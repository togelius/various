/* Pose a scene and photograph it - for the README, and for eyeballing art
 * without playing to the right moment.
 * usage: node tools/scene.js <out.png> <stage> [frames]
 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2], stage = parseInt(process.argv[3] || '1', 10);
  const frames = parseInt(process.argv[4] || '30', 10);
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(900);
  await page.evaluate(({ stage, frames }) => {
    PC.audio.enabled = false;
    PC.game.loop.stop();
    PC.input.poll = function () { };
    PC.game.coin();
    PC.game.startGame(0);
    PC.stage.load(stage);
    PC.game.stageIndex = stage;
    PC.game.setState('play');
    const p = PC.game.players[0];
    p.reviveAt(300, PC.FLOOR_BOT - 18);
    p.invuln = 0;
    PC.world.add(p);
    PC.world.camX = 210;
    PC.stage.locked = true; PC.stage.lockX = 210;
    // a fight, arranged
    const a = PC.spawnEnemy('punk', 336, PC.FLOOR_BOT - 20, { facing: -1 });
    const b = PC.spawnEnemy('rough', 430, PC.FLOOR_BOT - 40, { facing: -1 });
    const c = PC.spawnEnemy('batter', 250, PC.FLOOR_BOT - 6, { facing: 1 });
    PC.items.spawn('prop', 'crate', 480, PC.FLOOR_BOT - 30);
    PC.items.spawn('pickup', 'heart', 250, PC.FLOOR_BOT - 44);
    for (const e of [a, b, c]) e.control = function () { this.setState('idle'); this.vx = 0; this.vy = 0; };
    b.setState('walk');
    for (let i = 0; i < frames; i++) PC.game.update();
    // land a punch on the nearest one, then hold the freeze
    p.facing = 1;
    p.startAttack(PC.MOVES.hook);
    for (let i = 0; i < 8; i++) PC.game.update();
    PC.world.hitstop = 30;
    PC.game.render();
  }, { stage, frames });
  const el = await page.$('#screen');
  await el.screenshot({ path: path.resolve(root, out) });
  await browser.close();
  console.log(errs.length ? errs.join('\n') : 'ok -> ' + out);
})();
