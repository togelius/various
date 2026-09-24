const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.join(__dirname,'..');
const ctx=vm.createContext({console,Math,Float32Array,Uint32Array,GL:{mesh:(v,i)=>({v,i})}});
vm.runInContext(fs.readFileSync(path.join(root,'js/geo.js'),'utf8')+`;globalThis.Builder=Builder;`,ctx);
for(const [name,build] of [['rounded box',b=>b.roundedBox(-1,-1,-1,2,2,2,.2)],['loft',b=>b.loft(0,0,0,[[0,.2,.15],[.3,.3,.2],[.7,.15,.1]])]]) {
 const b=new ctx.Builder(); build(b); const m=b.build();
 assert(m.v.every(Number.isFinite),name+' has invalid vertices'); assert(m.i.every(i=>i<m.v.length/13));
 let valid=0;for(let j=0;j<m.i.length;j+=3){const a=m.i[j]*13,c=m.i[j+1]*13,d=m.i[j+2]*13;const u=[0,1,2].map(k=>m.v[c+k]-m.v[a+k]),v=[0,1,2].map(k=>m.v[d+k]-m.v[a+k]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...n)<1e-9)continue;assert(n.reduce((s,x,k)=>s+x*m.v[a+3+k],0)>0,name+' inward face');valid++;}assert(valid>0);console.log(name+': finite vertices, outward triangles');
}

// Check the authored rigs across headings, slopes and all phases of the gait.
ctx.RENDER={MAX_BONES:32};ctx.World={pushOut:()=>{},groundY:(x,z)=>.025*x+.01*z};
for(const file of ['util.js','math.js','paint.js','creatures.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
vm.runInContext(`
for(const yaw of [0,.7,2.1,-2.2]){
 const m=new Machine('bearer',0,0,yaw);
 for(let l=0;l<4;l++){const [x,z]=m.hipWorld(l);if(Math.hypot(x-m.feet[l].x,z-m.feet[l].z)>1e-6)throw Error('feet start crossed');}
 const forward=[Math.sin(yaw),Math.cos(yaw)],head=m.headWorld;
 if(head[0]*forward[0]+head[2]*forward[1]<.3)throw Error('head not forward');
 const player={x:0,y:0,z:1,speed:0,torch:false,cutterUp:false,hold:2.1,flinch:false,handWorld:[0,1,1]};
 m.state='standoff';m.update(1/60,player,{calmCeiling:1,awake:true});if(!m.off)throw Error('peaceful approach broke');
 const cut=new Machine('bearer',0,0,yaw);cut.sever(RIG.LEG);if(cut.legsLeft()!==3)throw Error('cut did not detach leg');cut.pose();if(!cut.bones.every(Number.isFinite))throw Error('invalid cut pose');
 const lift=new Machine('bearer',0,0,yaw);lift.state='standoff';player.hold=.5;player.flinch=true;lift.update(1/60,player,{calmCeiling:1,awake:true});if(lift.state!=='lift')throw Error('flinch response broke');
}
console.log('Rigs: sloped walking, four headings, contact, cut and flinch passed');
`,ctx);

vm.runInContext(`
const player={x:0,y:0,z:3,speed:0,torch:false,cutterUp:false,hold:0,flinch:false,handWorld:[0,1,3]};
let hits=0;const ctx={awake:true,quiet:false,onHit:()=>hits++};const hostile=new Machine('bearer',0,0,0,{aggressive:true});
for(let i=0;i<55;i++)hostile.update(1/60,player,ctx);
if(hits!==0||hostile.state!=='windup')throw Error('attack must telegraph before damage');
for(let i=0;i<65;i++)hostile.update(1/60,player,ctx);
if(hits!==1)throw Error('committed attack must hit exactly once');
const stopped=new Machine('bearer',0,0,0,{aggressive:true});stopped.state='windup';stopped.attackT=.8;stopped.sever(RIG.LEG+1);
if(stopped.joints().some(j=>j[0]===RIG.LEG||j[0]===RIG.LEG+1))throw Error('disabled support still targetable');
stopped.update(.2,player,ctx);if(stopped.state==='lunge')throw Error('sever did not interrupt windup');
stopped.sever(RIG.LEG+2);stopped.sever(RIG.LEG+4);let completed=false;stopped.update(.01,player,{...ctx,onSwitchedOff:()=>completed=true});
if(!stopped.off||!completed)throw Error('three supports must disable roadkeeper');
console.log('Roadkeeper: telegraph, one hit per lunge, stagger, disabled-joint filtering and defeat passed');
`,ctx);

vm.runInContext(`
const walking=new Machine('bearer',0,0,0,{scale:1.45});
for(let i=0;i<120;i++){walking.t+=1/60;walking.advanceFeet(1/60);walking.move(1/60,0,1,1.7);walking.pose();}
walking.speed=0;for(let i=0;i<40;i++){walking.advanceFeet(1/60);walking.pose();}
if(walking.feet.some(f=>f.step>0||Math.abs(f.y-World.groundY(f.x,f.z))>.001))throw Error('paused machine left a foot in the air');
if(Math.abs(walking.yaw)>.001)throw Error('machine failed to face north');
console.log('Locomotion: scaled rig, north-facing travel and interrupted steps settle onto terrain');
`,ctx);

vm.runInContext(`
const stationary={x:0,y:0,z:3,speed:0,torch:false,cutterUp:false,hold:0,flinch:false,handWorld:[0,1,3]};
let hurt=0,impacts=0;const callbacks={awake:true,quiet:false,onHit:()=>hurt++,onImpact:()=>impacts++};
const dodged=new Machine('bearer',0,0,0,{aggressive:true});dodged.update(1/60,stationary,callbacks);
if(dodged.state!=='windup')throw Error('charge did not announce');
const original=JSON.stringify(dodged.attackDir);stationary.x=3;
for(let i=0;i<120;i++)dodged.update(1/60,stationary,callbacks);
if(JSON.stringify(dodged.attackDir)!==original||Math.abs(dodged.x)>.01)throw Error('telegraphed charge changed its lane');
if(hurt!==0||impacts!==1)throw Error('sidestep must avoid damage and charge must land once');
console.log('Roadkeeper: telegraphed lane commits before movement, side-step is safe, impact fires once');
`,ctx);

vm.runInContext(`
for(const dt of [1/120,1/30,.4]){
 const contactPlayer={x:0,y:0,z:3,speed:0,torch:false,cutterUp:false};
 let hits=0,impacts=0;const m=new Machine('bearer',0,0,0,{aggressive:true,scale:1.45});m.state='lunge';
 const callbacks={awake:true,quiet:false,onHit:()=>hits++,onImpact:()=>impacts++};
 for(let i=0;i<120&&m.state==='lunge';i++)m.update(dt,contactPlayer,callbacks);
 if(hits!==1||impacts!==1||m.state!=='recover')throw Error('contact must end the charge once');
 if(Math.abs(Math.hypot(m.x-contactPlayer.x,m.z-contactPlayer.z)-1.25)>1e-6)throw Error('charge drove through player');
 const stop=[m.x,m.z];m.update(.5,contactPlayer,callbacks);
 if(hits!==1||impacts!==1||m.x!==stop[0]||m.z!==stop[1])throw Error('contact recovery must leave room to escape');
}
console.log('Roadkeeper: contact stops at player boundary at 120/30 fps and through a long frame');
`,ctx);
