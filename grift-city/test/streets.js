// Shared authored geometry: clearances, stacked floors, paths and traversal.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const noop=()=>{},ctx=vm.createContext({console,assert,URLSearchParams,location:{search:'?seed=42'},TEX:{names:{},shopKinds:[]},RENDER:{MAX_BONES:14,env:{wet:0},cam:{},setCamera:noop},AUDIO:{play:noop},HUD:{notify:noop},POLICE:{crime:noop},MISSIONS:{dialogue:null,S:{}},GAME:{state:'playing',options:{}}});
for(const n of ['math','assets','meshes','streets','city','world','input','vehicles','peds','player'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),ctx,{filename:n+'.js'});
vm.runInContext(`
MESH.Builder.prototype.build=()=>({});CITY.generate();
assert.equal(CITY.blocks.filter(b=>b.quarter).length,10);
assert.equal(CITY.blocks.filter(b=>b.authored).length,7);
for(let z=252;z<293;z+=.5)assert.ok(!CITY.solidProps.some(p=>M.dist(p.x,p.z,210,z)<p.r+1),'Lantern Lane entrance and lane remain free of sidewalk furniture');
assert.equal(CITY.districtName(210,252),'Foundry Quarter');
assert.equal(CITY.groundY(294,462,.15),.15,'walk underneath deck');
assert.equal(CITY.groundY(294,462,3.8),3.8,'walk on deck');
assert.equal(W.pushOut(294,462,.42,{y:.15}).hit,null,'underside clear');
assert.equal(W.pushOut(294,462,.42,{y:3.8}).hit,null,'deck surface clear');
assert.equal(W.raycast3(294,1.5,462,1,0,0,20,null,true).kind,'none','underpass sightline');
assert.ok(W.raycast3(294,2,462,0,1,0,10,null,true).dist<1.5,'ceiling ray');
assert.equal(STREETS.ceiling(294,462,.15,2,1.8),1.68,'ceiling stops head');
for(let z=430;z<=444;z+=.25){const y=CITY.groundY(314,z,(z-430)*3.65/14+.15);assert.ok(Math.abs(y-((z-430)*3.65/14+.15))<.001,'ramp continuity');}
const portal=STREETS.objects.find(o=>o.maxWidth===2.02),x=(portal.x0+portal.x1)/2,z=(portal.z0+portal.z1)/2;
assert.equal(W.pushOut(x,z,.84,{vehicle:{spec:{wid:1.85}},y:.15}).hit,null,'compact passage');
assert.ok(W.pushOut(x,z,.84,{vehicle:{spec:{wid:2.1}},y:.15}).hit,'wide vehicle blocked');
const path=STREETS.navigation({x:262,y:.15,z:463},{x:314,y:3.8,z:461});
assert.ok(path.length>4 && path.some(n=>n.y===3.8),'underpass to deck uses ramp network');
assert.ok(STREETS.navigation({x:252,z:420,y:0},{x:314,z:461,y:3.8},2).some(n=>n.y===3.8),'car graph connects road and upper deck');
const gate=STREETS.objects.find(o=>o.gate),gx=(gate.x0+gate.x1)/2,gz=(gate.z0+gate.z1)/2;
assert.ok(W.pushOut(gx,gz,.4).hit,'intact gate solid');
W.pushOut(gx,gz,.8,{vehicle:{spec:{wid:1.8,mass:1},absSpeed:10,vx:0,vz:10},y:.15});
assert.ok(gate.down);assert.equal(W.pushOut(gx,gz,.4).hit,null,'broken gate clears collision');
const car=VEH.spawn('sedan',314,429,0,{});car.driver=PLAYER;car.ai.mode='player';car.controls.throttle=1;for(let i=0;i<180;i++)car.physics(1/60);assert.ok(car.z>447 && car.y>=3.79,'car physically crosses ramp/deck seam');W.cars.length=0;
const p=PLAYER.P;Object.assign(p,{x:299,y:.15,z:298,camYaw:0,state:'foot',crouch:0});
assert.ok(PLAYER.startVault(),'wall is vaultable');
for(let i=0;i<40;i++)PLAYER.update(1/60);
assert.equal(p.state,'foot');assert.ok(p.z>300,'vault lands beyond wall');
console.log('Foundry Quarter: 10 blocks, deck/underpass, continuous ramp, clearances, navigation, breakage and vault passed');
`,ctx);
