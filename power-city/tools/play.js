/* Drive POWER CITY in headless Chromium and take screenshots along the way.
 * usage: node tools/play.js <outdir>
 */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp';
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(900);

  const shot = async (name) => {
    const el = await page.$('#screen');
    await el.screenshot({ path: path.join(out, name) });
  };
  const state = async () => page.evaluate(() => ({
    state: PC.game.state, actors: PC.world.actors.length, enemies: PC.world.enemies().length,
    camX: Math.round(PC.world.camX), hp: PC.game.players[0] && Math.round(PC.game.players[0].hp),
    lives: PC.game.lives[0], score: PC.game.scores[0], items: PC.world.items.length,
    enc: PC.stage.encIndex, locked: PC.stage.locked, pstate: PC.game.players[0] && PC.game.players[0].state
  }));

  await page.keyboard.press('Digit5');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await shot('01-ready.png');
  await page.waitForTimeout(2200);
  console.log('after ready', JSON.stringify(await state()));
  await shot('02-play.png');

  // walk right into the first fight
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(400);
  console.log('walked', JSON.stringify(await state()));
  await shot('03-fight.png');

  // throw some punches
  for (let i = 0; i < 26; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(110); }
  console.log('punched', JSON.stringify(await state()));
  await shot('04-punch.png');

  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 16; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(150); }
  await page.keyboard.up('ArrowRight');
  await shot('05-more.png');
  console.log('after more', JSON.stringify(await state()));

  // kick + jump
  await page.keyboard.press('KeyX'); await page.waitForTimeout(300);
  await page.keyboard.press('KeyC'); await page.waitForTimeout(180);
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(200);
  await shot('06-air.png');
  console.log('final', JSON.stringify(await state()));

  await browser.close();
  if (errs.length) { console.log('--- errors ---\n' + [...new Set(errs)].join('\n')); process.exitCode = 1; }
  else console.log('no errors');
})();
