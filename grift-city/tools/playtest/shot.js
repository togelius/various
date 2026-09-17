// usage: node play.js out.png "<js script; may call sim(sec, [codes])>" [w h]
const { launch } = require('./launch.js');
(async () => {
  const [out, script, w, h] = process.argv.slice(2);
  const b = await launch(['--autoplay-policy=no-user-gesture-required']);
  const p = await b.newPage({ viewport: { width: +w || 960, height: +h || 540 } });
  const errors = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!t.includes('GL_INVALID') || errors.length < 3) errors.push(t.slice(0, 400)); } });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', 'index.html') + '?shadow=' + (process.env.SHADOW || 1024));
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await p.evaluate(() => { GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; window.sim = window.__sim; window.tp = (x, z) => { PLAYER.P.x = x; PLAYER.P.z = z; }; });
  if (script) { try { await p.evaluate(script); } catch (e) { errors.push('SCRIPT ' + e.message); } }
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const info = await p.evaluate(() => ({ x: PLAYER.x.toFixed(1), z: PLAYER.z.toFixed(1), car: PLAYER.car ? PLAYER.car.type + ' spd=' + PLAYER.car.absSpeed.toFixed(1) : null, hp: Math.round(PLAYER.health), wanted: PLAYER.wanted, cars: W.cars.length, peds: W.peds.length, draws: RENDER.stats.draws, obj: MISSIONS.objective, state: PLAYER.P.state, st: window.__st }));
  console.log(JSON.stringify(info));
  for (const e of errors.slice(0, 8)) console.log('ERR', e);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => { window.__pt = { paused: true }; requestAnimationFrame(r); })));
  await p.screenshot({ path: out, timeout: 240000 });
  await b.close();
})();
