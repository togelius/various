// Foundry Quarter: authored spaces and the shared geometry contracts used by movement,
// sight, cover, vaulting, vehicle clearance, navigation and rendering.
'use strict';
const STREETS = (() => {
  const BLOCKS = [[1,3],[2,3],[3,3],[4,3],[1,4],[2,4],[3,4],[1,5],[2,5],[3,5]];
  const objects=[], surfaces=[], paths=[], landmarks=[], nodes=[];let walkGraph=[],driveGraph=[];
  const has=(i,j)=>BLOCKS.some(b=>b[0]===i&&b[1]===j);
  const contains=(s,x,z)=>x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1;
  const height=(s,x,z)=>s.y+(s.slopeZ||0)*(z-s.z0)+(s.slopeX||0)*(x-s.x0);
  const C={stone:[.71,.69,.63],trim:[.35,.42,.40],teal:[.19,.36,.36],rust:[.51,.28,.20],cream:[.85,.79,.64],asphalt:[.63,.64,.61]};
  function ground(x,z,y=0) { let best=-Infinity; for(const s of surfaces) if(contains(s,x,z)) {const h=height(s,x,z);if(h<=y+.72&&h>best)best=h;}return best; }
  function ceiling(x,z,oldY,newY,bodyHeight) {
    let y=newY;
    for(const o of objects) if(!o.down&&o.y0>0&&contains(o,x,z)&&oldY+bodyHeight<=o.y0+.02&&y+bodyHeight>o.y0)y=o.y0-bodyHeight;
    return y;
  }
  function raySurface(ox,oy,oz,ex,ey,ez) {
    let best=1;
    for(const s of surfaces) {const den=ey-(s.slopeX||0)*ex-(s.slopeZ||0)*ez;if(Math.abs(den)<1e-8)continue;
      const t=(height(s,ox,oz)-oy)/den;if(t>=0&&t<best&&contains(s,ox+ex*t,oz+ez*t))best=t;}
    return best;
  }
  function route(name,points,width=5,mode='both') { const p={name,points,width,mode};paths.push(p);return p; }
  function surface(s) {surfaces.push(s);return s;}
  function build(b,block,api) {
    if(!has(block.i,block.j))return false;
    block.quarter='Foundry Quarter';
    // Retain the mission garage, respray and existing park; they anchor this connected area.
    if(['garage','spray','park'].includes(block.kind))return false;
    const {addLot,addPlace,props,parkedSpots,shopfronts,T}=api, x=block.x,z=block.z;
    block.authored=true;
    const solid=(a,h,kind='wall',extra={})=>{
      const o=addLot(block,a[0],a[1],a[2],a[3],h,kind);Object.assign(o,{y0:0,material:kind==='building'?'masonry':'concrete'},extra);objects.push(o);return o;
    };
    const wall=(x0,z0,w,d,h=1.05,extra={})=>{
      const y=extra.y0||.15,o=solid([x0,z0,x0+w,z0+d],y+h,'wall',{cover:h>=.7&&h<=1.5,vaultable:h<=1.25,...extra});
      if(!o.destructible){b.box(x0,y,z0,w,h,d,C.stone,0);b.box(x0-.03,y+h-.08,z0-.03,w+.06,.10,d+.06,C.cream);}
      return o;
    };
    const sign=(x0,y0,z0,w,key)=>b.box(x0,y0,z0,w,w/5,.12,[1,1,1],T[key]||T.vossSign,{uvScale:w,uvScaleV:w/5,faces:32});
    const landmark=(name,x0,z0,key)=>{landmarks.push({name,x:x0,z:z0,key});addPlace('landmark',{label:name,x:x0,z:z0});};
    const building=(x0,z0,w,d,h=13,tile='brick2',shop=3)=>{
      // The recess is real: a set-back ground floor, side piers, and an upper overhang.
      solid([x0,z0+.95,x0+w,z0+d],h,'building');
      solid([x0,z0,x0+.65,z0+.95],4.15,'building');solid([x0+w-.65,z0,x0+w,z0+.95],4.15,'building');
      solid([x0,z0,x0+w,z0+d],h,'overhang',{y0:4.15});
      b.box(x0,4.15,z0,w,h-4.15,d,C.stone,T[tile],{uvScale:12.8});
      b.box(x0,.15,z0+.95,w,4,d-.95,C.stone,T[tile],{uvScale:8});
      b.box(x0,.15,z0,.65,4,.95,C.trim);b.box(x0+w-.65,.15,z0,.65,4,.95,C.trim);
      // One shop per frontage, varied widths; no repeated 8m stamp along the street.
      b.box(x0+.65,.15,z0+.93,w-1.3,3.85,.04,[.87,.86,.81],T['shops'+shop],{uvScale:(w-1.3)/2,uvScaleV:3.85,faces:32});
      b.box(x0-.12,3.6,z0-.38,w+.24,.22,1.35,C.teal);b.box(x0-.1,h,z0-.1,w+.2,.28,d+.2,C.trim);
      shopfronts.push({x:x0+w/2,z:z0+.88,nx:0,nz:-1,w:w-1.3,h:.12,tile:T['shops'+shop],shut:false});
      for(let k=0;k<Math.floor(w/4);k++) b.box(x0+1+k*4,4.12,z0-.03,2.5,.18,.24,C.cream);
      return [x0,z0,w,d,h];
    };
    const paintPath=(points,w)=>{
      for(let i=1;i<points.length;i++){const a=points[i-1],c=points[i],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),rx=-dz/len*w/2,rz=dx/len*w/2;
        b.poly([[a[0]+rx,.166,a[1]+rz],[c[0]+rx,.166,c[1]+rz],[c[0]-rx,.166,c[1]-rz],[a[0]-rx,.166,a[1]-rz]],C.asphalt,T.asphalt,[[0,0],[0,len/8],[w/8,len/8],[w/8,0]]);}
    };
    const gate=(x0,z0,w,d)=>wall(x0,z0,w,d,1.35,{destructible:true,material:'wood',strength:27,gate:true,cover:true});
    const id=block.i+','+block.j;
    if(id==='2,3') {
      building(x+3,z+2,23,19,10,'brick3',3);sign(x+5,4.3,z+1.8,19,'foundryDiner');
      building(x+3,z+31,23,29,17,'loft',19);building(x+38,z+4,22,24,14,'stone',7);building(x+38,z+40,22,20,11,'painted',5);
      const lane=[[x+32,z-10],[x+32,z+74]];paintPath(lane,5.6);route('Lantern Lane',lane,5.6);
      gate(x+29.2,z+43,5.6,.16);wall(x+42,z+32,9,.5);wall(x+53,z+32,7,.5);
      landmark('Lantern Diner',x+15,z-2,'diner');props.cafeSet.push({x:x+13,z:z-1.5,a:0});parkedSpots.push({x:x+33,z:z+20,angle:0});
    } else if(id==='2,4') {
      building(x+3,z+3,22,13,11,'brick3',14);building(x+39,z+3,15,13,11,'painted',14);building(x+4,z+47,49,14,14,'loft',17);building(x+3,z+23,12,19,8,'painted',2);
      b.floor(x+18,z+18,38,27,.165,C.cream,T.sidewalk,6);
      // Narrow exit has a measured 2.02m clearance: hatchbacks fit; vans do not.
      wall(x+58,z+18,.5,10,2.0);wall(x+58,z+30.02,.5,15,2.0);
      solid([x+58,z+28,x+58.5,z+30.02],2.15,'portal',{maxWidth:2.02,passage:true,material:'clearance'});
      sign(x+48,2.4,z+17.95,10,'foundryPassage');
      wall(x+24,z+34,11,.5);wall(x+41,z+34,8,.5);wall(x+21,z+23,.5,6);
      const lane=[[x+32,z-10],[x+32,z+20],[x+42,z+29],[x+74,z+29]];paintPath(lane,4.5);route('Courtyard Cut',lane,2.02);
      const foot=[[x-10,z+20],[x+19,z+20],[x+19,z+41],[x+55,z+41],[x+55,z+74]];route('Laundry Walk',foot,1.2,'foot');
      for(const zz of [18.9,21.1])wall(x-1,z+zz,.24,.24,.9);
      props.bench.push({x:x+48,z:z+23,a:Math.PI});landmark('Laundry Court',x+39,z+23,'court');
    } else if(id==='3,3') {
      building(x+3,z+2,31,12,12,'warehouse',20);building(x+42,z+40,20,21,16,'brick2',19);
      sign(x+5,4.3,z+1.8,26,'foundryWorks');
      const diagonal=[[x-10,z+47],[x+14,z+37],[x+39,z+23],[x+74,z+12]];paintPath(diagonal,6);route('Foundry Bend',diagonal,6);
      for(const [cx,cz,col] of [[x+5,z+51,C.rust],[x+14,z+51,C.teal],[x+43,z+3,C.teal]]) {b.append(MESH.shippingContainer(col),cx,.15,cz);solid([cx,cz,cx+6,cz+2.4],2.75,'container',{material:'metal'});}
      wall(x+34,z+37,6,.65,1.05);wall(x+39,z+29,.6,5,1.05);gate(x+24,z+28,.16,7);
      b.box(x+5,.15,z+19,15,.65,5,C.stone);solid([x+5,z+19,x+20,z+24],.8,'loadingBay',{cover:true,vaultable:true});
      landmark('Old Foundry',x+22,z+28,'foundry');parkedSpots.push({x:x+51,z:z+29,angle:Math.PI/2});
    } else if(id==='3,5') {
      const deck={x0:x+8,z0:z+14,x1:x+56,z1:z+48,y:3.8,name:'Switchback Deck'};surface(deck);b.floor(deck.x0,deck.z0,48,34,3.801,C.asphalt,T.asphalt,8);
      b.box(deck.x0,3.48,deck.z0,48,.32,34,C.stone,0);solid([deck.x0,deck.z0,deck.x1,deck.z1],3.8,'deck',{y0:3.48,material:'concrete'});
      const ramps=[{x0:x+48,x1:x+56,z0:z,z1:z+14,y:.15,slopeZ:3.65/14},{x0:x+8,x1:x+16,z0:z+48,z1:z+64,y:3.8,slopeZ:-3.65/16}];
      for(const ramp of ramps){surface(ramp);const y0=height(ramp,ramp.x0,ramp.z0),y1=height(ramp,ramp.x1,ramp.z1);b.poly([[ramp.x0,y0,ramp.z0],[ramp.x0,y1,ramp.z1],[ramp.x1,y1,ramp.z1],[ramp.x1,y0,ramp.z0]],C.asphalt,T.asphalt,[[0,0],[0,2],[1,2],[1,0]]);}
      for(const xx of [x+20,x+43])for(const zz of [z+17,z+45]){b.box(xx,.15,zz,.7,3.35,.7,C.stone);solid([xx,zz,xx+.7,zz+.7],3.5,'column');}
      for(const xx of [deck.x0-.25,deck.x1])wall(xx,deck.z0,.25,34,.85,{y0:3.8});
      wall(deck.x0,deck.z0,39.8,.25,.85,{y0:3.8});wall(deck.x0+8.2,deck.z1-.25,39.8,.25,.85,{y0:3.8});
      for(let xx=x+20;xx<x+46;xx+=4){b.floor(xx,z+18,.10,8,3.805,C.cream,0);b.floor(xx,z+38,.10,8,3.805,C.cream,0);}
      sign(x+16,2,z+13.84,24,'foundryDeck');landmark('Switchback Deck',x+32,z+32,'deck');
      route('Switchback Ramp',[[x+52,z-10,.15],[x+52,z,.15],[x+52,z+14,3.8],[x+52,z+31,3.8],[x+12,z+31,3.8],[x+12,z+48,3.8],[x+12,z+64,.15],[x+12,z+74,.15]],7.5);
      route('Underpass',[[x-10,z+33,.15],[x+74,z+33,.15]],8);
      for(const zz of [z+28,z+37]){b.floor(x,zz,64,.14,.17,C.cream,0);}
    } else if(id==='1,3') {
      building(x+3,z+2,25,58,16,'brick2',19);building(x+35,z+3,26,56,12,'warehouse',5);
      b.cyl(x+49,12,z+44,3.2,16,C.teal,0,12);for(const xx of [-2,2])for(const zz of [-2,2])b.box(x+49+xx,10,z+44+zz,.15,2,.15,C.trim);
      const foot=[[x+31.5,z-10],[x+31.5,z+74]];paintPath(foot,3);route('Boiler Walk',foot,1.3,'foot');
      for(const xx of [x+30.6,x+32.4])wall(xx,z+29,.25,.25,.95);
      solid([x+30.7,z+29,x+32.4,z+29.25],2,'portal',{maxWidth:1.3,passage:true});landmark('Teal Water Tower',x+31,z+20,'tower');
    } else if(id==='1,5') {
      building(x+2,z+3,21,18,9,'painted',14);building(x+31,z+3,29,18,12,'brick3',17);building(x+2,z+43,58,18,15,'stone',3);
      b.floor(x+7,z+23,49,16,.166,C.cream,T.sidewalk,5);sign(x+33,4.3,z+2.8,24,'foundryMarket');
      for(const xx of [x+11,x+47]){wall(xx,z+25,5,2,.8);props.roundTree.push({x:xx+2.5,z:z+26,a:0,s:.8});}
      props.cafeSet.push({x:x+31,z:z+30,a:0});props.bench.push({x:x+38,z:z+39,a:0});
      route('Market Arcade',[[x+27,z-10],[x+27,z+33],[x+64,z+33],[x+74,z+33]],2.5,'foot');landmark('Signal Market',x+31,z+30,'market');
    } else {
      building(x+2,z+3,19,23,11,'brick3',7);building(x+27,z+6,33,21,17,'deco',10);building(x+3,z+39,24,22,14,'loft',4);building(x+34,z+41,26,20,10,'stone',3);
      wall(x+7,z+31,7,.5);wall(x+46,z+33,8,.5);landmark('Foundry Exchange',x+31,z+32,'exchange');
      route('Exchange Lane',[[x-10,z+33],[x+30,z+33],[x+30,z+74]],4.6);
    }
    return true;
  }
  function connect(walkNodes) {
    walkGraph=walkNodes;
    const add=(x,z,y)=>{const n={x,z,y,links:[]};nodes.push(n);return n;};
    const link=(a,b,width,mode)=>{a.links.push({to:b,width,mode});b.links.push({to:a,width,mode});};
    for(const p of paths){let previous=null;for(const v of p.points){const n=add(v[0],v[1],v[2]??.15);if(previous)link(previous,n,p.width,p.mode);previous=n;}}
    // Join physically coincident paths, preserving their height and vehicle clearance.
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(M.dist(nodes[i].x,nodes[i].z,nodes[j].x,nodes[j].z)<1&&Math.abs(nodes[i].y-nodes[j].y)<.3)link(nodes[i],nodes[j],8,'both');
    // Mirror each node once, then connect route endpoints to the sidewalk network.
    const sidewalk=walkNodes.slice();
    for(const n of nodes){n.walk={x:n.x,z:n.z,y:n.y,links:[]};walkNodes.push(n.walk);}
    for(const n of nodes)for(const e of n.links)n.walk.links.push({to:e.to.walk,cross:false});
    for(const n of nodes.filter(n=>n.links.length===1)) {
      const near=sidewalk.filter(v=>Math.abs((v.y||.15)-n.y)<.4).sort((a,b)=>M.dist2(a.x,a.z,n.x,n.z)-M.dist2(b.x,b.z,n.x,n.z))[0];
      if(near&&M.dist(near.x,near.z,n.x,n.z)<50){near.links.push({to:n.walk,cross:true});n.walk.links.push({to:near,cross:true});}
    }
    // Join authored vehicle passages to road-centre segments without changing ambient lane traffic.
    driveGraph=nodes.slice();const road=new Map();for(const n of CITY.roadNodes){const q={x:n.x,z:n.z,y:0,links:[]};road.set(n,q);driveGraph.push(q);}
    for(const n of CITY.roadNodes)for(const e of n.out)link(road.get(n),road.get(e.to),6.5,'both');
    for(const n of nodes.filter(n=>n.links.length===1&&n.y<.5&&n.links[0].mode!=='foot')){let best=null;
      for(const e of CITY.roadEdges){const dx=e.to.x-e.from.x,dz=e.to.z-e.from.z,t=M.clamp(((n.x-e.from.x)*dx+(n.z-e.from.z)*dz)/(dx*dx+dz*dz),0,1),x=e.from.x+dx*t,z=e.from.z+dz*t,d=M.dist(x,z,n.x,n.z);if(!best||d<best.d)best={e,x,z,d};}
      if(best&&best.d<15){const q={x:best.x,z:best.z,y:0,links:[]};driveGraph.push(q);link(n,q,6.5,'both');link(q,road.get(best.e.from),6.5,'both');link(q,road.get(best.e.to),6.5,'both');}
    }
  }

  function navigation(from,to,width=0) {
    const graph=width?driveGraph.filter(n=>n.links.some(e=>e.mode!=='foot'&&e.width>=width)):walkGraph;
    const nearest=p=>graph.reduce((best,n)=>!best||Math.hypot(n.x-p.x,n.z-p.z,((n.y??.15)-(p.y??.15))*12)<Math.hypot(best.x-p.x,best.z-p.z,((best.y??.15)-(p.y??.15))*12)?n:best,null);
    const start=nearest(from),goal=nearest(to);if(!start||!goal||Math.max(M.dist(start.x,start.z,from.x,from.z),M.dist(goal.x,goal.z,to.x,to.z))>90)return [];
    const dist=new Map([[start,0]]),prev=new Map(),open=[start],done=new Set();
    while(open.length){open.sort((a,b)=>dist.get(a)-dist.get(b));const n=open.shift();if(n===goal)break;if(done.has(n))continue;done.add(n);for(const e of n.links){if(width&&(e.mode==='foot'||width>e.width))continue;const d=dist.get(n)+Math.hypot(n.x-e.to.x,n.z-e.to.z,(n.y??.15)-(e.to.y??.15));if(d<(dist.get(e.to)??Infinity)){dist.set(e.to,d);prev.set(e.to,n);open.push(e.to);}}}
    if(!dist.has(goal))return [];const out=[];for(let n=goal;n;n=prev.get(n)){out.unshift(n);if(n===start)break;}return out;
  }
  function breakObject(o,vehicle) {
    if(o.down||!o.destructible)return false;o.down=true;
    const x=(o.x0+o.x1)/2,z=(o.z0+o.z1)/2;W.FX.debris(x,.7,z,8,[.4,.28,.17]);W.noise(x,z,24,'crash');AUDIO.play('crash',x,z,.4);
    if(vehicle.driver===PLAYER)POLICE.crime('vandal',x,z,null);return true;
  }
  function entities() {
    const out=[];
    for(const o of objects)if(o.gate&&!o.down&&M.dist((o.x0+o.x1)/2,(o.z0+o.z1)/2,RENDER.cam.tx,RENDER.cam.tz)<120){
      if(!o.mesh){const b=new MESH.Builder(),w=o.x1-o.x0,d=o.z1-o.z0;for(let t=0;t<1;t+=.14)b.box(o.x0+(w>d?w*t:0),.15,o.z0+(d>w?d*t:0),w>d?w*.10:w,1.25,d>w?d*.10:d,C.rust);o.mesh=b.build();o.model=M.create();}
      out.push({mesh:o.mesh,model:o.model});
    }return out;
  }
  return {BLOCKS,objects,surfaces,paths,landmarks,nodes,has,ground,height,ceiling,raySurface,build,connect,navigation,breakObject,entities};
})();
