// ACCESSION — LV6, the entrance's safe zone (design/layout.md §7.1, §9.1; BUILD.md §5.5; M4 plan A10):
// no exhibit stands within SAFE_ZONE walking tiles of the entrance, and nothing an exhibit does
// over the visit's first SAFE_ZONE_TURNS turns reaches you anywhere in that zone. It registers
// as a validator with Populate.addValidator('lv6', …) from here, the first of them (plan A10),
// so a department it rejects is a failed layout attempt, which reseeds.
//
// The safe zone: every tile you could stand on (Grid.walkable, as you walk) within SAFE_ZONE
// walking tiles of the entrance (Grid.distances, population's measure). LV6 asks, of every
// exhibit in the department (none left out: the Intro's, a Centrepiece's pieces, one in a
// case), what would reach a tile of the zone while you stand there:
//   - where it stands: any tile of it within SAFE_ZONE walking tiles of the entrance (one
//     beyond its nearest neighbour you could step onto, for a case or a plinth: Grid.reachDist);
//   - its wake region (Archetypes.wakeRegion over SAFE_ZONE_TURNS turns: a sleeper's ring at
//     RING_MOVING in sight, and what its archetype adds: a station its line, an awake Grazer
//     what it could see), every tile of which wakes it, strikes you or shows you to it;
//   - a patrol walking its round (a Wader): what it sees (AI.sees: within SIGHT_EXHIBIT, in
//     line of sight) from where it stands at each of its actions over those turns, as
//     Patrol.timeline tells it exactly (the timeline the worst-case runner reads too, kept
//     per state); its wake region only where the timeline cannot be told; and an exhibit
//     awake from the start, on no round, whose rules give it no wake region, is taken to find
//     you, as the worst-case runner takes it (none is, as M4's packs are made);
//   - what the wake region leaves out: a sleeper's `axis` trigger (a pip each turn you stand in
//     its row or column within AXIS_RANGE, in its sight: Wake.onAxis), and its `tether`
//     (waking at once within TETHER_RANGE of what it guards: Wake.inTether, which needs no
//     sight and so reaches through a wall);
//   - the noise of a door you open or close from the zone (Step.moveInto, Doors: an ordinary
//     door beside a tile of it you stand on, a soft noise at the door, Noise.reach): an
//     exhibit that hears it gains a pip (one a turn, so PIPS_TO_WAKE turns of it wake a
//     sleeper), or, awake, goes to look at the door, in the zone;
//   - your ring at its largest there: where this department holds a curio with `observing`
//     (S.9's Lamp, which a visitor may wear lit from the start, plan A2), or you carry one, a
//     sleeper's ring LAMP_RING wider (Kit.ringDelta); and where a tile of the zone is a loud
//     floor, RING_LOUD_FLOOR wider still (Vision.actionRing).
// Each is asked of the department as made, its doors shut, and with every ordinary door open
// (staff doors stay shut: they need a grade), since you open the Intro's partition door to go
// on, and any other you pass, and an exhibit opens the doors on its way. A door shut or open
// changes no walking distance, so a sleeper's ring, axis and tether with the doors open hold
// every tile they hold with them shut, and so does a station's line, which passes a closed
// door as an open one: these are asked with the doors shut only to say which it is. A
// patrol's sight and an awake exhibit's region are asked both ways.
// A surface only ever hides you, so none is counted (there are none as a department is made).
//
// The rejection names what would reach the zone, in words a player would take: the exhibit,
// how it would wake or find you, and the first tile of the zone it reaches (row-major); its
// tiles to mark on the plan's text are where the exhibit stands, then every tile of the zone
// it reaches. LV6 draws on no stream and changes nothing in the state.
'use strict';
const LV6 = (() => {
  // The zone: walking distances from the entrance out to SAFE_ZONE (d), the tiles of it you
  // could stand on (safe, a mask by tile index; list, their indices in row-major order) and
  // the box they fill (x0, y0, x1, y1); or null in a map with no entrance.
  function zone(m) {
    if (!m || !Array.isArray(m.entrance) || !Array.isArray(m.tiles)) return null;
    const d = Grid.distances(m, [m.entrance], N.SAFE_ZONE), safe = new Uint8Array(m.w * m.h), list = [];
    let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    for (let k = 0; k < d.length; k++) {
      if (d[k] < 0) continue;
      const x = k % m.w, y = Int.idiv(k, m.w);
      if (!Grid.walkable(m, x, y)) continue;
      safe[k] = 1; list.push(k);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return list.length ? { d, safe, list, x0, y0, x1, y1 } : null;
  }
  // Is (x, y) within r tiles (Chebyshev) of the zone's box?
  const near = (z, x, y, r) => x >= z.x0 - r && x <= z.x1 + r && y >= z.y0 - r && y <= z.y1 + r;
  const nearAny = (z, a, r) => Actors.footprint(a).some(([x, y]) => near(z, x, y, r));

  // The department with every ordinary door open (open true) or as it is, a copy sharing all
  // else, and with no surface: the two views LV6 asks in.
  function view(state, open) {
    const m = state.dept, tiles = open ? m.tiles.map(row => row.replace(/\+/g, "'")) : m.tiles;
    return Object.assign({}, state, { dept: Object.assign({}, m, { tiles, surfaces: [] }) });
  }
  // Could you stand on tile k in view m (walkable, not a closed door)?
  const stand = (m, k) => { const x = k % m.w, y = Int.idiv(k, m.w); return Grid.walkable(m, x, y) && !Grid.closedDoor(m, x, y); };
  const tile = (m, k) => [k % m.w, Int.idiv(k, m.w)];

  // Your ring at its largest in the zone (above): RING_MOVING, LAMP_RING more where a lit
  // Lamp can be worn, RING_LOUD_FLOOR more where a tile of the zone is a loud floor.
  const observes = it => !!it && it.kind === 'curio' && (it.prims || []).some(p => p.id === 'observing');
  function lampHere(state) {
    const pack = state.dept.acc ? Packs.get(state.dept.acc) : null;
    return (!!pack && (pack.items || []).some(observes)) || (state.items || []).some(observes);
  }
  function largestRing(state, z) {
    const m = state.dept;
    let r = N.RING_MOVING;
    if (lampHere(state)) r += N.LAMP_RING;
    for (const k of z.list) { const t = Grid.TILES[Grid.ch(m, k % m.w, Int.idiv(k, m.w))]; if (t && t.loud) { r += N.RING_LOUD_FLOOR; break; } }
    return r;
  }

  // The zone's tiles (indices, row-major) each way reaches, in view v:
  // a sleeper's ring at radius r, as Archetypes.wakeRegion's default measures it at RING_MOVING
  // (rules/archetypes.js): you could stand there, none of a's own tiles, and some tile of a's
  // footprint an exhibit can stand on is within r walking tiles (one beyond its nearest
  // neighbour you could step onto, for one you cannot) and in line of sight;
  function ringHits(v, z, a, r) {
    const m = v.dept, fp = Actors.footprint(a), out = [];
    const mine = k => fp.some(t => t[1] * m.w + t[0] === k);
    for (const [tx, ty] of fp) {
      if (!Grid.inside(m, tx, ty) || !Grid.hold(m, tx, ty)) continue;
      const own = Grid.walkable(m, tx, ty), starts = [];
      if (own) starts.push([tx, ty]);
      else for (let d = 0; d < 8; d++) { const x = tx + Grid.DX[d], y = ty + Grid.DY[d]; if (Grid.inside(m, x, y) && Grid.walkable(m, x, y)) starts.push([x, y]); }
      if (!starts.length) continue;
      const dist = Grid.distances(m, starts, own ? r : r - 1);
      for (const k of z.list) {
        if (out.includes(k) || dist[k] < 0 || !stand(m, k) || mine(k)) continue;
        const [x, y] = tile(m, k);
        if (Grid.los(m, x, y, tx, ty)) out.push(k);
      }
    }
    return out.sort((p, q) => p - q);
  }
  // its axis (Wake.onAxis): in its row or column within AXIS_RANGE of one of its tiles, in
  // sight from it, not on it;
  function axisHits(v, z, a) {
    const m = v.dept, out = [];
    for (const k of z.list) {
      const [x, y] = tile(m, k);
      if (!stand(m, k) || Actors.covers(a, x, y)) continue;
      if (Actors.footprint(a).some(([fx, fy]) => (fx === x || fy === y) && Grid.disc(x - fx, y - fy, N.AXIS_RANGE) && Grid.los(m, fx, fy, x, y))) out.push(k);
    }
    return out;
  }
  // its tether (Wake.inTether): within TETHER_RANGE of what it guards, through anything;
  function tetherHits(v, z, a) {
    const m = v.dept, g = a.guards;
    return z.list.filter(k => { const [x, y] = tile(m, k); return Grid.disc(x - g[0], y - g[1], N.TETHER_RANGE) && stand(m, k); });
  }
  // what a patrol standing with its top-left tile on (px, py) sees (AI.sees): within
  // SIGHT_EXHIBIT of a tile of it, in line of sight, not one of its own;
  function sightHits(v, z, a, px, py) {
    const m = v.dept, fp = Actors.footprint(Object.assign({}, a, { x: px, y: py })), out = [];
    if (!fp.some(([x, y]) => near(z, x, y, N.SIGHT_EXHIBIT))) return out;
    for (const k of z.list) {
      const [x, y] = tile(m, k);
      if (!stand(m, k) || fp.some(t => t[0] === x && t[1] === y)) continue;
      if (fp.some(([fx, fy]) => Grid.disc(x - fx, y - fy, N.SIGHT_EXHIBIT) && Grid.los(m, fx, fy, x, y))) out.push(k);
    }
    return out;
  }
  // its wake region (Archetypes.wakeRegion over the turns), or the tiles of the zone among
  // tiles given.
  const hitsOf = (m, z, tiles) => { const out = []; for (const [x, y] of tiles) if (Grid.inside(m, x, y) && z.safe[y * m.w + x]) out.push(y * m.w + x); return out; };
  const regionHits = (v, z, a, turns) => hitsOf(v.dept, z, Archetypes.wakeRegion(v, a, turns));
  const sleeps = (state, a) => a.mode === 'dormant' && !Archetypes.pipless(state, a);
  // The ordinary doors you could open or close from the zone: beside a tile of it you could
  // stand on, and stepped into from there (Grid.canStep, the corner rule), as indices.
  function doorsOf(v, z) {
    const m = v.dept, out = [];
    for (const k of z.list) {
      const [x, y] = tile(m, k);
      if (!stand(m, k)) continue;
      for (let d = 0; d < 8; d++) {
        const nx = x + Grid.DX[d], ny = y + Grid.DY[d], c = Grid.ch(m, nx, ny), j = ny * m.w + nx;
        if ((c === '+' || c === "'") && Grid.canStep(m, x, y, d) && !out.includes(j)) out.push(j);
      }
    }
    return out.sort((p, q) => p - q);
  }
  // The doors of the zone whose noise a hears (within NOISE_SOFT of a tile of it by Noise.reach,
  // through every other door as it stands in view v, measured as Noise.emit measures it),
  // given each door's reach (reachOf).
  function noiseHits(v, a, doors, reachOf) {
    const m = v.dept, out = [];
    for (const k of doors) {
      const r = reachOf(v, k);
      if (Actors.footprint(a).some(([x, y]) => { const e = Grid.inside(m, x, y) ? Grid.reachDist(r, m, x, y) : -1; return e >= 0 && e <= N.NOISE_SOFT; })) out.push(k);
    }
    return out;
  }

  // LV6.findings(state) → every way the zone is reached, in spawn order and, for one exhibit,
  // in the order above: [{uid, how, tiles, open, turns?, d?}]. how: 'stands' (d its walking
  // distance from the entrance), 'ring', 'region' (the rest of its wake region: a station's
  // line, an awake exhibit's sight), 'untold' (awake from the start, with no region: tiles,
  // the zone's tile nearest it), 'sight' (a patrol from its round; turns, the turns from now
  // to the first action at which it would see you, as an event's turn counts them), 'axis',
  // 'tether', 'noise' (tiles: the doors it hears) or 'lamp' (only at
  // the larger ring: the Lamp lit, or a loud floor); tiles, the zone's tiles it reaches ([x,
  // y], row-major); open, true when it reaches them only with the doors open. [] in a map with
  // no entrance (a room for tests).
  function findings(state) {
    const m = state && state.dept, z = zone(m), out = [];
    if (!z) return out;
    const shut = view(state, false), open = view(state, true), R = largestRing(state, z), T = N.SAFE_ZONE_TURNS;
    const told = Patrol.timeline(state, T), walked = new Map(), doors = doorsOf(open, z), heard = new Map();
    // A door's noise, opened (it is open as its noise is made), each worked out once a view.
    const reachOf = (v, k) => {
      const key = (v === open ? 'o' : 's') + k;
      if (!heard.has(key)) { const x = k % m.w, y = Int.idiv(k, m.w), d = Object.assign({}, v.dept, { tiles: v.dept.tiles.slice() }); Grid.set(d, x, y, "'"); heard.set(key, Noise.reach(d, x, y, N.NOISE_SOFT)); }
      return heard.get(key);
    };
    if (told) for (const p of told) walked.set(p.uid, p.at);
    const say = (a, how, k, wasOpen, extra) => out.push(Object.assign({ uid: a.uid, how, tiles: k.map(i => tile(m, i)), open: wasOpen }, extra || {}));
    // A way that holds every tile with the doors open that it holds with them shut: asked open;
    // where it reaches, asked shut to say whether the doors' being open is what lets it.
    const monotone = (a, how, hitsIn) => {
      const o = hitsIn(open);
      if (!o.length) return false;
      const s = hitsIn(shut);
      say(a, how, s.length ? s : o, !s.length);
      return true;
    };
    // Any other way: asked shut, then open.
    const both = (a, how, hitsIn) => {
      for (const [v, wasOpen] of [[shut, false], [open, true]]) { const got = hitsIn(v); if (got.length) { say(a, how, got, wasOpen); return true; } }
      return false;
    };
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone) continue;
      let d = -1;
      for (const [x, y] of Actors.footprint(a)) { const e = Grid.inside(m, x, y) ? Grid.reachDist(z.d, m, x, y) : -1; if (e >= 0 && (d < 0 || e < d)) d = e; }
      if (d >= 0) out.push({ uid: a.uid, how: 'stands', tiles: Actors.footprint(a).map(t => [t[0], t[1]]), open: false, d });
      const dormant = sleeps(state, a);
      if (walked.has(a.uid)) {
        // A patrol on its round, told exactly: the first of its actions at which it sees the
        // zone, shut, then open.
        let hit = null;
        for (const [v, wasOpen] of [[shut, false], [open, true]]) {
          for (const p of walked.get(a.uid)) { const got = sightHits(v, z, a, p.x, p.y); if (got.length) { hit = { got, wasOpen, turns: Int.ceilDiv(p.t - state.tick, N.TICKS_PER_TURN) }; break; } }
          if (hit) break;
        }
        if (hit) say(a, 'sight', hit.got, hit.wasOpen, { turns: hit.turns });
      } else if (dormant) {
        // A sleeper's region is its ring, and a station's line, which passes a closed door as it
        // passes an open one: with the doors open, every tile it holds with them shut.
        monotone(a, 'region', v => regionHits(v, z, a, T));
      } else {
        // Awake: its region, with the doors shut, then open.
        let told = false;
        both(a, 'region', v => { const got = Archetypes.wakeRegion(v, a, T); if (got.length) told = true; return hitsOf(m, z, got); });
        // Awake from the start, on no round, with nothing in its rules saying where it walks
        // (no wake region either way): it is taken to find you, as the worst-case runner takes
        // it; the tile of the zone nearest it is marked.
        if (!told && a.mode !== 'hunting' && !Cases.encased(state, a)) {
          let best = -1, far = -1;
          for (const k of z.list) { const [x, y] = tile(m, k), c = Math.min(...Actors.footprint(a).map(([u, w]) => Math.max(Math.abs(u - x), Math.abs(w - y)))); if (best < 0 || c < far) { best = k; far = c; } }
          say(a, 'untold', [best], false);
        }
      }
      if (dormant && a.trigger === 'axis' && nearAny(z, a, N.AXIS_RANGE)) monotone(a, 'axis', v => axisHits(v, z, a));
      if (dormant && a.trigger === 'tether' && Array.isArray(a.guards) && near(z, a.guards[0], a.guards[1], N.TETHER_RANGE)) monotone(a, 'tether', v => tetherHits(v, z, a));
      if (doors.length && a.mode !== 'hunting' && !Archetypes.pipless(state, a) && nearAny(z, a, N.NOISE_SOFT + 1)) monotone(a, 'noise', v => noiseHits(v, a, doors, reachOf));
      if (dormant && R > N.RING_MOVING && nearAny(z, a, R)) monotone(a, 'lamp', v => ringHits(v, z, a, R));
    }
    // A sleeper's region reaching the zone in its ring is its ring's doing; and the larger
    // ring's finding is kept only where the ring at RING_MOVING does not reach.
    const ringed = new Set();
    for (const f of out) {
      if (f.how !== 'region') continue;
      const a = state.actors.find(b => b.uid === f.uid);
      if (!sleeps(state, a)) continue;
      const r = ringHits(f.open ? open : shut, z, a, N.RING_MOVING);
      if (r.length) { f.how = 'ring'; f.tiles = r.map(k => tile(m, k)); ringed.add(f.uid); }
    }
    return out.filter(f => !(f.how === 'lamp' && ringed.has(f.uid)));
  }

  // The exhibit's name, as its label gives it.
  function name(state, a) {
    const sp = a ? Packs.speciesFor(state, a) : null;
    return sp && sp.name ? sp.name : 'an exhibit';
  }
  // LV6.words(state, f) → a finding in words a player would take.
  function words(state, f) {
    const a = state.actors.find(b => b.uid === f.uid), who = name(state, a), at = f.tiles[0];
    const where = `standing at ${at[0]},${at[1]}, in the safe zone${f.open ? ', once the doors are open' : ''}`;
    switch (f.how) {
      case 'stands': return `the ${who} stands ${f.d} walking tiles from the entrance, inside the safe zone (the first ${N.SAFE_ZONE})`;
      case 'ring': return `${where}, you would wake the ${who}: it is inside your ring (${N.RING_MOVING} walking tiles, in sight)`;
      case 'lamp': return `${where}, with the Lamp lit you would wake the ${who}: it is inside your ring (${N.RING_MOVING + N.LAMP_RING} walking tiles, in sight)`;
      case 'axis': return `${where}, you would wake the ${who}: you are in its row or column within ${N.AXIS_RANGE} tiles, in its sight`;
      case 'tether': return `${where}, you are within ${N.TETHER_RANGE} tiles of what the ${who} guards: it would wake at once, and it feels you through walls`;
      case 'sight': return `${where}, the ${who} would see you from its round ${f.turns ? `within ${f.turns} turn${f.turns === 1 ? '' : 's'}` : 'at once'}`;
      case 'noise': return `opening or closing the door at ${at[0]},${at[1]}, beside the safe zone${f.open ? ', once the other doors are open' : ''}, ` +
        (a && a.mode === 'dormant' ? `you would wake the ${who}: it hears the door, a pip each turn, and wakes at ${N.PIPS_TO_WAKE}` : `the ${who} would hear it and come to look`);
      case 'untold': return `the ${who} is awake from the start and nothing tells where it walks, so it is taken to find you in the safe zone (at ${at[0]},${at[1]}, the nearest tile of it)`;
      default:
        if (a && HourlyDemonstration.isStation(state, a)) return `${where}, the line of the ${who} would strike you within ${N.SAFE_ZONE_TURNS} turns`;
        if (a && a.mode !== 'dormant') return `${where}, the ${who} would see you within ${N.SAFE_ZONE_TURNS} turns`;
        return `${where} for ${N.SAFE_ZONE_TURNS} turns, you would wake the ${who}`;
    }
  }

  // LV6.check(state, plan) → null, or {reason, tiles}: the first finding (LV6.findings), in
  // words (LV6.words), with its tiles to mark: where the exhibit stands, then the zone's tiles
  // it reaches. plan is not read (the state holds the department as made); a map with no
  // entrance has nothing to check.
  function check(state, plan) {
    const all = findings(state);
    if (!all.length) return null;
    const f = all[0], a = state.actors.find(b => b.uid === f.uid), tiles = [];
    for (const t of Actors.footprint(a).concat(f.tiles)) if (!tiles.some(u => u[0] === t[0] && u[1] === t[1])) tiles.push([t[0], t[1]]);
    return { reason: words(state, f), tiles };
  }

  // Registered through the namespace, so that a test may stand in for it (LV6.check).
  Populate.addValidator('lv6', (state, plan) => LV6.check(state, plan));
  return { check, findings, words };
})();
