/* Drive a boss fight headlessly: teleport to the arena, trigger the fight,
 * then hammer the boss while dodging nothing, and report what happens.
 * node tools/boss.js <stageIndex> <outdir>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STAGE = parseInt(process.argv[2] || '0', 10);
const OUT = process.argv[3] || '/tmp/vzboss';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 470 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(400);

  await page.evaluate((s) => {
    const g = VZ.game;
    g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
    g.loadStage(s, false);
    g.player.unlocked = [true, true, true];
    g.setState('play');
    // Park the player just outside the arena mouth.
    g.player.x = g.arena.x0 - 30;
    g.player.y = g.arena.y1 - 16;
    g.camera.follow(g.player, true);
    g.lives = 9;
  }, STAGE);
  await page.waitForTimeout(300);

  const hold = (acts) => page.evaluate((a) => {
    VZ.input.virtual = {};
    a.forEach(k => { VZ.input.virtual[k] = true; });
  }, acts);

  const probe = () => page.evaluate(() => {
    const g = VZ.game, p = g.player, b = g.boss;
    return {
      state: g.state, hp: p.hp, dead: p.dead, lives: g.lives,
      bossStarted: g.bossStarted, bossDefeated: !!g.bossDefeated,
      boss: b ? { n: b.name, hp: b.hp, max: b.maxHp, st: b.state, ph: b.phase, dying: !!b.dying,
                  x: Math.round(b.x), y: Math.round(b.y) } : null,
      proj: g.projectiles.length, msg: g.hud.msg
    };
  });

  const log = [];
  await hold(['right']);
  await page.waitForTimeout(1200);
  log.push('entered: ' + JSON.stringify(await probe()));

  // Keep the player invincible so we can watch the whole pattern set play out.
  await page.evaluate(() => { VZ.game._godLoop = setInterval(() => {
    const p = VZ.game.player; if (p) { p.hp = p.maxHp; p.invuln = Math.max(p.invuln, 2); }
  }, 60); });

  const states = new Set();
  for (let i = 0; i < 40; i++) {
    const acts = [];
    if (i % 4 === 0) acts.push('jump');
    if (i % 6 === 3) acts.push('dash');
    acts.push(i % 8 < 4 ? 'right' : 'left');
    // Tap fire repeatedly rather than holding, so the buster actually shoots.
    for (let k = 0; k < 5; k++) {
      await hold(acts.concat(['fire']));
      await page.waitForTimeout(70);
      await hold(acts);
      await page.waitForTimeout(60);
    }
    const st = await probe();
    if (st.boss) states.add(st.boss.st);
    if (i % 6 === 0) log.push(i + ': ' + JSON.stringify(st));
    if (i % 10 === 0) await page.screenshot({ path: path.join(OUT, 's' + STAGE + '_' + i + '.png') });
    if (st.state !== 'play') { log.push('LEFT PLAY at ' + i + ': ' + JSON.stringify(st)); break; }
  }
  await hold([]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 's' + STAGE + '_end.png') });
  log.push('final: ' + JSON.stringify(await probe()));
  log.push('boss states seen: ' + [...states].join(','));

  console.log(log.join('\n'));
  console.log('--- errors ---');
  console.log(errors.length ? [...new Set(errors)].slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
