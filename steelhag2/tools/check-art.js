const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.join(__dirname,'..');
const ctx=vm.createContext({console,Math,Float32Array,Uint32Array,GL:{mesh:(v,i)=>({v,i})}});
vm.runInContext(fs.readFileSync(path.join(root,'js/geo.js'),'utf8')+`;globalThis.Builder=Builder;`,ctx);
for(const [name,build] of [['rounded box',b=>b.roundedBox(-1,-1,-1,2,2,2,.2)],['loft',b=>b.loft(0,0,0,[[0,.2,.15],[.3,.3,.2],[.7,.15,.1]])]]) {
 const b=new ctx.Builder(); build(b); const m=b.build();
 assert(m.v.every(Number.isFinite),name+' has invalid vertices'); assert(m.i.every(i=>i<m.v.length/13));
 let valid=0;for(let j=0;j<m.i.length;j+=3){const a=m.i[j]*13,c=m.i[j+1]*13,d=m.i[j+2]*13;const u=[0,1,2].map(k=>m.v[c+k]-m.v[a+k]),v=[0,1,2].map(k=>m.v[d+k]-m.v[a+k]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...n)<1e-9)continue;assert(n.reduce((s,x,k)=>s+x*m.v[a+3+k],0)>0,name+' inward face');valid++;}assert(valid>0);console.log(name+': finite vertices, outward triangles');
}
