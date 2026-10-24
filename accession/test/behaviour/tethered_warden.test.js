// ACCESSION — the tethered_warden's Behaviour line (BUILD.md §5.3; W1-ARCH-C): "Stays within
// {TETHER_RANGE} tiles of what it guards. It strikes from beside you for {dmg}; beside you, at
// most one action in {ROLE_WARDEN_SPECIAL_EVERY} since it woke, it marks the tiles round it for a
// turn, then strikes everything on them for {gross} before Padding. If you are not within
// {TETHER_RANGE} tiles of what it guards, it goes back, heals fully and settles." Each scenario
// runs for every pack warden (S9.4) at depths 1–7, as a function of the clause's parameters,
// with every invariant and a clone checked after every step. "Within r" is dx² + dy² ≤ r² + r
// (§8.2), written out here.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Specials, Wake, Roles, N, AI, Archetypes, Clauses, Grid } = C;
  const json = x => JSON.stringify(x);
  const within = (g, x, y, r) => (x - g[0]) * (x - g[0]) + (y - g[1]) * (y - g[1]) <= r * r + r;
  const range = s => s.includes('–') ? s.split('–').map(Number) : [Number(s), Number(s)];
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const warden = s => s.actors.find(a => a.arch === 'tethered_warden');
  const strong = s => { s.actors[0].hp = s.actors[0].maxHp = 999; return s; };
  const list = id => { const l = H.species(C, id); assert.ok(l.length >= 7, `${id}: ${l.length} species and depths`); return l; };
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const ROOM = ['#################', '#...............#', '#...............#', '#...............#', '#...............#', '#...............#', '#...............#', '#...............#', '#################'];
  const G = [5, 4];
  const make = (sp, depth, opts, you, extra) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: ROOM, you,
    exhibits: [Object.assign({ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) }, extra || {})] }, { rulesOff: opts.rulesOff }));

  // Beside you, it strikes, and marks its ring at its EVERY-th action and every EVERY after;
  // what the ring deals is what its mark showed the moment before (§8.1).
  let log = [];
  const rings = H.scenario({
    name: 'beside you it strikes for its damage range, and one action in every few it marks the tiles round it, which then deal what they showed',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => make(sp, depth, opts, [G[0] + 1, G[1]]),
    actions: (s, i) => { if (i === 0) log = []; log.push({ acts: warden(s).acts, marks: Specials.marks(s) }); return i < 16 ? { a: 'wait' } : null; },
    expect(r, params) {
      const E = params.ROLE_WARDEN_SPECIAL_EVERY, [lo, hi] = range(params.dmg), w = warden(r.state), you = r.start.actors[0];
      log.push({ acts: w.acts, marks: Specials.marks(r.state) });
      // Its acts after step i is log[i + 1].acts; a ring is marked in a step in which it acted once.
      const at = [];
      r.steps.forEach((st, i) => { if (st.events.some(e => e.k === 'telegraphed' && e.who === w.uid)) at.push(log[i + 1].acts); });
      const want = []; for (let k = E; k <= log[log.length - 1].acts; k += E) want.push(k);
      if (json(at) !== json(want) || at.length < 3) return `it marked its ring at its actions ${json(at)}; ${json(want)} were expected`;
      for (let i = 0; i < r.steps.length; i++) {
        for (const e of r.steps[i].events) {
          if (e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special') {
            const shown = log[i].marks.find(m => m.x === you.x && m.y === you.y && m.by === w.uid);
            if (!shown || shown.dmg !== e.amount) return `its ring dealt ${e.amount} at step ${i}, but the floor showed ${shown && shown.dmg}`;
          }
          if (e.k === 'damaged' && e.who === 'you' && e.cause.k === 'attack' && (e.cause.raw < lo || e.cause.raw > hi)) return `a blow rolled ${e.cause.raw}, outside ${params.dmg}`;
        }
      }
      if (!r.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'attack')) return 'no blow landed';
      return null;
    },
  });

  test('beside you it strikes for {dmg}, and marks its ring one action in every ROLE_WARDEN_SPECIAL_EVERY since it woke, which deals what it showed', () => {
    ok(H.sweep(C, rings, list('tethered_warden')), rings.name);
  });

  // The ring's number: max(1, gross − your Padding), for everything on its tiles.
  const ring = H.scenario({
    name: 'its ring strikes everything on its tiles for its gross number less each one\'s Padding',
    id: 'ring', clone: true,
    build: (params, sp, depth, opts) => {
      const s = Setup.room(opts.seed, { acc: 'T0', depth, map: ROOM, you: [G[0] + 1, G[1]], kit: { garment: { form: 'heavy', tier: 2 } },
        exhibits: [{ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) },
          { sp: 'dummy', at: [G[0] - 1, G[1] + 1], mode: 'dormant', stats: { hp: 999, acc: 0, eva: 0, pad: 2, dmin: 1, dmax: 1 } }] }, { rulesOff: opts.rulesOff });
      s.actors[1].acts = N.ROLE_WARDEN_SPECIAL_EVERY - 1;
      return strong(s);
    },
    actions: waits(2),
    expect(r, params) {
      const hits = r.steps[1].events.filter(e => e.k === 'damaged' && e.cause.k === 'special');
      const pads = { you: r.start.actors[0].pad, [r.start.actors[2].uid]: 2 };
      if (hits.length !== 2) return `the ring hit ${hits.length} actors, not the 2 on its tiles`;
      for (const e of hits) if (e.amount !== Math.max(N.DMG_MIN_ON_HIT, params.gross - pads[e.who]) || e.cause.gross !== params.gross) return `it dealt ${e.who} ${e.amount} of gross ${e.cause.gross}; ${params.gross} less Padding ${pads[e.who]} was expected`;
      return null;
    },
  });

  test('its ring strikes everything on its tiles for {gross} less each one\'s Padding', () => {
    ok(H.sweep(C, ring, list('ring')), ring.name);
  });

  // You walk away: it follows only within its tether, and when you are outside it, it goes
  // back and does not fight you.
  const leash = H.scenario({
    name: 'it follows you only within its tether, and when you leave the tether it goes back instead of fighting',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => make(sp, depth, opts, [G[0] + 1, G[1]]),
    actions: Array.from({ length: 7 }, () => ({ a: 'move', dir: 2 })).concat(waits(6), Array.from({ length: 6 }, () => ({ a: 'move', dir: 6 })), waits(4)),
    expect(r, params) {
      const R = params.TETHER_RANGE, w = warden(r.start);
      // The first step after which you stand outside its tether, by the formula.
      let first = -1;
      for (let i = 0, x = G[0] + 1; i < 7; i++) { x++; if (!within(G, x, G[1], R)) { first = i; break; } }
      const lost = r.steps.map(st => st.events.some(e => e.k === 'lost' && e.who === w.uid && e.cause.k === 'tether'));
      if (lost.indexOf(true) !== first) return `it went back first at step ${lost.indexOf(true)}; step ${first} was expected, when you first stood outside its tether`;
      for (const st of r.steps) for (const e of st.events) if (e.k === 'moved' && e.who === w.uid && !within(G, e.to[0], e.to[1], R)) return `it stepped to ${e.to}, outside its tether`;
      // Back within its tether (from step 18), it fights you again: a blow or its ring.
      if (!r.steps.slice(18).some(st => st.events.some(e => (e.k === 'attacked' && e.by === w.uid) || (e.k === 'telegraphed' && e.who === w.uid)))) return 'back inside its tether, it did not fight you again';
      return null;
    },
  });

  test('it never goes more than TETHER_RANGE from what it guards, and goes back when you leave its tether', () => {
    ok(H.sweep(C, leash, list('tethered_warden')), leash.name);
  });

  // You stand within its tether, but behind a wall that only a way outside the tether goes
  // round: it stays inside and does not come round.
  const WALLED = ROOM.map((row, y) => y === G[1] + 1 ? row.slice(0, G[0] - 2) + '#####' + row.slice(G[0] + 3) : row);
  const detour = H.scenario({
    name: 'it will not go round outside its tether to reach you, even while you stand within it',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: WALLED, you: [G[0], G[1] + 2],
      exhibits: [{ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff })),
    actions: waits(10),
    expect(r, params) {
      const w = warden(r.state), R = params.TETHER_RANGE;
      if (!within(G, G[0], G[1] + 2, R)) return 'this scenario needs you within its tether';
      for (const e of r.events) if (e.k === 'moved' && e.who === w.uid && !within(G, e.to[0], e.to[1], R)) return `it stepped to ${e.to}, outside its tether`;
      if (r.events.some(e => e.k === 'lost' && e.who === w.uid)) return 'it went back, though you stayed within its tether';
      return null;
    },
  });

  test('it will not leave its tether to go round to you', () => {
    ok(H.sweep(C, detour, list('tethered_warden')), detour.name);
  });

  // A core in which going back is stood in for as W1-WAKE-B builds it (AI.byMode, BUILD.md
  // §8.2): returning walks home and, on arriving, reinstalls (returned, then onHome);
  // REINSTALL_TURNS later it sleeps with 1 pip. Only this package's invariants run with it.
  function goingBack() {
    const X = loadCore(), orig = X.AI.byMode;
    X.AI.byMode = (state, a, ev) => {
      if (a.mode === 'returning' && a.home) {
        const t = X.AI.towards(state, a, a.home, 'onto', ev);
        if (t !== null) return t;
        if (a.x === a.home[0] && a.y === a.home[1]) { X.Wake.setMode(state, a, 'reinstalling', { k: 'home', x: a.x, y: a.y }, ev); X.Archetypes.onHome(state, a, ev); }
        return X.AI.wait(state, a, ev);
      }
      if (a.mode === 'reinstalling') {
        if (state.turn - a.stim >= X.N.REINSTALL_TURNS) { X.Wake.setMode(state, a, 'dormant', { k: 'home', x: a.x, y: a.y }, ev); a.pips = 1; a.stim = state.turn; }
        return X.AI.wait(state, a, ev);
      }
      return orig(state, a, ev);
    };
    return X;
  }
  // Two rooms joined by a doorway: you walk out of its tether and out of its sight.
  const TWO = ['#############', '#.....#.....#', '#.....#.....#', '#...........#', '#.....#.....#', '#.....#.....#', '#############'];
  const home = H.scenario({
    name: 'when you leave its tether it goes back, heals fully when it reaches home, and settles',
    id: 'tethered_warden', clone: true, inv: ['arch-c'],
    build: (params, sp, depth, opts) => {
      const st = Roles.stats(sp.role, depth);
      return strong(Setup.room(opts.seed, { acc: 'T0', depth, map: TWO, you: [4, 3],
        exhibits: [{ sp: sp.id, at: [3, 3], mode: 'hunting', stats: st, hp: st.hp - 7, maxHp: st.hp }] }, { rulesOff: opts.rulesOff }));
    },
    actions: [2, 2, 2, 2, 1, 1].map(dir => ({ a: 'move', dir })).concat(waits(14)),
    expect(r) {
      const w = warden(r.state), heals = r.events.filter(e => e.k === 'healed' && e.who === w.uid);
      if (heals.length !== 1 || heals[0].cause.k !== 'home' || heals[0].amount !== 7 || heals[0].hp !== w.maxHp) return `it healed ${json(heals.map(e => [e.amount, e.hp]))}, not once to full (7 to ${w.maxHp})`;
      if (!r.events.some(e => e.k === 'lost' && e.who === w.uid && e.cause.k === 'tether')) return 'it never went back for its tether';
      if (w.mode !== 'dormant' || w.x !== 3 || w.y !== 3) return `it ended ${w.mode} at ${w.x},${w.y}, not asleep at home`;
      return null;
    },
  });

  test('when you leave its tether it goes back, heals fully on reaching home, and settles (going back stood in for as W1-WAKE-B builds it)', () => {
    const X = goingBack();
    ok(H.sweep(X, home, H.species(X, 'tethered_warden')), home.name);
  });

  test('home again, it heals to full with healed (home), and says nothing when it is not hurt', () => {
    for (const { sp, depth } of list('tethered_warden')) {
      const s = make(sp, depth, { seed: 1, rulesOff: [] }, [10, 4]), w = warden(s), ev = [];
      Archetypes.onHome(s, w, ev);
      assert.equal(ev.length, 0, 'at full health nothing happens');
      w.hp = 1;
      Archetypes.onHome(s, w, ev);
      assert.equal(json(ev.map(e => [e.k, e.who, e.amount, e.hp, e.cause.k, e.cause.by])), json([['healed', w.uid, w.maxHp - 1, w.maxHp, 'home', w.uid]]));
      assert.equal(C.Causes.check(ev[0]), null);
      assert.ok(/^.+ is back in its place and heals \d+: health \d+\.$/.test(C.Text.event(ev[0], () => 'the Brooder')), C.Text.event(ev[0]));
    }
  });

  test('noise cannot draw it past the edge: sent to look at a tile outside its tether, it stops at the edge', () => {
    for (const { sp, depth } of list('tethered_warden')) {
      const s = make(sp, depth, { seed: 3, rulesOff: [] }, [14, 1], { mode: 'awake', target: [14, 7] }), w = warden(s), R = N.TETHER_RANGE;
      const seen = [];
      for (let k = 0; k < 12; k++) { if (AI.towards(s, w, [14, 7], 'onto', []) === null) break; seen.push([w.x, w.y]); }
      assert.ok(seen.length >= 2, 'it set off');
      for (const [x, y] of seen) assert.ok(within(G, x, y, R), `it stepped to ${x},${y}`);
      // At the edge: no step it may take gets nearer.
      assert.equal(AI.towards(s, w, [14, 7], 'onto', []), null);
      // Put outside its tether, it may step only nearer to what it guards.
      w.x = G[0] + R + 2; w.y = G[1];
      assert.equal(Archetypes.mayStep(s, w, w.x + 1, w.y), false);
      assert.equal(Archetypes.mayStep(s, w, w.x - 1, w.y), true);
    }
  });

  test('made with the department, a warden guards its own tile, its first ring due at its ROLE_WARDEN_SPECIAL_EVERY-th action; its line names its numbers', () => {
    for (let depth = 1; depth <= 7; depth++) {
      const s = C.Dept.create(depth + 10, 'S9', depth), w = warden(s);
      assert.ok(w, `S9 d${depth} places a warden`);
      assert.equal(json([w.guards, w.ax.due]), json([[w.x, w.y], N.ROLE_WARDEN_SPECIAL_EVERY]));
      const line = Clauses.line(C.Packs.speciesFor(s, w), { depth }), gross = Roles.at(N.ROLE_WARDEN_SPECIAL, depth);
      assert.ok(line.includes(`within ${N.TETHER_RANGE} tiles`) && line.includes(`one action in ${N.ROLE_WARDEN_SPECIAL_EVERY}`) && line.includes(`for ${gross} before Padding`), line);
      assert.ok(!/undefined|NaN|\[object/.test(line), line);
    }
  });

  test('the cadence is counted again from each waking', () => {
    const [{ sp, depth }] = list('tethered_warden');
    const s = make(sp, depth, { seed: 2, rulesOff: [] }, [G[0] + 1, G[1]], { mode: 'dormant' }), w = warden(s);
    assert.equal(Wake.wake(s, w, 'hunting', { k: 'damage', by: 'you' }, []), true);
    let marked = null;
    for (let k = 0; k < 8 && marked === null; k++) { const r = H.play(C, s, waits(1)); assert.equal(json(r.violations), '[]'); if (r.events.some(e => e.k === 'telegraphed' && e.who === w.uid)) marked = w.acts; }
    assert.equal(marked, N.ROLE_WARDEN_SPECIAL_EVERY, 'its first ring comes at its EVERY-th action after waking');
    // Asleep and woken again, the count starts again.
    Wake.setMode(s, w, 'dormant', { k: 'searched' }, []);
    Wake.wake(s, w, 'hunting', { k: 'damage', by: 'you' }, []);
    assert.equal(json([w.acts, w.ax.due]), json([0, N.ROLE_WARDEN_SPECIAL_EVERY]));
  });

  test('an encased warden never marks its ring, and one with no home holds its place when you leave', () => {
    const [{ sp, depth }] = list('tethered_warden');
    const map = ROOM.map((row, y) => y === G[1] ? row.slice(0, G[0]) + 'v' + row.slice(G[0] + 1) : row);
    const s = strong(Setup.room(1, { acc: 'T0', depth, map, you: [G[0] + 1, G[1]], exhibits: [{ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }));
    const r = H.play(C, s, waits(9));
    assert.equal(json(r.violations), '[]');
    assert.ok(!r.events.some(e => e.k === 'telegraphed' || (e.k === 'attacked' && e.by === warden(s).uid)), 'it struck or marked from inside its case');
    const t = make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 4, G[1]], { home: null }), u = warden(t);
    assert.equal(u.home, null);
    const q = H.play(C, t, waits(3));
    assert.equal(json(q.violations), '[]');
    assert.ok(!q.events.some(e => e.who === u.uid && (e.k === 'moved' || e.k === 'lost')), 'with no home it does not go back');
  });

  test('its invariants catch a planted warden that leaves its tether, rings too soon, or heals short of full', () => {
    const [{ sp, depth }] = list('tethered_warden');
    const X = loadCore();
    X.Archetypes.mayStep = () => true;
    const s = strong(X.Setup.room(1, { acc: 'T0', depth, map: WALLED, you: [G[0], G[1] + 2], exhibits: [{ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }));
    assert.ok(H.play(X, s, waits(8), { inv: ['arch-c'] }).violations.some(v => v.inv === 'warden_tether'));
    const t = make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 1, G[1]]);
    warden(t).ax.due = 1;                            // a planted fault: its ring due at once
    assert.ok(H.play(C, t, waits(2), { inv: ['arch-c'] }).violations.some(v => v.inv === 'warden_tether' && /before its/.test(v.message)));
    const Y = loadCore();
    Y.Archetypes.onHome = (state, a, ev) => { a.hp = a.maxHp - 1; Y.Causes.emit(state, ev, 'healed', { who: a.uid, amount: 1, hp: a.hp }, { k: 'home', by: a.uid }); };
    const u = make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 1, G[1]]);
    const orig = Y.AI.byMode;
    Y.AI.byMode = (state, a, ev) => { if (a.arch === 'tethered_warden') { Y.Archetypes.onHome(state, a, ev); return Y.AI.wait(state, a, ev); } return orig(state, a, ev); };
    assert.ok(H.play(Y, u, waits(2), { inv: ['arch-c'] }).violations.some(v => v.inv === 'warden_heal'));
  });
};
