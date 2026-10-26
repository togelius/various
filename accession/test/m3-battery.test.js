// The M3 sim battery (BUILD.md §10.3, §11's M3 row: criteria 3, 5 and 6; tools/battery.js),
// check-all's short sims (§10.2 step 4). test/run.js runs this file alone, as that step of its
// own, so the time it measures is the battery's: a run of the whole suite with no filter leaves
// it out, and `node test/run.js m3-battery` runs it.
//   - The short battery passes: every step of every run plain data, every event's cause
//     schema and sentence, every invariant, every special's damage to you equal to its mark in
//     the view model before the step, completeness, at most 150 rng streams and 64 cause
//     records, and at every death the recap equal to the one rebuilt from the log; it runs the
//     arenas it finds (a stamp and its policy file with naive and counter), prints them and the
//     ms a step, and takes at most 60 s.
//   - Its definitions are D6.3's, and an arena with no policy file, or one without both
//     policies, is skipped and named.
//   - Planted faults are caught: a plodder that steps twice, a darter that never steps back,
//     marble at full speed, a cause with a float (slipped into an event, and emitted by a rule),
//     a recap off by one turn, a special dealing one more than its mark, a special that goes
//     off before your next decision, and a beam that deals more on its way back from a
//     reflector than its shooter's mark there showed (in a room built for it, since no pack's
//     beam can strike you on its way back in play).
//   - A log that links a missing build fails check-all (§12).
//   - The battery's monkey plays as Monkey.run does, visit for visit.
'use strict';
module.exports = ({ test, assert, root, fs, path }) => {
  const Battery = require(path.join(root, 'tools/battery.js'));
  const json = v => JSON.stringify(v);
  const os = require('node:os'), cp = require('node:child_process');
  const ids = r => [...new Set(r.problems.map(p => p.id + (p.inv ? ' ' + p.inv : '')))];
  const named = d => Object.assign({ name: Battery.nameOf(d) }, d);
  const arena = (id, policy, seed) => named({ kind: 'arena', arena: id, policy, seed: seed || 1 });

  test('the short battery passes every check after every step, finds and prints the arenas it ran, and takes at most 60 s', () => {
    const r = Battery.run('short');
    console.log(r.sentence);
    const kinds = Object.keys(r.kinds).sort();
    console.log(`  the monkeys drew ${kinds.map(k => `${k} ${r.kinds[k]}`).join(', ')}; your killers were awake by ${Object.keys(r.killers).map(k => `${k} ${r.killers[k]}`).join(', ')}`);
    assert.ok(r.pass, `${r.violations} violations:\n${r.problems.slice(0, 8).map(p => `${p.run}: ${p.id}: ${p.text}`).join('\n')}`);
    assert.match(r.sentence, /; an empty completeness tally; 0 violations\.$/);
    assert.ok(r.ms <= Battery.GATE_MS, `the short battery took ${(r.ms / 1000).toFixed(1)} s, over the ${Battery.GATE_MS / 1000} s of check-all's gate (D6.3)`);
    // It ran each arena found, with both policies, on seed 1: here, a stamp in test/arena/ and
    // a policy file in tools/policies/ for each, which these lists find independently.
    const stamps = fs.readdirSync(path.join(root, 'test/arena')).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4)).sort();
    const withPolicies = stamps.filter(id => fs.existsSync(path.join(root, 'tools/policies', id + '.js')));
    assert.equal(json(r.arenas), json(withPolicies));
    assert.ok(r.arenas.length >= 1, 'no arena was found');
    const arenaRuns = r.results.filter(x => x.kind === 'arena');
    assert.equal(json(arenaRuns.map(x => `${x.arena} ${x.policy} ${x.seed}`)), json([].concat(...r.arenas.map(id => [`${id} naive 1`, `${id} counter 1`]))));
    // What it checked is there to check: deaths with recaps, specials on you, the soak's bell
    // and night watch, and a Night Watchman's victims among the deaths when its arena is run.
    assert.ok(r.deaths >= 1 && r.recaps === r.deaths, `${r.deaths} deaths, ${r.recaps} recaps`);
    assert.ok(r.specials >= 1, 'no special struck you, so criterion 3 was not checked');
    const soak = r.results.find(x => x.kind === 'soak');
    assert.ok(soak && soak.turns >= 1000 && soak.tally.stages.bell >= 1 && soak.tally.stages.night_watch >= 1, `the soak: ${json(soak && soak.tally.stages)}`);
    if (r.arenas.includes('night_watchman')) assert.ok(r.killers.night_watch >= 1, json(r.killers));
    // The monkeys draw every action kind a player has (weighted): each kind legal at 1,000
    // steps or more of theirs was drawn, beyond moves, waits and blows.
    const often = Object.keys(r.legal).filter(k => r.legal[k] >= 1000);
    assert.ok(often.length >= 5, json(r.legal));
    for (const k of often) assert.ok(r.kinds[k] > 0, `the monkeys never drew ${k}, legal at ${r.legal[k]} steps`);
    console.log(`  ${r.steps} steps in ${(r.ms / 1000).toFixed(1)} s: ${r.msPerStep.toFixed(2)} ms a step`);
  });

  test('the battery\'s runs are D6.3\'s, and only the arenas with a policy file registering naive and counter are run; the others are named', () => {
    const short = Battery.runs('short'), long = Battery.runs('long');
    const C = Battery.context(), depts = C.Packs.list().map(p => p.acc), found = Battery.arenas(C);
    const count = (list, k) => list.filter(x => x.kind === k).length;
    assert.equal(json(short.filter(x => x.kind === 'monkey').map(x => [x.room || x.dept, x.depth || null, x.seed, x.actions])),
      json([['T0', null, Battery.GOLDEN_SEED, 2000]].concat(depts.map(d => [d, 3, 1, 1000]))));
    assert.equal(count(short, 'arena'), 2 * found.ran.length);
    assert.equal(json(short.filter(x => x.kind === 'soak').map(x => [x.dept, x.depth, x.turns])), json([['M11', 3, 1000]]));
    assert.equal(count(long, 'monkey'), 1 + depts.length * 3 * 20);
    assert.equal(count(long, 'arena'), found.ran.length * 2 * 200);
    assert.equal(count(long, 'wander'), depts.length * 7 * 50);
    assert.equal(json(long.filter(x => x.kind === 'soak').map(x => [x.dept, x.turns])), json(depts.map(d => [d, 10000])));
    assert.ok(short.concat(long).every(x => typeof x.name === 'string' && x.name && !/undefined|NaN|null/.test(x.name)));
    assert.throws(() => Battery.runs('medium'), /short or long/);
    // A folder of stamps: one with its policies, one with no policy file (no group), one whose
    // file is there but lacks counter (it registers its own group, so the real file is used).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-battery-'));
    try {
      fs.copyFileSync(path.join(root, 'test/arena/plodder.txt'), path.join(dir, 'plodder.txt'));
      fs.copyFileSync(path.join(root, 'test/arena/plodder.txt'), path.join(dir, 'nobody.txt'));
      fs.copyFileSync(path.join(root, 'test/arena/plodder.txt'), path.join(dir, 'wander.txt'));
      const f = Battery.arenas(C, dir);
      assert.equal(json(f.ran), json(['plodder']));
      assert.equal(json(f.skipped), json([{ id: 'nobody', why: 'there is no tools/policies/nobody.js' }, { id: 'wander', why: 'tools/policies/wander.js registers no wander.naive or wander.counter' }]));
      const mine = Battery.runs('short', { arenaDir: dir }).filter(x => x.kind === 'arena');
      assert.equal(json(mine.map(x => [x.arena, x.policy, x.seed, x.stamp])), json([['plodder', 'naive', 1, path.join(dir, 'plodder.txt')], ['plodder', 'counter', 1, path.join(dir, 'plodder.txt')]]));
      const r = Battery.run(mine.slice(0, 1));
      assert.ok(r.pass && r.steps > 0, r.sentence);
      assert.ok(/skipped nobody \(there is no tools\/policies\/nobody\.js\) and wander/.test(Battery.sentence(Object.assign({}, r, { skipped: f.skipped }))));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('planted faults are caught: a plodder that steps twice, a darter that never steps back, marble at full speed, a cause with a float, a recap off by one turn, a special dealing one more than its mark, a special that goes off before your next decision', () => {
    const monkey = named({ kind: 'monkey', room: 'T0', seed: 1, actions: 60 });
    const plants = [
      { what: 'a plodder that steps twice', want: 'invariant plodder_one_thing', runs: [arena('plodder', 'naive')],
        plant: X => { const real = X.AI.towards; X.AI.towards = (s, a, g, how, ev) => { const x = a.x, y = a.y, t = real(s, a, g, how, ev); if (a.arch === 'plodder' && t !== null && !a.gone && (a.x !== x || a.y !== y)) real(s, a, g, how, ev); return t; }; } },
      { what: 'a darter that never steps back', want: 'invariant darter_steps_back', runs: [arena('darter', 'naive')],
        plant: X => { const real = X.Archetypes.act; X.Archetypes.act = (s, a, ev) => { if (a.arch !== 'darter' || a.mode !== 'hunting') return real(s, a, ev); const c = X.AI.strike(s, a, s.actors[0], ev); return c === null ? real(s, a, ev) : c; }; } },
      // The plodder arena's species on seed 1 is A4.1, a marble plodder.
      { what: 'marble at full speed', want: 'invariant arch_a_speed', runs: [arena('plodder', 'naive')],
        plant: X => { X.Registry.MODIFIERS.marble.speed = null; } },
      { what: 'a cause with a float, slipped into an event after it was emitted', want: 'cause', runs: [monkey],
        plant: X => { const real = X.Step.step; X.Step.step = (s, a) => { const ev = real(s, a); const e = ev.find(x => x.cause && Number.isInteger(x.cause.dist)); if (e) e.cause.dist += 0.5; return ev; }; } },
      { what: 'a cause with a float, emitted by a rule', want: 'threw', runs: [monkey],
        plant: X => { const real = X.Noise.emit; X.Noise.emit = (s, x, y, cls, cause, ev) => real(s, x, y, cls, Object.assign({}, cause, { dist: 0.5 }), ev); } },
      { what: 'a recap off by one turn', want: 'recap', runs: [arena('plodder', 'naive')],
        plant: X => { const real = X.Text.recap; X.Text.recap = (s, n) => { const r = real(s, n); if (r && r.wakeTurn !== null) r.wakeTurn += 1; return r; }; } },
      { what: 'a special dealing one more than its mark', want: 'special_marks', runs: [arena('axis_sniper', 'naive')],
        plant: X => { const real = X.Combat.hurt; X.Combat.hurt = (s, who, amount, cause, ev) => real(s, who, who.uid === 'you' && cause.k === 'special' ? amount + 1 : amount, cause, ev); } },
      // A mark that costs a tick and no longer waits for your next decision (notBefore): the
      // special goes off in the step it was marked, so no view model before a step showed it.
      { what: 'a special that goes off before your next decision', want: 'special_marks', runs: [arena('axis_sniper', 'naive')],
        plant: X => { const real = X.Specials.mark; X.Specials.mark = (s, a, id, list, ev) => { real(s, a, id, list, ev); a.notBefore = null; return 1; }; } },
    ];
    // Each run passes on the core as it is, so what fails is the plant.
    const clean = Battery.run([].concat(...plants.map(p => p.runs)).filter((d, i, all) => all.findIndex(x => x.name === d.name) === i));
    assert.ok(clean.pass, clean.sentence);
    assert.ok(clean.specials >= 1 && clean.deaths >= 1, clean.sentence);
    for (const p of plants) {
      const X = Battery.load();
      p.plant(X);
      const r = Battery.run(p.runs, { C: X });
      assert.ok(!r.pass, `${p.what} was not caught: ${r.sentence}`);
      assert.ok(ids(r).includes(p.want), `${p.what}: caught as ${json(ids(r))}, not ${p.want}`);
      const first = r.problems.find(x => x.id + (x.inv ? ' ' + x.inv : '') === p.want);
      assert.ok(first.replay && first.replay.actions.length >= 1 && first.text.includes(p.runs[0].name), `${p.what}: ${json(first)}`);
      console.log(`  planted ${p.what}: ${r.violations} ${r.violations === 1 ? 'violation' : 'violations'}, the first: ${first.text.slice(0, 160)}`);
    }
  });

  test('special_marks reads a beam sent back by a reflector as its shooter\'s special: a beam that strikes you on its way back must deal what its shooter\'s mark there showed', () => {
    // No pack's beam can strike you on its way back in play: the one axis_sniper species is glass,
    // so its beam sent back ends on its own tile, and from beyond the reflector you cannot reach
    // a tile behind it in the one decision you have. So a room for the test: the sniper without
    // its glass, a dish between it and you, and you set, once the beam is marked, on a tile its
    // way back crosses (behind the sniper), as a test sets a room. The step that follows is
    // played and checked as the battery checks every step.
    const CORRIDOR = ['##########', '#........#', '##########'];
    function beamBack(X, depth) {
      const body = (sp, at, extra) => Object.assign({ sp, at, mode: 'hunting', stats: X.Roles.stats(X.Packs.species('M11', sp).role, depth) }, extra || {});
      const s = X.Setup.room(1, { acc: 'M11', depth, map: CORRIDOR, you: [4, 1], exhibits: [body('M11.4', [2, 1], { mode: 'dormant', hp: 999 }), body('M11.1', [6, 1], { mods: [] })] });
      const you = s.actors[0], sniper = s.actors[2], chk = Battery.checks(X, { invs: [] }), out = [];
      assert.equal(json([s.actors[1].arch, sniper.arch]), json(['reflector', 'axis_sniper']));
      you.hp = you.maxHp = 999;
      let at = null;
      for (let i = 0; i < 12 && !s.over; i++) {
        if (!at && sniper.telegraph) {
          const t = sniper.telegraph, k = t.tiles.findIndex((xy, j) => t.via[j] && !s.actors.some(a => !a.gone && a.x === xy[0] && a.y === xy[1]));
          assert.ok(k >= 0, `depth ${depth}: the beam's way back crosses no free tile: ${json(t)}`);
          at = t.tiles[k]; you.x = at[0]; you.y = at[1];
        }
        const pre = X.State.clone(s), action = { a: 'wait' }, ev = X.Step.step(s, action);
        out.push(...chk.check(pre, action, ev, s));
        if (at && ev.some(e => e.k === 'special' && e.who === sniper.uid)) return { out, tally: chk.tally, hit: ev.filter(e => e.k === 'damaged' && e.who === 'you') };
      }
      assert.fail(`depth ${depth}: the beam never went off with you on its way back`);
    }
    for (const depth of [1, 4, 7]) {
      const r = beamBack(Battery.context(), depth);
      assert.equal(r.hit.length, 1, json(r.hit));
      assert.equal(json([r.hit[0].cause.k, typeof r.hit[0].cause.sp]), json(['reflected', 'string']), 'the beam struck you on its way back');
      assert.equal(r.tally.specials, 1, 'the battery counted it as a special on you');
      assert.equal(json(r.out), '[]');
    }
    // Planted: a beam deals one more on its way back than the mark there showed.
    const X = Battery.load(), real = X.Combat.hurt;
    X.Combat.hurt = (s, who, amount, cause, ev) => real(s, who, who.uid === 'you' && cause.k === 'reflected' && typeof cause.sp === 'string' ? amount + 1 : amount, cause, ev);
    const r = beamBack(X, 4);
    assert.ok(r.out.some(v => v.id === 'special_marks' && /'s line dealt you \d+ on \d+,\d+; its mark there in the view model before the step showed \d+/.test(v.text)), json(r.out));
  });

  test('the battery\'s other checks bite: more than 150 rng streams, more than 64 cause records, a state that is not plain data, a sentence with a gap, a starting story no room gives or one told at another turn, an illegal action', () => {
    const monkey = named({ kind: 'monkey', room: 'T0', seed: 1, actions: 30 });
    const after = f => X => { const real = X.Step.step; X.Step.step = (s, a) => { const ev = real(s, a); f(s, ev, X); return ev; }; };
    const plants = [
      { want: 'rng', runs: [monkey], plant: after(s => { for (let i = 0; i < 151; i++) s.rng['planted/' + i] = i; }) },
      { want: 'causes', runs: [monkey], plant: after(s => { while (s.causes.length <= 64) s.causes.push(Object.assign({}, s.causes[0] || { k: 'stage', turn: 0, tick: 0, stage: 'bell', cause: { k: 'clock', count: 0, B: 1, G: 1 } })); }) },
      { want: 'plain_data', runs: [monkey], plant: after(s => { s.planted = 0.5; }) },
      { want: 'sentence', runs: [monkey], plant: X => { const real = X.Text.event; X.Text.event = (e, n) => e.k === 'moved' ? 'The undefined moved.' : real(e, n); } },
      { want: 'start_story', runs: [arena('plodder', 'naive')], plant: X => { const real = X.Arena.build; X.Arena.build = (...a) => { const s = real(...a); for (const x of s.actors) if (x.woke) x.woke.cause.k = 'seen'; return s; }; } },
      // Set out awake, but its story says two turns after the visit began: Text.recap and
      // Recap.fromLog would both read that story, so the starting rule must catch it.
      { want: 'start_story', runs: [arena('plodder', 'naive')], plant: X => { const real = X.Arena.build; X.Arena.build = (...a) => { const s = real(...a); for (const x of s.actors) if (x.woke) { x.woke.turn += 2; if (x.hunted) x.hunted.turn += 2; } return s; }; } },
      // Its hunt told as begun by another cause than its waking.
      { want: 'start_story', runs: [arena('plodder', 'naive')], plant: X => { const real = X.Arena.build; X.Arena.build = (...a) => { const s = real(...a); for (const x of s.actors) if (x.hunted) x.hunted.cause = { k: 'seen', dist: 1 }; return s; }; } },
      { want: 'policy', runs: [arena('plodder', 'naive')], plant: X => { const p = X.Policies.get('plodder.naive').policy, real = p.decide; p.decide = obs => obs.legal.some(l => l.a === 'attack') ? real(obs) : { action: { a: 'move', dir: 99 }, reason: 'walks nowhere' }; } },
    ];
    for (const p of plants) {
      const X = Battery.load();
      p.plant(X);
      const r = Battery.run(p.runs, { C: X });
      assert.ok(!r.pass && ids(r).some(i => i === p.want || i.startsWith(p.want + ' ')), `${p.want} was not caught: ${json(ids(r))}: ${r.sentence}`);
    }
  });

  test('a log that links a build missing from dist/builds fails check-all\'s linked-builds step (§12)', () => {
    const sh = fs.readFileSync(path.join(root, 'check-all.sh'), 'utf8');
    const line = sh.split('\n').find(l => /^run linked-builds\s/.test(l));
    assert.ok(line, 'check-all has no linked-builds step');
    const args = line.replace(/^run linked-builds\s+/, '').trim().split(/\s+/);
    assert.equal(args[0], 'node');
    // The step's own command, run in a folder with a log of our own.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-builds-'));
    const step = () => cp.spawnSync(process.execPath, args.slice(1).map(a => a.startsWith('tools/') ? path.join(root, a) : a), { cwd: dir, encoding: 'utf8' });
    try {
      fs.writeFileSync(path.join(dir, 'DEVELOPMENT.md'), '- coreHash 1234abcd, nothing linked.\n- The acceptance build: [dist/builds/0badc0de.html](dist/builds/0badc0de.html).\n');
      let r = step();
      assert.notEqual(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /dist\/builds\/0badc0de\.html \(linked in DEVELOPMENT\.md\)/);
      assert.ok(!/1234abcd/.test(r.stdout), 'a coreHash named but not linked is no link');
      fs.mkdirSync(path.join(dir, 'dist', 'builds'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'dist', 'builds', '0badc0de.html'), '<!doctype html>');
      r = step();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /1 linked build, every one kept/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // And this tree's log passes it.
    const here = cp.spawnSync(process.execPath, args.slice(1).map(a => a.startsWith('tools/') ? path.join(root, a) : a), { cwd: root, encoding: 'utf8' });
    assert.equal(here.status, 0, here.stdout + here.stderr);
  });

  test('tools/report.js: sentences from sim and battery JSON, replays chosen by rule (the largest and the median paired difference; the commonest outcome\'s median seed and the median seed), crash cards for failures', () => {
    const Report = require(path.join(root, 'tools/report.js')), Sim = require(path.join(root, 'tools/sim.js'));
    const C = Battery.context(), BAD = /undefined|NaN|\[object|\bnull\b/;
    // The report's words: every line but the replays' JSON, in which null is a value.
    const words = t => t.split('\n').filter(l => !/^\s*\{/.test(l)).join('\n');
    // The rules, on JSON written by hand: differences B − A of 3, -5, 5, 0 and 1 on seeds 1–5.
    const run = (seed, hp, died) => ({ seed, stopped: died ? 'died' : 'won', hpLost: hp, outcome: { hpLost: hp, deaths: died ? 1 : 0 }, replay: { seed } });
    const pairs = { metric: { name: 'hpLost', test: 'ratio', at: 'most', pct: 70 }, a: { runs: [run(1, 5), run(2, 9), run(3, 2), run(4, 4), run(5, 4)] }, b: { runs: [run(1, 8), run(2, 4), run(3, 7), run(4, 4), run(5, 5)] } };
    const p = Report.pickPaired(pairs);
    assert.equal(json([p.metric, p.largest.seed, p.largest.d, p.median.seed, p.median.d]), json(['hpLost', 2, -5, 5, 1]), 'the largest |B − A| is 5 (seeds 2 and 3: the lower seed); the differences in order are -5, 0, 1, 3, 5');
    assert.equal(Report.pickPaired(Object.assign({}, pairs, { metric: { name: 'died', test: 'lower' } })).metric, 'deaths');
    const single = { runs: [run(4, 20, true), run(1, 3), run(2, 20, true), run(3, 20, true), run(5, 6)] };
    const q = Report.pickSingle(single);
    assert.equal(json([q.common, q.count, q.commonRun.seed, q.medianRun.seed]), json(['died', 3, 3, 3]));
    // A real paired run: its report names the verdict, the build, and replays that play back to
    // the runs' end states.
    const json2 = JSON.parse(JSON.stringify(Object.assign({ tool: 'sim', coreHash: Sim.hashes(C).coreHash, vmHash: Sim.hashes(C).vmHash }, Sim.paired('plodder', 'naive', 'counter', [1, 2, 3, 4], { C })), Sim.jsonValue));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-report-'));
    try {
      const text = Report.report(json2, { out: dir });
      assert.ok(!BAD.test(words(text)), text);
      assert.ok(text.includes(json2.verdict.sentence) && text.includes(`dist/builds/${json2.coreHash}.html`) && /link: pending M5/.test(text), text);
      assert.equal(fs.readFileSync(path.join(dir, 'report.md'), 'utf8'), text);
      const pp = Report.pickPaired(json2), files = fs.readdirSync(path.join(dir, 'replays')).sort();
      assert.equal(json(files), json([...new Set([pp.largest.seed, pp.median.seed])].sort((a, b) => a - b).flatMap(sd => [`plodder-seed${sd}-A.json`, `plodder-seed${sd}-B.json`])));
      for (const f of files) {
        const r = JSON.parse(fs.readFileSync(path.join(dir, 'replays', f), 'utf8')), side = /-A\.json$/.test(f) ? json2.a : json2.b;
        const want = side.runs.find(x => x.seed === Number(/seed(\d+)/.exec(f)[1]));
        assert.equal(C.Replay.play(r).hash, want.endHash, f);
      }
      // One policy's rates.
      const one = JSON.parse(JSON.stringify(Object.assign({ tool: 'sim', coreHash: 'abcdef12', vmHash: 'abcdef12' }, Sim.single('darter', 'naive', [1, 2, 3], { C }))));
      const t1 = Report.report(one);
      assert.ok(!BAD.test(words(t1)) && /Wilson interval/.test(t1) && /the commonest outcome, /.test(t1) && /the median seed, /.test(t1), t1);
      // A battery report with a planted failure: its crash card, shrunk, still fails as it did.
      const X = Battery.load();
      const real = X.Text.recap; X.Text.recap = (s, n) => { const r = real(s, n); if (r && r.wakeTurn !== null) r.wakeTurn += 1; return r; };
      const failed = JSON.parse(JSON.stringify(Battery.run([arena('plodder', 'naive')], { C: X })));
      const card = Report.crashCard(X, failed.problems[0], 20000);
      assert.ok(card.actions <= failed.problems[0].replay.actions.length && /^recap: the death recap's wakeTurn/.test(card.message), card.text);
      assert.ok(/Crash card: recap/.test(card.text) && !/undefined|NaN|\[object/.test(card.text), card.text);
      const tb = Report.report(failed);
      assert.ok(/Failures \(1; the first 1 kept\)/.test(tb) && /play it:/.test(tb), tb);
      assert.ok(Report.report(JSON.parse(JSON.stringify(Battery.run([arena('plodder', 'counter')])))).includes('No failure, so no crash card.'));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // Links: a build's path, with or without dist/, is a link; a coreHash named alone is not.
    assert.equal(json(Report.linkedBuilds('see dist/builds/0123abcd.html and builds/89abcdef.html, then [x](dist/builds/0123abcd.html); coreHash 76543210')), json(['0123abcd', '89abcdef']));
  });

  test('the battery\'s monkey plays as Monkey.run does: the same actions, visits and final state', () => {
    const C = Battery.context();
    for (const d of [named({ kind: 'monkey', room: 'T0', seed: 20261023, actions: 400 }), named({ kind: 'monkey', dept: 'A4', depth: 3, seed: 2, actions: 300 })]) {
      const r = Battery.run([d]).results[0];
      let last = null, ends = 0;
      C.Monkey.run(d.seed, d.actions, { make: d.room === 'T0' ? undefined : s => C.Dept.create(s, d.dept, d.depth),
        check(s) { last = C.State.hash(s); if (C.Monkey.ended(s)) ends++; } });
      assert.ok(ends >= 1, `${d.name}: no visit ended, so the restart is not compared`);
      assert.equal(r.visits, ends + 1, d.name);
      assert.equal(r.finalHash, last, d.name);
    }
  });
};
