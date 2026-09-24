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
    for(const p of this.parts)for(let i=0;i<p.p.length/3;i++){const k=(p.offset+i)*13;const wear=p.tile==='CLOTH'?.94+.06*Math.sin(p.p[i*3+2]*1800+p.p[i*3]*450):1;this.vertices.set(p.col.map(c=>c*wear),k+6);this.vertices[k+9]=p.p[i*3]*250;this.vertices[k+10]=p.p[i*3+2]*250;this.vertices[k+11]=MAT[p.tile];}
    this.mesh=GL.mesh(this.vertices,new Uint32Array(indices),true);
    this.item={mesh:this.mesh,model:M.create(),radius:1.4,x:0,y:1,z:0};
    this.items=[this.item];this.hand=[0,1,0];this.torchWorld=[0,1.7,0,0,0,1];
    this.phase=0;this.movePhase=0;this.clock=0;this.blend=1;this.clip='Idle_Neutral';this.oldPose=null;
    this.headIndex=this.nodes.findIndex(n=>n.name==='Head');this.handIndex=this.nodes.findIndex(n=>n.name==='Wrist.R');this.chestIndex=this.nodes.findIndex(n=>n.name==='Chest');this.footIndices=['Foot.L','Foot.R'].map(name=>this.nodes.findIndex(n=>n.name===name));
    // Small field pack and headlamp are equipment attached to the imported skeleton.
    const pack=new Builder();pack.tile=MAT.CLOTH;pack.col=[.43,.46,.37];
    pack.roundedBox(-.155,-.19,-.30,.31,.40,.16,.065);
    pack.col=[.35,.38,.31];pack.roundedBox(-.148,-.11,-.341,.296,.18,.065,.025);
    pack.col=[.51,.51,.40];pack.roundedBox(-.16,.12,-.305,.32,.10,.16,.04);
    // Webbing, leather tabs, a stitched front pocket and a folded rain cover.
    pack.col=[.22,.25,.20];for(const x of [-.105,.08])pack.roundedBox(x,-.15,-.359,.025,.35,.022,.007);
    for(const side of [-1,1]){
      pack.col=[.37,.40,.33];pack.roundedBox(side<0?-.21:.15,-.12,-.275,.07,.22,.12,.025);
      pack.col=[.27,.28,.23];pack.tube([[side*.12,.14,-.20],[side*.135,.27,-.06],[side*.14,.22,.10],[side*.13,-.10,.13],[side*.12,-.17,-.10]],.022,{segs:7});
    }
    pack.tile=MAT.STEEL;pack.col=[.86,.83,.65];for(const x of [-.11,.075])pack.roundedBox(x,-.06,-.37,.035,.045,.013,.004);
    pack.tile=MAT.CLOTH;pack.col=[.72,.66,.47];pack.roundedBox(-.085,.02,-.355,.17,.055,.014,.004);
    pack.tile=MAT.DARK;pack.col=[.62,.64,.59];pack.tube([[-.04,.23,-.19],[-.04,.27,-.19],[.04,.27,-.19],[.04,.23,-.19]],.011,{segs:6});
    pack.tile=MAT.DARK;pack.col=[.48,.53,.49];pack.roundedBox(-.035,-.155,-.385,.07,.165,.027,.01);
    this.pack={mesh:pack.build(),model:M.create(),radius:1};this.items.push(this.pack);
    const gauge=new Builder();this.gaugeRanges=[];
    for(let i=0;i<3;i++){const first=gauge.count;gauge.tile=MAT.COLD_LIGHT;gauge.col=[.42,.78,.70];gauge.box(-.020,-.139+i*.046,-.400,.04,.025,.012);this.gaugeRanges.push([first,gauge.count]);}
    this.gaugeData=new Float32Array(gauge.v);this.gauge={mesh:GL.mesh(this.gaugeData,new Uint32Array(gauge.i),true),model:this.pack.model,radius:1,noShadow:true,emis:.55};this.items.push(this.gauge);this.condition=-1;
    const lamp=new Builder();lamp.tile=MAT.CLOTH;lamp.col=[.65,.53,.32];
    lamp.loft(0,.09,-.015,[[0,.115,.135],[.045,.12,.138],[.11,.112,.13],[.16,.065,.08],[.177,.005,.006]],{segs:24});
    lamp.col=[.49,.40,.25];lamp.loft(0,.09,-.015,[[0,.12,.14],[.046,.122,.141]],{segs:24});
    lamp.tile=MAT.DARK;lamp.col=[.38,.39,.33];lamp.roundedBox(-.05,.115,.125,.10,.058,.05,.013);
    lamp.tile=MAT.GLASS;lamp.col=[.80,.76,.59];lamp.roundedBox(-.027,.13,.171,.054,.027,.009,.006);
    this.lamp={mesh:lamp.build(),model:M.create(),radius:1};this.items.push(this.lamp);
    const tool=new Builder();tool.tile=MAT.DARK;tool.col=[.16,.18,.17];tool.roundedBox(-.055,-.03,-.06,.11,.10,.30,.015);tool.tile=MAT.BEIGE;tool.col=[.67,.52,.28];tool.roundedBox(-.065,.04,.015,.13,.09,.22,.015);tool.tile=MAT.COLD_LIGHT;tool.col=[.3,.83,1];for(const x of [-.05,.05])tool.box(x-.012,.055,.23,.024,.025,.10);this.tool={mesh:tool.build(),model:M.create(),radius:1};
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
  pose(x,y,z,yaw,run,dt,reach=0,carried=0,torchOn=false,aim=false,velocity=null,feedback={}){
    const speed=run*1.4;this.clock+=dt;
    const name=carried?'Death':aim?'Idle_Gun_Pointing':reach>.5?'Interact':speed>3.6?'Run':speed>.12?'Walk':'Idle_Neutral';
    if(name!==this.clip){this.oldPose=this.nodes.map(n=>({t:n.t.slice(),q:n.q.slice(),s:n.s.slice()}));this.clip=name;this.blend=0;this.phase=0;}
    this.blend=Math.min(1,this.blend+dt/0.18);
    const clip=this.clips[name];const rate=name==='Walk'?Math.max(.25,speed/1.65):name==='Run'?Math.max(.4,speed/4.2):1;
    // Keep the hand extended until the player releases the interaction.
    this.phase+=dt*rate;const tm=name==='Interact'?Math.min(this.phase,clip.duration*.52):name==='Death'?Math.min(this.phase,clip.duration-.001):this.phase%clip.duration;
    for(let i=0;i<this.nodes.length;i++){const n=this.nodes[i],src=CHARACTER_ASSET.nodes[i];n.t.splice(0,3,...(src.translation||[0,0,0]));n.q.splice(0,4,...(src.rotation||[0,0,0,1]));n.s.splice(0,3,...(src.scale||[1,1,1]));}
    for(const tr of clip.tracks)this.sample(tr,tm,this.nodes[tr.node][{translation:'t',rotation:'q',scale:'s'}[tr.path]]);
    // Keep the authored aiming upper body while the lower body continues to walk.
    if(aim&&speed>.12){const walk=speed>3.6?this.clips.Run:this.clips.Walk;const backward=velocity&&velocity[0]*Math.sin(yaw)+velocity[1]*Math.cos(yaw)<-.15;this.movePhase+=dt*Math.max(.25,speed/(speed>3.6?4.2:1.65))*(backward?-1:1);for(const tr of walk.tracks)if(/^(UpperLeg|LowerLeg|Foot|PT)\./.test(this.nodes[tr.node].name))this.sample(tr,(this.movePhase%walk.duration+walk.duration)%walk.duration,this.nodes[tr.node][{translation:'t',rotation:'q',scale:'s'}[tr.path]]);}
    if(this.oldPose&&this.blend<1)for(let i=0;i<this.nodes.length;i++){
      const n=this.nodes[i],p=this.oldPose[i],f=smooth(0,1,this.blend);let dot=n.q.reduce((a,v,k)=>a+v*p.q[k],0),sg=dot<0?-1:1;
      for(let k=0;k<3;k++){n.t[k]=lerp(p.t[k],n.t[k],f);n.s[k]=lerp(p.s[k],n.s[k],f);}for(let k=0;k<4;k++)n.q[k]=lerp(p.q[k],n.q[k]*sg,f);const len=Math.hypot(...n.q);for(let k=0;k<4;k++)n.q[k]/=len;
    }
    // Small upper-body reactions leave authored footwork and locomotion untouched.
    const recoil=clamp(feedback.recoil||0,0,1),hit=clamp(feedback.hit||0,0,1),pitch=aim?clamp(feedback.aimPitch||0,-.5,.6):0;
    const rotateX=(index,angle)=>{const q=this.nodes[index].q,[x,y,z,w]=q,s=Math.sin(angle*.5),c=Math.cos(angle*.5);q[0]=x*c+w*s;q[1]=y*c+z*s;q[2]=z*c-y*s;q[3]=w*c-x*s;};
    rotateX(this.chestIndex,pitch*.72+hit*.26-recoil*.12);rotateX(this.headIndex,hit*.12-pitch*.20);
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
    this.feet=this.footIndices.map(worldPoint);this.hand=worldPoint(this.handIndex);M.trsEuler(this.tool.model,this.hand[0]-Math.sin(yaw)*recoil*.035,this.hand[1]+recoil*.018,this.hand[2]-Math.cos(yaw)*recoil*.035,yaw,pitch-recoil*.14,0);this.tool.x=x;this.tool.y=y+1;this.tool.z=z;this.head=worldPoint(this.headIndex);const c=worldPoint(this.chestIndex);
    // Attach orientation as well as position; the pack and cap follow torso/head motion.
    const attach=(item,index,point,offsetY=0)=>{const n=this.nodes[index].world,a=item.model,cy=Math.cos(yaw),sy=Math.sin(yaw);M.identity(a);for(let col=0;col<3;col++){const k=col*4,len=Math.hypot(n[k],n[k+1],n[k+2])||1;a[k]=(cy*n[k]+sy*n[k+2])/len;a[k+1]=n[k+1]/len;a[k+2]=(-sy*n[k]+cy*n[k+2])/len;}a[12]=point[0]+a[4]*offsetY;a[13]=point[1]+a[5]*offsetY;a[14]=point[2]+a[6]*offsetY;};
    attach(this.pack,this.chestIndex,c,-.08);attach(this.lamp,this.headIndex,this.head);
    this.gauge.x=x;this.gauge.y=y+1;this.gauge.z=z;
    const condition=clamp(Math.round(feedback.condition===undefined?3:feedback.condition),0,3);
    if(condition!==this.condition){this.condition=condition;const col=condition===3?[.42,.78,.70]:condition===2?[.96,.61,.25]:[1,.25,.10];for(let i=0;i<3;i++)for(let v=this.gaugeRanges[i][0];v<this.gaugeRanges[i][1];v++){this.gaugeData.set(i<condition?col:[.24,.29,.28],v*13+6);this.gaugeData[v*13+11]=i<condition?MAT.COLD_LIGHT:MAT.DARK;}GL.updateMesh(this.gauge.mesh,this.gaugeData);}
    for(const item of [this.pack,this.lamp]){item.x=x;item.y=y+1;item.z=z;}
    this.lamp.emis=torchOn?1:.02;this.torchWorld=[this.head[0]+Math.sin(yaw)*.16,this.head[1]+.12,this.head[2]+Math.cos(yaw)*.16,Math.sin(yaw),-.12,Math.cos(yaw)];
  }
}
