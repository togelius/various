// Regression scenarios for the shipping damage rules and actual death/PLEASE path.
function testForgiveness() {
  const out=[], oldTimer=window.setTimeout;
  window.setTimeout=()=>0;
  const check=(name,ok)=>{if(!ok)throw Error(name);out.push('PASS '+name);};
  const near=(a,b)=>Math.abs(a-b)<.00001;
  const fresh=()=>{reset();hideScreen();state='play';locked=true;mouseDown=false;continues=0;interT=9999;for(const k in keys)keys[k]=false;};
  try {
    fresh();hurt(20,'spoon');const hitHP=P.hp;hurt(20,'bottle');
    check('An ordinary hit is gentler and protects against an immediate pile-on',hitHP===83&&P.hp===hitHP&&P.iT>=.55);
    const protection=P.iT;keys.ShiftLeft=true;updatePlayer(.01);keys.ShiftLeft=false;
    check('Dashing cannot shorten ordinary-hit protection',P.iT>=protection-.011);
    seepDamage(7,.1,'puddle');
    check('Damage grace also covers sauce and heat',P.hp===hitHP);
    P.iT=0;hurt(20,'spoon');check('A later hit still matters',P.hp===66);

    fresh();const sponge=makeEnemy('sponge',P.x,P.z), grandma=makeEnemy('sponge',P.x,P.z,4);
    updatePlayer(.1);absorbPlayer(sponge,.1);absorbPlayer(sponge,.1);absorbPlayer(grandma,.1);
    check('Overlapping sponges share a maximum absorption budget',near(P.hp,98.5));
    updatePlayer(.1);absorbPlayer(sponge,.1);check('Absorption continues gently on later frames',near(P.hp,97.4));
    P.iT=1;absorbPlayer(grandma,.1);check('A protected return cannot immediately be absorbed',near(P.hp,97.4));
    fresh();enemies=[0,.1,-.1].map(dx=>{const e=makeEnemy('sponge',P.x+dx,P.z);e.cd=10;e.spawnT=0;return e;});
    updatePlayer(.1);updateEnemies(.1);
    check('The actual enemy update uses the shared absorption budget',near(P.hp,98.9));
    fresh();P.hp=50;explode(P.x,P.y+.5,P.z);
    check('Point-blank fizz remains a launch with survivable self-damage',P.hp>=44.7&&P.vy>=12&&state==='play');

    // A naturally fired close-range rocket must be spent before its lethal blast snapshots the world.
    fresh();wave=1;waveActive=true;spawnQ=[];
    const blastSurvivor=makeEnemy('sponge',P.x+2.5,P.z,2),blastVictim=makeEnemy('sponge',P.x+3.2,P.z+.1);
    enemies=[blastSurvivor,blastVictim];P.hp=1;P.iT=0;P.w=P.wNext=2;
    globs=[{life:0}];soaps=[{life:0}];fire();updateRockets(.04);
    check('A fired close-range rocket can naturally cause a lethal self-explosion',state==='dead'&&deathCause==='self'&&blastSurvivor.hp>0&&blastSurvivor.hp<blastSurvivor.maxHp&&blastVictim.dead);
    const blastHP=blastSurvivor.hp,blastScore=score,blastKills=killCount;
    continueGame();
    check('PLEASE does not resurrect the lethal rocket or other consumed projectiles',rockets.length===0&&globs.length===0&&soaps.length===0&&enemies.length===1&&enemies[0].hp===blastHP);
    updateRockets(.2);
    check('Returning after self-explosion cannot blast enemies or award kills a second time',enemies[0].hp===blastHP&&score===blastScore&&killCount===blastKills&&P.hp===100);

    // Kill a real parent so the exact surviving split family must be restored.
    fresh();chapter=4;wave=10;waveActive=true;spawnQ=['bottle','roll'];spawnT=.4;MOD='moon';gs=.4;
    const parent=makeEnemy('sponge',290,14,4), bottle=makeEnemy('bottle',285,14), fork=makeEnemy('fork',281,10);
    enemies=[parent,bottle,fork];killEnemy(parent,0);enemies=enemies.filter(e=>!e.dead);
    const child=enemies.find(e=>e.type==='sponge');child.hp=37;fork.hp=123;forkStatus='sighted';
    child.grudge=bottle;bottle.grudge=child;
    globs=[{x:284,y:2,z:14,vx:0,vy:0,vz:0,g:22,life:2,owner:bottle}];
    stains=[];stain(283,0,15,2,WET);
    const surviving=enemies.length, earned=score, kills=killCount, wetCount=stains.length;
    nemesis='foe_lobster';chal={k:'enjoy',t:7,prog:2};chalNext=T+40;
    P.hp=1;P.iT=0;hurt(20,'spoon');
    check('Natural lethal damage records a retry snapshot',state==='dead'&&!!retrySnapshot);
    const deadTime=T;
    // The real death animation keeps simulating. Neither drift nor later rewards survive PLEASE.
    for(let i=0;i<20;i++)tick(.05);
    fork.hp=1;spawnQ=[];MOD='caffeine';gs=1;score+=99999;killCount+=20;stains=[];
    continueGame();
    const restoredFork=enemies.find(e=>e.type==='fork'),restoredChild=enemies.find(e=>e.hp===37),restoredBottle=enemies.find(e=>e.type==='bottle');
    check('PLEASE restores surviving split children without resurrecting Grandma',enemies.length===surviving&&!enemies.some(e=>e.type==='mama')&&!!restoredChild);
    check('PLEASE keeps boss damage and the exact remaining spawn queue',restoredFork.hp===123&&spawnQ.join(',')==='bottle,roll'&&near(spawnT,.4));
    check('PLEASE does not award post-death kills or duplicate prior rewards',score===earned&&killCount===kills);
    check('PLEASE restores wave modifiers and the death-time simulation clock',MOD==='moon'&&gs===.4&&T===deadTime&&wave===10&&waveActive);
    check('PLEASE preserves reciprocal actor grudges and projectile ownership',restoredChild.grudge===restoredBottle&&restoredBottle.grudge===restoredChild&&globs[0].owner===restoredBottle);
    check('PLEASE restores wet scenery, challenges, nemesis and Fork history',stains.length===wetCount&&chal.prog===2&&chal.t===7&&nemesis==='foe_lobster'&&forkStatus==='sighted');
    check('PLEASE supplies full health and ammo with a safe checkpoint return',P.hp===100&&P.ammo.every((a,i)=>a===WEAPONS[i].max)&&P.iT===3&&P.x===264&&state==='play');
    P.iT=0;P.hp=1;hurt(20,'spoon');continueGame();
    check('A second PLEASE keeps the same progress without adding enemies',continues===2&&enemies.length===surviving&&score===earned&&killCount===kills&&enemies.find(e=>e.type==='fork').hp===123);

    fresh();wave=1;waveActive=true;spawnQ=[];const last=makeEnemy('sponge',0,0);enemies=[last];killEnemy(last,0);enemies=[];
    const beforeClear=score;P.hp=1;P.iT=0;hurt(20,'spoon');continueGame();updateWaves(0);const cleared=score;updateWaves(0);
    check('PLEASE after the last kill grants the wave-clear reward exactly once',!waveActive&&wave===1&&cleared===beforeClear+500&&score===cleared);

    fresh();wave=1;waveActive=false;interT=4;P.hp=1;hurt(20,'spoon');continueGame();
    check('Death between waves preserves the upcoming wave and its pause',!waveActive&&wave===1&&interT===4);
    updateWaves(4.1);check('The next wave starts once after a between-wave PLEASE',wave===2&&waveActive);
    fresh();chapter=2;chapterClear=true;wave=6;waveActive=false;P.hp=1;hurt(20,'spoon');continueGame();
    check('Death while travelling keeps a cleared district open',chapterClear&&wave===6&&!waveActive&&chapterGateOpen(2));
    fresh();P.hp=1;hurt(20,'spoon');showScreen('dead');
    check('Death keeps the written PLEASE ritual and adds a direct progress-preserving button',document.querySelector('[data-action="continue"]')&&$('scr').textContent.includes('OR TYPE PLEASE')&&$('scr').textContent.includes('CLICK TO RE-CONDENSE'));
    document.querySelector('[data-action="continue"]').click();check('PLEASE button resumes the saved encounter',state==='play'&&continues===1);
    fresh();check('A new spill clears the old death snapshot',retrySnapshot===null);
  } catch(e) { out.push('FAIL '+e.message); }
  finally { window.setTimeout=oldTimer;fresh(); }
  return out;
}
