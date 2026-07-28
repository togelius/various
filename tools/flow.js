const { chromium } = require('playwright');
const path = require('path');
const OUT='/tmp/claude-0/-home-user-various/6c10734b-f56b-5da6-b710-21023ccf1b77/scratchpad/flow';
require('fs').mkdirSync(OUT,{recursive:true});
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
  const p = await b.newPage({ viewport: { width: 800, height: 470 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message+' | '+(e.stack||'').split('\n')[1]));
  p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text());});
  await p.goto('file://' + path.resolve(process.cwd(),'index.html'));
  await p.waitForFunction('window.VZ && window.VZ.game');
  await p.waitForTimeout(400);
  const log=[];
  const st=()=>p.evaluate(()=>({s:VZ.game.state,stage:VZ.game.stageIndex,score:VZ.game.score,
     unlocked:VZ.game.save.unlocked,w:VZ.game.player&&VZ.game.player.unlocked.slice()}));
  const press=async(k,ms)=>{await p.evaluate(x=>{VZ.input.virtual={[x]:true};},k);await p.waitForTimeout(ms||120);await p.evaluate(()=>{VZ.input.virtual={};});await p.waitForTimeout(80);};

  for (let stage=0; stage<3; stage++){
    await p.evaluate((s)=>{const g=VZ.game;g.fade=0;g.fadeTarget=0;g.fadeCb=null;
      if(g.state!=='play'||g.stageIndex!==s){g.loadStage(s,true);g.setState('play');}
      g.player.x=g.arena.x0-30;g.player.y=g.arena.y1-16;g.camera.follow(g.player,true);},stage);
    await p.evaluate(()=>{VZ.input.virtual={right:true};});
    await p.waitForTimeout(1500);
    await p.evaluate(()=>{VZ.input.virtual={};});
    log.push('stage '+stage+' boss started: '+JSON.stringify(await st()));
    // kill the boss outright
    await p.evaluate(()=>{const g=VZ.game;if(g.boss){g.boss.hp=1;g.boss.hurtBy(5,g.boss.x);}});
    await p.waitForTimeout(4500);
    log.push('  after boss death: '+JSON.stringify(await st()));
    await p.screenshot({path:OUT+'/stage'+stage+'_results.png'});
    // advance through results
    for(let i=0;i<6;i++){ await press('jump',150); }
    await p.waitForTimeout(2500);
    log.push('  advanced to: '+JSON.stringify(await st()));
    await p.screenshot({path:OUT+'/stage'+stage+'_next.png'});
  }
  await p.waitForTimeout(2000);
  log.push('final: '+JSON.stringify(await st()));
  await p.screenshot({path:OUT+'/ending.png'});
  console.log(log.join('\n'));
  console.log('--- errors ---'); console.log(errs.length?[...new Set(errs)].slice(0,8).join('\n'):'none');
  await b.close();
})();
