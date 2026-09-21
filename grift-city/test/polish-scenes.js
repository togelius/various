// Local manual rehearsal, deliberately isolated from saves. Open through the same HTTP server.
'use strict';
const statusEl = document.querySelector('#qa-status');
if (!AUDIO.muted) AUDIO.toggleMute();
window.addEventListener('error', e => { statusEl.textContent = 'ERROR: '+e.message; });
function status() {
  const p=PLAYER.P; statusEl.textContent=JSON.stringify({signTile:TEX.names.vossSign,textures:TEX.layers.length,state:p.state,health:Math.round(p.health),ammo:p.weapons[p.weapon],magazine:PLAYER.magazine(),reload:+p.reloadT.toFixed(2),mission:MISSIONS.S.current && MISSIONS.S.current.name,objective:MISSIONS.objective},null,2);
}
function prepare() {
  if (!window.__ready) throw new Error('The city is still loading.');
  GAME.save=()=>{}; window.__manual=true; GAME.state='playing'; INPUT.releaseLock(); INPUT.onLockLost=()=>{};
  const p=PLAYER.P; if(p.car) {p.car.driver=null;p.car.ai.mode='parked';} p.car=null;p.alive=true;p.health=100;p.state='foot';p.invuln=100;p.lying=0;p.vx=p.vy=p.vz=0;p.airborne=false;p.aim=0;p.weapon='fist';
  MISSIONS.cleanup();MISSIONS.S.current=null;MISSIONS.S.dialogue=null;MISSIONS.S.retry=null;MISSIONS.S.cooldown=999;MISSIONS.S.shop=null;
  POLICE.clear();W.state.time=16.5;W.weather.rain=0;W.weather.fog=0;
  return p;
}
function render() { window.__renderOnce();status(); }
document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{
  try {const p=prepare(),g=CITY.place('garage'),scene=button.dataset.scene;
  p.x=g.x+5;p.z=g.z-10;p.y=CITY.groundY(p.x,p.z);p.camYaw=0;p.camPitch=.18;p.camX=p.camZ=0;
  if(scene==='street') {MISSIONS.S.objective='Meet Marla at Voss Motors.';MISSIONS.S.blip={x:g.x-6,z:g.z,col:'#f5ce68'};}
  if(scene==='drive') {const c=VEH.spawn('sports',3*CITY.PITCH,3*CITY.PITCH+18,0,{color:0});c.driver=PLAYER;c.ai.mode='player';p.car=c;p.state='car';p.x=c.x;p.z=c.z;p.y=c.y;MISSIONS.S.blip={x:g.x,z:g.z,col:'#f5ce68'};MISSIONS.S.objective='Bring the Falcata home. Keep the bodywork clean.';}
  if(scene==='repo') {MISSIONS.S.progress=1;MISSIONS.S.skipIntro=true;MISSIONS.S.cooldown=0;MISSIONS.start(MISSIONS.LIST[1]);const d=MISSIONS.S.current.data;p.x=d.car.x-9;p.z=d.car.z+4;p.y=CITY.groundY(p.x,p.z);p.camYaw=Math.atan2(d.car.x-p.x,d.car.z-p.z);}
  if(scene==='combat') {p.x=3*CITY.PITCH;p.z=3*CITY.PITCH;p.y=CITY.groundY(p.x,p.z);p.camYaw=0;PLAYER.giveWeapon('pistol',51);p.weapon='pistol';p.magazines.pistol=17;p.aim=1;MISSIONS.S.objective='Fire a magazine, reload, then check the searching indicator.';}
  render();}catch(e){statusEl.textContent=e.stack;}
}));
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{try{GAME.state='playing';const key=button.dataset.step;window.__sim(2,key?[key]:[]);render();}catch(e){statusEl.textContent=e.stack;}}));
document.querySelector('#search').onclick=()=>{POLICE.setStars(2);POLICE.S.seenT=10;render();};
document.querySelector('#retry').onclick=()=>{if(MISSIONS.S.current)MISSIONS.onPlayerDown('wasted');else window.__sim(.1,['KeyY']);render();};
document.querySelector('#touch').onclick=()=>{TOUCH.force(!TOUCH.active);render();};
