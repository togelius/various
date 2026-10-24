// ACCESSION — layout generation, top level (design/layout.md §§2, 9, 10): embed the
// programme, add loops, make a-spaces, repair, curate, validate; up to 4 reseeds, then a
// certified fallback. Every step is logged in words, and every failed check names the
// tiles at fault, so a failing plan explains itself.
'use strict';
const Layout = (() => {
  const B = LBuild, T = B.T;
  const PIN = 2;                 // the layout version: bump on any change that alters layouts
  const RESEEDS = 4;
  // Certified fallbacks: one seed per programme, re-certified by test/m1.test.js.
  const FALLBACK = { enfilade: 1, case_labyrinth: 1, sculpture_court: 1 };

  const xy = (G, i) => { const x = i % G.W; return [x, (i - x) / G.W]; };
  const fail = (why, tiles) => ({ why, tiles: tiles || [] });

  // Identity checks per programme (design/layout.md §13.2), as integer comparisons.
  const IDENTITY = {
    enfilade: (L, A) => A.roomsToC < 3 ? `only ${A.roomsToC} rooms from the Intro to the Centrepiece hall (at least 3)`
      : (100 * A.glass < 40 * A.blockers || 100 * A.glass > 85 * A.blockers) ? `glass is ${A.glass} of ${A.blockers} blockers (40–85%)` : null,
    case_labyrinth: (L, A) => 4 * A.glass < 3 * A.blockers ? `glass is ${A.glass} of ${A.blockers} blockers (at least 75%)`
      : 100 * A.narrow < 15 * A.floor ? `only ${A.narrow} of ${A.floor} floor tiles are narrow (at least 15%)`
      : L.meta.crossing < L.meta.tortMin ? `the maze is crossed too directly (${L.meta.crossing} against ${L.meta.tortMin} per thousand)` : null,
    sculpture_court: (L, A) => A.pillar < 8 ? `only ${A.pillar} pillar loops (at least 8)` : null,
  };

  // The validators layout alone can decide (design/layout.md §9.1). Each returns null, or
  // a sentence and the tiles at fault.
  const CHECKS = [
    ['LV1', (L, A) => {
      if (A.allReached && A.exitsReached) return null;
      const G = L.G, tiles = [];
      for (const rm of L.rooms) if (rm && rm.role !== 'staff' && !LCurate.roomTiles(L, rm).some(i => A.openMask[i])) tiles.push(...LCurate.roomTiles(L, rm).slice(0, 4).map(i => xy(G, i)));
      for (const [x, y] of L.meta.exits) if (A.D[y * G.W + x] < 0) tiles.push([x, y]);
      return fail('not every room and exit can be reached from the entrance', tiles);
    }],
    ['LV3', (L, A) => A.optionalC ? null : fail('no exit can be reached without passing through the Centrepiece hall', L.meta.exits)],
    ['LV4', (L, A) => A.introExits >= 2 && A.introOnCycle ? null
      : fail(`the Intro has ${A.introExits} onward openings and ${A.introOnCycle ? 'is' : 'is not'} on a loop`, [L.meta.entrance])],
    ['LV5', (L, A) => A.allReached ? null : fail('a public room can only be reached through the staff layer')],
    ['LV8', (L, A) => {
      if (A.arenaMinRing < 16) return fail(`a free-standing block in the Centrepiece hall makes a loop of only ${A.arenaMinRing} tiles`, A.arenaBlock || []);
      if (!L.meta.viewTile) return fail('no lectern could be placed at the viewing distance from the Centrepiece', [L.meta.cpl]);
      const G = L.G, [vx, vy] = L.meta.viewTile, d = LCurate.toFootprint(L)(vy * G.W + vx);
      if (d !== N.VIEW_DISTANCE || !LAnalyse.los(G, vx, vy, L.meta.cpl[0], L.meta.cpl[1])) return fail(`the viewing tile is ${d} walking tiles from the Centrepiece, not ${N.VIEW_DISTANCE}, or out of its sight`, [L.meta.viewTile]);
      return null;
    }],
    ['LV9', (L, A) => !L.meta.vistaRequired || A.vista ? null : fail('the Centrepiece cannot be seen from the Intro', [L.meta.entrance, L.meta.cpl])],
    ['LV10', (L, A, pre) => {
      const G = L.G;
      for (const g of pre.gates) if (B.BLOCK[G.t[g]]) return fail('a fixture blocks a gate cell', [xy(G, g)]);
      for (let i = 0; i < G.W * G.H; i++) {
        if (G.t[i] !== T.VIT || !G.room[i]) continue;
        const [x, y] = xy(G, i);
        let ok = false;
        for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1; dx++) if (A.openMask[(y + dy) * G.W + x + dx]) { ok = true; break; }
        if (!ok) return fail('a case cannot be reached', [[x, y]]);
      }
      return null;
    }],
    ['LV14', (L, A) => {
      const why = IDENTITY[L.meta.programme] && IDENTITY[L.meta.programme](L, A);
      if (why) return fail(why);
      if (L.meta.vistaRequired && !A.vista) return fail('no vista from the Intro');
      return null;
    }],
  ];

  // Opens a way into each unreachable room, then puts the Intro on a loop: first by opening
  // the Intro into a neighbour, then by linking the Intro's neighbour onward
  // (design/layout.md §10.1). Every repair is logged.
  function repair(L, A) {
    if (!A.allReached) {
      for (const r of L.rooms) {
        if (!r || r.role === 'staff' || LCurate.roomTiles(L, r).some(i => A.openMask[i])) continue;
        for (const q of L.rooms) if (q && q !== r && q.role !== 'staff' && LCurate.roomTiles(L, q).some(i => A.openMask[i]) && B.connect(L, r.id, q.id, { width: 1, why: 'repair' })) { L.log.push({ check: 'LV1', room: r.id, op: `opened a way into unreachable room ${r.id} (${r.role})` }); break; }
      }
      A = LAnalyse.analyse(L);
    }
    if (!A.introOnCycle || A.introExits < 2) {
      const intro = L.rooms.find(r => r && r.role === 'intro');
      const linked = new Set(L.edges.filter(e => e.a === intro.id || e.b === intro.id).map(e => e.a === intro.id ? e.b : e.a));
      for (const q of L.rooms) {
        if (!q || q === intro || q.role === 'staff' || q.role === 'coda' || q.tags.deadEnd || linked.has(q.id)) continue;
        if (B.connect(L, intro.id, q.id, { width: 3, why: 'repair:introCycle' })) { L.log.push({ check: 'LV4', room: q.id, op: `opened the Intro into room ${q.id}` }); break; }
      }
      A = LAnalyse.analyse(L);
      if (!A.introOnCycle) {
        let done = false;
        for (const id of linked) {
          const q = L.rooms[id];
          if (q.tags.deadEnd) continue;
          for (const r2 of L.rooms) {
            if (!r2 || r2 === q || r2 === intro || r2.role === 'staff' || r2.tags.deadEnd || r2.tags.noLoops) continue;
            if (L.edges.some(e => (e.a === q.id && e.b === r2.id) || (e.b === q.id && e.a === r2.id))) continue;
            if (B.connect(L, q.id, r2.id, { width: 3, why: 'repair:introCycle' })) { L.log.push({ check: 'LV4', room: q.id, op: `linked room ${q.id} onward to room ${r2.id} to put the Intro on a loop` }); done = true; break; }
          }
          if (done) break;
        }
        A = LAnalyse.analyse(L);
      }
    }
    return A;
  }

  // opts.plant(L) lets tests break a plan at a chosen stage ('afterAspace' or 'afterCurate').
  function attempt(programme, size, seed, base, opts) {
    opts = opts || {};
    const P = LProgrammes.PROGRAMMES[programme];
    const K = P.knobs(B.stream(seed, base + '/knobs'), size);
    const L = B.newLayout();
    L.meta.programme = programme;
    P.embed(L, K, B.stream(seed, base + '/embed'));
    B.addLoops(L, P.d, B.stream(seed, base + '/openings'), {
      allow: (a, b) => !a.tags.noLoops && !b.tags.noLoops && a.role !== 'staff' && b.role !== 'staff' && !((a.role === 'intro' && b.role === 'coda') || (a.role === 'coda' && b.role === 'intro')),
    });
    B.aSpacePass(L, K.studies || 0, B.stream(seed, base + '/aspace'));
    if (opts.plant && opts.plant.stage === 'afterAspace') opts.plant.fn(L);
    let A = repair(L, LAnalyse.analyse(L));
    roleKeys(L, A);
    LCurate.curate(L, seed, base, A.gates, opts.perturbRoom);
    const pre = { gates: A.gates };
    if (opts.plant && opts.plant.stage === 'afterCurate') opts.plant.fn(L, pre);
    A = LAnalyse.analyse(L);
    const failed = [];
    for (const [id, f] of CHECKS) { const r = f(L, A, pre); if (r) failed.push({ id, why: r.why, tiles: r.tiles }); }
    return { L, A, K, failed };
  }

  // Role keys name rooms without dots (BUILD.md §3.2): sections in tour order.
  function roleKeys(L, A) {
    let s = 0, st = 0;
    for (const id of A.order) { const r = L.rooms[id]; if (r.role === 'section') r.key = 's' + (++s); else if (r.role === 'study') r.key = 'study' + (++st); }
    for (const r of L.rooms) if (r && !r.key) r.key = r.role === 'section' ? 's' + (++s) : r.role === 'study' ? 'study' + (++st) : r.role;
  }

  // The certified fallback for a programme: always the same plan.
  function fallback(programme, size, opts) {
    return attempt(programme, size, FALLBACK[programme], `layout/fallback/${programme}@${PIN}/a0`, opts && { plant: opts.plantFallback });
  }

  // Generate one department's plan. opts: { acc, depth } name the streams.
  function generate(programme, size, seed, opts) {
    opts = opts || {};
    const key = `layout/${opts.acc || programme}@${PIN}/d${opts.depth || 1}`;
    const tries = [];
    for (let k = 0; k <= RESEEDS; k++) {
      const r = attempt(programme, size, seed, key + '/a' + k, opts);
      tries.push(r.failed);
      if (!r.failed.length) return finish(r, { attempt: k, fallback: false, tries, key, base: key + '/a' + k });
    }
    const r = fallback(programme, size, opts);
    if (r.failed.length) throw new Error(`Layout: the certified fallback for ${programme} failed: ${r.failed.map(f => f.id + ' ' + f.why).join('; ')}`);
    return finish(r, { attempt: RESEEDS + 1, fallback: true, tries, key, base: key + '/a' + (RESEEDS + 1) });
  }

  // The plan as plain data for the state (BUILD.md §4.1), plus the analysis for checks, and
  // `base`, the department's stream key for the attempt that made the plan (`…/d<depth>/a<k>`;
  // a certified fallback is attempt RESEEDS + 1), under which its placement streams are named
  // (§3.2). base is outside the plan, so the plan, and the layout pin, are as they were.
  function finish(r, info) {
    const { L, A } = r, G = L.G;
    const rooms = [];
    for (const rm of L.rooms) if (rm) rooms.push({ id: rm.id, key: rm.key, role: rm.role, x0: rm.x0, y0: rm.y0, x1: rm.x1, y1: rm.y1, tags: Object.keys(rm.tags).filter(k => rm.tags[k]).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) });
    const roomOf = [];
    for (let y = 0; y < G.H; y++) { const row = []; for (let x = 0; x < G.W; x++) row.push(G.room[y * G.W + x]); roomOf.push(row); }
    return {
      plan: { programme: L.meta.programme, pin: PIN, w: G.W, h: G.H, tiles: G.rows(), rooms, roomOf, entrance: L.meta.entrance.slice(),
        exits: L.meta.exits.map(e => e.slice()), cpl: L.meta.cpl.slice(), lectern: L.meta.lectern ? L.meta.lectern.slice() : null,
        viewTile: L.meta.viewTile ? L.meta.viewTile.slice() : null, ltour: A.tour, tourOrder: A.order.slice() },
      analysis: A, failed: r.failed, log: L.log, attempt: info.attempt, fallback: info.fallback, tries: info.tries, knobs: r.K, base: info.base,
    };
  }

  // Room numbers D·100 + n in tour order: galleries in L_tour order, then the Centrepiece
  // hall, then the coda (design/layout.md §8.1). Staff rooms are not numbered.
  function number(plan, depth) {
    const out = {};
    let n = 1;
    for (const id of plan.tourOrder) out[id] = depth * 100 + n++;
    for (const rm of plan.rooms) if (rm.role === 'coda') out[rm.id] = depth * 100 + n++;
    return out;
  }

  // A plan as text, with the given tiles marked '!' (for failure reports).
  function text(plan, tiles) {
    const rows = plan.tiles.slice();
    for (const [x, y] of tiles || []) if (y >= 0 && y < rows.length) rows[y] = rows[y].slice(0, x) + '!' + rows[y].slice(x + 1);
    return rows.join('\n');
  }

  return { PIN, FALLBACK, generate, fallback, attempt, number, text, CHECKS };
})();
