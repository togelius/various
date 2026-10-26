// ACCESSION — the joined-up scenarios (BUILD.md §5.3, checks 2 and 3, with every rule in
// place; W2a-BEHAVIOUR). Each Wave 1 package proved its clauses with the other packages' hooks
// stubbed or driven directly; here each archetype that depends on another package's rules is
// played from sleep through the real chain, in the real core, with nothing stubbed or set by
// hand once the room is made: the herald wakes to a noise you make out of its sight, comes to
// look, and calls on seeing you; the tethered warden is drawn by a noise as far as its tether
// lets it, and fights you when you step inside it; the kiter wakes to a noise, sees you from
// beyond its range, walks in to its distance and shoots; the mimic is touched through a real open or bash of its case in
// every S.9 department that places one. Each runs for every pack species of its archetype at
// depths 1–7, with every invariant (tools/invariants.js) after every step and a clone check.
// The noise is your real Tuning Fork's (W1-KIT): a soft noise "as if you made it there".
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Roles, N, Grid, Step, Dept, Archetypes, Cases, Actors, Clauses } = C;
  const json = x => JSON.stringify(x);
  const of = (ev, k, f) => ev.filter(e => e.k === k && (!f || f(e)));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const list = id => { const l = H.species(C, id); assert.ok(l.length >= 7, `${id}: ${l.length} species and depths`); return l; };
  const accOf = sp => { const p = C.Packs.list().find(q => q.species.includes(sp)); return p ? p.acc : 'T0'; };
  const range = s => s.includes('–') ? s.split('–').map(Number) : [Number(s), Number(s)];
  const FORK = { uid: 'joined.fork', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } };
  const sleeper = at => ({ sp: 'dummy', at, mode: 'dormant', stats: { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 } });

  // Two rooms, a wall between them with one gap at (7, 3). You stand in the west room at
  // (2, 1); the exhibit sleeps in the east room at (9, 1), out of your sight and you out of
  // its, 3 walking tiles from the gap, where you strike the fork three times, one a turn.
  const TWO = ['###############', '#......#......#', '#......#......#', '#.............#', '#......#......#', '#......#......#', '###############'];
  const GAP = [7, 3], YOU = [2, 1], AT = [9, 1];
  const forkThrice = (s, i) => i < N.TUNING_FORK[0] ? { a: 'use', uid: FORK.uid, x: GAP[0], y: GAP[1] } : null;
  const sees = (m, a, b) => Grid.los(m, a[0], a[1], b[0], b[1]) && Grid.disc(a[0] - b[0], a[1] - b[1], N.SIGHT_EXHIBIT);
  // The step at which the exhibit woke, and that it woke awake to the noise, to look at it.
  function wokeToNoise(r, uid) {
    const i = r.steps.findIndex(st => st.events.some(e => e.k === 'woke' && e.who === uid));
    if (i < 0) return { i, bad: 'the fork\'s noise never woke it' };
    const w = r.steps[i].events.find(e => e.k === 'woke' && e.who === uid);
    if (w.mode !== 'awake' || w.cause.k !== 'noise' || w.cause.by !== 'you' || w.cause.x !== GAP[0] || w.cause.y !== GAP[1]) return { i, bad: `it woke ${w.mode}, ${json(w.cause)}` };
    if (i !== N.PIPS_TO_WAKE - 1) return { i, bad: `it woke at the fork's ${i + 1}th strike, not its ${N.PIPS_TO_WAKE}th` };
    return { i, bad: null };
  }
  // Where an actor stood before each step and after the last.
  function track(r, uid) {
    const a = r.start.actors.find(x => x.uid === uid);
    let p = [a.x, a.y];
    const out = [p];
    for (const s of r.steps) { for (const e of s.events) if (e.k === 'moved' && e.who === uid) p = e.to; out.push(p); }
    return out;
  }

  // ---- The herald: woken by your noise out of its sight, it comes to look; on seeing you it
  // calls, and the sleepers within its range that can hear wake and come to look. ----
  // Three sleepers sleep in the east room, out of earshot of the fork, and a mimic in its
  // disguise among them, which hears nothing.
  const heraldCalls = H.scenario({
    name: 'a herald woken by your noise comes to look; on seeing you it calls, and the sleepers within its range that can hear wake and come to look',
    id: 'herald', clone: true,
    build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: accOf(sp), depth, map: TWO, you: YOU.slice(), items: [FORK],
      exhibits: [{ sp: sp.id, at: AT.slice(), stats: Roles.stats(sp.role, depth) }, sleeper([12, 1]), sleeper([11, 5]), sleeper([13, 4]),
        { sp: 'S9.5', at: [10, 5], stats: Roles.stats('ambusher', depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
    actions: (s, i) => forkThrice(s, i) || (i < 16 ? { a: 'wait' } : null),
    expect(r, params) {
      const h = r.start.actors[1], woke = wokeToNoise(r, h.uid);
      if (woke.bad) return woke.bad;
      const seen = r.steps.findIndex(st => st.events.some(e => e.k === 'hunting' && e.who === h.uid));
      if (seen < 0) return 'it never saw you';
      const hunt = r.steps[seen].events.find(e => e.k === 'hunting' && e.who === h.uid);
      if (hunt.cause.k !== 'seen' || hunt.was !== 'awake') return `it began to hunt ${json(hunt)}, not on seeing you`;
      const t = track(r, h.uid);
      if (json(t[0]) === json(t[seen + 1])) return 'it saw you without coming to look';
      // It calls at the first action after it sees you (or in the same one).
      const call = r.steps.findIndex(st => st.events.some(e => e.k === 'telegraphed' && e.who === h.uid));
      if (call < seen || call > seen + 1) return `it saw you at step ${seen} and called at step ${call}`;
      const tel = r.steps[call].events.find(e => e.k === 'telegraphed' && e.who === h.uid);
      if (tel.sp !== 'call') return `it marked ${tel.sp}`;
      // When the call goes off: exactly the sleepers on its tiles that can hear wake, awake,
      // sent to look where you stood; the mimic sleeps on.
      const off = r.steps.findIndex(st => st.events.some(e => e.k === 'special' && e.who === h.uid && !e.cancelled));
      if (off <= call) return 'the call never went off';
      const on = uid => { const b = r.start.actors.find(x => x.uid === uid); return tel.tiles.some(([x, y]) => x === b.x && y === b.y); };
      const sleepers = r.start.actors.filter(b => b.sp === 'dummy').map(b => b.uid);
      const wokeBy = of(r.steps[off].events, 'woke', e => e.cause.k === 'herald').map(e => e.who);
      if (json(wokeBy) !== json(sleepers.filter(on))) return `the call woke ${json(wokeBy)}; the sleepers on its tiles were ${json(sleepers.filter(on))}`;
      if (!wokeBy.length) return 'no sleeper was within its call';
      const you = track(r, 'you')[off];
      for (const e of of(r.steps[off].events, 'woke', x => x.cause.k === 'herald')) if (e.mode !== 'awake' || e.cause.by !== h.uid || e.cause.x !== you[0] || e.cause.y !== you[1]) return `${e.who} woke ${json(e)}`;
      const mimic = r.state.actors.find(b => b.arch === 'mimic_vitrine');
      if (mimic.mode !== 'dormant' || !Archetypes.present(r.state, mimic)) return 'the mimic in its disguise woke';
      return null;
    },
  });
  test('the herald, joined up: woken by your noise out of its sight, it comes to look, calls on seeing you, and the call wakes the sleepers within its range that can hear', () => {
    ok(H.sweep(C, heraldCalls, list('herald')), heraldCalls.name);
  });

  // ---- The tethered warden: drawn by a noise as far as its tether lets it, never past it; it
  // starts no fight while you stand outside its tether; step inside, and it fights you. ----
  // It guards (3, 4); the lure is 3 tiles east of that, just outside its tether; you stand 8
  // tiles east of the lure, so that the fork reaches it (within 8, in your sight) but nothing
  // within the warden's tether is within its sight of you (SIGHT_EXHIBIT): it is drawn by
  // hearing alone. Then you walk in until you stand within its tether.
  const ROOM = ['#################', ...Array.from({ length: 7 }, () => '#...............#'), '#################'];
  const G = [3, 4], LURE = [6, 4], FAR = [14, 4];
  const inTether = (p, R) => (p[0] - G[0]) * (p[0] - G[0]) + (p[1] - G[1]) * (p[1] - G[1]) <= R * R + R;
  const wardenDrawn = H.scenario({
    name: 'a warden woken by a noise beyond its tether comes to look as far as its tether, never past it, and fights you only once you step inside it',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: accOf(sp), depth, map: ROOM, you: FAR.slice(), items: [FORK],
      exhibits: [{ sp: sp.id, at: G.slice(), stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
    // Three fork strikes at the lure, 3 tiles from what it guards; then you wait 6 turns
    // outside its tether; then you walk in, to beside what it guards, and stand.
    actions: (s, i, c) => {
      if (i < N.TUNING_FORK[0]) return { a: 'use', uid: FORK.uid, x: LURE[0], y: LURE[1] };
      if (i < N.TUNING_FORK[0] + 6) return { a: 'wait' };
      const you = s.actors[0];
      if (!inTether([you.x, you.y], c.params.TETHER_RANGE)) return i < 40 ? { a: 'move', dir: 6 } : null;
      return i < 40 ? { a: 'wait' } : null;
    },
    expect(r, params) {
      const w = r.start.actors[1], R = params.TETHER_RANGE, [lo, hi] = range(params.dmg);
      if (json(w.guards) !== json(G)) return `it guards ${json(w.guards)}, not its own tile`;
      if (inTether(LURE, R) || !inTether([LURE[0] - 1, LURE[1]], R)) return 'this scenario needs the lure just outside its tether';
      for (let y = 0; y < ROOM.length; y++) for (let x = 0; x < ROOM[0].length; x++) if (inTether([x, y], R) && Grid.disc(x - FAR[0], y - FAR[1], N.SIGHT_EXHIBIT)) return 'this scenario needs you out of its sight from within its tether';
      const woke = r.steps.findIndex(st => st.events.some(e => e.k === 'woke' && e.who === w.uid));
      const we = woke >= 0 ? r.steps[woke].events.find(e => e.k === 'woke' && e.who === w.uid) : null;
      if (!we || we.mode !== 'awake' || we.cause.k !== 'noise' || we.cause.x !== LURE[0]) return `the lure did not wake it awake: ${json(we)}`;
      const t = track(r, w.uid), y = track(r, 'you');
      const out = t.findIndex(p => !inTether(p, R));
      if (out >= 0) return `it stood at ${t[out]}, outside its tether, at step ${out}`;
      // Drawn: before you came near, it reached the edge of its tether, a step from the lure.
      const before = t.slice(0, N.TUNING_FORK[0] + 6).reduce((best, p) => Math.min(best, Math.max(Math.abs(p[0] - LURE[0]), Math.abs(p[1] - LURE[1]))), 99);
      if (before !== 1) return `the lure drew it no nearer than ${before} steps`;
      // No fight while you stood outside its tether; a blow or a ring once you were inside.
      for (let i = 0; i < r.steps.length; i++) {
        const hit = r.steps[i].events.filter(e => (e.k === 'attacked' && e.by === w.uid) || (e.k === 'telegraphed' && e.who === w.uid));
        if (hit.length && !inTether(y[i], R) && !inTether(y[i + 1], R)) return `it fought you at step ${i}, with you outside its tether`;
      }
      const blows = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === w.uid && e.cause.k === 'attack');
      if (!blows.length) return 'inside its tether, it never struck you';
      const bad = blows.find(e => e.cause.raw < lo || e.cause.raw > hi);
      return bad ? `a blow rolled ${bad.cause.raw}, outside ${params.dmg}` : null;
    },
  });
  test('the tethered warden, joined up: drawn by your noise to the edge of its tether and no further; inside it, it fights you', () => {
    ok(H.sweep(C, wardenDrawn, list('tethered_warden')), wardenDrawn.name);
  });

  // ---- The kiter: woken by your noise out of its sight, it comes to look; seeing you, it
  // hunts, walks in to its distance and shoots you only from there. ----
  // A longer west room: you stand at (3, 3), 8 tiles from the gap at (11, 3), so that the
  // kiter, come to look at the gap, first sees you from beyond ROLE_ARTILLERY_RANGE (and
  // beyond KITER_HOLD1 walking steps), though within its sight. A kiter that shot on sight,
  // or from outside its band, would shoot from there; this one must walk in first.
  const LONG = ['###################', '#..........#......#', '#..........#......#', '#.................#', '#..........#......#', '#..........#......#', '###################'];
  const KGAP = [11, 3], KYOU = [3, 3], KAT = [13, 1];
  const kiterSees = H.scenario({
    name: 'a kiter woken by your noise comes to look; seeing you from beyond its range it hunts, walks in to KITER_HOLD0 to KITER_HOLD1 tiles off, and shoots you from there within ROLE_ARTILLERY_RANGE',
    id: 'kiter', clone: true,
    build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: accOf(sp), depth, map: LONG, you: KYOU.slice(), items: [FORK],
      exhibits: [{ sp: sp.id, at: KAT.slice(), stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
    actions: (s, i) => (i < N.TUNING_FORK[0] ? { a: 'use', uid: FORK.uid, x: KGAP[0], y: KGAP[1] } : null) || (i < 24 ? { a: 'wait' } : null),
    expect(r, params) {
      const k = r.start.actors[1], [lo, hi] = range(params.dmg), R = params.ROLE_ARTILLERY_RANGE, [near, far] = [params.KITER_HOLD0, params.KITER_HOLD1];
      const m = r.start.dept, walk = Grid.distances(m, [KYOU], m.w * m.h, null, 'exhibit'), steps = p => walk[p[1] * m.w + p[0]];
      const inRange = p => { const dx = p[0] - KYOU[0], dy = p[1] - KYOU[1]; return dx * dx + dy * dy <= R * R + R; };
      // The geometry this scenario needs: the gap in your sight and its, out of range and band.
      if (!sees(m, KGAP, KYOU) || inRange(KGAP) || steps(KGAP) <= far) return 'this scenario needs you seen from the gap, beyond its range and band';
      // It woke awake to the noise at the gap, the third strike's pip.
      const wi = r.steps.findIndex(st => st.events.some(e => e.k === 'woke' && e.who === k.uid));
      const we = wi >= 0 ? r.steps[wi].events.find(e => e.k === 'woke' && e.who === k.uid) : null;
      if (!we || we.mode !== 'awake' || we.cause.k !== 'noise' || we.cause.by !== 'you' || json([we.cause.x, we.cause.y]) !== json(KGAP)) return `the fork's noise did not wake it awake: ${json(we)}`;
      if (wi !== N.PIPS_TO_WAKE - 1) return `it woke at the fork's ${wi + 1}th strike, not its ${N.PIPS_TO_WAKE}th`;
      const seen = r.steps.findIndex(st => st.events.some(e => e.k === 'hunting' && e.who === k.uid));
      if (seen < 0) return 'it never saw you';
      const hunt = r.steps[seen].events.find(e => e.k === 'hunting' && e.who === k.uid);
      if (hunt.cause.k !== 'seen') return `it began to hunt ${json(hunt.cause)}, not on seeing you`;
      const t = track(r, k.uid);
      // Where it stood when it began to hunt (its last step before the hunting event): beyond
      // its range, as laid out.
      let spotted = [k.x, k.y];
      for (const e of r.events.slice(0, r.events.indexOf(hunt))) if (e.k === 'moved' && e.who === k.uid) spotted = e.to;
      if (inRange(spotted)) return `it first saw you from ${spotted}, within ${R} tiles, which this scenario does not test`;
      const shots = [];
      r.steps.forEach((st, i) => { for (const e of st.events) if (e.k === 'attacked' && e.by === k.uid) shots.push({ i, e }); });
      if (!shots.length) return 'it never shot you';
      for (const { i, e } of shots) {
        if (i < seen) return `it shot at step ${i}, before it saw you at ${seen}`;
        if (e.how.kind !== 'shot') return `its attack was ${json(e.how)}, not a shot`;
        const from = t[i + 1];
        if (!inRange(from)) return `it shot from ${from}, beyond ${R} tiles`;
        if (!sees(m, from, KYOU)) return `it shot from ${from}, which has no sight of you`;
        if (steps(from) < near || steps(from) > far) return `it shot from ${from}, ${steps(from)} walking steps from you, not ${near} to ${far}`;
      }
      // Once in its band, it keeps to it: never nearer than KITER_HOLD0, never beyond KITER_HOLD1.
      const first = shots[0].i + 1, off = t.slice(first).find(p => steps(p) < near || steps(p) > far);
      if (off) return `after its first shot it stood at ${off}, ${steps(off)} walking steps from you`;
      const hurt = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === k.uid);
      const bad = hurt.find(e => e.cause.raw < lo || e.cause.raw > hi);
      return bad ? `a shot rolled ${bad.cause.raw}, outside ${params.dmg}` : null;
    },
  });
  test('the kiter, joined up: woken by your noise, it comes to look; seeing you from beyond its range, it walks in to its band and shoots only from there, in sight and in range', () => {
    ok(H.sweep(C, kiterSees, list('kiter')), kiterSees.name);
  });

  // ---- The mimic in its department: touched through a real open (or, where its lock is
  // beyond your grade, a real bash) of its case. ----
  test('the mimic, joined up, in every S.9 department that places one at depths 1–7: opened (or bashed) where it stands, it grips you, wakes hunting, shows itself and strikes', () => {
    let n = 0;
    for (const depth of H.DEPTHS) for (const seed of [1, 2, 3]) {
      const s = Dept.create(seed, 'S9', depth, { invulnerable: true }), m = s.actors.find(a => a.arch === 'mimic_vitrine' && !a.gone);
      if (!m || !Archetypes.present(s, m)) continue;
      // You stand on a free floor tile beside it, from which the open is not past a corner.
      const you = s.actors[0], f = Cases.at(s, m.x, m.y);
      const spot = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [m.x + dx, m.y + dy])
        .find(([x, y]) => Grid.walkable(s.dept, x, y, 'you') && Grid.ch(s.dept, x, y) === '.' && !Actors.at(s, x, y));
      if (!spot) continue;
      you.x = spot[0]; you.y = spot[1];
      const act = f.lock <= s.run.grade ? 'open' : 'bash';
      const r = H.play(C, s, [{ a: act, x: m.x, y: m.y }].concat(Array.from({ length: 10 }, () => ({ a: 'wait' }))), { clone: true });
      const where = `S9 d${depth} seed ${seed} (${act})`;
      assert.equal(json(r.violations.map(v => v.text)), '[]', where);
      const e0 = r.steps[0].events;
      assert.notEqual(e0[0].k, 'refused', `${where}: ${json(e0[0])}`);
      const grip = e0.find(e => e.k === 'status' && e.id === 'rooted' && e.on && e.who === 'you');
      assert.ok(grip && grip.cause.k === 'grip' && grip.cause.by === m.uid && grip.turns === N.MIMIC_GRIP_TURNS, `${where}: the grip ${json(grip)}`);
      const woke = e0.find(e => e.k === 'woke' && e.who === m.uid);
      assert.ok(woke && woke.mode === 'hunting' && woke.cause.k === 'touch_case' && woke.cause.itself, `${where}: ${json(woke)}`);
      assert.ok(e0.indexOf(grip) < e0.findIndex(e => e.k === 'noise'), `${where}: the grip comes before the noise`);
      assert.equal(Archetypes.present(r.state, m), null, `${where}: it showed itself`);
      assert.ok(r.events.some(e => e.k === 'attacked' && e.by === m.uid), `${where}: it struck`);
      const line = Clauses.line(C.Packs.speciesFor(s, m), { depth });
      assert.ok(line.includes(`cannot move for ${N.MIMIC_GRIP_TURNS} turns`), line);
      n++;
    }
    assert.ok(n >= 14, `${n} departments' mimics touched`);
  });
};
