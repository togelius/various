#!/usr/bin/env python3
"""Re-encode the source PNGs under assets/ as WebP data URIs in js/*-data.js, and compact the character JSON.
The game loads every image through an Image element, so WebP decodes everywhere WebGL2 runs.
Sizes are chosen per use: tiling surfaces at 1024, tree cutouts at 768x1152 with alpha, the sky band at 1536x768.
Run from anywhere: python3 steelhag2/tools/compress-assets.py
"""
import pathlib, base64, io, json, re
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent

def webp(src, size, quality, alpha):
    im = Image.open(root / src)
    im = im.convert('RGBA' if alpha else 'RGB')
    if im.size != size: im = im.resize(size, Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=quality, method=6, exact=False)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def write(js, comment, consts):
    body = comment + '\n' + ''.join(f'const {k}="{v}";\n' for k, v in consts)
    (root / 'js' / js).write_text(body); print(js, len(body), 'bytes')

write('material-data.js', '// Original generated game textures, re-encoded by tools/compress-assets.py; see assets/materials/README.md.', [
    ('ICE_IMAGE', webp('assets/materials/lake-ice.png', (1024, 1024), 80, False)),
    ('WOOD_IMAGE', webp('assets/materials/falu-siding.png', (1024, 1024), 80, False))])
write('foliage-data.js', '// Generated winter spruce cutout, re-encoded by tools/compress-assets.py. Source and prompt: assets/foliage/README.md.', [
    ('FOLIAGE_IMAGE', webp('assets/foliage/winter-spruce.png', (768, 1152), 82, True))])
write('pine-data.js', '// Original generated pine cutout, re-encoded by tools/compress-assets.py; full provenance in assets/foliage/README.md.', [
    ('PINE_IMAGE', webp('assets/foliage/winter-pine.png', (768, 1152), 82, True))])
write('sky-data.js', '// Original generated panorama, re-encoded by tools/compress-assets.py; source and prompt in assets/sky/README.md.', [
    ('SKY_IMAGE', webp('assets/sky/winter-stratus.png', (1536, 768), 80, False))])

# the character: same JSON, floats rounded to five decimals and no whitespace
p = root / 'js/character-data.js'; s = p.read_text(); i = s.index('{'); j = s.rindex('}')
def rnd(v):
    if isinstance(v, float): r = round(v, 5); return int(r) if r == int(r) and abs(r) < 1e9 else r
    if isinstance(v, list): return [rnd(x) for x in v]
    if isinstance(v, dict): return {k: rnd(x) for k, x in v.items()}
    return v
out = s[:i] + json.dumps(rnd(json.loads(s[i:j + 1])), separators=(',', ':')) + s[j + 1:]
p.write_text(out); print('character-data.js', len(out), 'bytes')
