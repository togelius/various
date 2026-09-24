// A short batch development, followed by deliberate inspection of each exposure.
'use strict';
const Darkroom=(()=>{
  const DURATION=2.4;
  function open(photos){const list=photos.slice(),pending=list.filter(p=>!p.developed),i=Math.max(0,list.findIndex(p=>!p.developed));return {list,pending,i,t:pending.length?0:DURATION,ready:!pending.length,compare:false};}
  function advance(d,dt,skip=false){if(d.ready)return [];d.t=Math.min(DURATION,skip?DURATION:d.t+dt);if(d.t<DURATION)return [];d.ready=true;return d.pending;}
  function move(d,dir){d.i=Math.max(0,Math.min(d.list.length-1,d.i+dir));d.compare=false;}
  function reveal(d){return d.ready?1:Math.max(0,Math.min(1,(d.t-.25)/(DURATION-.25)));}
  return {open,advance,move,reveal,DURATION};
})();
