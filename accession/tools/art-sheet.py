#!/usr/bin/env python3
"""Render every sprite in art/sprites under every department palette, as a contact sheet
for review: test/shots/art-sheet.png. Usage: python3 tools/art-sheet.py [scale=4] [filter]"""
import json, os, sys
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pal = json.load(open(os.path.join(root, 'art/palettes.json')))
scale = int(sys.argv[1]) if len(sys.argv) > 1 else 3
flt = sys.argv[2] if len(sys.argv) > 2 else ''

def load(path):
    meta, rows = {}, []
    for line in open(path, encoding='utf-8').read().splitlines():
        if line.startswith('#'):
            k, _, v = line[1:].partition(':'); meta[k.strip()] = v.strip()
        elif line.strip():
            rows.append(line.rstrip('\n'))
    return meta, rows

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

sprites = []
d = os.path.join(root, 'art/sprites')
for f in sorted(os.listdir(d)):
    if f.endswith('.txt') and flt in f:
        meta, rows = load(os.path.join(d, f))
        sprites.append((f[:-4], meta, rows))

depts = [k for k in pal['dept'] if k != 'T0']
cell = 32 * scale + 8
W = 8 + cell * (len(depts) + 0)
img = Image.new('RGB', (W + 160, 8 + cell * len(sprites)), (21, 19, 26))
dr = ImageDraw.Draw(img)
for r, (name, meta, rows) in enumerate(sprites):
    kinds = [meta.get('kind', 'exhibit')]
    for c, dep in enumerate(depts):
        p = pal['player'] if meta.get('kind') == 'player' else pal['dept'][dep]
        ox, oy = 8 + c * cell, 8 + r * cell
        bg = hexrgb(pal['dept'][dep]['floor'])
        n = len(rows)
        dr.rectangle([ox, oy, ox + n * scale - 1, oy + n * scale - 1], fill=bg)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in '. ':
                    continue
                col = (p.get('glass') if ch == 'g' else None) or p.get(ch) or pal['semantic'].get({'R': 'hostile', 'O': 'hazard', 'C': 'readable', 'Y': 'item', 'B': 'player'}.get(ch, ''), None)
                if not col:
                    col = '#ff00ff'
                dr.rectangle([ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1], fill=hexrgb(col))
    dr.text((8 + len(depts) * cell, 8 + r * cell + 4), name, fill=(236, 230, 216))
    dr.text((8 + len(depts) * cell, 8 + r * cell + 18), meta.get('silhouette', ''), fill=(163, 157, 144))
out = os.path.join(root, 'test/shots/art-sheet.png')
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out)
print('wrote', os.path.relpath(out, root), len(sprites), 'sprites')
