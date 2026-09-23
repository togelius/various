// Assisted progression audit: real mission code and actors; travel/combat outcomes are controlled.
// This checks campaign logic, not driving difficulty or a human-speed combat playthrough.
function runCampaignAudit() {
 const log=[],p=PLAYER.P,S=MISSIONS.S, check=(v,m)=>{if(!v)throw Error(m);};
 const at=(x,z)=>{p.x=x;p.z=z;p.y=CITY.groundY(x,z);p.vx=p.vz=0;};
 const place=k=>{const q=CITY.place(k);at(q.x,q.z);};
 const enter=c=>{p.car=c;c.driver=PLAYER;c.ai.mode='player';p.state='car';at(c.x,c.z);MISSIONS.onEnterCar(c);};
 const park=k=>{const q=CITY.place(k),c=p.car;c.x=q.x;c.z=q.z;c.vx=c.vz=0;at(q.x,q.z);};
 const leave=()=>{if(p.car){p.car.driver=null;p.car=null;}p.state='foot';};
 const dead=q=>{q.state='dead';q.health=0;};
 const wreck=c=>{c.wrecked=true;c.health=0;};
 const start=m=>{leave();MISSIONS.cleanup();W.cars.length=0;W.peds.length=0;W.pickups.length=0;W.state.heard.length=0;POLICE.clear();S.current=null;S.retry=null;S.cp=null;S.dialogue=null;S.cooldown=0;S.skipIntro=true;p.health=100;p.alive=true;p.weapon='fist';p.weaponOut=false;p.aim=0;p.speed=0;at(-100,-100);MISSIONS.start(m);check(S.current===m,m.name+' did not start');return m.data;};
 const update=(m,dt=.016)=>{m.update(m.data,dt);};
 const expectedRewards=[500,1600,1500,2500,2500,3000,4000,10000,25000,3000,4000,5000,5000,8000,5000,3500,6000,8000,1500,2500,4000,6000]; let rewardIndex=0, beforeMoney=0;
 const passed=m=>{check(p.money-beforeMoney===expectedRewards[rewardIndex++],m.name+' payout mismatch: '+(p.money-beforeMoney));check(S.current===null,m.name+' did not finish: '+MISSIONS.objective);check(p.stats.missions>0,'mission counter');log.push(m.name+' — passed');S.dialogue=null;};
 for(const m of MISSIONS.LIST) {
  const d=start(m);beforeMoney=p.money;
  switch(m.id) {
   case 0: {const c=d.car;enter(c);update(m);check(p.wanted===1,'the hot car brings a star');POLICE.clear();update(m);check(S.dialogue,'Marla calls once the heat is off');S.dialogue=null;park('garage');c.x=p.x;c.z=p.z;update(m);break;}
   case 1: d.method='unnoticed';enter(d.car);park('garage');update(m);break;
   case 2: enter(d.van);park('docks');update(m);break;
   case 3: at(...d.spot);update(m);d.goons.forEach(dead);update(m);dead(d.teddy);update(m);check(d.cash,'Teddy must drop the collection');p.money+=d.cash.amount;d.cash.taken=true;update(m);place('mission');update(m);break;
   case 4: for(const type of ['taxi','police','bus']){const q=CITY.place('garage'),c=VEH.spawn(type,q.x,q.z,0);m.onExitCar(c);}update(m);break;
   case 5: enter(d.car);at(...d.startPt);update(m);update(m,4.1);for(let i=0;i<d.route.length*d.laps;i++){at(...d.route[d.cp]);update(m);}break;
   case 6: d.trucks.forEach(wreck);update(m);POLICE.clear();update(m);break;
   case 7: place('bank');d.crew.forEach(c=>{c.x=p.x;c.z=p.z;});update(m);S.timer=0;update(m);place('safehouse');d.crew.forEach(c=>{c.x=p.x;c.z=p.z;});update(m);break;
   case 8: place('tower');update(m);dead(d.crane);update(m);place('safehouse');update(m);break;
  }
  passed(m);
 }
 for(const m of MISSIONS.LIST2) {
  const d=start(m);beforeMoney=p.money;
  switch(m.id) {
   case 0: enter(d.truck);update(m);park('docks');update(m);break;
   case 1: place('docks');update(m);for(let i=0;i<3;i++){update(m,41);d.attackers.forEach(dead);}update(m);break;
   case 2: d.cars.forEach(wreck);update(m);break;
   case 3: at(d.van.x+35,d.van.z);update(m);d.van.ai.onRouteEnd();update(m);d.guards.filter(Boolean).forEach(dead);update(m);break;
   case 4: enter(VEH.spawn('sedan',d.truck.x+10,d.truck.z,0));update(m);d.truck.ai.onRouteEnd();update(m);break;
   case 5: at(d.hut.x,d.hut.z);update(m);place('mission2');update(m);break;
   case 6: for(const q of d.subjects){at(q.x,q.z-12);m.onPhoto(d,q.x,q.z);}place('mission2');update(m);break;
   case 7: wreck(d.tanker);d.cars.forEach(wreck);place('mission2');update(m);break;
   case 8: enter(d.boat);wreck(d.launch);update(m);leave();place('mission2');update(m);break;
  }
  passed(m);
 }
 for(const m of MISSIONS.PHONE) {const d=start(m);beforeMoney=p.money;if(d.t)dead(d.t);else dead(d.d);update(m);passed(m);}
 check(S.progress===9,'Marla campaign unlock progression');check(S.progress2===9,'Okafor campaign unlock progression');check(S.phoneProgress===4,'phone campaign unlock progression');
 // Failure must offer the same job again; every scripted job supports a death/failure retry.
 for(const m of [...MISSIONS.LIST,...MISSIONS.LIST2,...MISSIONS.PHONE]) {
  start(m);const oldData=m.data;MISSIONS.onPlayerDown('wasted');
  if(m.gentle){check(!S.current&&!S.retry&&S.gentleRestart.m===m,m.name+' must restart quietly');for(let i=0;i<400&&!S.current;i++)MISSIONS.update(.016);check(S.current===m&&m.data!==oldData&&!S.dialogue,m.name+' must restart itself without its intro');continue;}
  check(!S.current && S.retry.m===m,m.name+' failure did not retain retry');
  const oldHit=INPUT.hit;INPUT.hit=k=>k==='KeyY';try{MISSIONS.update(.016);}finally{INPUT.hit=oldHit;}
  check(S.current===m && m.data!==oldData && !S.dialogue,m.name+' retry must recreate the job without replaying the intro');
 }
 log.push('22 actual failure/retry transitions — passed');
 // Story order: CRANE waits for Okafor's strand, and its marker does not start it early.
 {leave();MISSIONS.cleanup();S.current=null;S.retry=null;S.cooldown=0;S.dialogue=null;S.progress=8;S.progress2=5;place('mission');MISSIONS.update(.016);check(!S.current&&/Not yet/.test(MISSIONS.objective),'CRANE must wait for Okafor');
  S.progress2=MISSIONS.LIST2.length;MISSIONS.update(.016);check(S.current&&S.current.name==='CRANE','CRANE starts once Okafor is done');MISSIONS.cleanup();S.current=null;S.dialogue=null;log.push('Story order: CRANE after Okafor — passed');}
 // A job interrupted by a reload comes back, from its checkpoint: SPECIAL DELIVERY past the ambush checkpoint.
 {const m=MISSIONS.LIST[2];const d=start(m);enter(d.van);d.phase=1;{const k=CITY.place('docks');at(k.x+60,k.z+60);}p.car.x=p.x;p.car.z=p.z;update(m);check(S.cp&&S.cp.name===m.name&&S.cp.idx===0,'the ambush sets a checkpoint');
  const job=MISSIONS.jobState();check(job&&job.name===m.name&&job.cp===0,'a save records the job and its checkpoint');leave();MISSIONS.cleanup();S.current=null;S.cp=null;S.retry=null;
  MISSIONS.resumeJob(JSON.parse(JSON.stringify(job)));check(S.retry&&S.retry.resumed&&S.cp&&S.cp.restore,'a load offers the job back');
  const oldHit=INPUT.hit;INPUT.hit=k=>k==='KeyY';try{MISSIONS.update(.016);}finally{INPUT.hit=oldHit;}check(S.current===m&&m.data.ambush&&S.timer>100,'resuming starts from the checkpoint');MISSIONS.cleanup();S.current=null;S.cp=null;log.push('Resume from a saved checkpoint — passed');}
 // The finale's choice: a Bastion stopped by a crash leaves Crane alive with an offer; taking it pays $40,000, passes
 // CRANE and turns Crane's people; finishing it is Marla's ending.
 for(const pick of [1,0]){const m=MISSIONS.LIST[8];const d=start(m);beforeMoney=p.money;d.phase=1;d.crane.inCar=d.car;d.car.driver=d.crane;d.car.wrecked=true;d.car.disabled=true;update(m);check(d.phase===3&&d.crane.alive,'a crashed Bastion leaves Crane alive');
  at(d.crane.x+2,d.crane.z);update(m);check(S.dialogue,'Crane makes his offer');const then=S.dialogue.then;S.dialogue=null;then&&then();check(S.choice&&S.choice.options.length===2,'the offer is a choice');
  const oldHit=INPUT.hit;INPUT.hit=k=>k==='Digit'+(pick+1);try{MISSIONS.update(.016);}finally{INPUT.hit=oldHit;}S.dialogue=null;
  if(pick===1){check(S.flags.ending==='crane'&&p.money-beforeMoney===40000&&ECON.S.rep.crane>0&&!S.current,'the deal pays and ends the story Crane\'s way');}
  else{check(!d.crane.alive&&d.phase===2,'finishing it kills Crane');place('safehouse');update(m);check(S.flags.ending==='marla'&&!S.current,'Marla\'s ending');S.dialogue=null;}
  MISSIONS.cleanup();S.current=null;POLICE.clear();}
 log.push('The choice and both endings — passed');
 // The finale can be lost: the Bastion reaching open road far from the player fails CRANE.
 {const m=MISSIONS.LIST[8];const d=start(m);d.phase=1;d.crane.inCar=d.car;d.car.driver=d.crane;d.car.x=p.x+400;d.car.z=p.z;update(m);check(!S.current&&S.retry&&S.retry.m===m,'CRANE must fail when the Bastion escapes');S.retry=null;log.push('Finale fail branch — passed');}
 // The bank crew hold the door as fighters, not bystanders.
 {const m=MISSIONS.LIST[7];const d=start(m);place('bank');d.crew.forEach(c=>{c.x=p.x;c.z=p.z;});update(m);check(d.phase===1&&d.crew.every(c=>c.role==='crew'&&c.guardSpot),'crew guard the bank door');MISSIONS.cleanup();S.current=null;POLICE.clear();log.push('Bank crew hold and fight — passed');}
 const repo=MISSIONS.LIST[1];
 for(const method of ['negotiated','intimidated','unnoticed','chase','noise']) {
  const d=start(repo),o=d.owner;at(o.x,o.z+(method==='unnoticed'?-8:2));o.angle=0;p.angle=Math.PI;
  if(method==='intimidated'){p.weapon='pistol';p.weaponOut=true;p.aim=1;}
  const oldDown=INPUT.down;INPUT.down=k=>k==='KeyG'&&method==='negotiated';
  if(method==='noise')W.state.heard.push({x:p.x,z:p.z,r:30});
  try{for(let i=0;i<(method==='chase'?80:30);i++)update(repo,.1);}finally{INPUT.down=oldDown;}
  if(method==='unnoticed')check(!d.fled && !d.notice,'unseen approach must not reveal the player');
  else if(method==='chase'||method==='noise')check(d.fled,'provoked debtor must flee');
  else check(d.surrendered && d.method===method,method+' must surrender');
 }
 log.push('5 repo approaches — passed');
 // A racer on foot cannot collect checkpoints, and markers cannot accumulate every frame.
 {const m=MISSIONS.LIST[5],d=start(m);d.started=true;d.count=0;at(...d.route[0]);for(let i=0;i<120;i++)update(m);check(d.cp===0,'race on foot');check(S.markers.length===1,'race marker leak');}
 // Mission handover must wait until an exit is possible.
 for(const m of [MISSIONS.LIST[2],MISSIONS.LIST2[0]]){const d=start(m);enter(d.van||d.truck);update(m);park('docks');const oldExit=PLAYER.exitCar;PLAYER.exitCar=()=>false;try{update(m);}finally{PLAYER.exitCar=oldExit;}check(S.current===m,'blocked exit must defer delivery');}
 {const m=MISSIONS.LIST[7],d=start(m);dead(d.crew[0]);update(m);check(!S.current && S.retry.m===m,'bank job must require every crew member');}
 log.push('Race, delivery and crew regressions — passed');
 for(const m of [...MISSIONS.LIST,...MISSIONS.LIST2,...MISSIONS.PHONE]) {
  const d=start(m);
  for(const e of S.spawned) {if(e.spec?.boat || e.inCar)continue;for(const [x,z,r] of e.spec?e.circles():[[e.x,e.z,.4]]) {const q=W.pushOut(x,z,r);check(Math.hypot(q.x-x,q.z-z)<.1,m.name+' spawns '+(e.type||e.name||'guard')+' inside collision geometry');}}
  if(d.hut){const q=W.pushOut(d.hut.x,d.hut.z,.4);check(Math.hypot(q.x-d.hut.x,q.z-d.hut.z)<.1,'ledger must be accessible on foot');}
 }
 log.push('22 mission spawn-clearance checks — passed');
 return log;
}
if(typeof module!=='undefined')module.exports=runCampaignAudit;
