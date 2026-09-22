// Local combat knowledge, reachable cover and visibly different squad jobs.
'use strict';
const TACTICS=(()=>{
  let serial=0;
  const memory=p=>p.tactics||(p.tactics={id:++serial,role:'hold',think:0,seen:null,seenAt:-99,windup:0,cover:null,dest:null});
  function sight(p,target){const t=target.P||target;return M.dist(p.x,p.z,t.x,t.z)<65&&W.sight3(p.x,p.y+1.5,p.z,t.x,t.y+1.1,t.z,[p.inCar,t.car]);}
  function clearStep(p,x,z){const q=W.pushOut(x,z,.45,{y:p.y,height:1.8});return !q.hit&&W.sight3(p.x,p.y+.55,p.z,x,p.y+.55,z,[p.inCar]);}
  function coverPoints(p,t){const candidates=[];
    if(typeof STREETS!=='undefined')for(const o of STREETS.objects){if(!o.cover||o.down||Math.abs((o.y0||.15)-p.y)>.5)continue;const cx=(o.x0+o.x1)/2,cz=(o.z0+o.z1)/2;if(M.dist(p.x,p.z,cx,cz)>24)continue;
      for(const [x,z] of [[o.x0-.65,cz],[o.x1+.65,cz],[cx,o.z0-.65],[cx,o.z1+.65]])candidates.push({x,z,y:p.y,object:o});}
    for(const c of W.cars){if(c.removed||c.absSpeed>.7||Math.abs(c.y-p.y)>.5||M.dist(c.x,c.z,p.x,p.z)>20)continue;const r=c.right,f=c.fwd;for(const side of [-1,1])for(const end of [-1,1])candidates.push({x:c.x+r[0]*side*(c.spec.wid/2+.6)+f[0]*end*c.spec.len*.22,z:c.z+r[1]*side*(c.spec.wid/2+.6)+f[1]*end*c.spec.len*.22,y:p.y,object:c});}
    return candidates.filter(c=>clearStep(p,c.x,c.z)&&!W.sight3(t.x,t.y+1,t.z,c.x,c.y+.65,c.z,[t.car])&&!W.peds.some(o=>o!==p&&o.alive&&o.tactics?.cover&&M.dist(o.tactics.cover.x,o.tactics.cover.z,c.x,c.z)<2)).sort((a,b)=>M.dist2(p.x,p.z,a.x,a.z)-M.dist2(p.x,p.z,b.x,b.z));
  }
  function step(p,target,dt,visible){const t=target.P||target,T=memory(p);if(visible===undefined)visible=sight(p,target);
    p.suppression=Math.max(0,(p.suppression||0)-dt*.23);T.think-=dt;
    if(visible){T.seen={x:t.x,y:t.y,z:t.z,car:t.car};T.seenAt=W.state.elapsed;T.windup+=dt;}else T.windup=0;
    if(!T.seen){p.aim=0;p.speed=0;if(p.isCop&&POLICE.lastSeen){const q=POLICE.pursuitPoint(p);p.moveToward(q[0],q[1],3.5,dt,POLICE.S.lastY||0);}return true;}
    const known=T.seen,d=M.dist(p.x,p.z,known.x,known.z);
    if(T.think<=0){T.think=.7+(T.id%3)*.13;T.cover=null;T.dest=null;
      const reloadOpening=visible&&t.reloadT>.25,underFire=p.suppression>.28||p.reloadT>0;
      T.role=underFire?'cover':reloadOpening?'advance':['hold','flank','guard'][T.id%3];
      if(underFire||T.role==='hold'){T.cover=coverPoints(p,known)[0]||null;T.dest=T.cover;}
      if(T.role==='flank'&&visible&&d>9){const dx=(p.x-known.x)/(d||1),dz=(p.z-known.z)/(d||1),side=T.id%2?1:-1,x=p.x-dz*side*7,z=p.z+dx*side*7;if(clearStep(p,x,z))T.dest={x,z,y:p.y};}
      if(T.role==='guard'&&d>12){const n=CITY.nearestWalkNode(known.x,known.z);if(n&&clearStep(p,n.x,n.z))T.dest={x:n.x,z:n.z,y:n.y||.15};}
      if(T.role==='advance'&&d>6){const x=p.x+(known.x-p.x)*.3,z=p.z+(known.z-p.z)*.3;if(clearStep(p,x,z))T.dest={x,z,y:known.y};}
      if(T.role!==T.lastRole&&W.state.elapsed-(T.callAt||-99)>6){p.say(T.role==='flank'?'Going around!':T.role==='advance'?'Moving up!':T.role==='cover'?'Taking cover!':'Hold this side!');T.callAt=W.state.elapsed;T.lastRole=T.role;}
    }
    const atCover=T.cover&&M.dist(p.x,p.z,T.cover.x,T.cover.z)<.9;
    const duck=atCover&&(p.reloadT>0||p.suppression>.55||Math.sin(W.state.elapsed*2+T.id)>.45);
    p.crouch=M.approach(p.crouch||0,duck?1:0,dt*5);p.aim=visible&&!duck?1:0;
    if(T.dest&&M.dist(p.x,p.z,T.dest.x,T.dest.z)>.7)p.moveToward(T.dest.x,T.dest.z,T.role==='advance'?5:3.8,dt,T.dest.y);
    else if(!visible){p.aim=0;if(W.state.elapsed-T.seenAt>12){T.seen=null;p.speed=0;}else {const q=p.isCop?POLICE.pursuitPoint(p):[known.x,known.z];p.moveToward(q[0],q[1],3.8,dt,known.y);}}
    else if(d>32&&!T.dest)p.moveToward(known.x,known.z,4,dt,known.y);else p.speed=0;
    if(visible){p.faceTo(t.x,t.z,dt);if(T.windup>.35&&!duck&&p.reloadT<=0&&d<45)p.fireAt(target,dt);}
    return true;
  }
  function nearShot(shooter,x,y,z,hx,hy,hz){const dx=hx-x,dy=hy-y,dz=hz-z,den=dx*dx+dy*dy+dz*dz||1;
    for(const p of W.peds){if(!p.alive||p.inCar||p===shooter||!(p.hostile||p.isGang||p.isCop))continue;const t=M.clamp(((p.x-x)*dx+(p.y+1-y)*dy+(p.z-z)*dz)/den,0,1),d=Math.hypot(p.x-x-dx*t,p.y+1-y-dy*t,p.z-z-dz*t);if(d<1.8){p.suppression=Math.min(1,(p.suppression||0)+.32*(1-d/2));const T=memory(p);if(!T.seen){T.seen={x,y,z};T.seenAt=W.state.elapsed;}T.think=0;}}
  }
  return {step,nearShot,coverPoints,sight};
})();
