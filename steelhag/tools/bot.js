// A dumb bot that runs right, jumps at edges and walls, waits for arcs and lifts.
// usage: node tools/bot.js [chapter...]   — reports progress, deaths and where it got stuck.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const chs = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.__game && window.__game.state === 'title', null, { timeout: 60000 });
  for (const spec of (chs.length ? chs : ['0', '1', '2', '3', '4'])) {
    const [ch, sx] = spec.split(':').map(Number);
    await page.evaluate(([ch, sx]) => window.__game.jump(ch, sx || 0), [ch, sx]);
    await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 60000 });
    const res = await page.evaluate(() => {
      const G = window.__game, k = G.keys, W = G.world, L = G.L;
      let deaths = [], best = 0, stuckT = 0, lastX = 0, t = 0, log = [];
      let wasDead = false;
      for (let f = 0; f < 60 * 60 * 5; f++) {
        const p = G.player;
        if (G.state !== 'play') break;
        k.right = true; k.left = false; k.jump = false;
        const ahead = x => { let s = W.surfaceAt(x, p.y - 100); for (const m of W.movers) if (x >= m.x && x <= m.x + m.w && m.y >= p.y - 100 && (s === null || m.y < s)) s = m.y; return s; };
        const here = p.y;
        if (p.onGround) {
          const a1 = ahead(p.x + 14), aw = ahead(p.x + 22);
          const drop = a1 === null || a1 > here + 60;
          const wall = aw !== null && aw < here - 14;
          // arcs ahead
          for (const h of L.hazards || []) {
            const d = h.x - p.x;
            if (d > 0 && d < 70) {
              const ph = ((G.time / h.period + (h.phase || 0)) % 1 + 1) % 1 * h.period;
              const safeFor = ph >= h.on ? h.period - ph : 0;
              if (safeFor < 0.55) k.right = false;
            }
          }
          // lifts: ride to the top
          if (p.ref && p.ref.art === 'lift') { const m = p.ref; const up = m.dy < 0; if (Math.abs(m.y - (m.by + m.dy)) > 4) k.right = false; }
          else {
            for (const m of W.movers) if (m.art === 'lift' && m.x - p.x > 0 && m.x - p.x < 40 && Math.abs(m.y - m.by) > 6) k.right = false;
          }
          if (k.right && (drop || wall)) { G.pressed.jump = true; k.jump = true; }
        } else { k.jump = true; if (p.vy > 0) { const below = ahead(p.x); const far = ahead(p.x + 40); if (below !== null && below > p.y - 4 && (far === null || far > below + 30)) k.right = false; } }
        if (G.player.y > 0 && Math.random() < 0.002) {}
        G.step(2);
        t += 1 / 60;
        const dead = G.player.y > 800 || (G.state === 'play' && document && false);
        if (p.x > best + 5) { best = p.x; stuckT = 0; } else stuckT += 1 / 60;
        if (stuckT > 6) { k.right = false; k.left = true; for (let i = 0; i < 20; i++) G.step(2); k.left = false; k.right = true; G.pressed.jump = true; k.jump = true; for (let i = 0; i < 30; i++) G.step(2); stuckT = 0; log.push('unstick@' + Math.round(p.x)); if (log.length > 12) break; }
      }
      return { state: G.state, best: Math.round(best), x: Math.round(G.player.x), exit: L.exit, log, t: Math.round(t) };
    });
    console.log('chapter', ch + 1, JSON.stringify(res));
  }
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})();
