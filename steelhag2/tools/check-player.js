// Camera regression: a wall must shorten the boom without jumping through it.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..','js'),c=vm.createContext({console,Math,Float32Array,RENDER:{cam:{}}});
for(const f of ['util','math','world','player'])vm.runInContext(fs.readFileSync(path.join(root,f+'.js'),'utf8'),c);
vm.runInContext(`
const input={mx:0,my:0,lookDX:0,lookDY:0,cutHeld:false},ctx={};
const assert=(v,m)=>{if(!v)throw Error(m);};
World.S.colliders.push({x0:-3,x1:3,y0:0,y1:4,z0:16,z1:18.7});
Player.place(0,20,0);Player.update(1/60,input,ctx);
assert(RENDER.cam.z>18.7,'camera crossed the wall on its first frame');
for(let i=0;i<900;i++){Player.update(1/60,input,ctx);assert(!World.occluded(Player.P.x,Player.P.y+1.45,Player.P.z,RENDER.cam.x,RENDER.cam.y,RENDER.cam.z),'camera boom cut through a wall');}
World.S.colliders.length=0;Player.place(0,20,0);
for(let i=0;i<900;i++)Player.update(1/60,{...input,cutHeld:true},ctx);
assert(Player.P.calmCam<.01,'aiming drifted into the distant scenic camera');
assert(Math.hypot(RENDER.cam.x,RENDER.cam.z-20)<2.4,'aim camera lost its shoulder framing');
Player.place(0,20,0);for(let i=0;i<900;i++)Player.update(1/60,input,{threat:true});assert(Player.P.calmCam<.01,'threat camera zoomed away');
Player.place(0,20,0);for(let i=0;i<900;i++)Player.update(1/60,input,ctx);assert(Player.P.calmCam>.8,'safe scenic camera stopped working');
console.log('Player: wall-safe camera boom, close aiming, stable threat framing and scenic idle camera passed');
`,c);
