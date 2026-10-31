// The shared M4 sweep (M4 plan B4): the departments are built once, seeds 1–100 of each of the
// three departments at each depth 1–7 (2,100 visits, as Dept.create makes them), and each is
// handed to every check in test/sweep/*.check.js, so the packages that check what population,
// the validators, the items, the runner and the panels made share one build instead of each
// making its own.
//
// A check file, test/sweep/<name>.check.js, exports a function of the loaded core,
// C => ({each, done}):
//   each(d) → null, or a problem (a sentence). d = {state, seed, acc, depth}, one department,
//            given in the order acc (S9, A4, M11), then depth, then seed. A check reads
//            d.state and never changes it (the sweep fails one that does, by name); one that
//            needs to play a department clones it (C.State.clone);
//   done() → null, or a problem: called once after the last department, for a check over the
//            whole sweep (a rate, a count).
// Each check is a test of its own here, failing with its first problems and where they are.
// With no check file the sweep builds nothing.
'use strict';
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const os = require('node:os');
  const DIR = path.join(root, 'test/sweep');
  const FULL = { accs: ['S9', 'A4', 'M11'], depths: [1, 2, 3, 4, 5, 6, 7], seeds: 100 };
  const SHOW = 10;

  // The check files of dir, by name.
  const names = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.check.js')).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) : [];
  const load = (dir, name) => {
    const make = require(path.join(dir, name));
    if (typeof make !== 'function') throw new Error(`${name} exports no function of the core`);
    return make;
  };

  // sweep(C, checks, size) → {problems: [{check, where, text}], built}: checks is [[name,
  // make]…]; each make(C) gives the check's {each, done}. Every department of size is built
  // once and handed to each check in order; a check that throws, returns a problem, or
  // changes the department is reported by name, with where (acc, depth and seed).
  function sweep(C, checks, size) {
    const problems = [], live = checks.map(([name, make]) => [name, make(C)]);
    for (const [name, c] of live) if (!c || typeof c.each !== 'function') throw new Error(`${name}'s check has no each(d)`);
    let built = 0;
    if (!live.length) return { problems, built };
    for (const acc of size.accs) for (const depth of size.depths) for (let seed = 1; seed <= size.seeds; seed++) {
      const state = C.Dept.create(seed, acc, depth), where = `${acc} depth ${depth} seed ${seed}`;
      built++;
      let before = JSON.stringify(state);
      for (const [name, c] of live) {
        let p = null;
        try { p = c.each({ state, seed, acc, depth }); } catch (e) { p = `threw: ${e && e.message}`; }
        if (p) problems.push({ check: name, where, text: String(p) });
        const after = JSON.stringify(state);
        if (after !== before) { problems.push({ check: name, where, text: 'changed the department it was given' }); before = after; }
      }
    }
    for (const [name, c] of live) {
      if (typeof c.done !== 'function') continue;
      let p = null;
      try { p = c.done(); } catch (e) { p = `threw: ${e && e.message}`; }
      if (p) problems.push({ check: name, where: 'the whole sweep', text: String(p) });
    }
    return { problems, built };
  }
  const report = ps => ps.slice(0, SHOW).map(p => `${p.where}: ${p.text}`).join('\n') + (ps.length > SHOW ? `\n… and ${ps.length - SHOW} more` : '');

  // The real sweep, run once for every check file's test.
  const files = names(DIR);
  let result = null;
  const full = () => result || (result = sweep(loadCore(), files.map(n => [n, load(DIR, n)]), FULL));
  for (const name of files) {
    test(`the shared sweep: ${name} finds no problem over ${FULL.seeds} seeds × ${FULL.accs.length} departments × ${FULL.depths.length} depths`, () => {
      const r = full(), mine = r.problems.filter(p => p.check === name);
      assert.equal(r.built, FULL.seeds * FULL.accs.length * FULL.depths.length);
      assert.equal(mine.length, 0, `${name}: ${mine.length} problem(s)\n${report(mine)}`);
    });
  }

  // The sweep itself, on planted checks over a small size (M.11, depths 1 and 2, seeds 1–2):
  // every department once, in order; problems, throws and a changed department reported by
  // name and place; done once at the end; check files found by name, and none means no build.
  test('the shared sweep hands every department to every check once, in order, and reports what fails', () => {
    const C = loadCore(), small = { accs: ['M11'], depths: [1, 2], seeds: 2 };
    const seen = [], dones = [];
    const record = () => ({ each: d => { seen.push(`${d.acc}.${d.depth}.${d.seed}`); assert.ok(d.state && d.state.dept.acc === d.acc && d.state.dept.depth === d.depth && d.state.seed === d.seed); return null; }, done: () => { dones.push(seen.length); return null; } });
    const picky = () => ({ each: d => (d.seed === 2 && d.depth === 1 ? 'a planted problem' : null), done: () => 'a planted whole-sweep problem' });
    const thrower = () => ({ each: d => { if (d.depth === 2 && d.seed === 1) throw new Error('planted'); return null; } });
    const meddler = () => ({ each: d => { if (d.seed === 1 && d.depth === 1) d.state.turn = 99; return null; } });
    const r = sweep(C, [['record', record], ['picky', picky], ['thrower', thrower], ['meddler', meddler]], small);
    assert.equal(r.built, 4);
    assert.equal(JSON.stringify(seen), JSON.stringify(['M11.1.1', 'M11.1.2', 'M11.2.1', 'M11.2.2']));
    assert.equal(JSON.stringify(dones), JSON.stringify([4]));
    const got = r.problems.map(p => `${p.check} @ ${p.where}: ${p.text}`);
    assert.equal(JSON.stringify(got), JSON.stringify([
      'meddler @ M11 depth 1 seed 1: changed the department it was given',
      'picky @ M11 depth 1 seed 2: a planted problem',
      'thrower @ M11 depth 2 seed 1: threw: planted',
      'picky @ the whole sweep: a planted whole-sweep problem',
    ]));
    // With no checks, nothing is built.
    assert.equal(sweep(C, [], FULL).built, 0);
    // Check files are found by name, in name order, and must export a function of the core.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-sweep-'));
    fs.writeFileSync(path.join(tmp, 'b.check.js'), "module.exports = C => ({ each: d => (d.depth === 2 ? 'b: ' + C.Packs.get(d.acc).title : null) });\n");
    fs.writeFileSync(path.join(tmp, 'a.check.js'), 'module.exports = () => ({ each: () => null });\n');
    fs.writeFileSync(path.join(tmp, 'notes.txt'), 'not a check\n');
    fs.writeFileSync(path.join(tmp, 'c.check.js'), 'module.exports = { each: () => null };\n');
    assert.equal(JSON.stringify(names(tmp)), JSON.stringify(['a.check.js', 'b.check.js', 'c.check.js']));
    assert.throws(() => load(tmp, 'c.check.js'), /exports no function/);
    const r2 = sweep(C, ['a.check.js', 'b.check.js'].map(n => [n, load(tmp, n)]), small);
    assert.equal(JSON.stringify(r2.problems.map(p => p.check)), JSON.stringify(['b.check.js', 'b.check.js']));
    assert.match(r2.problems[0].text, /^b: /);
    assert.equal(JSON.stringify(names(path.join(tmp, 'none'))), '[]');
  });
};
