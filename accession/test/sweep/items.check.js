// The items as the item placement leaves them (M4 plan D-ITEMS, A10, D2; BUILD.md §5.2, §5.5,
// §8.5, §8.6), over the shared sweep (test/m4-sweep.test.js: seeds 1–100 of each department at
// each depth 1–7, as Dept.create makes them). For every department, worked out here from
// BUILD's sentences, never from the placement code:
//   - each item a gallery lists, once, in the room its gallery took: a `case: true` item in a
//     case of that room, or on its floor only when no case of the room could take it (shut,
//     not on loan, no mimic's, holding nothing, no exhibit in it); any other item on its floor;
//   - an item listed directly after a warden that guards a case in the case that warden
//     guards, its nest, whenever it guards one; otherwise in its room (S.9's Round Book 9: the
//     Brooder's paragraph says the Museum displays the two together, the item claims below);
//   - the treasure (a treasure Centrepiece's Signature piece its hall's gallery lists: S.9's
//     Lamp) in the hall's one real case, never on loan, its glass the pack's override no
//     stronger than the depth's mix allows (Security; Laminated at depths 1–2), its lock in
//     that glass's range at the depth, and that case at least LAMP_CASE_MIN_WALK walking tiles
//     from every opening of the hall (an oracle written here, apart from layout/treasure.js);
//   - the rest of §8.5's counts from what no gallery lists, in the sections and studies:
//     EQUIPMENT_PER_DEPT weapons and garments and CURIO_OR_INSTRUMENT_PER_DEPT curios and
//     instruments, less the list's own, never the Signature piece; KITS_PER_DEPT Restoration
//     kits, the Highlights, recorded with their rooms, in a section or study, walked to from
//     the entrance without a staff door, in a case only within the grade you came in with;
//   - one item a tile, none on an actor, each made from its pack record with its tier on offer;
//   - CONSUMABLES_PER_DEPT consumables on the floor of the sections and studies;
//   - the item claims the packs' records make (ITEM_CLAIMS here, which test/m4-items.test.js
//     holds to the paragraphs and tombstones);
// and over the whole sweep: how many of S.9's departments have the Brooder's nest, with Round
// Book 9 in it.
'use strict';
module.exports = C => {
  const { N, Grid, Populate, Packs, Cases } = C;
  const tally = { S9: 0, nests: 0, inNest: 0, treasures: 0, deepest: 0, nearest: 99 };
  const isGear = r => r.kind === 'weapon' || r.kind === 'garment', isExtra = r => r.kind === 'curio' || r.kind === 'instrument';

  // The hall's ways in: every walkable tile outside the hall beside one of its tiles (N, E, S
  // or W); and the case's walking distance from the nearest, as §5.5 measures a case's (1 + the
  // nearest tile beside it one can stand on, a diagonal past a corner included), over your walk
  // (doors and staff doors walked through).
  function caseWalk(m, hall, f) {
    const inHall = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.roomOf[y][x] === hall.id, ops = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!inHall(x, y) && Grid.walkable(m, x, y) && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => inHall(x + dx, y + dy))) ops.push([x, y]);
    }
    const d = Grid.distances(m, ops, m.w * m.h);
    let best = -1;
    for (let k = 0; k < 8; k++) {
      const x = f.x + Grid.DX[k], y = f.y + Grid.DY[k];
      if (!Grid.inside(m, x, y) || !Grid.walkable(m, x, y)) continue;
      const v = d[y * m.w + x];
      if (v >= 0 && (best < 0 || v + 1 < best)) best = v + 1;
    }
    return best;
  }

  // What keeps each claim the packs' records make about where an item lies (m4-items' claims):
  // null, or why it does not hold in department s.
  const ITEM_CLAIMS = {
    // S.9.4's paragraph: "the Museum has displayed the two together ever since" (Round Book 9
    // and the Brooder): the book lies in its nest whenever it has one, else in its room.
    'S9.4': s => {
      const m = s.dept, w = s.actors.find(a => a.sp === 'S9.4'), rb = s.items.find(i => i.ref === 'S9.10');
      if (!w) return null;
      if (!rb || (rb.where.at !== 'floor' && rb.where.at !== 'case')) return 'Round Book 9 is not in the department';
      const f = w.guards ? Cases.at(s, w.guards[0], w.guards[1]) : null;
      if (f && f.k === 'case') return rb.where.at === 'case' && rb.where.x === f.x && rb.where.y === f.y ? null : `Round Book 9 lies at ${rb.where.x},${rb.where.y}, not in the Brooder's nest at ${f.x},${f.y}`;
      return m.roomOf[rb.where.y][rb.where.x] === m.roomOf[w.y][w.x] ? null : 'Round Book 9 is not in the Brooder\'s room';
    },
    // S.9.10's tombstone: "pages 40–112 in the nest (see S.9.4)": the nest is the Brooder's
    // own, its Medium "nest of round-book pages", wherever it stands.
    'S9.10': s => (s.actors.some(a => a.sp === 'S9.4') ? null : 'no Brooder holds the nest the tombstone points to'),
  };

  function each(d) {
    const { state: s, acc } = d, m = s.dept, pack = Packs.get(acc), where = [], say = t => where.push(t);
    const roomAt = (x, y) => m.rooms.find(r => r.id === m.roomOf[y][x]) || null;
    const lying = i => i.where.at === 'floor' || i.where.at === 'case';
    const placed = s.items.filter(i => !i.uid.startsWith('you.') && i.kind !== 'consumable' && lying(i));
    const cp = pack.centrepiece, sig = cp ? cp.signature : undefined;
    const freeCase = f => f.k === 'case' && f.mimic === null && f.st === 'shut' && !f.loan && f.holds === null && !s.actors.some(a => a.uid !== 'you' && C.Actors.covers(a, f.x, f.y));
    const listed = [];
    // Every item a gallery lists, in the room its gallery took.
    pack.galleries.forEach((g, gi) => {
      const rm = m.rooms.find(r => Array.isArray(r.galleries) && r.galleries.includes(gi));
      g.contents.forEach((e, k) => {
        if (e.item === undefined) return;
        const rec = pack.items.find(r => r.id === e.item), its = placed.filter(i => i.ref === e.item);
        listed.push(rec);
        if (its.length !== 1) { say(`${e.item} is placed ${its.length} times`); return; }
        const it = its[0], at = roomAt(it.where.x, it.where.y);
        if (!rm || !at || at.id !== rm.id) { say(`${it.uid} (${e.item}) lies in ${at ? at.key : 'no room'}, not ${g.name}'s room ${rm ? rm.key : '(none)'}`); return; }
        const prev = k > 0 ? g.contents[k - 1] : null;
        if (rec.id === sig) {
          // The treasure, in the hall's case.
          tally.treasures++;
          const hall = m.rooms.find(r => r.role === 'centre'), real = m.fixtures.filter(f => f.k === 'case' && f.mimic === null && m.roomOf[f.y][f.x] === hall.id);
          if (cp.form !== 'treasure' || g.key !== 'centre') { say(`its Signature piece ${sig} is listed in ${g.name}, and only a treasure lies in its hall`); return; }
          if (real.length !== 1) { say(`the hall holds ${real.length} real cases`); return; }
          const f = real[0];
          if (it.where.at !== 'case' || it.where.x !== f.x || it.where.y !== f.y || f.holds !== it.uid) { say(`${sig} is not in the hall's case at ${f.x},${f.y}`); return; }
          const mix = N['GLASS_MIX_D' + Math.min(6, d.depth)], top = mix.reduce((t, w, i) => (w > 0 ? i + 1 : t), 1);
          const want = Math.min(cp.treasure.case.glass, top), lo = N.GLASS_LOCK_MIN[want - 1], hi = Math.max(lo, Math.min(N.GLASS_LOCK_MAX[want - 1], d.depth + 1));
          if (f.glass !== want || f.loan || f.lock < lo || f.lock > hi) say(`the treasure case is glass ${f.glass}, lock ${f.lock}${f.loan ? ', on loan' : ''}; it should be glass ${want}, lock ${lo}–${hi}, never on loan`);
          const w = caseWalk(m, hall, f);
          tally.deepest = Math.max(tally.deepest, w); if (w >= 0) tally.nearest = Math.min(tally.nearest, w);
          if (w < N.LAMP_CASE_MIN_WALK) say(`the treasure case at ${f.x},${f.y} is ${w} walking tiles from the hall's nearest opening, under ${N.LAMP_CASE_MIN_WALK}`);
          return;
        }
        if (prev && prev.guards === 'case') {
          const w = s.actors.find(a => a.sp === prev.sp && m.roomOf[a.y][a.x] === rm.id), f = w && w.guards ? Cases.at(s, w.guards[0], w.guards[1]) : null;
          if (f && f.k === 'case') { if (!(it.where.at === 'case' && it.where.x === f.x && it.where.y === f.y)) say(`${it.uid} (${e.item}) is not in ${w.uid}'s nest at ${f.x},${f.y}`); return; }
        }
        if (e.case === true) {
          if (it.where.at === 'case') return;
          const left = m.fixtures.filter(f => m.roomOf[f.y][f.x] === rm.id && freeCase(f));
          if (left.length) say(`${it.uid} (${e.item}) lies on the floor while ${rm.key} has an empty case at ${left[0].x},${left[0].y}`);
        } else if (it.where.at !== 'floor') say(`${it.uid} (${e.item}) is in a case, and its entry asks for none`);
      });
    });
    // The rest of §8.5's counts, from what no gallery lists, in the sections and studies; the
    // Highlights.
    const mine = listed.filter(r => r.id !== sig), pool = pack.items.filter(r => r.id !== sig && !listed.includes(r));
    const drawn = placed.filter(i => i.kind === 'kit' || !listed.some(r => r.id === i.ref));
    const want = (has, isIt) => (pool.some(isIt) ? Math.max(0, has - mine.filter(isIt).length) : 0);
    const recOf = i => pack.items.find(r => r.id === i.ref);
    const gear = drawn.filter(i => i.kind !== 'kit' && isGear(recOf(i))).length, extra = drawn.filter(i => i.kind !== 'kit' && isExtra(recOf(i))).length;
    if (gear !== want(N.EQUIPMENT_PER_DEPT, isGear) || extra !== want(N.CURIO_OR_INSTRUMENT_PER_DEPT, isExtra)) say(`${gear} weapons and garments and ${extra} curios and instruments drawn, for ${want(N.EQUIPMENT_PER_DEPT, isGear)} and ${want(N.CURIO_OR_INSTRUMENT_PER_DEPT, isExtra)}`);
    for (const i of drawn) {
      if (i.kind !== 'kit' && (i.ref === sig || !recOf(i))) say(`${i.uid} (${i.ref}) is no item the placement draws`);
      const rm = roomAt(i.where.x, i.where.y);
      if (!rm || (rm.role !== 'section' && rm.role !== 'study')) say(`${i.uid} (${i.ref || i.kind}) lies in ${rm ? rm.role : 'no room'}, not a section or study`);
    }
    const kits = drawn.filter(i => i.kind === 'kit');
    if (kits.length !== N.KITS_PER_DEPT) say(`${kits.length} Restoration kits`);
    if (JSON.stringify(m.highlights) !== JSON.stringify(kits.map(i => ({ uid: i.uid, room: roomAt(i.where.x, i.where.y).key })))) say('the Highlights are not the kits with their rooms');
    const walk = (() => {
      const tiles = m.tiles.map(r => r);
      for (const f of m.fixtures) if (f.k === 'case' && f.mimic) tiles[f.y] = tiles[f.y].slice(0, f.x) + '.' + tiles[f.y].slice(f.x + 1);
      return Grid.distances({ w: m.w, h: m.h, tiles, surfaces: [] }, [m.entrance], m.w * m.h, null, 'exhibit');
    })();
    for (const i of kits) {
      const f = i.where.at === 'case' ? Cases.at(s, i.where.x, i.where.y) : null;
      if (f && f.lock > m.entryGrade) say(`${i.uid} is in a case locked above the grade you came in with`);
      const near = f ? Grid.DX.some((dx, k) => { const x = f.x + dx, y = f.y + Grid.DY[k]; return Grid.inside(m, x, y) && walk[y * m.w + x] >= 0; }) : walk[i.where.y * m.w + i.where.x] >= 0;
      if (!near) say(`${i.uid} cannot be walked to from the entrance without a staff door`);
    }
    // Each item made from its record, with a tier on offer; one a tile, none on an actor.
    const T = N.TIER_LOW_BY_DEPTH, low = T[d.depth - 1], tiles = new Set();
    for (const i of s.items) if (!i.uid.startsWith('you.') && i.kind !== 'consumable' && !lying(i)) say(`${i.uid} lies nowhere`);
    for (const i of placed) {
      const rec = recOf(i);
      if (i.kind !== 'kit' && (!rec || i.kind !== rec.kind || JSON.stringify(i.prims) !== JSON.stringify(rec.prims))) say(`${i.uid} is not made from ${i.ref}`);
      if (['weapon', 'garment', 'instrument'].includes(i.kind) && i.tier !== low && i.tier !== Math.min(T[T.length - 1], low + 1)) say(`${i.uid} is tier ${i.tier}`);
      const key = i.where.x + ',' + i.where.y;
      if (tiles.has(key)) say(`two items lie on ${key}`);
      tiles.add(key);
      if (s.actors.some(a => a.uid !== 'you' && C.Actors.covers(a, i.where.x, i.where.y))) say(`${i.uid} lies under an exhibit`);
      if (i.where.at === 'case') { const f = Cases.at(s, i.where.x, i.where.y); if (!f || f.k !== 'case' || f.holds !== i.uid || f.loan || f.mimic !== null) say(`${i.uid}'s case does not hold it`); }
      else if (m.tiles[i.where.y][i.where.x] !== '.') say(`${i.uid} lies on ${m.tiles[i.where.y][i.where.x]}`);
    }
    // The consumables (§8.6), on the floor of the sections and studies.
    const cons = s.items.filter(i => i.kind === 'consumable');
    if (cons.length !== N.CONSUMABLES_PER_DEPT) say(`${cons.length} consumables`);
    for (const i of cons) { const rm = roomAt(i.where.x, i.where.y); if (i.where.at !== 'floor' || !rm || (rm.role !== 'section' && rm.role !== 'study') || tiles.has(i.where.x + ',' + i.where.y)) say(`${i.uid} lies at ${JSON.stringify(i.where)}`); }
    // The item claims.
    for (const id of Object.keys(ITEM_CLAIMS).sort()) if (pack.species.some(sp => sp.id === id) || pack.items.some(r => r.id === id)) { const no = ITEM_CLAIMS[id](s); if (no) say(`${id}: ${no}`); }
    if (acc === 'S9') {
      tally.S9++;
      const w = s.actors.find(a => a.sp === 'S9.4'), f = w && w.guards ? Cases.at(s, w.guards[0], w.guards[1]) : null;
      if (f && f.k === 'case') { tally.nests++; const rb = s.items.find(i => i.ref === 'S9.10'); if (rb && rb.where.x === f.x && rb.where.y === f.y) tally.inNest++; }
    }
    return where.length ? where.slice(0, 4).join('; ') : null;
  }

  function done() {
    if (tally.S9 && tally.treasures !== tally.S9) return `S.9's treasure was placed in ${tally.treasures} of ${tally.S9} departments`;
    if (tally.nests !== tally.inNest) return `Round Book 9 lies in the Brooder's nest in ${tally.inNest} of the ${tally.nests} S.9 departments with one`;
    return null;
  }
  return { each, done, tally, claims: Object.keys(ITEM_CLAIMS).sort() };
};
