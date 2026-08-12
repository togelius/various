/* What kind of difficulty is each part of the game made of?
 *
 * Deaths at full agent capability measure only how much slack the design
 * leaves. What a person meets is that slack minus their own limits, and the
 * limits are not interchangeable. So degrade the agent along one axis at a
 * time and watch which sections fall over:
 *
 *   dexterity  - forced action repetition, drawn from a gaussian whose
 *                standard deviation is the setting. A motor-bandwidth limit:
 *                it corrupts execution itself, every frame. After Isaksen et
 *                al.'s dexterity/strategy model as used by Talakat.
 *   strategy   - how much search each decision is allowed. Talakat spends this
 *                in milliseconds of thinking time per frame; a node budget is
 *                the reproducible equivalent, since wall-clock inside a
 *                headless run at many times realtime means nothing.
 *   latency    - how stale the agent's picture of the world is. Talakat files
 *                "quick reactions" under dexterity but its action-repetition
 *                error does not actually delay information, so this covers the
 *                half of the concept that one leaves out.
 *
 * Also reports `entropy`, the information entropy of the first, second and
 * third derivatives of the action sequence - Talakat's feature of the same
 * name. It is a demand measure rather than a failure measure, and it is the
 * only column here that costs one ordinary run instead of a sweep.
 *
 *   node tools/agent/skills.js --axis=dex --level=6 --json=out.json
 *   node tools/agent/skills.js --merge=a.json,b.json,...
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

// The 32-tile chunks the stages were authored in, in play order.
const SECTIONS = [
  ['Opening', 'Gap run', 'Wall-jump chimney', 'Crumble + spikes', 'Turret gauntlet', 'Run-up', 'Aegis Drone'],
  ['Opening', 'Conveyors', 'Flame vents', 'Lava climb', 'Lava bridge', 'Run-up', 'Forge Golem'],
  ['Opening', 'Spike corridor', 'Void ascent', 'Crumble bridge', 'Turret + shielders', 'Run-up', 'Vanguard Prime']
];

// One knob per axis. `0` is always "no impairment".
const AXES = {
  dex:      { param: 'dexSigma',    levels: [0, 2, 6, 10] },   // Talakat: 2/6/10
  strategy: { param: 'searchNodes', levels: [200, 60, 20, 8] },
  latency:  { param: 'latency',     levels: [0, 3, 6, 9] }
};

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
    finished,
    deaths: t.deaths.map(d => ({ stage: d.stage, section: d.section })),
    damage: t.damage.map(d => ({ stage: d.stage, section: d.section, amount: d.amount })),
    sectionFrames: t.sectionFrames,
    actions: t.actions
  };
};

// Shannon entropy of a {value: count} histogram, in bits, normalised so that a
// flat distribution over the observed support scores 1.
function entropyOf(hist) {
  const counts = Object.values(hist);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 8 || counts.length < 2) return 0;
  let h = 0;
  counts.forEach(c => { const pr = c / total; h -= pr * Math.log2(pr); });
  return h / Math.log2(counts.length);
}

function blank() { return { deaths: 0, dmg: 0, visits: 0, ent: 0, entN: 0 }; }

async function collect({ axis, level, trials, lives, seconds }) {
  const spec = AXES[axis];
  if (!spec) throw new Error('unknown axis ' + axis);
  const params = {};
  params[spec.param] = level;

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

  const cell = {}, clears = [0, 0, 0];
  for (let stage = 0; stage < 3; stage++) {
    for (let t = 0; t < trials; t++) {
      const r = await page.evaluate(RUN, { stage, lives, params, maxFrames: seconds * 60 });
      if (r.finished === 'cleared') clears[stage]++;
      const touch = k => (cell[k] = cell[k] || blank());
      r.deaths.forEach(d => { touch(d.stage + '|' + d.section).deaths++; });
      r.damage.forEach(d => { touch(d.stage + '|' + d.section).dmg += d.amount; });
      Object.keys(r.sectionFrames).forEach(sk => {
        const [st, se] = sk.split(':');
        touch(st + '|' + se).visits++;
      });
      Object.keys(r.actions).forEach(sk => {
        const [st, se] = sk.split(':');
        const c = touch(st + '|' + se);
        const a = r.actions[sk];
        const e = (entropyOf(a.d1) + entropyOf(a.d2) + entropyOf(a.d3)) / 3;
        if (e > 0) { c.ent += e; c.entN++; }
      });
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');
  await browser.close();
  return { axis, level, param: spec.param, cell, clears, errors: [...new Set(errors)].slice(0, 3) };
}

// ------------------------------------------------------------------ report
function merge(paths) {
  const out = {};
  paths.forEach(p => {
    const part = JSON.parse(fs.readFileSync(p, 'utf8'));
    out[part.axis] = out[part.axis] || { levels: [], by: {}, clears: {} };
    out[part.axis].levels.push(part.level);
    out[part.axis].by[part.level] = part.cell;
    out[part.axis].clears[part.level] = part.clears;
  });
  /* The unimpaired run is the same run for all three axes - dexterity 0,
   * strategy 200 and latency 0 are one configuration - so it is measured once
   * and shared, rather than paid for three times. */
  const baseAxis = Object.keys(out).find(k => out[k].by[AXES[k].levels[0]]);
  Object.keys(out).forEach(k => {
    const zero = AXES[k].levels[0];
    if (!out[k].by[zero] && baseAxis) {
      out[k].by[zero] = out[baseAxis].by[AXES[baseAxis].levels[0]];
      out[k].clears[zero] = out[baseAxis].clears[AXES[baseAxis].levels[0]];
      out[k].levels.push(zero);
    }
  });
  Object.values(out).forEach(a => {
    a.levels = [...new Set(a.levels)];
    a.levels.sort((x, y) => AXES[Object.keys(out).find(k => out[k] === a)].levels.indexOf(x) -
                            AXES[Object.keys(out).find(k => out[k] === a)].levels.indexOf(y));
  });
  return out;
}

function per(c, field) { return c && c.visits ? c[field] / c.visits : 0; }

function bar(v, max, w) {
  const n = max > 0 ? Math.round((v / max) * w) : 0;
  return '#'.repeat(Math.min(w, Math.max(0, n))).padEnd(w, '.');
}

function report(data) {
  const order = [];
  for (let st = 0; st < 3; st++) for (let se = 0; se < 7; se++) order.push([st, se]);

  console.log('\n============================================================');
  console.log('  VANGUARD ZERO - what kind of difficulty, section by section');
  console.log('============================================================');

  Object.keys(data).forEach(axis => {
    const a = data[axis];
    const levels = a.levels;
    console.log('\n' + axis.toUpperCase() + '  (' + AXES[axis].param + ' = ' +
      levels.join(', ') + ')   deaths per visit');
    console.log('  ' + 'section'.padEnd(24) + levels.map(l => String(l).padStart(7)).join('') +
      '   ' + 'visits at worst'.padStart(16));
    order.forEach(([st, se]) => {
      const k = st + '|' + se;
      const vals = levels.map(l => per(a.by[l] && a.by[l][k], 'deaths'));
      if (!levels.some(l => a.by[l] && a.by[l][k])) return;
      const lastV = (a.by[levels[levels.length - 1]] || {})[k];
      console.log('  ' + ((st + 1) + '-' + SECTIONS[st][se]).padEnd(24) +
        vals.map(v => v.toFixed(2).padStart(7)).join('') +
        String(lastV ? lastV.visits : 0).padStart(16));
    });
    console.log('  ' + 'stage clears'.padEnd(24) +
      levels.map(l => (a.clears[l] || []).join('/').padStart(7)).join(''));
  });

  // entropy is axis-independent; take it from the unimpaired run
  const base = (data.dex && data.dex.by[0]) || (data.latency && data.latency.by[0]) || {};
  console.log('\nINPUT DEMAND  (entropy of the 1st/2nd/3rd derivatives of the action sequence)');
  const ents = order.map(([st, se]) => {
    const c = base[st + '|' + se];
    return { label: (st + 1) + '-' + SECTIONS[st][se], e: c && c.entN ? c.ent / c.entN : 0 };
  }).filter(r => r.e > 0);
  const maxE = Math.max(...ents.map(r => r.e), 0.001);
  ents.forEach(r => console.log('  ' + r.label.padEnd(24) + r.e.toFixed(3).padStart(7) +
    '   ' + bar(r.e, maxE, 24)));
}

async function main() {
  const mergeArg = arg('merge', '');
  if (mergeArg) {
    const data = merge(mergeArg.split(','));
    report(data);
    const out = arg('json', '');
    if (out) fs.writeFileSync(out, JSON.stringify({ data, SECTIONS, AXES }, null, 1));
    return;
  }
  const res = await collect({
    axis: arg('axis', 'dex'),
    level: parseFloat(arg('level', '0')),
    trials: parseInt(arg('trials', '4'), 10),
    lives: parseInt(arg('lives', '9'), 10),
    seconds: parseInt(arg('seconds', '320'), 10)
  });
  const out = arg('json', '');
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(res.axis + ' ' + res.level + ': clears ' + res.clears.join('/') +
    (res.errors.length ? '  errors: ' + res.errors.join(' | ') : ''));
}

main();
