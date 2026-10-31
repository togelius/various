'use strict';
// Campaign runtime (js/sim/campaign.js + js/data/missions.js) and the Director (js/sim/director.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');
const SQ = load({ plugins: true, fresh: true });

function mk(missionId, opts) {
  const cfg = Object.assign(SQ.Campaign.matchConfig(missionId, opts || {}), { quiet: true });
  return SQ.Match.create(cfg);
}

/** A tutorial-following "player": does whatever the current hint points at. */
function follower(m) {
  const st = m.state, P = st.player, u = st.units;
  let hint = null;
  m.bus.on('hint', (h) => { if (!h.tip && h.text) hint = h; });
  return function step() {
    if (!hint || !hint.target) return;
    const t = hint.target;
    const mine = [];
    for (let i = 0; i < u.n; i++) if (u.faction[i] === P && !(u.flags[i] & SQ.C.UF.OVERIT)) mine.push(u.id[i]);
    if (t.lm && mine.length) {
      const L = st.lmById[t.lm];
      if (L && L.owner !== P) SQ.cmd.order(m, P, mine, { type: 'take', lm: t.lm });
    }
    if (t.ui === 'recruit.crowd') SQ.cmd.recruit(m, P, 'crowd');
    if (hint.id === 'crew' || t.ui === 'crew') {
      let x = 0, z = 0, n = 0;
      for (let i = 0; i < u.n; i++) if (u.faction[i] !== P && !(u.flags[i] & SQ.C.UF.OVERIT)) { x += u.x[i]; z += u.z[i]; n++; }
      if (n) SQ.cmd.crewCall(m, P, { x: x / n - 15, z: z / n, x2: x / n + 15, z2: z / n });
    }
  };
}

test('every mission builds a valid config and runs 30 s with hints and no errors', () => {
  for (const M of SQ.data.missions) {
    const m = mk(M.id, { pick: 'noise', seed: 5 });
    const hints = [];
    m.bus.on('hint', (h) => hints.push(h));
    for (let k = 0; k < 600 && !m.state.over; k++) m.tick(0.05);
    assert.equal(m.state.missionId, M.id);
    assert.ok(hints.length >= 1, M.id + ' emits a start hint');
    assert.ok(hints.every((h) => typeof h.id === 'string' && 'target' in h), M.id + ' hint payload shape');
    const s = SQ.Campaign.status(m);
    assert.equal(s.missionId, M.id);
    assert.equal(s.stars.length, 3);
    assert.ok(s.objective && s.progress, M.id + ' has an objective');
    // the player's crew is what the mission says (or the pick)
    assert.equal(m.state.factions[m.state.player].key, M.player === 'pick' ? 'noise' : M.player);
    assert.equal(m.state.factions.length, 1 + M.opponents.length);
  }
});

test('Mission 1 can be played through by following the hints, and cannot be lost', () => {
  const m = mk('m1', { seed: 1 });
  const step = follower(m);
  const seen = [];
  let end = null;
  m.bus.on('hint', (h) => seen.push(h.id));
  m.bus.on('missionEnd', (r) => { end = r; });
  const shoo = () => { for (const n of m.state.neutrals) if (n.kind === 'squirrel' && !n.dead) SQ.cmd.shoo(m, m.state.player, n.id); };
  for (let k = 0; k < 20 * 400 && !m.state.over; k++) {
    if (k % 20 === 0) { step(); shoo(); }
    m.tick(0.05);
  }
  assert.ok(end, 'mission ended');
  assert.equal(end.won, true);
  assert.equal(m.state.reason, 'mission');
  for (const id of ['swoop', 'tapRun', 'gotRun', 'recruit', 'bigRun', 'crew', 'bobst']) assert.ok(seen.includes(id), 'beat ' + id + ' fired');
  assert.ok(seen.indexOf('crew') > seen.indexOf('bigRun') && seen.indexOf('bobst') > seen.indexOf('crew'), 'beats in order');
  assert.ok(end.stars[0], 'win star');
  assert.ok(m.state.factions[0].stats.shooed >= 3 && end.stars[2], 'shoo bonus star (scripted Squirrel Heists)');
  assert.ok(m.state.factions[0].stats.crewCalls >= 1, 'ZOOMIES was used');
});

test('Mission 1: a passive player loses nothing (the safety net refills dogs)', () => {
  const m = mk('m1', { seed: 2 });
  const st = m.state;
  // wipe the player's units: they come back
  for (let i = st.units.n - 1; i >= 0; i--) if (st.units.faction[i] === st.player) SQ.Combat.damage(m, i, 999, 1, 'test');
  for (let k = 0; k < 20 * 40; k++) m.tick(0.05);
  assert.ok(!m.state.over, 'not over');
  assert.ok(!st.factions[st.player].eliminated);
  assert.ok(SQ.Match.unitsOf(st, st.player).length >= 2);
});

test('holdTime win (M4) and stars bookkeeping', () => {
  const m = mk('m4', { seed: 3 });
  const st = m.state;
  let end = null;
  m.bus.on('missionEnd', (r) => { end = r; });
  st.lmById.fountain.owner = st.player; st.lmById.fountain.meter = 100; st.lmById.fountain.heldSince = st.t;
  st.factions[st.player].stats.held.fountain = 149;
  for (let k = 0; k < 60 && !st.over; k++) m.tick(0.05);
  assert.ok(end && end.won && st.reason === 'mission');
  assert.equal(end.stars[1], true, 'time star (well under 6:00)');
  assert.deepEqual(SQ.Campaign.result(m), end);
});

test('context tip: losing units to their counter suggests the right shape', () => {
  const m = mk('m2', { seed: 4 });
  const st = m.state;
  const tips = [];
  m.bus.on('hint', (h) => { if (h.id === 'lost') tips.push(h); });
  const P = st.player, E = 1 - P;
  // three Hustle crowds sent home by Violet heavies (■ beats ●)
  for (let k = 0; k < 3; k++) {
    const i = SQ.World.spawnUnit(st, P, 'hustle.crowd', -120 + k, 40);
    const j = SQ.World.spawnUnit(st, E, 'violets.heavy', -118 + k, 40);
    SQ.World.rebuildHash(st);
    SQ.Combat.overIt(m, SQ.World.unitIndex(st, st.units.id[i]), E, 'sway', 'heavy');
    void j;
  }
  m.tick(0.05);
  assert.equal(tips.length, 1);
  assert.match(tips[0].text, /●.*■.*▲/);
  assert.equal(tips[0].target.ui, 'recruit.talker');
  assert.equal(tips[0].tip, true);
});

test('matchConfig: picks, distinct opponents, Chill it down', () => {
  const c = SQ.Campaign.matchConfig('m6', { pick: 'pack', seed: 9 });
  const fs = c.players.map((p) => p.faction);
  assert.equal(fs[0], 'pack');
  assert.equal(new Set(fs).size, 3, 'FFA crews are distinct');
  const chill = SQ.Campaign.matchConfig('m3', { chill: true });
  assert.equal(chill.players[1].ai.difficulty, 'chill');
  assert.equal(chill.players[0].assist, true);
  assert.equal(SQ.Campaign.stepDown('legend'), 'hard');
  assert.ok(SQ.Campaign.shouldOfferChill(2) && !SQ.Campaign.shouldOfferChill(1));
  assert.equal(SQ.Campaign.next('m1'), 'm2');
  assert.equal(SQ.Campaign.next('m6'), null);
});

// ------------------------------------------------------------------ Director
function skirmish(events, seed) {
  return SQ.Match.create({ seed: seed || 1, quiet: true, events, ai: false, players: [{ faction: 'noise', ai: false }, { faction: 'pack', ai: false }] });
}

test('Director: first event warned 8 s ahead at 1:30, then one every 70-100 s', () => {
  const m = skirmish('normal', 7);
  const warns = [], starts = [];
  m.bus.on('eventWarn', (p) => warns.push({ t: m.state.t, p }));
  m.bus.on('eventStart', (p) => starts.push({ t: m.state.t, p }));
  for (let k = 0; k < 20 * 400; k++) m.tick(0.05);
  assert.ok(starts.length >= 3, 'several events');
  assert.ok(Math.abs(starts[0].t - 90) < 0.11, 'first event at 1:30');
  assert.ok(Math.abs(warns[0].t - 82) < 0.11, 'announced 8 s ahead');
  for (let k = 1; k < starts.length; k++) {
    const gap = starts[k].t - starts[k - 1].t;
    if (starts[k].p.kind === 'bells' || starts[k - 1].p.kind === 'bells') continue;
    assert.ok(gap >= 69 && gap <= 140, 'gap ' + gap);
  }
  for (const w of warns) assert.ok(typeof w.p.text === 'string' && w.p.text.length > 5 && isFinite(w.p.x) && isFinite(w.p.z));
});

test('Director: events off -> none; calm is slower than chaos', () => {
  const count = (mode) => {
    const m = skirmish(mode, 3);
    let n = 0;
    m.bus.on('eventStart', () => n++);
    for (let k = 0; k < 20 * 590; k++) m.tick(0.05);
    return n;
  };
  assert.equal(count('off'), 0);
  const calm = count('calm'), chaos = count('chaos');
  assert.ok(chaos > calm, `chaos ${chaos} > calm ${calm}`);
});

test('Director: every event kind starts, applies its effect, and cleans up', () => {
  const m = skirmish('off', 2);
  const st = m.state;
  st.lmById.arch.owner = 0; st.lmById.smallrun.owner = 1; st.lmById.fountain.owner = 1;
  assert.ok(SQ.cmd.build(m, 1, 'smallrun', -1, 'cart').ok);
  for (let k = 0; k < 140; k++) m.tick(0.05);
  const seen = {};
  for (const kind of Object.keys(SQ.data.events)) {
    const before = st.factions.map((f) => f.clout);
    const e = SQ.Director.trigger(m, kind, {});
    assert.ok(e, kind);
    for (let k = 0; k < 20 * 9; k++) m.tick(0.05);
    assert.equal(e.state, kind === 'bells' ? 'done' : (e.state === 'done' ? 'done' : 'active'), kind + ' started');
    seen[kind] = {
      zones: st.zones.map((z) => z.kind), rain: st.weather.rain, freeze: st.freezeUntil, neutrals: st.neutrals.map((n) => n.kind),
      bonus: st.lmById.smallrun.bonusClout, clout: st.factions.map((f, k) => f.clout - before[k]),
    };
    for (let k = 0; k < 20 * 60 && e.state !== 'done'; k++) m.tick(0.05);
    assert.equal(e.state, 'done', kind + ' ended');
  }
  assert.ok(seen.piano.zones.includes('piano') && seen.piano.neutrals.includes('piano'));
  assert.ok(seen.pigeonLady.zones.includes('pigeons') && seen.pigeonLady.neutrals.includes('pigeonLady'));
  assert.ok(seen.pep.zones.filter((z) => z === 'pep').length === 2 && seen.pep.neutrals.includes('pep'));
  assert.ok(seen.shower.rain);
  assert.ok(seen.bells.freeze > 0);
  assert.ok(seen.tourists.neutrals.filter((k) => k === 'tourist').length === 20);
  assert.ok(seen.graduation.neutrals.filter((k) => k === 'graduate').length === 80 && seen.graduation.zones.includes('graduationSpeed'));
  // after everything: no event zones left, rain off, bonuses reset, actors gone
  for (let k = 0; k < 20 * 15; k++) m.tick(0.05);
  assert.deepEqual(st.zones.filter((z) => z.kind !== 'drumCircle').map((z) => z.kind), []);
  assert.equal(st.weather.rain, false);
  assert.equal(st.lmById.smallrun.bonusClout, 0);
  assert.deepEqual([...new Set(st.neutrals.map((n) => n.kind))].sort(), ['dosa', 'parkHouse', 'pigeonFlock']);
});

test('Director: squirrels rob an unguarded cart, can be shooed, and flee from guards', () => {
  const m = skirmish('off', 4);
  const st = m.state;
  st.lmById.bobst.owner = 1;
  assert.ok(SQ.cmd.build(m, 1, 'bobst', -1, 'cart').ok);
  for (let k = 0; k < 140; k++) m.tick(0.05);
  // pull the Pack's units far away so the cart is unguarded and no dogs scare them
  for (let i = 0; i < st.units.n; i++) { st.units.x[i] = -150; st.units.z[i] = -66 + (i % 5); }
  SQ.World.rebuildHash(st);
  let stolen = 0;
  m.bus.on('clout', (p) => { if (p.reason === 'heist') { assert.equal(p.faction, 1); stolen += p.amount; } });
  SQ.Director.trigger(m, 'squirrelHeist', { warn: 0 });
  m.tick(0.05);
  const sq = st.neutrals.filter((n) => n.kind === 'squirrel');
  assert.ok(sq.length >= 3 && sq.length <= 5);
  assert.ok(sq.every((s) => s.victim === 1 && s.shooable));
  // shoo one right away
  const r = SQ.cmd.shoo(m, 0, sq[0].id);
  assert.ok(r.ok);
  for (let k = 0; k < 20 * 30; k++) m.tick(0.05);
  assert.ok(st.factions[1].stats.heists >= 1, 'heists happened');
  assert.ok(stolen <= -20, 'lost Clout to the squirrels');
  assert.ok(!st.neutrals.some((n) => n.kind === 'squirrel'), 'all gone afterwards');
  assert.equal(st.factions[0].stats.shooed, 1);
});

test('Director: event targeting never picks a faction 300+ Turf behind', () => {
  const m = skirmish('chaos', 8);
  const st = m.state;
  st.factions[0].turf = 900; st.factions[1].turf = 100;
  const targets = [];
  m.bus.on('eventWarn', (p) => targets.push(p.target));
  for (let k = 0; k < 20 * 400; k++) { st.factions[0].turf = Math.max(st.factions[0].turf, 900); m.tick(0.05); }
  assert.ok(targets.length >= 4);
  assert.ok(targets.every((t) => t === 0), 'always the leader: ' + targets.join(','));
});

test('Director is deterministic', () => {
  const run = () => {
    const m = skirmish('chaos', 21);
    const log = [];
    m.bus.on('eventStart', (p) => log.push(p.kind + '@' + m.state.t.toFixed(2) + ':' + p.lm));
    for (let k = 0; k < 20 * 300; k++) m.tick(0.05);
    return log.join('|') + '#' + m.hash();
  };
  assert.equal(run(), run());
});

test('Director: a guarded cart scares the squirrels off (no heist)', () => {
  const m = skirmish('off', 6);
  const st = m.state;
  st.lmById.bobst.owner = 0; // Noise (not Animals)
  assert.ok(SQ.cmd.build(m, 0, 'bobst', -1, 'cart').ok);
  for (let k = 0; k < 140; k++) m.tick(0.05);
  const cart = st.setups[0];
  // Noise units stand guard at the cart; the Pack's dogs are far away
  for (let i = 0; i < st.units.n; i++) {
    if (st.units.faction[i] === 0) { st.units.x[i] = cart.x + (i % 3); st.units.z[i] = cart.z + 1; } else { st.units.x[i] = -150; st.units.z[i] = 66; }
    st.units.order[i] = null; st.units.ax[i] = st.units.x[i]; st.units.az[i] = st.units.z[i];
  }
  SQ.World.rebuildHash(st);
  SQ.Director.trigger(m, 'squirrelHeist', { warn: 0 });
  for (let k = 0; k < 20 * 30; k++) m.tick(0.05);
  assert.equal(st.factions[0].stats.heists, 0);
});
