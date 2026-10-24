// ACCESSION — runs dist/accession-hash.html in Chromium (BUILD.md §3.5), in two parts.
// 1. The golden runs, of every kind. Every pinned run must PASS. When the page says PENDING
//    (a run has no pin while a wave changes the state), each pending run's hash and
//    checkpoints on the page must equal the same run in Node, through tools/core-context.js
//    on this tree (tools/hash-compare.js).
// 2. The divergence printer, on planted runs: the same page with its golden runs replaced by
//    a replay pinned in Node and then given one changed action, and a monkey run whose pin
//    has one changed step. The page must fail, name the first diverging step of each with
//    its action and events in the same words as Node, and offer them as a copyable block
//    whose Download button saves the same text.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { open, root } from './lib.mjs';
const require = createRequire(import.meta.url);
const HashCompare = require('../hash-compare.js');

const fail = (why, errors) => { console.log(why); if (errors && errors.length) console.log('errors:', errors.join('; ')); process.exit(1); };
const settle = async page => page.waitForFunction(() => ['PASS', 'FAIL', 'PENDING'].includes(document.title), null, { timeout: 120000 });

// 1. The golden runs.
let summary = '';
{
  const { browser, page, errors } = await open('dist/accession-hash.html', { viewport: { width: 800, height: 600 } });
  let title, text, results;
  try {
    await settle(page);
    title = await page.title();
    text = await page.textContent('#out');
    results = await page.evaluate(() => window.HASH_RESULTS || null);
  } catch (e) { console.log('errors:', errors.join('; ')); await browser.close(); throw e; }
  await browser.close();
  console.log(text.split('\n').filter(Boolean).join(' | '));
  if (errors.length) fail('the page logged errors', errors);
  if (title === 'FAIL') fail('the page found a difference');
  if (title === 'PASS' && !text.includes('ALL PASS')) fail('the page says PASS but not ALL PASS');
  if (title === 'PASS') summary = 'every golden run passes';
  if (title === 'PENDING') {
    // Compare each pending run with Node, and check that what the page showed is what it reported.
    const golden = HashCompare.readGolden();
    const node = HashCompare.nodeRuns(golden);
    const problems = HashCompare.compare(golden, results, node);
    for (const name of Object.keys(node)) {
      if (!text.includes(`PENDING ${name}: hash ${node[name].hash}, checkpoints ${node[name].checkpoints.join(' ')}`)) problems.push(`${name}: the page does not show Node's hash and checkpoints`);
    }
    if (problems.length) fail('pending runs differ from Node: ' + problems.join('; '));
    summary = `pending runs equal Node's: ${Object.keys(node).map(n => `${n} ${node[n].hash}`).join(', ')}`;
    console.log(summary);
  }
}

// 2. Planted divergences.
const Replay = require('../replay.js'), C = Replay.load(), R = C.Replay;
const planted = {}, expect = {};
{
  // A replay of 160 actions from the monkey's first visit, pinned here; then one move, past
  // the first checkpoint, becomes a wait, so that action is where it first differs.
  const r = R.record({ kind: 'monkey', seed: 20261023, actions: 160, make: null }, 160);
  if (r.actions.length < 120) fail(`the planted replay has only ${r.actions.length} actions`);
  const p = R.golden(r, { steps: true });
  const at = r.actions.findIndex((a, i) => i >= 104 && a.a === 'move');
  if (at < 0) fail('the planted replay has no move to change');
  const entry = Object.assign({}, r, { hash: p.hash, checkpoints: p.checkpoints, steps: R.encode(p.steps) });
  entry.actions = entry.actions.slice(); entry.actions[at] = { a: 'wait' };
  planted.plantedReplay = entry; expect.plantedReplay = at + 1;
  // A 300-action monkey whose pin has one step's hash, and its final hash, changed.
  const m = { kind: 'monkey', seed: 11, actions: 300, make: null }, q = R.golden(m, { steps: true });
  const steps = q.steps.slice(); steps[216] = (steps[216] + 1) >>> 0;
  planted.plantedMonkey = Object.assign({}, m, { hash: (q.hash + 1) >>> 0, checkpoints: q.checkpoints, visits: q.visits, steps: R.encode(steps) });
  expect.plantedMonkey = 217;
}
// What Node says about each, which the page must say word for word.
const words = {};
for (const name of Object.keys(planted)) {
  const v = R.verify(name, planted[name]);
  if (v.ok !== false || !v.diverged || v.diverged.step !== expect[name]) fail(`${name}: Node does not find the planted change at step ${expect[name]}: ${v.text}`);
  words[name] = v.text;
}
{
  const built = fs.readFileSync(path.join(root, 'dist/accession-hash.html'), 'utf8');
  const src = fs.readFileSync(path.join(root, 'test/golden/golden.js'), 'utf8');
  const at = built.indexOf(src);
  if (at < 0 || built.indexOf(src, at + 1) >= 0) fail('the built page does not hold test/golden/golden.js exactly once');
  const html = built.slice(0, at) + "'use strict';\nconst GOLDEN = " + JSON.stringify(planted) + ';\n' + built.slice(at + src.length);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-hash-')), file = path.join(dir, 'planted.html');
  fs.writeFileSync(file, html);
  const { browser, page, errors } = await open(path.relative(root, file), { viewport: { width: 390, height: 844 } });
  let title, text, report, results, box, saved;
  try {
    await settle(page);
    title = await page.title();
    text = await page.textContent('#out');
    report = await page.inputValue('#report');
    results = await page.evaluate(() => window.HASH_RESULTS);
    box = { shown: await page.isVisible('#diverged'), copy: await page.locator('#copy').boundingBox(), download: await page.locator('#download').boundingBox() };
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#download')]);
    saved = fs.readFileSync(await dl.path(), 'utf8');
  } catch (e) { console.log('errors:', errors.join('; ')); await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); throw e; }
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  if (errors.length) fail('the planted page logged errors', errors);
  if (title !== 'FAIL') fail(`the planted page says ${title}, not FAIL`);
  if (!box.shown) fail('the planted page does not show its copyable block');
  for (const k of ['copy', 'download']) if (!box[k] || box[k].height < 44 || box[k].width < 44) fail(`the ${k} button is smaller than 44 px`);
  for (const name of Object.keys(planted)) {
    const d = results[name] && results[name].diverged;
    if (!d || d.step !== expect[name]) fail(`${name}: the page reports ${d ? 'step ' + d.step : 'no diverging step'}, not step ${expect[name]}`);
    if (!text.includes(words[name])) fail(`${name}: the page's words differ from Node's:\nNode: ${words[name]}\npage: ${text}`);
    if (!report.includes(words[name])) fail(`${name}: the copyable block does not hold Node's words`);
    if (!saved.includes(words[name])) fail(`${name}: the downloaded file does not hold Node's words`);
  }
  if (saved.trim() !== report.trim()) fail('the downloaded file differs from the copyable block');
  console.log(`${summary}; planted divergences found on the page as in Node: ${Object.keys(planted).map(n => `${n} at step ${expect[n]}`).join(', ')}`);
}
