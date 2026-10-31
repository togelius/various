// ACCESSION — the Intro's stamp (BUILD.md §5.2, §5.5; design/layout.md §11): writing a pack's
// Intro stamp into the Intro at layout version 3, LV4's checks of the stamped Intro, and the
// shape of plan.intro, which the generator gives and population reads. M4's skeleton fixed the
// shape, so the generator and population (D-POP, which tests on fixture plans) agree without
// waiting on each other.
//
// A stamp (a pack's `intro` part, Packs.part(acc, 'intro', …)) is plain data:
//   { map: [row…],         the Intro drawn west to east, one string a row, north first. Each
//                          row is 1 + INTRO_WIDTH characters: column 0 is the Intro's west
//                          wall, '#', or 'E' on the one row the entrance is in (the entrance
//                          row); columns 1–INTRO_WIDTH are its floor columns, so a column is the
//                          plan's x. A floor column holds a stamp tile (TILES) or a letter the
//                          legend names;
//     legend: {letter: {tile?, …}}, the letters the map uses beyond the stamp tiles, each one
//                          character other than '#' and 'E'. A legend letter is written as its
//                          entry's `tile` (a stamp tile), or as itself if it is a stamp tile,
//                          else as floor; every tile holding one is a mark of plan.intro (the
//                          rest of the entry, an exhibit, a case or an item, is population's);
//     stretch: [row…],     rows (by index, ascending, not the entrance row) repeated to fill the
//                          Intro's height: the rows the Intro has north of its entrance row are
//                          filled by the stamp's rows north of its entrance row, its stretch rows
//                          there repeated as evenly as they can be (zero times or more, the
//                          northern ones taking one more first), and the same to the south. A
//                          stamp that cannot fill a side exactly does not fit: the attempt fails
//                          LV4 and reseeds;
//     cut: 'letters',      zone Z of the invariant cut(Z): every tile holding one of these
//                          letters. Every walk from the entrance to an onward opening must cross
//                          Z, so a partition drawn wall to wall with Z its only gap, in every row
//                          (stretch rows included), runs wall to wall in the Intro too;
//     invariants: [{near: letter, k}…] } the template's further invariants (§11.2): near(A, k),
//                          every walk from the entrance to an onward opening passes within k
//                          tiles (Chebyshev: steps, ignoring what stands between) of a tile
//                          holding the letter. Only near is built; any other is refused, so a
//                          stamp never claims a check that is not made.
// Every field is required (an empty legend {}, stretch [], invariants []), and no other field
// is read, so a stamp with one is refused rather than half read.
//
// plan.intro is null where no stamp lies (no plan the generator makes at version 3), or:
//   { x0, y0, x1, y1,      the Intro's floor rectangle, inclusive, in plan tiles;
//     cut: [[x, y]…],      zone Z of LV4's cut(Z): every walk from the entrance to an onward
//                          opening crosses one of these tiles (the stamp's cut), inside the
//                          rectangle; at least one;
//     marks: [{ch, x, y}…], each tile whose stamp letter the pack's legend names (an
//                          exhibit, a case, an item or a tile), ch that letter, inside the
//                          rectangle;
//     openings: [[x, y]…] } the Intro's onward openings (the tiles of its doorways, archways and
//                          staff doors into other rooms, the entrance left out), each on the
//                          wall ring one tile outside the rectangle, at walk INTRO_DEPTH or more
//                          from the entrance (LV4 checks the walk; the shape cannot);
// every list in row-major order (y, then x), with no tile twice. Plain data.
'use strict';
const LStamp = (() => {
  const B = LBuild, T = B.T;
  const isInt = Number.isInteger;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const isTile = t => Array.isArray(t) && t.length === 2 && isInt(t[0]) && isInt(t[1]);
  const before = (p, q) => p[1] < q[1] || (p[1] === q[1] && p[0] < q[0]);

  // The tiles a stamp may draw: floor and the fixtures curation and the programmes place,
  // each the plan tile of the same letter (§4.1). Walls, exits, staff doors, the entrance, the
  // Centrepiece's footprint and the lectern (the hall's alone) are the generator's.
  const TILES = '.+vfpoH|b~w';
  const FIELDS = 'cut,invariants,legend,map,stretch';

  // The fixture stamp, the Intro of a department whose pack gives none (and of every plan made
  // without a pack): a partition wall to wall at column 7 whose door on the entrance row is the
  // cut, so the 6 columns west of it are the vestibule, and two free-standing plinths east of
  // it, which the sculpture court's pillar-loop count needs (D-SPIKE: without free-standing
  // blockers in the Intro, the court rejects about 11% of first attempts).
  const FIXTURE = Object.freeze({
    map: Object.freeze([
      '#......|.......',
      '#......|...p...',
      '#......|.......',
      'E......+.......',
      '#......|.......',
      '#......|...p...',
      '#......|.......',
    ]),
    legend: Object.freeze({}),
    stretch: Object.freeze([0, 6]),
    cut: '+',
    invariants: Object.freeze([]),
  });

  // LStamp.check(stamp) → null if stamp is a stamp (above), else the first thing wrong, as a
  // sentence.
  function check(st) {
    if (!st || typeof st !== 'object' || Array.isArray(st)) return 'a stamp is not a record';
    const keys = Object.keys(st).sort(cmp);
    if (keys.join() !== FIELDS) return `a stamp has the fields ${keys.join(', ')}, not map, legend, stretch, cut and invariants`;
    const { map, legend, stretch, cut, invariants } = st;
    if (!Array.isArray(map) || !map.length || !map.every(r => typeof r === 'string')) return "a stamp's map is not a list of rows";
    if (!legend || typeof legend !== 'object' || Array.isArray(legend)) return "a stamp's legend is not a record";
    const width = 1 + N.INTRO_WIDTH;
    let entrance = -1;
    const used = new Set();
    for (let y = 0; y < map.length; y++) {
      const row = map[y];
      if (row.length !== width) return `the stamp's row ${y} is ${row.length} characters, not ${width} (the west wall and ${N.INTRO_WIDTH} floor columns)`;
      if (row[0] === 'E') { if (entrance >= 0) return `the stamp's rows ${entrance} and ${y} both hold the entrance`; entrance = y; }
      else if (row[0] !== '#') return `the stamp's row ${y} begins ${JSON.stringify(row[0])}, not the west wall '#' or the entrance 'E'`;
      for (let x = 1; x < width; x++) {
        const c = row[x];
        if (!own(legend, c) && !TILES.includes(c)) return `the stamp's row ${y} column ${x} is ${JSON.stringify(c)}, neither a stamp tile (${TILES}) nor a letter its legend names`;
        used.add(c);
      }
    }
    if (entrance < 0) return "no row of the stamp's map holds the entrance 'E' in its west wall";
    for (const k of Object.keys(legend).sort(cmp)) {
      const e = legend[k];
      if (k.length !== 1 || k === '#' || k === 'E') return `the stamp's legend names ${JSON.stringify(k)}, not one letter other than '#' and 'E'`;
      if (!e || typeof e !== 'object' || Array.isArray(e)) return `the stamp's legend entry '${k}' is not a record`;
      if (e.tile !== undefined && !(typeof e.tile === 'string' && e.tile.length === 1 && TILES.includes(e.tile))) return `the stamp's legend entry '${k}' has the tile ${JSON.stringify(e.tile)}, not a stamp tile (${TILES})`;
      if (!used.has(k)) return `the stamp's legend names '${k}', which its map does not use`;
    }
    if (!Array.isArray(stretch)) return "a stamp's stretch is not a list of rows";
    for (let i = 0; i < stretch.length; i++) {
      const r = stretch[i];
      if (!isInt(r) || r < 0 || r >= map.length) return `the stamp's stretch row ${JSON.stringify(r)} is not a row of its map`;
      if (r === entrance) return `the stamp's stretch rows include its entrance row ${r}`;
      if (i > 0 && stretch[i - 1] >= r) return "the stamp's stretch rows are not in ascending order, each once";
    }
    if (typeof cut !== 'string' || !cut.length) return "a stamp's cut is not a string of its map's letters";
    for (let i = 0; i < cut.length; i++) {
      if (!used.has(cut[i])) return `the stamp's cut names '${cut[i]}', which its map does not use`;
      if (cut.indexOf(cut[i]) !== i) return `the stamp's cut names '${cut[i]}' twice`;
    }
    if (!Array.isArray(invariants)) return "a stamp's invariants are not a list";
    for (let i = 0; i < invariants.length; i++) {
      const v = invariants[i];
      if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort(cmp).join() !== 'k,near') return `the stamp's invariant ${i} is not {near: letter, k} (near is the only invariant built besides cut)`;
      if (typeof v.near !== 'string' || !used.has(v.near)) return `the stamp's invariant ${i} is near ${JSON.stringify(v.near)}, a letter its map does not use`;
      if (!isInt(v.k) || v.k < 0 || v.k > N.INTRO_WIDTH) return `the stamp's invariant ${i} has k ${JSON.stringify(v.k)}, not 0–${N.INTRO_WIDTH}`;
    }
    return null;
  }

  // The stamp a plan's Intro takes: opts.stamp when given; else the `intro` part of the pack
  // opts.acc names, if it has one; else FIXTURE.
  function of(opts) {
    if (opts && opts.stamp !== undefined) return opts.stamp;
    const pack = opts && typeof opts.acc === 'string' ? Packs.get(opts.acc) : null;
    return pack && pack.intro ? pack.intro : FIXTURE;
  }

  // The stamp's row for each of the Intro's rows, north to south, given the rows the Intro has
  // north and south of its entrance row; or, if it does not fit, why, as a sentence.
  function rowsFor(st, north, south) {
    const e = st.map.findIndex(r => r[0] === 'E'), out = [];
    const side = (lo, hi, need, where) => {
      const rows = [], str = [];
      for (let r = lo; r < hi; r++) { rows.push(r); if (st.stretch.includes(r)) str.push(r); }
      const fixed = rows.length - str.length, extra = need - fixed;
      if (extra < 0) return `the Intro has ${need} rows ${where} of its entrance row, and the stamp draws ${fixed} there that do not stretch`;
      if (extra > 0 && !str.length) return `the Intro has ${need} rows ${where} of its entrance row, and the stamp draws ${fixed} there, none of which stretches`;
      for (const r of rows) {
        const k = str.indexOf(r), n = k < 0 ? 1 : Int.idiv(extra, str.length) + (k < extra % str.length ? 1 : 0);
        for (let i = 0; i < n; i++) out.push(r);
      }
      return null;
    };
    const n = side(0, e, north, 'north');
    if (n) return n;
    out.push(e);
    const s = side(e + 1, st.map.length, south, 'south');
    return s || out;
  }

  // Write the stamp into L's Intro (by the embedder, once the Intro and its entrance are placed
  // and before any opening is made; BUILD.md §5.5): every floor tile of the Intro becomes the
  // stamp's, the Intro is tagged stamped (curation passes
  // it by) and filled (so is M1's locality check), and L.meta.stamp keeps the tiles LV4 and
  // plan.intro need. A stamp that is not one throws, as a pack's error; one that does not fit
  // the Intro's height is kept as L.meta.stamp.misfit, for LV4 to fail. Returns whether it fit.
  function write(L, st) {
    const why = check(st);
    if (why) throw new Error('LStamp: ' + why);
    const G = L.G, r = L.rooms.find(q => q && q.role === 'intro'), [ex, ey] = L.meta.entrance;
    if (r.x1 - r.x0 + 1 !== N.INTRO_WIDTH || ex !== r.x0 - 1 || ey < r.y0 || ey > r.y1) throw new Error(`LStamp: the Intro (${r.x0},${r.y0})–(${r.x1},${r.y1}) is not ${N.INTRO_WIDTH} columns wide with the entrance (${ex},${ey}) in its west wall`);
    const rows = rowsFor(st, ey - r.y0, r.y1 - ey);
    if (typeof rows === 'string') { L.meta.stamp = { room: r.id, misfit: rows }; return false; }
    const s = { room: r.id, misfit: null, cut: [], marks: [], near: st.invariants.map(v => ({ ch: v.near, k: v.k, tiles: [] })) };
    for (let k = 0; k < rows.length; k++) {
      const y = r.y0 + k, line = st.map[rows[k]];
      for (let c = 1; c < line.length; c++) {
        const x = r.x0 - 1 + c, ch = line[c], e = own(st.legend, ch) ? st.legend[ch] : null;
        G.set(x, y, (e ? (e.tile || (TILES.includes(ch) ? ch : '.')) : ch).charCodeAt(0));
        if (e) s.marks.push({ ch, x, y });
        if (st.cut.includes(ch)) s.cut.push([x, y]);
        for (const n of s.near) if (n.ch === ch) n.tiles.push([x, y]);
      }
    }
    r.tags.stamped = true; r.tags.filled = true;
    L.meta.stamp = s;
    return true;
  }

  // The Intro's onward openings in L: the tiles of the wall ring round it that can be walked
  // (staff doors included), the entrance left out, in row-major order.
  function openings(L, r) {
    const G = L.G, out = [];
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) continue;
      const c = G.get(x, y);
      if (B.WALK[c] && c !== T.ENT) out.push([x, y]);
    }
    return out;
  }

  // plan.intro for L (above), or null if no stamp was written.
  function intro(L) {
    const s = L.meta.stamp;
    if (!s || s.misfit) return null;
    const r = L.rooms[s.room];
    return { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, cut: s.cut.map(t => t.slice()), marks: s.marks.map(m => ({ ch: m.ch, x: m.x, y: m.y })), openings: openings(L, r) };
  }

  // The onward openings a walk from the entrance reaches with the tiles of `walled` made walls
  // (staff doors walkable, as for a visitor of their grade), nearest first (then row-major),
  // each with its walk; none if the entrance itself is walled (every walk starts there).
  function reached(L, ops, walled) {
    const G = L.G, [ex, ey] = L.meta.entrance, e = ey * G.W + ex, mask = new Uint8Array(G.W * G.H);
    for (const [x, y] of walled) if (G.in(x, y)) mask[y * G.W + x] = 1;
    if (mask[e]) return [];
    const D = B.bfs(G, [e], B.ALL, 0, mask);
    return ops.map(([x, y]) => ({ x, y, d: D[y * G.W + x] })).filter(o => o.d >= 0).sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  }

  // LV4's checks of the stamped Intro (design/layout.md §11.2), after the room-graph test:
  // the stamp fits; every onward opening is at walk INTRO_DEPTH or more from the entrance;
  // cut(Z); and each near(A, k). null, or {why, tiles}: a sentence, and the tiles at fault
  // (the openings too near, or reached; the nearest first).
  function lv4(L) {
    const s = L.meta.stamp;
    if (!s) return { why: 'the Intro has no stamp', tiles: [L.meta.entrance] };
    if (s.misfit) return { why: `the Intro's stamp does not fit: ${s.misfit}`, tiles: [L.meta.entrance] };
    const ops = openings(L, L.rooms[s.room]);
    const near = reached(L, ops, []).filter(o => o.d < N.INTRO_DEPTH);
    if (near.length) return { why: `the Intro's onward opening at (${near[0].x}, ${near[0].y}) is ${near[0].d} walking tiles from the entrance (at least ${N.INTRO_DEPTH})`, tiles: near.map(o => [o.x, o.y]) };
    const leak = reached(L, ops, s.cut);
    if (leak.length) return { why: `the Intro's cut leaks: its onward opening at (${leak[0].x}, ${leak[0].y}) is reached from the entrance in ${leak[0].d} steps without crossing it`, tiles: leak.map(o => [o.x, o.y]) };
    for (const n of s.near) {
      const ball = [];
      for (const [x, y] of n.tiles) for (let dy = -n.k; dy <= n.k; dy++) for (let dx = -n.k; dx <= n.k; dx++) ball.push([x + dx, y + dy]);
      const miss = reached(L, ops, ball);
      if (miss.length) return { why: `a walk from the entrance reaches the Intro's onward opening at (${miss[0].x}, ${miss[0].y}) without passing within ${n.k} tiles of '${n.ch}'`, tiles: miss.map(o => [o.x, o.y]) };
    }
    return null;
  }

  // LStamp.shape(intro) → null if intro has plan.intro's shape (null included), else the
  // first thing wrong, as a sentence.
  function shape(intro) {
    if (intro === null) return null;
    if (!intro || typeof intro !== 'object' || Array.isArray(intro)) return 'plan.intro is not an object or null';
    const keys = Object.keys(intro).sort(cmp);
    if (keys.join() !== 'cut,marks,openings,x0,x1,y0,y1') return `plan.intro has the fields ${keys.join(', ')}, not x0, y0, x1, y1, cut, marks and openings`;
    const { x0, y0, x1, y1 } = intro;
    if (![x0, y0, x1, y1].every(isInt) || x0 > x1 || y0 > y1) return `plan.intro's rectangle ${JSON.stringify([x0, y0, x1, y1])} is not x0 ≤ x1, y0 ≤ y1 in whole tiles`;
    const inside = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const ring = ([x, y]) => !inside([x, y]) && x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1;
    const list = (name, ts, where, what) => {
      if (!Array.isArray(ts)) return `plan.intro.${name} is not a list`;
      for (let i = 0; i < ts.length; i++) {
        if (!isTile(ts[i])) return `plan.intro.${name}[${i}] is not a tile [x, y]`;
        if (!where(ts[i])) return `plan.intro.${name}[${i}] ${JSON.stringify(ts[i])} is not ${what}`;
        if (i > 0 && !before(ts[i - 1], ts[i])) return `plan.intro.${name} is not in row-major order, with no tile twice, at ${i}`;
      }
      return null;
    };
    const cut = list('cut', intro.cut, inside, 'inside the Intro');
    if (cut) return cut;
    if (!intro.cut.length) return 'plan.intro.cut is empty';
    if (!Array.isArray(intro.marks)) return 'plan.intro.marks is not a list';
    for (let i = 0; i < intro.marks.length; i++) {
      const m = intro.marks[i];
      if (!m || typeof m !== 'object' || Object.keys(m).sort(cmp).join() !== 'ch,x,y') return `plan.intro.marks[${i}] is not {ch, x, y}`;
      if (typeof m.ch !== 'string' || m.ch.length !== 1) return `plan.intro.marks[${i}].ch is not one letter`;
    }
    const marks = list('marks', intro.marks.map(m => [m.x, m.y]), inside, 'inside the Intro');
    if (marks) return marks;
    return list('openings', intro.openings, ring, 'on the wall ring round the Intro');
  }

  return { TILES, FIXTURE, check, of, rowsFor, write, openings, intro, lv4, shape };
})();
