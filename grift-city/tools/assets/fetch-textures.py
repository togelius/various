#!/usr/bin/env python3
"""Download CC0 PBR materials from ambientCG into a local cache.

Usage: fetch-textures.py <cache-dir> [material ...]
With no material names the list in textures.json is used. Each material lands in
<cache-dir>/<AssetId>/ with Color.jpg, Normal.jpg and Roughness.jpg.
Everything on ambientCG is CC0; see tools/assets/SOURCES.md.
"""
import sys, os, io, json, zipfile, urllib.request

UA = {'User-Agent': 'grift-city-asset-fetch/1 (hobby game; contact via repo)'}
def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r: return r.read()

def grab(asset, cache, res='1K-JPG'):
    out = os.path.join(cache, asset)
    if os.path.exists(os.path.join(out, 'Color.jpg')): return 'cached'
    os.makedirs(out, exist_ok=True)
    data = fetch('https://ambientcg.com/get?file=%s_%s.zip' % (asset, res))
    z = zipfile.ZipFile(io.BytesIO(data)); got = []
    for n in z.namelist():
        low = n.lower()
        for key, tag in (('_color.', 'Color'), ('_normalgl.', 'Normal'), ('_roughness.', 'Roughness'), ('_displacement.', 'Displacement')):
            if key in low:
                ext = os.path.splitext(n)[1]
                open(os.path.join(out, tag + ext), 'wb').write(z.read(n)); got.append(tag)
    return ','.join(got) or 'nothing'

if __name__ == '__main__':
    cache = sys.argv[1]; names = sys.argv[2:]
    if not names:
        spec = json.load(open(os.path.join(os.path.dirname(__file__), 'textures.json')))
        names = sorted({e['material'] for e in spec['layers'].values() if e.get('material')})
    os.makedirs(cache, exist_ok=True)
    for i, a in enumerate(names):
        try: print('%3d/%d %-22s %s' % (i + 1, len(names), a, grab(a, cache)), flush=True)
        except Exception as e: print('%3d/%d %-22s FAILED %s' % (i + 1, len(names), a, e), flush=True)
