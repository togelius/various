// Authored ice-road checkpoint and abandoned recovery equipment, in metres.
// Static scenery is batched into one mesh; signs and exposed fittings carry the story.
'use strict';
const Roadside=(()=>{
  function front(b,x,y,z,w,h,tile){
    b.tile=tile;b.col=[1,1,1];
    const a=b.vert(x,y,z,0,0,-1,1,1),c=b.vert(x,y+h,z,0,0,-1,1,0),d=b.vert(x+w,y+h,z,0,0,-1,0,0),e=b.vert(x+w,y,z,0,0,-1,0,1);b.quad(a,c,d,e);
  }
  function drum(b,x,y,z){
    b.tile=MAT.STEEL;b.col=[.81,.53,.31];b.cyl(x,y,z,.28,.82,{segs:18});
    b.tile=MAT.DARK;b.col=[.75,.78,.72];for(const h of [.04,.25,.59,.80])b.cyl(x,y+h,z,.29,.025,{segs:18});
    b.tile=MAT.SNOW;b.col=[.90,.94,.94];b.cyl(x,y+.825,z,.265,.028,{segs:18});
  }
  function hut(b){
    b.tile=MAT.CONCRETE;b.col=[.56,.60,.57];b.roundedBox(-1.95,-.20,-1.7,3.9,.26,3.4,.09);
    // Corrugated shell with a real opening at the service counter.
    b.tile=MAT.BEIGE;b.col=[.67,.72,.66];b.box(-1.7,.08,1.38,3.4,2.6,.12);for(const x of [-1.7,1.58])b.box(x,.08,-1.5,.12,2.6,3);
    b.box(-1.7,.08,-1.5,3.4,1.03,.12);b.box(-1.7,2.27,-1.5,3.4,.40,.12);
    for(const x of [-1.7,1.39])b.box(x,1.10,-1.5,.31,1.18,.12);
    b.tile=MAT.FLAT;b.col=[.23,.36,.34];b.box(-1.72,.32,-1.52,3.44,.55,.025);for(const x of [-1.72,1.70])b.box(x,.32,-1.5,.025,.55,3);
    b.tile=MAT.BEIGE;b.col=[.60,.65,.59];for(let z=-1.35;z<1.4;z+=.15)for(const x of [-1.72,1.70])b.box(x,.95,z,.025,1.64,.025);
    // Snow-lipped steel roof, gutter and downpipe.
    b.tile=MAT.DARK;b.col=[.68,.72,.70];b.roundedBox(-1.95,2.65,-1.75,3.9,.18,3.5,.06);
    b.tile=MAT.SNOW;b.col=[.91,.95,.97];b.loft(0,2.80,0,[[0,2.02,1.83],[.10,1.96,1.76],[.22,1.74,1.60],[.25,.04,.04]],{segs:32});
    b.tile=MAT.STEEL;b.col=[.62,.67,.65];b.tube([[1.85,2.65,-1.72],[1.85,.18,-1.72],[2.12,.08,-1.72]],.045,{segs:8});
    b.tile=MAT.PLANK;b.col=[.63,.60,.49];b.box(-1.5,1.06,-1.72,3,.09,.57);b.box(-1.50,.05,-1.25,3,.07,2.5);
    // Window surround, glazing at one side, and a half-open blind.
    b.tile=MAT.FLAT;b.col=[.78,.82,.76];for(const x of [-1.42,1.35])b.box(x,1.15,-1.55,.07,1.1,.1);b.box(-1.42,2.21,-1.55,2.84,.06,.1);
    b.box(.31,1.15,-1.56,.045,1.1,.11);b.tile=MAT.WINDOW;b.col=[.58,.70,.71];b.box(.38,1.17,-1.52,.94,1.01,.018);
    b.tile=MAT.STEEL;b.col=[.7,.75,.68];for(let y=2.04;y<2.22;y+=.055)b.box(-1.34,y,-1.59,1.59,.03,.03);
    // Nobody at the desk: an analog radio, handset, mug and empty chair.
    b.tile=MAT.DARK;b.col=[.84,.92,.90];b.roundedBox(-1.06,1.18,-1.21,.59,.35,.35,.04);
    b.tile=MAT.STEEL;b.col=[.83,.83,.69];for(let i=0;i<6;i++)b.box(-1.01+i*.047,1.23,-1.227,.015,.17,.01);
    b.tile=MAT.GLASS;b.col=[.32,.47,.26];b.box(-.63,1.28,-1.231,.13,.075,.01);
    b.tile=MAT.DARK;b.col=[.9,.95,.9];b.cyl(-.55,1.20,-1.24,.032,.015,{axis:'z',segs:10});b.tube([[-.52,1.5,-1.0],[-.52,2.02,-1.0]],.007,{segs:4});
    b.tile=MAT.BEIGE;b.col=[.85,.85,.72];b.cyl(.02,1.15,-1.31,.07,.13,{segs:14});b.tile=MAT.DARK;b.col=[.6,.5,.3];b.cyl(.02,1.281,-1.31,.056,.002,{segs:14});
    b.tile=MAT.CLOTH;b.col=[.31,.42,.39];b.roundedBox(-.25,.62,.23,.52,.10,.55,.06);b.roundedBox(-.25,.72,.72,.52,.64,.09,.04);
    b.tile=MAT.DARK;b.col=[.75,.8,.76];for(const x of [-.22,.23])for(const z of [.28,.72])b.tube([[x,.05,z],[x,.64,z]],.024,{segs:6});
    front(b,-.41,1.1,1.35,.81,.8,MAT.NOTE);
    // Enamel service plate beneath the window.
    front(b,-.62,.34,-1.555,1.24,.47,MAT.BADGE);
    b.tile=MAT.DARK;b.col=[.6,.64,.62];b.tube([[1.05,2.45,-1.50],[1.05,2.57,-1.92]],.025,{segs:7});b.cyl(1.05,2.48,-1.92,.15,.09,{segs:16});
    b.tile=MAT.GLASS;b.col=[.95,.70,.38];b.sphere(1.05,2.46,-1.92,.068,{segs:10,rings:8});
  }
  function recovery(b){
    // A tracked towing cradle with a broken instrument pod lashed to it.
    b.tile=MAT.STEEL;b.col=[.56,.63,.61];
    for(const x of [-1.23,1.23])b.tube([[x,.10,-2.8],[x,.07,-2.2],[x,.07,2],[x,.35,2.8]],.13,{segs:10});
    b.tile=MAT.DARK;b.col=[.80,.91,.9];b.roundedBox(-1.4,.34,-2.35,2.8,.21,4.8,.09);
    for(const z of [-1.95,-.6,.65,1.95])b.box(-1.37,.11,z,2.74,.25,.09);
    b.tile=MAT.BEIGE;b.col=[.66,.69,.61];b.roundedBox(-1.1,.57,-1.60,2.2,1.68,3.25,.16);
    b.tile=MAT.FLAT;b.col=[.70,.28,.12];b.roundedBox(-1.115,1.24,-1.615,2.23,.28,3.28,.035);
    // Open engine compartment with pipes, ceramic insulators and a missing lid.
    b.tile=MAT.DARK;b.col=[.8,.85,.82];b.box(-.87,1.66,-1.633,1.74,.41,.045);
    b.tile=MAT.STEEL;b.col=[.76,.82,.74];for(let i=0;i<7;i++)b.box(-.79+i*.23,1.7,-1.66,.09,.29,.06);
    front(b,-.60,1.05,-1.646,1.20,.43,MAT.RECOVERY_PLATE);
    b.tile=MAT.DARK;b.col=[.72,.80,.75];b.box(-.85,2.21,-1.26,1.7,.06,2.6);
    b.tile=MAT.STEEL;b.col=[.8,.83,.73];for(const x of [-.52,.50]){b.cyl(x,2.24,.10,.25,.58,{segs:14});for(let y=2.32;y<2.82;y+=.1)b.cyl(x,y,.10,.30,.025,{segs:14});}
    b.tile=MAT.BEIGE;b.col=[.8,.75,.57];b.cyl(0,2.24,-.83,.20,.62,{segs:14});b.tile=MAT.STEEL;b.col=[.95,.89,.72];b.tube([[-.52,2.8,.1],[-.5,2.95,-.4],[0,2.87,-.83],[.5,2.76,.1]],.07,{segs:9});
    // A peeled lid leans at the rear, rather than a pristine closed cuboid.
    b.tile=MAT.BEIGE;b.col=[.75,.76,.64];b.tube([[-.98,2.20,1.42],[-1.13,2.70,1.93],[-1.03,2.97,2.26],[.95,2.93,2.25],[1.08,2.66,1.95],[.98,2.2,1.42]],.045,{segs:7});
    const a=b.vert(-.98,2.2,1.42,0,.7,-.7,0,1),c=b.vert(-1.03,2.97,2.26,0,.7,-.7,0,0),d=b.vert(.95,2.93,2.25,0,.7,-.7,1,0),e=b.vert(.98,2.2,1.42,0,.7,-.7,1,1);b.quad(a,c,d,e);b.quad(e,d,c,a);
    // Steel straps, grab handles, rusted attachment eyes and a tow winch.
    b.tile=MAT.DARK;b.col=[.6,.69,.67];for(const z of [-.95,.89]){for(const x of [-1.13,1.1])b.box(x,.53,z,.04,1.75,.085);}
    b.tile=MAT.STEEL;b.col=[.66,.69,.62];for(const x of [-1.4,1.4])for(const z of [-1.8,1.8])b.tube([[x,.51,z-.14],[x,.72,z-.14],[x,.72,z+.14],[x,.51,z+.14]],.035,{segs:7});
    b.tile=MAT.DARK;b.col=[.88,.91,.86];b.cyl(-.5,.91,-2.14,.27,1,{axis:'x',segs:18});b.tile=MAT.STEEL;b.col=[.65,.64,.51];for(const x of [-.56,.52])b.cyl(x,.91,-2.14,.34,.04,{axis:'x',segs:18});
    b.tile=MAT.SNOW;b.col=[.92,.95,.96];b.roundedBox(-1.30,.55,.87,.16,.08,1.23,.035);b.roundedBox(.82,2.23,-1.35,.25,.06,2.63,.028);
  }
  function build(place,collide,groundY,S){
    const b=new Builder(),ground=new Builder(),r=rng32(409);
    const hx=-7.8,hz=-11,hy=groundY(hx,hz);
    b.begin();hut(b);b.end(M.trs(M.create(),hx,hy,hz,0));collide(hx-1.75,hy-.2,hz-1.55,3.5,3.25,3.1);
    S.checkpointHut={x:hx,y:hy,z:hz};
    // Raised boom gate leaves a six-metre opening down the existing route.
    const by=groundY(-3.8,-8);b.tile=MAT.CONCRETE;b.col=[.62,.64,.58];b.roundedBox(-4.15,by-.12,-8.35,.7,.20,.7,.06);
    b.tile=MAT.STEEL;b.col=[.8,.77,.63];b.roundedBox(-4,by,-8.20,.40,1.17,.40,.06);
    for(let i=0;i<10;i++){b.tile=MAT.FLAT;b.col=i%2?[.64,.22,.12]:[.91,.87,.69];b.tube([[-3.8-i*.10,by+1.05+i*.37,-8],[-3.8-(i+1)*.10,by+1.05+(i+1)*.37,-8]],.078,{segs:4});}
    collide(-4.1,by,-8.3,.6,1.3,.6);
    // A battered directional sign faces the arriving walker.
    const sy=groundY(5.4,-7);b.tile=MAT.STEEL;b.col=[.73,.77,.72];for(const x of [4.55,6.25])b.cyl(x,sy-.1,-7,.065,3.05,{segs:10});
    b.tile=MAT.DARK;b.col=[.80,.86,.82];b.roundedBox(4.14,sy+1.22,-7.10,2.52,1.56,.12,.05);front(b,4.19,sy+1.27,-7.172,2.42,1.46,MAT.CROSSING_SIGN);
    b.tile=MAT.SNOW;b.col=[.95,.96,.97];b.roundedBox(4.11,sy+2.78,-7.12,2.58,.08,.18,.035);
    for(const x of [4.55,6.25])collide(x-.08,sy,-7.08,.16,3,.16);
    // Heavy timber rails and two sagging utility wires frame the entrance.
    for(const side of [-1,1])for(let i=0;i<4;i++){const x=side*(5.3+i*2.8),z=-3.7-i*.48,y=groundY(x,z);b.tile=MAT.PLANK;b.col=[.64,.61,.50];b.box(x-.07,y-.12,z-.07,.14,1.22,.14);if(i<3){const nx=side*(5.3+(i+1)*2.8),nz=z-.48,ny=groundY(nx,nz);for(const h of [.5,.96])b.tube([[x,y+h,z],[nx,ny+h,nz]],.045,{segs:4});}}
    const poles=[[-13,-25],[-12,-5]];
    for(const [x,z] of poles){const y=groundY(x,z);b.tile=MAT.PLANK;b.col=[.58,.54,.44];b.cyl(x,y-.3,z,.13,6.8,{segs:10,r1:.085});b.tile=MAT.STEEL;b.col=[.7,.73,.63];b.box(x-.8,y+5.90,z-.06,1.6,.09,.12);for(const side of [-.65,.65]){b.tile=MAT.BEIGE;b.col=[.8,.85,.75];b.cyl(x+side,y+5.97,z,.07,.18,{segs:8});}collide(x-.15,y,z-.15,.3,6.5,.3);}
    b.tile=MAT.DARK;b.col=[.75,.82,.82];for(const side of [-.65,.65]){const pts=[];for(let i=0;i<=12;i++){const t=i/12,x=lerp(-13,-12,t),z=lerp(-25,-5,t),y=lerp(groundY(-13,-25),groundY(-12,-5),t)+6.12-Math.sin(t*Math.PI)*.8;pts.push([x+side,y,z]);}b.tube(pts,.012,{segs:4});}
    for(const [x,z] of [[-10.5,-10],[-10.7,-9.3]]){drum(b,x,groundY(x,z),z);collide(x-.28,groundY(x,z),z-.28,.56,.9,.56);}
    // Snow banks and sunken vehicle ruts give the empty white slope some scale.
    b.tile=MAT.SNOW;b.col=[.96,.98,1];for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=side*(3.5+r()*.9),z=-25+i*5+r(),rx=.7+r()*.55,rz=2.4+r()*.6,base=b.count;
      b.loft(x,0,z,[[0,rx,rz],[.07,rx*.92,rz*.94],[.14,rx*.73,rz*.8],[.21,rx*.45,rz*.59],[.235,rx*.18,rz*.25],[.24,.01,.01]],{segs:28});
      for(let j=base;j<b.count;j++){const k=j*13;b.v[k+1]+=groundY(b.v[k],b.v[k+2])-.045;}
    }
    const stamp=(x,z,yaw,w,l,tile)=>{ground.tile=tile;ground.col=[1,1,1];const ids=[];for(const [u,v]of[[-1,-1],[-1,1],[1,1],[1,-1]]){const xx=x+Math.cos(yaw)*u*w+Math.sin(yaw)*v*l,zz=z-Math.sin(yaw)*u*w+Math.cos(yaw)*v*l;ids.push(ground.vert(xx,groundY(xx,zz)+.017,zz,0,1,0,u,v));}ground.quad(...ids);};
    for(let z=-57;z<-32.8;z+=.33)for(const x of [-.87,.87])stamp(x,z,.02,.14,.24,MAT.TRACK);
    for(let i=0;i<23;i++){const t=i/22;stamp(lerp(-.6,hx,t)+(i%2?.1:-.1),lerp(-26,hz-2,t),-.48,.068,.145,MAT.TRACK);}
    // Abandoned recovery sled, off the road after the first encounter.
    const rx=-8.2,rz=58,ry=groundY(rx,rz);b.begin();recovery(b);b.end(M.trs(M.create(),rx,ry,rz,-.22));collide(rx-1.85,ry,rz-2.65,3.7,3.1,5.3);S.recovery={x:rx,y:ry,z:rz};
    b.tile=MAT.DARK;b.col=[.8,.84,.77];const coil=[];for(let i=0;i<=80;i++){const t=i/80*TAU*3;coil.push([rx+2.7+Math.cos(t)*(.8-i*.003),.045,rz-1+Math.sin(t)*(.8-i*.003)]);}b.tube(coil,.035,{segs:6});
    // Broken tow cable and displaced ice slabs point toward the nearest hull.
    const cable=[];for(let i=0;i<=20;i++){const t=i/20;cable.push([lerp(rx,10,t),.04,lerp(rz-2.6,51,t)+Math.sin(t*8)*.55]);}b.tube(cable,.038,{segs:6});
    for(let i=0;i<13;i++){
      const x=rx-3+r()*7,z=rz-4+r()*9;if(Math.abs(x)<3)continue;b.tile=MAT.ICE;b.col=[.94,1,1];
      const top=.035+r()*.07,ring=[],center=b.vert(x,top,z,0,1,0,.5,.5),size=.26+r()*.4;
      for(let j=0;j<6;j++){const a=j*TAU/6,rad=size*(.75+r()*.5),xx=x+Math.sin(a)*rad,zz=z+Math.cos(a)*rad;ring.push(b.vert(xx,top,zz,0,1,0,xx,zz));}
      for(let j=0;j<6;j++){const a=ring[j],c=ring[(j+1)%6];b.i.push(center,a,c);const aa=a*13,cc=c*13,nx=(b.v[aa]+b.v[cc])/2-x,nz=(b.v[aa+2]+b.v[cc+2])/2-z,ll=Math.hypot(nx,nz),low=b.vert(b.v[aa],.012,b.v[aa+2],nx/ll,0,nz/ll,0,1),low2=b.vert(b.v[cc],.012,b.v[cc+2],nx/ll,0,nz/ll,1,1);b.quad(a,low,low2,c);}
    }
    // Project snow grain in world space; radial loft UVs made artificial rings.
    for(let i=0;i<b.count;i++){const k=i*13;if(b.v[k+11]===MAT.SNOW){b.v[k+9]=b.v[k]*.20;b.v[k+10]=b.v[k+2]*.20;}}
    place(b.build(),0,0,0);place(ground.build(),0,0,0,0,{alpha:1,noShadow:true});
    S.lamps.push({x:hx+1.05,y:hy+2.44,z:hz-1.95,r:4,col:[1,.66,.31],k:.30,name:'checkpoint'});
    const light=new Builder();light.tile=MAT.LED;light.col=[1,.25,.10];light.cyl(0,0,0,.12,.13,{segs:12});
    S.recoveryLight=place(light.build(),rx-.92,ry+2.30,rz-.85,0,{emis:1,noShadow:true});
    S.vantages.push({x:-3.7,z:54,key:'1:recovery',caption:'The recovery sled. The tow cable had been cut.'});
  }
  return {build};
})();
