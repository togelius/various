// Ice displaced by the rising transformer hulls. Presentation follows hull progress,
// so reset, checkpoint restore and photographs share exactly the same state.
'use strict';
const IceBreak=(()=>{
  const PIECES=12,DUST=44;
  function ribbon(b,pts,width,col,y){
    b.tile=MAT.FLAT;b.col=col;
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],c=pts[i+1],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz)||1,nx=dz/len*width,nz=-dx/len*width;
      const v=[b.vert(a[0]-nx,y,a[1]-nz,0,1,0,0,0),b.vert(a[0]+nx,y,a[1]+nz,0,1,0,1,0),b.vert(c[0]+nx,y,c[1]+nz,0,1,0,1,1),b.vert(c[0]-nx,y,c[1]-nz,0,1,0,0,1)];b.quad(v[0],v[3],v[2],v[1]);
    }
  }
  function plate(b,size,r){
    const ring=[];for(let j=0;j<6;j++){const a=j*TAU/6,rad=size*(.7+r()*.35);ring.push([Math.sin(a)*rad,Math.cos(a)*rad]);}
    b.tile=MAT.ICE;b.col=[.93,.98,1];
    const top=b.vert(0,.07,0,0,1,0,0,0),topRing=ring.map(([x,z])=>b.vert(x,.07,z,0,1,0,x*.3,z*.3));
    for(let j=0;j<6;j++)b.i.push(top,topRing[j],topRing[(j+1)%6]);
    b.tile=MAT.FLAT;b.col=[.38,.52,.59];const bottom=b.vert(0,-.07,0,0,-1,0,0,0),low=ring.map(([x,z])=>b.vert(x,-.07,z,0,-1,0,x,z));
    for(let j=0;j<6;j++)b.i.push(bottom,low[(j+1)%6],low[j]);
    b.col=[.54,.70,.77];for(let j=0;j<6;j++){const [x,z]=ring[j],[xx,zz]=ring[(j+1)%6],nx=x+xx,nz=z+zz,len=Math.hypot(nx,nz)||1;
      const a=b.vert(x,.07,z,nx/len,0,nz/len,0,0),c=b.vert(x,-.07,z,nx/len,0,nz/len,0,1),d=b.vert(xx,-.07,zz,nx/len,0,nz/len,1,1),e=b.vert(xx,.07,zz,nx/len,0,nz/len,1,0);b.quad(a,c,d,e);
    }
  }
  function create(hulls){
    const fields=hulls.map((h,index)=>{
      const r=rng32(820+index*59),cracks=new Builder(),slabs=new Builder(),chunks=[],dust=[];
      // An uneven pressure perimeter and branching leads, not a perfect shock ring.
      const perimeter=[];
      for(let j=0;j<=28;j++){const a=(j%28)*TAU/28,rr=h.h*(.26+(j%4)*.011);perimeter.push([Math.sin(a)*rr,Math.cos(a)*rr*.70]);}
      ribbon(cracks,perimeter,.13,[.16,.27,.32],.018);ribbon(cracks,perimeter,.035,[.83,.94,.98],.022);
      for(let j=0;j<11;j++){
        const a=j*TAU/11+(r()-.5)*.24,pts=[];
        for(let k=0;k<5;k++){const rr=h.h*(.18+k*(.047+r()*.012)),aa=a+(r()-.5)*.15;pts.push([Math.sin(aa)*rr,Math.cos(aa)*rr*.82]);}
        ribbon(cracks,pts,.08+r()*.035,[.17,.31,.37],.024);
        const start=pts[2],aa=a+(j%2?1:-1)*.45,rr=h.h*.39;
        ribbon(cracks,[start,[(start[0]+Math.sin(aa)*rr)/2,(start[1]+Math.cos(aa)*rr*.82)/2],[Math.sin(aa)*rr,Math.cos(aa)*rr*.82]],.035,[.45,.65,.74],.026);
      }
      for(let j=0;j<PIECES;j++){
        const a=j*TAU/PIECES+(r()-.5)*.17,size=h.h*(.029+r()*.024);
        chunks.push({a,size,delay:.12+r()*.15,push:.8+r()*1.4,height:.6+r()*1.2,twist:(r()-.5)*.7});
        slabs.bone=j;plate(slabs,size,r);
      }
      for(let j=0;j<DUST;j++)dust.push({a:r()*TAU,delay:.12+r()*.34,rad:h.h*(.22+r()*.1),speed:1.5+r()*3.5,lift:1+r()*3.4,size:1.1+r()*2.2});
      const bones=new Float32Array(RENDER.MAX_BONES*16);for(let j=0;j<RENDER.MAX_BONES;j++)M.identity(bones.subarray(j*16,j*16+16));
      return {h,chunks,dust,crack:{mesh:cracks.build(),model:M.create(),noShadow:true,alpha:0,hidden:true},slab:{mesh:slabs.build(),model:M.create(),bones,noShadow:true,hidden:true}};
    });
    const items=fields.flatMap(f=>[f.crack,f.slab]),particles={data:new Float32Array(fields.length*DUST*5),n:0,col:[.45,.60,.66],maxSize:60,soft:true};
    function sync(reduced=false){
      particles.n=0;
      for(const f of fields){
        const {h}=f,p=clamp(h.rise||0,0,1),growth=smooth(.015,.32,p),show=p>.015;
        f.crack.hidden=!show;f.slab.hidden=p<.12;f.crack.alpha=growth*.82;
        M.trs(f.crack.model,h.x,0,h.z,0,lerp(.35,1,growth),1,lerp(.35,1,growth));
        for(let j=0;j<f.chunks.length;j++){
          const c=f.chunks[j],t=clamp((p-c.delay)/.65,0,1),travel=smooth(0,1,t),arc=Math.sin(Math.PI*t),radius=h.h*.245+travel*(h.h*.075+c.push);
          const y=t<=0?-.5:reduced?lerp(-.15,.13,travel):.13+arc*c.height;
          M.trsEuler(f.slab.bones.subarray(j*16,j*16+16),h.x+Math.sin(c.a)*radius,y,h.z+Math.cos(c.a)*radius*.72,c.a+c.twist*travel,reduced?0:arc*.43, reduced?0:arc*c.twist);
        }
        // Short, bounded sheets of powder emerge from the same cracks. No repeated
        // emission and no idle animation once the plate has settled.
        if(!reduced&&p<1)for(const d of f.dust){
          const t=(p-d.delay)/.41;if(t<=0||t>=1)continue;
          const radius=d.rad+d.speed*t,alpha=Math.sin(t*Math.PI)*.19;
          particles.data.set([h.x+Math.sin(d.a)*radius,.12+Math.sin(t*Math.PI)*d.lift,h.z+Math.cos(d.a)*radius*.72,d.size*(.6+t),alpha],particles.n++*5);
        }
      }
      return items;
    }
    sync();return {items,particles,sync};
  }
  return {create};
})();
