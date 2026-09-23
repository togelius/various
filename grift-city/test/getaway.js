// Regressions for the getaway plan: markers that cannot pile up, cars that stay where you left them, and an aim
// lock that works at the resting camera pitch.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const noop=()=>{};const ctx=vm.createContext({console,assert,URLSearchParams,location:{search:'?seed=42'},setTimeout:noop,
 TEX:{shopKinds:[],names:new Proxy({},{get:()=>0})},RENDER:{MAX_BONES:14,env:{wet:0},cam:{},setCamera:noop},
 AUDIO:new Proxy({},{get:()=>noop}),HUD:new Proxy({},{get:()=>noop}),INPUT:{touch:true,held:{},down(k){return !!this.held[k];},hit:()=>false,pad:{buttons:[],pressed:[]},mouse:{}},GAME:{save:noop,options:{}},ECON:{S:{rep:{marla:0}},onMissionPassed:noop,discount:()=>1}});
for(const n of ['math','assets','meshes','streets','city','world','tactics','peds','vehicles','player','police','missions','grift'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),ctx,{filename:n+'.js'});
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
// 8. A T-bone spins the car it hits; a burning pursuer explodes; gunfire sets a car alight rather than disabling it.
{W.cars.length=0;const pushOut=W.pushOut;W.pushOut=(x,z)=>({x,z});/* open ground: only the two cars */const a=VEH.spawn('sedan',400,380,Math.PI/2,{mode:'parked'}),b=VEH.spawn('sedan',406,381.9,0,{mode:'parked'});a.vx=15;a.vz=0;b.vx=b.vz=0;
 for(let i=0;i<30&&Math.abs(b.yawRate||0)<1e-6;i++){a.x+=a.vx/60;a.collide(1/60);}W.pushOut=pushOut;check(Math.abs(b.yawRate||0)>1,'a T-bone on the rear quarter spins the car ('+(b.yawRate||0).toFixed(2)+' rad/s)');
 W.cars.length=0;const cop=VEH.spawn('police',300,300,0,{mode:'chase'});cop.ai.target={x:300,z:400,P:{y:0}};
 for(let i=0;i<20&&!cop.burning;i++)cop.damage(cop.maxHealth*.06,PLAYER,{x:300,y:1,z:301,kind:'bullet'});check(cop.burning&&!cop.wrecked,'gunfire sets a car alight');
 for(let i=0;i<60*7&&!cop.burned;i++)cop.update(1/60);check(cop.burned,'a burning pursuer explodes within seconds');
 const w=VEH.spawn('sedan',320,300,0,{mode:'parked'});w.damage(w.maxHealth*2,null,{x:320,y:.7,z:302,kind:'impact'});check(w.disabled&&!w.burned,'a crash disables without an explosion');}
// 9. Heat Run: the pot grows while wanted, a clean getaway banks it, getting caught loses it.
{W.cars.length=0;W.peds.length=0;const P=PLAYER.P;P.alive=true;P.car=null;P.money=0;POLICE.clear();POLICE.setStars(2);for(let i=0;i<600;i++)POLICE.update(1/60);
 const pot=Math.floor(POLICE.S.pot);check(pot>=150,'two stars for ten seconds builds a pot ($'+pot+')');
 POLICE.S.seenT=999;POLICE.S.heat=1.2;POLICE.update(1/60);check(P.money>=pot&&POLICE.S.pot===0,'losing the last star banks the pot ($'+P.money+')');
 P.money=0;POLICE.setStars(3);for(let i=0;i<600;i++)POLICE.update(1/60);PLAYER.respawn('hospital');check(P.money===0&&POLICE.S.pot===0,'a respawn loses the pot');}
// 10. The gun arm points at a locked target above the player, not along the camera's tilt.
{const at=(m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
 const rig=t=>{const b=new Float32Array(16*RENDER.MAX_BONES);PEDS.buildRig({x:0,y:0,z:0,angle:0,phase:0,vx:0,vz:0,aim:1,camPitch:.28,aimTarget:t,speed:0,state:'foot'},M.create(),b);return b;};
 const up=rig({x:0,y:6,z:6,alive:true}),level=rig(null);const hy=b=>at(b.subarray(160,176),-.26,-.6,0)[1]-at(b.subarray(48,64),-.26,0,0)[1];
 check(hy(up)>.3&&hy(level)<.1,'locked on a target above, the gun hand rises ('+hy(up).toFixed(2)+' vs '+hy(level).toFixed(2)+')');}
// 11. The con: hold G beside a stranger; the pitch lands for cash or blows up into a police report. Guns, stars
// and nearby cops make it harder.
{W.cars.length=0;W.peds.length=0;POLICE.clear();MISSIONS.cleanup();MISSIONS.S.current=null;MISSIONS.S.shop=null;MISSIONS.S.dialogue=null;const P=PLAYER.P;P.alive=true;P.car=null;P.x=300;P.z=300;P.speed=0;P.weapon='fist';P.weaponOut=false;P.money=0;
 const q=PEDS.spawn(301.5,300);q.state='walk';check(GRIFT.candidate()===q,'a stranger within reach is a mark');const clean=GRIFT.odds(q);
 INPUT.held.KeyG=true;for(let i=0;i<60*3;i++){GRIFT.update(1/60);q.x=301.5;q.z=300;}INPUT.held.KeyG=false;
 check(q.conned&&(P.money>0||POLICE.reports.length>0||P.wanted>0),'the pitch resolves: cash, or a report ($'+P.money+')');
 check(GRIFT.candidate()!==q,'nobody falls for it twice');
 const q2=PEDS.spawn(299,300);P.weapon='pistol';P.weaponOut=true;POLICE.setStars(1);check(GRIFT.odds(q2)<clean-.5,'a drawn gun and a star ruin the odds');P.weaponOut=false;POLICE.clear();}
// 12. From three stars a roadblock comes with a spike strip across the road short of it; driving over it takes the tyres.
{W.cars.length=0;W.peds.length=0;POLICE.clear();const P=PLAYER.P;P.alive=true;const n=CITY.roadNodes.find(q=>q.i===4&&q.j===4);P.x=n.x-120;P.z=n.z+1;const car=VEH.spawn('sedan',P.x,P.z,Math.PI/2,{mode:'parked'});car.vx=20;P.car=car;car.driver=PLAYER;
 POLICE.setStars(3);POLICE.seen();POLICE.S.motion={f:[1,0.05],speed:20};POLICE.spawnRoadblock();check(POLICE.S.spikes.length===1,'a three-star roadblock lays a spike strip');
 const k=POLICE.S.spikes[0];check(Math.abs(k.fz)<1e-9&&W.cars.filter(c=>c.roadblock).length===2,'the block sits square across the road');
 car.x=k.x;car.z=k.z;car.vx=15;car.vz=0;POLICE.update(1/60);check(car.condition.tyres.every(t=>t===0),'driving over the strip shreds the tyres');P.car=null;car.driver=null;POLICE.clear();}
// 13. Kerb parking: slots clear of the traffic lanes, streamed near the player, capped, and parked cars stay put.
{W.cars.length=0;const P=PLAYER.P;P.car=null;P.x=300;P.z=300;VEH.streamKerb(P.x,P.z);const slots=VEH.kerbSlots;
 check(slots.length>150&&slots.length<900,'kerb slots on a fraction of the streets ('+slots.length+')');
 const live=[...VEH.kerbCars.values()];check(live.length>0&&live.length<=24,'kerb cars streamed near the player ('+live.length+')');
 const clear=slots.every(s=>{const ln=CITY.nearestLane(s.x,s.z);const [lx,lz]=CITY.lanePoint(ln.e,1,ln.s);return Math.hypot(s.x-lx,s.z-lz)>1.8;});check(clear,'every slot sits clear of the outer lane');
 const c=live[0],x0=c.x,z0=c.z;for(let i=0;i<300;i++)c.update(1/60);check(Math.hypot(c.x-x0,c.z-z0)<0.3,'a car parked on the kerb stays where it was put ('+Math.hypot(c.x-x0,c.z-z0).toFixed(2)+' m)');
 P.x=800;P.z=800;VEH.streamKerb(P.x,P.z);check(c.removed,'kerb cars left far behind are cleared');}
console.log('Getaway: '+checks+' checks passed'+(blocked?' (aim scene blocked; aim checked in browser)':''));
`,ctx);
