// ═══════════════════════════════════════════════════════════
//  Priceless NextCar — Smart Shuttle Tracker
//  Bouncie GPS + Learning Engine (auto-improving ETA)
// ═══════════════════════════════════════════════════════════

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ─── Bouncie API Config ───
const BOUNCIE_API = "https://api.bouncie.dev/v1";
const BOUNCIE_AUTH = "https://auth.bouncie.com/oauth/token";
const CLIENT_ID = process.env.BOUNCIE_CLIENT_ID;
const CLIENT_SECRET = process.env.BOUNCIE_CLIENT_SECRET;
const REDIRECT_URI = process.env.BOUNCIE_REDIRECT_URI;
const AUTH_CODE = process.env.BOUNCIE_AUTH_CODE;
const POLL_INTERVAL = Math.max(10, parseInt(process.env.POLL_INTERVAL) || 10) * 1000;

// ─── Fixed Locations ───
const OFFICE = { lat: 33.9479, lng: -118.3840 }; // 5835 W 98th St (Priceless/NextCar office)
const LAX    = { lat: 33.9497, lng: -118.3918 }; // 6129 W 96th St - LAX Economy Parking (pickup/dropoff)

// ─── State ───
let accessToken = null;
let tokenExpiry = 0;
let vehicles = [];
let latestPositions = {};
let lastMovedAt = {};  // imei -> Date when van last had speed > 2mph

// ═══════════════════════════════════════════════════
//  DATABASE — Trip Logger & Learning Engine
// ═══════════════════════════════════════════════════
const db = new Database(path.join(__dirname, "shuttle-brain.db"));
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imei TEXT NOT NULL,
    direction TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_sec INTEGER,
    day_of_week INTEGER,
    hour_of_day INTEGER,
    avg_speed REAL,
    distance_miles REAL,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS breadcrumbs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER,
    imei TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed REAL,
    heading REAL,
    progress REAL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id)
  );

  CREATE INDEX IF NOT EXISTS idx_trips_direction ON trips(direction, status);
  CREATE INDEX IF NOT EXISTS idx_trips_hour ON trips(hour_of_day, day_of_week);
  CREATE INDEX IF NOT EXISTS idx_breadcrumbs_trip ON breadcrumbs(trip_id);
`);

// Prepared statements for speed
const insertTrip = db.prepare(`
  INSERT INTO trips (imei, direction, started_at, day_of_week, hour_of_day, status)
  VALUES (?, ?, ?, ?, ?, 'active')
`);

const endTrip = db.prepare(`
  UPDATE trips SET ended_at = ?, duration_sec = ?, avg_speed = ?, distance_miles = ?, status = 'completed'
  WHERE id = ?
`);

const insertBreadcrumb = db.prepare(`
  INSERT INTO breadcrumbs (trip_id, imei, lat, lng, speed, heading, progress, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getActiveTrip = db.prepare(`
  SELECT * FROM trips WHERE imei = ? AND status = 'active' ORDER BY id DESC LIMIT 1
`);

const getAvgDuration = db.prepare(`
  SELECT AVG(duration_sec) as avg_sec, COUNT(*) as trips
  FROM trips
  WHERE direction = ? AND status = 'completed' AND duration_sec BETWEEN 60 AND 1800 AND avg_speed > 3
`);

const getAvgDurationByHour = db.prepare(`
  SELECT AVG(duration_sec) as avg_sec, COUNT(*) as trips
  FROM trips
  WHERE direction = ? AND status = 'completed' AND duration_sec BETWEEN 60 AND 1800 AND avg_speed > 3
  AND hour_of_day = ?
`);

const getAvgDurationByHourAndDay = db.prepare(`
  SELECT AVG(duration_sec) as avg_sec, COUNT(*) as trips
  FROM trips
  WHERE direction = ? AND status = 'completed' AND duration_sec BETWEEN 60 AND 1800 AND avg_speed > 3
  AND hour_of_day = ? AND day_of_week = ?
`);

const getProgressAtTime = db.prepare(`
  SELECT AVG(progress) as avg_progress
  FROM breadcrumbs b
  JOIN trips t ON b.trip_id = t.id
  WHERE t.direction = ? AND t.status = 'completed'
  AND CAST((julianday(b.recorded_at) - julianday(t.started_at)) * 86400 AS INTEGER)
    BETWEEN ? AND ?
`);

const getStats = db.prepare(`
  SELECT
    COUNT(*) as total_trips,
    AVG(duration_sec) as avg_duration,
    MIN(duration_sec) as fastest,
    MAX(duration_sec) as slowest
  FROM trips WHERE status = 'completed' AND duration_sec BETWEEN 60 AND 1800 AND avg_speed > 3
`);

// Recent averages (last hour) per direction — exclude idle/parked "trips"
const getRecentAvg = db.prepare(`
  SELECT
    AVG(duration_sec) as avg_sec,
    COUNT(*) as trips,
    MIN(duration_sec) as fastest,
    MAX(duration_sec) as slowest
  FROM trips
  WHERE direction = ? AND status = 'completed'
  AND duration_sec BETWEEN 60 AND 1800
  AND avg_speed > 3
  AND ended_at > datetime('now', '-1 hour')
`);

// All-time averages per direction — exclude idle/parked "trips"
const getAllTimeAvg = db.prepare(`
  SELECT
    AVG(duration_sec) as avg_sec,
    COUNT(*) as trips
  FROM trips
  WHERE direction = ? AND status = 'completed'
  AND duration_sec BETWEEN 60 AND 1800
  AND avg_speed > 3
`);

// ─── Trip state tracking per vehicle ───
let activeTrips = {}; // imei -> { tripId, direction, startTime, speedSamples, startPos }

function trackTrip(pos, direction, progress) {
  const imei = pos.imei;
  const now = new Date();
  const active = activeTrips[imei];

  // If direction changed or no active trip, start a new one
  if (!active || active.direction !== direction) {
    // End previous trip if exists
    if (active) {
      const durationSec = Math.round((now - active.startTime) / 1000);
      const avgSpeed = active.speedSamples.length > 0
        ? active.speedSamples.reduce((a, b) => a + b, 0) / active.speedSamples.length
        : 0;
      const dist = calcDistance(active.startPos, pos);
      try {
        endTrip.run(now.toISOString(), durationSec, avgSpeed, dist, active.tripId);
        console.log(`[Brain] Trip #${active.tripId} completed: ${durationSec}s, ${avgSpeed.toFixed(1)}mph avg`);
      } catch (e) { /* ignore */ }
    }

    // Start new trip (only for actual movement directions)
    if (direction === "to-office" || direction === "to-lax") {
      try {
        const result = insertTrip.run(imei, direction, now.toISOString(), now.getDay(), now.getHours());
        activeTrips[imei] = {
          tripId: result.lastInsertRowid,
          direction,
          startTime: now,
          speedSamples: [pos.speed || 0],
          startPos: { lat: pos.lat, lng: pos.lng },
        };
        console.log(`[Brain] New trip #${result.lastInsertRowid}: ${direction}`);
      } catch (e) { console.error("[Brain] Trip start error:", e.message); }
    } else {
      // At a location — no active trip
      if (active) {
        const durationSec = Math.round((now - active.startTime) / 1000);
        const avgSpeed = active.speedSamples.length > 0
          ? active.speedSamples.reduce((a, b) => a + b, 0) / active.speedSamples.length
          : 0;
        const dist = calcDistance(active.startPos, pos);
        try {
          endTrip.run(now.toISOString(), durationSec, avgSpeed, dist, active.tripId);
        } catch (e) { /* ignore */ }
      }
      delete activeTrips[imei];
    }
  } else if (active) {
    // Same direction — log breadcrumb and speed
    active.speedSamples.push(pos.speed || 0);
    try {
      insertBreadcrumb.run(
        active.tripId, imei, pos.lat, pos.lng,
        pos.speed || 0, pos.heading || 0, progress,
        now.toISOString()
      );
    } catch (e) { /* ignore */ }
  }
}

// ═══════════════════════════════════════════════════
//  PREDICTION ENGINE v2 — NASA-grade ETA
//
//  Uses 5 independent prediction methods and blends
//  them with confidence-weighted averaging:
//
//  1. SEGMENT TIME — how long did past trips take from
//     THIS exact progress % to 100%? (most accurate)
//  2. CONTEXTUAL AVG — same direction + hour + day of week
//  3. HOURLY AVG — same direction + hour (any day)
//  4. OVERALL AVG — all completed trips for this direction
//  5. SPEED-BASED — remaining distance ÷ current speed
//     (real-time, good when moving, bad when stopped)
//
//  Each method returns { etaSec, confidence }.
//  Final ETA = weighted average by confidence.
// ═══════════════════════════════════════════════════

// Query: how long from progress X% to arrival, in past trips?
const getSegmentTime = db.prepare(`
  SELECT
    t.duration_sec,
    b.progress as start_progress,
    b.recorded_at as crumb_time,
    t.started_at,
    t.ended_at
  FROM breadcrumbs b
  JOIN trips t ON b.trip_id = t.id
  WHERE t.direction = ? AND t.status = 'completed' AND t.duration_sec BETWEEN 60 AND 1800 AND t.avg_speed > 3
  AND b.progress BETWEEN ? AND ?
  ORDER BY b.recorded_at DESC
  LIMIT 50
`);

// Query: recent trips (last 20) with recency weighting
const getRecentTrips = db.prepare(`
  SELECT duration_sec, hour_of_day, day_of_week, ended_at
  FROM trips
  WHERE direction = ? AND status = 'completed' AND duration_sec > 30
  ORDER BY id DESC
  LIMIT 20
`);

function predictETA(direction, progress, fallbackDistMiles, currentSpeed) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const speed = currentSpeed || 0;
  const methods = [];

  // ── METHOD 1: Segment Time (highest accuracy) ──
  // Find breadcrumbs from past trips at similar progress, calculate
  // how much time remained from that point to trip end
  try {
    const crumbs = getSegmentTime.all(direction, progress - 5, progress + 5);
    if (crumbs.length >= 2) {
      const remainingTimes = [];
      for (const c of crumbs) {
        const crumbTime = new Date(c.crumb_time).getTime();
        const endTime = new Date(c.ended_at).getTime();
        const remainSec = (endTime - crumbTime) / 1000;
        if (remainSec > 0 && remainSec < 3600) { // sanity: < 1 hour
          remainingTimes.push(remainSec);
        }
      }
      if (remainingTimes.length >= 2) {
        // Use median (resistant to outliers)
        remainingTimes.sort((a, b) => a - b);
        const mid = Math.floor(remainingTimes.length / 2);
        const median = remainingTimes.length % 2 === 0
          ? (remainingTimes[mid - 1] + remainingTimes[mid]) / 2
          : remainingTimes[mid];
        methods.push({
          name: "segment",
          etaSec: median,
          confidence: Math.min(remainingTimes.length * 15, 95), // max 95
        });
      }
    }
  } catch (e) { /* skip */ }

  // ── METHOD 2: Contextual Average (direction + hour + day) ──
  try {
    const ctx = getAvgDurationByHourAndDay.get(direction, hour, day);
    if (ctx && ctx.trips >= 2 && ctx.avg_sec > 0) {
      const remaining = Math.max(0, 100 - progress) / 100;
      methods.push({
        name: `context (${ctx.trips} trips, ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]} ${hour}:00)`,
        etaSec: ctx.avg_sec * remaining,
        confidence: Math.min(ctx.trips * 12, 80),
      });
    }
  } catch (e) { /* skip */ }

  // ── METHOD 3: Hourly Average (direction + hour, any day) ──
  try {
    const hourly = getAvgDurationByHour.get(direction, hour);
    if (hourly && hourly.trips >= 2 && hourly.avg_sec > 0) {
      const remaining = Math.max(0, 100 - progress) / 100;
      methods.push({
        name: `hourly (${hourly.trips} trips at ${hour}:00)`,
        etaSec: hourly.avg_sec * remaining,
        confidence: Math.min(hourly.trips * 8, 60),
      });
    }
  } catch (e) { /* skip */ }

  // ── METHOD 4: Overall Average (all trips, this direction) ──
  try {
    const overall = getAvgDuration.get(direction);
    if (overall && overall.trips >= 2 && overall.avg_sec > 0) {
      const remaining = Math.max(0, 100 - progress) / 100;
      methods.push({
        name: `overall (${overall.trips} trips)`,
        etaSec: overall.avg_sec * remaining,
        confidence: Math.min(overall.trips * 5, 40),
      });
    }
  } catch (e) { /* skip */ }

  // ── METHOD 5: Speed-Based (real-time) ──
  if (speed >= 3 && fallbackDistMiles > 0.01) {
    // Use current speed but add 20% buffer for stops/turns/traffic
    const etaSec = (fallbackDistMiles / speed) * 3600 * 1.2;
    methods.push({
      name: "live speed",
      etaSec,
      confidence: 25, // low — speed changes constantly
    });
  }

  // ── BLEND: Weighted average by confidence ──
  if (methods.length > 0) {
    // Apply recency bonus to recent trips
    let totalWeight = 0;
    let weightedSum = 0;
    const details = [];

    for (const m of methods) {
      totalWeight += m.confidence;
      weightedSum += m.etaSec * m.confidence;
      details.push(`${m.name}:${Math.round(m.etaSec/60)}m@${m.confidence}%`);
    }

    const blendedSec = weightedSum / totalWeight;
    const etaMin = Math.max(1, Math.round(blendedSec / 60));
    const topMethod = methods.reduce((a, b) => a.confidence > b.confidence ? a : b);
    const totalConfidence = Math.min(Math.round(totalWeight / methods.length), 99);

    console.log(`[Brain] ETA blend: ${details.join(' | ')} → ${etaMin}min`);

    return {
      eta: etaMin,
      confidence: totalConfidence,
      source: `${methods.length} models, led by ${topMethod.name}`,
      learned: true,
      methods: methods.length,
    };
  }

  // ── FALLBACK: Distance-only (dumb mode, day 1) ──
  // Assume 25mph average with 30% traffic buffer for LAX area
  const avgSpeedMph = 25;
  const etaSec = (fallbackDistMiles / avgSpeedMph) * 3600 * 1.3;
  const etaMin = Math.max(1, Math.round(etaSec / 60));
  return {
    eta: etaMin,
    confidence: 0,
    source: "distance estimate (learning...)",
    learned: false,
    methods: 0,
  };
}

// ═══════════════════════════════════════════════════
//  BOUNCIE API
// ═══════════════════════════════════════════════════
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  console.log("[Bouncie] Exchanging auth code for access token...");
  try {
    const res = await fetch(BOUNCIE_AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: AUTH_CODE,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    console.log("[Bouncie] Access token obtained");
    return accessToken;
  } catch (e) {
    console.error("[Bouncie] Auth error:", e.message);
    return null;
  }
}

async function bouncieGet(endpoint, params = {}) {
  const token = await getAccessToken();
  if (!token) return null;
  const url = new URL(`${BOUNCIE_API}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: token }, timeout: 10000 });
  if (res.status === 401) {
    accessToken = null; tokenExpiry = 0;
    const newToken = await getAccessToken();
    if (!newToken) return null;
    const retry = await fetch(url.toString(), { headers: { Authorization: newToken }, timeout: 10000 });
    if (!retry.ok) return null;
    return retry.json();
  }
  if (!res.ok) return null;
  return res.json();
}

// ─── Math ───
function calcDistance(p1, p2) {
  const R = 3959;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = ((p2.lng || p2.lon) - (p1.lng || p1.lon)) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Poll & Learn ───
async function pollLocations() {
  try {
    const data = await bouncieGet("/vehicles");
    if (!data || !Array.isArray(data)) return;
    vehicles = data;

    for (const vehicle of vehicles) {
      const loc = vehicle.stats && vehicle.stats.location;
      if (!loc || !loc.lat) continue;

      const pos = {
        lat: loc.lat,
        lng: loc.lon,
        speed: vehicle.stats.speed || 0,
        heading: loc.heading || 0,
        isRunning: vehicle.stats.isRunning || false,
        fuelLevel: vehicle.stats.fuelLevel || 0,
        timestamp: vehicle.stats.lastUpdated || new Date().toISOString(),
        nickName: vehicle.nickName || `Vehicle`,
        imei: vehicle.imei,
      };

      latestPositions[vehicle.imei] = pos;

      // Track when van last moved (speed > 2mph)
      if (pos.speed > 2) {
        lastMovedAt[vehicle.imei] = new Date();
      } else if (!lastMovedAt[vehicle.imei]) {
        lastMovedAt[vehicle.imei] = new Date(); // assume just started tracking
      }

      // Calculate direction & progress
      const shuttle = buildShuttleData(pos, 0);

      // Log to brain
      trackTrip(pos, shuttle.direction, shuttle.progress);

      console.log(`[GPS] ${pos.lat.toFixed(4)},${pos.lng.toFixed(4)} | ${pos.speed}mph | ${shuttle.direction} | ETA: ${shuttle.prediction.eta}min (${shuttle.prediction.source})`);
    }
  } catch (e) {
    console.error("[Poll] Error:", e.message);
  }
}

// Calculate bearing from point A to point B (in degrees)
function calcBearing(from, to) {
  const dLng = ((to.lng || to.lon) - (from.lng || from.lon)) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function buildShuttleData(pos, index) {
  const distToOffice = calcDistance(pos, OFFICE);
  const distToLax = calcDistance(pos, LAX);
  const totalDist = calcDistance(OFFICE, LAX);

  let direction, progress;
  const speed = pos.speed || 0;
  const heading = pos.heading || 0;

  // If parked (close to a location and not moving)
  if (distToOffice < 0.05 && speed < 3) {
    direction = "at-office"; progress = 100;
  } else if (distToLax < 0.05 && speed < 3) {
    direction = "at-lax"; progress = 0;
  } else if (speed >= 3) {
    // Moving — use heading to determine direction
    const bearingToOffice = calcBearing(pos, OFFICE);
    const bearingToLax = calcBearing(pos, LAX);

    // How close is the van's heading to each destination? (0-180, lower = more aligned)
    const diffToOffice = Math.abs(((heading - bearingToOffice + 540) % 360) - 180);
    const diffToLax = Math.abs(((heading - bearingToLax + 540) % 360) - 180);

    if (diffToOffice < diffToLax) {
      direction = "to-office";
      progress = Math.round((1 - distToOffice / totalDist) * 100);
    } else {
      direction = "to-lax";
      progress = Math.round((1 - distToLax / totalDist) * 100);
    }
  } else {
    // Not moving, not at a location — use proximity
    if (distToOffice < distToLax) {
      direction = "at-office"; progress = 100;
    } else {
      direction = "at-lax"; progress = 0;
    }
  }
  progress = Math.min(100, Math.max(0, progress));

  const relevantDist = direction.includes("office") ? distToOffice : distToLax;
  const prediction = predictETA(direction, progress, relevantDist, pos.speed);

  return {
    id: index,
    name: pos.nickName,
    imei: pos.imei,
    lat: pos.lat,
    lng: pos.lng,
    speed: Math.round(pos.speed || 0),
    heading: Math.round(pos.heading || 0),
    isRunning: pos.isRunning,
    direction,
    progress,
    prediction,
    distToOffice: distToOffice.toFixed(2),
    distToLax: distToLax.toFixed(2),
    timestamp: pos.timestamp,
  };
}

// ═══════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════
app.get("/api/shuttles", (req, res) => {
  // Filter out vans parked for more than 30 minutes
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min in ms
  const now = Date.now();
  const positions = Object.values(latestPositions).filter(pos => {
    const lastMoved = lastMovedAt[pos.imei];
    if (!lastMoved) return true; // no data yet, show it
    return (now - lastMoved.getTime()) < IDLE_TIMEOUT;
  });
  if (positions.length === 0) {
    return res.json({
      mode: "waiting",
      shuttles: [],
      message: "Waiting for GPS signal...",
      vehicleCount: vehicles.length,
      lastUpdate: new Date().toISOString(),
    });
  }
  const shuttles = positions.map((pos, i) => buildShuttleData(pos, i));

  // Trip averages for display
  const toOfficeRecent = getRecentAvg.get("to-office");
  const toLaxRecent = getRecentAvg.get("to-lax");
  const toOfficeAll = getAllTimeAvg.get("to-office");
  const toLaxAll = getAllTimeAvg.get("to-lax");

  const avgTrips = {
    toOffice: toOfficeRecent && toOfficeRecent.trips >= 1
      ? { avgMin: Math.round(toOfficeRecent.avg_sec / 60), trips: toOfficeRecent.trips, source: "last hour" }
      : toOfficeAll && toOfficeAll.trips >= 1
        ? { avgMin: Math.round(toOfficeAll.avg_sec / 60), trips: toOfficeAll.trips, source: "all time" }
        : null,
    toLax: toLaxRecent && toLaxRecent.trips >= 1
      ? { avgMin: Math.round(toLaxRecent.avg_sec / 60), trips: toLaxRecent.trips, source: "last hour" }
      : toLaxAll && toLaxAll.trips >= 1
        ? { avgMin: Math.round(toLaxAll.avg_sec / 60), trips: toLaxAll.trips, source: "all time" }
        : null,
  };

  res.json({
    mode: "live",
    shuttles,
    avgTrips,
    vehicleCount: vehicles.length,
    lastUpdate: new Date().toISOString(),
  });
});

app.get("/api/brain", (req, res) => {
  const stats = getStats.get();
  const toOffice = getAvgDuration.get("to-office");
  const toLax = getAvgDuration.get("to-lax");

  // Hourly breakdown for today
  const now = new Date();
  const hourly = [];
  for (let h = 6; h <= 22; h++) {
    const o = getAvgDurationByHour.get("to-office", h);
    const l = getAvgDurationByHour.get("to-lax", h);
    hourly.push({
      hour: h,
      toOffice: o && o.trips >= 1 ? { avgMin: Math.round(o.avg_sec / 60), trips: o.trips } : null,
      toLax: l && l.trips >= 1 ? { avgMin: Math.round(l.avg_sec / 60), trips: l.trips } : null,
    });
  }

  res.json({
    totalTrips: stats.total_trips,
    avgDurationMin: stats.avg_duration ? Math.round(stats.avg_duration / 60) : null,
    fastestMin: stats.fastest ? Math.round(stats.fastest / 60) : null,
    slowestMin: stats.slowest ? Math.round(stats.slowest / 60) : null,
    routes: {
      toOffice: toOffice && toOffice.trips >= 1
        ? { avgMin: Math.round(toOffice.avg_sec / 60), trips: toOffice.trips }
        : null,
      toLax: toLax && toLax.trips >= 1
        ? { avgMin: Math.round(toLax.avg_sec / 60), trips: toLax.trips }
        : null,
    },
    hourlyBreakdown: hourly,
  });
});

app.get("/api/status", (req, res) => {
  const stats = getStats.get();
  res.json({
    configured: !!(CLIENT_ID && CLIENT_SECRET && AUTH_CODE),
    connected: !!accessToken,
    vehicleCount: vehicles.length,
    pollInterval: POLL_INTERVAL / 1000,
    brain: {
      totalTrips: stats.total_trips,
      learned: stats.total_trips >= 3,
    },
  });
});

app.get("/api/debug", async (req, res) => {
  const allVehicles = await bouncieGet("/vehicles");
  res.json({ allVehicles, positions: latestPositions });
});

// ─── Start ───
const PORT = process.env.PORT || 3488;
app.listen(PORT, async () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════╗");
  console.log("  ║   PRICELESS NEXTCAR — Smart Shuttle Tracker      ║");
  console.log(`  ║   http://localhost:${PORT}                            ║`);
  console.log("  ║   Brain: shuttle-brain.db (auto-learning)        ║");
  console.log("  ╚══════════════════════════════════════════════════╝");
  console.log("");

  const stats = getStats.get();
  console.log(`  [Brain] ${stats.total_trips} trips logged so far`);

  if (CLIENT_ID && CLIENT_SECRET && AUTH_CODE) {
    console.log("  [Bouncie] Credentials found, connecting...");
    await fetchVehicles();
    console.log(`  [Bouncie] ${vehicles.length} vehicle(s) found`);
    console.log(`  [Bouncie] Polling every ${POLL_INTERVAL / 1000}s`);
    await pollLocations();
    setInterval(pollLocations, POLL_INTERVAL);
  } else {
    console.log("  ⚠  No Bouncie credentials in .env");
  }
  console.log("");
});

async function fetchVehicles() {
  const data = await bouncieGet("/vehicles");
  if (data && Array.isArray(data)) {
    vehicles = data;
    vehicles.forEach((v, i) => {
      console.log(`  [${i}] ${v.nickName || "Unknown"} — IMEI: ${v.imei}`);
    });
  }
}
