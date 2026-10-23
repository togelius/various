"""Turn raw generated images into small palette-indexed sprites.

Usage: python -I postprocess.py OUTDIR
Reads OUTDIR/raw/*.png, writes OUTDIR/sprites/<id>_s<seed>_<N>.png for N in 16, 32, 48 (RGBA,
16-colour fixed palette, hard alpha), plus an auto-cleaned 32 px variant (<..>_32clean.png),
and OUTDIR/sprites/postprocess.json with per-image stats.

Steps (all deterministic, no learned parts):
 1. background = pixels near the border colour that are connected to the border (flood fill);
 2. crop to the object's bounding box, pad to a square with a small margin;
 3. map every pixel to the nearest palette colour (CIELAB distance, no dithering);
 4. downscale by block vote: a target pixel is opaque if >= 50% of its block is object,
    and takes the most common palette index among the block's object pixels;
 5. "clean" variant only: drop isolated opaque pixels, then add a 1-px dark outline.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image

OUT = sys.argv[1]
SP = os.path.join(OUT, 'sprites'); os.makedirs(SP, exist_ok=True)

# A fixed 16-colour "museum materials" palette, authored for this probe (no third-party source).
PALETTE = [
    ('outline', '#16131c'), ('shadow', '#3b3546'), ('stone', '#6f6a78'), ('marble', '#aaa4ae'),
    ('cream', '#e8e3d8'), ('white', '#fbf8f0'), ('umber', '#4a2e1f'), ('bronze', '#8a5a32'),
    ('brass', '#c8913f'), ('gold', '#f2d27a'), ('verdigris_d', '#2b4f4a'), ('verdigris', '#4f8f7f'),
    ('glass', '#a6d8c8'), ('oxblood', '#6e2328'), ('vermilion', '#c8503a'), ('ultramarine', '#34508a'),
]
PAL = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for _, h in PALETTE], dtype=np.float64)

def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

PAL_LAB = srgb_to_lab(PAL)

def nearest_index(rgb):
    lab = srgb_to_lab(rgb.astype(np.float64))
    d = ((lab[..., None, :] - PAL_LAB[None, None, :, :]) ** 2).sum(-1)
    return d.argmin(-1)

def background_mask(a, tol=40.0):
    h, w, _ = a.shape
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(border, 0)
    near = np.sqrt(((a.astype(np.float64) - bg) ** 2).sum(-1)) < tol
    seed = np.zeros_like(near)
    seed[0, :], seed[-1, :], seed[:, 0], seed[:, -1] = near[0, :], near[-1, :], near[:, 0], near[:, -1]
    m = seed
    while True:  # flood fill by repeated 4-neighbour dilation inside `near`
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        g &= near
        if (g == m).all(): break
        m = g
    return m, bg

def square_crop(fg, margin=0.06):
    ys, xs = np.nonzero(fg)
    # ignore stray specks: use the 0.5th..99.5th percentile extent
    y0, y1 = np.percentile(ys, [0.2, 99.8]).astype(int); x0, x1 = np.percentile(xs, [0.2, 99.8]).astype(int)
    side = int(max(y1 - y0, x1 - x0) * (1 + 2 * margin)) + 1
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    return cy - side // 2, cx - side // 2, side

def block_vote(idx, fg, top, left, side, n):
    out_i = np.zeros((n, n), dtype=np.int64); out_a = np.zeros((n, n), dtype=bool)
    h, w = idx.shape
    edges = np.linspace(0, side, n + 1)
    for r in range(n):
        for c in range(n):
            ya, yb = top + int(edges[r]), top + int(edges[r + 1]); xa, xb = left + int(edges[c]), left + int(edges[c + 1])
            ya2, yb2, xa2, xb2 = max(ya, 0), min(yb, h), max(xa, 0), min(xb, w)
            if yb2 <= ya2 or xb2 <= xa2: continue
            f = fg[ya2:yb2, xa2:xb2]; area = (yb - ya) * (xb - xa)
            if f.sum() * 2 < area: continue
            vals = idx[ya2:yb2, xa2:xb2][f]
            out_i[r, c] = np.bincount(vals, minlength=16).argmax(); out_a[r, c] = True
    return out_i, out_a

def clean(i, a):
    a = a.copy(); n = a.shape[0]
    pad = np.pad(a, 1)
    nb = pad[:-2, 1:-1].astype(int) + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
    a &= nb > 0                                   # drop isolated pixels
    pad = np.pad(a, 1)
    grow = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    ring = grow & ~a
    i = i.copy(); i[ring] = 0                     # palette index 0 = outline
    return i, a | ring

def to_rgba(i, a):
    rgb = PAL[i].astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]), 'RGBA')

stats = {}
for p in sorted(glob.glob(os.path.join(OUT, 'raw', '*.png'))):
    key = os.path.basename(p)[:-4]
    a = np.asarray(Image.open(p).convert('RGB'))
    bgm, bg = background_mask(a)
    fg = ~bgm
    top, left, side = square_crop(fg)
    idx = nearest_index(a)
    rec = dict(bg_rgb=[int(v) for v in bg], object_share=round(float(fg.mean()), 3), crop=[int(top), int(left), int(side)])
    for n in (16, 32, 48):
        i, al = block_vote(idx, fg, top, left, side, n)
        to_rgba(i, al).save(os.path.join(SP, f'{key}_{n}.png'))
        rec[f'colours_{n}'] = int(len(np.unique(i[al])))
        if n == 32:
            ci, ca = clean(i, al)
            to_rgba(ci, ca).save(os.path.join(SP, f'{key}_32clean.png'))
    stats[key] = rec
    print(key, rec, flush=True)
json.dump(dict(palette=PALETTE, images=stats), open(os.path.join(SP, 'postprocess.json'), 'w'), indent=1)
