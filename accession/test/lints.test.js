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
