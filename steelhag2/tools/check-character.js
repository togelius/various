const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..','js'),ctx=vm.createContext({console,Math,Float32Array,Uint32Array,Uint16Array,Uint8Array,atob,GL:{mesh:(v,i)=>({v,i}),updateMesh:()=>{}}});
for(const f of ['util','math','geo','paint','character-data','character'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),ctx);
vm.runInContext(`
const c=new Character();
for(const speed of [0,1.5,2.8,5.6,0])for(let frame=0;frame<120;frame++){
 c.pose(0,0,0,0,speed/1.4,1/60);
 let low=Infinity,high=-Infinity;
 for(let i=0;i<c.vertices.length;i+=13){for(let k=0;k<6;k++)if(!Number.isFinite(c.vertices[i+k]))throw Error('invalid skinned vertex');low=Math.min(low,c.vertices[i+1]);high=Math.max(high,c.vertices[i+1]);if(Math.hypot(c.vertices[i],c.vertices[i+2])>1.5)throw Error('root motion escaped player');}
 if(low<-.18||low>.3||high<1.5||high>2.1)throw Error('character lost grounding: '+[speed,low,high]);
}
for(const mode of ['Interact','Idle_Gun_Pointing']){for(let i=0;i<60;i++)c.pose(0,0,0,0,0,1/60,mode==='Interact'?1:0,0,false,mode==='Idle_Gun_Pointing');if(c.clip!==mode)throw Error('missing interaction pose');}
if(c.hand[1]<1.15||c.hand[2]<.3)throw Error('cutter arm is not aimed forward');
const foot=c.nodes.findIndex(n=>n.name==='Foot.L'),samples=[];for(let i=0;i<90;i++){c.pose(0,0,0,0,2/1.4,1/60,0,0,false,true);samples.push(c.nodes[foot].world[14]);}if(Math.max(...samples)-Math.min(...samples)<.1)throw Error('aiming locomotion is sliding');
const before=c.movePhase;for(let i=0;i<60;i++)c.pose(0,0,0,0,2/1.4,1/60,0,0,false,true,[0,-2]);if(c.movePhase>=before||!c.vertices.every(Number.isFinite))throw Error('backpedal clip did not reverse safely');
// Reactions may move the upper body and equipment, but must not disturb foot plants.
const r=new Character();for(let i=0;i<30;i++)r.pose(0,0,0,0,0,1/60,0,0,false,true);
const feet=r.feet.map(f=>f.slice()),pack=Array.from(r.pack.model),tool=Array.from(r.tool.model);
r.pose(0,0,0,0,0,0,0,0,false,true,null,{hit:1,recoil:1,aimPitch:.3,condition:1});
for(let j=0;j<2;j++)if(r.feet[j].some((v,k)=>Math.abs(v-feet[j][k])>1e-5))throw Error('upper-body reaction moved foot plants');
if(!r.vertices.every(Number.isFinite)||!r.pack.model.every(Number.isFinite)||!r.lamp.model.every(Number.isFinite))throw Error('reaction or attachment invalid');
if(r.pack.model.every((v,k)=>Math.abs(v-pack[k])<1e-5)||r.tool.model.every((v,k)=>Math.abs(v-tool[k])<1e-5))throw Error('equipment remains rigid during reaction');
for(const condition of [3,2,1,0,3]){r.pose(0,0,0,0,0,0,0,0,false,false,null,{condition});let lit=0;for(let k=11;k<r.gaugeData.length;k+=13)if(r.gaugeData[k]===MAT.COLD_LIGHT)lit++;if(lit!==condition*24)throw Error('condition lamps do not match health');}
for(let i=0;i<65;i++)r.pose(0,0,0,0,0,1/60,0,1,false,false,null,{condition:0});
if(r.clip!=='Death'||!r.vertices.every(Number.isFinite))throw Error('authored defeat pose invalid');
console.log('Reactions: stable foot plants, attached equipment, condition lamps and authored defeat passed');
console.log('Authored character: weighted skin, walk/run/idle blends, grounding, interaction and cutter pose passed');
`,ctx);
