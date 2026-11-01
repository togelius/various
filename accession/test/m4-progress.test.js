// Certificates and the grade (BUILD.md §8.7; M4 plan PG-CORE, A3, A5, D4.10, D4.12, D4.13):
//   - each of the three routes (defeat, view, treasure) earns the Certificate with its events in
//     §8.7's order: the Certificate, your grade one higher with HP_PER_GRADE more maximum
//     health, then CERT_HEAL back up to that new maximum, then the perk offer; in all three
//     departments at depths 1–7, with the median visitor's grade there;
//   - once a visit; never past GRADE_MAX, where the log says the grade stays; nothing for a
//     visit that is over;
//   - the perk choice: taken at the rank offered, at no cost in time, refused when an option is
//     not the rank above yours;
//   - an empty offer gives no perk, the log says so and no choice waits; an offer of one or two
//     perks is shown as it is;
//   - the award reads HP_PER_GRADE and CERT_HEAL (set apart, so neither stands in for the
//     other), and a room that names no department cannot give a Certificate;
//   - a perk offer and the Catalogue Card's seal choice, in both orders: neither ever leaves a
//     choice with no answer; death while either waits ends the visit with it unanswered, and
//     leaving waits for every answer;
//   - joined-up scenarios at depths 1–7 with every invariant on and a clone check, and the
//     invariants of test/behaviour/progress.inv.js shown failing on planted states.
// The expected figures are worked out here from BUILD.md, never from the code.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const N = C.N;
  const json = x => JSON.stringify(x);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const DEPTS = ['S9', 'A4', 'M11'];
  const ALL = ['soft_soles', 'vanishing_act', 'light_fingers', 'single_file', 'elbow_room', 'second_wind', 'duck_and_cover', 'close_the_distance'];
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  // Your maximum health at a grade (§8.1): 20, and 5 more a grade above I.
  const maxAt = g => 20 + 5 * (g - 1);
  const room = (X, o) => {
    o = o || {};
    const s = X.Setup.room(o.seed || 1, { acc: o.acc || 'S9', depth: o.depth || 1, grade: o.grade || 1, map: OPEN, you: [2, 3], exhibits: [], fixtures: o.fixtures || [], exits: o.exits || [] });
    if (o.hp !== undefined) s.actors[0].hp = o.hp;
    if (o.perks) s.run.perks = o.perks.map(p => ({ id: p[0], rank: p[1] }));
    return s;
  };
  const cause = how => how === 'defeat' ? { k: 'defeat', by: 'S9.1.room.1' } : { k: how };
  const checked = (X, ev) => { for (const e of ev) { const bad = X.Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|\bnull\b/.test(s);
  const said = (X, s, ev) => ev.map(e => { const t = X.Text.event(e, X.Labels.nameOf(s)); assert.ok(clean(t), `${e.k}: ${json(t)}`); return t; });
  const kinds = ev => ev.map(e => e.k + (e.cause ? '.' + e.cause.k : ''));
  const allAt = (rank, except) => ALL.filter(id => !(except || []).some(p => p[0] === id)).map(id => [id, rank]).concat(except || []);

  // ---- The three routes, in order ----

  test('each route earns the Certificate: its event, then the grade and +5 maximum health, then 5 health back, then the offer, at depths 1–7', () => {
    for (const acc of DEPTS) for (let d = 1; d <= 7; d++) for (const how of ['defeat', 'view', 'treasure']) {
      const g = Math.min(7, d), s = room(C, { acc, depth: d, grade: g }), you = s.actors[0], at = `${acc} d${d} ${how}`;
      assert.equal(you.maxHp, maxAt(g), at);
      you.hp = you.maxHp - 2;
      assert.ok(!('cert' in s.dept) && !('offer' in s.dept), 'absent until a Certificate (§4.1)');
      assert.equal(C.Progress.cert(s), null);
      const ev = [];
      assert.equal(C.Progress.award(s, how, cause(how), ev), true, at);
      checked(C, ev);
      const up = g < 7;
      assert.equal(json(kinds(ev)), json(['certificate.' + how, up ? 'grade.certificate' : 'grade.highest', 'healed.certificate']), at);
      assert.equal(json([ev[0].acc, ev[0].how]), json([acc, how]));
      assert.equal(ev[1].grade, up ? g + 1 : 7);
      assert.equal(s.run.grade, up ? g + 1 : 7);
      assert.equal(you.maxHp, maxAt(up ? g + 1 : 7), at);
      // +5 maximum first, then 5 back: 2 short of the old maximum is 2 short of the new one.
      assert.equal(json([ev[2].who, ev[2].amount, ev[2].hp, you.hp]), json(['you', up ? 5 : 2, you.maxHp - (up ? 2 : 0), you.maxHp - (up ? 2 : 0)]), at);
      assert.equal(json(s.dept.cert), json({ how, turn: s.turn }));
      assert.equal(json(C.Progress.cert(s)), json({ how, turn: s.turn }));
      assert.equal(json(s.run.certificates), json([{ acc, depth: d, how, turn: s.turn }]));
      assert.equal(s.ui.pendingChoice.k, 'perk');
      assert.equal(s.ui.pendingChoice.options.length, 3);
      const words = said(C, s, ev);
      // §8.7: each part in the log, the raised maximum too (the heal may pass the old one).
      assert.equal(words[1], up ? `Your Handling Clearance is now Grade ${ROMAN[g + 1]}, and your maximum health is 5 higher.` : 'Your Handling Clearance stays at Grade VII, the highest there is, and so does your maximum health.');
      assert.doesNotMatch(words[1], /Grade \d/);
    }
    // The causes' sentences: 28 of 30 becomes 33 of 35, and the log says why 33 is not too many.
    const s = room(C, { acc: 'S9', depth: 3, grade: 3, hp: 28 });
    const ev = []; C.Progress.award(s, 'view', { k: 'view' }, ev);
    assert.equal(json(said(C, s, ev)), json(['You earned this department’s Certificate: you viewed its Centrepiece.', 'Your Handling Clearance is now Grade IV, and your maximum health is 5 higher.',
      'You healed 5 with the Certificate: now 33.']));
  });

  test('the award reads its numbers: HP_PER_GRADE for the maximum and its sentence, CERT_HEAL for the heal', () => {
    // Set apart (7 and 3), so neither can stand in for the other; the invariants read them too.
    const X = loadCore(null, { numbers: { HP_PER_GRADE: 7, CERT_HEAL: 3 } });
    const invs = Inv.select(X, ['progress']);
    for (const [g, hp, wantMax, wantHp] of [[3, 30, 41, 33], [3, 34, 41, 37], [1, 10, 27, 13], [7, 60, 62, 62], [7, 50, 62, 53]]) {
      const s = X.Setup.room(1, { acc: 'M11', depth: g, grade: g, map: OPEN, you: [2, 3], exhibits: [] }), you = s.actors[0];
      assert.equal(you.maxHp, 20 + 7 * (g - 1));
      you.hp = Math.min(hp, you.maxHp);
      const pre = X.State.clone(s), ev = [];
      X.Progress.award(s, 'view', { k: 'view' }, ev);
      assert.equal(json([you.maxHp, you.hp]), json([wantMax, wantHp]), `grade ${g}, ${hp} health`);
      assert.deepEqual(Inv.checker(X, invs)(pre, { a: 'wait' }, ev, s).map(v => v.text), [], `grade ${g}`);
      const words = X.Text.log(ev, X.Labels.nameOf(s));
      if (g < 7) assert.ok(words.includes(`Your Handling Clearance is now Grade ${ROMAN[g + 1]}, and your maximum health is 7 higher.`), json(words));
    }
  });

  test('a Certificate is a department\'s: a room that names none cannot give one, and asking it to throws', () => {
    const s = C.Setup.room(1, { map: OPEN, you: [2, 3], exhibits: [] }), before = json(s), ev = [];
    assert.throws(() => C.Progress.award(s, 'view', { k: 'view' }, ev), /a Certificate is a department's/);
    assert.equal(json(s), before); assert.equal(ev.length, 0);
  });

  test('+5 maximum health, then 5 back, in that order: never capped at the old maximum; nothing to heal at full health', () => {
    for (const [g, hp, wantHp, healed] of [[3, 30, 35, 5], [3, 28, 33, 5], [3, 1, 6, 5], [1, 20, 25, 5], [7, 50, 50, 0], [7, 48, 50, 2], [7, 40, 45, 5], [6, 45, 50, 5]]) {
      const s = room(C, { depth: g, grade: g, hp }), ev = [];
      C.Progress.award(s, 'view', { k: 'view' }, ev);
      const h = ev.filter(e => e.k === 'healed');
      assert.equal(json([s.actors[0].hp, s.actors[0].maxHp]), json([wantHp, maxAt(Math.min(7, g + 1))]), `grade ${g}, ${hp} health`);
      assert.equal(h.length ? h[0].amount : 0, healed, `grade ${g}, ${hp} health`);
      assert.equal(s.actors[0].maxHp, C.Health.maxHp(s.run.grade), 'your maximum health is your grade\'s');
    }
  });

  test('a Certificate is earned once a visit, never in a visit that is over, and only by defeat, view or treasure', () => {
    const s = room(C, { depth: 2, grade: 2 }), ev = [];
    assert.equal(C.Progress.award(s, 'defeat', { k: 'defeat', by: 'S9.1.room.1' }, ev), true);
    const h = C.State.hash(s), ev2 = [];
    for (const how of ['defeat', 'view', 'treasure']) assert.equal(C.Progress.award(s, how, cause(how), ev2), false, how);
    assert.equal(ev2.length, 0); assert.equal(C.State.hash(s), h);
    // Still once after the perk is taken.
    C.Step.step(s, { a: 'choose', index: 0 });
    const h2 = C.State.hash(s);
    assert.equal(C.Progress.award(s, 'view', { k: 'view' }, ev2), false); assert.equal(C.State.hash(s), h2);
    // A visit that is over, or you gone: nothing.
    const over = room(C); over.over = { k: 'died', turn: 0, by: null, door: null, cause: null };
    const h3 = C.State.hash(over);
    assert.equal(C.Progress.award(over, 'view', { k: 'view' }, ev2), false); assert.equal(C.State.hash(over), h3); assert.equal(ev2.length, 0);
    const gone = room(C); gone.actors[0].gone = 1;
    assert.equal(C.Progress.award(gone, 'view', { k: 'view' }, ev2), false); assert.equal(ev2.length, 0);
    // A way that is not one, or a cause that is not the way's, is a bug in the caller.
    assert.throws(() => C.Progress.award(room(C), 'kill', { k: 'kill' }, []), /defeat, view, treasure, not "kill"/);
    assert.throws(() => C.Progress.award(room(C), 'view', { k: 'defeat' }, []), /needs the cause/);
    assert.throws(() => C.Progress.award(room(C), 'view', null, []), /needs the cause/);
  });

  test('the grade never passes VII: from grade I, a Certificate a visit takes it to VII and leaves it there, health with it', () => {
    let grade = 1;
    for (let visit = 1; visit <= 9; visit++) {
      const s = C.Dept.create(visit, 'M11', Math.min(visit, 7), { carry: { grade } });
      assert.equal(s.actors[0].maxHp, maxAt(grade));
      const ev = [];
      C.Progress.award(s, 'treasure', { k: 'treasure' }, ev);
      const want = Math.min(7, grade + 1);
      assert.equal(json([s.run.grade, s.actors[0].maxHp]), json([want, maxAt(want)]), `visit ${visit}`);
      assert.equal(ev.find(e => e.k === 'grade').cause.k, grade < 7 ? 'certificate' : 'highest');
      grade = s.run.grade;
    }
    assert.equal(grade, 7);
  });

  test('the grade raises what reads it by your next decision: your stats (a short Heavy weapon) and the case locks you open', () => {
    // A T2 Heavy weapon needs grade IV (§8.1: 2t − 1, and Heavy one more): at grade III it is 1 short.
    const X = loadCore();
    const map = ['############', '#..........#', '#.v........#', '#..........#', '#..........#', '#..........#', '############'];
    const s = X.Setup.room(1, { acc: 'S9', depth: 3, grade: 3, map, you: [2, 3], exhibits: [], fixtures: [{ k: 'planted_cert', x: 3, y: 3 }, X.Cases.make({ x: 2, y: 2, num: '9.1', lock: 4 })] });
    X.Fixtures.addReader('planted_cert', () => ({ text: null, effects: (st, ev) => X.Progress.award(st, 'view', { k: 'view' }, ev) }));
    const w = s.items.find(i => i.uid === 'you.w'); w.form = 'heavy'; w.tier = 2; X.Kit.settle(s);
    const acc3 = s.actors[0].acc, opens = () => X.Step.legal(s).some(a => a.a === 'open' && a.x === 2 && a.y === 2);
    assert.ok(!opens(), 'a Grade IV lock at grade III');
    checked(X, X.Step.step(s, { a: 'read', x: 3, y: 3 }));
    X.Step.step(s, { a: 'choose', index: 0 });
    assert.equal(s.run.grade, 4);
    assert.equal(s.actors[0].acc, acc3 + N.SHORT_ACC, 'no longer short of the weapon\'s grade');
    assert.equal(json(s.actors[0]), json(Object.assign({}, s.actors[0], X.Kit.derive(s))), 'your stats are settled at your new grade');
    assert.ok(opens(), 'the Grade IV lock opens at grade IV');
  });

  // ---- The perk choice ----

  test('the perk choice: the perk at the index is yours at the rank offered, at no cost in time; a rank-2 perk goes up in place', () => {
    for (const index of [0, 1, 2]) {
      const s = room(C, { acc: 'M11', depth: 3, grade: 3, perks: [['soft_soles', 1], ['duck_and_cover', 1]] });
      C.Progress.award(s, 'view', { k: 'view' }, []);
      const opts = s.ui.pendingChoice.options;
      assert.equal(json(opts), json([{ id: 'duck_and_cover', rank: 2 }, { id: 'close_the_distance', rank: 1 }, { id: 'second_wind', rank: 1 }]));
      assert.equal(json(C.Step.legal(s)), json([0, 1, 2].map(i => ({ a: 'choose', index: i }))), 'only the answers are legal');
      assert.equal(C.Step.step(C.State.clone(s), { a: 'wait' })[0].reason, 'choice_pending');
      const tick = s.tick, next = s.actors[0].next;
      const ev = checked(C, C.Step.step(s, { a: 'choose', index }));
      const o = opts[index];
      assert.equal(json(ev.map(e => [e.k, e.id, e.rank, e.cause.k])), json([['perk', o.id, o.rank, 'chosen']]));
      assert.equal(json([s.tick, s.actors[0].next, s.ui.pendingChoice]), json([tick, next, null]), 'free');
      const want = index === 0 ? [['soft_soles', 1], ['duck_and_cover', 2]] : [['soft_soles', 1], ['duck_and_cover', 1], [o.id, 1]];
      assert.equal(json(s.run.perks), json(want.map(p => ({ id: p[0], rank: p[1] }))));
      assert.equal(said(C, s, ev)[0], index === 0 ? 'You took the perk Duck and Cover, at rank 2.' : `You took the perk ${C.Registry.PERKS[o.id].name}.`);
      assert.ok(C.Step.legal(s).some(a => a.a === 'wait'), 'the visit goes on');
    }
    // In place: a perk you hold goes up where it is, not to the end (here it is held first).
    const p = room(C, { acc: 'M11', depth: 3, grade: 3, perks: [['duck_and_cover', 1], ['soft_soles', 1], ['second_wind', 1]] });
    C.Progress.award(p, 'view', { k: 'view' }, []);
    assert.equal(json(p.ui.pendingChoice.options[0]), json({ id: 'duck_and_cover', rank: 2 }));
    checked(C, C.Step.step(p, { a: 'choose', index: 0 }));
    assert.equal(json(p.run.perks), json([{ id: 'duck_and_cover', rank: 2 }, { id: 'soft_soles', rank: 1 }, { id: 'second_wind', rank: 1 }]));
    // An option that is not a perk at the rank above yours is refused, and the choice waits.
    const s = room(C, { acc: 'A4', depth: 2, grade: 2 });
    C.Progress.award(s, 'view', { k: 'view' }, []);
    for (const bad of [{ id: 'single_file', rank: 2 }, { id: 'planted', rank: 1 }, { id: 'single_file' }, null]) {
      s.ui.pendingChoice.options[0] = bad;
      const h = C.State.hash(s);
      assert.equal(json(C.Step.step(s, { a: 'choose', index: 0 }).map(e => e.reason)), json(['choice_bad']), json(bad));
      assert.equal(C.State.hash(s), h);
    }
    assert.equal(json(C.Step.step(s, { a: 'choose', index: 3 }).map(e => e.reason)), json(['choice_bad']));
  });

  // ---- Empty, one and two ----

  test('an empty offer gives no perk: the log says so, no choice waits and the visit goes on', () => {
    for (const acc of DEPTS) {
      const s = room(C, { acc, depth: 4, grade: 4, perks: allAt(2) }), ev = [];
      assert.equal(json(C.Progress.offer(s)), '[]');
      C.Progress.award(s, 'view', { k: 'view' }, ev);
      checked(C, ev);
      assert.equal(json(kinds(ev)), json(['certificate.view', 'grade.certificate', 'healed.certificate', 'perk.none']), acc);
      assert.equal(ev[3].id, undefined); assert.equal(ev[3].rank, undefined);
      assert.equal(s.ui.pendingChoice, null); assert.ok(!('offer' in s.dept));
      const log = C.Text.log(ev, C.Labels.nameOf(s));
      assert.ok(log.includes('No perk was offered: you already hold every perk at its highest rank.'), json(log));
      assert.ok(C.Step.legal(s).some(a => a.a === 'wait'));
      assert.equal(C.Step.step(s, { a: 'wait' })[0].k !== 'refused', true);
    }
  });

  test('an offer of one or two perks is shown as it is, and taken as any other', () => {
    for (const acc of DEPTS) {
      let s = room(C, { acc, depth: 2, grade: 2, perks: allAt(2, [['light_fingers', 1]]) });
      C.Progress.award(s, 'view', { k: 'view' }, []);
      assert.equal(json(s.ui.pendingChoice), json({ k: 'perk', options: [{ id: 'light_fingers', rank: 2 }] }), acc);
      assert.equal(json(C.Step.legal(s)), json([{ a: 'choose', index: 0 }]));
      checked(C, C.Step.step(s, { a: 'choose', index: 0 }));
      assert.equal(C.Perks.rank(s, 'light_fingers'), 2); assert.equal(s.ui.pendingChoice, null);
      // Two left: Elbow Room not held, Second Wind at rank 1.
      s = room(C, { acc, depth: 2, grade: 2, perks: allAt(2, [['elbow_room', 0], ['second_wind', 1]]).filter(p => p[1] > 0) });
      C.Progress.award(s, 'view', { k: 'view' }, []);
      const opts = s.ui.pendingChoice.options;
      assert.equal(opts.length, 2, acc);
      assert.equal(json(opts.map(o => o.id).sort()), json(['elbow_room', 'second_wind']));
      assert.equal(json(opts.map(o => o.rank)), json(opts.map(o => o.id === 'second_wind' ? 2 : 1)));
      assert.equal(C.Step.legal(s).length, 2);
    }
  });

  // ---- A perk offer and the Catalogue Card's choice, both orders ----

  // A room with a Catalogue Card in the tote (known, so it offers the six unknown seals).
  function cardRoom(X, o) {
    const s = room(X, Object.assign({ acc: 'S9', depth: 3, grade: 3 }, o));
    X.Consumables.startRun(s);
    const you = s.actors[0], it = X.Consumables.make(s, 'card', { at: 'floor', x: you.x, y: you.y });
    it.where = { at: 'tote' }; it.n = 2; s.you.tote.push(it.uid);
    for (const ck of ['card', 'plan']) s.run.knownSeals.push(X.Consumables.sealFor(s, ck));
    return { s, card: it.uid };
  }

  test('the Card first: a Certificate earned while its seal choice waits makes the offer wait behind it, raised once the seal is chosen', () => {
    // The Certificate comes as the world acts after your reading (as a Centrepiece's last piece
    // falling in the world's turn would), at the first turn boundary.
    const X = loadCore();
    const boundary = X.Hall.boundary;
    let armed = false;
    X.Hall.boundary = (st, ev) => { if (armed) { armed = false; X.Progress.award(st, 'defeat', { k: 'defeat', by: 'S9.3.room.1' }, ev); } return boundary(st, ev); };
    for (const depth of [1, 4, 7]) {
      const { s, card } = cardRoom(X, { depth, grade: depth });
      armed = true;
      const ev = checked(X, X.Step.step(s, { a: 'use', uid: card }));
      assert.ok(ev.some(e => e.k === 'certificate'), 'earned during the reading\'s turn');
      assert.equal(s.ui.pendingChoice.k, 'seal', 'the Card\'s choice is the one waiting');
      const offer = X.Progress.waiting(s);
      assert.equal(offer.length, 3); assert.equal(json(s.dept.offer), json(offer));
      // Only the seal's answers are legal; nothing else, and no perk is taken by them.
      assert.equal(json(X.Step.legal(s)), json(s.ui.pendingChoice.options.map((o, index) => ({ a: 'choose', index }))));
      assert.equal(X.Step.step(X.State.clone(s), { a: 'wait' })[0].reason, 'choice_pending');
      // Asked while the seal still waits, afterChoice leaves both as they are.
      const t = X.State.clone(s), th = X.State.hash(t);
      X.Progress.afterChoice(t, []);
      assert.equal(X.State.hash(t), th, 'the offer is not raised over the Card\'s choice');
      const ev2 = checked(X, X.Step.step(s, { a: 'choose', index: 1 }));
      assert.equal(json(ev2.map(e => e.k)), json(['identified']));
      assert.equal(json(s.ui.pendingChoice), json({ k: 'perk', options: offer }), 'the offer is raised');
      assert.ok(!('offer' in s.dept)); assert.equal(json(X.Progress.waiting(s)), '[]');
      assert.equal(json(X.Step.legal(s)), json([0, 1, 2].map(index => ({ a: 'choose', index }))));
      const ev3 = checked(X, X.Step.step(s, { a: 'choose', index: 2 }));
      assert.equal(json(ev3.map(e => [e.k, e.id])), json([['perk', offer[2].id]]));
      assert.equal(s.ui.pendingChoice, null);
      assert.ok(X.Step.legal(s).some(a => a.a === 'wait'));
    }
    // An empty offer behind the Card waits for nothing: no perk, said at once.
    const { s, card } = cardRoom(X, { perks: allAt(2) });
    armed = true;
    const ev = X.Step.step(s, { a: 'use', uid: card });
    assert.ok(ev.some(e => e.k === 'perk' && e.cause.k === 'none'));
    assert.ok(!('offer' in s.dept));
    X.Step.step(s, { a: 'choose', index: 0 });
    assert.equal(s.ui.pendingChoice, null);
  });

  test('the offer first: while the perk choice waits the Card cannot be read, and once a perk is taken it can, its own choice working as before', () => {
    const X = loadCore();
    X.Fixtures.addReader('planted_cert', () => ({ text: null, effects: (st, ev) => X.Progress.award(st, 'view', { k: 'view' }, ev) }));
    for (const depth of [2, 5]) {
      const { s, card } = cardRoom(X, { depth, grade: depth, fixtures: [{ k: 'planted_cert', x: 3, y: 3 }] });
      const ev = checked(X, X.Step.step(s, { a: 'read', x: 3, y: 3 }));
      assert.ok(ev.some(e => e.k === 'certificate'), 'earned in your own action');
      assert.equal(s.ui.pendingChoice.k, 'perk');
      assert.equal(json(X.Step.step(X.State.clone(s), { a: 'use', uid: card }).map(e => e.reason)), json(['choice_pending']));
      assert.ok(!X.Step.legal(s).some(a => a.a === 'use'));
      assert.equal(X.Step.legal(s).length, 3);
      const taken = s.ui.pendingChoice.options[1];
      checked(X, X.Step.step(s, { a: 'choose', index: 1 }));
      assert.equal(X.Perks.rank(s, taken.id), 1);
      assert.equal(s.ui.pendingChoice, null);
      // The Card now reads, and its seal choice is answered as ever; no offer comes back.
      checked(X, X.Step.step(s, { a: 'use', uid: card }));
      assert.equal(s.ui.pendingChoice.k, 'seal');
      checked(X, X.Step.step(s, { a: 'choose', index: 0 }));
      assert.equal(s.ui.pendingChoice, null);
      assert.ok(!('offer' in s.dept));
      assert.equal(json(s.run.perks), json([{ id: taken.id, rank: 1 }]));
    }
  });

  // ---- Death and leaving while an offer waits ----

  test('death while an offer waits ends the visit with it unanswered, nothing left to give; leaving waits for every answer', () => {
    // The Certificate comes as the world acts (as a Centrepiece's last piece falling in the
    // world's turn would), at the first turn boundary, and the world may then kill you in that
    // same turn, with the perk choice waiting, or with the offer waiting behind a Card's.
    const X = loadCore();
    const boundary = X.Hall.boundary, invs = Inv.select(X, ['progress']);
    let armed = null;
    X.Hall.boundary = (st, ev) => { if (armed) { const f = armed; armed = null; f(st, ev); } return boundary(st, ev); };
    const award = (st, ev) => X.Progress.award(st, 'defeat', { k: 'defeat', by: 'S9.3.room.1' }, ev);
    const die = (st, ev) => X.Combat.hurt(st, st.actors[0], 999, { k: 'special', by: 'S9.3.room.1', sp: 'cp_burst', gross: 999, pad: 0, net: 999, x: 2, y: 3, from: [3, 3] }, ev);
    const play = (s, a) => {
      const pre = X.State.clone(s), ev = checked(X, X.Step.step(s, a));
      assert.deepEqual(Inv.checker(X, invs)(pre, a, ev, s).map(v => v.text), [], json(a));
      return ev;
    };
    const ended = (s, what) => {
      assert.equal(s.over.k, 'died', what);
      assert.equal(json(X.Step.legal(s)), '[]', `${what}: nothing is legal`);
      assert.equal(json(X.Step.step(X.State.clone(s), { a: 'choose', index: 0 }).map(e => e.reason)), json(['visit_over']), what);
      const h = X.State.hash(s);
      X.Progress.afterChoice(s, []);
      assert.equal(X.State.hash(s), h, `${what}: nothing is raised over a finished visit`);
      assert.equal(json(s.run.perks), '[]', `${what}: no perk was taken`);
      assert.equal(s.run.certificates.length, 1, `${what}: the Certificate stays earned`);
    };
    for (const depth of [1, 4, 7]) {
      // The perk choice waiting.
      let s = room(X, { depth, grade: depth });
      armed = (st, ev) => { award(st, ev); die(st, ev); };
      let ev = play(s, { a: 'wait' });
      assert.ok(kinds(ev).indexOf('certificate.defeat') < ev.findIndex(e => e.k === 'died'), 'the Certificate, then the death');
      assert.equal(s.ui.pendingChoice.k, 'perk');
      ended(s, `d${depth}, the perk choice waiting`);
      // The offer waiting behind the Card's seal choice.
      const c = cardRoom(X, { depth, grade: depth });
      s = c.s;
      armed = (st, ev) => { award(st, ev); die(st, ev); };
      ev = play(s, { a: 'use', uid: c.card });
      assert.equal(s.ui.pendingChoice.k, 'seal'); assert.equal(X.Progress.waiting(s).length, 3);
      ended(s, `d${depth}, the offer behind the Card`);
      // Death first, then the way to the Certificate in the same turn: the visit is over, so nothing.
      s = room(X, { depth, grade: depth });
      let got = null;
      armed = (st, ev) => { die(st, ev); got = award(st, ev); };
      ev = play(s, { a: 'wait' });
      assert.equal(got, false); assert.ok(!ev.some(e => e.k === 'certificate'));
      assert.equal(json([s.run.certificates, X.Progress.cert(s), s.ui.pendingChoice]), json([[], null, null]));
    }
    // afterChoice, asked of a finished visit with an offer still in dept.offer, raises nothing.
    const t = room(X, { depth: 2, grade: 2 });
    t.dept.offer = [{ id: 'second_wind', rank: 1 }]; t.over = { k: 'died', turn: 0, by: null, door: null, cause: null };
    X.Progress.afterChoice(t, []);
    assert.equal(t.ui.pendingChoice, null);

    // Leaving: refused while any choice waits, the perk's or the Card's with the offer behind it;
    // once the perk is taken you leave with it and the Certificate.
    for (const viaCard of [false, true]) {
      const c = cardRoom(X, { depth: 3, grade: 3, exits: [[2, 3]] }), s = c.s;
      assert.ok(X.Step.legal(s).some(a => a.a === 'leave'));
      armed = award;
      play(s, viaCard ? { a: 'use', uid: c.card } : { a: 'wait' });
      const refusedLeave = () => assert.equal(json(X.Step.step(X.State.clone(s), { a: 'leave', i: 0 }).map(e => e.reason)), json(['choice_pending']));
      refusedLeave();
      if (viaCard) { assert.equal(s.ui.pendingChoice.k, 'seal'); play(s, { a: 'choose', index: 0 }); refusedLeave(); }
      assert.equal(s.ui.pendingChoice.k, 'perk');
      assert.ok(X.Step.legal(s).every(a => a.a === 'choose'));
      const taken = s.ui.pendingChoice.options[0];
      play(s, { a: 'choose', index: 0 });
      const ev = play(s, { a: 'leave', i: 0 });
      assert.equal(json([s.over.k, ev.map(e => e.k)]), json(['left', ['left']]));
      assert.equal(json([s.run.perks, s.run.certificates.length]), json([[taken], 1]));
    }
  });

  // ---- Joined up, with every invariant ----

  test('scenarios at depths 1–7 in each department: earn, take the perk, play on; every invariant held, clone-stable', () => {
    const X = loadCore();
    X.Fixtures.addReader('planted_cert', () => ({ text: null, effects: (st, ev) => X.Progress.award(st, 'view', { k: 'view' }, ev) }));
    let runs = 0;
    for (const acc of DEPTS) for (let d = 1; d <= 7; d++) for (const held of [[], [['second_wind', 1]], [['second_wind', 1], ['elbow_room', 2]], allAt(2, [['soft_soles', 1]]), allAt(2)]) {
      const s = H.room(X, d, { acc, depth: d, grade: Math.min(7, d), map: OPEN, you: [2, 3], exhibits: [], fixtures: [{ k: 'planted_cert', x: 3, y: 3 }] });
      s.run.perks = held.map(p => ({ id: p[0], rank: p[1] }));
      s.actors[0].hp -= 3;
      const acts = (st, i) => i === 0 ? { a: 'read', x: 3, y: 3 } : st.ui.pendingChoice ? { a: 'choose', index: st.ui.pendingChoice.options.length - 1 } : i < 6 ? { a: 'wait' } : i === 6 ? { a: 'read', x: 3, y: 3 } : null;
      const r = H.play(X, s, acts, { inv: 'all', clone: true, cap: 20 });
      assert.deepEqual(r.violations.map(v => v.text), [], `${acc} d${d} ${json(held)}`);
      assert.equal(r.events.filter(e => e.k === 'certificate').length, 1, 'the second read earns nothing');
      assert.equal(s.ui.pendingChoice, null);
      runs++;
    }
    assert.equal(runs, 105);
  });

  // ---- The invariants against planted states ----

  test('the invariants of progress.inv.js fail on planted faults, and hold on the real award', () => {
    const invs = Inv.select(C, ['progress']);
    assert.equal(json(invs.map(i => i.id)), json(['certificate_once', 'grade_and_health', 'offer_valid', 'choice_answerable', 'perk_taken']));
    const run = (pre, events, post, action) => Inv.checker(C, invs)(pre, action || { a: 'wait' }, events, post).map(v => v.inv);
    // The real thing: none.
    const base = () => room(C, { acc: 'A4', depth: 3, grade: 3, hp: 20, perks: [['single_file', 1]] });
    let pre = base(), post = C.State.clone(pre), ev = [];
    C.Progress.award(post, 'view', { k: 'view' }, ev);
    assert.deepEqual(run(pre, ev, post), []);
    // Each plant, and the invariant that catches it.
    const plants = [
      ['grade_and_health', (p, e) => { p.run.grade++; }, 'a grade with no Certificate'],
      ['grade_and_health', (p, e) => { p.actors[0].maxHp += 5; }, 'maximum health with no Certificate'],
      ['certificate_once', (p, e) => { p.dept.cert = { how: 'view', turn: 0 }; }, 'a Certificate with no event'],
      ['perk_taken', (p, e) => { p.run.perks.push({ id: 'elbow_room', rank: 1 }); }, 'a perk with no choice'],
      ['offer_valid', (p, e) => { p.dept.offer = [{ id: 'elbow_room', rank: 1 }]; }, 'an offer waiting behind no choice'],
      ['choice_answerable', (p, e) => { p.ui.pendingChoice = { k: 'perk', options: [] }; }, 'a perk choice with no options'],
      ['choice_answerable', (p, e) => { p.ui.pendingChoice = { k: 'planted', options: [1] }; }, 'a choice of a kind with no answer'],
    ];
    for (const [want, plant, what] of plants) {
      pre = base(); post = C.State.clone(pre); plant(post, []);
      assert.ok(run(pre, [], post).includes(want), `${what}: ${json(run(pre, [], post))}`);
    }
    // Plants on the award itself.
    const awarded = (edit) => { const p0 = base(), p1 = C.State.clone(p0), e = []; C.Progress.award(p1, 'view', { k: 'view' }, e); edit(p1, e); return run(p0, e, p1); };
    const cases = [
      ['grade_and_health', (p, e) => { p.actors[0].maxHp -= 5; }, 'the grade without its health'],
      ['grade_and_health', (p, e) => { e.reverse(); }, 'the events out of order'],
      ['grade_and_health', (p, e) => { e.find(x => x.k === 'healed').amount = 3; }, 'a short heal'],
      ['certificate_once', (p, e) => { p.run.certificates.push({ acc: 'A4', depth: 3, how: 'view', turn: 0 }); }, 'two records'],
      ['certificate_once', (p, e) => { e.push(Object.assign({}, e[0])); }, 'two Certificates'],
      ['offer_valid', (p, e) => { p.ui.pendingChoice.options[1] = { id: p.ui.pendingChoice.options[0].id, rank: p.ui.pendingChoice.options[0].rank }; }, 'a perk twice'],
      ['offer_valid', (p, e) => { p.ui.pendingChoice.options[0].rank = 1; }, 'a held perk at rank 1'],
      ['offer_valid', (p, e) => { p.ui.pendingChoice.options.pop(); }, 'an offer short of three'],
      ['offer_valid', (p, e) => { p.ui.pendingChoice.options[0] = { id: 'soft_soles', rank: 1 }; p.ui.pendingChoice.options[1] = { id: 'elbow_room', rank: 1 }; }, 'a held rank-1 perk left out of its family\'s'],
      ['offer_valid', (p, e) => { p.ui.pendingChoice = null; }, 'no offer and nothing said'],
      ['offer_valid', (p, e) => { p.ui.pendingChoice = null; e.push({ k: 'perk', turn: 0, tick: 0, cause: { k: 'none' } }); }, 'no perk said while perks are left'],
      ['grade_and_health', (p, e) => { const h = e.find(x => x.k === 'healed'); p.actors[0].hp = p.actors[0].maxHp; h.hp = p.actors[0].maxHp; h.amount = N.CERT_HEAL + 2; }, 'a heal past CERT_HEAL, to the maximum'],
    ];
    for (const [want, edit, what] of cases) assert.ok(awarded(edit).includes(want), `${what}: ${json(awarded(edit))}`);
    // The grade past VII, and a grade raised at VII.
    pre = room(C, { depth: 7, grade: 7 }); post = C.State.clone(pre); ev = [];
    C.Progress.award(post, 'view', { k: 'view' }, ev);
    assert.deepEqual(run(pre, ev, post), []);
    post.run.grade = 8;
    assert.ok(run(pre, ev, post).includes('grade_and_health'));
    post.run.grade = 7; post.actors[0].maxHp += N.HP_PER_GRADE;
    assert.ok(run(pre, ev, post).includes('grade_and_health'), 'maximum health raised at grade VII');
    // The run's record of the Certificate must be the visit's.
    post.actors[0].maxHp -= N.HP_PER_GRADE; post.run.certificates[0].depth = 6;
    assert.ok(run(pre, ev, post).includes('certificate_once'), 'a record of another depth');
    // A perk taken by something other than choose, and at the wrong rank.
    pre = base(); post = C.State.clone(pre); C.Progress.award(post, 'view', { k: 'view' }, []);
    const p2 = C.State.clone(post), ev2 = C.Step.step(p2, { a: 'choose', index: 0 });
    assert.deepEqual(run(post, ev2, p2, { a: 'choose', index: 0 }), []);
    assert.ok(run(post, ev2, p2, { a: 'wait' }).includes('perk_taken'));
    assert.equal(json(ev2.map(e => [e.id, e.rank])), json([['single_file', 2]]));
    p2.run.perks.push({ id: 'second_wind', rank: 1 });
    assert.ok(run(post, ev2, p2, { a: 'choose', index: 0 }).includes('perk_taken'), 'a second perk with the one chosen');
    p2.run.perks.pop(); ev2[0].rank = 1;
    assert.ok(run(post, ev2, p2, { a: 'choose', index: 0 }).includes('perk_taken'), 'the event at the wrong rank');
  });
};
