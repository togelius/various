// Start scenarios. A run must not always begin in the same place, so a *start* is drawn at random:
//   where     a random sidewalk node, 120-450 m from the mission giver, in the training or the held-out part of the city
//   how       on foot (a free parked car lies 6-20 m away half the time) or already behind the wheel of a random car
//   story     which job is next (REPO MAN, SPECIAL DELIVERY or COLLECTIONS)
//   state     health, weapons, wanted level, time of day, rain, and the world's random seed (traffic, people, AI)
// The city is cut into held-out and training blocks by a fixed hash of the block's grid cell, so the held-out starts
// are in neighbourhoods no training start ever began in: the generalisation test is spatial, not just a new roll of dice.
'use strict';
const { createWorld } = require('./world');

let MAP = null;
function cityMap() {
  if (MAP) return MAP;
  const w = createWorld(1, { density: 0 });
  MAP = JSON.parse(w.run(`JSON.stringify((() => {
    const g = CITY.place('mission'), walk = [];
    for (const n of CITY.walkNodes) {
      const bl = CITY.blockAt(n.x, n.z); if (!bl) continue; const ln = CITY.nearestLane(n.x, n.z); const [lx, lz] = CITY.lanePoint(ln.e, 1, ln.s);
      walk.push({ x: Math.round(n.x * 10) / 10, z: Math.round(n.z * 10) / 10, bi: bl.i, bj: bl.j, lane: { x: Math.round(lx * 10) / 10, z: Math.round(lz * 10) / 10, angle: Math.atan2(ln.e.dx, ln.e.dz) } });
    }
    return { giver: [g.x, g.z], walk };
  })())`));
  return MAP;
}
// the held-out neighbourhoods: about a quarter of the blocks, fixed
const isHeldOutBlock = (bi, bj) => ((bi * 7 + bj * 3) % 4 + 4) % 4 === 0;

function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const weighted = (rng, pairs) => { let r = rng() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };

const CAR_TYPES = ['sedan', 'sedan', 'hatch', 'taxi', 'pickup', 'muscle', 'sports', 'van'];

// split: 'train' | 'heldout' | 'any'
function sampleStart(rng, opts = {}) {
  const map = cityMap(), split = opts.split || 'train', minD = opts.minDist || 120, maxD = opts.maxDist || 450;
  let node = null;
  for (let tries = 0; tries < 400 && !node; tries++) {
    const n = pick(rng, map.walk), d = Math.hypot(n.x - map.giver[0], n.z - map.giver[1]); if (d < minD || d > maxD) continue;
    const held = isHeldOutBlock(n.bi, n.bj); if ((split === 'train' && held) || (split === 'heldout' && !held)) continue;
    // a car start or a parked car needs the lane to be near
    if (Math.hypot(n.lane.x - n.x, n.lane.z - n.z) > 22) continue; node = n;
  }
  if (!node) throw new Error('no start found for split ' + split);
  const inCar = rng() < (opts.carShare === undefined ? 0.3 : opts.carShare);
  const s = { split, story: pick(rng, opts.stories || [1, 2, 3]), hour: pick(rng, [7, 9, 12, 14, 17, 20, 22, 2]), rain: rng() < 0.2, seed: Math.floor(rng() * 65535) + 1,
    hp: weighted(rng, [[100, 6], [70, 2], [40, 2]]), money: 500, wanted: weighted(rng, [[0, 85], [1, 10], [2, 5]]), weapons: rng() < 0.2 ? ['pistol'] : [],
    x: node.x + (rng() - 0.5) * 2, z: node.z + (rng() - 0.5) * 2, heading: rng() * Math.PI * 2, block: [node.bi, node.bj], giverDist: Math.round(Math.hypot(node.x - map.giver[0], node.z - map.giver[1])) };
  if (inCar) { s.car = { type: pick(rng, CAR_TYPES), x: node.lane.x, z: node.lane.z, angle: node.lane.angle, color: Math.floor(rng() * 6) }; s.x = node.lane.x; s.z = node.lane.z; s.heading = node.lane.angle; }
  else if (rng() < 0.5) { const a = rng() * Math.PI * 2; s.parked = { type: pick(rng, CAR_TYPES), x: node.lane.x, z: node.lane.z, angle: node.lane.angle, color: Math.floor(rng() * 6) }; void a; }
  s.mode = inCar ? 'car' : s.parked ? 'foot+car' : 'foot';
  return s;
}

// a fixed list of n starts for a seed and split (the held-out set, or a validation set)
function makeStarts(seed, n, split, opts = {}) {
  const rng = mulberry(seed), out = [];
  for (let i = 0; i < n; i++) { const s = sampleStart(rng, { split, ...opts }); s.id = `${split[0]}${seed}-${i}`; out.push(s); }
  return out;
}
// seconds of game time a start is given: 90 s, plus time for a long way to go (about 2 minutes for a typical start;
// a job passed from where you stand takes most of that, so passing one is within reach but not easy)
const budget = s => Math.round(90 + Math.min(50, s.giverDist / 7));

module.exports = { cityMap, sampleStart, makeStarts, mulberry, isHeldOutBlock, budget };
