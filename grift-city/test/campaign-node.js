const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const noop=()=>{};const ctx=vm.createContext({console,URLSearchParams,location:{search:'?seed=42'},setTimeout:noop,
 TEX:{shopKinds:[],names:new Proxy({},{get:()=>0})},RENDER:{MAX_BONES:14,env:{wet:0},cam:{tx:0,tz:0},setCamera:noop},
 AUDIO:{play:noop},HUD:new Proxy({},{get:()=>noop}),INPUT:{down:()=>false,hit:()=>false,pad:{buttons:[],pressed:[]},mouse:{}},GAME:{save:noop},ECON:{S:{rep:{marla:0}},onMissionPassed:noop}});
for(const n of ['math','assets','meshes','city','world','peds','vehicles','player','police','missions'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),ctx,{filename:n+'.js'});
vm.runInContext('MESH.Builder.prototype.build=MESH.Builder.prototype.buildInstanced=function(){return {}};CITY.generate();W.initProps();PLAYER.init(0,0,0);',ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'campaign-audit.js'),'utf8'),ctx);
console.log(vm.runInContext('runCampaignAudit().join("\\n")',ctx));
