// ACCESSION — LV11, the worst-case runner (design/layout.md §9.2; M4 plan D2.3, Q2; BUILD.md §5.5,
// §10.3): a route from the entrance to an exit, the exhibits it would wake, and what they would
// cost a runner of the median visitor less one Certificate. It passes at RUNNER_PASS_PCT of the
// runner's health. D-RUNNER-EST built it in report mode; D-RUNNER registers it as a validator
// (Populate.addValidator('lv11', …), below, after LV6 and the treasure case), with its
// RUNNER_MOVES logged moves (LRunner.check), and tools/runner-sweep.js --check is its gate.
//
// The runner (D2.3): the median visitor at the department's depth (Progress.median: a Balanced
// weapon and a Standard garment of the lower tier on offer there) at one grade less (never
// below GRADE_START), with that grade's health, and its kit's stats at that grade (Kit.stats:
// a kit a grade too high for it costs Acc and Padding, §8.1); no perks, no items, no surprise.
//
// The route: over tiles you could step onto (§8.2's step rule), from the entrance to an exit,
// never on a staff door, a tile of the Centrepiece hall, or a tile an exhibit stands on that
// does not move (asleep, or in a case). It passes through the Intro's onward openings, which
// are its only ways out; the Intro's own exhibits are left out of everything, since the Intro's
// checks certify them (D2.3). The runner stands on the route's i-th tile at turn i.
//
// Waking, pessimistic (D2.3; never fewer exhibits, never later, than the rules wake them), with
// every ordinary door open, since the runner or an exhibit may open any of them:
//   - asleep: a pip for each turn on a tile of its wake region (Archetypes.wakeRegion: the ring
//     at RING_MOVING with line of sight, and what its archetype adds), and on its `axis`
//     trigger's tiles (Wake.onAxis's: its row or column within AXIS_RANGE, in its sight), each
//     at most once a turn, never decaying; it wakes on the turn the pips it lacks are reached.
//     Its `tether` (within TETHER_RANGE of what it guards) wakes it at once;
//   - awake at the start (a Wader on its round): the first tile of its wake region over HORIZON
//     times the shortest route's turns (Archetypes.wakeRegion: what it could see by then);
//   - what a waking wakes in turn: a Wader flagged with alarm_network raises the alarm two
//     turns after it wakes (shown, then called), and every sleeper that can hear wakes
//     (AlarmNetwork's call); a herald calls two turns after it wakes, and every sleeper on its
//     call's tiles wakes (Specials.tiles 'call'); an exhibit the runner fights wakes, a turn
//     later, every sleeper of its group with the `ally_hit` trigger within ALLY_HIT_RANGE.
//     A mimic in its disguise (pipless) is woken by none of these, and a Centrepiece's piece
//     only by pips.
// Left out, and so not counted: noise (a blow's, a door's), regeneration, the bell, and an
// exhibit's walk after it wakes; an exhibit in an intact case wakes but cannot strike you, and
// a tethered warden (§8.2) strikes only while you stand within TETHER_RANGE of what it guards
// (its leash), so it joins a fight from the first turn, once awake, that the route stands
// there, and never when the route keeps outside it, however it woke.
//
// The charge of every woken exhibit not in a case, from the numbers its odds readout uses
// (Labels.odds: Combat.hitChance, Combat.netRolls after Padding, Archetypes.readout's hits,
// Specials.readout), in hundredths of a hit point, each special counted once at the damage it
// would deal you (D2.3); your time to destroy it is its hits needed at your chance of hitting,
// at your blow's cost:
//   (a) 'a': its expected blow (its mean net hit at its chance), for your expected time to
//       destroy it, each exhibit fought alone (the label's figures);
//   (b) 'b', Q2's charge: its maximum blow after your Padding at its chance, for your expected
//       time to destroy it; exhibits woken within RUNNER_TOGETHER_TURNS of each other along the
//       route are one fight, in which each attacks at its own blow's rate until destroyed and
//       you destroy them in the order that costs least (shortest time per damage first);
//   (c) 'c', the draft's (layout.md §9.2): its maximum blow, always hitting, for the turns you
//       take to destroy it hitting every blow at your least damage, and APPROACH turns more
//       for a ranged exhibit, each fought alone.
// The cheapest route is searched among a few: the shortest, and shortest ones that pay more
// and more for the tiles of wake regions (each tile costing what waking there would wake),
// then those that wait for timed patrols (timed, its work bounded by TIMED_WORK); so a pass
// found is a route that exists, and a failure may miss a cheaper one.
//
// It draws on no stream. Only LV11's moves (LRunner.check) change the state: where an exhibit
// stands, as generation makes the department.
'use strict';
const LRunner = (() => {
  const CHARGES = ['a', 'b', 'c'];
  // The draft's approach turns for a ranged exhibit (layout.md §9.2: "up to 3"); charge (c) only.
  const APPROACH = 3;
  // A Wader's sight is taken over this many times the shortest route's turns, which holds its
  // whole round (its region stops growing after one round in every measured department).
  const HORIZON = 3;
  // How the route search prices a tile in a wake region, against a step's 100: the shortest
  // route (0), then dearer and dearer, then such tiles never stepped on (BLOCK).
  const PRICES = [0, 1, 4, 32];
  const BLOCK = -1;
  // The timed search's work, in steps tried (each tile reached at a turn, and each step from
  // it), past which it stops with what it has found: it bounds the rare department whose
  // patrols leave a great many ways to wait (some 200 CPU-ms at CP1). A route it then misses
  // is a pass missed, never a cost understated.
  const TIMED_WORK = 600000;
  // A chain waking's delay: the alarm and a herald's call are shown for a turn, then go off at
  // the caller's next action; ally_hit wakes as the first blow lands.
  const CALL_DELAY = 2, ALLY_DELAY = 1;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

  // ---- The runner (D2.3) ----

  // LRunner.runner(state, opts?) → the runner, an actor-like record for the combat rules: the
  // median visitor at the department's depth less one Certificate. opts.runner 'hp' keeps the
  // median's kit stats and takes only the health away (a reading of "less one Certificate"
  // kept for measurement).
  function runner(state, opts) {
    const m = state.dept, med = Progress.median(m.depth), grade = Math.max(N.GRADE_START, med.grade - 1);
    const kitGrade = opts && opts.runner === 'hp' ? med.grade : grade;
    const w = Kit.item({ uid: 'runner.w', kind: 'weapon', where: { at: 'kit', slot: 'weapon' }, form: 'balanced', tier: med.tier });
    const g = Kit.item({ uid: 'runner.g', kind: 'garment', where: { at: 'kit', slot: 'garment' }, form: 'standard', tier: med.tier });
    const st = Kit.stats(w, g, kitGrade, []), hp = Health.maxHp(grade), you = state.actors[0];
    return { uid: 'you', sp: 'visitor', size: 1, x: you.x, y: you.y, hp, maxHp: hp, grade, tier: med.tier, acc: st.acc, eva: st.eva, pad: st.pad,
      dmin: st.dmin, dmax: st.dmax, weaponForm: st.weaponForm, reach: st.reach, statuses: [], mode: null };
  }

  // ---- One exhibit's numbers, as its odds readout has them (Labels.odds) ----

  // LRunner.terms(state, a, run) → {uid, need, least, yourChance, yourCost, chance, max, sum, n,
  // cost, ranged, specials: [{sp, net}]}: your hits needed (the readout's "typically need"),
  // your hits needed at your least damage, your chance and your blow's ticks; its chance to hit
  // you, its largest net hit, the sum and count of its net rolls (their mean is the readout's
  // "typically"), its blow's ticks, whether it shoots, and each damaging special's net damage.
  // You are taken to strike it from its own tile, so no side of it (an old repair's) doubles
  // your blows. An exhibit with no blow (noBlow) has chance 0.
  function terms(state, a, run) {
    const r = Object.assign({}, run, { x: a.x, y: a.y }), at = [a.x, a.y];
    const said = Archetypes.readout(state, a, r), noBlow = said.some(s => s.k === 'noBlow'), set = said.find(s => s.k === 'hits') || null;
    const mine = Combat.netRolls(r, a, state, at), theirs = noBlow ? null : Combat.netRolls(a, r, state, at);
    const A = own(Registry.ARCHETYPES, a.arch) ? Registry.ARCHETYPES[a.arch] : null;
    return {
      uid: a.uid, need: set ? set.n : Int.ceilDiv(a.hp * mine.n, mine.sum), least: set ? set.n : Int.ceilDiv(a.hp, mine.min),
      yourChance: Combat.hitChance(r, a), yourCost: Actors.attackCost(state, r),
      chance: noBlow ? 0 : Combat.hitChance(a, r), max: noBlow ? 0 : theirs.max, sum: noBlow ? 0 : theirs.sum, n: noBlow ? 1 : theirs.n,
      cost: Actors.attackCost(state, a), ranged: !!(A && A.ranged),
      specials: Specials.readout(state, a, r).filter(s => s.net !== null).map(s => ({ sp: s.sp, net: s.net })),
    };
  }

  // ---- The charges, in hundredths of a hit point ----

  // Your expected time to destroy it, in hundredths of a turn: its hits needed, each taking
  // 100 / your chance attempts, each attempt your blow's ticks (100 ticks a turn).
  const time = t => Int.ceilDiv(100 * t.need * t.yourCost, t.yourChance);
  const specials = t => { let s = 0; for (const x of t.specials) s += 100 * x.net; return s; };
  // LRunner.alone(t, how) → its charge fought alone, under charge how ('a', 'b' or 'c'). Over C
  // hundredths of a turn an exhibit blowing every `cost` ticks for d at chance p deals
  // C · p · d / cost hundredths of a hit point.
  function alone(t, how) {
    if (how === 'a') return Int.ceilDiv(time(t) * t.chance * t.sum, t.cost * t.n) + specials(t);
    if (how === 'c') return Int.ceilDiv((t.least * t.yourCost + (t.ranged ? 100 * APPROACH : 0)) * 100 * t.max, t.cost) + specials(t);
    if (how === 'b') return Int.ceilDiv(time(t) * t.chance * t.max, t.cost) + specials(t);
    throw new Error(`LRunner: no charge ${how}`);
  }
  // LRunner.fight(list, how) → {cost, order}: a fight's charge, list its exhibits' terms (each
  // with i, its spawn index, for ties). Under (a) and (c) each is fought alone; under (b) they
  // all attack until each is destroyed, and you destroy them shortest time per damage first
  // (Smith's rule: the order that costs least), each dealing its rate until its own end.
  function fight(list, how) {
    if (how !== 'b') { let c = 0; for (const t of list) c += alone(t, how); return { cost: c, order: list.map(t => t.uid) }; }
    const order = list.slice().sort((p, q) => (time(p) * q.chance * q.max * p.cost - time(q) * p.chance * p.max * q.cost) || (p.i - q.i));
    let at = 0, c = 0;
    for (const t of order) { at += time(t); c += Int.ceilDiv(at * t.chance * t.max, t.cost) + specials(t); }
    return { cost: c, order: order.map(t => t.uid) };
  }

  // ---- The department, as the runner sees it ----

  const roomOf = (m, x, y) => Array.isArray(m.roomOf) && m.roomOf[y] ? m.roomOf[y][x] : null;
  const roleOf = (m, id) => { const r = (m.rooms || []).find(q => q.id === id); return r ? r.role : null; };
  // A map with every ordinary door open (each may be by then).
  function opened(state) {
    const m = state.dept;
    return Object.assign({}, state, { dept: Object.assign({}, m, { tiles: m.tiles.map(row => row.replace(/\+/g, "'")) }) });
  }
  const maskOf = (m, tiles) => { const k = new Uint8Array(m.w * m.h); for (const [x, y] of tiles) if (Grid.inside(m, x, y)) k[y * m.w + x] = 1; return k; };
  const any = k => { for (let i = 0; i < k.length; i++) if (k[i]) return true; return false; };
  // The tiles you could stand on where an `axis` exhibit gains its pip (Wake.onAxis): in its row
  // or column within AXIS_RANGE of one of its tiles, in sight from it, not on it.
  function axisMask(m, a) {
    const k = new Uint8Array(m.w * m.h);
    for (const [fx, fy] of Actors.footprint(a)) for (let d = 0; d < 8; d += 2) for (let s = 1; s <= N.AXIS_RANGE; s++) {
      const x = fx + Grid.DX[d] * s, y = fy + Grid.DY[d] * s;
      if (!Grid.inside(m, x, y) || !Grid.disc(x - fx, y - fy, N.AXIS_RANGE)) break;
      if (Grid.walkable(m, x, y) && !Actors.covers(a, x, y) && Grid.los(m, fx, fy, x, y)) k[y * m.w + x] = 1;
    }
    return k;
  }
  // The tiles within TETHER_RANGE of what a guards (Wake.inTether: no sight needed).
  function tetherMask(m, a) {
    const k = new Uint8Array(m.w * m.h), g = a.guards;
    for (let y = g[1] - N.TETHER_RANGE; y <= g[1] + N.TETHER_RANGE; y++) for (let x = g[0] - N.TETHER_RANGE; x <= g[0] + N.TETHER_RANGE; x++)
      if (Grid.inside(m, x, y) && Grid.disc(x - g[0], y - g[1], N.TETHER_RANGE)) k[y * m.w + x] = 1;
    return k;
  }
  // A function giving the tiles you could stand on that an exhibit standing on (x, y) sees
  // (AI.sees: within SIGHT_EXHIBIT, in line of sight; every ordinary door open, as every wake
  // region is read here; a surface, which only ever hides you, not counted), each tile's mask
  // made once.
  function sighted(state, vm) {
    const r = N.SIGHT_EXHIBIT, made = new Map(), w = vm.w, h = vm.h, max = Math.max, min = Math.min;
    // You could stand there: walkable, not a closed door; and sight passes it (Grid.seeThrough):
    // each read once per tile.
    const stand = new Uint8Array(w * h), see = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (Grid.walkable(vm, x, y) && !Grid.closedDoor(vm, x, y)) stand[y * w + x] = 1;
      if (Grid.seeThrough(vm, x, y)) see[y * w + x] = 1;
    }
    // Grid.los on this map, with no surface: the same Bresenham line, traced from the end that
    // comes first in row-major order, its ends never blocking.
    const los = (x0, y0, x1, y1) => {
      if (y1 < y0 || (y1 === y0 && x1 < x0)) { let t = x0; x0 = x1; x1 = t; t = y0; y0 = y1; y1 = t; }
      const dx = x1 > x0 ? x1 - x0 : x0 - x1, dy = y1 - y0, sx = x1 > x0 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      for (;;) {
        if (x === x1 && y === y1) return true;
        if (!(x === x0 && y === y0) && !see[y * w + x]) return false;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += 1; }
      }
    };
    // Each mask's tiles as a list (lists), for reading it whole.
    const lists = new Map();
    const sightOf = (fx, fy) => {
      const key = fy * w + fx;
      if (made.has(key)) return made.get(key);
      const k = new Uint8Array(w * h), list = [];
      for (let y = max(0, fy - r); y <= min(h - 1, fy + r); y++) for (let x = max(0, fx - r); x <= min(w - 1, fx + r); x++) {
        const dx = x - fx, dy = y - fy;
        if (stand[y * w + x] && dx * dx + dy * dy <= r * r + r && los(fx, fy, x, y)) { k[y * w + x] = 1; list.push(y * w + x); }
      }
      made.set(key, k);
      lists.set(k, list);
      return k;
    };
    sightOf.lists = lists;
    return sightOf;
  }
  // A tethered warden's leash (§8.2; rules/arch/tethered_warden.js): it never steps off the disc
  // of TETHER_RANGE round what it guards, and while you stand outside that disc at its action
  // it starts no fight with you, no blow and no new ring (a ring it showed while you stood
  // inside still goes off at its next action, which a route has entered the disc to meet). So
  // it strikes the runner only once the route stands within that disc while it is awake.
  const leashed = a => a.arch === 'tethered_warden' && Array.isArray(a.guards);
  const near = (a, b, r) => Actors.footprint(a).some(([x, y]) => Actors.footprint(b).some(([u, v]) => Grid.disc(x - u, y - v, r)));
  const sleeps = (state, b) => b.mode === 'dormant' && !Archetypes.pipless(state, b);

  // LRunner.model(state, opts?) → what the route search and every route's charge read, or
  // {none: why} when the state is no department (no entrance, exits or rooms) or no route
  // reaches an exit. opts, for measurement: {runner: 'hp'} (above); {doors: 'shut'}, wake
  // regions with the doors as they stand; {chain: 'off'}, no waking wakes another (D2.3's list:
  // the ring and the wake regions only). Fields: run (the runner), blocked (the tiles no route
  // steps on), short (the shortest route's turns), horizon, and ex, one record per exhibit
  // that counts: {a, i, t (its terms), fights (not in a case), need, ring, axis, tether, leash
  // (a tethered warden's disc, where alone it strikes), sight (masks of tile indices), wakes:
  // [[j, delay, why]] (the sleepers its waking wakes)}.
  function model(state, opts) {
    const m = state.dept;
    if (!m || !Array.isArray(m.entrance) || !Array.isArray(m.exits) || !m.exits.length || !Array.isArray(m.rooms) || !m.rooms.length) return { none: 'not a department' };
    const intro = (m.rooms.find(r => r.role === 'intro') || {}).id, hall = m.rooms.filter(r => r.role === 'centre').map(r => r.id);
    const blocked = new Uint8Array(m.w * m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const c = Grid.ch(m, x, y);
      if (!Grid.walkable(m, x, y) || c === 'S' || c === 's' || hall.includes(roomOf(m, x, y))) blocked[y * m.w + x] = 1;
    }
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (!a.gone && (a.mode === 'dormant' || Cases.encased(state, a))) for (const [x, y] of Actors.footprint(a)) if (Grid.inside(m, x, y)) blocked[y * m.w + x] = 1;
    }
    // The route starts where you stand as the visit begins (inside the entrance), so that its
    // i-th tile is where you stand after your i-th action.
    const you = state.actors[0], start = you.y * m.w + you.x, steps = stepsOf(m, blocked);
    const first = search(m, steps, null, 0, start), short = first ? first.length - 1 : -1;
    if (short < 0) return { none: 'no way to an exit but through the hall, a staff door or an exhibit that stands still' };
    const run = runner(state, opts), horizon = HORIZON * short, view = opts && opts.doors === 'shut' ? state : opened(state), vm = view.dept;
    // The patrols' timeline (Patrol.timeline), unless it cannot be told or is switched off.
    const told = opts && opts.timing === 'off' ? null : Patrol.timeline(state, horizon), walked = new Map();
    if (told) for (const p of told) walked.set(p.uid, p.at);
    const sightOf = sighted(state, vm);
    const ex = [];
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || Archetypes.pipless(state, a) || roomOf(m, a.x, a.y) === intro) continue;
      const e = { a, i, t: null, fights: !Cases.encased(state, a), need: 0, ring: null, axis: null, tether: null, leash: leashed(a) ? tetherMask(vm, a) : null, sight: null, wakes: [] };
      if (a.mode === 'dormant') {
        e.need = Math.max(1, N.PIPS_TO_WAKE - (a.pips || 0));
        e.ring = maskOf(vm, Archetypes.wakeRegion(view, a, N.PIPS_TO_WAKE));
        if (a.trigger === 'axis') e.axis = axisMask(vm, a);
        if (a.trigger === 'tether' && Array.isArray(a.guards)) e.tether = tetherMask(vm, a);
      } else if (walked.has(a.uid)) {
        // A patrol whose walk is told: what it sees at each of its actions (AI.look, before it
        // moves), by the runner's turn: an action in the ticks of turn i comes after the
        // runner's i-th move (ties go to you), so it sees the route's tile i + 1.
        // (e.walk: the tiles it stands on, each once, which no move may take.)
        e.turns = []; e.walk = [];
        const masks = new Set();
        for (const p of walked.get(a.uid)) {
          const q = p.y * m.w + p.x;
          if (!e.walk.includes(q)) e.walk.push(q);
          const i = Int.idiv(p.t - state.tick, N.TICKS_PER_TURN) + 1;
          while (e.turns.length <= i) e.turns.push([]);
          const k = sightOf(p.x, p.y);
          if (!e.turns[i].includes(k)) e.turns[i].push(k);
          masks.add(k);
        }
        // Everything it could see on its round: after a fight starts, and past its timeline.
        e.sight = new Uint8Array(m.w * m.h);
        for (const k of masks) for (const q of sightOf.lists.get(k)) e.sight[q] = 1;
      } else {
        e.sight = maskOf(vm, Archetypes.wakeRegion(view, a, horizon));
        // An exhibit awake from the start whose rules give no region is taken to find you at once.
        if (!any(e.sight)) e.sight.fill(1);
      }
      // A station's line (M.11's chime; CP1): each of its chimes within the horizon marks it,
      // awake or asleep, and DEMO_WARNING turns later it goes off at the boundary when the
      // runner stands on the route's tile (that turn less the state's): [j, the tiles it could
      // take then (HourlyDemonstration.reach)].
      if (HourlyDemonstration.isStation(state, a) && HourlyDemonstration.of(state)) {
        e.lines = [];
        for (let c = state.turn + 1; c + N.DEMO_WARNING - state.turn <= horizon; c++)
          if (HourlyDemonstration.chimesAt(state, a, c)) e.lines.push([c + N.DEMO_WARNING - state.turn, maskOf(m, HourlyDemonstration.reach(state, a, c))]);
      }
      ex.push(e);
    }
    // A line's net damage to the runner, through its Padding, as every special's is counted.
    const lineNet = Math.max(N.DMG_MIN_ON_HIT, Specials.info(state, 'demo_line').gross - run.pad);
    // What each waking wakes in turn.
    if (!(opts && opts.chain === 'off')) for (const e of ex) {
      const a = e.a, A = own(Registry.ARCHETYPES, a.arch) ? Registry.ARCHETYPES[a.arch] : null;
      const call = A && A.special === 'call' ? maskOf(m, Specials.tiles(state, a, 'call')) : null, alarm = Modules.flagged(state, a, 'alarm_network');
      ex.forEach((f, j) => {
        const b = f.a;
        if (b === a || !sleeps(state, b)) return;
        const piece = Actors.centrepiece(b);
        // ally_hit first: the soonest of a sleeper's wakings is the one kept.
        if (e.fights && a.group && b.group === a.group && b.trigger === 'ally_hit' && near(b, a, N.ALLY_HIT_RANGE)) e.wakes.push([j, ALLY_DELAY, 'ally_hit']);
        if (alarm && !piece) e.wakes.push([j, CALL_DELAY, 'alarm']);
        else if (call && !piece && Actors.footprint(b).some(([x, y]) => call[y * m.w + x])) e.wakes.push([j, CALL_DELAY, 'herald']);
      });
    }
    return { state, run, blocked, start, short, first, steps, horizon, ex, lineNet, costs: new Map(), lists: sightOf.lists };
  }

  // The terms of M's exhibit e (LRunner.terms, with its spawn index and species), worked out
  // the first time a charge needs them.
  function termsOf(M, e) {
    if (!e.t) e.t = Object.assign(terms(M.state, e.a, M.run), { i: e.i, sp: e.a.sp });
    return e.t;
  }

  // ---- The route ----

  // Every step the route may take, worked out once a model (Grid.canStep, in Grid's direction
  // order): for each tile k not blocked, its steps from[k] … from[k + 1] − 1, each onto to[e]
  // (never a blocked tile) in direction how[e], or 10 + that direction onto a closed door.
  function stepsOf(m, blocked) {
    const n = m.w * m.h, w = m.w, from = new Int32Array(n + 1), to = new Int32Array(8 * n), how = new Uint8Array(8 * n);
    let e = 0;
    for (let k = 0; k < n; k++) {
      from[k] = e;
      if (blocked[k]) continue;
      const x = k % w, y = Int.idiv(k, w);
      for (let d = 0; d < 8; d++) {
        if (!Grid.canStep(m, x, y, d)) continue;
        const qx = x + Grid.DX[d], qy = y + Grid.DY[d], q = qy * w + qx;
        if (!blocked[q]) { to[e] = q; how[e] = Grid.ch(m, qx, qy) === '+' ? 10 + d : d; e++; }
      }
    }
    from[n] = e;
    return { from, to, how };
  }

  // A cheapest walk (Dijkstra, 100 a step and price × pen[k] for entering tile k, never a
  // blocked tile, nor a priced tile when price is BLOCK) from the entrance to an exit: its tile
  // indices, the entrance first, or null. Ties go to the lower tile index, so it draws nothing.
  // The heap holds (distance, tile) pairs in two typed arrays, least distance first, then the
  // lower tile.
  function search(m, steps, pen, price, start) {
    const n = m.w * m.h, dist = new Float64Array(n).fill(-1), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const exit = new Uint8Array(n), { from, to, how } = steps;
    for (const [x, y] of m.exits) exit[y * m.w + x] = 1;
    let cap = 64, hd = new Float64Array(cap), hk = new Int32Array(cap), size = 0;
    const less = (i, j) => hd[i] < hd[j] || (hd[i] === hd[j] && hk[i] < hk[j]);
    const swap = (i, j) => { const d = hd[i], k = hk[i]; hd[i] = hd[j]; hk[i] = hk[j]; hd[j] = d; hk[j] = k; };
    const push = (d, k) => {
      if (size === cap) { cap *= 2; const d2 = new Float64Array(cap), k2 = new Int32Array(cap); d2.set(hd); k2.set(hk); hd = d2; hk = k2; }
      hd[size] = d; hk[size] = k;
      let i = size++;
      while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
    };
    dist[start] = 0; push(0, start);
    while (size) {
      const d = hd[0], k = hk[0];
      size--;
      if (size) {
        hd[0] = hd[size]; hk[0] = hk[size];
        for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let b = i; if (l < size && less(l, b)) b = l; if (r < size && less(r, b)) b = r; if (b === i) break; swap(i, b); i = b; }
      }
      if (done[k]) continue;
      done[k] = 1;
      if (exit[k]) {
        // Its tiles, the entrance first, with a turn more before each closed door (as the map
        // stands) to open it: a step into one opens it and leaves you where you were.
        const out = [];
        for (let q = k; q >= 0; q = prev[q]) { out.push(q); if (prev[q] >= 0 && Grid.ch(m, q % m.w, Int.idiv(q, m.w)) === '+') out.push(prev[q]); }
        return out.reverse();
      }
      for (let e = from[k]; e < from[k + 1]; e++) {
        const q = to[e];
        if (done[q]) continue;
        if (pen && pen[q] && price === BLOCK) continue;
        const nd = d + 100 + (pen && price > 0 ? price * pen[q] : 0);
        if (dist[q] < 0 || nd < dist[q]) { dist[q] = nd; prev[q] = k; push(nd, q); }
      }
    }
    return null;
  }

  // What a route wakes, and when: T[j] the turn exhibit ex[j] wakes (-1: never), how[j] why
  // (ring, axis, tether, sight, alarm, herald, ally_hit), and F[j] the turn it joins a fight
  // (-1: never): its waking's, for one that can fight (not in a case); for a tethered warden
  // (e.leash), the first turn, from its waking on, that the route stands within its tether,
  // since outside that it starts no fight (§8.2), and never when the route does not.
  // Does a timed patrol see the route's tile k at turn i (past its timeline, anything it could)?
  const seesAt = (e, i, k) => i < e.turns.length ? e.turns[i].some(mask => mask[k] === 1) : e.sight[k] === 1;
  function wakes(M, route) {
    const n = M.ex.length, T = new Array(n).fill(-1), how = new Array(n).fill(null), F = new Array(n).fill(-1);
    M.ex.forEach((e, j) => {
      if (e.turns) { for (let i = 0; i < route.length; i++) if (seesAt(e, i, route[i])) { T[j] = i; how[j] = 'sight'; return; } return; }
      if (e.sight) { for (let i = 0; i < route.length; i++) if (e.sight[route[i]]) { T[j] = i; how[j] = 'sight'; return; } return; }
      let pips = 0;
      for (let i = 0; i < route.length; i++) {
        const k = route[i];
        if (e.tether && e.tether[k]) { T[j] = i; how[j] = 'tether'; return; }
        const ring = e.ring[k] ? 1 : 0, axis = e.axis && e.axis[k] ? 1 : 0;
        pips += ring + axis;
        if (pips >= e.need) { T[j] = i; how[j] = ring ? 'ring' : 'axis'; return; }
      }
    });
    const joins = (e, t) => {
      if (!e.fights) return -1;
      if (!e.leash) return t;
      for (let i = t; i < route.length; i++) if (e.leash[route[i]]) return i;
      return -1;
    };
    // Each waking's own wakings, earliest first: the alarm and a herald's call from its waking,
    // ally_hit from the fight that strikes it. Once the runner has a fight, it keeps to no
    // timetable: from then on a timed patrol finds it wherever it could see it on its round.
    // (woke[j]: its waking seen to; hit[j]: its fight seen to; a waking first on a tie.)
    const woke = new Uint8Array(n), hit = new Uint8Array(n);
    let fought = false;
    for (;;) {
      let b = -1, fight = false, at = -1;
      for (let j = 0; j < n; j++) {
        if (!woke[j] && T[j] >= 0 && (b < 0 || T[j] < at || (T[j] === at && fight))) { b = j; fight = false; at = T[j]; }
        if (woke[j] && !hit[j] && F[j] >= 0 && (b < 0 || F[j] < at)) { b = j; fight = true; at = F[j]; }
      }
      if (b < 0) break;
      const e = M.ex[b];
      if (!fight) {
        woke[b] = 1;
        F[b] = joins(e, T[b]);
        for (const [j, delay, why] of e.wakes) if (why !== 'ally_hit' && !woke[j] && (T[j] < 0 || T[b] + delay < T[j])) { T[j] = T[b] + delay; how[j] = why; }
        continue;
      }
      hit[b] = 1;
      if (!fought) {
        fought = true;
        M.ex.forEach((p, j) => {
          if (woke[j] || !p.turns) return;
          for (let i = F[b]; i < route.length && (T[j] < 0 || i < T[j]); i++) if (p.sight[route[i]]) { T[j] = i; how[j] = 'sight'; return; }
        });
      }
      for (const [j, delay, why] of e.wakes) if (why === 'ally_hit' && !woke[j] && (T[j] < 0 || F[b] + delay < T[j])) { T[j] = F[b] + delay; how[j] = why; }
    }
    return { T, how, F };
  }

  // LRunner.cost(M, route) → {route, length, woken: [{uid, sp, turn, how, fights, at}], fights:
  // [{turn, uids, sps, a, b, c}], a, b, c}: what the route wakes, its fights (exhibits that fight
  // it: not in a case and, a tethered warden, reached within its tether (at, the turn each
  // joins; null for one that never does), each joining within RUNNER_TOGETHER_TURNS of the one
  // before, in the order they join), and each charge.
  function cost(M, route) {
    if (M.costs && M.costs.has(route)) return M.costs.get(route);
    const out = costOf(M, route);
    if (M.costs) M.costs.set(route, out);
    return out;
  }
  function costOf(M, route) {
    const { T, how, F } = wakes(M, route), woken = [];
    M.ex.forEach((e, j) => { if (T[j] >= 0) woken.push({ j, uid: e.a.uid, sp: e.a.sp, turn: T[j], how: how[j], fights: F[j] >= 0, at: F[j] }); });
    woken.sort((p, q) => (p.turn - q.turn) || (M.ex[p.j].i - M.ex[q.j].i));
    // The fights, in the order their exhibits join them (at), ties in spawn order.
    const fights = [], joining = woken.filter(w => w.fights).sort((p, q) => (p.at - q.at) || (M.ex[p.j].i - M.ex[q.j].i));
    for (const w of joining) {
      const last = fights[fights.length - 1];
      if (last && w.at - last.end <= N.RUNNER_TOGETHER_TURNS) { last.list.push(termsOf(M, M.ex[w.j])); last.end = w.at; }
      else fights.push({ turn: w.at, end: w.at, list: [termsOf(M, M.ex[w.j])] });
    }
    const out = { route, length: route.length - 1, woken: woken.map(w => ({ uid: w.uid, sp: w.sp, turn: w.turn, how: w.how, fights: w.fights, at: w.fights ? w.at : null })), fights: [], lines: [] };
    for (const how of CHARGES) out[how] = 0;
    // A station's line that goes off while the route stands on it, once a station (D2.3: each
    // special once, at its printed damage), in every charge.
    for (const e of M.ex) {
      if (!e.lines) continue;
      const hit = e.lines.find(([j, mask]) => j < route.length && mask[route[j]] === 1);
      if (!hit) continue;
      out.lines.push({ uid: e.a.uid, turn: hit[0] });
      for (const how of CHARGES) out[how] += 100 * M.lineNet;
    }
    for (const f of fights) {
      const rec = { turn: f.turn, uids: f.list.map(t => t.uid), sps: f.list.map(t => t.sp) };
      for (const how of CHARGES) { rec[how] = fight(f.list, how).cost; out[how] += rec[how]; }
      out.fights.push(rec);
    }
    return out;
  }

  // The routes the search tries: the shortest, then dearer prices for the tiles where a waking
  // would cost (pen: each exhibit's charge (b) alone and what its waking wakes, over the pips it
  // lacks for a ring or axis tile), then those tiles never stepped on; each once, and none
  // longer than the horizon. verdict, given (LV11's), stops the search at the first route
  // that passes charge (b) at RUNNER_PASS_PCT: the routes kept so far, that one last.
  function candidates(state, M, verdict) {
    const m = state.dept, pen = new Float64Array(m.w * m.h), K = { M, out: [], keys: [], verdict: !!verdict, done: false };
    // The shortest first: when it is enough, nothing else need be priced.
    keepRoute(K, M.first);
    if (K.done) return K.out;
    M.ex.forEach(e => {
      if (e.lines) for (const [, mask] of e.lines) for (let q = 0; q < pen.length; q++) if (mask[q]) pen[q] = Math.max(pen[q], 100 * M.lineNet);
      // Waking it costs its fight and what its waking wakes; a tethered warden's fight, and the
      // ally_hit its being struck brings, only on its leash's tiles, where it strikes (held).
      const own = e.fights ? alone(termsOf(M, e), 'b') : 0;
      let ally = 0, call = 0;
      for (const [j, , why] of e.wakes) if (M.ex[j].fights) { const c = alone(termsOf(M, M.ex[j]), 'b'); if (why === 'ally_hit') ally += c; else call += c; }
      const k = e.leash ? call : own + ally + call, held = e.leash ? own + ally : 0;
      if (!k && !held) return;
      const per = Int.ceilDiv(k, Math.max(1, e.need));
      for (let q = 0; q < pen.length; q++) {
        if (held && e.leash[q]) pen[q] += held;
        if (!k) continue;
        if ((e.sight && e.sight[q]) || (e.tether && e.tether[q])) pen[q] += k;
        else if ((e.ring && e.ring[q]) || (e.axis && e.axis[q])) pen[q] += per;
      }
    });
    for (const price of PRICES.concat([BLOCK])) if (!K.done && price !== 0) keepRoute(K, search(m, M.steps, pen, price, M.start));
    // Then the timed routes, unless a route found already costs nothing (none can cost less).
    if (K.done || K.out.some(r => cost(M, r).b === 0)) return K.out;
    for (const r of timed(m, M, pen, false, K)) keepRoute(K, r);
    // And, unless one of those costs nothing, those that keep off every priced tile.
    if (!K.done && !K.out.some(r => cost(M, r).b === 0)) for (const r of timed(m, M, pen, true, K)) keepRoute(K, r);
    return K.out;
  }
  // A route the search found, kept once (K.out), unless it is longer than the horizon or the
  // search is done; with K.verdict, the search is done once one passes charge (b) at
  // RUNNER_PASS_PCT.
  function keepRoute(K, r) {
    if (K.done || !r || r.length - 1 > K.M.horizon) return;
    const key = r.join(',');
    if (K.keys.includes(key)) return;
    K.keys.push(key); K.out.push(r);
    if (K.verdict && cost(K.M, r).b <= N.RUNNER_PASS_PCT * K.M.run.maxHp) K.done = true;
  }

  // The routes that keep out of every timed patrol's sight, waiting where they must (a careful
  // runner times a patrol): a search over (tile, turn) up to the horizon, each turn a wait or a
  // step onto a tile no route steps on (blocked), a closed door (as the map stands) taking a
  // turn more, to open it; never on a tile a timed patrol sees at that turn. Each turn's tile
  // pays its pen. It gives the soonest such route to an exit (least pen among those), and the
  // one of least pen (soonest among those); none when there is no timed patrol or no such
  // route. Ties go to the lower tile index and to waiting, then compass order, so it draws
  // nothing.
  function timed(m, M, pen, avoid, K) {
    const pats = M.ex.filter(e => e.turns), lines = M.ex.filter(e => e.lines && e.lines.length);
    if (!pats.length && !lines.length) return [];
    // INF is read once: a global's every read is slow in a context of its own (the tools').
    const n = m.w * m.h, w = m.w, L = M.horizon, INF = Infinity;
    const T = { pats, lines, layers: [], n, lists: M.lists || new Map() };
    const exit = new Uint8Array(n);
    for (const [x, y] of m.exits) exit[y * w + x] = 1;
    const s = M.start;
    if (seenAt(T, 0)[s]) return [];
    // Each tile's steps (the model's: from[k] to from[k + 1] in to and how, d or 10 + d onto a
    // closed door); keeping off the priced tiles, none onto one.
    const { from, to, how } = M.steps;
    const par = new Uint8Array(n * (L + 1));
    // Three layers kept, turn i's (cur), i + 1's (nxt) and i + 2's (after): each tile's value
    // (INF where none) and the list of the tiles holding one; turned round each turn.
    let cur = new Float64Array(n).fill(INF), nxt = new Float64Array(n).fill(INF), after = new Float64Array(n).fill(INF);
    let curL = new Int32Array(n), nxtL = new Int32Array(n), afterL = new Int32Array(n), curN = 1, nxtN = 0, afterN = 0;
    cur[s] = pen[s]; curL[0] = s;
    let first = null, least = null, work = 0;
    for (let i = 0; i <= L && curN && work <= TIMED_WORK; i++) {
      if (i + 2 <= L) { for (let j = 0; j < afterN; j++) after[afterL[j]] = INF; afterN = 0; }
      const s1 = i + 1 <= L ? seenAt(T, i + 1) : null, s2 = i + 2 <= L ? seenAt(T, i + 2) : null, pb = (i + 1) * n, pc = (i + 2) * n;
      let fk = -1, fv = INF;
      for (let j = 0; j < curN; j++) {
        const k = curL[j], v = cur[k];
        if (exit[k]) {
          if (!first && v < fv) { fk = k; fv = v; }
          if (!least || v < least.v) least = { i, k, v };
          continue;
        }
        // Values only grow along a way (pen ≥ 0), so once an exit is reached at least at v, a
        // state at v or more can bring neither a sooner exit nor a cheaper one.
        if (!s1 || (least && v >= least.v)) continue;
        if (!s1[k]) { const u = v + pen[k]; if (u < nxt[k]) { if (nxt[k] === INF) nxtL[nxtN++] = k; nxt[k] = u; par[pb + k] = 9; } }
        work += from[k + 1] - from[k] + 1;
        for (let e = from[k]; e < from[k + 1]; e++) {
          const q = to[e], code = how[e];
          if (avoid && pen[q] > 0) continue;
          if (code >= 10) {
            if (!s2 || s1[k] || s2[q]) continue;
            const u = v + pen[k] + pen[q];
            if (u < after[q]) { if (after[q] === INF) afterL[afterN++] = q; after[q] = u; par[pc + q] = code + 1; }
          } else if (!s1[q]) {
            const u = v + pen[q];
            if (u < nxt[q]) { if (nxt[q] === INF) nxtL[nxtN++] = q; nxt[q] = u; par[pb + q] = code + 1; }
          }
        }
      }
      if (fk >= 0) {
        first = { i, k: fk, v: fv };
        // LV11's verdict: the soonest route, kept at once, may already be enough.
        if (K && K.verdict) { keepRoute(K, traceBack(par, n, w, i, fk)); if (K.done) return []; }
      }
      if (least && least.v === 0) break;
      // Turned round: turn i's layer, cleared by its list at the next turn, becomes i + 3's.
      const v0 = cur, l0 = curL, n0 = curN;
      cur = nxt; curL = nxtL; curN = nxtN;
      nxt = after; nxtL = afterL; nxtN = afterN;
      after = v0; afterL = l0; afterN = n0;
    }
    const out = [];
    if (first) out.push(traceBack(par, n, w, first.i, first.k));
    if (least && (!first || least.i !== first.i || least.k !== first.k)) out.push(traceBack(par, n, w, least.i, least.k));
    return out;
  }
  // The tiles some timed patrol sees at turn i (past its timeline, everything it could), or a
  // station's line could take as it goes off then: T.layers[i], made once.
  function seenAt(T, i) {
    if (T.layers[i]) return T.layers[i];
    const k = new Uint8Array(T.n);
    for (const e of T.pats) for (const mask of i < e.turns.length ? e.turns[i] : [e.sight]) for (const q of tilesOf(T, mask)) k[q] = 1;
    for (const e of T.lines) for (const [j, mask] of e.lines) if (j === i) for (const q of tilesOf(T, mask)) k[q] = 1;
    return (T.layers[i] = k);
  }
  function tilesOf(T, mask) {
    if (!T.lists.has(mask)) { const t = []; for (let q = 0; q < T.n; q++) if (mask[q]) t.push(q); T.lists.set(mask, t); }
    return T.lists.get(mask);
  }
  // The route to tile k at turn i, from the timed search's parents: its tiles, the entrance
  // first (a wait repeats a tile; a closed door, opened, two turns on one tile).
  function traceBack(par, n, w, i, k) {
    const out = [k];
    for (let ci = i, ck = k; ci > 0;) {
      const c = par[ci * n + ck] - 1;
      if (c === 8) { out.push(ck); ci--; }
      else if (c < 8) { ck -= Grid.DX[c] + Grid.DY[c] * w; out.push(ck); ci--; }
      else { ck -= Grid.DX[c - 10] + Grid.DY[c - 10] * w; out.push(ck, ck); ci -= 2; }
    }
    return out.reverse();
  }

  // LRunner.measure(state, opts?) → the runner's report on a department: {none} as model gives
  // it, or {hp, grade, short, horizon, routes, best: {a, b, c}}, best[how] the cheapest route
  // tried under that charge (LRunner.cost's record), hp the runner's health. A charge passes at
  // pct% when best[how][how] ≤ pct × hp (LRunner.passes).
  const measure = (state, opts) => judge(state, opts).rep;
  // The report with the model it was read from. verdict, given (LV11's), stops the search at
  // the first route that passes charge (b) at RUNNER_PASS_PCT: the verdict is the full
  // report's (a route that passes is never cheaper than the cheapest), and a department that
  // fails has had every route tried, as the full report has.
  function judge(state, opts, verdict) {
    const M = model(state, opts);
    if (M.none) return { M, rep: { none: M.none } };
    const tried = candidates(state, M, verdict).map(r => cost(M, r)), best = {};
    for (const how of CHARGES) for (const c of tried) if (!best[how] || c[how] < best[how][how]) best[how] = c;
    return { M, rep: { hp: M.run.maxHp, grade: M.run.grade, short: M.short, horizon: M.horizon, routes: tried.length, best } };
  }
  // LRunner.passes(report, how, pct) → bool: does the cheapest route under charge how cost at
  // most pct% of the runner's health? (No route never passes.)
  const passes = (rep, how, pct) => !rep.none && rep.best[how][how] <= pct * rep.hp;

  // ---- LV11: the validator, and its moves (D-RUNNER; layout.md §9.2, §10.1; plan D2.3) ----
  //
  // LRunner.check(state, plan, log?) → null, or {reason, tiles}: LV11 under charge (b) at
  // RUNNER_PASS_PCT (Q2). A department the runner passes is accepted as it stands. One it
  // fails is repaired, as layout.md §9.2 says ("move the costliest enemy on the cheapest route
  // into an adjacent alcove or off the walkway, then retest"), by at most RUNNER_MOVES moves,
  // each of another exhibit, never a removal:
  //   - the exhibit moved is the costliest the cheapest route wakes by itself (its ring, its
  //     axis or its tether, not a waking's chain or a patrol's sight): what it costs fought
  //     alone under (b), and what its waking wakes in turn (LRunner.blame), that a move may
  //     take (movable: asleep, on the floor, one tile, and neither a station on its line, a
  //     swarm's body, a warden whose nest is a case, a Centrepiece's piece, nor in the hall or
  //     the Intro, whose placement their own rules fix);
  //   - it goes to the nearest tile of its own room (walking from where it stood; row-major
  //     on a tie) where population could have put it and where the route that woke it would
  //     not (LRunner.spots): floor, beyond the safe zone, off the Centrepiece's footprint and
  //     the reading tile's ring (Populate's rules), no actor or item on it, no exhibit beside
  //     it, never where a patrol walks or a station's line could run, out of call of every
  //     exhibit for a herald its gallery keeps apart; and where none of its ring, its axis or
  //     its tether (a warden guarding its own tile takes it along) holds a tile of that route;
  //     one that LV6, which judged the department before it, would now reject is passed over;
  //   - the runner is asked again; once it passes, each move is logged as a sentence
  //     ({check: 'LV11', room, op}) and the department is accepted. If it still fails after
  //     the last move, every move is undone and the attempt is rejected, which reseeds.
  // The department is judged as it is made with every module on and nothing left out
  // (Populate.asMade): a switch (rulesOff) or an exhibit left out (without) must not change
  // which attempt is taken, or where anything stands (M4 plan A10: population is the same
  // under any switch, so paired runs share rooms); the moves made there are made here too. A state that
  // is no department (a room for tests) has nothing to check. The moves draw on no stream
  // (D2.3: "the runner's moves draw nothing").
  function check(state, plan, log) {
    const v = Populate.asMade(state), r = verdict(v, plan);
    if (r === null) return null;
    if (r.reason) return { reason: r.reason, tiles: r.tiles };
    if (v !== state) for (const mv of r.moves) put(Object.assign({}, mv, { a: Actors.byUid(state, mv.a.uid) }), mv.to);
    if (log) for (const mv of r.moves) log.push({ check: 'LV11', room: mv.room, op: mv.op });
    return null;
  }
  // LV11 on department v, moving what it must: null when it passes as it stands; {moves} when
  // the moves (made on v) make it pass; {reason, tiles} when it fails, every move undone.
  function verdict(v, plan) {
    let got = judge(v, null, true);
    const first = got.rep;
    if (first.none === 'not a department') return null;
    if (first.none) return { reason: `the worst-case runner finds ${first.none}`, tiles: [v.dept.entrance.slice()] };
    if (passes(first, 'b', N.RUNNER_PASS_PCT)) return null;
    const moves = [];
    while (moves.length < N.RUNNER_MOVES) {
      const mv = move(v, plan, got, moves);
      if (!mv) break;
      moves.push(mv);
      got = judge(v, null, true);
      if (passes(got.rep, 'b', N.RUNNER_PASS_PCT)) return { moves };
    }
    for (let i = moves.length - 1; i >= 0; i--) undo(moves[i]);
    const b = first.best.b, m = v.dept, tried = moves.length ? `; ${moves.map(q => q.tried).join(', then ')}, it still costs ${hp(got.rep.none ? 0 : got.rep.best.b.b)}` : '';
    return { reason: `the worst-case runner's cheapest route costs ${hp(b.b)} of its ${first.hp} HP (at most ${Int.idiv(N.RUNNER_PASS_PCT * first.hp, 100)}, ${N.RUNNER_PASS_PCT}%): ${why(v, b)}${tried}`,
      tiles: b.route.map(k => [k % m.w, Int.idiv(k, m.w)]) };
  }
  const hp = x => Int.ceilDiv(x, 100);

  // LRunner.movable(state, a) → may a move take exhibit a (above)?
  function movable(state, a) {
    const m = state.dept, rm = m.rooms.find(r => r.id === roomOf(m, a.x, a.y));
    if (!rm || rm.role === 'centre' || rm.role === 'intro' || a.uid === 'you' || a.gone || a.mode !== 'dormant') return false;
    if ((a.size || 1) !== 1 || Archetypes.pipless(state, a) || Cases.encased(state, a) || Actors.centrepiece(a)) return false;
    if (a.arch === 'mote_swarm' || HourlyDemonstration.isStation(state, a)) return false;
    if (Array.isArray(a.guards) && (a.guards[0] !== a.x || a.guards[1] !== a.y)) return false;
    return Grid.ch(m, a.x, a.y) === '.';
  }
  // LRunner.blame(M, j, fights?) → what waking M.ex[j] costs, in hundredths of a hit point: its
  // charge (b) fought alone, if it fights (fights, given: whether it fights on the route at
  // hand, which a tethered warden the route never reaches within its tether does not), and that
  // of each sleeper its waking wakes in turn (by ally_hit only if it is fought).
  function blame(M, j, fights) {
    const e = M.ex[j], f = fights === undefined ? e.fights : fights;
    let k = f ? alone(termsOf(M, e), 'b') : 0;
    for (const [i, , why] of e.wakes) if (M.ex[i].fights && (f || why !== 'ally_hit')) k += alone(termsOf(M, M.ex[i]), 'b');
    return k;
  }
  const DIRECT = ['ring', 'axis', 'tether'];
  // One move (above) on the department as judged (got: {M, rep}), none of the exhibits already
  // moved (done) taken again: the move made, {a, from, to, home, guards, room, op, tried}, or
  // null when no exhibit the route wakes by itself can be moved anywhere.
  function move(state, plan, got, done) {
    const { M, rep } = got, b = rep.best.b, m = state.dept;
    // An exhibit awake on no told walk could walk anywhere, a moved one's tile included.
    if (M.ex.some(e => e.a.mode !== 'dormant' && !e.turns && !Cases.encased(state, e.a))) return null;
    const list = [];
    for (const w of b.woken) {
      if (!DIRECT.includes(w.how)) continue;
      const j = M.ex.findIndex(e => e.a.uid === w.uid), a = M.ex[j].a;
      if (done.some(v => v.a === a) || !movable(state, a)) continue;
      const k = blame(M, j, w.fights);
      if (k > 0) list.push({ j, a, w, k });
    }
    list.sort((p, q) => (q.k - p.k) || (p.w.turn - q.w.turn) || (M.ex[p.j].i - M.ex[q.j].i));
    for (const c of list) {
      const from = [c.a.x, c.a.y], home = c.a.home ? c.a.home.slice() : null, guards = c.a.guards ? c.a.guards.slice() : null;
      for (const to of spots(state, plan, M, c.a, b.route)) {
        const mv = { a: c.a, from, to, home, guards, room: roomOf(m, from[0], from[1]) };
        put(mv, to);
        if (!clear(state, c.a, b.route) || (typeof LV6 !== 'undefined' && LV6.check(state, plan))) { undo(mv); continue; }
        const who = name(state, c.a), as = who.includes(',') ? `${who},` : who, where = galleryName(state, mv.room);
        // A tethered warden woken otherwise costs only once the way comes within its tether.
        const said = WAKE[c.w.how](M.ex[c.j].need) + (c.w.fights && M.ex[c.j].leash && c.w.how !== 'tether' ? `, and came within ${N.TETHER_RANGE} tiles of what it guards, where it strikes` : '');
        mv.op = `moved ${as} from ${from[0]},${from[1]} to ${to[0]},${to[1]}${where ? `, in ${where}` : ''}: the worst-case runner's way ${said}; from ${to[0]},${to[1]} it passes clear of it`;
        mv.tried = `with ${as} moved from ${from[0]},${from[1]} to ${to[0]},${to[1]}`;
        return mv;
      }
    }
    return null;
  }
  // Exhibit a set on tile t (its home and, a warden guarding its own tile, what it guards with
  // it), or back where the move found it.
  function put(mv, t) {
    const a = mv.a;
    a.x = t[0]; a.y = t[1];
    if (mv.home && mv.home[0] === mv.from[0] && mv.home[1] === mv.from[1]) a.home = t.slice();
    if (mv.guards) a.guards = t.slice();
  }
  function undo(mv) {
    const a = mv.a;
    a.x = mv.from[0]; a.y = mv.from[1];
    a.home = mv.home ? mv.home.slice() : null;
    if (mv.guards) a.guards = mv.guards.slice();
  }
  // How the route would wake it, in words a player would take.
  const WAKE = {
    ring: need => `passed within ${N.RING_MOVING} walking tiles of it, in its sight, for ${need} turn${need === 1 ? '' : 's'}, which wakes it`,
    axis: () => `crossed its row or column within ${N.AXIS_RANGE} tiles, in its sight, which wakes it`,
    tether: () => `came within ${N.TETHER_RANGE} tiles of what it guards, which wakes it at once`,
  };
  const name = (state, a) => (a && Labels.nameOf(state)(a.uid)) || 'an exhibit';
  // A room's gallery by name, as a sentence says it ("the Brooders’ Bay").
  const galleryName = (state, id) => { const g = Populate.galleryOf(state, id); return g && g.name ? g.name.replace(/^The /, 'the ') : null; };

  // LRunner.spots(state, plan, M, a, route) → the tiles a move may take exhibit a to, nearest
  // first (above), before its ring, axis and tether are read there (clear): [[x, y]…]. plan,
  // given, holds the Centrepiece's footprint ('C'); the reading tile is the department's.
  function spots(state, plan, M, a, route) {
    const m = state.dept, w = m.w, n = m.w * m.h, id = roomOf(m, a.x, a.y);
    const reach = Grid.distances(m, [m.entrance], n), view = m.viewTile ? Grid.distances(m, [m.viewTile], N.RING_STILL + 1) : null;
    const near = Grid.distances(m, [[a.x, a.y]], n), on = new Uint8Array(n), shut = new Uint8Array(n);
    for (const k of route) on[k] = 1;
    // Where a patrol walks (its timeline), and where a station's line could run.
    for (const e of M.ex) {
      if (e.walk) for (const k of e.walk) shut[k] = 1;
      if (HourlyDemonstration.isStation(state, e.a)) for (const [x, y] of HourlyDemonstration.reach(state, e.a)) shut[y * w + x] = 1;
    }
    const others = state.actors.filter(b => b !== a && !b.gone);
    const apart = Populate.galleriesOf(state, id).some(g => g.contents.some(c => c.sp === a.sp && c.apart));
    const free = (x, y) => !others.some(b => Actors.covers(b, x, y)) && !state.items.some(it => it.where && it.where.at === 'floor' && it.where.x === x && it.where.y === y);
    const spaced = (x, y) => !others.some(b => b.uid !== 'you' && Actors.footprint(b).some(([u, v]) => Grid.chebyshev(u, v, x, y) <= 1));
    const outOfCall = (x, y) => !others.some(b => b.uid !== 'you' && Actors.footprint(b).some(([u, v]) => Grid.disc(u - x, v - y, N.HERALD_RANGE)));
    const list = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (roomOf(m, x, y) !== id || (x === a.x && y === a.y) || Grid.ch(m, x, y) !== '.' || shut[k] || on[k] || near[k] < 0) continue;
      if (plan && plan.tiles && plan.tiles[y][x] === 'C') continue;
      const d = Grid.reachDist(reach, m, x, y);
      if (d < 0 || d <= N.SAFE_ZONE) continue;
      if (view) { const v = Grid.reachDist(view, m, x, y); if (v >= 0 && v <= N.RING_STILL + 1) continue; }
      if (!free(x, y) || !spaced(x, y) || (apart && !outOfCall(x, y))) continue;
      list.push([near[k], k]);
    }
    list.sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
    return list.map(([, k]) => [k % w, Int.idiv(k, w)]);
  }
  // Is exhibit a, where it stands, clear of the route: none of its ring, its axis or its tether
  // (a tethered warden's leash, whatever its trigger) holds a tile of it, with every ordinary
  // door open, as the model reads them?
  function clear(state, a, route) {
    const vm = opened(state), on = new Set(route);
    for (const [u, v] of Archetypes.wakeRegion(vm, a, N.PIPS_TO_WAKE)) if (on.has(v * vm.dept.w + u)) return false;
    if (a.trigger === 'axis') { const ax = axisMask(vm.dept, a); for (const q of route) if (ax[q]) return false; }
    if ((a.trigger === 'tether' && a.guards) || leashed(a)) { const t = tetherMask(vm.dept, a); for (const q of route) if (t[q]) return false; }
    return true;
  }

  // In words a player would take: what starts the route's costliest fight, and how many more
  // join it; or the line that strikes it.
  const HOW = { ring: 'wakes as it passes', axis: 'wakes as it crosses its axis', tether: 'wakes as it nears what it guards', sight: 'sees it',
    alarm: 'wakes at the alarm', herald: 'wakes at a herald\'s call', ally_hit: 'wakes as one of its group is struck' };
  function why(state, b) {
    const who = uid => name(state, state.actors.find(x => x.uid === uid));
    let worst = null;
    for (const f of b.fights) if (!worst || f.b > worst.b) worst = f;
    if (!worst) return b.lines.length ? `the line of ${who(b.lines[0].uid)} strikes it at turn ${b.lines[0].turn}` : 'nothing it fights';
    const first = b.woken.find(w => w.uid === worst.uids[0]) || b.woken[0], more = worst.uids.length - 1;
    // A tethered warden woken before the route comes within its tether fights only from then.
    const later = first.at !== null && first.at !== undefined && first.at > first.turn ? `, and strikes once the runner comes within ${N.TETHER_RANGE} tiles of what it guards, at turn ${first.at}` : '';
    return `${who(first.uid)} ${HOW[first.how] || 'wakes'} at turn ${first.turn}${later}` + (more ? `, and ${more} more join the fight` : '');
  }

  // Registered through the namespace, so that a test may stand in for it (LRunner.check); after
  // LV6 and the treasure case (load order), before LV7 and LV13.
  Populate.addValidator('lv11', (state, plan, log) => LRunner.check(state, plan, log));

  return { CHARGES, APPROACH, HORIZON, runner, terms, alone, fight, model, wakes, cost, measure, passes, check, candidates, timed, movable, blame, spots };
})();
