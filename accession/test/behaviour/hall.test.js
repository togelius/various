// ACCESSION — the Centrepiece hall's seal (BUILD.md §8.4, §4.1, §7.1, §7.2; M4 plan A13, D3.1,
// D3.15, D7.3; ARCH-HALL), joined up: real actions in a room with a hall (the harness's
// rooms and cp), every invariant checked after every step (hall.inv.js among them), and the
// main scenarios clone-checked at depths 1–7. The figures expected are worked out here from
// BUILD's sentences, not from rules/hall.js:
//   - the hall seals on the hunt, at the boundary its piece begins to hunt you, while you stand
//     inside it; never from outside; never for a piece hunting you from outside it (you are
//     never sealed in alone); an occupied opening delays it, said once, naming what calls for
//     the seal and who stands in the way only if you see it; a staff door is shuttered with
//     the rest, and the board shows no staff door under a shutter;
//   - the count stops and you do not regenerate while it is sealed; a planted module's turn
//     rules still run; the Night Watchman is shut out;
//   - the shutters open after SEAL_LIFT_TURNS turns in a row in which the Centrepiece neither
//     hurt you (at any range) nor ended a turn beside you; with a Ticket (its pieces heal
//     SEAL_HEAL_PCT and go back); on defeat; and the hall seals again only once you have
//     stood outside it at a turn's end;
//   - your memory of an opening follows its shutter, and as it opens shows what you last saw
//     there; a treasure's hall does not seal on the hunt;
//   - the words: the hall's confirmation (Hall.entering, R11), the threat's for a line not yet
//     marked (D7.3), the sealed chip and the dial.
'use strict';
const H = require('./_harness.js');
const Inv = require('../../tools/invariants.js');
const B = require('../../tools/battery.js');

module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const json = JSON.stringify;
  const wait = { a: 'wait' };
  // The hall (x 1–7, y 1–5) and a gallery east of it (x 9–11), joined by an archway (8,2) and
  // a staff door (8,4), its openings; the entrance in the gallery.
  const MAP = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 }, { key: 's1', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }];
  const OPENINGS = [{ x: 8, y: 2, ch: ',' }, { x: 8, y: 4, ch: 'S' }];
  const BODY = { hp: 60, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const DEPTHS = H.DEPTHS, N_LIFT = C.N.SEAL_LIFT_TURNS;
  // A room with the hall. o: you ([5, 2]); piece (its record: a 2×2 Centrepiece at (1,4),
  // hunting, held still by a fixed status for 9,999 turns unless o.still is false); more (other
  // exhibits); form; clock ({B: 300, G: 60}); items; hp (yours, of 999).
  function hall(X, depth, o) {
    o = o || {};
    const piece = Object.assign({ sp: 'dummy', at: [1, 4], size: 2, role: 'centrepiece', mode: 'hunting', stats: BODY },
      o.still === false ? {} : { statuses: [{ id: 'fixed', turns: 9999 }] }, o.piece || {});
    const spec = { acc: 'T0', depth, map: o.map || MAP, you: o.you || [5, 2], exhibits: [piece].concat(o.more || []), rooms: ROOMS,
      cp: Object.assign({ uids: [`T0.${depth}.room.1`], room: 'centre' }, o.form ? { form: o.form } : {}),
      clock: o.clock || { B: 300, G: 60 }, entrance: [11, 3], fixtures: [{ k: 'staff', x: 8, y: 4, grade: 1 }], items: o.items || [] };
    const s = H.room(X, 1, spec, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = o.hp === undefined ? 999 : o.hp;
    return s;
  }
  const stages = (ev, k) => ev.filter(e => e.k === 'stage' && e.cause && e.cause.k === 'hall' && (!k || e.stage === k));
  const tilesAt = s => OPENINGS.map(o => s.dept.tiles[o.y][o.x]).join('');
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  const clean = t => typeof t === 'string' && t.length > 0 && !/undefined|NaN|\[object|\bnull\b/.test(t);
  const allVisible = s => new Uint8Array(s.dept.w * s.dept.h).fill(1);

  // ---- The seal ----

  test('the hall seals on the hunt: at the boundary its piece, woken by your ring, begins to hunt you, with you inside; every opening, the staff door too, under a shutter, the clock paused; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { you: [4, 3], piece: { mode: 'dormant' }, still: false });
      const r = H.play(C, s, (state, i) => i < 6 ? wait : null, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const hunt = r.events.find(e => e.k === 'hunting' && e.who === `T0.${depth}.room.1`), sealed = stages(r.events, 'sealed');
      if (!hunt) { problems.push(`d${depth}: the piece never hunted`); continue; }
      if (sealed.length !== 1 || sealed[0].turn !== hunt.turn) problems.push(`d${depth}: hunted at turn ${hunt.turn}, sealed ${json(sealed.map(e => e.turn))}`);
      if (r.events.indexOf(sealed[0]) < r.events.indexOf(hunt)) problems.push(`d${depth}: the seal came before the hunt`);
      if (json(sealed[0] && sealed[0].cause) !== json({ k: 'hall', why: 'hunt', by: `T0.${depth}.room.1` })) problems.push(`d${depth}: the seal's cause ${json(sealed[0] && sealed[0].cause)}`);
      if (tilesAt(s) !== 'ZZ') problems.push(`d${depth}: the openings are ${tilesAt(s)}`);
      if (json(s.dept.cp.openings) !== json(OPENINGS)) problems.push(`d${depth}: the openings keep ${json(s.dept.cp.openings)}`);
      if (s.dept.clock.pausedSince !== hunt.turn || s.dept.clock.count !== hunt.turn - 1) problems.push(`d${depth}: the clock ${json(s.dept.clock)} after a seal at turn ${hunt.turn}`);
      const words = say(C, s, sealed[0]);
      if (!/^Shutters closed over the hall’s openings, since the training dummy is hunting you: .* They open once the Centrepiece has gone 50 turns without hurting you or ending a turn beside you, once it falls or goes under its dust sheet or none of it is left in the hall, or when you read a Re-admission Ticket\.$/.test(words)) problems.push(`d${depth}: ${words}`);
    }
    assert.deepEqual(problems, []);
  });

  test('no seal from outside: a hunting piece and you in the gallery or in an opening seal nothing, and say nothing; one step in, and it seals at that step\'s boundary', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { you: [10, 3] });
      let r = H.play(C, s, Array(8).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} gallery`));
      if (stages(r.events).length || tilesAt(s) !== ',S' || s.dept.clock.pausedSince !== null) problems.push(`d${depth}: sealed from the gallery: ${json(stages(r.events).map(e => e.stage))} ${tilesAt(s)}`);
      const u = hall(C, depth, { you: [8, 2] });
      r = H.play(C, u, Array(5).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} archway`));
      if (stages(r.events).length || tilesAt(u) !== ',S') problems.push(`d${depth}: sealed with you in the archway: ${json(stages(r.events).map(e => e.stage))}`);
      r = H.play(C, u, [{ a: 'move', dir: 6 }], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} step in`));
      const sealed = stages(r.events, 'sealed');
      if (sealed.length !== 1 || sealed[0].turn !== u.turn || tilesAt(u) !== 'ZZ' || u.actors[0].x !== 7) problems.push(`d${depth}: one step in: ${json(sealed)} ${tilesAt(u)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('an occupied opening delays the seal: it says once that it waits, naming the hunting piece that calls for the seal as its cause (so the stage is the piece\'s doing, never the bystander\'s) and who stands there, seen; and seals at the first boundary every opening is clear', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const dummy = { sp: 'dummy', at: [8, 2], mode: 'dormant', stats: { hp: 1, acc: -99, eva: -999, pad: 0, dmin: 1, dmax: 1 } };
      const s = hall(C, depth, { you: [7, 2], more: [dummy] }), who = `T0.${depth}.room.2`, piece = `T0.${depth}.room.1`;
      let r = H.play(C, s, Array(5).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const w = stages(r.events, 'waiting');
      if (w.length !== 1 || w[0].turn !== 1 || json(w[0].cause) !== json({ k: 'hall', why: 'hunt', by: piece, in: who }) || stages(r.events, 'sealed').length || tilesAt(s) !== ',S') problems.push(`d${depth}: waiting ${json(w)} with ${tilesAt(s)}`);
      // The soak's completeness holds the stage to its causer: the piece, whose line covers it.
      if (w[0] && B.causer(w[0]) !== piece) problems.push(`d${depth}: the waiting stage is ${B.causer(w[0])}'s doing`);
      if (w[0] && say(C, s, w[0]) !== 'The hall would seal, but the training dummy stands in an opening: its shutters close once every opening is clear while you and the Centrepiece are inside and it hunts you.') problems.push(`d${depth}: ${say(C, s, w[0])}`);
      r = H.play(C, s, (state, i) => i < 10 && !state.actors[2].gone ? { a: 'attack', uid: who } : null, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} clearing`));
      const died = r.events.find(e => e.k === 'died' && e.who === who), sealed = stages(r.events, 'sealed');
      if (!died || sealed.length !== 1 || r.events.indexOf(sealed[0]) < r.events.indexOf(died) || sealed[0].turn !== s.turn || tilesAt(s) !== 'ZZ') problems.push(`d${depth}: cleared at ${died && died.turn}, sealed ${json(sealed.map(e => e.turn))}`);
      if (stages(r.events, 'waiting').length) problems.push(`d${depth}: it said again that it waits`);
    }
    assert.deepEqual(problems, []);
  });

  test('a staff door is shuttered with the archway, the board shows no staff door under its shutter, nor a label for it (one open on it closes), and it is a staff door again when the shutters open', () => {
    const s = hall(C, 3, { you: [7, 4] });
    const staff = () => C.Cases.staffView(s, allVisible(s)).map(f => [f.x, f.y]);
    assert.equal(json(staff()), json([[8, 4]]));
    assert.equal(C.Labels.of(s, 'staff:8,4').odds[0], 'Your grade (Grade I) opens it.');
    H.play(C, s, [wait], { inv: 'all' });
    assert.equal(tilesAt(s), 'ZZ');
    assert.equal(json(staff()), '[]');
    assert.equal(json(C.ViewModel.derive(s, {}).staff), '[]');
    // A label selected on it before the seal: js/main.js closes a label Labels.of no longer gives.
    assert.equal(C.Labels.of(s, 'staff:8,4'), null);
    C.Hall.onDefeat(s, []);
    assert.equal(tilesAt(s), ',S');
    assert.equal(json(staff()), json([[8, 4]]));
    assert.equal(C.Labels.of(s, 'staff:8,4').title, 'A staff door');
  });

  // ---- While sealed ----

  test('while sealed the clock\'s count stops and you do not regenerate; once the shutters open, both go on', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { hp: 900 });
      const r = H.play(C, s, Array(N_LIFT + 6).fill(wait), { inv: 'all' });
      problems.push(...bad(r, `d${depth}`));
      const lift = stages(r.events, 'unsealed')[0];
      const regen = r.events.filter(e => e.k === 'regenerated').map(e => e.turn);
      if (!lift || lift.turn !== 1 + N_LIFT) { problems.push(`d${depth}: lifted ${json(lift)}`); continue; }
      if (regen.some(t => t <= lift.turn)) problems.push(`d${depth}: you regenerated while sealed, at turns ${json(regen.filter(t => t <= lift.turn))}`);
      if (!regen.length) problems.push(`d${depth}: you never regenerated after the lift`);
      // Sealed at boundary 1 before the clock counted it: the count is 0 until the lift's boundary counts again.
      if (s.dept.clock.count !== s.turn - N_LIFT) problems.push(`d${depth}: the count is ${s.dept.clock.count} at turn ${s.turn}`);
    }
    assert.deepEqual(problems, []);
  });

  test('Hall.addCheck: an added check runs at each boundary after the seal\'s own step (it sees the hall sealed at the boundary it seals, and open at the one it opens), in the order added, and none once the visit is over', () => {
    const X = loadCore(), seen = [];
    X.Hall.addCheck('probe_a', state => seen.push(['a', state.turn, !!state.dept.cp.sealed]));
    X.Hall.addCheck('probe_b', state => seen.push(['b', state.turn, !!state.dept.cp.sealed]));
    assert.throws(() => X.Hall.addCheck('probe_a', () => {}), /added twice/);
    const s = hall(X, 3);
    H.play(X, s, [wait, wait], { inv: 'all' });
    assert.equal(json(seen), json([['a', 1, true], ['b', 1, true], ['a', 2, true], ['b', 2, true]]));
    X.Hall.onDefeat(s, []);
    seen.length = 0;
    s.over = { k: 'left', turn: s.turn };
    X.Hall.boundary(s, []);
    assert.equal(json(seen), '[]');
  });

  test('a body that covers an opening with any of its tiles (a 2×2 piece standing half in a double archway) keeps the shutters open, and the hall says so', () => {
    const map = MAP.slice(); map[1] = '#.......,...#';
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const big = { sp: 'dummy', at: [7, 1], size: 2, mode: 'dormant', statuses: [{ id: 'fixed', turns: 9999 }], stats: BODY };
      const s = hall(C, depth, { map, you: [4, 4], piece: { at: [1, 4] }, more: [big] });
      const r = H.play(C, s, Array(3).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const w = stages(r.events, 'waiting');
      if (C.Clock.sealed(s) || w.length !== 1 || w[0].cause.in !== s.actors[2].uid || w[0].cause.by !== s.actors[1].uid) problems.push(`d${depth}: sealed ${C.Clock.sealed(s)}, waiting ${json(w)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('an occupied opening out of your sight: the hall says it waits without naming who stands there, "someone out of your sight", and the stage is still the hunting piece\'s doing; one you see is named before one you do not', () => {
    // Pillars (4,2) and (4,3) hide the archway (8,2) from you at (1,3), and from (7,5), which sees
    // the staff door (8,4).
    const map = MAP.slice(); map[2] = '#...o...,...#'; map[3] = '#...o...#...#';
    const sleeper = at => ({ sp: 'dummy', at, mode: 'dormant', statuses: [{ id: 'fixed', turns: 9999 }], stats: BODY });
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { map, you: [1, 3], more: [sleeper([8, 2])] }), piece = `T0.${depth}.room.1`;
      if (C.Vision.visible(s)[2 * s.dept.w + 8]) { problems.push(`d${depth}: the archway is in your sight, so this shows nothing`); continue; }
      const r = H.play(C, s, [wait, wait], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const w = stages(r.events, 'waiting');
      if (w.length !== 1 || json(w[0].cause) !== json({ k: 'hall', why: 'hunt', by: piece }) || B.causer(w[0]) !== piece) problems.push(`d${depth}: waiting ${json(w)}`);
      const words = w[0] ? say(C, s, w[0]) : '';
      if (words !== 'The hall would seal, but someone out of your sight stands in an opening: its shutters close once every opening is clear while you and the Centrepiece are inside and it hunts you.') problems.push(`d${depth}: ${words}`);
      if (/training dummy/.test(C.Text.log(r.events, C.Labels.nameOf(s), () => false).join(' '))) problems.push(`d${depth}: the log names the dummy out of your sight`);
      // Two in the openings, the first (by the openings' order) out of sight: the one seen is named.
      const t = hall(C, depth, { map, you: [7, 5], more: [sleeper([8, 2]), sleeper([8, 4])] });
      if (!C.Vision.visible(t)[4 * t.dept.w + 8] || C.Vision.visible(t)[2 * t.dept.w + 8]) { problems.push(`d${depth}: you see the archway, or not the staff door, so this shows nothing`); continue; }
      const q = stages(H.play(C, t, [wait], { inv: 'all' }).events, 'waiting');
      if (q.length !== 1 || q[0].cause.in !== t.actors[3].uid) problems.push(`d${depth}: two in the openings: ${json(q)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('never sealed in alone: a piece hunting you from outside the hall seals nothing, however long you stay inside, and the clock counts on; once it stands in the hall with you it seals you in with it; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      // Held still in the gallery, hunting you: 60 turns inside, and nothing.
      const s = hall(C, depth, { you: [6, 3], piece: { size: 1, at: [10, 1] } });
      let r = H.play(C, s, Array(60).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} held`));
      if (stages(r.events).length || C.Clock.sealed(s) || s.dept.clock.count !== 60 || C.Hall.calls(s) !== null) problems.push(`d${depth}: held outside: ${json(stages(r.events).map(e => [e.turn, e.stage]))}, count ${s.dept.clock.count}`);
      // The hall's confirmation from outside says nothing seals behind you.
      const u = hall(C, depth, { you: [8, 2], piece: { size: 1, at: [10, 1] } });
      if (json(C.Hall.entering(u, { a: 'move', dir: 6 })) !== json({ by: null, form: 'fight', seals: false })) problems.push(`d${depth}: entering ${json(C.Hall.entering(u, { a: 'move', dir: 6 }))}`);
      // Free to come: it walks in through the archway, and the hall seals once it is inside.
      const t = hall(C, depth, { you: [6, 3], still: false, piece: { size: 1, at: [10, 1] } }), p = t.actors[1];
      r = H.play(C, t, (state, i) => i < 20 && !C.Clock.sealed(state) ? wait : null, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} walks in`));
      const sealed = stages(r.events, 'sealed'), inside = r.events.filter(e => e.k === 'moved' && e.who === p.uid && C.Hall.inside(t, e.to[0], e.to[1]));
      if (sealed.length !== 1 || !inside.length || sealed[0].turn < inside[0].turn || sealed[0].cause.by !== p.uid || !C.Hall.inside(t, p.x, p.y)) problems.push(`d${depth}: walked in ${json(inside.map(e => e.turn))}, sealed ${json(sealed)}`);
      if (r.events.some(e => e.k === 'stage' && e.cause && e.cause.k === 'hall' && e.turn < (inside[0] || { turn: 0 }).turn)) problems.push(`d${depth}: a hall stage before it came in`);
    }
    assert.deepEqual(problems, []);
  });

  test('the shutters open when none of the Centrepiece is left in the hall with you (alone): its piece inside falls while another stands outside; the sentence says so and that they close only once you have stepped out; the clock counts again', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      // A second piece of it, hunting you from the gallery, held still; the first beside you.
      const out = { sp: 'dummy', at: [10, 1], size: 1, role: 'centrepiece', mode: 'hunting', statuses: [{ id: 'fixed', turns: 9999 }], stats: BODY };
      const s = hall(C, depth, { you: [3, 3], more: [out], piece: { hp: 3, stats: Object.assign({}, BODY, { hp: 3, eva: -999 }) } });
      s.dept.cp.uids.push(s.actors[2].uid);
      let r = H.play(C, s, [wait], { inv: 'all' });
      if (!C.Clock.sealed(s) || stages(r.events, 'sealed')[0].cause.by !== s.actors[1].uid) { problems.push(`d${depth}: not sealed by the piece inside: ${json(stages(r.events))}`); continue; }
      const count = s.dept.clock.count, uid = s.actors[1].uid;
      r = H.play(C, s, (state, i) => i < 20 && C.Clock.sealed(state) ? (state.actors[1].gone ? wait : { a: 'attack', uid }) : null, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const died = r.events.find(e => e.k === 'died' && e.who === uid), lift = stages(r.events, 'unsealed');
      if (!died || json(lift.map(e => e.cause.why)) !== '["alone"]' || lift[0].turn !== Math.floor(died.tick / C.N.TICKS_PER_TURN) + 1 || tilesAt(s) !== ',S') { problems.push(`d${depth}: fell ${json(died)}, lifted ${json(lift)}`); continue; }
      if (say(C, s, lift[0]) !== 'The shutters opened: none of the Centrepiece is left in the hall with you. They do not close again until you have stepped out of the hall.') problems.push(`d${depth}: ${say(C, s, lift[0])}`);
      // Still inside, the other still hunting you from outside: no seal again, and the clock counts.
      const before = s.dept.clock.count;
      r = H.play(C, s, Array(3).fill(wait), { inv: 'all' });
      if (stages(r.events).length || before <= count || s.dept.clock.count !== before + 3) problems.push(`d${depth}: after: ${json(stages(r.events))}, count ${count}, ${before}, ${s.dept.clock.count}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a planted module\'s turn rules run at every boundary while the hall is sealed (step 8 is not stopped)', () => {
    const X = loadCore(), R = X.Registry;
    R.define('MODULES', 'planted_bell', { built: 'M4', sentence: 'A planted rule acts each turn.' });
    R.defineCause('module', 'planted_bell', { fields: {}, built: 'M4' });
    X.Text.defineCause('module', 'planted_bell', () => 'The planted rule acted.');
    X.Modules.define('planted_bell', { rules: [{ rule: 'tick', on: 'turn', do: [{ k: 'flag', name: 'ticks', value: 1 }] }] });
    const s = hall(X, 3);
    X.Modules.init(s, { acc: 'T0', species: [], modules: [{ id: 'planted_bell', role: null, params: {} }] });
    const r = H.play(X, s, Array(6).fill(wait), { inv: 'all', clone: true });
    assert.deepEqual(bad(r, 'd3'), []);
    assert.equal(stages(r.events, 'sealed')[0].turn, 1);
    assert.equal(json(r.events.filter(e => e.k === 'module').map(e => [e.turn, e.rule])), json([1, 2, 3, 4, 5, 6].map(t => [t, 'tick'])));
    assert.ok(X.Clock.sealed(s));
  });

  test('the Night Watchman is shut out: in the gallery when the hall seals, it never comes in, never stands on a shutter, never strikes you, and no other comes while the clock is stopped', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { clock: { B: 10, G: 10, count: 20 } });
      const w = C.ClockRules.spawnWatchman(s, []);
      const r = H.play(C, s, Array(30).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      if (stages(r.events, 'sealed').length !== 1 || !C.Clock.sealed(s)) problems.push(`d${depth}: not sealed`);
      if (C.Hall.inside(s, w.x, w.y) || w.gone) problems.push(`d${depth}: the Watchman stands at ${w.x},${w.y}`);
      if (r.events.some(e => (e.k === 'attacked' || e.k === 'damaged') && e.cause && e.cause.by === w.uid)) problems.push(`d${depth}: the Watchman struck at you`);
      if (s.actors.filter(a => a.arch === 'night_watchman').length !== 1 || r.events.some(e => e.k === 'stage' && e.cause && e.cause.k === 'clock')) problems.push(`d${depth}: the clock went on`);
    }
    assert.deepEqual(problems, []);
  });

  test('a Night Watchman that falls inside a sealed hall: the next comes when the clock has counted WATCHMAN_RETURN more turns, as its line says, so not while the clock is stopped, and that many turns after the shutters open', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = hall(C, depth, { you: [7, 2], clock: { B: 10, G: 10, count: 25 } });
      const w = C.ClockRules.spawnWatchman(s, []);
      Object.assign(w, { x: 6, y: 3, hp: 1 });
      // It falls to your blows inside the sealed hall; then you wait out the quiet count.
      let r = H.play(C, s, (state, i) => i < 30 && !w.gone ? (i === 0 ? wait : { a: 'attack', uid: w.uid }) : null, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const fell = r.events.find(e => e.k === 'died' && e.who === w.uid);
      if (!fell || !C.Clock.sealed(s)) { problems.push(`d${depth}: fell ${json(fell)}, sealed ${C.Clock.sealed(s)}`); continue; }
      // The dial, while the clock is stopped, says when the next comes, as the line does.
      const dial = C.Text.clock(Object.assign({ sealed: true }, C.Clock.view(s)));
      if (!dial.endsWith(` Another Night Watchman comes once it has counted ${C.N.WATCHMAN_RETURN} more turns.`)) problems.push(`d${depth}: ${dial}`);
      r = H.play(C, s, (state, i) => i < 2 * N_LIFT + C.N.WATCHMAN_RETURN + 5 && !r2(state) ? wait : null, { inv: 'all' });
      problems.push(...bad(r, `d${depth} after`));
      // The boundary that opens the shutters counts the first of those turns (the hall's step
      // comes before the clock's), so the next comes WATCHMAN_RETURN − 1 turns after it.
      const lift = stages(r.events, 'unsealed')[0], came = r.events.find(e => e.k === 'entered');
      if (!lift || !came || came.turn - lift.turn !== C.N.WATCHMAN_RETURN - 1 || came.cause.count !== 25 + C.N.WATCHMAN_RETURN) problems.push(`d${depth}: fell at ${fell.turn}, lifted ${lift && lift.turn}, the next came ${json(came)}`);
    }
    function r2(state) { return state.actors.filter(a => a.arch === 'night_watchman' && !a.gone).length > 0; }
    assert.deepEqual(problems, []);
    const line = C.Clauses.line(C.Packs.shared('night_watchman'), { depth: 3 });
    assert.ok(line.includes(`If defeated, another comes when the clock has counted ${C.N.WATCHMAN_RETURN} more turns.`), line);
  });

  // ---- The lift ----

  test('the quiet lift: after SEAL_LIFT_TURNS turns in a row in which the Centrepiece neither hurt you nor ended a turn beside you; then no seal until you have stood outside the hall at a turn\'s end; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth);
      let r = H.play(C, s, Array(N_LIFT + 1).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const sealed = stages(r.events, 'sealed'), lift = stages(r.events, 'unsealed');
      if (json(sealed.map(e => e.turn)) !== '[1]' || json(lift.map(e => [e.turn, e.cause.why])) !== json([[1 + N_LIFT, 'quiet']])) problems.push(`d${depth}: sealed ${json(sealed.map(e => e.turn))}, lifted ${json(lift.map(e => [e.turn, e.cause.why]))}`);
      // The sentence says what comes next: still inside and hunted, no seal until you have stepped out.
      if (lift[0] && say(C, s, lift[0]) !== `The shutters opened: the Centrepiece has neither hurt you nor ended a turn beside you for ${N_LIFT} turns. They do not close again until you have stepped out of the hall.`) problems.push(`d${depth}: ${say(C, s, lift[0])}`);
      if (tilesAt(s) !== ',S' || s.dept.clock.pausedSince !== null) problems.push(`d${depth}: after the lift ${tilesAt(s)} ${s.dept.clock.pausedSince}`);
      // Still inside, still hunted: no seal. A step out into the archway, a step back in: sealed again.
      r = H.play(C, s, Array(5).fill(wait).concat([{ a: 'move', dir: 2 }, { a: 'move', dir: 2 }, { a: 'move', dir: 2 }, { a: 'move', dir: 6 }]), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} again`));
      const again = stages(r.events, 'sealed');
      if (json(again.map(e => e.turn)) !== json([s.turn]) || tilesAt(s) !== 'ZZ' || s.actors[0].x !== 7) problems.push(`d${depth}: sealed again at ${json(again.map(e => e.turn))} (turn ${s.turn}), you at ${s.actors[0].x}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a piece beside you keeps the shutters down: no quiet lift while it stands beside you at each turn\'s end; once you step away the count runs from the last boundary it stood beside you', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = hall(C, depth, { you: [3, 3] });
      let r = H.play(C, s, Array(60).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      if (!C.Clock.sealed(s) || stages(r.events, 'unsealed').length) problems.push(`d${depth}: lifted while beside you: ${json(stages(r.events).map(e => [e.turn, e.stage]))}`);
      r = H.play(C, s, (state, i) => i === 0 ? { a: 'move', dir: 1 } : C.Clock.sealed(state) && i < 2 * N_LIFT ? wait : null, { inv: 'all' });
      problems.push(...bad(r, `d${depth} away`));
      const lift = stages(r.events, 'unsealed');
      if (json(lift.map(e => [e.turn, e.cause.why])) !== json([[60 + N_LIFT, 'quiet']])) problems.push(`d${depth}: beside you until turn 60, lifted ${json(lift.map(e => [e.turn, e.cause.why]))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a shutter keeps what its opening was when it closed: a door you opened on your way in is open again when the shutters open', () => {
    const map = MAP.slice(); map[2] = '#.......+...#';
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = hall(C, depth, { map, you: [9, 2] });
      // Open the door (a bump), step onto it, step in: the hall seals at that step's boundary.
      const r = H.play(C, s, [{ a: 'move', dir: 6 }, { a: 'move', dir: 6 }, { a: 'move', dir: 6 }], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      if (stages(r.events, 'sealed').length !== 1 || tilesAt(s) !== 'ZZ' || s.dept.cp.openings[0].ch !== "'") problems.push(`d${depth}: ${json(s.dept.cp.openings)} ${tilesAt(s)}`);
      C.Hall.onDefeat(s, []);
      if (tilesAt(s) !== "'S") problems.push(`d${depth}: the shutters opened onto ${tilesAt(s)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a hurt by the Centrepiece restarts the quiet count, at the boundary after it, whenever it falls; a hurt by another exhibit does not', () => {
    // A blow in the gap after a boundary (as an exhibit's action after it): the turn it falls
    // in ends at the next boundary, from which the count starts again.
    const run = (by, at, shooter) => {
      const s = hall(C, 3, { more: [{ sp: 'dummy', at: [10, 3], mode: 'dormant', stats: BODY }] });
      const ev = [];
      for (let i = 1; i <= 2 * N_LIFT && !ev.some(e => e.k === 'stage' && e.stage === 'unsealed'); i++) {
        for (const e of C.Step.step(s, wait)) ev.push(e);
        if (s.turn !== at) continue;
        // A blow; or, with a shooter, its bolt that a reflector (by) sent back (Ranged's cause).
        const cause = shooter ? { k: 'reflected', by, shooter, chance: 50, roll: 1, how: { kind: 'bolt' }, range: 3, raw: 1, pad: 0, from: [1, 4] }
          : { k: 'attack', by, at: 'you', chance: 50, roll: 1, raw: 1, pad: 0, how: { kind: 'melee' }, from: [1, 4] };
        C.Combat.hurt(s, s.actors[0], 1, cause, ev);
      }
      return stages(ev, 'unsealed').map(e => e.turn);
    };
    assert.equal(json(run('T0.3.room.1', 30)), json([31 + N_LIFT]));
    assert.equal(json(run('T0.3.room.2', 30)), json([1 + N_LIFT]));
    // A piece's bolt sent back by a reflector hurts you as the piece's: the count restarts; a
    // reflector's sending back another exhibit's does not.
    assert.equal(json(run('T0.3.room.2', 30, 'T0.3.room.1')), json([31 + N_LIFT]));
    assert.equal(json(run('T0.3.room.1', 30, 'T0.3.room.2')), json([31 + N_LIFT]));
    assert.equal(json(run('T0.3.room.2', 30, 'you')), json([1 + N_LIFT]));
    // A hurt inside the boundary, before the hall's step (a status at step 2), counts for the
    // turn that boundary ends.
    const s = hall(C, 3), ev = [];
    for (let i = 0; i < 10; i++) C.Step.step(s, wait);
    const boundary = C.Status.tick;
    C.Status.tick = (state, e) => { boundary(state, e); if (state.turn === 20) C.Combat.hurt(state, state.actors[0], 1, { k: 'attack', by: 'T0.3.room.1', at: 'you', chance: 50, roll: 1, raw: 1, pad: 0, how: { kind: 'melee' }, from: [1, 4] }, e); };
    try { for (let i = 0; i < 2 * N_LIFT && !stages(ev, 'unsealed').length; i++) for (const e of C.Step.step(s, wait)) ev.push(e); } finally { C.Status.tick = boundary; }
    assert.equal(json(stages(ev, 'unsealed').map(e => e.turn)), json([20 + N_LIFT]));
  });

  test('joined up: a Centrepiece that shoots you from across the hall (a kiter) keeps the shutters down; once it can no longer act, they open SEAL_LIFT_TURNS turns after the turn of its last hit', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) {
      const s = hall(C, depth, { you: [7, 1], still: false, piece: { size: 1, at: [2, 3], arch: 'kiter', stats: { hp: 60, acc: 99, eva: 0, pad: 0, dmin: 1, dmax: 1 } } });
      const k = s.actors[1];
      let r = H.play(C, s, Array(20).fill(wait), { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === k.uid);
      if (hits.length < 3 || stages(r.events, 'unsealed').length || !C.Clock.sealed(s)) { problems.push(`d${depth}: ${hits.length} hits, sealed ${C.Clock.sealed(s)}`); continue; }
      if (s.actors.slice(1).some(a => !a.gone && C.Actors.dist(a, 7, 1) <= 1)) problems.push(`d${depth}: the kiter came beside you`);
      // An exhibit's hit at tick t falls in the turn ending at boundary floor(t / TICKS) + 1.
      const lastTurn = Math.max(...hits.map(e => Math.floor(e.tick / C.N.TICKS_PER_TURN) + 1));
      C.Status.apply(s, k, 'fixed', 9999, { k: 'planted' }, []);
      r = H.play(C, s, (state, i) => i < 2 * N_LIFT && C.Clock.sealed(state) ? wait : null, { inv: 'all' });
      problems.push(...bad(r, `d${depth} still`));
      const lift = stages(r.events, 'unsealed');
      if (json(lift.map(e => [e.turn, e.cause.why])) !== json([[lastTurn + N_LIFT, 'quiet']])) problems.push(`d${depth}: last hit in the turn ending ${lastTurn}, lifted ${json(lift.map(e => [e.turn, e.cause.why]))}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a Re-admission Ticket unseals the hall: you at the entrance, the openings as they were, the clock running; each piece regains SEAL_HEAL_PCT of its maximum health and goes back to its place; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { still: false, piece: { hp: 20, maxHp: 60 } });
      C.Consumables.startRun(s);
      const tk = C.Consumables.make(s, 'ticket', { at: 'tote' });
      s.run.knownSeals.push(C.Consumables.sealFor(s, 'ticket'));
      let r = H.play(C, s, [wait], { inv: 'all', clone: true });
      if (!C.Clock.sealed(s)) { problems.push(`d${depth}: not sealed`); continue; }
      const p = s.actors[1], before = p.hp, heal = Math.min(p.maxHp - p.hp, Math.floor(p.maxHp * C.N.SEAL_HEAL_PCT / 100));
      r = H.play(C, s, [{ a: 'use', uid: tk.uid }], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const lift = stages(r.events, 'unsealed'), healed = r.events.find(e => e.k === 'healed' && e.who === p.uid), back = r.events.find(e => e.k === 'lost' && e.who === p.uid && e.cause.k === 'hall');
      if (json(lift.map(e => e.cause.why)) !== '["ticket"]') problems.push(`d${depth}: lifted ${json(lift.map(e => e.cause))}`);
      if (!healed || healed.amount !== heal || healed.hp !== before + heal) problems.push(`d${depth}: healed ${json(healed)}, wanted ${heal} from ${before}`);
      if (!back || back.to !== 'returning') problems.push(`d${depth}: went back ${json(back)}`);
      if (s.actors[0].x !== 11 || s.actors[0].y !== 3 || tilesAt(s) !== ',S' || s.dept.clock.pausedSince !== null) problems.push(`d${depth}: you at ${s.actors[0].x},${s.actors[0].y}, ${tilesAt(s)}`);
      for (const e of [lift[0], healed, back]) if (e && !clean(say(C, s, e))) problems.push(`d${depth}: ${say(C, s, e)}`);
      // From the entrance nothing seals again, and the clock counts.
      const count = s.dept.clock.count;
      r = H.play(C, s, Array(4).fill(wait), { inv: 'all' });
      if (stages(r.events).length || s.dept.clock.count !== count + 4) problems.push(`d${depth}: after the Ticket ${json(stages(r.events).map(e => e.stage))}, count ${s.dept.clock.count}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a Ticket read while the hall is not sealed (it waits on an opening, or you are outside it) says nothing of the hall and changes nothing of it: no shutters open, no piece healed or sent back by it', () => {
    const problems = [];
    for (const depth of [1, 4, 7]) for (const where of ['waiting', 'outside']) {
      const dummy = { sp: 'dummy', at: [8, 2], mode: 'dormant', statuses: [{ id: 'fixed', turns: 9999 }], stats: BODY };
      const s = where === 'waiting' ? hall(C, depth, { you: [6, 3], more: [dummy], piece: { hp: 20, maxHp: 60 } }) : hall(C, depth, { you: [10, 2], piece: { hp: 20, maxHp: 60 } });
      C.Consumables.startRun(s);
      const tk = C.Consumables.make(s, 'ticket', { at: 'tote' });
      s.run.knownSeals.push(C.Consumables.sealFor(s, 'ticket'));
      let r = H.play(C, s, [wait], { inv: 'all' });
      if (C.Clock.sealed(s) || (where === 'waiting') !== !!s.dept.cp.waiting) { problems.push(`d${depth} ${where}: ${json(s.dept.cp)}`); continue; }
      r = H.play(C, s, [{ a: 'use', uid: tk.uid }, wait], { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth} ${where}`));
      const told = r.events.filter(e => e.cause && e.cause.k === 'hall');
      if (told.length || tilesAt(s) !== ',S' || s.actors[1].hp !== 20) problems.push(`d${depth} ${where}: ${json(told)} ${tilesAt(s)} hp ${s.actors[1].hp}`);
    }
    assert.deepEqual(problems, []);
  });

  test('defeat lifts the seal: its last piece falling opens the shutters at the next boundary, or at once when the Centrepiece\'s rules call Hall.onDefeat; a treasure\'s guardian and a dust sheet say so; the hall never seals again', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = hall(C, depth, { you: [3, 3], piece: { hp: 1, stats: { hp: 1, acc: -99, eva: -999, pad: 0, dmin: 1, dmax: 1 } } });
      let r = H.play(C, s, [wait], { inv: 'all', clone: true });
      const uid = s.actors[1].uid;
      r = H.play(C, s, (state, i) => i < 10 && !state.actors[1].gone ? { a: 'attack', uid } : null, { inv: 'all', clone: true });
      problems.push(...bad(r, `d${depth}`));
      const died = r.events.find(e => e.k === 'died' && e.who === uid), lift = stages(r.events, 'unsealed');
      if (!died || json(lift.map(e => [e.turn, e.cause.why])) !== json([[s.turn, 'defeat']]) || tilesAt(s) !== ',S') problems.push(`d${depth}: died ${json(died)}, lifted ${json(lift)}`);
      r = H.play(C, s, Array(4).fill(wait), { inv: 'all' });
      if (stages(r.events).length) problems.push(`d${depth}: after the defeat ${json(stages(r.events).map(e => e.stage))}`);
    }
    // Hall.onDefeat at once: a fight's defeat, a treasure guardian's (its hall sealed by a
    // planted treasure rule), and a Centrepiece under its dust sheet.
    for (const [form, sheet, why] of [['fight', null, 'defeat'], ['treasure', null, 'treasure'], ['fight', { x: 1, y: 4 }, 'sheet']]) {
      const X = loadCore();
      X.Hall.defineSeal('treasure', () => ({ why: 'touched' }));
      const s = hall(X, 3, { form });
      H.play(X, s, [wait], { inv: 'all' });
      if (!X.Clock.sealed(s)) { problems.push(`${form}: not sealed`); continue; }
      s.dept.cp.sheet = sheet;
      const ev = [];
      X.Hall.onDefeat(s, ev);
      if (json(stages(ev).map(e => [e.stage, e.cause.why])) !== json([['unsealed', why]]) || tilesAt(s) !== ',S' || X.Clock.sealed(s)) problems.push(`${form} ${why}: ${json(ev)}`);
      else if (!clean(say(X, s, ev[0]))) problems.push(say(X, s, ev[0]));
      const again = [];
      X.Hall.onDefeat(s, again);
      if (again.length) problems.push(`${form}: a second defeat said ${json(again)}`);
    }
    assert.deepEqual(problems, []);
  });

  test('a treasure\'s hall does not seal on the hunt; its form\'s seal rule (Hall.defineSeal) does, with that rule\'s why', () => {
    const s = hall(C, 3, { form: 'treasure' });
    const r = H.play(C, s, Array(4).fill(wait), { inv: 'all' });
    assert.equal(stages(r.events).length, 0);
    assert.equal(C.Hall.calls(s), null);
    const X = loadCore();
    X.Hall.defineSeal('treasure', (state, c) => state.turn >= 2 ? { why: 'touched' } : null);
    assert.throws(() => X.Hall.defineSeal('treasure', () => null), /defined twice/);
    const t = hall(X, 3, { form: 'treasure' });
    const q = H.play(X, t, Array(4).fill(wait), { inv: 'all' });
    assert.deepEqual(bad(q, 'treasure'), []);
    assert.equal(json(stages(q.events).map(e => [e.turn, e.stage, e.cause.why])), json([[2, 'sealed', 'touched']]));
    assert.match(say(X, t, stages(q.events)[0]), /^Shutters closed over the hall’s openings: it is sealed/);
    // A rule that answers nonsense is a bug.
    const Y = loadCore();
    Y.Hall.defineSeal('treasure', () => ({ why: 3 }));
    assert.throws(() => Y.Step.step(hall(Y, 3, { form: 'treasure' }), wait), /seal rule gave/);
  });

  test('your memory of an opening follows its shutter, as the stage event tells you: a remembered opening out of sight shows its shutter, and opens again; one never seen stays unseen', () => {
    const map = MAP.slice(); map[2] = '#...o...,...#'; map[3] = '#...o...#...#';
    const s = hall(C, 3, { map, you: [1, 3] });
    // You remember the whole map but the staff door (as a Floor Plan read earlier would, but that).
    const n = s.dept.w * s.dept.h, i = 4 * s.dept.w + 8, j = 2 * s.dept.w + 8;
    s.dept.seen = s.dept.tiles.join('').slice(0, i) + ' ' + s.dept.tiles.join('').slice(i + 1);
    assert.equal(s.dept.seen.length, n);
    assert.ok(!C.Vision.visible(s)[j], 'the archway is out of your sight');
    H.play(C, s, [wait], { inv: 'all' });
    assert.ok(C.Clock.sealed(s));
    const vm = C.ViewModel.derive(s, {});
    assert.equal(vm.vis[j], 1, 'remembered, not in view');
    assert.equal(vm.tiles[2][8], 'Z', 'the remembered archway shows its shutter');
    assert.equal(vm.tiles[4][8], ' ', 'the staff door, never seen, stays unseen');
    C.Hall.onDefeat(s, []);
    assert.equal(C.ViewModel.derive(s, {}).tiles[2][8], ',', 'and it opens again in your memory');
    // A door you remember shut, which an exhibit opened out of your sight before the seal: as
    // the shutters open you remember it shut, as you last saw it, not as it is now.
    const doorMap = map.slice(); doorMap[2] = '#...o...+...#';
    for (const [how, lift] of [['defeat', t => C.Hall.onDefeat(t, [])], ['quiet', t => H.play(C, t, Array(N_LIFT).fill(wait), { inv: 'all' })]]) {
      const t = hall(C, 3, { map: doorMap, you: [3, 2] });
      t.dept.seen = t.dept.tiles.join('');
      C.Grid.set(t.dept, 8, 2, "'");
      H.play(C, t, [wait], { inv: 'all' });
      assert.ok(C.Clock.sealed(t) && !C.Vision.visible(t)[j], how);
      assert.equal(C.ViewModel.derive(t, {}).tiles[2][8], 'Z', how);
      lift(t);
      assert.ok(!C.Clock.sealed(t), how);
      assert.equal(t.dept.tiles[2][8], "'", `${how}: the door is open`);
      assert.equal(C.ViewModel.derive(t, {}).tiles[2][8], '+', `${how}: your memory shows the open door you never saw`);
    }
  });

  // ---- The words ----

  test('Hall.entering and the hall\'s confirmation: a step from outside onto a free tile of the hall, while its Centrepiece stands; "the hall will seal behind you" exactly when its piece hunts you and every other opening is clear', () => {
    const nameOf = () => uid => uid === 'T0.3.room.1' ? 'the Great Board' : null;
    const at = (you, more, extra) => hall(C, 3, Object.assign({ you, more }, extra || {}));
    let s = at([8, 2]);
    const step = { a: 'move', dir: 6 };
    assert.equal(json(C.Hall.entering(s, step)), json({ by: 'T0.3.room.1', form: 'fight', seals: true }));
    const c = C.Text.confirm('hall', C.Hall.entering(s, step), nameOf(s));
    assert.equal(json(c), json({ title: 'Step into the Centrepiece’s hall?', yes: 'Step in',
      line: `The Great Board is hunting you, so the hall will seal behind you as this turn ends, unless someone then stands in one of its openings: shutters close over its openings, the clock stops, and you do not recover health; they open once the Centrepiece has gone ${N_LIFT} turns without hurting you or ending a turn beside you, once it falls or goes under its dust sheet or none of it is left in the hall, or when you read a Re-admission Ticket.` }));
    // Not a step in: a wait, a step along the gallery, a step from inside, a bump into an exhibit.
    assert.equal(C.Hall.entering(s, wait), null);
    assert.equal(C.Hall.entering(s, { a: 'move', dir: 2 }), null);
    assert.equal(C.Hall.entering(at([6, 2]), { a: 'move', dir: 6 }), null);
    assert.equal(C.Hall.entering(at([8, 2], [{ sp: 'dummy', at: [7, 2], mode: 'dormant', stats: BODY }]), step), null);
    // Someone in the other opening: no seal yet, and the words say what would seal it.
    s = at([8, 2], [{ sp: 'dummy', at: [8, 4], mode: 'dormant', stats: BODY }]);
    const e = C.Hall.entering(s, step);
    assert.equal(json(e), json({ by: 'T0.3.room.1', form: 'fight', seals: false }));
    assert.match(C.Text.confirm('hall', e, nameOf(s)).line, /^If the Centrepiece hunts you while you and it are inside, the hall seals at the end of a turn when no one stands in its openings: /);
    // A sleeping piece: no seal yet. A treasure's hall: its label says when.
    assert.equal(json(C.Hall.entering(at([8, 2], [], { piece: { mode: 'dormant' } }), step)), json({ by: null, form: 'fight', seals: false }));
    s = at([8, 2], [], { form: 'treasure' });
    assert.match(C.Text.confirm('hall', C.Hall.entering(s, step), nameOf(s)).line, /^This hall can seal while you are inside it, as its guardian’s label says: /);
    // A treasure's hall whose own rule calls for the seal (a planted one, as COMPOSITE-PHASES's
    // will): it seals behind you, and the words never say its guardian hunts you, though it does;
    // and once it waits on an opening, the waiting words do not either. Both come true.
    {
      const X = loadCore();
      X.Hall.defineSeal('treasure', () => ({ why: 'touched' }));
      const t = hall(X, 3, { you: [8, 2], form: 'treasure' }), te = X.Hall.entering(t, step);
      assert.equal(json(te), json({ by: null, form: 'treasure', seals: true }));
      const line = X.Text.confirm('hall', te, nameOf(t)).line;
      assert.match(line, /^The hall will seal behind you as this turn ends, as its guardian’s label says, unless someone then stands in one of its openings: /);
      assert.doesNotMatch(line, /hunt/);
      const q = H.play(X, t, [step], { inv: 'all' });
      assert.equal(json(stages(q.events).map(e => [e.stage, e.cause.why])), json([['sealed', 'touched']]));
      const u = hall(X, 3, { you: [7, 2], form: 'treasure', more: [{ sp: 'dummy', at: [8, 4], mode: 'dormant', stats: BODY }] });
      const w = stages(H.play(X, u, [wait], { inv: 'all' }).events, 'waiting');
      assert.equal(say(X, u, w[0]), 'The hall would seal, but the training dummy stands in an opening: its shutters close once every opening is clear while you are inside.');
    }
    // Sealed, or its Centrepiece gone: nothing to ask.
    s = at([8, 2]); s.actors[1].gone = 1;
    assert.equal(C.Hall.entering(s, step), null);
    // And what it says comes true: the step in seals it at its boundary.
    s = at([8, 2]);
    const r = H.play(C, s, [step], { inv: 'all' });
    assert.equal(stages(r.events, 'sealed').length, 1);
    assert.equal(C.Hall.entering(s, { a: 'move', dir: 2 }), null);
  });

  test('the threat\'s confirmation: a special already marked keeps its words; a due line not yet marked (a chime still to come) is named as its owner will mark it, never as a marked tile; the others that strike there are listed', () => {
    const nameOf = uid => ({ 'x.1': 'the Signal Station', 'x.2': 'the Warden' })[uid] || null;
    const marked = C.Text.confirm('threat', { by: 'x.1', shape: 'line', dmg: 6, stay: true, marked: true, due: false }, nameOf);
    assert.equal(json(marked), json({ title: 'Stay on the marked tile?', yes: 'Stay', line: 'The Signal Station’s beam goes off on that tile before your next turn: it would deal you 6, with no roll.' }));
    const due = C.Text.confirm('threat', { by: 'x.1', shape: 'planted_row', dmg: 7, stay: true, marked: false, due: true }, nameOf);
    // (A line not yet marked has no tiles yet, and the threat warns of every tile it could take:
    // so it "can" strike there, MOD-CHIME.)
    assert.equal(json(due), json({ title: 'Stay where a line can strike?', yes: 'Stay', line: 'The Signal Station is to mark its line before your next turn; it can reach that tile, and it goes off before then: it would deal you 7, with no roll.' }));
    const step = C.Text.confirm('threat', { by: 'x.1', shape: null, dmg: 7, stay: false, marked: false, due: true,
      more: [{ by: 'x.2', shape: 'ring', dmg: 3, marked: true, due: false }, { by: 'x.3', shape: null, dmg: 2, marked: false, due: true }] }, nameOf);
    assert.equal(json(step), json({ title: 'Step where a line can strike?', yes: 'Step there',
      line: 'The Signal Station is to mark its line before your next turn; it can reach that tile, and it goes off before then: it would deal you 7, with no roll. More go off there before your next turn: the Warden’s ring of blows, dealing 3; an exhibit’s line, dealing 2 (not yet marked: it can reach there).' }));
    const one = C.Text.confirm('threat', { by: 'x.2', shape: 'ring', dmg: 3, stay: false, more: [{ by: 'x.1', shape: 'line', dmg: 6 }] }, nameOf);
    assert.match(one.line, /with no roll\. Another goes off there before your next turn: the Signal Station’s beam, dealing 6\.$/);
    for (const c of [marked, due, step, one]) assert.ok(clean(c.title) && clean(c.yes) && clean(c.line) && /^[A-Z].*\.$/.test(c.line), json(c));
  });

  test('joined up: js/main.js\'s threatPart tells the confirmation whether a threat\'s line is marked yet: a 300-tick equip begun before a planted chime\'s line is marked is warned of it as a line still to be marked, by its owner, with its damage; begun after, as a marked tile', () => {
    // main.js's threatPart, run on the core's namespaces (the browser's globals).
    const acorn = require(path.join(root, 'tools/vendor/acorn/acorn.js')), vm = require('node:vm');
    const src = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8'), ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    let fn = null;
    (function walk(n) { if (!n || typeof n.type !== 'string' || fn) return; if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'threatPart') { fn = n; return; } for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast);
    assert.ok(fn, 'main.js has threatPart');
    const X = loadCore(), S = X.Specials, TPT = X.N.TICKS_PER_TURN, R = 11;
    S.addShape('planted_row', { tiles: (state, a) => X.Ranged.beam(state, a, 2, R), from: (state, a) => X.Ranged.beamFrom(state, a, 2, R), via: (state, a) => X.Ranged.beamVia(state, a, 2, R), glass: true });
    X.Registry.define('SPECIALS', 'planted_due', { shape: 'planted_row', effect: 'damage', curve: 'ROLE_ARTILLERY_SPECIAL', range: null, every: null });
    X.Registry.define('ARCHETYPES', 'planted_station', { special: null });
    X.Archetypes.add('planted_station', { act: (state, a, ev) => X.AI.wait(state, a, ev), marksAwake: () => true });
    X.Registry.define('MODULES', 'planted_chime', { built: 'M4', sentence: 'A planted chime.' });
    X.Registry.defineCause('module', 'planted_chime', { fields: {}, built: 'M4' });
    X.Text.defineCause('module', 'planted_chime', (e, w) => `${e.who ? w.Name(e.who) + ': ' : ''}the planted chime acted.`);
    const stations = state => state.actors.filter(a => a.arch === 'planted_station' && !a.gone), tiles = (state, a) => S.tiles(state, a, 'planted_row');
    // Marked on every turn ≡ 1 (mod 3) from the start, due two turns later.
    X.Modules.define('planted_chime', {
      rules: [{ rule: 'line', on: 'period', every: 3, at: 1, who: stations, when: (state, e, m, a) => S.canMark(state, a, 'planted_due', tiles(state, a)),
        telegraph: { turns: 2, shown: 'planted_due' }, do: [{ k: 'special', sp: 'planted_due', due: state => (state.turn + 2) * TPT }] }],
      bespoke: ['threat'],
      threat(state, until, m) {
        const out = [];
        for (const st of stations(state)) {
          const t = st.telegraph;
          if (t && Number.isInteger(t.due) && t.due < until) out.push({ by: st.uid, sp: t.sp, tiles: t.tiles, gross: t.gross, due: t.due });
          for (let T = state.turn + 1; (T + 2) * TPT < until; T++) if ((T - m.since) % 3 === 1) out.push({ by: st.uid, sp: 'planted_due', tiles: tiles(state, st), gross: S.info(state, 'planted_due').gross, due: (T + 2) * TPT });
        }
        return out;
      },
    });
    const GARMENT = { uid: 'g2', kind: 'garment', form: 'standard', tier: 3, where: { at: 'tote' } };
    const make = () => {
      const s = X.Setup.room(1, { acc: 'T0', depth: 3, map: ['#############', '#...........#', '#############'], you: [10, 1], items: [GARMENT],
        exhibits: [{ sp: 'dummy', at: [1, 1], arch: 'planted_station', mode: 'awake', stats: { hp: 400, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, next: 100000 }] });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      X.Modules.init(s, { acc: 'T0', species: [], modules: [{ id: 'planted_chime', role: null, params: {} }] });
      return s;
    };
    const part = s => vm.runInNewContext('(' + src.slice(fn.start, fn.end) + ')', { state: s, Actors: X.Actors, Registry: X.Registry, Object });
    const ask = (s, action) => {
      const t = S.threat(s, action), p = part(s), you = s.actors[0];
      return t && X.Text.confirm('threat', Object.assign(p(t), { stay: t.x === you.x && t.y === you.y, more: (t.more || []).map(p) }), X.Labels.nameOf(s));
    };
    // Before the chime: the equip runs past the boundary the line goes off at.
    const s = make(), equip = { a: 'equip', uid: 'g2' };
    const dmg = S.net(S.info(s, 'planted_due').gross, s.actors[0].pad);
    const before = ask(s, equip);
    assert.ok(before, 'the equip is warned of');
    assert.equal(before.title, 'Stay where a line can strike?');
    assert.equal(before.line, `An exhibit is to mark its line before your next turn; it can reach that tile, and it goes off before then: it would deal you ${dmg}, with no roll.`);
    // After the chime has marked it: a marked tile.
    const u = make();
    X.Step.step(u, { a: 'wait' }); X.Step.step(u, { a: 'wait' });
    assert.ok(u.actors[1].telegraph, 'the line is marked');
    const after = ask(u, { a: 'wait' });
    assert.equal(after.title, 'Stay on the marked tile?');
    assert.match(after.line, /^An exhibit’s line goes off on that tile before your next turn: it would deal you \d+, with no roll\.$/);
  });

  test('the sealed chip and the dial: "Sealed: the clock is stopped", with ", the chime still sounds" while the chime\'s module is on; the dial counts what comes next from when the clock starts again', () => {
    const v = C.Clock.view(hall(C, 3, { clock: { B: 300, G: 60, count: 40 } }));
    assert.equal(json(C.Text.stage(v)), json({ name: 'Open:', next: 'bell in 260 turns' }));
    assert.equal(json(C.Text.stage(Object.assign({ sealed: true, chime: false }, v))), json({ name: 'Sealed:', next: 'the clock is stopped' }));
    assert.equal(json(C.Text.stage(Object.assign({ sealed: true, chime: true }, v))), json({ name: 'Sealed:', next: 'the clock is stopped, the chime still sounds' }));
    assert.equal(json(C.Text.stage(Object.assign({ sealed: false, chime: true }, v))), json({ name: 'Open:', next: 'bell in 260 turns' }));
    assert.equal(C.Text.clock(v), 'The clock: open hours, turn 40; the bell rings in 260 turns.');
    assert.equal(C.Text.clock(Object.assign({ sealed: true }, v)), 'The clock is stopped while the hall is sealed: open hours, turn 40; the bell rings once it has counted 260 more turns.');
    const night = C.Clock.view(hall(C, 3, { clock: { B: 10, G: 10, count: 21 } }));
    assert.equal(C.Text.clock(Object.assign({ sealed: true }, night)), 'The clock is stopped while the hall is sealed: the night watch, turn 21; the next night-watch bell rings once it has counted 29 more turns.');
    const soon = C.Clock.view(hall(C, 3, { clock: { B: 10, G: 10, count: 19 } }));
    assert.equal(C.Text.clock(Object.assign({ sealed: true }, soon)), 'The clock is stopped while the hall is sealed: after the bell, turn 19; the night watch begins once it has counted 1 more turn.');
    // js/main.js gives the chip and the dial the hall's seal and the chime's module.
    const src = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
    assert.match(src, /Object\.assign\(\{ sealed: Clock\.sealed\(state\), chime: Modules\.on\(state, 'hourly_demonstration'\) \}, vm\.clock\)/);
    assert.match(src, /dial: Text\.clock\(clock\), stage: stageChip\(clock\)/);
  });

  test('every hall sentence is clean, whatever the stage, why, and who', () => {
    const names = uid => uid === 'x.1' ? 'the Great Board' : null, out = [];
    for (const stage of ['sealed', 'unsealed', 'waiting', 'other']) for (const why of ['hunt', 'quiet', 'ticket', 'defeat', 'treasure', 'sheet', 'alone', 'touched']) for (const by of [undefined, 'x.1', 'you', 'x.9']) for (const inn of [undefined, 'x.1', 'x.9']) {
      const cause = Object.assign({ k: 'hall', why }, by ? { by } : {}, inn ? { in: inn } : {});
      out.push(C.Text.event({ k: 'stage', turn: 3, stage, cause }, names));
    }
    out.push(C.Text.event({ k: 'healed', turn: 3, who: 'x.1', amount: 15, hp: 40, cause: { k: 'hall', why: 'ticket' } }, names));
    out.push(C.Text.event({ k: 'lost', turn: 3, who: 'x.1', from: 'searching', to: 'returning', cause: { k: 'hall', why: 'ticket' } }, names));
    out.push(C.Text.refusal('sealed'));
    for (const t of out) assert.ok(clean(t) && /^[A-Z].*\.$/.test(t), t);
    assert.equal(C.Text.refusal('sealed'), 'A shutter is closed over that opening: the hall is sealed.');
  });

  // ---- The shutters as drawn ----

  test('the shutters are drawn in the same two colours in every board view, the two at 3:1 or more to each other, and against every department\'s walls, wall tops and floors one of them at 3:1 or more', () => {
    // WCAG's relative luminance and contrast ratio.
    const lum = hex => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const vm = require('node:vm'), ctx = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'js/view/art.gen.js'), 'utf8') + ';this.ART = ART;', ctx);
    const depts = ctx.ART.palettes.dept;
    // Every board view (each file that registers one), as the 3D guard finds them.
    const views = fs.readdirSync(path.join(root, 'js/view')).map(f => 'js/view/' + f).filter(f => /Views\.register\(/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    const colours = views.map(v => {
      const m = fs.readFileSync(path.join(root, v), 'utf8').match(/const SHUTTER = \{ steel: '(#[0-9a-f]{6})', rib: '(#[0-9a-f]{6})' \};/);
      assert.ok(m, `${v} gives the shutter's two colours in const SHUTTER`);
      return { steel: m[1], rib: m[2] };
    });
    assert.ok(colours.length >= 1);
    for (const c of colours) assert.deepEqual(c, colours[0], 'every board view draws the shutter in the same two colours');
    const { steel, rib } = colours[0], problems = [];
    if (ratio(steel, rib) < 3) problems.push(`steel ${steel} and rib ${rib} are ${ratio(steel, rib).toFixed(2)}:1`);
    for (const k of Object.keys(depts).sort()) for (const part of ['wall', 'wallTop', 'floor', 'floor2']) {
      const n = depts[k][part], best = Math.max(ratio(steel, n), ratio(rib, n));
      if (best < 3) problems.push(`${k}'s ${part} ${n}: steel ${ratio(steel, n).toFixed(2)}:1, rib ${ratio(rib, n).toFixed(2)}:1`);
    }
    assert.deepEqual(problems, []);
  });

  test('the floor plan draws a shutter as a striped tile, never as a wall, and its key says so while one is shut', () => {
    // js/ui/bag.js's tileLook, run on the core's Grid (the browser's global).
    const acorn = require(path.join(root, 'tools/vendor/acorn/acorn.js')), vm = require('node:vm');
    const src = fs.readFileSync(path.join(root, 'js/ui/bag.js'), 'utf8'), ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    const found = {};
    (function walk(n) { if (!n || typeof n.type !== 'string') return; if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'tileLook') found.fn = n; if (n.type === 'VariableDeclarator' && n.id && n.id.name === 'MAP') found.map = n; for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(ast);
    assert.ok(found.fn && found.map, 'bag.js has tileLook and its MAP');
    const look = vm.runInNewContext(`const MAP = ${src.slice(found.map.init.start, found.map.init.end)}; (${src.slice(found.fn.start, found.fn.end)})`, { Grid: C.Grid });
    const z = look('Z'), wall = look('#'), door = look('+');
    assert.ok(z && z.shape && z.fill !== wall.fill && z.shape !== door.shape, `a shutter is drawn ${json(z)}, a wall ${json(wall)}, a door ${json(door)}`);
    assert.match(src, /vm\.tiles\.some\(r => r\.includes\('Z'\)\) \? ' Shutters: a striped tile\.' : ''/);
  });

  // ---- The invariants catch what they say ----

  test('hall.inv.js catches a shutter off an opening, a shutter with no seal, a paused clock with no seal, someone on a shutter, the count moving while sealed, a seal for a piece outside the hall, a second "waiting", a wait blamed on a bystander, naming one out of sight or naming none in sight, a hall sealed with none of it inside, a lift "alone" too soon, and a quiet lift too soon', () => {
    const check = ids => Inv.checker(C, Inv.select(C, ids));
    const sealedHall = () => { const s = hall(C, 3); C.Step.step(s, wait); return s; };
    const text = (ids, pre, ev, post) => check(ids)(pre, wait, ev, post).map(v => v.text).join(' | ');
    // A shutter at a tile that is no opening.
    let pre = sealedHall(), post = C.State.clone(pre);
    C.Grid.set(post.dept, 5, 1, 'Z');
    assert.match(text(['hall.shutters'], pre, [], post), /none of the hall's openings/);
    // An opening shut with no seal.
    pre = hall(C, 3); post = C.State.clone(pre); C.Grid.set(post.dept, 8, 2, 'Z');
    assert.match(text(['hall.shutters'], pre, [], post), /not sealed, but a shutter stands/);
    // A shutter with no Centrepiece at all.
    pre = C.Setup.room(1, { acc: 'T0', map: MAP, you: [2, 2], exhibits: [] }); post = C.State.clone(pre); C.Grid.set(post.dept, 8, 2, 'Z');
    assert.match(text(['hall.shutters'], pre, [], post), /with no Centrepiece hall/);
    // A paused clock with no seal, and a seal with the wrong turn.
    pre = hall(C, 3); post = C.State.clone(pre); post.dept.clock.pausedSince = 0;
    assert.match(text(['hall.paused'], pre, [], post), /paused since 0 but the hall is not sealed/);
    pre = sealedHall(); post = C.State.clone(pre); post.dept.clock.pausedSince = 7;
    assert.match(text(['hall.paused'], pre, [], post), /paused since 7, but the hall sealed at turn 1/);
    // Someone on a shutter.
    pre = sealedHall(); post = C.State.clone(pre); post.actors[1].x = 8; post.actors[1].y = 1;
    assert.match(text(['hall.clear'], pre, [], post), /stands on a shutter at 8,2/);
    // The count moving, a clock stage, a regeneration while sealed.
    pre = sealedHall(); post = C.State.clone(pre); post.dept.clock.count++;
    assert.match(text(['hall.frozen'], pre, [], post), /count moved/);
    post = C.State.clone(pre);
    assert.match(text(['hall.frozen'], pre, [{ k: 'regenerated', turn: 2, who: 'you', hp: 5 }], post), /regenerated/);
    // A seal said outside, or for a piece not hunting.
    pre = hall(C, 3, { you: [10, 3] }); post = C.State.clone(pre); post.dept.cp.sealed = { turn: 0, by: 'T0.3.room.1', why: 'hunt', at: 0, last: 0 };
    assert.match(text(['hall.seal'], pre, [{ k: 'stage', turn: 0, tick: 0, stage: 'sealed', cause: { k: 'hall', by: 'T0.3.room.1', why: 'hunt' } }], post), /outside it/);
    pre = hall(C, 3, { piece: { mode: 'dormant' } }); post = C.State.clone(pre); post.dept.cp.sealed = { turn: 0, by: 'T0.3.room.1', why: 'hunt', at: 0, last: 0 };
    assert.match(text(['hall.seal'], pre, [{ k: 'stage', turn: 0, tick: 0, stage: 'sealed', cause: { k: 'hall', by: 'T0.3.room.1', why: 'hunt' } }], post), /which was dormant, not hunting you/);
    // A seal for a piece hunting you from outside the hall: you sealed in alone.
    pre = hall(C, 3, { piece: { size: 1, at: [10, 1] } }); post = C.State.clone(pre); post.dept.cp.sealed = { turn: 0, by: 'T0.3.room.1', why: 'hunt', at: 0, last: 0 };
    assert.match(text(['hall.seal'], pre, [{ k: 'stage', turn: 0, tick: 0, stage: 'sealed', cause: { k: 'hall', by: 'T0.3.room.1', why: 'hunt' } }], post), /hunts you from outside it: you are sealed in alone/);
    // "Waiting" said twice in one wait.
    pre = hall(C, 3, { you: [7, 2], more: [{ sp: 'dummy', at: [8, 2], mode: 'dormant', stats: BODY }] });
    C.Step.step(pre, wait);
    post = C.State.clone(pre);
    const waits = cause => [{ k: 'stage', turn: 2, tick: 200, stage: 'waiting', cause: Object.assign({ k: 'hall', why: 'hunt' }, cause) }];
    assert.match(text(['hall.waiting'], pre, waits({ by: 'T0.3.room.1', in: 'T0.3.room.2' }), post), /said again that it waits/);
    // A wait blamed on the bystander in the archway; one naming it out of your sight; one naming
    // no one while you see it there (each in a fresh wait).
    pre = hall(C, 3, { you: [7, 2], more: [{ sp: 'dummy', at: [8, 2], mode: 'dormant', stats: BODY }] }); post = C.State.clone(pre);
    assert.match(text(['hall.waiting'], pre, waits({ by: 'T0.3.room.2', in: 'T0.3.room.2' }), post), /names T0\.3\.room\.2 as what calls for the seal, but it is none of the Centrepiece/);
    assert.match(text(['hall.waiting'], pre, waits({ by: 'T0.3.room.1' }), post), /named no one in its openings, but you see T0\.3\.room\.2 in one/);
    assert.equal(text(['hall.waiting'], pre, waits({ by: 'T0.3.room.1', in: 'T0.3.room.2' }), post), '');
    const hid = MAP.slice(); hid[2] = '#...o...,...#'; hid[3] = '#...o...#...#';
    pre = hall(C, 3, { map: hid, you: [1, 3], more: [{ sp: 'dummy', at: [8, 2], mode: 'dormant', stats: BODY }] }); post = C.State.clone(pre);
    assert.match(text(['hall.waiting'], pre, waits({ by: 'T0.3.room.1', in: 'T0.3.room.2' }), post), /named T0\.3\.room\.2 in an opening, out of your sight/);
    // Sealed with none of it in the hall (its piece moved out), and no piece of it fell.
    pre = sealedHall(); post = C.State.clone(pre); Object.assign(post.actors[1], { x: 10, y: 1, size: 1 });
    assert.match(text(['hall.alone'], pre, [], post), /sealed with none of its Centrepiece in it/);
    // "Alone" while its piece still stands in the hall.
    pre = sealedHall(); post = C.State.clone(pre);
    assert.match(text(['hall.alone'], pre, [{ k: 'stage', turn: 2, tick: 200, stage: 'unsealed', cause: { k: 'hall', why: 'alone' } }], post), /opened as alone while T0\.3\.room\.1 still stood in the hall/);
    // A quiet lift too soon.
    pre = sealedHall(); post = C.State.clone(pre);
    assert.match(text(['hall.quiet'], pre, [{ k: 'stage', turn: 20, tick: 2000, stage: 'unsealed', cause: { k: 'hall', why: 'quiet' } }], post), /19 turns after the seal/);
  });
};
