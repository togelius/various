// ACCESSION — S.9's Centrepiece, the Composite (completing_guardian; BUILD.md §5.3, §5.5, §8.1,
// §8.3, §8.7; M4 plan A8, D3.5, D3.14, decided without play; revisit once M4 is playable): its
// record (content/S9-cp.js), its core (rules/arch/completing_guardian.js) and its line. Its core
// stays at ready false, so no department places it: these tests place the real record with
// Centrepiece.place in rooms with a hall (the harness's rooms), and in S.9's own departments with
// the core planted ready, every invariant checked after every step (centrepiece.inv.js among
// them) and one of their own (it never leaves its hall), the main runs clone-checked. What each
// test expects is worked out here from BUILD's sentences, not from the code:
//   - it guards the Lamp's case: opening or bashing that case wakes it at once, hunting, before
//     the noise; a case it does not guard, or Solvent's dissolving its own, does not;
//   - it grows a limb for every GUARDIAN_PER_STAGE galleries you have walked (the rooms holding a
//     gallery you have stood in, the one you start in and its hall among them), told as you
//     stand in the gallery that brings it: its neck, its legs, its tail;
//   - each limb's mark equals what it deals: the neck the tiles round it on your side, the legs a
//     lane as wide as it toward you (up to CHARGE_RANGE, never through a case) down which it
//     then charges, stopping short of anyone in it, the tail all the tiles round it; each marked
//     only while you stand on one of its tiles in its hall;
//   - it never leaves its hall, and while you stand outside it it starts no fight with you but
//     goes back to its place;
//   - its death awards nothing: no Signature piece, no Certificate, no grade; a seal lifts;
//   - its line says all of this, and its strip, in every phase, fits the phone.
// Seeds: 1 (harness rooms), 1–3 (S.9's departments); depths 1–7 unless a test says otherwise.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS;
  const B = require(path.join(root, 'tools/battery.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const LINES = require(path.join(root, 'test/m4-lines.test.js'));
  const C = loadCore(), { N } = C;
  const WAIT = { a: 'wait' };
  const LIMBS = ['cp_sweep', 'cp_charge', 'cp_ring'];

  // The hall (x 1–11, y 1–7) with the Lamp's case in its south-west corner (1,7), its one way in
  // an archway (12,2) from a gallery east of it (x 13–15, y 1–7), and four one-tile rooms below
  // (1,9), (3,9), (5,9), (7,9), never walked to, which a test may name as walked. The Composite's
  // footprint: 5–6 × 3–4.
  const MAP = ['#################', '#...........#...#', '#...........,...#', '#...........#...#', '#...........#...#', '#...........#...#',
    '#...........#...#', '#v..........#...#', '#################', '#.#.#.#.#########', '#################'];
  const ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 11, y1: 7 }, { key: 's1', role: 'section', x0: 13, y0: 1, x1: 15, y1: 7 },
    { key: 'intro', role: 'intro', x0: 1, y0: 9, x1: 1, y1: 9 }, { key: 's2', role: 'section', x0: 3, y0: 9, x1: 3, y1: 9 },
    { key: 's3', role: 'section', x0: 5, y0: 9, x1: 5, y1: 9 }, { key: 'coda', role: 'coda', x0: 7, y0: 9, x1: 7, y1: 9 }];
  // The galleries S.9's list puts in each (indices into its list: the hall's is 'centre'; s2
  // holds two, as a section the study room joins does).
  const GALLERIES = [[4], [1], [0], [1, 3], [2], [5]];
  const AT = [5, 3], CASE = [1, 7];

  // A room with the hall, the Composite placed on its footprint (Centrepiece.place, S.9's record).
  // o: you ([4, 3], beside it on the west); walked (room ids, a department visit's list; by
  // default the gallery east of the hall); more exhibits; map; core (X); options; scale (its
  // health and maximum, so a fight is short); fixtures (the Lamp's case by default).
  function room(depth, o) {
    o = o || {};
    const X = o.core || C;
    const s = H.room(X, o.seed || 1, { acc: 'S9', depth, map: o.map || MAP, you: o.you || [4, 3], exhibits: o.more || [], rooms: o.rooms || ROOMS,
      clock: { B: 300, G: 60 }, entrance: [15, 4], fixtures: o.fixtures || [X.Cases.make({ x: CASE[0], y: CASE[1], glass: 3, lock: 1 })], items: [] }, o.options || {});
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    (o.galleries || GALLERIES).forEach((g, i) => { if (s.dept.rooms[i]) s.dept.rooms[i].galleries = g.slice(); });
    s.dept.walked = (o.walked || [2]).slice();
    X.Centrepiece.place(s, { cpl: o.at || AT }, X.Packs.get('S9'));
    const a = X.Centrepiece.pieces(s)[0];
    if (o.scale) { a.maxHp = o.scale; a.hp = o.scale; }
    return s;
  }
  const ALL = [1, 2, 3, 4, 5, 6];
  const composite = (X, s) => X.Centrepiece.pieces(s)[0];
  const bad = (r, tag) => r.violations.map(v => `${tag}: ${v.id}: ${v.text}`);
  const say = (X, s, e) => X.Text.event(e, X.Labels.nameOf(s));
  // Its own invariant, beside every file's: every tile of it stands in its hall, after every step.
  const IN_HALL = { id: 'composite.hall', check(pre, events, post) {
    const cp = post.dept && post.dept.cp, a = cp ? post.actors.find(b => b.uid === cp.uids[0]) : null;
    if (!a || a.gone) return null;
    const out = C.Actors.footprint(a).filter(([x, y]) => !C.Hall.inside(post, x, y));
    return out.length ? `the Composite stands on ${json(out)}, outside its hall` : null;
  } };
  const INV = X => Inv.select(X, 'all').concat([IN_HALL]);
  // Every event it caused is a kind its line allows it (the soak's completeness, B.causer).
  function covered(X, s, events) {
    const rec = X.Packs.get('S9').centrepiece, allow = new Set(X.Clauses.UNIVERSAL), uid = s.dept.cp.uids[0], out = [];
    for (const p of X.Clauses.of(rec, { depth: s.dept.depth })) for (const k of p.covers) allow.add(k);
    for (const e of events) if (B.causer(e) === uid && !allow.has(e.k)) out.push(`it caused ${e.k}, which its line does not cover`);
    return out;
  }
  // S.9's department at a depth with the core planted ready in core X (a fresh one), so it places
  // the Composite; options as Dept.create's.
  function readyCore(numbers) {
    const X = numbers ? loadCore(null, { numbers }) : loadCore();
    X.Registry.ARCHETYPES.completing_guardian.ready = 'unit';
    return X;
  }

  // ---- Its record and its placement ----

  test('its record (content/S9-cp.js): one 2×2 body of the role centrepiece, a treasure whose Signature piece is the Lamp in its Security case, woken by touch_case; phase 1 says how its limbs grow, phase 3 that its specials come more often; its core at ready false, added with the shared rules, so no department of the game places it', () => {
    const pack = C.Packs.get('S9'), rec = pack.centrepiece;
    C.Centrepiece.check(rec, pack);
    assert.equal(json([rec.id, rec.archetype, rec.role, rec.form, rec.size, rec.signature, rec.trigger, rec.treasure, rec.sprite, rec.phases, rec.specials, rec.pieces]),
      json(['S9.12', 'completing_guardian', 'centrepiece', 'treasure', 2, 'S9.11', 'touch_case', { case: { glass: 3 } }, 'composite',
        [{ parts: ['CLAUSES.guardian_limbs'] }, {}, { parts: ['CLAUSES.guardian_quick'] }], undefined, undefined]));
    assert.equal(C.Registry.ARCHETYPES.completing_guardian.ready, false);
    assert.equal(C.Populate.ready(rec), false);
    assert.ok(C.Centrepiece.wired('completing_guardian'), 'its core is added with the shared rules');
    assert.equal(C.LTreasure.of(pack).id, 'S9.11');
    assert.equal(json([1, 2, 3, 7].map(d => C.LTreasure.glass(pack, d))), json([2, 2, 3, 3]), 'Laminated at depths 1–2, Security beyond');
    // Its line names three limbs, so the cap holds all three.
    assert.equal(json(C.Guardian.LIMBS), json(LIMBS));
    assert.ok(N.GUARDIAN_STAGE_MAX >= LIMBS.length && N.GUARDIAN_PER_STAGE >= 1);
    for (const depth of [1, 4, 7]) for (const seed of [1, 2]) assert.equal(C.Hall.cp(C.Dept.create(seed, 'S9', depth)), null, `S9 seed ${seed} depth ${depth} placed its Centrepiece`);
  });

  test('placed in S.9\'s own departments (its core planted ready), seeds 1–3 at depths 1, 4 and 7: on the plan\'s footprint in the hall, asleep, guarding the hall\'s case (the Lamp\'s, 3 or more tiles away), with no limb yet for the one gallery you have walked; it draws nothing and changes nothing else', () => {
    const problems = [], X = readyCore(), Y = loadCore();
    for (const depth of [1, 4, 7]) for (const seed of [1, 2, 3]) {
      const s = X.Dept.create(seed, 'S9', depth), a = composite(X, s), f = X.LTreasure.caseOf(s), tag = `seed ${seed} d${depth}`;
      const cpl = X.Layout.generate('sculpture_court', 0, seed, { acc: 'S9', depth }).plan.cpl;
      if (!a) { problems.push(`${tag}: not placed`); continue; }
      const lamp = s.items.find(i => i.ref === 'S9.11');
      if (json([a.x, a.y, a.size, a.mode, a.trigger, a.role, a.arch]) !== json([cpl[0], cpl[1], 2, 'dormant', 'touch_case', 'centrepiece', 'completing_guardian'])) problems.push(`${tag}: ${json([a.x, a.y, a.mode, a.trigger])}`);
      if (json(a.guards) !== json([f.x, f.y]) || lamp.where.at !== 'case' || lamp.where.x !== f.x || lamp.where.y !== f.y) problems.push(`${tag}: guards ${json(a.guards)}, the case ${f.x},${f.y}, the Lamp ${json(lamp.where)}`);
      if (X.Actors.dist(a, f.x, f.y) < 3) problems.push(`${tag}: the case is ${X.Actors.dist(a, f.x, f.y)} tiles from it`);
      if (json([a.ax.specials, a.ax.stage, a.ax.grown, a.ax.phase]) !== json([[], 0, 0, 1]) || X.Guardian.galleries(s) !== 1) problems.push(`${tag}: ${json(a.ax)}, ${X.Guardian.galleries(s)} galleries`);
      for (const [x, y] of X.Actors.footprint(a)) if (!X.Hall.inside(s, x, y)) problems.push(`${tag}: ${x},${y} outside its hall`);
      // The same department with the core at ready false: the rest of it is the same.
      const plain = Y.Dept.create(seed, 'S9', depth);
      const strip = st => ({ actors: st.actors.filter(b => !(st.dept.cp && st.dept.cp.uids.includes(b.uid))), items: st.items, tiles: st.dept.tiles, rng: st.rng,
        fixtures: st.dept.fixtures.filter(q => q.k !== 'lectern') });
      if (json(strip(s)) !== json(strip(plain))) problems.push(`${tag}: placing it changed the rest of the department`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its limbs, by the galleries you have walked ----

  // A row of rooms you walk through from west to east along row 4, each joined to the next by an
  // archway: an Intro (x 1–3), a section holding two galleries (5–7), a staff room with none
  // (9–11), a section (13–15), the coda (17–19), a section (21–23), then its hall (25–33), the
  // Composite on 30–31 × 5–6 and the Lamp's case at (33,1).
  const ROW = (() => {
    const rows = ['#'.repeat(35)];
    for (let y = 1; y <= 7; y++) {
      let r = '';
      for (let x = 0; x < 35; x++) r += x === 0 || x === 34 ? '#' : [4, 8, 12, 16, 20, 24].includes(x) ? (y === 4 ? ',' : '#') : x === 33 && y === 1 ? 'v' : '.';
      rows.push(r);
    }
    rows.push('#'.repeat(35));
    return rows;
  })();
  const ROW_ROOMS = [['intro', 'intro', 1], ['s1', 'section', 5], ['staff', 'staff', 9], ['s2', 'section', 13], ['coda', 'coda', 17], ['s3', 'section', 21]]
    .map(([key, role, x0]) => ({ key, role, x0, y0: 1, x1: x0 + 2, y1: 7 })).concat([{ key: 'centre', role: 'centre', x0: 25, y0: 1, x1: 33, y1: 7 }]);
  const ROW_GALLERIES = [[0], [1, 3], [], [2], [5], [1], [4]];
  function walkRow(X, depth, clone) {
    const s = room(depth, { core: X, map: ROW, rooms: ROW_ROOMS, galleries: ROW_GALLERIES, walked: [1], you: [2, 4], at: [30, 5],
      fixtures: [X.Cases.make({ x: 33, y: 1, glass: 3, lock: 1 })] });
    const r = H.play(X, s, (st, i) => st.actors[0].x < 26 ? { a: 'move', dir: 2 } : null, { inv: INV(X), clone, cap: 40 });
    return { s, r };
  }

  test('its limbs come from the galleries you have walked, joined up: one for every GUARDIAN_PER_STAGE of them (the one you start in, a room holding two galleries once, a staff room never, its hall too), told in the step you first stand in the gallery that brings it: its neck at 2, its legs at 4, its tail at 6; then no more; at depths 1–7, clone-checked', () => {
    const problems = [], want = [[2, 1, 'cp_sweep', 5], [4, 2, 'cp_charge', 17], [6, 3, 'cp_ring', 25]];
    for (const depth of DEPTHS) {
      const { s, r } = walkRow(C, depth, true), a = composite(C, s), tag = `d${depth}`;
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const grew = [];
      r.steps.forEach((st, i) => { for (const e of st.events) if (e.k === 'phase') grew.push([e.cause.n, e.stage, e.gained, 3 + i, e.cause.k, e.phase, e.who]); });
      if (json(grew) !== json(want.map(w => w.concat(['walked', 1, a.uid])))) problems.push(`${tag}: ${json(grew)}`);
      if (json([a.ax.specials, a.ax.stage, a.ax.grown, a.mode]) !== json([LIMBS, 3, 3, 'dormant'])) problems.push(`${tag}: ${json(a.ax)} ${a.mode}`);
      if (C.Guardian.galleries(s) !== 6 || json(s.dept.walked) !== json([1, 2, 3, 4, 5, 6, 7])) problems.push(`${tag}: ${C.Guardian.galleries(s)} galleries, walked ${json(s.dept.walked)}`);
      // Two steps more, standing in its hall: nothing more grows.
      const more = H.play(C, s, [WAIT, WAIT], { inv: INV(C) });
      if (more.events.some(e => e.k === 'phase')) problems.push(`${tag}: a limb grew with no gallery walked`);
    }
    // The sentence, at one depth: what it grew, for how many galleries, and how many limbs it has.
    const { s, r } = walkRow(C, 4), ev = r.events.filter(e => e.k === 'phase');
    assert.equal(json(ev.map(e => say(C, s, e))), json([
      'The Composite, Assembled From the Round Books grew its neck, for the 2 galleries you have walked: it has 1 limb.',
      'The Composite, Assembled From the Round Books grew its legs, for the 4 galleries you have walked: it has 2 limbs.',
      'The Composite, Assembled From the Round Books grew its tail, for the 6 galleries you have walked: it has 3 limbs.']));
    // And the log tells it out of sight: it says nothing of where it stands.
    assert.ok(C.Text.log(r.steps[2].events, C.Labels.nameOf(s), () => false).some(l => /grew its neck/.test(l)));
    assert.deepEqual(problems, []);
  });

  test('its limbs read their numbers (planted): GUARDIAN_PER_STAGE 3 grows its neck at 3 galleries and its legs at 6, and its line says every 3; GUARDIAN_STAGE_MAX 1 stops at its neck; placed after you have walked 6 galleries, it has all three, untold', () => {
    const X = loadCore(null, { numbers: { GUARDIAN_PER_STAGE: 3 } }), { s, r } = walkRow(X, 3);
    assert.deepEqual(bad(r, 'per 3'), []);
    assert.equal(json(r.events.filter(e => e.k === 'phase').map(e => [e.cause.n, e.gained])), json([[3, 'cp_sweep'], [6, 'cp_charge']]));
    assert.match(X.Clauses.strip(X.Packs.get('S9').centrepiece, { depth: 3, phase: 1 }), /for every 3 galleries you have walked/);
    assert.equal(composite(X, s).ax.stage, 2);
    const Y = loadCore(null, { numbers: { GUARDIAN_STAGE_MAX: 1 } }), m = walkRow(Y, 3);
    assert.equal(json(m.r.events.filter(e => e.k === 'phase').map(e => [e.cause.n, e.gained])), json([[2, 'cp_sweep']]));
    assert.equal(json([composite(Y, m.s).ax.specials, composite(Y, m.s).ax.grown]), json([['cp_sweep'], 1]));
    // Walked already: its limbs at placement, with no event (the department's making tells nothing).
    const t = room(3, { walked: ALL }), a = composite(C, t);
    assert.equal(json([a.ax.specials, a.ax.stage, a.ax.grown]), json([LIMBS, 3, 3]));
    assert.equal(C.Guardian.galleries(t), 6);
    // Outside a department visit (no walked list), no gallery is walked.
    delete t.dept.walked;
    assert.equal(C.Guardian.galleries(t), 0);
  });

  // ---- Its limbs' marks, and what they deal ----

  test('each limb\'s mark equals what it deals, joined up: beside it on its west, its neck, legs and tail are marked in turn, each on its own tiles and only with you on one, and each strikes you for what its mark showed, a Centrepiece\'s gross through your Padding; at depths 1–7, clone-checked', () => {
    const problems = [];
    for (const depth of DEPTHS) {
      const s = room(depth, { walked: ALL }), a = composite(C, s), tag = `d${depth}`;
      const r = H.play(C, s, (st, i) => i > 70 ? null : WAIT, { inv: INV(C), clone: true, cap: 80 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      const told = r.events.filter(e => e.k === 'telegraphed' && e.who === a.uid);
      const order = told.map(e => e.sp);
      if (json(order.slice(0, 4)) !== json(['cp_sweep', 'cp_charge', 'cp_ring', 'cp_sweep'])) problems.push(`${tag}: its limbs came ${json(order)}`);
      // Each mark's tiles, as BUILD has them, from its tile and yours (4,3).
      const tiles = { cp_sweep: [[4, 2], [4, 3], [4, 4], [4, 5]], cp_charge: [[1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4], [4, 4]].sort((p, q) => p[1] - q[1] || p[0] - q[0]),
        cp_ring: [[4, 2], [5, 2], [6, 2], [7, 2], [4, 3], [7, 3], [4, 4], [7, 4], [4, 5], [5, 5], [6, 5], [7, 5]] };
      for (const e of told.slice(0, 3)) if (json(e.tiles) !== json(tiles[e.sp])) problems.push(`${tag}: ${e.sp} marked ${json(e.tiles)}`);
      const gross = C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', depth), dmg = Math.max(N.DMG_MIN_ON_HIT, gross - s.actors[0].pad);
      const struck = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === a.uid);
      for (const sp of LIMBS) if (!struck.some(e => e.cause.sp === sp)) problems.push(`${tag}: its ${sp} never struck you`);
      for (const e of struck) if (e.amount !== dmg || e.cause.gross !== gross) problems.push(`${tag}: ${e.cause.sp} dealt ${e.amount} (gross ${e.cause.gross}), not ${dmg}`);
      // You stood beside it on the lane's first row, so its charge ran nowhere.
      if (r.events.some(e => e.k === 'moved' && e.who === a.uid)) problems.push(`${tag}: it moved`);
      // The words: each mark names its limb.
      const words = told.slice(0, 3).map(e => say(C, s, e));
      if (!/marks the tiles round it on your side for its neck: \d+ before your Padding/.test(words[0]) || !/marks a lane toward you for its legs/.test(words[1]) || !/marks the tiles round it for its tail/.test(words[2])) problems.push(`${tag}: ${json(words)}`);
    }
    assert.deepEqual(problems, []);
  });

  // A room with it hunting you, its limbs those given (planted: ax.specials), its next action the
  // one its turns give a special (acts), you at `you`.
  function hunting(depth, o) {
    const s = room(depth, Object.assign({ walked: ALL }, o)), a = composite(C, s);
    C.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
    a.ax.specials = o.limbs.slice();
    a.acts = N.CP_SPECIAL_EVERY[0] - 1;
    return { s, a };
  }
  // Wait until its special has gone off (a few turns at most).
  const untilUsed = a => (st, i, x) => i > 8 || x.events.some(e => e.k === 'special' && e.who === a.uid) ? null : WAIT;

  test('its legs: the lane runs from its side toward you, as wide as it, up to CHARGE_RANGE rows of its hall it could step onto, stopping short of a case, a wall or its hall\'s edge; marked only with you on it, it strikes you for what it showed, then charges down the lane and stops short of you, joined up at depths 1–7, clone-checked', () => {
    const s = room(3), a = composite(C, s), L = d => C.Guardian.lane(s, a, d);
    const cols = (xs, ys) => xs.flatMap(x => ys.map(y => [x, y])).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    assert.equal(json(L(0)), json(cols([5, 6], [1, 2])), 'north: two rows to its wall');
    assert.equal(json(L(2)), json(cols([7, 8, 9, 10, 11], [3, 4])), 'east: CHARGE_RANGE rows');
    assert.equal(json(L(4)), json(cols([5, 6], [5, 6, 7])), 'south: three rows to its wall');
    assert.equal(json(L(6)), json(cols([1, 2, 3, 4], [3, 4])), 'west: four rows to its wall');
    // A case in the lane ends it before the case; the hall's archway ends it at the hall's edge.
    const t = room(3, { fixtures: [C.Cases.make({ x: 9, y: 4, glass: 1, lock: 1 })], map: MAP.map((row, y) => y === 4 ? row.slice(0, 9) + 'v' + row.slice(10) : row) });
    assert.equal(json(C.Guardian.lane(t, composite(C, t), 2)), json(cols([7, 8], [3, 4])));
    const u = room(3, { at: [10, 2] });
    assert.equal(json(C.Guardian.lane(u, composite(C, u), 2)), '[]', 'never past its hall\'s edge into the archway');
    // Not on its tiles, no limb is marked: you on none of its lanes (diagonal to it, beside it or
    // two tiles off), or beside it in the archway, outside its hall; beside it in its hall, each is.
    for (const you of [[11, 5], [12, 2]]) {
      const v = room(3, { you, at: [8, 1] });
      assert.equal(json(C.Specials.tiles(v, composite(C, v), 'charge')), '[]', json(you));
    }
    for (const [you, at, want] of [[[3, 1], AT, false], [[12, 2], [10, 1], false], [[9, 2], [10, 1], true]]) {
      const v = room(3, { you, at }), b = composite(C, v);
      for (const shape of ['sweep', 'charge', 'tail']) assert.equal(C.Specials.tiles(v, b, shape).length > 0, want, `${shape} with you at ${you}`);
    }
    // Joined up: you on its east lane, 3 tiles from it; it marks the lane, strikes you, and runs
    // down the lane to stand beside you.
    const problems = [];
    for (const depth of DEPTHS) {
      const { s: h, a: b } = hunting(depth, { you: [9, 3], limbs: ['cp_charge'] }), tag = `d${depth}`;
      const r = H.play(C, h, untilUsed(b), { inv: INV(C), clone: true });
      problems.push(...bad(r, tag));
      const mark = r.events.find(e => e.k === 'telegraphed' && e.who === b.uid), hit = r.events.find(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === b.uid);
      const moves = r.events.filter(e => e.k === 'moved' && e.who === b.uid).map(e => e.to);
      if (!mark || json(mark.tiles) !== json(cols([7, 8, 9, 10, 11], [3, 4]))) problems.push(`${tag}: its mark ${json(mark)}`);
      if (!hit || hit.cause.sp !== 'cp_charge' || hit.amount !== Math.max(N.DMG_MIN_ON_HIT, C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', depth) - h.actors[0].pad)) problems.push(`${tag}: ${json(hit)}`);
      if (json(moves) !== json([[6, 3], [7, 3]]) || json([b.x, b.y]) !== json([7, 3])) problems.push(`${tag}: it ran ${json(moves)} to ${b.x},${b.y}`);
      // Its charge is no blow: its one hit on you is the lane's.
      if (r.events.some(e => e.k === 'attacked' && e.by === b.uid) || r.events.filter(e => e.k === 'damaged' && e.who === 'you').length !== 1) problems.push(`${tag}: its charge struck you again`);
      // The moves come after the blow, before it is told as used.
      const k = r.events.indexOf(hit), used = r.events.findIndex(e => e.k === 'special' && e.who === b.uid);
      if (!(k < r.events.findIndex(e => e.k === 'moved' && e.who === b.uid) && r.events.findIndex(e => e.k === 'moved' && e.who === b.uid) < used)) problems.push(`${tag}: the order of the blow, the run and the special`);
    }
    // Someone else in the lane: struck too, and it stops short of them.
    const { s: w, a: c } = hunting(4, { you: [11, 4], limbs: ['cp_charge'], more: [{ sp: 'S9.6', at: [9, 3], mode: 'dormant', stats: C.Roles.stats('skirmisher', 4) }] });
    const r = H.play(C, w, untilUsed(c), { inv: INV(C) });
    assert.deepEqual(bad(r, 'other'), []);
    assert.ok(r.events.some(e => e.k === 'damaged' && e.who === w.actors[1].uid && e.cause.sp === 'cp_charge'), 'the hopper in the lane was struck');
    assert.equal(json([c.x, c.y]), json([7, 3]), 'it stopped short of the hopper');
    assert.deepEqual(problems, []);
  });

  test('its legs never go through a case: in S.9\'s own departments (seeds 1–3, depths 1–7), no lane from where it stands, nor from any tile of its hall it could stand on, holds a case\'s tile or a tile outside its hall', () => {
    const X = readyCore(), problems = [];
    for (const seed of [1, 2, 3]) for (const depth of DEPTHS) {
      const s = X.Dept.create(seed, 'S9', depth), a = composite(X, s), m = s.dept, home = [a.x, a.y];
      const cases = m.fixtures.filter(f => f.k === 'case').map(f => `${f.x},${f.y}`);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!X.Archetypes.mayStep(s, a, x, y) || ![[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => X.Grid.walkable(m, x + dx, y + dy, 'exhibit'))) continue;
        a.x = x; a.y = y;
        for (const d of [0, 2, 4, 6]) for (const [tx, ty] of X.Guardian.lane(s, a, d)) {
          if (cases.includes(`${tx},${ty}`)) problems.push(`seed ${seed} d${depth}: from ${x},${y} its lane holds the case at ${tx},${ty}`);
          if (!X.Hall.inside(s, tx, ty)) problems.push(`seed ${seed} d${depth}: from ${x},${y} its lane leaves its hall at ${tx},${ty}`);
        }
      }
      a.x = home[0]; a.y = home[1];
    }
    assert.deepEqual(problems.slice(0, 5), []);
  });

  // ---- Its hall ----

  test('it never leaves its hall, and while you stand outside the hall it starts no fight with you: struck awake, it chases you to the archway; while it sees you there it walks back to its place, still hunting, with no blow and no mark; out of its sight it goes back (its own sentence, never "searches where it last knew you were") and settles; at depths 1–7, clone-checked', () => {
    const problems = [];
    // Out of the hall by the archway (12,2), then to (13,7), which no tile of the hall sees.
    const path = [[7, 3], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7]];
    const dir = (from, to) => [0, 1, 2, 3, 4, 5, 6, 7].find(d => from[0] + C.Grid.DX[d] === to[0] && from[1] + C.Grid.DY[d] === to[1]);
    for (const depth of DEPTHS) {
      const s = room(depth, { walked: ALL, you: [7, 3] }), a = composite(C, s), tag = `d${depth}`;
      let k = 0, saw = 0;
      const r = H.play(C, s, (st, i) => {
        if (i === 0) return { a: 'attack', uid: a.uid };
        if (i > 60) return null;
        const you = st.actors[0];
        if (k + 1 < path.length && you.x === path[k][0] && you.y === path[k][1]) { k++; return { a: 'move', dir: dir(path[k - 1], path[k]) }; }
        return WAIT;
      }, { inv: INV(C), clone: true, cap: 70 });
      problems.push(...bad(r, tag), ...covered(C, s, r.events).map(l => `${tag}: ${l}`));
      for (const e of r.events) if ((e.k === 'lost' || e.k === 'alerted') && e.who === a.uid && e.cause && ['out_of_sight', 'searched'].includes(e.cause.k)) problems.push(`${tag}: ${say(C, s, e)}`);
      // Each step after which you stand outside its hall: no blow and no mark of its.
      const replay = room(depth, { walked: ALL, you: [7, 3] });
      for (const st of r.steps) {
        C.Step.step(replay, st.action);
        const you = replay.actors[0], b = composite(C, replay);
        if (C.Hall.inside(replay, you.x, you.y)) continue;
        if (st.events.some(e => (e.k === 'attacked' && e.by === a.uid) || (e.k === 'telegraphed' && e.who === a.uid))) problems.push(`${tag}: it fought you outside its hall`);
        if (b.mode === 'hunting' && C.AI.sees(replay, b)) saw++;
      }
      const lost = r.events.filter(e => e.k === 'lost' && e.who === a.uid);
      if (json(lost.map(e => e.cause.k)) !== json(['outside'])) problems.push(`${tag}: lost ${json(lost.map(e => e.cause))}`);
      else if (say(C, s, lost[0]) !== 'The Composite, Assembled From the Round Books goes back to its place: you are outside its hall, which it never leaves.') problems.push(`${tag}: ${say(C, s, lost[0])}`);
      if (!r.events.some(e => e.k === 'returned' && e.who === a.uid && e.phase === 'reinstalled') || a.mode !== 'dormant' || json([a.x, a.y]) !== json(AT)) problems.push(`${tag}: it ends ${a.mode} at ${a.x},${a.y}`);
      if (!r.events.some(e => e.k === 'hunting' && e.who === a.uid)) problems.push(`${tag}: never hunted`);
      if (!saw) problems.push(`${tag}: it never saw you from outside its hall, so holding back was not tried`);
    }
    assert.deepEqual(problems, []);
  });

  test('it never steps out of its hall: mayStep refuses any step that puts a tile of it outside (the archway, a wall), so neither a rule nor the Window Pole moves it out; inside, it allows the step', () => {
    const s = room(3, { at: [10, 1] }), a = composite(C, s);
    assert.equal(C.Archetypes.mayStep(s, a, 11, 1), false, 'onto the archway column');
    assert.equal(C.Archetypes.mayStep(s, a, 9, 1), true);
    assert.equal(C.Archetypes.mayStep(s, a, 10, 2), true);
    assert.equal(C.Archetypes.mayStep(s, a, 10, 0), false);
    // An exhibit of another archetype is not held to its hall by this rule.
    const t = room(3, { more: [{ sp: 'S9.6', at: [14, 4], mode: 'dormant', stats: C.Roles.stats('skirmisher', 3) }] });
    assert.equal(C.Archetypes.mayStep(t, t.actors[1], 12, 2), true);
  });

  // ---- Its case ----

  test('its case is the Lamp\'s: in S.9\'s departments (its core planted ready, seeds 1–3 at depths 1, 4 and 7), opening or bashing that case wakes it at once, hunting (touch_case), before the case changes and before the noise; another case touched, or its own dissolved by Solvent, leaves it asleep', () => {
    const problems = [];
    // A free tile of the hall beside a case, from which it can be opened or bashed.
    const beside = (X, s, f) => { for (const d of [0, 2, 4, 6, 1, 3, 5, 7]) { const x = f.x + X.Grid.DX[d], y = f.y + X.Grid.DY[d]; if (X.Grid.walkable(s.dept, x, y) && !X.Actors.at(s, x, y) && X.Cases.at(s, f.x, f.y)) return [x, y]; } return null; };
    const X = readyCore();
    for (const depth of [1, 4, 7]) for (const seed of [1, 2, 3]) for (const how of ['open', 'bash']) {
      const s = X.Dept.create(seed, 'S9', depth, { carry: { grade: N.GRADE_MAX }, invulnerable: true }), a = composite(X, s), f = X.LTreasure.caseOf(s), tag = `seed ${seed} d${depth} ${how}`;
      const at = beside(X, s, f);
      s.actors[0].x = at[0]; s.actors[0].y = at[1];
      const r = H.play(X, s, [{ a: how, x: f.x, y: f.y }], { inv: INV(X) });
      problems.push(...bad(r, tag));
      const ev = r.events, woke = ev.findIndex(e => e.k === 'hunting' && e.who === a.uid && e.cause.k === 'touch_case'), pip = ev.findIndex(e => e.k === 'pip' && e.who === a.uid && e.cause.k === 'touch_case');
      const change = ev.findIndex(e => ['case_opened', 'glass_cracked', 'glass_broke'].includes(e.k)), noise = ev.findIndex(e => e.k === 'noise' && e.x === f.x && e.y === f.y);
      if (!(pip >= 0 && pip < woke && woke < change && change < noise)) problems.push(`${tag}: pip ${pip}, hunting ${woke}, the case ${change}, its noise ${noise}`);
      if (woke >= 0 && !/woke and began hunting you: its case was (opened|bashed)/.test(X.Text.event(ev[woke], X.Labels.nameOf(s)))) problems.push(`${tag}: ${X.Text.event(ev[woke], X.Labels.nameOf(s))}`);
    }
    // Another case, in another room, bashed: it sleeps on.
    for (const seed of [1, 2, 3]) {
      const s = X.Dept.create(seed, 'S9', 4, { carry: { grade: N.GRADE_MAX }, invulnerable: true }), a = composite(X, s), mine = X.LTreasure.caseOf(s);
      const f = s.dept.fixtures.find(q => q.k === 'case' && q !== mine && q.st === 'shut' && !q.mimic && beside(X, s, q));
      if (!f) continue;
      const at = beside(X, s, f);
      s.actors[0].x = at[0]; s.actors[0].y = at[1];
      const ev = X.Step.step(s, { a: 'bash', x: f.x, y: f.y });
      // (Standing in another gallery may grow it a limb: that is no touch.)
      if (ev.some(e => e.who === a.uid && e.k !== 'phase') || a.mode !== 'dormant') problems.push(`seed ${seed}: another case touched it: ${json(ev.filter(e => e.who === a.uid))}`);
      // Its own case dissolved (Solvent: no touch, §8.3): it sleeps on.
      const ev2 = [];
      X.Cases.dissolve(s, mine, { k: 'item', by: 'you' }, ev2);
      if (mine.st !== 'dissolved' || ev2.some(e => e.who === a.uid) || a.mode !== 'dormant') problems.push(`seed ${seed}: dissolving its case: ${json(ev2)}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its fall ----

  test('its death awards nothing, joined up in S.9\'s departments (its core planted ready, seed 1 at depths 1–7, clone-checked at depth 4): struck down beside it, no Signature piece drops, no Certificate comes, your grade and perks stay as they were, the Lamp stays in its case; and with a seal planted for its treasure, its fall lifts the seal (why treasure) and nothing else', () => {
    const problems = [], cores = [readyCore(), readyCore()];
    for (const depth of DEPTHS) for (const sealed of [false, true]) {
      const X = cores[sealed ? 1 : 0];
      if (sealed && depth === 1) X.Hall.defineSeal('treasure', (s, c) => { const b = X.Actors.byUid(s, c.uids[0]); return b && !b.gone && b.mode === 'hunting' ? { why: 'touched' } : null; });
      const s = X.Dept.create(1, 'S9', depth, { invulnerable: true }), a = composite(X, s), tag = `d${depth}${sealed ? ' sealed' : ''}`;
      a.maxHp = 30; a.hp = 30;
      // Beside it, inside its hall.
      let spot = null;
      for (const [x, y] of X.Specials.tiles(s, a, 'ring')) if (!spot && X.Hall.inside(s, x, y) && X.Grid.walkable(s.dept, x, y) && !X.Actors.at(s, x, y)) spot = [x, y];
      s.actors[0].x = spot[0]; s.actors[0].y = spot[1];
      const grade = s.run.grade, perks = json(s.run.perks), lamp = json(s.items.find(i => i.ref === 'S9.11'));
      const r = H.play(X, s, st => composite(X, st).gone ? null : { a: 'attack', uid: a.uid }, { inv: INV(X), clone: depth === 4, cap: 300 });
      problems.push(...bad(r, tag), ...covered(X, s, r.events).map(l => `${tag}: ${l}`));
      if (!a.gone) { problems.push(`${tag}: it still stands (${a.hp})`); continue; }
      const k = r.steps.findIndex(st => st.events.some(e => e.k === 'died' && e.who === a.uid)), after = r.steps[k].events.slice(r.steps[k].events.findIndex(e => e.k === 'died' && e.who === a.uid) + 1);
      const gave = after.filter(e => ['dropped', 'certificate', 'grade', 'perk'].includes(e.k) || (e.k === 'stage' && e.stage === 'unsealed'));
      if (json(gave.map(e => e.k === 'stage' ? `${e.stage}:${e.cause.why}` : e.k)) !== json(sealed ? ['unsealed:treasure'] : [])) problems.push(`${tag}: its fall gave ${json(gave)}`);
      if (sealed && !r.events.some(e => e.k === 'stage' && e.stage === 'sealed')) problems.push(`${tag}: the planted seal never closed`);
      if (s.dept.cert || s.run.grade !== grade || json(s.run.perks) !== perks || (s.run.certificates || []).length || json(s.items.find(i => i.ref === 'S9.11')) !== lamp) problems.push(`${tag}: after its fall ${json([s.dept.cert, s.run.grade, s.run.certificates])}`);
      if (r.events.some(e => ['certificate', 'grade', 'dropped'].includes(e.k))) problems.push(`${tag}: ${json(r.events.filter(e => ['certificate', 'grade', 'dropped'].includes(e.k)))}`);
    }
    assert.deepEqual(problems, []);
  });

  // ---- Its line ----

  // Its whole line at a depth, from BUILD's sentences: §5.5's Composite, §5.3's form rule
  // (cp_treasure), its phase parts and the wake and trigger clauses.
  const span = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  function wantLine(d) {
    const r = C.Roles.stats('centrepiece', d), g = C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', d);
    return ['Its case is the Lamp’s, which it guards; it never leaves its hall, and while you are outside the hall it starts no fight with you but goes back to its place.',
      `It strikes from beside you for ${span(r.dmin, r.dmax)}.`,
      `Its limbs’ specials come in turn, each marked only while you stand on one of its tiles, then striking everything on them for ${g} before Padding: its neck marks the tiles round it on your side; its legs, a lane as wide as it toward you, up to ${N.CHARGE_RANGE} tiles and never through a case, then it charges down the lane, stopping short of anyone in it; its tail, all the tiles round it.`,
      `Its second phase starts at ${N.CP_PHASE_PCT[0]}% of its full health or less, its third at ${N.CP_PHASE_PCT[1]}%, for good.`,
      'Killing it opens its hall but earns nothing: carry the treasure it guards out of the hall.',
      `It grows a limb, each a special, for every ${N.GUARDIAN_PER_STAGE} galleries you have walked, the one you start in and its own hall among them: first its neck, then its legs, then its tail.`,
      `From phase 3: it marks a limb’s special at most once every ${N.CP_SPECIAL_EVERY[1]} of its actions, not ${N.CP_SPECIAL_EVERY[0]}.`,
      'Wakes when you stay inside your ring or make noise near it; wakes at once, hunting you, when its case is opened or bashed.'].join(' ');
  }
  const TREASURE = 'Killing it earns nothing: carry the Lamp out.', REST = 'Its label has the rest.';
  const wantStrip = k => [`Phase ${k} of 3.`, TREASURE,
    ...(k === 1 ? [`It grows a limb, each a special, for every ${N.GUARDIAN_PER_STAGE} galleries you have walked, the one you start in and its own hall among them: first its neck, then its legs, then its tail.`]
      : k === 3 ? [`It marks a limb’s special at most once every ${N.CP_SPECIAL_EVERY[1]} of its actions, not ${N.CP_SPECIAL_EVERY[0]}.`] : []), REST].join(' ');

  test('its line (\'ARCHETYPES.completing_guardian\', \'CLAUSES.cp_treasure\', \'CLAUSES.guardian_limbs\', \'CLAUSES.guardian_quick\') says that it guards the Lamp\'s case and never leaves its hall, what each limb marks and deals, that killing it earns nothing, and how its limbs grow, in plain words; its strip, in every phase, says the treasure\'s rule and its phase\'s own part within the budget (m4-lines\' model), the limbs\' growth in phase 1, at depths 1–7; its words hold no digit; its label\'s odds name each limb', () => {
    const rec = C.Packs.get('S9').centrepiece, problems = [];
    for (const d of DEPTHS) {
      if (C.Clauses.line(rec, { depth: d }) !== wantLine(d)) problems.push(`d${d}: ${C.Clauses.line(rec, { depth: d })}`);
      for (const k of [1, 2, 3]) {
        const t = C.Clauses.strip(rec, { depth: d, phase: k });
        if (t !== wantStrip(k)) problems.push(`d${d} phase ${k}: ${t}`);
        if (LINES.rows(t) > LINES.METRICS.budgetRows) problems.push(`d${d} phase ${k}: ${LINES.rows(t)} rows`);
      }
    }
    // The whole line is long (the label scrolls, FU1).
    assert.ok(LINES.rows(C.Clauses.line(rec, { depth: 7 })) > LINES.METRICS.budgetRows);
    const R = C.Registry;
    for (const [t, id] of [['ARCHETYPES', 'completing_guardian'], ['CLAUSES', 'guardian_limbs'], ['CLAUSES', 'guardian_quick'], ['SPECIALS', 'cp_sweep'], ['SPECIALS', 'cp_charge'], ['SPECIALS', 'cp_ring']]) {
      const cl = R[t][id].clause;
      if (/[0-9]/.test(cl.replace(/\{[^}]*\}/g, ''))) problems.push(`${t}.${id}: a digit outside a parameter`);
      if (t === 'ARCHETYPES' ? !/^[A-Z].*\.$/.test(cl) : /^[A-Z]|\.$/.test(cl)) problems.push(`${t}.${id}: "${cl}"`);
    }
    assert.equal(json(LIMBS.map(id => [R.SPECIALS[id].noun, R.SPECIALS[id].shape, R.SPECIALS[id].curve, R.SPECIALS[id].effect])),
      json([['neck', 'sweep', 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', 'damage'], ['legs', 'charge', 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', 'damage'], ['tail', 'tail', 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', 'damage']]));
    // Its label: the line whole, and its odds readout's line for each limb it has.
    const s = room(4, { walked: ALL }), a = composite(C, s), l = C.Labels.of(s, a.uid), g = C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', 4);
    assert.equal(l.behaviour, wantLine(4));
    for (const noun of ['neck', 'legs', 'tail']) assert.ok(l.odds.some(x => x.startsWith(`Its ${noun} would deal you ${Math.max(N.DMG_MIN_ON_HIT, g - s.actors[0].pad)} (${g} before your Padding)`)), `${noun}: ${json(l.odds)}`);
    assert.deepEqual(problems, []);
  });

  // ---- The shape's after, and its own invariant ----

  test('Specials.addShape takes an after (a function, or refused), which runs once a damage mark of its shape has struck and its noise is made, before the special is told, and not once its owner has fallen; the hall invariant catches it standing outside (planted)', () => {
    const X = loadCore(), S = X.Specials;
    assert.throws(() => S.addShape('planted_after', { tiles: () => [], after: 3 }), /not a function/);
    const order = [];
    S.addShape('planted_burst', { tiles: (st, b) => [[st.actors[0].x, st.actors[0].y]], after: (st, b, tel, ev) => order.push(ev.map(e => e.k).join(' ')) });
    X.Registry.define('SPECIALS', 'planted_burst', { built: 'M4', ready: 'unit', tests: [], inv: null, icon: 'special', shape: 'planted_burst', effect: 'damage', curve: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', range: null, every: null, clause: 'strikes', params: {}, covers: [] });
    const s = room(3, { core: X }), a = composite(X, s);
    X.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you' }, []);
    const ev = [];
    S.mark(s, a, 'planted_burst', [[4, 3]], ev);
    S.resolve(s, a, ev);
    assert.equal(order.length, 1);
    assert.match(order[0], /damaged.*noise$/);
    assert.ok(ev.findIndex(e => e.k === 'special' && e.who === a.uid) > ev.findIndex(e => e.k === 'noise'));
    // Fallen before it goes off (a blow at once): no after.
    S.mark(s, a, 'planted_burst', [[4, 3]], []);
    a.gone = 1;
    S.resolve(s, a, []);
    assert.equal(order.length, 1);
    // The hall invariant (this file's own).
    const t = room(3), pre = C.State.clone(t);
    composite(C, t).x = 10; composite(C, t).y = 1;
    assert.equal(IN_HALL.check(pre, [], t), null, 'inside');
    composite(C, t).x = 11;
    assert.match(IN_HALL.check(pre, [], t), /outside its hall/);
  });
};
