// Regression tests for save/load and purchases, using real browser storage and keyboard events.
// node tools/playtest/tests/persistence.js [--dist]
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch } = require('../launch.js');
(async () => {
  const browser = await launch();
  const errors = [];
  let checks = 0;
  const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks++; console.log('PASS', name); };
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.__pt = { paused: true }; });
    const entry = process.argv.includes('--dist') ? 'dist/grift-city.html' : 'index.html';
    await page.goto('file://' + path.resolve(__dirname, '../../..', entry) + '?shadow=256');
    const ready = () => page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
    await ready();
    const purchases = await page.evaluate(() => {
      GAME.state = 'playing'; MISSIONS.S.progress = 1; MISSIONS.S.cooldown = 1e9;
      const g = CITY.places.guns[0]; PLAYER.P.x = g.x; PLAYER.P.z = g.z; PLAYER.P.money = 250; W.state.time = 12;
      MISSIONS.update(.1);
      const buy = () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })); MISSIONS.update(.1); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2' })); INPUT.endFrame(); };
      buy(); const ammo = PLAYER.P.weapons.pistol; buy();
      const result = { money: PLAYER.money, extraAmmo: PLAYER.P.weapons.pistol - ammo, enabled: MISSIONS.shop.items[1].enabled };
      PLAYER.P.money = 250; result.reenabled = MISSIONS.shop.items[1].enabled;
      MISSIONS.closeShop(); return result;
    });
    check('repeat purchase cannot overdraw or grant free ammo; affordability refreshes', purchases, { money: 0, extraAmmo: 0, enabled: false, reenabled: true });
    const saved = await page.evaluate(() => {
      for (const p of W.pickups.filter(p => p.kind === 'package').slice(0, 5)) { PLAYER.P.x = p.x; PLAYER.P.z = p.z; PICKUPS.update(.1); }
      const sh = CITY.place('safehouse'); const c = VEH.spawn('sedan', sh.x + 3, sh.z, 0, { mode: 'parked' });
      c.playerOwned = true; c.mods = { engine: 2, tyres: 1, armor: 1 }; ECON.applyMods(c);
      MISSIONS.enterInterior(CITY.interiors.safehouse);
      const bed = CITY.interiors.safehouse.spots.bed; PLAYER.P.x = bed.x; PLAYER.P.z = bed.z;
      MISSIONS.S.saveT = 0; W.state.time = 9; MISSIONS.update(.1);
      const s = JSON.parse(localStorage.getItem('grift-city-save-v1'));
      return { ids: s.packages.length, count: s.stats.packages, inside: s.inside, time: s.time, mods: s.garage.mods };
    });
    check('bed saves collected IDs, interior, post-sleep time and car mods', saved, { ids: 5, count: 5, inside: 'safehouse', time: 15, mods: { engine: 2, tyres: 1, armor: 1 } });
    await page.reload(); await ready();
    const loaded = await page.evaluate(() => {
      const before = PLAYER.P.stats.packages;
      PICKUPS.update(.1); GAME.onPackage(5); GAME.onPackage(5); GAME.onPackage(25);
      const c = W.cars.find(c => c.playerOwned);
      GAME.save();
      return { inside: MISSIONS.S.inside, y: PLAYER.P.y, floor: CITY.interiors.safehouse.floorY,
        count: PLAYER.P.stats.packages, before, ids: JSON.parse(localStorage.getItem('grift-city-save-v1')).packages.length,
        rewards: W.pickups.filter(p => p.packageReward === 'uzi').length,
        mods: c.mods, upgraded: c.spec.accel > VEH.SPECS.sedan.accel, time: W.state.time, sleepCooldown: MISSIONS.S.saveT > 0 };
    });
    check('load restores interior floor', [loaded.inside, loaded.y === loaded.floor], ['safehouse', true]);
    check('collected packages survive cleanup and another save', [loaded.count, loaded.before, loaded.ids], [5, 5, 5]);
    check('package reward is restored exactly once', loaded.rewards, 1);
    check('car mods affect the restored spec', [loaded.mods, loaded.upgraded], [{ engine: 2, tyres: 1, armor: 1 }, true]);
    check('sleep time survives and loading does not immediately sleep again', [loaded.time, loaded.sleepCooldown], [15, true]);
    // Reload once more and visit the original package locations, through the actual pickup update.
    await page.reload(); await ready();
    check('revisiting collected packages does not increase the count', await page.evaluate(() => {
      MISSIONS.exitInterior();
      for (const p of W.pickups.filter(p => p.kind === 'package' && p.taken)) { PLAYER.P.x = p.x; PLAYER.P.z = p.z; PICKUPS.update(.1); }
      return PLAYER.P.stats.packages;
    }), 5);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('grift-city-save-v1'));
      delete s.version; delete s.inside; delete s.y; delete s.roof; delete s.garage.mods;
      s.stats.packages = 30; localStorage.setItem('grift-city-save-v1', JSON.stringify(s));
    });
    await page.reload(); await ready();
    check('old bed saves recover outside and old over-counts are bounded', await page.evaluate(() => ({ insideBuilding: !!CITY.insideLot(PLAYER.x, PLAYER.z), count: PLAYER.P.stats.packages, cars: W.cars.filter(c => c.playerOwned).length })), { insideBuilding: false, count: 20, cars: 1 });
    check('no browser exceptions', errors, []);
    console.log(`${checks} checks passed (${entry})`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
