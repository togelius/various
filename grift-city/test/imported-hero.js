// The imported prototype must survive the same poses and clothes as the shipped hero.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary'),TEX:{names:{face:71,characterCloth:72,heroSkin:73,heroHair:74,heroEyes:75}},RENDER:{MAX_BONES:14},W:{state:{elapsed:1}}});
for(const file of ['math.js','herodata.js','meshes.js','peds.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),ctx);
const {MESH,PEDS,M,HERODATA}=vm.runInContext('({MESH,PEDS,M,HERODATA})',ctx);
const imported=MESH.pedMesh({...PEDS.PLAYER_LOOK,importedHero:true});
assert(imported.n<65536,'prototype must fit the renderer\'s 16-bit index buffer');
assert(imported.v.every(Number.isFinite));assert(imported.skin.every(Number.isFinite));
assert.equal(imported.skin.length,imported.n*5);
assert(imported.i.every(i=>Number.isInteger(i)&&i>=0&&i<imported.n));
assert.equal(HERODATA.parts.length,6);
const active=new Set(imported.i), verts=[];
for(const id of active){const v=imported.v.slice(id*13,id*13+13);if(v[11]>=73)verts.push({id,v});}
assert(verts.length>1000);
assert(verts.every(({v})=>[1,9,10].includes(v[12])));
assert(verts.every(({v})=>Math.abs(Math.hypot(...v.slice(3,6))-1)<.00001));
assert(verts.every(({v})=>v[9]>=0&&v[9]<=(v[11]===75?2:1.00001)&&v[10]>=0&&v[10]<=1.00001));
const head=verts.filter(({v})=>v[12]===1),hands=verts.filter(({v})=>v[12]!==1);
assert(head.every(({v})=>Math.abs(v[0])<.13&&v[1]>-.09&&v[1]<.34),'head and tapered neck must fit the collar');
assert(hands.every(({v})=>Math.abs(v[0])<.32&&v[1]>-.72&&v[1]<-.52),'authored wrists must end inside the sleeve cuffs');
assert(head.some(({id,v})=>v[1]<-.035&&imported.skin[id*5+1]>.95),'neck base must follow the chest to prevent gaps');
// The outfit changes only the clothes, never the imported face or hands.
for(const lod of [false,true])for(const jacket of [PEDS.PLAYER_LOOK.jacket,[.12,.16,.22]]){
 const b=MESH.pedMesh({...PEDS.PLAYER_LOOK,importedHero:true,jacket,tailored:true},lod);
 const actual=[];for(let i=0;i<b.v.length;i+=13)if(b.v[i+11]>=73)actual.push(b.v.slice(i,i+13));
 assert.deepEqual(actual,verts.map(({v})=>v));
}
const transform=(b,id,v)=>[0,1,2].map(k=>b[id*16+k]*v[0]+b[id*16+4+k]*v[1]+b[id*16+8+k]*v[2]+b[id*16+12+k]);
let poses=0;
for(const speed of [0,1.5,6.8])for(const phase of [0,1.6,3.2,4.8])for(const aim of [0,1])for(const gesturePulse of [0,.8]){
 const bones=new Float32Array(224);PEDS.buildRig({x:0,y:0,z:0,angle:0,phase,speed,aim,gesturePulse,state:'foot',vx:0,vz:speed},M.create(),bones);
 for(const {id,v}of verts){const s=imported.skin.subarray(id*5,id*5+5),a=transform(bones,v[12],v),b=transform(bones,s[0],[v[0]+s[2],v[1]+s[3],v[2]+s[4]]);const p=a.map((x,k)=>x*(1-s[1])+b[k]*s[1]);assert(p.every(Number.isFinite));assert(Math.hypot(...p)<2.5,'skinning must not explode in motion');}
 poses++;
}
// An absent asset bundle must still produce the complete procedural fallback.
const fallback=vm.createContext({TEX:{names:{}}});for(const file of ['math.js','meshes.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),fallback);
const fm=vm.runInContext('MESH',fallback);assert.deepEqual(fm.pedMesh({...PEDS.PLAYER_LOOK,importedHero:true}).v,fm.pedMesh({...PEDS.PLAYER_LOOK,importedHero:false}).v);
console.log(`Imported hero: ${HERODATA.parts.reduce((n,p)=>n+p.triangles,0)} authored triangles, ${poses} skinned poses, wardrobe and fallback checks passed`);
