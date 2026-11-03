// The controller-evolution harness (evolve/): sandbox limits, prompt plumbing, the MAP-Elites archive, start scenarios
// (varied, and held-out neighbourhoods that training never touches), a deterministic headless episode, the pool, and a
// drift guard that fails when game.js's step() grows a gameplay call that the headless world does not replay.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const E = path.join(__dirname, '..', 'evolve');
const { validate, Controller, LIMITS } = require(E + '/sandbox');
const { Archive, AXES } = require(E + '/archive');
const P = require(E + '/prompts');
const { makeStarts, isHeldOutBlock, cityMap } = require(E + '/scenarios');
const { createWorld, STEP_CALLS } = require(E + '/world');
const { runEpisode, aggregate } = require(E + '/episode');
let checks = 0; const check = (v, m) => { assert.ok(v, m); checks++; };
const seed = f => fs.readFileSync(path.join(E, 'seeds', f), 'utf8');

// 1. Sandbox: size cap, static bans, time limit, JSON-only boundary, memory, deterministic Math.random.
check(validate(seed('walker.js')).ok && validate(seed('driver.js')).ok, 'both seed controllers are valid');
check(!validate('function think(o,m){return {};}\n' + '// x\n'.repeat(130)).ok && validate('function think(o,m){return {};}\n' + '// x\n'.repeat(130)).tooLong, 'more than the line limit is rejected as too long');
check(validate('function think(o,m){return {};}' + ' '.repeat(LIMITS.maxChars)).tooLong, 'more than the character limit is rejected as too long');
for (const [src, why] of [['function think(o,m){while(true){} return {};}', 'while'], ['function think(o,m){return {a: eval("1")};}', 'eval'], ['function think(o,m){return process.exit();}', 'process'],
  ['function think(o,m){return this.constructor.constructor("return 1")();}', 'constructor'], ['function think(o,m){do{}while(0);return {};}', 'do'], ['function think(o,m){return {a: Date.now()};}', 'Date'], ['function think(o,m){throw new Error("x");}', 'throw']])
  check(!validate(src).ok, 'rejected: ' + why);
check(validate('function think(o,m){ /* while (true) {} */ const s = "while(1)"; return {}; }').ok, 'bans look at code, not comments or strings');
{ const c = new Controller('function think(o,m){ for(;;){} }', 1); const r = c.step({}); check(r.error && /timed out/.test(r.error), 'an endless loop is cut off by the time limit'); }
{ const c = new Controller('function think(o,m){ m.n=(m.n||0)+1; return {move:m.n, r:Math.random()}; }', 7), d = new Controller('function think(o,m){ m.n=(m.n||0)+1; return {move:m.n, r:Math.random()}; }', 7);
  const a1 = c.step({}), a2 = c.step({}), b1 = d.step({}); check(a2.move === 2 && a1.r === b1.r && a1.r !== a2.r, 'memory persists across calls and Math.random is seeded per run'); }
{ const c = new Controller('function think(o,m){ return {hp:o.me.hp, f:function(){}} }', 1); const r = c.step({ me: { hp: 5 } }); check(r.hp === 5 && r.f === undefined, 'only JSON crosses the boundary'); }

// 2. Prompts: diff application and code extraction.
check(P.applyDiff('a\nb\nc\n', '<<<<<<< SEARCH\nb\n=======\nB\n>>>>>>> REPLACE').code === 'a\nB\nc\n', 'a SEARCH/REPLACE block is applied');
check(P.applyDiff('a\nb\nb\n', '<<<<<<< SEARCH\nb\n=======\nB\n>>>>>>> REPLACE').error, 'an ambiguous SEARCH block is refused');
check(P.applyDiff('a\n', '<<<<<<< SEARCH\nzzz\n=======\nB\n>>>>>>> REPLACE').error, 'a SEARCH block that is not there is refused');
check(P.extractCode('idea\n```js\nfunction think(o,m){}\n```\n') === 'function think(o,m){}\n', 'the code block is extracted');
{ const parent = { code: seed('walker.js'), cur: 0.5, desc: [0, 0], cell: [0, 0], eval: null }; const p = P.mutationPrompt({ parent, hint: P.HINTS[0], mode: 'diff' });
  check(p.includes('function think') && p.includes(String(LIMITS.maxChars)) && p.includes('POSITIVE TO THE RIGHT') && p.length < 16000, 'the mutation prompt carries the contract, the limit and the parent (' + p.length + ' chars)'); }

// 3. Archive: bins, contests, ties go to the shorter program, empty neighbours.
{ const a = new Archive(); const g = (q, d, code = 'x') => ({ cur: q, desc: d, code });
  check(a.cellOf([0, 0]).join() === '0,0' && a.cellOf([1, 50]).join() === '5,5' && a.cellOf([0.3, 1]).join() === '2,2', 'descriptor bins');
  check(a.contest(g(0.3, [0, 0])) === 'new' && a.contest(g(0.2, [0, 0])) === 'worse' && a.contest(g(0.4, [0, 0])) === 'better', 'new / worse / better');
  check(a.contest(g(0.4, [0, 0], 'xx')) === 'worse' && a.contest(g(0.4, [0, 0], '')) === 'better', 'a tie goes to the shorter controller');
  check(a.emptyNear([0, 0]).every(c => Math.max(c[0], c[1]) <= 1) && a.emptyNear([0, 0]).length === 3, 'empty cells next to a cell'); }

// 4. Scenarios: reproducible, varied, and the held-out neighbourhoods are never used for training.
{ const a = makeStarts(5, 8, 'train'), b = makeStarts(5, 8, 'train'), h = makeStarts(5, 12, 'heldout');
  check(JSON.stringify(a) === JSON.stringify(b), 'the same seed gives the same starts');
  check(a.every(s => !isHeldOutBlock(s.block[0], s.block[1])) && h.every(s => isHeldOutBlock(s.block[0], s.block[1])), 'training and held-out starts are in different blocks');
  check(new Set(a.map(s => s.mode)).size >= 2 && new Set(a.map(s => s.story)).size >= 2 && new Set(a.map(s => s.hour)).size >= 3, 'starts vary in mode, job and time of day');
  check(a.concat(h).every(s => s.giverDist >= 100 && s.giverDist <= 460), 'every start is 120-450 m from the giver');
  const m = cityMap(); const held = m.walk.filter(n => isHeldOutBlock(n.bi, n.bj)).length / m.walk.length; check(held > 0.1 && held < 0.4, 'about a quarter of the city is held out (' + held.toFixed(2) + ')'); }

// 5. A headless episode: the turn sign matches the documented bearings, and the same episode twice is identical.
{ const s = makeStarts(3, 1, 'train')[0], w = createWorld(s.seed, { density: 0.2 }); w.setup({ ...s, car: undefined, parked: undefined, mode: 'foot', wanted: 0 });
  const h0 = w.obs().me.h; for (let i = 0; i < 4; i++) { w.act({ turn: 1 }); w.tick(false); } const dh = w.obs().me.h - h0;
  check(dh < -0.5 && dh > -2, 'turn +1 turns right: the heading decreases (' + dh.toFixed(2) + ' rad)');
  const o = w.obs(); check(o.goal && o.gps && o.rays.length === 7 && typeof o.me.hp === 'number', 'the observation has a goal, a route and rays');
  const run = () => { const r = runEpisode(seed('walker.js'), s, { density: 0.3, seconds: 12 }); return JSON.stringify({ p: r.points, a: r.approach, df: r.dFoot, ev: r.events, e: r.ended }); };
  check(run() === run(), 'the same controller on the same start plays out identically'); }

// 6. Drift guard: every gameplay call in game.js's step() is replayed by the headless world.
{ const s = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8'), i = s.indexOf('function step(dt) {'); let d = 0, j = i; for (let k = s.indexOf('{', i); k < s.length; k++) { if (s[k] === '{') d++; if (s[k] === '}' && !--d) { j = k; break; } }
  const calls = new Set([...s.slice(i, j + 1).matchAll(/\b([A-Z][A-Za-z]*)\.([a-zA-Z]+)\(/g)].map(m => m[1] + '.' + m[2]));
  const cosmetic = c => /^(RENDER|AUDIO|Math|HUD|M)\./.test(c) || ['CITY.nearestPlace', 'W.particle', 'W.rng'].includes(c); /* audio, grading, hydrant spray */
  const missing = [...calls].filter(c => !cosmetic(c) && !STEP_CALLS.includes(c)), extra = STEP_CALLS.filter(c => !calls.has(c));
  check(!missing.length, 'game.js step() calls that evolve/world.js does not replay: ' + missing.join(', ') + ' (add them to the step script and STEP_CALLS, or to the cosmetic list here)');
  check(!extra.length, 'evolve/world.js replays calls that game.js step() no longer makes: ' + extra.join(', ')); }

// 7. A tiny pool run: a good controller scores, a broken one reports an error instead of crashing the worker.
(async () => {
  const { Pool } = require(E + '/pool'); const pool = new Pool(2); const s = makeStarts(3, 1, 'train')[0];
  const [good, bad] = await Promise.all([pool.run(seed('walker.js'), s, { density: 0.3, seconds: 10 }), pool.run('function think(o,m){ return o.nope.x; }', s, { density: 0.3, seconds: 6 })]);
  pool.close();
  check(typeof good.quality === 'number' && good.ended === 'time' && good.tFoot > 5, 'a pool worker plays an episode');
  check(bad.firstError && bad.errors > 0, 'a throwing controller is reported, not fatal');
  const agg = aggregate([good, bad]); check(agg.n === 2 && agg.errors > 0, 'aggregate counts');
  console.log('Evolve harness: ' + checks + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
void AXES;
