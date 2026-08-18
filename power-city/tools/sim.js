/* Fast-forward POWER CITY headlessly with a bot at the controls.
 * usage: node tools/sim.js <outdir> [frames] [startStage]
 *
 * The game loop is stopped and update() is called by hand, so a whole stage
 * runs in a couple of seconds and every crash surfaces at once.
 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp';
  const frames = parseInt(process.argv[3] || '12000', 10);
  const startStage = parseInt(process.argv[4] || '0', 10);
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(1000);

  await page.evaluate((startStage) => {
    window.__log = [];
    PC.audio.enabled = false;
    PC.game.loop.stop();
    // ---- bot: walk right, close on the nearest enemy, hit it
    const B = { punchT: 0 };
    PC.input.poll = function () {
      const st = this.p[0];
      for (const k in st.held) { st.held[k] = false; st.pressed[k] = false; }
      st.tapDir = 0;
      this.coin = false; this.pause = false; this.mute = false; this.fullscreen = false;
      const g = PC.game, p = g.players[0];
      if (g.state === 'title' || g.state === 'continue' || g.state === 'over') {
        if (PC.world.time % 40 === 0) { st.pressed.start = true; st.held.start = true; this.coin = true; }
        return;
      }
      if (!p || p.dead) return;
      const es = PC.world.enemies();
      let t = null, bd = 1e9;
      for (const e of es) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y); if (d < bd) { bd = d; t = e; } }
      if (!t) { st.held.right = true; return; }
      const dx = t.x - p.x, dy = t.y - p.y;
      if (Math.abs(dy) > 5) { if (dy > 0) st.held.down = true; else st.held.up = true; }
      const want = 20;
      if (Math.abs(dx) > want) { if (dx > 0) st.held.right = true; else st.held.left = true; }
      if (Math.abs(dx) < want + 8 && Math.abs(dy) < 12) {
        B.punchT++;
        if (B.punchT % 9 === 0) { st.pressed.punch = true; st.held.punch = true; }
        if (B.punchT % 47 === 0) { st.pressed.kick = true; st.held.kick = true; }
      }
      // back off a touch when hurt so the bot does not just die in a corner
      if (p.hp < 25 && PC.world.time % 120 < 40) { st.held.left = true; st.held.right = false; }
    };
    if (startStage > 0) { PC.game.stageIndex = startStage; }
  }, startStage);

  // start the game, jump to the requested stage
  await page.evaluate((startStage) => {
    PC.game.coin();
    PC.game.startGame(0);
    if (startStage > 0) {
      PC.game.stageIndex = startStage;
      PC.stage.load(startStage);
      const p = PC.game.players[0];
      p.reviveAt(60, PC.FLOOR_BOT - 16);
      PC.world.add(p);
      PC.game.setState('play');
    }
  }, startStage);

  const step = async (n) => page.evaluate((n) => {
    const marks = [];
    for (let i = 0; i < n; i++) {
      PC.game.update();
      if (i % 600 === 0) marks.push({
        f: i, st: PC.game.state, stage: PC.stage.index, enc: PC.stage.encIndex,
        cam: Math.round(PC.world.camX), hp: PC.game.players[0] ? Math.round(PC.game.players[0].hp) : -1,
        lives: PC.game.lives[0], en: PC.world.enemies().length, sc: PC.game.scores[0],
        t: PC.stage.timeLeft
      });
    }
    PC.game.render();
    return marks;
  }, n);

  const shot = async (name) => { const el = await page.$('#screen'); await el.screenshot({ path: path.join(out, name) }); };

  const chunk = 1500;
  for (let done = 0; done < frames; done += chunk) {
    const marks = await step(Math.min(chunk, frames - done));
    marks.forEach(m => console.log(JSON.stringify(m)));
    await shot('sim-' + String(done).padStart(6, '0') + '.png');
    if (errs.length) break;
  }
  await browser.close();
  if (errs.length) { console.log('--- errors ---\n' + [...new Set(errs)].join('\n')); process.exitCode = 1; }
  else console.log('no errors');
})();
