// ACCESSION — LV11, the worst-case runner (design/layout.md §9.2; M4 plan D2.3, Q2; BUILD.md §5.5,
// §10.3): a route from the entrance to an exit, the exhibits it would wake, and what they would
// cost a runner of the median visitor less one Certificate. It passes at RUNNER_PASS_PCT of the
// runner's health. D-RUNNER-EST built it in report mode: nothing registers it as a validator,
// so it changes no department, and tools/runner-sweep.js measures it. D-RUNNER registers it
// with Populate.addValidator('lv11', …) from here and adds its RUNNER_MOVES logged moves.
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
// exhibit's walk after it wakes; an exhibit in an intact case wakes but cannot strike you.
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
// and more for the tiles of wake regions (each tile costing what waking there would wake);
// so a pass found is a route that exists, and a failure may miss a cheaper one.
//
// It draws on no stream and changes nothing in the state.
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
    const bare = Object.assign({}, vm, { surfaces: [] }), r = N.SIGHT_EXHIBIT, made = new Map();
    // You could stand there: walkable, not a closed door (read once per tile).
    const { disc, los } = Grid, stand = new Uint8Array(vm.w * vm.h);
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) if (Grid.walkable(vm, x, y) && !Grid.closedDoor(vm, x, y)) stand[y * vm.w + x] = 1;
    return (fx, fy) => {
      const key = fy * vm.w + fx;
      if (made.has(key)) return made.get(key);
      const k = new Uint8Array(vm.w * vm.h);
      for (let y = Math.max(0, fy - r); y <= Math.min(vm.h - 1, fy + r); y++) for (let x = Math.max(0, fx - r); x <= Math.min(vm.w - 1, fx + r); x++)
        if (stand[y * vm.w + x] && disc(x - fx, y - fy, r) && los(bare, fx, fy, x, y)) k[y * vm.w + x] = 1;
      made.set(key, k);
      return k;
    };
  }
  const near = (a, b, r) => Actors.footprint(a).some(([x, y]) => Actors.footprint(b).some(([u, v]) => Grid.disc(x - u, y - v, r)));
  const sleeps = (state, b) => b.mode === 'dormant' && !Archetypes.pipless(state, b);

  // LRunner.model(state, opts?) → what the route search and every route's charge read, or
  // {none: why} when the state is no department (no entrance, exits or rooms) or no route
  // reaches an exit. opts, for measurement: {runner: 'hp'} (above); {doors: 'shut'}, wake
  // regions with the doors as they stand; {chain: 'off'}, no waking wakes another (D2.3's list:
  // the ring and the wake regions only). Fields: run (the runner), blocked (the tiles no route
  // steps on), short (the shortest route's turns), horizon, and ex, one record per exhibit
  // that counts: {a, i, t (its terms), fights (not in a case), need, ring, axis, tether, sight
  // (masks of tile indices), wakes: [[j, delay, why]] (the sleepers its waking wakes)}.
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
    const you = state.actors[0], start = you.y * m.w + you.x;
    const short = shortest(m, blocked, start);
    if (short < 0) return { none: 'no route reaches an exit without the hall, a staff door or an exhibit that stands still' };
    const run = runner(state, opts), horizon = HORIZON * short, view = opts && opts.doors === 'shut' ? state : opened(state), vm = view.dept;
    // The patrols' timeline (Patrol.timeline), unless it cannot be told or is switched off.
    const told = opts && opts.timing === 'off' ? null : Patrol.timeline(state, horizon), walked = new Map();
    if (told) for (const p of told) walked.set(p.uid, p.at);
    const sightOf = sighted(state, vm);
    const ex = [];
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || Archetypes.pipless(state, a) || roomOf(m, a.x, a.y) === intro) continue;
      const e = { a, i, t: Object.assign(terms(state, a, run), { i, sp: a.sp }), fights: !Cases.encased(state, a), need: 0, ring: null, axis: null, tether: null, sight: null, wakes: [] };
      if (a.mode === 'dormant') {
        e.need = Math.max(1, N.PIPS_TO_WAKE - (a.pips || 0));
        e.ring = maskOf(vm, Archetypes.wakeRegion(view, a, N.PIPS_TO_WAKE));
        if (a.trigger === 'axis') e.axis = axisMask(vm, a);
        if (a.trigger === 'tether' && Array.isArray(a.guards)) e.tether = tetherMask(vm, a);
      } else if (walked.has(a.uid)) {
        // A patrol whose walk is told: what it sees at each of its actions (AI.look, before it
        // moves), by the runner's turn: an action in the ticks of turn i comes after the
        // runner's i-th move (ties go to you), so it sees the route's tile i + 1.
        e.turns = [];
        for (const p of walked.get(a.uid)) {
          const i = Int.idiv(p.t - state.tick, N.TICKS_PER_TURN) + 1;
          while (e.turns.length <= i) e.turns.push([]);
          const k = sightOf(p.x, p.y);
          if (!e.turns[i].includes(k)) e.turns[i].push(k);
        }
        // Everything it could see on its round: after a fight starts, and past its timeline.
        e.sight = new Uint8Array(m.w * m.h);
        for (const list of e.turns) for (const k of list) for (let q = 0; q < k.length; q++) if (k[q]) e.sight[q] = 1;
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
    return { run, blocked, start, short, horizon, ex, lineNet };
  }

  // The number of steps of the shortest route from the entrance to an exit, or -1.
  function shortest(m, blocked, start) {
    const p = search(m, blocked, null, 0, start);
    return p ? p.length - 1 : -1;
  }

  // ---- The route ----

  // A cheapest walk (Dijkstra, 100 a step and price × pen[k] for entering tile k, never a
  // blocked tile, nor a priced tile when price is BLOCK) from the entrance to an exit: its tile
  // indices, the entrance first, or null. Ties go to the lower tile index, so it draws nothing.
  function search(m, blocked, pen, price, start) {
    const n = m.w * m.h, dist = new Float64Array(n).fill(-1), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const exit = new Uint8Array(n);
    for (const [x, y] of m.exits) exit[y * m.w + x] = 1;
    const s = start;
    const heap = [];
    const less = (i, j) => heap[i][0] < heap[j][0] || (heap[i][0] === heap[j][0] && heap[i][1] < heap[j][1]);
    const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; const t = heap[i]; heap[i] = heap[p]; heap[p] = t; i = p; } };
    const pop = () => {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let b = i; if (l < heap.length && less(l, b)) b = l; if (r < heap.length && less(r, b)) b = r; if (b === i) break; const t = heap[i]; heap[i] = heap[b]; heap[b] = t; i = b; }
      }
      return first;
    };
    dist[s] = 0; push(0, s);
    while (heap.length) {
      const [d, k] = pop();
      if (done[k]) continue;
      done[k] = 1;
      if (exit[k]) {
        // Its tiles, the entrance first, with a turn more before each closed door (as the map
        // stands) to open it: a step into one opens it and leaves you where you were.
        const out = [];
        for (let q = k; q >= 0; q = prev[q]) { out.push(q); if (prev[q] >= 0 && Grid.ch(m, q % m.w, Int.idiv(q, m.w)) === '+') out.push(prev[q]); }
        return out.reverse();
      }
      const x = k % m.w, y = Int.idiv(k, m.w);
      for (let dir = 0; dir < 8; dir++) {
        if (!Grid.canStep(m, x, y, dir)) continue;
        const q = (y + Grid.DY[dir]) * m.w + x + Grid.DX[dir];
        if (blocked[q] || done[q]) continue;
        if (pen && pen[q] && price === BLOCK) continue;
        const nd = d + 100 + (pen && price > 0 ? price * pen[q] : 0);
        if (dist[q] < 0 || nd < dist[q]) { dist[q] = nd; prev[q] = k; push(nd, q); }
      }
    }
    return null;
  }

  // What a route wakes, and when: wake[j] the turn exhibit ex[j] wakes (-1: never), how[j] why
  // (ring, axis, tether, sight, alarm, herald, ally_hit).
  // Does a timed patrol see the route's tile k at turn i (past its timeline, anything it could)?
  const seesAt = (e, i, k) => i < e.turns.length ? e.turns[i].some(mask => mask[k] === 1) : e.sight[k] === 1;
  function wakes(M, route) {
    const n = M.ex.length, T = new Array(n).fill(-1), how = new Array(n).fill(null);
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
    // Each waking's own wakings, earliest first. Once the runner has a fight, it keeps to no
    // timetable: from then on a timed patrol finds it wherever it could see it on its round.
    const done = new Uint8Array(n);
    let fought = false;
    for (;;) {
      let b = -1;
      for (let j = 0; j < n; j++) if (!done[j] && T[j] >= 0 && (b < 0 || T[j] < T[b])) b = j;
      if (b < 0) break;
      done[b] = 1;
      if (!fought && M.ex[b].fights) {
        fought = true;
        M.ex.forEach((e, j) => {
          if (done[j] || !e.turns) return;
          for (let i = T[b]; i < route.length && (T[j] < 0 || i < T[j]); i++) if (e.sight[route[i]]) { T[j] = i; how[j] = 'sight'; return; }
        });
      }
      for (const [j, delay, why] of M.ex[b].wakes) if (!done[j] && (T[j] < 0 || T[b] + delay < T[j])) { T[j] = T[b] + delay; how[j] = why; }
    }
    return { T, how };
  }

  // LRunner.cost(M, route) → {route, length, woken: [{uid, sp, turn, how, fights}], fights: [{turn,
  // uids, sps, a, b, c}], a, b, c}: what the route wakes, its fights (exhibits not in a case, woken
  // within RUNNER_TOGETHER_TURNS of the one before, in the order they wake), and each charge.
  function cost(M, route) {
    const { T, how } = wakes(M, route), woken = [];
    M.ex.forEach((e, j) => { if (T[j] >= 0) woken.push({ j, uid: e.a.uid, sp: e.a.sp, turn: T[j], how: how[j], fights: e.fights }); });
    woken.sort((p, q) => (p.turn - q.turn) || (M.ex[p.j].i - M.ex[q.j].i));
    const fights = [];
    for (const w of woken) {
      if (!w.fights) continue;
      const last = fights[fights.length - 1];
      if (last && w.turn - last.end <= N.RUNNER_TOGETHER_TURNS) { last.list.push(M.ex[w.j].t); last.end = w.turn; }
      else fights.push({ turn: w.turn, end: w.turn, list: [M.ex[w.j].t] });
    }
    const out = { route, length: route.length - 1, woken: woken.map(w => ({ uid: w.uid, sp: w.sp, turn: w.turn, how: w.how, fights: w.fights })), fights: [], lines: [] };
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
  // longer than the horizon.
  function candidates(state, M) {
    const m = state.dept, pen = new Float64Array(m.w * m.h);
    M.ex.forEach(e => {
      if (e.lines) for (const [, mask] of e.lines) for (let q = 0; q < pen.length; q++) if (mask[q]) pen[q] = Math.max(pen[q], 100 * M.lineNet);
      let k = e.fights ? alone(e.t, 'b') : 0;
      for (const [j] of e.wakes) if (M.ex[j].fights) k += alone(M.ex[j].t, 'b');
      if (!k) return;
      const per = Int.ceilDiv(k, Math.max(1, e.need));
      for (let q = 0; q < pen.length; q++) {
        if ((e.sight && e.sight[q]) || (e.tether && e.tether[q])) pen[q] += k;
        else if ((e.ring && e.ring[q]) || (e.axis && e.axis[q])) pen[q] += per;
      }
    });
    const out = [], seen = [];
    const keep = r => { if (!r || r.length - 1 > M.horizon) return; const key = r.join(','); if (seen.includes(key)) return; seen.push(key); out.push(r); };
    for (const price of PRICES.concat([BLOCK])) keep(search(m, M.blocked, pen, price, M.start));
    // Then the timed routes, unless a route found already costs nothing (none can cost less).
    if (out.some(r => cost(M, r).b === 0)) return out;
    for (const r of timed(m, M, pen, false)) keep(r);
    for (const r of timed(m, M, pen, true)) keep(r);
    return out;
  }

  // The routes that keep out of every timed patrol's sight, waiting where they must (a careful
  // runner times a patrol): a search over (tile, turn) up to the horizon, each turn a wait or a
  // step onto a tile no route steps on (blocked), a closed door (as the map stands) taking a
  // turn more, to open it; never on a tile a timed patrol sees at that turn. Each turn's tile
  // pays its pen. It gives the soonest such route to an exit (least pen among those), and the
  // one of least pen (soonest among those); none when there is no timed patrol or no such
  // route. Ties go to the lower tile index and to waiting, then compass order, so it draws
  // nothing.
  function timed(m, M, pen, avoid) {
    const pats = M.ex.filter(e => e.turns), lines = M.ex.filter(e => e.lines && e.lines.length);
    if (!pats.length && !lines.length) return [];
    // INF is read once: a global's every read is slow in a context of its own (the tools').
    const n = m.w * m.h, w = m.w, L = M.horizon, layers = [], INF = Infinity;
    // The tiles some timed patrol sees at turn i (past its timeline, everything it could).
    const tilesOf = new Map(), listOf = mask => {
      if (!tilesOf.has(mask)) { const t = []; for (let q = 0; q < n; q++) if (mask[q]) t.push(q); tilesOf.set(mask, t); }
      return tilesOf.get(mask);
    };
    const seen = i => {
      if (layers[i]) return layers[i];
      const k = new Uint8Array(n);
      for (const e of pats) for (const mask of i < e.turns.length ? e.turns[i] : [e.sight]) for (const q of listOf(mask)) k[q] = 1;
      for (const e of lines) for (const [j, mask] of e.lines) if (j === i) for (const q of listOf(mask)) k[q] = 1;
      return (layers[i] = k);
    };
    const exit = new Uint8Array(n);
    for (const [x, y] of m.exits) exit[y * w + x] = 1;
    const s = M.start;
    if (seen(0)[s]) return [];
    // Each tile's steps, once: from[k] to from[k + 1] in to and how (d, or 10 + d onto a closed
    // door).
    const from = new Int32Array(n + 1), to = new Int32Array(8 * n), how = new Uint8Array(8 * n);
    let e0 = 0;
    for (let k = 0; k < n; k++) {
      from[k] = e0;
      if (M.blocked[k]) continue;
      const x = k % w, y = Int.idiv(k, w);
      for (let d = 0; d < 8; d++) {
        if (!Grid.canStep(m, x, y, d)) continue;
        const qx = x + Grid.DX[d], qy = y + Grid.DY[d], q = qy * w + qx;
        if (!M.blocked[q] && !(avoid && pen[q] > 0)) { to[e0] = q; how[e0] = Grid.ch(m, qx, qy) === '+' ? 10 + d : d; e0++; }
      }
    }
    from[n] = e0;
    const val = [0, 1, 2].map(() => new Float64Array(n).fill(INF)), par = new Uint8Array(n * (L + 1));
    // The tiles holding a value in each of the three layers kept (Int32Array lists).
    const lists = [0, 1, 2].map(() => new Int32Array(n)), size = [0, 0, 0];
    val[0][s] = pen[s]; lists[0][0] = s; size[0] = 1;
    let first = null, least = null;
    for (let i = 0; i <= L && size[i % 3]; i++) {
      const a = i % 3, b = (i + 1) % 3, c = (i + 2) % 3, cur = val[a], nxt = val[b], after = val[c];
      if (i + 2 <= L) { for (let j = 0; j < size[c]; j++) after[lists[c][j]] = INF; size[c] = 0; }
      const s1 = i + 1 <= L ? seen(i + 1) : null, s2 = i + 2 <= L ? seen(i + 2) : null, live = lists[a].subarray(0, size[a]);
      const nl = lists[b], cl = lists[c], pb = (i + 1) * n, pc = (i + 2) * n;
      let firstHere = null;
      for (let j = 0; j < live.length; j++) {
        const k = live[j], v = cur[k];
        if (exit[k]) {
          if (!first && (!firstHere || v < firstHere.v)) firstHere = { i, k, v };
          if (!least || v < least.v) least = { i, k, v };
          continue;
        }
        if (!s1) continue;
        if (!s1[k]) { const u = v + pen[k]; if (u < nxt[k]) { if (nxt[k] === INF) nl[size[b]++] = k; nxt[k] = u; par[pb + k] = 9; } }
        for (let e = from[k]; e < from[k + 1]; e++) {
          const q = to[e], code = how[e];
          if (code >= 10) {
            if (!s2 || s1[k] || s2[q]) continue;
            const u = v + pen[k] + pen[q];
            if (u < after[q]) { if (after[q] === INF) cl[size[c]++] = q; after[q] = u; par[pc + q] = code + 1; }
          } else if (!s1[q]) {
            const u = v + pen[q];
            if (u < nxt[q]) { if (nxt[q] === INF) nl[size[b]++] = q; nxt[q] = u; par[pb + q] = code + 1; }
          }
        }
      }
      if (firstHere) first = firstHere;
      if (least && least.v === 0) break;
    }
    const back = ({ i, k }) => {
      const out = [k];
      for (let ci = i, ck = k; ci > 0;) {
        const c = par[ci * n + ck] - 1;
        if (c === 8) { out.push(ck); ci--; }
        else if (c < 8) { ck -= Grid.DX[c] + Grid.DY[c] * w; out.push(ck); ci--; }
        else { ck -= Grid.DX[c - 10] + Grid.DY[c - 10] * w; out.push(ck, ck); ci -= 2; }
      }
      return out.reverse();
    };
    const out = [];
    if (first) out.push(back(first));
    if (least && (!first || least.i !== first.i || least.k !== first.k)) out.push(back(least));
    return out;
  }

  // LRunner.measure(state, opts?) → the runner's report on a department: {none} as model gives
  // it, or {hp, grade, short, horizon, routes, best: {a, b, c}}, best[how] the cheapest route
  // tried under that charge (LRunner.cost's record), hp the runner's health. A charge passes at
  // pct% when best[how][how] ≤ pct × hp (LRunner.passes).
  function measure(state, opts) {
    const M = model(state, opts);
    if (M.none) return { none: M.none };
    const tried = candidates(state, M).map(r => cost(M, r)), best = {};
    for (const how of CHARGES) for (const c of tried) if (!best[how] || c[how] < best[how][how]) best[how] = c;
    return { hp: M.run.maxHp, grade: M.run.grade, short: M.short, horizon: M.horizon, routes: tried.length, best };
  }
  // LRunner.passes(report, how, pct) → bool: does the cheapest route under charge how cost at
  // most pct% of the runner's health? (No route never passes.)
  const passes = (rep, how, pct) => !rep.none && rep.best[how][how] <= pct * rep.hp;

  // LRunner.check(state, plan) → null, or {reason, tiles}: LV11 under charge (b) at
  // RUNNER_PASS_PCT (Q2), with the route that fails it. In report mode nothing calls it while a
  // department is made. A state that is no department (a room for tests) has nothing to check.
  function check(state, plan) {
    const rep = measure(state);
    if (rep.none === 'not a department') return null;
    if (rep.none) return { reason: `the worst-case runner finds ${rep.none}`, tiles: [state.dept.entrance.slice()] };
    if (passes(rep, 'b', N.RUNNER_PASS_PCT)) return null;
    const b = rep.best.b, m = state.dept, hp = x => Int.ceilDiv(x, 100);
    return { reason: `the worst-case runner's cheapest route costs ${hp(b.b)} of its ${rep.hp} HP (at most ${Int.idiv(N.RUNNER_PASS_PCT * rep.hp, 100)}, ${N.RUNNER_PASS_PCT}%)`,
      tiles: b.route.map(k => [k % m.w, Int.idiv(k, m.w)]) };
  }

  return { CHARGES, APPROACH, HORIZON, runner, terms, alone, fight, model, wakes, cost, measure, passes, check, candidates, timed };
})();
