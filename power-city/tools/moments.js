/* Photograph every screen the game can show, so none of them rot unseen.
 * usage: node tools/moments.js <outdir>
 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp';
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    PC.audio.enabled = false;
    PC.game.loop.stop();
    PC.input.poll = function () { };
    window.__setup = function (stage) {
      PC.game.coin(); PC.game.coin(); PC.game.coin();
      PC.game.startGame(0);
      PC.stage.load(stage); PC.game.stageIndex = stage;
      PC.game.setState('play');
      const p = PC.game.players[0];
      p.reviveAt(300, PC.FLOOR_BOT - 18); p.invuln = 0;
      PC.world.add(p);
      PC.world.camX = 210; PC.stage.locked = true; PC.stage.lockX = 210;
      return p;
    };
    window.__freeze = function (e) { e.control = function () { this.setState('idle'); this.vx = 0; this.vy = 0; }; return e; };
    window.__run = function (n) { for (let i = 0; i < n; i++) PC.game.update(); PC.game.render(); };
  });
  const shot = async (name, fn) => {
    await page.evaluate(fn);
    const el = await page.$('#screen');
    await el.screenshot({ path: path.join(out, name) });
  };

  await shot('m1-ready.png', () => {
    PC.game.coin(); PC.game.startGame(0); PC.game.stateT = 120; PC.game.render();
  });
  await shot('m2-boss.png', () => {
    __setup(0);
    const b = PC.spawnEnemy('crusher', 420, PC.FLOOR_BOT - 24, { facing: -1 });
    PC.stage.bossActive = b; PC.stage.bossBanner = 80; b.invuln = 40;
    __freeze(b); __run(2);
  });
  await shot('m3-grab.png', () => {
    const p = __setup(1);
    const e = __freeze(PC.spawnEnemy('punk', 318, PC.FLOOR_BOT - 18, { facing: -1 }));
    __freeze(PC.spawnEnemy('rough', 380, PC.FLOOR_BOT - 40, { facing: -1 }));
    __run(2); p.facing = 1; p.beginGrab(e); __run(3);
  });
  await shot('m4-weapon.png', () => {
    const p = __setup(2);
    const it = PC.items.spawn('weapon', 'bat', 300, p.y);
    PC.items.take(p, it);
    __freeze(PC.spawnEnemy('brute', 340, PC.FLOOR_BOT - 20, { facing: -1 }));
    __freeze(PC.spawnEnemy('knifer', 400, PC.FLOOR_BOT - 44, { facing: -1 }));
    __run(2); p.facing = 1; p.startAttack(PC.MOVES.batSwing);
    for (let i = 0; i < 8; i++) PC.game.update();
    PC.world.hitstop = 30; PC.game.render();
  });
  await shot('m5-dizzy.png', () => {
    __setup(3);
    const e = __freeze(PC.spawnEnemy('rough', 340, PC.FLOOR_BOT - 20, { facing: -1 }));
    e.stunned = 1; e.dizzyT = 100; e.setState('dizzy');
    const f = __freeze(PC.spawnEnemy('batter', 260, PC.FLOOR_BOT - 40, { facing: 1 }));
    f.knockDown(-1, { vx: 3, vz: 3.4 });
    __run(14);
  });
  await shot('m6-twoplayer.png', () => {
    __setup(1);
    PC.game.joinPlayer(1);
    const p2 = PC.game.players[1];
    p2.x = 250; p2.y = PC.FLOOR_BOT - 34; p2.invuln = 0;
    __freeze(PC.spawnEnemy('punk', 330, PC.FLOOR_BOT - 30, { facing: -1 }));
    __freeze(PC.spawnEnemy('knifer', 390, PC.FLOOR_BOT - 12, { facing: -1 }));
    __run(4);
  });
  await shot('m7-clear.png', () => {
    __setup(0); PC.game.setState('clear'); PC.game.stateT = 60; PC.stage.timeLeft = 42; PC.game.render();
  });
  await shot('m8-continue.png', () => {
    __setup(2); PC.game.setState('continue'); PC.game.continueT = 7 * 60; PC.game.stateT = 20; PC.game.render();
  });
  await shot('m9-ending.png', () => {
    __setup(3); PC.game.setState('ending'); PC.game.stateT = 340; PC.game.scores[0] = 128400; PC.game.render();
  });
  await shot('m10-docks.png', () => {
    const p = __setup(2);
    PC.world.camX = 900; PC.stage.lockX = 900;
    p.x = 990; p.y = PC.FLOOR_BOT - 20;
    __freeze(PC.spawnEnemy('batter', 1060, PC.FLOOR_BOT - 34, { facing: -1 }));
    __freeze(PC.spawnEnemy('punk', 1120, PC.FLOOR_BOT - 8, { facing: -1 }));
    PC.items.spawn('prop', 'drum', 1040, PC.FLOOR_BOT - 44);
    __run(4);
  });
  await browser.close();
  console.log(errs.length ? errs.join('\n') : 'ok');
})();
