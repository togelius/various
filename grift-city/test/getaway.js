// Regressions for the getaway plan: markers that cannot pile up, cars that stay where you left them, and an aim
// lock that works at the resting camera pitch.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const noop=()=>{};const ctx=vm.createContext({console,assert,URLSearchParams,location:{search:'?seed=42'},setTimeout:noop,
 TEX:{shopKinds:[],names:new Proxy({},{get:()=>0})},RENDER:{MAX_BONES:14,env:{wet:0},cam:{},setCamera:noop},
 AUDIO:new Proxy({},{get:()=>noop}),HUD:new Proxy({},{get:()=>noop}),INPUT:{touch:true,down:()=>false,hit:()=>false,pad:{buttons:[],pressed:[]},mouse:{}},GAME:{save:noop,options:{}},ECON:{S:{rep:{marla:0}},onMissionPassed:noop,discount:()=>1}});
for(const n of ['math','assets','meshes','streets','city','world','tactics','peds','vehicles','player','police','missions'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),ctx,{filename:n+'.js'});
vm.runInContext(`
MESH.Builder.prototype.build=MESH.Builder.prototype.buildInstanced=function(){return {}};CITY.generate();W.initProps();PLAYER.init(0,0,0);
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
// 1. Idle job markers and taxi destinations are re-issued every frame; the list must stay bounded.
const P=PLAYER.P;const g=CITY.place('mission');P.x=g.x+30;P.z=g.z;P.alive=true;MISSIONS.S.progress=4;MISSIONS.S.cooldown=0;
for(let i=0;i<600;i++)MISSIONS.update(1/60);
check(MISSIONS.S.markers.length<=8,'idle job markers do not accumulate ('+MISSIONS.S.markers.length+')');
// 2. Despawn keeps bought cars and the car you last drove; other cars you drove once still go.
W.cars.length=0;
const bought=VEH.spawn('sedan',P.x+400,P.z,0,{mode:'parked'});bought.playerOwned=bought.owned=true;
const left=VEH.spawn('sports',P.x+420,P.z,0,{mode:'parked'});left.playerOwned=true;P.lastCar=left;
const old=VEH.spawn('van',P.x+440,P.z,0,{mode:'parked'});old.playerOwned=true;
VEH.despawn(P.x,P.z);
check(!bought.removed,'a bought car survives despawn');check(!left.removed,'the car you left survives despawn');check(old.removed,'older stolen cars are still recycled');
// 3. Aim lock at the resting camera pitch: a target 20 m ahead is acquired and a locked shot is aimed at it.
W.cars.length=0;W.peds.length=0;P.car=null;P.x=300;P.z=300;P.y=CITY.groundY(300,300);P.camYaw=0;P.camPitch=.28;P.aim=1;P.camX=300;P.camZ=295;
Object.assign(RENDER.cam,{x:300,y:P.y+3.2,z:295.5,tx:300,ty:P.y+1.5,tz:300});
const t=PEDS.spawn(300,320);t.hostile=true;t.y=CITY.groundY(300,320);
const blocked=!W.sight3(300,P.y+1.35,300,300,t.y+1.2,320);
if(!blocked){PLAYER.aimAngle(.16);check(P.aimTarget===t,'a hostile 20 m ahead is locked at the resting camera pitch');
 P.camPitch=.28;Object.assign(RENDER.cam,{ty:P.y+1.5+14});PLAYER.aimAngle(.16);check(P.aimTarget===null,'no lock when the crosshair is far above the target');}
// 4. AI cars can back out: a chase car told to reverse from a standstill actually moves backwards.
W.cars.length=0;const cc=VEH.spawn('police',310,310,0,{mode:'chase'});cc.ai.target={x:310,z:250,P:{y:0}};cc.ai.reverseT=1;const z0=cc.z;
for(let i=0;i<40;i++){cc.aiChase(1/60);cc.physics(1/60);}
check(cc.z<z0-.3,'a chase car reverses from a standstill ('+(cc.z-z0).toFixed(2)+' m)');
// 5. Respawns step out toward open street and face it.
for(const where of ['hospital','police']){P.x=100;P.z=100;PLAYER.respawn(where);const f=[Math.sin(P.angle),Math.cos(P.angle)];check(!CITY.insideLot(P.x,P.z)&&!CITY.insideLot(P.x+f[0]*8,P.z+f[1]*8),where+' respawn faces open ground');}
// 6. Pay 'n' Spray charges once per visit, and only with stars or damage.
{W.cars.length=0;const sp=CITY.places.spray[0];const car=VEH.spawn('sedan',sp.x,sp.z,0,{mode:'parked'});P.car=car;P.x=sp.x;P.z=sp.z;P.money=1000;MISSIONS.S.current=null;MISSIONS.S.sprayT=0;
 for(let i=0;i<120;i++)MISSIONS.update(1/60);check(P.money===1000,'no charge for a clean car with no stars');
 POLICE.setStars(2);for(let i=0;i<60*15;i++)MISSIONS.update(1/60);check(P.money===900&&P.wanted===0,'one respray clears the stars ('+P.money+')');
 P.car=null;}
// 7. A closed shop menu stays closed until you step away.
{const gs=CITY.places.guns[0];W.state.time=12;P.car=null;P.x=gs.x;P.z=gs.z;MISSIONS.S.shop=null;MISSIONS.S.shopLatch=null;MISSIONS.update(1/60);check(MISSIONS.S.shop&&MISSIONS.S.shop.kind==='guns','gun shop opens');
 MISSIONS.closeShop();for(let i=0;i<30;i++)MISSIONS.update(1/60);check(!MISSIONS.S.shop,'closed shop does not reopen while you stand there');
 P.x=gs.x+8;MISSIONS.update(1/60);P.x=gs.x;MISSIONS.update(1/60);check(MISSIONS.S.shop,'it opens again after stepping away');MISSIONS.closeShop();}
console.log('Getaway: '+checks+' checks passed'+(blocked?' (aim scene blocked; aim checked in browser)':''));
`,ctx);
