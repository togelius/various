// M3's test and determinism infrastructure (BUILD.md §3.5, §5.3, §10.2, §10.3): the
// invariant checker and the Behaviour-line scenario harness on planted invariants and
// scenarios; the runner's folders and filter; the Wilson interval against published values;
// and the Node side of the hash page's pending check, on planted mismatches.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const Stats = require(path.join(root, 'tools/stats.js'));
  const HashCompare = require(path.join(root, 'tools/hash-compare.js'));
  const Runner = require(path.join(root, 'test/run.js'));
  const C = loadCore(['tools/monkey.js']);
  const { Setup, Roles, Packs, Registry, TestRoom, Monkey } = C;
  // A test given a temporary folder of its own, tmp: made as it starts, and removed in a
  // finally block as it ends, whether it passed or failed.
  let tmp = null;
  const tmpTest = (name, fn) => test(name, () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-infra-'));
    try { fn(); } finally { fs.rmSync(tmp, { recursive: true, force: true }); tmp = null; }
  });
  const write = (rel, text) => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
  const json = x => JSON.stringify(x);

  // Planted invariants: one the rules break (a hunting dummy walks), one they keep (health
  // never exceeds its maximum), and one checked once a step.
  const still = { id: 'planted_still', applies: a => a.uid !== 'you',
    check: (pre, events, post, ctx) => ctx.before && (ctx.before.x !== ctx.actor.x || ctx.before.y !== ctx.actor.y) ? `moved from ${ctx.before.x},${ctx.before.y} to ${ctx.actor.x},${ctx.actor.y}` : null };
  const healthy = { id: 'planted_hp', applies: () => true, check: (pre, events, post, ctx) => ctx.actor.hp > ctx.actor.maxHp ? 'more health than its maximum' : null };

  test('the invariant checker reports a planted clause the rules break, on the right actor and step, and nothing for one they keep', () => {
    let calls = 0;
    const perStep = { id: 'planted_per_step', check: (pre, events, post, ctx) => { calls++; return ctx.uid === null && ctx.actor === null ? null : 'given an actor'; } };
    const waits = Array.from({ length: 30 }, () => ({ a: 'wait' }));
    // You are made hard to kill, so that every wait is played.
    const room = () => { const s = TestRoom.create(9); s.actors[0].hp = s.actors[0].maxHp = 999; return s; };
    const p = H.play(C, room(), waits, { inv: [still, healthy, perStep] });
    assert.equal(p.steps.length, 30);
    assert.equal(calls, 30, 'an invariant without applies is checked once a step');
    assert.ok(p.violations.length > 0, 'the hunting dummies walk, so "never moves" is broken');
    assert.ok(p.violations.every(v => v.inv === 'planted_still'), 'only the planted clause is broken: ' + p.violations.map(v => v.text).join('; '));
    // Independently, from the events of an identical run: (step, uid) for every exhibit
    // whose first move of a step started somewhere other than its last move ended.
    const q = H.play(C, room(), waits, { inv: [] });
    assert.equal(q.violations.length, 0);
    const want = [];
    q.steps.forEach((s, i) => {
      const by = new Map();
      for (const e of s.events) if (e.k === 'moved' && e.who !== 'you') { if (!by.has(e.who)) by.set(e.who, { from: e.from, to: e.to }); by.get(e.who).to = e.to; }
      for (const [uid, m] of by) if (json(m.from) !== json(m.to)) want.push(`${i + 1} ${uid}`);
    });
    assert.equal(json(p.violations.map(v => `${v.step} ${v.uid}`).sort()), json(want.sort()));
    const v = p.violations[0];
    assert.equal(json(v.action), json({ a: 'wait' }));
    assert.equal(v.sp, 'training_dummy');
    assert.ok(v.text.startsWith('planted_still: moved from') && v.text.includes(v.uid) && v.text.includes(`at step ${v.step}`), v.text);
  });

  test('the checker sees an actor destroyed during a step on that step only, and one created during it with before null', () => {
    const map = ['#######', '#.....#', '#######'];
    const s = Setup.room(1, { acc: 'T0', depth: 1, map, you: [1, 1], exhibits: [{ sp: 'x', at: [2, 1], mode: 'dormant', stats: { hp: 1, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
    const seen = [];
    const watch = { id: 'planted_watch', applies: a => a.uid !== 'you', check: (pre, events, post, ctx) => { seen.push(`${ctx.step} ${ctx.uid} ${ctx.actor.gone ? 'gone' : 'here'}`); return null; } };
    const p = H.play(C, s, [{ a: 'attack', uid: 'T0.1.room.1' }, { a: 'wait' }, { a: 'wait' }], { inv: [watch] });
    assert.ok(p.events.some(e => e.k === 'died'), 'the surprise blow destroys it');
    assert.equal(json(seen), json(['1 T0.1.room.1 gone']));
    // Direct calls on plain states: an actor that appears in post has no before.
    const check = Inv.checker(C, [{ id: 'planted_new', applies: () => true, check: (pre, events, post, ctx) => ctx.before ? null : `new ${ctx.uid}` }]);
    const pre = { actors: [{ uid: 'you' }, { uid: 'a' }] }, post = { actors: [{ uid: 'you' }, { uid: 'a' }, { uid: 'a/1' }] };
    assert.equal(json(check(pre, { a: 'wait' }, [], post).map(x => x.message)), json(['new a/1']));
    // A check that throws, one that returns a boolean, and an applies that throws are violations.
    const odd = Inv.checker(C, [{ id: 'throws', check: () => { throw new Error('boom'); } }, { id: 'bool', check: () => true }, { id: 'bad_applies', applies: () => { throw new Error('no'); }, check: () => null }]);
    const got = odd(pre, { a: 'wait' }, [], pre).map(x => `${x.inv}: ${x.message}`);
    assert.equal(got.length, 4, got.join('; '));
    assert.match(got[0], /^throws: threw boom/);
    assert.match(got[1], /^bool: check returned true/);
    assert.match(got[2], /^bad_applies: applies threw no/);
  });

  tmpTest('tools/invariants.js loads every .inv.js file in name order, selects by id or file, and refuses a malformed one', () => {
    write('inv/b.inv.js', "module.exports = C => [{ id: 'b1', applies: a => a.uid === 'you', check: () => null }, { id: 'b2', check: () => null }];\n");
    write('inv/a.inv.js', "module.exports = C => ({ id: 'a1', check: () => typeof C.Step.step === 'function' ? null : 'no core' });\n");
    write('inv/notes.js', "module.exports = 'not an invariant';\n");
    const dir = path.join(tmp, 'inv'), all = Inv.load(C, { dir });
    assert.equal(json(all.map(i => `${i.file}:${i.id}`)), json(['a:a1', 'b:b1', 'b:b2']));
    assert.equal(all[0].check(), null, 'the factory is given the loaded core');
    assert.equal(json(Inv.select(C, ['b'], { dir }).map(i => i.id)), json(['b1', 'b2']));
    assert.equal(json(Inv.select(C, ['a1', still], { dir }).map(i => i.id)), json(['a1', 'planted_still']));
    assert.equal(Inv.select(C, [], { dir }).length, 0);
    assert.equal(Inv.select(C, 'all', { dir }).length, 3);
    assert.throws(() => Inv.select(C, ['nothing'], { dir }), /no invariant or file named nothing/);
    write('bad/bad.inv.js', "module.exports = C => ({ id: 'x' });\n");
    assert.throws(() => Inv.load(C, { dir: path.join(tmp, 'bad') }), /bad\.inv\.js: x has no check/);
    write('dup/a.inv.js', "module.exports = C => ({ id: 'same', check: () => null });\n");
    write('dup/b.inv.js', "module.exports = C => ({ id: 'same', check: () => null });\n");
    assert.throws(() => Inv.load(C, { dir: path.join(tmp, 'dup') }), /same is defined twice/);
    // The real folder loads, whatever it holds.
    assert.ok(Inv.load(C).every(i => typeof i.id === 'string' && typeof i.check === 'function'));
    assert.equal(Inv.DIR, path.join(root, 'test', 'behaviour'));
  });

  test('play stops when the visit is over, at a function\'s cap, or when the function returns null', () => {
    const map = ['#######', '#.....#', '#######'];
    const doomed = Setup.room(1, { acc: 'T0', depth: 1, map, you: [1, 1], exhibits: [{ sp: 'x', at: [2, 1], mode: 'hunting', stats: { hp: 99, acc: 30, eva: 0, pad: 0, dmin: 30, dmax: 30 } }] });
    const p = H.play(C, doomed, Array.from({ length: 10 }, () => ({ a: 'wait' })), { inv: [] });
    assert.equal(p.stopped, 'over');
    assert.ok(p.steps.length < 10 && doomed.over);
    const capped = H.play(C, TestRoom.create(2), () => ({ a: 'wait' }), { inv: [], cap: 5 });
    assert.equal(capped.stopped, 'cap'); assert.equal(capped.steps.length, 5);
    const lasts = [];
    const three = H.play(C, TestRoom.create(2), (s, i, c) => { lasts.push(c.last.length); return i < 3 ? { a: 'wait' } : null; }, { inv: [] });
    assert.equal(three.stopped, 'done'); assert.equal(three.steps.length, 3);
    assert.equal(lasts[0], 0, 'no events before the first step');
    assert.equal(lasts[1], three.steps[0].events.length, 'the function sees the last step\'s events');
    assert.equal(three.events.length, three.steps.reduce((n, s) => n + s.events.length, 0));
    assert.throws(() => H.play(C, TestRoom.create(2), 'wait', { inv: [] }), /actions must be a list or a function/);
  });

  test('play checks after every step that the state is plain data, and with clone that a clone after every step agrees', () => {
    const X = loadCore(), waits = Array.from({ length: 5 }, () => ({ a: 'wait' }));
    const wait = X.Actions.get('wait'), apply = wait.apply;
    let n = 0;
    wait.apply = (state, action, ev) => { const c = apply(state, action, ev); if (++n === 3) state.actors[0].ax.x = undefined; return c; };
    const p = H.play(X, X.TestRoom.create(1), waits, { inv: [] });
    assert.equal(p.violations.length, 1, 'with no invariants at all');
    assert.match(p.violations[0].text, /^not plain data at state\.actors\[0\]\.ax\.x after step 2 /);
    assert.equal(p.steps.length, 3, 'it stops there');
    // A rule that reads the order of an object's keys, which State.clone (canonical JSON) sorts.
    // (It bumps your acts, a count no rule of yours resets; the regeneration store empties at full health.)
    wait.apply = (state, action, ev) => { if (Object.keys(state)[0] === 'v') state.actors[0].acts++; return apply(state, action, ev); };
    assert.equal(H.play(X, X.TestRoom.create(1), waits, { inv: [] }).violations.length, 0, 'unseen without the clone check');
    const q = H.play(X, X.TestRoom.create(1), waits, { inv: [], clone: true });
    assert.equal(q.violations.length, 1);
    assert.match(q.violations[0].text, /^a clone after every step differs from the state at step 0 /);
    wait.apply = apply;
    // A scenario asks for it with clone: true, and a clean one passes.
    assert.equal(plodderStrikes({ clone: true }).clone, true);
    assert.equal(H.run(C, plodderStrikes({ clone: true }), Packs.species('A4', 'A4.1'), 3).failure, null);
  });

  test('the checks\' pre, Inv.snapshot, is State.clone\'s copy made directly, key order and all, and refuses what State.canon refuses in its words; Inv.same says what comparing canonical JSON says', () => {
    // Real states: the test room and a department of each pack at depths 1 and 6, each new and
    // after 60 of the monkey's actions (streams, causes, statuses, memory and log filled in).
    const states = [];
    for (const make of [s => TestRoom.create(s), ...['S9', 'A4', 'M11'].flatMap(acc => [1, 6].map(d => s => C.Dept.create(s, acc, d)))]) {
      const s = make(4), r = Monkey.stream(4);
      states.push(C.State.clone(s));
      for (let i = 0; i < 60 && !s.over; i++) C.Step.step(s, Monkey.choose(s, r));
      states.push(s);
    }
    for (const s of states) {
      const before = C.State.canon(s), copy = Inv.snapshot(s);
      assert.equal(JSON.stringify(copy), JSON.stringify(C.State.clone(s)), 'the same values, each object\'s keys in the same order');
      assert.equal(Inv.same(copy, s), true);
      copy.actors[0].hp++;
      assert.equal(C.State.canon(s), before, 'a copy: changing it leaves the state as it was');
      assert.equal(Inv.same(copy, s), false);
      // Keys in another order are the same state; a key more, or a value changed deep down, is not.
      const reordered = JSON.parse(JSON.stringify(s, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)));
      assert.equal(Inv.same(Inv.snapshot(s), reordered), C.State.canon(reordered) === before);
      assert.equal(Inv.same(Inv.snapshot(s), Object.assign({}, s, { extra: 1 })), false);
      const fewer = C.State.clone(s); delete fewer.actors[0].x;
      assert.equal(Inv.same(Inv.snapshot(s), fewer), false, 'a key less');
      const deep = C.State.clone(s); deep.dept.tiles[1] = deep.dept.tiles[1].replace(/./, c => (c === '#' ? '.' : '#'));
      assert.equal(Inv.same(Inv.snapshot(s), deep), false);
    }
    // Keys that hold the separator a joined key list would use, and keys that are numbers.
    for (const odd of [{ 'a\u0000b': 1, c: 2 }, { a: 1, 'b\u0000c': 2 }, { b: 1, a: 2, 10: 3, 9: 4, '': 5 }]) assert.equal(json(Inv.snapshot(odd)), json(C.State.clone(odd)));
    // What is not plain data: thrown as State.canon throws it, for the copy and for the comparison.
    const hole = [1]; hole[2] = 3;
    for (const bad of [1.5, -0, NaN, 2 ** 53, undefined, null && 0, hole, new Map(), () => 1, Symbol('s'), 10n, new Uint8Array(2)]) {
      if (bad === null || bad === 0) continue;
      const state = { a: [{ b: bad }] };
      let want = null;
      try { C.State.clone(state); } catch (e) { want = e.message; }
      assert.ok(want, `State.clone takes ${String(bad)}`);
      assert.throws(() => Inv.snapshot(state), e => e.message === want, `snapshot of ${String(bad)}`);
      assert.throws(() => Inv.same({ a: [{ b: 1 }] }, state), e => e.message === want, `same, against ${String(bad)}`);
      assert.throws(() => Inv.same({ a: [] }, state), e => e.message === want, `same, differing before ${String(bad)}`);
    }
  });

  tmpTest('the hardened context declares each builtin the core and its tools name as a constant of its own (BUILTINS), so the core reads one at a page\'s speed, and Math is still the frozen object with the allowed functions alone', () => {
    const vm = require('node:vm'), acorn = require(path.join(root, 'tools/vendor/acorn/acorn.js')), Context = require(path.join(root, 'tools/core-context.js'));
    // Every name a core file or a tool run in the context reads (not a property or a key) that a
    // fresh context's global object holds, configurably and not banned by the prelude.
    const fresh = vm.runInContext('globalThis', vm.createContext({}));
    const bindable = n => { const d = Object.getOwnPropertyDescriptor(fresh, n); return !!d && d.configurable; };
    const BANNED = ['Date', 'Intl', 'eval', 'Function', 'performance', 'setTimeout', 'setInterval', 'queueMicrotask', 'parseFloat'];
    const tools = ['tools/arena.js', 'tools/monkey.js', 'tools/replay.js', 'test/golden/golden.js'].concat(fs.readdirSync(path.join(root, 'tools/policies')).filter(f => f.endsWith('.js')).map(f => 'tools/policies/' + f));
    const named = new Set();
    for (const f of Context.coreFiles().concat(tools)) {
      (function walk(node, parent, key) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'Identifier' && !(parent.type === 'MemberExpression' && key === 'property' && !parent.computed)
          && !(parent.type === 'Property' && key === 'key' && !parent.computed) && !(parent.type === 'MethodDefinition' && key === 'key')) named.add(node.name);
        for (const k of Object.keys(node)) {
          const v = node[k];
          if (Array.isArray(v)) for (const x of v) walk(x, node, k);
          else if (v && typeof v.type === 'string') walk(v, node, k);
        }
      })(acorn.parse(fs.readFileSync(path.join(root, f), 'utf8'), { ecmaVersion: 2022, sourceType: 'script' }), {}, null);
    }
    // console: only replay.js's part for Node (when `module` exists) names it, never run here.
    const missing = [...named].filter(n => bindable(n) && !BANNED.includes(n) && n !== 'console' && !Context.BUILTINS.includes(n)).sort();
    assert.deepEqual(missing, [], 'builtins the core names that BIND does not declare');
    for (const n of ['Math', 'Object', 'Array', 'JSON', 'Number']) assert.ok(named.has(n) && Context.BUILTINS.includes(n), n);
    // In the context: the same objects, Math frozen with its eight functions, the bans in place.
    const probe = write('probe.js', "'use strict';\nconst Probe = { math: () => Math, global: () => globalThis.Math, object: () => Object === globalThis.Object, keys: () => Object.keys(Math).sort((a, b) => (a < b ? -1 : 1)), random: () => typeof Math.random, date: () => Date.now(), parse: () => parseFloat('1.5') };\n");
    const X = loadCore([probe]), P = X.Probe;
    assert.equal(P.math(), P.global()); assert.ok(P.object());
    assert.ok(Object.isFrozen(P.math()));
    assert.equal(json(P.keys()), json(['abs', 'ceil', 'floor', 'imul', 'max', 'min', 'sign', 'trunc']));
    assert.equal(P.random(), 'undefined');
    assert.throws(() => P.date(), /Date is not allowed in the deterministic core/);
    assert.throws(() => P.parse(), /parseFloat is not allowed in the deterministic core/);
    // The speed: State.fnv1a (Math.imul in its loop) over a long text, against the same loop in
    // Node, in CPU time, the best of five. Read through the global object, it was some 30 times
    // slower; as a constant it is about the same.
    const text = 'abcdefghij'.repeat(30000);
    const nodeFnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    assert.equal(X.State.fnv1a(text), nodeFnv(text));
    const best = fn => { let b = Infinity; for (let k = 0; k < 5; k++) { const u = process.cpuUsage(); for (let i = 0; i < 4; i++) fn(text); const c = process.cpuUsage(u); b = Math.min(b, c.user + c.system); } return b / 1000; };
    best(X.State.fnv1a); best(nodeFnv);
    const inCore = best(X.State.fnv1a), inNode = best(nodeFnv);
    assert.ok(inCore <= 5 * inNode + 2, `State.fnv1a took ${inCore.toFixed(1)} CPU-ms in the context, ${inNode.toFixed(1)} in Node`);
  });

  tmpTest('a tree\'s files are read and compiled once a process, and again as soon as one changes: a core loaded after a file is rewritten, even to the same length, has the new text', () => {
    const tree = path.join(tmp, 'tree');
    for (const rel of ['index.html', 'js/core', 'content', 'tools/core-context.js']) fs.cpSync(path.join(root, rel), path.join(tree, rel), { recursive: true });
    const Tree = require(path.join(tree, 'tools/core-context.js')), numbers = path.join(tree, 'js/core/numbers.js'), src = fs.readFileSync(numbers, 'utf8');
    const k = Tree.loadCore().N.SAFE_ZONE, other = k === 9 ? 8 : k + 1;
    assert.equal(String(other).length, String(k).length);
    assert.equal(Tree.loadCore().N.SAFE_ZONE, k);
    fs.writeFileSync(numbers, src.replace(/^(\s*SAFE_ZONE: )\d+,/m, `$1${other},`));
    assert.equal(fs.statSync(numbers).size, Buffer.byteLength(src));
    assert.equal(Tree.loadCore().N.SAFE_ZONE, other, 'the rewritten file is read again');
    assert.equal(Tree.loadCore(null, { numbers: { SAFE_ZONE: k } }).N.SAFE_ZONE, k);
    assert.equal(Tree.loadCore().N.SAFE_ZONE, other, 'opts.numbers leaves the file\'s own text as it is');
    // A file added to index.html is loaded too.
    fs.writeFileSync(path.join(tree, 'content/zz.js'), "'use strict';\nconst Planted = { here: true };\n");
    fs.writeFileSync(path.join(tree, 'index.html'), fs.readFileSync(path.join(tree, 'index.html'), 'utf8').replace('</body>', '<script src="content/zz.js"></script>\n</body>'));
    assert.equal(Tree.loadCore().Planted.here, true);
  });

  // A scenario for the plodder's clause, "strikes from beside you for {dmg}", as a function
  // of its parameter: every blow it lands rolls within dmg.
  const MAP = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
  const range = d => { const [lo, hi] = String(d).split('–').map(Number); return [lo, hi === undefined ? lo : hi]; };
  const plodderStrikes = extra => H.scenario(Object.assign({
    name: 'a plodder beside you strikes for its damage range', id: 'plodder',
    build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: MAP, you: [2, 2],
      exhibits: [{ sp: sp.id, at: [3, 2], mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff }),
    actions: Array.from({ length: 20 }, () => ({ a: 'wait' })),
    expect(r, params) {
      const [lo, hi] = range(params.dmg), ex = r.state.actors[1].uid;
      const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === ex);
      if (!hits.length) return 'it never landed a blow';
      const bad = hits.find(e => e.cause.raw < lo || e.cause.raw > hi);
      return bad ? `a blow rolled ${bad.cause.raw}, outside ${params.dmg}` : null;
    },
    inv: [],
  }, extra));

  test('species gives every pack species whose line has a clause, at depths 1–7, as the pack gives it, leaving out unbuilt archetypes', () => {
    const records = [];
    for (const p of Packs.list()) for (const sp of [...p.species, p.centrepiece]) records.push(sp);
    // Built: an M3 archetype, or an M4 one its package has added (Archetypes.added: the
    // Centrepieces' cores, whose records name a trigger once built, as S.9's does, COMPOSITE-CORE).
    const built = sp => Registry.ARCHETYPES[sp.archetype] && (Registry.ARCHETYPES[sp.archetype].built === 'M3' || C.Archetypes.added(sp.archetype));
    const expect = pred => records.filter(sp => built(sp) && pred(sp)).flatMap(sp => H.DEPTHS.map(d => `${sp.id}@${d}`));
    const got = (id, o) => H.species(C, id, o).map(x => `${x.sp.id}@${x.depth}`);
    for (const arch of ['plodder', 'herald', 'darter', 'kiter', 'splitter']) assert.equal(json(got(arch)), json(expect(sp => sp.archetype === arch)), arch);
    for (const mod of ['marble', 'plaster', 'glass', 'old_repair']) assert.equal(json(got(mod)), json(expect(sp => (sp.modifiers || []).includes(mod))), mod);
    for (const trig of ['ally_hit', 'axis', 'tether', 'touch_case']) assert.equal(json(got(trig)), json(expect(sp => sp.trigger === trig)), trig);
    assert.ok(got('plodder').length > 0 && got('marble').length > 0 && got('axis').length > 0, 'the packs have these clauses');
    // The pack's own record, so its override fields apply (M11.3's repaired side).
    const lamp = H.species(C, 'old_repair').find(x => x.sp.id === 'M11.3');
    assert.ok(lamp && lamp.sp === Packs.species('M11', 'M11.3') && lamp.acc === 'M11' && lamp.sp.modParams.old_repair.side === 'W');
    // A special or status set inside an archetype's clause is a part too; a pipless species
    // has no generic wake clause.
    assert.equal(json(got('rooted')), json(expect(sp => sp.archetype === 'mimic_vitrine')));
    assert.ok(got('wake').length > 0 && !got('wake').some(k => records.some(sp => sp.archetype === 'mimic_vitrine' && k.startsWith(sp.id + '@'))));
    // Unbuilt archetypes (M4's, until their package adds them: Archetypes.added) only on
    // request; depths on request. Every pack archetype is added since COMPOSITE-CORE (the
    // gallery species' since ARCH-CLOCKWORK, the three Centrepieces' cores, each held at ready
    // false by its package), so none is left in the packs: in a core of its own, A.4's record
    // names a planted archetype that no package adds.
    assert.equal(json(records.filter(sp => !built(sp) && Registry.ARCHETYPES[sp.archetype] && !C.Archetypes.added(sp.archetype)).map(sp => sp.id)), '[]');
    const X = loadCore();
    X.Registry.define('ARCHETYPES', 'planted_unbuilt', { built: 'M4', ready: false, clause: 'Stands for an archetype no package has added yet.', params: {}, covers: [], tests: [], inv: null });
    X.Packs.get('A4').centrepiece.archetype = 'planted_unbuilt';
    const xs = [];
    for (const p of X.Packs.list()) for (const sp of [...p.species, p.centrepiece]) xs.push(sp);
    const m4 = xs.filter(sp => X.Registry.ARCHETYPES[sp.archetype] && X.Registry.ARCHETYPES[sp.archetype].built !== 'M3' && !X.Archetypes.added(sp.archetype));
    assert.equal(json(m4.map(sp => [sp.id, sp.archetype])), json([['A4.12', 'planted_unbuilt']]));
    const gotX = (id, o) => H.species(X, id, o).map(x => `${x.sp.id}@${x.depth}`);
    assert.equal(json(gotX('planted_unbuilt')), '[]');
    assert.equal(json(gotX('planted_unbuilt', { m4: true })), json(H.DEPTHS.map(d => `A4.12@${d}`)));
    assert.equal(json(got('plodder', { depths: [2, 5] })), json(records.filter(sp => built(sp) && sp.archetype === 'plodder').flatMap(sp => [`${sp.id}@2`, `${sp.id}@5`])));
  });

  test('a scenario runs for every species and depth with its clause\'s parameters, and a planted failure names species, depth and seed', () => {
    const sc = plodderStrikes();
    const results = H.sweep(C, sc);
    assert.equal(results.length, H.species(C, 'plodder').length);
    assert.equal(json(H.failures(results)), '[]');
    for (const r of results) {
      const sp = Packs.list().flatMap(p => p.species).find(s => s.id === r.sp), s = Roles.stats(sp.role, r.depth);
      assert.equal(r.params.dmg, s.dmin === s.dmax ? String(s.dmin) : `${s.dmin}–${s.dmax}`, `${r.sp} at depth ${r.depth}`);
      assert.ok(r.clause.includes(`strikes from beside you for ${r.params.dmg}`), r.clause);
      assert.equal(r.start.turn, 0, 'start is the state as built');
    }
    // An expectation the rules do not meet fails, once per species and depth, and says where.
    const wrong = plodderStrikes({ name: 'planted: every blow rolls its minimum', expect: (r, params) => r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.raw > range(params.dmg)[0]) ? 'a blow rolled above the minimum' : null });
    const lines = H.failures(H.sweep(C, wrong));
    assert.ok(lines.length > 0);
    assert.match(lines[0], /^planted: every blow rolls its minimum \[\S+, depth \d, seed 1\]: a blow rolled above the minimum$/);
    // An invariant broken during a scenario fails it; so does a build that throws, or a
    // clause the species' line does not have; a sweep over nothing is refused.
    const A41 = Packs.species('A4', 'A4.1');
    assert.equal(H.run(C, plodderStrikes({ inv: [still, healthy] }), A41, 3).failure, null, 'a plodder beside you strikes and stays put');
    const walker = plodderStrikes({ inv: [still], build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: MAP, you: [2, 2], exhibits: [{ sp: sp.id, at: [5, 2], mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }) });
    assert.match(H.run(C, walker, A41, 3).failure, /^planted_still: moved from 5,2/);
    const broken = H.run(C, plodderStrikes({ build: () => { throw new Error('no room'); } }), A41, 3);
    assert.equal(broken.error, 'no room'); assert.equal(broken.failure, 'threw no room');
    assert.match(H.run(C, plodderStrikes({ id: 'axis' }), A41, 3).failure, /A4\.1's Behaviour line has no axis clause/);
    assert.throws(() => H.sweep(C, sc, []), /no species and depths/);
    assert.throws(() => H.scenario({ name: 'x', build: () => null, actions: [] }), /needs expect/);
    assert.throws(() => H.scenario({ build: () => null, actions: [], expect: () => null }), /needs a name/);
    assert.equal(sc.run(C, A41, 2).failure, null, 'sc.run is run(C, sc, …)');
  });

  test('sensitivity: a scenario that depends on a rule fails with it switched off; one that does not, or that fails anyway, is reported', () => {
    // A planted modifier, applied where an archetype's init would apply it: the exhibit has
    // 1 HP unless the modifier is switched off.
    const jaw = 'planted_glass_jaw';
    const build = (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: MAP, you: [2, 2],
      exhibits: [{ sp: sp.id, at: [3, 2], mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: opts.rulesOff.includes(jaw) ? 50 : 1 }) }] }, { rulesOff: opts.rulesOff });
    const blow = (s, i) => i === 0 ? { a: 'attack', uid: s.actors[1].uid } : null;
    const list = [1, 4].map(depth => ({ sp: Packs.species('A4', 'A4.1'), depth }));
    const falls = H.scenario({ name: 'it falls to one blow', build, actions: blow, inv: [], expect: r => r.events.some(e => e.k === 'died') ? null : 'it survived the blow' });
    const s1 = H.sensitivity(C, falls, jaw, list);
    assert.equal(json(s1.problems), '[]');
    assert.equal(s1.sensitive, true);
    assert.equal(s1.runs.length, 2);
    for (const run of s1.runs) {
      assert.equal(run.on.failure, null);
      assert.equal(run.off.failure, 'it survived the blow');
      assert.ok(run.off.state.options.rulesOff.includes(jaw), 'the switched-off id is in the state\'s options');
      assert.ok(!run.on.state.options || !run.on.state.options.rulesOff.includes(jaw));
    }
    const hits = H.scenario({ name: 'the blow lands', build, actions: blow, inv: [], expect: r => r.events.some(e => e.k === 'damaged') ? null : 'it missed' });
    const s2 = H.sensitivity(C, hits, jaw, list);
    assert.equal(s2.sensitive, false);
    assert.equal(s2.problems.length, 2);
    assert.equal(s2.problems[0], 'the blow lands [A4.1, depth 1, seed 1, rulesOff planted_glass_jaw]: passed with planted_glass_jaw switched off, so the scenario does not test it');
    const never = H.scenario({ name: 'never passes', build, actions: blow, inv: [], expect: () => 'no' });
    assert.match(H.sensitivity(C, never, jaw, list).problems[0], /it must pass with the rule on/);
    const crash = H.scenario({ name: 'crashes when off', build: (p, sp, d, o) => { if (o.rulesOff.length) throw new Error('off'); return build(p, sp, d, o); }, actions: blow, inv: [], expect: falls.expect });
    assert.match(H.sensitivity(C, crash, jaw, list).problems[0], /it threw, which shows nothing/);
  });

  tmpTest('the runner finds test files in test/, behaviour/ and arena/ at any depth, and its filter matches the path from test/', () => {
    const t = path.join(tmp, 'tests');
    const mark = name => `module.exports = ({ test }) => { test('${name}', () => { console.log('RAN ${name}'); }); };\n`;
    write('tests/a.test.js', mark('a'));
    write('tests/behaviour/b.test.js', mark('b'));
    write('tests/behaviour/deep/c.test.js', mark('c'));
    write('tests/behaviour/_harness.js', '');
    write('tests/behaviour/x.inv.js', '');
    write('tests/arena/d.test.js', mark('d'));
    write('tests/golden/e.test.js', mark('e'));
    write('tests/other/f.test.js', mark('f'));
    assert.equal(json(Runner.files(t, '')), json(['a.test.js', 'arena/d.test.js', 'behaviour/b.test.js', 'behaviour/deep/c.test.js']));
    assert.equal(json(Runner.files(t, 'behaviour')), json(['behaviour/b.test.js', 'behaviour/deep/c.test.js']));
    assert.equal(json(Runner.files(t, 'behaviour/deep')), json(['behaviour/deep/c.test.js']));
    assert.equal(json(Runner.files(t, 'arena')), json(['arena/d.test.js']));
    // End to end: `node test/run.js behaviour` runs that folder and nothing else.
    const run = filter => spawnSync(process.execPath, [path.join(root, 'test/run.js'), ...(filter ? [filter] : [])], { encoding: 'utf8', env: Object.assign({}, process.env, { ACCESSION_TEST_DIR: t }) });
    const r = run('behaviour');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(json(r.stdout.match(/RAN \w/g)), json(['RAN b', 'RAN c']));
    assert.match(r.stdout, /tests: 2\/2 passed/);
    assert.match(run('').stdout, /tests: 4\/4 passed/);
    // The real tree: this file, and the behaviour filter selects only what is in behaviour/.
    const here = path.join(root, 'test');
    assert.equal(json(Runner.files(here, 'm3-infra')), json(['m3-infra.test.js']));
    assert.ok(Runner.files(here, 'behaviour/').every(f => f.startsWith('behaviour/')));
    assert.ok(Runner.files(here, '').includes('golden.test.js') && !Runner.files(here, '').some(f => f.startsWith('golden/')));
  });

  test('the Wilson interval matches published values', () => {
    // Newcombe (1998), "Two-sided confidence intervals for the single proportion", Statistics
    // in Medicine 17:857–872, Table I, method 3 (the score interval), at 95%, to 4 places.
    const cases = [[81, 263, 0.2553, 0.3662], [15, 148, 0.0624, 0.1605], [0, 20, 0, 0.1611], [1, 29, 0.0061, 0.1718]];
    const r4 = x => Math.round(x * 1e4) / 1e4;
    for (const [k, n, lo, hi] of cases) {
      const w = Stats.wilson(k, n);
      assert.equal(json([r4(w.lo), r4(w.hi)]), json([lo, hi]), `${k}/${n}`);
      assert.equal(w.p, k / n);
    }
    assert.equal(Stats.wilson(0, 20).lo, 0);
    assert.equal(Stats.wilson(29, 29).hi, 1);
    // 99.9%: z = 3.2905; 50 of 100 gives 0.3437 to 0.6563 (symmetric about one half).
    const w = Stats.wilson(50, 100, Stats.Z999);
    assert.equal(json([r4(w.lo), r4(w.hi)]), json([0.3437, 0.6563]));
    assert.ok(Math.abs(w.lo + w.hi - 1) < 1e-12);
    assert.ok(Math.abs(Stats.Z95 - 1.959964) < 1e-6 && Math.abs(Stats.Z999 - 3.290527) < 1e-6);
    // Wider at higher confidence, narrower with more trials.
    assert.ok(Stats.wilson(50, 100, Stats.Z999).lo < Stats.wilson(50, 100).lo && Stats.wilson(500, 1000).lo > Stats.wilson(50, 100).lo);
    assert.throws(() => Stats.wilson(5, 0), /n must be a positive integer/);
    assert.throws(() => Stats.wilson(6, 5), /k must be an integer/);
    assert.throws(() => Stats.wilson(1.5, 5), /k must be an integer/);
  });

  test('the hash page\'s pending check: a pending run passes only if the page equals Node, run for run and checkpoint for checkpoint', () => {
    const pin = Monkey.run(3, 1000);
    const golden = { pinned: { seed: 3, actions: 1000, hash: pin.hash, checkpoints: Array.from(pin.checkpoints) }, open: { seed: 5, actions: 2000, hash: 1, checkpoints: [1, 2], pending: 'testing' } };
    const node = HashCompare.nodeRuns(golden, C);
    assert.equal(json(Object.keys(node)), json(['open']), 'only pending runs are played');
    const mine = Monkey.run(5, 2000);
    assert.equal(json(node.open), json({ hash: mine.hash, checkpoints: Array.from(mine.checkpoints) }));
    assert.equal(node.open.checkpoints.length, 2);
    const page = () => ({ pinned: { hash: pin.hash, checkpoints: Array.from(pin.checkpoints), pending: false, ok: true }, open: { hash: node.open.hash, checkpoints: node.open.checkpoints.slice(), pending: true, ok: null } });
    assert.equal(json(HashCompare.compare(golden, page(), node)), '[]');
    // Planted mismatches, each caught and named.
    const planted = [
      [p => { p.open.checkpoints[1] += 1; p.open.hash += 1; }, /^open: the page gives hash \d+, Node \d+; checkpoint 2 \(action 2000\) differs: page \d+, Node \d+$/],
      [p => { p.open.hash += 1; }, /^open: the page gives hash \d+, Node \d+; every checkpoint agrees$/],
      [p => { p.open.checkpoints.pop(); }, /checkpoint 2 \(action 2000\) differs: page undefined/],
      [p => { delete p.open; }, /^open: not on the page$/],
      [p => { p.open.pending = false; }, /^open: pending in golden\.js, but the page did not run it as pending$/],
      [p => { p.pinned.ok = false; }, /^pinned: the page does not match its pin$/],
      [p => { p.extra = { hash: 1, checkpoints: [], pending: true }; }, /^extra: on the page but not in golden\.js$/],
    ];
    for (const [plant, re] of planted) {
      const p = page(); plant(p);
      const problems = HashCompare.compare(golden, p, node);
      assert.equal(problems.length, 1, problems.join('; '));
      assert.match(problems[0], re);
    }
    assert.match(HashCompare.compare(golden, page(), {})[0], /^open: no Node run to compare with$/);
    // The golden file as Node reads it is the one the core context loads.
    const G = loadCore(['test/golden/golden.js']).GOLDEN;
    assert.equal(json(HashCompare.readGolden()), json(G));
  });
};
