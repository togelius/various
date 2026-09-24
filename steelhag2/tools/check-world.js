const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..','js'),c=vm.createContext({console,Math,Float32Array});
for(const f of ['util','math','world'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),c);vm.runInContext('globalThis.W=World;',c);const W=c.W;
for(let z=-24;z<142;z+=.23){const y=W.groundY(2,z);assert(Number.isFinite(y)&&y>=0);const step=W.groundY(2,z+.01)-y;assert(Math.abs(step)<.08,'unwalkable shore discontinuity');}
W.S.colliders.push({x0:-1,x1:1,y0:0,y1:3,z0:5,z1:7});assert(W.occluded(0,1,0,0,1,10));assert(!W.occluded(3,1,0,3,1,10));assert(!W.occluded(0,4,0,0,4,10));assert(!W.occluded(0,1,0,0,1,4));
const p={x:0,z:5.1};W.pushOut(p,.5,0);assert(p.z<=4.5||p.z>=7.5||Math.abs(p.x)>=1.5);
console.log('World: continuous shore grounding, wall occlusion, clear rays and collider escape passed');
