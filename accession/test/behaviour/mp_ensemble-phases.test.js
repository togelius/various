// ACCESSION — A.4's Centrepiece, the Ordinance (mp_ensemble; BUILD.md §5.5, §8.1, §8.3, §8.7;
// M4 plan D3.3, D3.7, D3.13, decided without play; revisit once M4 is playable): what
// ENSEMBLE-PHASES built on its pieces (test/behaviour/mp_ensemble.test.js holds those):
// inheritance, phase 3's shatter, its Clerk and its gallery hook. Its core stays at ready false,
// so no department places it: these tests place the real record with Centrepiece.place in a
// room with a hall and a gallery (the harness's rooms), with A.4's modules running
// (Modules.init, as a department does), every invariant checked after every step
// (centrepiece.inv.js, copies.inv.js and arch-d.inv.js among them), the joined-up runs
// clone-checked; a department places it only with its core planted ready. What each test
// expects is worked out here from BUILD's sentences, not from the code:
//   - inheritance: when a piece falls while another stands, each piece still standing, in its
//     pieces' order, takes on every special the fallen one had that it lacks, at the end of its
//     own; told by a phase event (cause inherited) naming the piece that takes it on only when
//     you see it; and it then marks it in its turn, as it showed;
//   - the shatter: phase 3 gives it to its first piece standing; it marks every case of its
//     hall still intact, then breaks them (no touch; shards on the first floor tile beside each
//     in direction order; what stood in one released), then a crash; once no case of its hall is
//     intact it is spent, told, and holds no other special back;
//   - its Clerk: an exhibit of its hall, not a piece, asleep, at its tile or the free one
//     nearest it, never by the reading tile, with its own label (the healer's line); it restores
//     a piece as any exhibit, and the Ordinance's phase never goes back, nor are its marks other
//     than what strikes; with it fallen, the fight goes on;
//   - its gallery hook: each original destroyed in the galleries costs it ENSEMBLE_HOOK_PCT[0]%
//     of its full health from its first piece standing, never its last point, at the turn's
//     boundary, at most ENSEMBLE_HOOK_PCT[1]% in all, with copies_weaken on or off; told without
//     naming a piece; waking none;
//   - the cuts (D3.7): nothing it shows promises spares joining phase 3 or the Clerk's interrupt.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const C = loadCore(), { N, Int, Roles } = C;
  const B = require(path.join(root, 'tools/battery.js'));
  const LINES = require(path.join(root, 'test/m4-lines.test.js'));
  const WAIT = { a: 'wait' };
  const HOOK = N.ENSEMBLE_HOOK_PCT, MOST = Int.idiv(HOOK[1], HOOK[0]);
  // The hall (x 1–7, y 1–5), its case at (6,1), and a gallery east of it (x 9–11), joined by an
  // archway (8,2) and a staff door (8,4); the footprint's top-left tile (2,2): the original on
  // (2,2), copy a (3,2), copy b (2,3), copy c (3,3). The Clerk's own tile, (2,2) + (0,3), is (2,5).
  const MAP = ['#############', '#.....v.#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 }, { key: 's1', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }];
  const AT = [2, 2], CASE = [6, 1], CLERK_AT = [2, 5];
  const STAFF = { k: 'staff', x: 8, y: 4, grade: 1 };
  const caseAt = (x, y, more) => C.Cases.make(Object.assign({ x, y, room: 'centre', glass: 1, lock: 1 }, more || {}));

  // A room with the hall, the Ordinance placed on its footprint (Centrepiece.place) and A.4's
  // modules running (Modules.init). o: you ([1, 2]), map, more exhibits, fixtures (the hall's
  // case and the staff door), items, options (rulesOff, without), clerk (false: left out), core.
  function room(depth, o) {
    o = o || {};
    const X = o.core || C, opts = Object.assign({}, o.options || {});
    const n = 5 + (o.more || []).filter(e => (e.room || 'room') === 'centre').length;
    if (o.clerk === false) opts.without = (opts.without || []).concat([`A4.${depth}.centre.${n}`]);
    const s = H.room(X, o.seed || 1, { acc: 'A4', depth, map: o.map || MAP, you: o.you || [1, 2], exhibits: o.more || [], rooms: o.rooms || ROOMS,
      clock: { B: 300, G: 60 }, entrance: [11, 3], fixtures: o.fixtures || [caseAt(CASE[0], CASE[1]), STAFF], items: o.items || [] }, opts);
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    const pack = X.Packs.get('A4');
    X.Centrepiece.place(s, { cpl: AT }, pack);
    X.Modules.init(s, pack);
    return s;
  }
  const pieces = (X, s) => X.Centrepiece.pieces(s);
  const clerkOf = (X, s) => s.actors.find(a => a.sp === 'A4.13') || null;
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  const Cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  // A blow straight to an exhibit (Combat.hurt, as your blow lands), for a planted state.
  const blow = (X, s, a, n) => { const ev = []; X.Combat.hurt(s, a, n, { k: 'attack', by: 'you', at: a.uid, chance: 100, raw: n, pad: 0, how: { kind: 'melee' }, from: [s.actors[0].x, s.actors[0].y] }, ev); return ev; };
  // Every event a piece caused is one its own line allows it (the soak's completeness, B.causer).
  function covered(X, s, events) {
    const out = [], rulesOff = (s.options && s.options.rulesOff) || [];
    for (const e of events) {
      const by = B.causer(e), a = by && s.dept.cp.uids.includes(by) ? X.Actors.byUid(s, by) : null;
      if (!a) continue;
      const allow = new Set(X.Clauses.UNIVERSAL);
      for (const p of X.Clauses.of(X.Packs.speciesFor(s, a), { depth: s.dept.depth, rulesOff })) for (const k of p.covers) allow.add(k);
      if (!allow.has(e.k)) out.push(`${by} caused ${e.k}, which its line does not cover`);
    }
    return out;
  }
  // Strike the first exhibit of `order` (uids) still standing, from a tile beside it, stepping
  // along a shortest walk to a free tile beside it when you are not; null once none stands.
  const fightIn = (X, order, cap) => (st, i) => {
    if (i > (cap || 600)) return null;
    const p = order.map(u => X.Actors.byUid(st, u)).find(a => a && !a.gone), you = st.actors[0], m = st.dept;
    if (!p) return null;
    if (X.Actors.dist(p, you.x, you.y) <= 1) return { a: 'attack', uid: p.uid };
    const free = (x, y) => X.Grid.walkable(m, x, y) && !X.Actors.at(st, x, y, you);
    const goals = [];
    for (let y = p.y - 1; y <= p.y + 1; y++) for (let x = p.x - 1; x <= p.x + 1; x++) if (free(x, y)) goals.push([x, y]);
    const dist = X.Grid.distances(m, goals, 99), here = dist[you.y * m.w + you.x];
    const d = [0, 1, 2, 3, 4, 5, 6, 7].find(k => { const x = you.x + X.Grid.DX[k], y = you.y + X.Grid.DY[k]; return free(x, y) && X.Grid.canStep(m, you.x, you.y, k, 'you') && dist[y * m.w + x] >= 0 && dist[y * m.w + x] < here; });
    return d === undefined ? WAIT : { a: 'move', dir: d };
  };
  // Planted blows taking its pieces' health together to a phase's threshold (CP_PHASE_PCT[k − 2]),
  // on the pieces in `order`, never felling one: the events.
  function toPhase(X, s, k, order) {
    const out = [];
    for (const a of order) {
      const h = X.Centrepiece.health(s), n = h.hp - Int.pct(h.max, N.CP_PHASE_PCT[k - 2]);
      if (n <= 0) break;
      if (!a.gone && a.hp > 1) out.push(...blow(X, s, a, Math.min(n, a.hp - 1)));
    }
    return out;
  }

  // ---- Inheritance ----

  test('inheritance, at depths 1–7: a piece that falls while another stands passes every special it had to each piece still standing that lacks it, in its pieces\' order, at the end of its own; told by a phase event, cause inherited, in the phase it is in, in one sentence naming each piece you see; a piece with none passes nothing, and a fall that ends it passes nothing', () => {
    const problems = [];
    for (const depth of H.DEPTHS) {
      const tag = `d${depth}`;
      // Copy a (the burst) falls in phase 1: the original and copy c take on its burst, copy b has it.
      let s = room(depth, { clerk: false }), [o, a, b, c] = pieces(C, s);
      const ev = blow(C, s, a, 999), took = ev.filter(e => e.k === 'phase');
      if (json(took.map(e => [e.who, e.phase, e.gained, e.cause])) !== json([[o.uid, 1, 'cp_burst', { k: 'inherited', from: a.uid, seen: true }], [c.uid, 1, 'cp_burst', { k: 'inherited', from: a.uid, seen: true }]])) problems.push(`${tag}: ${json(took)}`);
      if (json([o, b, c].map(p => p.ax.specials)) !== json([['cp_burst'], ['cp_burst'], ['cp_burst']])) problems.push(`${tag}: ${json([o, b, c].map(p => p.ax.specials))}`);
      if (C.Centrepiece.phase(s) !== 1) problems.push(`${tag}: phase ${C.Centrepiece.phase(s)}`);
      const log = C.Text.log(ev, C.Labels.nameOf(s), () => true);
      if (!log.includes('The Duplicate Ordinance, Signed Original and the Duplicate Ordinance, Certified Copy c took on the burst of the Duplicate Ordinance, Certified Copy a, which fell.')) problems.push(`${tag}: ${json(log)}`);
      if (say(C, s, took[1]) !== 'The Duplicate Ordinance, Certified Copy c took on the burst of the Duplicate Ordinance, Certified Copy a, which fell.') problems.push(`${tag}: ${say(C, s, took[1])}`);
      // The original (nothing yet, in phase 1) falls first: nothing is passed on.
      s = room(depth, { clerk: false }); [o] = pieces(C, s);
      if (blow(C, s, o, 999).some(e => e.k === 'phase' && e.cause.k === 'inherited')) problems.push(`${tag}: the original passed something on`);
      // A piece with two specials (its burst, and a shatter while the hall's case is intact)
      // passes both, in its order, to each piece that lacks them; one that has one takes the other.
      s = room(depth, { clerk: false }); [o, a, b, c] = pieces(C, s);
      a.ax.specials = ['cp_burst', 'shatter_all'];
      const two = blow(C, s, a, 999).filter(e => e.k === 'phase').map(e => [e.who, e.gained]);
      if (json(two) !== json([[o.uid, 'cp_burst'], [c.uid, 'cp_burst'], [o.uid, 'shatter_all'], [b.uid, 'shatter_all'], [c.uid, 'shatter_all']])) problems.push(`${tag}: two specials passed as ${json(two)}`);
      if (json([o, b, c].map(p => p.ax.specials)) !== json([['cp_burst', 'shatter_all'], ['cp_burst', 'shatter_all'], ['cp_burst', 'shatter_all']])) problems.push(`${tag}: ${json([o, b, c].map(p => p.ax.specials))}`);
      // The last piece's fall is its defeat: nothing is passed on.
      s = room(depth, { clerk: false }); [o, a, b, c] = pieces(C, s);
      for (const p of [o, b, c]) blow(C, s, p, 999);
      if (blow(C, s, a, 999).some(e => e.k === 'phase' && e.cause.k === 'inherited')) problems.push(`${tag}: the last piece passed something on`);
    }
    assert.deepEqual(problems, []);
  });

  // A hall in which the corner (7,5) is closed off by columns (6,4), (7,4), (6,5): a piece moved
  // there (pieces never step, so it stays) is out of your sight.
  const CORNER = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.....oo#...#', '#.....o.#...#', '#############'];
  test('inheritance\'s sentence names the piece that takes a special on only when you see it: copy c out of your sight takes on copy a\'s burst, and the log says only that a piece still standing, out of your sight, did, never naming copy c; in sight it is named; joined up at depths 1, 4 and 7', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) for (const hidden of [true, false]) {
      const s = room(depth, { map: CORNER, you: [4, 1], fixtures: [], clerk: false }), [o, a, b, c] = pieces(C, s), tag = `d${depth}${hidden ? ' hidden' : ''}`;
      if (hidden) Object.assign(c, { x: 7, y: 5 });
      // Strike copy a down; the original and copy b too, so that no phase special muddles it.
      const r = H.play(C, s, (st, i) => i > 400 || a.gone ? null : fightIn(C, [a.uid])(st, i), { inv: 'all', clone: true, cap: 500 });
      problems.push(...bad(r, tag));
      const step = r.steps.find(st => st.events.some(e => e.k === 'died' && e.who === a.uid));
      if (!step) { problems.push(`${tag}: copy a never fell`); continue; }
      const e = step.events.find(x => x.k === 'phase' && x.cause.k === 'inherited' && x.who === c.uid);
      const inView = new Set(C.ViewModel.derive(s, {}).actors.map(x => x.uid)), name = C.Labels.nameOf(s)(c.uid);
      if (!e || e.cause.seen !== !hidden || inView.has(c.uid) === hidden) { problems.push(`${tag}: ${json(e)}; in view ${inView.has(c.uid)}`); continue; }
      const want = hidden ? 'A piece still standing, out of your sight, took on the burst of the Duplicate Ordinance, Certified Copy a, which fell.'
        : 'The Duplicate Ordinance, Certified Copy c took on the burst of the Duplicate Ordinance, Certified Copy a, which fell.';
      if (say(C, s, e) !== want) problems.push(`${tag}: ${say(C, s, e)}`);
      const log = C.Text.log(step.events, C.Labels.nameOf(s), uid => inView.has(uid));
      if (hidden && log.some(l => l.includes(name) || l.includes(Cap(name)))) problems.push(`${tag}: the log names copy c: ${json(log)}`);
      if (!log.some(l => l.includes(hidden ? 'a piece out of your sight took on the burst' : 'Certified Copy c took on the burst'))) problems.push(`${tag}: the log says ${json(log)}`);
    }
    assert.deepEqual(problems, []);
  });

  // (The original and copy b are left out, so that copy c, which has no special of its own,
  // takes copy a's burst on; you stand at (4,1), beside copy a and out of copy c's reach, and off
  // the burst's 3×3 round you, which strikes every piece on it too.)
  test('a burst taken on is marked in its turn and strikes as its mark showed: copy a struck down first, copy c takes on its burst and, hunting you, marks it at its cadence and it strikes you for what the mark showed (centrepiece.marks); its line covers all it causes; joined up at depths 1, 4 and 7, clone-checked', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { you: [4, 1], clerk: false, options: { rulesOff: ['copies_weaken'], without: [`A4.${depth}.centre.1`, `A4.${depth}.centre.3`] } }), [, a, , c] = pieces(C, s), tag = `d${depth}`;
      let fell = -1;
      const r = H.play(C, s, (st, i, x) => {
        if (fell < 0 && a.gone) fell = i;
        if (fell >= 0 && (i > fell + 40 || x.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === c.uid))) return null;
        return fell < 0 ? fightIn(C, [a.uid])(st, i) : WAIT;
      }, { inv: 'all', clone: true, cap: 600 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      if (!r.events.some(e => e.k === 'phase' && e.cause.k === 'inherited' && e.who === c.uid && e.gained === 'cp_burst')) problems.push(`${tag}: copy c took on nothing`);
      const hit = r.events.find(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === c.uid && e.cause.sp === 'cp_burst');
      if (!hit) problems.push(`${tag}: copy c's burst never struck you: ${json(r.events.filter(e => e.who === c.uid || (e.cause && e.cause.by === c.uid)).map(e => [e.k, e.sp]))}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Phase 3's shatter ----

  // Planted: its pieces' health together at phase 3's threshold, by blows on copies b and c
  // (none falls); the step's events.
  const toPhase3 = (X, s) => { const [, , b, c] = pieces(X, s); return toPhase(X, s, 2, [c, b]).concat(toPhase(X, s, 3, [c, b, pieces(X, s)[1]])); };

  test('phase 3 gives its first piece standing the shatter; at its turn it marks every case of its hall still intact (the readout and the mark say so), and at its next action each breaks, as its line says: broken, no touch, its shards on the first floor tile beside it in direction order, what stood in it released and hunting, told without naming the piece; then a crash; then, no case left intact, the shatter is spent (told), and its burst comes again in turn; joined up at depths 1–7, clone-checked, with the hall sealed round you', () => {
    const problems = [];
    for (const depth of H.DEPTHS) {
      const tag = `d${depth}`, sp = C.Packs.species('A4', 'A4.1');
      // A sleeping clerk in the case, and you at (5,3), 2 tiles from its pieces, so that no
      // burst round you strikes a piece (a burst strikes every exhibit on it).
      // (Its trigger touch_case, so a touch would wake it, as the shatter's break must not.)
      const s = room(depth, { clerk: false, you: [5, 3], more: [{ sp: 'A4.1', at: CASE, mode: 'dormant', stats: Roles.stats(sp.role, depth), room: 'centre', group: 'clerks@centre', trigger: 'touch_case' }] });
      const [o] = pieces(C, s), inCase = s.actors.find(x => x.sp === 'A4.1');
      const ev0 = toPhase3(C, s);
      const ph = ev0.filter(e => e.k === 'phase' && e.cause.k === 'ensemble');
      if (json(ph.map(e => [e.phase, e.who, e.gained || null])) !== json([[2, o.uid, 'cp_burst'], [3, o.uid, 'shatter_all']])) { problems.push(`${tag}: phases ${json(ph)}`); continue; }
      if (say(C, s, ph[1]) !== `The Centrepiece is now in phase 3 of 3: its pieces’ health together has fallen to ${N.CP_PHASE_PCT[1]}% of their full health or below. The Duplicate Ordinance, Signed Original, the first of them still standing, has a shatter.`) problems.push(`${tag}: ${say(C, s, ph[1])}`);
      if (json(o.ax.specials) !== json(['cp_burst', 'shatter_all'])) problems.push(`${tag}: the original holds ${json(o.ax.specials)}`);
      if (!C.Labels.of(s, o.uid).odds.includes('Its shatter deals no damage: its Behaviour line says what it does.')) problems.push(`${tag}: ${json(C.Labels.of(s, o.uid).odds)}`);
      // Struck from beside it until its shatter has gone off and is spent, and its burst struck you.
      let spentAt = -1;
      const r = H.play(C, s, (st, i, x) => {
        if (spentAt < 0 && x.events.some(e => e.k === 'special' && e.cause && e.cause.k === 'spent')) spentAt = i;
        if (spentAt >= 0 && i > spentAt && x.last.some(e => e.k === 'telegraphed' && e.who === o.uid && e.sp === 'cp_burst')) return null;
        return i > 120 ? null : WAIT;
      }, { inv: 'all', clone: true, cap: 150 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const mark = r.events.find(e => e.k === 'telegraphed' && e.sp === 'shatter_all');
      if (!mark || mark.who !== o.uid || json(mark.tiles) !== json([CASE])) { problems.push(`${tag}: its shatter marked ${json(mark)}`); continue; }
      if (say(C, s, mark) !== 'The Duplicate Ordinance, Signed Original marks every case of its hall still intact for its shatter, at its next action.') problems.push(`${tag}: ${say(C, s, mark)}`);
      const k = r.events.indexOf(r.events.find(e => e.k === 'glass_broke'));
      const broke = r.events[k], f = s.dept.fixtures.find(x => x.k === 'case');
      // Its shards: the case's first floor neighbour in direction order (N, NE, E, …): (6,0) is
      // wall, (7,0) wall, (7,1) floor.
      if (!broke || json([broke.by, broke.x, broke.y, broke.shards, broke.released, broke.cause]) !== json([o.uid, CASE[0], CASE[1], [[7, 1]], inCase.uid, { k: 'shatter', by: o.uid, sp: 'shatter_all' }])) problems.push(`${tag}: ${json(broke)}`);
      else if (say(C, s, broke) !== `The Centrepiece’s shatter broke the Plate glass of a case in its hall, and shards spread. ${Cap(C.Labels.nameOf(s)(inCase.uid))} is free.`) problems.push(`${tag}: ${say(C, s, broke)}`);
      if (f.st !== 'broken' || C.Grid.ch(s.dept, CASE[0], CASE[1]) !== 'k' || C.Grid.ch(s.dept, 7, 1) !== 'x') problems.push(`${tag}: the case is ${f.st} on ${C.Grid.ch(s.dept, CASE[0], CASE[1])}`);
      const after = r.events.slice(k);
      if (r.events.some(e => e.cause && e.cause.k === 'touch_case')) problems.push(`${tag}: the shatter touched the case`);
      // (Released, it hunts you with no home; the noise of the fight woke it in its case before.)
      if (inCase.mode !== 'hunting' || inCase.home !== null) problems.push(`${tag}: the clerk in the case is ${inCase.mode} at ${json(inCase.home)}`);
      // Planted, the shatter going off with the clerk asleep in the case: no touch (it would
      // wake by touch_case, its trigger); it wakes hunting as the case breaks (case_broken).
      const t = room(depth, { clerk: false, you: [5, 4], more: [{ sp: 'A4.1', at: CASE, mode: 'dormant', stats: Roles.stats(sp.role, depth), room: 'centre', group: 'clerks@centre', trigger: 'touch_case' }] });
      const [to] = pieces(C, t), tin = t.actors.find(x => x.sp === 'A4.1'), tev = [];
      Object.assign(to, { mode: 'hunting', ax: Object.assign(to.ax, { specials: ['shatter_all'] }) });
      C.Specials.mark(t, to, 'shatter_all', C.Specials.tiles(t, to, 'shatter_all'), tev);
      C.Specials.resolve(t, to, tev);
      if (tev.some(e => e.cause && e.cause.k === 'touch_case') || !tev.some(e => (e.k === 'woke' || e.k === 'hunting') && e.who === tin.uid && e.cause.k === 'case_broken') || tin.mode !== 'hunting') problems.push(`${tag}: planted, the break told ${json(tev.filter(e => e.who === tin.uid))}`);
      const crash = after.findIndex(e => e.k === 'noise' && e.cls === 'crash' && e.cause.k === 'glass_broke'), used = after.findIndex(e => e.k === 'special' && e.who === o.uid && e.sp === 'shatter_all' && !e.cancelled);
      if (crash < 0 || used < crash) problems.push(`${tag}: the crash, then its use: ${crash}, ${used}`);
      const spent = after.find(e => e.k === 'special' && e.cause && e.cause.k === 'spent');
      if (!spent || spent.who !== o.uid || !spent.cancelled || spent.cause.seen !== true || after.indexOf(spent) < used) problems.push(`${tag}: spent ${json(spent)}`);
      else if (say(C, s, spent) !== 'The Duplicate Ordinance, Signed Original has the shatter no more: no case of its hall is intact.') problems.push(`${tag}: ${say(C, s, spent)}`);
      if (o.ax.specials.includes('shatter_all') || C.Labels.of(s, o.uid).odds.some(l => l.includes('shatter'))) problems.push(`${tag}: still holds it: ${json(o.ax.specials)}`);
      if (!r.events.slice(r.events.indexOf(spent)).some(e => e.k === 'telegraphed' && e.who === o.uid && e.sp === 'cp_burst')) problems.push(`${tag}: its burst never came again`);
      if (!C.Clock.sealed(s)) problems.push(`${tag}: the hall never sealed round you`);
    }
    assert.deepEqual(problems, []);
  });

  test('the shatter is spent whenever no case of its hall is intact, so it never holds the burst back: gained in phase 3 with the hall\'s case already broken, it is spent at once; held, and the case opened by you, it is spent at the turn\'s boundary; a piece out of your sight is not named; nor is a spent shatter taken on; at depths 1, 4 and 7', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const tag = `d${depth}`;
      // The case broken before phase 3: the shatter comes and goes in one step.
      let s = room(depth, { clerk: false, fixtures: [caseAt(CASE[0], CASE[1], { st: 'broken' }), STAFF] });
      s.dept.tiles[CASE[1]] = s.dept.tiles[CASE[1]].slice(0, CASE[0]) + 'k' + s.dept.tiles[CASE[1]].slice(CASE[0] + 1);
      let [o] = pieces(C, s), ev = toPhase3(C, s);
      const got = ev.filter(e => (e.k === 'phase' && e.gained === 'shatter_all') || (e.k === 'special' && e.cause.k === 'spent'));
      if (json(got.map(e => [e.k, e.who, e.cause.k])) !== json([['phase', o.uid, 'ensemble'], ['special', o.uid, 'spent']]) || o.ax.specials.includes('shatter_all')) problems.push(`${tag}: ${json(got)}`);
      // Held, and the case opened by you (grade high enough): spent at the next boundary.
      s = room(depth, { clerk: false, you: [6, 2] });
      [o] = pieces(C, s);
      toPhase3(C, s);
      for (const p of pieces(C, s)) { p.mode = 'dormant'; p.pips = 0; }
      const r = H.play(C, s, [{ a: 'open', x: CASE[0], y: CASE[1] }, WAIT], { inv: 'all' });
      problems.push(...bad(r, `${tag} opened`));
      const sp = r.steps[0].events.filter(e => e.k === 'special' && e.cause.k === 'spent');
      if (json(sp.map(e => e.who)) !== json([o.uid]) || o.ax.specials.includes('shatter_all')) problems.push(`${tag}: opened, then ${json(r.steps.map(x => x.events.map(e => e.k)))}`);
      // Out of your sight: its mark and its use are not told (the board shows the mark on the
      // case, in sight), its breaking names no piece, and its spending does not name it.
      s = room(depth, { clerk: false, map: CORNER.map((row, y) => y === 1 ? '#.....v.#...#' : row), you: [4, 1] });
      [o] = pieces(C, s);
      Object.assign(o, { x: 7, y: 5 });
      toPhase3(C, s);
      o.telegraph = null; o.mode = 'hunting';
      const evm = []; C.Specials.mark(s, o, 'shatter_all', C.Specials.tiles(s, o, 'shatter_all'), evm);
      C.Specials.resolve(s, o, evm);
      const seenNow = new Set(C.ViewModel.derive(s, {}).actors.map(x => x.uid)), oname = C.Labels.nameOf(s)(o.uid);
      const told = C.Text.log(evm, C.Labels.nameOf(s), uid => seenNow.has(uid));
      if (seenNow.has(o.uid) || told.some(l => l.includes(oname) || l.includes(Cap(oname))) || !told.includes('The Centrepiece’s shatter broke the Plate glass of a case in its hall, and shards spread.')) problems.push(`${tag}: hidden, the log says ${json(told)}`);
      s.dept.fixtures.find(f => f.k === 'case').st = 'shut';
      s.dept.tiles[1] = '#.....v.#...#';
      s.dept.fixtures.find(f => f.k === 'case').st = 'open';
      s.dept.tiles[1] = '#.....u.#...#';
      const ev2 = []; C.Hall.boundary(s, ev2);
      const e2 = ev2.find(e => e.k === 'special' && e.cause.k === 'spent');
      if (!e2 || e2.cause.seen !== false || say(C, s, e2) !== 'A piece out of your sight has the shatter no more: no case of its hall is intact.') problems.push(`${tag}: hidden ${json(e2)} ${e2 && say(C, s, e2)}`);
      // Not taken on: the holder falls with no case intact (its spending not yet come).
      s = room(depth, { clerk: false, fixtures: [STAFF] });
      const [, a, b, c] = pieces(C, s);
      a.ax.specials = ['cp_burst', 'shatter_all'];
      const ev3 = blow(C, s, a, 999);
      if (ev3.some(e => e.k === 'phase' && e.gained === 'shatter_all') || [b, c].some(p => p.ax.specials.includes('shatter_all'))) problems.push(`${tag}: a spent shatter was taken on`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- The Senior Countersigning Clerk ----

  test('its Clerk (A.4.13, its record\'s attachment): one exhibit of the hall made with its pieces, asleep, its own species (its label: name, number, the healer\'s and clockwork\'s line, its own health), not a piece and in no phase; on its own tile, or the free tile of the hall nearest it, never by the reading tile; drawing nothing; a department with the core planted ready places it in the hall', () => {
    const problems = [], rec = C.Packs.get('A4').centrepiece, q = rec.attachments[0];
    assert.equal(json([rec.attachments.length, q.id, q.archetype, q.role, q.modifiers, q.at]), json([1, 'A4.13', 'conservator_healer', 'support', ['clockwork'], [0, 3]]));
    for (const depth of H.DEPTHS) {
      const tag = `d${depth}`, s = room(depth), c = clerkOf(C, s), role = Roles.stats('support', depth);
      if (!c || json([c.uid, c.x, c.y, c.mode, c.arch, c.mods, c.role, c.hp, c.maxHp]) !== json([`A4.${depth}.centre.5`, CLERK_AT[0], CLERK_AT[1], 'dormant', 'conservator_healer', ['clockwork'], 'support', role.hp, role.hp])) { problems.push(`${tag}: ${json(c)}`); continue; }
      if (s.dept.cp.uids.includes(c.uid) || C.Centrepiece.health(s).max !== Roles.stats('centrepiece', depth).hp) problems.push(`${tag}: it counts as a piece`);
      if (json(s.rng) !== '{}') problems.push(`${tag}: drew on ${json(Object.keys(s.rng))}`);
      const l = C.Labels.of(s, c.uid), want = C.Clauses.line(q, { depth, modules: C.Modules.active(s) });
      if (l.title !== 'Senior Countersigning Clerk, Automaton' || l.number !== 'A.4.13' || l.behaviour !== want || want !== C.Clauses.line(C.Packs.species('A4', 'A4.5'), { depth })) problems.push(`${tag}: ${json([l.title, l.number, l.behaviour])}`);
      if (LINES.rows(l.behaviour) > LINES.METRICS.budgetRows) problems.push(`${tag}: its line takes ${LINES.rows(l.behaviour)} rows`);
      if (C.ViewModel.derive(s, {}).actors.find(a => a.uid === c.uid).sprite !== 'countersigning_clerk') problems.push(`${tag}: its sprite`);
      // Its own tile taken (a column there): the free tile nearest it, ties in row-major order.
      const t = room(depth, { map: MAP.map((row, y) => y === 5 ? '#.o.....#...#' : row) }), tc = clerkOf(C, t);
      if (json([tc.x, tc.y]) !== json([1, 4])) problems.push(`${tag}: its tile taken, it stands at ${tc.x},${tc.y}`);
    }
    // Never within RING_STILL + 1 walking tiles of the hall's reading tile (as no gallery exhibit).
    const X = loadCore();
    X.Registry.ARCHETYPES.mp_ensemble.ready = 'unit';
    // (A.4 seed 2 at depth 5: its own tile is 3 walking tiles from the reading tile, so it stands on the next.)
    for (const [seed, depth] of [[1, 1], [2, 1], [1, 4], [2, 4], [2, 5], [1, 7], [2, 7]]) {
      const s = X.Dept.create(seed, 'A4', depth), c = clerkOf(X, s), m = s.dept, cp = X.Hall.cp(s);
      const view = X.Grid.distances(m, [m.viewTile], 99)[c.y * m.w + c.x];
      if (!c || X.Cases.roomKey(s, c.x, c.y) !== cp.room || view <= N.RING_STILL + 1 || c.mode !== 'dormant') problems.push(`A4 ${seed} d${depth}: ${json(c && [c.x, c.y, view])}`);
      if (seed === 2 && depth === 5 && json([c.x, c.y]) === json([cp.at[0], cp.at[1] + 3])) problems.push('A4 2 d5: it stands on its own tile, by the reading tile');
      const want = [cp.at[0], cp.at[1] + 3];
      if (X.Grid.chebyshev(c.x, c.y, want[0], want[1]) > 2) problems.push(`A4 ${seed} d${depth}: it stands at ${c.x},${c.y}, far from ${want}`);
    }
    assert.deepEqual(problems, []);
  });

  test('its Clerk restores its pieces, and the Ordinance\'s phase never goes back, nor does a mark strike other than it showed: woken, it keeps CONSERVATOR_KEEP tiles from you and restores the most-hurt piece it sees by CONSERVATOR_HEAL_PCT% of that piece\'s maximum, shown first; no phase is told on a restore, nor told again when the piece is struck back down; struck down itself, the fight goes on and the Ordinance falls; joined up at depths 2 and 6, every invariant on, clone-checked', () => {
    const problems = [];
    for (const depth of [2, 6]) {
      const tag = `d${depth}`, s = room(depth, { you: [5, 1] }), [o, a, b, c] = pieces(C, s), clerk = clerkOf(C, s);
      // Planted: phase 2 (copy c hurt most); the Clerk and the pieces hunting you.
      toPhase(C, s, 2, [c, b]);
      for (const p of [clerk]) blow(C, s, p, 1);
      const phase = C.Centrepiece.phase(s);
      if (phase !== 2) { problems.push(`${tag}: phase ${phase}`); continue; }
      // Wait until it restores, then strike the most-hurt piece, then the Clerk, then the rest.
      let healed = -1;
      const isHeal = e => e.k === 'healed' && e.cause.k === 'restore' && e.cause.by === clerk.uid && s.dept.cp.uids.includes(e.who);
      const order = [c.uid, clerk.uid, b.uid, a.uid, o.uid];
      const r = H.play(C, s, (st, i, x) => {
        if (healed < 0 && x.events.some(isHeal)) healed = i;
        if (healed < 0) return i > 60 ? null : WAIT;
        return fightIn(C, order, 900)(st, i);
      }, { inv: 'all', clone: true, cap: 1000 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const heal = r.events.find(isHeal);
      if (!heal) { problems.push(`${tag}: the Clerk never restored a piece: ${json(r.events.filter(e => e.k === 'telegraphed' || e.k === 'healed').map(e => [e.k, e.who, e.sp]))}`); continue; }
      const p = C.Actors.byUid(s, heal.who), mark = r.events.slice(0, r.events.indexOf(heal)).reverse().find(e => e.k === 'telegraphed' && e.who === clerk.uid);
      if (!mark || json(mark.tiles) !== json([[p.x, p.y]])) problems.push(`${tag}: the restore was not shown on ${p.uid}: ${json(mark)}`);
      if (heal.amount > Int.pct(p.maxHp, N.CONSERVATOR_HEAL_PCT)) problems.push(`${tag}: it restored ${heal.amount} of ${p.maxHp}`);
      // No phase told between its restore and the next phase the health gives: the phases told are 3 alone after it.
      const told = r.events.filter(e => e.k === 'phase' && e.cause.k === 'ensemble').map(e => e.phase);
      if (json(told) !== json([3])) problems.push(`${tag}: phases told ${json(told)}`);
      if (!clerk.gone) problems.push(`${tag}: the Clerk was never struck down`);
      if (!pieces(C, s).every(q => q.gone) || r.events.filter(e => e.k === 'certificate').length !== 1) problems.push(`${tag}: the Ordinance did not fall`);
      // The Clerk keeps its distance whenever it acts (arch-d.inv's healer.keep is on); and a
      // piece's burst struck you as marked (centrepiece.marks is on).
      if (!r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && s.dept.cp.uids.includes(e.cause.by))) problems.push(`${tag}: no burst struck you`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its gallery hook ----

  // A gallery (s1, x 9–11) holding copy groups: each an original Seated Clerk and a spare.
  const groupIn = (depth, k, x, y) => {
    const sp = C.Packs.species('A4', 'A4.1'), st = Roles.stats(sp.role, depth);
    return [{ sp: 'A4.1', at: [x, y], mode: 'dormant', stats: st, room: 's1', group: `clerks@g${k}` }, { sp: 'A4.1a', at: [x, y + 1], mode: 'dormant', stats: Roles.stats('fodder', depth), room: 's1', group: `clerks@g${k}` }];
  };
  test('its gallery hook, at depths 1–7, with copies_weaken on and off: each original destroyed in the galleries costs it ENSEMBLE_HOOK_PCT[0]% of its full health, from its first piece standing, at the turn\'s boundary, waking none and naming none; ENSEMBLE_HOOK_PCT[1] ÷ ENSEMBLE_HOOK_PCT[0] count, no more (ENSEMBLE_HOOK_PCT[1]% in all); with its original fallen, from the first copy standing; never a piece\'s last point; one gone by `without`, or its own original, does not count', () => {
    const problems = [];
    for (const depth of H.DEPTHS) for (const off of [[], ['copies_weaken']]) {
      const tag = `d${depth}${off.length ? ' off' : ''}`;
      const more = [...groupIn(depth, 1, 9, 1), ...groupIn(depth, 2, 10, 1), ...groupIn(depth, 3, 11, 1), ...groupIn(depth, 4, 9, 4)];
      const s = room(depth, { more, clerk: false, you: [10, 5], options: { rulesOff: off } }), ps = pieces(C, s), [o] = ps;
      const origs = s.actors.filter(a => a.sp === 'A4.1'), max = C.Centrepiece.health(s).max, cost = Int.pct(max, HOOK[0]);
      const each = [];
      for (const g of origs) {
        blow(C, s, g, 999);
        const r = H.play(C, s, [WAIT], { inv: 'all' });
        problems.push(...bad(r, tag));
        each.push(r.events.filter(e => e.k === 'damaged' && e.cause.k === 'hook'));
      }
      const want = origs.map((g, i) => i < MOST ? [[o.uid, cost, g.uid]] : []);
      if (json(each.map(l => l.map(e => [e.who, e.amount, e.cause.of]))) !== json(want)) problems.push(`${tag}: ${json(each)}`);
      if (o.hp !== o.maxHp - MOST * cost || MOST * cost > Int.pct(max, HOOK[1]) || json(s.dept.cp.hook) !== json(origs.slice(0, MOST).map(g => g.uid))) problems.push(`${tag}: the original at ${o.hp}/${o.maxHp}`);
      if (ps.some(p => p.mode !== 'dormant')) problems.push(`${tag}: a piece woke`);
      const e = each[0][0];
      if (e && say(C, s, e) !== `An original was destroyed in the galleries, a companion piece to the Centrepiece: its first piece standing lost ${cost} health.`) problems.push(`${tag}: ${say(C, s, e)}`);
    }
    // With its original fallen: from copy a; never its last point; `without`; its own original.
    for (const depth of [1, 7]) {
      let s = room(depth, { more: groupIn(depth, 1, 9, 1), clerk: false, you: [10, 5] }), [o, a] = pieces(C, s);
      blow(C, s, o, 999);
      blow(C, s, s.actors.find(x => x.sp === 'A4.1'), 999);
      let ev = H.play(C, s, [WAIT], { inv: 'all' });
      problems.push(...bad(ev, `d${depth} copy a`));
      const max = C.Centrepiece.health(s).max;
      if (json(ev.events.filter(e => e.k === 'damaged' && e.cause.k === 'hook').map(e => [e.who, e.amount])) !== json([[a.uid, Int.pct(max, HOOK[0])]])) problems.push(`d${depth}: with the original fallen ${json(ev.events.filter(e => e.k === 'damaged'))}`);
      s = room(depth, { more: groupIn(depth, 1, 9, 1), clerk: false, you: [10, 5] }); [o] = pieces(C, s);
      o.hp = 2;
      blow(C, s, s.actors.find(x => x.sp === 'A4.1'), 999);
      ev = H.play(C, s, [WAIT], { inv: 'all' });
      if (o.hp !== 1 || json(ev.events.filter(e => e.k === 'damaged').map(e => e.amount)) !== '[1]') problems.push(`d${depth}: at 2 health, ${o.hp}`);
      s = room(depth, { more: groupIn(depth, 1, 9, 1), clerk: false, you: [10, 5], options: { without: [`A4.${depth}.s1.1`] } }); [o] = pieces(C, s);
      ev = H.play(C, s, [WAIT, WAIT], { inv: 'all' });
      if (ev.events.some(e => e.k === 'damaged') || C.Hall.cp(s).hook !== undefined) problems.push(`d${depth}: an original left out counted`);
    }
    assert.deepEqual(problems, []);
  });

  test('its gallery hook can bring a phase: with its pieces\' health together just above CP_PHASE_PCT[0]%, an original destroyed in the galleries takes it into phase 2, told with its cause, ensemble, naming no one who struck; the Ordinance sleeps on; at depths 1, 4 and 7', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = room(depth, { more: groupIn(depth, 1, 9, 1), clerk: false, you: [10, 5] }), [o, , b, c] = pieces(C, s), max = C.Centrepiece.health(s).max;
      // Planted: health together 1 above phase 2's threshold, the pieces asleep again.
      const n = C.Centrepiece.health(s).hp - Int.pct(max, N.CP_PHASE_PCT[0]) - 1;
      c.hp -= Math.min(n, c.hp - 1); b.hp -= n - Math.min(n, c.maxHp - 1);
      if (C.Centrepiece.phaseFor(C.Centrepiece.health(s).hp, max) !== 1) { problems.push(`d${depth}: planted wrong`); continue; }
      blow(C, s, s.actors.find(x => x.sp === 'A4.1'), 999);
      const r = H.play(C, s, [WAIT], { inv: 'all' });
      problems.push(...bad(r, `d${depth}`));
      const ph = r.events.filter(e => e.k === 'phase');
      if (json(ph.map(e => [e.phase, e.who, e.gained, e.cause])) !== json([[2, o.uid, 'cp_burst', { k: 'ensemble', seen: false }]])) problems.push(`d${depth}: ${json(ph)}`);
      if (pieces(C, s).some(p => p.mode !== 'dormant')) problems.push(`d${depth}: a piece woke`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its words: the line, the strip, the cuts ----

  test('its line states inheritance, the hook and the shatter, at every depth, with copies_weaken on and off, and each phase\'s strip keeps within the phone\'s budget (m4-lines\' model); nothing it, its Clerk or its gateway label says promises the cuts (spares joining phase 3, the Clerk\'s interrupt)', () => {
    const rec = C.Packs.get('A4').centrepiece, problems = [];
    for (const depth of H.DEPTHS) for (const off of [[], ['copies_weaken']]) {
      const line = C.Clauses.line(rec, { depth, rulesOff: off });
      for (const w of ['When a piece falls, each piece still standing takes on every special the fallen piece had that it lacks.',
        `Each original destroyed in the galleries, a companion piece to it, costs it ${HOOK[0]}% of its full health, at most ${HOOK[1]}% in all, taken from its first piece standing, never that piece’s last point.`,
        'its first piece standing as the phase begins has a shatter too: it marks every case of its hall still intact, then breaks them all; once none is intact, the shatter is spent.'])
        if (!line.includes(w)) problems.push(`d${depth}: no "${w}"`);
      for (const k of [1, 2, 3]) { const n = LINES.rows(C.Clauses.strip(rec, { depth, phase: k, rulesOff: off })); if (n > LINES.METRICS.budgetRows) problems.push(`d${depth} phase ${k}: ${n} rows`); }
    }
    const said = [C.Clauses.line(rec, { depth: 7 }), C.Clauses.line(rec.attachments[0], { depth: 7 }), rec.gateway, rec.attachments[0].paragraph, ...[1, 2, 3].map(k => C.Clauses.strip(rec, { depth: 7, phase: k })),
      C.Registry.SPECIALS.shatter_all.clause, ...[1, 2, 3, 4].map(i => (rec.pieces[i - 1].paragraph || ''))].join(' ');
    for (const cut of [/interrupt/i, /moistener/i, /\bjet\b/i, /join(s|ed)? (it|the fight|phase)/i, /spares? (come|step|wake|join)/i])
      if (cut.test(said)) problems.push(`it says ${cut}`);
    // Its own sentences never say "undefined", "NaN" or "[object" (m4-grammar reads them with
    // planted ids too).
    assert.deepEqual(problems, []);
  });
};
