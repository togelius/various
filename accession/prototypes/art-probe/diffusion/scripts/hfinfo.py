import json, sys, urllib.request
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'probe'}), timeout=30) as r:
        return json.load(r)
for rid in sys.argv[1:]:
    try:
        d = get(f'https://huggingface.co/api/models/{rid}?blobs=true')
    except Exception as e:
        print(rid, 'ERR', e); continue
    cd = d.get('cardData') or {}
    lic = cd.get('license'); ln = cd.get('license_name'); ll = cd.get('license_link')
    sib = d.get('siblings') or []
    st = sum((s.get('size') or 0) for s in sib if s['rfilename'].endswith('.safetensors'))
    print(f"{rid}\n  license={lic} name={ln} link={ll} gated={d.get('gated')} created={d.get('createdAt','')[:10]} modified={d.get('lastModified','')[:10]} downloads={d.get('downloads')} params={ (d.get('safetensors') or {}).get('total')} safetensors_total_GB={st/1e9:.1f}")
