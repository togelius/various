#!/usr/bin/env python3
"""Convert Kenney starter-kit GLB models into js/assets.js for Grift City.

Each model becomes { parts: { name: { t: [x,y,z], first, count } }, v: [x,y,z,r,g,b ...], i: [...], min, max }.
Vertices are in node-local space (so a wheel spins about its own centre) with the node's world translation in t.
Colours come from the model's colormap texture, sampled at each vertex's UV, so the game needs no texture for them.
Normals are not stored: the models are flat shaded with unshared vertices, so face normals are rebuilt at load.
"""
import sys, json, struct, os, io, math
from PIL import Image

def load(path):
    b = open(path, 'rb').read(); magic, ver, ln = struct.unpack('<III', b[:12]); assert magic == 0x46546C67
    off = 12; js = None; bin_ = None
    while off < ln:
        cl, ct = struct.unpack('<II', b[off:off + 8]); data = b[off + 8:off + 8 + cl]; off += 8 + cl
        if ct == 0x4E4F534A: js = json.loads(data.decode())
        elif ct == 0x004E4942: bin_ = data
    return js, bin_

CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def accessor(js, bin_, idx):
    a = js['accessors'][idx]; bv = js['bufferViews'][a['bufferView']]; fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', sz * n); out = []
    for k in range(a['count']):
        o = base + k * stride; out.append(struct.unpack_from('<' + fmt * n, bin_, o))
    return out

def image(js, bin_, idx, path):
    im = js['images'][idx]
    if 'uri' in im: return Image.open(os.path.join(os.path.dirname(path), im['uri'])).convert('RGB')  # texture beside the model
    bv = js['bufferViews'][im['bufferView']]; data = bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    return Image.open(io.BytesIO(data)).convert('RGB')

def mat_mul(a, b):  # column-major 4x4
    return [sum(a[r + k * 4] * b[k + c * 4] for k in range(4)) for c in range(4) for r in range(4)]
def node_matrix(n):
    if 'matrix' in n: return n['matrix']
    t = n.get('translation', [0, 0, 0]); q = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    r = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
         t[0], t[1], t[2], 1]
    for c in range(3):
        for k in range(3): r[c * 4 + k] *= s[c]
    return r

def convert(path, opts):
    js, bin_ = load(path); tex = None
    if js.get('images'): tex = image(js, bin_, 0, path)
    W, H = tex.size if tex else (1, 1)
    parts = {}; V = []; I = []; palette = []; palidx = {}
    def walk(ni, parent):
        n = js['nodes'][ni]; m = mat_mul(parent, node_matrix(n))
        if 'mesh' in n:
            name = n.get('name', 'part%d' % ni); first = len(I)
            local = opts.get('local', False)  # keep vertices in node space, store world translation
            for p in js['meshes'][n['mesh']]['primitives']:
                pos = accessor(js, bin_, p['attributes']['POSITION']); uv = accessor(js, bin_, p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else None
                mat = js['materials'][p['material']] if 'material' in p else {}; pbr = mat.get('pbrMetallicRoughness', {}); bc = pbr.get('baseColorFactor', [1, 1, 1, 1])
                # a material may be recoloured by name: Kenney's foliage is a stylised teal, which sits badly in a
                # photographic city, so the spec maps it to something that grows here
                mname = mat.get('name', '')
                for key, rgb in (opts.get('recolor') or {}).items():
                    if key.lower() in mname.lower(): bc = list(rgb) + [1.0]; break
                idx = [t[0] for t in accessor(js, bin_, p['indices'])] if 'indices' in p else list(range(len(pos)))
                if opts.get('twoSided'):  # single-sided foliage shows its hollow inside when culled: emit both faces
                    idx = idx + [idx[t + k] for t in range(0, len(idx), 3) for k in (0, 2, 1)]
                det = (m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]))
                if det < 0:  # a mirrored node (e.g. the right-hand wheels are the left ones scaled by -1) flips the winding
                    idx = [idx[t + k] for t in range(0, len(idx), 3) for k in (0, 2, 1)]
                base = len(V) // 4
                for k, (x, y, z) in enumerate(pos):
                    # local parts keep the node's rotation and scale but not its translation, so a wheel spins about its own centre
                    wx = m[0] * x + m[4] * y + m[8] * z; wy = m[1] * x + m[5] * y + m[9] * z; wz = m[2] * x + m[6] * y + m[10] * z
                    if not local: wx += m[12]; wy += m[13]; wz += m[14]
                    if tex is not None and uv is not None and 'baseColorTexture' in pbr:
                        u, v = uv[k]; px = tex.getpixel((int(u * W) % W, int(v * H) % H)); r, g, b = [c / 255 * f for c, f in zip(px, bc[:3])]
                    else: r, g, b = bc[:3]
                    key = (round(r, 3), round(g, 3), round(b, 3))
                    if key not in palidx: palidx[key] = len(palette); palette.append(list(key))
                    V.extend([round(wx, 4), round(wy, 4), round(wz, 4), palidx[key]])
                I.extend(base + j for j in idx)
            parts[name] = {'t': [round(m[12], 4), round(m[13], 4), round(m[14], 4)], 'first': first, 'count': len(I) - first}
        for c in n.get('children', []): walk(c, m)
    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    for ni in js['scenes'][js.get('scene', 0)]['nodes']: walk(ni, ident)
    # compact: vertices are [x,y,z,palIndex]
    # drop the flat ground square some tiles carry (every vertex of the triangle below a height)
    if opts.get('dropBelow') is not None:
        keep = []; th = opts['dropBelow']
        for t in range(0, len(I), 3):
            if max(V[I[t + k] * 4 + 1] for k in range(3)) >= th: keep.extend(I[t:t + 3])
        for p in parts.values():  # recount parts (single-part tiles only)
            p['first'] = 0; p['count'] = len(keep)
        I = keep
    # which palette entries are the paint the game recolours per vehicle: a hue rule named in the spec
    paint = []
    rules = {'red': lambda c: c[0] > c[1] * 1.3 and c[0] > c[2] * 1.5 and max(c) - min(c) > 0.25,
             'green': lambda c: c[1] > c[0] * 1.5 and c[1] > c[2] * 1.15 and max(c) - min(c) > 0.2}
    if opts.get('paint'): paint = [i for i, c in enumerate(palette) if rules[opts['paint']](c)]
    xs = V[0::4]; ys = V[1::4]; zs = V[2::4]
    out = {'parts': parts, 'pal': palette, 'v': V, 'i': I, 'min': [min(xs), min(ys), min(zs)], 'max': [max(xs), max(ys), max(zs)]}
    if paint: out['paint'] = paint
    return out

if __name__ == '__main__':
    # usage: import-glb.py <spec.json> <out.js> [kit-cache-dir]
    spec = json.load(open(sys.argv[1])); out = {}
    cache = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('KIT_CACHE', '')
    for name, ent in spec['models'].items():
        path = ent['file'] if os.path.isabs(ent['file']) else os.path.join(cache, ent['file'])
        out[name] = convert(path, ent.get('opts', {})); print('  %-12s %5d verts %5d tris %3d colours  %s' % (name, len(out[name]['v']) // 4, len(out[name]['i']) // 3, len(out[name]['pal']), ' '.join(list(out[name]['parts'])[:5])))
    js = 'const ASSETS = ' + json.dumps({'credits': spec['credits'], 'models': out}, separators=(',', ':')) + ';\n'
    open(sys.argv[2], 'w').write("// Generated by tools/assets/import-glb.py from the Kenney starter kits (MIT / CC0, see tools/assets/SOURCES.md). Do not edit.\n'use strict';\n" + js)
    print('wrote', sys.argv[2], len(js) // 1024, 'KB')
