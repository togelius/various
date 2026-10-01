// Exercise the actual projectile, encounter, UI and death/PLEASE paths together.
function testKitchenFixes() {
  const out = [], oldTimer = window.setTimeout, oldRandom = Math.random, oldT = T, colliders = COL.length;
  window.setTimeout = () => 0;
  Math.random = () => .6;
  const check = (name, ok) => { if (!ok) throw Error(name); out.push('PASS ' + name); };
  const fresh = () => {
    COL.length = colliders; reset(); hideScreen(); state = 'play'; locked = true; mouseDown = false;
    continues = 0; interT = 9999; T = 0; for (const k in keys) keys[k] = false;
  };
  const scenario = (name, fn) => { try { fresh(); fn(); } catch (e) { out.push('FAIL ' + name + ': ' + e.message); } };
  const finale = () => { chapter = 4; wave = 10; chapterClear = true; spawnClog(); };
  const aimFizz = (distance = 8, pitch) => {
    P.x = clog.x - distance; P.z = clog.z; P.y = 0; P.yaw = -Math.PI / 2;
    P.pitch = pitch ?? Math.atan2(clog.y - P.eyeH, distance);
    P.w = P.wNext = 2; P.cool = P.switchT = P.recoil = 0; fire();
  };
  const flyRockets = () => { for (let i = 0; i < 120 && rockets.length; i++) updateRockets(1 / 60); };
  try {
    scenario('Clog collision', () => {
      finale(); aimFizz();
      check('The real launcher emits a fizz rocket at the Clog', rockets.length === 1);
      flyRockets();
      check('A directly aimed fizz rocket hits and defeats the Clog', !clog.alive && rockets.length === 0);
      check('The rocket awards the Clog reward once', score === 5000);
      updateRockets(.2); check('A consumed boss-killing rocket cannot repeat its reward', score === 5000);

      fresh(); finale(); addBox(clog.x - 9, clog.z, .1, 2, 5); aimFizz(12); flyRockets();
      check('Scenery stops fizz before a more distant Clog', rockets.length === 0 && clog.hp === clog.max);

      fresh(); finale(); const guard = makeEnemy('sponge', clog.x - 9, clog.z); guard.spawnT = 0; enemies = [guard];
      aimFizz(12); flyRockets();
      check('An intervening enemy takes the rocket before the Clog', guard.dead && clog.hp === clog.max && rockets.length === 0);
    });

    scenario('Roll hotplates', () => {
      chapter = 2; wave = 6; spawnEnemy('roll'); const roll = enemies[0];
      check('The stove can actually spawn a roll on a burner-crossing lane', BURNERS.some(b => b.x === roll.x));
      const health = roll.hp;
      for (let i = 0; i < 240 && roll.hp === health; i++) { T += 1 / 60; updateEnemies(1 / 60); }
      check('A naturally rolling towel is scorched by a live hotplate', roll.hp < health && roll.lastCause === 'HOTPLATE');
      check('Toasting preserves the roll motion instead of trying to launch it', roll.vy === 0 && roll.padCd === 0);
      const scorched = roll.hp; updateEnemies(1 / 60);
      check('A hotplate cannot damage the same roll on every frame', roll.hp === scorched);
      const burner = BURNERS.find(b => b.x === roll.x);
      roll.x = burner.x; roll.z = burner.z; roll.hp = 100; roll.heatCd = 0; roll.storedWater = 4;
      T = (Math.PI / 2 - burner.phase) / 1.05; updateEnemies(1 / 60);
      check('A toasted roll dies with environmental credit and returns its water', roll.dead && killCount === 1 && $('feed').textContent.includes('KITCHEN [HOTPLATE]') && stains.some(s => s.water));

      fresh(); chapter = 2; const cool = makeEnemy('roll', BURNERS[0].x, BURNERS[0].z); enemies = [cool];
      T = 3 * Math.PI / 2 / 1.05; updateEnemies(1 / 60);
      check('A cooling hotplate leaves a paper roll unharmed', cool.hp === cool.maxHp);
    });

    scenario('Finale guidance', () => {
      chapter = 4; wave = 10; waveActive = true; spawnQ = []; enemies = []; updateWaves(0); hud(0);
      check('Wave ten leaves the Clog arrival announcement visible', clog.alive && $('ann').textContent.startsWith('THE CLOG'));
      check('The objective explains the blocked drain and usable weapons', /BLOCKED/.test($('journeyGoal').textContent) && /FIZZ OR ICE/.test($('journeyGoal').textContent));
      check('The wave display acknowledges the live finale instead of a rest', $('wave').textContent.includes('THE CLOG BLOCKS THE DRAIN') && !$('wave').textContent.includes('CATCH YOUR BREATH'));
      check('The live Clog has a named visible boss bar', !$('boss').hidden && $('bossN').textContent === 'THE CLOG');
      clog.hp = clog.max / 2; hud(0);
      check('The Clog health bar reflects its wounds', $('bossF').style.width === '50%');
      clog.hp = clog.max * 1.25; hud(0);
      check('Feeding the Clog cannot overflow its health bar', $('bossF').style.width === '100%');
      P.x = DRAIN.x; P.z = DRAIN.z; P.y = 0; hud(0);
      check('A blocked drain offers neither a plug prompt nor escape', $('prompt').hidden && !escapeReady());
      aimFizz(); flyRockets(); hud(0);
      check('Defeating the Clog hides its bar and opens the objective', !clog.alive && $('boss').hidden && $('journeyGoal').textContent.includes('DRAIN IS OPEN'));
      P.x = DRAIN.x; P.z = DRAIN.z; P.y = 0; P.onG = true; hud(0);
      check('The cleared drain enables the plug prompt', !$('prompt').hidden && escapeReady());
      keys.KeyE = true; kitchenUpdate(1.6);
      check('The actual fizz-to-plug sequence completes the campaign', state === 'won');
    });

    scenario('Clog PLEASE snapshot', () => {
      finale(); P.x = clog.x - 3.8; P.z = clog.z; P.y = 0;
      clog.hp = 50; clog.spitT = 0; clog.burpT = 5; updateClog(1 / 60);
      check('Retry setup includes an actual Clog-owned hairball', globs.length === 1 && globs[0].owner === clog);
      for (let i = 0; i < 12; i++) techVariety('squirt');
      stashSaid.letter = true; toolTipsSeen.greasy = true;
      const history = techHist.slice(), clock = clog.t, burp = clog.burpT, before = score;
      aimFizz(3.8, -Math.PI / 4); P.hp = 1; P.iT = 0; hurt(20, 'spoon');
      check('The death snapshot is taken before the in-flight rocket explodes', state === 'dead' && clog.alive && rockets.length === 1);
      for (let i = 0; i < 40; i++) tick(.05);
      check('The real death tableau can finish the Clog with that rocket', !clog.alive && score === before + 5000);
      techVariety('fizz'); stashSaid.shelf = true; toolTipsSeen.fork = true; hud(0);
      continueGame(); hud(0);
      check('PLEASE restores Clog wounds and timers from the instant of death', clog.alive && clog.hp === 50 && clog.t === clock && clog.burpT === burp);
      check('PLEASE clears victory announcements from the rolled-back death tableau', !$('ann').classList.contains('go') && !$('mk').classList.contains('go'));
      check('PLEASE restores hairball ownership to the live restored boss', globs.length === 1 && globs[0].owner === clog);
      check('PLEASE rolls back the tableau reward and restores the unfinished rocket', score === before && rockets.length === 1);
      check('PLEASE restores technique history and its HUD multiplier together', techLast === 'squirt' && techRun === 12 && techHist.join() === history.join() && varietyMult === .6 && $('vty').textContent.includes('REPETITION'));
      check('PLEASE keeps prior stash rewards and tips without retaining later ones', stashSaid.letter && !stashSaid.shelf && toolTipsSeen.greasy && !toolTipsSeen.fork);
      P.hp = 1; P.iT = 0; hurt(20, 'spoon'); continueGame();
      check('Repeated PLEASE keeps the boss graph independent of earlier snapshots', clog.alive && clog.hp === 50 && globs[0].owner === clog && score === before);
      flyRockets(); const rewarded = score;
      check('The restored rocket can finish the boss and award the reward once', !clog.alive && rewarded === before + 5000);
      P.hp = 1; P.iT = 0; hurt(20, 'spoon'); continueGame(); updateRockets(.2); hud(0);
      check('Death after the Clog dies preserves its reward and the open drain', !clog.alive && score === rewarded && rockets.length === 0 && $('journeyGoal').textContent.includes('DRAIN IS OPEN'));
    });
  } finally {
    window.setTimeout = oldTimer; Math.random = oldRandom; fresh(); T = oldT;
  }
  return out;
}
