// Animation invariants that matter in play: exact joints, grounded strafe steps, supported weapons and frame-rate-independent transitions.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({console,assert,TEX:{names:{}},RENDER:{MAX_BONES:14},W:{state:{elapsed:0},cars:[],pushOut:(x,z)=>({x,z})},CITY:{groundY:()=>0}});
for(const name of ['math','meshes','peds'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
vm.runInContext(`
const at=(b,k,x,y,z)=>[0,1,2].map(i=>b[k*16+i]*x+b[k*16+4+i]*y+b[k*16+8+i]*z+b[k*16+12+i]);
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function pose(p){const b=new Float32Array(224);PEDS.buildRig({x:0,y:0,z:0,angle:0,phase:0,speed:0,...p},M.create(),b);return b;}
MESH.Builder.prototype.build=()=>({});let checks=0;
for(const fps of [30,60,120]){
 const p={angle:0,speed:0,aim:1,state:'foot'};
 for(let i=0;i<fps/5;i++)PEDS.updateMotion(p,1/fps);
 assert.ok(p.motion.aim>.97&&p.motion.aim<.98,'aim settles in 200 ms independent of refresh rate');
 p.aim=0;for(let i=0;i<fps/5;i++)PEDS.updateMotion(p,1/fps);
 assert.ok(p.motion.aim<.03,'lowering also blends');checks+=2;
}
for(const weapon of ['pistol','rifle','shotgun','uzi'])for(const pitch of [-.6,0,.5]){
 const b=pose({weapon,aim:1,camPitch:pitch}),long=['rifle','shotgun'].includes(weapon);
 const gun=PEDS.heldEntity({model:M.identity(M.create()),bones:b,weapon,weaponOut:true,aim:1,angle:0,camPitch:pitch,state:'foot'}).model;
 const hand=at(b,9,.26,-.6,0),grip=at(gun,0,.04,long?-.10:0,-.035);
 if(long){const barrel=at(gun,0,0,-1,0),origin=at(gun,0,0,0,0);assert.ok(Math.abs((barrel[1]-origin[1])+Math.sin(pitch))<.001,'rifle wrist follows aim pitch');
 if(pitch===0){const stock=at(gun,0,0,.35,.05),shoulder=at(b,6,-.26,.6,0);assert.ok(dist(stock,shoulder)<.18,'stock rests near the shoulder');}}
 assert.ok(dist(hand,grip)<.045,'off-hand reaches '+weapon+' grip at pitch '+pitch+' ('+dist(hand,grip)+')');
 for(const [arm,fore,sx] of [[2,9,.26],[3,10,-.26]])assert.ok(dist(at(b,arm,sx,-.31,0),at(b,fore,sx,-.31,0))<1e-6,'elbows stay attached during grip solve');
 checks++;
}
for(const direction of [-Math.PI/2,0,Math.PI/2,Math.PI]){
 const speed=2.4,stance=PEDS.gait(speed).stance;
 // Reverse phase for backward travel, exactly as the rig does.
 const rig=c=>pose({speed,aim:1,vx:Math.sin(direction)*speed,vz:Math.cos(direction)*speed,phase:c*stance*M.TAU*(Math.cos(direction)<-.2?-1:1)});
 const a=at(rig(.1),12,.11,-.86,.15),b=at(rig(.5),12,.11,-.86,.15),travel=speed*.4*stance/PEDS.cadence(speed);
 assert.ok(Math.abs(a[1])<.001&&Math.abs(b[1])<.001,'strafing soles stay on ground');
 assert.ok(Math.abs((b[0]-a[0])+travel*Math.sin(direction))<.002,'no sideways foot skating');
 assert.ok(Math.abs((b[2]-a[2])+travel*Math.cos(direction))<.002,'no forward/backward foot skating');checks+=3;
}
// Wrist blending preserves a rigid weapon and connected elbows throughout raising/lowering and reloading.
for(const aim of [.05,.25,.5,.75,1])for(const reloadT of [0,.15,.7,1.3]){
 const actor={weapon:'rifle',weaponOut:true,aim,motion:{aim},reloadT,reloadDuration:1.4,angle:0,camPitch:-.4,state:'foot'};
 const bones=pose(actor),model=M.identity(M.create());const gun=PEDS.heldEntity({...actor,bones,model}).model;
 assert.ok(Array.from(gun).every(Number.isFinite));for(const k of [0,4,8])assert.ok(Math.abs(Math.hypot(gun[k],gun[k+1],gun[k+2])-1)<.001,'weapon wrist stays rigid');
 assert.ok(dist(at(bones,3,-.26,-.31,0),at(bones,10,-.26,-.31,0))<1e-6,'right elbow remains connected during shoulder aim');
}
// NPC motion follows collision resolution; no walking animation against a solid wall or when pushed by traffic.
for(const fps of [30,60,120]){
 const p={x:0,y:0,z:0,angle:0,vx:0,vz:3,vy:0,speed:3,phase:0,state:'walk',airborne:false};
 W.pushOut=(x,z)=>({x:0,z:0});PEDS.Ped.prototype.moveBody.call(p,1/fps,false);
 assert.equal(p.speed,0);assert.equal(p.phase,0);assert.equal(p.animVz,0);checks++;
}
const p={x:0,y:0,z:0,angle:0,phase:1,speed:3.3,aim:0};const b1=pose(p),b2=pose(p);
assert.deepEqual(Array.from(b1),Array.from(b2),'rendering never advances animation state');
assert.ok(dist(at(b1,0,0,.6,.1),at(b1,6,0,.6,.1))>.01,'pelvis and chest articulate independently');
for(const state of [{airborne:true,vy:5},{airborne:true,vy:-7},{airborne:true,vaultPose:.9},{landing:1},{crouch:1},{state:'entering',entryPose:1,doorReach:.2}])assert.ok(Array.from(pose(state)).every(Number.isFinite));
console.log('Character motion: '+checks+' transition, grip, strafe and collision checks; articulated spine and pure rendering passed');
`,ctx);
