// ACCESSION — the module unobserved_motion (BUILD.md §5.4; MOD-UNOBSERVED): its part on the
// Grazer's line, "Moves {UNOBSERVED_STEP} tiles a turn, but only while you cannot see it (it takes
// no step in your sight, and stops for the turn once a step brings it into view)". Each scenario
// runs for every pack Grazer (S9.1) at depths 1–7, joined up (the real core, every rule in place,
// real actions only, every invariant checked after every step, a clone checked where it says
// so), and is rerun with unobserved_motion switched off, when it must fail (§5.3 check 3). What
// is expected is worked out from the clause and §5.4's one definition of "unobserved" (a tile of
// it in your line of sight within your sight range, or within a lit Lamp's range), each of its
// actions watched as it begins (a core of its own, whose AI.act notes where the Grazer stands and
// whether you can see it then), never from the module's code. Also: the Lamp Corridor (S.9's
// Intro stamp, its staggered columns), its sentences and the log, its form for the validation
// log, departments with Grazers placed by population, and planted faults, each caught.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { N, Grid, Roles, Modules, Text, Labels, Wake } = C;
  const json = x => JSON.stringify(x);
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const ID = 'unobserved_motion';
  const list = () => { const l = H.species(C, 'MODULES.' + ID); assert.ok(l.length >= 7, `${l.length} species and depths`); return l; };
  const grazer = s => s.actors.find(a => a.arch === 'unobserved_mover');
  const lamp = (extra) => Object.assign({ uid: 'lamp', kind: 'curio', where: { at: 'kit', slot: 'curio0' }, prims: [{ id: 'observing', cls: 'M' }] }, extra || {});
  const PART = 'Moves 2 tiles a turn, but only while you cannot see it (it takes no step in your sight, and stops for the turn once a step brings it into view)';

  // Can you see exhibit a now, by §5.4's definition: a tile of it in your line of sight within
  // SIGHT_PLAYER, or, while you wear a lit Lamp, within its range (LAMP_OBSERVE_RANGE).
  function sees(X, s, a) {
    const you = s.actors[0], lit = (s.you && s.you.kit ? s.you.kit.curio : []).some(u => { const it = s.items.find(i => i.uid === u); return it && it.lit === true && (it.prims || []).some(p => p.id === 'observing'); });
    for (const [x, y] of X.Actors.footprint(a)) {
      if (lit && Grid.disc(x - you.x, y - you.y, N.LAMP_OBSERVE_RANGE)) return true;
      if (Grid.disc(x - you.x, y - you.y, N.SIGHT_PLAYER) && Grid.los(s.dept, you.x, you.y, x, y)) return true;
    }
    return false;
  }
  // A core whose AI.act notes, as each Grazer's action begins, its tick, turn and tile, its
  // mode, and whether you can see it then (acts), and as it ends whether you can see it then
  // (after), in the state the scenario built and plays (watching; not its clone-checked twin),
  // cleared as each scenario builds its room.
  let acts = [], watching = null;
  function watched() {
    const X = loadCore(), act = X.AI.act;
    X.AI.act = (s, a, ev) => {
      if (s !== watching || a.arch !== 'unobserved_mover') return act(s, a, ev);
      const rec = { uid: a.uid, tick: s.tick, turn: s.turn, at: [a.x, a.y], mode: a.mode, seen: sees(X, s, a) };
      acts.push(rec);
      const c = act(s, a, ev);
      rec.after = sees(X, s, a);
      return c;
    };
    return X;
  }
  const W = watched();

  // A room in S.9 running its modules (Modules.init, as a department does), with you hard to
  // kill. spec: Setup.room's, or H.room's.
  function room(opts, spec) {
    const s = H.room(C, opts.seed, Object.assign({ acc: 'S9' }, spec), { rulesOff: opts.rulesOff });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    Modules.init(s, C.Packs.get('S9'));
    acts = []; watching = s;
    return s;
  }
  const hunter = (sp, depth, at, lastKnown, more) => Object.assign({ sp: sp.id, at, mode: 'hunting', lastKnown, stim: 0, stats: Roles.stats(sp.role, depth) }, more || {});

  // Its pace, from its actions as they began and its steps (the clause, read as the rule of
  // each turn): an action begun in your sight takes no step, and it acts no more that turn but
  // to strike; out of your sight, it walks, each step its own action, and stops for the turn
  // once a step ends in your sight. `walks(turn)` says whether it had somewhere to go that turn
  // (not beside you, not arrived): then every turn begun out of your sight, with no step into
  // view, holds UNOBSERVED_STEP steps. Returns a message, or null.
  function paced(r, uid, walks) {
    const mine = acts.filter(x => x.uid === uid), byTurn = new Map();
    const steps = r.events.filter(e => e.k === 'moved' && e.who === uid && e.cause === undefined);
    for (const x of mine) { if (!byTurn.has(x.turn)) byTurn.set(x.turn, []); byTurn.get(x.turn).push(x); }
    for (const [turn, xs] of byTurn) {
      const st = steps.filter(e => e.turn === turn), blows = r.events.filter(e => e.k === 'attacked' && e.by === uid && e.turn === turn);
      for (const x of xs) if (x.seen && st.some(e => e.tick === x.tick)) return `turn ${turn}: it stepped at tick ${x.tick}, when you could see it`;
      if (xs[0].seen) {
        if (xs.length > 1) return `turn ${turn}: in your sight at its first action, it acted ${xs.length} times`;
        continue;
      }
      if (st.length > N.UNOBSERVED_STEP) return `turn ${turn}: ${st.length} steps`;
      const into = xs.findIndex((x, k) => k > 0 && x.seen);
      if (into > 0 && xs.length > into) return `turn ${turn}: it acted again after a step brought it into your sight`;
      // A step that ended in your sight (judged as the step ends, where you stand then) is its
      // last action of the turn.
      const stepped = x => st.some(e => e.tick === x.tick), last = xs.findIndex(x => stepped(x) && x.after);
      if (last >= 0 && last + 1 < xs.length) return `turn ${turn}: it acted again after a step brought it into your sight`;
      const intoView = last >= 0;
      if (!intoView && !blows.length && walks(turn) && st.length !== N.UNOBSERVED_STEP) return `turn ${turn}: out of your sight it took ${st.length} steps, not ${N.UNOBSERVED_STEP}`;
    }
    return null;
  }
  // The log's lines for one of your steps, as main.js makes them: of the exhibits in view at
  // its end (on a tile you can see, as the board draws them).
  function logged(s, ev) {
    const v = Vision.visible(s), inView = uid => { const a = s.actors.find(b => b.uid === uid); return !!a && C.Actors.footprint(a).some(([x, y]) => v[y * s.dept.w + x] === 1); };
    return Text.log(ev, Labels.nameOf(s), inView);
  }
  const { Vision } = C;

  // ---- Out of your sight, 2 tiles a turn; into view, it stops; in your sight, no step ----
  // A wall with a gap: it comes round from behind it, after you, where you last were.
  const GAP = ['####################', '#........#.........#', '#........#.........#', '#..................#', '#........#.........#', '#........#.........#', '####################'];
  const comes = H.scenario({
    name: 'out of your sight it comes 2 tiles a turn; the step that brings it into your view ends its turn; in your sight it takes no step',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => room(opts, { depth, map: GAP, you: [2, 1], exhibits: [hunter(sp, depth, [17, 5], [2, 1])] }),
    actions: waits(12),
    expect(r) {
      const g = grazer(r.start), mine = acts.filter(x => x.uid === g.uid);
      const p = paced(r, g.uid, () => true);
      if (p) return p;
      const first = mine.findIndex(x => x.seen);
      if (first < 2) return `it came into your sight at its action ${first}, too soon to show its pace`;
      if (!mine.slice(first).every(x => x.seen) || mine.length - first < 6) return 'once in your sight it did not stay there, still, for 6 turns';
      if (r.events.some(e => e.k === 'moved' && e.who === g.uid && e.tick >= mine[first].tick)) return 'it moved in your sight';
      // Each step is a stride, told in the log only for the step in which it ends in your view.
      const steps = r.events.filter(e => e.k === 'moved' && e.who === g.uid), strides = r.events.filter(e => e.k === 'module' && e.id === ID);
      if (strides.length !== steps.length || strides.some(e => e.rule !== 'stride' || e.who !== g.uid || e.n !== 1)) return `${steps.length} steps, strides ${json(strides)}`;
      return null;
    },
  });
  test('out of your sight it comes 2 tiles a turn; a step into view ends its turn; in your sight it takes no step', () => {
    ok(H.sweep(W, comes, list()), comes.name);
  });

  test('the log tells its strides only in the step it ends in your view, as one line: "… moved n tiles while you could not see it."', () => {
    const sp = C.Packs.species('S9', 'S9.1'), s = room({ seed: 1, rulesOff: [] }, { depth: 3, map: GAP, you: [2, 1], exhibits: [hunter(sp, 3, [17, 5], [2, 1])] });
    const told = [];
    for (let t = 0; t < 8; t++) { const ev = W.Step.step(s, { a: 'wait' }); told.push([ev.filter(e => e.k === 'module' && e.id === ID).length, logged(s, ev).filter(l => / while you could not see it\.$/.test(l))]); }
    const at = told.findIndex(([, l]) => l.length);
    assert.ok(at > 0, json(told));
    assert.ok(told.slice(0, at).every(([n, l]) => n > 0 && !l.length), `strides out of view are not told: ${json(told)}`);
    assert.equal(json(told[at][1]), json([`The Long-Necked Grazer moved ${Text.count(told[at][0], 'tile')} while you could not see it.`]));
    assert.ok(told.slice(at + 1).every(([n, l]) => n === 0 && !l.length), json(told));
  });

  // ---- From beside you it strikes ----
  // It hunts you across an open room, in your sight, and stays still. You walk up beside it: it
  // strikes you from beside you, for its damage, at each of its actions; you walk away, in its
  // sight and yours, and it does not follow.
  const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '#............#', '##############'];
  const strikes = H.scenario({
    name: 'in your sight it stays still, but from beside you it strikes, for its damage; walking away in its sight, you are not followed',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => room(opts, { depth, map: OPEN, you: [2, 3], exhibits: [hunter(sp, depth, [8, 3], [2, 3])] }),
    actions: (s, i) => i < 5 ? { a: 'move', dir: 2 } : i < 9 ? { a: 'wait' } : i < 13 ? { a: 'move', dir: 6 } : null,
    expect(r, params, sp, depth) {
      const g = grazer(r.start), p = paced(r, g.uid, () => true);
      if (p) return p;
      if (r.events.some(e => e.k === 'moved' && e.who === g.uid)) return 'it stepped, though you could always see it';
      const blows = r.events.filter(e => e.k === 'attacked' && e.by === g.uid);
      if (blows.length < 4) return `${blows.length} blows while you stood beside it`;
      if (blows.some(e => e.how.kind !== 'melee' || e.turn < 4 || e.turn > 8)) return 'a blow not from beside you';
      const st = Roles.stats(sp.role, depth), hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === g.uid);
      if (hits.some(e => e.cause.raw < st.dmin || e.cause.raw > st.dmax)) return `a blow outside ${st.dmin}–${st.dmax}`;
      if (r.state.actors[1].mode !== 'hunting') return `it ended ${r.state.actors[1].mode}`;
      return null;
    },
  });
  test('in your sight it stays still, but from beside you it strikes for its damage', () => {
    ok(H.sweep(W, strikes, list()), strikes.name);
  });

  // ---- A Fumigant cloud breaks your sight ----
  // It sees you across an open room, in your sight, and stays still; you throw a Fumigant
  // between you, and the cloud hides it: it comes through the cloud 2 tiles a turn, stops on
  // coming beside you, and strikes.
  const cloud = H.scenario({
    name: 'in your sight it stays still; a Fumigant cloud thrown between you hides it, and it comes on through the cloud 2 tiles a turn',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => {
      const s = room(opts, { depth, map: OPEN, you: [2, 3], exhibits: [hunter(sp, depth, [10, 3], [2, 3])] });
      C.Consumables.startRun(s);
      const it = C.Consumables.make(s, 'fumigant', { at: 'floor', x: 2, y: 3 });
      it.where = { at: 'tote' }; it.n = 1; s.you.tote.push(it.uid);
      return s;
    },
    actions: (s, i) => i < 3 ? { a: 'wait' } : i === 3 ? { a: 'throw', uid: s.items.find(x => x.ck === 'fumigant').uid, x: 5, y: 3 } : i < 12 ? { a: 'wait' } : null,
    expect(r) {
      const g = grazer(r.start), p = paced(r, g.uid, turn => !r.events.some(e => e.k === 'attacked' && e.by === g.uid && e.turn <= turn));
      if (p) return p;
      const laid = r.events.find(e => e.k === 'surface' && e.kind === 'fumigant');
      if (!laid) return 'no cloud was laid';
      const before = r.events.filter(e => e.k === 'moved' && e.who === g.uid && e.tick < laid.tick);
      if (before.length) return `it moved ${before.length} times before the cloud, in your sight`;
      const after = r.events.filter(e => e.k === 'moved' && e.who === g.uid && e.tick >= laid.tick);
      if (after.length < 4) return `behind the cloud it took only ${after.length} steps`;
      if (!r.events.some(e => e.k === 'attacked' && e.by === g.uid)) return 'it never struck';
      return null;
    },
  });
  test('a Fumigant cloud between you breaks your sight: it comes on, 2 tiles a turn', () => {
    ok(H.sweep(W, cloud, list()), cloud.name);
  });

  // ---- A lit Lamp ----
  // Behind a wall you cannot see it; while you wear the Lamp lit, every exhibit within its range
  // counts as seen: it comes on until a step brings it within the Lamp's range, and stops there,
  // behind the wall, as long as the Lamp is lit; hooded, it comes on again.
  const POCKET = ['############', '#....#.....#', '#....#.....#', '#....#.....#', '#....#.....#', '#..........#', '############'];
  const lit = H.scenario({
    name: 'a lit Lamp freezes it behind a wall within its range; hooded, it comes on again',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => room(opts, { depth, map: POCKET, you: [4, 2], exhibits: [hunter(sp, depth, [10, 2], [4, 2])], items: [lamp()] }),
    actions: (s, i) => i === 0 || i === 7 ? { a: 'use', uid: 'lamp' } : i < 10 ? { a: 'wait' } : null,
    expect(r) {
      const g = grazer(r.start), p = paced(r, g.uid, () => true);
      if (p) return p;
      const used = r.events.filter(e => e.k === 'used' && e.item === 'lamp');
      if (used.length !== 2 || used[0].how !== 'light' || used[1].how !== 'hood') return `the Lamp was ${json(used.map(e => e.how))}`;
      const [on, off] = [used[0].tick, used[1].tick], mine = acts.filter(x => x.uid === g.uid);
      // While lit: it stood within the Lamp's range, unseen by your eyes behind the wall, and
      // still, for at least 4 turns.
      const held = mine.filter(x => x.tick > on && x.tick < off && Grid.disc(x.at[0] - 4, x.at[1] - 2, N.LAMP_OBSERVE_RANGE));
      if (held.length < 4 || held.some(x => Grid.los(r.start.dept, 4, 2, x.at[0], x.at[1]))) return `lit, it was held within its range behind the wall at ${held.length} actions`;
      if (r.events.some(e => e.k === 'moved' && e.who === g.uid && e.tick > held[0].tick && e.tick < off)) return 'it moved within the lit Lamp\'s range';
      if (!r.events.some(e => e.k === 'moved' && e.who === g.uid && e.tick > off)) return 'hooded, it did not come on again';
      return null;
    },
  });
  test('a lit Lamp freezes it behind a wall, within its range; hooded, it comes on again', () => {
    ok(H.sweep(W, lit, list()), lit.name);
  });

  // ---- In your sight, nothing that is a walk ----
  // Through an open door you watch two Grazers: one going home, one sent to look at a tile. In
  // your sight neither takes a step, and neither gives up its walk (no "others stand in the way",
  // the target kept); you close the door, and out of your sight each walks on, 2 tiles a turn.
  const DOOR = ['########################', '#...#..................#', "#...'..................#", '#...#..................#', '########################'];
  const walks = H.scenario({
    name: 'in your sight it neither steps nor gives up a walk (going home, or sent to look); out of it, it walks on 2 tiles a turn',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => {
      const st = Roles.stats(sp.role, depth);
      const s = room(opts, { depth, map: DOOR, you: [3, 2], exhibits: [
        { sp: sp.id, at: [13, 1], mode: 'returning', home: [22, 1], stim: 0, stats: st },
        { sp: sp.id, at: [13, 3], mode: 'awake', target: [22, 3], stim: 0, stats: st }] });
      return s;
    },
    actions: (s, i) => i < 3 ? { a: 'wait' } : i === 3 ? { a: 'close', x: 4, y: 2 } : i < 10 ? { a: 'wait' } : null,
    expect(r) {
      const [a, b] = [r.start.actors[1], r.start.actors[2]];
      const shut = r.events.find(e => e.k === 'closed');
      if (!shut) return 'the door was not closed';
      if (r.events.some(e => e.k === 'alerted' && e.cause.k === 'blocked')) return 'a walk was told as blocked';
      for (const g of [a, b]) {
        if (r.events.some(e => e.who === g.uid && e.tick < shut.tick && (e.k === 'moved' || e.k === 'alerted' || e.k === 'lost'))) return `${g.uid} stepped or changed its walk in your sight`;
        const p = paced(r, g.uid, turn => turn * N.TICKS_PER_TURN < shut.tick || !r.events.some(e => e.k === 'moved' && e.who === g.uid && e.to[0] >= 21 && e.turn < turn));
        if (p) return `${g.uid}: ${p}`;
        if (r.events.filter(e => e.k === 'moved' && e.who === g.uid && e.tick > shut.tick).length < 5) return `${g.uid} did not walk on once out of your sight`;
      }
      const end = r.state.actors;
      if (!(end[1].x === 22 && end[1].y === 1 && (end[1].mode === 'reinstalling' || end[1].mode === 'dormant'))) return `going home, it ended at ${end[1].x},${end[1].y}, ${end[1].mode}`;
      if (!r.events.some(e => e.k === 'moved' && e.who === b.uid && e.to[0] === 22 && e.to[1] === 3)) return 'sent to look, it never got there';
      return null;
    },
  });
  test('in your sight it neither steps nor gives up a walk home or to look; out of your sight it walks on', () => {
    ok(H.sweep(W, walks, list()), walks.name);
  });

  // Through the same door you watch two more, beyond their own sight of you: one whose search
  // of where it last knew you were is done, one settling back in that was moved off its home.
  // In your sight neither sets off home nor is told as giving anything up, for longer than its
  // search; you close the door, and out of your sight each goes home (searched; displaced) and
  // settles in there.
  const settles = H.scenario({
    name: 'in your sight a search done, or a Grazer moved off its home while settling in, waits; out of it, it goes home',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => {
      const st = Roles.stats(sp.role, depth);
      return room(opts, { depth, map: DOOR, you: [3, 2], exhibits: [
        { sp: sp.id, at: [13, 1], mode: 'searching', lastKnown: [13, 1], home: [22, 1], stim: 0, stats: st },
        { sp: sp.id, at: [13, 3], mode: 'reinstalling', home: [22, 3], stim: 0, stats: st }] });
    },
    actions: (s, i) => i < 5 ? { a: 'wait' } : i === 5 ? { a: 'close', x: 4, y: 2 } : i < 16 ? { a: 'wait' } : null,
    expect(r) {
      const [c, d] = [r.start.actors[1], r.start.actors[2]], shut = r.events.find(e => e.k === 'closed');
      if (!shut) return 'the door was not closed';
      if (shut.turn <= N.SEARCH_TURNS) return 'the door closed before the search was done';
      if (r.events.some(e => e.k === 'alerted' && e.cause.k === 'blocked')) return 'a walk was told as blocked';
      for (const [g, why, home] of [[c, 'searched', [22, 1]], [d, 'displaced', [22, 3]]]) {
        if (r.events.some(e => e.who === g.uid && e.tick < shut.tick && ['moved', 'alerted', 'lost', 'returned'].includes(e.k))) return `${g.uid} stepped or changed its mode in your sight`;
        const off = r.events.find(e => e.k === 'lost' && e.who === g.uid && e.to === 'returning');
        if (!off || off.cause.k !== why || off.tick < shut.tick) return `${g.uid} set off home ${json(off)}, not out of your sight for ${why}`;
        if (!r.events.some(e => e.k === 'returned' && e.who === g.uid && e.phase === 'arrived' && e.cause.x === home[0] && e.cause.y === home[1])) return `${g.uid} never got home`;
      }
      return null;
    },
  });
  test('in your sight a Grazer whose search is done, or one moved off its home while settling in, waits; out of it, it goes home', () => {
    ok(H.sweep(W, settles, list()), settles.name);
  });

  // ---- The Lamp Corridor: S.9's Intro stamp, its staggered columns ----
  // The stamp's map (content/S9-intro.js, D-STAMPS: "you can see it from some tiles of that way
  // and not from others"), with the Grazer awake on its plinth, its home, hunting you: you walk
  // east along the entrance row from the door, then wait at the far end. It steps off its
  // plinth and moves on the turns a column hides it, and only then.
  const CORRIDOR = ['################', '#.......|......#', '#.......|......#', '#.......|..p...#', '#.......|......#', '#.......|.o.o..#', "#.......'......#", '#.......|......#', '#.......|......#', '#.......|.o....#', '#.......|......#', '################'];
  const corridor = H.scenario({
    name: 'in the Lamp Corridor, walking past it, it moves only on the turns a column hides it from you',
    id: 'MODULES.' + ID, clone: true,
    build: (params, sp, depth, opts) => room(opts, { depth, map: CORRIDOR, you: [8, 6], exhibits: [hunter(sp, depth, [11, 3], [8, 6])] }),
    actions: (s, i) => i < 6 ? { a: 'move', dir: 2 } : i < 14 ? { a: 'wait' } : null,
    expect(r) {
      const g = grazer(r.start), mine = acts.filter(x => x.uid === g.uid);
      const p = paced(r, g.uid, turn => !r.events.some(e => e.k === 'attacked' && e.by === g.uid && e.turn <= turn));
      if (p) return p;
      if (!mine.some(x => x.seen) || !mine.some(x => !x.seen)) return `it was ${mine.every(x => x.seen) ? 'always' : 'never'} in your sight: the columns taught nothing`;
      const steps = r.events.filter(e => e.k === 'moved' && e.who === g.uid);
      if (!steps.length || json(steps[0].from) !== '[11,3]') return 'it never stepped off its plinth';
      return null;
    },
  });
  test('the Lamp Corridor\'s staggered columns: walking past the Grazer, it moves only on the turns a column hides it', () => {
    ok(H.sweep(W, corridor, list()), corridor.name);
  });

  // ---- The Lamp Corridor itself: S.9's Intro, as population makes it ----
  // S.9 with a gallery list (empty: the stamp places the Intro's exhibits, BUILD §5.5), at depths
  // 1–7: its Grazer sleeps on its plinth. You walk to two tiles south of the plinth and wait in
  // its ring until it wakes, walk east along the entrance row past the staggered columns to the
  // Intro's far side, then on, out of its sight, and wait. It steps off its plinth, every step
  // begun while you cannot see it (unobserved.gate, with every other invariant, after every
  // step); once it has lost you and searched, it goes home, steps back onto its plinth, settles
  // in and sleeps there.
  test('the Lamp Corridor (S.9\'s Intro): its Grazer, woken on its plinth, steps off it only while you cannot see it, and goes home onto it and sleeps there', () => {
    const X = loadCore(), { Grid: G, Step } = X;
    X.Packs.get('S9').galleries = [];
    for (let depth = 1; depth <= 7; depth++) {
      const s = X.Dept.create(depth, 'S9', depth), m = s.dept, where = `depth ${depth}`;
      s.actors[0].hp = s.actors[0].maxHp = 9999;
      const g = s.actors.find(a => a.arch === 'unobserved_mover'), home = g.home.slice(), intro = m.rooms.find(r => r.role === 'intro'), ey = m.entrance[1];
      assert.ok(g && g.mode === 'dormant' && G.ch(m, home[0], home[1]) === 'p' && g.x === home[0] && g.y === home[1], `${where}: the Intro's Grazer sleeps on its plinth`);
      const fromG = G.distances(m, [[home[0] + 1, home[1]]], 9999, null);
      let far = null;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y][x] === '.' && fromG[y * m.w + x] <= 30 && (!far || fromG[y * m.w + x] > fromG[far[1] * m.w + far[0]])) far = [x, y];
      const toward = (st, goal) => {
        const d = G.distances(st.dept, [goal], 9999, null), you = st.actors[0];
        let best = null, bv = d[you.y * st.dept.w + you.x];
        for (const a of Step.legal(st).filter(q => q.a === 'move')) { const v = d[(you.y + G.DY[a.dir]) * st.dept.w + you.x + G.DX[a.dir]]; if (v >= 0 && v < bv) { bv = v; best = a; } }
        return best || { a: 'wait' };
      };
      let phase = 0, waited = 0;
      const r = H.play(X, s, (st, i) => {
        const you = st.actors[0], b = st.actors.find(a => a.uid === g.uid), at = t => you.x === t[0] && you.y === t[1];
        if (i >= 160) return null;
        if (phase === 0) { const t = [home[0], home[1] + 2]; if (at(t)) phase = 1; else return toward(st, t); }
        if (phase === 1) { if (b.mode !== 'dormant' || waited > 8) phase = 2; else { waited++; return { a: 'wait' }; } }
        if (phase === 2) { const t = [intro.x1, ey]; if (at(t)) phase = 3; else return toward(st, t); }
        if (phase === 3 && !at(far)) return toward(st, far);
        return { a: 'wait' };
      }, { cap: 200 });
      assert.deepEqual(r.violations.slice(0, 3).map(v => v.text), [], where);
      const mine = r.events.filter(e => e.who === g.uid), steps = mine.filter(e => e.k === 'moved'), end = s.actors.find(a => a.uid === g.uid);
      assert.ok(mine.some(e => e.k === 'woke'), `${where}: it woke`);
      assert.ok(steps.length >= 2 && json(steps[0].from) === json(home), `${where}: it stepped off its plinth (${json(steps.map(e => e.to))})`);
      assert.equal(json(steps[steps.length - 1].to), json(home), `${where}: its last step was back onto its plinth`);
      assert.equal(json(mine.filter(e => e.k === 'returned').map(e => [e.phase, e.cause.x, e.cause.y])), json([['arrived', ...home], ['reinstalled', ...home]]), where);
      assert.equal(json([end.mode, end.x, end.y]), json(['dormant', ...home]), `${where}: it sleeps on its plinth`);
      assert.equal(r.events.filter(e => e.k === 'module' && e.id === ID && e.who === g.uid).length, steps.length, `${where}: each step a stride`);
    }
  });

  // ---- With the module off, or in a room without it, it walks a tile a turn, in your sight too ----
  test('with unobserved_motion off, or in a room without it, it walks a tile a turn, in your sight too, and tells no stride; its line says so', () => {
    const sp = C.Packs.species('S9', 'S9.1');
    for (const [off, modules] of [[true, true], [false, false]]) {
      const s = H.room(C, 1, { acc: 'S9', depth: 3, map: OPEN, you: [2, 3], exhibits: [hunter(sp, 3, [10, 3], [2, 3])] }, { rulesOff: off ? [ID] : [] });
      s.actors[0].hp = 999;
      if (modules) Modules.init(s, C.Packs.get('S9'));
      const r = H.play(C, s, waits(6));
      assert.deepEqual(r.violations.map(v => v.text), []);
      const steps = r.events.filter(e => e.k === 'moved' && e.who === s.actors[1].uid);
      assert.equal(json(steps.map(e => e.turn)), json([0, 1, 2, 3, 4, 5].slice(0, steps.length)));
      assert.ok(steps.length >= 5, `${steps.length} steps`);
      assert.ok(!r.events.some(e => e.k === 'module' && e.id === ID));
    }
  });

  // ---- Its sentences, its form ----
  test('its sentences: a stride, the log\'s one line for a mover\'s strides, nothing for a stride that names no mover; the panel sentence', () => {
    const names = uid => uid === 'x.2' ? 'the Long-Necked Grazer' : uid === 'x.3' ? 'the Long-Necked Grazer' : null;
    const stride = (who, n) => Object.assign({ k: 'module', turn: 3, tick: 300, id: ID, rule: 'stride', cause: { k: ID } }, who ? { who } : {}, n === undefined ? {} : { n });
    assert.equal(Text.event(stride('x.2', 1), names), 'The Long-Necked Grazer moved 1 tile while you could not see it.');
    assert.equal(Text.event(stride('x.2', 2), names), 'The Long-Necked Grazer moved 2 tiles while you could not see it.');
    assert.equal(Text.event(stride(null, 1), names), null, 'a stride that names no mover is never told');
    assert.equal(json(Text.log([stride('x.2', 1), stride('x.3', 1), stride('x.2', 1)], names)),
      json(['The Long-Necked Grazer moved 2 tiles while you could not see it.', 'The Long-Necked Grazer moved 1 tile while you could not see it.']));
    assert.equal(json(Text.log([stride('x.2', 1), stride('x.3', 1)], names, uid => uid === 'x.3')), json(['The Long-Necked Grazer moved 1 tile while you could not see it.']));
    assert.equal(json(Text.log([stride(null, 1), stride(null, 1)], names, () => true)), '[]');
    assert.equal(C.Clauses.sentence(ID, { depth: 3 }), 'The animals move only when you cannot see them.');
  });

  test('its form, for the validation log: no rule fits the form; the gate, the pace and the stop are bespoke', () => {
    assert.equal(json(Modules.form(ID)), json({ rules: [], bespoke: ['UnobservedMotion.act', 'UnobservedMotion.mayStep', 'UnobservedMotion.costPct'] }));
    assert.ok(Modules.bespoke().some(b => b.id === ID));
    for (let depth = 1; depth <= 7; depth++) {
      const sp = C.Packs.species('S9', 'S9.1'), st = Roles.stats(sp.role, depth);
      assert.equal(C.Clauses.line(sp, { depth }), `${PART}, and strikes from beside you for ${st.dmin}–${st.dmax}. Wakes when you stay inside your ring or make noise near it.`);
    }
    // Its pace is UNOBSERVED_STEP's: at 3, a step costs 34 ticks, so at most 3 begin in a turn.
    const X = loadCore([], { numbers: { UNOBSERVED_STEP: 3 } });
    assert.equal(X.UnobservedMotion.stepPct(), 34);
    assert.equal(C.UnobservedMotion.stepPct(), 50);
  });

  // ---- In departments: Grazers placed by population ----
  // S.9 with a gallery list (fixture galleries, as D-PACKS will give it): Grazers asleep on
  // their tiles; a walk to the nearest, a wait beside it until it wakes, then a wander. Every
  // invariant holds after every step, and Grazers stride.
  const GALLERIES = [
    { key: 'intro', name: 'The Lamp Corridor', contents: [] },
    { key: 's1', where: 'central', name: 'The Mount Court', contents: [{ sp: 'S9.1' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }] },
    { key: 's2', where: 'band', name: 'The Brooders\' Bay', contents: [{ sp: 'S9.1' }, { sp: 'S9.4', guards: 'case' }, { sp: 'S9.5', near: 'case' }] },
    { key: 'last', name: 'The Round-Book Room', contents: [{ sp: 'S9.6' }] },
    { key: 'centre', name: 'The Day Curator\'s Case', contents: [{ sp: 'S9.1', count: 2 }] },
    { key: 'coda', name: 'The Night Staff\'s Tea Room', contents: [] },
  ];
  test('in S.9 departments, Grazers placed by population sleep until woken, then stride out of your sight; every invariant holds', () => {
    const X = loadCore();
    X.Packs.get('S9').galleries = JSON.parse(json(GALLERIES));
    let grazers = 0, strides = 0, woke = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const depth = 1 + ((seed - 1) % 7), s = X.Dept.create(seed, 'S9', depth);
      assert.equal(json(s.dept.modules.map(m => [m.id, m.on])), json([[ID, true], ['alarm_network', true]]));
      const gs = s.actors.filter(b => b.arch === 'unobserved_mover');
      grazers += gs.length;
      assert.ok(gs.every(b => b.mode === 'dormant'), `seed ${seed}: Grazers start asleep`);
      s.actors[0].hp = s.actors[0].maxHp = 999;
      let lcg = seed * 7919, near = 0;
      const r = H.play(X, s, (st, i) => {
        if (i >= 160) return null;
        const you = st.actors[0], g = st.actors.find(b => b.arch === 'unobserved_mover' && !b.gone && b.mode === 'dormant');
        const legal = X.Step.legal(st).filter(a => a.a === 'move' || a.a === 'wait');
        if (g && near < 12) {
          const d = X.Grid.distances(st.dept, [[g.x, g.y]], 9999, null), here = d[you.y * st.dept.w + you.x];
          if (here > 2) {
            const best = legal.filter(a => a.a === 'move').sort((p, q) => d[(you.y + X.Grid.DY[p.dir]) * st.dept.w + you.x + X.Grid.DX[p.dir]] - d[(you.y + X.Grid.DY[q.dir]) * st.dept.w + you.x + X.Grid.DX[q.dir]] || p.dir - q.dir)[0];
            if (best) return best;
          }
          near++;
          return { a: 'wait' };
        }
        lcg = (lcg * 1103515245 + 12345) % 2147483648;
        return legal[lcg % legal.length];
      }, {});
      assert.deepEqual(r.violations.slice(0, 3).map(v => v.text), [], `S9 seed ${seed}`);
      strides += r.events.filter(e => e.k === 'module' && e.id === ID && e.rule === 'stride').length;
      woke += r.events.filter(e => e.k === 'woke' && gs.some(g => g.uid === e.who)).length;
    }
    assert.ok(grazers >= 12, `${grazers} Grazers placed`);
    assert.ok(woke >= 3 && strides >= 6, `${woke} Grazers woke, ${strides} strides`);
  });

  // ---- Planted faults, each caught ----
  // A fresh core with one rule broken; the scenario named must then fail, by its invariants or
  // its expectation, at depth 3. (Each plant is put into the recording core's twin, so the
  // scenario's own watch of each action still works.)
  const failsWith = (X, sc) => H.run(X, sc, C.Packs.species('S9', 'S9.1'), 3, { seed: 1 }).failure;
  const plants = [
    ['no gate: it steps in your sight', X => { X.Vision.observed = () => false; }, comes, /could see it|in your sight|moved in/],
    ['no stop: it steps on after coming into view', X => { const act = X.UnobservedMotion.act; X.UnobservedMotion.act = (s, a, ev) => { const c = act(s, a, ev); a.notBefore = null; return c; }; }, comes, /acted again|into your sight|steps|sight/],
    ['its pace a tile a turn', X => { X.UnobservedMotion.costPct = () => 100; }, comes, /steps, not 2|took 1 steps/],
    ['its pace 3 tiles a turn', X => { X.UnobservedMotion.costPct = (s, a, kind) => kind === 'move' && X.UnobservedMotion.moves(s, a) ? 34 : 100; }, comes, /3 steps|more than 2/],
    ['the Lamp ignored', X => { const obs = X.Vision.observed; X.Vision.observed = (s, a) => { const k = X.Kit.observing; X.Kit.observing = () => 0; try { return obs(s, a); } finally { X.Kit.observing = k; } }; }, lit, /Lamp|lit|could see it/],
    ['clouds ignored', X => { const obs = X.Vision.observed; X.Vision.observed = (s, a) => obs(Object.assign({}, s, { dept: Object.assign({}, s.dept, { surfaces: [] }) }), a); }, cloud, /cloud|steps|could see it/],
    ['no stride told', X => { const emit = X.Causes.emit; X.Causes.emit = (s, ev, k, f, c) => k === 'module' && f && f.id === ID ? null : emit(s, ev, k, f, c); }, comes, /stride/],
    ['a stride naming no mover', X => { const emit = X.Causes.emit; X.Causes.emit = (s, ev, k, f, c) => emit(s, ev, k, k === 'module' && f && f.id === ID ? Object.assign({}, f, { who: undefined }) : f, c); }, comes, /stride|sentence|reads/],
    ['in your sight, a walk given up (going home, sent to look)', X => { const act = X.UnobservedMotion.act; X.UnobservedMotion.act = (s, a, ev) => X.UnobservedMotion.moves(s, a) && X.Vision.observed(s, a) && (a.mode === 'returning' || a.mode === 'awake') ? X.AI.byMode(s, a, ev) : act(s, a, ev); }, walks, /blocked|changed its walk|stepped|never got there|ended/],
  ];
  test('planted faults in the module are each caught: by its invariants or by its scenarios', () => {
    for (const [what, plant, sc, want] of plants) {
      const X = watched();
      assert.equal(failsWith(X, sc), null, `${what}: the scenario passes on the real core`);
      plant(X);
      const f = failsWith(X, sc);
      assert.ok(f && want.test(f), `${what}: ${f}`);
    }
  });
};
