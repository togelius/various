"""Contact sheet and phone mock-up for the art probe.

Usage: python -I sheets.py OUTDIR EXISTING_SHEET_PNG KENNEY_TILES_DIR SEED
Writes OUTDIR/contact_sheet.png and OUTDIR/phone_mockup_390x844_dpr3.png.
"""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont

OUT, EXISTING, KENNEY, SEED = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
SP = os.path.join(OUT, 'sprites')
IDS = ['doorstep', 'bollard', 'hound', 'moth', 'crane', 'bell']
NAMES = {'doorstep': 'marble doorstep', 'bollard': 'bronze bollard', 'hound': 'clockwork hound',
         'moth': 'pinned moth', 'crane': 'harbour crane', 'bell': 'bell on a float'}
OLD = ['amphora', 'automaton', 'docent', 'reliquary', 'astrolabe', 'being 1', 'being 2', 'being 3']
KEN = [(84, 'wizard'), (96, 'knight'), (121, 'ghost'), (122, 'spider'), (110, 'crab'), (65, 'tombstone'),
       (63, 'bookshelf'), (89, 'chest')]

def font(sz):
    return ImageFont.load_default(size=sz)

def existing_sprites(row=0):
    """Recover the 16x16 sprites from the 6x sheet (cell 18x18 at 4+c*20, sprite at +1,+1)."""
    sh = Image.open(EXISTING).convert('RGB')
    wall = {0: (0x26, 0x32, 0x4d), 1: (0x4a, 0x16, 0x20), 2: (0x4f, 0x5e, 0x48)}[row]
    out = []
    for c in range(8):
        x, y = (4 + c * 20 + 1) * 6, (4 + row * 20 + 1) * 6
        t = sh.crop((x, y, x + 96, y + 96)).resize((16, 16), Image.NEAREST).convert('RGBA')
        t.putdata([(0, 0, 0, 0) if p[:3] == wall else p for p in t.get_flattened_data()])
        out.append(t)
    return out

def gen(sid, n):
    p = os.path.join(SP, f'{sid}_s{SEED}_{n}.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

def raw(sid):
    p = os.path.join(OUT, 'raw', f'{sid}_s{SEED}.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

def kenney(i):
    return Image.open(os.path.join(KENNEY, 'tile_%04d.png' % i)).convert('RGBA')

# ------------------------------------------------------------------ contact sheet
CELL, GAP, LABW, ROWH = 96, 18, 330, 96 + 34
rows = [
    ('Planned: 16x16 code-drawn grids', '(LLM-written grids + Bollinger beings, existing probe) shown at 6x',
     [(s, n) for s, n in zip(existing_sprites(0), OLD)], 6),
    ('Generated, raw 768 px', 'SDXL 1.0 + LCM-LoRA + Pixel Art XL LoRA, CPU; smooth thumbnail',
     [(raw(s), NAMES[s]) for s in IDS], None),
    ('Generated -> 48x48', 'fixed 16-colour palette, block vote, shown at 2x', [(gen(s, 48), NAMES[s]) for s in IDS], 2),
    ('Generated -> 32x32', 'same, shown at 3x', [(gen(s, 32), NAMES[s]) for s in IDS], 3),
    ('Generated -> 32x32 + code cleanup', 'isolated pixels dropped, 1-px outline added; 3x',
     [(gen(s, '32clean'), NAMES[s]) for s in IDS], 3),
    ('Generated -> 16x16', 'same pipeline at the planned tile size, 6x', [(gen(s, 16), NAMES[s]) for s in IDS], 6),
    ('Downloaded: Kenney Tiny Dungeon', 'CC0 1.0, 16x16, shown at 6x', [(kenney(i), n) for i, n in KEN], 6),
]
def seed2(sid, kind):
    p = os.path.join(OUT, 'raw', f'{sid}_s202.png') if kind == 'raw' else os.path.join(SP, f'{sid}_s202_32clean.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None
if any(seed2(s_, 'raw') for s_ in IDS[:3]):
    items = []
    for s_ in IDS[:3]:
        items += [(seed2(s_, 'raw'), s_ + ', raw'), (seed2(s_, '32'), s_ + ', 32 clean')]
    rows.insert(5, ('Same prompts, seed 202', 'raw (smooth) and 32x32 cleaned (3x), for consistency', items, 'mixed'))
W = LABW + 8 * (CELL + GAP) + GAP
H = 70 + len(rows) * (ROWH + 14) + 70
sheet = Image.new('RGB', (W, H), (34, 34, 40))
d = ImageDraw.Draw(sheet)
d.text((GAP, 16), 'ACCESSION art probe: every tile below occupies the same 96 x 96 screen pixels', fill=(235, 235, 240), font=font(20))
d.text((GAP, 42), f'Generated row seed {SEED}. Prompts: "pixel art, <subject>, single object, centered, full view, plain white background, game sprite".',
       fill=(170, 170, 180), font=font(13))
y = 70
for title, sub, items, z in rows:
    d.text((GAP, y + 26), title, fill=(240, 220, 160), font=font(16))
    d.multiline_text((GAP, y + 48), sub.replace(', ', ',\n', 1) if len(sub) > 44 else sub, fill=(170, 170, 180), font=font(12))
    for k, (im, name) in enumerate(items):
        x = LABW + GAP + k * (CELL + GAP)
        d.rectangle([x - 1, y - 1, x + CELL, y + CELL], fill=(58, 60, 70), outline=(80, 82, 94))
        if im is not None:
            zz = z if z != 'mixed' else (None if im.width > 64 else 3)
            t = im.resize((96, 96), Image.LANCZOS) if zz is None else im.resize((im.width * zz, im.height * zz), Image.NEAREST)
            sheet.paste(t, (x + (CELL - t.width) // 2, y + (CELL - t.height) // 2), t)
        else:
            d.text((x + 20, y + 40), 'missing', fill=(200, 80, 80), font=font(12))
        d.text((x, y + CELL + 6), name, fill=(200, 200, 210), font=font(12))
    y += ROWH + 14
# palette strip
pp = json.load(open(os.path.join(SP, 'postprocess.json')))['palette']
d.text((GAP, y + 6), 'Fixed palette (authored for the probe):', fill=(200, 200, 210), font=font(13))
for k, (nm, hx) in enumerate(pp):
    x = LABW + GAP + k * 48
    d.rectangle([x, y + 4, x + 40, y + 30], fill=hx, outline=(20, 20, 20))
sheet.save(os.path.join(OUT, 'contact_sheet.png'))

# ------------------------------------------------------------------ phone mock-up (device pixels, DPR 3)
DPR = 3
PW, PH = 390 * DPR, 844 * DPR
BEZ = 36
ph = Image.new('RGB', (PW + 2 * BEZ, PH + 2 * BEZ), (12, 12, 14))
scr = Image.new('RGB', (PW, PH), (24, 26, 34))
s = ImageDraw.Draw(scr)
F = lambda css: font(int(css * DPR))
# top bar (48 CSS px)
s.rectangle([0, 0, PW, 48 * DPR], fill=(18, 20, 26))
s.rectangle([12 * DPR, 18 * DPR, 120 * DPR, 30 * DPR], fill=(150, 40, 40))
s.ellipse([170 * DPR, 8 * DPR, 202 * DPR, 40 * DPR], outline=(220, 210, 180), width=2 * DPR)
s.text((230 * DPR, 16 * DPR), 'device px = CSS px x 3', fill=(170, 170, 180), font=F(11))

def floor(w, h, t, x0, y0):
    for r in range(h):
        for c in range(w):
            col = (150, 153, 162) if (r + c) % 2 else (138, 141, 151)
            s.rectangle([x0 + c * t, y0 + r * t, x0 + (c + 1) * t - 1, y0 + (r + 1) * t - 1], fill=col)

def band(y, label, sprites, art, zoom, cols=None):
    t = art * zoom                     # device px per tile
    css = t // DPR
    n = cols or PW // t
    s.text((6 * DPR, y), label, fill=(240, 220, 160), font=F(11))
    y0 = y + 16 * DPR
    x0 = (PW - n * t) // 2
    floor(n, 2, t, x0, y0)
    for k, im in enumerate(sprites):
        if im is None: continue
        c, r = (1 + 2 * k) % n, (k // ((n + 1) // 2)) % 2
        c = (2 * k + r) % n
        sp = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
        scr.paste(sp, (x0 + c * t + (t - sp.width) // 2, y0 + r * t + (t - sp.height) // 2), sp)
    return y0 + 2 * t + 10 * DPR, css, n

y = 56 * DPR
old = existing_sprites(0)
y, css, n = band(y, '16 px art, x6 device = 32 CSS px tiles, 12 across (the plan)', old[:6], 16, 6)
y, css, n = band(y, 'generated 32 px (cleaned), x3 = 32 CSS px tiles, 12 across', [gen(i, '32clean') for i in IDS], 32, 3)
y, css, n = band(y, 'generated 48 px, x2 = 32 CSS px tiles, 12 across', [gen(i, 48) for i in IDS], 48, 2)
y, css, n = band(y, 'generated 48 px, x3 = 48 CSS px tiles, 8 across (>= 44 px tap target)', [gen(i, 48) for i in IDS], 48, 3)
y, css, n = band(y, 'Kenney Tiny Dungeon (CC0) 16 px, x6 = 32 CSS px, 12 across', [kenney(i) for i, _ in KEN[:6]], 16, 6)
# tap-target references
s.text((6 * DPR, y), 'squares: 44x44 CSS px (WCAG 2.5.5 AAA, Apple HIG) and 24x24 (WCAG 2.5.8 AA)',
       fill=(200, 200, 210), font=F(10))
s.rectangle([12 * DPR, y + 16 * DPR, 56 * DPR, y + 60 * DPR], outline=(120, 220, 140), width=DPR)
s.rectangle([70 * DPR, y + 26 * DPR, 94 * DPR, y + 50 * DPR], outline=(220, 200, 120), width=DPR)
y += 70 * DPR
# coverage panel: what one portrait screen of world shows of a department
s.text((6 * DPR, y), 'one world view vs a department (cells = tiles): 43x33 and 37x20 outlines;', fill=(200, 200, 210), font=F(10))
s.text((6 * DPR, y + 13 * DPR), 'green = 12x21 view at 32 CSS px tiles, orange = 8x14 view at 48 CSS px tiles', fill=(200, 200, 210), font=F(10))
cell = 10  # device px per department tile in this diagram
gx, gy = 12 * DPR, y + 30 * DPR
s.rectangle([gx, gy, gx + 43 * cell, gy + 33 * cell], outline=(160, 160, 170), width=DPR)
s.rectangle([gx, gy, gx + 37 * cell, gy + 20 * cell], outline=(110, 110, 120), width=DPR)
s.rectangle([gx + 4 * cell, gy + 6 * cell, gx + 16 * cell, gy + 27 * cell], outline=(120, 220, 140), width=2 * DPR)
s.rectangle([gx + 22 * cell, gy + 6 * cell, gx + 30 * cell, gy + 20 * cell], outline=(230, 160, 80), width=2 * DPR)
# bottom bar (56 CSS px)
s.rectangle([0, PH - 56 * DPR, PW, PH], fill=(18, 20, 26))
for k, lab in enumerate(['Wait', 'Bag', 'Q1', 'Q2', 'Q3', 'Map']):
    bx = 5 * DPR + k * 64 * DPR
    s.rectangle([bx, PH - 50 * DPR, bx + 58 * DPR, PH - 6 * DPR], outline=(90, 92, 104), width=DPR)
    s.text((bx + 16 * DPR, PH - 36 * DPR), lab, fill=(200, 200, 210), font=F(12))
ph.paste(scr, (BEZ, BEZ))
ph.save(os.path.join(OUT, 'phone_mockup_390x844_dpr3.png'))
print('ok')
