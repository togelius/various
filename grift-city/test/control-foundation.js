// Physical invariants and action cancellation, independent of rendering frame rate.
'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const noop=()=>{};
const ctx=vm.createContext({console,assert,URLSearchParams,location:{search:'?seed=42'},TEX:{names:{}},
  RENDER:{MAX_BONES:14,env:{wet:0},cam:{},setCamera(x,y,z,tx,ty,tz){Object.assign(this.cam,{x,y,z,tx,ty,tz});}},
  AUDIO:{play:noop},HUD:{notify:noop},MISSIONS:{dialogue:null,S:{},onExitCar:noop},GAME:{state:'playing',options:{bindings:{}},saveOptions:noop}});
for (const name of ['math','meshes','city','world','input','peds','player','settings']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx,{filename:name+'.js'});
vm.runInContext(`
Object.assign(GAME.options,SETTINGS.defaults,{bindings:{}});
CITY.lotsNear=()=>[]; CITY.groundY=()=>0;
const p=PLAYER.P;
for(const fps of [30,60,120]) {
  Object.assign(p,{x:50,z:50,y:0,vx:0,vz:0,airborne:false,crouch:0,crouched:false,evadeT:0,evadeRecovery:0,phase:0,camYaw:0,camX:50,camZ:45,camY:3});
  CITY.lotsNear=()=>[{x0:40,x1:60,z0:51,z1:53,h:4}];
  INPUT.holdKey('KeyW',true);
  for(let i=0;i<fps*2;i++){PLAYER.update(1/fps);INPUT.endFrame();}
  assert.ok(p.speed<.001,'wall contact must stop gait at '+fps+' Hz');
  assert.ok(p.z<50.6,'wall is solid');
  assert.ok(p.brace>.8,'blocked movement braces');
  INPUT.releaseAll();
}
CITY.lotsNear=()=>[];
INPUT.tapKey('KeyZ');PLAYER.update(1/60);INPUT.endFrame();
for(let i=0;i<60;i++) PLAYER.update(1/60);
assert.ok(p.crouch>.99,'crouch settles');
INPUT.tapKey('KeyX');PLAYER.update(1/60);INPUT.endFrame();
assert.ok(p.evadeT>0 && p.evadeRecovery>.9,'evade has recovery');
for(let i=0;i<20;i++) PLAYER.update(1/60);
INPUT.tapKey('KeyX');PLAYER.update(1/60);INPUT.endFrame();
assert.equal(p.evadeT,0,'cannot chain evade before recovery');
const shoulder=p.shoulder;INPUT.tapKey('KeyV');PLAYER.update(1/60);INPUT.endFrame();
assert.equal(p.shoulder,-shoulder,'shoulder switches once per press');
SETTINGS.bind('KeyW','KeyS');
assert.equal(GAME.options.bindings.KeyS,'KeyW','binding conflicts swap');
INPUT.holdKey('KeyS',true);assert.ok(INPUT.down('KeyW'),'remapped key drives action');assert.ok(!INPUT.down('KeyS'),'old action does not fire');INPUT.releaseAll();
SETTINGS.sanitize(Object.assign(GAME.options,{sensitivity:NaN,cameraShake:8,hudScale:-2}));
assert.equal(GAME.options.sensitivity,1);assert.equal(GAME.options.cameraShake,1);assert.equal(GAME.options.hudScale,.8);
W.cars.push({x:50,y:0,z:47,fwd:[0,1],right:[-1,0],spec:{len:2,wid:2,hgt:2}});
assert.equal(W.raycast3(50,1,50,0,0,-1,8,null,'camera').kind,'car','camera sees vehicle cover');
console.log('Control foundation: wall motion at 30/60/120 Hz, crouch, recovery, shoulders, remapping, settings and camera collision passed');
`,ctx);
