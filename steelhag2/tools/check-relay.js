const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'../js'),ctx=vm.createContext({console,Math,Float32Array,Uint32Array,RENDER:{MAX_BONES:32},GL:{mesh:(v,i)=>({v,i})}});
for(const f of ['util','math','geo','paint','relay'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
vm.runInContext(`
const assert=(v,m)=>{if(!v)throw Error(m);},items=[],colliders=[],S={},path=[];
for(let i=0;i<=32;i++)path.push([14+i,3.09,176+i*.5]);
const relay=FieldRelay.build((mesh,x,y,z,yaw,extra)=>{const it={mesh,x,y,z,model:M.trs(M.create(),x,y,z,yaw||0),...extra};items.push(it);return it;},(...c)=>colliders.push(c),()=>3,path,S);
let tris=0;for(const it of items){const m=it.mesh;tris+=m.i.length/3;assert(m.v.every(Number.isFinite),'nonfinite relay vertex');assert(m.i.every(i=>i>=0&&i<m.v.length/13),'invalid relay index');for(let i=0;i<m.v.length;i+=13){assert(m.v[i+11]>=0&&m.v[i+11]<MATS,'material outside atlas');assert(m.v[i+12]>=0&&m.v[i+12]<32,'bone out of bounds');}}
assert(tris<9000,'relay geometry budget');assert(S.relay&&colliders.length===1,'missing interaction or collision');
const standby=Array.from(relay.lever.model);assert(relay.amber.emis>relay.green.emis&&relay.pulse.hidden,'standby state');
let lastX=-Infinity,litFrames=0;
for(let i=0;i<=200;i++){relay.sync(true,Math.max(0,3.2-i/60));assert(relay.lever.model.every(Number.isFinite)&&relay.needle.model.every(Number.isFinite),'bad moving controls');if(relay.light){assert(relay.light.every(Number.isFinite),'bad surge position');assert(relay.light[0]>=lastX,'surge must travel toward field');lastX=relay.light[0];litFrames++;const visible=Array.from(relay.pulse.fx).filter((v,k)=>k%4===1&&v===0).length;assert(visible>0&&visible<=3,'unbounded surge');}}
assert(litFrames>120&&relay.pulse.hidden&&relay.light===null,'surge must travel then finish');assert(relay.progress===1&&relay.green.emis>relay.amber.emis,'running state');assert(relay.lever.model.some((v,k)=>Math.abs(v-standby[k])>.1),'breaker did not move');
const running=Array.from(relay.lever.model);relay.sync(false,0);assert(relay.lever.model.every((v,k)=>Math.abs(v-standby[k])<1e-6),'new journey must reset breaker');relay.sync(true,0);assert(relay.lever.model.every((v,k)=>Math.abs(v-running[k])<1e-6)&&relay.pulse.hidden,'resume must restore running without surge');
for(let i=0;i<190;i++){relay.sync(true,3.2-i/60,true);assert(relay.pulse.hidden&&relay.light===null,'reduced motion must suppress travelling pulse');}
console.log('Field relay: '+tris+' finite triangles, control/lamp states, bounded directional surge, reset/resume and reduced motion passed');
`,ctx);
