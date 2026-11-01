// ACCESSION — S.9's Centrepiece, the Composite, past its core: its phases, the leave-heal, the
// alarm, its crest, and its treasure (BUILD.md §5.5, §8.4, §8.7; M4 plan D3.5, D3.6, D3.8,
// D3.14, decided without play; revisit once M4 is playable; rules/arch/completing_guardian.js,
// rules/treasure.js). Its core stays at ready false, so no department places it: these tests
// place the real record with Centrepiece.place in a room with its hall (the harness's rooms,
// completing_guardian.test.js's), and in S.9's own departments with the core planted ready,
// every invariant checked after every step (centrepiece.inv.js among them) and two of their own
// (it never leaves its hall; the treasure is carried out exactly when it is), the main runs
// clone-checked. What each test expects is worked out here from BUILD's sentences, not from the
// code:
//   - its hall seals while it hunts you there, once no one stands in an opening, from
//     TREASURE_SEAL_TURNS turns after its case is first opened or bashed (not dissolved), or
//     while its health is TREASURE_SEAL_HP_PCT% of its full health or less; never on the hunt
//     alone;
//   - holding the Lamp it guards (the department's, not one you came with) outside its unsealed
//     hall at a turn's end, an opening included, or reading a Ticket while you carry it, is
//     carrying it out: the Certificate, once, by treasure; killing it earns nothing;
//   - leaving its hall while it hunts you (into an opening, or by a Ticket) heals it
//     GUARDIAN_LEAVE_HEAL_PCT% of its full health and drops its last limb;
//   - each phase from its second grows its next limb (neck, legs, tail, crest), so its tail
//     comes only at phase 2 (or 3), never by walking, and its crest after it; its crest's call
//     wakes the sleepers on its tiles that can hear, never a Centrepiece;
//   - from phase 2, with alarm_network on, hunting you in its hall and seeing you, it shows and
//     raises the alarm as a Wader does; never in phase 1, nor with the module off;
//   - every mark of its equals what it deals;
//   - its gateway label is 40–120 words and claims no rule.
// Seeds: 1 (harness rooms), 1–3 (S.9's departments); depths 1–7 unless a test says otherwise.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS;
  const B = require(path.join(root, 'tools/battery.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore(), { N } = C;
  const WAIT = { a: 'wait' }, W = d => ({ a: 'move', dir: d });
  const ALL_LIMBS = ['cp_sweep', 'cp_charge', 'cp_ring', 'cp_call'], WALKED = ['cp_sweep', 'cp_charge'];

  // completing_guardian.test.js's hall (x 1–11, y 1–7), the Lamp's case in its south-west
  // corner (1,7), its one way in an archway (12,2) from a gallery east of it (x 13–15, y 1–7),
  // and four one-tile rooms below, never walked to, which a test may name as walked. The
  // Composite's footprint: 5–6 × 3–4.
  const MAP = ['#################', '#...........#...#', '#...........,...#', '#...........#...#', '#...........#...#', '#...........#...#',
    '#...........#...#', '#v..........#...#', '#################', '#.#.#.#.#########', '#################'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 11, y1: 7 }, { key: 's1', role: 'section', x0: 13, y0: 1, x1: 15, y1: 7 },
    { key: 'intro', role: 'intro', x0: 1, y0: 9, x1: 1, y1: 9 }, { key: 's2', role: 'section', x0: 3, y0: 9, x1: 3, y1: 9 },
    { key: 's3', role: 'section', x0: 5, y0: 9, x1: 5, y1: 9 }, { key: 'coda', role: 'coda', x0: 7, y0: 9, x1: 7, y1: 9 }];
  const GALLERIES = [[4], [1], [0], [1, 3], [2], [5]];
  const AT = [5, 3], CASE = [1, 7], ARCH = [12, 2];
  const ALL = [1, 2, 3, 4, 5, 6];

  // A room with the hall, the Composite placed on its footprint (Centrepiece.place, S.9's record).
  // o: you ([4, 3], beside it on the west); walked (room ids; by default the gallery east of the
  // hall); more exhibits; items; core (X); options; modules (true: S.9's, Modules.init, as a
  // department runs them); scale (its health and maximum); lamp ('case' or 'tote': the
  // department's Lamp, made there, Kit.make).
  function room(depth, o) {
    o = o || {};
    const X = o.core || C;
    const s = H.room(X, o.seed || 1, { acc: 'S9', depth, map: o.map || MAP, you: o.you || [4, 3], exhibits: o.more || [], rooms: ROOMS,
      clock: { B: 300, G: 60 }, entrance: [15, 4], fixtures: o.fixtures || [X.Cases.make({ x: CASE[0], y: CASE[1], glass: 3, lock: 1 })], items: o.items || [] }, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    GALLERIES.forEach((g, i) => { if (s.dept.rooms[i]) s.dept.rooms[i].galleries = g.slice(); });
    s.dept.walked = (o.walked || [2]).slice();
    if (o.modules) X.Modules.init(s, X.Packs.get('S9'));
    X.Centrepiece.place(s, { cpl: o.at || AT }, X.Packs.get('S9'));
    const a = X.Centrepiece.pieces(s)[0];
    if (o.scale) { a.maxHp = o.scale; a.hp = o.scale; }
    const rec = X.Packs.get('S9').items.find(i => i.id === 'S9.11');
    if (o.lamp === 'case') X.Kit.make(s, rec, { at: 'case', x: CASE[0], y: CASE[1] });
    if (o.lamp === 'tote') X.Kit.make(s, rec, { at: 'tote' });
    return s;
  }
  const composite = (X, s) => X.Centrepiece.pieces(s)[0];
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  const stages = (ev, k) => ev.filter(e => e.k === 'stage' && e.cause && e.cause.k === 'hall' && (!k || e.stage === k));
  const certs = ev => ev.filter(e => e.k === 'certificate');
  const lampOf = s => s.items.find(i => i.ref === 'S9.11' && i.uid.indexOf('you.') !== 0);
  // A step's direction from one tile to the next.
  const dir = (from, to) => [0, 1, 2, 3, 4, 5, 6, 7].find(d => from[0] + C.Grid.DX[d] === to[0] && from[1] + C.Grid.DY[d] === to[1]);
  // Walk along a path of tiles (each beside the last), then wait; null after `more` steps. A
  // choice waiting (the perk a Certificate offers) is answered first, with its first option.
  const walker = (path, more) => (st, i) => {
    if (i > more) return null;
    if (st.ui.pendingChoice) return { a: 'choose', index: 0 };
    const you = st.actors[0], k = path.findIndex(p => p[0] === you.x && p[1] === you.y);
    return k >= 0 && k + 1 < path.length ? W(dir(path[k], path[k + 1])) : WAIT;
  };

  // Its own invariants, beside every file's:
  //   composite.hall    every tile of it stands in its hall, after every step;
  //   treasure.carried  a Certificate by treasure comes only in a step that ends with you
  //                     holding the department's Lamp outside its hall, unsealed, after a turn
  //                     boundary, and only once; a step that ends so, past a boundary, with no
  //                     Certificate yet this visit, has one, or the visit's treasure was carried
  //                     out already (dept.cp.treasure).
  const IN_HALL = { id: 'composite.hall', check(pre, events, post) {
    const cp = post.dept && post.dept.cp, a = cp ? post.actors.find(b => b.uid === cp.uids[0]) : null;
    if (!a || a.gone) return null;
    const out = C.Actors.footprint(a).filter(([x, y]) => !C.Hall.inside(post, x, y));
    return out.length ? `the Composite stands on ${json(out)}, outside its hall` : null;
  } };
  const CARRIED = { id: 'treasure.carried', check(pre, events, post) {
    const cp = post.dept && post.dept.cp;
    if (!cp || cp.form !== 'treasure' || post.over) return null;
    const lamp = lampOf(post), you = post.actors[0], boundary = post.turn > pre.turn;
    const held = !!lamp && (lamp.where.at === 'kit' || lamp.where.at === 'tote');
    const outside = held && !C.Hall.inside(post, you.x, you.y) && !cp.sealed;
    const got = events.filter(e => e.k === 'certificate' && e.cause && e.cause.k === 'treasure');
    if (got.length > 1) return `${got.length} Certificates by treasure in one step`;
    if (got.length && !(outside && boundary)) return `a Certificate by treasure came with you ${held ? 'holding' : 'not holding'} the Lamp at ${you.x},${you.y}${cp.sealed ? ', sealed' : ''}`;
    if (got.length && pre.dept.cp && pre.dept.cp.treasure) return 'a second carry-out earned a Certificate';
    if (outside && boundary && !got.length && !(pre.dept.cp && pre.dept.cp.treasure) && !pre.dept.cert) return `you hold the Lamp outside its unsealed hall at ${you.x},${you.y} after a turn's end, and no Certificate came`;
    return null;
  } };
  const INV = X => Inv.select(X, 'all').concat([IN_HALL, CARRIED]);
  // Every event it caused is a kind its line allows it (the soak's completeness, B.causer), with
  // the visit's modules.
  function covered(X, s, events) {
    const rec = X.Packs.get('S9').centrepiece, allow = new Set(X.Clauses.UNIVERSAL), uid = s.dept.cp.uids[0], out = [];
    for (const p of X.Clauses.of(rec, { depth: s.dept.depth, modules: X.Modules.active(s) })) for (const k of p.covers) allow.add(k);
    for (const e of events) if (B.causer(e) === uid && !allow.has(e.k)) out.push(`it caused ${e.k}, which its line does not cover`);
    return out;
  }
  // S.9's department with the core planted ready in core X (a fresh one), so it places the
  // Composite.
  function readyCore() {
    const X = loadCore();
    X.Registry.ARCHETYPES.completing_guardian.ready = 'unit';
    return X;
  }

  // ---- The treasure seal ----

  test('the treasure seal at TREASURE_SEAL_TURNS: its case bashed (the first touch recorded; later bashes do not restart it), it hunts you and the hall seals at the turn boundary 12 turns after that touch, not one sooner, why touched, its sentence saying so; never on the hunt alone, and a case dissolved by Solvent is no touch; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const tag = `d${depth}`, s = room(depth, { walked: ALL, you: [2, 7], lamp: 'case' }), a = composite(C, s);
      const r = H.play(C, s, (st, i) => i > 20 ? null : i < 3 ? { a: 'bash', x: CASE[0], y: CASE[1] } : WAIT, { inv: INV(C), clone: true, cap: 30 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const touch = r.events.find(e => e.k === 'pip' && e.who === a.uid && e.cause.k === 'touch_case');
      const t0 = touch ? touch.turn : null;
      if (t0 === null || json(s.dept.cp.touched) !== json({ turn: t0 }) || C.Treasure.touched(s) !== t0) { problems.push(`${tag}: touched ${json(s.dept.cp.touched)}, the touch ${json(touch)}`); continue; }
      const shut = stages(r.events, 'sealed');
      if (json(shut.map(e => [e.turn, e.cause.why, e.cause.by])) !== json([[t0 + N.TREASURE_SEAL_TURNS, 'touched', undefined]])) problems.push(`${tag}: sealed ${json(shut)} (touched on turn ${t0})`);
      else if (say(C, s, shut[0]) !== `Shutters closed over the hall’s openings, since the Centrepiece is hunting you and its treasure’s case was first opened or bashed ${N.TREASURE_SEAL_TURNS} turns or more ago: it is sealed, and while it is, the clock is stopped and you do not recover health. They open once the Centrepiece has gone ${N.SEAL_LIFT_TURNS} turns without hurting you or ending a turn beside you, once it falls or goes under its dust sheet or none of it is left in the hall, or when you read a Re-admission Ticket.`) problems.push(`${tag}: ${say(C, s, shut[0])}`);
      // It hunted you from its touch on, and the hall did not seal for that alone.
      if (!r.events.some(e => e.k === 'hunting' && e.who === a.uid && e.turn === t0)) problems.push(`${tag}: it did not wake hunting at the touch`);
    }
    // Planted: touched TREASURE_SEAL_TURNS turns ago, but asleep, or you outside the hall: no
    // call; hunting you in its hall: it calls (Hall.calls, which the confirmation reads).
    const s = room(3, {}), a = composite(C, s);
    s.dept.cp.touched = { turn: s.turn - N.TREASURE_SEAL_TURNS };
    assert.equal(C.Hall.calls(s), null, 'asleep');
    C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
    assert.equal(json(C.Hall.calls(s)), json({ why: 'touched' }));
    s.dept.cp.touched = { turn: s.turn - N.TREASURE_SEAL_TURNS + 1 };
    assert.equal(C.Hall.calls(s), null, 'a turn short');
    s.dept.cp.touched = false;
    assert.equal(C.Hall.calls(s), null, 'never touched: no seal on the hunt alone');
    // Solvent dissolves its case: no touch, so no turn is recorded.
    const t = room(3, { you: [2, 7], lamp: 'case' }), ev = [];
    C.Cases.dissolve(t, C.Cases.at(t, CASE[0], CASE[1]), { k: 'solvent', by: 'you' }, ev);
    assert.equal(json([t.dept.cp.touched, C.Treasure.touched(t), composite(C, t).mode]), json([false, null, 'dormant']));
    assert.deepEqual(problems, []);
  });

  test('the treasure seal at TREASURE_SEAL_HP_PCT: hunting you in its hall with its health at 34% of its full health or less, the hall seals at the next turn boundary (why hurt), at one more health it does not; while someone stands in the opening the seal waits, says so once, and closes when the opening clears; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) for (const plus of [0, 1]) {
      const tag = `d${depth}${plus ? ' +1' : ''}`, s = room(depth, { walked: ALL, scale: 100 }), a = composite(C, s);
      C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
      a.hp = C.Int.pct(a.maxHp, N.TREASURE_SEAL_HP_PCT) + plus;
      // (Its phases follow its health: planted with it.)
      for (const b of C.Centrepiece.pieces(s)) b.ax.phase = C.Centrepiece.phaseFor(a.hp, a.maxHp);
      const r = H.play(C, s, [WAIT], { inv: INV(C), clone: true });
      problems.push(...bad(r, tag));
      const shut = stages(r.events, 'sealed');
      if (json(shut.map(e => e.cause.why)) !== json(plus ? [] : ['hurt'])) problems.push(`${tag}: ${json(shut)}`);
      else if (!plus && !/^Shutters closed over the hall’s openings, since the Centrepiece is hunting you with 34% of its full health or less: it is sealed/.test(say(C, s, shut[0]))) problems.push(`${tag}: ${say(C, s, shut[0])}`);
    }
    // Someone in the opening (a sleeper planted in the archway): the seal waits, once.
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { walked: ALL, scale: 100, more: [{ sp: 'S9.6', at: ARCH, mode: 'dormant', stats: C.Roles.stats('skirmisher', depth), statuses: [{ id: 'fixed', turns: 9999 }] }] }), a = composite(C, s);
      C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
      a.hp = C.Int.pct(a.maxHp, N.TREASURE_SEAL_HP_PCT);
      for (const b of C.Centrepiece.pieces(s)) b.ax.phase = 3;
      let r = H.play(C, s, [WAIT, WAIT, WAIT], { inv: INV(C) });
      problems.push(...bad(r, `d${depth} waiting`));
      const w = stages(r.events, 'waiting');
      if (stages(r.events, 'sealed').length || w.length !== 1 || w[0].cause.why !== 'hurt') problems.push(`d${depth}: waiting ${json(stages(r.events))}`);
      // The opening clears (planted: the sleeper is taken away): it seals at the next boundary.
      s.actors.find(b => b.sp === 'S9.6').gone = 1;
      r = H.play(C, s, [WAIT], { inv: INV(C) });
      if (json(stages(r.events).map(e => [e.stage, e.cause.why])) !== json([['sealed', 'hurt']])) problems.push(`d${depth}: cleared ${json(stages(r.events))}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- The carry-out ----

  test('the carry-out by the threshold: holding the Lamp (from its case, in your tote) you walk out by the archway; the turn boundary that finds you in the opening earns the Certificate by treasure, once, with its sentence; inside the hall, or holding a Lamp you came with (you.c1), nothing; walking back in and out again, nothing more; at depths 1–7, clone-checked', () => {
    const problems = [], path = [[8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [13, 3]];
    for (const depth of DEPTHS) {
      const tag = `d${depth}`, s = room(depth, { walked: ALL, you: [8, 2], lamp: 'tote' }), grade = s.run.grade;
      const r = H.play(C, s, walker(path, 8), { inv: INV(C), clone: true, cap: 12 });
      problems.push(...bad(r, tag));
      const k = r.steps.findIndex(st => certs(st.events).length);
      const c = k >= 0 ? certs(r.steps[k].events) : [];
      if (k !== 3 || json(c.map(e => [e.how, e.cause.k])) !== json([['treasure', 'treasure']])) problems.push(`${tag}: the Certificate came at step ${k}: ${json(c)}`);
      else if (say(C, s, c[0]) !== 'You earned this department’s Certificate: you carried its treasure out of the hall.') problems.push(`${tag}: ${say(C, s, c[0])}`);
      if (!c.length || json(s.dept.cp.treasure) !== json({ turn: c[0].turn }) || !C.Progress.cert(s) || s.run.grade !== Math.min(N.GRADE_MAX, grade + 1)) problems.push(`${tag}: ${json([s.dept.cp.treasure, C.Progress.cert(s), s.run.grade])}`);
      if (certs(r.events).length !== 1) problems.push(`${tag}: ${certs(r.events).length} Certificates`);
      // Back in, and out again: nothing more.
      const back = H.play(C, s, walker([[13, 3], [13, 2], [12, 2], [11, 2], [12, 2], [13, 2]], 6), { inv: INV(C), cap: 8 });
      if (certs(back.events).length) problems.push(`${tag}: a second Certificate`);
      // A Lamp you came with (the carry's you.c1), worn: walking out earns nothing.
      const t = room(depth, { walked: ALL, you: [8, 2], items: [{ uid: 'you.c1', kind: 'curio', ref: 'S9.11', prims: [{ id: 'observing', cls: 'L' }], where: { at: 'kit', slot: 'curio0' } }], lamp: 'case' });
      const q = H.play(C, t, walker(path, 8), { inv: INV(C), cap: 12 });
      problems.push(...bad(q, `${tag} brought`));
      if (certs(q.events).length || t.dept.cp.treasure) problems.push(`${tag}: a Lamp you came with earned ${json(certs(q.events))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('the carry-out comes at a turn boundary, after that boundary\'s regeneration: below your maximum, with your regeneration store due, the step out by the archway regenerates 1 health at your old maximum and then raises it with the Certificate (combat.inv\'s combat_health reads the maximum as it was); at depths 1–7', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const tag = `d${depth}`, s = room(depth, { walked: ALL, you: [11, 2], lamp: 'tote' }), you = s.actors[0];
      you.maxHp = C.Health.maxHp(s.run.grade); you.hp = you.maxHp - 5;
      const max = you.maxHp;
      you.regen = N.REGEN_BELL_MULT * C.Health.interval(max) - 1;
      const r = H.play(C, s, [W(2)], { inv: INV(C), clone: true });
      problems.push(...bad(r, tag));
      const ev = r.events.map(e => e.k), regen = r.events.find(e => e.k === 'regenerated');
      if (!regen || ev.indexOf('regenerated') > ev.indexOf('certificate') || regen.cause.need !== N.REGEN_BELL_MULT * C.Health.interval(max)) problems.push(`${tag}: ${json(r.events.map(e => [e.k, e.cause && e.cause.k]))}`);
      if (s.run.grade < N.GRADE_MAX && you.maxHp !== max + N.HP_PER_GRADE) problems.push(`${tag}: your maximum is ${you.maxHp}`);
    }
    assert.deepEqual(problems, []);
  });

  test('the carry-out by a Ticket: sealed in its hall (its case touched TREASURE_SEAL_TURNS turns before, planted) holding the Lamp, you read a Re-admission Ticket: the shutters open (why ticket), you stand at the entrance, and the Certificate comes in that step, by treasure; with no Lamp, none; unsealed, a Ticket read while you carry it earns it too; at depths 1–7, clone-checked', () => {
    const problems = [];
    const ticket = s => { const tk = C.Consumables.make(s, 'ticket', { at: 'tote' }); s.run.knownSeals.push(C.Consumables.sealFor(s, 'ticket')); return tk.uid; };
    for (const depth of DEPTHS) for (const [lamp, sealed] of [['tote', true], [null, true], ['tote', false]]) {
      const tag = `d${depth} ${lamp ? 'the Lamp' : 'no Lamp'}${sealed ? ', sealed' : ''}`, s = room(depth, { walked: ALL, lamp: lamp || undefined }), a = composite(C, s);
      const tk = ticket(s);
      if (sealed) {
        s.dept.cp.touched = { turn: s.turn - N.TREASURE_SEAL_TURNS };
        C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
        const r = H.play(C, s, [WAIT], { inv: INV(C) });
        problems.push(...bad(r, tag));
        if (!C.Clock.sealed(s)) { problems.push(`${tag}: not sealed`); continue; }
      }
      const r = H.play(C, s, [{ a: 'use', uid: tk }], { inv: INV(C), clone: true });
      problems.push(...bad(r, tag));
      const you = s.actors[0];
      if (json([you.x, you.y]) !== json(s.dept.entrance)) problems.push(`${tag}: you are at ${you.x},${you.y}`);
      if (sealed && json(stages(r.events).map(e => [e.stage, e.cause.why])) !== json([['unsealed', 'ticket']])) problems.push(`${tag}: ${json(stages(r.events))}`);
      const c = certs(r.events);
      if (json(c.map(e => e.cause.k)) !== json(lamp ? ['treasure'] : [])) problems.push(`${tag}: ${json(c)}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- The leave-heal ----

  test('the leave-heal: struck while it hunts you, you step out of its hall into the opening (the archway): at that turn\'s end it regains GUARDIAN_LEAVE_HEAL_PCT% of its maximum health (to full) and drops its last limb (its legs), each told; out and back while it sleeps, nothing; read a Ticket while it hunts you, the same; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const tag = `d${depth}`, s = room(depth, { walked: ALL, you: [10, 2], scale: 60 }), a = composite(C, s);
      C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
      a.hp = 50;
      const r = H.play(C, s, [WAIT, W(2), WAIT], { inv: INV(C), clone: true });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      // The step into the archway (12,2) from (11,2)... (10,2) → (11,2) is in the hall, then out.
      const out = H.play(C, s, [W(2), WAIT], { inv: INV(C), clone: true });
      problems.push(...bad(out, tag));
      const st = out.steps[0].events, heal = st.filter(e => e.k === 'healed' && e.who === a.uid), drop = st.filter(e => e.k === 'phase' && e.who === a.uid);
      if (json([s.actors[0].x, s.actors[0].y]) !== json(ARCH) && json([s.actors[0].x, s.actors[0].y]) !== json([13, 2])) problems.push(`${tag}: you at ${s.actors[0].x},${s.actors[0].y}`);
      if (json(heal.map(e => [e.cause.k, e.hp])) !== json([['left', 60]])) problems.push(`${tag}: healed ${json(heal)}`);
      if (json(drop.map(e => [e.cause.k, e.cause.limb, e.stage, e.phase])) !== json([['left', 'cp_charge', 1, 1]])) problems.push(`${tag}: ${json(drop)}`);
      else {
        if (say(C, s, drop[0]) !== 'You left The Composite, Assembled From the Round Books’s hall while it hunted you, so it dropped its legs: it has 1 limb.') problems.push(`${tag}: ${say(C, s, drop[0])}`);
        if (say(C, s, heal[0]) !== `You left The Composite, Assembled From the Round Books’s hall while it hunted you, so it regained ${heal[0].amount} health: now 60.`) problems.push(`${tag}: ${say(C, s, heal[0])}`);
      }
      if (json([a.ax.specials, a.ax.stage, a.ax.grown, a.hp]) !== json([['cp_sweep'], 1, 2, 60])) problems.push(`${tag}: ${json([a.ax, a.hp])}`);
      if (out.steps.slice(1).some(x => x.events.some(e => e.k === 'healed' || e.k === 'phase'))) problems.push(`${tag}: healed again`);
    }
    // Asleep: you step out and in and out; nothing.
    const s = room(3, { walked: ALL, you: [11, 2] }), a = composite(C, s);
    a.hp = a.maxHp - 5;
    const r = H.play(C, s, [W(2), W(6), W(2)], { inv: INV(C) });
    assert.deepEqual(bad(r, 'asleep'), []);
    assert.equal(json(r.events.filter(e => e.who === a.uid).map(e => e.k)), '[]');
    // By a Ticket, while it hunts you: you leave its hall too.
    for (const depth of [1, 7]) {
      const t = room(depth, { walked: ALL, scale: 60 }), b = composite(C, t);
      C.Wake.wake(t, b, 'hunting', { k: 'damage', by: 'you' }, []);
      b.hp = 40;
      H.play(C, t, [WAIT], { inv: INV(C) });
      const tk = C.Consumables.make(t, 'ticket', { at: 'tote' }); t.run.knownSeals.push(C.Consumables.sealFor(t, 'ticket'));
      const q = H.play(C, t, [{ a: 'use', uid: tk.uid }], { inv: INV(C), clone: true });
      assert.deepEqual(bad(q, `ticket d${depth}`), []);
      assert.equal(json(q.events.filter(e => e.who === b.uid && (e.k === 'healed' || e.k === 'phase')).map(e => [e.k, e.cause.k])), json([['healed', 'left'], ['phase', 'left']]), `ticket d${depth}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its phases: the tail, the crest, the alarm ----

  // Strike it from beside it on the west until it is in its third phase (or `cap` steps).
  const toPhase3 = (X, a) => (st, i) => i > 120 || a.gone || a.ax.phase >= 3 ? null : st.ui.pendingChoice ? { a: 'choose', index: 0 } : { a: 'attack', uid: a.uid };
  // The limbs its phase events told, in order: [cause, phase, stage, gained].
  const limbsTold = (ev, a) => ev.filter(e => e.k === 'phase' && e.who === a.uid).map(e => [e.cause.k, e.phase, e.stage, e.gained]);

  test('each phase from its second grows its next limb, so its tail comes only at phase 2: with every gallery walked (its neck and its legs), struck from beside it to its third phase, it grows its tail as phase 2 begins and its crest as phase 3 begins, each told after its phase\'s own sentence; with one gallery fewer (its neck alone), its legs then its tail; GUARDIAN_STAGE_MAX 3 (planted) stops at its tail; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) for (const [walked, want] of [[ALL, [['cp_ring', 3], ['cp_call', 4]]], [[2], [['cp_charge', 2], ['cp_ring', 3]]]]) {
      const tag = `d${depth} walked ${walked.length}`, s = room(depth, { walked, scale: 90 }), a = composite(C, s);
      const before = a.ax.specials.slice();
      if (json(before) !== json(walked.length > 1 ? WALKED : ['cp_sweep'])) problems.push(`${tag}: placed with ${json(before)}`);
      const r = H.play(C, s, toPhase3(C, a), { inv: INV(C), clone: depth === 4, cap: 130 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      if (a.gone || a.ax.phase !== 3) { problems.push(`${tag}: it ends in phase ${a.ax.phase}${a.gone ? ', fallen' : ''}`); continue; }
      const told = limbsTold(r.events, a), entered = told.filter(t => t[0] === 'damaged').map(t => t[1]), grew = told.filter(t => t[0] === 'limb');
      if (json(entered) !== json([2, 3]) || json(grew.map(t => [t[3], t[2], t[1]])) !== json(want.map(([sp, k], i) => [sp, k, 2 + i]))) problems.push(`${tag}: ${json(told)}`);
      // Each limb told right after its phase's own event.
      const ev = r.events.filter(e => e.k === 'phase' && e.who === a.uid);
      for (let i = 0; i < ev.length; i++) if (ev[i].cause.k === 'limb' && (i === 0 || ev[i - 1].cause.k !== 'damaged' || ev[i - 1].phase !== ev[i].phase)) problems.push(`${tag}: its ${ev[i].gained} was not told after its phase`);
      if (json(a.ax.specials) !== json(before.concat(want.map(w => w[0]))) || a.ax.stage !== before.length + 2 || a.ax.grown !== (walked.length > 1 ? 2 : 1)) problems.push(`${tag}: ${json(a.ax)}`);
      const said = r.events.filter(e => e.k === 'phase' && e.cause.k === 'limb').map(e => say(C, s, e));
      const noun = { cp_charge: 'legs', cp_ring: 'tail', cp_call: 'crest' };
      if (json(said) !== json(want.map(([sp, k], i) => `The Composite, Assembled From the Round Books grew its ${noun[sp]} as its phase ${2 + i} began: it has ${k} limbs.`))) problems.push(`${tag}: ${json(said)}`);
    }
    // GUARDIAN_STAGE_MAX 3 (planted): its tail at phase 2, nothing at phase 3.
    const X = loadCore(null, { numbers: { GUARDIAN_STAGE_MAX: 3 } }), s = room(4, { core: X, walked: ALL, scale: 90 }), a = composite(X, s);
    const r = H.play(X, s, toPhase3(X, a), { inv: Inv.select(X, 'all'), cap: 130 });
    assert.deepEqual(bad(r, 'max 3'), []);
    assert.equal(json(limbsTold(r.events, a).filter(t => t[0] === 'limb').map(t => t[3])), json(['cp_ring']));
    assert.equal(a.ax.stage, 3);
    assert.deepEqual(problems, []);
  });

  // A room with it hunting you, its limbs those given (planted: ax.specials), its next action the
  // one its turns give a special (acts).
  function hunting(depth, o) {
    const s = room(depth, Object.assign({ walked: ALL }, o)), a = composite(C, s);
    C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
    a.ax.specials = o.limbs.slice(); a.ax.stage = o.limbs.length;
    a.acts = N.CP_SPECIAL_EVERY[0] - 1;
    if (o.phase) for (const b of C.Centrepiece.pieces(s)) b.ax.phase = o.phase;
    return { s, a };
  }

  test('its crest\'s call (cp_call): beside it in its hall, its crest marks the tiles within HERALD_RANGE of it (told as the tiles its call reaches, no damage), and when it goes off every sleeper on them that can hear wakes awake, sent to look at your tile (cause herald, by it); a sleeper beyond them sleeps on; no blow, no damage from it; outside its hall it marks nothing; at depths 1–7, clone-checked', () => {
    const problems = [];
    const near = depth => ({ sp: 'S9.1', at: [9, 6], mode: 'dormant', stats: C.Roles.stats('skirmisher', depth), room: 'centre' });
    const far = depth => ({ sp: 'S9.6', at: [15, 7], mode: 'dormant', stats: C.Roles.stats('skirmisher', depth), room: 's1' });
    for (const depth of DEPTHS) {
      const tag = `d${depth}`, { s, a } = hunting(depth, { limbs: ['cp_call'], more: [near(depth), far(depth)] });
      const n = s.actors.find(b => b.sp === 'S9.1'), f = s.actors.find(b => b.sp === 'S9.6');
      const r = H.play(C, s, (st, i, x) => i > 8 || x.events.some(e => e.k === 'special' && e.who === a.uid) ? null : WAIT, { inv: INV(C), clone: true });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const mark = r.events.find(e => e.k === 'telegraphed' && e.who === a.uid), woke = r.events.filter(e => e.k === 'woke');
      const want = C.Specials.tiles(s, a, 'call');
      if (!mark || mark.sp !== 'cp_call' || json(mark.tiles) !== json(want)) problems.push(`${tag}: its mark ${json(mark)}`);
      else if (say(C, s, mark) !== 'The Composite, Assembled From the Round Books marks the tiles its call reaches for its crest, at its next action.') problems.push(`${tag}: ${say(C, s, mark)}`);
      if (json(woke.map(e => [e.who, e.cause.k, e.cause.by, e.mode, e.cause.x, e.cause.y])) !== json([[n.uid, 'herald', a.uid, 'awake', 4, 3]])) problems.push(`${tag}: woke ${json(woke)}`);
      if (f.mode !== 'dormant' || r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === a.uid && e.cause.k === 'special')) problems.push(`${tag}: ${f.mode}, ${json(r.events.filter(e => e.k === 'damaged'))}`);
    }
    // Outside its hall (in the archway, beside it there), its crest marks nothing.
    const t = room(3, { you: ARCH, at: [10, 1] }), b = composite(C, t);
    assert.equal(json(C.Specials.tiles(t, b, 'crest')), '[]');
    const u = room(3, { you: [9, 2], at: [10, 1] });
    assert.ok(C.Specials.tiles(u, composite(C, u), 'crest').length > 0);
    assert.deepEqual(problems, []);
  });

  test('the alarm, from phase 2 with alarm_network on: hunting you in its hall and seeing you, with no limb of its marked, it shows the alarm on its own tiles, and its next action raises it: the crash, every sleeper that can hear but the Centrepiece wakes, sent to look where you stood, the alarm runs, the clock comes nearer; in phase 1, with the module off, or with you outside its hall, no alarm; at depths 1–7, clone-checked', () => {
    const problems = [];
    const sleeper = depth => ({ sp: 'S9.6', at: [15, 7], mode: 'dormant', stats: C.Roles.stats('skirmisher', depth), room: 's1' });
    for (const depth of DEPTHS) for (const [phase, off, you] of [[2, false, [4, 3]], [1, false, [4, 3]], [2, true, [4, 3]], [3, false, [4, 3]]]) {
      const tag = `d${depth} phase ${phase}${off ? ' module off' : ''}`;
      const { s, a } = hunting(depth, { limbs: [], phase, modules: true, more: [sleeper(depth)], you, options: off ? { rulesOff: ['alarm_network'] } : {} });
      const hop = s.actors.find(b => b.sp === 'S9.6');
      const r = H.play(C, s, (st, i) => i > 6 ? null : WAIT, { inv: INV(C), clone: depth === 4 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const shown = r.events.filter(e => e.k === 'telegraphed' && e.sp === 'alarm'), raised = r.events.filter(e => e.k === 'alarm');
      if (phase >= 2 && !off) {
        if (json(shown.map(e => [e.who, e.tiles])) !== json([[a.uid, C.Actors.footprint(a)]])) problems.push(`${tag}: shown ${json(shown)}`);
        if (json(raised.map(e => [e.by, e.cause.k])) !== json([[a.uid, 'alarm_network']]) || !C.AlarmNetwork.running(s)) problems.push(`${tag}: raised ${json(raised)}`);
        if (!r.events.some(e => e.k === 'woke' && e.who === hop.uid && e.cause.k === 'alarm' && e.cause.by === a.uid && e.mode === 'awake' && e.cause.x === 4 && e.cause.y === 3)) problems.push(`${tag}: the sleeper ${json(r.events.filter(e => e.who === hop.uid))}`);
        if (!r.events.some(e => e.k === 'noise' && e.cls === 'crash' && e.cause.k === 'alarm' && e.cause.by === a.uid)) problems.push(`${tag}: no crash`);
        if (!r.events.some(e => e.k === 'module' && e.rule === 'call' && e.who === a.uid)) problems.push(`${tag}: no call`);
        const words = r.events.filter(e => e.k === 'module' && e.who === a.uid).map(e => say(C, s, e));
        if (!words.some(w => /has seen you, and shows the alarm: at its next action it raises it\./.test(w))) problems.push(`${tag}: ${json(words)}`);
      } else if (shown.length || raised.length || hop.mode !== 'dormant') problems.push(`${tag}: an alarm ${json(shown.concat(raised))}`);
    }
    // You in the archway, outside its hall, in its sight: it holds back, and shows no alarm.
    for (const depth of [1, 7]) {
      const { s, a } = hunting(depth, { limbs: [], phase: 2, modules: true, you: ARCH, at: [8, 1] });
      const r = H.play(C, s, (st, i) => i > 4 ? null : WAIT, { inv: INV(C) });
      problems.push(...bad(r, `outside d${depth}`));
      if (r.events.some(e => e.k === 'telegraphed' && e.who === a.uid)) problems.push(`outside d${depth}: it marked ${json(r.events.filter(e => e.k === 'telegraphed'))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('every mark of its equals what it deals, joined up from full health to its fall, its limbs grown by walking and by its phases (its tail, then its crest): each special that struck you dealt what its mark showed (centrepiece.inv\'s marks), the gross through your Padding, and its crest, a call, struck no one; its fall earns nothing; at depths 1–7, clone-checked at depth 4', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const tag = `d${depth}`, s = room(depth, { walked: ALL, scale: 120 }), a = composite(C, s);
      const r = H.play(C, s, (st, i) => i > 250 || a.gone ? null : st.ui.pendingChoice ? { a: 'choose', index: 0 } : { a: 'attack', uid: a.uid }, { inv: INV(C), clone: depth === 4, cap: 260 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      if (!a.gone) problems.push(`${tag}: it still stands at ${a.hp}`);
      const gross = C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', depth), dmg = Math.max(N.DMG_MIN_ON_HIT, gross - s.actors[0].pad);
      const struck = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === a.uid);
      const marked = new Set(r.events.filter(e => e.k === 'telegraphed' && e.who === a.uid).map(e => e.sp));
      for (const sp of ['cp_sweep', 'cp_charge', 'cp_ring', 'cp_call']) if (!marked.has(sp)) problems.push(`${tag}: its ${sp} was never marked`);
      for (const e of struck) if (e.amount !== dmg || e.cause.sp === 'cp_call') problems.push(`${tag}: ${e.cause.sp} dealt ${e.amount}, not ${dmg}`);
      if (r.events.some(e => ['certificate', 'dropped'].includes(e.k))) problems.push(`${tag}: its fall gave ${json(r.events.filter(e => ['certificate', 'dropped'].includes(e.k)))}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- In S.9's own departments ----

  test('the race, joined up in S.9\'s departments (its core planted ready; seeds 1–3 at depths 1, 4 and 7; alarm_network and unobserved_motion each on and off): beside the Lamp\'s case, bash it open, take the Lamp and walk to the nearest opening: you carry it out (the Certificate, by treasure, at the turn\'s end that finds you outside), unless the hall sealed first, TREASURE_SEAL_TURNS turns after the touch; every invariant holds, and every event it causes is one its line covers', () => {
    const X = readyCore(), problems = [], tally = { out: 0, sealed: 0 };
    const OFF = [[], ['alarm_network'], ['unobserved_motion'], ['alarm_network', 'unobserved_motion']];
    for (const depth of [1, 4, 7]) for (const seed of [1, 2, 3]) for (const rulesOff of OFF) {
      const tag = `seed ${seed} d${depth}${rulesOff.length ? ' ' + rulesOff.join('+') + ' off' : ''}`;
      const s = X.Dept.create(seed, 'S9', depth, { invulnerable: true, rulesOff }), m = s.dept, f = X.Treasure.caseOf(s), lamp = X.Treasure.item(s);
      if (!f || !lamp || lamp.where.at !== 'case') { problems.push(`${tag}: the case ${json(f)}, the Lamp ${json(lamp)}`); continue; }
      // Beside the case, inside the hall.
      const at = [0, 2, 4, 6, 1, 3, 5, 7].map(d => [f.x + X.Grid.DX[d], f.y + X.Grid.DY[d]]).find(([x, y]) => X.Grid.walkable(m, x, y) && !X.Actors.at(s, x, y) && X.Hall.inside(s, x, y));
      s.actors[0].x = at[0]; s.actors[0].y = at[1];
      const out = X.Grid.distances(m, X.Hall.openings(s).map(o => [o.x, o.y]), m.w * m.h, null, 'you');
      const r = H.play(X, s, st => {
        if (st.ui.pendingChoice) return { a: 'choose', index: 0 };
        if (st.dept.cp.treasure || X.Clock.sealed(st)) return null;
        const c = X.Cases.at(st, f.x, f.y), it = X.Treasure.item(st);
        if (it.where.at === 'case' && c.st === 'shut') return { a: 'bash', x: f.x, y: f.y };
        if (it.where.at === 'case') return { a: 'take', uid: it.uid };
        const you = st.actors[0], here = out[you.y * m.w + you.x];
        // A step to a free tile nearer an opening, else one as near (round whoever is in the
        // way), else a wait.
        const moves = X.Step.legal(st).filter(a => a.a === 'move').map(a => [a, you.x + X.Grid.DX[a.dir], you.y + X.Grid.DY[a.dir]]).filter(([, x, y]) => out[y * m.w + x] >= 0 && !X.Actors.at(st, x, y));
        const down = moves.filter(([, x, y]) => out[y * m.w + x] < here), side = moves.filter(([, x, y]) => out[y * m.w + x] === here);
        return down.length ? down[0][0] : side.length ? side[0][0] : { a: 'wait' };
      }, { inv: INV(X), clone: seed === 1 && depth === 4 && !rulesOff.length, cap: 60 });
      problems.push(...bad(r, tag), ...covered(X, s, r.events).map(l => `${tag}: ${l}`));
      const touched = X.Treasure.touched(s), got = certs(r.events).filter(e => e.cause.k === 'treasure'), shut = stages(r.events, 'sealed');
      if (got.length === 1 && !shut.length) tally.out++;
      // (Sealed later only if it waited on an opening someone stood in, from its turn on.)
      else if (shut.length === 1 && !got.length && touched !== null && (shut[0].turn - touched === N.TREASURE_SEAL_TURNS
        || (shut[0].turn - touched > N.TREASURE_SEAL_TURNS && stages(r.events, 'waiting').some(e => e.turn - touched === N.TREASURE_SEAL_TURNS)))) tally.sealed++;
      else problems.push(`${tag}: carried out ${json(got)}, sealed ${json(shut)}, touched on turn ${touched}`);
    }
    // Both happen in these departments: the race is a real one.
    assert.deepEqual(problems, []);
    assert.ok(tally.out > 0 && tally.sealed > 0 && tally.out + tally.sealed === 3 * 3 * OFF.length, json(tally));
  });

  // ---- Its gateway label ----

  test('its gateway label (D3.8), on the lectern: 40–120 words, naming it first, and claiming no rule (no number of record, no "you", no limb, seal or Certificate); the lectern reads it first', () => {
    const rec = C.Packs.get('S9').centrepiece, words = rec.gateway.split(/\s+/).length;
    assert.ok(words >= 40 && words <= 120 && rec.gateway.startsWith(`${rec.name}. `), `${words} words`);
    assert.doesNotMatch(rec.gateway, /\byou\b|limb|seal|Certificate|turns?\b|health|alarm/i);
    assert.ok(!/[{}]/.test(rec.gateway) && /\.$/.test(rec.gateway));
  });
};
