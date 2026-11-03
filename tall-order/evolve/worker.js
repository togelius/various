#!/usr/bin/env node
// One evaluation worker: owns a headless Chromium with Tall Order loaded, and answers JSON-line jobs on stdin.
//   {id, op:'starts', seed, n}               -> {id, starts}
//   {id, op:'run', code, specs}              -> {id, results}
// It is a separate process so the parent can SIGKILL it if a controller hangs the page.
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.AudioContext = undefined; window.webkitAudioContext = undefined;     // no sound: the sim doesn't need it
    window.requestAnimationFrame = () => 0;                                    // we step the game ourselves
  });
  await page.route(/^(?!file:)/, r => r.abort());                              // no fonts, no network
  await page.goto(GAME, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.tallOrder);
  await page.addScriptTag({ path: path.join(__dirname, 'driver.js') });
  const rl = readline.createInterface({ input: process.stdin });
  const out = o => process.stdout.write(JSON.stringify(o) + '\n');
  out({ ready: true });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const job = JSON.parse(line);
    try {
      if (job.op === 'starts') out({ id: job.id, starts: await page.evaluate(([s, n]) => window.__EV.makeStarts(s, n), [job.seed, job.n]) });
      else if (job.op === 'run') {
        const results = [];
        for (const spec of job.specs) results.push(await page.evaluate(([c, s]) => window.__EV.run(c, s), [job.code, spec]));
        out({ id: job.id, results });
      }
    } catch (e) { out({ id: job.id, error: String(e.message || e).slice(0, 300) }); }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
