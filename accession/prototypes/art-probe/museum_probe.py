"""Feasibility probe for the museum roguelike art pipeline.

Renders (1) sprites written directly as index grids by an LLM (this session,
zero-shot, no image tools while writing), recoloured under three department
palettes; (2) Bollinger-style mask sprites from a seeded RNG; (3) generated
"paintings" in frames; (4) a 320x176 gallery mock-up at 16 px tiles with wall
colour, plinths, vitrines, label plaques and dithered lighting pools; (5) a
label-legibility sheet for candidate pixel fonts at native size.

Usage: python3 -I museum_probe.py FONTDIR OUTDIR
"""
import sys, os, math, random
from PIL import Image, ImageDraw, ImageFont

FONTDIR, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# ------------------------------------------------------------------ palettes
# Each department: a material ramp (o d m l h), an accent ramp (b a c),
# skin (k s), emissive e, glass w/g, and room colours.
DEPTS = {
  'Glass Weather': dict(o='#10141f', d='#1f4f63', m='#3c8a97', l='#7cc7c4', h='#d8f4ef',
                        b='#5b6170', a='#9aa3b5', c='#dfe5ee', k='#a0675a', s='#e0a98f', e='#ffe27a',
                        wall='#26324d', trim='#3b4a6b', wainscot='#1b2438', floorA='#b9bcc4', floorB='#a3a7b2', light='#fff6d8'),
  'Lacquered Hours': dict(o='#1a0d0d', d='#5e1a1d', m='#9c2b25', l='#d4523a', h='#f2a07a',
                          b='#7a5418', a='#c99a2e', c='#f3d77a', k='#8a5a44', s='#d9a07c', e='#9ef0ff',
                          wall='#4a1620', trim='#6b2430', wainscot='#2e0d14', floorA='#6b4426', floorB='#5a381e', light='#ffe2b0'),
  'Salt Saints': dict(o='#1d1a16', d='#8a8070', m='#c2b8a3', l='#e6dfcc', h='#fffbf0',
                      b='#8a5a1c', a='#c98a32', c='#ecc06a', k='#7a5a4a', s='#cf9f83', e='#ff6a4a',
                      wall='#4f5e48', trim='#6a7a60', wainscot='#323c2d', floorA='#b2643f', floorB='#9c5536', light='#f4ffe6'),
}

def sprite(rows, pal, name, log):
    w = 16
    bad = [(i, len(r)) for i, r in enumerate(rows) if len(r) != w]
    if bad: log.append(f'{name}: rows with wrong length {bad}')
    if len(rows) != 16: log.append(f'{name}: {len(rows)} rows, expected 16')
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows[:16]):
        for x, ch in enumerate(r[:16]):
            if ch in '. ': continue
            if ch not in pal: log.append(f'{name}: unknown index {ch!r}'); continue
            im.putpixel((x, y), hexrgb(pal[ch]) + (255,))
    return im

# ------------------------------------------------- LLM-written index grids
# Written by hand in this session as a stand-in for "an LLM emits a pixel grid".
GRIDS = {
'amphora': [
"................",
".....oooooo.....",
".....ohllmo.....",
"......olmo......",
"...oo.olmo.oo...",
"..o..oolmdoo..o.",
"..o.ollhmmmdo.o.",
"..o.olhlmmmmdoo.",
"...ollaaaaaado..",
"...olacbacbado..",
"...ollaaaaaado..",
"....ollmmmmdo...",
".....olmmmdo....",
"......olmdo.....",
".....ooooooo....",
"................"],
'automaton': [
"................",
".....oooooo.....",
"....ommmmmmo....",
"....omeommeo....",
"....ommlmmmo....",
".....oddddo.....",
"...oooaaaaooo...",
"..ommloaaolmmo..",
"..omo.oaao.omo..",
"..omo.oddo.omo..",
"..oco.oddo.oco..",
"......oddo......",
".....od..do.....",
".....od..do.....",
"....ooo..ooo....",
"................"],
'docent': [
"................",
"......oooo......",
".....obbbbo.....",
".....osssso.....",
".....oskkso.....",
"......osso......",
".....oddddo.....",
"....odmmmmdo....",
"....odmcamdo....",
"....odmmmmdo....",
"....oso..oso....",
".....odddddo....",
".....od..do.....",
".....od..do.....",
".....oo..oo.....",
"................"],
'reliquary': [
"................",
"......oaao......",
".......ao.......",
"....oaaaaaao....",
"...oacccccabo...",
"...oacemmecbo...",
"...oacmlhmcbo...",
"...oacmhlmcbo...",
"...oacemmecbo...",
"...oacccccabo...",
"....obbbbbbo....",
".....oaaaao.....",
"......oaao......",
"....oaaaaaao....",
"....oooooooo....",
"................"],
'astrolabe': [
"................",
".......oo.......",
"......oaao......",
".....oooooo.....",
"...ooaaaaaaoo...",
"..oacc.ab..cao..",
"..oac.oaao.cao..",
".oac.ob..bo.cao.",
".oaa.a.ee.a.aao.",
".oab.ob..bo.bao.",
"..oab.oaao.bao..",
"..oabb.ab.bbao..",
"...ooaaaaaaoo...",
".....oooooo.....",
"................",
"................"],
}

# --------------------------------------------- Bollinger-style mask sprites
# Mask (half width 8, height 16), mirrored on x. -1 border, 0 empty,
# 1 empty/body, 2 border/body. Values follow zfedoran's port (MIT).
CREATURE_MASK = [
 [0,0,0,0,0,0,0,0],
 [0,0,0,0,0,1,1,1],
 [0,0,0,0,1,1,2,2],
 [0,0,0,0,1,2,2,2],
 [0,0,0,0,0,1,2,2],
 [0,0,0,0,1,1,1,2],
 [0,0,1,1,1,1,2,2],
 [0,1,1,1,1,2,2,2],
 [0,1,1,0,1,2,2,2],
 [0,1,0,0,1,1,2,2],
 [0,0,0,0,1,1,1,2],
 [0,0,0,0,1,1,1,1],
 [0,0,0,1,1,0,1,1],
 [0,0,1,1,0,0,1,1],
 [0,0,1,0,0,0,0,1],
 [0,0,0,0,0,0,0,0]]

def bollinger(seed, pal):
    rnd = random.Random(seed)
    H, W = 16, 16
    g = [[0]*W for _ in range(H)]
    for y in range(H):
        for x in range(8):
            v = CREATURE_MASK[y][x]
            if v == 1: v = 1 if rnd.random() < 0.5 else 0
            elif v == 2: v = 1 if rnd.random() < 0.5 else -1
            g[y][x] = g[y][W-1-x] = v
    # outline: empty cells next to body become border
    for y in range(H):
        for x in range(W):
            if g[y][x] == 0 and any(0 <= y+dy < H and 0 <= x+dx < W and g[y+dy][x+dx] == 1
                                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1))):
                g[y][x] = -1
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    ramp = ['d', 'm', 'l', 'h']
    eye_y = rnd.randint(3, 6)
    for y in range(H):
        for x in range(W):
            v = g[y][x]
            if v == -1: im.putpixel((x, y), hexrgb(pal['o']) + (255,))
            elif v == 1:
                # brighter toward the top-left, like a single key light
                t = 1 - (y / H) * 0.7 - abs(x - 7.5) / 16 + rnd.uniform(-0.15, 0.15)
                idx = max(0, min(3, int(t * 4)))
                im.putpixel((x, y), hexrgb(pal[ramp[idx]]) + (255,))
    # eyes on the symmetric axis band
    for x in (6, 9):
        if g[eye_y][x] == 1: im.putpixel((x, eye_y), hexrgb(pal['e']) + (255,))
    return im

# ------------------------------------------------------------- paintings
def painting(seed, pal):
    rnd = random.Random(seed)
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            if x in (0, 15) or y in (0, 15): c = pal['b']
            elif x in (1, 14) or y in (1, 14): c = pal['a'] if (x + y) % 3 else pal['c']
            else: c = None
            if c: im.putpixel((x, y), hexrgb(c) + (255,))
    kind = rnd.choice(['landscape', 'portrait', 'still'])
    sky, ground = rnd.sample(['h', 'l', 'm', 'c'], 2)
    hz = rnd.randint(6, 10)
    for y in range(2, 14):
        for x in range(2, 14):
            c = pal[sky] if y < hz else pal['d']
            if y >= hz and (x * 3 + y * 5 + seed) % 7 == 0: c = pal['m']
            im.putpixel((x, y), hexrgb(c) + (255,))
    if kind == 'landscape':
        sx, sy = rnd.randint(4, 11), rnd.randint(3, hz - 2)
        for dx, dy in ((0,0),(1,0),(0,1),(1,1)): im.putpixel((sx+dx, sy+dy), hexrgb(pal['e']) + (255,))
        for x in range(2, 14):
            top = hz - int(2 * abs(math.sin((x + seed) * 0.7)))
            for y in range(top, hz): im.putpixel((x, y), hexrgb(pal['o']) + (255,))
    elif kind == 'portrait':
        for y in range(5, 14):
            for x in range(5, 11):
                r = ((x - 7.5) / 2.6) ** 2 + ((y - 7) / 2.4) ** 2
                if y < 10 and r < 1: im.putpixel((x, y), hexrgb(pal['s']) + (255,))
                if y >= 10: im.putpixel((x, y), hexrgb(pal['o']) + (255,))
    else:
        for x in range(4, 12): im.putpixel((x, 11), hexrgb(pal['b']) + (255,))
        for (cx, cy, col) in ((6, 9, 'e'), (9, 9, 'l'), (8, 8, 'a')):
            for dx in (0, 1):
                for dy in (0, 1): im.putpixel((cx+dx, cy+dy), hexrgb(pal[col]) + (255,))
    return im

def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)

log = []
# ------------------------------------------------- sheet 1: sprites x palettes
cols = list(GRIDS) + ['being 1', 'being 2', 'being 3', 'painting 1', 'painting 2']
sheet = Image.new('RGB', (len(cols) * 20 + 4, len(DEPTS) * 20 + 4), (40, 40, 44))
for r, (dname, pal) in enumerate(DEPTS.items()):
    for c, name in enumerate(cols):
        if name in GRIDS: sp = sprite(GRIDS[name], pal, name, log if r == 0 else [])
        elif name.startswith('being'): sp = bollinger(1000 + int(name[-1]) * 7 + r, pal)
        else: sp = painting(31 * int(name[-1]) + r, pal)
        bg = Image.new('RGB', (18, 18), hexrgb(pal['wall'])); bg.paste(sp, (1, 1), sp)
        sheet.paste(bg, (4 + c * 20, 4 + r * 20))
up(sheet, 6).save(os.path.join(OUT, 'sprites_by_department.png'))

# ------------------------------------------------- sheet 2: beings variety
bs = Image.new('RGB', (12 * 18 + 2, 3 * 18 + 2), (30, 30, 34))
for r, pal in enumerate(DEPTS.values()):
    for i in range(12):
        sp = bollinger(5000 + i * 13 + r * 1000, pal)
        bs.paste(sp, (2 + i * 18, 2 + r * 18), sp)
up(bs, 6).save(os.path.join(OUT, 'bollinger_beings.png'))

# ------------------------------------------------- sheet 3: gallery mock-up
def tile_floor(pal, x, y):
    t = Image.new('RGB', (16, 16), hexrgb(pal['floorA'] if (x + y) % 2 else pal['floorB']))
    d = ImageDraw.Draw(t); d.line([(0, 15), (15, 15)], fill=hexrgb(pal['wainscot'])); return t

def tile_wall(pal, row):
    t = Image.new('RGB', (16, 16), hexrgb(pal['wall']))
    d = ImageDraw.Draw(t)
    if row == 1:
        d.rectangle([0, 8, 15, 15], fill=hexrgb(pal['wainscot'])); d.line([(0, 8), (15, 8)], fill=hexrgb(pal['trim']))
    else:
        d.line([(0, 2), (15, 2)], fill=hexrgb(pal['trim']))
    return t

def plinth(pal):
    t = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    d.rectangle([2, 9, 13, 15], fill=hexrgb('#e8e4da'), outline=hexrgb(pal['o']))
    d.rectangle([1, 8, 14, 9], fill=hexrgb('#f6f3ea'), outline=hexrgb(pal['o']))
    d.line([(3, 14), (12, 14)], fill=hexrgb('#bdb7aa'))
    return t

def vitrine(pal):
    t = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    d.rectangle([1, 10, 14, 15], fill=hexrgb('#3a3026'), outline=hexrgb(pal['o']))
    d.rectangle([1, 0, 14, 10], outline=hexrgb('#d8e8ee'))
    d.line([(3, 2), (3, 6)], fill=hexrgb('#ffffff')); d.line([(4, 2), (4, 3)], fill=hexrgb('#ffffff'))
    return t

def plaque(pal):
    t = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    d.rectangle([4, 9, 11, 13], fill=hexrgb('#f1ead6'), outline=hexrgb(pal['o']))
    d.line([(5, 11), (10, 11)], fill=hexrgb('#7a7468')); d.line([(5, 12), (8, 12)], fill=hexrgb('#7a7468'))
    return t

def gallery(dname, pal, seed):
    W, H = 20, 11
    rnd = random.Random(seed)
    im = Image.new('RGB', (W * 16, H * 16))
    for y in range(H):
        for x in range(W):
            if y < 2: im.paste(tile_wall(pal, y), (x * 16, y * 16))
            else: im.paste(tile_floor(pal, x, y), (x * 16, y * 16))
    # doorway
    for y in range(2): im.paste(Image.new('RGB', (32, 16), hexrgb(pal['o'])), (9 * 16, y * 16))
    # paintings on the north wall
    for i, x in enumerate((2, 5, 13, 16)):
        p = painting(seed * 10 + i, pal); im.paste(p, (x * 16, 0), p)
    lights = []
    exhibits = [(3, 5, 'amphora'), (7, 5, 'reliquary'), (12, 5, 'astrolabe'), (16, 5, 'being')]
    for (x, y, what) in exhibits:
        pl = vitrine(pal) if what in ('reliquary', 'astrolabe') else plinth(pal)
        im.paste(pl, (x * 16, y * 16 + 4), pl)
        sp = bollinger(seed + x, pal) if what == 'being' else sprite(GRIDS[what], pal, what, [])
        im.paste(sp, (x * 16, y * 16 - 6), sp)
        pq = plaque(pal); im.paste(pq, (x * 16 + 12, y * 16 + 8), pq)
        lights.append((x * 16 + 8, y * 16 + 6, 34))
    # actors
    for (x, y, g) in ((9, 8, 'docent'), (14, 8, 'automaton')):
        sp = sprite(GRIDS[g], pal, g, []); im.paste(sp, (x * 16, y * 16), sp)
    hero = sprite(GRIDS['docent'], dict(pal, b='#2b2b2b', d='#2a3b6a', m='#4466aa', c='#ffd24a', a='#ffd24a'), 'hero', [])
    im.paste(hero, (10 * 16, 9 * 16), hero)
    lights.append((10 * 16 + 8, 9 * 16 + 8, 40))
    # lighting: 3 levels with 4x4 Bayer dither at the boundaries
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    px = im.load()
    lr, lg, lb = hexrgb(pal['light'])
    for y in range(im.height):
        for x in range(im.width):
            v = 0.0
            for (cx, cy, r) in lights:
                dd = math.hypot(x - cx, (y - cy) * 1.3) / r
                v = max(v, 1 - dd)
            v = max(0.0, min(1.0, v)) * 2.0 + (bayer[y % 4][x % 4] / 16 - 0.5) * 0.6
            level = 0 if v < 0.5 else (1 if v < 1.4 else 2)
            mul = (0.62, 0.82, 1.0)[level]
            r, g, b = px[x, y]
            if level == 2: r, g, b = (r * 0.85 + lr * 0.15), (g * 0.85 + lg * 0.15), (b * 0.85 + lb * 0.15)
            px[x, y] = (int(r * mul), int(g * mul), int(b * mul))
    return im

fonts = {'Bytesized': ('Bytesized.ttf', 8), 'Micro5': ('Micro5.ttf', 11), 'Tiny5': ('Tiny5.ttf', 8),
         'PressStart2P': ('PressStart2P.ttf', 8), 'Silkscreen': ('Silkscreen-Regular.ttf', 8),
         'VT323': ('VT323.ttf', 16), 'PixelifySans': ('PixelifySans%5Bwght%5D.ttf', 16)}

LABEL = ("ASTROLABE OF THE LESSER HOURS\n"
         "Brass, glass, one captured noon. Workshop of the Seventh Lantern, "
         "c. the Year of Two Winters. It measures the angle between a wish "
         "and its refusal. Lent by the Department of Glass Weather.")

def wrap(text, font, width):
    out = []
    for para in text.split('\n'):
        line = ''
        for word in para.split(' '):
            t = (line + ' ' + word).strip()
            if font.getlength(t) <= width: line = t
            else: out.append(line); line = word
        out.append(line)
    return out

def label_box(img, font, size, x, y, w):
    f = ImageFont.truetype(os.path.join(FONTDIR, font), size)
    d = ImageDraw.Draw(img); d.fontmode = '1'
    lines = wrap(LABEL, f, w - 8)
    asc, desc = f.getmetrics(); lh = asc + desc + 1
    h = len(lines) * lh + 8
    d.rectangle([x, y, x + w, y + h], fill=(241, 234, 214), outline=(29, 26, 22))
    for i, ln in enumerate(lines): d.text((x + 4, y + 4 + i * lh), ln, font=f, fill=(29, 26, 22))
    return h

for i, (dname, pal) in enumerate(DEPTS.items()):
    g = gallery(dname, pal, 7 + i)
    canvas = Image.new('RGB', (320, 240), (12, 12, 14)); canvas.paste(g, (0, 0))
    label_box(canvas, 'Micro5.ttf', 11, 4, 178, 312)
    up(canvas, 3).save(os.path.join(OUT, f'gallery_{i+1}_{dname.replace(" ", "_")}.png'))

# ------------------------------------------------- sheet 4: label fonts
sheet = Image.new('RGB', (320, 700), (60, 56, 52)); y = 4
d = ImageDraw.Draw(sheet); d.fontmode = '1'
for name, (fn, sz) in fonts.items():
    d.text((4, y), f'{name} @ {sz}px', fill=(255, 210, 74), font=ImageFont.truetype(os.path.join(FONTDIR, 'Bytesized.ttf'), 8))
    y += 12
    h = label_box(sheet, fn, sz, 4, y, 200)
    y += h + 8
sheet = sheet.crop((0, 0, 320, y))
up(sheet, 3).save(os.path.join(OUT, 'label_fonts.png'))
print('\n'.join(log) if log else 'all grids 16x16 and valid')
