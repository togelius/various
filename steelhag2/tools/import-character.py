#!/usr/bin/env python3
"""Compile Quaternius modular-men GLBs into a compact, offline character asset.
Usage: import-character.py hoodie.glb trousers.glb output.js
The unmodified source GLBs and CC0 attribution live in assets/character/.
"""
import sys,json,struct,base64,pathlib,math
from collections import defaultdict

def read(path):
 b=pathlib.Path(path).read_bytes(); n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),b[28+n:]
def accessor(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 typ={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]; size=struct.calcsize(typ);stride=v.get('byteStride',n*size);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [c for j in range(a['count']) for c in struct.unpack_from('<'+typ*n,b,offset+j*stride)]
def soften_normals(pos,norm):
 # Smooth cloth's deliberately faceted source normals while retaining creases.
 groups=defaultdict(list)
 for i in range(len(pos)//3):groups[tuple(round(v,7) for v in pos[i*3:i*3+3])].append(i)
 out=[]
 for i in range(len(pos)//3):
  n=norm[i*3:i*3+3];same=groups[tuple(round(v,7) for v in pos[i*3:i*3+3])];total=[0,0,0]
  for j in same:
   other=norm[j*3:j*3+3]
   if sum(a*b for a,b in zip(n,other))>.50:
    for k in range(3):total[k]+=other[k]
  length=math.sqrt(sum(v*v for v in total)) or 1
  out.extend(v/length for v in total)
 return out
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
   if part.endswith('Head') and mat=='Hair':continue # Replaced by a fitted wool cap.
   if part.endswith('Body'):col=[.73,.38,.23] if mat!='Skin' else [.16,.18,.18]
   elif part.endswith('Legs'):col=[.32,.36,.37]
   elif part.endswith('Feet'):col=[.25,.235,.20]
   else:
    tile='FLAT';col={'Skin':[.64,.47,.35],'Hair':[.16,.14,.105],'Eyebrows':[.11,.095,.08],'Eye':[.07,.08,.08]}.get(mat,[.4,.4,.4])
   pos=accessor(d,buf,attrs['POSITION']);norm=accessor(d,buf,attrs['NORMAL']);norm=soften_normals(pos,norm)
   parts.append(dict(name=part,material=mat,p=enc(pos),n=enc(norm),j=enc(accessor(d,buf,attrs['JOINTS_0']),'H'),w=enc(accessor(d,buf,attrs['WEIGHTS_0'])),i=enc(accessor(d,buf,prim['indices']),'I'),joints=joints,ibm=ibm,col=col,tile=tile))
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
