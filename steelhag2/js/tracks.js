// Bounded, transient footprints and sled marks. One small dynamic draw call.
// Review/reset and chapter changes never leave a line connecting distant positions.
'use strict';
const Tracks=(()=>{
  const MAX=240, data=new Float32Array(MAX*4*13),indices=new Uint32Array(MAX*6);
  for(let i=0;i<MAX;i++){const v=i*4;indices.set([v,v+1,v+2,v,v+2,v+3],i*6);}
  let mesh=null,count=0,cursor=0,last=null,side=1;
  const item={model:null,mesh:null,noShadow:true,alpha:1};
  function stamp(x,z,yaw,width,length){
    const c=Math.cos(yaw),s=Math.sin(yaw),corners=[[-1,-1],[-1,1],[1,1],[1,-1]];
    for(let j=0;j<4;j++){const [u,v]=corners[j],xx=x+c*u*width+s*v*length,zz=z-s*u*width+c*v*length;
      data.set([xx,World.groundY(xx,zz)+.015,zz,0,1,0,1,1,1,u,v,MAT.TRACK,0],(cursor*4+j)*13);}
    cursor=(cursor+1)%MAX;count=Math.min(MAX,count+1);
  }
  function update(p){
    if(!last){last={x:p.x,z:p.z,sx:p.sled.x,sz:p.sled.z,foot:0};return;}
    const dist=Math.hypot(p.x-last.x,p.z-last.z);
    if(dist>5){last=null;return;}
    if(dist<.22)return;
    last.foot+=dist;
    if(last.foot>.64){last.foot=0;side=-side;stamp(p.x+Math.cos(p.yaw)*.11*side,p.z-Math.sin(p.yaw)*.11*side,p.yaw,.065,.145);}
    const sledDist=Math.hypot(p.sled.x-last.sx,p.sled.z-last.sz);
    if(sledDist>.20&&sledDist<3){const yaw=p.sled.yaw;for(const side of [-1,1])stamp(p.sled.x+Math.cos(yaw)*.26*side,p.sled.z-Math.sin(yaw)*.26*side,yaw,.022,.26);last.sx=p.sled.x;last.sz=p.sled.z;}
    last.x=p.x;last.z=p.z;
    if(!mesh){mesh=GL.mesh(data,indices,true);item.mesh=mesh;item.model=M.create();}
    GL.updateMesh(mesh,data);mesh.count=count*6;
  }
  function reset(){count=cursor=0;last=null;if(mesh)mesh.count=0;}
  return {update,reset,get item(){return count&&mesh?item:null;}};
})();
