// ACCESSION — the Swarm and Attrition perks Single File ('single_file'), Elbow Room ('elbow_room')
// and Second Wind ('second_wind'), and the status 'second_wind' (BUILD.md §8.1, §8.7; M4 plan
// PG-PERKS-B, A11's Elbow Room row, D4.5–D4.7; the PROGRESS map's PR4, PR5, PR8), joined up:
// real actions in rooms at depths 1–7, every invariant checked after every step (perks-b.inv.js
// among them), the main runs clone-checked. A perk is held by planting it in run.perks (PG-CORE:
// the perk sheet is UI-PROGRESS's). Each scenario is run at both ranks, and again with its perk
// switched off (rulesOff), when it must fail (§5.3, check 3: the harness's sweep does it). The
// figures expected are the clauses' own parameters (the perk sheet's numbers), worked out here
// from BUILD's sentences:
//   - Single File: an exhibit that steps into a doorway (an open door, an archway, a closed one
//     it opened first) beside you loses its next action (staggered), once for each exhibit, a
//     split half by its own uid; at the second rank it is first dealt exactly its {dmg}, which
//     its Padding does not reduce; a step onto a doorway not beside you counts for nothing; the
//     Night Watchman is staggered as any exhibit is; the Great Board, which never steps, never;
//   - Elbow Room: your Padding is {p1}, or {p2}, more while {n} or more exhibits stand beside
//     you, not asleep and in no intact case (a mimic in its disguise and a sleeper never count;
//     a body of several tiles, the Great Board's, counts once), counted when you act, and every
//     blow meets what was counted: the odds readout's figures and a mark's number are what is
//     dealt; an exhibit that comes beside you while the world acts raises it only at your next
//     decision;
//   - Second Wind: damage that takes you below {below}% of your maximum health, which you live
//     through, heals {p1}%, or {p2}%, of it over {turns} turns from your next action, once a
//     visit; in the night watch and in a sealed hall too, where regeneration stops; never when
//     the damage defeats you, or when you were below already; and with your next decision
//     mid-turn (a Heavy blow) no share is lost;
//   - the threat (Specials.threat) of a mark whose owner is staggered: its mark waits with it,
//     and the threat warns of it only when it will go off before your next decision.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { N, Int, Registry: R, Clauses, Labels, Text, Roles, Status, Specials } = C;
  const json = JSON.stringify;
  const DEPTHS = H.DEPTHS.map(depth => ({ sp: null, depth }));
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const WAIT = { a: 'wait' };
  const waits = n => Array.from({ length: n }, () => WAIT);
  // A perk held at a rank (none at 0), planted in run.perks.
  const hold = (s, id, rank) => { s.run.perks = rank ? [{ id, rank }] : []; return s; };
  const say = (s, e) => Text.event(e, Labels.nameOf(s));
  const hunter = (at, stats, extra) => Object.assign({ sp: 'dummy', at, mode: 'hunting', stats, sawYou: true, stim: 0 }, extra || {});
  const own = (a, e) => (e.k === 'moved' && e.who === a.uid) || (e.k === 'attacked' && e.by === a.uid);
  const PERKS_B = ['single_file', 'elbow_room', 'second_wind'];

  // ---- The registry ----

  test('the registry: the three perks at ready true, their clauses naming their numbers as parameters (no digit, a rank in words); the second_wind status and its heal; staggered proved here too', () => {
    const fill = e => Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: 1 }));
    assert.equal(json(R.order('PERKS').slice(3, 6)), json(PERKS_B));
    for (const [id, family] of [['single_file', 'swarm'], ['elbow_room', 'swarm'], ['second_wind', 'attrition']]) {
      const e = R.PERKS[id];
      assert.equal(json([e.built, e.ready, e.tests, e.inv, e.family]), json(['M4', true, ['behaviour/perks-b.test.js'], 'perks-b', family]), id);
      assert.ok(C.Perks.added(id), `${id} registers its rules`);
      assert.ok(!/[0-9]/.test(e.clause.replace(/\{[^}]*\}/g, '')), `${id}: a digit in "${e.clause}"`);
    }
    assert.equal(fill(R.PERKS.single_file), `An exhibit that steps into a doorway (an open door or an archway) beside you loses its next action, once for each exhibit (a body split off or called in during the visit is one of its own); at the second rank it is also dealt ${N.PERK_SINGLE_FILE_DMG} damage, which no Padding reduces.`);
    assert.equal(fill(R.PERKS.elbow_room), `You have ${N.PERK_ELBOW_ROOM[0]} more Padding, or ${N.PERK_ELBOW_ROOM[1]} more at the second rank, while ${N.PERK_ELBOW_ROOM_ADJACENT} or more exhibits stand beside you that are not asleep and not in an intact case; they are counted each time you act, where all stand as you choose your action, and the Padding holds until you act again.`);
    assert.equal(fill(R.PERKS.second_wind), `Once a visit, when damage takes you from ${N.PERK_SECOND_WIND_BELOW_PCT}% of your maximum health or more to below it and you live, you heal ${N.PERK_SECOND_WIND_PCT[0]}% of it, or ${N.PERK_SECOND_WIND_PCT[1]}% at the second rank, in shares over the ${N.PERK_SECOND_WIND_TURNS} turns from your next action, never past your maximum; it is healing, not regeneration, so it goes on in the night watch and in a sealed hall.`);
    // second_wind: its words, clause, pictogram id, rule; its heal's cause and sentence.
    const st = R.STATUSES.second_wind;
    assert.equal(json([st.built, st.ready, st.inv, st.icon, st.harmful, st.words]), json(['M4', true, 'perks-b', 'second_wind', false, 'getting your second wind']));
    assert.ok(/^[a-z]/.test(st.clause) && !/\.$/.test(st.clause));
    assert.ok(Status.defined().includes('second_wind') && Status.EFFECTS.second_wind, 'second_wind heals at its turns (Status.define)');
    assert.ok(R.CAUSES.healed.second_wind && R.CAUSES.died.perk && R.CAUSES.perk.wind.fields.total === 'int?');
    assert.ok(R.STATUSES.staggered.tests.includes('behaviour/perks-b.test.js'));
    // Second Wind's charge: 1 until it comes, then 0; the other two have none.
    const s = C.Setup.room(1, { acc: 'T0', depth: 1, map: ['#####', '#...#', '#####'], you: [1, 1] });
    s.run.perks = PERKS_B.map(id => ({ id, rank: 1 }));
    assert.equal(json(C.Perks.charges(s)), json(PERKS_B.map(id => ({ id, rank: 1, charge: id === 'second_wind' ? 1 : null }))));
    s.dept.perk = { wind: { turn: 0, total: 5 } };
    assert.equal(C.Perks.charges(s)[2].charge, 0);
  });

  // ---- Single File ----

  // Two rooms joined by a doorway at (5, 2), `d`: an open door, an archway, or a closed door
  // the exhibit opens first. You at `you` (by default (6, 2), beside it on the east); a hunter
  // that knows where you are walks to you from (2, 2), through it. Its Padding is 4, so a
  // blow of 3 would deal 1 to it; it hits you for 1.
  const DOOR = d => ['###########', '#....#....#', '#....' + d + '....#', '#....#....#', '###########'];
  const PADDED = { hp: 20, acc: 0, eva: 0, pad: 4, dmin: 1, dmax: 1 };
  const fileRoom = (depth, opts, rank, d, you, extra) => hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: DOOR(d), you: you || [6, 2],
    exhibits: [hunter([2, 2], PADDED, Object.assign({ lastKnown: you || [6, 2] }, extra || {}))] }, { rulesOff: opts.rulesOff, invulnerable: true }), 'single_file', rank);
  const perkEvents = (r, uid) => r.events.filter(e => e.k === 'perk' && e.cause && e.cause.k === 'single_file' && (!uid || e.cause.who === uid));
  const single = (rank, d, you) => H.scenario({
    name: `Single File at rank ${rank}: a hunter that steps into a doorway (${json(d)}) beside you${you ? ' diagonally' : ''} loses its next action${rank === 2 ? ' and is dealt its damage through its Padding' : ''}`,
    id: 'PERKS.single_file', clone: true,
    build: (params, sp, depth, opts) => fileRoom(depth, opts, rank, d, you),
    actions: waits(6),
    expect(r, params) {
      const a = r.state.actors[1], into = r.events.find(e => e.k === 'moved' && e.who === a.uid && e.to[0] === 5 && e.to[1] === 2);
      if (!into) return 'it never stepped into the doorway';
      const fired = perkEvents(r);
      if (fired.length !== 1 || fired[0].cause.who !== a.uid || r.events[r.events.indexOf(into) + 1] !== fired[0]) return `Single File did not count its step at once, once: ${json(fired)}`;
      if (say(r.state, fired[0]) !== 'Single File: the training dummy stepped into a doorway beside you.') return say(r.state, fired[0]);
      // Its next action after the step is lost: its next doing comes a wait (a turn) later.
      const t0 = into.tick, after = r.events.filter(e => own(a, e) && e.tick > t0)[0];
      if (!after || after.tick !== t0 + N.COST_STEP + N.COST_WAIT) return `its next doing after the doorway came at ${after && after.tick}, not ${t0 + N.COST_STEP + N.COST_WAIT}: it lost no action, or more than one`;
      const hurt = r.events.filter(e => e.k === 'damaged' && e.who === a.uid);
      if (rank === 1) return hurt.length || a.hp !== PADDED.hp ? `Single File at the first rank dealt damage: ${json(hurt)}` : null;
      if (hurt.length !== 1 || hurt[0].amount !== params.dmg || a.hp !== PADDED.hp - params.dmg) return `it was dealt ${json(hurt.map(e => e.amount))}, now ${a.hp}, not exactly ${params.dmg} through its Padding ${PADDED.pad}`;
      return say(r.state, hurt[0]) === `The training dummy took ${params.dmg} damage from Single File.` ? null : say(r.state, hurt[0]);
    },
  });
  test('Single File, joined up, at both ranks: a hunter stepping into an open door, an archway, or a closed door it opened, beside you (beside or diagonally), loses its next action, and at the second rank is dealt exactly its damage, whatever its Padding; with it switched off it is not', () => {
    for (const rank of [1, 2]) for (const d of ["'", ',', '+']) ok(H.sweep(C, single(rank, d), DEPTHS), `rank ${rank}, ${d}`);
    for (const rank of [1, 2]) ok(H.sweep(C, single(rank, "'", [6, 1]), DEPTHS), `rank ${rank}, diagonally`);
  });

  test('Single File counts nothing but a step onto a doorway beside you: a doorway two tiles off, a step beside you that is no doorway, and a perk not held are nothing', () => {
    for (const depth of H.DEPTHS) {
      // You two tiles east of the doorway: it walks through and comes to you uncounted.
      let r = H.play(C, fileRoom(depth, { seed: depth, rulesOff: [] }, 2, "'", [7, 2]), waits(6), { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.ok(r.events.some(e => e.k === 'moved' && e.to[0] === 5 && e.to[1] === 2), 'it went through the doorway');
      assert.equal(perkEvents(r).length + r.events.filter(e => e.k === 'status').length, 0, json(perkEvents(r)));
      // An open room: it comes beside you on floor, uncounted.
      const open = hold(C.Setup.room(depth, { acc: 'T0', depth, map: ['#########', '#.......#', '#.......#', '#########'], you: [6, 1], exhibits: [hunter([1, 1], PADDED, { lastKnown: [6, 1] })] }, { invulnerable: true }), 'single_file', 2);
      r = H.play(C, open, waits(6));
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.equal(perkEvents(r).length, 0);
      assert.ok(r.events.some(e => e.k === 'attacked' && e.by === open.actors[1].uid), 'it came and struck you');
    }
  });

  // A body of four tiles (a 2×2 hunter) through an archway two tiles tall, at (5, 2) and (5, 3),
  // you at (6, 1), beside its top tile: it is counted when its step brings its tiles onto the
  // archway, and not when it steps on while it already stood in it (it stepped into nothing).
  test('Single File and a body of several tiles: counted when a step brings a tile of it onto a doorway beside you, not when it moves on from a doorway it already stood in', () => {
    const TALL = ['###########', '#....#....#', '#....,....#', '#....,....#', '#....#....#', '###########'];
    const BIG = { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
    for (const depth of H.DEPTHS) {
      const make = at => hold(C.Setup.room(depth, { acc: 'T0', depth, map: TALL, you: [6, 1], exhibits: [hunter(at, BIG, { size: 2, lastKnown: [6, 1] })] }, { invulnerable: true }), 'single_file', 2);
      let s = make([2, 2]), r = H.play(C, s, waits(4), { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), [], `depth ${depth}`);
      const into = r.events.find(e => e.k === 'moved' && e.to[0] === 4 && e.to[1] === 2), fired = perkEvents(r);
      assert.ok(into && fired.length === 1 && r.events.indexOf(fired[0]) === r.events.indexOf(into) + 1, `depth ${depth}: ${json(r.events.filter(e => e.k === 'moved' || e.k === 'perk'))}`);
      s = make([4, 2]); r = H.play(C, s, waits(4), { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), [], `depth ${depth}`);
      assert.ok(r.events.some(e => e.k === 'moved' && e.from[0] === 4 && e.to[0] === 5), 'it stepped on from the archway');
      assert.equal(perkEvents(r).length, 0, `depth ${depth}: counted as it stepped on from the archway it stood in`);
    }
  });

  // Once for each exhibit (§8.7): S.9's Hopper, a darter, strikes from the doorway and steps back
  // out of it, and comes into it again and again; it is counted the first time only.
  const darter = rank => H.scenario({
    name: `Single File at rank ${rank} counts each exhibit once: a darter in and out of the doorway beside you is staggered the first time only`,
    id: 'PERKS.single_file', clone: true,
    build(params, sp, depth, opts) {
      const s = C.Setup.room(opts.seed, { acc: 'T0', depth, map: DOOR("'"), you: [6, 2], exhibits: [{ sp: sp.id, at: [1, 2], mode: 'hunting', stats: Roles.stats(sp.role, depth), lastKnown: [6, 2], sawYou: true, stim: 0 }] },
        { rulesOff: opts.rulesOff, invulnerable: true });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      return hold(s, 'single_file', rank);
    },
    actions: waits(10),
    expect(r) {
      const a = r.state.actors[1], entries = r.events.filter(e => e.k === 'moved' && e.who === a.uid && e.to[0] === 5 && e.to[1] === 2);
      const fired = perkEvents(r), backs = r.events.filter(e => e.k === 'moved' && e.who === a.uid && e.from[0] === 5 && e.from[1] === 2);
      if (entries.length < 3 || backs.length < 2) return `it came into the doorway ${entries.length} times and stepped back out ${backs.length} times`;
      if (fired.length !== 1 || r.events.indexOf(fired[0]) !== r.events.indexOf(entries[0]) + 1) return `Single File counted it ${fired.length} times, not once at its first entry`;
      const put = r.events.filter(e => e.k === 'status' && e.who === a.uid && e.on);
      return put.length === 1 && put[0].id === 'staggered' && json(r.state.dept.perk.filed) === json([a.uid]) ? null : `staggered ${put.length} times; filed ${json(r.state.dept.perk && r.state.dept.perk.filed)}`;
    },
  });
  test('Single File counts each exhibit once, by its uid: S.9\'s Hopper, a darter, is staggered at its first step into the doorway beside you, and never at the next, at depths 1–7; with the perk off, never', () => {
    const list = H.species(C, 'darter').filter(x => x.sp.id === 'S9.6');
    assert.equal(list.length, 7);
    for (const rank of [1, 2]) ok(H.sweep(C, darter(rank), list), `rank ${rank}`);
  });

  // A body made in the visit is an exhibit of its own (§3.2, uid <body>/<k>): A.4's Spare Trustee,
  // a splitter of 7 health, steps into the doorway (counted, and at the second rank dealt its
  // damage, which may split it); you strike it down from beside the doorway; its half, made
  // behind it, then steps into the doorway and is counted too, once.
  const split = rank => H.scenario({
    name: `Single File at rank ${rank}: a split half, made during the visit, is counted by its own uid when it steps into the doorway`,
    id: 'PERKS.single_file', clone: true,
    build(params, sp, depth, opts) {
      const s = C.Setup.room(opts.seed, { acc: 'T0', depth, map: DOOR("'"), you: [6, 2], exhibits: [{ sp: sp.id, at: [3, 2], mode: 'hunting', stats: Roles.stats(sp.role, depth), hp: 7, lastKnown: [6, 2], sawYou: true, stim: 0 }] },
        { rulesOff: opts.rulesOff, invulnerable: true });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      return hold(s, 'single_file', rank);
    },
    actions(s) {
      const x = s.actors[1], strike = { a: 'attack', uid: x.uid };
      if (s.actors.some(a => a.uid.startsWith(x.uid + '/') && a.x === 5 && a.y === 2)) return null;
      return !x.gone && C.Step.legal(s).some(l => json(l) === json(strike)) ? strike : WAIT;
    },
    cap: 40,
    expect(r) {
      const x = r.state.actors[1], halves = r.state.actors.filter(a => a.uid.startsWith(x.uid + '/'));
      const counted = perkEvents(r).map(e => e.cause.who);
      if (!x.gone || !halves.length) return `the body ${x.gone ? 'fell' : 'stands'}, with ${halves.length} halves`;
      const half = halves.find(h => counted.includes(h.uid));
      if (counted[0] !== x.uid || !half || counted.length !== new Set(counted).size) return `Single File counted ${json(counted)}, not the body and then its half, each once`;
      return json(r.state.dept.perk.filed) === json(counted) ? null : `filed ${json(r.state.dept.perk.filed)}`;
    },
  });
  test('Single File and bodies made during the visit: a splitter\'s half has its own uid, and is counted once when it steps into the doorway, after its body (A.4\'s Spare Trustee, depths 1–7)', () => {
    const list = H.species(C, 'splitter').filter(x => x.sp.id === 'A4.4a');
    assert.equal(list.length, 7);
    for (const rank of [1, 2]) ok(H.sweep(C, split(rank), list), `rank ${rank}`);
  });

  // A swarm body (A.4's Carbon Flimsies) at the second rank: it is dealt the perk's 3 (raw),
  // through no Padding, and its own rule (any hit takes all its health) makes that all its
  // health, which the log says with both numbers, so "dealt 3" and the health it lost are both
  // told true; it falls, and so is never staggered.
  const swarm = H.scenario({
    name: 'Single File at the second rank and a swarm body: dealt its 3, it falls to it, losing all its health, and the log says so',
    id: 'PERKS.single_file', clone: true,
    build(params, sp, depth, opts) {
      const s = C.Setup.room(opts.seed, { acc: 'T0', depth, map: DOOR("'"), you: [6, 2], exhibits: [{ sp: sp.id, at: [3, 2], mode: 'hunting', stats: Roles.stats(sp.role, depth), lastKnown: [6, 2], sawYou: true, stim: 0 }] },
        { rulesOff: opts.rulesOff, invulnerable: true });
      return hold(s, 'single_file', 2);
    },
    actions: waits(4),
    expect(r, params) {
      const a = r.state.actors[1], hp = r.start.actors[1].hp, hurt = r.events.filter(e => e.k === 'damaged' && e.who === a.uid);
      if (perkEvents(r, a.uid).length !== 1) return 'Single File did not count it';
      if (hurt.length !== 1 || hurt[0].cause.raw !== params.dmg || hurt[0].amount !== hp || !a.gone) return `it was dealt ${json(hurt.map(e => [e.cause.raw, e.amount]))} and ${a.gone ? 'fell' : 'stands'}, not ${params.dmg} taking all its ${hp} health`;
      const words = hp === params.dmg ? `${Labels.nameOf(r.state)(a.uid)} took ${hp} damage from Single File.`
        : `${Labels.nameOf(r.state)(a.uid)} took ${hp} damage from Single File (${params.dmg}; it falls to any one hit: all ${hp} of its health).`;
      if (say(r.state, hurt[0]) !== words.charAt(0).toUpperCase() + words.slice(1)) return say(r.state, hurt[0]);
      if (r.events.some(e => e.k === 'status' && e.who === a.uid)) return 'it fell and was still staggered';
      return say(r.state, r.events.find(e => e.k === 'died' && e.who === a.uid)) === `${Labels.nameOf(r.state)(a.uid).replace(/^./, c => c.toUpperCase())} broke apart under Single File.` ? null : 'its fall reads wrong';
    },
  });
  test('Single File at the second rank and a swarm body (A.4\'s Carbon Flimsies, depths 1–7): dealt the perk\'s 3, which its own rule makes all its health, it falls, and the log gives both numbers; with the perk off, nothing', () => {
    const list = H.species(C, 'mote_swarm').filter(x => x.sp.id === 'A4.2');
    assert.equal(list.length, 7);
    ok(H.sweep(C, swarm, list), 'swarm');
  });

  // The night watch (clock B 1, G 1): the Night Watchman comes in at the entrance (0, 2) and
  // walks to you through the doorway beside you. Single File names no exception, so it is
  // staggered as any exhibit is.
  const ENTRY = DOOR("'").map((row, y) => y === 2 ? 'E' + row.slice(1) : row);
  const watch = rank => H.scenario({
    name: `Single File at rank ${rank} staggers the Night Watchman stepping into the doorway beside you`,
    id: 'PERKS.single_file', clone: true,
    build(params, sp, depth, opts) {
      const s = C.Setup.room(opts.seed, { acc: 'T0', depth, map: ENTRY, you: [6, 2], exhibits: [], clock: { B: 1, G: 1 }, entrance: [0, 2] }, { rulesOff: opts.rulesOff, invulnerable: true });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      return hold(s, 'single_file', rank);
    },
    actions: (s, i) => s.actors.some(a => a.arch === 'night_watchman' && a.x === 6) || i > 30 ? null : WAIT,
    expect(r) {
      const w = r.state.actors.find(a => a.arch === 'night_watchman');
      if (!w) return 'no Night Watchman came in';
      const fired = perkEvents(r, w.uid), put = r.events.filter(e => e.k === 'status' && e.who === w.uid && e.on && e.id === 'staggered');
      return fired.length === 1 && put.length === 1 ? null : `the Night Watchman was counted ${fired.length} times and staggered ${put.length} times`;
    },
  });
  test('Single File staggers the Night Watchman too, at both ranks: its clause names no exception', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, watch(rank), DEPTHS), `rank ${rank}`);
  });

  // The soak's checks (tools/battery.js: every invariant, every sentence, and completeness: no
  // exhibit causes an event its Behaviour line does not cover) hold with all three perks, on
  // S.9's Hopper coming through the doorway: Single File's event is yours, naming the exhibit
  // it counted as who, never as by, so it is never laid to the exhibit.
  test('the soak\'s checks hold with the three perks at both ranks, at depths 1–7: Single File\'s event is yours, never laid to the exhibit it counted (completeness)', () => {
    const B = require(path.join(root, 'tools/battery.js'));
    let fired = 0;
    for (const depth of H.DEPTHS) for (const rank of [1, 2]) {
      const s = C.Setup.room(depth, { acc: 'S9', depth, map: DOOR("'"), you: [6, 2], exhibits: [{ sp: 'S9.6', at: [1, 2], mode: 'hunting', stats: Roles.stats('skirmisher', depth), lastKnown: [6, 2], sawYou: true, stim: 0 }] }, { invulnerable: true });
      s.actors[0].hp = C.Int.ceilDiv(N.PERK_SECOND_WIND_BELOW_PCT * s.actors[0].maxHp, 100);
      s.run.perks = PERKS_B.map(id => ({ id, rank }));
      const ch = B.checks(C), out = [];
      for (let i = 0; i < 10; i++) { const pre = C.State.clone(s), ev = C.Step.step(s, WAIT); fired += ev.filter(e => e.k === 'perk').length; out.push(...ch.check(pre, WAIT, ev, s)); }
      assert.deepEqual(out.map(v => v.text), [], `depth ${depth}, rank ${rank}`);
    }
    assert.ok(fired >= 2 * 2 * H.DEPTHS.length, `${fired} perk events`);
  });

  // ---- The Great Board, a Centrepiece that never steps ----

  // The hall of mp_tableau's tests (x 1–9, y 1–6), its archway at (10, 2) to a gallery (x 11–13),
  // M.11's Great Board placed on 4–5 × 3–4 (Centrepiece.place).
  const HALL_MAP = ['###############', '#.........#...#', '#.........,...#', '#.........#...#', '#.........#...#', '#.........S...#', '#.........#...#', '###############'];
  const HALL_ROOMS = [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 9, y1: 6 }, { key: 's1', role: 'section', x0: 11, y0: 1, x1: 13, y1: 6 }];
  function boardRoom(depth, you, more, perks, rulesOff) {
    const s = H.room(C, depth, { acc: 'M11', depth, map: HALL_MAP, you, exhibits: more || [], rooms: HALL_ROOMS, clock: { B: 300, G: 60 }, entrance: [13, 3],
      fixtures: [{ k: 'staff', x: 10, y: 5, grade: 1 }], items: [] }, { invulnerable: true, rulesOff: rulesOff || [] });
    s.actors[0].maxHp = 999; s.actors[0].hp = 999;
    C.Centrepiece.place(s, { cpl: [4, 3] }, C.Packs.get('M11'));
    s.run.perks = perks;
    C.Kit.settle(s);
    return s;
  }
  test('the Great Board, which never steps, is never counted by Single File, while a hunter beside it stepping into the archway beside you is; as one exhibit of four tiles it counts once for Elbow Room, awake, and not asleep', () => {
    for (const depth of H.DEPTHS) {
      const perks = [{ id: 'single_file', rank: 2 }, { id: 'elbow_room', rank: 1 }];
      // You in the gallery beside the archway; the Board hunting you; a hunter in the hall.
      const s = boardRoom(depth, [11, 3], [hunter([8, 2], PADDED, { lastKnown: [11, 3] })], perks);
      const b = C.Centrepiece.pieces(s)[0];
      C.Wake.toHunting(s, b, { k: 'damage' }, []);
      const r = H.play(C, s, waits(6), { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), [], `depth ${depth}`);
      assert.ok(!r.events.some(e => e.k === 'moved' && e.who === b.uid), 'the Board never steps');
      assert.equal(json(perkEvents(r).map(e => e.cause.who)), json([s.actors[1].uid]), `depth ${depth}: only the hunter is counted`);
      // Elbow Room: you beside the Board (its east side, two of its tiles beside you) and two
      // awake hunters: three exhibits; the Board asleep, two.
      const base = boardRoom(depth, [6, 4], [hunter([7, 4], PADDED), hunter([6, 5], PADDED)], []).actors[0].pad;
      const t = boardRoom(depth, [6, 4], [hunter([7, 4], PADDED), hunter([6, 5], PADDED)], perks);
      assert.equal(t.actors[0].pad, base, `depth ${depth}: the Board asleep is not counted`);
      C.Wake.toHunting(t, C.Centrepiece.pieces(t)[0], { k: 'damage' }, []);
      C.Kit.settle(t);
      assert.equal(t.actors[0].pad, base + N.PERK_ELBOW_ROOM[0], `depth ${depth}: the Board awake counts once`);
    }
  });

  // ---- Elbow Room ----

  // You at (4, 3) in an open room; hunters beside you strike for exactly K (dmin = dmax), their
  // hit chance 95%; you can take every blow (invulnerable, 999 health).
  const K = 12, STRIKER = { hp: 999, acc: 10, eva: 0, pad: 0, dmin: K, dmax: K };
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const elbowRoom = (depth, opts, rank, list) => {
    const s = hold(C.Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: [4, 3], exhibits: list.map(([x, y, extra]) => hunter([x, y], STRIKER, extra)) },
      { rulesOff: opts.rulesOff, invulnerable: true }), 'elbow_room', rank);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    C.Kit.settle(s);
    return s;
  };
  // Your Padding before any perk: your kit's (Kit.stats), as with no perk held.
  const kitPad = s => { const t = C.State.clone(s); t.run.perks = []; return C.Kit.derive(t).pad; };
  const bonus = (params, rank) => rank === 1 ? params.p1 : params.p2;
  const blowsAtYou = events => events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause && e.cause.k === 'attack');
  const three = rank => H.scenario({
    name: `Elbow Room at rank ${rank}: three hunters beside you, and every blow meets your Padding and its bonus`,
    id: 'PERKS.elbow_room', clone: true,
    build: (params, sp, depth, opts) => elbowRoom(depth, opts, rank, [[3, 3], [5, 3], [4, 2]]),
    actions: waits(3),
    expect(r, params) {
      const base = kitPad(r.start), want = base + bonus(params, rank), hits = blowsAtYou(r.events);
      if (params.n !== 3) return `the clause counts ${params.n}`;
      if (r.start.actors[0].pad !== want) return `your Padding is ${r.start.actors[0].pad}, not ${want} (${base} and ${bonus(params, rank)})`;
      if (hits.length < 4) return `only ${hits.length} blows landed`;
      const wrong = hits.filter(e => e.amount !== Math.max(N.DMG_MIN_ON_HIT, K - want) || e.cause.pad !== want);
      return wrong.length ? `blows met Padding ${json(wrong.map(e => [e.cause.pad, e.amount]))}, not ${want}` : null;
    },
  });
  test('Elbow Room, joined up, at both ranks: with three hunters beside you your Padding is PERK_ELBOW_ROOM[rank − 1] more, and every blow is that much less; with it switched off it is not', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, three(rank), DEPTHS), `rank ${rank}`);
  });

  // Counted when you act (A11, D4.5): two hunters beside you, and a fast third (its steps half a
  // turn) four tiles south. It comes beside you while the world acts, after your decision, and
  // strikes in the same turn: that blow meets the Padding counted when you acted, with two
  // beside you; the bonus comes only at your next decision, and then every blow meets it.
  const arrives = rank => H.scenario({
    name: `Elbow Room at rank ${rank} is counted when you act: an exhibit coming beside you while the world acts raises your Padding only at your next decision`,
    id: 'PERKS.elbow_room', clone: true,
    build: (params, sp, depth, opts) => elbowRoom(depth, opts, rank, [[3, 3], [5, 3], [4, 7, { speed: 'fast' }]]),
    actions: waits(4),
    expect(r, params) {
      const base = kitPad(r.start), want = base + bonus(params, rank), third = r.state.actors[3];
      // The step in which it came beside you.
      const k = r.steps.findIndex(st => st.events.some(e => e.k === 'moved' && e.who === third.uid && Math.max(Math.abs(e.to[0] - 4), Math.abs(e.to[1] - 3)) === 1));
      if (k < 1) return `the third came beside you at step ${k}`;
      const at = r.steps[k].events.find(e => e.k === 'moved' && e.who === third.uid && Math.max(Math.abs(e.to[0] - 4), Math.abs(e.to[1] - 3)) === 1);
      // It struck at you (hit or miss) in the same step, after it came: before your next decision.
      const late = r.steps[k].events.filter(e => e.k === 'attacked' && e.by === third.uid && e.tick > at.tick);
      if (blowsAtYou(r.steps.slice(0, k + 1).flatMap(st => st.events)).some(e => e.cause.pad !== base)) return 'a blow before your next decision met the bonus';
      if (r.steps.slice(k + 1).flatMap(st => blowsAtYou(st.events)).some(e => e.cause.pad !== want)) return 'a blow after your next decision did not meet the bonus';
      const after = r.steps.slice(k + 1).flatMap(st => blowsAtYou(st.events));
      return late.length && after.length ? null : `${late.length} blows struck at you after the third came, in its step, and ${after.length} landed after your next decision`;
    },
  });
  test('Elbow Room is counted when you act, at both ranks: a third exhibit coming beside you as the world acts changes nothing until your next decision, and every blow until then meets the Padding you had; with it switched off the bonus never comes', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, arrives(rank), DEPTHS), `rank ${rank}`);
    // Planted: Padding counted live (your stats settled after every exhibit's action): a blow
    // after the third came, in the same turn, meets the bonus, which the invariant catches.
    const X = loadCore(), act = X.AI.act;
    X.AI.act = (s, a, ev) => { const c = act(s, a, ev); X.Kit.settle(s); return c; };
    let caught = 0;
    for (const depth of H.DEPTHS) {
      const s = hold(X.Setup.room(depth, { acc: 'T0', depth, map: OPEN, you: [4, 3], exhibits: [[3, 3], [5, 3], [4, 7, { speed: 'fast' }]].map(([x, y, e]) => hunter([x, y], STRIKER, e)) }, { invulnerable: true }), 'elbow_room', 1);
      s.actors[0].hp = s.actors[0].maxHp = 999;
      X.Kit.settle(s);
      const r = H.play(X, s, waits(4), { inv: ['perks-b'] });
      if (r.violations.some(v => v.inv === 'perks_b.elbow_room')) caught++;
    }
    assert.ok(caught >= 5, `live Padding was caught at ${caught} depths of 7`);
  });

  test('Elbow Room counts exhibits beside you that are not asleep and not in an intact case: a sleeper, an exhibit in its case, a mimic in its disguise and one destroyed never count; a body of four tiles counts once; two are not enough', () => {
    const CASE = OPEN.map((row, y) => y === 2 ? row.slice(0, 4) + 'v' + row.slice(5) : row);
    for (const depth of H.DEPTHS) for (const rank of [1, 2]) {
      const plus = N.PERK_ELBOW_ROOM[rank - 1];
      const make = (list, map, fixtures) => {
        const s = hold(C.Setup.room(depth, { acc: 'T0', depth, map: map || OPEN, you: [4, 3], exhibits: list, fixtures: fixtures || [] }, { invulnerable: true }), 'elbow_room', rank);
        C.Kit.settle(s);
        return s;
      };
      const awake = (x, y) => hunter([x, y], STRIKER);
      const s3 = make([awake(3, 3), awake(5, 3), awake(4, 4)]), base = kitPad(s3);
      assert.equal(s3.actors[0].pad, base + plus, `depth ${depth} rank ${rank}: three awake`);
      assert.equal(make([awake(3, 3), awake(5, 3)]).actors[0].pad, base, 'two');
      assert.equal(make([awake(3, 3), awake(5, 3), awake(4, 5)]).actors[0].pad, base, 'the third two tiles off');
      assert.equal(make([awake(3, 3), awake(5, 3), Object.assign(awake(4, 4), { mode: 'dormant' })]).actors[0].pad, base, 'the third asleep');
      for (const mode of ['awake', 'searching', 'returning']) assert.equal(make([awake(3, 3), awake(5, 3), Object.assign(awake(4, 4), { mode })]).actors[0].pad, base + plus, `the third ${mode}`);
      // In an intact case beside you (north), awake: no blow reaches you from there.
      const cased = make([awake(3, 3), awake(5, 3), Object.assign(awake(4, 2), { mode: 'awake' })], CASE, [C.Cases.make({ x: 4, y: 2, room: 'room', num: `T.0.${depth}01.1`, glass: 1, lock: 1 })]);
      assert.equal(cased.actors[0].pad, base, 'the third in an intact case');
      // A mimic in its disguise (S.9's Glass-Backed Tortoise, asleep as a case beside you).
      const m = make([awake(3, 3), awake(5, 3), { sp: 'S9.5', at: [4, 4], stats: Roles.stats('ambusher', depth) }]);
      assert.equal(C.Grid.ch(m.dept, 4, 4), 'v', 'the mimic is in its disguise');
      assert.equal(m.actors[0].pad, base, 'a mimic in its disguise');
      // Destroyed.
      const g = make([awake(3, 3), awake(5, 3), awake(4, 4)]);
      g.actors[3].gone = 1; C.Kit.settle(g);
      assert.equal(g.actors[0].pad, base, 'the third destroyed');
      // A body of four tiles beside you (two of its tiles beside you) counts once.
      const big = Object.assign(hunter([5, 3], STRIKER), { size: 2 });
      assert.equal(make([awake(3, 3), big]).actors[0].pad, base, 'a 2×2 body and one more: two');
      assert.equal(make([awake(3, 3), awake(3, 4), big]).actors[0].pad, base + plus, 'a 2×2 body and two more: three');
    }
  });

  // The odds readout (§8.1) reads your settled Padding, so its figures are what the blows deal:
  // with Elbow Room counting, "at worst" and "typically" are worked out at K less your Padding
  // and its bonus, and so are the blows; switched off, at K less your Padding alone.
  test('a label\'s figures are the real ones: with Elbow Room counting, an exhibit\'s odds readout, and a mark\'s number, are what its blows and its special deal you, at depths 1, 4 and 7, at each rank and switched off', () => {
    const halfUp = (p, q) => Int.idiv(2 * p + q, 2 * q);
    const warden = H.species(C, 'tethered_warden').find(x => x.sp.id === 'S9.4').sp;
    let marks = 0;
    for (const depth of [1, 4, 7]) for (const [rank, off] of [[1, false], [2, false], [2, true]]) {
      const opts = { seed: depth, rulesOff: off ? ['elbow_room'] : [] };
      const s = elbowRoom(depth, opts, rank, [[3, 3], [5, 3]]);
      // The third a tethered warden (S.9's), whose ring of blows is its special.
      C.Actors.spawn(s, { uid: 'warden', sp: warden.id, arch: 'tethered_warden', role: warden.role, mods: [], modParams: {}, trigger: warden.trigger, group: null,
        x: 4, y: 4, hp: 999, maxHp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1, speed: 'normal', mode: 'hunting', sawYou: true, stim: 0, guards: [4, 4], home: [4, 4], lastKnown: [4, 3] });
      C.Archetypes.init(s, s.actors[3]);
      C.Kit.settle(s);
      const you = s.actors[0], pad = kitPad(s) + (off ? 0 : N.PERK_ELBOW_ROOM[rank - 1]), net = Math.max(N.DMG_MIN_ON_HIT, K - pad);
      assert.equal(you.pad, pad, `d${depth} rank ${rank}${off ? ' off' : ''}`);
      const line = Labels.odds(s, s.actors[1])[0];
      assert.equal(line, `It has a 95% chance to hit you, typically hits for ${halfUp(100 * net, you.hp)}% of your current health, and at worst could defeat you in ${Int.ceilDiv(you.hp, net)} hits.`);
      const r = H.play(C, s, (st, i) => i < 5 ? WAIT : null, { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), []);
      const hits = blowsAtYou(r.events);
      assert.ok(hits.length >= 4 && hits.every(e => e.amount === net), `d${depth}: blows dealt ${json(hits.map(e => e.amount))}, its label ${net}`);
      // The warden's ring: its readout line, before it marks, and the damage it deals.
      for (const e of r.events.filter(x => x.k === 'damaged' && x.who === 'you' && x.cause && x.cause.k === 'special')) {
        const ring = Specials.readout(s, s.actors[3], you)[0];
        assert.equal(e.amount, Math.max(N.DMG_MIN_ON_HIT, e.cause.gross - pad), `the ring dealt ${e.amount}`);
        assert.equal(ring.net, e.amount, 'its readout line says what it deals');
        marks++;
      }
    }
    assert.ok(marks >= 6, `${marks} rings went off`);
  });

  // ---- Second Wind ----

  // You at (3, 2) with health `hp` of your maximum (your grade's); a hunter beside you strikes for
  // 1 (95% to hit) until you stop; you cannot fall (invulnerable), unless `mortal`.
  const ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
  const lowest = max => Int.ceilDiv(N.PERK_SECOND_WIND_BELOW_PCT * max, 100);
  const ONE = { hp: 999, acc: 10, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  function windRoom(depth, opts, rank, o) {
    o = o || {};
    const s = hold(C.Setup.room(opts.seed, Object.assign({ acc: 'T0', depth, map: o.map || ROOM, you: o.you || [3, 2], grade: Math.min(N.GRADE_MAX, depth),
      exhibits: o.exhibits || [hunter(o.at || [4, 2], o.striker || ONE, { lastKnown: o.you || [3, 2] })] }, o.spec || {}), { rulesOff: opts.rulesOff, invulnerable: !o.mortal }), 'second_wind', rank);
    const you = s.actors[0];
    you.hp = o.hp === undefined ? lowest(you.maxHp) : o.hp(you.maxHp);
    return s;
  }
  const winds = r => r.events.filter(e => e.k === 'perk' && e.cause && e.cause.k === 'wind');
  const heals = r => r.events.filter(e => e.k === 'healed' && e.cause && e.cause.k === 'second_wind');
  // The shares a total heals in over T turns (§8.1's rule for restoring), k from 0.
  const share = (total, k) => Int.idiv(total * (k + 1), N.PERK_SECOND_WIND_TURNS) - Int.idiv(total * k, N.PERK_SECOND_WIND_TURNS);
  // Second Wind came once and healed its total in its shares, one at each boundary of the turns
  // from your next decision (two at the first if your next decision came after that turn's
  // boundary), as BUILD says: [null, its total], or [a message].
  function healedRight(r, params, rank, maxHp) {
    const w = winds(r);
    if (w.length !== 1) return [`Second Wind came ${w.length} times`];
    const max = maxHp || r.start.actors[0].maxHp, total = Int.pct(max, rank === 1 ? params.p1 : params.p2);
    if (w[0].cause.total !== total) return [`it heals ${w[0].cause.total}, not ${total} (${rank === 1 ? params.p1 : params.p2}% of ${max})`];
    const k = r.steps.findIndex(st => st.events.includes(w[0])), next = r.steps[k + 1] && r.steps[k + 1].events[0];
    if (!next) return ['the visit stopped as Second Wind came'];
    const from = Int.idiv(next.tick, N.TICKS_PER_TURN), first = Math.max(from, w[0].turn + 1), T = params.turns;
    const want = [];
    for (let t = first; t < from + T; t++) {
      let n = 0;
      for (let j = t === first ? 0 : t - from; j <= t - from; j++) n += share(total, j);
      want.push([t, n]);
    }
    const got = heals(r).map(e => [e.turn, e.amount]);
    return json(got) === json(want.filter(([, n]) => n > 0)) ? [null, total] : [`it healed ${json(got)}, not ${json(want)} (from turn ${from}, its total ${total} over ${T} turns)`];
  }
  const wind = rank => H.scenario({
    name: `Second Wind at rank ${rank}: damage that takes you below the line heals its share of your maximum health over its turns, once`,
    id: 'PERKS.second_wind', clone: true,
    build: (params, sp, depth, opts) => windRoom(depth, opts, rank),
    actions: waits(10),
    expect(r, params) {
      const [m, total] = healedRight(r, params, rank);
      if (m) return m;
      const w = winds(r)[0], put = r.events.filter(e => e.k === 'status' && e.who === 'you' && e.id === 'second_wind');
      if (put.length !== 2 || !put[0].on || put[0].turns !== params.turns || put[1].on) return `its status: ${json(put)}`;
      const words = `Second Wind: you fell below ${params.below}% of your maximum health, so from your next action you heal ${total} health (${rank === 1 ? params.p1 : params.p2}% of your maximum health) over ${params.turns} turns.`;
      if (say(r.state, w) !== words) return say(r.state, w);
      if (say(r.state, put[0]) !== `You are now getting your second wind for ${params.turns} turns: Second Wind.`) return say(r.state, put[0]);
      return say(r.state, heals(r)[0]) === `You healed ${heals(r)[0].amount} with Second Wind: health ${heals(r)[0].hp}.` ? null : say(r.state, heals(r)[0]);
    },
  });
  test('Second Wind, joined up, at both ranks: the hit that takes you below PERK_SECOND_WIND_BELOW_PCT% brings it at once, and it heals PERK_SECOND_WIND_PCT[rank − 1]% of your maximum health in shares over its turns, once; with it switched off nothing heals', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, wind(rank), DEPTHS), `rank ${rank}`);
  });

  // In the night watch (from the second boundary; clock B 1, G 1) regeneration stops, and the
  // Night Watchman comes; the hunter starts four tiles off, so it first strikes you in the
  // night watch.
  const night = rank => H.scenario({
    name: `Second Wind at rank ${rank} heals in the night watch, where regeneration stops`,
    id: 'PERKS.second_wind', clone: true,
    build: (params, sp, depth, opts) => windRoom(depth, opts, rank, { map: ['#########', 'E.......#', '#.......#', '#.......#', '#########'], you: [7, 2], at: [2, 2],
      spec: { clock: { B: 1, G: 1 }, entrance: [0, 1] } }),
    actions: waits(14),
    expect(r, params) {
      if (C.Clock.stage(r.state) !== 2) return `the clock is at stage ${C.Clock.stage(r.state)}`;
      const [m] = healedRight(r, params, rank);
      if (m) return m;
      const w = winds(r)[0], late = heals(r).filter(e => e.turn < 2);
      if (w.turn < 2 || late.length) return `Second Wind came at turn ${w.turn}, before the night watch`;
      return r.events.some(e => e.k === 'regenerated' && e.turn >= 2) ? 'you regenerated in the night watch' : null;
    },
  });
  // In a sealed hall (hall.test.js's): the Centrepiece, held fixed, hunts you from inside, so the
  // hall seals at the first boundary; a hunter in the hall with you, two tiles off, first strikes
  // you once it has sealed.
  const HALL = ['#############', '#.......#...#', '#.......,...#', '#.......#...#', '#.......S...#', '#.......#...#', '#############'];
  const sealed = rank => H.scenario({
    name: `Second Wind at rank ${rank} heals in a sealed hall, where regeneration stops`,
    id: 'PERKS.second_wind', clone: true,
    build(params, sp, depth, opts) {
      const s = H.room(C, opts.seed, { acc: 'T0', depth, map: HALL, you: [5, 2], grade: Math.min(N.GRADE_MAX, depth), rooms: [{ key: 'centre', role: 'centre', x0: 1, y0: 1, x1: 7, y1: 5 },
        { key: 's1', role: 'section', x0: 9, y0: 1, x1: 11, y1: 5 }], cp: { uids: [`T0.${depth}.room.1`], room: 'centre' }, clock: { B: 300, G: 60 }, entrance: [11, 3],
        fixtures: [{ k: 'staff', x: 8, y: 4, grade: 1 }],
        exhibits: [{ sp: 'dummy', at: [1, 4], size: 2, role: 'centrepiece', mode: 'hunting', stats: { hp: 60, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 }, statuses: [{ id: 'fixed', turns: 9999 }] },
          hunter([7, 2], ONE, { lastKnown: [5, 2] })] }, { rulesOff: opts.rulesOff, invulnerable: true });
      s.actors[0].hp = lowest(s.actors[0].maxHp);
      return hold(s, 'second_wind', rank);
    },
    actions: waits(10),
    expect(r, params) {
      const seal = r.events.filter(e => e.k === 'stage' && e.cause && e.cause.k === 'hall');
      if (seal.length !== 1 || seal[0].stage !== 'sealed' || !C.Clock.sealed(r.state)) return `the hall did not seal and stay sealed: ${json(seal)}`;
      const [m] = healedRight(r, params, rank);
      if (m) return m;
      if (heals(r).some(e => e.turn <= seal[0].turn)) return 'Second Wind healed before the seal';
      return r.events.some(e => e.k === 'regenerated') ? 'you regenerated in the sealed hall' : null;
    },
  });
  test('Second Wind is healing, not regeneration, at both ranks: it heals in the night watch and in a sealed hall, where regeneration stops; with it switched off nothing heals there', () => {
    for (const rank of [1, 2]) ok(H.sweep(C, night(rank), DEPTHS), `night watch, rank ${rank}`);
    for (const rank of [1, 2]) ok(H.sweep(C, sealed(rank), DEPTHS), `sealed hall, rank ${rank}`);
  });

  test('Second Wind comes once a visit, only as damage takes you below the line and you live: not for a hit when you were below already, not for a hit that defeats you, not twice; and its charge is spent', () => {
    for (const depth of H.DEPTHS) for (const rank of [1, 2]) {
      const opts = { seed: depth, rulesOff: [] };
      // Below already: a hit from one below the line brings nothing.
      let s = windRoom(depth, opts, rank, { hp: max => lowest(max) - 1 });
      let r = H.play(C, s, waits(4));
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.ok(r.events.some(e => e.k === 'damaged' && e.who === 'you'));
      assert.equal(winds(r).length, 0, `d${depth}: below already`);
      // A hit that defeats you (you are not kept at 1): it comes from the line, and nothing follows.
      s = windRoom(depth, opts, rank, { mortal: true, striker: Object.assign({}, ONE, { dmin: 999, dmax: 999 }) });
      r = H.play(C, s, waits(4));
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.equal(json([s.over && s.over.k, winds(r).length]), json(['died', 0]), `d${depth}: defeated`);
      // Twice: once its turns are over, you are put back at the line, and the next hit takes you
      // below again: nothing.
      s = windRoom(depth, opts, rank);
      let after = null;
      r = H.play(C, s, (st, i, c) => {
        if (after === null && c.events.some(e => e.k === 'status' && e.id === 'second_wind' && !e.on)) { after = i; st.actors[0].hp = lowest(st.actors[0].maxHp); }
        return after !== null && i > after + 4 ? null : WAIT;
      }, { cap: 30 });
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.ok(after !== null, 'its turns ended');
      const crossed = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.tick > r.steps[after].events[0].tick);
      assert.ok(crossed.length, 'it was hit again');
      assert.equal(winds(r).length, 1, `d${depth}: it came twice`);
      assert.equal(C.Perks.charges(s)[0].charge, 0, 'its charge is spent');
    }
  });

  // Your next decision mid-turn (a Heavy blow costs 150 ticks): the hit that brings Second Wind
  // can come after the boundary of the turn your next decision falls in, which its status covers
  // first (§8.1); that turn's share comes at the next boundary, so no share is lost.
  test('Second Wind loses no share when your next decision comes mid-turn: with a Heavy weapon, struck between a boundary and your decision, it still heals its whole total over its turns', () => {
    let merged = 0;
    for (const depth of H.DEPTHS) for (const rank of [1, 2]) for (const seed of [1, 2, 3]) {
      const s = windRoom(depth, { seed, rulesOff: [] }, rank, { spec: { kit: { weapon: { form: 'heavy' } } } }), max = s.actors[0].maxHp;
      const target = s.actors[1].uid, strike = { a: 'attack', uid: target };
      const r = H.play(C, s, (st, i) => i < 12 ? (C.Step.legal(st).some(l => json(l) === json(strike)) ? strike : WAIT) : null, { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), [], `d${depth}`);
      const params = Clauses.params(R.PERKS.second_wind.params, null, { depth });
      const [m, total] = healedRight(r, params, rank, max);
      assert.equal(m, null, `d${depth} rank ${rank} seed ${seed}`);
      const got = heals(r).reduce((n, e) => n + e.amount, 0);
      assert.equal(got, total, 'its whole total');
      if (heals(r).length < N.PERK_SECOND_WIND_TURNS && heals(r).every(e => e.amount > 0)) merged++;
    }
    assert.ok(merged > 0, 'no run had its next decision mid-turn as Second Wind came');
  });

  // Brought at a boundary: a line due there (M.11's station, its chime's line, §5.4) takes you
  // below the line as the boundary runs, after its statuses' turn (step 4), with you to act
  // first after it. second_wind is settled as the boundary ends (Step.boundary), so it covers
  // the 5 turns from that decision of yours, "5 turns left" there, its first share coming at
  // the next boundary with the second's, and every share healed; and every status is settled
  // at the end of the step (status_timing).
  test('Second Wind brought by a line due at a boundary (M.11\'s station): its status covers the turns from your next decision, settled as the boundary ends, and heals its whole total, at both ranks, depths 1–7', () => {
    const ROW = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
    const SECTION = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 14, y1: 5 }];
    for (const depth of H.DEPTHS) for (const rank of [1, 2]) {
      const sp = C.Packs.species('M11', 'M11.2');
      const s = H.room(C, depth, { acc: 'M11', depth, map: ROW, you: [8, 1], rooms: SECTION, grade: Math.min(N.GRADE_MAX, depth),
        exhibits: [{ sp: 'M11.2', at: [2, 1], stats: Roles.stats(sp.role, depth), pips: 1 }] }, { invulnerable: true });
      s.actors[1].route = { dir: 'E' };
      C.Modules.init(s, C.Packs.get('M11'));
      hold(s, 'second_wind', rank);
      const you = s.actors[0], net = Specials.net(C.Roles.at(N.DEMO_LINE_DMG, depth), you.pad), max = you.maxHp;
      assert.ok(lowest(max) + net - 1 <= max, `depth ${depth}: the line cannot take you below the line from health you can have`);
      let at = null, left = null;
      const r = H.play(C, s, (st, i) => {
        const w = st.dept.perk && st.dept.perk.wind;
        if (!w) st.actors[0].hp = lowest(max) + net - 1;
        else if (at === null) { at = i; left = Status.left(st, st.actors[0], 'second_wind'); }
        return at !== null && i > at + N.PERK_SECOND_WIND_TURNS + 1 ? null : WAIT;
      }, { cap: 60 });
      assert.deepEqual(r.violations.map(v => v.text), [], `depth ${depth} rank ${rank}`);
      const w = winds(r), hit = r.events[r.events.indexOf(w[0]) - 1];
      assert.ok(w.length === 1 && hit && hit.cause.k === 'special' && hit.tick % N.TICKS_PER_TURN === 0, `depth ${depth}: Second Wind came from the line at a boundary: ${json(hit)}`);
      assert.equal(left, N.PERK_SECOND_WIND_TURNS, `depth ${depth}: at your next decision it has ${left} turns left`);
      const total = Int.pct(max, N.PERK_SECOND_WIND_PCT[rank - 1]), got = heals(r);
      assert.equal(got.reduce((n, e) => n + e.amount, 0), total, `depth ${depth} rank ${rank}: healed ${json(got.map(e => [e.turn, e.amount]))}, not ${total}`);
      assert.ok(got.every(e => e.turn > w[0].turn && e.turn < w[0].turn + N.PERK_SECOND_WIND_TURNS), `depth ${depth}: healed at turns ${json(got.map(e => e.turn))}, after turn ${w[0].turn}, within its turns`);
    }
  });

  // ---- The threat of a staggered owner's mark ----

  // A tethered warden (S.9's) beside you marks its ring of blows on your tile; then it is staggered
  // (as a rule may stagger an exhibit that shows a mark: perks-a.test.js), so its next action is
  // lost and the ring waits with it. At each step the threat of a wait (Specials.threat) warns of
  // the ring exactly when the ring goes off before your next decision. Played twice: at your
  // usual speed, the lost action and then the ring each come after your next decision, so the
  // threat must not warn while it waits (over-warning); and with you slowed (every wait of yours
  // 200 ticks), the lost action and the ring both come before your next decision, so it must
  // warn even though the owner is staggered (under-warning, which would let the ring strike
  // unannounced).
  test('the threat counts a staggered owner\'s lost action: a mark that waits with it is warned of only when it will go off before your next decision, never later (S.9\'s warden, depths 1–7; you at your speed, and slowed)', () => {
    const list = H.species(C, 'tethered_warden').filter(x => x.sp.id === 'S9.4');
    for (const slow of [false, true]) for (const { sp, depth } of list) {
      const s = C.Setup.room(depth, { acc: 'T0', depth, map: ROOM, you: [3, 2], exhibits: [{ sp: sp.id, at: [4, 2], mode: 'hunting', stats: Roles.stats(sp.role, depth), sawYou: true, stim: 0 }] }, { invulnerable: true });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      if (slow) { Status.apply(s, s.actors[0], 'slowed', 'perm', { k: 'status', id: 'slowed' }, []); Status.settle(s); }
      let staggered = null;
      const said = [], held = [];
      const r = H.play(C, s, (st, i, c) => {
        const w = st.actors[1];
        if (staggered === null && w.telegraph) { staggered = i; Status.apply(st, w, 'staggered', N.STAGGER_TURNS, { k: 'perk', id: 'single_file' }, []); Status.settle(st); }
        if (staggered !== null && i > staggered + 4) return null;
        if (staggered !== null) { said.push(!!Specials.threat(st, WAIT)); held.push(Status.has(w, 'staggered') && !!w.telegraph); }
        return WAIT;
      }, { cap: 20 });
      const where = `depth ${depth}${slow ? ', slowed' : ''}`;
      assert.deepEqual(r.violations.map(v => v.text), [], where);
      assert.ok(staggered !== null, `${where}: the warden never marked`);
      const went = r.steps.slice(staggered).map(st => st.events.some(e => e.k === 'damaged' && e.who === 'you' && e.cause && e.cause.k === 'special'));
      assert.equal(json(said), json(went.slice(0, said.length)), `${where}: warned ${json(said)}, went off ${json(went)}`);
      // At your speed the ring waits one action, then goes off; slowed, it goes off within your
      // first wait, its owner staggered as you decided, and was warned of.
      assert.equal(json(went.slice(0, 2)), json(slow ? [true, false] : [false, true]), `${where}: the ring went off ${json(went)}`);
      assert.ok(held[0] && said[0] === slow, `${where}: staggered with its mark at your decision, warned ${said[0]}`);
    }
  });

  // ---- All three, in real departments ----

  // The three perks held together at one rank (the first at depth 2, the second at depth 5), in
  // each department, with its real exhibits: you strike awake the first sleepers you can reach
  // (standing by each, as a test may set a room), then stand by the nearest doorway to them and
  // wait while they come to you; your health starts at the line, so Second Wind comes. Every
  // invariant is held after every step.
  function dept(acc, depth, rank) {
    const s0 = C.Dept.create(depth, acc, depth, { carry: { perks: PERKS_B.map(id => ({ id, rank })) }, invulnerable: true });
    const out = { violations: [], filed: 0, wind: 0, elbow: 0, steps: 0 };
    const free = (s, x, y) => '.,\''.includes(C.Grid.ch(s.dept, x, y)) && !C.Actors.at(s, x, y) && !C.Cases.at(s, x, y);
    const doorways = [];
    for (let y = 0; y < s0.dept.h; y++) for (let x = 0; x < s0.dept.w; x++) if (',\''.includes(C.Grid.ch(s0.dept, x, y))) doorways.push([x, y]);
    let tried = 0;
    for (let i = 1; i < s0.actors.length && tried < 3; i++) {
      const s = C.State.clone(s0), a = s.actors[i];
      if (a.gone || a.mode !== 'dormant' || C.Cases.encased(s, a) || (a.size || 1) !== 1 || C.Actors.centrepiece(a)) continue;
      const at = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [a.x + dx, a.y + dy]).find(([x, y]) => free(s, x, y));
      const door = doorways.filter(([x, y]) => C.Grid.chebyshev(x, y, a.x, a.y) <= 6).sort((p, q) => C.Grid.chebyshev(p[0], p[1], a.x, a.y) - C.Grid.chebyshev(q[0], q[1], a.x, a.y))[0];
      if (!at || !door) continue;
      s.actors[0].x = at[0]; s.actors[0].y = at[1];
      const strike = { a: 'attack', uid: a.uid };
      if (!C.Step.legal(s).some(l => json(l) === json(strike))) continue;
      tried++;
      s.actors[0].hp = lowest(s.actors[0].maxHp);
      let r = H.play(C, s, [strike]);
      out.violations.push(...r.violations.map(v => v.text));
      // Beside the doorway, on its far side from the exhibit.
      const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [door[0] + dx, door[1] + dy])
        .filter(([x, y]) => free(s, x, y) && !',\''.includes(C.Grid.ch(s.dept, x, y))).sort((p, q) => C.Grid.chebyshev(q[0], q[1], a.x, a.y) - C.Grid.chebyshev(p[0], p[1], a.x, a.y))[0];
      if (!spot) continue;
      s.actors[0].x = spot[0]; s.actors[0].y = spot[1];
      C.Kit.settle(s);
      r = H.play(C, s, waits(10));
      out.violations.push(...r.violations.map(v => v.text));
      out.filed += r.events.filter(e => e.k === 'perk' && e.cause.k === 'single_file').length;
      out.wind += winds(r).length;
      out.steps += r.steps.length;
      if (C.Perks.padding(s) > 0) out.elbow++;
    }
    return out;
  }
  test('the three perks together, in the three departments at depths 2 (the first rank) and 5 (the second): real exhibits struck awake come to you through doorways, and every invariant holds after every step', () => {
    let filed = 0, wind = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const [depth, rank] of [[2, 1], [5, 2]]) {
      const o = dept(acc, depth, rank);
      assert.deepEqual(o.violations.slice(0, 3), [], `${acc} d${depth} rank ${rank}`);
      assert.ok(o.steps > 0, `${acc} d${depth}: nothing was played`);
      filed += o.filed; wind += o.wind;
    }
    assert.ok(filed >= 6 && wind >= 6, `${filed} counted by Single File, ${wind} Second Winds`);
  });
};
