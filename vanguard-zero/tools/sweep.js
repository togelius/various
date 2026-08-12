/* Capture every major screen and mechanic for review.
 * node tools/sweep.js <outdir>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/vzsweep';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const p = await b.newPage({ viewport: { width: 800, height: 470 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction('window.VZ && window.VZ.game');
  await p.waitForTimeout(600);

  const shot = n => p.screenshot({ path: path.join(OUT, n + '.png') });
  const set = (fn, arg) => p.evaluate(fn, arg);

  await shot('01_title');

  // controls page
  await set(() => { VZ.game.menu.page = 'controls'; });
  await p.waitForTimeout(200); await shot('02_controls');
  await set(() => { VZ.game.menu.page = 'main'; });

  // stage intro card
  await set(() => { const g = VZ.game; g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
    g.loadStage(0, false); g.setState('stageIntro'); });
  await p.waitForTimeout(900); await shot('03_stage_intro');

  // gameplay: each stage at a representative spot
  const spots = [
    [0, 14, 11, '04_s1_start'],
    [0, 82, 11, '05_s1_chimney'],
    [0, 104, 11, '06_s1_crumble'],
    [0, 140, 11, '07_s1_gauntlet'],
    [1, 40, 11, '08_s2_conveyor'],
    [1, 72, 11, '09_s2_flames'],
    [1, 100, 11, '10_s2_climb'],
    [2, 36, 11, '11_s3_spikes'],
    [2, 100, 11, '12_s3_crush'],
    [2, 140, 11, '13_s3_turrets']
  ];
  for (const [st, tx, ty, name] of spots) {
    await set(([s, x, y]) => {
      const g = VZ.game; g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
      if (g.stageIndex !== s || g.state !== 'play') { g.loadStage(s, true); g.setState('play'); }
      g.player.unlocked = [true, true, true];
      g.player.x = x * 16 + 8; g.player.y = y * 16 + 5;
      g.player.vx = 0; g.player.vy = 0; g.player.hp = g.player.maxHp;
      g.camera.follow(g.player, true);
    }, [st, tx, ty]);
    await p.waitForTimeout(1100);
    await set(() => { VZ.fx.flashAlpha = 0; VZ.game.player.hp = VZ.game.player.maxHp; });
    await p.waitForTimeout(60);
    await shot(name);
  }

  // charged shot
  await set(() => {
    const g = VZ.game; g.loadStage(0, true); g.setState('play');
    g.player.x = 20 * 16; g.player.y = 11 * 16 + 5; g.camera.follow(g.player, true);
    g.player.charge = 90; g.player.chargeLevel = 2; g.player.shootTimer = 20;
  });
  await p.waitForTimeout(500);
  await set(() => { VZ.game.player.chargeLevel = 2; VZ.game.player.shootTimer = 20; });
  await p.waitForTimeout(100); await shot('14_charge');
  await set(() => { VZ.game.player.fire(2); });
  await p.waitForTimeout(180); await shot('15_charge_shot');

  // sub-weapons
  await set(() => { const g = VZ.game; g.player.weapon = 1; g.player.fireSpecial(); });
  await p.waitForTimeout(180); await shot('16_spread');
  await set(() => { const g = VZ.game; g.player.weapon = 2; g.player.fireCool = 0; g.player.fireSpecial(); });
  await p.waitForTimeout(160); await shot('17_lance');

  // bosses mid-fight
  for (const [st, name] of [[0, '18_boss_aegis'], [1, '19_boss_golem'], [2, '20_boss_prime']]) {
    await set((s) => {
      const g = VZ.game; g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
      g.loadStage(s, true); g.setState('play');
      g.player.x = g.arena.x0 - 30; g.player.y = g.arena.y1 - 16;
      g.camera.follow(g.player, true);
      VZ.input.virtual = { right: true };
    }, st);
    await p.waitForTimeout(1400);
    await set(() => { VZ.input.virtual = {}; if (VZ.game.boss) VZ.game.boss.hp = Math.round(VZ.game.boss.maxHp * 0.45); });
    await p.waitForTimeout(2400);
    await set(() => { VZ.fx.flashAlpha = 0; VZ.game.player.hp = VZ.game.player.maxHp; });
    await p.waitForTimeout(60);
    await shot(name);
  }

  // pause + results + game over + ending
  await set(() => { VZ.game.paused = true; VZ.game.pauseIndex = 0; });
  await p.waitForTimeout(200); await shot('21_pause');
  await set(() => { VZ.game.paused = false; });

  await set(() => { const g = VZ.game; g.stageTime = 60 * 96; g.damageTaken = 4;
    g.player.kills = 18; g.finishStage(); });
  await p.waitForTimeout(4200); await shot('22_results');

  await set(() => { const g = VZ.game; g.score = 128400; g.setState('gameOver'); });
  await p.waitForTimeout(1400); await shot('23_gameover');

  await set(() => { const g = VZ.game; g.score = 214800; g.setState('ending'); g.endingScroll = 200; });
  await p.waitForTimeout(900); await shot('24_ending');

  console.log('captured ' + fs.readdirSync(OUT).length + ' frames');
  console.log('--- errors ---');
  console.log(errs.length ? [...new Set(errs)].slice(0, 10).join('\n') : 'none');
  await b.close();
})();
