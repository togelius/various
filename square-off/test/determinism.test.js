'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');
const { dumbBot } = require('./helpers.js');

function play(SQ, seed, seconds, aiPlugins, mapId) {
  const m = SQ.Match.create({
    seed, quiet: true, mapId: mapId || 'whole',
    players: aiPlugins
      ? [{ faction: 'noise', ai: { personality: 'turtle', difficulty: 'regular' } }, { faction: 'violets', ai: { personality: 'mosh', difficulty: 'hard' } }]
      : [{ faction: 'noise', ai: false }, { faction: 'violets', ai: false }],
  });
  const hashes = [];
  for (let k = 0; k < seconds * 20 && !m.state.over; k++) {
    if (!aiPlugins && k % 40 === 0) { dumbBot(SQ, m, 0); dumbBot(SQ, m, 1); }
    m.tick(0.05);
    if (k % 200 === 0) hashes.push(m.hash());
  }
  return { m, hashes };
}

test('same seed + same commands -> identical state hash', () => {
  const SQ = load({ plugins: false });
  const a = play(SQ, 42, 150, false);
  const b = play(SQ, 42, 150, false);
  assert.deepEqual(a.hashes, b.hashes);
  assert.equal(a.m.hash(), b.m.hash());
  assert.ok(a.m.state.units.n > 10, 'something actually happened');
});

test('different seeds diverge (Random Spots picks landmarks by seed)', () => {
  const SQ = load({ plugins: false });
  const a = play(SQ, 1, 60, false, 'random'), b = play(SQ, 2, 60, false, 'random');
  assert.notDeepEqual(a.m.state.landmarks.map((l) => l.id), b.m.state.landmarks.map((l) => l.id));
  assert.notEqual(a.m.hash(), b.m.hash());
});

test('replay of the command log reproduces the match', () => {
  const SQ = load({ plugins: false });
  const a = play(SQ, 7, 100, false);
  const ticks = a.m.state.tick;
  const r = SQ.Match.replay(a.m.cfg, a.m.log, ticks);
  assert.equal(r.state.tick, ticks);
  assert.equal(r.hash(), a.m.hash());
});

test('AI-vs-AI with all sim plug-ins present is deterministic too', () => {
  const SQ = load({ plugins: true, fresh: true });
  const a = play(SQ, 99, 120, true);
  const b = play(SQ, 99, 120, true);
  assert.deepEqual(a.hashes, b.hashes);
  load({ plugins: false, fresh: true });
});
