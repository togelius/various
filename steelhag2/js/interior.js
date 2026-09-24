// The old house: a compact authored interior with a kitchen, radio and bedroom.
'use strict';
const Interior=(()=>{
  const X=800,Z=800,items=[],lamps=[],spots={entry:[X+5,Z+2.3],exit:[X+5,Z+.65],radio:[X+1.6,Z+8.35],note:[X+5.4,Z+5.6],bed:[X+9.5,Z+7.1]};
  const contains=(x,z)=>x>X-2&&x<X+14&&z>Z-2&&z<Z+12;
  const collide=(x,z,w,d,h=2.8)=>World.S.colliders.push({x0:X+x,y0:0,z0:Z+z,x1:X+x+w,y1:h,z1:Z+z+d});
  let redLight;
  function build(){
    const b=new Builder();
    const box=(x,y,z,w,h,d)=>b.box(x,y,z,w,h,d);
    b.tile=MAT.PLANK;b.col=[.94,.88,.74];box(0,-.16,0,12,.16,10);
    b.tile=MAT.FLAT;b.col=[.62,.65,.53];box(-.2,0,-.2,12.4,3.2,.2);box(-.2,0,10,12.4,3.2,.2);box(-.2,0,0,.2,3.2,10);box(12,0,0,.2,3.2,10);
    collide(-.2,-.2,12.4,.2);collide(-.2,10,12.4,.2);collide(-.2,0,.2,10);collide(12,0,.2,10);
    b.col=[.67,.66,.57];box(-.2,3.2,-.2,12.4,.2,10.4);
    World.S.colliders.push({x0:X-.2,y0:3.2,z0:Z-.2,x1:X+12.2,y1:3.4,z1:Z+10.2});
    // Painted tongue-and-groove panels below the pale plaster.
    b.tile=MAT.PLANK;b.col=[.72,.73,.61];for(let x=0;x<12;x+=.2){box(x,0,.008,.19,1.03,.023);box(x,0,9.97,.19,1.03,.023);}for(let z=0;z<10;z+=.2){box(.008,0,z,.023,1.03,.19);box(11.97,0,z,.023,1.03,.19);}
    b.tile=MAT.FLAT;b.col=[.43,.47,.38];box(0,.97,0,12,.055,.05);box(0,.97,9.95,12,.055,.05);box(0,.97,0,.05,.055,10);box(11.95,.97,0,.05,.055,10);
    b.tile=MAT.PLANK;b.col=[.43,.34,.24];for(const x of [0,3.7,7.5,11.8])box(x,3.03,0,.14,.18,10);
    // Bedroom partition, with a clear doorway through the middle.
    b.tile=MAT.FLAT;b.col=[.53,.58,.50];box(7.7,0,4,.16,3.2,2.0);box(7.7,0,7.4,.16,3.2,2.6);box(7.7,2.35,6,.16,.85,1.4);box(7.7,0,4,4.3,3.2,.14);
    collide(7.7,4,.16,2);collide(7.7,7.4,.16,2.6);collide(7.7,4,4.3,.14);
    b.tile=MAT.PLANK;b.col=[.72,.70,.57];for(const z of [5.94,7.4])box(7.63,0,z,.26,2.4,.07);box(7.63,2.33,5.94,.26,.07,1.53);
    // The shut front door and its coat hooks.
    b.tile=MAT.PLANK;b.col=[.39,.43,.36];box(4.45,0,.01,1.1,2.23,.08);b.col=[.65,.64,.52];for(const x of [4.35,5.56])box(x,0,.07,.09,2.33,.1);box(4.35,2.25,.07,1.3,.08,.1);
    b.tile=MAT.STEEL;b.col=[.82,.71,.46];b.roundedBox(5.31,.99,.10,.13,.025,.06,.01);
    b.tile=MAT.PLANK;b.col=[.52,.45,.34];box(6.2,1.64,.03,1.15,.13,.08);b.tile=MAT.DARK;b.col=[.55,.57,.49];for(const x of [6.4,6.78,7.16])b.tube([[x,1.69,.1],[x,1.57,.2],[x,1.65,.23]],.018,{segs:6});
    // The small coat belongs to the person the narrator used to be.
    b.tile=MAT.CLOTH;b.col=[.58,.29,.15];b.loft(6.78,.80,.21,[[0,.22,.07],[.12,.22,.08],[.50,.18,.085],[.63,.14,.07]],{segs:16});
    for(const side of [-1,1])b.tube([[6.78+side*.15,1.36,.21],[6.78+side*.29,1.17,.23],[6.78+side*.26,.90,.25]],.067,{segs:9});
    b.sphere(6.78,1.49,.21,.12,{segs:16,rings:12});b.tile=MAT.DARK;b.col=[.5,.4,.25];b.cyl(6.78,1.49,.32,.08,.012,{axis:'z',segs:16});
    // Two deep windows: blue winter light against the room's tungsten lamps.
    for(const x of [2.45,9.45]){
      b.tile=MAT.COLD_LIGHT;b.col=[.23,.29,.36];box(x,1.1,9.955,1.7,1.35,.025);
      // Tree silhouettes sit behind the glazing bars, outside the warm room.
      b.tile=MAT.WINDOW_TREE;b.col=[.74,.81,.84];
      for(const [xx,ww,hh]of [[x+.1,.53,.96],[x+.68,.64,1.22],[x+1.23,.41,.78]]){const y=1.11,z=9.932,a=b.vert(xx,y,z,0,0,-1,0,1),c=b.vert(xx+ww,y,z,0,0,-1,1,1),d=b.vert(xx+ww,y+hh,z,0,0,-1,1,0),e=b.vert(xx,y+hh,z,0,0,-1,0,0);b.quad(a,e,d,c);}
      b.tile=MAT.FLAT;b.col=[.70,.70,.59];for(const xx of [x-.07,x+.82,x+1.7])box(xx,1.02,9.90,.07,1.5,.10);box(x-.07,1.73,9.90,1.84,.06,.1);box(x-.07,2.43,9.88,1.84,.08,.12);box(x-.17,1.01,9.73,2.03,.09,.30);
      b.tile=MAT.CLOTH;b.col=[.65,.62,.47];for(const xx of [x-.27,x+1.68])for(let i=0;i<4;i++)b.roundedBox(xx+i*.065,1.0,9.72,.08,1.63,.08,.025);
      lamps.push({x:X+x+.85,y:1.8,z:Z+9.65,r:4,col:[.18,.30,.48],k:.8});
    }
    // Galley kitchen, enamel cooker, sink, cupboards and crockery.
    b.tile=MAT.PLANK;b.col=[.50,.54,.43];box(.12,0,2.2,.72,.91,3.6);collide(.12,2.2,.72,3.6,1);
    b.tile=MAT.FLAT;b.col=[.68,.64,.53];box(.10,.91,2.15,.78,.055,3.7);
    b.tile=MAT.STEEL;b.col=[.85,.85,.76];box(.13,.961,2.5,.61,.015,.75);b.tile=MAT.DARK;b.col=[.72,.75,.70];box(.20,.978,2.56,.46,.012,.6);
    b.tile=MAT.STEEL;b.col=[.92,.92,.84];b.tube([[.21,.97,3.32],[.21,1.26,3.32],[.37,1.26,3.32],[.41,1.16,3.32]],.024,{segs:10});
    b.tile=MAT.FLAT;b.col=[.72,.73,.65];box(.14,1.58,2.2,.40,.86,3.6);for(let z=2.35;z<5.8;z+=.7){b.col=[.45,.49,.40];box(.545,1.69,z,.02,.03,.12);}
    b.tile=MAT.DARK;b.col=[.7,.73,.67];box(.12,.97,4.15,.7,.025,.85);for(const z of [4.35,4.73])for(const x of [.3,.63])b.cyl(x,1.0,z,.11,.012,{segs:16});
    b.tile=MAT.STEEL;b.col=[.68,.63,.45];b.cyl(.47,1.02,4.37,.11,.17,{segs:18});b.tube([[.37,1.17,4.37],[.37,1.32,4.37],[.57,1.32,4.37],[.57,1.17,4.37]],.016,{segs:8});
    // Worn rug and kitchen table. Furniture has real, simple collision volumes.
    b.tile=MAT.CLOTH;b.col=[.32,.35,.31];box(3.6,.006,3.8,3.8,.013,3.0);b.col=[.60,.52,.38];box(3.72,.022,3.94,3.56,.009,.07);box(3.72,.022,6.58,3.56,.009,.07);
    b.tile=MAT.PLANK;b.col=[.75,.62,.44];b.roundedBox(4.35,.76,4.52,1.95,.10,1.03,.045);for(const x of [4.45,6.13])for(const z of [4.62,5.39])box(x,0,z,.10,.78,.10);collide(4.35,4.52,1.95,1.03,.85);
    function chair(x,z,yaw){b.begin();b.tile=MAT.PLANK;b.col=[.66,.53,.37];b.roundedBox(-.23,.43,-.23,.46,.06,.46,.02);for(const xx of [-.20,.16])for(const zz of [-.20,.16])box(xx,0,zz,.04,.47,.04);for(const xx of [-.21,.17])box(xx,.47,.17,.04,.55,.04);for(const y of [.64,.89])box(-.20,y,.17,.41,.07,.04);b.end(M.trs(M.create(),x,0,z,yaw));collide(x-.27,z-.27,.54,.54,1);}
    chair(5.2,3.97,Math.PI);chair(6.85,5.02,Math.PI/2);chair(4.5,6.07,0);
    // An open notebook, a cup and the old torch on the table.
    b.tile=MAT.PLANK;b.col=[.22,.28,.23];box(5.05,.87,4.73,.49,.028,.40);b.tile=MAT.NOTE;b.col=[1,1,1];box(5.065,.90,4.745,.46,.008,.37,{uv:1});
    b.tile=MAT.FLAT;b.col=[.72,.72,.60];b.cyl(5.85,.87,4.83,.075,.14,{segs:16});b.tile=MAT.DARK;b.col=[.5,.55,.5];b.cyl(5.85,1.01,4.83,.061,.007,{segs:16});
    // The radio occupies its own pool of light by the northern wall.
    b.tile=MAT.PLANK;b.col=[.47,.39,.28];b.roundedBox(.55,0,8.9,1.8,.86,.75,.025);collide(.55,8.9,1.8,.75,1);
    b.col=[.39,.27,.16];b.roundedBox(.85,.86,9.07,1.13,.47,.31,.035);
    b.tile=MAT.CLOTH;b.col=[.40,.39,.31];box(.91,.93,9.05,.55,.3,.023);b.tile=MAT.DARK;b.col=[.50,.49,.40];for(let x=.94;x<1.45;x+=.032)box(x,.96,9.027,.009,.23,.016);
    b.tile=MAT.GLASS;b.col=[.67,.68,.43];box(1.52,1.16,9.036,.37,.095,.016);b.tile=MAT.DARK;b.col=[.8,.82,.72];for(const x of [1.59,1.82])b.cyl(x,1.02,9.016,.045,.04,{axis:'z',segs:14});
    b.tile=MAT.STEEL;b.col=[.8,.8,.72];b.tube([[1.13,1.3,9.23],[1.25,1.85,9.24]],.009,{segs:6});
    // A small wall clock. Its stopped hands read 18:40.
    b.tile=MAT.PLANK;b.col=[.42,.30,.18];b.cyl(5.9,2.3,9.88,.25,.08,{axis:'z',segs:32});b.tile=MAT.FLAT;b.col=[.76,.74,.60];b.cyl(5.9,2.3,9.86,.21,.025,{axis:'z',segs:32});b.tile=MAT.DARK;b.col=[1,1,1];b.tube([[5.9,2.3,9.849],[5.75,2.22,9.849]],.009,{segs:5});b.tube([[5.9,2.3,9.849],[5.88,2.19,9.849]],.014,{segs:6});
    // The old bedroom: a faded blanket, pillow, shoes and a bedside lamp.
    b.tile=MAT.PLANK;b.col=[.46,.37,.27];b.roundedBox(9.3,.17,7.65,1.5,.29,2.0,.04);box(9.25,0,9.55,1.6,.95,.08);collide(9.25,7.6,1.6,2.03,.9);
    b.tile=MAT.CLOTH;b.col=[.52,.58,.55];b.roundedBox(9.30,.45,7.66,1.50,.20,1.85,.09);b.col=[.75,.74,.65];b.roundedBox(9.44,.65,9.03,1.2,.15,.40,.10);b.col=[.31,.40,.39];b.roundedBox(9.27,.62,7.63,1.55,.04,1.12,.018);
    b.tile=MAT.PLANK;b.col=[.55,.45,.31];box(8.20,0,8.95,.64,.59,.64);collide(8.2,8.95,.64,.64,.6);
    b.tile=MAT.STEEL;b.col=[.59,.47,.29];b.cyl(8.52,.60,9.28,.14,.025,{segs:16});b.cyl(8.52,.62,9.28,.023,.28,{segs:12});b.tile=MAT.CLOTH;b.col=[.89,.73,.46];b.loft(8.52,.91,9.28,[[0,.24,.24],[.31,.13,.13]],{segs:24});
    lamps.push({x:X+8.52,y:1.1,z:Z+9.28,r:4,col:[1.7,.82,.34],k:1});
    // Low pendant over the kitchen table.
    b.tile=MAT.DARK;b.col=[.33,.34,.29];b.cyl(5.35,2.64,5.0,.018,.56,{segs:8});b.loft(5.35,2.42,5,[[0,.31,.31],[.23,.09,.09]],{segs:24});b.tile=MAT.GLASS;b.col=[.9,.82,.59];b.sphere(5.35,2.40,5,.075,{segs:12,rings:8});
    lamps.push({x:X+5.35,y:2.30,z:Z+5,r:7,col:[1.40,.81,.39],k:1});
    World.S.vantages.push({x:X+5,z:Z+3,key:'2:kitchen',caption:'The room was warmer than I remembered. There was a light beyond the window.'});
    items.push({mesh:b.build(),model:M.trs(M.create(),X,0,Z,0),x:X+6,y:1.6,z:Z+5,radius:9,noShadow:true});
    const eye=new Builder();eye.tile=MAT.LED;eye.col=[1,.20,.08];eye.sphere(0,0,0,.018,{segs:8,rings:6});redLight={mesh:eye.build(),model:M.trs(M.create(),X+3.5,1.64,Z+9.85,0),x:X+3.5,y:1.64,z:Z+9.85,radius:.1,hidden:true,noShadow:true,emis:2};items.push(redLight);
  }
  function nearby(x,z){let best=null,d=1.45;for(const [id,p] of Object.entries(spots)){if(id==='entry')continue;const dist=Math.hypot(p[0]-x,p[1]-z);if(dist<d){d=dist;best=id;}}return best;}
  function light(answered){for(const l of lamps)RENDER.light(l.x,l.y,l.z,l.r,...l.col);redLight.hidden=!answered;RENDER.contact(X+5.35,0,Z+5,1.2);}
  return {build,contains,items,spots,nearby,light};
})();
