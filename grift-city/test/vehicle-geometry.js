// No browser or dependencies: validate generated surfaces, winding and damage seams.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ TEX: { names: {} } });
for (const file of ['math.js', 'meshes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
const MESH = vm.runInContext('MESH', context);
const point = (b, i) => b.v.slice(i * 13, i * 13 + 3);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
function triangles(b) { return Array.from({ length: b.i.length / 3 }, (_, i) => b.i.slice(i * 3, i * 3 + 3).map(j => point(b, j))); }
function hit(origin, dir, tri) {
  const [a,b,c] = tri, e1 = sub(b,a), e2 = sub(c,a), h = cross(dir,e2), det = dot(e1,h);
  if (Math.abs(det) < 1e-10) return Infinity;
  const s = sub(origin,a), u = dot(s,h)/det, q = cross(s,e1), v = dot(dir,q)/det;
  if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) return Infinity;
  const t = dot(e2,q)/det; return t >= -1e-8 ? t : Infinity;
}
let checks = 0;
for (const lod of [false, true]) {
  for (const type of ['truck', 'van', 'swat', 'bus']) {
  const {body, glass} = MESH.carMesh(type, [.2,.5,.3], {lod});
  const shell = triangles(body);
  for (const tri of triangles(glass)) {
    const center = tri[0].map((_, i) => (tri[0][i]+tri[1][i]+tri[2][i])/3);
    let normal = cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])); const len = Math.hypot(...normal); normal = normal.map(x=>-x/len);
    assert.ok(Math.min(...shell.map(t=>hit(center,normal,t))) < .025, `${type} pane must be backed by its body within 2.5 cm`); checks++;
  }
  }
  const van = MESH.carMesh('van', [.2,.5,.3], {lod});
  const rear = van.glass.v.filter((_,i)=>i%13===2 && van.glass.v[i+3]<-.9);
  assert.ok(rear.length > 0 && rear.every(z => z < -MESH.VEHICLES.van.len/2), 'van rear window must be outside rear cap'); checks++;
  const wheel = new MESH.Builder().wheel(0,0,0,.5,.3,1,lod?8:16);
  for (let i=0;i<wheel.i.length;i+=3) {
    const ids=wheel.i.slice(i,i+3), p=ids.map(j=>point(wheel,j));
    const geometric=cross(sub(p[1],p[0]),sub(p[2],p[0]));
    const normal=ids.map(j=>wheel.v.slice(j*13+3,j*13+6)).reduce((a,b)=>a.map((v,k)=>v+b[k]),[0,0,0]);
    assert.ok(dot(geometric,normal)>0, 'wheel triangles must face their outward normals, not be culled'); checks++;
  }
}
for (const type of ['sedan','sports','hatch','pickup','taxi','police','muscle']) {
  const clean=MESH.carMesh(type,[.2,.5,.3]), damaged=MESH.carMesh(type,[.2,.5,.3],{dent:1,seed:42});
  // Windscreens remain glass even when their slope gives them an upward-facing normal.
  assert.ok(clean.glass.v.some((v,i)=>i%13===4 && v>.55), `${type} has sloped glazing`); checks++;
  for(let i=0;i<clean.glass.n;i++) assert.deepEqual(Array.from(clean.glass.v.slice(i*13+6,i*13+9)), [.28,.38,.48], 'glass uses its own tint, not body paint');
  const positions = new Map(); for(let i=0;i<clean.body.n;i++) positions.set(point(clean.body,i).join(','),i);
  let seams=0;
  for(let i=0;i<clean.glass.n;i++) { const j=positions.get(point(clean.glass,i).join(',')); if(j===undefined)continue;
    assert.deepEqual(point(damaged.glass,i),point(damaged.body,j),'body and glass seam must deform together'); seams++; checks++;
  }
  assert.ok(seams>0, `${type} has shared body/glass vertices`);
}
console.log(`${checks} vehicle geometry checks passed`);
