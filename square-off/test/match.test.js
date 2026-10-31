'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQload, makeMatch, spawn, alive, unitsOf, run, dumbBot } = require('./helpers.js');
const SQ = SQload();

test('a dumb scripted bot beats a passive opponent on the Whole Square', () => {
  const m = makeMatch(SQ, { seed: 3, players: [{ faction: 'pack', ai: false }, { faction: 'hustle', ai: false }] });
  let won = null;
  m.bus.on('victory', (p) => { won = p; });
  for (let k = 0; k < 20 * 600 && !won; k++) {
    if (k % 40 === 0) dumbBot(SQ, m, 0);
    m.tick(0.05);
  }
  assert.ok(won, 'match finished');
  assert.equal(won.winner, 0);
  assert.ok(['turf', 'elimination'].includes(won.reason));
  assert.ok(m.state.t < 600);
  const st = won.stats.factions[0].stats;
  assert.ok(st.captures >= 4 && st.recruited > 0);
  assert.ok(won.stats.history.length > 10, 'Turf curves for the Park Report');
});

test('bot vs bot on every map ends by Turf, clock or sudden death within 10:00', () => {
  for (const mapId of ['whole', 'north', 'south', 'random']) {
    const m = makeMatch(SQ, { seed: 11, mapId, players: [{ faction: 'violets', ai: false }, { faction: 'noise', ai: false }] });
    let won = null;
    m.bus.on('victory', (p) => { won = p; });
    for (let k = 0; k < 20 * 700 && !won; k++) {
      if (k % 40 === 0) { dumbBot(SQ, m, 0); dumbBot(SQ, m, 1); }
      m.tick(0.05);
    }
    assert.ok(won, mapId + ' finished');
    assert.ok(m.state.t <= 661, mapId + ' within 10:00 (+ sudden death)');
  }
});

test('three- and four-crew games use the SW and NE Home Spots', () => {
  const m = makeMatch(SQ, { players: ['hustle', 'noise', 'violets', 'pack'].map((f) => ({ faction: f, ai: false })) });
  assert.deepEqual(m.state.factions.map((f) => f.home), ['home_nw', 'home_se', 'home_sw', 'home_ne']);
  run(m, 5);
  assert.equal(m.state.units.n, 20);
});

test('park closes at 10:00: highest Turf wins; a tie goes to sudden death at the Fountain', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  let won = null, sd = null;
  m.bus.on('victory', (p) => { won = p; });
  m.bus.on('suddenDeath', (p) => { sd = p; });
  run(m, 600.1);
  assert.ok(sd, 'tied at 0 Turf -> sudden death');
  assert.equal(m.state.clock, 600);
  const ft = m.state.lmById.fountain;
  ft.owner = 1; ft.meter = 100;
  run(m, 61);
  assert.ok(won && won.winner === 1 && won.reason === 'suddenDeath');
});

test('elimination: no units, no landmarks, < 40 Clout', () => {
  const m = makeMatch(SQ, {});
  const s = m.state;
  for (const id of unitsOf(SQ, m, 1)) SQ.Combat.damage(m, SQ.World.unitIndex(s, id), 999, 0, 'test');
  s.factions[1].clout = 10; // after the Grudge refunds
  let won = null;
  m.bus.on('victory', (p) => { won = p; });
  run(m, 0.1);
  assert.ok(s.factions[1].eliminated);
  assert.ok(won && won.winner === 0 && won.reason === 'elimination');
});

test('commands are validated', () => {
  const m = makeMatch(SQ, {});
  const mine = unitsOf(SQ, m, 0), theirs = unitsOf(SQ, m, 1);
  assert.equal(SQ.cmd.order(m, 0, theirs, { type: 'move', x: 0, z: 0 }).reason, 'units', 'cannot order enemy units');
  assert.equal(SQ.cmd.order(m, 0, mine, { type: 'take', lm: 'nowhere' }).reason, 'landmark');
  assert.equal(SQ.cmd.order(m, 0, mine, { type: 'attack', targetId: mine[0] }).reason, 'target');
  assert.equal(SQ.cmd.order(m, 0, mine, { type: 'dance' }).reason, 'type');
  assert.equal(SQ.cmd.order(m, 5, mine, { type: 'stop' }).reason, 'faction');
  assert.equal(SQ.cmd.recruit(m, 0, 'wizard').reason, 'class');
  assert.equal(SQ.cmd.crewCall(m, 0, { x: 0, z: 0 }).reason, 'charging');
  assert.ok(SQ.cmd.order(m, 0, mine, { type: 'take', lm: 'grove' }).ok);
  assert.ok(SQ.cmd.order(m, 0, mine, { type: 'move', x: -100, z: 0, queue: true }).ok, 'queued');
  assert.ok(SQ.cmd.squad(m, 0, mine.slice(0, 2), 3).ok);
  assert.equal(m.state.units.squad[SQ.World.unitIndex(m.state, mine[0])], 3);
  assert.ok(SQ.cmd.order(m, 0, mine, { type: 'hold' }).ok);
  assert.ok(SQ.cmd.order(m, 0, mine, { type: 'stop' }).ok);
});

test('queued orders run in sequence; attack orders chase a target', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const ids = spawn(SQ, m, 0, 'pack.crowd', -100, -20, 2);
  SQ.cmd.order(m, 0, ids, { type: 'move', x: -80, z: -20 });
  SQ.cmd.order(m, 0, ids, { type: 'take', lm: 'holley', queue: true });
  const lm = s.lmById.holley;
  run(m, 30, () => lm.owner === 0);
  assert.equal(lm.owner, 0);
  const [enemy] = spawn(SQ, m, 1, 'hustle.talker', -60, 20, 1);
  SQ.cmd.order(m, 0, ids, { type: 'attack', targetId: enemy });
  run(m, 30, () => !alive(SQ, m, [enemy]).length);
  assert.equal(alive(SQ, m, [enemy]).length, 0);
});

test('Crew Calls: Tournament freezes, Drum Circle hurts and heals, Group Chat spawns 5, Zoomies knocks', () => {
  // Tournament
  {
    const m = makeMatch(SQ, { startUnits: [], players: [{ faction: 'hustle', ai: false }, { faction: 'pack', ai: false }] });
    const s = m.state;
    const foes = spawn(SQ, m, 1, 'pack.crowd', 0, 30, 5);
    s.factions[0].crew = 100;
    const r = SQ.cmd.crewCall(m, 0, { x: 1, z: 31 });
    assert.ok(r.ok && r.hits === 5);
    assert.ok(s.units.flags[SQ.World.unitIndex(s, foes[0])] & SQ.C.UF.FROZEN);
    assert.equal(s.factions[0].crew, 0);
    run(m, 6.1);
    assert.equal(s.units.flags[SQ.World.unitIndex(s, foes[0])] & SQ.C.UF.FROZEN, 0);
  }
  // Drum Circle
  {
    const m = makeMatch(SQ, { startUnits: [], players: [{ faction: 'noise', ai: false }, { faction: 'pack', ai: false }] });
    const s = m.state;
    const foes = spawn(SQ, m, 1, 'pack.heavy', 0, 30, 1);
    const [ally] = spawn(SQ, m, 0, 'noise.heavy', -100, -20, 1);
    s.units.hp[SQ.World.unitIndex(s, ally)] = 100;
    s.factions[0].crew = 100;
    assert.ok(SQ.cmd.crewCall(m, 0, { x: 0, z: 30 }).ok);
    s.factions[0].crew = 100;
    assert.ok(SQ.cmd.crewCall(m, 0, { x: -100, z: -20 }).ok);
    run(m, 4);
    const hpFoe = s.units.hp[SQ.World.unitIndex(s, foes[0])];
    assert.ok(hpFoe < 240 - 4 * 5 + 1 && hpFoe > 240 - 4 * 5 - 1, 'enemies take 5/s');
    assert.ok(s.units.hp[SQ.World.unitIndex(s, ally)] > 120, 'allies heal 6/s');
    run(m, 9);
    assert.equal(s.zones.length, 0, 'zones expire');
  }
  // Group Chat
  {
    const m = makeMatch(SQ, { startUnits: [], players: [{ faction: 'violets', ai: false }, { faction: 'pack', ai: false }] });
    const s = m.state;
    s.factions[0].crew = 100;
    assert.equal(SQ.cmd.crewCall(m, 0, { landmarkId: 'fountain' }).reason, 'notOwned');
    const r = SQ.cmd.crewCall(m, 0, { landmarkId: 'home_nw' });
    assert.ok(r.ok && r.ids.length === 5);
  }
  // Zoomies
  {
    const m = makeMatch(SQ, { startUnits: [], players: [{ faction: 'pack', ai: false }, { faction: 'hustle', ai: false }] });
    const s = m.state;
    const foes = spawn(SQ, m, 1, 'hustle.talker', 10, 30, 3);
    const [mine] = spawn(SQ, m, 0, 'pack.crowd', -15, 25, 1);
    s.factions[0].crew = 100;
    const before = foes.map((id) => s.units.z[SQ.World.unitIndex(s, id)]);
    assert.ok(SQ.cmd.crewCall(m, 0, { x: -10, z: 30, x2: 60, z2: 30 }).ok);
    assert.ok(s.units.speedBuffT[SQ.World.unitIndex(s, mine)] > 5, 'own units nearby get +60% speed');
    run(m, 2.5);
    let hurt = 0;
    foes.forEach((id, k) => { const i = SQ.World.unitIndex(s, id); if (s.units.hp[i] <= 55 - 29 || Math.abs(s.units.z[i] - before[k]) > 1) hurt++; });
    assert.ok(hurt >= 2, 'dogs hit the line');
  }
});

test('Dosa cart and squirrel shoo', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  assert.equal(SQ.cmd.buyDosa(m, 0).reason, 'noUnits');
  const ids = spawn(SQ, m, 0, 'hustle.crowd', -100, 50, 3);
  const c0 = s.factions[0].clout;
  assert.ok(SQ.cmd.buyDosa(m, 0).ok);
  assert.equal(c0 - s.factions[0].clout, 50);
  assert.ok(s.units.swayBuffT[SQ.World.unitIndex(s, ids[0])] > 19);
  assert.equal(SQ.cmd.buyDosa(m, 0).reason, 'cooldown');
  s.neutrals.push({ id: 'sq1', kind: 'squirrel', x: 0, z: 0, px: 0, pz: 0 });
  const c1 = s.factions[0].clout;
  assert.ok(SQ.cmd.shoo(m, 0, 'sq1').ok);
  assert.equal(s.factions[0].clout - c1, 5);
  run(m, 0.05);
  assert.ok(!s.neutrals.some((n) => n.id === 'sq1'), 'shooed squirrel removed');
});

test('campaign mission 1 boots (Pack vs a passive Squirrel Gang) and cannot be lost', () => {
  const m = SQ.Match.create({ missionId: 'm1', seed: 5, quiet: true, players: [{ faction: 'pack', ai: false }, { faction: 'squirrels', ai: { personality: 'passive', difficulty: 'chill' } }] });
  const s = m.state;
  assert.equal(s.mapId, 'firstLight');
  assert.ok(s.lmById.smallrun && s.lmById.bigrun && !s.lmById.chess);
  assert.equal(m.rules.cannotLose[0], 0);
  // wipe the player out: still not eliminated
  for (const id of unitsOf(SQ, m, 0)) SQ.Combat.damage(m, SQ.World.unitIndex(s, id), 999, 1, 'test');
  s.factions[0].clout = 0;
  run(m, 2);
  assert.equal(s.factions[0].eliminated, false);
  assert.ok(unitsOf(SQ, m, 1).length >= 6, 'squirrels hold the Big Run and Garibaldi');
});

test('Over It bubbles and squad wipe words', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const ids = spawn(SQ, m, 1, 'pack.crowd', 0, 30, 4);
  SQ.cmd.squad(m, 1, ids, 2);
  let wiped = null;
  m.bus.on('squadWiped', (p) => { wiped = p; });
  for (const id of ids) SQ.Combat.damage(m, SQ.World.unitIndex(s, id), 999, 0, 'test');
  assert.ok(wiped && wiped.word === 'BAD DOG DAY');
  assert.ok(SQ.data.text.exitLines.any.length + SQ.data.text.exitLines.hustle.length * 4 >= 70, '~80 exit lines');
});

test('performance: a busy 4-crew tick stays well under budget', () => {
  const m = makeMatch(SQ, { seed: 9, players: ['hustle', 'noise', 'violets', 'pack'].map((f) => ({ faction: f, ai: false })) });
  for (let k = 0; k < 20 * 120; k++) {
    if (k % 40 === 0) for (let f = 0; f < 4; f++) dumbBot(SQ, m, f);
    m.tick(0.05);
  }
  const t0 = process.hrtime.bigint();
  const N = 200;
  for (let k = 0; k < N; k++) m.tick(0.05);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  assert.ok(ms < 4, `avg tick ${ms.toFixed(2)} ms with ${m.state.units.n} units`);
});
