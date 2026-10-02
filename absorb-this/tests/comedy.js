// Real weapon / physics paths, immutable footage, and safe transitions back to play.
function testComedy() {
  const out = [], oldTimer = window.setTimeout, oldRandom = Math.random, oldAuto = autoReplays, oldT = T;
  window.setTimeout = () => 0; Math.random = () => .6;
  const check = (name, ok) => { if (!ok) throw Error(name); out.push('PASS ' + name); };
  const fresh = () => {
    reset(); hideScreen(); state = 'play'; locked = true; mouseDown = false; autoReplays = true;
    T = 0; wave = 1; waveActive = true; spawnQ = []; spawnT = 99; interT = 999;
    chalNext = ZZ.nextIdle = 9999; jokeT = 0; ZZ.lock = false;
    for (const k in keys) keys[k] = false;
  };
  const scenario = (name, fn) => { try { fresh(); fn(); } catch (e) { out.push('FAIL ' + name + ': ' + e.message); } };
  const sponge = x => { const e = makeEnemy('sponge', x, 17); e.spawnT = 0; enemies.push(e); return e; };
  const preRoll = () => { for (let i = 0; i < 50; i++) recordReplay(.05); };
  const iceShot = () => { P.yaw = -Math.PI / 2; P.pitch = -.035; P.w = P.wNext = 1; P.cool = P.switchT = 0; fire(); };
  const footage = () => {
    const e = sponge(-17); preRoll(); iceShot();
    for (let i = 0; i < 25; i++) { updateIceBodies(.05); updateParticles(.05); recordReplay(.05); }
    return replayBest;
  };
  try {
    scenario('Frozen body bowling', () => {
      const first = sponge(-17), second = sponge(-10); preRoll(); iceShot();
      check('One real ice shotgun volley kills an ordinary sponge and leaves a sliding body', first.dead && iceBodies.length === 1 && Math.hypot(iceBodies[0].vx, iceBodies[0].vz) > 15);
      check('The body preserves the defeated actor identity', iceBodies[0].replayId === first.replayId);
      const firstScore = score;
      for (let i = 0; i < 45; i++) updateIceBodies(1 / 60);
      check('A dead sponge bowls over another enemy without another shot', second.dead && killCount === 2 && score > firstScore);
      check('Bowling receives environmental credit', $('feed').textContent.includes('KITCHEN [ICE BOWLING]'));
      check('The broadcast credits the sliding actor, with its original name, rather than its victim', replayBest.kind === 'bowling' && replayBest.actorId === first.replayId && replayBest.actor === kitchenActorName(first) && iceBodies[0].dramaId === first.dramaId);
      const reward = score; for (let i = 0; i < 400; i++) updateIceBodies(1 / 60);
      check('Melting props do not award a second kill or score', killCount === 2 && score === reward && !iceBodies.length);
      check('Melting leaves useful water behind', stains.some(s => s.water));
    });
    scenario('Commentary follows the material accident', () => {
      const burn = type => {
        fresh(); chapter = 2; const b = BURNERS[0]; P.x = b.x - 8; P.z = b.z + 8;
        const e = makeEnemy(type, b.x, b.z); e.hp = 1; e.spawnT = 0; enemies = [e]; preRoll();
        T = (Math.PI / 2 - b.phase) / 1.05; updateEnemies(1 / 60);
        return { dead: e.dead, kind: replayBest.kind, title: replayBest.title };
      };
      const bottle = burn('bottle'), roll = burn('roll');
      check('A scorched bottle receives heat commentary without pretending to be paper', bottle.dead && bottle.kind === 'scorch' && !bottle.title.includes('PAPER'));
      check('A toasted paper roll gets its own materially appropriate headline', roll.dead && roll.kind === 'toast' && roll.title.includes('PAPER'));
    });
    scenario('Puck interactions and PLEASE', () => {
      sponge(-17); iceShot(); const b = iceBodies[0];
      b.vx = b.vz = 0; const reward = score;
      hitscan([b.x - 4, b.y + .45, b.z], [1, 0, 0], 10, 4, 0);
      check('A water shot can push the frozen body without awarding another kill', b.vx > 5 && score === reward && killCount === 1);
      const live = sponge(-8); b.struck.add(live.replayId);
      die('bottle'); const savedX = retrySnapshot.iceBodies[0].x;
      updateIceBodies(.5); continueGame();
      check('PLEASE restores moving bodies and their collision history from the death snapshot', iceBodies.length === 1 && iceBodies[0].x === savedX && iceBodies[0].struck.has(live.replayId));
      check('PLEASE clears footage of the abandoned death tableau', !replayRing.length && !replayBest && !replayPending);
      for (let i = 0; i < 18; i++) leaveIceBody(makeEnemy('sponge', -16, 17), 1, 0);
      check('Lingering frozen bodies have a fixed population budget', iceBodies.length === 12);
    });
    scenario('Recorded broadcast and read-only rendering', () => {
      const clip = footage(); check('A real ice kill records both its lead-up and aftermath', clip && clip.frames[0].at < clip.eventAt && clip.frames.at(-1).at > clip.eventAt + .8);
      check('The recorder bounds its rolling buffer and selected clip', replayRing.length <= 42 && clip.frames.length <= 64);
      check('Snapshots contain independent actor values, not the live actor graph', clip.frames[0].enemies[0] !== enemies[0] && !('struck' in clip.frames.at(-1).iceBodies[0]));
      const live = { P, enemies, iceBodies, score, killCount, T, x: P.x, hp: P.hp, bodies: JSON.stringify(iceBodies.map(replayVisual)), clip: JSON.stringify(clip) };
      beginReplay(clip); mouseDown = true; keys.KeyW = true;
      tick(.5); render(); hud(.5);
      check('Replay time does not advance live physics, health, score or simulation time', P === live.P && enemies === live.enemies && iceBodies === live.iceBodies && P.x === live.x && P.hp === live.hp && score === live.score && killCount === live.killCount && T === live.T && JSON.stringify(iceBodies.map(replayVisual)) === live.bodies);
      check('Rendering does not modify recorded frames', JSON.stringify(clip.frames) === JSON.stringify(JSON.parse(live.clip).frames));
      check('Replay rendering leaves WebGL healthy and the matrix stack balanced', gl.getError() === gl.NO_ERROR && stack.length === 0 && !replayDrawing && replayCamera === null);
      const playingAt = replayPlayback.elapsed;
      ZZ.speaking = true; replayPlayback.elapsed = 60; updateReplay(0);
      check('Automatic playback waits for a spoken punchline to finish', !!replayPlayback);
      ZZ.speaking = false; replayPlayback.elapsed = playingAt;
      const elapsed = replayPlayback.elapsed; holdReplay(true); tick(2);
      check('Holding the broadcast freezes playback as well as the game', replayPlayback.elapsed === elapsed && $('replayHold').textContent === 'RESUME REPLAY');
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }));
      check('A jump held before the replay cannot accidentally skip it by key repeat', !!replayPlayback);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      check('Space skips cleanly with safe controls and a return grace period', state === 'play' && !replayPlayback && !mouseDown && !keys.KeyW && P.iT >= 2 && $('replay').hidden && !document.body.classList.contains('broadcast'));
    });
    scenario('Wave clear pacing and optional broadcasts', () => {
      footage(); enemies = []; updateWaves(0);
      check('Frozen bodies do not block a wave clear', !waveActive && iceBodies.length > 0 && replayPending > 0);
      for (let i = 0; i < 80 && state === 'play'; i++) recordReplay(1 / 60);
      check('Wave clear saves and starts one automatic highlight', state === 'replay' && replayArchive.length === 1);
      for (let i = 0; i < 1000 && replayPlayback; i++) tick(1 / 60);
      check('The broadcast finishes automatically and keeps a short breather', state === 'play' && !replayPlayback && interT >= 2.5);
      fresh(); footage(); autoReplays = false; enemies = []; updateWaves(0);
      for (let i = 0; i < 80; i++) recordReplay(1 / 60);
      check('Notebook-only mode records the highlight without interrupting play', state === 'play' && !replayPlayback && replayArchive.length === 1);
      openNotebook(); const scoreBefore = score;
      $('scr').querySelector('[data-replay="0"]').click(); render(); $('replaySkip').click();
      check('A notebook replay returns to the paused notebook without changing score', state === 'paused' && screenKind === 'journal' && score === scoreBefore);
    });
    scenario('Finale and unlocked return', () => {
      const clip = footage(); chapter = 4; wave = 10; chapterClear = true; spawnClog();
      const boss = clog, hp = clog.hp; beginReplay(clip);
      tick(2); render(); check('The arriving Clog remains intact during a prior highlight', clog === boss && clog.hp === hp && clog.alive);
      locked = false; finishReplay();
      check('Return respects desktop pointer capture or touch controls', TOUCH ? state === 'play' : state === 'paused' && screenKind === 'pause');
      check('The Clog objective is announced again after the replay', $('ann').textContent.includes('FIZZ CLEARS THE DRAIN'));
    });
    scenario('Existing wave commentary survives the broadcast', () => {
      footage(); const delayed = [];
      window.setTimeout = (fn, ms) => { if (ms === 2200) delayed.push(fn); return 0; };
      enemies = []; updateWaves(0); window.setTimeout = () => 0;
      for (let i = 0; i < 80 && state === 'play'; i++) recordReplay(1 / 60);
      delayed.forEach(fn => fn());
      check('The original wave-clear speech waits when its timer fires during a replay', replayPlayback.after.length === 1);
      finishReplay(); zHide(); ZZ.cool = 0; const count = comedyTranscript.length; update(0);
      check('The original wave-clear bank still speaks and is archived after the broadcast', ZZ.on && comedyTranscript.length > count && !broadcastBarks.length);
    });
    if (TOUCH) scenario('Touch gestures across a broadcast', () => {
      const clip = footage(); $('touchui').hidden = false;
      const touch = (target, type, x, y, id) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      touch($('touchui'), 'pointerdown', 80, innerHeight * .75, 7);
      touch(window, 'pointermove', 120, innerHeight * .75, 7);
      touch($('tbFire'), 'pointerdown', innerWidth - 60, innerHeight - 170, 8);
      check('Touch fixture uses the real joystick and fire handlers', stickV.x > 0 && mouseDown && $('tbFire').classList.contains('on'));
      beginReplay(clip); const yaw = P.yaw;
      touch(window, 'pointermove', 170, innerHeight * .75, 7);
      touch(window, 'pointermove', innerWidth - 20, innerHeight - 170, 8);
      check('A replay releases active touch gestures and hides the old stick', !mouseDown && stickV.x === 0 && $('stick').hidden && !$('tbFire').classList.contains('on') && P.yaw === yaw);
      $('replaySkip').click();
      touch(window, 'pointermove', 200, innerHeight * .75, 7);
      touch(window, 'pointermove', innerWidth - 10, innerHeight - 170, 8);
      check('Old fingers cannot restart movement or aim after skipping', state === 'play' && stickV.x === 0 && P.yaw === yaw && !mouseDown);
    });
    scenario('Complete commentary archive', () => {
      zShow('A long punchline <that must survive> & its interruption.');
      const original = comedyTranscript.at(-1); zShow('Interrupting myself, again.');
      check('Muted commentary is readable immediately, without a typewriter delay', $('zztext').textContent === ZZ.text && ZZ.shown === ZZ.text.length);
      check('An interrupted line keeps its complete text and speaker', comedyTranscript.includes(original) && original.text.includes('<that must survive>') && original.who);
      say('A presenter line, even in silence.', true);
      check('Silent presenter lines are preserved too', comedyTranscript.at(-1).text === 'A presenter line, even in silence.');
      const html = broadcastNotebookHTML();
      check('Transcript text is escaped safely for the notebook', html.includes('&lt;that must survive&gt; &amp;') && !html.includes('<that must survive>'));
      die('bottle'); continueGame();
      check('PLEASE retains what the player heard, including the previous attempt', comedyTranscript.includes(original));
      reset(); check('A new run starts a fresh transcript and clip archive', !comedyTranscript.length && !replayArchive.length && !iceBodies.length);
    });
  } finally { window.setTimeout = oldTimer; Math.random = oldRandom; fresh(); autoReplays = oldAuto; T = oldT; }
  return out;
}
