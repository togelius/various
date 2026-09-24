// Visible regression fixture: only initial setup places actors. Subsequent controls use ordinary game input.
'use strict';
window.__manual=true;GAME.save=()=>false;
if(!AUDIO.muted)AUDIO.toggleMute();
INPUT.onLockLost=()=>{};
const report=document.querySelector('#escape-status');
let firstCar,secondCar,startTime=0,started=false,live=false,seenHeat=false;
const milestones=[];
const originalUpdate=PLAYER.update;
PLAYER.update=function(dt){originalUpdate(dt);if(started)observe();};
function mark(label){if(!milestones.some(m=>m.label===label))milestones.push({label,at:+(W.state.elapsed-startTime).toFixed(2),hp:Math.round(PLAYER.P.health)});}
function observe(){const p=PLAYER.P;if(p.wanted)seenHeat=true;if(p.car===firstCar)mark('Stole first car');if(firstCar.health<firstCar.maxHealth-3)mark('Real collision damage');if(!p.car&&milestones.length>=2)mark('Abandoned car');if(p.state==='vaulting')mark('Vaulted cover');if(p.car===secondCar)mark('Switched cars');if(p.car===secondCar&&seenHeat&&!p.wanted)mark('Lost pursuit');if(!p.alive)mark('Player down');}
function status(){if(!started)return;const p=PLAYER.P,c=p.car;report.textContent=JSON.stringify({sound:AUDIO.muted?'muted':'ON',elapsed:+(W.state.elapsed-startTime).toFixed(1),state:p.state,pos:[p.x,p.z].map(v=>+v.toFixed(2)),speed:+(c?c.absSpeed:p.speed).toFixed(2),health:Math.round(p.health),wanted:p.wanted,firstCarHealth:Math.round(100*firstCar.health/firstCar.maxHealth),vault:!!PLAYER.vaultCandidate(),milestones},null,2);}
function draw(){window.__renderOnce();status();}
function step(t,keys){GAME.state='playing';window.__sim(t,keys);draw();}
document.querySelector('#start').onclick=()=>{
 if(!window.__ready)return;
 window.__manual=true;live=false;GAME.state='playing';INPUT.releaseAll();INPUT.releaseLock();
 MISSIONS.cleanup();Object.assign(MISSIONS.S,{current:null,dialogue:null,retry:null,cooldown:99999,shop:null,objective:'Steal. Crash. Vault the low wall. Switch cars.',blip:null});POLICE.clear();HUD.clearBig();
 W.cars.forEach(c=>c.removed=true);W.peds.forEach(p=>p.removed=true);W.pickups.length=0;
 firstCar=VEH.spawn('sedan',299,280,0,{mode:'parked',color:2});firstCar.driver=PEDS.spawnDriver(firstCar);firstCar.isMission=true;
 secondCar=VEH.spawn('sports',298,309,0,{mode:'parked',color:4});secondCar.isMission=true;
 const p=PLAYER.P;Object.assign(p,{x:301.5,y:.15,z:280,angle:0,camYaw:0,camPitch:.16,camX:0,camZ:0,vx:0,vy:0,vz:0,speed:0,car:null,alive:true,state:'foot',health:100,armor:0,invuln:0,rag:null,lying:0,knockT:0,airborne:false,weapon:'fist',weaponOut:false,aim:0,exitPose:null,crouched:false,crouch:0,jumpBuffer:0,coyote:0,vault:null,vaultPose:0,motion:null,entryPose:0,targetCar:null,exitDoor:null,landing:0,phase:0});
 W.state.time=16;W.weather.rain=W.weather.target=0;RENDER.env.wet=0;startTime=W.state.elapsed;started=true;seenHeat=false;milestones.length=0;POLICE.setStars(2);draw();
};
document.querySelectorAll('[data-keys]').forEach(b=>b.onclick=()=>{if(started)step(+b.dataset.time,b.dataset.keys?b.dataset.keys.split(','):[]);});
document.querySelectorAll('[data-turn]').forEach(b=>b.onclick=()=>{PLAYER.P.camYaw+=Number(b.dataset.turn)*Math.PI/4;draw();});
document.querySelector('#live').onclick=()=>{live=!live;window.__manual=!live;GAME.state='playing';document.querySelector('#live').textContent=live?'Pause rehearsal':'Play live';if(live)INPUT.requestLock();else INPUT.releaseLock();};
setInterval(()=>{if(started)status();else if(window.__ready)report.textContent='Ready. Start sets up the test once; all later actions use normal controls.';},250);
window.addEventListener('error',e=>report.textContent='ERROR '+e.message);

// Repeatable endurance replay. No teleporting, health changes, police suppression or vehicle repair after setup.
// This measures simulation continuity, not a human's completion time or rendering performance.
async function runEscapeAudit(seconds=600) {
 document.querySelector('#start').click();window.__pt={paused:true};
 const sequence=[[.1,['KeyF']],[1,[]],[3,['KeyW']],[.1,['KeyF']],[.25,['KeyW']],[.7,['Space','KeyW']],[1,['KeyW','ShiftLeft']],[.1,['KeyF']],[1,[]],[.5,['KeyW']]];
 for(const [duration,keys] of sequence){step(duration,keys);await new Promise(requestAnimationFrame);}
 if(PLAYER.P.car!==secondCar)throw new Error('Continuous escape failed before entering the replacement car.');
 const route=[[298,330],[264,332],[250,342],[250,492],[260,508],[408,508],[424,496],[424,348],[412,332],[264,332]];
 let waypoint=0,elapsed=0,stuck=0,reversing=0,distance=0,footGoal=null;const minutes=[],used=new Set([secondCar]);const initialWasted=PLAYER.P.stats.wasted;
 while(elapsed<seconds){
   const p=PLAYER.P,c=p.car;
   if(![p.x,p.y,p.z,p.health].every(Number.isFinite))throw new Error('Non-finite state in escape audit');
   if(!c){
     // A worn-out car is an expected consequence, not a reason to heal or reset the fixture. Walk to an
     // accessible replacement, or patrol visible sidewalk nodes while the normal respawn/entry runs.
     let keys=[];
     if(p.alive&&p.state==='foot'){
       const candidate=PLAYER.entryCandidate();
       if(candidate&&!candidate.car.locked)keys=['KeyF'];
       else {
         const destinations=[];
         for(const car of W.cars)if(!car.removed&&!car.wrecked&&!car.locked&&car.absSpeed<1&&M.dist(p.x,p.z,car.x,car.z)<55)for(const side of [-1,1]){const r=car.right,x=car.x+r[0]*side*(car.spec.wid/2+.8),z=car.z+r[1]*side*(car.spec.wid/2+.8);if(W.sight3(p.x,p.y+1,p.z,x,p.y+1,z)&&!W.pushOut(x,z,.42,{y:p.y,height:1.8}).hit)destinations.push({x,z});}
         destinations.sort((a,b)=>M.dist(p.x,p.z,a.x,a.z)-M.dist(p.x,p.z,b.x,b.z));
         if(destinations.length)footGoal=destinations[0];
         else if(!footGoal||M.dist(p.x,p.z,footGoal.x,footGoal.z)<2||stuck>2){const nodes=CITY.walkNodes.filter(n=>{const d=M.dist(p.x,p.z,n.x,n.z);return d>5&&d<18&&W.sight3(p.x,p.y+1,p.z,n.x,p.y+1,n.z);});footGoal=nodes[Math.floor(elapsed)%Math.max(1,nodes.length)];stuck=0;}
         if(footGoal){p.camYaw=Math.atan2(footGoal.x-p.x,footGoal.z-p.z);keys=['KeyW'];}
       }
     }
     const x=p.x,z=p.z;GAME.state='playing';window.__sim(.1,keys);elapsed+=.1;const moved=M.dist(x,z,p.x,p.z);if(p.alive&&moved<10)distance+=moved;stuck=moved<.01?stuck+.1:0;
     if(Math.floor(elapsed/60)>minutes.length)minutes.push({minute:minutes.length+1,health:Math.round(p.health),state:p.state,wanted:p.wanted,distance:Math.round(distance)});
     if(Math.round(elapsed*10)%20===0){draw();await new Promise(requestAnimationFrame);}continue;
   }
   used.add(c);
   const target=route[waypoint],d=M.dist(c.x,c.z,...target);
   if(d<8){waypoint++;if(waypoint===route.length)waypoint=2;}
   const next=route[waypoint],error=M.angleTo(c.angle,Math.atan2(next[0]-c.x,next[1]-c.z));
   let targetSpeed=Math.abs(error)>.65?4:Math.abs(error)>.25?7:10;
   const f=c.fwd,r=c.right;for(const other of W.cars){if(other===c||other.removed)continue;const dx=other.x-c.x,dz=other.z-c.z,along=dx*f[0]+dz*f[1],across=Math.abs(dx*r[0]+dz*r[1]);if(along>0&&along<5+c.absSpeed*.8&&across<(c.spec.wid+other.spec.wid)*.5+.2)targetSpeed=0;}
   if(c.absSpeed<.4)stuck+=.1;else stuck=0;
   if(stuck>2){reversing=1.2;stuck=0;}
   const keys=[];
   if(reversing>0){keys.push('KeyS');reversing-=.1;if(Math.abs(error)>.15)keys.push(error>0?'KeyD':'KeyA');}
   else {keys.push(targetSpeed===0&&c.absSpeed<.5?'Space':c.absSpeed>targetSpeed+.7?(c.speed<0?'KeyW':'KeyS')/* braking a car that is rolling backwards is the forward pedal; S would reverse harder */:c.absSpeed<targetSpeed?'KeyW':'');if(Math.abs(error)>.07)keys.push(error>0?'KeyA':'KeyD');}
   const x=c.x,z=c.z;GAME.state='playing';window.__sim(.1,keys.filter(Boolean));elapsed+=.1;distance+=M.dist(c.x,c.z,x,z);
   if(Math.floor(elapsed/60)>minutes.length){minutes.push({minute:minutes.length+1,health:Math.round(PLAYER.P.health),carHealth:Math.round(100*c.health/c.maxHealth),wanted:PLAYER.P.wanted,distance:Math.round(distance),pos:[Math.round(c.x),Math.round(c.z)]});}
   if(Math.round(elapsed*10)%20===0){draw();await new Promise(requestAnimationFrame);}
 }
 draw();const result={elapsed:Math.round(elapsed),alive:PLAYER.P.alive,car:PLAYER.P.car===secondCar,distance:Math.round(distance),vehiclesUsed:used.size,respawns:PLAYER.P.stats.wasted-initialWasted,milestones:milestones.slice(),minutes};
 report.textContent=JSON.stringify(result,null,2);delete window.__pt;return result;
}
const audit=document.createElement('button');audit.textContent='Run 10-minute simulation audit';audit.onclick=()=>runEscapeAudit().catch(e=>report.textContent=e.stack);document.querySelector('#escape-actions').append(audit);
