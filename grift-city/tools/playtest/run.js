// usage: node playtest2.js <name> <scenario> <gameSeconds>
const { launch } = require('./launch.js'); const fs = require('fs'); const path = require('path');
const flags = process.argv.slice(2).filter(a => a.startsWith('--')); const [name, scenario = 'story', secsArg = '180'] = process.argv.slice(2).filter(a => !a.startsWith('--')); const GAME_SECS = +secsArg;
const seed = (+process.env.SEED || Math.floor(Math.random() * 65535)) || 1; const record = flags.includes('--record'); // --record writes inputs.json for tools/playtest/replay.js
const dir = path.join(__dirname, 'pt', name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
(async () => {
  const b = await launch(['--autoplay-policy=no-user-gesture-required']);
  const page = await b.newPage({ viewport: { width: 640, height: 360 } }); const t0 = Date.now(); const errors = [];
  page.on('pageerror', e => { errors.push(e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', '..', 'index.html') + '?seed=' + seed); console.log(JSON.stringify({ seed, record })); await page.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await page.evaluate(([sc, rec]) => { window.__pt = { dt: 1 / 30, renderEvery: 10, cheap: true, n: 0, record: rec ? [] : null }; window.__botScenario = sc; GAME.startPlay(); if (sc !== 'story') { MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; } }, [scenario, record]);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8') });
  const shots = []; const lines = []; const track = []; let lastT = -99, logIdx = 0;
  while (true) {
    await new Promise(r => setTimeout(r, 400));
    const s = await page.evaluate(() => { const st = window.__ptState(); st.botT = window.__bot.t; st.botLog = window.__bot.log.slice(); st.dbg = window.__bot.debug; return st; });
    track.push([Math.round(s.x), Math.round(s.z)]);
    for (; logIdx < s.botLog.length; logIdx++) { lines.push(s.botLog[logIdx]); console.log(JSON.stringify(s.botLog[logIdx])); }
    if (s.botT - lastT >= 4 || shots.length === 0) {
      lastT = s.botT; await page.evaluate(() => { window.__pt.wantShot = true; }); await page.waitForFunction(() => !window.__pt.wantShot, null, { timeout: 60000 }); await page.evaluate(() => { window.__pt.paused = true; }); await new Promise(r => setTimeout(r, 150));
      const f = path.join(dir, String(shots.length).padStart(3, '0') + '.png'); try { await page.screenshot({ path: f, timeout: 45000 }); } catch (e) { console.log('shot failed', e.message.split('\n')[0]); } await page.evaluate(() => { window.__pt.paused = false; });
      const line = { t: +s.botT.toFixed(1), shot: shots.length, obj: s.objective, mission: s.mission, pos: [Math.round(s.x), Math.round(s.z)], car: s.car ? s.car.type + ' ' + s.car.abs.toFixed(1) : null, hp: Math.round(s.hp), wanted: s.wanted, money: s.money, state: s.state, wall: Math.round((Date.now() - t0) / 1000), dbg: s.dbg };
      shots.push({ file: f, label: `t=${line.t}s ${s.mission || ''} | ${s.objective || ''} | ${line.car || 'foot'} hp${line.hp} ★${s.wanted} $${s.money}` }); lines.push(line); console.log(JSON.stringify(line)); fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify(shots)); fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(lines, null, 1));
    }
    if (s.botT >= GAME_SECS) break;
  }
  const final = await page.evaluate(() => window.__ptState()); console.log(JSON.stringify({ final: { stats: final.stats, money: final.money, progress: final.progress, mission: final.mission } }));
  fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(lines, null, 1)); fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify(shots));
  // where the run went, and (with --record) how to play it back
  try { await page.evaluate(t => { window.__pt.paused = true; HUD.heatmap(t); }, track); await page.locator('#hud').screenshot({ path: path.join(dir, 'heatmap.png'), timeout: 60000 }); console.log('heatmap', path.join(dir, 'heatmap.png')); } catch (e) { console.log('heatmap failed', e.message.split('\n')[0]); }
  if (record) { const inputs = await page.evaluate(() => window.__pt.record); fs.writeFileSync(path.join(dir, 'inputs.json'), JSON.stringify({ seed, dt: 1 / 30, scenario, frames: inputs.length, final: { x: final.x, z: final.z, money: final.money }, inputs })); console.log('recorded', inputs.length, 'frames'); }
  console.log('errors', errors.length, errors.slice(0, 5).join('\n'), 'wall', Math.round((Date.now() - t0) / 1000) + 's');
  await b.close();
})();
