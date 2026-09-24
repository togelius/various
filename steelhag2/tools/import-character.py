#!/usr/bin/env python3
"""Compile Quaternius modular-men GLBs into a compact, offline character asset.
Usage: import-character.py hoodie.glb trousers.glb output.js
The unmodified source GLBs and CC0 attribution live in assets/character/.
"""
import sys,json,struct,base64,pathlib

def read(path):
 b=pathlib.Path(path).read_bytes(); n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),b[28+n:]
def accessor(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 typ={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]; size=struct.calcsize(typ);stride=v.get('byteStride',n*size);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [c for j in range(a['count']) for c in struct.unpack_from('<'+typ*n,b,offset+j*stride)]
def enc(vals,typ='f'):return base64.b64encode(struct.pack('<'+typ*len(vals),*vals)).decode()
g,b=read(sys.argv[1]);other,ob=read(sys.argv[2]);names={n.get('name'):i for i,n in enumerate(g['nodes'])}
nodes=[{k:n[k] for k in ['name','translation','rotation','scale','children'] if k in n} for n in g['nodes']]
parts=[]
for d,buf,ends in [(g,b,('Body','Head')),(other,ob,('Legs','Feet'))]:
 for node in d['nodes']:
  if 'mesh' not in node or not node.get('name','').endswith(ends):continue
  skin=d['skins'][node['skin']];joints=[names[d['nodes'][j]['name']] for j in skin['joints']];ibm=enc(accessor(d,buf,skin['inverseBindMatrices']))
  for prim in d['meshes'][node['mesh']]['primitives']:
   attrs=prim['attributes'];mat=d['materials'][prim['material']]['name'];part=node['name'];col=[.4,.4,.4];tile='CLOTH'
   if part.endswith('Body'):col=[.68,.34,.20] if mat!='Skin' else [.16,.18,.18]
   elif part.endswith('Legs'):col=[.24,.29,.32]
   elif part.endswith('Feet'):col=[.11,.12,.11]
   else:
    tile='FLAT';col={'Skin':[.64,.47,.35],'Hair':[.16,.14,.105],'Eyebrows':[.11,.095,.08],'Eye':[.07,.08,.08]}.get(mat,[.4,.4,.4])
   parts.append(dict(name=part,p=enc(accessor(d,buf,attrs['POSITION'])),n=enc(accessor(d,buf,attrs['NORMAL'])),j=enc(accessor(d,buf,attrs['JOINTS_0']),'H'),w=enc(accessor(d,buf,attrs['WEIGHTS_0'])),i=enc(accessor(d,buf,prim['indices']),'I'),joints=joints,ibm=ibm,col=col,tile=tile))
clips={}
for a in g['animations']:
 name=a['name'].split('|')[-1]
 if name not in ['Idle_Neutral','Walk','Run','Interact','Idle_Gun_Pointing','Death']:continue
 tracks=[];duration=0
 for c in a['channels']:
  s=a['samplers'][c['sampler']];t=accessor(g,b,s['input']);v=accessor(g,b,s['output']);sz=4 if c['target']['path']=='rotation' else 3;duration=max(duration,t[-1]);assert s.get('interpolation','LINEAR')=='LINEAR'
  if all(abs(v[i]-v[i%sz])<1e-6 for i in range(len(v))):t=t[:1];v=v[:sz]
  tracks.append(dict(node=c['target']['node'],path=c['target']['path'],t=enc(t),v=enc(v)))
 clips[name]=dict(duration=duration,tracks=tracks)
out=dict(nodes=nodes,parts=parts,clips=clips)
pathlib.Path(sys.argv[3]).write_text('// Quaternius, CC0. Compiled by tools/import-character.py; see assets/character/README.md.\nconst CHARACTER_ASSET='+json.dumps(out,separators=(',',':'))+';\n')
print(len(parts),'mesh parts;',len(clips),'authored clips;',pathlib.Path(sys.argv[3]).stat().st_size,'bytes')
