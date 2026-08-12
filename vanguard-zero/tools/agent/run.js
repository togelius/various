/* Harness: run the play agent over the game and return telemetry.
 *
 *   node tools/agent/run.js [--stage=N] [--speed=N] [--lives=N] [--params=json]
 *                           [--seconds=N] [--trials=N] [--quiet]
 *
 * The game is driven directly rather than through requestAnimationFrame, and
 * rendering is skipped, so a full playthrough takes seconds instead of minutes.
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

/* Runs one full attempt inside the page. Returns telemetry. */
const RUN_IN_PAGE = async ({ stage, lives, params, maxFrames, speed, fullGame }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;           // turbo makes the scheduler meaningless
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();

  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = lives;
  g.score = 0;
  g.player = null;
  g.loadStage(stage, false);
  if (stage >= 1) g.player.unlocked[1] = true;
  if (stage >= 2) g.player.unlocked[2] = true;
  g.setState('play');

  const pilot = new AGENT.Pilot(g, params);
  window._pilot = pilot;

  const t0 = performance.now();
  let frames = 0;
  let lastStage = g.stageIndex;
  let finished = null;
  const startedStage = {};
  startedStage[g.stageIndex] = 0;

  // Fades are wall-clock-free here: step them by hand so transitions resolve.
  while (frames < maxFrames) {
    // let the fade callback fire immediately rather than easing for 23 frames
    if (g.fadeCb && Math.abs(g.fade - g.fadeTarget) > 0.001) g.fade = g.fadeTarget;

    pilot.tick();
    g.update();
    frames++;

    if (g.stageIndex !== lastStage) {
      pilot.tele.cleared.push({ stage: lastStage, frames: frames - (startedStage[lastStage] || 0) });
      lastStage = g.stageIndex;
      startedStage[lastStage] = frames;
      pilot.reset();
      pilot.fieldStage = -1;
      if (!fullGame) { finished = 'cleared'; break; }
    }
    if (g.state === 'ending') { finished = 'ending'; break; }
    if (g.state === 'gameOver') { finished = 'gameOver'; break; }
    if (!fullGame && g.state === 'results') {
      pilot.tele.cleared.push({ stage: lastStage, frames: frames - (startedStage[lastStage] || 0) });
      finished = 'cleared';
      break;
    }
    // yield occasionally so the page stays responsive and we can be killed
    if (frames % 20000 === 0) await new Promise(r => setTimeout(r, 0));
  }

  const tele = pilot.tele;
  tele.frames = frames;
  tele.finished = finished;
  tele.wall = Math.round(performance.now() - t0);
  tele.endStage = g.stageIndex;
  tele.endState = g.state;
  tele.lives = g.lives;
  tele.score = g.score;
  tele.levelW = g.level.pixelW;
  return tele;
};

async function main() {
  const stage = parseInt(arg('stage', '0'), 10);
  const lives = parseInt(arg('lives', '3'), 10);
  const trials = parseInt(arg('trials', '1'), 10);
  const seconds = parseInt(arg('seconds', '300'), 10);
  const fullGame = arg('stage', null) === null || arg('full', '0') === '1';
  const paramsRaw = arg('params', '');
  const params = paramsRaw ? JSON.parse(paramsRaw) : {};
  const quiet = process.argv.includes('--quiet');

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AGENT_SRC });

  const results = [];
  for (let t = 0; t < trials; t++) {
    const tele = await page.evaluate(RUN_IN_PAGE, {
      stage, lives, params, maxFrames: seconds * 60, speed: 1, fullGame
    });
    results.push(tele);
    if (!quiet) {
      const pct = Math.round(100 * (tele.maxX['s' + tele.endStage] || 0) / tele.levelW);
      console.log(`trial ${t}: ${tele.finished || 'timeout'}  stage=${tele.endStage}` +
        `  reach=${pct}%  deaths=${tele.deaths.length}  dmg=${tele.damage.reduce((a, d) => a + d.amount, 0)}` +
        `  frames=${tele.frames} (${(tele.frames / 60).toFixed(0)}s game / ${(tele.wall / 1000).toFixed(1)}s real)`);
    }
  }
  console.log(JSON.stringify({ results, errors: [...new Set(errors)].slice(0, 6) }, null, 0)
    .slice(0, 0) || '');
  if (errors.length) console.log('ERRORS: ' + [...new Set(errors)].slice(0, 5).join(' | '));
  fs.writeFileSync(arg('out', '/tmp/agent-run.json'), JSON.stringify(results));
  await browser.close();
}

main();
