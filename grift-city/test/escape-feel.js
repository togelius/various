'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),noop=()=>{};
const ctx=vm.createContext({assert,console,URLSearchParams,location:{search:'?seed=42'},TEX:{names:{},shopKinds:[]},RENDER:{MAX_BONES:14,env:{wet:0},cam:{},setCamera(x,y,z,tx,ty,tz){Object.assign(this.cam,{x,y,z,tx,ty,tz});}},AUDIO:{play:noop,engine:noop,screech:noop},HUD:{notify:noop},MISSIONS:{dialogue:null,S:{},onExitCar:noop},POLICE:{crime:noop},GAME:{options:{cameraShake:0}}});
for(const name of ['math','assets','meshes','streets','city','world','input','vehicles','peds','player'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
vm.runInContext(`
MESH.Builder.prototype.build=()=>({});CITY.generate();const p=PLAYER.P;let checks=0;
function reset(){INPUT.releaseAll();Object.assign(p,{x:299,z:298,y:.15,vx:0,vz:0,vy:0,speed:0,angle:0,camYaw:0,state:'foot',car:null,alive:true,crouched:false,crouch:0,airborne:false,jumpBuffer:0,coyote:0,evadeT:0,evadeRecovery:0,exitPose:null,vault:null,motion:null,weapon:'fist',weaponOut:false});W.cars.length=0;}
for(const fps of [30,60,120])for(const running of [false,true]){
 reset();p.speed=6.8;p.vz=6.8;if(running){INPUT.holdKey('KeyW',true);INPUT.holdKey('ShiftLeft',true);}
 assert.ok(PLAYER.startVault());for(let i=0;i<fps&&p.state==='vaulting';i++){PLAYER.update(1/fps);INPUT.endFrame();}
 assert.equal(p.state,'foot');assert.ok(p.z>300);assert.ok(p.speed>(running?6.7:-1)&&p.speed<(running?6.9:.001),'momentum follows held movement at '+fps+' Hz');checks++;
}
const ground=CITY.groundY,lots=CITY.lotsNear;CITY.groundY=()=>0;CITY.lotsNear=()=>[];
for(const fps of [30,60,120]){
 reset();p.x=p.z=50;p.y=.06;p.airborne=true;p.vy=-2;INPUT.tapKey('Space');
 for(let i=0;i<Math.ceil(fps*.08);i++){PLAYER.update(1/fps);INPUT.endFrame();}
 assert.ok(p.vy>4&&p.y>.05,'jump pressed just before landing is honored');checks++;
 reset();p.x=p.z=50;p.y=.2;p.airborne=true;p.coyote=.07;INPUT.tapKey('Space');PLAYER.update(1/fps);INPUT.endFrame();
 assert.ok(p.vy>5,'late ledge jump succeeds');const before=p.vy;INPUT.tapKey('Space');PLAYER.update(1/fps);INPUT.endFrame();assert.ok(p.vy<before,'coyote cannot enable a second airborne jump');checks+=2;
}
reset();p.x=p.z=50;const car=VEH.spawn('sedan',50,50,0,{mode:'parked'});car.driver=PLAYER;car.ai.mode='player';p.car=car;p.state='car';p.camYaw=1.7;p.camIdle=9;
assert.ok(PLAYER.exitCar());assert.equal(p.camYaw,1.7,'exiting preserves the player camera heading');assert.equal(p.camIdle,0);checks++;
reset();p.x=p.z=50;p.camX=50;p.camZ=45;p.camY=3;p.camPitch=.15;PLAYER.giveWeapon('pistol',30);p.weapon='pistol';PEDS.updateMotion(p,1/60);PLAYER.updateCamera(1/60);const before=RENDER.cam.tx;
INPUT.holdKey('KeyC',true);PLAYER.update(1/60);assert.ok(Math.abs(RENDER.cam.tx-before)<.2,'aim shoulder offset blends instead of snapping');checks++;
PLAYER.setOutfit(0);assert.ok(p.look.bomber);PLAYER.setOutfit(1);assert.ok(p.look.tailored&&!p.look.bomber,'suit keeps its own collar and tailoring');checks++;
// During the committed sit-down phase, an early throttle press must finish entry instead of cancelling it.
reset();p.x=p.z=50;const entering=VEH.spawn('sedan',50,50,0,{mode:'parked'});Object.assign(p,{x:51.6,z:50,y:0,state:'entering',targetCar:entering,doorSide:-1,doorReach:.55,stateT:.7,enterFrom:[51.6,0,50]});
MISSIONS.onEnterCar=()=>{};AUDIO.radioStation=p.radio;INPUT.tapKey('KeyW');
for(let i=0;i<30;i++){PLAYER.update(1/60);INPUT.endFrame();}assert.equal(p.car,entering,'early throttle finishes committed entry');checks++;
CITY.groundY=ground;CITY.lotsNear=lots;
console.log('Escape feel: '+checks+' running/released vault, buffered/coyote jump, exit camera, aim camera and outfit checks passed');
`,ctx);
