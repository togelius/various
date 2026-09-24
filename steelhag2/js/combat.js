// Reticle-based assisted aiming, shared by the cutter and its HUD.
'use strict';
const Combat=(()=>{
  function view(cam){
    let fx=cam.tx-cam.x,fy=cam.ty-cam.y,fz=cam.tz-cam.z;const l=Math.hypot(fx,fy,fz)||1;fx/=l;fy/=l;fz/=l;
    const h=Math.hypot(fx,fz)||1,rx=-fz/h,rz=fx/h;
    return {f:[fx,fy,fz],r:[rx,0,rz],u:[-fy*fx/h,h,-fy*fz/h]};
  }
  function project(point,cam,aspect=1){
    const b=view(cam),d=[point[0]-cam.x,point[1]-cam.y,point[2]-cam.z],dot=a=>a.reduce((s,v,i)=>s+v*d[i],0),depth=dot(b.f),t=Math.tan(cam.fov/2);
    if(depth<=.05)return null;return {x:dot(b.r)/(depth*t*aspect),y:dot(b.u)/(depth*t),depth};
  }
  function targets(machines,player,cam,aspect,occluded){
    const out=[];
    for(const m of machines){if(m.kind!=='bearer'||m.off||m.dark)continue;
      for(const j of m.joints()){
        if(j[0]>=RIG.ARM||j[0]<RIG.LEG&&j[0]!==RIG.BODY||j[0]===RIG.BODY&&m.legsLeft()>2)continue;
        const p=j.slice(1,4),distance=Math.hypot(p[0]-player.x,p[1]-player.y-1.2,p[2]-player.z);
        if(distance>8||occluded(player.x,player.y+1.2,player.z,...p))continue;
        const screen=project(p,cam,aspect);if(!screen||Math.abs(screen.x)>.94||Math.abs(screen.y)>.85)continue;
        // Score in screen-height units so wide displays do not widen aim assistance.
        const radius=Math.hypot(screen.x*aspect,screen.y);
        out.push({m,j,screen,distance,score:radius+distance*.001});
      }
    }
    out.sort((a,b)=>a.score-b.score);return out;
  }
  function select(candidates){return candidates.find(t=>t.score<.58)||null;}
  function missEnd(hand,cam,range=8){const f=view(cam).f,point=[cam.x+f[0]*12,cam.y+f[1]*12,cam.z+f[2]*12],d=point.map((v,i)=>v-hand[i]),l=Math.hypot(...d)||1;return hand.map((v,i)=>v+d[i]/l*range);}
  return {project,targets,select,missEnd};
})();
