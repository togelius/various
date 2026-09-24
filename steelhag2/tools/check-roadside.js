// Verify actual authored scenery and the original direct crossing corridor.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'../js'),c=vm.createContext({console,Math,Float32Array,Uint32Array,GL:{mesh:(v,i)=>({v,i})}});
for(const f of ['util','math','geo','paint','roadside','world'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),c);
vm.runInContext(`
const meshes=[],colliders=[],S={lamps:[],vantages:[]};
Roadside.build((mesh,x,y,z,yaw,extra)=>{const it={mesh,x,y,z,...extra};meshes.push(it);return it;},(x,y,z,w,h,d)=>colliders.push({x0:x,y0:y,z0:z,x1:x+w,y1:y+h,z1:z+d}),World.groundY,S);
const assert=(v,m)=>{if(!v)throw Error(m);};
let triangles=0;
for(const {mesh:m} of meshes){assert(m.v.every(Number.isFinite),'invalid scenery vertex');assert(m.i.every(i=>i>=0&&i<m.v.length/13),'invalid scenery index');triangles+=m.i.length/3;for(let i=11;i<m.v.length;i+=13)assert(m.v[i]>=0&&m.v[i]<MATS,'invalid scenery material');}
assert(triangles<32000,'scenery exceeds bounded geometry budget');
for(let z=-24;z<=108;z+=.2)for(const x of [-2,0,2])for(const c of colliders)assert(!(x+.45>c.x0&&x-.45<c.x1&&z+.45>c.z0&&z-.45<c.z1),'scenery blocks direct crossing at '+x+','+z);
assert(colliders.some(c=>S.checkpointHut.x>c.x0&&S.checkpointHut.x<c.x1&&S.checkpointHut.z>c.z0&&S.checkpointHut.z<c.z1),'hut lacks collision');
assert(colliders.some(c=>S.recovery.x>c.x0&&S.recovery.x<c.x1&&S.recovery.z>c.z0&&S.recovery.z<c.z1),'recovery sled lacks collision');
assert(S.recoveryLight&&S.vantages.some(v=>v.key==='1:recovery'),'recovery beacon/photo location absent');
console.log('Roadside: '+triangles+' finite triangles, valid materials, hut/sled collisions, clear crossing corridor and recovery photograph passed');
`,c);
