// LV11, the worst-case runner, as its gate (M4 plan D-RUNNER, A1.4, D2.3, R2; BUILD.md §5.5,
// §10.3), over the shared sweep (test/m4-sweep.test.js), on seed s of each department at depth
// ((s − 1) mod 7) + 1 for seeds 1–100: 100 departments a department, as Dept.generate made them
// (d.made says how). For each:
//   - LV11 run again outside generation (LRunner.measure, the full report) passes the final
//     department, unless it is the certified fallback, taken despite LV11's own rejection, which
//     is counted;
//   - nothing stands removed (no exhibit gone as the visit starts): a move never removes;
//   - each move the department's log holds ({check: 'LV11'}) is a sentence a player would
//     take, naming the exhibit and what woke it, and the exhibit it names stands where it says;
//   - an oracle written here, apart from js/core/layout/runner.js, recomputes what the reported
//     cheapest route (charge (b)) wakes, and when, and its charge, from the game's own rules
//     (Archetypes.wakeRegion, Wake.onAxis, Wake.inTether, Patrol.timeline and AI.sees,
//     HourlyDemonstration's lines, the alarm, a herald's call, ally_hit; Combat, Specials and
//     the readout's hits for the charge), and agrees with LRunner to the hundredth of a hit point;
// and over the sweep, each department's gate (A1.4): at least 90 of its 100 seeds pass at the
// first attempt LV11 judged (its moves included: a move is the attempt's own repair, layout.md
// §10.1), at most 1 falls back, none has an exhibit removed.
'use strict';
module.exports = C => {
  const { N, Int, Grid, Actors, Archetypes, Wake, AI, Patrol, Cases, Combat, Specials, Modules, HourlyDemonstration, Progress, Kit, Health, Registry, LRunner, Labels } = C;
  const ACCS = ['S9', 'A4', 'M11'];
  const tally = {};
  for (const acc of ACCS) tally[acc] = { n: 0, first: 0, clean: 0, moved: 0, moves: 0, reseeds: 0, fallbacks: 0, removed: 0, oracle: 0 };

  // ---- The oracle ----

  // The runner (D2.3): the median visitor at the depth less one Certificate: a grade less (never
  // below GRADE_START), that grade's health, a Balanced weapon and a Standard garment of the
  // median's tier at that grade's stats; no perks, no statuses.
  function runnerOf(s) {
    const med = Progress.median(s.dept.depth), grade = Math.max(N.GRADE_START, med.grade - 1);
    const w = Kit.item({ uid: 'o.w', kind: 'weapon', where: { at: 'kit', slot: 'weapon' }, form: 'balanced', tier: med.tier });
    const g = Kit.item({ uid: 'o.g', kind: 'garment', where: { at: 'kit', slot: 'garment' }, form: 'standard', tier: med.tier });
    const k = Kit.stats(w, g, grade, []), hp = Health.maxHp(grade), you = s.actors[0];
    return { uid: 'you', sp: 'visitor', size: 1, x: you.x, y: you.y, hp, maxHp: hp, grade, tier: med.tier, acc: k.acc, eva: k.eva, pad: k.pad,
      dmin: k.dmin, dmax: k.dmax, weaponForm: k.weaponForm, reach: k.reach, statuses: [], mode: null };
  }
  // One exhibit fought under (b): your expected time to destroy it (hundredths of a turn), its
  // blow's rate (chance × its largest net hit, over its blow's ticks) and its specials once.
  function fighter(s, a, run) {
    const r = Object.assign({}, run, { x: a.x, y: a.y }), said = Archetypes.readout(s, a, r);
    const noBlow = said.some(q => q.k === 'noBlow'), hits = said.find(q => q.k === 'hits');
    const mine = Combat.netRolls(r, a, s, [a.x, a.y]), need = hits ? hits.n : Int.ceilDiv(a.hp * mine.n, mine.sum);
    const time = Int.ceilDiv(100 * need * Actors.attackCost(s, r), Combat.hitChance(r, a));
    const chance = noBlow ? 0 : Combat.hitChance(a, r), max = noBlow ? 0 : Combat.netRolls(a, r, s, [a.x, a.y]).max;
    let extra = 0;
    for (const q of Specials.readout(s, a, r)) if (q.net !== null) extra += 100 * q.net;
    return { a, time, chance, max, cost: Actors.attackCost(s, a), extra };
  }
  // A fight's charge: every exhibit strikes until destroyed, you destroying them shortest time
  // per damage first (the order that costs least), ties in spawn order.
  function fightCost(list) {
    const order = list.slice().sort((p, q) => (p.time * q.chance * q.max * p.cost - q.time * p.chance * p.max * q.cost) || (p.i - q.i));
    let t = 0, c = 0;
    for (const f of order) { t += f.time; c += Int.ceilDiv(t * f.chance * f.max, f.cost) + f.extra; }
    return c;
  }

  // What route R (tile indices; you stand on R[i] after your i-th action) wakes on department
  // s, and its charge (b), over `horizon` turns: {woken: [[uid, turn]…], b}.
  function oracle(s, R, horizon) {
    const m = s.dept, w = m.w, intro = (m.rooms.find(r => r.role === 'intro') || {}).id;
    const open = Object.assign({}, s, { dept: Object.assign({}, m, { tiles: m.tiles.map(r => r.replace(/\+/g, "'")), surfaces: [] }) });
    const me = Object.assign({}, open, { actors: [Object.assign({}, s.actors[0])].concat(s.actors.slice(1)) });
    const at = k => { me.actors[0].x = k % w; me.actors[0].y = (k - k % w) / w; return me; };
    const ex = [];
    for (let i = 1; i < s.actors.length; i++) {
      const a = s.actors[i];
      if (!a.gone && !Archetypes.pipless(s, a) && m.roomOf[a.y][a.x] !== intro) ex.push({ a, i, T: -1, done: false });
    }
    const told = Patrol.timeline(s, horizon), walks = new Map((told || []).map(p => [p.uid, p.at]));
    // Does a patrol standing on p see you on tile k?
    const sees = (a, p, k) => AI.sees(at(k), Object.assign({}, a, { x: p.x, y: p.y }));
    for (const e of ex) {
      const a = e.a;
      if (a.mode === 'dormant') {
        const ring = new Set(Archetypes.wakeRegion(open, a, N.PIPS_TO_WAKE).map(([x, y]) => y * w + x)), need = Math.max(1, N.PIPS_TO_WAKE - (a.pips || 0));
        let pips = 0;
        for (let i = 0; i < R.length && e.T < 0; i++) {
          if (a.trigger === 'tether' && Array.isArray(a.guards) && Wake.inTether(at(R[i]), a)) { e.T = i; break; }
          pips += (ring.has(R[i]) ? 1 : 0) + (a.trigger === 'axis' && Wake.onAxis(at(R[i]), a) ? 1 : 0);
          if (pips >= need) e.T = i;
        }
      } else if (walks.has(a.uid)) {
        // An action of its at tick t comes after your actions at ticks up to t (ties go to
        // you): you stand on R[i], i the count of them; past its timeline, wherever it could be.
        const byTurn = new Map(), all = walks.get(a.uid);
        let last = 0;
        for (const p of all) { const i = Int.idiv(p.t - s.tick, N.TICKS_PER_TURN) + 1; if (!byTurn.has(i)) byTurn.set(i, []); byTurn.get(i).push(p); last = Math.max(last, i); }
        e.anywhere = k => all.some(p => sees(a, p, k));
        for (let i = 0; i < R.length && e.T < 0; i++) if (i > last ? e.anywhere(R[i]) : (byTurn.get(i) || []).some(p => sees(a, p, R[i]))) e.T = i;
      } else {
        const region = new Set(Archetypes.wakeRegion(open, a, horizon).map(([x, y]) => y * w + x));
        for (let i = 0; i < R.length && e.T < 0; i++) if (region.size === 0 || region.has(R[i])) e.T = i;
      }
    }
    // What each waking wakes in turn, earliest first; once you fight, a timed patrol finds you
    // wherever it could see you.
    const sleeps = b => b.mode === 'dormant' && !Archetypes.pipless(s, b);
    let fighting = false;
    for (;;) {
      let e = null;
      for (const f of ex) if (!f.done && f.T >= 0 && (!e || f.T < e.T)) e = f;
      if (!e) break;
      e.done = true;
      const a = e.a, fights = !Cases.encased(s, a);
      if (!fighting && fights) {
        fighting = true;
        for (const f of ex) if (!f.done && f.anywhere) for (let i = e.T; i < R.length && (f.T < 0 || i < f.T); i++) if (f.anywhere(R[i])) { f.T = i; break; }
      }
      const A = Registry.ARCHETYPES[a.arch], call = A && A.special === 'call' ? Specials.tiles(s, a, 'call') : null, alarm = Modules.flagged(s, a, 'alarm_network');
      for (const f of ex) {
        const b = f.a;
        if (f.done || b === a || !sleeps(b)) continue;
        let t = -1;
        const near = Actors.footprint(b).some(([x, y]) => Actors.footprint(a).some(([u, v]) => Grid.disc(x - u, y - v, N.ALLY_HIT_RANGE)));
        if (fights && a.group && b.group === a.group && b.trigger === 'ally_hit' && near) t = e.T + 1;
        if (!Actors.centrepiece(b) && (alarm || (call && Actors.footprint(b).some(([x, y]) => call.some(c => c[0] === x && c[1] === y))))) t = t < 0 ? e.T + 2 : Math.min(t, e.T + 2);
        if (t >= 0 && (f.T < 0 || t < f.T)) f.T = t;
      }
    }
    // The fights: those woken that can fight (not in a case), in the order they wake, each
    // joining the one before when it wakes within RUNNER_TOGETHER_TURNS of its last.
    const run = runnerOf(s), woke = ex.filter(e => e.T >= 0).sort((p, q) => (p.T - q.T) || (p.i - q.i));
    let b = 0, fight = [], end = -99;
    for (const e of woke) {
      if (Cases.encased(s, e.a)) continue;
      if (fight.length && e.T - end > N.RUNNER_TOGETHER_TURNS) { b += fightCost(fight); fight = []; }
      fight.push(Object.assign(fighter(s, e.a, run), { i: e.i }));
      end = e.T;
    }
    if (fight.length) b += fightCost(fight);
    // A station's line: once, at its net damage, when the route stands on a tile it could
    // take as it goes off, DEMO_WARNING turns after a chime within the horizon.
    const net = Math.max(N.DMG_MIN_ON_HIT, Specials.info(s, 'demo_line').gross - run.pad);
    for (const e of ex) {
      if (!HourlyDemonstration.isStation(s, e.a) || !HourlyDemonstration.of(s)) continue;
      for (let c = s.turn + 1; c + N.DEMO_WARNING - s.turn <= horizon; c++) {
        const j = c + N.DEMO_WARNING - s.turn;
        if (!HourlyDemonstration.chimesAt(s, e.a, c) || j >= R.length) continue;
        if (HourlyDemonstration.reach(s, e.a, c).some(([x, y]) => y * w + x === R[j])) { b += 100 * net; break; }
      }
    }
    return { woken: woke.map(e => [e.a.uid, e.T]), b };
  }

  // ---- The moves' sentences ----
  const MOVE = /^moved (the .+?),? from (\d+),(\d+) to (\d+),(\d+)(, in .+)?: the worst-case runner's way (passed within \d+ walking tiles of it, in its sight, for \d+ turns, which wakes it|crossed its row or column within \d+ tiles, in its sight, which wakes it|came within \d+ tiles of what it guards, which wakes it at once); from (\d+),(\d+) it passes clear of it$/;

  function each(d) {
    const { state: s, acc, seed, depth, made } = d;
    if (depth !== 1 + ((seed - 1) % 7)) return null;
    const t = tally[acc], out = [];
    t.n++;
    const rejected = made.tries.flat().filter(f => f.id === 'lv11').length + (made.rejected && made.rejected.id === 'lv11' ? 1 : 0);
    const moves = made.log.filter(l => l.check === 'LV11');
    if (!rejected) t.first++;
    if (!rejected && !moves.length) t.clean++;
    if (moves.length) t.moved++;
    t.moves += moves.length;
    t.reseeds += made.tries.flat().filter(f => f.id === 'lv11').length;
    if (made.fallback) t.fallbacks++;
    if (s.actors.some(a => a.gone)) { t.removed++; out.push('an exhibit stands removed'); }
    const name = Labels.nameOf(s);
    for (const l of moves) {
      const q = MOVE.exec(l.op || '');
      if (!q) { out.push(`the move "${l.op}" is not a sentence of LV11's`); continue; }
      const there = s.actors.find(a => a.x === +q[4] && a.y === +q[5] && !a.gone);
      if (!there || name(there.uid) !== q[1] || q[8] !== q[4] || q[9] !== q[5]) out.push(`the move "${l.op}" names what does not stand at ${q[4]},${q[5]}`);
    }
    const rep = LRunner.measure(s);
    if (!LRunner.passes(rep, 'b', N.RUNNER_PASS_PCT)) {
      if (made.fallback && made.rejected && made.rejected.id === 'lv11') return out.length ? out.join('; ') : null;
      out.push(`LV11 fails the department made: ${rep.none || `${Int.ceilDiv(rep.best.b.b, 100)} of ${rep.hp} HP`}`);
      return out.join('; ');
    }
    if (rep.none) return out.concat([rep.none]).join('; ');
    const b = rep.best.b, o = oracle(s, b.route, rep.horizon);
    t.oracle++;
    const theirs = JSON.stringify(b.woken.map(w => [w.uid, w.turn]).sort()), ours = JSON.stringify(o.woken.slice().sort());
    if (o.b !== b.b || theirs !== ours) out.push(`the oracle's charge of the reported route is ${o.b} (woken ${ours}), LRunner's ${b.b} (woken ${theirs})`);
    return out.length ? out.join('; ') : null;
  }

  function done() {
    const out = [];
    for (const acc of ACCS) {
      const t = tally[acc];
      if (!t.n) continue;
      if (t.first * 100 < 90 * t.n) out.push(`${acc}: ${t.first} of ${t.n} pass at the first attempt LV11 judged, under 90%`);
      if (t.fallbacks * 100 > t.n) out.push(`${acc}: ${t.fallbacks} of ${t.n} fall back, over 1%`);
      if (t.removed) out.push(`${acc}: ${t.removed} with an exhibit removed`);
      if (t.oracle < t.n - t.fallbacks) out.push(`${acc}: the oracle checked ${t.oracle} of ${t.n}`);
    }
    return out.length ? out.join('; ') : null;
  }
  return { each, done, tally, oracle };
};
