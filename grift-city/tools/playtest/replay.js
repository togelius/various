// Play back a recording made by run.js --record: same seed, same fixed timestep, the recorded inputs instead of a bot.
// usage: node replay.js <name> [everyGameSeconds=4]
// Writes screenshots to pt/<name>/replay/ and prints the final position next to the recorded one, so a diverging replay shows up.
const { launch } = require('./launch.js'); const fs = require('fs'); const path = require('path');
const [name, everyArg = '4'] = process.argv.slice(2); const EVERY = +everyArg;
const dir = path.join(__dirname, 'pt', name); const rec = JSON.parse(fs.readFileSync(path.join(dir, 'inputs.json'), 'utf8'));
const out = path.join(dir, 'replay'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await launch([]);
  const page = await b.newPage({ viewport: { width: 640, height: 360 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', '..', 'index.html') + '?seed=' + rec.seed); await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await page.evaluate(([sc, inputs, dt]) => { window.__pt = { dt, renderEvery: 10, cheap: true, n: 0, replay: inputs }; window.__botScenario = sc; GAME.startPlay(); if (sc !== 'story') { MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; } }, [rec.scenario, rec.inputs, rec.dt]);
  let shots = 0, lastT = -99;
  while (true) {
    await new Promise(r => setTimeout(r, 300));
    const s = await page.evaluate(() => { const st = window.__ptState(); st.n = window.__pt.n; st.done = !!window.__pt.done; return st; });
    const t = s.n * rec.dt;
    if (t - lastT >= EVERY) { lastT = t; await page.evaluate(() => { window.__pt.wantShot = true; }); await page.waitForFunction(() => !window.__pt.wantShot || window.__pt.done, null, { timeout: 60000 }); await page.evaluate(() => { window.__pt.paused = true; }); await new Promise(r => setTimeout(r, 50)); try { await page.screenshot({ path: path.join(out, String(shots++).padStart(3, '0') + '.png'), timeout: 45000 }); } catch (e) { console.log('shot failed', e.message.split('\n')[0]); } await page.evaluate(() => { if (!window.__pt.done) window.__pt.paused = false; }); console.log(JSON.stringify({ t: +t.toFixed(1), pos: [Math.round(s.x), Math.round(s.z)], hp: Math.round(s.hp), money: s.money, obj: s.objective })); }
    if (s.done) { console.log(JSON.stringify({ replayed: { x: Math.round(s.x), z: Math.round(s.z), money: s.money }, recorded: rec.final, match: Math.abs(s.x - rec.final.x) < 2 && Math.abs(s.z - rec.final.z) < 2 })); break; }
  }
  console.log('errors', errors.length, errors.slice(0, 3).join(' | ')); await b.close();
})();
