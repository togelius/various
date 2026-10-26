// ACCESSION — the tethered_warden's Behaviour line (BUILD.md §5.3; W1-ARCH-C): "Stays within
// {TETHER_RANGE} tiles of what it guards; if it hunts you and you are not, it goes back instead
// of starting a fight, waits there while it sees you, then heals fully and settles, unless it
// has no home. It strikes from beside you for {dmg}; beside you, at most one action in
// {ROLE_WARDEN_SPECIAL_EVERY} since it woke, it marks the tiles round it for a turn, then
// strikes everything on them for {gross} before Padding." ("Hunts" takes in searching, as in
// §8.2's table, where searching is part of the hunt.) Each scenario runs for every pack warden
// (S9.4) at depths 1–7, as a function of the clause's parameters, with every invariant and a
// clone checked after every step. "Within r" is dx² + dy² ≤ r² + r (§8.2), and "sees" is
// within SIGHT_EXHIBIT with a line of sight (§8.2), both written out here.
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

  // "Sees": your tile within SIGHT_EXHIBIT of its tile, with a line of sight (§8.2).
  const sees = (m, w, you) => within(w, you[0], you[1], N.SIGHT_EXHIBIT) && Grid.los(m, w[0], w[1], you[0], you[1]);
  // Where you and the warden stand after each step, from the events: [{you, w}] (w is its
  // tile when the step ends, which is where it stands at its first action in the next step).
  function trail(r, uid) {
    let you = [r.start.actors[0].x, r.start.actors[0].y], w = (() => { const a = r.start.actors.find(b => b.uid === uid); return [a.x, a.y]; })();
    const out = [];
    for (const st of r.steps) {
      for (const e of st.events) if (e.k === 'moved') { if (e.who === 'you') you = e.to; else if (e.who === uid) w = e.to; }
      out.push({ you: you.slice(), w: w.slice() });
    }
    return out;
  }
  const tetherLost = (st, uid) => st.events.some(e => e.k === 'lost' && e.who === uid && e.cause.k === 'tether');
  const fought = (st, uid) => st.events.some(e => (e.k === 'attacked' && e.by === uid && e.at === 'you') || (e.k === 'telegraphed' && e.who === uid));

  // You walk away in its sight: it follows only within its tether; with you outside it, it
  // does not fight you but goes back to its place and waits there, still hunting, with no
  // going back told (it sees you); back inside, it fights you again.
  const leash = H.scenario({
    name: 'it follows you only within its tether; with you outside it and in its sight, it goes back to its place and waits there instead of fighting',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => make(sp, depth, opts, [G[0] + 1, G[1]]),
    actions: Array.from({ length: 7 }, () => ({ a: 'move', dir: 2 })).concat(waits(6), Array.from({ length: 6 }, () => ({ a: 'move', dir: 6 })), waits(4)),
    expect(r, params) {
      const R = params.TETHER_RANGE, w = warden(r.start), t = trail(r, w.uid);
      for (let i = 0; i < r.steps.length; i++) {
        const st = r.steps[i], out = !within(G, t[i].you[0], t[i].you[1], R);
        if (!sees(r.start.dept, t[i].w, t[i].you)) return `this scenario needs you in its sight, but at step ${i} it could not see you`;
        for (const e of st.events) if (e.k === 'moved' && e.who === w.uid && !within(G, e.to[0], e.to[1], R)) return `it stepped to ${e.to}, outside its tether`;
        if (out && fought(st, w.uid)) return `it fought you at step ${i}, with you at ${t[i].you}, outside its tether`;
        if (st.events.some(e => e.who === w.uid && ['lost', 'hunting', 'returned', 'healed'].includes(e.k))) return `at step ${i} it ${json(st.events.filter(e => e.who === w.uid).map(e => e.k))}; while it sees you it should only wait at its place`;
      }
      // By the end of your waits outside its tether it stands at its place, still hunting.
      const back = t[12];
      if (back.w[0] !== G[0] || back.w[1] !== G[1]) return `after your waits outside its tether it stood at ${back.w}, not at its place ${G}`;
      // Back within its tether (from step 18), it fights you again: a blow or its ring.
      if (!r.steps.slice(18).some(st => fought(st, w.uid))) return 'back inside its tether, it did not fight you again';
      return null;
    },
  });

  test('it never goes more than TETHER_RANGE from what it guards, and while you are outside its tether in its sight it waits at its place instead of fighting', () => {
    ok(H.sweep(C, leash, list('tethered_warden')), leash.name);
  });

  // You stand within its tether, but behind a wall that only a way outside the tether goes
  // round: it stays inside and does not come round. (It may lose track of you and search,
  // then go back, as every hunter does; never for its tether, since you stay within it.)
  const WALLED = ROOM.map((row, y) => y === G[1] + 1 ? row.slice(0, G[0] - 2) + '#####' + row.slice(G[0] + 3) : row);
  const detour = H.scenario({
    name: 'it will not go round outside its tether to reach you, even while you stand within it',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: WALLED, you: [G[0], G[1] + 2],
      exhibits: [{ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff })),
    actions: waits(14),
    expect(r, params) {
      const w = warden(r.state), R = params.TETHER_RANGE;
      if (!within(G, G[0], G[1] + 2, R)) return 'this scenario needs you within its tether';
      for (const e of r.events) if (e.k === 'moved' && e.who === w.uid && !within(G, e.to[0], e.to[1], R)) return `it stepped to ${e.to}, outside its tether`;
      if (r.events.some(e => e.k === 'lost' && e.who === w.uid && e.cause.k === 'tether')) return 'it went back for its tether, though you stayed within it';
      if (r.events.some(e => e.k === 'attacked' && e.by === w.uid)) return 'it struck at you round the wall';
      return null;
    },
  });

  // A ring shown while you stood within its tether still goes off when you step out of the
  // tether onto one of its tiles: leaving starts no fight, but calls off no mark either
  // (§8.1, Cancelling; §8.2). It marks with you at G + (2, 1), within the tether; you step east
  // to G + (3, 1), outside it (9 + 1 > 2² + 2) but still beside it, on its ring; the ring
  // deals what the floor showed and the threat said before the step; then, with you outside,
  // it starts nothing new. Its line says so.
  let shown = [];
  const shownRing = H.scenario({
    name: 'a ring it has shown still strikes you after you step out of its tether onto it, as its mark and the threat said; then it starts no fight',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => {
      const s = make(sp, depth, opts, [G[0] + 2, G[1] + 1], { at: [G[0] + 2, G[1]], guards: G.slice(), home: G.slice() });
      warden(s).acts = params.ROLE_WARDEN_SPECIAL_EVERY;
      return s;
    },
    actions: (s, i) => {
      if (i === 0) shown = [];
      shown.push({ marks: Specials.marks(s), threat: Specials.threat(s, { a: 'move', dir: 2 }) });
      return [{ a: 'wait' }, { a: 'move', dir: 2 }, { a: 'wait' }, { a: 'wait' }][i] || null;
    },
    expect(r, params) {
      const R = params.TETHER_RANGE, w = warden(r.start), at = [G[0] + 3, G[1] + 1];
      if (!within(G, G[0] + 2, G[1] + 1, R) || within(G, at[0], at[1], R)) return 'this scenario needs you to step from within its tether to outside it';
      if (!r.steps[0].events.some(e => e.k === 'telegraphed' && e.who === w.uid && e.sp === 'ring' && e.tiles.some(t => t[0] === at[0] && t[1] === at[1]))) return 'it did not mark its ring, over the tile east of you, with you within its tether';
      const mark = shown[1].marks.find(m => m.x === at[0] && m.y === at[1] && m.by === w.uid);
      if (!mark || !shown[1].threat || shown[1].threat.dmg !== mark.dmg || shown[1].threat.by !== w.uid) return `before your step the floor showed ${json(mark)} and the threat said ${json(shown[1].threat)}; both should name its ring`;
      const hit = r.steps[1].events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special' && e.cause.by === w.uid && e.cause.sp === 'ring');
      if (hit.length !== 1 || hit[0].amount !== mark.dmg || hit[0].cause.x !== at[0] || hit[0].cause.y !== at[1]) return `outside its tether its shown ring dealt ${json(hit.map(e => [e.amount, e.cause.x, e.cause.y]))}; ${mark.dmg} at ${at} was expected`;
      if (r.steps.slice(1).some(st => fought(st, w.uid))) return 'with you outside its tether it struck at you or marked again';
      // Its line must not say it stops fighting outright: it starts no fight, and a ring it has
      // marked "then strikes everything on" its tiles.
      if (/instead of fighting/.test(r.clause) || !/goes back instead of starting a fight/.test(r.clause) || !/marks the tiles round it for a turn, then strikes everything on them/.test(r.clause))
        return `its line does not say that it only starts no fight, while a ring it has marked still strikes: "${r.clause}"`;
      return null;
    },
  });

  test('a ring it has shown still strikes you outside its tether, as the floor and the threat said, and its line does not say otherwise', () => {
    ok(H.sweep(C, shownRing, list('tethered_warden')), shownRing.name);
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
  // Two rooms joined by a doorway at (6, 3); the warden guards (3, 3).
  const TWO = ['#############', '#.....#.....#', '#.....#.....#', '#...........#', '#.....#.....#', '#.....#.....#', '#############'];
  // The step at which it should go back: the first after which you stand outside its tether
  // and out of its sight from where it then stands.
  function dueBack(r, uid, R, g) {
    const t = trail(r, uid);
    for (let i = 0; i < t.length; i++) if (!within(g, t[i].you[0], t[i].you[1], R) && !sees(r.start.dept, i ? t[i - 1].w : [g[0], g[1]], t[i].you)) return i;
    return -1;
  }
  // You walk out of its tether and out of its sight: it goes back once, at its first action
  // with you outside and unseen, and never fights you outside its tether.
  const outOfSight = {
    name: 'when you leave its tether and its sight it goes back, once, at its first action after',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => {
      const st = Roles.stats(sp.role, depth);
      return strong(Setup.room(opts.seed, { acc: 'T0', depth, map: TWO, you: [4, 3],
        exhibits: [{ sp: sp.id, at: [3, 3], mode: 'hunting', stats: st, hp: st.hp - 7, maxHp: st.hp }] }, { rulesOff: opts.rulesOff }));
    },
    actions: [2, 2, 2, 2, 1, 1].map(dir => ({ a: 'move', dir })).concat(waits(14)),
    expect(r, params) {
      const w = warden(r.start), want = dueBack(r, w.uid, params.TETHER_RANGE, [3, 3]), lost = r.steps.map(st => tetherLost(st, w.uid));
      if (want < 0) return 'this scenario needs you to leave its tether and its sight';
      if (lost.indexOf(true) !== want || lost.filter(Boolean).length !== 1) return `it went back for its tether at steps ${json(lost.map((x, i) => x ? i : -1).filter(i => i >= 0))}; once, at step ${want}, was expected`;
      const t = trail(r, w.uid);
      for (let i = 0; i < r.steps.length; i++) if (!within([3, 3], t[i].you[0], t[i].you[1], params.TETHER_RANGE) && fought(r.steps[i], w.uid)) return `it fought you at step ${i}, outside its tether`;
      return null;
    },
  };
  const away = H.scenario(outOfSight);
  // The same, going back as W1-WAKE-B builds it: it heals fully on reaching home, and settles.
  const home = H.scenario(Object.assign({}, outOfSight, {
    name: 'when you leave its tether and its sight it goes back, heals fully when it reaches home, and settles',
    inv: ['arch-c'],
    expect(r, params) {
      const first = outOfSight.expect(r, params);
      if (first) return first;
      const w = warden(r.state), heals = r.events.filter(e => e.k === 'healed' && e.who === w.uid);
      if (heals.length !== 1 || heals[0].cause.k !== 'home' || heals[0].amount !== 7 || heals[0].hp !== w.maxHp) return `it healed ${json(heals.map(e => [e.amount, e.hp]))}, not once to full (7 to ${w.maxHp})`;
      if (w.mode !== 'dormant' || w.x !== 3 || w.y !== 3) return `it ended ${w.mode} at ${w.x},${w.y}, not asleep at home`;
      return null;
    },
  }));

  test('when you leave its tether and its sight it goes back once, and never fights you outside its tether', () => {
    ok(H.sweep(C, away, list('tethered_warden')), away.name);
  });
  test('when you leave its tether it goes back, heals fully on reaching home, and settles (going back stood in for as W1-WAKE-B builds it)', () => {
    const X = goingBack();
    ok(H.sweep(X, home, H.species(X, 'tethered_warden')), home.name);
  });

  // Watched from outside its tether. It stands at home, hurt; you stand in its sight, 4 tiles
  // off through the doorway, for 20 turns: it waits there, still hunting, with nothing told
  // and no healing (it neither turns back and forth between going back and hunting, nor heals
  // again and again); then you step out of its sight, and it goes back, once, heals and
  // settles.
  const watched = {
    name: 'watched from outside its tether it waits at its place, quietly; out of its sight, it goes back once, heals and settles',
    id: 'tethered_warden', clone: true,
    build: (params, sp, depth, opts) => {
      const st = Roles.stats(sp.role, depth);
      return strong(Setup.room(opts.seed, { acc: 'T0', depth, map: TWO, you: [7, 3],
        exhibits: [{ sp: sp.id, at: [3, 3], mode: 'hunting', stats: st, hp: st.hp - 7, maxHp: st.hp }] }, { rulesOff: opts.rulesOff }));
    },
    actions: waits(20).concat([{ a: 'move', dir: 2 }, { a: 'move', dir: 1 }], waits(8)),
    expect(r, params) {
      const w = warden(r.start), t = trail(r, w.uid);
      if (within([3, 3], 7, 3, params.TETHER_RANGE) || !sees(r.start.dept, [3, 3], [7, 3])) return 'this scenario needs you outside its tether and in its sight';
      for (let i = 0; i < 21; i++) {
        const mine = r.steps[i].events.filter(e => e.who === w.uid || e.by === w.uid);
        if (mine.length) return `watched at step ${i}, it ${json(mine.map(e => e.k + '.' + (e.cause && e.cause.k)))}; it should wait at its place, telling nothing`;
        if (t[i].w[0] !== 3 || t[i].w[1] !== 3) return `watched, it left its place for ${t[i].w}`;
      }
      const want = dueBack(r, w.uid, params.TETHER_RANGE, [3, 3]), lost = r.steps.map(st => tetherLost(st, w.uid));
      if (want !== 21 || lost.indexOf(true) !== want || lost.filter(Boolean).length !== 1) return `it went back for its tether at steps ${json(lost.map((x, i) => x ? i : -1).filter(i => i >= 0))}; once, at step 21, when you left its sight, was expected (${want})`;
      return null;
    },
  };
  const watch = H.scenario(watched);
  const watchHome = H.scenario(Object.assign({}, watched, {
    name: 'watched from outside its tether it does not heal; out of its sight, it goes back, heals fully once and settles',
    inv: ['arch-c'],
    expect(r, params) {
      const first = watched.expect(r, params);
      if (first) return first;
      const w = warden(r.state), heals = r.events.filter(e => e.k === 'healed' && e.who === w.uid);
      if (heals.length !== 1 || heals[0].amount !== 7 || r.steps.slice(0, 21).some(st => st.events.some(e => e.k === 'healed'))) return `it healed ${json(heals.map(e => [e.turn, e.amount]))}; once, 7, after you left its sight, was expected`;
      if (w.mode !== 'dormant') return `it ended ${w.mode}, not asleep`;
      return null;
    },
  }));

  test('watched from outside its tether it waits quietly at its place; out of its sight it goes back once', () => {
    ok(H.sweep(C, watch, list('tethered_warden')), watch.name);
  });
  test('watched from outside its tether it does not heal; out of its sight it goes back, heals once and settles (going back stood in for as W1-WAKE-B builds it)', () => {
    const X = goingBack();
    ok(H.sweep(X, watchHome, H.species(X, 'tethered_warden')), watchHome.name);
  });

  test('searching for you with you outside its tether and out of its sight, it goes back at once; within it, or with no home, it does not', () => {
    for (const { sp, depth } of list('tethered_warden')) {
      const build = (you, extra) => strong(Setup.room(1, { acc: 'T0', depth, map: TWO, you,
        exhibits: [Object.assign({ sp: sp.id, at: [3, 3], mode: 'searching', lastKnown: [4, 3], stats: Roles.stats(sp.role, depth) }, extra || {})] }));
      // Outside its tether, out of its sight (beyond the doorway's wall): it goes back.
      const s = build([9, 1]), w = warden(s);
      assert.ok(!within([3, 3], 9, 1, N.TETHER_RANGE) && !sees(s.dept, [3, 3], [9, 1]));
      const r = H.play(C, s, waits(1), { clone: true });
      assert.equal(json(r.violations), '[]');
      assert.equal(json(r.events.filter(e => e.who === w.uid && e.k === 'lost').map(e => [e.from, e.to, e.cause.k])), json([['searching', 'returning', 'tether']]), `${sp.id} d${depth}`);
      // Within its tether (but out of its sight, round the wall), it searches on.
      const t = build([2, 1], {}), u = warden(t);
      Grid.set(t.dept, 2, 2, '#'); Grid.set(t.dept, 3, 2, '#'); Grid.set(t.dept, 1, 2, '#');
      assert.ok(within([3, 3], 2, 1, N.TETHER_RANGE) && !sees(t.dept, [3, 3], [2, 1]));
      const q = H.play(C, t, waits(1));
      assert.equal(json(q.violations), '[]');
      assert.ok(!q.events.some(e => e.who === u.uid && e.k === 'lost' && e.cause.k === 'tether'), 'within its tether it does not go back for it');
      // With no home it cannot go back: it searches on, as any homeless exhibit does.
      const h = build([9, 1], { home: null }), v = warden(h);
      const z = H.play(C, h, waits(3));
      assert.equal(json(z.violations), '[]');
      assert.ok(!z.events.some(e => e.who === v.uid && (e.k === 'lost' && e.to === 'returning')) && v.mode !== 'returning', `with no home it went back: ${v.mode}`);
    }
  });

  test('with no home, it never goes back: in its sight it waits at what it guards without fighting you; out of it, it hunts on inside its tether', () => {
    for (const { sp, depth } of list('tethered_warden')) {
      // In its sight, outside its tether, beside it at its edge: no blow, no ring; it goes back
      // to what it guards and waits there.
      const s = make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 3, G[1]], { at: [G[0] + 2, G[1]], guards: G.slice(), home: null }), w = warden(s);
      assert.ok(!within(G, G[0] + 3, G[1], N.TETHER_RANGE) && within(G, G[0] + 2, G[1], N.TETHER_RANGE));
      const r = H.play(C, s, waits(6), { clone: true });
      assert.equal(json(r.violations), '[]');
      assert.ok(!r.events.some(e => (e.k === 'attacked' && e.by === w.uid) || (e.k === 'telegraphed' && e.who === w.uid) || (e.k === 'lost' && e.who === w.uid)), json(r.events.filter(e => e.who === w.uid || e.by === w.uid).map(e => e.k)));
      assert.equal(json([w.x, w.y, w.mode]), json([G[0], G[1], 'hunting']), `${sp.id} d${depth}: it waits at what it guards`);
      // Out of its sight (round the doorway's wall), outside its tether: it never goes back.
      const t = strong(Setup.room(1, { acc: 'T0', depth, map: TWO, you: [9, 1], exhibits: [{ sp: sp.id, at: [3, 3], mode: 'hunting', home: null, stats: Roles.stats(sp.role, depth) }] })), u = warden(t);
      const q = H.play(C, t, waits(6));
      assert.equal(json(q.violations), '[]');
      assert.ok(!q.events.some(e => e.who === u.uid && e.k === 'lost' && e.cause.k === 'tether') && u.mode !== 'returning', `${sp.id} d${depth}: with no home it went back`);
    }
  });

  test('its tether is round what it guards, not round its home', () => {
    for (const { sp, depth } of list('tethered_warden')) {
      // It sleeps at G but guards the tile 2 east; you stand 4 east of G, within 2 of what it
      // guards: it comes for you, inside its tether, and does not go back.
      const g = [G[0] + 2, G[1]], s = make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 4, G[1]], { guards: g }), w = warden(s);
      assert.equal(json([w.home, w.guards]), json([G, g]));
      const r = H.play(C, s, waits(3), { clone: true });
      assert.equal(json(r.violations), '[]');
      assert.ok(r.events.some(e => e.k === 'moved' && e.who === w.uid), `${sp.id} d${depth}: it did not come for you`);
      assert.ok(!r.events.some(e => e.k === 'lost' && e.who === w.uid), 'it went back');
      for (const e of r.events) if (e.k === 'moved' && e.who === w.uid) assert.ok(within(g, e.to[0], e.to[1], N.TETHER_RANGE), `it stepped to ${e.to}, outside its tether`);
    }
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
      assert.ok(line.includes('waits there while it sees you') && line.includes('unless it has no home'), line);
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

  test('an encased warden never marks its ring', () => {
    const [{ sp, depth }] = list('tethered_warden');
    const map = ROOM.map((row, y) => y === G[1] ? row.slice(0, G[0]) + 'v' + row.slice(G[0] + 1) : row);
    const s = strong(Setup.room(1, { acc: 'T0', depth, map, you: [G[0] + 1, G[1]], exhibits: [{ sp: sp.id, at: G.slice(), mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }));
    const r = H.play(C, s, waits(9));
    assert.equal(json(r.violations), '[]');
    assert.ok(!r.events.some(e => e.k === 'telegraphed' || (e.k === 'attacked' && e.by === warden(s).uid)), 'it struck or marked from inside its case');
  });

  test('its invariants catch a planted warden that leaves its tether, rings too soon or too often, heals short of full, or turns back and forth while it sees you', () => {
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
    // A planted warden that rings every other action: it keeps no spacing between its rings.
    const Z = loadCore(), act = Z.Archetypes.act;
    Z.Archetypes.act = (state, a, ev) => { const r = act(state, a, ev); if (a.arch === 'tethered_warden' && a.telegraph && a.telegraph.sp === 'ring' && a.ax.due === a.acts + N.ROLE_WARDEN_SPECIAL_EVERY) a.ax.due = a.acts; return r; };
    const z = H.play(Z, make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 1, G[1]]), waits(12), { inv: ['arch-c'] });
    assert.ok(z.violations.some(v => v.inv === 'warden_tether' && /next is due/.test(v.message)), json(z.violations.map(v => v.message)));
    // A planted warden that turns back whenever you are outside its tether, seen or not: it
    // goes back for its tether while it can see you, and turns to hunt you again at its next
    // action.
    const Q = loadCore(), qact = Q.Archetypes.act;
    Q.Archetypes.act = (state, a, ev) => {
      const you = state.actors[0];
      if (a.arch === 'tethered_warden' && a.mode === 'hunting' && !Q.Grid.disc(you.x - a.guards[0], you.y - a.guards[1], N.TETHER_RANGE)) { Q.Wake.setMode(state, a, 'returning', { k: 'tether' }, ev); return null; }
      return qact(state, a, ev);
    };
    const q = H.play(Q, strong(Q.Setup.room(1, { acc: 'T0', depth, map: TWO, you: [7, 3], exhibits: [{ sp: sp.id, at: [3, 3], mode: 'hunting', stats: Roles.stats(sp.role, depth) }] })), waits(3), { inv: ['arch-c'] });
    assert.ok(q.violations.some(v => v.inv === 'warden_tether' && /though it could see you/.test(v.message)), json(q.violations.map(v => v.message)));
    // A planted warden that, with you outside its tether, rings you at once without showing
    // the ring first: its ring strikes you there, but no ring was shown as the step began.
    const P = loadCore(), pact = P.Archetypes.act;
    P.Archetypes.act = (state, a, ev) => {
      const you = state.actors[0];
      if (a.arch === 'tethered_warden' && !P.Grid.disc(you.x - a.guards[0], you.y - a.guards[1], N.TETHER_RANGE) && Math.max(Math.abs(you.x - a.x), Math.abs(you.y - a.y)) === 1) {
        const tiles = P.Specials.tiles(state, a, 'ring');
        a.telegraph = { sp: 'ring', tiles, from: tiles.map(() => [a.x, a.y]), gross: 5, effect: 'damage', turn: state.turn, tick: state.tick };
        return P.Specials.resolve(state, a, ev);
      }
      return pact(state, a, ev);
    };
    const p = H.play(P, make(sp, depth, { seed: 1, rulesOff: [] }, [G[0] + 3, G[1] + 1], { at: [G[0] + 2, G[1]], guards: G.slice() }), waits(2), { inv: ['arch-c'] });
    assert.ok(p.violations.some(v => v.inv === 'warden_tether' && /no ring of its was shown/.test(v.message)), json(p.violations.map(v => v.message)));
  });
};
