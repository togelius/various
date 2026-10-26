// The lints catch what they are for: planted violations fail, under any syntax the core
// lint is likely to meet (BUILD.md §3.3, §11 M0).
module.exports = ({ test, assert, root, fs, path }) => {
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-lint-'));
  const run = (script, args) => spawnSync(process.execPath, [path.join(root, script), ...args], { encoding: 'utf8' });
  const lintSrc = src => { const f = path.join(tmp, 'planted.js'); fs.writeFileSync(f, "'use strict';\n" + src + '\n'); return run('tools/lint-core.js', [f]).status; };

  test('lint-core fails on each forbidden thing, however it is written', () => {
    const bad = [
      'const r = Math.random();', 'const t = Date.now();', 'const d = Math.sqrt(2);', 'const p = 2 ** 3;', 'const r = Math["random"]();',
      'const M = Math; M.random();', 'const { random } = Math;', 'const a = Math.PI * 2;', 'parseFloat("1.5");', 'new Intl.Collator();',
      "['b','a'].sort();", 'for (const k in o) {}', "'a'.localeCompare('b');", '(1.5).toFixed(1);', "eval('1');", "Function('return 1')();",
      "s.replace(/'/g, 'x'); const z = Date.now();", 'const s = `${Math.random()}`;', 'const a = Math\n  .random();', 'const re = /a"b/; Date.now();',
      'const n = performance.now();', 'self.x = 1;',
    ];
    for (const b of bad) assert.equal(lintSrc(b), 1, 'not caught: ' + b);
  });

  // What the lint missed at the Wave 1 integration review: the locale's case members,
  // parseFloat reached through Number, GC-timed callbacks, a sort whose comparator is left
  // out by writing undefined or null or by toSorted, and the Function constructor reached
  // through a function's .constructor.
  test('lint-core fails on the equivalents of what it bans: locale case, Number.parseFloat, FinalizationRegistry, toSorted, a missing comparator, a constructor call', () => {
    const bad = ["'i'.toLocaleUpperCase();", "'I'.toLocaleLowerCase();", 'd.toLocaleTimeString();', "Number.parseFloat('1.5');", 'const { parseFloat: p } = Number;',
      'new FinalizationRegistry(() => {});', '[3, 1].toSorted();', '[3, 1].sort(undefined);', '[3, 1].toSorted(null);', "(() => {}).constructor('return 1')();",
      "const f = function () {}; f.constructor('x');"];
    for (const b of bad) assert.equal(lintSrc(b), 1, 'not caught: ' + b);
    const ok = ['[3, 1].toSorted((a, b) => a - b);', 'const w = new WeakMap(); const v = new WeakSet();', 'const c = o.constructor === Object;', "const s = 'x'.toUpperCase();"];
    for (const g of ok) assert.equal(lintSrc(g), 0, 'wrongly flagged: ' + g);
  });

  // A comparator that returns a comparison (true or false) never returns a negative number,
  // so engines sort with it differently: V8 leaves [3, 1, 2] as it is, SpiderMonkey sorts it
  // (BUILD.md §3.3).
  test('lint-core fails a sort whose comparator returns true or false rather than a number', () => {
    const bad = ['[3, 1].sort((a, b) => a > b);', '[3, 1].sort(function (a, b) { return a < b; });', '[3, 1].toSorted((a, b) => a >= b);', 'xs.sort((p, q) => p.d <= q.d);'];
    for (const b of bad) assert.equal(lintSrc(b), 1, 'not caught: ' + b);
    const ok = ['[3, 1].sort((a, b) => (a > b) - (a < b));', '[3, 1].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));', '[3, 1].sort(function (a, b) { return a - b; });', 'const lt = (a, b) => a < b;'];
    for (const g of ok) assert.equal(lintSrc(g), 0, 'wrongly flagged: ' + g);
  });

  test('check-all lints every tool the hardened context and the hash page run: arena, monkey, replay and the policies', () => {
    const sh = fs.readFileSync(path.join(root, 'check-all.sh'), 'utf8'), line = sh.split('\n').find(l => /^run lint-tools /.test(l));
    for (const f of ['tools/arena.js', 'tools/monkey.js', 'tools/replay.js', 'tools/policies/*.js']) assert.ok(line && line.includes(f), `check-all's lint-tools step does not lint ${f}: ${line}`);
    assert.equal(run('tools/lint-core.js', ['tools/arena.js', 'tools/monkey.js', 'tools/replay.js']).status, 0);
  });

  test('lint-core ignores comments, strings, keys and the allowed Math functions', () => {
    const ok = ["// Math.random is banned\nconst s = 'Date.now';\n/* window */", "const o = { window: 'window', Date: 1 };", 'const k = o.Date;',
      'const m = Math.max(1, Math.floor(7 / 2), Math.ceil(1), Math.imul(3, 4), Math.abs(-1), Math.min(2, 3), Math.sign(-2), Math.trunc(2));',
      "const t = 'Long-Handled Date Stamp';", "[3, 1].sort((a, b) => a - b);"];
    for (const g of ok) assert.equal(lintSrc(g), 0, 'wrongly flagged: ' + g);
  });

  test('lint-numbers fails on a planted mismatch', () => {
    const md = fs.readFileSync(path.join(root, 'BUILD.md'), 'utf8').replace('| TICKS_PER_TURN | 100 |', '| TICKS_PER_TURN | 101 |');
    const f = path.join(tmp, 'BUILD.md');
    fs.writeFileSync(f, md);
    const r = run('tools/lint-numbers.js', [f]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /TICKS_PER_TURN/);
  });

  // A number's meaning is written twice, in §8.10 and beside it in numbers.js, and the two
  // must say the same thing, so a reader tuning the table reads what the number controls.
  test('lint-numbers fails on a planted difference between a number\'s meaning in BUILD.md and in numbers.js', () => {
    const md = fs.readFileSync(path.join(root, 'BUILD.md'), 'utf8');
    const row = md.split('\n').find(l => l.startsWith('| TICKS_PER_TURN |'));
    assert.ok(row, 'the TICKS_PER_TURN row');
    const f = path.join(tmp, 'BUILD-meaning.md');
    fs.writeFileSync(f, md.replace(row, '| TICKS_PER_TURN | 100 | a planted meaning |'));
    const r = run('tools/lint-numbers.js', [f]);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /TICKS_PER_TURN means "a planted meaning" in BUILD\.md but/);
    assert.equal(run('tools/lint-numbers.js', []).status, 0);
  });

  test('lint-registry passes, and fails on an unledgered file or a ledger entry with no file', () => {
    assert.equal(run('tools/lint-registry.js', []).status, 0);
    const led = JSON.parse(fs.readFileSync(path.join(root, 'art/ledger.json'), 'utf8'));
    const f = path.join(tmp, 'ledger.json');
    fs.writeFileSync(f, JSON.stringify(Object.assign({}, led, { entries: led.entries.filter(e => e.file !== 'art/sprites/wader.txt') })));
    let r = run('tools/lint-registry.js', ['--ledger', f]);
    assert.equal(r.status, 1); assert.match(r.stdout, /art\/sprites\/wader\.txt has no entry/);
    fs.writeFileSync(f, JSON.stringify(Object.assign({}, led, { entries: led.entries.concat([{ file: 'art/sprites/ghost.txt', source: 'code', author: 'x', licence: 'MIT' }]) })));
    r = run('tools/lint-registry.js', ['--ledger', f]);
    assert.equal(r.status, 1); assert.match(r.stdout, /ghost\.txt is listed but not on disk/);
  });

  test('index.html lists exactly the core and content files on disk', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const listed = new Set([...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f.startsWith('js/core/') || f.startsWith('content/')));
    const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : e.name.endsWith('.js') ? [d + '/' + e.name] : []);
    const onDisk = new Set([...walk('js/core'), ...walk('content')]);
    for (const f of onDisk) assert.ok(listed.has(f), `${f} is on disk but not in index.html`);
    for (const f of listed) assert.ok(onDisk.has(f), `${f} is in index.html but not on disk`);
  });
};
