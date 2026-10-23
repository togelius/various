import json, sys, urllib.request
u = sys.argv[1]
with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'probe'}), timeout=30) as r:
    d = json.load(r)
for m in d:
    tags = [t for t in m.get('tags', []) if t.startswith('license:')]
    print(m.get('id'), m.get('createdAt','')[:10], m.get('downloads'), m.get('likes'), tags)
