// An inspectable studio for the actual character meshes and gameplay rig.
'use strict';
if (!AUDIO.muted) AUDIO.toggleMute();
let studioReady=false, studioView='front', castLook='PLAYER_LOOK', studioActor=null, studioPaused=false, studioYaw=0, studioNight=false,studioWeapon='pistol';
const studioStatus=document.querySelector('#studio-status');
function studioSetup() {
 if(!window.__ready)return false;
 if(studioReady)return true;
 GAME.save=()=>{};window.__manual=true;window.__pt={paused:true};document.querySelector('#hud').style.visibility='hidden';GAME.state='playing';INPUT.onLockLost=()=>{};
 MISSIONS.cleanup();MISSIONS.S.current=null;MISSIONS.S.dialogue=null;MISSIONS.S.cooldown=999;HUD.clearBig();POLICE.clear();
 W.cars.forEach(c=>c.removed=true);W.peds.forEach(p=>p.removed=true);W.pickups.length=0;
 const p=PLAYER.P;p.x=300;p.z=332;p.y=CITY.groundY(p.x,p.z);p.angle=0;p.vx=p.vz=0;p.car=null;p.alive=true;p.state='foot';p.weaponOut=false;
 W.state.time=10.5;W.weather.rain=0;W.weather.fog=0;
 PLAYER.updateCamera=()=>{const p=PLAYER.P, close=studioView==='front', back=studioView==='back', distance=close?1.45:3.7;const a=studioYaw+(back?Math.PI:0)+(close?.12:.28);RENDER.setCamera(p.x+Math.sin(a)*distance,p.y+(close?1.61:1.32),p.z+Math.cos(a)*distance,p.x,p.y+(close?1.59:.95),p.z,42*Math.PI/180);};
 PLAYER.giveWeapon('pistol',51);studioReady=true;return true;
}
function studioDraw() {
 if(!studioSetup())return;
 const p=PLAYER.P;p.look=PEDS[castLook];p.mesh=PEDS.getMesh(p.look);p.speed=studioView==='walk'?1.5:studioView==='run'?6.8:0;p.aim=studioView==='aim'?1:0;p.crouch=studioView==='crouch'?1:0;p.airborne=['vault','jump'].includes(studioView);p.vy=studioView==='jump'?4:0;p.landing=studioView==='land'?.8:0;p.vaultPose=studioView==='vault'?.8:0;p.reloadDuration=1.4;p.reloadT=studioView==='reload'?1.4-(W.state.elapsed%1.4):0;p.state='foot';p.vx=0;p.vz=p.speed;W.state.time=studioNight?22:10.5;p.weapon=['aim','reload'].includes(studioView)?studioWeapon:'fist';p.weaponOut=['aim','reload'].includes(studioView);p.camPitch=0;p.gesturePulse=studioView==='chat'?(.65+Math.sin(W.state.elapsed*2)*.6):0;
 if(studioPaused)PEDS.updateMotion(p,.5); // selecting a new pose while paused must also settle its aim blend
 if(studioView==='seated') {p.seat={x:p.x,y:p.y+.75,z:p.z,a:0};PLAYER.entity=()=>{PEDS.buildRigSeated(p,p.model,p.bones,M.identity(M.create()),p.x,p.y+.75,p.z,0,true);return {mesh:p.mesh,model:p.model,bones:p.bones,emis:p.emis};};}
 else PLAYER.entity=()=>{PEDS.buildRig(p,p.model,p.bones);return {mesh:p.mesh,model:p.model,bones:p.bones,emis:p.emis};};
 window.__renderOnce();studioStatus.textContent=castLook+' · '+studioView+' · sound '+(AUDIO.muted?'muted':'on');
}
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{castLook=b.dataset.look;studioDraw();});
document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{studioWeapon=b.dataset.weapon;studioView='aim';studioDraw();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{studioView=b.dataset.view;studioDraw();});
window.addEventListener('error',e=>studioStatus.textContent='ERROR: '+e.message);
document.querySelector('#studio-pause').onclick=()=>{studioPaused=!studioPaused;document.querySelector('#studio-pause').textContent=studioPaused?'Animate':'Pause pose';};document.querySelector('#studio-turn').onclick=()=>{studioYaw+=Math.PI/4;studioDraw();};document.querySelector('#studio-light').onclick=()=>{studioNight=!studioNight;studioDraw();};
let studioTime=0;function studioFrame(now){requestAnimationFrame(studioFrame);if(!studioSetup())return;const dt=Math.min(.04,(now-studioTime)/1000)||0;studioTime=now;if(!studioPaused){W.state.elapsed+=dt;PLAYER.P.phase+=dt*Math.PI*2*PEDS.cadence(PLAYER.P.speed);PEDS.updateMotion(PLAYER.P,dt);studioDraw();}}requestAnimationFrame(studioFrame);

document.querySelector('#studio-hide').onclick=()=>{const panel=document.querySelector('#studio-controls');panel.hidden=!panel.hidden;document.querySelector('#studio-hide').textContent=panel.hidden?'Show controls':'Hide controls';};
