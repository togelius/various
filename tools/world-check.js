/* Does the projected world match the world that actually happens?
 *
 * Freezes the player, projects N frames, then lets the real game run those
 * same N frames and compares the hazard boxes frame by frame. Also checks the
 * projection left no trace: the RNG stream and the live entity lists must be
 * exactly where they were.
 *
 *   node tools/world-check.js [--frames=N] [--stage=N]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AGENT_SRC = ['sim.js', 'plan.js', 'world.js']
  .map(f => fs.readFileSync(path.join(__dirname, 'agent', f), 'utf8')).join('\n');
const arg = (n, d) => {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=')[1] : d;
};

const RUN = async ({ stage, frames }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = 9; g.player = null;
  g.loadStage(stage, false);
  g.setState('play');

  const report = [];
  // walk right a while so enemies are live, sampling as we go
  for (let warm = 0; warm < 6; warm++) {
    for (let i = 0; i < 90; i++) { VZ.input.virtual = { right: true }; g.update(); }
    VZ.input.virtual = {};

    const before = { rand: VZ.rand.state(), en: g.enemies.length, pr: g.projectiles.length };
    const predicted = AGENT.world.project(g, frames, 400);
    const after = { rand: VZ.rand.state(), en: g.enemies.length, pr: g.projectiles.length };

    // Now let reality run the same frames with the player standing still, and
    // record what actually showed up.
    const actual = [];
    const snapBoxes = () => {
      const out = [];
      g.projectiles.forEach(pr => {
        if (pr.remove || pr.warn > 0 || pr.team === 'player') return;
        const b = pr.box(); out.push([b.x, b.y, b.w, b.h, pr.damage || 1]);
      });
      g.enemies.forEach(e => {
        if (e.dead || !(e.contactDamage > 0)) return;
        const b = e.box(); out.push([b.x, b.y, b.w, b.h, e.contactDamage]);
      });
      return out;
    };
    for (let f = 0; f <= frames; f++) {
      actual.push(snapBoxes());
      if (f === frames) break;
      VZ.input.virtual = {};
      g.update();
    }

    /* Compare only what could actually have hit us. Anything the projection
       skipped for being out of radius, or that the game spawned from a trigger
       after the projection was taken, is not a modelling error - it is out of
       scope by construction. */
    const px = g.player.x, py = g.player.y;
    let missing = 0, n = 0, exact = 0;
    const offs = [];
    for (let f = 0; f < actual.length; f++) {
      const pb = predicted[f] || [];
      for (const a of actual[f]) {
        if (Math.abs(a[0] - px) > 300 || Math.abs(a[1] - py) > 300) continue;
        n++;
        let best = Infinity;
        for (const q of pb) {
          const d = Math.abs(q.x - a[0]) + Math.abs(q.y - a[1]);
          if (d < best) best = d;
        }
        if (best === Infinity || best > 24) missing++;
        else { offs.push(best); if (best === 0) exact++; }
      }
    }
    offs.sort((a, b) => a - b);
    const worst = offs.length ? offs[offs.length - 1] : 0;
    const median = offs.length ? offs[offs.length >> 1] : 0;
    report.push({
      sample: warm, boxes: n, exactPct: n ? Math.round(100 * exact / n) : 0,
      medianOffsetPx: +median.toFixed(2), worstOffsetPx: +worst.toFixed(2), unmatched: missing,
      leakedRand: before.rand !== after.rand,
      leakedEnemies: before.en !== after.en,
      leakedProjectiles: before.pr !== after.pr
    });
  }
  return report;
};

(async () => {
  const frames = parseInt(arg('frames', '46'), 10);
  const stage = parseInt(arg('stage', '0'), 10);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AGENT_SRC });

  console.log('\nWORLD PROJECTION CHECK  (' + frames + ' frames ahead, stage ' + (stage + 1) + ')\n');
  const rows = await page.evaluate(RUN, { stage, frames });
  rows.forEach(r => {
    console.log('  sample ' + r.sample + ': ' + String(r.boxes).padStart(4) + ' in-range boxes  ' +
      String(r.exactPct).padStart(3) + '% exact  median ' + String(r.medianOffsetPx).padStart(5) +
      'px  worst ' + String(r.worstOffsetPx).padStart(6) + 'px  unmatched ' + r.unmatched +
      (r.leakedRand || r.leakedEnemies || r.leakedProjectiles ? '   !! LEAKED' : ''));
  });
  const leaked = rows.some(r => r.leakedRand || r.leakedEnemies || r.leakedProjectiles);
  console.log('\n  side effects on the live game: ' + (leaked ? 'YES - projection is not clean' : 'none'));
  if (errors.length) console.log('  errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await browser.close();
})();
