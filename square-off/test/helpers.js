'use strict';
// Shared helpers for the sim tests (not a test file itself).
const load = require('./load.js');

function SQload() { return load({ plugins: false }); }

/** Create a quiet match. players default: hustle (human) vs pack (human, i.e. scripted). */
function makeMatch(SQ, opts) {
  return SQ.Match.create(Object.assign({
    seed: 1, quiet: true, ai: false,
    players: [{ faction: 'hustle', ai: false }, { faction: 'pack', ai: false }],
  }, opts || {}));
}

function spawn(SQ, m, f, typeKey, x, z, n) {
  const ids = [];
  for (let k = 0; k < (n || 1); k++) {
    const i = SQ.World.spawnUnit(m.state, f, typeKey, x + (k % 4) * 1.2, z + Math.floor(k / 4) * 1.2);
    ids.push(m.state.units.id[i]);
  }
  SQ.World.rebuildHash(m.state);
  return ids;
}

function alive(SQ, m, ids) {
  const u = m.state.units;
  return ids.filter((id) => { const i = SQ.World.unitIndex(m.state, id); return i >= 0 && !(u.flags[i] & SQ.C.UF.OVERIT); });
}

function unitsOf(SQ, m, f) {
  const u = m.state.units, out = [];
  for (let i = 0; i < u.n; i++) if (u.faction[i] === f && !(u.flags[i] & SQ.C.UF.OVERIT)) out.push(u.id[i]);
  return out;
}

function run(m, seconds, until) {
  const ticks = Math.round(seconds / 0.05);
  for (let k = 0; k < ticks && !m.state.over; k++) {
    m.tick(0.05);
    if (until && until()) return true;
  }
  return until ? !!until() : true;
}

/**
 * A deliberately dumb scripted bot: recruit a fixed mix, send everyone idle to the nearest landmark it
 * does not own, build a Food Cart when rich, fire the Crew Call at the biggest enemy clump.
 */
function dumbBot(SQ, m, f) {
  const s = m.state, u = s.units;
  const fac = s.factions[f];
  const mix = ['crowd', 'crowd', 'talker', 'heavy'];
  fac._bot = fac._bot || { k: 0 };
  const want = mix[fac._bot.k % mix.length];
  if (SQ.cmd.recruit(m, f, want).ok) fac._bot.k++;
  // idle units -> nearest landmark not owned
  const idle = [];
  for (let i = 0; i < u.n; i++) {
    if (u.faction[i] !== f || (u.flags[i] & (SQ.C.UF.OVERIT | SQ.C.UF.REGULAR))) continue;
    const o = u.order[i];
    if (!o || (o.arrived && s.landmarks[o.lm] && s.landmarks[o.lm].owner === f)) idle.push(i);
  }
  if (idle.length) {
    let cx = 0, cz = 0;
    for (const i of idle) { cx += u.x[i]; cz += u.z[i]; }
    cx /= idle.length; cz /= idle.length;
    let best = null, bd = Infinity;
    for (const lm of s.landmarks) {
      if (lm.isHome || lm.owner === f) continue;
      const d = Math.hypot(lm.x - cx, lm.z - cz);
      if (d < bd) { bd = d; best = lm; }
    }
    if (best) SQ.cmd.order(m, f, idle.map((i) => u.id[i]), { type: 'take', lm: best.id });
  }
  if (fac.clout > 160) {
    for (const lm of s.landmarks) if (lm.owner === f && !lm.isHome && SQ.cmd.build(m, f, lm.id, -1, 'cart').ok) break;
  }
  if (fac.crew >= 100) {
    let bestI = -1, bestN = 0;
    for (let i = 0; i < u.n; i++) {
      if (u.faction[i] === f || (u.flags[i] & SQ.C.UF.OVERIT)) continue;
      const n = SQ.World.query(s, u.x[i], u.z[i], 12, []).filter((j) => u.faction[j] !== f).length;
      if (n > bestN) { bestN = n; bestI = i; }
    }
    if (bestI >= 0) {
      const lm = s.landmarks.find((l) => l.owner === f && !l.isHome);
      SQ.cmd.crewCall(m, f, { x: u.x[bestI], z: u.z[bestI], x2: u.x[bestI] + 25, z2: u.z[bestI], landmarkId: lm ? lm.id : fac.home });
    }
  }
}

module.exports = { SQload, makeMatch, spawn, alive, unitsOf, run, dumbBot };
