/* Drive the game headlessly and capture frames.
 * node tools/play.js <outdir> [stageIndex]
 *
 * Uses VZ.input.virtual so we exercise the same code path real input does.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || '/tmp/vz';
const STAGE = parseInt(process.argv[3] || '0', 10);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(400);

  // Jump straight into the requested stage.
  await page.evaluate((s) => {
    const g = VZ.game;
    g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
    g.lives = 3; g.score = 0; g.player = null;
    g.loadStage(s, false);
    g.player.unlocked = [true, true, true];
    g.setState('play');
  }, STAGE);
  await page.waitForTimeout(300);

  const hold = (acts) => page.evaluate((a) => {
    VZ.input.virtual = {};
    a.forEach(k => { VZ.input.virtual[k] = true; });
  }, acts);

  const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.png') });
  const probe = () => page.evaluate(() => {
    const g = VZ.game, p = g.player;
    return {
      state: g.state, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp,
      grounded: p.grounded, vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
      enemies: g.enemies.length, proj: g.projectiles.length,
      boss: g.boss ? g.boss.name + ' ' + g.boss.hp + '/' + g.boss.maxHp + ' ' + g.boss.state : null,
      dead: p.dead, lives: g.lives, t: g.stageTime,
      camX: Math.round(g.camera.x)
    };
  });

  const log = [];
  // Run right, jumping and firing, for a while; screenshot periodically.
  for (let i = 0; i < 34; i++) {
    const acts = ['right', 'fire'];
    if (i % 3 === 1) acts.push('jump');
    if (i % 5 === 2) acts.push('dash');
    await hold(acts);
    await page.waitForTimeout(700);
    const st = await probe();
    log.push(i + ': ' + JSON.stringify(st));
    if (i % 4 === 0) await shot('f' + String(i).padStart(2, '0'));
  }
  await hold([]);
  await shot('final');

  fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
  console.log(log.filter((_, i) => i % 3 === 0).join('\n'));
  console.log('---');
  console.log(errors.length ? errors.slice(0, 12).join('\n') : 'no errors');
  await browser.close();
})();
