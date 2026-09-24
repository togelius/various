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
console.log('Authored character: weighted skin, walk/run/idle blends, grounding, interaction and cutter pose passed');
`,ctx);
