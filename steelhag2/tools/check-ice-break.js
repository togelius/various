const fs=require('fs'),path=require('path'),vm=require('vm');
const c=vm.createContext({console,Math,Float32Array,Uint32Array,RENDER:{MAX_BONES:32},GL:{mesh:(v,i)=>({v,i})}});
for(const f of ['util','math','geo','paint','ice-break'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8'),c);
vm.runInContext(`
const assert=(v,m)=>{if(!v)throw Error(m);},hulls=[{x:19,z:53,h:26,rise:0},{x:-29,z:83,h:34,rise:0}],effect=IceBreak.create(hulls);
assert(effect.items.every(i=>i.hidden),'ice scars visible before reveal');
for(const it of effect.items){assert(it.mesh.v.every(Number.isFinite),'invalid effect geometry');assert(it.mesh.i.every(i=>i>=0&&i<it.mesh.v.length/13),'invalid effect indices');}
let active=false;
for(let frame=0;frame<=420;frame++){for(const h of hulls)h.rise=frame/420;effect.sync();assert(effect.particles.n<=88,'unbounded powder');active||=effect.particles.n>0;for(const it of effect.items)assert(Array.from(it.model).every(Number.isFinite)&&(!it.bones||it.bones.every(Number.isFinite)),'invalid animated slab matrix');}
assert(active,'no powder during rise');assert(effect.particles.n===0,'powder continues after rise');assert(effect.items.every(i=>!i.hidden),'settled fracture field missing');
const settled=effect.items.filter(i=>i.bones).map(i=>Array.from(i.bones));effect.sync();assert(JSON.stringify(settled)===JSON.stringify(effect.items.filter(i=>i.bones).map(i=>Array.from(i.bones))),'settled debris still moves');
for(const h of hulls)h.rise=.5;effect.sync(true);assert(effect.particles.n===0,'reduced motion still throws powder');
for(const it of effect.items.filter(i=>i.bones))for(let j=0;j<12;j++){assert(Math.abs(it.bones[j*16+1])<1e-6&&Math.abs(it.bones[j*16+6])<1e-6,'reduced motion still tumbles slabs');}
for(const h of hulls)h.rise=0;effect.sync();assert(effect.items.every(i=>i.hidden)&&!effect.particles.n,'new journey retained debris');
for(const h of hulls)h.rise=1;effect.sync();assert(!effect.particles.n&&effect.items.every(i=>!i.hidden),'checkpoint resume replays burst');
console.log('Ice reveal: finite meshes/poses, bounded transient powder, static aftermath, reset/resume and reduced-motion behavior passed');
`,c);
