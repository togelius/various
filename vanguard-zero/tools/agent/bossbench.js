/* Boss benchmark.
 *
 * A boss fight is two clocks racing: how fast you remove its health, and how
 * fast it removes yours. Win rate alone hides which clock is the problem, so
 * this reports both, plus the margin between them.
 *
 *   node tools/agent/bossbench.js [--trials=N] [--params=json]
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
const NAMES = ['AEGIS DRONE (stage 1)', 'FORGE GOLEM (stage 2)', 'VANGUARD PRIME (stage 3)'];

const RUN = async ({ stage, trials, params }) => {
  const out = [];
  for (let t = 0; t < trials; t++) {
    const g = VZ.game;
    VZ.audio.enabled = false;
    if (VZ.audio.stopSong) VZ.audio.stopSong();
    if (g.loop) g.loop.stop();
    g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
    g.lives = 0; g.score = 0; g.player = null;
    g.loadStage(stage, false);
    g.player.unlocked = [true, true, true];
    g.setState('play');
    g.player.x = g.arena.x0 - 34;
    g.player.y = g.arena.y1 - 16;
    g.camera.follow(g.player, true);

    const pilot = new AGENT.Pilot(g, params);
    let f = 0, fightFrames = 0, won = false, engaged = false;
    let bossMax = 0, dealt = 0, taken = 0, lastBossHp = null, lastHp = g.player.maxHp;

    while (f < 150 * 60) {
      if (g.fadeCb && Math.abs(g.fade - g.fadeTarget) > 0.001) g.fade = g.fadeTarget;
      pilot.tick(); g.update(); f++;
      const b = g.boss;
      if (b && b.state !== 'intro' && !b.dying) {
        if (!engaged) { engaged = true; bossMax = b.maxHp; lastBossHp = b.hp; lastHp = g.player.hp; }
        fightFrames++;
        if (lastBossHp !== null && b.hp < lastBossHp) dealt += lastBossHp - b.hp;
        lastBossHp = b.hp;
        if (g.player.hp < lastHp) taken += lastHp - g.player.hp;
        lastHp = g.player.hp;
      }
      if (g.bossDefeated) { won = true; break; }
      if (g.state === 'gameOver') break;
      if (f % 20000 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const secs = fightFrames / 60;
    out.push({
      won, secs,
      dps: secs > 0 ? dealt / secs : 0,          // boss hp removed per second
      tps: secs > 0 ? taken / secs : 0,          // player hp lost per second
      bossMax, hpLeftPct: g.boss && !won ? Math.round(100 * g.boss.hp / g.boss.maxHp) : 0
    });
  }
  return out;
};

async function main() {
  const trials = parseInt(arg('trials', '12'), 10);
  const params = arg('params', '') ? JSON.parse(arg('params')) : {};
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

  console.log('\nBOSS BENCHMARK  (' + trials + ' attempts each, agent starts at full health)\n');
  console.log('  ' + 'boss'.padEnd(24) + 'wins'.padStart(7) + '  ' +
    'kill'.padStart(6) + '  ' + 'survive'.padStart(8) + '  ' + 'margin'.padStart(7));

  const rows = [];
  for (let stage = 0; stage < 3; stage++) {
    const rs = await page.evaluate(RUN, { stage, trials, params });
    const wins = rs.filter(r => r.won).length;
    const avgDps = rs.reduce((a, r) => a + r.dps, 0) / rs.length;
    const avgTps = rs.reduce((a, r) => a + r.tps, 0) / rs.length;
    const bossHp = rs[0].bossMax;
    // seconds to remove the boss's health at the observed rate
    const killSecs = avgDps > 0 ? bossHp / avgDps : Infinity;
    // seconds for the boss to remove yours
    const surviveSecs = avgTps > 0 ? 16 / avgTps : Infinity;
    const margin = surviveSecs / killSecs;
    rows.push({ stage, wins, killSecs, surviveSecs, margin });
    console.log('  ' + NAMES[stage].padEnd(24) +
      (wins + '/' + trials).padStart(7) + '  ' +
      (isFinite(killSecs) ? killSecs.toFixed(0) + 's' : '  never').padStart(6) + '  ' +
      (isFinite(surviveSecs) ? surviveSecs.toFixed(0) + 's' : '   -').padStart(8) + '  ' +
      margin.toFixed(2).padStart(7));
  }

  console.log('\n  kill    = seconds to remove the boss\'s health at the rate actually achieved');
  console.log('  survive = seconds before the boss removes all 16 of yours');
  console.log('  margin  = survive / kill. Below 1.0 means you lose the race on average;');
  console.log('            a fight only feels fair somewhere north of ~1.5.');
  if (errors.length) console.log('\nerrors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await browser.close();
}
main();
