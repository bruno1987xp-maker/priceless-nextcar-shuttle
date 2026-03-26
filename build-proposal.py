from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

W, H = letter
output = 'Shuttle-Tracker-Proposal-AMPM.pdf'
c = canvas.Canvas(output, pagesize=letter)

NAVY = HexColor('#0B1426')
DARK_BLUE = HexColor('#1A2744')
ACCENT = HexColor('#146FF4')
WHITE = HexColor('#FFFFFF')
LIGHT_GRAY = HexColor('#F5F7FA')
MED_GRAY = HexColor('#8B9BBF')
DARK_TEXT = HexColor('#1E293B')
BODY_TEXT = HexColor('#475569')

def draw_header_bar(c, y_top, height):
    c.setFillColor(NAVY)
    c.rect(0, y_top - height, W, height, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(0, y_top - height, W, 3, fill=1, stroke=0)

# ========== PAGE 1 - COVER ==========
c.setFillColor(NAVY)
c.rect(0, 0, W, H, fill=1, stroke=0)

c.setFillColor(ACCENT)
c.rect(0, H - 8, W, 8, fill=1, stroke=0)

y = H - 120
c.setFillColor(ACCENT)
c.roundRect(72, y, 120, 32, 4, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 14)
c.drawString(82, y + 10, 'PRICELESS')

c.setFillColor(HexColor('#2ECC71'))
c.roundRect(200, y, 110, 32, 4, fill=1, stroke=0)
c.setFillColor(WHITE)
c.drawString(215, y + 10, 'NEXTCAR')

c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 36)
c.drawString(72, H - 220, 'Shuttle Tracking')
c.drawString(72, H - 265, 'System')

c.setFillColor(ACCENT)
c.rect(72, H - 285, 80, 4, fill=1, stroke=0)

c.setFillColor(WHITE)
c.setFont('Helvetica', 18)
c.drawString(72, H - 315, 'Project Proposal')

y_box = H - 440
c.setFillColor(DARK_BLUE)
c.roundRect(72, y_box, W - 144, 100, 6, fill=1, stroke=0)

c.setFillColor(MED_GRAY)
c.setFont('Helvetica', 9)
c.drawString(92, y_box + 75, 'PREPARED FOR')
c.drawString(300, y_box + 75, 'PREPARED BY')
c.drawString(470, y_box + 75, 'DATE')

c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 14)
c.drawString(92, y_box + 50, 'AMPM')
c.drawString(300, y_box + 50, 'Bruno Prado')
c.drawString(470, y_box + 50, 'March 26, 2026')

c.setFillColor(MED_GRAY)
c.setFont('Helvetica', 10)
c.drawString(92, y_box + 30, 'Board of Directors')
c.drawString(300, y_box + 30, 'Technology Consultant')

c.setFillColor(ACCENT)
c.rect(0, 0, W, 6, fill=1, stroke=0)
c.showPage()

# ========== PAGE 2 - EXECUTIVE SUMMARY + SCOPE ==========
c.setFillColor(LIGHT_GRAY)
c.rect(0, 0, W, H, fill=1, stroke=0)

draw_header_bar(c, H, 60)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 11)
c.drawString(72, H - 40, 'PRICELESS NEXTCAR')
c.setFont('Helvetica', 9)
c.drawRightString(W - 72, H - 40, 'Shuttle Tracking System Proposal')

y = H - 100
c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 9)
c.drawString(72, y, 'EXECUTIVE SUMMARY')
y -= 8
c.rect(72, y, 40, 2, fill=1, stroke=0)
y -= 20

c.setFillColor(DARK_TEXT)
c.setFont('Helvetica', 10)
lines = [
    'A custom-built, real-time GPS shuttle tracking system for Priceless NextCar,',
    'designed to be displayed on a TV screen at the rental office near LAX. The system',
    'uses Bouncie GPS hardware to track shuttle vans in real-time, showing customers',
    'exactly where their shuttle is and providing AI-powered ETA predictions that',
    'improve automatically with every trip completed.',
]
for line in lines:
    c.drawString(72, y, line)
    y -= 16

y -= 25
c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 9)
c.drawString(72, y, 'PROJECT SCOPE')
y -= 8
c.rect(72, y, 40, 2, fill=1, stroke=0)
y -= 25

scope_items = [
    ('Custom Real-Time GPS Web Application', 'Full-stack web app with live satellite map, shuttle markers, and GPS breadcrumb trails'),
    ('Bouncie GPS API Integration', 'Server backend connecting to Bouncie hardware for continuous location data'),
    ('AI-Powered ETA Prediction Engine', 'Machine learning system that logs every trip and improves ETA accuracy daily'),
    ('Professional TV Display', 'Satellite map with company branding, optimized for large screen viewing'),
    ('Custom Location Markers', 'LAX Economy Parking pickup (6129 W 96th St) and office (5835 W 98th St)'),
    ('Auto-Deploy Infrastructure', 'GitHub + Render hosting with instant updates when code changes'),
    ('Standby Mode', 'Branded screen with company logos when shuttle is parked'),
    ('Board Presentation Deck', 'Professional slide deck for stakeholder presentations'),
]

for i, (title, desc) in enumerate(scope_items):
    c.setFillColor(WHITE)
    c.roundRect(72, y - 38, W - 144, 42, 4, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.circle(90, y - 15, 4, fill=1, stroke=0)
    c.setFillColor(DARK_TEXT)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(102, y - 12, title)
    c.setFillColor(BODY_TEXT)
    c.setFont('Helvetica', 8.5)
    c.drawString(102, y - 28, desc)
    y -= 50

c.setFillColor(MED_GRAY)
c.setFont('Helvetica', 8)
c.drawString(72, 30, 'Bruno Prado | Technology Consultant')
c.drawRightString(W - 72, 30, 'Page 2')
c.showPage()

# ========== PAGE 3 - INVESTMENT ==========
c.setFillColor(LIGHT_GRAY)
c.rect(0, 0, W, H, fill=1, stroke=0)

draw_header_bar(c, H, 60)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 11)
c.drawString(72, H - 40, 'PRICELESS NEXTCAR')
c.setFont('Helvetica', 9)
c.drawRightString(W - 72, H - 40, 'Shuttle Tracking System Proposal')

y = H - 100
c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 9)
c.drawString(72, y, 'INVESTMENT BREAKDOWN')
y -= 8
c.rect(72, y, 40, 2, fill=1, stroke=0)
y -= 30

c.setFillColor(NAVY)
c.roundRect(72, y - 5, W - 144, 28, 4, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 9)
c.drawString(92, y + 2, 'COMPONENT')
c.drawRightString(W - 92, y + 2, 'RETAIL VALUE')
y -= 15

items = [
    ('Custom Real-Time GPS Web Application', '$5,000'),
    ('Bouncie API Integration & Server Backend', '$2,000'),
    ('AI Learning Engine (ETA Prediction & Trip History)', '$3,000'),
    ('Professional TV Display & UI Design', '$1,500'),
    ('Satellite Map with Custom Branding', '$800'),
    ('Hosting Setup & Auto-Deploy Pipeline', '$700'),
    ('Board Presentation Deck', '$500'),
]

for i, (item, retail) in enumerate(items):
    y -= 32
    bg = WHITE if i % 2 == 0 else LIGHT_GRAY
    c.setFillColor(bg)
    c.rect(72, y - 5, W - 144, 28, fill=1, stroke=0)
    c.setFillColor(DARK_TEXT)
    c.setFont('Helvetica', 9.5)
    c.drawString(92, y + 3, item)
    c.setFillColor(MED_GRAY)
    c.setFont('Helvetica', 9.5)
    c.drawRightString(W - 92, y + 3, retail)

y -= 32
c.setFillColor(HexColor('#E8EDF5'))
c.rect(72, y - 5, W - 144, 28, fill=1, stroke=0)
c.setFillColor(DARK_TEXT)
c.setFont('Helvetica-Bold', 10)
c.drawString(92, y + 3, 'Retail Total')
c.setFillColor(MED_GRAY)
c.drawRightString(W - 92, y + 3, '$13,500')

y -= 36
c.setFillColor(ACCENT)
c.roundRect(72, y - 8, W - 144, 36, 4, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 12)
c.drawString(92, y + 3, 'BUNDLED PROJECT PRICE')
c.setFont('Helvetica-Bold', 16)
c.drawRightString(W - 92, y + 1, '$6,500')

y -= 40
c.setFillColor(HexColor('#E8F5E9'))
c.roundRect(72, y - 5, W - 144, 28, 4, fill=1, stroke=0)
c.setFillColor(HexColor('#2E7D32'))
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W / 2, y + 3, 'You save $7,000 (52% discount)')

y -= 55
c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 9)
c.drawString(72, y, 'MONTHLY MAINTENANCE')
y -= 8
c.rect(72, y, 40, 2, fill=1, stroke=0)
y -= 25

c.setFillColor(WHITE)
c.roundRect(72, y - 60, W - 144, 80, 6, fill=1, stroke=0)

c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 24)
c.drawString(92, y - 5, '$200')
c.setFillColor(BODY_TEXT)
c.setFont('Helvetica', 12)
c.drawString(175, y - 3, '/ month')

maint_items = [
    'Hosting management & monitoring',
    'Code updates & feature requests',
    'System uptime monitoring',
]
c.setFont('Helvetica', 9)
x_start = 310
for i, item in enumerate(maint_items):
    c.setFillColor(ACCENT)
    c.circle(x_start, y - 5 - (i * 16), 2.5, fill=1, stroke=0)
    c.setFillColor(BODY_TEXT)
    c.drawString(x_start + 10, y - 9 - (i * 16), item)

c.setFillColor(MED_GRAY)
c.setFont('Helvetica-Oblique', 8)
c.drawString(92, y - 50, 'Bouncie GPS subscription (~$8/mo) managed separately by client')

c.setFillColor(MED_GRAY)
c.setFont('Helvetica', 8)
c.drawString(72, 30, 'Bruno Prado | Technology Consultant')
c.drawRightString(W - 72, 30, 'Page 3')
c.showPage()

# ========== PAGE 4 - DELIVERABLES + TERMS ==========
c.setFillColor(LIGHT_GRAY)
c.rect(0, 0, W, H, fill=1, stroke=0)

draw_header_bar(c, H, 60)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 11)
c.drawString(72, H - 40, 'PRICELESS NEXTCAR')
c.setFont('Helvetica', 9)
c.drawRightString(W - 72, H - 40, 'Shuttle Tracking System Proposal')

y = H - 100
c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 9)
c.drawString(72, y, "WHAT'S INCLUDED")
y -= 8
c.rect(72, y, 40, 2, fill=1, stroke=0)
y -= 25

deliverables = [
    ('24/7 Live Tracking Display', 'Real-time satellite map showing shuttle position updated every 10 seconds'),
    ('Smart ETA Predictions', 'AI engine that learns from every trip and gets more accurate every day'),
    ('Automatic Destination Detection', 'System predicts where shuttle is heading based on learned patterns'),
    ('GPS Breadcrumb Trail', 'Visual trail showing the actual path the shuttle has driven'),
    ('Professional Company Branding', 'Priceless & NextCar logos, branded markers, and custom color scheme'),
    ('Standby Screen', 'Elegant branded display when shuttle is parked with company logos'),
    ('Mobile-Accessible URL', 'Access the tracker from any device, anywhere via web browser'),
    ('Instant Code Updates', 'Changes deployed to the live site in under 30 seconds'),
]

for i, (title, desc) in enumerate(deliverables):
    c.setFillColor(WHITE)
    c.roundRect(72, y - 38, W - 144, 42, 4, fill=1, stroke=0)
    c.setFillColor(HexColor('#2ECC71'))
    c.setFont('Helvetica-Bold', 14)
    c.drawString(86, y - 18, '\xe2\x9c\x93'.encode().decode('utf-8') if False else 'V')
    c.setFillColor(DARK_TEXT)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(108, y - 12, title)
    c.setFillColor(BODY_TEXT)
    c.setFont('Helvetica', 8.5)
    c.drawString(108, y - 28, desc)
    y -= 50

y -= 15
c.setFillColor(ACCENT)
c.setFont('Helvetica-Bold', 9)
c.drawString(72, y, 'PAYMENT TERMS')
y -= 8
c.rect(72, y, 40, 2, fill=1, stroke=0)
y -= 25

terms = [
    ('50% Deposit', '$3,250', 'Due upon agreement'),
    ('50% On Delivery', '$3,250', 'Due upon completion'),
    ('Monthly Maintenance', '$200/mo', 'Billed on the 1st'),
]

card_w = (W - 144 - 24) / 3
for i, (label, amount, desc) in enumerate(terms):
    x = 72 + i * (card_w + 12)
    c.setFillColor(WHITE)
    c.roundRect(x, y - 55, card_w, 65, 4, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.setFont('Helvetica-Bold', 18)
    c.drawString(x + 12, y - 15, amount)
    c.setFillColor(DARK_TEXT)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x + 12, y - 33, label)
    c.setFillColor(BODY_TEXT)
    c.setFont('Helvetica', 7.5)
    c.drawString(x + 12, y - 47, desc)

c.setFillColor(MED_GRAY)
c.setFont('Helvetica', 8)
c.drawString(72, 30, 'Bruno Prado | Technology Consultant')
c.drawRightString(W - 72, 30, 'Page 4')
c.showPage()

# ========== PAGE 5 - SIGNATURE ==========
c.setFillColor(LIGHT_GRAY)
c.rect(0, 0, W, H, fill=1, stroke=0)

draw_header_bar(c, H, 60)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 11)
c.drawString(72, H - 40, 'PRICELESS NEXTCAR')
c.setFont('Helvetica', 9)
c.drawRightString(W - 72, H - 40, 'Shuttle Tracking System Proposal')

y = H - 140
c.setFillColor(DARK_TEXT)
c.setFont('Helvetica-Bold', 22)
c.drawCentredString(W / 2, y, 'Agreement & Authorization')
y -= 15
c.setFillColor(ACCENT)
c.rect(W / 2 - 30, y, 60, 2, fill=1, stroke=0)

y -= 40
c.setFillColor(BODY_TEXT)
c.setFont('Helvetica', 10)
lines = [
    'By signing below, both parties agree to the terms outlined in this proposal.',
    'This includes the project scope, investment of $6,500, and monthly maintenance of $200.',
]
for line in lines:
    c.drawCentredString(W / 2, y, line)
    y -= 18

y -= 50

for side, name, role in [('left', 'AMPM', 'Authorized Representative'), ('right', 'Bruno Prado', 'Technology Consultant')]:
    x = 72 if side == 'left' else W / 2 + 20
    box_w = W / 2 - 92

    c.setFillColor(WHITE)
    c.roundRect(x, y - 120, box_w, 140, 6, fill=1, stroke=0)

    c.setFillColor(ACCENT)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x + 16, y + 2, name)

    c.setFillColor(BODY_TEXT)
    c.setFont('Helvetica', 8)
    c.drawString(x + 16, y - 12, role)

    c.setStrokeColor(MED_GRAY)
    c.setLineWidth(0.5)
    c.line(x + 16, y - 60, x + box_w - 16, y - 60)
    c.setFillColor(MED_GRAY)
    c.setFont('Helvetica', 8)
    c.drawString(x + 16, y - 73, 'Signature')

    c.line(x + 16, y - 100, x + box_w - 16, y - 100)
    c.drawString(x + 16, y - 113, 'Date')

c.setFillColor(ACCENT)
c.rect(0, 0, W, 6, fill=1, stroke=0)

c.setFillColor(MED_GRAY)
c.setFont('Helvetica', 8)
c.drawString(72, 20, 'Bruno Prado | Technology Consultant')
c.drawRightString(W - 72, 20, 'Page 5')
c.showPage()

c.save()
print('PDF created: ' + output)
