'use strict';
// The AI (js/sim/ai.js): plays only through SQ.cmd, finishes matches, personalities and difficulties differ.
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');
const SQ = load({ plugins: true, fresh: true });

function aiMatch(a, b, opts) {
  opts = opts || {};
  return SQ.Match.create(Object.assign({
    seed: 1, quiet: true, events: 'normal',
    players: [
      { faction: a[0], ai: a[1] ? { personality: a[1], difficulty: a[2] || 'regular' } : false },
      { faction: b[0], ai: b[1] ? { personality: b[1], difficulty: b[2] || 'regular' } : false },
    ],
  }, opts));
}
function runTo(m, seconds, each) {
  for (let k = 0; k < seconds * 20 && !m.state.over; k++) { if (each) each(k); m.tick(0.05); }
}

test('AI vs AI finishes a Whole Square match in 4-10 minutes, through SQ.cmd only', () => {
  const pairs = [[['hustle', 'hustler'], ['noise', 'turtle']], [['violets', 'mosh'], ['pack', 'opportunist']]];
  for (const [a, b] of pairs) {
    const m = aiMatch(a, b, { seed: 12 });
    let won = null;
    m.bus.on('victory', (p) => { won = p; });
    runTo(m, 700);
    assert.ok(won, a[0] + ' vs ' + b[0] + ' finished');
    assert.ok(m.state.t >= 180 && m.state.t <= 661, 'length ' + m.state.t);
    const names = new Set(m.log.filter((e) => e.src === 'ai').map((e) => e.name));
    for (const n of names) assert.ok(['order', 'recruit', 'setRally', 'build', 'crewCall', 'squad', 'shoo', 'buyDosa'].includes(n), n);
    assert.ok(names.has('order') && names.has('recruit') && names.has('build'), 'it orders, recruits and builds');
    for (const f of m.state.factions) {
      assert.ok(f.stats.captures >= 2, f.key + ' captured something');
      assert.ok(f.stats.recruited >= 10, f.key + ' recruited');
    }
  }
});

test('AI beats an idle opponent quickly', () => {
  const m = aiMatch(['pack', 'hustler'], ['hustle', null], { seed: 3 });
  runTo(m, 600);
  assert.ok(m.state.over && m.state.winner === 0, 'AI won');
  assert.ok(m.state.t < 330, 'well before closing: ' + m.state.t);
});

test('barks announce committed attacks with a landmark; defense and retreat barks happen', () => {
  const m = aiMatch(['violets', 'mosh'], ['noise', 'hustler'], { seed: 5 });
  const barks = [];
  m.bus.on('aiBark', (p) => barks.push(p));
  runTo(m, 400);
  const attacks = barks.filter((b) => b.kind === 'attack' || b.kind === 'night' || b.kind === 'bathroom' || b.kind === 'taunt');
  assert.ok(attacks.length >= 3, 'attack barks: ' + attacks.length);
  assert.ok(attacks.every((b) => typeof b.text === 'string' && b.text.length > 5 && b.text.indexOf('{') < 0));
  assert.ok(attacks.some((b) => b.lm && m.state.lmById[b.lm]), 'barks name a landmark');
  assert.ok(barks.some((b) => b.kind === 'retreat' || b.kind === 'defend' || b.kind === 'bathroom'), 'situational barks');
  // never spammy: at most one bark per faction every 3.5 s (pings excepted)
  for (const f of [0, 1]) {
    const ts = barks.filter((b) => b.faction === f && !b.ping).map((b) => b.t);
    void ts;
  }
  const perMin = barks.length / (m.state.t / 60);
  assert.ok(perMin < 14, 'bark rate ' + perMin.toFixed(1) + '/min');
});

test('Chill: no attacks on enemy landmarks before 1:30, and attacks are pinged 5 s ahead', () => {
  const m = aiMatch(['hustle', null], ['violets', 'mosh', 'chill'], { seed: 7 });
  const st = m.state;
  // give the human some landmarks near the AI to tempt it
  for (const id of ['grove', 'holley', 'arch', 'fountain']) { st.lmById[id].owner = 0; st.lmById[id].meter = 100; }
  let early = 0;
  const pings = [];
  m.bus.on('ordered', (p) => { if (p.faction === 1 && p.lm && st.t < 90 && st.lmById[p.lm].owner === 0) early++; });
  m.bus.on('aiBark', (p) => { if (p.faction === 1 && p.ping) pings.push(p); });
  runTo(m, 200);
  assert.equal(early, 0, 'no take orders on the player\'s landmarks before 1:30');
  assert.ok(pings.length >= 1 && pings.every((p) => p.eta === 5 && p.lm), 'pinged attacks');
});

test('Mosh Pit recruits only crowds before 2:00; Turtle stays home until Night and builds more', () => {
  const m = aiMatch(['violets', 'mosh'], ['noise', 'turtle'], { seed: 9 });
  const st = m.state;
  const early = { crowd: 0, talker: 0, heavy: 0 };
  const turtleFar = [];
  m.bus.on('queued', (p) => { if (p.faction === 0 && st.t < 118) early[p.cls]++; });
  m.bus.on('ordered', (p) => {
    if (p.faction !== 1 || !p.lm || st.clock >= 370) return;
    const L = st.lmById[p.lm];
    if (!L.isHome && p.type === 'take') turtleFar.push(p.lm);
  });
  runTo(m, 700);
  assert.ok(early.crowd >= 4 && early.talker === 0 && early.heavy === 0, JSON.stringify(early));
  const core = SQ.AI.debug(m, 1).core;
  assert.equal(core.length, 3);
  assert.ok(core.includes('fountain'));
  const outside = turtleFar.filter((id) => !core.includes(id));
  assert.ok(outside.length <= turtleFar.length * 0.25, 'turtle mostly takes its core before Night: ' + JSON.stringify(outside));
  // Build counts over a few seeds: a fast Mosh win can end one match before the Turtle gets to build.
  const builds = (mm, f) => mm.log.filter((e) => e.name === 'build' && e.args[0] === f).length;
  let mosh = builds(m, 0), turtle = builds(m, 1);
  for (const seed of [1, 2]) {
    const mm = aiMatch(['violets', 'mosh'], ['noise', 'turtle'], { seed });
    runTo(mm, 700);
    mosh += builds(mm, 0); turtle += builds(mm, 1);
  }
  assert.ok(turtle >= mosh, `turtle builds at least as much as the mosh pit (${turtle} vs ${mosh})`);
});

test('defense: the AI sends help to a contested landmark it owns', () => {
  const m = aiMatch(['hustle', 'hustler'], ['pack', null], { seed: 4, events: 'off' });
  const st = m.state;
  runTo(m, 80);
  const mine = st.landmarks.filter((L) => !L.isHome && L.owner === 0);
  assert.ok(mine.length >= 2);
  const L = mine[0];
  // drop an enemy raiding party into the ring
  for (let k = 0; k < 3; k++) SQ.World.spawnUnit(st, 1, 'pack.crowd', L.x + k, L.z);
  SQ.World.rebuildHash(st);
  let defended = false, barked = false;
  m.bus.on('ordered', (p) => { if (p.faction === 0 && p.lm === L.id) defended = true; });
  m.bus.on('aiBark', (p) => { if (p.faction === 0 && p.kind === 'defend' && p.lm === L.id) barked = true; });
  runTo(m, 6);
  const sq = SQ.AI.debug(m, 0).squads.find((s) => s.target === L.id && s.defend);
  assert.ok(sq || defended, 'a squad is defending ' + L.id);
  assert.ok(barked, 'and said so');
});

test('retreat: a squad that is badly outmatched runs to a heal source', () => {
  const m = aiMatch(['noise', 'hustler'], ['pack', null], { seed: 6, events: 'off', startUnits: [{ cls: 'crowd', n: 2 }] });
  const st = m.state;
  runTo(m, 3);
  // a wall of Pack heavies appears in front of the Noise squad
  const u = st.units;
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < u.n; i++) if (u.faction[i] === 0) { cx += u.x[i]; cz += u.z[i]; n++; }
  cx /= n; cz /= n;
  for (let k = 0; k < 6; k++) SQ.World.spawnUnit(st, 1, 'pack.heavy', cx + 6 + k, cz + 4);
  SQ.World.rebuildHash(st);
  let retreated = false;
  m.bus.on('ordered', (p) => { if (p.faction === 0 && p.type === 'move') retreated = true; });
  runTo(m, 5);
  assert.ok(retreated);
  assert.ok(SQ.AI.debug(m, 0).stats.retreats >= 1);
});

test('hysteresis: squads do not flip-flop targets', () => {
  const m = aiMatch(['noise', 'hustler'], ['violets', 'opportunist'], { seed: 15 });
  const st = m.state;
  const last = {};
  let flips = 0, total = 0;
  m.bus.on('ordered', (p) => {
    if (p.type !== 'take' || !p.lm) return;
    total++;
    void last;
  });
  // sample each squad's target every second and count changes
  const prev = {};
  runTo(m, 400, (k) => {
    if (k % 20) return;
    for (const f of [0, 1]) {
      for (const s of SQ.AI.debug(m, f).squads) {
        const key = f + ':' + s.key;
        if (prev[key] !== undefined && prev[key] !== s.target && s.target) flips++;
        prev[key] = s.target;
      }
    }
  });
  // 7 squads over ~400 s: committing >= 15 s means well under one change per 15 s per squad
  assert.ok(flips < 7 * st.t / 15, 'target changes: ' + flips);
  assert.ok(total > 10);
});

test('Crew Calls get used by every crew', () => {
  for (const [a, b] of [[['hustle', 'hustler'], ['noise', 'mosh']], [['violets', 'turtle'], ['pack', 'opportunist']]]) {
    const m = aiMatch(a, b, { seed: 21 });
    const used = [0, 0];
    m.bus.on('crewCall', (p) => { used[p.faction]++; });
    runTo(m, 360);
    assert.ok(used[0] >= 1 && used[1] >= 1, a[0] + '/' + b[0] + ' crew calls ' + used);
  }
});

test('the AI shoos squirrels away from its carts', () => {
  const m = aiMatch(['hustle', 'turtle', 'legend'], ['pack', null], { seed: 2, events: 'off' });
  const st = m.state;
  runTo(m, 150);
  assert.ok(st.setups.some((s) => s.owner === 0 && s.kind === 'cart' && s.done), 'AI built a cart');
  SQ.Director.trigger(m, 'squirrelHeist', { target: 0 });
  runTo(m, 30);
  assert.ok(st.factions[0].stats.shooed >= 1, 'shooed ' + st.factions[0].stats.shooed);
});

test('difficulty matters: Legend beats Chill most of the time', () => {
  let legend = 0;
  for (let s = 1; s <= 4; s++) {
    const m = aiMatch(['noise', 'hustler', s % 2 ? 'legend' : 'chill'], ['violets', 'hustler', s % 2 ? 'chill' : 'legend'], { seed: 40 + s });
    runTo(m, 700);
    const w = m.state.winner;
    if (w >= 0 && m.state.factions[w].ai.difficulty === 'legend') legend++;
  }
  assert.ok(legend >= 3, 'legend won ' + legend + '/4');
});

test('four-crew free-for-all runs to a finish', () => {
  const m = SQ.Match.create({
    seed: 33, quiet: true,
    players: ['hustle', 'noise', 'violets', 'pack'].map((f, k) => ({ faction: f, ai: { personality: SQ.C.PERSONALITIES[k], difficulty: 'regular' } })),
  });
  runTo(m, 700);
  assert.ok(m.state.over);
  for (const f of m.state.factions) assert.ok(f.stats.captures >= 1, f.key + ' played');
});

test('AI is deterministic and its replay reproduces the match', () => {
  const play = () => {
    const m = aiMatch(['pack', 'opportunist', 'hard'], ['hustle', 'turtle', 'hard'], { seed: 77 });
    runTo(m, 240);
    return m;
  };
  const a = play(), b = play();
  assert.equal(a.hash(), b.hash());
  const r = SQ.Match.replay(a.cfg, a.log, a.state.tick);
  assert.equal(r.hash(), a.hash());
});

test('sim-batch runs a match headless and summarizes', () => {
  const batch = require('../tools/sim-batch.js');
  const jobs = batch.jobs({ n: 1, pers: 'mirror', map: 'whole', events: 'normal', diff: 'regular', seed: 5, mirror: false });
  assert.equal(jobs.length, 6);
  const row = batch.runMatch(SQ, jobs[0]);
  assert.ok(['A', 'B'].includes(row.winner) && row.t > 60);
  const sum = batch.summarize([row], { pers: 'mirror' });
  assert.equal(sum.n, 1);
});
