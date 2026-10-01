// Browser integration tests. Injected into the game closure by index.html.
// All scenarios call the shipping simulation and collision functions.
function testJourney() {
 const out=[], oldTimer=window.setTimeout, timers=[];
 const check=(label,ok)=>{if(!ok)throw Error(label);out.push('PASS '+label);};
 window.setTimeout=fn=>{timers.push(fn);return 0;};
 const fresh=()=>{reset();state='play';mouseDown=false;for(const k in keys)keys[k]=false;continues=0;};
 try{
  fresh();check('Counter is 360 by 43',CX1-CX0===360&&CZ1-CZ0===43);check('Five distinct chapters',CHAPTERS.length===5&&new Set(CHAPTERS.map(c=>c.name)).size===5);
  check('Starts facing down kitchen',P.x===-24&&P.yaw===-Math.PI/2);
  for(let i=0;i<5;i++){
   fresh();chapter=i;checkpointPosition();const before=[P.x,P.z];collide(P,PRAD,1.2);
   check('Checkpoint '+(i+1)+' is unobstructed',Math.hypot(P.x-before[0],P.z-before[1])<.001&&onCounter(P.x,P.z));
   for(const type of ['sponge','bottle','spoon','mama','roll','fork','gold']){enemies=[];wave=CHAPTERS[i].first;killCount=1;spawnEnemy(type);const e=enemies[0];check('Local '+type+' spawn '+(i+1),!!e&&Math.abs(e.x-CHAPTERS[i].x)<33&&onCounter(e.x,e.z));}
  }
  fresh();P.x=35.9;P.z=17;P.y=0;P.vx=5;P.vz=0;check('Closed checkpoint blocks movement',collide(P,PRAD,1.2)&&P.x<36);
  check('Closed checkpoint blocks shots',rayStatic(34,1,17,1,0,0,12)<3);
  chapterClear=true;P.x=36;P.z=17;check('Cleared checkpoint opens',!collide(P,PRAD,1.2));check('Open checkpoint passes shots',rayStatic(34,1,17,1,0,0,12)>3);
  wave=2;waveActive=false;interT=0;updateWaves(10);check('Cleared district waits for travel',wave===2&&!waveActive);
  P.x=48;kitchenUpdate(.01);check('Travel starts Breakfast checkpoint',chapter===1&&!chapterClear&&wave===2&&P.hp>=80);
  fresh();chapter=1;P.x=65.9;P.z=11;P.y=0;P.vx=1;P.vz=0;
  check('Board blocks standing body',collide(P,PRAD,1.2));P.x=65.9;check('Puddle fits below board',!collide(P,PRAD,.42));
  check('Wet shortcut is marked as wet',wetLaneAt(74,11)&&!wetLaneAt(74,18));
  fresh();chapter=2;P.x=135;P.z=-9;P.y=0;P.onG=true;T=Math.PI/2/1.05;const hp=P.hp;kitchenUpdate(.2);check('Hotplate hurts grounded DRIP',P.hp<hp);
  P.y=3;P.onG=false;const airborne=P.hp;kitchenUpdate(.2);check('Jump clears hotplate',P.hp===airborne);
  P.y=0;P.onG=true;T=3*Math.PI/2/1.05;const cool=P.hp;kitchenUpdate(.2);check('Cooling hotplate is safe',P.hp===cool);
  P.x=299;P.z=-17;P.hp=90;kitchenUpdate(1);check('Tap refills and caps dampness',P.hp===100);
  fresh();chapter=3;wave=7;score=4321;killCount=19;forkStatus='sighted';P.ammo[1]=2;continueGame();
  check('PLEASE resumes correct district and wave',chapter===3&&wave===7&&P.x===192&&P.z===17);
  check('PLEASE preserves score and Fork history',score===4321&&killCount===19&&forkStatus==='sighted');
  check('PLEASE restores usable ammunition',P.ammo[1]>=WEAPONS[1].start);
  chapterClear=true;wave=8;continueGame();check('PLEASE during travel keeps gate open',chapterClear&&wave===8&&!waveActive&&chapterGateOpen(3));
  // Exercise the complete state path: real wave spawns, boss splitting, clear rewards and district entry.
  fresh();
  for(let stage=0;stage<5;stage++){
   if(stage>0){P.x=CHAPTERS[stage].x-24;P.z=17;kitchenUpdate(.01);check('Entered district '+(stage+1),chapter===stage);}
   for(let n=CHAPTERS[stage].first;n<=CHAPTERS[stage].last;n++){
    startWave(n);while(spawnQ.length)spawnEnemy(spawnQ.shift());
    let guard=0;while(enemies.some(e=>!e.dead)&&guard++<500){const e=enemies.find(e=>!e.dead);killEnemy(e,0);}
    enemies=enemies.filter(e=>!e.dead);updateWaves(0);check('Wave '+n+' clears including split enemies',!waveActive&&enemies.length===0&&guard<500);
   }
   check('District '+(stage+1)+' opens after two waves',chapterClear);
  }
  check('No eleventh wave before escape',wave===10&&chapter===4&&chapterClear);
  P.x=DRAIN.x;P.z=DRAIN.z;P.y=0;P.onG=true;keys.KeyE=false;kitchenUpdate(2);check('Drain requires deliberate input',state==='play');
  keys.KeyE=true;kitchenUpdate(1.6);check('Drain finishes the kitchen',state==='won'&&endings().escaped&&$('hud').classList.contains('off'));
  const banked=score;continueEndless();updateWaves(5);check('Optional endless starts wave eleven',endless&&state==='play'&&wave===11&&score===banked&&!$('hud').classList.contains('off'));
  check('Endless opens all checkpoints',GATES.every(g=>chapterGateOpen(g.index)));
  render();check('Balanced render stack',stack.length===0);check('No WebGL errors',gl.getError()===gl.NO_ERROR);check('Audio stayed muted',muted&&(!master||master.gain.value===0));
 }catch(e){out.push('FAIL '+e.message);}
 finally{window.setTimeout=oldTimer;fresh();hideScreen();$('hud').classList.remove('off');interT=9999;jokeT=0;ZZ.lock=false;}
 return out;
}
function testTraversal() {
 const out=[],oldTimer=window.setTimeout;window.setTimeout=()=>0;
 const check=(name,ok)=>{if(!ok)throw Error(name);out.push('PASS '+name);};
 const fresh=()=>{reset();state='play';interT=9999;mouseDown=false;for(const k in keys)keys[k]=false;};
 try{
  fresh();chapter=1;P.x=74;P.z=11;P.pud=true;P.pudT=1;P.onG=true;const x=P.x;
  updatePlayer(1/60);check('Releasing puddle under board stays flat',P.pud&&Math.abs(P.x-x)<.5);
  P.x=64.5;P.z=11;P.yaw=-Math.PI/2;keys.KeyW=keys.KeyC=true;
  for(let i=0;i<150;i++)updatePlayer(1/60);
  check('Actual slide crosses under board',P.x>82&&P.hp===100);
  P.x=83;P.z=10;P.vx=P.vz=0;keys.KeyW=keys.KeyC=false;updatePlayer(1/60);
  check('DRIP reforms after clearing board',!P.pud);
  fresh();chapter=1;P.x=57;P.z=2;P.onG=true;updatePlayer(1/60);
  check('Toaster pad launches above toaster height',P.vy>=29.5);
  let landed=false,peak=0;
  for(let i=0;i<115;i++){updatePlayer(1/60);peak=Math.max(peak,P.y);if(P.onG&&P.y>=9)landed=true;}
  check('Toaster route is physically reachable',peak>10&&landed);
  fresh();chapter=3;P.x=196;P.z=7;P.onG=true;updatePlayer(1/60);let plateLand=false;
  for(let i=0;i<115;i++){updatePlayer(1/60);if(P.onG&&P.y>1)plateLand=true;}
  check('Dish launcher lands on raised route',plateLand);
  fresh();endless=true;P.yaw=-Math.PI/2;keys.KeyW=true;
  let guard=0;while(P.x<304&&guard++<2600)updatePlayer(1/60);
  check('Front lane traverses the entire counter',P.x>=304&&P.hp===100&&state==='play');
  fresh();chapter=3;P.x=216;P.z=15;const e=makeEnemy('spoon',216,-19);e.y=3;e.vz=12;e.state=2;e.stT=3;e.spawnT=0;enemies=[e];
  for(let i=0;i<180;i++)updateEnemies(1/60);
  check('Cutlery can climb the tall dish rack',e.climbTop>10||e.y>10||e.z>-4);
  render();check('No graphics error after traversal',gl.getError()===0&&stack.length===0);
 }catch(e){out.push('FAIL '+e.message);}
 finally{window.setTimeout=oldTimer;fresh();hideScreen();$('hud').classList.remove('off');}
 return out;
}

function testLighting() {
 const out=[],before=richLighting;
 const check=(name,ok)=>{if(!ok)throw Error(name);out.push('PASS '+name);};
 try{
  check('Sun depth framebuffer is complete',shadowReady);
  richLighting=true;
  for(let i=0;i<5;i++){
   reset();state='play';chapter=i;checkpointPosition();render();
   check('Sunlit district '+(i+1)+' renders without graphics errors',gl.getError()===0&&sunVP.every(Number.isFinite));
  }
  const cached=shadowKey;render();check('Stationary scenery shadow is cached',shadowKey===cached);
  P.x+=16;render();check('Sunlight follows travel',shadowKey!==cached);
  richLighting=false;render();check('Classic lighting remains available',gl.getError()===0);
  richLighting=true;chapter=0;chapterClear=false;checkpointPosition();render();const closed=shadowKey;
  chapterClear=true;render();check('Opening a checkpoint updates its shadow',shadowKey!==closed&&gl.getError()===0);
 }catch(e){out.push('FAIL '+e.message);}
 finally{richLighting=before;reset();state='play';}
 return out;
}

function testCurios(){
 const out=[],oldTimer=window.setTimeout,oldRich=richLighting;window.setTimeout=()=>0;
 const check=(name,ok)=>{if(!ok)throw Error(name);out.push('PASS '+name);};
 const fresh=()=>{reset();hideScreen();state='play';interT=9999;jokeT=0;ZZ.lock=false;mouseDown=false;for(const k in keys)keys[k]=false;};
 const pose=r=>{
  chapter=r.district;P.pud=!!r.lowOnly;P.eyeH=P.pud?.32:1.45;
  for(const radius of [2.8,3.8,1.8])for(let i=0;i<16;i++){
   P.x=r.x+Math.sin(i*Math.PI/8)*radius;P.z=r.z+Math.cos(i*Math.PI/8)*radius;P.y=groundAt(P.x,P.z,r.y+.5);P.vx=P.vy=P.vz=0;
   if(!onCounter(P.x,P.z)||Math.abs(P.y-r.y)>3)continue;
   const x=P.x,z=P.z;collide(P,PRAD,P.pud?.42:1.2);if(Math.hypot(P.x-x,P.z-z)>.001)continue;
   const dx=r.x-P.x,dz=r.z-P.z;P.yaw=Math.atan2(-dx,-dz);P.pitch=Math.atan2(r.y+r.eyeY-P.y-P.eyeH,Math.hypot(dx,dz));
   if(findCurio()===r)return true;
  }
  return false;
 };
 try{
  fresh();curioFound.clear();
  check('Twenty unique philosophical encounters',CURIOS.length===20&&new Set(CURIOS.map(r=>r.id)).size===20);
  check('Four discoveries in every district',CHAPTERS.every((_,i)=>CURIOS.filter(r=>r.district===i).length===4));
  check('Undiscovered notebook keeps identities hidden',CURIOS.every(r=>!journalHTML().includes(r.name)));
  check('Notebook offers optional clues',(journalHTML().match(/A small nudge/g)||[]).length===20);
  for(const r of CURIOS){
   fresh();check(r.id+' can be examined from solid unobstructed ground',pose(r));
   const hp=P.hp,t=T,n=wave,enemy=makeEnemy('sponge',P.x+5,P.z+5);enemies=[enemy];const ex=enemy.x,ez=enemy.z;
   check(r.id+' opens its own encounter and banks discovery',inspectCurio()&&state==='paused'&&readingCurio===r&&curioFound.has(r.id)&&score===250);
   tick(2);check(r.id+' reading freezes danger and hotplate time',P.hp===hp&&T===t&&wave===n&&enemy.x===ex&&enemy.z===ez);
   richLighting=true;render();check(r.id+' close-up renders in Sunlit mode',gl.getError()===0&&stack.length===0);
   if(['occam','wittgenstein','russell'].includes(r.id)){richLighting=false;render();check(r.id+' close-up renders in Classic mode',gl.getError()===0&&stack.length===0);}
   check(r.id+' includes a separate hidden footnote',document.querySelector('.curioCard details')?.textContent.includes(r.foot));
   document.querySelector('[data-action="curio-close"]').click();
   check(r.id+' resumes the same fight',state==='play'&&screenKind==='play'&&!$('hud').classList.contains('off')&&enemies[0]===enemy);
   inspectCurio();check(r.id+' revisits cannot farm score',score===250&&runCurios.size===1);
  }
  check('Discoveries persist in the save store',JSON.parse(localStorage.getItem('absorb.curios')).length===20);
  openNotebook();check('Notebook lists all twenty discovered objects',document.querySelectorAll('button[data-curio]').length===20);check('Finding the whole faculty reveals its diploma',!!document.querySelector('.noteDiploma'));
  document.querySelector('[data-curio="kant"]').click();check('Notebook reopens an already found character',readingCurio.id==='kant'&&document.querySelector('.curioCard').textContent.includes('MODERN MORALITY'));
  const banked=score;openNotebook();document.querySelector('[data-curio="russell"]').click();check('Notebook reading earns no extra score',score===banked);
  fresh();check('New spill resets run discoveries but keeps field notes',runCurios.size===0&&curioFound.size===20);
  const spoon=CURIOS.find(r=>r.lowOnly);check('Teaspoon can be found while a puddle',pose(spoon)&&findCurio()===spoon);
  P.pud=false;check('Hidden teaspoon requires puddle form',findCurio()!==spoon);
  const r=CURIOS.find(r=>r.id==='occam');pose(r);P.yaw+=Math.PI;check('Looking away does not reveal kitchenware',!findCurio());
  pose(r);P.x-=20;check('Distant kitchenware does not reveal itself',!findCurio());
  // A real opaque obstacle between eye and object must block discovery.
  pose(r);const eye=[P.x,P.y+P.eyeH,P.z],target=[r.x,r.y+r.eyeY,r.z];
  addBox((eye[0]+target[0])/2,(eye[2]+target[2])/2,1.8,.5,12);check('Scenery blocks discovery through walls',findCurio()!==r);COL.pop();
  pose(r);inspectCurio();start();const saved=score;continueGame();check('PLEASE keeps discoveries and their score',runCurios.has(r.id)&&curioFound.size===20&&score===saved);
  fresh();state='title';showScreen('title');openNotebook();dispatchEvent(new KeyboardEvent('keydown',{code:'Enter'}));check('Enter in title notebook does not reset the run',screenKind==='journal'&&state==='title');document.querySelector('[data-curio="russell"]').click();document.querySelector('[data-action="curio-close"]').click();check('Title notebook returns to title without starting a run',state==='title'&&screenKind==='title');
  fresh();state='won';showScreen('won');openNotebook();document.querySelector('[data-action="notebook-back"]').click();check('Ending notebook returns to the completed run',state==='won'&&screenKind==='won');
  check('Discovery tests kept audio muted',muted&&(!master||master.gain.value===0));
 }catch(e){out.push('FAIL '+e.message);}
 finally{window.setTimeout=oldTimer;richLighting=oldRich;fresh();}
 return out;
}

const testResults = [...testJourney(), ...testTraversal(), ...testLighting(), ...testCurios(), ...testForgiveness(), ...testSlapstick(), ...testStories()];
parent.postMessage({type: "absorb-tests", results: testResults}, "*");
