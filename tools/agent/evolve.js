/* Evolve the agent's parameter genome.
 *
 * Navigation is solved by search, so what is left to tune is judgement: how
 * much risk to accept near an enemy, how long to linger, how to space a boss.
 * Those have no exact model, which is what makes them worth evolving.
 *
 * Mutation is deliberately two-part:
 *   - automatic gaussian jitter, for local refinement
 *   - a hand-written `--inject` genome, for when reading the telemetry says a
 *     specific dial is the problem. That is the operator Claude drives between
 *     generations.
 *
 *   node tools/agent/evolve.js [--gens=N] [--pop=N] [--trials=N] [--lives=N]
 *                             [--seed=path] [--out=path] [--inject=json]
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

// Genes the search cannot decide for itself, with sane bounds.
const GENES = {
  wDist: [0.4, 2.5], wTime: [0.1, 2.0],
  wSpike: [200, 2500], wEnemy: [40, 900], enemyMargin: [0, 14],
  wShot: [0, 600], wPit: [0, 400],
  wCrumbleEnd: [100, 1200], wCrumbleFresh: [0, 200],
  crumbleHaste: [1, 14], spikeHaste: [1, 25], wWait: [0, 200],
  fireOn: [2, 9], fireOff: [1, 8],
  bossMin: [24, 90], bossMax: [70, 170],
  bossJump: [16, 90], bossHop: [10, 60], bossIdleJump: [40, 300],
  bossFireOn: [2, 9], bossFireOff: [1, 8],
  bossCharge: [0, 1], bossAlign: [0, 90], bossBand: [0, 700], bossClear: [0, 22],
  retreatHp: [0, 10], devX: [3, 14], devY: [4, 18]
};
const KEYS = Object.keys(GENES);

function clampGene(k, v) {
  const [lo, hi] = GENES[k];
  return Math.max(lo, Math.min(hi, v));
}
function mutate(g, rate, scale) {
  const out = Object.assign({}, g);
  KEYS.forEach(k => {
    if (Math.random() > rate) return;
    const [lo, hi] = GENES[k];
    const span = (hi - lo) * scale;
    out[k] = clampGene(k, out[k] + (Math.random() * 2 - 1) * span);
  });
  return out;
}
function crossover(a, b) {
  const out = {};
  KEYS.forEach(k => { out[k] = Math.random() < 0.5 ? a[k] : b[k]; });
  return out;
}
function round(g) {
  const o = {};
  KEYS.forEach(k => { o[k] = Math.round(g[k] * 1000) / 1000; });
  return o;
}

const RUN_IN_PAGE = async ({ params, lives, maxFrames }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = lives; g.score = 0; g.player = null;
  g.loadStage(0, false);
  g.setState('play');
  const pilot = new AGENT.Pilot(g, params);
  let frames = 0, lastStage = 0, finished = null, cleared = 0;
  while (frames < maxFrames) {
    if (g.fadeCb && Math.abs(g.fade - g.fadeTarget) > 0.001) g.fade = g.fadeTarget;
    pilot.tick(); g.update(); frames++;
    if (g.stageIndex !== lastStage) {
      cleared++; lastStage = g.stageIndex; pilot.reset(); pilot.fieldStage = -1;
    }
    if (g.state === 'ending') { finished = 'ending'; cleared = 3; break; }
    if (g.state === 'gameOver') { finished = 'gameOver'; break; }
    if (frames % 20000 === 0) await new Promise(r => setTimeout(r, 0));
  }
  const reach = (pilot.tele.maxX['s' + g.stageIndex] || 0) / g.level.pixelW;
  return {
    cleared, reach, frames, finished,
    deaths: pilot.tele.deaths.length,
    damage: pilot.tele.damage.reduce((a, d) => a + d.amount, 0),
    stage: g.stageIndex
  };
};

function fitness(rs) {
  // Completing stages dominates; progress inside the current one breaks ties;
  // deaths and damage are the tiebreakers after that.
  let f = 0;
  rs.forEach(r => {
    f += r.cleared * 10000;
    f += Math.min(1, r.reach) * 1200;
    f -= r.deaths * 90;
    f -= r.damage * 2;
    f -= r.frames * 0.004;
    if (r.finished === 'ending') f += 8000;
  });
  return f / rs.length;
}

async function main() {
  const gens = parseInt(arg('gens', '6'), 10);
  const pop = parseInt(arg('pop', '10'), 10);
  const trials = parseInt(arg('trials', '2'), 10);
  const lives = parseInt(arg('lives', '5'), 10);
  const seconds = parseInt(arg('seconds', '520'), 10);
  const outPath = arg('out', 'tools/agent/best.json');

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

  // seed population
  const defaults = await page.evaluate(() => AGENT.DEFAULTS);
  let base = {};
  KEYS.forEach(k => { base[k] = defaults[k] !== undefined ? defaults[k] : (GENES[k][0] + GENES[k][1]) / 2; });
  const seedPath = arg('seed', '');
  if (seedPath && fs.existsSync(seedPath)) {
    base = Object.assign(base, JSON.parse(fs.readFileSync(seedPath, 'utf8')).genome || {});
    console.log('seeded from ' + seedPath);
  }
  const injectRaw = arg('inject', '');
  const injected = injectRaw ? JSON.parse(injectRaw) : null;

  base.bossCharge = 1;                 // measured far better than tap-firing
  let population = [base];
  if (injected) population.push(Object.assign({}, base, injected));
  while (population.length < pop) {
    population.push(mutate(base, 0.5, population.length < pop / 2 ? 0.12 : 0.3));
  }

  let bestEver = null, bestFit = -1e18;
  for (let gen = 0; gen < gens; gen++) {
    const scored = [];
    for (let i = 0; i < population.length; i++) {
      const rs = [];
      for (let t = 0; t < trials; t++) {
        rs.push(await page.evaluate(RUN_IN_PAGE, {
          params: population[i], lives, maxFrames: seconds * 60
        }));
      }
      const f = fitness(rs);
      scored.push({ g: population[i], f, rs });
      process.stdout.write(f > bestFit ? '!' : '.');
    }
    scored.sort((a, b) => b.f - a.f);
    if (scored[0].f > bestFit) { bestFit = scored[0].f; bestEver = scored[0].g; }

    const top = scored[0];
    const avgCleared = (top.rs.reduce((a, r) => a + r.cleared, 0) / top.rs.length).toFixed(1);
    const avgReach = (top.rs.reduce((a, r) => a + r.reach, 0) / top.rs.length * 100).toFixed(0);
    const avgDeaths = (top.rs.reduce((a, r) => a + r.deaths, 0) / top.rs.length).toFixed(1);
    console.log(`\ngen ${gen}: best fit ${top.f.toFixed(0)}  stages=${avgCleared}` +
      `  reach=${avgReach}%  deaths=${avgDeaths}  (pop best-to-worst ` +
      `${scored.map(s => s.f.toFixed(0)).slice(0, 5).join(' ')})`);

    // next generation: elites, crossover children, jittered mutants
    const elites = scored.slice(0, Math.max(2, Math.floor(pop * 0.3))).map(s => s.g);
    const next = elites.slice();
    while (next.length < pop) {
      const a = elites[Math.floor(Math.random() * elites.length)];
      const b = elites[Math.floor(Math.random() * elites.length)];
      const child = mutate(crossover(a, b), 0.35, 0.18);
      next.push(child);
    }
    population = next;
    fs.writeFileSync(outPath, JSON.stringify({ genome: round(bestEver), fitness: bestFit }, null, 2));
  }

  console.log('\nbest fitness ' + bestFit.toFixed(0));
  console.log(JSON.stringify(round(bestEver)));
  fs.writeFileSync(outPath, JSON.stringify({ genome: round(bestEver), fitness: bestFit }, null, 2));
  if (errors.length) console.log('errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await browser.close();
}

main();
