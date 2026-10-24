// Replays (BUILD.md §3.6) and the golden runs' tooling (§3.5): where a replay starts, that it
// plays the same in a clone and as the monkey that made it, per-step hashes as base64, the
// divergence printer on planted one-step changes (one action changed, one rule changed),
// tools/golden.js's format, re-pin, check, add and pending, --against on a planted pair of
// commits, coreHash and vmHash, and the `node tools/replay.js` command.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const os = require('node:os'), cp = require('node:child_process');
  const Golden = require(path.join(root, 'tools/golden.js'));
  const Hashes = require(path.join(root, 'tools/core-hash.js'));
  const HashCompare = require(path.join(root, 'tools/hash-compare.js'));
  const EXTRA = ['tools/monkey.js', 'tools/replay.js'];
  const C = loadCore(EXTRA);
  const { Replay: R, State, TestRoom, Dept, Monkey, Actions, Text } = C;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-replay-'));
  const json = x => JSON.stringify(x);
  const clean = s => !/undefined|NaN|\[object/.test(s);

  // A planted rule: from turn 5 on, every wait also writes a mark into the department, so the
  // first wait at turn 5 or later is the first step that differs. Given a core, plants it.
  const PLANT = 'if (state.turn >= 5) state.dept.planted = state.turn;';
  const plant = K => { const h = K.Actions.get('wait'), f = h.apply; h.apply = (state, action, ev) => { if (state.turn >= 5) state.dept.planted = state.turn; return f(state, action, ev); }; };
  // Independently of the replay player: the turn and kind before each Step.step call of fn().
  const watch = (K, fn) => {
    const real = K.Step.step, seen = [];
    K.Step.step = (s, a) => { seen.push({ turn: s.turn, a: a && a.a }); return real(s, a); };
    try { fn(); } finally { K.Step.step = real; }
    return seen;
  };
  const firstPlanted = seen => seen.findIndex(x => x.a === 'wait' && x.turn >= 5) + 1;

  const monkey = (seed, actions, make) => ({ kind: 'monkey', seed, actions, make: make || null });
  const visit419 = R.record(monkey(20261023, 1000), 1000);

  test('a replay starts in the test room, a department, a snapshot or a registered start, with its options', () => {
    assert.equal(State.hash(R.begin({ seed: 9, room: 'T0' })), State.hash(TestRoom.create(9)));
    assert.equal(State.hash(R.begin({ seed: 4, dept: 'S9', depth: 2 })), State.hash(Dept.create(4, 'S9', 2)));
    const s = TestRoom.create(3), snap = R.begin({ state: s });
    assert.equal(State.hash(snap), State.hash(s));
    snap.actors[0].x = 99;
    assert.notEqual(s.actors[0].x, 99, 'a snapshot start is a copy');
    const without = R.begin({ seed: 9, room: 'T0' }, { without: ['T0.1.room.2'] });
    assert.equal(without.actors.find(a => a.uid === 'T0.1.room.2').gone, 1);
    assert.equal(json(without.options), json({ rulesOff: [], without: ['T0.1.room.2'], invulnerable: false }));
    // A replay records the layout pin a department was made with, and its options.
    const rd = R.make({ seed: 4, dept: 'S9', depth: 2 }, { invulnerable: true }, [{ a: 'wait' }], 'abcdef01');
    assert.equal(rd.layoutPin, Dept.create(4, 'S9', 2).dept.pin);
    assert.ok(Number.isSafeInteger(rd.layoutPin));
    assert.equal(json(rd), json({ coreHash: 'abcdef01', layoutPin: rd.layoutPin, start: { dept: 'S9', depth: 2, seed: 4 }, options: { rulesOff: [], without: [], invulnerable: true }, actions: [{ a: 'wait' }] }));
    assert.equal(R.make({ seed: 1, room: 'T0' }, null, []).layoutPin, null);
    // What it refuses, in words.
    for (const [start, re] of [[5, /a start is \{seed, room\}/], [{ room: 'T0' }, /no whole-number seed/], [{ seed: 1 }, /no way to make the start/], [{ seed: 1, dept: 'S9' }, /has no depth/]]) {
      assert.throws(() => R.begin(start), e => re.test(e.message) && clean(e.message), json(start));
    }
    assert.throws(() => R.make({ seed: 1, room: 'T0' }, null, 'wait'), /actions must be a list/);
    // Another tool's start (an arena's, say).
    const K = loadCore(EXTRA);
    K.Replay.starter('custom', (start, o) => K.Setup.room(start.seed, K.TestRoom.spec, o));
    assert.equal(K.State.hash(K.Replay.begin({ seed: 6, custom: 1 })), State.hash(TestRoom.create(6)));
    assert.throws(() => K.Replay.starter('custom', () => null), /registered twice/);
  });

  test('a replay plays the same twice and with a clone after every step, and a recorded monkey visit replays to the monkey\'s hashes', () => {
    assert.equal(visit419.actions.length, 419, 'the golden monkey\'s first visit clears the room at its 419th action');
    const a = R.play(visit419, { steps: true }), b = R.play(visit419), c = R.play(visit419, { clone: true, steps: true });
    assert.equal(b.hash, a.hash); assert.equal(json(b.checkpoints), json(a.checkpoints)); assert.equal(json(c.steps), json(a.steps));
    assert.equal(a.checkpoints.length, 4);
    assert.equal(json(a.checkpoints), json([100, 200, 300, 400].map(i => a.steps[i - 1])), 'a checkpoint every 100 actions');
    assert.equal(a.hash, a.steps[418]); assert.equal(a.refused, 0); assert.equal(a.played, 419);
    // The monkey's own hash after each action, seen independently through Monkey.run's check.
    const mine = [];
    Monkey.run(20261023, 419, { check: s => mine.push(State.hash(s)) });
    assert.equal(json(a.steps), json(mine));
    // Visits after the first replay from their own seed.
    const g = monkey(20261023, 600), v = R.visit(g, 500);
    assert.equal(json(v.replay.start), json({ seed: 20261024, room: 'T0' }));
    assert.equal(v.index, 81);
    let at500 = null;
    Monkey.run(20261023, 600, { check: (s, i) => { if (i === 500) at500 = State.hash(s); } });
    assert.equal(R.play(v.replay).hash, at500);
    assert.throws(() => R.visit(g, 601), /no action 601/);
    // upTo, log and refusals.
    assert.equal(R.play(visit419, { upTo: 10 }).hash, a.steps[9]);
    const odd = Object.assign({}, visit419, { actions: [{ a: 'move', dir: 9 }].concat(visit419.actions.slice(0, 5)) });
    const q = R.play(odd, { log: true });
    assert.equal(q.refused, 1); assert.equal(q.log.length, 6); assert.equal(q.log[0].events[0].k, 'refused');
  });

  test('play\'s check stops at the first failure with the states either side; a step that throws is a failure too', () => {
    const p = R.play(visit419, { check: (pre, action, events, post) => post.actors[0].x >= 8 ? `you are at ${post.actors[0].x},${post.actors[0].y}` : null });
    const xs = R.play(visit419, { log: true }).log.map((l, i) => i);
    assert.ok(p.failure, 'you reach the right-hand room');
    const want = (() => { const st = R.begin(visit419.start); for (let i = 0; i < 419; i++) { C.Step.step(st, visit419.actions[i]); if (st.actors[0].x >= 8) return i + 1; } return -1; })();
    assert.equal(p.failure.step, want); assert.ok(xs.length === 419);
    assert.ok(p.failure.pre.actors[0].x < 8 && p.failure.post.actors[0].x >= 8);
    assert.equal(json(p.failure.action), json(visit419.actions[want - 1]));
    assert.ok(p.failure.events.some(e => e.k === 'moved' && e.who === 'you'));
    assert.equal(p.played, want);
    // A list of invariant violations is a failure too.
    const q = R.play(visit419, { check: (pre, action, events, post, i) => i === 3 ? [{ text: 'planted: third' }] : [] });
    assert.equal(q.failure.step, 3); assert.equal(q.failure.message, 'planted: third');
    // A rule that throws, planted in a core of its own.
    const K = loadCore(EXTRA), h = K.Actions.get('wait'), f = h.apply;
    h.apply = (state, action, ev) => { if (state.turn >= 7) throw new Error('planted crash'); return f(state, action, ev); };
    const t = K.Replay.play(visit419);
    assert.equal(t.failure.message, 'threw planted crash');
    const seen = watch(C, () => R.play(visit419));
    assert.equal(t.failure.step, seen.findIndex(x => x.a === 'wait' && x.turn >= 7) + 1);
    assert.equal(t.failure.events.length, 0);
  });

  test('per-step hashes are 4 bytes a step in base64, as Node writes base64', () => {
    let x = 12345;
    const next = () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x; };
    for (let n = 0; n <= 9; n++) {
      const hs = Array.from({ length: n }, next).concat(n === 9 ? [0, 0xffffffff, 0x80000000] : []);
      const bytes = Buffer.alloc(hs.length * 4);
      hs.forEach((h, i) => bytes.writeUInt32BE(h, i * 4));
      assert.equal(R.encode(hs), bytes.toString('base64'));
      assert.equal(json(R.decode(R.encode(hs))), json(hs));
    }
    for (const bad of ['abc', 'AAA*', 'AAA=', 5]) assert.throws(() => R.decode(bad), /Replay.decode/);
    assert.equal(R.firstDiff([1, 2, 3], [1, 2, 3]), -1);
    assert.equal(R.firstDiff([1, 2, 3], [1, 5, 3]), 1);
    assert.equal(R.firstDiff([1, 2], [1, 2, 3]), 2);
  });

  test('the divergence printer finds a planted one-step change: one action of a replay, or one rule under a monkey', () => {
    // A replay pinned here, then one move becomes a wait.
    const r = R.record(monkey(20261023, 300), 300), p = R.golden(r, { steps: true });
    const pinned = Object.assign({}, r, { hash: p.hash, checkpoints: p.checkpoints, steps: R.encode(p.steps) });
    assert.equal(R.verify('pinned', pinned).ok, true);
    const k = r.actions.findIndex((a, i) => i >= 150 && a.a === 'move');
    const changed = Object.assign({}, pinned, { actions: pinned.actions.slice() });
    changed.actions[k] = { a: 'wait' };
    const v = R.verify('changed', changed);
    assert.equal(v.ok, false);
    assert.equal(v.diverged.step, k + 1);
    assert.equal(json(v.diverged.action), json({ a: 'wait' }));
    // Its events, as a plain play of the changed list logs them at that step.
    const logged = R.play(changed, { log: true }).log[k].events;
    assert.equal(json(v.diverged.events), json(logged));
    assert.ok(v.text.includes(`changed: the first diverging step is step ${k + 1} of 300.`), v.text);
    assert.ok(v.text.includes('Its action: {"a":"wait"}.') && v.text.includes(`Its events (${logged.length}):`) && v.text.includes('"k":"waited"'), v.text);
    assert.ok(v.text.includes(`the first checkpoint that differs is checkpoint ${Math.floor(k / 100) + 1} (action ${(Math.floor(k / 100) + 1) * 100})`), v.text);
    assert.ok(clean(v.text));
    // A monkey pinned on this core, played on a core with the planted rule.
    const g = monkey(3, 200), q = R.golden(g, { steps: true });
    const m = Object.assign({}, g, { hash: q.hash, checkpoints: q.checkpoints, visits: q.visits, steps: R.encode(q.steps) });
    const K = loadCore(EXTRA); plant(K);
    const w = K.Replay.verify('monkey', m);
    const expected = firstPlanted(watch(C, () => Monkey.run(3, 200)));
    assert.ok(expected > 1);
    assert.equal(w.ok, false); assert.equal(w.diverged.step, expected);
    assert.equal(json(w.diverged.action), json({ a: 'wait' }));
    assert.ok(w.text.includes(`monkey: the first diverging step is step ${expected} of 200.`), w.text);
    // Without per-step hashes, only the checkpoint or the final hash is known; pending is not judged.
    const bare = Object.assign({}, changed, { steps: null });
    assert.ok(/keeps no per-step hashes/.test(R.verify('bare', bare).text));
    assert.equal(R.verify('open', Object.assign({}, changed, { pending: 'testing' })).ok, null);
    const short = Object.assign({}, changed, { steps: R.encode(p.steps.slice(0, 10)) });
    assert.ok(/keeps 10 per-step hashes for 300 actions/.test(R.verify('short', short).text));
  });

  test('tools/golden.js keeps its format, re-pins with per-step hashes, checks, adds, marks pending, and names the first changed step', () => {
    // The real file is in the tool's format, and every run in it is a valid definition.
    const real = Golden.read(Golden.FILE);
    assert.equal(fs.readFileSync(Golden.FILE, 'utf8'), Golden.format(real), 'test/golden/golden.js is as tools/golden.js writes it');
    for (const name of Object.keys(real)) { Golden.definition(name, real[name]); assert.ok(R.KINDS.includes(real[name].kind), name); }
    assert.ok(Object.keys(real).some(n => real[n].kind === 'replay'), 'a replay is among the golden runs');
    // A file of our own.
    const file = path.join(tmp, 'golden.js'), r = R.record(monkey(20261023, 160), 160);
    Golden.write(file, { mk: monkey(4, 250), rp: r });
    let g = Golden.read(file);
    assert.equal(g.mk.hash, null); assert.equal(g.rp.steps, null);
    const lines = Golden.repin(C, file);
    assert.ok(lines[0].startsWith('golden: mk new → ') && lines[0].includes('kept no per-step hashes'), lines[0]);
    g = Golden.read(file);
    for (const name of ['mk', 'rp']) {
      const run = R.golden(g[name], { steps: true });
      assert.equal(g[name].hash, run.hash); assert.equal(g[name].steps, R.encode(run.steps)); assert.equal(R.decode(g[name].steps).length, R.count(g[name]));
    }
    assert.equal(g.mk.visits, R.golden(g.mk).visits);
    assert.equal(Golden.check(C, file).bad, 0);
    // One action changed in the file: --check names its step, and a re-pin says where it moved.
    g.rp.actions[120] = g.rp.actions[120].a === 'wait' ? { a: 'move', dir: 0 } : { a: 'wait' };
    Golden.write(file, g);
    const c = Golden.check(C, file);
    assert.equal(c.bad, 1);
    assert.ok(c.lines.join('\n').includes('rp: the first diverging step is step 121 of 160.'), c.lines.join('\n'));
    assert.ok(Golden.repin(C, file).some(l => l.startsWith('golden: rp ') && l.endsWith('first divergence from the old pin at step 121')));
    assert.ok(Golden.repin(C, file).some(l => l.startsWith('golden: mk ') && l.endsWith('no step differs from the old pin')));
    // Pending keeps the pins and is not held to them; add puts in a new run, pinned or not.
    const before = Golden.read(file);
    Golden.markPending(file, 'testing');
    g = Golden.read(file);
    for (const n of ['mk', 'rp']) { assert.equal(g[n].pending, 'testing'); assert.equal(g[n].hash, before[n].hash); assert.equal(g[n].steps, before[n].steps); }
    g.rp.actions[3] = { a: 'wait' };
    Golden.write(file, g);
    const pc = Golden.check(C, file);
    assert.equal(pc.bad, 0);
    assert.ok(pc.lines.some(l => /^golden: rp is pending \(testing\): hash \d+, pin \d+$/.test(l)), pc.lines.join('\n'));
    assert.ok(Golden.add(C, file, 'dm', monkey(2, 120, { dept: 'S9', depth: 3 }), 'new').endsWith('unpinned and pending: new'));
    assert.ok(/pinned at \d+$/.test(Golden.add(C, file, 'dm2', monkey(2, 120, { dept: 'S9', depth: 3 }))));
    assert.throws(() => Golden.add(C, file, 'dm', monkey(2, 10)), /already a golden run/);
    g = Golden.read(file);
    assert.equal(g.dm.hash, null); assert.equal(g.dm.pending, 'new');
    const deptRun = Monkey.run(2, 120, { make: s => Dept.create(s, 'S9', 3) });
    assert.equal(g.dm2.hash, deptRun.hash);
    assert.equal(Golden.check(C, file).bad, 0, 'a pinned department monkey matches its pin, and the pending runs are not held to theirs');
    assert.equal(json(HashCompare.nodeRuns({ dm: g.dm }, C).dm), json({ hash: deptRun.hash, checkpoints: Array.from(deptRun.checkpoints) }));
    assert.equal(json(Golden.read(file)), json(HashCompare.readGolden(file)));
    for (const bad of [{ kind: 'film' }, { kind: 'monkey', seed: 1.5, actions: 3 }, { kind: 'monkey', seed: 1, actions: 3, make: { dept: 'S9' } }, { kind: 'replay', start: null, actions: [] }]) {
      assert.throws(() => Golden.definition('x', bad), /^Error: golden: /);
    }
    // The page's Node side plays a pending replay as the page does, and counts its checkpoints by 100.
    const open = { rp: Object.assign({}, g.rp, { pending: 'testing' }) };
    const node = HashCompare.nodeRuns(open, C);
    const run = R.golden(open.rp);
    assert.equal(json(node.rp), json({ hash: run.hash, checkpoints: run.checkpoints }));
    const page = { rp: { hash: run.hash, checkpoints: run.checkpoints.map((h, i) => i === 0 ? h + 1 : h), pending: true, ok: null } };
    assert.match(HashCompare.compare(open, page, node)[0], /checkpoint 1 \(action 100\) differs/);
  });

  test('--against on a planted pair of commits finds the step where the planted rule first changes the state', () => {
    // A checkout with the core and the tools, committed; then the planted rule, committed.
    const repo = path.join(tmp, 'repo');
    const copy = rel => { const from = path.join(root, rel), to = path.join(repo, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };
    for (const rel of ['index.html', 'js/core', 'content', 'tools/core-context.js', 'tools/monkey.js', 'tools/replay.js']) copy(rel);
    const git = (...args) => cp.execFileSync('git', ['-C', repo, '-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8' }).trim();
    git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'unplanted');
    const before = git('rev-parse', 'HEAD');
    const last = require(path.join(repo, 'tools/core-context.js')).coreFiles().slice(-1)[0];
    fs.appendFileSync(path.join(repo, last), `\n;(() => { const h = Actions.get('wait'), f = h.apply; h.apply = (state, action, ev) => { ${PLANT} return f(state, action, ev); }; })();\n`);
    git('commit', '-q', '-am', 'planted');
    const rp = Object.assign({}, visit419, { actions: visit419.actions.slice(0, 120) });
    const runs = { rp, mk: monkey(3, 120) };
    const res = Golden.against(before, { root: repo, golden: runs });
    const wantRp = firstPlanted(watch(C, () => R.play(rp))), wantMk = firstPlanted(watch(C, () => Monkey.run(3, 120)));
    assert.ok(wantRp > 1 && wantMk > 1);
    assert.equal(json(res.map(x => [x.name, x.step])), json([['rp', wantRp], ['mk', wantMk]]));
    const t = res[0].text;
    assert.ok(t.startsWith(`rp: the first diverging step is step ${wantRp} of 120, between this tree and ${before.slice(0, 7)}.`), t);
    assert.ok(t.includes('This tree: action {"a":"wait"}') && t.includes(`\n${before.slice(0, 7)}: action {"a":"wait"}`) && t.includes('"k":"waited"'), t);
    assert.ok(clean(t));
    // The same from the command line; and no step differs against the tree's own commit.
    const file = path.join(tmp, 'against.js');
    Golden.write(file, runs);
    const out = cp.execFileSync('node', [path.join(root, 'tools/golden.js'), '--against', before, '--root', repo, '--golden', file, 'rp'], { encoding: 'utf8' });
    assert.ok(out.startsWith(`rp: the first diverging step is step ${wantRp} of 120`), out);
    const same = Golden.against('HEAD', { root: repo, golden: runs, names: ['rp'] });
    assert.equal(same[0].step, null);
    assert.ok(/^rp: no step differs in 120 actions between this tree and HEAD \([0-9a-f]{7}\); both end with hash \d+\.$/.test(same[0].text), same[0].text);
    assert.throws(() => Golden.against('no-such-commit', { root: repo, golden: runs }), /no-such-commit is not a commit here/);
  });

  test('coreHash covers js/core and content/ except viewmodel.js, and vmHash covers viewmodel.js', () => {
    assert.match(Hashes.coreHash(), /^[0-9a-f]{8}$/); assert.match(Hashes.vmHash(), /^[0-9a-f]{8}$/);
    const files = Hashes.coreFiles();
    assert.ok(files.includes('js/core/state.js') && files.includes('js/core/layout/generate.js') && files.includes('content/testroom.js'));
    assert.ok(!files.includes('js/core/viewmodel.js'));
    assert.equal(json(files.slice().sort()), json(files));
    // Every file index.html loads from js/core and content/ is covered (viewmodel.js aside).
    const listed = require(path.join(root, 'tools/core-context.js')).coreFiles().filter(f => f !== 'js/core/viewmodel.js');
    assert.equal(json(listed.slice().sort()), json(files));
    for (const s of ['', 'a', 'Accession — the état', '\u{1F3DB}']) assert.equal(Hashes.fnv1a(s), State.fnv1a(s));
    // A copy of the tree: what changes each hash, and what does not.
    const copy = path.join(tmp, 'hashes');
    for (const d of ['js/core', 'content', 'js/ui']) fs.cpSync(path.join(root, d), path.join(copy, d), { recursive: true });
    const h0 = Hashes.coreHash(copy), v0 = Hashes.vmHash(copy);
    assert.equal(h0, Hashes.coreHash()); assert.equal(v0, Hashes.vmHash());
    fs.appendFileSync(path.join(copy, 'js/core/viewmodel.js'), '\n// a view-model change\n');
    assert.equal(Hashes.coreHash(copy), h0); assert.notEqual(Hashes.vmHash(copy), v0);
    fs.appendFileSync(path.join(copy, 'js/ui/ui.js'), '\n// an interface change\n');
    assert.equal(Hashes.coreHash(copy), h0);
    const stateFile = path.join(copy, 'js/core/state.js');
    fs.writeFileSync(stateFile, fs.readFileSync(stateFile, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal(Hashes.coreHash(copy), h0, 'line endings do not count');
    fs.appendFileSync(path.join(copy, 'content/testroom.js'), '\n// a content change\n');
    assert.notEqual(Hashes.coreHash(copy), h0);
    const out = JSON.parse(cp.execFileSync('node', [path.join(root, 'tools/core-hash.js'), '--json'], { encoding: 'utf8' }));
    assert.equal(json(out), json({ coreHash: Hashes.coreHash(), vmHash: Hashes.vmHash() }));
  });

  test('node tools/replay.js plays a replay file, or a crash card holding one, and prints what happened in words', () => {
    const r = R.make({ seed: 20261023, room: 'T0' }, null, visit419.actions.slice(0, 40), Hashes.coreHash());
    const file = path.join(tmp, 'replay.json'), cardFile = path.join(tmp, 'card.json');
    fs.writeFileSync(file, json(r)); fs.writeFileSync(cardFile, json({ text: 'a card', replay: r }));
    const p = R.play(r);
    const run = (...args) => cp.spawnSync('node', [path.join(root, 'tools/replay.js')].concat(args), { encoding: 'utf8' });
    const a = run(file);
    assert.equal(a.status, 0, a.stdout + a.stderr);
    assert.ok(a.stdout.includes(`played 40 actions, 0 refused; final hash ${p.hash}`), a.stdout);
    assert.ok(a.stdout.includes(`coreHash ${Hashes.coreHash()}, this tree ${Hashes.coreHash()}`) && !a.stdout.includes('a different core'), a.stdout);
    const b = run(cardFile, '--log', '--inv');
    assert.equal(b.status, 0, b.stdout + b.stderr);
    assert.ok(b.stdout.includes('step 1: {"a":"move","dir":5}') && b.stdout.includes(`final hash ${p.hash}`), b.stdout);
    const lines = R.play(r, { log: true }).log.map(l => Text.log(l.events, C.Labels.nameOf(p.state), () => true)).filter(x => x.length);
    assert.ok(lines.length > 0 && b.stdout.includes('  ' + lines[0][0]), b.stdout);
    assert.ok(clean(a.stdout + b.stdout));
    assert.equal(run().status, 2);
  });
};
