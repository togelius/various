'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),noop=()=>{};
const ctx=vm.createContext({console,assert,URLSearchParams,location:{search:'?seed=42'},TEX:{names:{}},RENDER:{MAX_BONES:14,cam:{},env:{wet:0}},GAME:{options:{steeringAssist:.35}},AUDIO:{play:noop},HUD:{notify:noop},POLICE:{crime:noop},MISSIONS:{rampageKill:noop},PLAYER:{shake:noop,alive:false}});
for(const n of ['math','meshes','city','world','vehicles'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),ctx,{filename:n+'.js'});
vm.runInContext(`
MESH.Builder.prototype.build=()=>({});CITY.groundY=()=>0;W.pushOut=(x,z)=>({x,z});
const spawn=type=>{W.cars.length=0;const c=VEH.spawn(type,300,300,0);c.driver=PLAYER;c.ai.mode='player';return c;};
const run=(c,t,fps=60)=>{for(let i=0;i<t*fps;i++)c.physics(1/fps);};
const stats=[];
for(const type of ['sedan','sports','pickup']) {const c=spawn(type);c.controls.throttle=1;run(c,8);const speed=c.absSpeed;assert.ok(speed>14);c.controls.throttle=0;c.controls.steer=.7;run(c,2);assert.ok(Number.isFinite(c.angle));stats.push({type,speed:+speed.toFixed(2),turn:+c.angle.toFixed(2)});}
assert.ok(stats[1].speed>stats[0].speed+3,'sports acceleration distinct');assert.ok(stats[2].speed<stats[0].speed,'utility momentum/acceleration distinct');
const stop=wet=>{RENDER.env.wet=wet;const c=spawn('sedan');c.vz=20;c.controls.brake=1;c.controls.reverse=false;let i=0;while(c.absSpeed>.2&&i++<600)c.physics(1/60);return c.z-300;};
const dry=stop(0),wet=stop(1);assert.ok(wet>dry*1.2,'wet braking distance longer');RENDER.env.wet=0;
const speeds=[];for(const fps of [30,60,120]){const c=spawn('sports');c.controls.throttle=1;run(c,4,fps);speeds.push(c.absSpeed);}assert.ok(Math.max(...speeds)-Math.min(...speeds)<.4,'frame-rate stable acceleration');
const settle=(type,hb)=>{const c=spawn(type);c.vz=20;let pk=0;for(let i=0;i<60;i++){c.controls.throttle=hb?0:.5;c.controls.handbrake=hb?1:0;c.controls.steer=1;c.physics(1/60);pk=Math.max(pk,Math.atan2(Math.abs(c.lat),Math.abs(c.speed))*57.3);}
 c.controls.handbrake=0;c.controls.steer=0;let t=0;for(let i=0;i<300;i++){c.physics(1/60);if(Math.abs(c.lat)>.4||Math.abs(c.yawRate)>.1)t=(i+1)/60;}return {pk,t};};
for(const type of ['sedan','sports','muscle','pickup']){const r=settle(type,false);assert.ok(r.t<.6&&r.pk<5,type+' grips: slip '+r.pk.toFixed(1)+' deg, settles in '+r.t.toFixed(2)+' s');}
assert.ok(settle('sports',true).pk>12,'the handbrake still breaks the rear loose');
{const c=spawn('sports');c.vz=20;for(let i=0;i<27;i++){Object.assign(c.controls,{handbrake:1,steer:1,throttle:.3});c.physics(1/60);}assert.ok(c.drift,'a handbrake flick at speed starts a drift');
 for(let i=0;i<60;i++){Object.assign(c.controls,{handbrake:0,steer:0,throttle:.8});c.physics(1/60);}assert.ok(c.drift&&Math.abs(c.lat)>2,'throttle and a neutral stick hold a sports car drift');
 for(let i=0;i<150&&c.drift;i++){Object.assign(c.controls,{throttle:0,steer:0});c.physics(1/60);}assert.ok(!c.drift&&c.lastDrift&&c.lastDrift.t>1,'lifting ends it cleanly');}
{const wall=(deg)=>{const c=spawn('sedan');c.angle=deg/57.3;c.vx=Math.sin(c.angle)*20;c.vz=Math.cos(c.angle)*20;W.pushOut=(x,z,r)=>x+r>303?{x:303-r,z,hit:[-1,0]}:{x,z};for(let i=0;i<60;i++)c.physics(1/60);W.pushOut=(x,z)=>({x,z});return c.absSpeed/20;};
 const glance=wall(12),square=wall(60);assert.ok(glance>.55,'a glancing wall keeps most of the speed ('+glance.toFixed(2)+')');assert.ok(square<.15,'a square hit stops the car ('+square.toFixed(2)+')');}
const c=spawn('sedan');c.damage(120,PLAYER,{x:301,y:.3,z:301.4,kind:'bullet'});assert.equal(c.condition.tyres[0],0);assert.equal(c.condition.tyres.filter(t=>t===0).length,1);assert.ok(c.dmg.front<.6);assert.equal(c.condition.engine,1,'tyre hit does not damage engine');
c.damage(300,PLAYER,{x:300,y:.7,z:302.2,kind:'impact'});assert.ok(c.condition.engine<1&&c.condition.cooling<c.condition.engine);
c.damage(100,PLAYER,{x:301,y:1.2,z:300,kind:'bullet'});assert.equal(c.condition.glass[2],0);
const saved=JSON.parse(JSON.stringify(c.saveCondition())),copy=spawn('sedan');copy.loadCondition(saved);assert.deepEqual(copy.condition,c.condition);assert.equal(copy.health,c.health);copy.repair();assert.equal(copy.condition.tyres[0],1);assert.equal(copy.dmg.pull,0);
c.damage(2000,null,{x:300,y:.7,z:302,kind:'impact'});assert.ok(c.disabled&&c.wrecked&&!c.burned,'collision disables without explosion');
const meshes=MESH.carMesh('sedan',[.4,.2,.1]);assert.ok(meshes.body.v.some((v,i)=>i%13===12&&v===11));assert.ok(meshes.glass.v.some((v,i)=>i%13===12&&v===12),'door windows move with panels');
console.log('Driving: '+JSON.stringify(stats)+'; dry/wet stop '+dry.toFixed(1)+'/'+wet.toFixed(1)+' m; rates, local damage, persistence, repair, disable and doors passed');
`,ctx);
