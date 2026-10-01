/* POWER CITY - film strips of real fights.
 *
 * Put a persona at the controls, and whenever something worth seeing
 * happens - a counter, a guard broken, a body bowling over the gang, a
 * boss changing phase - save the frames either side of it. Numbers say how
 * often a mechanic fires; a strip shows whether a person could read it.
 *
 * usage: node tools/filmstrip.js <outdir> [persona] [stage] [frames] [seed]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PERSONA_SRC, BOOT } = require('./agents.js');

(async () => {
  const out = process.argv[2] || '/tmp/pc-film';
  const persona = process.argv[3] || 'brawler';
  const stage = process.argv[4] === undefined ? 1 : parseInt(process.argv[4], 10);
  const frames = parseInt(process.argv[5] || '9000', 10);
  const seed = parseInt(process.argv[6] || '7', 10);
  fs.mkdirSync(out, { recursive: true });
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 340 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(BOOT, { src: PERSONA_SRC, persona, seed, startStage: stage, p2: false });

  const ev = process.env.EV || 'COUNTER|BREAK';
  const shots = await page.evaluate(({ frames, ev }) => {
    const PC = window.PC, FX = PC.fx;
    // watch the score pops for the words the mechanics print
    const events = [];
    const origPop = FX.pop;
    FX.pop = function (x, y, text, col) {
      const t = String(text);
      if (new RegExp(ev).test(t)) events.push({ f: PC.world.time, what: t });
      return origPop.call(this, x, y, text, col);
    };
    const origBowl = PC.Actor.prototype.bowl;
    PC.Actor.prototype.bowl = function () {
      const before = this.bowled ? this.bowled.length : 0;
      const r = origBowl.call(this);
      if ((this.bowled ? this.bowled.length : 0) > before && new RegExp(ev).test('BOWL')) events.push({ f: PC.world.time, what: 'BOWL' });
      return r;
    };
    const kept = [], ring = [];
    let wantAfter = 0, label = '';
    for (let i = 0; i < frames; i++) {
      PC.game.update(); window.__sample();
      PC.game.render();
      const url = PC.Screen.canvas.toDataURL('image/png');
      ring.push(url); if (ring.length > 6) ring.shift();
      if (events.length && events[events.length - 1].f === PC.world.time && wantAfter <= 0 && kept.length < 60) {
        label = events[events.length - 1].what.replace(/[^A-Z0-9]+/g, '-');
        // the moment, with the lead-up from the ring buffer
        ring.forEach((u, k) => kept.push({ name: `${kept.length}-${label}-pre${ring.length - k}`, url: u }));
        wantAfter = 8;
        continue;
      }
      if (wantAfter > 0) { wantAfter--; if (wantAfter % 2 === 0) kept.push({ name: `${kept.length}-${label}-post`, url }); }
      if (window.__stats.result !== 'running') break;
    }
    return { kept, events: events.slice(0, 200) };
  }, { frames, ev });

  shots.kept.forEach(k => fs.writeFileSync(path.join(out, k.name + '.png'), Buffer.from(k.url.split(',')[1], 'base64')));
  const tally = {};
  shots.events.forEach(e => { const k = e.what.replace(/\d+ HITS/, 'n HITS'); tally[k] = (tally[k] || 0) + 1; });
  console.log('events:', JSON.stringify(tally), '| frames kept:', shots.kept.length);
  await browser.close();
  if (errs.length) { console.log('ERRORS', errs.join(' | ')); process.exitCode = 1; }
})();
