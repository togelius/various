// Aimed support choice must follow the view, with occlusion and range enforced.
const fs=require('fs'),vm=require('vm'),path=require('path');
const c=vm.createContext({console,Math});
for(const f of ['util','combat'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8'),c);
vm.runInContext(`
const RIG={BODY:0,LEG:5,ARM:13},assert=(v,m)=>{if(!v)throw Error(m);};
const p={x:0,y:0,z:0},cam={x:0,y:1.2,z:-2,tx:0,ty:1.2,tz:6,fov:Math.PI/3};
const machine={kind:'bearer',legsLeft:()=>4,joints:()=>[[5,2,1.2,3,'near off-axis'],[7,0,1.2,6,'under reticle'],[9,0,1.2,20,'far'],[11,0,1.2,-5,'behind']]};
const get=(camera=cam,blocked=()=>false)=>Combat.targets([machine],p,camera,16/9,blocked);
assert(Combat.select(get()).j[0]===7,'reticle must beat nearest distance');
assert(get().length===2,'behind-camera or out-of-range joints accepted');
assert(get(cam,()=>true).length===0,'cut target goes through a wall');
assert(Combat.select(get({...cam,tx:2,ty:1.2,tz:3})).j[0]===5,'horizontal aim did not change selection');
assert(Combat.select(get({...cam,ty:10}))===null,'looking into sky still cuts a support');
assert(Combat.missEnd([0,1.2,0],{...cam,ty:8})[1]>2,'missed discharge ignores pitch');
const core={...machine,legsLeft:()=>2,joints:()=>[[0,0,1.2,5,'core']]};
assert(Combat.select(Combat.targets([core],p,cam,1,()=>false)).j[0]===0,'exposed core not targetable');
assert(Combat.targets([{...core,legsLeft:()=>4}],p,cam,1,()=>false).length===0,'armored core is targetable');
console.log('Combat: reticle priority, horizontal/vertical aim, range, occlusion, missed-ray pitch and exposed core passed');
`,c);
