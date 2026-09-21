// Deterministic regressions for shot geometry, timing, magazines and police knowledge.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const noop = () => {};
const ctx = vm.createContext({ console, assert, URLSearchParams, location: {search:'?seed=42'}, TEX:{names:{}},
  RENDER:{MAX_BONES:16,env:{wet:0},setCamera:noop}, AUDIO:{play:noop},
  HUD:{flashStars:noop,notify:noop,hitMark:noop}, MISSIONS:{dialogue:null,S:{},onExitCar:noop} });
for (const name of ['math','meshes','city','world','peds','player','police']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx,{filename:name+'.js'});
vm.runInContext(`
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++};
CITY.lotsNear=()=>[]; CITY.groundY=()=>0;
const ped={x:0,y:30,z:10,alive:true,state:'walk'};W.peds.push(ped);
check(W.raycast(0,0,0,1,50,null,1.35).kind==='none','horizontal bullets miss elevated targets');
check(W.raycast3(0,1.35,0,0,30,10,50).kind==='ped','pitched bullets hit elevated targets');
ped.y=0;
check(W.raycast3(0,1.35,0,0,0,1,50).kind==='ped','level bullet hits body');
check(W.raycast3(0,4,0,0,0,1,50).kind==='none','bullets above head miss');
check(W.raycast3(0,1.35,0,0,0,1,50,ped).kind==='none','shooter can be ignored');
const wall={x0:-2,x1:2,z0:5,z1:6,h:3};CITY.lotsNear=()=>[wall];
check(W.raycast3(0,1.35,0,0,0,1,50).kind==='lot','near wall wins over distant body');
check(W.sight3(0,1.5,0,0,1.5,10)===false,'wall blocks police sight');
check(W.sight3(0,10,0,0,10,10)===true,'sight passes above low building');
check(W.raycast3(0,1,5.5,0,0,1,50).dist===0,'muzzle inside wall cannot shoot through it');
check(W.raycast3(0,5,0,0,-1,0,10).kind==='ground','vertical downward ray hits floor');
CITY.lotsNear=()=>[];W.peds.length=0;
const car={x:0,y:0,z:10,spec:{len:5,wid:2,hgt:1.5},fwd:[0,1],right:[-1,0]};W.cars.push(car);
check(W.raycast3(0,1,0,0,0,1,50).dist===7.5,'car hitbox has correct length');
check(W.raycast3(0,2,0,0,0,1,50).kind==='none','bullet above car roof misses');
W.cars.length=0;
const p=PLAYER.P;p.weapon='pistol';p.weapons.pistol=40;
check(PLAYER.magazine()===17,'new magazine initializes within capacity');p.magazines.pistol=4;
check(PLAYER.reload(),'partial magazine starts reload');PLAYER.updateWeapon(.5);
check(PLAYER.magazine()===4 && p.reloadT>0,'reload cannot complete early');PLAYER.updateWeapon(1);
check(PLAYER.magazine()===17 && p.weapons.pistol===40,'reload conserves total ammo');
p.magazines.pistol=0;PLAYER.reload();p.weapon='fist';PLAYER.updateWeapon(.1);
check(p.reloadT===0 && p.magazines.pistol===0,'weapon switch cancels reload');
p.weapon='pistol';p.weapons.pistol=3;PLAYER.reload();PLAYER.updateWeapon(3);
check(PLAYER.magazine()===3,'short reserve produces partial magazine');
check(!PLAYER.reload(),'cannot reload a full available magazine');
for(const fps of [30,60,120]) {
 p.punchT=.3;p.recoil=.12;
 const bones=new Float32Array(16*RENDER.MAX_BONES),model=M.create();
 for(let i=0;i<fps;i++) {PLAYER.updateWeapon(1/fps);PEDS.buildRig(p,model,bones);PEDS.buildRig(p,model,bones);}
 check(p.punchT===0 && p.recoil===0,'animation expires after simulation time at '+fps+' fps');
}
p.punchT=.3;p.recoil=.12;const bones=new Float32Array(16*RENDER.MAX_BONES);PEDS.buildRig(p,M.create(),bones);
check(p.punchT===.3 && p.recoil===.12,'rendering does not change animation state');
p.x=100;p.z=200;p.wanted=2;POLICE.S.heat=2;POLICE.S.seenT=20;POLICE.S.lastSeen=[10,20];
POLICE.crime('shoot',100,200,null);
check(POLICE.S.seenT===20 && POLICE.S.lastSeen[0]===10,'unwitnessed shot does not reveal player');
POLICE.S.seenT=1;check(POLICE.pursuitPoint()[0]===10,'recent sighting is remembered, not live player position');
W.peds.push({x:100,z:195,y:0,isCop:true,alive:true});W.state.elapsed+=2;
POLICE.crime('shoot',100,200,null);
check(POLICE.S.seenT===0 && POLICE.S.lastSeen[0]===100,'visible crime updates location');
POLICE.clear();check(POLICE.S.lastSeen===null,'escaping clears stale search location');
// A blocked driver-side door must fall back to the passenger side.
W.peds.length=0;W.cars.push({...car,x:0,z:0,y:0,angle:0,absSpeed:0,controls:{},ai:{},circles:()=>[]});
p.car=W.cars[0];W.pushOut=(x,z)=>({x:x<0?x+1:x,z});
check(PLAYER.exitCar() && p.x>0,'safe exit chooses the open side');
console.log('Gameplay polish: '+checks+' checks passed');
`,ctx);
// Mission transitions are tested with controlled actors; no geometry or renderer is needed here.
ctx.ECON={S:{rep:{marla:0}},onMissionPassed:noop};ctx.GAME={save:noop};ctx.HUD.big=noop;ctx.HUD.money=noop;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/missions.js'),'utf8'),ctx,{filename:'missions.js'});
vm.runInContext(`
{
CITY.place=()=>({x:0,z:0});W.cars.length=0;W.peds.length=0;PLAYER.exitCar=()=>{PLAYER.P.car=null;return true;};
const repo=MISSIONS.LIST[1];
for(const condition of [100,50,10]) {
 const p=PLAYER.P;p.x=p.z=0;p.money=0;p.car={};
 const car={x:0,z:0,health:condition,maxHealth:100,driver:PLAYER,absSpeed:0};
 const owner={x:100,z:100,alive:true,inCar:null};
 MISSIONS.S.current=repo;MISSIONS.S.progress=1;repo.update({car,owner,fled:true},.016);
 assert.equal(p.money,1000+condition*6,'condition changes repo payout');
 assert.equal(MISSIONS.S.current,null,'delivery completes mission');
}
const p=PLAYER.P;p.x=p.z=0;p.money=0;
const car={x:0,z:0,health:100,maxHealth:100,driver:PLAYER,absSpeed:10};
MISSIONS.S.current=repo;repo.update({car,owner:{x:100,z:100,alive:true},fled:true},.016);
assert.equal(p.money,0,'delivery requires stopping');
const fleeing={x:10,z:0,health:60,maxHealth:100,driver:null,absSpeed:8,ai:{mode:'flee'},controls:{}};
const owner={x:10,z:0,alive:true,inCar:fleeing,exitCar(){this.inCar=null;fleeing.driver=null;},scare(){},say(){}};
fleeing.driver=owner;const data={car:fleeing,owner,fled:true};repo.update(data,.016);
assert.equal(data.surrendered,true,'damaged fleeing car produces nonlethal surrender');assert.equal(owner.alive,true);
console.log('Repo Man: 9 transition and payout checks passed');
}
`,ctx);
