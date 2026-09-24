const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..','js'),c=vm.createContext({console,Math,Float32Array,Uint32Array,GL:{mesh:(v,i)=>({v,i})},RENDER:{light:()=>{},contact:()=>{}}});
for(const f of ['util','math','geo','paint','world','interior'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),c);
vm.runInContext(`
Interior.build();const assert=(v,m)=>{if(!v)throw Error(m);};
assert(Interior.items.length>=2,'interior geometry missing');for(const it of Interior.items)assert(Array.from(it.mesh.v).every(Number.isFinite),'invalid room vertex');
let p={x:805,z:801.25};const waypoints=[[805,803.1],[803.1,803.1],[803.1,807.7],[801.6,808.0],[803.1,807.7],[805.4,806.7],[809.5,806.7]];
for(const [x,z]of waypoints){for(let i=0;i<800&&Math.hypot(x-p.x,z-p.z)>.03;i++){const dx=x-p.x,dz=z-p.z,l=Math.hypot(dx,dz);p.x+=dx/l*Math.min(.04,l);p.z+=dz/l*Math.min(.04,l);World.pushOut(p,.35,0);assert(World.groundY(p.x,p.z)===0,'interior floor height incorrect');}assert(Math.hypot(x-p.x,z-p.z)<.1,'furniture blocks route to '+[x,z]);}
for(const [id,pt]of Object.entries(Interior.spots)){if(id==='entry')continue;assert(Interior.nearby(...pt)===id,'unreachable interaction '+id);}
console.log('Interior: finite geometry, level floor, furniture route, bedroom doorway and interaction ranges passed');
`,c);
