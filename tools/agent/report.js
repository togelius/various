/* Run the play agent many times and turn the telemetry into a difficulty
 * report: where it dies, where it bleeds health, where it spends its time.
 *
 *   node tools/agent/report.js [--trials=N] [--lives=N] [--stage=N|--full=1]
 *                             [--params=json] [--seconds=N] [--json=path]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AGENT_SRC = ['sim.js', 'plan.js', 'world.js', 'pilot.js']
  .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');

function arg(name, def) {
  const a = process.argv.find(s => s.startsWith('--' + name + '='));
  return a ? a.split('=').slice(1).join('=') : def;
}

// The 32-tile chunks the stages were authored in, so the numbers land on
// something a designer can actually go and edit.
const SECTIONS = [
  ['Opening', 'Gap run', 'Wall-jump chimney', 'Crumble + spikes', 'Turret gauntlet', 'Run-up', 'Boss arena'],
  ['Opening', 'Conveyors', 'Flame vents', 'Lava climb', 'Lava bridge', 'Run-up', 'Boss arena'],
  ['Opening', 'Spike corridor', 'Void ascent', 'Crumble bridge', 'Turret + shielders', 'Run-up', 'Boss arena']
];
const STAGE_NAMES = ['1 SKYFALL RIDGE', '2 MAGMA FOUNDRY', '3 VOID CITADEL'];

const RUN_IN_PAGE = async ({ stage, lives, params, maxFrames, fullGame }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = lives; g.score = 0; g.player = null;
  g.loadStage(stage, false);
  if (stage >= 1) g.player.unlocked[1] = true;
  if (stage >= 2) g.player.unlocked[2] = true;
  g.setState('play');

  const pilot = new AGENT.Pilot(g, params);
  let frames = 0, lastStage = g.stageIndex, finished = null;
  const started = { [g.stageIndex]: 0 };

  while (frames < maxFrames) {
    if (g.fadeCb && Math.abs(g.fade - g.fadeTarget) > 0.001) g.fade = g.fadeTarget;
    pilot.tick();
    g.update();
    frames++;
    if (g.stageIndex !== lastStage) {
      pilot.tele.cleared.push({ stage: lastStage, frames: frames - started[lastStage] });
      lastStage = g.stageIndex; started[lastStage] = frames;
      pilot.reset(); pilot.fieldStage = -1;
      if (!fullGame) { finished = 'cleared'; break; }
    }
    if (g.state === 'ending') { finished = 'ending'; break; }
    if (g.state === 'gameOver') { finished = 'gameOver'; break; }
    if (!fullGame && g.state === 'results') {
      pilot.tele.cleared.push({ stage: lastStage, frames: frames - started[lastStage] });
      finished = 'cleared'; break;
    }
    if (frames % 20000 === 0) await new Promise(r => setTimeout(r, 0));
  }
  const t = pilot.tele;
  t.frames = frames; t.finished = finished; t.endStage = g.stageIndex;
  t.score = g.score; t.livesLeft = g.lives; t.levelW = g.level.pixelW;
  return t;
};

function pct(n, d) { return d ? (100 * n / d).toFixed(0) + '%' : '-'; }
function bar(v, max, width) {
  const n = max > 0 ? Math.round((v / max) * width) : 0;
  return '#'.repeat(n) + '.'.repeat(Math.max(0, width - n));
}

async function main() {
  const trials = parseInt(arg('trials', '20'), 10);
  const lives = parseInt(arg('lives', '3'), 10);
  const seconds = parseInt(arg('seconds', '900'), 10);
  const fullGame = arg('full', '0') === '1';
  const stage = parseInt(arg('stage', '0'), 10);
  const params = arg('params', '') ? JSON.parse(arg('params')) : {};

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AGENT_SRC });

  const runs = [];
  for (let t = 0; t < trials; t++) {
    const tele = await page.evaluate(RUN_IN_PAGE, {
      stage, lives, params, maxFrames: seconds * 60, fullGame
    });
    runs.push(tele);
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  // ------------------------------------------------------------- aggregate
  const deaths = {}, damage = {}, timeIn = {}, visits = {};
  let totalDeaths = 0, totalDamage = 0;
  runs.forEach(r => {
    r.deaths.forEach(d => {
      const k = d.stage + '|' + d.section;
      deaths[k] = deaths[k] || { n: 0, causes: {} };
      deaths[k].n++; deaths[k].causes[d.cause || 'damage'] = (deaths[k].causes[d.cause || 'damage'] || 0) + 1;
      totalDeaths++;
    });
    r.damage.forEach(d => {
      const k = d.stage + '|' + d.section;
      damage[k] = (damage[k] || 0) + d.amount;
      totalDamage += d.amount;
    });
    Object.keys(r.sectionFrames).forEach(k => {
      const [st, se] = k.split(':');
      const kk = st + '|' + se;
      timeIn[kk] = (timeIn[kk] || 0) + r.sectionFrames[k];
      visits[kk] = (visits[kk] || 0) + 1;
    });
  });

  const clears = runs.filter(r => r.finished === 'ending').length;
  const stageClears = [0, 0, 0];
  runs.forEach(r => { r.cleared.forEach(c => { if (c.stage < 3) stageClears[c.stage]++; }); });

  console.log('\n============================================================');
  console.log('  VANGUARD ZERO - agent difficulty report');
  console.log('  ' + trials + ' runs, ' + lives + ' lives, ' +
    (fullGame ? 'full game from stage ' + (stage + 1) : 'stage ' + (stage + 1) + ' only'));
  console.log('============================================================\n');

  console.log('OUTCOMES');
  const outcomes = {};
  runs.forEach(r => { outcomes[r.finished || 'timeout'] = (outcomes[r.finished || 'timeout'] || 0) + 1; });
  Object.keys(outcomes).forEach(k => {
    const label = k === 'ending' ? 'beat the game' : k;
    console.log('  ' + label.padEnd(16) + String(outcomes[k]).padStart(3) + '   ' + pct(outcomes[k], trials));
  });
  console.log('  stage clears     ' + stageClears.map((n, i) => (i + 1) + ':' + n).join('  '));
  console.log('  deaths/run       ' + (totalDeaths / trials).toFixed(1));
  console.log('  damage/run       ' + (totalDamage / trials).toFixed(0) + ' hp');

  // per-section table
  const maxDeaths = Math.max(1, ...Object.values(deaths).map(d => d.n));
  for (let st = 0; st < 3; st++) {
    const rows = [];
    for (let se = 0; se < 7; se++) {
      const k = st + '|' + se;
      const d = deaths[k], dmg = damage[k] || 0, tf = timeIn[k] || 0, v = visits[k] || 0;
      if (!d && !dmg && !tf) continue;
      rows.push({
        name: (SECTIONS[st] && SECTIONS[st][se]) || ('section ' + se),
        deaths: d ? d.n : 0,
        causes: d ? Object.entries(d.causes).sort((a, b) => b[1] - a[1]).map(c => c[0] + '*' + c[1]).join(' ') : '',
        dmg: dmg, secs: (tf / 60 / Math.max(1, v)).toFixed(1), visits: v
      });
    }
    if (!rows.length) continue;
    console.log('\nSTAGE ' + STAGE_NAMES[st]);
    console.log('  ' + 'section'.padEnd(20) + 'deaths'.padStart(7) + '  ' +
      'dmg'.padStart(5) + '  ' + 'sec'.padStart(5) + '   how it died');
    rows.forEach(r => {
      console.log('  ' + r.name.padEnd(20) + String(r.deaths).padStart(7) + '  ' +
        String(r.dmg).padStart(5) + '  ' + String(r.secs).padStart(5) + '   ' +
        bar(r.deaths, maxDeaths, 12) + ' ' + r.causes);
    });
  }

  // ------------------------------------------------- ranked difficulty table
  const ranked = [];
  for (let st = 0; st < 3; st++) {
    for (let se = 0; se < 7; se++) {
      const k = st + '|' + se;
      const v = visits[k] || 0;
      if (!v) continue;
      const d = deaths[k] ? deaths[k].n : 0;
      const dm = damage[k] || 0;
      ranked.push({
        label: (st + 1) + '-' + ((SECTIONS[st] && SECTIONS[st][se]) || se),
        deathsPer: d / v, dmgPer: dm / v, secs: (timeIn[k] || 0) / 60 / v,
        deaths: d, visits: v
      });
    }
  }
  // A single difficulty score: deaths dominate, damage and time break ties.
  ranked.forEach(r => { r.score = r.deathsPer * 10 + r.dmgPer * 0.35 + r.secs * 0.06; });
  ranked.sort((a, b) => b.score - a.score);

  console.log('\nHARDEST TO EASIEST  (deaths per visit, hp lost per visit, seconds)');
  const maxScore = Math.max(...ranked.map(r => r.score), 0.001);
  ranked.forEach(r => {
    console.log('  ' + r.label.padEnd(24) +
      r.deathsPer.toFixed(2).padStart(6) + ' deaths  ' +
      r.dmgPer.toFixed(1).padStart(5) + ' hp  ' +
      r.secs.toFixed(1).padStart(5) + 's  ' + bar(r.score, maxScore, 20));
  });

  if (errors.length) console.log('\nERRORS: ' + [...new Set(errors)].slice(0, 5).join(' | '));
  const jsonPath = arg('json', '');
  if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(runs));
  await browser.close();
}

main();
