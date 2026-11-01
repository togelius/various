// M4's skeleton (M4 plan A12, A15, A18; W0-SKEL): every file M4 adds is listed in index.html in
// an order that lets it register where it must; every export the plan names has its arity and
// its neutral result on a fresh test room; the skeleton's working code (the perks' dispatch, the
// hall's checks, a Centrepiece's pieces, the starting kit's tier, plan.intro's shape, the `view`
// action) does what it says; and every M4 number of record is in numbers.js with its value.
//
// Each export's row says how its neutral result is held:
//   keep  the result a fresh test room gives for good, whoever fills the export: M4's parts of
//         a state are absent until a rule writes them (§4.1), and the test room has none, so
//         a filled export must still give it;
//   stub  the result while the export is still the skeleton's one-line stub, found by its line
//         in its file, the line above it a comment naming the package that fills it; once
//         that package fills it, its own tests pin what it does, and this file its arity.
// Every row calls the export on a fresh test room, with an empty event list, and also checks
// that the call changed nothing and emitted nothing.
'use strict';
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const { spawnSync } = require('node:child_process');
  const C = loadCore();
  const json = x => JSON.stringify(x);
  const src = f => fs.readFileSync(path.join(root, f), 'utf8');
  const PACK = { acc: 'T0', species: [], modules: [] };
  // The core with one file's source changed (edit(text) → text), for a number loadCore's
  // opts.numbers cannot set (a table); unhardened, as only this file's tests use it.
  function coreWith(file, edit) {
    const vm = require('node:vm'), { coreFiles } = require(path.join(root, 'tools/core-context.js'));
    const ctx = vm.createContext({}), names = [];
    for (const f of coreFiles()) {
      const text = f === file ? edit(src(f)) : src(f);
      for (const m of text.matchAll(/^const ([A-Z][A-Za-z0-9]*) =/gm)) names.push(m[1]);
      vm.runInContext(text, ctx, { filename: f });
    }
    return vm.runInContext('({' + names.join(',') + '})', ctx);
  }

  // [export, arity, file, stub line (null: keep) and its filler, call(X, state, ev), neutral]
  const R = 'js/core/rules/', L = 'js/core/layout/';
  const ROWS = [
    ['Progress.median', 1, R + 'progress.js', ['W0c', 'function median(depth) { return null; }'], X => X.Progress.median(1), null],
    ['Progress.award', 4, R + 'progress.js', ['PG-CORE', 'function award(state, how, cause, ev) { return false; }'], (X, s, ev) => X.Progress.award(s, 'view', { k: 'view' }, ev), false],
    ['Progress.afterChoice', 2, R + 'progress.js', null, (X, s, ev) => X.Progress.afterChoice(s, ev), undefined],
    ['Progress.offer', 1, R + 'progress.js', ['PG-CORE', 'function offer(state) { return []; }'], (X, s) => X.Progress.offer(s), []],
    ['Progress.cert', 1, R + 'progress.js', null, (X, s) => X.Progress.cert(s), null],
    ['Perks.add', 2, R + 'perks.js', null, null, null],
    ['Perks.rank', 2, R + 'perks.js', null, (X, s) => X.Perks.rank(s, 'soft_soles'), 0],
    ['Perks.charges', 1, R + 'perks.js', null, (X, s) => X.Perks.charges(s), []],
    ['Perks.ringDelta', 1, R + 'perks.js', null, (X, s) => X.Perks.ringDelta(s), 0],
    ['Perks.loseTrack', 2, R + 'perks.js', null, (X, s) => X.Perks.loseTrack(s, s.actors[1]), C.N.LOSE_TRACK_TURNS],
    ['Perks.onLoseTrack', 3, R + 'perks.js', null, (X, s, ev) => X.Perks.onLoseTrack(s, s.actors[1], ev), undefined],
    ['Perks.openCost', 2, R + 'perks.js', null, (X, s) => X.Perks.openCost(s, C.N.COST_OPEN_CASE), C.N.COST_OPEN_CASE],
    ['Perks.openQuiet', 1, R + 'perks.js', null, (X, s) => X.Perks.openQuiet(s), false],
    ['Perks.lockBonus', 1, R + 'perks.js', null, (X, s) => X.Perks.lockBonus(s), 0],
    ['Perks.padding', 1, R + 'perks.js', null, (X, s) => X.Perks.padding(s), 0],
    ['Perks.afterStep', 4, R + 'perks.js', null, (X, s, ev) => X.Perks.afterStep(s, s.actors[1], [4, 1], ev), undefined],
    ['Perks.onLow', 4, R + 'perks.js', null, (X, s, ev) => X.Perks.onLow(s, s.actors[0], 20, ev), undefined],
    ['Perks.onResolve', 5, R + 'perks.js', null, (X, s, ev) => X.Perks.onResolve(s, s.actors[1], { id: 'ring', tiles: [] }, false, ev), undefined],
    ['Perks.surprise', 3, R + 'perks.js', null, (X, s) => X.Perks.surprise(s, s.actors[0], s.actors[3]), false],
    ['Perks.adjust', 4, R + 'perks.js', null, (X, s, ev) => X.Perks.adjust(s, { a: 'wait' }, 100, ev), { r: 100, why: null }],
    ['Hall.boundary', 2, R + 'hall.js', null, (X, s, ev) => X.Hall.boundary(s, ev), undefined],
    ['Hall.addCheck', 2, R + 'hall.js', null, null, null],
    ['Hall.onTicket', 2, R + 'hall.js', null, (X, s, ev) => X.Hall.onTicket(s, ev), undefined],
    ['Hall.onDefeat', 2, R + 'hall.js', null, (X, s, ev) => X.Hall.onDefeat(s, ev), undefined],
    ['Hall.inside', 3, R + 'hall.js', null, (X, s) => X.Hall.inside(s, 2, 3), false],
    ['Hall.openings', 1, R + 'hall.js', null, (X, s) => X.Hall.openings(s), []],
    ['Hall.cp', 1, R + 'hall.js', null, (X, s) => X.Hall.cp(s), null],
    ['Centrepiece.place', 3, R + 'centrepiece.js', ['ARCH-CP-CORE', 'function place(state, plan, pack) {}'], (X, s) => X.Centrepiece.place(s, null, PACK), undefined],
    ['Centrepiece.pieces', 1, R + 'centrepiece.js', null, (X, s) => X.Centrepiece.pieces(s), []],
    ['Centrepiece.form', 1, R + 'centrepiece.js', null, (X, s) => X.Centrepiece.form(s), null],
    ['Centrepiece.onPieceDied', 3, R + 'centrepiece.js', ['ARCH-CP-CORE', 'function onPieceDied(state, a, ev) {}'], (X, s, ev) => X.Centrepiece.onPieceDied(s, s.actors[1], ev), undefined],
    ['Viewing.legal', 1, R + 'viewing.js', null, (X, s) => X.Viewing.legal(s), []],
    ['Viewing.candidates', 1, R + 'viewing.js', null, (X, s) => X.Viewing.candidates(s), [{ a: 'view' }]],
    ['Viewing.apply', 3, R + 'viewing.js', null, (X, s, ev) => X.Viewing.apply(s, { a: 'view' }, ev), 'no_centrepiece'],
    ['Viewing.of', 1, R + 'viewing.js', null, (X, s) => X.Viewing.of(s), null],
    ['Fixtures.addReader', 2, R + 'fixtures.js', ['W0d1', 'function addReader(k, fn) {}'], X => X.Fixtures.addReader('planted', () => 'label_none'), undefined],
    ['Fixtures.read', 2, R + 'fixtures.js', ['W0d1', "function read(state, f) { return 'label_none'; }"], (X, s) => X.Fixtures.read(s, { k: 'planted', x: 4, y: 1 }), 'label_none'],
    ['Fixtures.at', 3, R + 'fixtures.js', null, (X, s) => X.Fixtures.at(s, s.actors[0].x, s.actors[0].y), null],
    ['Populate.exhibits', 4, 'js/core/populate.js', ['W0c', 'function exhibits(state, plan, pack, base) {}'], (X, s) => X.Populate.exhibits(s, null, PACK, 'planted'), undefined],
    ['Populate.addValidator', 2, 'js/core/populate.js', ['W0c', 'function addValidator(id, fn) {}'], X => X.Populate.addValidator('planted', () => null), undefined],
    ['Populate.validate', 2, 'js/core/populate.js', ['W0c', 'function validate(state, plan) { return null; }'], (X, s) => X.Populate.validate(s, null), null],
    ['Populate.galleryOf', 2, 'js/core/populate.js', null, (X, s) => X.Populate.galleryOf(s, 'room'), null],
    ['Panels.place', 3, 'js/core/panels.js', ['W-PANELS', 'function place(state, plan, pack) {}'], (X, s) => X.Panels.place(s, null, PACK), undefined],
    ['Panels.banner', 2, 'js/core/panels.js', null, (X, s) => X.Panels.banner(s, 'intro'), null],
    ['Labels.ofLectern', 2, 'js/core/labels.js', ['LABELS-M4', 'function ofLectern(state, f) { return null; }'], (X, s) => X.Labels.ofLectern(s, { k: 'lectern', x: 4, y: 1 }), null],
    ['Labels.ofPanel', 2, 'js/core/labels.js', ['LABELS-M4', 'function ofPanel(state, f) { return null; }'], (X, s) => X.Labels.ofPanel(s, { k: 'panel', x: 4, y: 0, key: 'intro' }), null],
    ['Labels.ofSheet', 2, 'js/core/labels.js', ['LABELS-M4', 'function ofSheet(state, f) { return null; }'], (X, s) => X.Labels.ofSheet(s, { k: 'sheet', x: 4, y: 1, of: 'nobody' }), null],
    ['Status.define', 2, R + 'status.js', ['W0c', 'function define(id, rule) {}'], X => X.Status.define('planted', {}), undefined],
    ['Modules.on', 2, R + 'modules.js', null, (X, s) => X.Modules.on(s, 'unobserved_motion'), false],
    ['Modules.offFor', 2, R + 'modules.js', null, X => X.Modules.offFor(PACK, []), []],
    // MOD-WEATHER: init gives each module's init the layout attempt's stream key (…/a<k>).
    ['Modules.init', 3, R + 'modules.js', null, (X, s) => X.Modules.init(s, PACK), undefined],
    ['Modules.pipsDecay', 1, R + 'modules.js', null, (X, s) => X.Modules.pipsDecay(s), true],
    ['Modules.mayReturn', 2, R + 'modules.js', null, (X, s) => X.Modules.mayReturn(s, s.actors[1]), true],
    ['Modules.threat', 2, R + 'modules.js', null, (X, s) => X.Modules.threat(s, 10000), []],
    ['Archetypes.huntsOnSight', 2, R + 'archetypes.js', null, (X, s) => X.Archetypes.huntsOnSight(s, s.actors[1]), true],
    ['Archetypes.marksAwake', 2, R + 'archetypes.js', null, (X, s) => X.Archetypes.marksAwake(s, s.actors[1]), false],
    ['Archetypes.immune', 3, R + 'archetypes.js', null, (X, s) => X.Archetypes.immune(s, s.actors[1], 'dazed'), false],
    ['Archetypes.plan', 2, R + 'archetypes.js', null, (X, s) => X.Archetypes.plan(s, s.actors[1]), null],
    ['Archetypes.wakeRegion', 3, R + 'archetypes.js', ['W0d1', 'function defaultWakeRegion(state, a, turns) { return []; }'], (X, s) => X.Archetypes.wakeRegion(s, s.actors[3], 3), []],
    ['Kit.start', 3, R + 'kit.js', null, null, null],
    ['Kit.observing', 1, R + 'kit.js', null, (X, s) => X.Kit.observing(s), 0],
    ['ClockRules.advance', 4, R + 'clock.js', ['W0d1', 'function advance(state, n, cause, ev) {}'], (X, s, ev) => X.ClockRules.advance(s, C.N.ALARM_CLOCK_ADVANCE, { k: 'alarm_network', by: 'nobody' }, ev), undefined],
    ['Actions.addRefuser', 1, R + 'actions.js', ['W0d1', 'function addRefuser(fn) {}'], X => X.Actions.addRefuser(() => null), undefined],
    ['Actions.free', 1, R + 'actions.js', null, X => X.Actions.free('wait'), false],
    // Beyond A18: the other names one package calls in another's file.
    ['CopiesWeaken.addGroup', 2, R + 'modules/copies_weaken.js', ['MOD-COPIES', 'function addGroup(state, group) {}'], (X, s) => X.CopiesWeaken.addGroup(s, 'planted'), undefined],
    ['LStamp.shape', 1, L + 'stamp.js', null, X => X.LStamp.shape(null), null],
    ['LV6.check', 2, L + 'lv6.js', ['D-LV6', 'function check(state, plan) { return null; }'], (X, s) => X.LV6.check(s, null), null],
    ['LTreasure.check', 2, L + 'treasure.js', ['D-ITEMS', 'function check(state, plan) { return null; }'], (X, s) => X.LTreasure.check(s, null), null],
    ['LRunner.check', 2, L + 'runner.js', ['D-RUNNER-EST', 'function check(state, plan) { return null; }'], (X, s) => X.LRunner.check(s, null), null],
    ['LVM4.lv7', 2, L + 'lv-m4.js', ['D-VALIDATORS', 'function lv7(state, plan) { return null; }'], (X, s) => X.LVM4.lv7(s, null), null],
    ['LVM4.lv13', 2, L + 'lv-m4.js', ['D-VALIDATORS', 'function lv13(state, plan) { return null; }'], (X, s) => X.LVM4.lv13(s, null), null],
  ];

  // Every row against the core X, its files read with read(file): the problems, as sentences.
  // A stub row is checked while its line is still in its file; the line above it must then be
  // a comment naming the package that fills it.
  function check(X, read) {
    const out = [];
    let held = 0, stubs = 0, filled = 0;
    for (const [name, n, file, stub, call, want] of ROWS) {
      const [ns, fn] = name.split('.');
      if (!X[ns] || typeof X[ns][fn] !== 'function') { out.push(`${name} is missing`); continue; }
      if (X[ns][fn].length !== n) { out.push(`${name} takes ${X[ns][fn].length} arguments, not ${n}`); continue; }
      if (!read(file).includes(fn)) out.push(`${name} is not in ${file}`);
      if (!call) continue;
      if (stub) {
        const lines = read(file).split('\n'), i = lines.findIndex(l => l.trim() === stub[1]);
        if (i < 0) { filled++; continue; }
        const above = lines[i - 1].trim();
        if (!above.startsWith('//') || !above.includes(stub[0])) out.push(`${name}: the stub "${stub[1]}" has no comment naming ${stub[0]} above it`);
        stubs++;
      }
      const s = X.TestRoom.create(1), before = json(s), ev = [];
      let got;
      try { got = call(X, s, ev); } catch (e) { out.push(`${name} threw ${e.message}`); continue; }
      if (json(got) !== json(want) || (want === undefined) !== (got === undefined)) out.push(`${name} on a fresh test room gives ${json(got)}, not ${json(want)}`);
      if (json(s) !== before) out.push(`${name} changed the test room`);
      if (ev.length) out.push(`${name} emitted ${json(ev)}`);
      held++;
    }
    return { out, held, stubs, filled };
  }

  test('every export of the skeleton has its arity, and its neutral result on a fresh test room', () => {
    const r = check(C, src);
    assert.equal(r.out.join('\n'), '');
    // A stub its package has filled keeps only its arity here, so the floors count it too.
    assert.ok(r.held + r.filled >= 60 && r.stubs + r.filled >= 20, `${r.held} neutral results held, ${r.stubs} of them stubs; ${r.filled} stubs filled`);
  });

  test('a planted change to an export\'s neutral result, its arity, its purity or its stub\'s comment is caught', () => {
    const X = loadCore();
    // A keep row (Progress.award is a stub row its package has filled, so only its arity is held).
    X.Progress.cert = function cert(state) { return { how: 'view', turn: 0 }; };
    X.Hall.inside = (state, x) => false;
    X.Perks.ringDelta = state => 1;
    X.Viewing.apply = (state, action, ev) => { state.turn = 5; return 'no_centrepiece'; };
    X.Modules.init = (state, pack, base) => {};
    X.Hall.onDefeat = (state, ev) => { ev.push({ k: 'planted' }); };
    delete X.Labels.ofSheet;
    // The first row whose stub is still in its file has its filler's name taken out of the
    // comment above it (none is left once every stub is filled).
    const stubbed = ROWS.find(([, , file, stub, call]) => stub && call && src(file).split('\n').some(l => l.trim() === stub[1]));
    const unnamed = f => {
      if (!stubbed || f !== stubbed[2]) return src(f);
      const lines = src(f).split('\n'), i = lines.findIndex(l => l.trim() === stubbed[3][1]);
      lines[i - 1] = lines[i - 1].split(stubbed[3][0]).join('NOBODY');
      return lines.join('\n');
    };
    const got = check(X, unnamed).out;
    for (const want of ['Progress.cert on a fresh test room gives {"how":"view","turn":0}, not null', 'Hall.inside takes 2 arguments, not 3', 'Perks.ringDelta on a fresh test room gives 1, not 0',
      'Viewing.apply changed the test room', 'Hall.onDefeat emitted', 'Labels.ofSheet is missing'].concat(stubbed ? [`${stubbed[0]}: the stub`] : [])) assert.ok(got.some(l => l.startsWith(want)), `not caught: ${want}\n${got.join('\n')}`);
    assert.ok(!got.some(l => l.startsWith('Modules.init')), 'a neutral replacement passes');
    // A filled stub (its line gone from its file) keeps only its arity here.
    const filled = f => f === R + 'progress.js' ? src(f).replace('function award(state, how, cause, ev) { return false; }', 'function award(state, how, cause, ev) { return grant(state, how, cause, ev); }') : src(f);
    const Y = loadCore();
    Y.Progress.award = function award(state, how, cause, ev) { return true; };
    assert.equal(check(Y, filled).out.join('\n'), '');
  });

  test('the view action is defined once, never legal yet, and refused no_centrepiece with nothing changed', () => {
    const s = C.TestRoom.create(1), h = C.State.hash(s), rng = json(s.rng);
    assert.ok(!C.Step.legal(s).some(a => a.a === 'view'));
    const ev = C.Step.step(s, { a: 'view' });
    assert.equal(json(ev.map(e => [e.k, e.reason])), json([['refused', 'no_centrepiece']]));
    assert.equal(C.State.hash(s), h); assert.equal(json(s.rng), rng);
    assert.equal(C.Causes.check(ev[0]), null);
    assert.equal(C.Text.event(ev[0]), 'There is no Centrepiece here to view.');
    assert.ok(C.Registry.REFUSALS.no_centrepiece && C.Text.refusalDefined('no_centrepiece'));
    assert.throws(() => C.Actions.define('view', { legal: () => [], candidates: () => [], apply: () => 0 }), /defined twice/);
    // While viewing is the skeleton's, a department refuses every view the same way.
    if (src(R + 'viewing.js').includes("function apply(state, action, ev) { return 'no_centrepiece'; }")) {
      const d = C.Dept.create(3, 'M11', 2);
      assert.equal(C.Step.step(d, { a: 'view' })[0].reason, 'no_centrepiece');
      assert.ok(!C.Step.legal(d).some(a => a.a === 'view'));
    }
  });

  test('the perks are dispatched to the perks you hold, by rank, in the order added, skipping one switched off', () => {
    const X = loadCore(), P = X.Perks, calls = [];
    // Once the registry has its PERKS table, a perk added must be in it: the planted ones are.
    if (X.Registry.TABLES.includes('PERKS')) {
      for (const id of ['planted_a', 'planted_b', 'planted_c', 'planted_d']) X.Registry.define('PERKS', id, { built: 'M4' });
      assert.throws(() => P.add('planted_e', {}), /not in Registry\.PERKS/);
    }
    P.add('planted_a', {
      ringDelta: (s, r) => -r, loseTrack: (s, a, r) => 3, openCost: (s, base, r) => base - 50 * r, openQuiet: () => true, lockBonus: (s, r) => r,
      padding: (s, r) => 2 * r, afterStep: (s, a, from, ev, r) => calls.push(['a', a.uid, from, r]), surprise: () => false,
      adjust: (s, action, t, ev, r) => (action.a === 'move' ? { r: 0, why: 'planted_a' } : null), charge: (s, r) => ({ left: r }),
    });
    P.add('planted_b', {
      ringDelta: (s, r) => -10 * r, loseTrack: (s, a, r) => (a === s.actors[1] ? 5 : null), openCost: (s, base, r) => base * 2, padding: (s, r) => 1,
      afterStep: (s, a, from, ev, r) => calls.push(['b', a.uid, from, r]), onLow: (s, who, before, ev, r) => calls.push(['b low', who.uid, before, r]),
      onLoseTrack: (s, a, ev, r) => { calls.push(['b search', a.uid, r]); ev.push({ k: 'planted', who: a.uid }); },
      onResolve: (s, a, tel, struck, ev, r) => calls.push(['b resolve', a.uid, tel.id, struck, r]), surprise: (s, att, def, r) => def.uid === 'x',
      adjust: (s, action, t, ev, r) => (t > 0 ? { r: t - 50, why: 'planted_b' } : null),
    });
    assert.throws(() => P.add('planted_a', {}), /twice/);
    assert.throws(() => P.add('planted_c', { ring: () => 0 }), /no hook called ring/);
    assert.throws(() => P.add('planted_c', { padding: 3 }), /not a function/);
    assert.throws(() => P.add('', {}), /string id/);
    const s = X.TestRoom.create(1), a = s.actors[1];
    // Taken b first, then a at rank 2: dispatch goes in the order added (a, then b); charges in the order taken.
    s.run.perks = [{ id: 'planted_b', rank: 1 }, { id: 'planted_a', rank: 2 }, { id: 'not_added', rank: 1 }];
    assert.equal(P.rank(s, 'planted_a'), 2); assert.equal(P.rank(s, 'planted_c'), 0); assert.equal(P.rank(s, 'not_added'), 1);
    assert.equal(P.ringDelta(s), -2 - 10);
    assert.equal(P.loseTrack(s, a), 3, 'the fewest turns any hook gives');
    assert.equal(P.loseTrack(s, s.actors[2]), 3, 'a hook that gives null says nothing');
    s.run.perks = [{ id: 'planted_b', rank: 1 }];
    assert.equal(P.loseTrack(s, a), 5, 'one hook\'s turns stand');
    assert.equal(P.loseTrack(s, s.actors[2]), C.N.LOSE_TRACK_TURNS, 'no hook said anything');
    s.run.perks = [{ id: 'planted_b', rank: 1 }, { id: 'planted_a', rank: 2 }, { id: 'not_added', rank: 1 }];
    assert.equal(P.openCost(s, 200), (200 - 100) * 2, 'chained in the order added');
    assert.equal(P.openQuiet(s), true); assert.equal(P.lockBonus(s), 2); assert.equal(P.padding(s), 5);
    const lostEv = [];
    P.afterStep(s, a, [1, 1], []); P.onLow(s, s.actors[0], 9, []); P.onResolve(s, a, { id: 'ring' }, true, []); P.onLoseTrack(s, a, lostEv);
    assert.equal(json(calls), json([['a', a.uid, [1, 1], 2], ['b', a.uid, [1, 1], 1], ['b low', 'you', 9, 1], ['b resolve', a.uid, 'ring', true, 1], ['b search', a.uid, 1]]));
    assert.equal(json(lostEv), json([{ k: 'planted', who: a.uid }]), 'a hook acting as a hunter starts to search is given the event list');
    assert.equal(P.surprise(s, s.actors[0], { uid: 'x' }), true); assert.equal(P.surprise(s, s.actors[0], a), false);
    assert.equal(json(P.adjust(s, { a: 'move', dir: 2 }, 100, [])), json({ r: 0, why: 'planted_a' }), 'b sees 0 ticks and leaves them');
    assert.equal(json(P.adjust(s, { a: 'wait' }, 100, [])), json({ r: 50, why: 'planted_b' }));
    assert.equal(json(P.charges(s)), json([{ id: 'planted_b', rank: 1, charge: null }, { id: 'planted_a', rank: 2, charge: { left: 2 } }, { id: 'not_added', rank: 1, charge: null }]));
    // Switched off for the visit (rulesOff), a perk is not asked; rank 0 is not held.
    const off = X.TestRoom.create(1); off.options.rulesOff = ['planted_a']; off.run.perks = [{ id: 'planted_a', rank: 2 }, { id: 'planted_b', rank: 0 }];
    assert.equal(P.ringDelta(off), 0); assert.equal(P.loseTrack(off, a), C.N.LOSE_TRACK_TURNS); assert.equal(P.openCost(off, 200), 200);
    assert.equal(json(P.adjust(off, { a: 'move', dir: 2 }, 100, [])), json({ r: 100, why: null }));
    // A hook that gives a cost the floor cannot read stops with an error.
    P.add('planted_d', { adjust: () => ({ r: -1, why: 'planted_d' }), loseTrack: () => 1.5 });
    off.run.perks = [{ id: 'planted_d', rank: 1 }];
    assert.throws(() => P.adjust(off, { a: 'wait' }, 100, []), /a hook gave/); assert.throws(() => P.loseTrack(off, a), /a hook gave/);
    assert.equal(json(P.HOOKS), json(['ringDelta', 'loseTrack', 'onLoseTrack', 'openCost', 'openQuiet', 'lockBonus', 'padding', 'afterStep', 'onLow', 'onResolve', 'surprise', 'adjust', 'charge']));
  });

  test('an exhibit\'s wake region is the default\'s with every hook\'s added, each tile once, in row-major order', () => {
    const X = loadCore(), R0 = X.Registry;
    R0.define('ARCHETYPES', 'planted_station', {}); R0.define('MODIFIERS', 'planted_round', {}); R0.define('MODIFIERS', 'planted_quiet', {});
    X.Archetypes.add('planted_station', { wakeRegion: (s, a, turns) => [[5, 2], [3, 2], [4, 2]].slice(0, turns) });
    X.Archetypes.addModifier('planted_round', { wakeRegion: (s, a, turns) => [[4, 2], [1, 7], [2, 1]] });
    X.Archetypes.addModifier('planted_quiet', { wakeRegion: () => null });
    const s = X.TestRoom.create(1), a = s.actors[1];
    a.arch = 'planted_station'; a.mods = ['planted_quiet', 'planted_round'];
    assert.equal(json(X.Archetypes.wakeRegion(s, a, 3)), json([[2, 1], [3, 2], [4, 2], [5, 2], [1, 7]]), 'a modifier adds to the archetype\'s, never replaces it');
    assert.equal(json(X.Archetypes.wakeRegion(s, a, 1)), json([[2, 1], [4, 2], [5, 2], [1, 7]]));
    s.options.rulesOff = ['planted_round'];
    assert.equal(json(X.Archetypes.wakeRegion(s, a, 3)), json([[3, 2], [4, 2], [5, 2]]), 'a modifier switched off adds nothing');
    // While the default is the skeleton's [] (W0d1 fills it with the ring), a hookless exhibit has none.
    if (src(R + 'archetypes.js').includes('function defaultWakeRegion(state, a, turns) { return []; }')) assert.equal(json(X.Archetypes.wakeRegion(s, s.actors[2], 3)), '[]');
  });

  test('the hall\'s checks register once each, in order; a Centrepiece\'s pieces come from dept.cp through Hall.cp', () => {
    const X = loadCore(), f = () => {}, g = () => {};
    X.Hall.addCheck('planted_one', f); X.Hall.addCheck('planted_two', g);
    assert.equal(json(X.Hall.added().map(([id, fn]) => [id, fn === f || fn === g])), json([['planted_one', true], ['planted_two', true]]));
    assert.throws(() => X.Hall.addCheck('planted_one', f), /twice/);
    assert.throws(() => X.Hall.addCheck('planted_three', null), /needs a function/);
    assert.throws(() => X.Hall.addCheck('', f), /string id/);
    const s = X.TestRoom.create(1);
    s.dept.cp = { uids: [s.actors[2].uid, 'nobody', s.actors[1].uid], room: null, openings: [], form: 'fight', sealed: null, touched: false, sheet: null, treasure: null };
    assert.equal(X.Hall.cp(s), s.dept.cp);
    assert.equal(json(X.Centrepiece.pieces(s).map(a => a.uid)), json([s.actors[2].uid, s.actors[1].uid]));
    s.actors[2].gone = 1;
    assert.equal(X.Centrepiece.pieces(s).length, 2, 'a fallen piece is still a piece');
  });

  test('Kit.start gives the starting kit at a tier, tier 1 when none is given', () => {
    const bare = () => { const s = C.TestRoom.create(1); s.items = s.items.filter(i => i.uid !== 'you.w' && i.uid !== 'you.g'); s.you.kit.weapon = s.you.kit.garment = null; return s; };
    const tiers = s => json(s.items.filter(i => i.uid === 'you.w' || i.uid === 'you.g').map(i => [i.uid, i.form, i.tier, i.where]));
    const s3 = bare(); C.Kit.start(s3, 'heavy', 3);
    assert.equal(tiers(s3), json([['you.w', 'heavy', 3, { at: 'kit', slot: 'weapon' }], ['you.g', 'standard', 3, { at: 'kit', slot: 'garment' }]]));
    const s1 = bare(); C.Kit.start(s1, 'light');
    assert.equal(tiers(s1), json([['you.w', 'light', 1, { at: 'kit', slot: 'weapon' }], ['you.g', 'standard', 1, { at: 'kit', slot: 'garment' }]]));
    const s0 = bare(); C.Kit.start(s0);
    assert.equal(tiers(s0), json([['you.w', 'balanced', 1, { at: 'kit', slot: 'weapon' }], ['you.g', 'standard', 1, { at: 'kit', slot: 'garment' }]]));
    for (const t of [0, 5, 1.5, '2']) assert.throws(() => C.Kit.start(bare(), 'balanced', t), /no tier/, String(t));
    // The highest tier is the table's (TIER_LOW_BY_DEPTH's last), not a number of its own.
    const T = coreWith('js/core/numbers.js', t => t.replace(/^(\s*TIER_LOW_BY_DEPTH: )\[[^\]]*\]/m, '$1[1, 1, 2, 2, 3, 3, 5]')), t5 = T.TestRoom.create(1);
    assert.equal(json(T.N.TIER_LOW_BY_DEPTH), json([1, 1, 2, 2, 3, 3, 5]));
    t5.items = t5.items.filter(i => i.uid !== 'you.w' && i.uid !== 'you.g'); t5.you.kit.weapon = t5.you.kit.garment = null;
    T.Kit.start(t5, 'balanced', 5);
    assert.equal(tiers(t5), json([['you.w', 'balanced', 5, { at: 'kit', slot: 'weapon' }], ['you.g', 'standard', 5, { at: 'kit', slot: 'garment' }]]));
    assert.throws(() => C.Kit.start(s0, 'balanced', 1), /already/);
    // A room, and a department at depth 1, start as before: tier 1.
    for (const s of [C.TestRoom.create(2), C.Dept.create(2, 'S9', 1)]) assert.equal(tiers(s), json([['you.w', 'balanced', 1, { at: 'kit', slot: 'weapon' }], ['you.g', 'standard', 1, { at: 'kit', slot: 'garment' }]]));
  });

  test('plan.intro\'s shape: LStamp.shape passes the shape and null, and names the first thing wrong', () => {
    const good = () => ({ x0: 1, y0: 3, x1: 14, y1: 9, cut: [[7, 6]], marks: [{ ch: 'a', x: 9, y: 4 }, { ch: 'b', x: 11, y: 8 }], openings: [[13, 2], [15, 7]] });
    assert.equal(C.LStamp.shape(good()), null);
    assert.equal(C.LStamp.shape(null), null);
    const bad = [
      [i => undefined, /not an object/],
      [i => { delete i.cut; return i; }, /has the fields/],
      [i => Object.assign(i, { extra: 1 }), /has the fields/],
      [i => Object.assign(i, { x1: 0 }), /rectangle/],
      [i => Object.assign(i, { cut: [] }), /cut is empty/],
      [i => Object.assign(i, { cut: [[0, 6]] }), /cut\[0\].*not inside/],
      [i => Object.assign(i, { cut: [[7, 6.5]] }), /not a tile/],
      [i => Object.assign(i, { marks: [{ ch: 'ab', x: 9, y: 4 }] }), /one letter/],
      [i => Object.assign(i, { marks: [{ ch: 'a', x: 9 }] }), /not \{ch, x, y\}/],
      [i => Object.assign(i, { marks: [{ ch: 'b', x: 11, y: 8 }, { ch: 'a', x: 9, y: 4 }] }), /row-major/],
      [i => Object.assign(i, { openings: [[13, 2], [13, 2]] }), /row-major order, with no tile twice/],
      [i => Object.assign(i, { openings: [[10, 5]] }), /not on the wall ring/],
      [i => Object.assign(i, { openings: [[17, 7]] }), /not on the wall ring/],
      [i => Object.assign(i, { openings: 'none' }), /not a list/],
    ];
    for (const [plant, want] of bad) {
      const got = C.LStamp.shape(plant(good()));
      assert.ok(typeof got === 'string' && want.test(got), `${plant}: ${got}`);
    }
  });

  // Every file A15 adds, in index.html; and the order each needs to register where it must.
  const NEW = [
    ...['progress', 'perks', 'hall', 'centrepiece', 'viewing', 'fixtures', 'treasure'].map(f => `${R}${f}.js`),
    ...['soft_soles', 'vanishing_act', 'light_fingers', 'single_file', 'elbow_room', 'close_the_distance', 'duck_and_cover', 'second_wind'].map(f => `${R}perks/${f}.js`),
    ...['unobserved_motion', 'alarm_network', 'copies_weaken', 'hourly_demonstration', 'weather_cases'].map(f => `${R}modules/${f}.js`),
    ...['unobserved_mover', 'patrol_guard', 'demonstrator', 'conservator_healer', 'completing_guardian', 'mp_ensemble', 'mp_tableau'].map(f => `${R}arch/${f}.js`),
    `${R}mods/clockwork.js`, 'js/core/populate.js', 'js/core/panels.js',
    ...['stamp', 'lv6', 'runner', 'lv-m4', 'treasure'].map(f => `${L}${f}.js`),
    ...['mod-unobserved', 'mod-alarm', 'mod-copies', 'mod-chime', 'mod-weather', 'arch-d', 'centrepiece', 'cp-guardian', 'cp-ensemble', 'cp-tableau', 'hall', 'progress',
      'perks', 'perks-a', 'perks-b', 'perks-timing', 'perk-status', 'viewing', 'panels'].flatMap(f => [`js/core/reg/${f}.js`, `js/core/text/${f}.js`]),
    ...['S9', 'A4', 'M11'].flatMap(acc => ['intro', 'cp', 'panels'].map(p => `content/${acc}-${p}.js`)),
  ];
  test('every file M4 adds is listed in index.html, each after what it registers with', () => {
    const order = [...src('index.html').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]), at = f => order.indexOf(f);
    assert.equal(NEW.length, 82);
    for (const f of NEW) { assert.ok(fs.existsSync(path.join(root, f)), `${f} is on disk`); assert.ok(at(f) >= 0, `${f} is in index.html`); }
    const before = (a, bs, why) => { for (const b of bs) assert.ok(at(a) >= 0 && at(a) < at(b), `${a} loads before ${b} (${why})`); };
    const under = dir => NEW.filter(f => f.startsWith(dir));
    before('js/core/rules/fixtures.js', ['js/core/rules/consumables.js', `${R}viewing.js`, 'js/core/panels.js'], 'Fixtures.addReader');
    before('js/core/rules/actions.js', [`${R}viewing.js`, `${R}hall.js`, `${R}treasure.js`, `${R}progress.js`], 'Actions.define, addRefuser, defineChoice');
    before(`${R}perks.js`, under(`${R}perks/`), 'Perks.add');
    before(`${R}modules.js`, under(`${R}modules/`), 'Modules.define');
    before(`${R}archetypes.js`, under(`${R}arch/`).concat([`${R}mods/clockwork.js`]), 'Archetypes.add');
    before(`${R}hall.js`, [`${R}treasure.js`, `${R}arch/completing_guardian.js`, `${R}arch/mp_ensemble.js`, `${R}arch/mp_tableau.js`], 'Hall.addCheck');
    // M4's rule files load after every M3 system, so each may register with any of them as it
    // loads (Specials.addShape for the cp_ shapes, Actions.addRefuser, Fixtures.addReader).
    const m3Systems = ['actors', 'noise', 'surfaces', 'wake', 'combat', 'ranged', 'specials', 'health', 'cases', 'kit', 'consumables', 'doors', 'ai'].map(f => `${R}${f}.js`);
    for (const f of [`${R}hall.js`, `${R}centrepiece.js`, `${R}progress.js`, `${R}viewing.js`, `${R}treasure.js`].concat(under(`${R}arch/`), under(`${R}modules/`), under(`${R}perks/`), [`${R}mods/clockwork.js`])) {
      for (const sys of m3Systems) before(sys, [f], 'an M3 system before the M4 rule that may register with it');
    }
    before(`${R}status.js`, ['js/core/reg/perk-status.js'], 'Status.define');
    before('js/core/populate.js', [`${L}lv6.js`, `${L}treasure.js`, `${L}runner.js`, `${L}lv-m4.js`], 'Populate.addValidator');
    // The validators register in the order A10 runs them: LV6, the treasure case, LV11, then LV7 and LV13.
    before(`${L}lv6.js`, [`${L}treasure.js`], 'validator order'); before(`${L}treasure.js`, [`${L}runner.js`], 'validator order'); before(`${L}runner.js`, [`${L}lv-m4.js`], 'validator order');
    // Each registry fragment before the rule files it names; each sentence fragment after text.js.
    before('js/core/reg/mod-unobserved.js', [`${R}arch/unobserved_mover.js`], 'Registry.ARCHETYPES');
    before('js/core/reg/arch-d.js', [`${R}arch/conservator_healer.js`, `${R}mods/clockwork.js`], 'Registry');
    for (const f of NEW.filter(n => n.startsWith('js/core/text/'))) before('js/core/text.js', [f], 'Text.define');
    // A pack's parts after the pack, and before the Orientation, which reads M.11's pack.
    for (const acc of ['S9', 'A4', 'M11']) before(`content/${acc}.js`, ['intro', 'cp', 'panels'].map(p => `content/${acc}-${p}.js`), 'Packs.part');
    before('content/M11-panels.js', ['content/orientation.js'], 'the Orientation reads the merged pack');
    // Close the Distance is added before Duck and Cover, so Perks.adjust lets a step made free stay free before a discount is asked.
    before(`${R}perks/close_the_distance.js`, [`${R}perks/duck_and_cover.js`], 'Perks.adjust order');
  });

  // The numbers of record M4 adds (plan A12), with the Intro's width from the layout spike and
  // two numbers the plan's text names: each in numbers.js and in BUILD.md §8.10 with a meaning
  // (their values are the lint's to compare, and a tune's to move).
  const NUMBERS = ['SAFE_ZONE', 'SAFE_ZONE_TURNS', 'INTRO_DEPTH', 'INTRO_WIDTH', 'RUNNER_PASS_PCT', 'RUNNER_MOVES', 'RUNNER_TOGETHER_TURNS', 'DEAD_END_REWARD',
    'LAMP_CASE_MIN_WALK', 'WEATHER_SIZE', 'WEATHER_FOG_PCT', 'CP_PHASE_PCT', 'CP_SPECIAL_EVERY', 'CP_SUMMON', 'CP_SUMMON_DMG_PCT', 'CHARGE_RANGE',
    'GUARDIAN_PER_STAGE', 'GUARDIAN_STAGE_MAX', 'GUARDIAN_LEAVE_HEAL_PCT', 'ENSEMBLE_PIECES', 'ENSEMBLE_HOOK_PCT', 'CONSERVATOR_HEAL_PCT', 'CONSERVATOR_KEEP',
    'PERK_SOFT_SOLES', 'PERK_CLOSE_STEPS', 'PERK_ELBOW_ROOM_ADJACENT', 'PERK_LIGHT_FINGERS_ABOVE', 'PERK_OFFER', 'STAGGER_TURNS'];
  test('every M4 number of record is in numbers.js and in BUILD.md §8.10 with a meaning, and the numbers lint passes both ways', () => {
    const md = src('BUILD.md'), a = md.indexOf('<!-- numbers:begin -->'), b = md.indexOf('<!-- numbers:end -->'), rows = md.slice(a, b).split('\n');
    for (const k of NUMBERS) {
      assert.ok(Object.prototype.hasOwnProperty.call(C.N, k), `${k} is in numbers.js`);
      const row = rows.find(l => l.startsWith(`| ${k} |`));
      assert.ok(row && row.split('|')[3].trim().length > 0, `${k} has a meaning in BUILD.md §8.10`);
    }
    // Readings checked against the design in review: a summon makes 1–2 bodies (design/samples.md,
    // the Great Board and the Ordinance; design/vocabulary.md's summon), so CP_SUMMON's two values
    // are the fewest and the most, not two phases; Light Fingers' rank 2 opens case locks, never
    // a staff door (plan PR7).
    const meaningOf = k => rows.find(l => l.startsWith(`| ${k} |`)).split('|')[3].trim();
    assert.match(meaningOf('CP_SUMMON'), /fewest and most/); assert.doesNotMatch(meaningOf('CP_SUMMON'), /phase/);
    assert.match(meaningOf('PERK_LIGHT_FINGERS_ABOVE'), /case locks/);
    const r = spawnSync(process.execPath, [path.join(root, 'tools/lint-numbers.js')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout);
  });
};
