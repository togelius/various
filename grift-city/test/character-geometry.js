// Hair must cover the back (-z), while beards sit on the face (+z).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ TEX: { names: {face: 71} }, RENDER: {MAX_BONES: 14}, W: {state: {elapsed: 1}} });
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
for(const gesturePulse of [0,.6]) for(const speed of [0,1.5,3.3,6]) for(const phase of [0,.7,1.6,3.2,4.8]) for(const aim of [0,1]) {
 const p={x:0,y:0,z:0,angle:.2,phase,speed,aim,gesturePulse,state:'foot',vx:1,vz:1,camPitch:.3};
 const bones=new Float32Array(224),model=math.create();peds.buildRig(p,model,bones);checkJoints(bones);
}
for(const driving of [false,true]) for(const bike of [false,true]) {
 const bones=new Float32Array(224);peds.buildRigSeated({},math.create(),bones,math.identity(math.create()),0,0,0,0,driving,.3,1,bike);checkJoints(bones);
}
console.log(`${rigChecks} animated rig cases passed; deterministic meshes and face UV seams passed`);

// A planted shoe stays level and at street height until the heel peels, across walk/jog/sprint speeds; the toe
// stays on the pavement to toe-off and slides back at exactly ground speed, so the feet never skate.
let footCases=0;
for(const speed of [1.5,3.3,6.8]) {
 const {stance}=peds.gait(speed), cps=peds.cadence(speed);
 const rig=cycle=>{const b=new Float32Array(224);peds.buildRig({x:0,y:0,z:0,angle:0,phase:cycle*Math.PI*2,speed,state:'walk'},math.create(),b);return b.subarray(192,208);};
 for(const c of [.03,.15,.3,.45,.6]) {
  const shoe=rig(c*stance);const a=at(shoe,.11,-.86,0),toe=at(shoe,.11,-.86,.15);
  assert(Math.abs(a[1])<.025,'stance sole must stay within 2.5 cm of the pavement');
  assert(Math.abs(a[1]-toe[1])<1e-6,'stance shoe must stay level');footCases++;
 }
 const toeAt=c=>at(rig(c*stance),.11,-.86,.15), t0=toeAt(.05);
 for(const c of [.3,.7,.95]) {
  const t=toeAt(c);assert(Math.abs(t[1])<.02,'toe must stay on the pavement until toe-off');
  assert(Math.abs((t[2]-t0[2])+speed*(c-.05)*stance/cps)<.01,'planted toe must slide back at ground speed');footCases++;
 }
}
assert(peds.gait(1.5).stance>.5&&peds.gait(3.3).stance<.5&&peds.gait(6.8).stance<peds.gait(3.3).stance,'walking has double support, running a flight phase');
assert(2*peds.cadence(1.5)<2.4&&2*peds.cadence(6.8)<4,'steps per second must stay human, not frantic');
console.log(`${footCases} planted-foot stance cases passed`);
