/* Prove the agent's physics model matches the real game.
 *
 * Drives the live player and a sim state with byte-identical random input for
 * hundreds of frames and reports the worst positional divergence. If this is
 * not ~0, every plan the agent makes is fiction.
 *
 *   node tools/sim-check.js [trials]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TRIALS = parseInt(process.argv[2] || '24', 10);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 700, height: 420 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));

  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: fs.readFileSync('tools/agent/sim.js', 'utf8') });

  const result = await page.evaluate(async (trials) => {
    const g = VZ.game, S = AGENT.sim;
    const out = [];

    // Deterministic input stream so a failure is reproducible.
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let t = 0; t < trials; t++) {
      const stage = t % 3;
      g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
      g.loadStage(stage, false);
      g.setState('play');
      // Physics only: no enemies, no projectiles, no damage.
      g.spawnDefs.length = 0;
      g.enemies.length = 0;
      g.projectiles.length = 0;
      g.pickups.length = 0;

      const p = g.player;
      // Park somewhere walkable and let it settle.
      const startX = 40 + Math.floor(rnd() * 120) * 16;
      p.x = startX; p.y = 11 * 16 + 5;
      p.vx = 0; p.vy = 0; p.invuln = 99999; p.spawnTimer = 0;

      // settle for a few frames with no input
      VZ.input.virtual = {};
      for (let i = 0; i < 12; i++) { VZ.input.poll(); p.update(); }
      if (p.dead) { t--; continue; }   // landed somewhere fatal; reroll

      // seed the sim from the live player's exact state
      const s = S.newState(g.level, p.x, p.y);
      s.vx = p.vx; s.vy = p.vy; s.grounded = p.grounded; s.facing = p.facing;
      s.coyote = p.coyote; s.airDash = p.airDash;
      s.dashTime = p.dashTime; s.dashCool = p.dashCool;
      s.ctrlLock = p.ctrlLock; s.wallStick = p.wallStick;
      s.wallCoyote = p.wallCoyote; s.lastWall = p.lastWall; s.noCut = p.noCut;
      s.jumpBuf = VZ.input.buffer.jump;
      s.prevJump = VZ.input.held.jump; s.prevDash = VZ.input.held.dash;

      let worst = 0, worstFrame = -1, divergedAt = -1;
      const FRAMES = 260;
      // Random but sticky inputs, so we get real runs, jumps and dashes rather
      // than noise that averages out.
      let hold = { left: false, right: false, jump: false, dash: false, down: false };
      for (let f = 0; f < FRAMES; f++) {
        if (f % 7 === 0) {
          const r = rnd();
          hold = {
            left: r < 0.25, right: r >= 0.25 && r < 0.6,
            jump: rnd() < 0.45, dash: rnd() < 0.15, down: rnd() < 0.08
          };
        }
        if (rnd() < 0.12) hold.jump = !hold.jump;

        VZ.input.virtual = Object.assign({}, hold);
        VZ.input.poll();
        p.update();
        S.step(s, hold);

        // The live player dying resets things the sim doesn't model; stop there.
        if (p.dead || s.dead) { divergedAt = -1; break; }

        const d = Math.max(Math.abs(p.x - s.body.x), Math.abs(p.y - s.body.y));
        if (d > worst) { worst = d; worstFrame = f; }
        if (d > 0.5 && divergedAt < 0) divergedAt = f;
      }
      out.push({ stage, startX, worst: +worst.toFixed(4), worstFrame, divergedAt });
    }
    return out;
  }, TRIALS);

  const worst = Math.max(...result.map(r => r.worst));
  const bad = result.filter(r => r.worst > 0.01);
  console.log('trials: ' + result.length);
  console.log('worst positional divergence across all trials: ' + worst.toFixed(4) + ' px');
  if (bad.length) {
    console.log('\ntrials that drifted:');
    bad.slice(0, 10).forEach(r => console.log('  ' + JSON.stringify(r)));
  }
  console.log('\n--- errors ---');
  console.log(errors.length ? [...new Set(errors)].slice(0, 5).join('\n') : 'none');
  await browser.close();
  process.exit(worst > 0.01 ? 1 : 0);
})();
