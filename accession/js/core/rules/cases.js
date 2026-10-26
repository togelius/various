// ACCESSION — cases, glass, locks and staff doors (BUILD.md §8.3). W0e built the case
// fixture, its draws, the shard rule and the mimic's disguise; W1-CASES builds placement,
// opening, bashing, breaking, Solvent's dissolving, the touch, staff doors and what the
// view model and the labels read, on these.
//
// A case is a fixture in dept.fixtures:
//   { k: 'case', x, y, room, num, glass, lock, hits, st, loan, holds, mimic }
// room is its room's role key; num its accession number (null only for a mimic's case, its
// tell); glass 1–3 (Registry.GLASS: Plate, Laminated, Security); lock the grade it needs,
// 1–7; hits the bashes it has taken; st 'shut', 'open', 'broken', 'dissolved' or 'revealed';
// loan true when it is "on loan elsewhere" (a label with no object); holds an item uid or
// null; mimic the uid of the mimic it is, or null.
// A staff door is a fixture { k: 'staff', x, y, grade }: the grade it needs to open.
//
// Which vitrines are cases: every `v` inside a room. A `v` in a wall's place (a glazed
// screen, which belongs to no room) is fixed glazing, with no fixture: you can see through
// it, never open or bash it, and a bump into it is refused as glass, as a case's is.
'use strict';
const Cases = (() => {
  // The fixture on (x, y), or null. Fixtures never share a tile.
  function at(state, x, y) {
    for (const f of (state.dept && state.dept.fixtures) || []) if (f.x === x && f.y === y) return f;
    return null;
  }
  // The case on (x, y) that is still intact (shut, on its `v`), or null.
  function intact(state, x, y) {
    const f = at(state, x, y);
    return f && f.k === 'case' && f.st === 'shut' && Grid.ch(state.dept, x, y) === 'v' ? f : null;
  }

  // Does a stand in an intact case? An exhibit on a `v` is encased (and so is a mimic in its
  // disguise): it cannot step out (Grid.canStep) or strike out, and nothing strikes in.
  const encased = (state, a) => Actors.footprint(a).some(([x, y]) => Grid.ch(state.dept, x, y) === 'v');

  // A case fixture with every field, plain data; rec gives x, y and any field to set.
  function make(rec) {
    const or = (k, v) => rec[k] !== undefined ? rec[k] : v;
    return { k: 'case', x: rec.x, y: rec.y, room: or('room', null), num: or('num', null), glass: or('glass', 1), lock: or('lock', 1),
      hits: or('hits', 0), st: or('st', 'shut'), loan: or('loan', false), holds: or('holds', null), mimic: or('mimic', null) };
  }

  // The lock range of a glass grade (§8.3's table): [GLASS_LOCK_MIN, GLASS_LOCK_MAX].
  const lockRange = glass => [N.GLASS_LOCK_MIN[glass - 1], N.GLASS_LOCK_MAX[glass - 1]];
  // The bashes a glass grade takes to break (GLASS_BASHES).
  const need = glass => N.GLASS_BASHES[glass - 1];

  // The draws that make a case (§8.3), from a stream (Rng.stream), in this order: its glass,
  // by depth's mix (GLASS_MIX_D1 … D6, depth 6's mix beyond); its lock; whether it is on loan
  // (one case in CASE_EMPTY_ONE_IN). Placement and the mimic's disguise both draw through
  // here, so a mimic's case is drawn exactly as a real one is.
  const drawGlass = (rng, depth) => 1 + rng.weighted(N['GLASS_MIX_D' + Math.min(6, Math.max(1, depth))]);
  // A lock is drawn uniformly from the overlap of the glass's range (GLASS_LOCK_MIN … MAX)
  // and I to depth + 1; if they do not overlap, it is the glass range's minimum, with no draw.
  // lockSpan gives the locks a case of that glass can have at that depth, [lowest, highest],
  // which the glass's clause states (its parameter lock:GLASS[i], Clauses.value), so a label
  // names only locks the department can hold.
  const lockCap = (glass, depth) => Math.min(N.GLASS_LOCK_MAX[glass - 1], depth + 1);
  function drawLock(rng, glass, depth) {
    const lo = N.GLASS_LOCK_MIN[glass - 1], hi = lockCap(glass, depth);
    return hi < lo ? lo : rng.int(lo, hi);
  }
  const lockSpan = (glass, depth) => { const lo = N.GLASS_LOCK_MIN[glass - 1]; return [lo, Math.max(lo, lockCap(glass, depth))]; };
  const drawLoan = rng => rng.int(1, N.CASE_EMPTY_ONE_IN) === 1;
  function draw(rng, depth) {
    const glass = drawGlass(rng, depth), lock = drawLock(rng, glass, depth), loan = drawLoan(rng);
    return { glass, lock, loan };
  }
  // A staff door's grade (§8.3: "drawn as locks are", D3.7): it has no glass range, so it is
  // uniform over I to depth + 1, never above GRADE_MAX.
  const drawStaff = (rng, depth) => rng.int(N.GRADE_START, Math.min(N.GRADE_MAX, depth + 1));

  // The one shard rule (§8.3): where shards land when they fall to (x, y) (a glass exhibit's
  // own tile; for a broken case, the tile on your side). The tile itself if it is floor or
  // archway; otherwise its first floor or archway neighbour in direction order (N, NE, E, …
  // NW); otherwise nowhere (null). So shards never cover a door, an exit, the entrance, a
  // bench, a case or a wall.
  const SHARDABLE = ch => ch === '.' || ch === ',';
  function shardTile(state, x, y) {
    const m = state.dept;
    if (SHARDABLE(Grid.ch(m, x, y))) return [x, y];
    for (let d = 0; d < 8; d++) { const nx = x + Grid.DX[d], ny = y + Grid.DY[d]; if (SHARDABLE(Grid.ch(m, nx, ny))) return [nx, ny]; }
    return null;
  }

  // The role key of the room holding (x, y), or null outside any room (or in a test room).
  function roomKey(state, x, y) {
    const m = state.dept;
    if (!m.roomOf || !m.rooms) return null;
    const id = m.roomOf[y] ? m.roomOf[y][x] : 0, rm = m.rooms.find(r => r.id === id);
    return rm ? rm.key || null : null;
  }

  // A mimic's disguise (§8.3, §8.8), made by its archetype's init: on its own floor tile it
  // becomes a case. Its glass, lock and loan are drawn as a real case's are (Cases.draw), on
  // the mimic's own ai/<uid> stream, so removing it reshuffles nothing else (§3.2); its case
  // has no accession number, its one tell. The tile becomes `v`, the only time a floor tile
  // does. Returns the fixture.
  function disguise(state, a) {
    const m = state.dept;
    if ((a.size || 1) !== 1) throw new Error(`Cases.disguise: ${a.uid} is not one tile`);
    if (Grid.ch(m, a.x, a.y) !== '.') throw new Error(`Cases.disguise: ${a.uid} is not on a floor tile`);
    if (at(state, a.x, a.y)) throw new Error(`Cases.disguise: there is already a fixture at ${a.x},${a.y}`);
    const d = draw(Rng.stream(state, 'ai/' + a.uid), m.depth);
    const f = make({ x: a.x, y: a.y, room: roomKey(state, a.x, a.y), num: null, glass: d.glass, lock: d.lock, loan: d.loan, mimic: a.uid });
    if (!m.fixtures) m.fixtures = [];
    m.fixtures.push(f);
    Grid.set(m, a.x, a.y, 'v');
    return f;
  }

  // The mimic shows itself: its case is 'revealed', and its tile, if still a vitrine,
  // becomes floor again. Returns the fixture, or null if a was never disguised.
  function reveal(state, a) {
    const f = ((state.dept && state.dept.fixtures) || []).find(q => q.k === 'case' && q.mimic === a.uid) || null;
    if (!f) return null;
    f.st = 'revealed';
    if (Grid.ch(state.dept, f.x, f.y) === 'v') Grid.set(state.dept, f.x, f.y, '.');
    return f;
  }

  // Cases.place(state, plan, base, pop): a department's fixtures, in row-major order (§4.1).
  //   Every `v` inside a room (state.dept.roomOf) is a case (D3.2), drawn (Cases.draw: glass,
  //   then lock, then loan) on its room's `${base}/room/<key>/populate` stream in pop, the
  //   one local holder the department's three placement calls share (§3.2), so the room's
  //   items and consumables are drawn after its cases on the same stream. Its accession
  //   number is the department's number, its room's number and its place among the room's
  //   cases in row-major order, counted from 1 (S.9.103.2; design/pipeline.md §6.3), with
  //   no draw. A `v` in no room is fixed glazing and gets no fixture.
  //   Every staff door `S` gets its grade (drawStaff) on the department's `${base}/staff`
  //   stream, in row-major order.
  // `plan` is the layout's plan (its tiles are the department's before anything is placed).
  function place(state, plan, base, pop) {
    const m = state.dept, pack = typeof Packs !== 'undefined' && Packs.get ? Packs.get(m.acc) : null;
    const number = (pack && pack.number) || m.acc, counts = {}, staff = Rng.stream(pop, `${base}/staff`);
    const roomOf = m.roomOf || plan.roomOf;
    if (!m.fixtures) m.fixtures = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const c = m.tiles[y][x];
      if (c === 'S') { m.fixtures.push({ k: 'staff', x, y, grade: drawStaff(staff, m.depth) }); continue; }
      if (c !== 'v') continue;
      const id = roomOf[y] ? roomOf[y][x] : 0, rm = id ? m.rooms.find(r => r.id === id) : null;
      if (!rm) continue;
      counts[rm.key] = (counts[rm.key] || 0) + 1;
      const d = draw(Rng.stream(pop, `${base}/room/${rm.key}/populate`), m.depth);
      m.fixtures.push(make({ x, y, room: rm.key, num: `${number}.${rm.number}.${counts[rm.key]}`, glass: d.glass, lock: d.lock, loan: d.loan }));
    }
  }

  // The grade a staff door at (x, y) needs, or null if no staff door fixture is there.
  function staffGrade(state, x, y) {
    const f = at(state, x, y);
    return f && f.k === 'staff' ? f.grade : null;
  }
  // The grade a closed staff door asks of you: its fixture's. A staff door with no fixture
  // asks no more than the grade you start with: a department records every one (place), so
  // only a room built by Setup.room (for a test or an arena) that was given none has one.
  // Path.to, which cannot tell such a door from one on a board that records no grades,
  // never paths through it while it is shut.
  const staffNeeds = (state, x, y) => { const g = staffGrade(state, x, y); return g === null ? N.GRADE_START : g; };
  const gradeOf = state => (state.run && state.run.grade) || N.GRADE_START;

  // Cases.enter(state, a, x, y, d, ev): your step from your tile in direction d onto (x, y),
  // which holds no actor (Step.moveInto calls it for you alone). It returns null if that
  // tile is nothing of this file's (the step goes on), a refusal code, or ticks:
  //   a vitrine (a case, fixed glazing, or a mimic in its disguise): behind_glass, alike;
  //   a closed staff door `S`, past no corner: at your grade or above it opens (`s`), for
  //     COST_DOOR, with a soft noise there, and you stay where you are, as a door does;
  //     below it, staff_grade, so to you it is a wall;
  //   an open staff door `s` is walked through.
  // With ev null it changes nothing and says what it would return, for Step.legal.
  function enter(state, a, x, y, d, ev) {
    const m = state.dept, c = Grid.ch(m, x, y);
    if (c === 'v') return 'behind_glass';
    if (c !== 'S' || !Grid.canStep(m, a.x, a.y, d)) return null;
    const grade = staffNeeds(state, x, y);
    if (gradeOf(state) < grade) return 'staff_grade';
    if (ev) {
      Grid.set(m, x, y, 's');
      Causes.emit(state, ev, 'opened', { who: a.uid, x, y, staff: true, grade }, { k: 'staff', by: a.uid, grade });
      Noise.emit(state, x, y, 'soft', { k: 'staff_door', by: a.uid }, ev);
    }
    return Actors.cost(state, a, N.COST_DOOR, 'act');
  }

  // Your bashes per swing (§8.3): 1, or 2 with a Heavy weapon, and BREAKER_BASHES more with
  // `breaker` (§8.5).
  const swing = you => 1 + (you.weaponForm === 'heavy' ? 1 : 0) + (you.breaker ? N.BREAKER_BASHES : 0);
  // Can your weapon break the glass of f? A Light weapon cannot break Laminated or Security
  // glass, breaker or not (D3.4).
  const canBreak = (you, f) => !(you.weaponForm === 'light' && f.glass >= 2);
  // What one bash costs you: COST_BASH, or COST_BASH_HEAVY for a Heavy weapon's swing.
  const bashCost = (state, you) => Actors.cost(state, you, you.weaponForm === 'heavy' ? N.COST_BASH_HEAVY : N.COST_BASH, 'act');
  // [M4: Light Fingers] What opening a case costs you.
  const openCost = state => N.COST_OPEN_CASE;

  // Is the actor a standing in the case f, or at home in it?
  const inCase = (a, f) => Actors.covers(a, f.x, f.y);
  const homedAt = (a, f) => !!a.home && a.home[0] === f.x && a.home[1] === f.y;
  function exhibitsOf(state, f) {
    const out = [];
    for (let i = 1; i < state.actors.length; i++) { const a = state.actors[i]; if (!a.gone && (inCase(a, f) || homedAt(a, f))) out.push(a); }
    return out;
  }
  const mimicOf = (state, f) => { if (!f.mimic) return null; const a = Actors.byUid(state, f.mimic); return a && !a.gone ? a : null; };
  // A mimic's case shows what it is: revealed (Cases.reveal), its tile floor again; a case
  // whose mimic is gone (destroyed in its disguise, say) likewise, with no one to reveal.
  function unmask(state, f) {
    if (f.st === 'revealed') return;
    const mimic = mimicOf(state, f);
    if (mimic) { reveal(state, mimic); return; }
    f.st = 'revealed';
    if (Grid.ch(state.dept, f.x, f.y) === 'v') Grid.set(state.dept, f.x, f.y, '.');
  }

  // Cases.touch(state, f, how, by, ev): the case f is touched, opened ('opened') or bashed
  // ('bashed') by `by` (§8.2, touch_case; never by Solvent, and a bump is refused, D3.5).
  //   1. every exhibit standing in it or at home in it, and the mimic it is, in spawn order:
  //      Archetypes.onTouched(state, a, how, by, ev) (the mimic's grip);
  //   2. a mimic's case is revealed (Cases.reveal), if its archetype has not done so (a case
  //      whose mimic is gone shows itself floor likewise);
  //   3. the mimic wakes at once, hunting (it gains no pips: Wake.wake, which a pipless
  //      exhibit allows for touch_case); every other one whose trigger is touch_case gains
  //      PIPS_TO_WAKE pips (Wake.addPips), so it wakes at once, hunting.
  // The cause is {k: 'touch_case', by, x, y, how}, with itself: true for the mimic, whose
  // case is the mimic itself. It comes before the action's noise (§8.2, one action's wake
  // order), so a sleeper at 2 pips that the touch wakes hunts you.
  function touch(state, f, how, by, ev) {
    const mimic = mimicOf(state, f), list = exhibitsOf(state, f);
    if (mimic && !list.includes(mimic)) list.push(mimic);
    for (const a of list) Archetypes.onTouched(state, a, how, by, ev);
    if (f.mimic) unmask(state, f);
    for (const a of list) {
      if (a.gone) continue;
      const cause = { k: 'touch_case', by, x: f.x, y: f.y, how };
      if (a === mimic) Wake.wake(state, a, 'hunting', Object.assign(cause, { itself: true }), ev);
      else if (a.trigger === 'touch_case') Wake.addPips(state, a, N.PIPS_TO_WAKE, cause, ev);
    }
  }

  // Cases.release(state, f, ev, cause?): the case f has broken or dissolved, so what stood in
  // it is free (§8.3): each exhibit standing in it loses its home and hunts you (a sleeper
  // wakes, hunting; an exhibit already awake turns to the hunt), with cause, by default
  // {k: 'case_broken' or 'dissolved' (by f.st), x, y}; an exhibit whose home it was but which
  // is not in it loses its home too. Returns the uids of the exhibits that stood in it.
  function release(state, f, ev, cause) {
    cause = cause || { k: f.st === 'dissolved' ? 'dissolved' : 'case_broken', x: f.x, y: f.y };
    const out = [];
    for (const a of exhibitsOf(state, f)) {
      a.home = null;
      if (!inCase(a, f)) continue;
      out.push(a.uid);
      const c = Causes.copy(cause, 'release.cause');
      if (f.mimic === a.uid) c.itself = true;
      if (a.mode === 'dormant') Wake.wake(state, a, 'hunting', c, ev);
      else if (a.mode !== 'hunting') Wake.setMode(state, a, 'hunting', c, ev);
    }
    return out;
  }

  // Cases.spreadShards(state, f, from) → tiles: a broken case's shards (§8.3) fall to the tile
  // on your side, `from` (the tile you bashed from): there if it is floor or archway, else
  // on its first floor or archway neighbour in direction order (Cases.shardTile), up to
  // SHARD_SPREAD tiles in that order. Each becomes `x`, a loud floor.
  function spreadShards(state, f, from) {
    const m = state.dept, list = [], out = [];
    list.push([from[0], from[1]]);
    for (let d = 0; d < 8; d++) list.push([from[0] + Grid.DX[d], from[1] + Grid.DY[d]]);
    for (const [x, y] of list) {
      if (out.length >= N.SHARD_SPREAD) break;
      if (SHARDABLE(Grid.ch(m, x, y))) out.push([x, y]);
    }
    for (const [x, y] of out) Grid.set(m, x, y, 'x');
    return out;
  }

  // Cases.open(state, who, f, ev) → ticks: who opens the intact case f, which the action has
  // checked (beside who, past no corner, its lock within who's grade). In order (§8.2):
  //   1. the touch (Cases.touch, 'opened');
  //   2. a real case opens: it is 'open' and its tile `u`, passable, with no shards; an
  //      exhibit in it may leave, keeps its home there and can return; case_opened
  //      {by, x, y, glass, lock}, cause {k: 'grade', grade, lock}. A mimic's case was
  //      revealed by the touch, and nothing opens;
  //   3. last, a soft noise from the case tile.
  // It costs openCost (COST_OPEN_CASE).
  function open(state, who, f, ev) {
    touch(state, f, 'opened', who.uid, ev);
    if (!f.mimic) {
      f.st = 'open';
      Grid.set(state.dept, f.x, f.y, 'u');
      Causes.emit(state, ev, 'case_opened', { by: who.uid, x: f.x, y: f.y, glass: f.glass, lock: f.lock }, { k: 'grade', grade: gradeOf(state), lock: f.lock });
    }
    Noise.emit(state, f.x, f.y, 'soft', { k: 'case_opened', by: who.uid }, ev);
    return Actors.cost(state, who, openCost(state), 'act');
  }

  // Cases.bash(state, who, f, ev) → ticks: who bashes the intact case f, which the action has
  // checked (beside who, past no corner, glass who's weapon can break). One swing counts
  // swing(who) bashes. In order (§8.2):
  //   1. the touch (Cases.touch, 'bashed'); a mimic's case is revealed by it, and the rest is
  //      only the loud noise;
  //   2. its hits rise by the swing's bashes, to at most what its glass takes (GLASS_BASHES);
  //   3. short of that: glass_cracked {by, x, y, glass, hits, need}, cause {k: 'bash', by,
  //      form, count}, then a loud noise from the case tile;
  //   4. the breaking bash: the case is 'broken' and its tile `k`, passable and loud; what
  //      stood in it is released (Cases.release, case_broken); the shards fall on your side
  //      (Cases.spreadShards); glass_broke {by, x, y, glass, shards, released}, cause {k:
  //      'bash', by, form, count, hits, need}; then, last, a crash from the case tile.
  // It costs COST_BASH, or COST_BASH_HEAVY for a Heavy swing.
  function bash(state, who, f, ev) {
    const cost = bashCost(state, who), count = swing(who), form = who.weaponForm || null;
    touch(state, f, 'bashed', who.uid, ev);
    if (f.mimic) { Noise.emit(state, f.x, f.y, 'loud', { k: 'bash', by: who.uid }, ev); return cost; }
    const n = need(f.glass);
    f.hits = Math.min(n, f.hits + count);
    if (f.hits < n) {
      Causes.emit(state, ev, 'glass_cracked', { by: who.uid, x: f.x, y: f.y, glass: f.glass, hits: f.hits, need: n }, { k: 'bash', by: who.uid, form, count });
      Noise.emit(state, f.x, f.y, 'loud', { k: 'bash', by: who.uid }, ev);
      return cost;
    }
    f.st = 'broken';
    Grid.set(state.dept, f.x, f.y, 'k');
    const freed = release(state, f, ev, { k: 'case_broken', by: who.uid, x: f.x, y: f.y });
    const shards = spreadShards(state, f, [who.x, who.y]);
    Causes.emit(state, ev, 'glass_broke', { by: who.uid, x: f.x, y: f.y, glass: f.glass, shards, released: freed.length ? freed[0] : null },
      { k: 'bash', by: who.uid, form, count, hits: f.hits, need: n });
    Noise.emit(state, f.x, f.y, 'crash', { k: 'glass_broke', by: who.uid }, ev);
    return cost;
  }

  // Cases.dissolve(state, f, cause, ev) → bool: Solvent dissolves the intact case f, silently
  // (§8.3): no noise, no shards, no touch_case. A real case is 'dissolved' and its tile `u`;
  // a mimic's case is revealed, and the mimic hunts you without its grip (D3.8). What stood
  // in it is released (Cases.release, cause {k: 'dissolved', by, x, y}); then glass_broke
  // {by, x, y, glass, shards: [], released} with the cause it is given, which Consumables
  // (W1-CONSUMABLES) builds as {k: 'solvent', by, item} and which names `by`. Consumables
  // emits no glass_broke itself. A case that is not intact is left alone (false).
  function dissolve(state, f, cause, ev) {
    if (!f || f.k !== 'case' || f.st !== 'shut' || Grid.ch(state.dept, f.x, f.y) !== 'v') return false;
    const by = cause && cause.by ? cause.by : null;
    if (f.mimic) unmask(state, f);
    else { f.st = 'dissolved'; Grid.set(state.dept, f.x, f.y, 'u'); }
    const wake = { k: 'dissolved', x: f.x, y: f.y };
    if (by) wake.by = by;
    const freed = release(state, f, ev, wake);
    Causes.emit(state, ev, 'glass_broke', { by, x: f.x, y: f.y, glass: f.glass, shards: [], released: freed.length ? freed[0] : null }, cause);
    return true;
  }

  // Can the item be reached where it lies? On the floor, yes; in a case, once the case is
  // open, broken or dissolved (its contents can then be taken from beside it, §8.3; the
  // pole reaches them from 2 tiles); anywhere else (carried, worn, gone), no. How near you
  // must be is the item rules' (Kit).
  function reach(state, item) {
    const w = item && item.where;
    if (!w) return false;
    if (w.at === 'floor') return true;
    if (w.at !== 'case') return false;
    const f = at(state, w.x, w.y);
    return !!f && f.k === 'case' && (f.st === 'open' || f.st === 'broken' || f.st === 'dissolved');
  }

  // May a Highlight go in the case f (§8.3)? Never behind a lock above the grade you entered
  // the department with (dept.entryGrade); and only in a real case that is shut, not on
  // loan, and holds nothing yet. A place that is no case (f null: the floor) is always allowed.
  function highlightOk(state, f) {
    if (!f) return true;
    return f.k === 'case' && f.mimic === null && f.st === 'shut' && !f.loan && f.holds === null && f.lock <= state.dept.entryGrade;
  }

  // Is the tile (x, y) shown? vis is a function (x, y) → bool, or an array indexed y·w + x
  // whose non-zero entries are shown (the view model's vis, or a mask of tiles seen now),
  // or absent (everything is).
  function shown(state, vis, x, y) {
    if (!vis) return true;
    if (typeof vis === 'function') return !!vis(x, y);
    return !!vis[y * state.dept.w + x];
  }

  // What you can do to the case f with your kit and grade now, wherever you stand: open it
  // (its lock within your grade), break it (glass your weapon can break), and in how many of
  // your swings.
  function yourWay(state, f) {
    const you = state.actors[0], shut = f.st === 'shut', n = need(f.glass);
    const breakable = shut && canBreak(you, f);
    return { canOpen: shut && gradeOf(state) >= f.lock, canBreak: breakable, blows: breakable ? Int.ceilDiv(n - f.hits, swing(you)) : null };
  }
  // The item a case holds, for a picture: {uid, kind, icon} (icon its kind's), or null.
  function held(state, f) {
    if (!f.holds) return null;
    const it = (state.items || []).find(i => i.uid === f.holds);
    return it ? { uid: it.uid, kind: it.kind, icon: it.kind } : null;
  }

  // The cases as the view model shows them (§6.1): every case on a shown tile (shown()), in
  // fixture order, as {x, y, glass, hits, need, lock, st, loan, holds, canOpen, canBreak,
  // blows, num}. A mimic in its disguise is listed exactly as a real case is, with num null
  // its only difference (D3.10); a revealed mimic's case is no case, and is left out.
  function view(state, vis) {
    const out = [];
    for (const f of (state.dept && state.dept.fixtures) || []) {
      if (f.k !== 'case' || f.st === 'revealed' || !shown(state, vis, f.x, f.y)) continue;
      out.push(Object.assign({ x: f.x, y: f.y, glass: f.glass, hits: f.hits, need: need(f.glass), lock: f.lock, st: f.st, loan: f.loan, holds: held(state, f) },
        yourWay(state, f), { num: f.num }));
    }
    return out;
  }
  // The staff doors as the view model shows them: every one on a shown tile, as {x, y, grade,
  // open, canOpen}, canOpen whether your grade opens it.
  function staffView(state, vis) {
    const out = [];
    for (const f of (state.dept && state.dept.fixtures) || []) {
      if (f.k !== 'staff' || !shown(state, vis, f.x, f.y)) continue;
      out.push({ x: f.x, y: f.y, grade: f.grade, open: Grid.ch(state.dept, f.x, f.y) === 's', canOpen: gradeOf(state) >= f.grade });
    }
    return out;
  }

  // The rules of a case, or of a staff door, as sentences: the registry's clauses for the
  // fixture (FIXTURES) and, for a case, its glass (GLASS), filled from the numbers of record.
  function rules(state, f) {
    const R = Registry, depth = (state.dept && state.dept.depth) || 1;
    const fill = e => Clauses.fill(e.clause, Clauses.params(e.params, null, { depth }));
    const out = [fill(R.FIXTURES[f.k])];
    if (f.k === 'case') { const g = R.order('GLASS').find(id => R.GLASS[id].n === f.glass); if (g) out.push(fill(R.GLASS[g])); }
    return out;
  }

  // A fixture's label data (§8.8), for Labels: for a case {k, x, y, num, room, glass,
  // glassName, lock, hits, need, st, loan, holds, canOpen, canBreak, blows, rules}; for a
  // staff door {k, x, y, grade, open, canOpen, rules}; else null. A mimic in its disguise
  // gives what a real case gives, with num null. A revealed mimic's case gives null.
  function describe(state, f) {
    if (!f) return null;
    if (f.k === 'staff') return { k: 'staff', x: f.x, y: f.y, grade: f.grade, open: Grid.ch(state.dept, f.x, f.y) === 's', canOpen: gradeOf(state) >= f.grade, rules: rules(state, f) };
    if (f.k !== 'case' || f.st === 'revealed') return null;
    const g = Registry.order('GLASS').find(id => Registry.GLASS[id].n === f.glass);
    return Object.assign({ k: 'case', x: f.x, y: f.y, num: f.num, room: f.room, glass: f.glass, glassName: g ? Registry.GLASS[g].name : null,
      lock: f.lock, hits: f.hits, need: need(f.glass), st: f.st, loan: f.loan, holds: held(state, f) }, yourWay(state, f), { rules: rules(state, f) });
  }

  // open(x, y) and bash(x, y) (§4.2): on an intact case beside you. A target is refused, in
  // this order: no intact case there (no_case: nothing, fixed glazing, a case already open
  // or broken, or a revealed mimic's); not beside you (out_of_reach); diagonally past a
  // corner, as a blow is (corner); then, to open, its lock above your grade (case_locked),
  // and to bash, glass your weapon cannot break (glass_too_strong). A mimic in its disguise
  // is refused or allowed exactly as a real case with its glass and lock would be.
  function check(state, id, x, y) {
    const m = state.dept, you = state.actors[0];
    if (!Number.isInteger(x) || !Number.isInteger(y)) return 'no_case';
    const f = intact(state, x, y);
    if (!f) return 'no_case';
    const dx = x - you.x, dy = y - you.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return 'out_of_reach';
    if (dx !== 0 && dy !== 0 && !(Grid.walkable(m, x, you.y) && Grid.walkable(m, you.x, y))) return 'corner';
    if (id === 'open' && gradeOf(state) < f.lock) return 'case_locked';
    if (id === 'bash' && !canBreak(you, f)) return 'glass_too_strong';
    return null;
  }
  const around = (state, a) => {
    const you = state.actors[0], out = [];
    for (let d = 0; d < 8; d++) out.push({ a, x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] });
    return out.concat([{ a, x: you.x, y: you.y }, { a }]);
  };
  for (const id of ['open', 'bash']) Actions.define(id, {
    legal(state) {
      const you = state.actors[0], out = [];
      for (let d = 0; d < 8; d++) { const x = you.x + Grid.DX[d], y = you.y + Grid.DY[d]; if (check(state, id, x, y) === null) out.push({ a: id, x, y }); }
      return out;
    },
    candidates: state => around(state, id),
    apply(state, action, ev) {
      const code = check(state, id, action.x, action.y);
      if (code) return code;
      const f = at(state, action.x, action.y), you = state.actors[0];
      return id === 'open' ? open(state, you, f, ev) : bash(state, you, f, ev);
    },
  });

  return { at, encased, make, lockRange, lockSpan, need, drawGlass, drawLock, drawLoan, draw, drawStaff, shardTile, roomKey, disguise, reveal,
    place, staffGrade, enter, swing, canBreak, openCost, touch, release, spreadShards, open, bash, dissolve, reach, highlightOk,
    view, staffView, rules, describe, check };
})();
