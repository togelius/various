// An inspectable studio for the actual character meshes and gameplay rig.
'use strict';
if (!AUDIO.muted) AUDIO.toggleMute();
let studioReady=false, studioView='front', castLook='PLAYER_LOOK', studioActor=null;
const studioStatus=document.querySelector('#studio-status');
function studioSetup() {
 if(!window.__ready)return false;
 if(studioReady)return true;
 GAME.save=()=>{};window.__manual=true;GAME.state='playing';INPUT.onLockLost=()=>{};
 MISSIONS.cleanup();MISSIONS.S.current=null;MISSIONS.S.dialogue=null;MISSIONS.S.cooldown=999;HUD.clearBig();POLICE.clear();
 W.cars.forEach(c=>c.removed=true);W.peds.forEach(p=>p.removed=true);W.pickups.length=0;
 const p=PLAYER.P, spot=CITY.place('garage');p.x=spot.x;p.z=spot.z-11;p.y=CITY.groundY(p.x,p.z);p.angle=0;p.vx=p.vz=0;p.car=null;p.alive=true;p.state='foot';p.weaponOut=false;
 W.state.time=10.5;W.weather.rain=0;W.weather.fog=0;
 PLAYER.updateCamera=()=>{const p=PLAYER.P, close=studioView==='front', back=studioView==='back', distance=close?1.45:3.7;RENDER.setCamera(p.x+(close?.25:1.1),p.y+(close?1.68:1.4),p.z+(back?-distance:distance),p.x,p.y+(close?1.62:.98),p.z,42*Math.PI/180);};
 PLAYER.giveWeapon('pistol',51);studioReady=true;return true;
}
function studioDraw() {
 if(!studioSetup())return;
 const p=PLAYER.P;p.look=PEDS[castLook];p.mesh=PEDS.getMesh(p.look);p.speed=studioView==='walk'?3.3:0;p.aim=studioView==='aim'?1:0;p.weapon=studioView==='aim'?'pistol':'fist';p.weaponOut=studioView==='aim';p.camPitch=0;p.gesturePulse=studioView==='chat'?(.65+Math.sin(W.state.elapsed*2)*.6):0;
 if(studioView==='seated') {p.seat={x:p.x,y:p.y+.75,z:p.z,a:0};PLAYER.entity=()=>{PEDS.buildRigSeated(p,p.model,p.bones,M.identity(M.create()),p.x,p.y+.75,p.z,0,true);return {mesh:p.mesh,model:p.model,bones:p.bones,emis:p.emis};};}
 else PLAYER.entity=()=>{PEDS.buildRig(p,p.model,p.bones);return {mesh:p.mesh,model:p.model,bones:p.bones,emis:p.emis};};
 window.__renderOnce();studioStatus.textContent=castLook+' · '+studioView+' · sound '+(AUDIO.muted?'muted':'on');
}
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{castLook=b.dataset.look;studioDraw();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{studioView=b.dataset.view;studioDraw();});
window.addEventListener('error',e=>studioStatus.textContent='ERROR: '+e.message);
let studioTime=0;function studioFrame(now){requestAnimationFrame(studioFrame);if(!studioReady)return;const dt=Math.min(.04,(now-studioTime)/1000)||0;studioTime=now;W.state.elapsed+=dt;if(studioView==='walk'||studioView==='chat'){PLAYER.P.phase+=dt*Math.PI*2*PEDS.cadence(PLAYER.P.speed);studioDraw();}}requestAnimationFrame(studioFrame);
