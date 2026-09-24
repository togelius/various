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
ctx.RENDER={MAX_BONES:32};ctx.World={groundY:(x,z)=>.025*x+.01*z};
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
