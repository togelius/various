// Authored, four-weight skinned character. Offline asset; no fetch or runtime dependency.
// CPU skinning keeps the scene's small rigid-machine shader and its 32-bone budget intact.
'use strict';
class Character {
  constructor() {
    const d=CHARACTER_ASSET;
    const unpack=(s,Type=Float32Array)=>{const bin=atob(s),b=new Uint8Array(bin.length);for(let i=0;i<b.length;i++)b[i]=bin.charCodeAt(i);return new Type(b.buffer);};
    this.nodes=d.nodes.map(n=>({name:n.name,t:(n.translation||[0,0,0]).slice(),q:(n.rotation||[0,0,0,1]).slice(),s:(n.scale||[1,1,1]).slice(),parent:-1,local:M.create(),world:M.create()}));
    d.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>this.nodes[j].parent=i));
    this.parts=d.parts.map(p=>({...p,p:unpack(p.p),n:unpack(p.n),j:unpack(p.j,Uint16Array),w:unpack(p.w),i:unpack(p.i,Uint32Array),ibm:unpack(p.ibm),skin:p.joints.map(()=>M.create())}));
    this.clips={};for(const [name,c] of Object.entries(d.clips))this.clips[name]={duration:c.duration,tracks:c.tracks.map(t=>({...t,t:unpack(t.t),v:unpack(t.v)}))};
    let nv=0;const indices=[];for(const p of this.parts){p.offset=nv;for(const i of p.i)indices.push(i+nv);nv+=p.p.length/3;}
    this.vertices=new Float32Array(nv*13);
    for(const p of this.parts)for(let i=0;i<p.p.length/3;i++){const k=(p.offset+i)*13;this.vertices.set(p.col,k+6);this.vertices[k+9]=p.p[i*3]*250;this.vertices[k+10]=p.p[i*3+2]*250;this.vertices[k+11]=MAT[p.tile];}
    this.mesh=GL.mesh(this.vertices,new Uint32Array(indices),true);
    this.item={mesh:this.mesh,model:M.create(),radius:1.4,x:0,y:1,z:0};
    this.items=[this.item];this.hand=[0,1,0];this.torchWorld=[0,1.7,0,0,0,1];
    this.phase=0;this.clock=0;this.blend=1;this.clip='Idle_Neutral';this.oldPose=null;
    this.headIndex=this.nodes.findIndex(n=>n.name==='Head');this.handIndex=this.nodes.findIndex(n=>n.name==='Wrist.R');this.chestIndex=this.nodes.findIndex(n=>n.name==='Chest');
    // Small field pack and headlamp are equipment attached to the imported skeleton.
    const pack=new Builder();pack.tile=MAT.CLOTH;pack.col=[.25,.28,.22];pack.roundedBox(-.16,-.18,-.31,.32,.40,.18,.035);pack.col=[.12,.15,.12];
    for(const x of [-.1,.1])pack.roundedBox(x-.012,-.15,-.325,.024,.32,.016,.003);
    pack.col=[.67,.66,.56];pack.roundedBox(-.07,-.07,-.33,.14,.055,.012,.004);
    this.pack={mesh:pack.build(),model:M.create(),radius:1};this.items.push(this.pack);
    const lamp=new Builder();lamp.tile=MAT.DARK;lamp.col=[.14,.16,.15];lamp.roundedBox(-.05,.09,.10,.10,.065,.055,.01);lamp.tile=MAT.GLASS;lamp.col=[.80,.76,.59];lamp.roundedBox(-.027,.107,.151,.054,.027,.008,.004);
    this.lamp={mesh:lamp.build(),model:M.create(),radius:1};this.items.push(this.lamp);
    this.pose(0,0,0,0,0,0);
  }
  // TRS uses glTF quaternion ordering x,y,z,w.
  matrix(out,t,q,s){
    const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
    out.set([(1-yy-zz)*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-xx-zz)*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-xx-yy)*s[2],0,...t,1]);
  }
  sample(track,t,out){
    const ts=track.t,v=track.v,n=out.length;let lo=0,hi=ts.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(ts[mid]<=t)lo=mid;else hi=mid;}
    const a=lo,b=ts.length===1?lo:hi,f=ts[b]===ts[a]?0:clamp((t-ts[a])/(ts[b]-ts[a]),0,1);let sign=1;
    if(n===4){let dot=0;for(let k=0;k<4;k++)dot+=v[a*n+k]*v[b*n+k];if(dot<0)sign=-1;}
    for(let k=0;k<n;k++)out[k]=lerp(v[a*n+k],v[b*n+k]*sign,f);
    if(n===4){const len=Math.hypot(...out)||1;for(let k=0;k<4;k++)out[k]/=len;}
  }
  pose(x,y,z,yaw,run,dt,reach=0,carried=0,torchOn=false,aim=false){
    const speed=run*1.4;this.clock+=dt;
    const name=carried?'Death':aim?'Idle_Gun_Pointing':reach>.5?'Interact':speed>3.6?'Run':speed>.12?'Walk':'Idle_Neutral';
    if(name!==this.clip){this.oldPose=this.nodes.map(n=>({t:n.t.slice(),q:n.q.slice(),s:n.s.slice()}));this.clip=name;this.blend=0;this.phase=0;}
    this.blend=Math.min(1,this.blend+dt/0.18);
    const clip=this.clips[name];const rate=name==='Walk'?Math.max(.25,speed/1.65):name==='Run'?Math.max(.4,speed/4.2):1;
    this.phase+=dt*rate;const tm=(name==='Interact'||name==='Death')?Math.min(this.phase,clip.duration-.001):this.phase%clip.duration;
    for(let i=0;i<this.nodes.length;i++){const n=this.nodes[i],src=CHARACTER_ASSET.nodes[i];n.t.splice(0,3,...(src.translation||[0,0,0]));n.q.splice(0,4,...(src.rotation||[0,0,0,1]));n.s.splice(0,3,...(src.scale||[1,1,1]));}
    for(const tr of clip.tracks)this.sample(tr,tm,this.nodes[tr.node][{translation:'t',rotation:'q',scale:'s'}[tr.path]]);
    if(this.oldPose&&this.blend<1)for(let i=0;i<this.nodes.length;i++){
      const n=this.nodes[i],p=this.oldPose[i],f=smooth(0,1,this.blend);let dot=n.q.reduce((a,v,k)=>a+v*p.q[k],0),sg=dot<0?-1:1;
      for(let k=0;k<3;k++){n.t[k]=lerp(p.t[k],n.t[k],f);n.s[k]=lerp(p.s[k],n.s[k],f);}for(let k=0;k<4;k++)n.q[k]=lerp(p.q[k],n.q[k]*sg,f);const len=Math.hypot(...n.q);for(let k=0;k<4;k++)n.q[k]/=len;
    }
    // The authored animations are in place; world movement belongs solely to Player.
    for(const n of this.nodes){this.matrix(n.local,n.t,n.q,n.s);if(n.parent<0)n.world.set(n.local);else M.multiply(n.world,this.nodes[n.parent].world,n.local);}
    for(const p of this.parts){
      p.joints.forEach((j,i)=>M.multiply(p.skin[i],this.nodes[j].world,p.ibm.subarray(i*16,i*16+16)));
      for(let i=0;i<p.p.length/3;i++){
        let px=0,py=0,pz=0,nx=0,ny=0,nz=0;const v=i*3,j=i*4;
        for(let k=0;k<4;k++){const w=p.w[j+k];if(w<.00001)continue;const a=p.skin[p.j[j+k]],x=p.p[v],y=p.p[v+1],z=p.p[v+2],u=p.n[v],vv=p.n[v+1],wz=p.n[v+2];
          px+=(a[0]*x+a[4]*y+a[8]*z+a[12])*w;py+=(a[1]*x+a[5]*y+a[9]*z+a[13])*w;pz+=(a[2]*x+a[6]*y+a[10]*z+a[14])*w;
          nx+=(a[0]*u+a[4]*vv+a[8]*wz)*w;ny+=(a[1]*u+a[5]*vv+a[9]*wz)*w;nz+=(a[2]*u+a[6]*vv+a[10]*wz)*w;
        }
        const dst=(p.offset+i)*13,len=Math.hypot(nx,ny,nz)||1;this.vertices[dst]=px;this.vertices[dst+1]=py;this.vertices[dst+2]=pz;this.vertices[dst+3]=nx/len;this.vertices[dst+4]=ny/len;this.vertices[dst+5]=nz/len;
      }
    }
    GL.updateMesh(this.mesh,this.vertices);M.trs(this.item.model,x,y+.015,z,yaw,.94,.94,.94);this.item.x=x;this.item.y=y+1;this.item.z=z;
    const worldPoint=i=>{const n=this.nodes[i].world,a=this.item.model;return [a[0]*n[12]+a[8]*n[14]+x,n[13]*.94+y+.015,a[2]*n[12]+a[10]*n[14]+z];};
    this.hand=worldPoint(this.handIndex);this.head=worldPoint(this.headIndex);const c=worldPoint(this.chestIndex);
    M.trs(this.pack.model,c[0],c[1]-.08,c[2],yaw);M.trs(this.lamp.model,...this.head,yaw);
    for(const item of [this.pack,this.lamp]){item.x=x;item.y=y+1;item.z=z;}
    this.lamp.emis=torchOn?1:.02;this.torchWorld=[this.head[0]+Math.sin(yaw)*.16,this.head[1]+.12,this.head[2]+Math.cos(yaw)*.16,Math.sin(yaw),-.12,Math.cos(yaw)];
  }
}
