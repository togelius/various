// ACCESSION — the mimic_vitrine's Behaviour line (BUILD.md §5.3; W1-ARCH-C): "Looks like a
// case, but its label has no accession number. Opened or bashed, it grips you (you cannot move
// for {MIMIC_GRIP_TURNS} turns) and strikes for {dmg}; it does everything at half speed. Wakes only when it is opened, bashed, dissolved or struck; wakes at once when its case
// is opened or bashed." Each scenario runs for every pack mimic (S9.5) at depths 1–7, as a
// function of the clause's parameters, with the invariants and a clone checked after every step.
// Opening and bashing are W1-CASES's: here they are stood in for as the plan gives them (the
// touch, Cases.touch calling the mimic's onTouched, then the soft or loud noise).
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Specials, Wake, Roles, N, Archetypes, Clauses, Cases, Combat, Actors, Noise, Status } = C;
  const json = x => JSON.stringify(x);
  const range = s => s.includes('–') ? s.split('–').map(Number) : [Number(s), Number(s)];
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const mimic = s => s.actors.find(a => a.arch === 'mimic_vitrine');
  const strong = s => { s.actors[0].hp = s.actors[0].maxHp = 999; return s; };
  const list = id => { const l = H.species(C, id); assert.ok(l.length >= 7, `${id}: ${l.length} species and depths`); return l; };
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const grip = (sp, depth) => Clauses.of(sp, { depth }).find(p => p.id === 'rooted').params.MIMIC_GRIP_TURNS;
  const caseOf = (s, a) => s.dept.fixtures.find(f => f.k === 'case' && f.mimic === a.uid) || null;
  // A room with a door beside you; the mimic sleeps at (4, 3), you stand west of it.
  const ROOM = ['#########', '#.......#', '#.+.....#', '#.......#', '#.......#', '#.......#', '#########'];
  const AT = [4, 3], YOU = [3, 3];
  const make = (X, sp, depth, opts, extra) => strong(X.Setup.room(opts.seed, { acc: 'T0', depth, map: ROOM, you: YOU.slice(),
    exhibits: [{ sp: sp.id, at: AT.slice(), stats: Roles.stats(sp.role, depth) }].concat(extra || []) }, { rulesOff: opts.rulesOff }));

  // A core with W1-CASES's open and bash stood in for a mimic's case, as the plan gives them.
  function standIn() {
    const X = loadCore(), get = X.Actions.get;
    X.Cases.touch = (state, f, how, by, ev) => { const m = f.mimic && X.Actors.byUid(state, f.mimic); if (m) X.Archetypes.onTouched(state, m, how, by, ev); };
    const handler = (id, cost, cls, noise) => ({
      legal: () => [], candidates: () => [],
      apply(state, action, ev) {
        const you = state.actors[0], f = X.Cases.at(state, action.x, action.y);
        if (!f || f.k !== 'case' || f.st !== 'shut' || X.Actors.dist(you, f.x, f.y) !== 1) return 'no_target';
        X.Cases.touch(state, f, id, 'you', ev);
        X.Noise.emit(state, f.x, f.y, cls, { k: noise, by: 'you' }, ev);
        return cost;
      },
    });
    const planted = { open: handler('open', N.COST_OPEN_CASE, 'soft', 'case_opened'), bash: handler('bash', N.COST_BASH, 'loud', 'bash') };
    X.Actions.get = id => planted[id] || get(id);
    return X;
  }
  const X = standIn();

  // A disguised mimic: in your ring, beside a door you open, beside a sleeper you strike, it
  // stays a case: no pips, no waking, no blow possible, its tile unchanged.
  let seen = [];
  const still = H.scenario({
    name: 'until its case is touched it is a case: it gains no pips, hears nothing, cannot be struck and does not move',
    id: 'wake_pipless', clone: true,
    build: (params, sp, depth, opts) => make(C, sp, depth, opts, [{ sp: 'dummy', at: [3, 4], mode: 'dormant', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }]),
    actions: (s, i) => {
      if (i === 0) seen = [];
      const m = mimic(s), legal = Step.legal(s);
      seen.push({ attack: legal.some(a => a.a === 'attack' && a.uid === m.uid), east: legal.some(a => a.a === 'move' && a.dir === 2), present: Archetypes.present(s, m), pips: m.pips, mode: m.mode });
      return [{ a: 'wait' }, { a: 'wait' }, { a: 'wait' }, { a: 'move', dir: 7 }, { a: 'attack', uid: s.actors[2].uid }, { a: 'move', dir: 2 }].concat(waits(6))[i] || null;
    },
    expect(r) {
      const m = mimic(r.state), f = caseOf(r.state, m);
      if (seen.some(v => v.attack || v.east || !v.present || v.present.as !== 'case' || v.pips || v.mode !== 'dormant')) return `it was not a case at every step: ${json(seen.find(v => v.attack || v.east || !v.present || v.pips || v.mode !== 'dormant'))}`;
      if (!r.events.some(e => e.k === 'noise')) return 'no noise was made beside it, so this shows nothing';
      if (r.events.some(e => (e.k === 'pip' || e.k === 'woke') && e.who === m.uid)) return 'it stirred or woke';
      if (r.steps[5].events[0].k !== 'refused' || r.steps[5].events[0].reason !== 'behind_glass') return `stepping into it was not refused as glass: ${json(r.steps[5].events[0])}`;
      if (m.x !== AT[0] || m.y !== AT[1] || r.state.dept.tiles[AT[1]][AT[0]] !== 'v' || !f || f.st !== 'shut' || f.num !== null) return 'its case is not as it was made';
      return null;
    },
  });

  test('until its case is opened or bashed it is a case: no pips, no waking, never struck, never moving', () => {
    ok(H.sweep(C, still, list('wake_pipless')), still.name);
  });

  // Opened: it shows itself, wakes hunting, grips you for your next MIMIC_GRIP_TURNS turns,
  // then its first action, after the beat, is a rolled blow, and everything it does is slow.
  const opened = how => H.scenario({
    name: `${how === 'open' ? 'opened' : 'bashed'}, it grips you for your next turns, then strikes from beside you, slowly`,
    id: 'mimic_vitrine', clone: true, inv: ['arch-c'],
    build: (params, sp, depth, opts) => make(C, sp, depth, opts),
    actions: (s, i, c) => {
      const g = grip(c.sp, c.depth), seq = [{ a: how, x: AT[0], y: AT[1] }];
      for (let k = 0; k < g; k++) seq.push({ a: 'move', dir: 6 }, { a: 'wait' });
      seq.push({ a: 'move', dir: 6 }, ...waits(8));
      return seq[i] || null;
    },
    expect(r, params, sp, depth) {
      const m = mimic(r.state), g = grip(sp, depth), [lo, hi] = range(params.dmg), e0 = r.steps[0].events;
      const held = e0.find(e => e.k === 'status' && e.on && e.id === 'rooted' && e.who === 'you');
      if (!held || held.cause.k !== 'grip' || held.cause.by !== m.uid) return `opening it did not grip you: ${json(held)}`;
      const woke = e0.find(e => e.k === 'woke' && e.who === m.uid);
      if (!woke || woke.mode !== 'hunting' || woke.cause.k !== 'touch_case') return `it did not wake hunting at the touch: ${json(woke)}`;
      if (e0.findIndex(e => e.k === 'noise') < e0.indexOf(held)) return 'the grip came after the noise of the touch';
      // You cannot move at your next g decisions, and can at the one after.
      for (let k = 0; k < g; k++) { const ev = r.steps[1 + 2 * k].events; if (ev.length !== 1 || ev[0].reason !== 'rooted') return `your move at your decision ${k + 1} after the touch was not refused as rooted: ${json(ev[0])}`; }
      if (!r.steps[1 + 2 * g].events.some(e => e.k === 'moved' && e.who === 'you')) return `you could not move at your decision ${g + 1} after the touch`;
      // Its first action is a blow, rolled, for its damage range.
      const firstAct = r.events.find(e => (e.k === 'attacked' && e.by === m.uid) || (e.k === 'moved' && e.who === m.uid));
      if (!firstAct || firstAct.k !== 'attacked') return `its first action was not a blow: ${json(firstAct)}`;
      const blows = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === m.uid);
      if (!blows.length || blows.some(e => e.cause.roll === undefined)) return 'its blows were not rolled';
      const bad = blows.find(e => e.k === 'damaged' && (e.cause.raw < lo || e.cause.raw > hi));
      if (bad) return `a blow rolled ${bad.cause.raw}, outside ${params.dmg}`;
      // It shows itself: its case revealed, the floor back, no longer shown as a case.
      const f = caseOf(r.state, m);
      if (f.st !== 'revealed' || r.state.dept.tiles[AT[1]][AT[0]] === 'v' || Archetypes.present(r.state, m)) return 'it did not show itself';
      return null;
    },
  });
  const opens = opened('open'), bashes = opened('bash');

  test('opened, it grips you for your next MIMIC_GRIP_TURNS turns, then its first action is a rolled blow for {dmg}', () => {
    ok(H.sweep(X, opens, H.species(X, 'mimic_vitrine')), opens.name);
  });
  test('bashed, it grips you likewise, before the bash\'s noise', () => {
    ok(H.sweep(X, bashes, H.species(X, 'mimic_vitrine')), bashes.name);
  });

  test('it does everything at half speed: its beat, its blows, its steps and its waits take twice as long', () => {
    for (const { sp, depth } of list('mimic_vitrine')) {
      const s = make(X, sp, depth, { seed: depth, rulesOff: [] }), m = mimic(s);
      assert.notEqual(X.Step.step(s, { a: 'open', x: AT[0], y: AT[1] })[0].k, 'refused');
      // Woken at tick 0, it first acts after a beat of twice COST_STEP.
      assert.equal(m.next, Actors.cost(s, m, N.COST_STEP, 'act'));
      assert.equal(json([Actors.cost(s, m, N.COST_STEP, 'move'), Actors.cost(s, m, N.COST_ATTACK, 'act'), Actors.cost(s, m, N.COST_WAIT, 'act')]),
        json([2 * N.COST_STEP, 2 * N.COST_ATTACK, 2 * N.COST_WAIT]));
      const r = H.play(X, s, waits(12), { inv: ['arch-c'] });
      assert.equal(json(r.violations), '[]');
      assert.ok(r.events.filter(e => e.k === 'attacked' && e.by === m.uid).length >= 3, 'it fought');
      assert.ok(r.events.filter(e => e.k === 'attacked' && e.by === m.uid).length <= 7, 'it fought slowly: at most one blow in two turns');
    }
  });

  test('struck while it is a case (a beam passes glass), it wakes and shows itself, without the grip', () => {
    for (const { sp, depth } of list('mimic_vitrine')) {
      const s = make(C, sp, depth, { seed: 1, rulesOff: [] }), m = mimic(s), ev = [];
      Combat.hurt(s, m, 1, { k: 'special', by: 'you', sp: 'line', gross: 1, pad: 0, net: 1, x: m.x, y: m.y, from: [m.x, m.y + 1] }, ev);
      assert.equal(json([m.mode, caseOf(s, m).st, s.dept.tiles[m.y][m.x], Archetypes.present(s, m)]), json(['hunting', 'revealed', '.', null]));
      assert.ok(ev.some(e => e.k === 'woke' && e.who === m.uid && e.cause.k === 'damage'));
      assert.ok(!s.actors[0].statuses.some(q => q.id === 'rooted') && !ev.some(e => e.k === 'status'), 'no grip');
      for (const e of ev) assert.equal(C.Causes.check(e), null);
    }
  });

  test('dissolved, its case is gone and it hunts without the grip; nothing else wakes it, a herald\'s call or a noise included', () => {
    for (const { sp, depth } of list('mimic_vitrine')) {
      const s = make(C, sp, depth, { seed: 1, rulesOff: [] }), m = mimic(s), f = caseOf(s, m), ev = [];
      for (const k of ['ring', 'noise', 'herald', 'seen', 'night_bell', 'ally_hit', 'tether', 'axis']) assert.equal(Wake.wake(s, m, k === 'noise' || k === 'herald' ? 'awake' : 'hunting', { k, by: 'you' }, ev), false, k);
      assert.equal(Wake.addPips(s, m, 1, { k: 'ring', dist: 1, r: 3 }, ev), false);
      Noise.emit(s, m.x, m.y - 1, 'crash', { k: 'glass_broke', by: 'you' }, ev);
      assert.equal(json([m.mode, m.pips]), json(['dormant', 0]));
      // Solvent, as W1-CASES will apply it: the case dissolved (u), then the sleeper released.
      s.dept.tiles[f.y] = s.dept.tiles[f.y].slice(0, f.x) + 'u' + s.dept.tiles[f.y].slice(f.x + 1); f.st = 'dissolved';
      assert.equal(Wake.wake(s, m, 'hunting', { k: 'dissolved', by: 'you' }, ev), true);
      assert.equal(json([m.mode, f.st, s.dept.tiles[f.y][f.x], Archetypes.present(s, m), Archetypes.pipless(s, m)]), json(['hunting', 'dissolved', 'u', null, true]));
      assert.ok(!s.actors[0].statuses.length, 'no grip');
    }
  });

  test('made with the department, the mimic is a case with no accession number, drawn on its own stream; a disguised mimic is no target', () => {
    let n = 0;
    for (let depth = 1; depth <= 7; depth++) for (const seed of [1, 2, 3]) {
      const s = C.Dept.create(seed, 'S9', depth), m = mimic(s);
      if (!m) continue;
      n++;
      const f = caseOf(s, m);
      assert.ok(f && f.num === null && f.st === 'shut' && f.x === m.x && f.y === m.y && s.dept.tiles[m.y][m.x] === 'v', `S9 d${depth} seed ${seed}`);
      assert.equal(json([m.mode, m.pips, Archetypes.pipless(s, m), Archetypes.present(s, m)]), json(['dormant', 0, true, { as: 'case' }]));
      assert.equal(Combat.canStrike(s, s.actors[0], m, { kind: 'melee' }), 'behind_glass');
      assert.ok(!Step.legal(s).some(a => a.a === 'attack' && a.uid === m.uid));
      const line = Clauses.line(C.Packs.speciesFor(s, m), { depth });
      assert.ok(line.includes(`cannot move for ${N.MIMIC_GRIP_TURNS} turns`) && line.startsWith('Looks like a case') && line.includes('Wakes only when'), line);
    }
    assert.ok(n >= 18, `${n} departments placed the mimic`);
    // Made awake, or on a tile that is not floor, it is a slow ambusher in plain view.
    const [{ sp }] = list('mimic_vitrine');
    const awake = Setup.room(1, { acc: 'T0', depth: 1, map: ROOM, you: YOU.slice(), exhibits: [{ sp: sp.id, at: AT.slice(), mode: 'hunting', stats: Roles.stats(sp.role, 1) }] });
    assert.equal(json([awake.dept.fixtures.length, Archetypes.present(awake, mimic(awake))]), json([0, null]));
  });

  test('the grip roots whoever touched it, once; a second touch does nothing', () => {
    const [{ sp, depth }] = list('mimic_vitrine');
    const s = make(C, sp, depth, { seed: 1, rulesOff: [] }), m = mimic(s), ev = [];
    Archetypes.onTouched(s, m, 'open', 'you', ev);
    assert.equal(json(ev.map(e => [e.k, e.who, e.cause.k])), json([['woke', m.uid, 'touch_case'], ['hunting', m.uid, 'touch_case'], ['status', 'you', 'grip']]));
    assert.equal(json([m.ax.gripped, caseOf(s, m).st]), json([1, 'revealed']));
    const more = [];
    Archetypes.onTouched(s, m, 'bash', 'you', more);
    assert.equal(more.length, 0);
    assert.ok(/^You are held in the grip of .+: you cannot move for \d+ turns\.$/.test(C.Text.event(ev[2], () => 'the Tortoise')), C.Text.event(ev[2]));
  });

  test('its invariants catch a planted mimic that takes pips while a case, grips short, or acts at full speed', () => {
    const [{ sp, depth }] = list('mimic_vitrine');
    const Y = loadCore();
    Y.Archetypes.pipless = () => false;
    const s = make(Y, sp, depth, { seed: 1, rulesOff: [] });
    assert.ok(H.play(Y, s, waits(3), { inv: ['arch-c'] }).violations.some(v => v.inv === 'mimic_disguise'));
    const Z = standIn();
    Z.Archetypes.onTouched = (state, a, how, by, ev) => { Z.Cases.reveal(state, a); Z.Wake.wake(state, a, 'hunting', { k: 'touch_case', by }, ev); Z.Status.apply(state, state.actors[0], 'rooted', 1, { k: 'grip', by: a.uid }, ev); };
    Z.Archetypes.speedApplies = () => ['move'];
    const t = make(Z, sp, depth, { seed: 1, rulesOff: [] });
    const v = H.play(Z, t, [{ a: 'open', x: AT[0], y: AT[1] }].concat(waits(6)), { inv: ['arch-c'] }).violations.map(x => x.inv);
    assert.ok(v.includes('mimic_grip') && v.includes('mimic_slow'), json(v));
  });
};
