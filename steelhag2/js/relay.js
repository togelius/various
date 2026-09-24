// An electromechanical field relay: breaker, moving ammeter and a visible cable surge.
'use strict';
const FieldRelay=(()=>{
  function build(place,collide,groundY,path,S){
    const x=14,z=176,y=groundY(x,z),b=new Builder();
    const face=(builder,tile,x,y,z,w,h)=>{builder.tile=tile;builder.col=[1,1,1];const a=builder.vert(x,y,z,0,0,-1,1,1),c=builder.vert(x+w,y,z,0,0,-1,0,1),d=builder.vert(x+w,y+h,z,0,0,-1,0,0),e=builder.vert(x,y+h,z,0,0,-1,1,0);builder.quad(a,e,d,c);};
    b.tile=MAT.CONCRETE;b.col=[.66,.64,.55];b.roundedBox(-.7,-.12,-.5,1.4,.35,1,.06);
    b.tile=MAT.DARK;b.col=[.60,.65,.61];for(const xx of [-.45,.37])b.box(xx,.15,-.23,.08,.17,.46);
    b.tile=MAT.BEIGE;b.col=[.62,.70,.65];b.roundedBox(-.53,.27,-.27,1.06,1.39,.53,.065);
    // A recessed front door, dark gasket, folded lip and snow on the top flange.
    b.tile=MAT.DARK;b.col=[.67,.69,.62];b.roundedBox(-.485,.34,-.304,.97,1.23,.035,.018);
    b.tile=MAT.BEIGE;b.col=[.72,.77,.68];b.roundedBox(-.459,.36,-.335,.918,1.19,.04,.018);
    b.tile=MAT.STEEL;b.col=[.60,.65,.62];b.box(-.59,1.64,-.34,1.18,.055,.66);
    b.tile=MAT.SNOW;b.col=[.91,.96,.96];b.roundedBox(-.57,1.688,-.32,1.14,.085,.62,.04);
    b.tile=MAT.DARK;b.col=[.6,.63,.58];for(const yy of [.46,1.32])b.roundedBox(-.53,yy,-.369,.07,.16,.055,.013);
    b.tile=MAT.STEEL;b.col=[.85,.83,.70];for(const xx of [-.412,.405])for(const yy of [.405,1.49])b.cyl(xx,yy,-.369,.018,.02,{axis:'z',segs:8});
    // Printed enamel control plate and a separate glass-fronted ammeter.
    face(b,MAT.RELAY_PLATE,-.39,.40,-.378,.78,1.08);
    b.tile=MAT.DARK;b.col=[.75,.77,.69];b.roundedBox(-.35,.91,-.404,.40,.34,.044,.03);
    face(b,MAT.RELAY_DIAL,-.325,.938,-.451,.35,.29);
    b.tile=MAT.STEEL;b.col=[.87,.85,.70];b.cyl(.25,1.095,-.408,.072,.065,{axis:'z',segs:20});
    // Two porcelain cable terminations, strapped conduit and an earth lead.
    b.tile=MAT.DARK;b.col=[.70,.72,.64];for(const xx of [-.24,.23])b.cyl(xx,.21,.12,.06,.10,{segs:10});
    for(const xx of [-.24,.23]){b.tile=MAT.FLAT;b.col=[.67,.57,.39];for(let i=0;i<4;i++)b.cyl(xx,.18+i*.037,.12,.081,.025,{segs:14});}
    b.tile=MAT.DARK;b.col=[.72,.79,.74];b.tube([[.23,.20,.12],[.58,.12,.29],[.69,.07,.63]],.055,{segs:8});
    b.tile=MAT.CABLE;b.col=[.64,.66,.53];b.tube([[-.24,.19,.12],[-.48,.08,.35],[-.67,.06,.24],[-.58,.10,-.31]],.018,{segs:7});
    b.tile=MAT.STEEL;b.col=[.68,.65,.52];for(const xx of [-.57,.57])for(const zz of [-.37,.35]){b.cyl(xx,.23,zz,.032,.037,{segs:6});}
    place(b.build(),x,y,z);collide(x-.55,y,z-.36,1.1,1.8,.65);
    const leverB=new Builder();leverB.tile=MAT.STEEL;leverB.col=[.87,.84,.68];leverB.cyl(0,0,0,.026,.25,{segs:10});leverB.tile=MAT.DARK;leverB.col=[.68,.41,.24];leverB.roundedBox(-.065,.18,-.046,.13,.16,.092,.028);
    const lever=place(leverB.build(),x+.25,y+1.095,z-.485,0,{radius:.4});
    const needleB=new Builder();needleB.tile=MAT.FLAT;needleB.col=[.39,.16,.08];needleB.tube([[0,0,0],[0,.12,0]],.0045,{segs:5});needleB.cyl(0,0,-.004,.012,.008,{axis:'z',segs:10});
    const needle=place(needleB.build(),x-.15,y+.976,z-.459,0,{noShadow:true,radius:.2});
    function lamp(xx,col){const lb=new Builder();lb.tile=MAT.COLD_LIGHT;lb.col=col;lb.sphere(0,0,0,.026,{segs:14,rings:10});return place(lb.build(),x+xx,y+.736,z-.409,0,{noShadow:true,emis:.08,radius:.1});}
    const amber=lamp(-.20,[1,.47,.13]),green=lamp(.18,[.33,.91,.70]);
    // The familiar cyan strip remains the interaction's location and navigation reference.
    const statusB=new Builder();statusB.tile=MAT.COLD_LIGHT;statusB.col=[.3,.65,.72];statusB.box(-.34,1.525,-.378,.68,.026,.012);
    S.relay=place(statusB.build(),x,y,z,0,{emis:.35,noShadow:true,radius:1});
    // One skinned mesh, up to 32 sections. No particles or new geometry while playing.
    const pulseB=new Builder(),fx=new Float32Array(RENDER.MAX_BONES*4),n=Math.min(path.length-1,RENDER.MAX_BONES);
    pulseB.tile=MAT.COLD_LIGHT;pulseB.col=[.20,.72,1];for(let i=0;i<n;i++){pulseB.bone=i;pulseB.tube([path[i],path[i+1]],.086,{segs:7});}
    const pulse=place(pulseB.build(),0,0,0,0,{fx,noShadow:true,emis:1.3});pulse.hidden=true;
    const relay={lever,needle,amber,green,pulse,light:null,progress:0,
      sync(on,remaining,reduced=false){
        const elapsed=3.2-remaining,progress=on?(remaining>0?smooth(0,.38,elapsed):1):0;
        this.progress=progress;
        M.trsEuler(lever.model,x+.25,y+1.095,z-.485,0,lerp(-.78,-2.35,progress),0);
        const settle=on&&remaining>0&&!reduced?Math.sin(elapsed*10)*Math.exp(-elapsed*3)*.13:0;
        M.trsEuler(needle.model,x-.15,y+.976,z-.459,0,0,lerp(-.95,.48,progress)+settle);
        amber.emis=on?.025:.8;green.emis=on?.8:.025;
        const active=on&&remaining>0&&elapsed>.40&&elapsed<2.9&&!reduced;this.light=null;pulse.hidden=!active;
        for(let i=0;i<n;i++)fx[i*4+1]=1;
        if(active){const front=(elapsed-.40)/2.5*n;for(let i=0;i<n;i++)if(i<=front&&i>front-3)fx[i*4+1]=0;const i=Math.min(n-1,Math.floor(front)),f=front-i;this.light=path[i].map((v,k)=>lerp(v,path[i+1][k],f));}
      }
    };
    relay.sync(false,0);S.fieldRelay=relay;return relay;
  }
  return {build};
})();
