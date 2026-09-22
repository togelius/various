// Bounded local consequences persist when the player leaves a street or saves.
'use strict';
const STREETLIFE=(()=>{
  const incidents=[],queues=[],deliveries=[];let started=false,scanT=0;
  function record(kind,x,z){let r=incidents.find(r=>M.dist(r.x,r.z,x,z)<24);const violent=kind==='shot'||kind==='explosion';if(r){r.left=Math.max(r.left,violent?100:50);r.violent=r.violent||violent;}else{r={kind,x,z,left:violent?100:50,violent};incidents.push(r);if(incidents.length>20)incidents.shift();}return r;}
  function risk(x,z){return incidents.reduce((v,r)=>Math.max(v,Math.max(0,1-M.dist(r.x,r.z,x,z)/38)*(r.violent?1:.6)),0);}
  function init(){if(started)return;started=true;for(const [x,z] of [[190,259],[123,462]])queues.push({x,z,people:[],quiet:0});}
  function update(dt){init();for(let i=incidents.length-1;i>=0;i--){incidents[i].left-=dt;if(incidents[i].left<=0)incidents.splice(i,1);}for(const n of W.state.noises)if(['shot','explosion','crash'].includes(n.kind))record(n.kind,n.x,n.z);
    for(const s of CITY.shopfronts){const unsafe=incidents.some(r=>r.violent&&M.dist2(r.x,r.z,s.x,s.z)<32**2);if(s.originallyShut===undefined)s.originallyShut=s.shut;s.shut=unsafe||s.originallyShut;s.shutter=M.approach(s.shutter||0,unsafe?1:0,dt*.55);}
    scanT-=dt;if(scanT>0)return;scanT=1;
    for(const q of queues){if(M.dist(PLAYER.x,PLAYER.z,q.x,q.z)>140)continue;
      if(!q.people.length&&risk(q.x,q.z)<.2){for(let i=0;i<3;i++){const p=PEDS.spawn(q.x+i*.8,q.z,{important:true});p.stationary=true;p.state='walk';p.angle=Math.PI;p.queueHome=[p.x,p.z];q.people.push(p);}}
      if(risk(q.x,q.z)>.2){q.quiet=0;for(const p of q.people)if(p.alive){p.stationary=false;p.scare(q.x,q.z);}}else if(++q.quiet===25){for(const p of q.people)if(p.alive&&!p.inCar){p.fear=0;p.goto(...p.queueHome,1.5,who=>{who.state='walk';who.stationary=true;who.angle=Math.PI;});}}
    }
    // One parked delivery van is a physical obstacle, and later joins ordinary traffic.
    if(!deliveries.length&&W.state.elapsed>12){const x=341.25,z=295;if(M.dist(PLAYER.x,PLAYER.z,x,z)<180&&M.dist(PLAYER.x,PLAYER.z,x,z)>40&&!W.sight3(PLAYER.x,PLAYER.P.y+1.5,PLAYER.z,x,1.5,z,[PLAYER.car])){const c=VEH.spawn('van',x,z,0,{mode:'parked',color:4});c.persistent=true;const p=PEDS.spawn(x+2,z,{important:true});p.stationary=true;p.item='briefcase';deliveries.push({car:c,driver:p,left:45});}}
    for(const d of deliveries){if(d.left<=0||d.car.removed)continue;d.left--;if(d.left<=0){d.car.persistent=false;if(d.driver.alive&&!d.car.driver&&!d.car.wrecked){d.driver.item=null;d.driver.inCar=d.car;d.driver.important=false;d.driver.state='driving';d.car.driver=d.driver;d.car.ai.mode='traffic';d.car.ai.edge=null;}}}
    // A crash draws nearby onlookers; gunfire makes them flee through the existing fear system.
    for(const r of incidents)if(!r.violent&&r.left>35){let n=0;for(const p of W.peds){if(n>=3)break;if(!p.alive||p.inCar||p.important||p.isCop||p.hostile||p.fear>0||M.dist(p.x,p.z,r.x,r.z)>16)continue;p.state='stand';p.wanderT=3;p.faceTarget={x:r.x,z:r.z};p.faceTo(r.x,r.z,.4);n++;}}
  }
  let shutterMesh=null;
  function entities(out){for(const s of CITY.shopfronts){if((s.shutter||0)<.01||M.dist(s.x,s.z,RENDER.cam.tx,RENDER.cam.tz)>75)continue;if(!shutterMesh){const b=new MESH.Builder();b.box(-.5,0,-.04,1,3.3,.08,[.28,.34,.33]);for(let y=.1;y<3.3;y+=.17)b.box(-.5,y,-.065,1,.025,.025,[.42,.47,.43]);shutterMesh=b.build();}if(!s.shutterModel)s.shutterModel=M.create();M.trs(s.shutterModel,s.x+s.nx*.06,.15+3.3*(1-s.shutter),s.z+s.nz*.06,Math.atan2(s.nx,s.nz),s.w,s.shutter,1);out.push({mesh:shutterMesh,model:s.shutterModel});}}
  function save(){return {incidents:incidents.map(r=>({...r})),gates:typeof STREETS==='undefined'?[]:STREETS.objects.filter(o=>o.gate&&o.down).map(o=>[o.x0,o.z0])};}
  function load(data){if(!data)return;incidents.length=0;for(const r of (data.incidents||[]).slice(0,20))if(Number.isFinite(r.x)&&Number.isFinite(r.z)&&Number.isFinite(r.left)&&r.left>0)incidents.push({kind:r.kind,x:r.x,z:r.z,left:Math.min(100,r.left),violent:!!r.violent});if(typeof STREETS!=='undefined')for(const pos of data.gates||[])for(const o of STREETS.objects)if(o.gate&&o.x0===pos[0]&&o.z0===pos[1])o.down=true;}
  return {incidents,queues,deliveries,record,risk,update,entities,save,load};
})();
