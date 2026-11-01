// M4 W0e: the module dispatcher (BUILD.md §5.4; M4 plan A7). Shown here with planted modules,
// each in a fresh core, standing in for the five modules their packages fill:
//   - Modules.define: the form and what it refuses (an unknown effect above all);
//   - a visit's modules: Modules.init in pack order, a module not yet defined left absent
//     (so every department today is as it was), switched off by rulesOff yet still made
//     (its init runs, to make its draws), on, active, of, flagged; offFor (§8.9, M5's);
//   - dispatch order: modules in pack order, rules in the order written, targets in who's
//     order, each rule's module event before its effects' events;
//   - each effect of the closed table through the core rule that owns it, joined up where it
//     is a rule of play (the clock through W0d1's ClockRules.advance, the special through
//     W0d2's Specials.addShape and its due lines, with every invariant on and a clone checked);
//     an effect that cannot act throws rather than leave its event to claim it; a module's
//     special is a due line its threat warns of, a move opens a closed door as its step, a
//     wake never takes a Centrepiece's piece, no rule acts on you, nor on your death or leaving;
//   - re-entry: an event a rule makes reaches other rules, to two deep; the third throws;
//   - streams: a module draws on module/<id>/<acc>/d<depth> only, and switching another off
//     moves nothing of its draws;
//   - the hooks the core asks (pipsDecay, mayReturn, threat, alarmDecay, turn), with
//     Specials.resolveDue first at step 8 and nothing acting once the visit is over;
//   - Modules.threat's marks checked, and warned of by Specials.threat;
//   - the validation log (Modules.bespoke, Modules.form).
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore(), N = C.N, TPT = N.TICKS_PER_TURN;
  const json = JSON.stringify;
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const BODY = { hp: 40, acc: 3, eva: 0, pad: 0, dmin: 4, dmax: 9 };
  const wait = { a: 'wait' };
  const violations = r => r.violations.map(v => v.text || v.message || json(v));

  // A planted module in core X: its registry entry, its event's cause and sentence, and
  // causes for the events its effects make (status, surface, stage, alarm, pip), each told
  // in words; then Modules.define with the form given.
  function plant(X, id, form, entry) {
    const R = X.Registry;
    R.define('MODULES', id, Object.assign({ built: 'M4', sentence: `The planted rule ${id.replace(/_/g, ' ')} acts.` }, entry || {}));
    R.defineCause('module', id, { fields: { by: 'uid?' }, built: 'M4' });
    X.Text.defineCause('module', id, (e, w) => `${e.who ? w.Name(e.who) + ': ' : ''}the planted rule ${e.rule.replace(/_/g, ' ')} acted.`);
    for (const k of ['status', 'surface', 'stage', 'alarm', 'pip']) {
      R.defineCause(k, id, { fields: {}, built: 'M4' });
      X.Text.defineCause(k, id, () => `A planted ${k} came about.`);
    }
    X.Modules.define(id, form);
  }
  function room(X, exhibits, more) {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: exhibits || [] }, more || {}));
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  }
  const pack = (...mods) => ({ acc: 'T0', species: [], modules: mods.map(m => typeof m === 'string' ? { id: m, role: null, params: {} } : m) });
  const mods = (ev, id) => ev.filter(e => e.k === 'module' && (!id || e.id === id)).map(e => `${e.id}.${e.rule}${e.who ? '@' + e.who : ''}`);
  const flag = (name, value) => ({ k: 'flag', name, value });

  // ---- The form ----
  test('Modules.define refuses what is not the form: an unknown module, effect, part or kind, a rule with no name or listening to module events, a hook not named bespoke, the registry\'s words given twice', () => {
    const X = loadCore(), M = X.Modules, R = X.Registry;
    // The slice's modules their own files have defined so far (alarm_network, MOD-ALARM;
    // hourly_demonstration, MOD-CHIME).
    const real = M.defined(), realBespoke = M.bespoke();
    R.define('MODULES', 'planted_m', { built: 'M4', sentence: 'A planted rule.' });
    const ok = { rule: 'r', on: 'waited', do: [flag('n', 1)] };
    const refused = [
      [{ rules: [ok] }, /not in Registry\.MODULES/, 'planted_none'],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'teleport' }] })] }, /"teleport" is not an effect/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'status', id: 'slowed', turns: 2, who: 1 }] })] }, /the status effect has no part who/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'status', id: 'slowed' }] })] }, /the status effect needs turns/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'status', id: 'planted', turns: 2 }] })] }, /there is no status planted/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'special', sp: 'planted', due: 300 }] })], bespoke: ['threat'], threat: () => [] }, /there is no special planted/],
      // A module's special is a due line, warned of through its threat: without either, refused.
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'special', sp: 'line' }] })], bespoke: ['threat'], threat: () => [] }, /the special effect needs due/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'special', sp: 'line', due: 300 }] })] }, /r marks a special, a due line, so it must give threat/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'surface', kind: 'planted', size: 1, turns: 1 }] })] }, /there is no surface planted/],
      [{ rules: [Object.assign({}, ok, { do: [{ k: 'wake', mode: 'searching', cause: { k: 'alarm' } }] })] }, /a wake is into awake or hunting/],
      [{ rules: [Object.assign({}, ok, { do: [flag('since', 1)] })] }, /not one a module may set/],
      [{ rules: [Object.assign({}, ok, { do: [] })] }, /do lists no effect/],
      [{ rules: [Object.assign({}, ok, { rule: undefined })] }, /a rule needs a name/],
      [{ rules: [ok, ok] }, /written twice/],
      [{ rules: [Object.assign({}, ok, { on: 'module' })] }, /no rule acts on a module event/],
      [{ rules: [Object.assign({}, ok, { on: 'planted' })] }, /is not an event kind, 'turn' or 'period'/],
      [{ rules: [Object.assign({}, ok, { on: 'period' })] }, /a period needs every/],
      [{ rules: [Object.assign({}, ok, { on: 'period', every: 3, at: 3 })] }, /is not a place in its period/],
      [{ rules: [Object.assign({}, ok, { every: 3 })] }, /only a period rule has every and at/],
      [{ rules: [Object.assign({}, ok, { reach: 3 })] }, /unknown part reach/],
      [{ rules: [Object.assign({}, ok, { when: true })] }, /when is not a function/],
      [{ rules: [Object.assign({}, ok, { telegraph: { turns: 0, shown: 'r' } })] }, /a telegraph is \{turns, shown\}/],
      [{ rules: [Object.assign({}, ok, { telegraph: { turns: 1, shown: 'planted' } })] }, /neither one of its rules nor a special/],
      [{ rules: [ok], pipsDecay: () => true }, /bespoke list must name it/],
      [{ rules: [ok], bespoke: 'pipsDecay' }, /not a list of names/],
      // The bespoke list is the validation log's: it names no hook the module does not give.
      [{ rules: [ok], bespoke: ['mayReturn'] }, /names mayReturn, which it does not give/],
      [{ rules: [ok], sentence: 'A planted rule.' }, /is its registry entry's/],
      [{ rules: [ok], params: {} }, /is its registry entry's/],
      [{ rules: [ok], reach: 3 }, /unknown part reach/],
    ];
    for (const [form, why, id] of refused) assert.throws(() => M.define(id || 'planted_m', form), why, json(form));
    assert.equal(json(M.defined()), json(real), 'nothing refused was defined');
    M.define('planted_m', { rules: [ok, Object.assign({}, ok, { rule: 'shown', telegraph: { turns: 1, shown: 'r' } })], bespoke: ['pipsDecay', 'the gate'], pipsDecay: () => true });
    assert.throws(() => M.define('planted_m', { rules: [ok] }), /defined twice/);
    assert.equal(json([M.defined(), M.defined('planted_m'), M.defined('planted_none')]), json([real.concat(['planted_m']), true, false]));
    assert.equal(json(M.bespoke()), json(realBespoke.concat([{ id: 'planted_m', bespoke: ['pipsDecay', 'the gate'] }])));
    assert.equal(json(M.form('planted_m')), json({ rules: [{ rule: 'r', on: 'waited', do: ['flag'], telegraph: null }, { rule: 'shown', on: 'waited', do: ['flag'], telegraph: { turns: 1, shown: 'r' } }], bespoke: ['pipsDecay', 'the gate'] }));
    assert.equal(M.form('unobserved_motion'), null);
    assert.equal(json(M.EFFECTS), json(['status', 'surface', 'wake', 'pips', 'move', 'special', 'alarm', 'clock', 'tier', 'flag']), 'the closed table of §5.4');
  });

  // ---- A visit's modules ----
  test('Modules.init: the pack\'s modules in pack order, each {id, role, on, since, params} and then its init; one not yet defined is absent; one switched off is made, off, its init run', () => {
    const X = loadCore(), M = X.Modules, seen = [];
    for (const id of ['planted_a', 'planted_b']) plant(X, id, { rules: [], init: (state, p, m) => seen.push([m.id, m.on, p.acc, X.Modules.rng(state, m.id).int(1, 1000)]) });
    const P = pack('planted_b', { id: 'planted_absent', role: 'secondary', params: {} }, { id: 'planted_a', role: 'secondary', params: { share: 30 } });
    X.Registry.define('MODULES', 'planted_absent', { built: 'M4', sentence: 'Not built.' });
    const s = room(X, [], {});
    M.init(s, P);
    assert.equal(json(s.dept.modules), json([{ id: 'planted_b', role: null, on: true, since: 0, params: {} }, { id: 'planted_a', role: 'secondary', on: true, since: 0, params: { share: 30 } }]));
    assert.equal(json(seen.map(x => x.slice(0, 3))), json([['planted_b', true, 'T0'], ['planted_a', true, 'T0']]));
    assert.equal(json([M.on(s, 'planted_a'), M.on(s, 'planted_absent'), M.on(s, 'unobserved_motion'), M.active(s)]), json([true, false, false, ['planted_b', 'planted_a']]));
    assert.equal(M.of(s, 'planted_a').params.share, 30);
    assert.throws(() => M.init(s, P), /already in the visit/);
    // Switched off, it is made all the same, with on false, and its init makes the same draws.
    const t = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [] }, { rulesOff: ['planted_a'] });
    seen.length = 0;
    M.init(t, P);
    assert.equal(json(t.dept.modules.map(m => [m.id, m.on])), json([['planted_b', true], ['planted_a', false]]));
    assert.equal(json([M.on(t, 'planted_a'), M.active(t)]), json([false, ['planted_b']]));
    assert.equal(seen.length, 2, 'its init ran');
  });

  test('every department is as it was while its modules are not defined: dept.modules holds only those defined, in pack order, off under rulesOff', () => {
    // Defined by their files so far: those of the slice's modules whose packages have built them.
    for (const acc of ['S9', 'A4', 'M11']) {
      const d = C.Dept.create(4, acc, 3), want = C.Packs.get(acc).modules.filter(m => C.Modules.defined(m.id)).map(m => ({ id: m.id, role: m.role, on: true, since: 0, params: m.params || {} }));
      assert.equal(json(d.dept.modules), json(want), acc);
    }
    const X = loadCore(), inits = [];
    for (const id of ['alarm_network', 'unobserved_motion']) if (!X.Modules.defined(id)) X.Modules.define(id, { init: (state, p, m) => inits.push([m.id, m.on]) });
    const d = X.Dept.create(4, 'S9', 3), o = X.Dept.create(4, 'S9', 3, { rulesOff: ['alarm_network'] });
    assert.equal(json(d.dept.modules), json([{ id: 'unobserved_motion', role: 'signature', on: true, since: 0, params: {} }, { id: 'alarm_network', role: 'secondary', on: true, since: 0, params: {} }]));
    assert.equal(json(o.dept.modules.map(m => [m.id, m.on])), json([['unobserved_motion', true], ['alarm_network', false]]));
    assert.ok(inits.length >= 2, 'each attempt\'s modules are made');
    // flagged: on, and the actor's species flagged with it (S9.1, the Grazer, with unobserved_motion).
    const s = X.Setup.room(1, { acc: 'S9', depth: 2, map: OPEN, you: [2, 3], exhibits: [{ sp: 'S9.1', at: [6, 3], mode: 'dormant', stats: BODY }, { sp: 'S9.3', at: [8, 3], mode: 'dormant', stats: BODY }] });
    assert.equal(X.Modules.flagged(s, s.actors[1], 'unobserved_motion'), false, 'not in the visit');
    X.Modules.init(s, X.Packs.get('S9'));
    assert.equal(json([X.Modules.flagged(s, s.actors[1], 'unobserved_motion'), X.Modules.flagged(s, s.actors[2], 'unobserved_motion'), X.Modules.flagged(s, s.actors[1], 'alarm_network')]), json([true, false, false]));
  });

  test('Modules.offFor (§8.9, for M5): with no module of the pack met and two of them, every one but the signature is off', () => {
    const M = C.Modules;
    const two = { modules: [{ id: 'a', role: 'secondary' }, { id: 'b', role: 'signature' }] };
    assert.equal(json(M.offFor(two, [])), json(['a']));
    assert.equal(json(M.offFor(two, ['b'])), '[]');
    assert.equal(json(M.offFor(two, ['a'])), '[]');
    assert.equal(json(M.offFor({ modules: [{ id: 'a' }, { id: 'b' }] }, null)), json(['b']), 'with no roles, the first is the signature');
    assert.equal(json(M.offFor({ modules: [{ id: 'a', role: 'signature' }] }, [])), '[]');
    assert.equal(json(M.offFor(C.Packs.get('S9'), [])), json(['alarm_network']));
    assert.equal(json(M.offFor(C.Packs.get('A4'), [])), '[]');
  });

  // ---- Dispatch ----
  test('dispatch order: modules in pack order, rules in the order written, targets in who\'s order; each rule\'s module event comes before its effects\' events, and a switched-off module does nothing', () => {
    const X = loadCore();
    const both = s => s.actors.filter(a => a.uid !== 'you');
    plant(X, 'planted_a', { rules: [
      { rule: 'first', on: 'waited', who: both, do: [{ k: 'status', id: 'slowed', turns: 2 }] },
      { rule: 'second', on: 'waited', do: [flag('seen', 1)] },
    ] });
    plant(X, 'planted_b', { rules: [{ rule: 'only', on: 'waited', who: s => both(s).reverse(), when: (state, e, m, a) => a.uid.endsWith('.1'), do: [flag('seen', 2)] }] });
    const ex = [{ sp: 'dummy', at: [6, 3], mode: 'dormant', stats: BODY }, { sp: 'dummy', at: [8, 3], mode: 'dormant', stats: BODY }];
    const s = room(X, ex);
    X.Modules.init(s, pack('planted_b', 'planted_a'));
    const ev = X.Step.step(s, wait);
    const order = ev.filter(e => e.k === 'waited' || e.k === 'module' || (e.k === 'status' && e.on)).map(e => e.k === 'module' ? `${e.id}.${e.rule}@${e.who || '-'}` : e.k === 'status' ? `status@${e.who}` : e.k);
    assert.equal(json(order), json(['waited', 'planted_b.only@T0.1.room.1', 'planted_a.first@T0.1.room.1', 'status@T0.1.room.1', 'planted_a.first@T0.1.room.2', 'status@T0.1.room.2', 'planted_a.second@-']));
    for (const e of ev.filter(e => e.k === 'module')) assert.equal(json(e.cause), json({ k: e.id }));
    assert.equal(json([X.Modules.of(s, 'planted_a').seen, X.Modules.of(s, 'planted_b').seen]), json([1, 2]));
    // Off, through rulesOff: nothing of it acts.
    const u = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: ex }, { rulesOff: ['planted_a'] });
    X.Modules.init(u, pack('planted_b', 'planted_a'));
    assert.equal(json(mods(X.Step.step(u, wait))), json(['planted_b.only@T0.1.room.1']));
  });

  // ---- The effects ----
  test('the status, tier and flag effects, and an effect that cannot act (an immune exhibit, a rule with no exhibit) throwing rather than leaving its event to claim it', () => {
    const X = loadCore();
    X.Registry.define('ARCHETYPES', 'planted_immune', { special: null });
    X.Archetypes.add('planted_immune', { immune: () => true });
    plant(X, 'planted_tier', { rules: [{ rule: 'weaken', on: 'waited', who: s => s.actors.slice(1), when: (state, e, m, a) => a.arch !== 'planted_immune',
      do: [{ k: 'tier', pct: 33, acc: 2 }, { k: 'status', id: 'slowed', turns: 2 }, flag('last', (state, e, m, a) => a.uid)] }] });
    const s = room(X, [
      { sp: 'dummy', at: [6, 3], mode: 'dormant', stats: { hp: 30, acc: 3, eva: 0, pad: 0, dmin: 4, dmax: 9 }, maxHp: 40 },
      { sp: 'dummy', at: [8, 3], mode: 'dormant', stats: { hp: 1, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 2 } },
      { sp: 'dummy', at: [8, 5], mode: 'dormant', arch: 'planted_immune', stats: BODY }]);
    X.Modules.init(s, pack('planted_tier'));
    const r = H.play(X, s, [wait], { inv: 'all', clone: true });
    assert.equal(json(violations(r)), '[]');
    const [, a, b] = s.actors;
    // max(1, pct(v, 33)) off each, never below 1; one at 1 keeps it.
    assert.equal(json([a.maxHp, a.hp, a.dmin, a.dmax, a.acc]), json([40 - 13, 30 - 9, 4 - 1, 9 - 2, 1]));
    assert.equal(json([b.maxHp, b.hp, b.dmin, b.dmax, b.acc]), json([1, 1, 1, 1, -2]));
    assert.ok(a.statuses.some(st => st.id === 'slowed' && st.until === 3) && b.statuses.some(st => st.id === 'slowed' && st.until === 3));
    assert.equal(X.Modules.of(s, 'planted_tier').last, b.uid);
    // For the rest of the visit ('perm', §5.4's "slowed for the rest of the visit").
    const P = loadCore();
    plant(P, 'planted_perm', { rules: [{ rule: 'weaken', on: 'waited', who: st => st.actors.slice(1), do: [{ k: 'status', id: 'slowed', turns: 'perm' }] }] });
    const p = P.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [{ sp: 'dummy', at: [6, 3], mode: 'dormant', stats: BODY }] });
    P.Modules.init(p, pack('planted_perm'));
    const pe = P.Step.step(p, wait).find(e => e.k === 'status');
    assert.equal(json([pe.who, pe.id, pe.on, pe.turns, pe.cause]), json([p.actors[1].uid, 'slowed', true, null, { k: 'planted_perm' }]));
    assert.equal(json(p.actors[1].statuses.map(st => [st.id, st.perm, st.until])), json([['slowed', true, null]]));
    // Asked to slow the immune one, the rule cannot act: it throws, and names why.
    const Y = loadCore();
    Y.Registry.define('ARCHETYPES', 'planted_immune', { special: null });
    Y.Archetypes.add('planted_immune', { immune: () => true });
    plant(Y, 'planted_tier', { rules: [{ rule: 'weaken', on: 'waited', who: st => st.actors.slice(1), do: [{ k: 'status', id: 'dazed', turns: 2 }] }] });
    const u = Y.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [{ sp: 'dummy', at: [8, 5], mode: 'dormant', arch: 'planted_immune', stats: BODY }] });
    Y.Modules.init(u, pack('planted_tier'));
    assert.throws(() => Y.Step.step(u, wait), /immune to dazed/);
    const Z = loadCore();
    plant(Z, 'planted_tier', { rules: [{ rule: 'weaken', on: 'waited', do: [{ k: 'tier', pct: 33, acc: 0 }] }] });
    const z = room(Z, []);
    Z.Modules.init(z, pack('planted_tier'));
    assert.throws(() => Z.Step.step(z, wait), /acts on an exhibit, and the rule has none/);
    const F = loadCore();
    plant(F, 'planted_flag', { rules: [{ rule: 'f', on: 'waited', do: [flag('bad', () => () => 1)] }] });
    const f = room(F, []);
    F.Modules.init(f, pack('planted_flag'));
    assert.throws(() => F.Step.step(f, wait), /not plain data/);
  });

  test('the wake, pips and surface effects: a sleeper woken awake toward a tile, a pip with its cause, a surface laid; one not asleep throws', () => {
    const X = loadCore();
    const sleepers = s => s.actors.filter(a => a.uid !== 'you' && a.mode === 'dormant');
    plant(X, 'planted_call', { rules: [
      { rule: 'stir', on: 'waited', who: sleepers, when: (state, e, m, a) => a.uid.endsWith('.2'), do: [{ k: 'pips', n: 1, cause: { k: 'planted_call' } }] },
      { rule: 'call', on: 'waited', who: sleepers, when: (state, e, m, a) => a.uid.endsWith('.1'), fields: (state) => ({ n: 1, at: [state.actors[0].x, state.actors[0].y] }),
        do: [{ k: 'wake', mode: 'awake', cause: (state, e, m, a) => ({ k: 'alarm', by: a.uid }), target: state => [state.actors[0].x, state.actors[0].y] },
          { k: 'surface', kind: 'dust', size: 3, turns: 2 }] },
    ] });
    const s = room(X, [{ sp: 'dummy', at: [6, 3], mode: 'dormant', stats: BODY }, { sp: 'dummy', at: [8, 3], mode: 'dormant', stats: BODY }]);
    X.Modules.init(s, pack('planted_call'));
    const r = H.play(X, s, [wait], { inv: 'all', clone: true });
    assert.equal(json(violations(r)), '[]');
    const [, a, b] = s.actors, ev = r.events;
    assert.equal(json([a.mode, a.target, a.woke.cause.k, b.mode, b.pips]), json(['awake', [2, 3], 'alarm', 'dormant', 1]));
    const call = ev.find(e => e.k === 'module' && e.rule === 'call');
    assert.equal(json([call.n, call.at]), json([1, [2, 3]]));
    const laid = ev.find(e => e.k === 'surface');
    assert.equal(json([laid.kind, laid.x, laid.y, laid.size, laid.turns, laid.cause.k]), json(['dust', 6, 3, 3, 2, 'planted_call']));
    assert.equal(s.dept.surfaces[0].by, a.uid, 'laid by the exhibit it acted on');
    const pip = ev.find(e => e.k === 'pip' && e.who === b.uid);
    assert.equal(json([pip.pips, pip.cause]), json([1, { k: 'planted_call' }]));
    // A wake of one already awake cannot act: it throws.
    const Y = loadCore();
    plant(Y, 'planted_call', { rules: [{ rule: 'call', on: 'waited', who: st => st.actors.slice(1), do: [{ k: 'wake', mode: 'awake', cause: { k: 'alarm' } }] }] });
    const u = Y.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [{ sp: 'dummy', at: [8, 5], mode: 'awake', stats: BODY }] });
    Y.Modules.init(u, pack('planted_call'));
    assert.throws(() => Y.Step.step(u, wait), /is not asleep/);
  });

  test('the move effect: one step toward its goal as an exhibit steps, its ties on the module\'s own stream, costing the exhibit nothing; with no step to take it throws', () => {
    const run = rulesOff => {
      const X = loadCore();
      plant(X, 'planted_move', { rules: [{ rule: 'drift', on: 'turn', who: s => s.actors.slice(1), when: (state, e, m, a) => a.x < 9, do: [{ k: 'move', to: [10, 1] }] }] });
      plant(X, 'planted_other', { rules: [{ rule: 'draw', on: 'turn', do: [flag('n', state => X.Modules.rng(state, 'planted_other').int(1, 100))] }] });
      const s = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 5], exhibits: [{ sp: 'dummy', at: [3, 5], mode: 'awake', stats: BODY, next: 100000 }] }, { rulesOff });
      X.Modules.init(s, pack('planted_other', 'planted_move'));
      const r = H.play(X, s, Array(5).fill(wait), { inv: 'all', clone: true });
      return { X, s, r };
    };
    const { s, r } = run([]);
    assert.equal(json(violations(r)), '[]');
    const a = s.actors[1], steps = r.events.filter(e => e.k === 'moved' && e.who === a.uid);
    assert.equal(steps.length, 5, 'one step each turn');
    assert.equal(json([a.x, a.next]), json([8, 100000]), 'it walked toward the goal, and its own time is untouched');
    assert.ok(Object.keys(s.rng).includes('module/planted_move/T0/d1'), 'the ties were drawn on the module\'s stream');
    assert.ok(!Object.keys(s.rng).some(k => k.startsWith('ai/')), 'and never on the exhibit\'s');
    // Switching the other module off moves nothing of this one's draws: the same walk.
    const off = run(['planted_other']);
    assert.equal(json(off.r.events.filter(e => e.k === 'moved').map(e => e.to)), json(steps.map(e => e.to)));
    assert.equal(off.s.rng['module/planted_move/T0/d1'], s.rng['module/planted_move/T0/d1']);
    assert.equal(off.s.rng['module/planted_other/T0/d1'], undefined, 'and the one switched off drew nothing');
    // Boxed in, it has no step: the effect throws.
    const Y = loadCore();
    plant(Y, 'planted_move', { rules: [{ rule: 'drift', on: 'turn', who: st => st.actors.slice(1), do: [{ k: 'move', to: [10, 1] }] }] });
    const u = Y.Setup.room(1, { acc: 'T0', depth: 1, map: ['#####', '#...#', '#####'], you: [1, 1], exhibits: [{ sp: 'dummy', at: [3, 1], mode: 'awake', stats: BODY, next: 100000 }] });
    Y.Modules.init(u, pack('planted_move'));
    assert.throws(() => Y.Step.step(u, wait), /goal \[10,1\] is not a tile|has no step toward/);
  });

  test('the move effect at a closed door: opening it is the step, as any exhibit\'s (§8.2), and the next walks through; every invariant on', () => {
    const X = loadCore();
    plant(X, 'planted_move', { rules: [{ rule: 'drift', on: 'turn', who: s => s.actors.slice(1), do: [{ k: 'move', to: [9, 1] }] }] });
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map: ['###########', '#....+....#', '###########'], you: [1, 1], exhibits: [{ sp: 'dummy', at: [4, 1], mode: 'awake', stats: BODY, next: 100000 }] });
    X.Modules.init(s, pack('planted_move'));
    const r = H.play(X, s, [wait, wait, wait], { inv: 'all', clone: true });
    assert.equal(json(violations(r)), '[]');
    const a = s.actors[1], did = r.steps.map(st => st.events.filter(e => (e.k === 'opened' || e.k === 'moved') && e.who === a.uid).map(e => e.k === 'opened' ? `opened ${e.x},${e.y}` : `moved to ${e.to}`));
    assert.equal(json(did), json([['opened 5,1'], ['moved to 5,1'], ['moved to 6,1']]));
    assert.ok(r.steps[0].events.some(e => e.k === 'noise' && e.x === 5 && e.y === 1), 'the door\'s soft noise');
    assert.equal(a.next, 100000, 'and its own time is untouched');
  });

  test('a module cannot pass over the core\'s rules: a Centrepiece\'s piece is never woken by it (pips and damage only), you are no target of its rules, and nothing acts on your death or your leaving', () => {
    // The wake effect on a Centrepiece's piece cannot act: it throws, as for one not asleep.
    const X = loadCore();
    plant(X, 'planted_alarm', { rules: [{ rule: 'call', on: 'waited', who: s => s.actors.slice(1), do: [{ k: 'wake', mode: 'awake', cause: { k: 'alarm' } }] }] });
    const s = room(X, [{ sp: 'dummy', at: [8, 3], mode: 'dormant', stats: BODY, role: 'centrepiece' }]);
    X.Modules.init(s, pack('planted_alarm'));
    assert.ok(X.Actors.centrepiece(s.actors[1]));
    assert.throws(() => X.Step.step(s, wait), /is a Centrepiece's piece, which wakes from pips and damage only/);
    // A rule whose who gives you: refused (a module's rules act on exhibits).
    for (const k of [{ k: 'status', id: 'slowed', turns: 2 }, { k: 'tier', pct: 33, acc: 0 }]) {
      const Y = loadCore();
      plant(Y, 'planted_you', { rules: [{ rule: 'r', on: 'waited', who: st => [st.actors[0]], do: [k] }] });
      const u = room(Y, []);
      Y.Modules.init(u, pack('planted_you'));
      const before = json([u.actors[0].maxHp, u.actors[0].statuses]);
      assert.throws(() => Y.Step.step(u, wait), /who gave you, not an exhibit present/, k.k);
      assert.equal(json([u.actors[0].maxHp, u.actors[0].statuses]), before, `${k.k}: you are untouched`);
    }
    // On your death: the blow that leaves you no health and your died reach no rule; an
    // exhibit's death does.
    const run = (killYou, mod) => {
      const Z = loadCore();
      plant(Z, 'planted_mourn', { rules: [
        { rule: 'hurt', on: 'damaged', do: [flag('hurt', (state, e) => e.who)] },
        { rule: 'mourn', on: 'died', who: st => st.actors.slice(1).filter(b => !b.gone && b.mode === 'dormant'), do: [{ k: 'wake', mode: 'awake', cause: { k: 'alarm' } }] }] });
      const z = Z.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [3, 2], exhibits: [
        { sp: 'dummy', at: [4, 2], mode: 'hunting', stats: { hp: 1, acc: 99, eva: 0, pad: 0, dmin: 50, dmax: 50 }, next: 50 },
        { sp: 'dummy', at: [9, 4], mode: 'dormant', stats: BODY }] });
      z.actors[0].hp = killYou ? 5 : 999;
      if (!killYou) z.actors[0].acc = 400;
      Z.Modules.init(z, pack(mod || 'planted_mourn'));
      return { z, ev: killYou ? Z.Step.step(z, wait) : Z.Step.step(z, { a: 'attack', uid: z.actors[1].uid }) };
    };
    const dead = run(true);
    assert.equal(json([dead.z.over.k, mods(dead.ev), dead.z.actors[2].mode]), json(['died', [], 'dormant']));
    assert.equal(dead.z.dept.modules[0].hurt, undefined, 'the fatal blow reached no rule');
    const won = run(false);
    assert.equal(json([won.z.over, mods(won.ev).slice(-1), won.z.actors[2].mode]), json([null, [`planted_mourn.mourn@${won.z.actors[2].uid}`], 'awake']));
    // Your leaving reaches no rule.
    const L = loadCore();
    plant(L, 'planted_left', { rules: [{ rule: 'gone', on: 'left', do: [flag('n', 1)] }] });
    const l = L.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exits: [[2, 3]], exhibits: [] });
    L.Modules.init(l, pack('planted_left'));
    const lev = L.Step.step(l, { a: 'leave', i: 0 });
    assert.equal(json([l.over.k, mods(lev), L.Modules.of(l, 'planted_left').n]), json(['left', [], undefined]));
  });

  test('the clock effect, through W0d1\'s ClockRules.advance: the bell comes n turns sooner, with the module\'s cause, at stages 0, 1 and 2', () => {
    const got = [];
    for (const [B, G, count] of [[40, 20, 5], [10, 20, 15], [10, 5, 30]]) {
      const X = loadCore();
      plant(X, 'planted_clock', { rules: [{ rule: 'sooner', on: 'waited', do: [{ k: 'clock', n: 12 }] }] });
      const s = room(X, [], { clock: { B, G, count } });
      X.Modules.init(s, pack('planted_clock'));
      const r = H.play(X, s, [wait], { inv: 'all', clone: true });
      assert.equal(json(violations(r)), '[]');
      const st = r.events.find(e => e.k === 'stage' && e.cause && e.cause.k === 'planted_clock');
      got.push([st.stage, st.n, s.dept.clock.B, s.dept.clock.G]);
    }
    assert.equal(json(got), json([['bell_sooner', 12, 28, 20], ['watch_sooner', 12, 10, 8], ['nothing_sooner', 0, 10, 5]]));
  });

  test('the alarm effect: the module\'s alarm {by, since, until} and the alarm event; one raised while another runs throws; alarmDecay, pipsDecay and mayReturn are the module\'s own, asked only while it is on', () => {
    const X = loadCore();
    const running = (state, m) => !!m.alarm && m.alarm.until > state.turn;
    plant(X, 'planted_alarm', {
      rules: [{ rule: 'call', on: 'waited', who: s => s.actors.slice(1), when: (state, e, m) => !running(state, m), do: [{ k: 'alarm', turns: 3 }] }],
      bespoke: ['alarmDecay', 'pipsDecay', 'mayReturn'],
      alarmDecay: (state, ev, m) => { if (m.alarm && m.alarm.until === state.turn) { X.Causes.emit(state, ev, 'module', { id: m.id, rule: 'over' }, { k: m.id }); m.alarm = null; } },
      pipsDecay: (state, m) => !running(state, m),
      mayReturn: (state, a, m) => !running(state, m),
    });
    const s = room(X, [{ sp: 'dummy', at: [8, 5], mode: 'awake', stats: BODY, next: 100000 }], { clock: { ltour: 60 } });
    X.Modules.init(s, pack('planted_alarm'));
    const seen = [];
    const r = H.play(X, s, (state, i) => {
      if (i >= 6) return null;
      seen.push([state.turn, X.Modules.pipsDecay(state), X.Clock.pipsDecay(state), X.Modules.mayReturn(state, state.actors[1]), X.AI.mayReturn(state, state.actors[1])]);
      return wait;
    }, { inv: 'all', clone: true });
    assert.equal(json(violations(r)), '[]');
    const alarms = r.events.filter(e => e.k === 'alarm');
    assert.equal(json(alarms.map(e => [e.turn, e.by, e.until, e.cause.k])), json([[0, 'T0.1.room.1', 3, 'planted_alarm'], [3, 'T0.1.room.1', 6, 'planted_alarm']]));
    assert.equal(json(mods(r.events)), json(['planted_alarm.call@T0.1.room.1', 'planted_alarm.over', 'planted_alarm.call@T0.1.room.1', 'planted_alarm.over']));
    // Asked before each wait: no alarm at turn 0; it runs at turns 1 and 2, is over at 3 (and
    // raised again by that turn's wait), and runs at 4 and 5. The clock and the AI ask it.
    const T = [true, true, true, true], F = [false, false, false, false];
    assert.equal(json(seen.map(x => x.slice(1))), json([T, F, F, T, F, F]));
    // A second alarm while one runs cannot be raised: the effect throws.
    const Y = loadCore();
    plant(Y, 'planted_alarm', { rules: [{ rule: 'call', on: 'waited', who: st => st.actors.slice(1), do: [{ k: 'alarm', turns: 3 }] }] });
    const u = Y.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [{ sp: 'dummy', at: [8, 5], mode: 'awake', stats: BODY, next: 100000 }] });
    Y.Modules.init(u, pack('planted_alarm'));
    Y.Step.step(u, wait);
    assert.throws(() => Y.Step.step(u, wait), /an alarm already runs until turn 3/);
    // Switched off, its hooks are not asked: pips decay and exhibits go back.
    const v = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [{ sp: 'dummy', at: [8, 5], mode: 'awake', stats: BODY }] }, { rulesOff: ['planted_alarm'] });
    X.Modules.init(v, pack('planted_alarm'));
    X.Modules.of(v, 'planted_alarm').alarm = { by: 'x', since: 0, until: 50 };
    assert.equal(json([X.Modules.pipsDecay(v), X.Modules.mayReturn(v, v.actors[1])]), json([true, true]));
    // A hook that answers anything but true or false is a bug.
    const W = loadCore();
    plant(W, 'planted_odd', { bespoke: ['pipsDecay'], pipsDecay: () => 0 });
    const w = room(W, []);
    W.Modules.init(w, pack('planted_odd'));
    assert.throws(() => W.Modules.pipsDecay(w), /gave 0, not true or false/);
  });

  // ---- The special effect and due lines, joined up ----
  // A planted chime: a station (awake, marking while awake) marks a planted beam along its
  // row on every turn ≡ 1 (mod 3) from the module's start, due two turns later; the line goes
  // off at that boundary (Specials.resolveDue, first in Modules.turn), and the module's threat
  // gives the lines due, and the chimes not yet sounded, so every decision is warned.
  function chime(X) {
    const S = X.Specials, RANGE = 9, PERIOD = 3, AT = 1, WARN = 2;
    S.addShape('planted_beam', { tiles: (state, a) => X.Ranged.beam(state, a, 2, RANGE), from: (state, a) => X.Ranged.beamFrom(state, a, 2, RANGE), via: (state, a) => X.Ranged.beamVia(state, a, 2, RANGE), glass: true });
    X.Registry.define('SPECIALS', 'planted_due', { shape: 'planted_beam', effect: 'damage', curve: 'ROLE_ARTILLERY_SPECIAL', range: null, every: null });
    X.Registry.define('ARCHETYPES', 'planted_station', { special: null });
    X.Archetypes.add('planted_station', { act: (state, a, ev) => X.AI.wait(state, a, ev), marksAwake: () => true });
    const stations = state => state.actors.filter(a => a.arch === 'planted_station' && !a.gone);
    const tiles = (state, a) => S.tiles(state, a, 'planted_beam');
    plant(X, 'planted_chime', {
      rules: [{ rule: 'line', on: 'period', every: PERIOD, at: AT, who: stations, when: (state, e, m, a) => S.canMark(state, a, 'planted_due', tiles(state, a)),
        telegraph: { turns: WARN, shown: 'planted_due' }, do: [{ k: 'special', sp: 'planted_due', due: state => (state.turn + WARN) * TPT }] }],
      bespoke: ['threat'],
      threat(state, until, m) {
        const out = [];
        for (const st of stations(state)) {
          const t = st.telegraph;
          if (t && Number.isInteger(t.due) && t.due < until) out.push({ by: st.uid, sp: t.sp, tiles: t.tiles, gross: t.gross, due: t.due });
          for (let T = state.turn + 1; (T + WARN) * TPT < until; T++) if ((T - m.since) % PERIOD === AT) out.push({ by: st.uid, sp: 'planted_due', tiles: tiles(state, st), gross: S.info(state, 'planted_due').gross, due: (T + WARN) * TPT });
        }
        return out;
      },
    });
  }
  test('the special effect, through W0d2\'s addShape: a period rule marks a due line on its turns; it goes off at its boundary, first at step 8, for what it showed; Modules.threat warns of it before every decision; at depths 1–7, every invariant on', () => {
    const ROW = ['############', '#..........#', '############'];
    const problems = [];
    for (const depth of H.DEPTHS) {
      const X = loadCore();
      chime(X);
      const s = X.Setup.room(1, { acc: 'T0', depth, map: ROW, you: [8, 1], exhibits: [{ sp: 'dummy', at: [1, 1], arch: 'planted_station', mode: 'awake', stats: BODY, next: 100000 }] });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      X.Modules.init(s, pack('planted_chime'));
      const threats = [];
      const r = H.play(X, s, (state, i) => { if (i >= 8) return null; threats.push(X.Specials.threat(state, wait)); return wait; }, { inv: 'all', clone: true });
      problems.push(...violations(r).map(v => `d${depth}: ${v}`));
      const net = X.Specials.net(X.Specials.info(s, 'planted_due').gross, s.actors[0].pad);
      const lines = mods(r.events), hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you');
      if (json(lines) !== json(['planted_chime.line@T0.' + depth + '.room.1', 'planted_chime.line@T0.' + depth + '.room.1', 'planted_chime.line@T0.' + depth + '.room.1'])) problems.push(`d${depth}: lines ${json(lines)}`);
      // Marked at turns 1, 4 and 7, due at 3, 6 and 9: you are struck at turns 3 and 6, each for the net it showed.
      if (json(hits.map(e => [e.turn, e.amount])) !== json([[3, net], [6, net]])) problems.push(`d${depth}: hits ${json(hits.map(e => [e.turn, e.amount]))}`);
      const warned = threats.map((t, i) => t ? i : null).filter(i => i !== null);
      if (json(warned) !== json([2, 5])) problems.push(`d${depth}: warned before decisions ${json(warned)}`);
      if (json(threats[2]) !== json({ x: 8, y: 1, dmg: net, by: s.actors[1].uid, sp: 'planted_due', due: 300 })) problems.push(`d${depth}: the warning ${json(threats[2])}`);
      // At step 8 the line goes off before any module rule acts: the special event comes
      // before the next line's module event in the same boundary.
      const k = r.events.findIndex(e => e.k === 'special' && e.turn === 3 && !e.cancelled);
      if (k < 0) problems.push(`d${depth}: no line went off at turn 3`);
    }
    assert.equal(json(problems), '[]');
  });

  // ---- Re-entry ----
  test('re-entry: an event a rule makes reaches the rules after it, to two deep; a rule acting three deep throws, naming the chain', () => {
    const build = deep => {
      const X = loadCore();
      const ex = s => s.actors.slice(1);
      plant(X, 'planted_a', { rules: [{ rule: 'one', on: 'waited', who: ex, do: [{ k: 'status', id: 'slowed', turns: 2 }] }] });
      plant(X, 'planted_b', { rules: [{ rule: 'two', on: 'status', when: (state, e) => e.on, who: (state, e) => [X.Actors.byUid(state, e.who)], do: [{ k: 'surface', kind: 'dust', size: 1, turns: 1 }] }] });
      plant(X, 'planted_c', { rules: deep ? [{ rule: 'three', on: 'surface', do: [flag('n', 3)] }] : [] });
      const s = room(X, [{ sp: 'dummy', at: [6, 3], mode: 'dormant', stats: BODY }]);
      X.Modules.init(s, pack('planted_a', 'planted_b', 'planted_c'));
      return { X, s };
    };
    const { X, s } = build(false), ev = X.Step.step(s, wait);
    assert.equal(json(ev.filter(e => ['waited', 'module', 'status', 'surface'].includes(e.k)).map(e => e.k === 'module' ? e.rule : e.k)), json(['waited', 'one', 'status', 'two', 'surface']));
    const deep = build(true);
    assert.throws(() => deep.X.Step.step(deep.s, wait), /planted_c\.three would act three deep, on an event of planted_b\.two, itself acting on an event of planted_a\.one/);
    // A module event reaches no module.
    const Y = loadCore();
    plant(Y, 'planted_a', { rules: [{ rule: 'one', on: 'waited', do: [flag('n', 1)] }] });
    let asked = 0;
    plant(Y, 'planted_b', { rules: [{ rule: 'listen', on: 'waited', when: (state, e) => { asked++; return e.k === 'module'; }, do: [flag('n', 2)] }] });
    const u = room(Y, []);
    Y.Modules.init(u, pack('planted_a', 'planted_b'));
    Y.Step.step(u, wait);
    assert.equal(json([asked, Y.Modules.of(u, 'planted_b').n]), json([1, undefined]));
  });

  // ---- Step 8, and the end of the visit ----
  test('Modules.turn: Specials.resolveDue first, then turn and period rules, then the module\'s own turn; nothing acts once the visit is over, a rule\'s defeat of you included', () => {
    const X = loadCore(), log = [];
    const resolveDue = X.Specials.resolveDue;
    X.Specials.resolveDue = (state, ev) => { log.push('resolveDue'); return resolveDue(state, ev); };
    plant(X, 'planted_t', {
      rules: [{ rule: 'tick', on: 'turn', do: [flag('n', state => { log.push('turn@' + state.turn); return state.turn; })] },
        { rule: 'every2', on: 'period', every: 2, do: [flag('p', state => { log.push('period@' + state.turn); return state.turn; })] },
        { rule: 'heard', on: 'waited', do: [flag('h', state => { log.push('heard@' + state.turn); return state.turn; })] }],
      bespoke: ['turn'], turn: state => log.push('own@' + state.turn),
    });
    const s = room(X, []);
    X.Modules.init(s, pack('planted_t'));
    X.Step.step(s, wait); X.Step.step(s, wait);
    assert.equal(json(log), json(['heard@0', 'resolveDue', 'turn@1', 'own@1', 'heard@1', 'resolveDue', 'turn@2', 'period@2', 'own@2']));
    // Once over, nothing: not at a boundary, not on an event.
    log.length = 0;
    s.over = { k: 'died', turn: s.turn, by: null };
    const ev = [];
    X.Modules.turn(s, ev); X.Modules.alarmDecay(s, ev); X.Modules.onEvent(s, { k: 'waited', turn: 0, tick: 0, who: 'you', how: 'wait' }, ev);
    assert.equal(json(log), json(['resolveDue']));
    assert.equal(ev.length, 0);
    // A rule whose effect ends the visit stops the rules after it.
    const Y = loadCore();
    plant(Y, 'planted_end', { rules: [
      { rule: 'end', on: 'turn', do: [flag('n', state => { state.over = { k: 'died', turn: state.turn, by: null }; return 1; })] },
      { rule: 'after', on: 'turn', do: [flag('m', 1)] }] });
    const u = room(Y, []);
    Y.Modules.init(u, pack('planted_end'));
    Y.Step.step(u, wait);
    assert.equal(json([Y.Modules.of(u, 'planted_end').n, Y.Modules.of(u, 'planted_end').m]), json([1, undefined]));
  });

  // ---- Modules.threat ----
  test('Modules.threat gives each module\'s marks due before the tick asked, checked and copied: anything not {by, sp, tiles, gross, due}, or not due after now and before it, throws', () => {
    const X = loadCore();
    let give = [];
    plant(X, 'planted_th', { bespoke: ['threat'], threat: () => give });
    const s = room(X, [{ sp: 'dummy', at: [6, 3], mode: 'awake', stats: BODY }]);
    X.Modules.init(s, pack('planted_th'));
    const uid = s.actors[1].uid, good = { by: uid, sp: 'line', tiles: [[6, 4]], gross: 5, due: 300 };
    give = [good];
    const got = X.Modules.threat(s, 400);
    assert.equal(json(got), json([good]));
    assert.notEqual(got[0], good, 'a copy');
    const bad = [
      [Object.assign({}, good, { extra: 1 }), /not \{by, sp, tiles, gross, due\}/], [{ by: uid, sp: 'line', tiles: [[6, 4]], gross: 5 }, /not \{by, sp/],
      [Object.assign({}, good, { by: 'nobody' }), /by is no exhibit present/], [Object.assign({}, good, { sp: 'planted' }), /sp is no special/],
      [Object.assign({}, good, { tiles: [[60, 4]] }), /tiles are not tiles/], [Object.assign({}, good, { tiles: [] }), /tiles are not tiles/],
      [Object.assign({}, good, { gross: 2.5 }), /gross is not a whole number/], [Object.assign({}, good, { due: 350 }), /due is not a boundary tick/],
      [Object.assign({}, good, { due: 400 }), /before 400/], [Object.assign({}, good, { due: 0 }), /after 0/],
    ];
    for (const [mk, why] of bad) { give = [mk]; assert.throws(() => X.Modules.threat(s, 400), why, json(mk)); }
    give = 'none';
    assert.throws(() => X.Modules.threat(s, 400), /not a list of marks/);
    assert.throws(() => X.Modules.threat(s, 4.5), /is not a tick/);
    // A switched-off module gives none.
    const t = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 3], exhibits: [{ sp: 'dummy', at: [6, 3], mode: 'awake', stats: BODY }] }, { rulesOff: ['planted_th'] });
    X.Modules.init(t, pack('planted_th'));
    give = [good];
    assert.equal(json(X.Modules.threat(t, 400)), '[]');
  });
};
