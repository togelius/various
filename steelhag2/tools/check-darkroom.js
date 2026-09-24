const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const ctx=vm.createContext({console,Math,URLSearchParams,location:{search:'?review'},localStorage:{getItem:()=>null,setItem:()=>{}}});
for(const name of ['store','darkroom'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
vm.runInContext(`
const photos=Array.from({length:12},(_,i)=>({key:'frame'+i,developed:i===0}));
const d=Darkroom.open(photos),assert=(v,m)=>{if(!v)throw Error(m);};
assert(d.list.length===12&&d.i===1,'all exposures must be inspectable, with first undeveloped selected');
assert(Darkroom.advance(d,1).length===0&&!photos[1].developed,'print developed too early');
const batch=Darkroom.advance(d,1.5);assert(batch.length===11&&d.ready,'whole roll must develop together');Store.developBatch(batch);assert(photos.every(p=>p.developed),'batch omitted an exposure');
assert(Darkroom.advance(d,10).length===0,'completed development repeated');
d.compare=true;Darkroom.move(d,99);assert(d.i===11&&!d.compare,'next navigation failed');Darkroom.move(d,-99);assert(d.i===0,'previous navigation failed');
const resumed=Darkroom.open(photos);assert(resumed.ready&&Darkroom.reveal(resumed)===1,'developed roll made player wait again');
const skip=Darkroom.open([{developed:false}]);assert(Darkroom.advance(skip,0,true).length===1,'reveal-now failed');
const interrupted=Darkroom.open([{developed:false}]);Darkroom.advance(interrupted,.5);assert(!interrupted.list[0].developed,'leaving early lost the negative');
console.log('Darkroom: whole-roll development, no eight-frame limit, timing, reveal-now, browsing, re-entry and interruption passed');
`,ctx);
