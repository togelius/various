// Screenshots. usage: node tools/shot.js out-dir spec ...   spec: "title" | "ch,x,z[,yaw][,wait]" | "cam:x,y,z,tx,ty,tz"
const { chromium } = require('playwright'); const path = require('path');
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
(async () => {
  const [out, ...specs] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/CERT|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.__game && window.__game.state === 'title', null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  let k = 0;
  for (const spec of specs) {
    if (spec === 'title') { await page.screenshot({ path: `${out}/title.png` }); continue; }
    if (spec.startsWith('cam:')) { const v = spec.slice(4).split(',').map(Number); await page.evaluate(v => window.__game.set(...v), v); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/cam${k++}.png` }); continue; }
    const [ch, x, z, yaw, wait] = spec.split(',').map(Number);
    await page.evaluate(([ch, x, z, yaw]) => { window.__game.jump(ch, x, z); window.__game.place(x, z, yaw || 0); }, [ch, x, z, yaw]);
    await page.waitForTimeout(wait || 1200);
    await page.screenshot({ path: `${out}/s${k++}-${ch}-${x}-${z}.png` });
  }
  if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 8).join('\n'));
  await browser.close();
})();
