// ACCESSION — actors: their fields, lookup, occupancy, action costs and the scheduler
// (BUILD.md §4.1, §8.1), frozen after M3's Wave 0.
'use strict';
const Actors = (() => {
  // An actor covers size × size tiles from its top-left anchor (BUILD.md §4.1): a
  // Centrepiece is 2×2. Occupancy, distance, reach and sight all use the footprint.
  const covers = (a, x, y) => { const s = a.size || 1; return x >= a.x && y >= a.y && x < a.x + s && y < a.y + s; };
  // a's tiles, in row-major order.
  function footprint(a) {
    const s = a.size || 1, out = [];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push([a.x + dx, a.y + dy]);
    return out;
  }
  // The actor whose footprint covers (x, y), skipping `except` if given.
  const at = (state, x, y, except) => { for (const a of state.actors) if (a !== except && !a.gone && covers(a, x, y)) return a; return null; };
  const byUid = (state, uid) => { for (const a of state.actors) if (a.uid === uid) return a; return null; };
  // Chebyshev distance from (x, y) to the nearest tile of a's footprint (§4.1).
  function dist(a, x, y) {
    const s = a.size || 1, nx = Math.min(Math.max(x, a.x), a.x + s - 1), ny = Math.min(Math.max(y, a.y), a.y + s - 1);
    return Math.max(Math.abs(nx - x), Math.abs(ny - y));
  }
  // Chebyshev distance between the nearest tiles of two footprints.
  function between(a, b) {
    let best = -1;
    for (const [x, y] of footprint(b)) { const d = dist(a, x, y); if (best < 0 || d < best) best = d; }
    return best;
  }
  // Is any tile of a's footprint in line of sight from (x, y)? It is observed if any is (§4.1).
  function inSight(state, a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (Grid.los(state.dept, x, y, a.x + dx, a.y + dy)) return true;
    return false;
  }
  // A Centrepiece is known by its role (Roles.stats('centrepiece', …)), whatever its size.
  const centrepiece = a => a.role === 'centrepiece';

  // An actor's speed (§8.1): its archetype's, or a modifier's that is not switched off; a
  // fast archetype with a slow modifier moves at the usual speed.
  function speedOf(state, arch, mods) {
    let fast = 0, slow = 0;
    const count = s => { if (s === 'fast') fast++; else if (s === 'slow') slow++; };
    const A = arch && Registry.ARCHETYPES[arch];
    if (A) count(A.speed);
    for (const id of mods) { const M = Registry.MODIFIERS[id]; if (M && !(state && Options.off(state, id))) count(M.speed); }
    return fast > slow ? 'fast' : slow > fast ? 'slow' : null;
  }

  // An actor's fields (BUILD.md §4.1), every one plain data with a default, never undefined.
  // rec gives uid, sp, size, x, y, hp (and maxHp), acc, eva, pad, dmin, dmax, mode, and may
  // give what the species gives (arch, role, mods, modParams, trigger, group) and the rest:
  // next, pips, stim, home, guards, gen, ax, speed, and for a room made for a test its
  // statuses ([{id, until?, turns?, from?}]: one with until null and turns N is settled by
  // the next Status.settle), target, lastKnown and sawYou. Rules read these copies, never the
  // pack. An exhibit with no archetype is a plodder. state may be null for an actor made
  // outside a state (Setup.you).
  function make(state, rec) {
    const you = rec.uid === 'you', arch = rec.arch !== undefined ? rec.arch : you ? null : 'plodder', mods = (rec.mods || []).slice();
    const or = (k, v) => rec[k] !== undefined ? rec[k] : v;
    return {
      uid: rec.uid, sp: or('sp', null), arch, role: or('role', null), mods, modParams: copy(or('modParams', {})),
      trigger: or('trigger', null), group: or('group', null), size: or('size', 1), x: rec.x, y: rec.y,
      hp: rec.hp, maxHp: or('maxHp', rec.hp), acc: or('acc', 0), eva: or('eva', 0), pad: or('pad', 0), dmin: or('dmin', 0), dmax: or('dmax', 0),
      speed: rec.speed !== undefined ? rec.speed : speedOf(state, arch, mods),
      next: or('next', 0), notBefore: null, mode: or('mode', you ? null : 'dormant'), pips: or('pips', 0), stim: or('stim', state ? state.turn : 0),
      pipTurns: {}, sawYou: or('sawYou', false),
      home: copy(or('home', you ? null : [rec.x, rec.y])), target: copy(or('target', null)), lastKnown: copy(or('lastKnown', null)), guards: copy(or('guards', null)),
      route: null, plan: null, facing: null,
      statuses: or('statuses', []).map(statusOf), telegraph: null, acts: 0, woke: null, hunted: null, kids: 0, gen: or('gen', 0), gone: 0, ax: copy(or('ax', {})),
    };
  }
  const copy = v => v === null ? null : JSON.parse(JSON.stringify(v));
  const orNull = v => v === undefined ? null : v;
  const statusOf = s => ({ id: s.id, until: orNull(s.until), turns: orNull(s.turns), from: orNull(s.from) });
  // Create an actor and append it: actors are only ever appended during a visit (§3.3).
  function spawn(state, rec) {
    const a = make(state, rec);
    state.actors.push(a);
    return a;
  }

  // The cost in ticks of an action of `kind` ('move' for a step, 'act' for anything else):
  // the base cost, at half (fast) or double (slow) where the actor's speed applies to that
  // kind (Archetypes.speedApplies: steps only, unless its archetype says otherwise), then
  // scaled by its archetype's and modifiers' costPct, then doubled again while slowed (§8.1).
  function cost(state, a, base, kind) {
    let c = base;
    if (a.speed && Archetypes.speedApplies(state, a).includes(kind)) c = Int.pct(c, a.speed === 'fast' ? N.SPEED_FAST_PCT : N.SPEED_SLOW_PCT);
    const p = Archetypes.costPct(state, a, kind);
    if (p !== 100) c = Int.pct(c, p);
    if (Status.has(a, 'slowed')) c = Int.pct(c, N.SPEED_SLOW_PCT);
    return c;
  }
  // A blow costs its weapon form's cost (FORM_<form>[3]: Heavy 150), or for an exhibit
  // COST_ATTACK, and COST_ATTACK_HEAVY for a brute (§8.1, §8.10).
  function attackCost(state, a) {
    let base = a.role === 'brute' ? N.COST_ATTACK_HEAVY : N.COST_ATTACK;
    if (a.weaponForm) {
      const F = N['FORM_' + a.weaponForm.toUpperCase()];
      if (!F) throw new Error('Actors.attackCost: no weapon form ' + a.weaponForm);
      base = F[3];
    }
    return cost(state, a, base, 'act');
  }
  // Sleeping exhibits are not scheduled (§8.1).
  const scheduled = a => !a.gone && a.mode !== 'dormant';
  // The scheduler: the smallest next tick; ties to you, then to spawn order (array order).
  function next(state) {
    let best = null;
    for (const a of state.actors) if (scheduled(a) && (best === null || a.next < best.next)) best = a;
    return best;
  }
  return { covers, footprint, at, byUid, dist, between, inSight, centrepiece, speedOf, make, spawn, cost, attackCost, scheduled, next };
})();
