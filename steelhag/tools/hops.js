// For a chain of platforms, check each hop is possible: try many (wait, run, release) timings.
// usage: node tools/hops.js
const { chromium } = require('playwright');
const path = require('path');
const CHAINS = [
  { ch: 2, name: 'drums', start: 2080, targets: ['m1', 'm2', 'm3', 'g2530'] },
  { ch: 2, name: 'first drum', start: 1720, targets: ['m0', 'g1880'] },
  { ch: 4, name: 'void', start: 3430, targets: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'g5580'] },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.__game && window.__game.state === 'title', null, { timeout: 60000 });
  for (const c of CHAINS) {
    await page.evaluate(ch => window.__game.jump(ch), c.ch);
    await page.waitForFunction(() => window.__game.state === 'play');
    const res = await page.evaluate(c => {
      const G = window.__game, W = G.world;
      const out = [];
      const on = (tg) => {
        const p = G.player;
        if (!p.onGround) return false;
        if (tg[0] === 'm') return p.ref === W.movers[+tg.slice(1)];
        return p.ref === null && Math.abs(p.x - +tg.slice(1)) < 60;
      };
      // stand at a place
      const place = (from) => {
        if (from[0] === 'm') { const m = W.movers[+from.slice(1)]; G.set(m.x + m.w / 2, m.y); G.player.ref = m; G.player.onGround = true; }
        else G.set(+from.slice(1));
      };
      let from = 'g' + c.start;
      for (const tg of c.targets) {
        let ok = null;
        search: for (let wait = 0; wait < 240; wait += 12) for (let run = 2; run < 50; run += 3) for (let rel = 8; rel < 90; rel += 6) {
          place(from);
          const k = G.keys;
          k.right = false; k.jump = false;
          G.step(2 * wait);
          if (from[0] === 'm') { const m = W.movers[+from.slice(1)]; if (!G.player.onGround) continue; }
          let jumped = false;
          for (let f = 0; f < 200; f++) {
            k.right = f < run + rel && (f < run || jumped);
            if (f === run) { G.pressed.jump = true; k.jump = true; jumped = true; }
            if (f > run + 30) k.jump = false;
            G.step(2);
            if (jumped && f > run + 4 && on(tg)) { ok = { wait, run, rel }; break search; }
            if (G.player.y > 700) break;
          }
        }
        out.push(`${from} -> ${tg}: ${ok ? 'ok ' + JSON.stringify(ok) : 'IMPOSSIBLE'}`);
        from = tg;
      }
      return out.join('\n');
    }, c);
    console.log(`== ${c.name}\n${res}`);
  }
  await browser.close();
})();
