// Check real farm geometry and navigable routes, including the open garden gate.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'../js'),c=vm.createContext({console,Math,Float32Array,Uint32Array,RENDER:{MAX_BONES:32},GL:{mesh:(v,i)=>({v,i}),instances:()=>{}}});
for(const f of ['util','math','geo','paint','roadside','farmyard','relay','world'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),c);
vm.runInContext(`
const assert=(v,m)=>{if(!v)throw Error(m);},meshes=[],colliders=[];
const S={};Farmyard.build((mesh,x,y,z,yaw,extra)=>{const it={mesh,x,y,z,...extra};meshes.push(it);return it;},(x,y,z,w,h,d)=>colliders.push({x0:x,y0:y,z0:z,x1:x+w,y1:y+h,z1:z+d}),World.groundY,S);
let triangles=0;
for(const {mesh:m}of meshes){assert(m.v.every(Number.isFinite),'nonfinite farmyard vertex');assert(m.i.every(i=>i>=0&&i<m.v.length/13),'invalid farmyard index');triangles+=m.i.length/3;for(let k=11;k<m.v.length;k+=13)assert(m.v[k]>=0&&m.v[k]<MATS,'invalid farmyard material');}
assert(triangles<36000,'farmyard geometry budget exceeded: '+triangles);
assert(S.woodstore&&colliders.length>6,'yard lacks obstacles');
World.build();
const routes=[[[0,140],[0,157.25]],[[-7,145],[0,156]],[[1,155],[9,155],[12,163],[13,174]],[[6.4,155],[6.4,162]],[[-5.2,157],[-5.2,163]]];
for(const route of routes)for(let j=1;j<route.length;j++){
 const [ax,az]=route[j-1],[bx,bz]=route[j],steps=Math.ceil(Math.hypot(bx-ax,bz-az)*10);
 for(let k=0;k<=steps;k++){const t=k/steps,p={x:lerp(ax,bx,t),z:lerp(az,bz,t)},x=p.x,z=p.z;World.pushOut(p,.34,World.groundY(x,z));assert(Math.hypot(p.x-x,p.z-z)<.001,'farm route blocked at '+x.toFixed(2)+','+z.toFixed(2));}
}
for(const [x,z]of[[-8,152],[7,152],[-10,157],[-7.65,164.25]]){const p={x,z};World.pushOut(p,.34,World.groundY(x,z));assert(Math.hypot(p.x-x,p.z-z)>.1,'solid scenery can be walked through at '+x+','+z);}
console.log('Farmyard: '+triangles+' finite triangles, material/index bounds, obstacle collisions and clear gate/door/relay/cellar/window routes passed');
`,c);
