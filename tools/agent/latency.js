/* Difficulty as a gradient, not a number.
 *
 * A planner with frame-exact execution and full state access measures a lower
 * bound: how much a section costs when nothing is missed. That is a real
 * quantity - it is how much slack the design leaves - but it is not what a
 * person experiences, and making the agent better only moves it further away.
 *
 * So sweep the one thing that separates the two. `latency` holds every
 * observation for N frames before the planner sees it, while it still acts
 * now: the same loop delay a hand-eye path has. Run each section at several
 * values of N and look at how fast it falls apart.
 *
 *   - steep gradient  -> a reflex wall. Fine when you know what is coming,
 *                        ruinous when your hands are a few frames behind.
 *   - flat but costly -> a knowledge wall. Expensive even played perfectly,
 *                        and no worse for being slow about it.
 *   - flat and cheap  -> the section is not doing anything.
 *
 * Those are different design problems, and deaths-at-zero-latency cannot tell
 * them apart.
 *
 *   node tools/agent/latency.js [--trials=N] [--steps=0,2,4,6] [--json=path]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AGENT_SRC = ['sim.js', 'plan.js', 'world.js', 'pilot.js']
  .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');

function arg(n, d) {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : d;
}

const SECTIONS = [
  ['Opening', 'Gap run', 'Wall-jump chimney', 'Crumble + spikes', 'Turret gauntlet', 'Run-up', 'Boss arena'],
  ['Opening', 'Conveyors', 'Flame vents', 'Lava climb', 'Lava bridge', 'Run-up', 'Boss arena'],
  ['Opening', 'Spike corridor', 'Void ascent', 'Crumble bridge', 'Turret + shielders', 'Run-up', 'Boss arena']
];

const RUN = async ({ stage, lives, params, maxFrames }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = lives; g.score = 0; g.player = null;
  g.loadStage(stage, false);
  g.player.unlocked = [true, true, true];
  g.setState('play');

  const pilot = new AGENT.Pilot(g, params);
  let frames = 0, finished = null;
  while (frames < maxFrames) {
    if (g.fadeCb && Math.abs(g.fade - g.fadeTarget) > 0.001) g.fade = g.fadeTarget;
    pilot.tick(); g.update(); frames++;
    if (g.stageIndex !== stage) { finished = 'cleared'; break; }
    if (g.state === 'results' || g.state === 'ending') { finished = 'cleared'; break; }
    if (g.state === 'gameOver') { finished = 'gameOver'; break; }
    if (frames % 20000 === 0) await new Promise(r => setTimeout(r, 0));
  }
  const t = pilot.tele;
  return {
    finished, frames,
    deaths: t.deaths.map(d => ({ stage: d.stage, section: d.section, cause: d.cause })),
    damage: t.damage.map(d => ({ stage: d.stage, section: d.section, amount: d.amount })),
    sectionFrames: t.sectionFrames
  };
};

function bar(v, max, w) {
  const n = max > 0 ? Math.round((v / max) * w) : 0;
  return '#'.repeat(Math.min(w, n)).padEnd(w, '.');
}

/* One latency setting per process is the only practical way to run this:
 * a single sweep is hours of wall clock and the settings are independent. */
function merge(paths) {
  const cell = {}, clears = {};
  let steps = [];
  paths.forEach(p => {
    const part = JSON.parse(fs.readFileSync(p, 'utf8'));
    steps = steps.concat(part.steps);
    Object.keys(part.clears).forEach(k => { clears[k] = part.clears[k]; });
    Object.keys(part.cell).forEach(k => {
      cell[k] = cell[k] || {};
      Object.keys(part.cell[k]).forEach(l => { cell[k][l] = part.cell[k][l]; });
    });
  });
  steps = [...new Set(steps)].sort((a, b) => a - b);
  return { steps, cell, clears };
}

async function main() {
  const trials = parseInt(arg('trials', '5'), 10);
  const lives = parseInt(arg('lives', '9'), 10);
  const seconds = parseInt(arg('seconds', '320'), 10);
  const steps = arg('steps', '0,3,6,9').split(',').map(Number);

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

  // cell[stage|section][latency] = {deaths, dmg, visits}
  const cell = {};
  const clears = {};
  for (const lat of steps) {
    clears[lat] = [0, 0, 0];
    for (let stage = 0; stage < 3; stage++) {
      for (let t = 0; t < trials; t++) {
        const r = await page.evaluate(RUN, {
          stage, lives, params: { latency: lat }, maxFrames: seconds * 60
        });
        if (r.finished === 'cleared') clears[lat][stage]++;
        r.deaths.forEach(d => {
          const k = d.stage + '|' + d.section;
          (cell[k] = cell[k] || {})[lat] = cell[k][lat] || { deaths: 0, dmg: 0, visits: 0 };
          cell[k][lat].deaths++;
        });
        r.damage.forEach(d => {
          const k = d.stage + '|' + d.section;
          (cell[k] = cell[k] || {})[lat] = cell[k][lat] || { deaths: 0, dmg: 0, visits: 0 };
          cell[k][lat].dmg += d.amount;
        });
        Object.keys(r.sectionFrames).forEach(sk => {
          const [st, se] = sk.split(':');
          const k = st + '|' + se;
          (cell[k] = cell[k] || {})[lat] = cell[k][lat] || { deaths: 0, dmg: 0, visits: 0 };
          cell[k][lat].visits++;
        });
      }
      process.stdout.write('.');
    }
    process.stdout.write(' lat' + lat + '\n');
  }

  report({ steps, cell, clears }, trials, lives);
  const jsonPath = arg('json', '');
  if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify({ steps, cell, clears }, null, 1));
  if (errors.length) console.log('\n  errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await browser.close();
}

function report({ steps, cell, clears }, trials, lives) {
  console.log('\n============================================================');
  console.log('  VANGUARD ZERO - difficulty vs reaction latency');
  console.log('  ' + trials + ' runs per stage per setting, ' + lives + ' lives');
  console.log('============================================================\n');

  console.log('STAGE CLEARS (out of ' + trials + ')');
  console.log('  ' + 'latency'.padEnd(12) + steps.map(s => (s + 'f').padStart(7)).join(''));
  for (let st = 0; st < 3; st++) {
    console.log('  ' + ('stage ' + (st + 1)).padEnd(12) +
      steps.map(s => String(clears[s][st]).padStart(7)).join(''));
  }

  console.log('\nDEATHS PER VISIT, BY LATENCY');
  console.log('  ' + 'section'.padEnd(24) + steps.map(s => (s + 'f').padStart(7)).join('') +
    '   ' + 'gradient'.padStart(9));

  const rows = [];
  for (let st = 0; st < 3; st++) {
    for (let se = 0; se < 7; se++) {
      const k = st + '|' + se;
      if (!cell[k]) continue;
      const vals = steps.map(s => {
        const c = cell[k][s];
        return c && c.visits ? c.deaths / c.visits : 0;
      });
      const dmg = steps.map(s => {
        const c = cell[k][s];
        return c && c.visits ? c.dmg / c.visits : 0;
      });
      const span = steps[steps.length - 1] - steps[0] || 1;
      rows.push({
        label: (st + 1) + '-' + (SECTIONS[st][se] || se),
        vals, dmg,
        visits: steps.map(s => (cell[k][s] && cell[k][s].visits) || 0),
        base: vals[0],
        grad: (vals[vals.length - 1] - vals[0]) / span
      });
    }
  }
  rows.sort((a, b) => b.grad - a.grad);
  const maxGrad = Math.max(...rows.map(r => Math.abs(r.grad)), 0.001);
  rows.forEach(r => {
    console.log('  ' + r.label.padEnd(24) +
      r.vals.map(v => v.toFixed(2).padStart(7)).join('') + '   ' +
      r.grad.toFixed(3).padStart(6) + '/f ' + bar(Math.max(0, r.grad), maxGrad, 14));
  });

  /* Sections past a wall stop being sampled once the agent cannot get through
   * it, and a row of zeroes from one visit is not the same claim as a row of
   * zeroes from four. */
  console.log('\nVISITS BEHIND EACH NUMBER (out of ' + trials + ')');
  console.log('  ' + 'section'.padEnd(24) + steps.map(s => (s + 'f').padStart(7)).join(''));
  rows.forEach(r => {
    console.log('  ' + r.label.padEnd(24) +
      r.visits.map(v => String(v).padStart(7)).join('') +
      (r.visits.some(v => v < trials / 2) ? '   thin' : ''));
  });

  console.log('\nHP LOST PER VISIT, BY LATENCY');
  console.log('  ' + 'section'.padEnd(24) + steps.map(s => (s + 'f').padStart(7)).join(''));
  rows.slice().sort((a, b) => b.dmg[0] - a.dmg[0]).forEach(r => {
    console.log('  ' + r.label.padEnd(24) + r.dmg.map(v => v.toFixed(1).padStart(7)).join(''));
  });

  console.log('\n  latency is in frames of observation delay at 60Hz;');
  console.log('  9 frames is 150ms, around a human visual reaction time.');
  console.log('  gradient = extra deaths per visit per frame of delay. A steep');
  console.log('  gradient is a reflex wall; a flat but costly row is a section');
  console.log('  that is expensive however well you see it coming.');

}

const mergeArg = arg('merge', '');
if (mergeArg) {
  report(merge(mergeArg.split(',')),
         parseInt(arg('trials', '5'), 10), parseInt(arg('lives', '9'), 10));
} else {
  main();
}
