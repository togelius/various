// The sim (tools/sim.js; BUILD.md §10.2, §10.3): runs with a reason for every decision and
// a replay that replays, paired runs on shared seeds, the counterfactual switches, the
// statistics of a comparison in words, and the command line end to end.
module.exports = ({ test, assert, root, path, fs }) => {
  const Sim = require(path.join(root, 'tools/sim.js'));
  const C = Sim.load();
  const { spawnSync } = require('node:child_process');
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const clean = s => assert.doesNotMatch(String(s), /undefined|NaN|\[object/, `not a clean sentence: ${s}`);
  const DUMMY = C.Arena.parse(C.Arena.DUMMY);
  const dummy = (s, o) => C.Arena.build(DUMMY, s, { options: o }), judged = (s, ev) => C.Arena.outcome(DUMMY, s, ev);
  const cli = args => spawnSync(process.execPath, [path.join(root, 'tools/sim.js'), ...args], { encoding: 'utf8', cwd: root });
  const policy = (decide, extra) => Object.assign({ card: { summary: 'A planted policy.', rules: ['As planted.'] }, decide }, extra || {});

  test('a run plays a policy to its outcome, with a reason for every decision', () => {
    const r = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1 });
    assert.equal(r.policy, 'basic.fighter'); assert.equal(r.seed, 1);
    assert.equal(r.stopped, 'won'); assert.equal(r.outcome.won, true); assert.equal(r.outcome.done, true);
    assert.equal(r.reasons.length, r.steps); assert.equal(r.replay.actions.length, r.steps);
    r.reasons.forEach(line => { assert.match(line, /^turn \d+: \S/); clean(line); });
    eq(r.violations, []); assert.equal(r.error, null);
    assert.equal(r.turns, r.outcome.turns); assert.equal(r.hpLost, r.outcome.hpLost); assert.equal(r.deaths, r.outcome.deaths);
    eq(r.replay.options, { rulesOff: [], without: [], invulnerable: false });
    assert.equal('events' in r, false, 'events only when asked for');
    const logged = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1, log: true });
    // Without an arena's outcome a run goes on until the visit is over or the cap, as a
    // department's does.
    assert.equal(Sim.run({ make: dummy, policy: 'fighter', seed: 1, cap: 30 }).stopped, 'cap');
    // runArena builds and judges from the stamp, with the seed's depth and species.
    const ra = Sim.runArena('dummy', 'fighter', 1);
    eq([ra.stopped, ra.reasons, ra.depth, ra.sp, ra.replay.start.arena], ['won', r.reasons, 2, C.Arena.speciesFor(DUMMY, 1).id, 'dummy']);
    assert.ok(logged.events.length > r.steps && logged.events.every(e => typeof e.k === 'string'));
  });

  test('a replay replays: its actions on a fresh state end on the same hash', () => {
    for (const seed of [1, 2, 3]) {
      const r = Sim.run({ make: dummy, policy: 'random', seed, cap: 60 });
      const s = dummy(seed, r.replay.options);
      assert.equal(C.State.hash(s), r.startHash);
      for (const a of r.replay.actions) C.Step.step(s, a);
      assert.equal(C.State.hash(s), r.endHash, `seed ${seed}`);
    }
  });

  test('the cap, the step limit, refusals, a failing policy and a missing reason each stop or mark a run', () => {
    const waits = policy(() => ({ action: { a: 'wait' }, reason: 'waits' }));
    const capped = Sim.run({ make: dummy, policy: waits, name: 'test.waits', seed: 1, cap: 7 });
    assert.deepEqual([capped.stopped, capped.turns, capped.steps], ['cap', 7, 7]);
    // A 0-tick refusal costs no time: the step limit (cap × 10) or the stuck rule stops it.
    const refused = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'fly' }, reason: 'tries to fly' })), name: 'test.fly', seed: 1, cap: 3 });
    assert.equal(refused.stopped, 'steps'); assert.equal(refused.steps, 30); assert.equal(refused.refusals, 30);
    assert.match(refused.violations[0].text, /test\.fly chose fly at turn 0, which is not legal then/);
    const stuck = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'fly' }, reason: 'tries to fly' })), name: 'test.fly', seed: 1 });
    assert.deepEqual([stuck.stopped, stuck.steps], ['stuck', 50]);
    const throws = Sim.run({ make: dummy, policy: policy(() => { throw new Error('lost its map'); }), name: 'test.lost', seed: 1 });
    assert.equal(throws.stopped, 'error'); assert.match(throws.error, /test\.lost failed to decide at turn 0: lost its map/);
    const mute = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'wait' }, reason: '' })), name: 'test.mute', seed: 1 });
    assert.equal(mute.stopped, 'error'); assert.match(mute.error, /gave no reason in words for wait/);
    const vague = Sim.run({ make: dummy, policy: policy(() => ({ action: { a: 'wait' }, reason: 'waits for undefined' })), name: 'test.vague', seed: 1 });
    assert.equal(vague.stopped, 'error');
    const none = Sim.run({ make: dummy, policy: policy(() => ({ reason: 'nothing' })), name: 'test.none', seed: 1 });
    assert.match(none.error, /decided no action/);
    assert.throws(() => Sim.run({ make: dummy, policy: 'nobody', seed: 1 }), /no policy nobody/);
    assert.throws(() => Sim.run({ policy: 'idle', seed: 1 }), /needs make/);
  });

  test('check runs a checker after every step, and its violations are listed with their step', () => {
    let calls = 0;
    const r = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 1, check: (pre, action, events, post) => {
      calls++;
      assert.ok(pre.tick <= post.tick && Array.isArray(events));
      return post.turn === 3 ? [{ inv: 'planted', text: 'turn 3 is planted' }] : [];
    } });
    assert.equal(calls, r.steps);
    assert.equal(r.violations.length, 1); assert.equal(r.violations[0].inv, 'planted'); assert.equal(r.violations[0].step, 2);
    // check: true loads every test/behaviour/*.inv.js through tools/invariants.js.
    const all = Sim.run({ make: dummy, outcome: judged, policy: 'fighter', seed: 2, check: true });
    assert.ok(Array.isArray(all.violations));
  });

  test('paired runs share seeds: both arms build the same room, with the same streams, from each seed', () => {
    const p = Sim.paired('dummy', 'idle', 'fighter', [1, 2, 3, 4]);
    eq(p.seeds, [1, 2, 3, 4]); assert.equal(p.arena, 'dummy');
    for (let i = 0; i < 4; i++) {
      const a = p.a.runs[i], b = p.b.runs[i];
      eq([a.seed, a.depth, a.sp, a.variant], [b.seed, b.depth, b.sp, b.variant]);
      assert.equal(a.startHash, b.startHash, `seed ${a.seed}: the same starting state`);
      assert.equal(a.depth, a.seed % 2 ? 2 : 5);
    }
    assert.equal(p.a.name, 'basic.idle'); assert.equal(p.b.name, 'basic.fighter');
    assert.ok(p.a.card.startsWith('basic.idle: '));
    // The verdict is the stamp's metric, in words.
    assert.equal(p.verdict.metric, 'hpLost <= 90%'); clean(p.verdict.sentence);
    for (const k of ['hpLost', 'woken', 'turns']) assert.equal(p.stats[k].n, 4);
    // Two option sets as arms: the same policy with a rule switched off differs only there.
    const q = Sim.paired('dummy', 'fighter', 'fighter@rules-off=marble+plaster,invulnerable', [1]);
    eq(q.b.runs[0].replay.options, { rulesOff: ['marble', 'plaster'], without: [], invulnerable: true });
    eq(q.a.runs[0].replay.options, { rulesOff: [], without: [], invulnerable: false });
    assert.throws(() => Sim.paired('dummy', 'fighter', 'fighter@colour=red', [1]), /an arm's switch is/);
  });

  test("--without X leaves an independent Y's combat/ and ai/ draws unchanged", () => {
    // Two hunting fodder, X and Y, come for you while you wait.
    const spec = C.Arena.parse('arena: pair\ngoal: kill\ncap: 40\ndepths: 3\nlegend: Q exhibit role=fodder mode=hunting; Y exhibit role=fodder mode=hunting\n\n##########\n#Q......Y#\n#...@....#\n##########\n');
    const X = 'T0.3.room.1', Y = 'T0.3.room.2';
    const seen = { with: [], without: [] };
    const record = k => (pre, a, ev, post) => { seen[k].push([post.rng['combat/' + Y], post.rng['ai/' + Y]]); return []; };
    const make = (s, o) => C.Arena.build(spec, s, { options: o });
    const w = Sim.run({ make, policy: 'idle', seed: 9, check: record('with'), options: { invulnerable: true } });
    const wo = Sim.run({ make, policy: 'idle', seed: 9, check: record('without'), options: { invulnerable: true, without: [X] } });
    assert.ok(w.turns > 10 && wo.turns > 10);
    // Y keeps its uid and tile.
    const a = make(9, {}), b = make(9, { without: [X] });
    eq([C.Actors.byUid(a, Y).x, C.Actors.byUid(a, Y).y], [C.Actors.byUid(b, Y).x, C.Actors.byUid(b, Y).y]);
    assert.equal(C.Actors.byUid(b, X).gone, 1);
    // Each stream state Y reaches lies, in order, on the one chain its seed starts: nothing
    // X did or did not do reseeded or shifted it.
    for (const [i, name] of [[0, 'combat/'], [1, 'ai/']]) {
      let st = C.Rng.hash32('9/' + name + Y);
      const chain = new Map([[st, 0]]);
      for (let k = 1; k <= 2000; k++) { st = C.Rng.advance(st)[1]; chain.set(st, k); }
      for (const k of ['with', 'without']) {
        let at = 0, used = 0;
        for (const s of seen[k]) {
          const v = s[i];
          if (v === undefined) continue;
          assert.ok(chain.has(v), `${name}${Y} ${k} X: a state off its chain`);
          assert.ok(chain.get(v) >= at, `${name}${Y} ${k} X: the stream went backwards`);
          at = chain.get(v); used = at;
        }
        if (name === 'combat/') assert.ok(used > 0, `${Y} struck ${k} X, so the test sees its draws`);
      }
    }
    // The first 50 draws from each start are the same.
    const draws = (s, p) => { const r = C.Rng.stream(s, p); return Array.from({ length: 50 }, () => r.u32()); };
    eq(draws(make(9, {}), 'combat/' + Y), draws(make(9, { without: [X] }), 'combat/' + Y));
    eq(draws(make(9, {}), 'ai/' + Y), draws(make(9, { without: [X] }), 'ai/' + Y));
  });

  test('--invulnerable keeps you at 1 HP and counts the blows that would have killed you', () => {
    const spec = C.Arena.parse('arena: brute\ngoal: kill\ncap: 60\ndepths: 7\nlegend: B exhibit role=brute mode=hunting\n\n#######\n#@...B#\n#######\n');
    const make = (s, o) => C.Arena.build(spec, s, { options: o });
    const mortal = Sim.run({ make, policy: 'idle', seed: 1 });
    assert.equal(mortal.stopped, 'died'); assert.deepEqual([mortal.deaths, mortal.hpLost], [1, 20]);
    const r = Sim.run({ make, policy: 'idle', seed: 1, options: { invulnerable: true } });
    assert.equal(r.stopped, 'cap'); assert.ok(r.deaths >= 2, `deaths ${r.deaths}`); assert.equal(r.outcome.died, false);
    assert.ok(r.hpLost <= 20);
  });

  test("the statistics of a comparison, and the verdict in words for each kind of metric", () => {
    const runs = vals => vals.map(([hpLost, died, woken]) => ({ outcome: { hpLost, died, deaths: died ? 1 : 0, woken, turns: 10, won: !died } }));
    const naive = runs(Array.from({ length: 40 }, (_, i) => [10 + (i % 5), i % 3 === 0, 3]));
    const counter = runs(Array.from({ length: 40 }, (_, i) => [5 + (i % 4), false, 1]));
    const hp = Sim.compare('test', naive, counter, { name: 'hpLost', test: 'ratio', at: 'most', pct: 90 }, ['n', 'c']);
    assert.equal(hp.verdict.pass, true); assert.match(hp.verdict.sentence, /^test: c's HP lost over n's is 0\.\d\d \(95% interval/); clean(hp.verdict.sentence);
    const wk = Sim.compare('test', naive, counter, { name: 'woken', test: 'ratio', at: 'most', pct: 50 }, ['n', 'c']);
    assert.equal(wk.stats.woken.ratio, 1 / 3); assert.equal(wk.verdict.pass, true, '1/3 meets 50%, and every seed differs by -2');
    eq([wk.stats.woken.lo, wk.stats.woken.hi], [-2, -2]);
    const died = Sim.compare('test', naive, counter, { name: 'died', test: 'lower', at: null, pct: null }, ['n', 'c']);
    assert.equal(died.verdict.pass, true); assert.match(died.verdict.sentence, /n died on 14 of 40 seeds \(35\.0%\) and c on 0/); clean(died.verdict.sentence);
    const never = Sim.compare('test', counter, counter, { name: 'died', test: 'lower', at: null, pct: null }, ['n', 'c']);
    assert.equal(never.verdict.pass, false); assert.match(never.verdict.sentence, /neither ever had the outcome/);
    const zero = Sim.compare('test', runs([[0, false, 0], [0, false, 0]]), runs([[3, false, 0], [1, false, 0]]), { name: 'hpLost', test: 'ratio', at: 'most', pct: 90 }, ['n', 'c']);
    assert.equal(zero.verdict.pass, false); assert.match(zero.verdict.sentence, /n has no HP lost over 2 seeds, so there is no ratio/); clean(zero.verdict.sentence);
    assert.equal(Sim.compare('test', naive, counter, null).verdict, null);
  });

  test('seeds, arms and flags are read as written, and refused in words otherwise', () => {
    eq(Sim.parseSeeds('1-3,7,9-10'), [1, 2, 3, 7, 9, 10]);
    assert.throws(() => Sim.parseSeeds('5-1'), /runs backwards/);
    assert.throws(() => Sim.parseSeeds('one'), /seeds are written like/);
    const o = Sim.parseArgs(['--arena', 'dummy', '--paired', 'naive', 'counter', '--seeds', '1-200', '--depth', '5', '--rules-off', 'marble,plaster', '--without', 'a.1', '--without', 'b.2', '--invulnerable', '--cap', '50', '--check', '--log']);
    eq([o.arena, o.paired, o.seeds, o.depth, o.rulesOff, o.without, o.invulnerable, o.cap, o.check, o.log], ['dummy', ['naive', 'counter'], '1-200', 5, ['marble', 'plaster'], ['a.1', 'b.2'], true, 50, true, true]);
    assert.throws(() => Sim.parseArgs(['--depth', '9']), /--depth is a whole number from 1 to 7/);
    assert.throws(() => Sim.parseArgs(['--fly']), /unknown flag --fly/);
    assert.throws(() => Sim.parseArgs(['--policy']), /--policy needs a value/);
  });

  test("coreHash covers the core and content but not viewmodel.js, and vmHash is viewmodel.js's", () => {
    const h = Sim.hashes(C);
    assert.match(h.coreHash, /^[0-9a-f]{8}$|^\S+$/); assert.ok(h.vmHash && h.coreHash !== h.vmHash);
    eq(Sim.hashes(C), h, 'stable');
    if (h.from === 'tools/sim.js') {
      const { coreFiles } = require(path.join(root, 'tools/core-context.js'));
      const src = f => f + '\n' + fs.readFileSync(path.join(root, f), 'utf8');
      const hex = v => (v >>> 0).toString(16).padStart(8, '0');
      assert.equal(h.coreHash, hex(C.State.fnv1a(coreFiles().filter(f => f !== 'js/core/viewmodel.js').map(src).join('\n'))));
      assert.equal(h.vmHash, hex(C.State.fnv1a(src('js/core/viewmodel.js'))));
    } else assert.equal(h.from, 'tools/core-hash.js');
  });

  test('the command line: --help lists the §10.2 flags, and the dummy arena runs end to end', () => {
    const help = cli(['--help']);
    assert.equal(help.status, 0);
    for (const f of ['--policy', '--seeds', '--depth', '--dept', '--rules-off', '--without', '--paired', '--invulnerable', '--arena', '--cards'])
      assert.ok(help.stdout.includes(f), `--help does not list ${f}`);
    const r = cli(['--arena', 'dummy', '--paired', 'idle', 'fighter', '--seeds', '1-4']);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.tool, 'sim'); assert.ok(j.coreHash && j.vmHash); eq(j.seeds, [1, 2, 3, 4]);
    eq([j.a.runs.length, j.b.runs.length, j.arena], [4, 4, 'dummy']);
    for (const run of j.a.runs.concat(j.b.runs)) { assert.equal(run.replay.coreHash, j.coreHash); assert.ok(run.reasons.length === run.steps); }
    assert.match(r.stderr, /^dummy: /); clean(r.stderr);
    // One policy, written to a file; a department; the cards.
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'accession-sim-')), out = path.join(tmp, 'out.json');
    const one = cli(['--arena', 'dummy', '--policy', 'fighter', '--seeds', '2', '--out', out, '--rules-off', 'marble']);
    assert.equal(one.status, 0, one.stderr);
    const k = JSON.parse(fs.readFileSync(out, 'utf8'));
    eq([k.policy, k.runs.length, k.options.rulesOff, k.runs[0].replay.options.rulesOff], ['basic.fighter', 1, ['marble'], ['marble']]);
    assert.ok(k.summary.n === 1 && 'won' in k.summary); clean(one.stderr);
    const dept = cli(['--dept', 'A4', '--policy', 'idle', '--seeds', '1', '--cap', '5', '--depth', '2']);
    assert.equal(dept.status, 0, dept.stderr);
    const d = JSON.parse(dept.stdout);
    eq([d.dept, d.runs[0].turns, d.runs[0].stopped, d.runs[0].replay.start], ['A4', 5, 'cap', { dept: 'A4', seed: 1, depth: 2 }]);
    const cards = cli(['--cards']);
    assert.equal(cards.stdout, fs.readFileSync(Sim.README, 'utf8'));
    // Mistakes are refused in words, with a failing status.
    for (const [args, re] of [[['--arena', 'nowhere', '--policy', 'idle'], /no arena nowhere/], [['--arena', 'dummy'], /one of --policy/], [['--policy', 'idle'], /one of --arena/],
      [['--arena', 'dummy', '--policy', 'nobody'], /no policy nobody/], [['--dept', 'Z9', '--policy', 'idle'], /no department Z9/]]) {
      const e = cli(args);
      assert.equal(e.status, 1, args.join(' ')); assert.match(e.stderr, re); clean(e.stderr);
    }
  });
};
