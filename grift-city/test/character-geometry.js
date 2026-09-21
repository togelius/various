// Hair must cover the back (-z), while beards sit on the face (+z).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ TEX: { names: {face: 71} }, RENDER: {MAX_BONES: 12}, W: {state: {elapsed: 1}} });
for (const file of ['math.js', 'meshes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), ctx);
const mesh = vm.runInContext('MESH', ctx);
const look = { skin: [.9,.7,.5], shirt: [.8,.8,.7], pants: [.2,.2,.3], hair: [.11,.07,.03], sleeves: true };
function vertices(b, predicate) {
  const out = [];
  for (let i = 0; i < b.v.length; i += 13) { const v = b.v.slice(i, i + 13); if (predicate(v)) out.push(v); }
  return out;
}
let count = 0;
for (const lod of [false, true]) {
  for (const style of [0, 2, 7]) {
    const b = mesh.pedMesh({ ...look, hairStyle: style }, lod);
    const hair = vertices(b, v => v[12] === 1 && v.slice(6,9).every((c,i) => c === look.hair[i]) && v[1] < .16);
    assert(hair.length > 0);
    if (style !== 7) assert(hair.every(v => v[2] < 0), 'short and long rear hair must stay behind the face');
    count++;
  }
  for (const jacket of [null, [.3,.2,.1]]) for (const sleeves of [false,true]) {
    const b = mesh.pedMesh({...look, jacket, sleeves}, lod);
    assert(b.v.every(Number.isFinite));
    assert(b.i.every(i => Number.isInteger(i) && i >= 0 && i < b.n));
    assert(vertices(b, v => v[12] === 9).length && vertices(b, v => v[12] === 10).length, 'forearms retained for animation');
    count++;
  }
}
const beard = mesh.pedMesh({...look, hairStyle: 5, beard: true});
const beardVerts = vertices(beard, v => v[12] === 1 && v.slice(6,9).every((c,i) => c === look.hair[i]) && v[1] < .12);
assert(beardVerts.length && beardVerts.every(v => v[2] > 0), 'beard must cover the chin, not the side of the head');
console.log(`${count + 1} character geometry cases passed`);

// Geometry must be deterministic and UV triangles must not smear eyes onto the back of the head.
for(const lod of [false,true]) {
 const a=mesh.pedMesh(look,lod), b=mesh.pedMesh(look,lod);
 assert.deepEqual(a.v,b.v);
 for(let i=0;i<a.i.length;i+=3) {
  const ids=a.i.slice(i,i+3).map(v=>v*13);
  if(ids.every(id=>a.v[id+11]===71)) {
   const us=ids.map(id=>a.v[id+9]);
   assert(Math.max(...us)-Math.min(...us)<=.500001,'face texture must wrap only at the back seam');
  }
 }
}
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/peds.js'),'utf8'),ctx);
const peds=vm.runInContext('PEDS',ctx), math=vm.runInContext('M',ctx);
const at=(m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
const near=(a,b,msg)=>assert(Math.hypot(...a.map((x,i)=>x-b[i]))<1e-6,msg);
let rigChecks=0;
function checkJoints(b) {
 for(const [arm,fore,x] of [[2,9,.26],[3,10,-.26]]) {
  near(at(b.subarray(0,16),x,.6,0),at(b.subarray(arm*16,arm*16+16),x,0,0),'shoulder must remain attached to the torso');
  near(at(b.subarray(arm*16,arm*16+16),x,-.31,0),at(b.subarray(fore*16,fore*16+16),x,-.31,0),'elbow must remain attached');
 }
 near(at(b.subarray(0,16),0,.68,0),at(b.subarray(16,32),0,0,0),'neck must remain attached');
 assert(Array.from(b).every(Number.isFinite));rigChecks++;
}
for(const speed of [0,1.5,3.3,6]) for(const phase of [0,.7,1.6,3.2,4.8]) for(const aim of [0,1]) {
 const p={x:0,y:0,z:0,angle:.2,phase,speed,aim,state:'foot',vx:1,vz:1,camPitch:.3};
 const bones=new Float32Array(192),model=math.create();peds.buildRig(p,model,bones);checkJoints(bones);
}
for(const driving of [false,true]) for(const bike of [false,true]) {
 const bones=new Float32Array(192);peds.buildRigSeated({},math.create(),bones,math.identity(math.create()),0,0,0,0,driving,.3,1,bike);checkJoints(bones);
}
console.log(`${rigChecks} animated rig cases passed; deterministic meshes and face UV seams passed`);
