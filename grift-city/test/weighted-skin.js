'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const ctx=vm.createContext({console,assert,TEX:{names:{face:1}},RENDER:{MAX_BONES:14},W:{state:{elapsed:0}},MISSIONS:{dialogue:null}});
for(const name of ['math','meshes','peds'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx,{filename:name+'.js'});
vm.runInContext(`
let weighted=0,cases=0;
for(const lod of [false,true]) {
 const mesh=MESH.pedMesh(PEDS.PLAYER_LOOK,lod);
 assert.equal(mesh.skin.length,mesh.n*5);
 for(let i=0;i<mesh.n;i++){const o=i*5;assert.ok(Number.isInteger(mesh.skin[o])&&mesh.skin[o]>=0&&mesh.skin[o]<14);assert.ok(mesh.skin[o+1]>=0&&mesh.skin[o+1]<=.66);if(mesh.skin[o+1]>0)weighted++;}
 for(const state of [{speed:0},{speed:3.3},{speed:6.8},{speed:1.65,crouch:1},{speed:2.4,aim:1},{speed:0,reloadT:.8,reloadDuration:1.35},{speed:0,evadeT:.2}]) {
  for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
   const p={x:0,y:0,z:0,angle:0,phase,alive:true,state:'foot',...state}, bones=new Float32Array(224);PEDS.buildRig(p,M.create(),bones);
   const at=(bone,x,y,z)=>[0,1,2].map(k=>bones[bone*16+k]*x+bones[bone*16+4+k]*y+bones[bone*16+8+k]*z+bones[bone*16+12+k]);
   for(let i=0;i<mesh.n;i++){const o=i*13,s=i*5,w=mesh.skin[s+1],v=mesh.v;const a=at(v[o+12],v[o],v[o+1],v[o+2]),b=at(mesh.skin[s],v[o]+mesh.skin[s+2],v[o+1]+mesh.skin[s+3],v[o+2]+mesh.skin[s+4]);for(let k=0;k<3;k++)assert.ok(Number.isFinite(a[k]*(1-w)+b[k]*w));if(w>0)assert.ok(Math.hypot(...a.map((x,k)=>x-b[k]))<.7,'bind conversion remains local');}
   cases++;
  }
 }
}
assert.ok(weighted>200,'joint bands actually receive blend weights');
console.log('Weighted skin: '+cases+' animated poses, finite transforms, local bind offsets and '+weighted+' blended vertices passed');
`,ctx);
