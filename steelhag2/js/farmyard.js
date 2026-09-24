// Sjögården's domestic scale: an open garden, winter wood store and things left out.
// Original authored meshes, batched into one static item and one ground decal item.
'use strict';
const Farmyard=(()=>{
  function front(b,x,y,z,w,h,tile){
    b.tile=tile;b.col=[1,1,1];const a=b.vert(x,y,z,0,0,-1,1,1),c=b.vert(x,y+h,z,0,0,-1,1,0),d=b.vert(x+w,y+h,z,0,0,-1,0,0),e=b.vert(x+w,y,z,0,0,-1,0,1);b.quad(a,c,d,e);
  }
  function fence(b,collide,groundY,ax,az,bx,bz){
    const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),n=Math.ceil(len/.31),yaw=Math.atan2(-dz,dx);
    for(let i=0;i<=n;i++){
      const t=i/n,x=lerp(ax,bx,t),z=lerp(az,bz,t),y=groundY(x,z),h=.87+Math.sin(i*6.4)*.065,post=i===0||i===n||i%8===0;
      b.begin();b.tile=MAT.PLANK;b.col=[.97,.99,.91];b.box(-.07,-.12,-.038,.14,post?1.25:h,.076);
      // Remnants of chalk paint leave the ends and small splits exposed.
      b.tile=MAT.FLAT;b.col=[.57,.61,.55];b.box(-.061,.17,-.040,.122,(post?1.07:h)-.22,.008);
      b.tile=MAT.SNOW;b.col=[.95,.98,1];b.box(-.08,(post?1.13:h-.12),-.055,.16,.055,.11);
      b.end(M.trs(M.create(),x,y,z,yaw));
    }
    b.tile=MAT.PLANK;b.col=[.80,.83,.72];for(const h of [.26,.69])b.tube([[ax,groundY(ax,az)+h,az+.06],[bx,groundY(bx,bz)+h,bz+.06]],.033,{segs:4});
    collide(Math.min(ax,bx)-.09,Math.min(groundY(ax,az),groundY(bx,bz))-.2,Math.min(az,bz)-.09,Math.abs(dx)+.18,1.35,Math.abs(dz)+.18);
  }
  function woodstore(b){
    b.tile=MAT.PLANK;b.col=[.80,.87,.91];
    for(const x of [-1.47,1.42])for(const z of [-.62,.62])b.box(x,0,z,.095,z<0?2.18:1.95,.095);
    for(const y of [.3,.8,1.3,1.75])b.box(-1.45,y,.64,2.96,.12,.06);
    for(const x of [-1.45,1.43])for(const y of [.30,.9,1.5])b.box(x,y,-.58,.06,.11,1.22);
    b.box(-1.5,.12,-.65,3,.08,1.4);
    // A sloping corrugated roof with a thick, uneven snow lip.
    for(const snow of [false,true]){b.tile=snow?MAT.SNOW:MAT.ROOF;b.col=snow?[.96,.98,1]:[.56,.62,.61];
      const lift=snow?.10:0,a=b.vert(-1.66,2.22+lift,-.8,0,.98,.16,0,0),c=b.vert(-1.66,1.99+lift,.85,0,.98,.16,0,1),d=b.vert(1.66,1.99+lift,.85,0,.98,.16,2,1),e=b.vert(1.66,2.22+lift,-.8,0,.98,.16,2,0);b.quad(a,c,d,e);if(!snow)b.quad(e,d,c,a);
    }
    b.tile=MAT.SNOW;b.col=[.92,.96,1];b.box(-1.66,2.22,-.82,3.32,.10,.09);
    const r=rng32(711);
    for(let row=0;row<5;row++)for(let j=0;j<10-row;j++){
      const x=-1.23+j*.263+row*.115,y=.33+row*.23,rad=.12+r()*.017,z=-.54-r()*.11;
      b.tile=MAT.PLANK;b.col=[.56+r()*.17,.51+r()*.10,.36+r()*.07];b.cyl(x,y,z,rad,.92+r()*.12,{axis:'z',segs:9});
      b.tile=MAT.LOG_END;b.col=[.87,.90,.90];const mid=b.vert(x,y,z-.004,0,0,-1,.5,.5),ids=[];
      for(let k=0;k<9;k++){const a=k/9*TAU;ids.push(b.vert(x+Math.cos(a)*rad,y+Math.sin(a)*rad,z-.004,0,0,-1,.5+Math.cos(a)*.5,.5+Math.sin(a)*.5));}
      for(let k=0;k<9;k++)b.i.push(mid,ids[(k+1)%9],ids[k]);
    }
  }
  function sled(b){
    b.tile=MAT.STEEL;b.col=[.74,.36,.19];for(const x of [-.27,.27])b.tube([[x,.12,.72],[x,.1,-.59],[x,.18,-.83],[x,.32,-.9]],.029,{segs:7});
    for(const z of [-.47,.48]){b.tube([[-.27,.1,z],[-.22,.35,z],[.22,.35,z],[.27,.1,z]],.022,{segs:6});}
    b.tile=MAT.PLANK;b.col=[.88,.77,.52];for(let j=0;j<5;j++)b.box(-.25+j*.105,.34,-.67,.086,.035,1.32);
    b.tile=MAT.DARK;b.col=[.67,.64,.51];b.tube([[-.25,.31,-.82],[-.4,.08,-1.1],[-.08,.025,-1.66],[.33,.02,-1.93],[.65,.024,-1.78]],.012,{segs:4});
    b.tile=MAT.SNOW;b.col=[.96,.97,1];b.loft(.05,.37,.17,[[0,.24,.4],[.035,.21,.34],[.065,.12,.20],[.08,.01,.01]],{segs:18});
  }
  function bicycle(b){
    for(const x of [-.61,.65]){
      const ring=[];for(let i=0;i<=32;i++){const a=i/32*TAU;ring.push([x+Math.cos(a)*.345,.38+Math.sin(a)*.345,0]);}
      b.tile=MAT.DARK;b.col=[.62,.68,.66];b.tube(ring,.027,{segs:6});b.tile=MAT.STEEL;b.col=[.77,.8,.75];
      for(let i=0;i<12;i++){const a=i/12*TAU;b.tube([[x,.38,0],[x+Math.cos(a)*.318,.38+Math.sin(a)*.318,0]],.004,{segs:3});}
    }
    b.tile=MAT.FLAT;b.col=[.20,.34,.31];
    const hub=[-.05,.35,0],seat=[-.22,.92,0],head=[.45,.94,0];
    b.tube([[-.61,.38,0],seat,hub,[-.61,.38,0]],.024,{segs:8});b.tube([seat,head,hub],.028,{segs:8});b.tube([[.65,.38,0],head,[.43,1.13,0],[.53,1.19,-.20],[.37,1.17,-.25]],.02,{segs:8});
    b.tile=MAT.DARK;b.col=[.66,.64,.57];b.roundedBox(-.38,.94,-.09,.30,.075,.18,.034);
    b.tile=MAT.STEEL;b.col=[.56,.60,.56];b.cyl(-.05,.35,-.08,.075,.16,{axis:'z',segs:12});b.tube([[-.05,.35,-.10],[.03,.23,-.10],[.03,.23,-.22]],.014,{segs:6});
    b.tube([[-.88,.78,0],[-.45,.78,0]],.023,{segs:7});for(const x of [-.87,-.5])b.tube([[x,.78,0],[-.61,.38,0]],.01,{segs:4});
  }
  function branch(b,pts,startRadius,endRadius){
    // Catmull-Rom centreline and taper remove the straight, blunt pipe silhouette.
    const curve=[];
    for(let j=0;j<pts.length-1;j++)for(let k=0;k<5;k++){
      const t=k/5,p=pts[Math.max(0,j-1)],q=pts[j],r=pts[j+1],s=pts[Math.min(pts.length-1,j+2)];
      curve.push(q.map((v,i)=>.5*((2*v)+(-p[i]+r[i])*t+(2*p[i]-5*v+4*r[i]-s[i])*t*t+(-p[i]+3*v-3*r[i]+s[i])*t*t*t)));
    }curve.push(pts[pts.length-1]);
    for(let j=1;j<curve.length;j++)b.tube([curve[j-1],curve[j]],lerp(startRadius,endRadius,j/(curve.length-1)),{segs:6});
  }
  function apple(b,r){
    b.tile=MAT.PLANK;b.col=[.77,.78,.69];branch(b,[[0,-.15,0],[.09,.9,.02],[-.08,1.55,.03],[.04,2.30,.10],[-.13,2.94,.12]],.13,.014);
    for(const [a,h,len]of[[-.9,1.13,1.50],[.4,1.44,1.19],[1.8,1.22,1.70],[3.0,1.72,1.23],[4.5,1.48,1.42]]){
      const dx=Math.sin(a),dz=Math.cos(a),pts=[[0,h,0],[dx*.40,h+.23,dz*.38],[dx*len*.72,h+.46,dz*len*.70],[dx*len,h+.92,dz*len]];
      branch(b,pts,.062,.006);
      for(let j=1;j<4;j++){const q=pts[j],side=j%2?1:-1,lift=.36+r()*.23;branch(b,[q,[q[0]+dx*.13+dz*.17*side,q[1]+lift*.6,q[2]+dz*.10-dx*.18*side],[q[0]+dx*.27+dz*.30*side,q[1]+lift,q[2]+dz*.22-dx*.3*side]],.018,.0025);}
      b.tile=MAT.SNOW;b.col=[.85,.90,.95];branch(b,pts.slice(1,3).map(p=>[p[0],p[1]+.040,p[2]]),.028,.010);b.tile=MAT.PLANK;b.col=[.77,.78,.69];
    }
  }
  function build(place,collide,groundY,S){
    const b=new Builder(),ground=new Builder(),r=rng32(625);
    // Generous central opening preserves the packed approach and route to the relay.
    fence(b,collide,groundY,-10,152,-3.4,152);fence(b,collide,groundY,3.4,152,11,152);fence(b,collide,groundY,-10,152,-10,166);
    // A gate left wide open, parallel to the path rather than blocking it.
    fence(b,collide,groundY,3.4,152,3.4,154.15);
    b.tile=MAT.DARK;b.col=[.63,.70,.65];const gy=groundY(3.4,152);for(const y of [.28,.74])b.cyl(3.4,gy+y,152,.06,.15,{segs:10});b.box(3.30,gy+.67,154.05,.19,.035,.16);
    // Frosted green postbox and enamel address at the gate.
    const my=groundY(-3.4,152);b.tile=MAT.FLAT;b.col=[.24,.37,.31];b.roundedBox(-3.73,my+.76,151.66,.64,.46,.36,.065);b.col=[.34,.44,.35];b.roundedBox(-3.78,my+1.18,151.61,.74,.07,.43,.028);
    b.tile=MAT.DARK;b.col=[.6,.65,.59];b.box(-3.65,my+1.09,151.639,.47,.024,.02);front(b,-3.64,my+.84,151.635,.44,.19,MAT.YARD_PLATE);
    b.tile=MAT.SNOW;b.col=[.93,.97,1];b.roundedBox(-3.77,my+1.25,151.63,.71,.055,.37,.026);
    const at=(x,z,yaw,fn,pitch=0,roll=0)=>{b.begin();fn(b);b.end(M.trsEuler(M.create(),x,groundY(x,z),z,yaw,pitch,roll));};
    at(-7.65,164.25,0,woodstore);collide(-9.35,groundY(-7.65,164.25),163.43,3.4,2.4,1.72);S.woodstore={x:-7.65,z:164.25};
    at(6.7,153.7,.4,sled);collide(6.15,groundY(6.7,153.7),153.0,1.1,.48,1.5);
    at(-9.65,160,Math.PI/2,bicycle,0,.13);collide(-10,groundY(-9.65,160),158.9,.70,1.3,2.2);
    at(-7.3,156.5,0,b=>apple(b,r));collide(-7.5,groundY(-7.3,156.5),156.3,.4,2.8,.4);
    // Chopping block, split kindling, and an axe left head-down in the wood.
    const sx=-7.2,sz=161.5,sy=groundY(sx,sz);b.tile=MAT.PLANK;b.col=[.62,.60,.47];b.cyl(sx,sy-.05,sz,.33,.48,{segs:13,r1:.29});
    b.tile=MAT.STEEL;b.col=[.55,.61,.58];b.box(sx-.12,sy+.39,sz-.05,.23,.13,.07);b.tile=MAT.PLANK;b.col=[.8,.74,.51];b.tube([[sx,sy+.48,sz],[sx+.18,sy+1.05,sz+.10]],.022,{segs:7});
    for(let i=0;i<6;i++){b.begin();b.box(-.045,0,-.18,.09,.065,.4+r()*.2);b.end(M.trs(M.create(),sx+.6+r()*.35,sy+.025,sz-.4+r()*.8,r()*TAU));}
    // Lean gardening tools and an empty cold frame beside the barn's southern wall.
    at(17.6,161.4,.3,b=>{b.tile=MAT.PLANK;b.col=[.63,.61,.45];b.tube([[0,.04,0],[.15,1.58,.24]],.022,{segs:7});b.tile=MAT.STEEL;b.col=[.6,.66,.65];b.roundedBox(-.15,.04,-.03,.3,.30,.05,.03);b.tube([[.1,1.59,.24],[.07,1.73,.26],[.23,1.75,.27],[.25,1.60,.25]],.014,{segs:6});});
    const cy=groundY(25,161);b.tile=MAT.PLANK;b.col=[.65,.64,.53];for(const x of [23.4,26.5])b.box(x,cy,160.3,.10,.40,1.4);for(const z of [160.3,161.6])b.box(23.4,cy,z,3.2,.40,.10);
    b.tile=MAT.SNOW;b.col=[.92,.97,1];b.box(23.53,cy+.18,160.43,2.92,.15,1.06);collide(23.4,cy,160.3,3.2,.48,1.4);
    // Old footprints disappear at the lit kitchen window; trampled snow grounds the yard.
    ground.tile=MAT.TRACK;ground.col=[.78,.84,.86];
    for(let i=0;i<17;i++){const t=i/16,x=lerp(-2.7,-5.15,t)+(i%2?.10:-.10),z=lerp(153.0,160.4,t),yaw=-.32,ids=[];
      for(const [u,v]of[[-1,-1],[-1,1],[1,1],[1,-1]]){const xx=x+Math.cos(yaw)*u*.071+Math.sin(yaw)*v*.14,zz=z-Math.sin(yaw)*u*.071+Math.cos(yaw)*v*.14;ids.push(ground.vert(xx,groundY(xx,zz)+.017,zz,0,1,0,u,v));}ground.quad(...ids);
    }
    for(let i=0;i<b.count;i++){const k=i*13;if(b.v[k+11]===MAT.SNOW){b.v[k+9]=b.v[k]*.20;b.v[k+10]=b.v[k+2]*.20;}}
    S.farmyard=place(b.build(),0,0,0);place(ground.build(),0,0,0,0,{noShadow:true,alpha:1});
  }
  return {build};
})();
