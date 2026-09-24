const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const data=new Map();let full=false;const ctx=vm.createContext({console,URLSearchParams,location:{search:''},navigator:{maxTouchPoints:0},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(full)throw Error('quota');data.set(k,v);}},Image:class{set src(v){this.url=v}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/store.js'),'utf8')+';globalThis.Store=Store;',ctx);const s=ctx.Store,canvas={toDataURL:()=> 'data:image/jpeg;base64,TEST'};
s.keepPhoto('first',1,0,'first',canvas,canvas);const original=data.get('stalhagen2.album.v1');full=true;const last=s.keepPhoto('second',1,2,'second',canvas,canvas);
assert.equal(last.saved,false);assert.equal(s.photos.length,2);assert.equal(data.get('stalhagen2.album.v1'),original,'quota failure must preserve stored album');
full=false;s.setSave({chapter:2,cast:{bearer:{off:true,cut:[5]}}});s.setting('quiet',true);assert.equal(s.save.cast.bearer.off,true);s.startJourney();assert.equal(s.save,null);assert.equal(s.photos.length,2,'new journey must retain album');assert.equal(s.settings.quiet,true);
console.log('Storage: full-storage preservation, session photo retention, checkpoints and new-journey album/settings retention passed');
