/* Fight a boss to the death with a competent scripted player and report the
 * whole arc: phase transitions, punish windows, death sequence, reward.
 *   node tools/killboss.js <stageIndex>
 */
const { chromium } = require('playwright');
const path = require('path');

const STAGE = parseInt(process.argv[2] || '0', 10);

// Runs inside the page: hold fire to charge, release when full, keep distance.
const PILOT = function () {
  const g = window.VZ.game;
  if (g._pilot) return;
  g._pilot = true;
  window._ev = [];
  let lastPhase = 1, lastState = '';
  const orig = g.update.bind(g);
  let f = 0;
  g.update = function () {
    f++;
    const p = g.player, b = g.boss;
    if (g.state === 'play' && p && !p.dead && !b) {
      // not in the arena yet - walk in and trip the gate
      window.VZ.input.virtual = { right: true };
      orig();
      return;
    }
    if (g.state === 'play' && p && !p.dead && b) {
      const act = {};
      // keep a working distance from the boss
      const dx = b.x - p.x;
      if (Math.abs(dx) > 95) act[dx > 0 ? 'right' : 'left'] = true;
      else if (Math.abs(dx) < 50) act[dx > 0 ? 'left' : 'right'] = true;
      // Jump to reach airborne targets, and to hop incoming ground attacks -
      // but not so often that the shot line spends its life above the boss.
      const needAir = (b.y + b.h / 2) < p.y - 4;
      const incoming = Math.abs(dx) < 120 && (b.state === 'charge' || b.state === 'dashAttack' ||
                                              b.state === 'tripleDash' || b.state === 'blades');
      if (p.grounded && (needAir ? f % 40 < 3 : incoming && f % 24 < 3)) act.jump = true;
      if (p.grounded && !needAir && !incoming && f % 150 < 3) act.jump = true;
      // Rapid fire is better DPS than charging, so tap unless we are lined up
      // for a charge on a stationary target.
      act.fire = (f % 8) < 5;
      window.VZ.input.virtual = act;

      if (b.phase !== lastPhase) {
        window._ev.push('f' + f + ' PHASE ' + lastPhase + '->' + b.phase + ' at hp ' + b.hp + '/' + b.maxHp);
        lastPhase = b.phase;
      }
      if (b.state !== lastState) { window._ev.push('f' + f + ' state ' + b.state); lastState = b.state; }
      if (b.dying && !window._died) { window._died = f; window._ev.push('f' + f + ' DYING'); }
    } else {
      window.VZ.input.virtual = (f % 24 < 6) ? { jump: true } : {};
    }
    orig();
  };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 470 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(400);
  await page.evaluate((s) => {
    const g = VZ.game;
    g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
    g.lives = 99;
    g.loadStage(s, false);
    g.player.unlocked = [true, true, true];
    g.setState('play');
    g.player.x = g.arena.x0 - 30;
    g.player.y = g.arena.y1 - 16;
    g.camera.follow(g.player, true);
    // keep the player alive so the fight runs its full length
    setInterval(() => { const p = VZ.game.player; if (p && p.hp < p.maxHp) p.hp = p.maxHp; }, 250);
  }, STAGE);
  await page.evaluate(PILOT);

  let cleared = false, secs = 0;
  for (let t = 0; t < 100; t++) {
    await page.waitForTimeout(1000);
    secs++;
    const st = await page.evaluate(() => {
      const g = VZ.game;
      return {
        state: g.state, boss: g.boss ? g.boss.hp : null, defeated: !!g.bossDefeated,
        weapons: g.player ? g.player.unlocked.slice() : null, score: g.score
      };
    });
    const sawDying = await page.evaluate(() => !!window._died);
    if (sawDying || st.state === 'results' || st.state === 'ending') { cleared = true;
      const df = await page.evaluate(() => window._died || 0);
      console.log('boss destroyed after ' + (df / 60).toFixed(1) + 's of fighting' +
        '  (harness saw it at ~' + secs + 's)  weapons=' + JSON.stringify(st.weapons));
      break;
    }
  }
  const ev = await page.evaluate(() => window._ev);
  console.log(ev.filter(e => e.indexOf('PHASE') >= 0 || e.indexOf('DYING') >= 0).join('\n'));
  const states = [...new Set(ev.filter(e => e.indexOf('state') >= 0).map(e => e.split('state ')[1]))];
  console.log('attack states used: ' + states.join(', '));
  if (!cleared) console.log('!! boss NOT defeated within 100s');
  console.log('--- errors ---');
  console.log(errors.length ? [...new Set(errors)].slice(0, 6).join('\n') : 'none');
  await browser.close();
  process.exit(cleared ? 0 : 1);
})();
