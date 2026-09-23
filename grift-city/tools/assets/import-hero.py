#!/usr/bin/env python3
"""Bake selected CC0 Quaternius geometry into the game's existing 14-bone rig.

Run: python3 tools/assets/import-hero.py /path/to/Universal\ Base\ Characters[Standard]
Requires Pillow. Original glTF files remain in the downloaded pack; provenance and
SHA-256 checksums are recorded alongside this importer. No runtime glTF dependency.
"""
import argparse, base64, hashlib, io, json, math, struct
from pathlib import Path
from PIL import Image


def gltf(path):
    data = json.loads(path.read_text())
    buffers = [(path.parent / b['uri']).read_bytes() for b in data['buffers']]
    def accessor(index):
        a = data['accessors'][index]; v = data['bufferViews'][a['bufferView']]
        fmt = {5126: 'f', 5123: 'H', 5121: 'B', 5125: 'I'}[a['componentType']]
        count = {'VEC3': 3, 'VEC2': 2, 'VEC4': 4, 'SCALAR': 1}[a['type']]
        size = struct.calcsize(fmt) * count
        start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from('<' + fmt * count, buffers[v['buffer']], start + k * v.get('byteStride', size)) for k in range(a['count'])]
    def primitive(mesh):
        p = data['meshes'][mesh]['primitives'][0]; a = p['attributes']
        verts = [list(p + n + uv) for p, n, uv in zip(accessor(a['POSITION']), accessor(a['NORMAL']), accessor(a['TEXCOORD_0']))]
        return verts, [i[0] for i in accessor(p['indices'])]
    return primitive


def clip(poly, axis, boundary, sign=1):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        da = (a[axis] - boundary) * sign; db = (b[axis] - boundary) * sign
        if da >= 0: out.append(a)
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            out.append([x + (y - x) * t for x, y in zip(a, b)])
    return out


def part(name, primitive, bone, material, transform, plane=None):
    source, indices = primitive; verts = []; faces = []; lookup = {}
    for k in range(0, len(indices), 3):
        poly = [source[i] for i in indices[k:k+3]]
        if plane: poly = clip(poly, *plane)
        if len(poly) < 3: continue
        ids = []
        for v in poly:
            v = transform(v.copy()); length = math.hypot(*v[3:6])
            v[3:6] = [n / length for n in v[3:6]]
            key = tuple(round(x, 6) for x in v)
            if key not in lookup: lookup[key] = len(verts) // 8; verts.extend(key)
            ids.append(lookup[key])
        for i in range(1, len(ids)-1):
            if len(set([ids[0], ids[i], ids[i+1]])) == 3: faces.extend([ids[0], ids[i], ids[i+1]])
    def encoded(values, fmt): return base64.b64encode(struct.pack('<' + fmt * len(values), *values)).decode()
    return dict(name=name, bone=bone, material=material, vertices=encoded(verts, 'f'), indices=encoded(faces, 'H'), vertexCount=len(verts)//8, triangles=len(faces)//3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pack', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'js/herodata.js')
    args = parser.parse_args(); root = args.pack
    body = root / 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
    hair = root / 'Hairstyles/Origin at 0/glTF (Godot)/Hair_SimpleParted.gltf'
    mesh = gltf(body); hairmesh = gltf(hair)
    # The head pivot is 1.53 m above the floor in both bind poses. Preserve
    # authored proportions, and center the neck on the game's forward axis.
    def head(v):
        # The athletic base has wide trapezius muscles. Keep the neck above
        # them and taper its lower ring into the existing jacket collar.
        blend = max(0, min(1, (1.59-v[1])/.035)) * max(0, min(1, (.075-v[2])/.055))
        v[0] *= 1-.4*blend
        v[1] -= 1.53+.065*blend
        v[2] = (v[2]+.041)*(1-.28*blend)-.024
        # A modest uniform scale matches the broader tailored game body.
        v[0] *= 1.1; v[1] = (v[1]-.07)*1.1+.04; v[2] *= 1.1
        return v
    def hand(side):
        def convert(v):
            x, y, z, nx, ny, nz, u, w = v; scale = .65
            return [side*.26 + side*(y-1.455)*scale, -.55-side*(x-side*.706)*scale, .01+(z+.065)*scale, side*ny, -side*nx, nz, u, w]
        return convert
    parts = [part('head', mesh(2), 1, 'heroSkin', head, (1, 1.555)), part('brows', mesh(0), 1, 'heroHair', head), part('eyes', mesh(1), 1, 'heroEyes', head), part('hair', hairmesh(0), 1, 'heroHair', head)]
    for side, bone in [(1,9),(-1,10)]: parts.append(part('handLeft' if side==1 else 'handRight', mesh(2), bone, 'heroSkin', hand(side), (0, side*.685, side)))
    textures = {'heroSkin': root/'Base Characters/Textures/T_Superhero_Male_Ligh.png', 'heroHair': hair.parent/'T_Hair_1_BaseColor.png', 'heroEyes': body.parent/'T_Eye_Brown.png'}
    images = {}
    for name, path in textures.items():
        im = Image.open(path).convert('RGB'); im.thumbnail((512,512), Image.Resampling.LANCZOS)
        stream = io.BytesIO(); im.save(stream, format='PNG', optimize=True)
        images[name] = {'c': 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()}
    digest = hashlib.sha256(json.dumps([parts,images],sort_keys=True).encode()).hexdigest()[:16]
    result = dict(version=digest, source='Quaternius Universal Base Characters Standard (CC0)', parts=parts, mats=images)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('// Generated by tools/assets/import-hero.py. Quaternius CC0; see tools/assets/HERO-SOURCES.md.\nconst HERODATA = '+json.dumps(result,separators=(',',':'))+';\n')
    print(f'Wrote {args.output}: {args.output.stat().st_size//1024} KiB; {sum(p["triangles"] for p in parts)} triangles')
    for path in [body,body.with_suffix('.bin'),hair,hair.with_suffix('.bin'),*textures.values()]: print(hashlib.sha256(path.read_bytes()).hexdigest(), path.relative_to(root))

if __name__ == '__main__': main()
