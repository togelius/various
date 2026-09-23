// The visible rehearsal and headless regression exercise the same continuous input sequence.
const assert=require('node:assert/strict'),path=require('node:path');
const {launch}=require('../launch.js');
(async()=>{const browser=await launch();try{
 const page=await browser.newPage({viewport:{width:800,height:450}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.resolve(__dirname,'../../../test/escape-rehearsal.html')+'?mute=1&seed=42&shadow=256');
 await page.waitForFunction(()=>window.__ready,null,{timeout:240000});
 const result=await page.evaluate(()=>runEscapeAudit());console.log(JSON.stringify(result));
 assert.deepEqual(errors,[]);for(const label of ['Stole first car','Real collision damage','Abandoned car','Vaulted cover','Switched cars','Lost pursuit'])assert.ok(result.milestones.some(m=>m.label===label),label);
 assert.ok(result.elapsed>=600,'ten minutes continue through normal vehicle wear and recovery');assert.equal(result.minutes.length,10);
 assert.ok(result.distance>1000,'replay travels rather than idling in safety');
 console.log('PASS continuous two-star crash, abandon, vault, car switch and ten-minute endurance replay');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
