// ACCESSION — the old_repair modifier's hooks (BUILD.md §5.1, §5.5, §8.1; rules/archetypes.js),
// owned by W1-ARCH-B. Its Behaviour-line clause and registry entry are in js/core/reg/arch-b.js.
//
// One side of the body is a later repair: the compass side its species gives in
// modParams.old_repair.side (N, NE, E, SE, S, SW, W or NW), copied onto the actor at spawn.
// Damage that comes from that side is doubled (OLD_REPAIR_PCT), after Padding and the
// minimum: max(DMG_MIN_ON_HIT, raw − Padding) × 2. Where damage comes from is its cause's
// `from`, the tile the blow, shot or beam last came from (§8.1): the attacker's tile for a
// blow (two tiles off for Reach), the last tile a bolt or beam crossed. It comes from the
// side of the body that tile lies toward: from the defender's nearest footprint tile, the
// direction of `from` (each axis −1, 0 or +1) is one of the eight compass points, and "that
// side" is the side's own point and its two neighbours (for W: NW, W and SW). The doubled
// damage marks its cause with `side`. Switched off (rulesOff), nothing is doubled.
'use strict';
(() => {
  const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];      // Grid's direction order
  const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;

  // The compass point (an index into POINTS) that (x, y) lies toward from a's footprint, or
  // -1 if it lies within it.
  function pointOf(a, x, y) {
    const s = a.size || 1, nx = Math.min(Math.max(x, a.x), a.x + s - 1), ny = Math.min(Math.max(y, a.y), a.y + s - 1);
    const sx = sign(x - nx), sy = sign(y - ny);
    for (let d = 0; d < 8; d++) if (Grid.DX[d] === sx && Grid.DY[d] === sy) return d;
    return -1;
  }
  // Does damage coming from (x, y) come from a's repaired side?
  function fromSide(a, side, x, y) {
    const d = POINTS.indexOf(side), p = pointOf(a, x, y);
    return d >= 0 && p >= 0 && (p === d || p === (d + 1) % 8 || p === (d + 7) % 8);
  }

  function adjustDamage(state, def, amount, cause) {
    const p = def.modParams && def.modParams.old_repair, side = p ? p.side : null, from = cause ? cause.from : null;
    if (typeof side !== 'string' || !Array.isArray(from) || from.length !== 2 || !fromSide(def, side, from[0], from[1])) return amount;
    cause.side = side;
    return Int.pct(amount, N.OLD_REPAIR_PCT);
  }

  Archetypes.addModifier('old_repair', { adjustDamage });
})();
