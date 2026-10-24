// ACCESSION — runs dist/accession-hash.html in Chromium (BUILD.md §3.5), in two parts.
// 1. The golden runs, of every kind. Every pinned run must PASS. When the page says PENDING
//    (a run has no pin while a wave changes the state), each pending run's hash and
//    checkpoints on the page must equal the same run in Node, through tools/core-context.js
//    on this tree (tools/hash-compare.js). The page, and the game in dist/accession.html,
//    must carry this tree's coreHash (and the game its vmHash), from tools/core-hash.js.
// 2. Planted runs, on the same page with its golden runs replaced: a replay with switched
//    options, pinned in Node, which must PASS with Node's hash; the same replay pending,
//    which must equal Node's run; a replay pinned in Node and then given one changed action;
//    and a monkey run whose pin has one changed step. The page must name the first diverging
//    step of the last two with its action and events in the same words as Node, and offer
//    them as a copyable block whose Download button saves the same text.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { open, root } from './lib.mjs';
const require = createRequire(import.meta.url);
const HashCompare = require('../hash-compare.js');
const Hashes = require('../core-hash.js');
const CORE = Hashes.coreHash(), VM = Hashes.vmHash();

const fail = (why, errors) => { console.log(why); if (errors && errors.length) console.log('errors:', errors.join('; ')); process.exit(1); };
const settle = async page => page.waitForFunction(() => ['PASS', 'FAIL', 'PENDING'].includes(document.title), null, { timeout: 120000 });

// 1. The golden runs.
let summary = '';
{
  const { browser, page, errors } = await open('dist/accession-hash.html', { viewport: { width: 800, height: 600 } });
  let title, text, results, ua;
  try {
    await settle(page);
    title = await page.title();
    text = await page.textContent('#out');
    ua = await page.textContent('#ua');
    results = await page.evaluate(() => window.HASH_RESULTS || null);
  } catch (e) { console.log('errors:', errors.join('; ')); await browser.close(); throw e; }
  await browser.close();
  console.log(text.split('\n').filter(Boolean).join(' | '));
  if (errors.length) fail('the page logged errors', errors);
  if (title === 'FAIL') fail('the page found a difference');
  // The builds carry this tree's coreHash and vmHash (build-single.py).
  if (!ua.includes(` · core ${CORE}`)) fail(`the hash page is not stamped with this tree's coreHash ${CORE}: ${ua}`);
  const game = fs.readFileSync(path.join(root, 'dist/accession.html'), 'utf8'), head = game.slice(0, game.indexOf('</head>'));
  for (const [k, v] of [['accession-core-hash', CORE], ['accession-vm-hash', VM]]) {
    if (!head.includes(`<meta name="${k}" content="${v}">`)) fail(`dist/accession.html has no <meta name="${k}" content="${v}"> in its head`);
  }
  if (title === 'PASS' && !text.includes('ALL PASS')) fail('the page says PASS but not ALL PASS');
  if (title === 'PASS') summary = `every golden run passes; core ${CORE}`;
  if (title === 'PENDING') {
    // Compare each pending run with Node, and check that what the page showed is what it reported.
    const golden = HashCompare.readGolden();
    const node = HashCompare.nodeRuns(golden);
    const problems = HashCompare.compare(golden, results, node);
    for (const name of Object.keys(node)) {
      if (!text.includes(`PENDING ${name}: hash ${node[name].hash}, checkpoints ${node[name].checkpoints.join(' ')}`)) problems.push(`${name}: the page does not show Node's hash and checkpoints`);
    }
    if (problems.length) fail('pending runs differ from Node: ' + problems.join('; '));
    summary = `pending runs equal Node's: ${Object.keys(node).map(n => `${n} ${node[n].hash}`).join(', ')}; core ${CORE}`;
    console.log(summary);
  }
}

// 2. Planted divergences.
const Replay = require('../replay.js'), C = Replay.load(), R = C.Replay;
const planted = {}, expect = {}, same = {};
{
  // A replay of up to 160 actions from a monkey's first visit, on the first seed from
  // 20261023 whose first visit has at least 120 (how long a visit lasts depends on the rules).
  let r = null;
  for (let seed = 20261023; seed < 20261043 && !r; seed++) {
    const v = R.record({ kind: 'monkey', seed, actions: 160, make: null }, 160);
    if (v.actions.length >= 120) r = v;
  }
  if (!r) fail('no monkey visit of 120 actions or more, on 20 seeds, to plant a replay in');
  // The same actions with switched options (a training dummy taken out, your health kept at
  // 1 or more), pinned here: the page must play them as Node does, pinned and pending.
  const sw = Object.assign({}, R.make(r.start, { without: ['T0.1.room.2'], invulnerable: true }, r.actions), { kind: 'replay' });
  const ps = R.golden(sw, { steps: true });
  planted.pinnedReplay = Object.assign({}, sw, { hash: ps.hash, checkpoints: ps.checkpoints, steps: R.encode(ps.steps) });
  planted.pendingReplay = Object.assign({}, sw, { hash: null, checkpoints: [], steps: null, pending: 'planted' });
  same.pinnedReplay = ps; same.pendingReplay = ps;
  // The plain replay pinned here; then one move, past the first checkpoint, becomes a wait,
  // so that action is where it first differs.
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
for (const name of Object.keys(expect)) {
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
  // The replay with switched options: pinned, it passes with Node's hash; pending, it equals
  // Node's run, and the page shows that.
  const pin = results.pinnedReplay, n = planted.pinnedReplay.actions.length;
  if (!pin || pin.ok !== true || pin.hash !== same.pinnedReplay.hash) fail(`pinnedReplay: the page gives ${pin ? 'hash ' + pin.hash : 'nothing'}, where Node pinned ${same.pinnedReplay.hash}`);
  if (!text.includes(`PASS pinnedReplay: replay, ${n} actions, hash ${same.pinnedReplay.hash},`)) fail('pinnedReplay: the page does not show it passing');
  const only = { pendingReplay: planted.pendingReplay }, node = HashCompare.nodeRuns(only, C);
  const problems = HashCompare.compare(only, { pendingReplay: results.pendingReplay }, node);
  if (node.pendingReplay.hash !== same.pendingReplay.hash) problems.push('Node\'s pending run differs from its pinned one');
  if (!text.includes(`PENDING pendingReplay: hash ${node.pendingReplay.hash}, checkpoints ${node.pendingReplay.checkpoints.join(' ')}`)) problems.push('the page does not show Node\'s hash and checkpoints');
  if (problems.length) fail('pendingReplay: ' + problems.join('; '));
  for (const name of Object.keys(expect)) {
    const d = results[name] && results[name].diverged;
    if (!d || d.step !== expect[name]) fail(`${name}: the page reports ${d ? 'step ' + d.step : 'no diverging step'}, not step ${expect[name]}`);
    if (!text.includes(words[name])) fail(`${name}: the page's words differ from Node's:\nNode: ${words[name]}\npage: ${text}`);
    if (!report.includes(words[name])) fail(`${name}: the copyable block does not hold Node's words`);
    if (!saved.includes(words[name])) fail(`${name}: the downloaded file does not hold Node's words`);
  }
  if (saved.trim() !== report.trim()) fail('the downloaded file differs from the copyable block');
  console.log(`${summary}; a planted replay with switched options plays as in Node, pinned and pending (hash ${same.pinnedReplay.hash}); planted divergences found on the page as in Node: ${Object.keys(expect).map(n => `${n} at step ${expect[n]}`).join(', ')}`);
}
