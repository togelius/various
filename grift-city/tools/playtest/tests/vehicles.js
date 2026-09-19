// Isolated vehicle turntable shots for inspecting windows, wheels and damage.
// node tools/playtest/tests/vehicles.js [--dist]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch } = require('../launch.js');
(async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.__pt = { paused: true }; });
    const entry = process.argv.includes('--dist') ? 'dist/grift-city.html' : 'index.html';
    await page.goto('file://' + path.resolve(__dirname, '../../..', entry) + '?shadow=512');
    await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
    await page.evaluate(() => {
      document.getElementById('hud').style.display = 'none';
      RENDER.setTimeOfDay(14); RENDER.env.shadowOn = false; RENDER.env.fogDensity = 0; RENDER.post.ao = 0;
      window.vehicleFloor = new MESH.Builder().box(-12, -.15, -12, 24, .15, 24, [.38,.4,.42]).build();
    });
    const out = path.resolve(__dirname, '../pt/vehicles'); fs.mkdirSync(out, { recursive: true });
    for (const type of ['truck', 'van', 'swat', 'bus', 'sedan', 'kfire']) {
      for (const view of ['front', 'rear', 'damaged']) {
        await page.evaluate(({ type, view }) => {
          const car = VEH.spawn(type, 0, 0, 0, { mode: 'parked', color: 5 }); car.y = 0;
          if (view === 'damaged') { car.dentSeed = 42; car.damage(car.maxHealth * .75, null); }
          RENDER.setCamera(view === 'rear' ? -9 : 9, 5.3, view === 'rear' ? -11 : 11, 0, 1.5, 0, Math.PI / 4);
          const canvas = document.getElementById('gl'); RENDER.beginFrame(canvas);
          RENDER.render(canvas, { statics: [vehicleFloor], props: [], entities: [car.entity(false)], flat: W.F, particles: W.P }, 0);
          car.removed = true;
        }, { type, view });
        await page.screenshot({ path: path.join(out, `${type}-${view}.png`) });
      }
    }
    assert.deepEqual(errors, [], 'no browser exceptions during vehicle rendering');
    console.log('18 vehicle views rendered without exceptions:', out);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
