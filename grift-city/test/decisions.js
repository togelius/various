'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),noop=()=>{};
const ctx=vm.createContext({console,assert,URLSearchParams,location:{search:'?seed=42'},TEX:{names:{},shopKinds:[]},RENDER:{MAX_BONES:14,env:{wet:0},cam:{},setCamera:noop},GAME:{options:{}},AUDIO:new Proxy({},{get:()=>noop}),HUD:new Proxy({},{get:()=>noop}),MISSIONS:{S:{},dialogue:null,rampageKill:noop},ECON:{craneHostile:()=>false}});
for(const n of ['math','assets','meshes','streets','city','world','input','vehicles','tactics','peds','player','police'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),ctx,{filename:n+'.js'});
vm.runInContext(`
MESH.Builder.prototype.build=MESH.Builder.prototype.buildInstanced=()=>({});CITY.generate();const p=PLAYER.P;
Object.assign(p,{x:252,y:0,z:336,alive:true,car:null,wanted:0});
const witness=PEDS.spawn(254,336);POLICE.crime('kill',p.x,p.z,null);assert.equal(POLICE.reports.length,1);assert.equal(POLICE.S.lastSeen,null,'call does not reveal location immediately');
p.x=280;POLICE.updateReports(6);assert.equal(POLICE.S.lastSeen[0],252,'report remembers crime position, not current player');assert.equal(p.wanted,1);
POLICE.clear();W.peds.length=0;
const a=VEH.spawn('sedan',252,336,0);a.identity='A';p.car=a;p.x=a.x;p.z=a.z;POLICE.setStars(2);POLICE.seen();POLICE.S.seenT=6;
const cop={x:252,z:306,y:0,angle:0};assert.ok(POLICE.identified(cop));
const b=VEH.spawn('sedan',252,336,0);b.identity='B';p.car=b;assert.ok(!POLICE.identified(cop),'unseen vehicle swap breaks identification');
p.car=a;b.removed=true;a.colIdx=(a.colIdx+1)%VEH.PALETTE.length;assert.ok(!POLICE.identified(cop),'unseen repaint breaks description');
a.colIdx=POLICE.S.description.color;assert.ok(POLICE.observe(cop),'matching car observed');POLICE.S.seenT=8;
const q1=POLICE.pursuitPoint({}),q2=POLICE.pursuitPoint({});assert.notDeepEqual(q1,q2,'units search different sectors');
W.cars.length=0;p.car=null;p.x=299;p.y=.15;p.z=290;
const guard=PEDS.spawn(299,302,{gang:true,hostile:true,weapon:'pistol'});guard.suppression=.9;
const cover=TACTICS.coverPoints(guard,p);assert.ok(cover.length,'reachable low cover behind foundry wall');
TACTICS.step(guard,PLAYER,.1,true);assert.equal(guard.tactics.role,'cover');assert.ok(guard.tactics.cover);
TACTICS.nearShot(PLAYER,298,1.4,295,300,1.4,305);assert.ok(guard.suppression>.5);
const remembered=guard.tactics.seen.x;p.x+=30;TACTICS.step(guard,PLAYER,.1,false);assert.equal(guard.tactics.seen.x,remembered,'unseen target position stays local');
guard.tacticalAmmo=0;guard.fireAt(PLAYER,.1);assert.ok(guard.reloadT>0,'NPC magazines have reload openings');
// Collision-aware sight sees a parked car, but can ignore an observer or target's own car.
W.cars.length=0;const coverCar=VEH.spawn('van',252,336,0);assert.ok(!W.sight3(246,1,336,258,1,336));assert.ok(W.sight3(246,1,336,258,1,336,[coverCar]));
console.log('Decisions: delayed reports, remembered positions, vehicle identity/paint, independent searches, reachable cover, suppression, reloads and car occlusion passed');
`,ctx);
