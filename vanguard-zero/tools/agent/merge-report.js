/* Merge the JSON telemetry from several report.js runs into one table.
 *
 * A single 24-run sample takes hours; four 6-run batches in parallel take a
 * quarter of that and answer the same question.
 *
 *   node tools/agent/merge-report.js out1.json out2.json ...
 */
const fs = require('fs');
const SECTIONS = [
  ['Opening', 'Gap run', 'Wall-jump chimney', 'Crumble + spikes', 'Turret gauntlet', 'Run-up', 'Boss arena'],
  ['Opening', 'Conveyors', 'Flame vents', 'Lava climb', 'Lava bridge', 'Run-up', 'Boss arena'],
  ['Opening', 'Spike corridor', 'Void ascent', 'Crumble bridge', 'Turret + shielders', 'Run-up', 'Boss arena']
];
const STAGE_NAMES = ['1 SKYFALL RIDGE', '2 MAGMA FOUNDRY', '3 VOID CITADEL'];
const bar = (v, max, w) => '#'.repeat(max > 0 ? Math.round(v / max * w) : 0)
  .padEnd(w, '.');

const runs = process.argv.slice(2).flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const deaths = {}, damage = {}, timeIn = {}, visits = {};
let totalDeaths = 0, totalDamage = 0;
runs.forEach(r => {
  r.deaths.forEach(d => {
    const k = d.stage + '|' + d.section;
    deaths[k] = deaths[k] || { n: 0, causes: {} };
    deaths[k].n++;
    const c = d.cause || 'damage';
    deaths[k].causes[c] = (deaths[k].causes[c] || 0) + 1;
    totalDeaths++;
  });
  r.damage.forEach(d => {
    const k = d.stage + '|' + d.section;
    damage[k] = (damage[k] || 0) + d.amount; totalDamage += d.amount;
  });
  Object.keys(r.sectionFrames).forEach(k => {
    const [st, se] = k.split(':'), kk = st + '|' + se;
    timeIn[kk] = (timeIn[kk] || 0) + r.sectionFrames[k];
    visits[kk] = (visits[kk] || 0) + 1;
  });
});

const outcomes = {};
runs.forEach(r => { outcomes[r.finished || 'timeout'] = (outcomes[r.finished || 'timeout'] || 0) + 1; });
console.log('\n============================================================');
console.log('  VANGUARD ZERO - agent difficulty report');
console.log('  ' + runs.length + ' full-game runs, 3 lives');
console.log('============================================================\n');
console.log('OUTCOMES');
Object.keys(outcomes).forEach(k => {
  const label = k === 'ending' ? 'beat the game' : k;
  console.log('  ' + label.padEnd(16) + String(outcomes[k]).padStart(3) + '   ' +
    (100 * outcomes[k] / runs.length).toFixed(0) + '%');
});
console.log('  deaths/run       ' + (totalDeaths / runs.length).toFixed(1));
console.log('  damage/run       ' + (totalDamage / runs.length).toFixed(0) + ' hp');

const maxDeaths = Math.max(1, ...Object.values(deaths).map(d => d.n));
for (let st = 0; st < 3; st++) {
  const rows = [];
  for (let se = 0; se < 7; se++) {
    const k = st + '|' + se, d = deaths[k], dmg = damage[k] || 0;
    const tf = timeIn[k] || 0, v = visits[k] || 0;
    if (!d && !dmg && !tf) continue;
    rows.push({
      name: SECTIONS[st][se] || ('section ' + se),
      deaths: d ? d.n : 0,
      causes: d ? Object.entries(d.causes).sort((a, b) => b[1] - a[1]).map(c => c[0] + '*' + c[1]).join(' ') : '',
      dmg, secs: (tf / 60 / Math.max(1, v)).toFixed(1), visits: v
    });
  }
  if (!rows.length) continue;
  console.log('\nSTAGE ' + STAGE_NAMES[st]);
  console.log('  ' + 'section'.padEnd(20) + 'deaths'.padStart(7) + '  ' + 'dmg'.padStart(5) +
    '  ' + 'sec'.padStart(5) + '   how it died');
  rows.forEach(r => console.log('  ' + r.name.padEnd(20) + String(r.deaths).padStart(7) + '  ' +
    String(r.dmg).padStart(5) + '  ' + String(r.secs).padStart(5) + '   ' +
    bar(r.deaths, maxDeaths, 12) + ' ' + r.causes));
}

const ranked = [];
for (let st = 0; st < 3; st++) for (let se = 0; se < 7; se++) {
  const k = st + '|' + se, v = visits[k] || 0;
  if (!v) continue;
  const d = deaths[k] ? deaths[k].n : 0, dm = damage[k] || 0;
  ranked.push({
    label: (st + 1) + '-' + SECTIONS[st][se],
    deathsPer: d / v, dmgPer: dm / v, secs: (timeIn[k] || 0) / 60 / v, visits: v
  });
}
ranked.forEach(r => { r.score = r.deathsPer * 10 + r.dmgPer * 0.35 + r.secs * 0.06; });
ranked.sort((a, b) => b.score - a.score);
console.log('\nHARDEST TO EASIEST  (per visit)');
const maxScore = Math.max(...ranked.map(r => r.score), 0.001);
ranked.forEach(r => console.log('  ' + r.label.padEnd(24) +
  r.deathsPer.toFixed(2).padStart(6) + ' deaths  ' + r.dmgPer.toFixed(1).padStart(5) + ' hp  ' +
  r.secs.toFixed(1).padStart(5) + 's  ' + bar(r.score, maxScore, 20)));
