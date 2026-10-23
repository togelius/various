// ACCESSION — exhibit numbers from role and depth (BUILD.md §8.10): the role curves are
// anchored at depths 1, 4 and 8 and interpolated linearly, rounding down.
'use strict';
const Roles = (() => {
  const ANCHORS = [1, 4, 8];
  function at(values, depth) {
    if (depth <= ANCHORS[0]) return values[0];
    for (let i = 0; i + 1 < ANCHORS.length; i++) {
      const a = ANCHORS[i], b = ANCHORS[i + 1];
      if (depth <= b) return values[i] + Int.idiv((values[i + 1] - values[i]) * (depth - a), b - a);
    }
    return values[values.length - 1];
  }
  // Every role has all five rows; a missing one is an error, never a silent default.
  function row(role, what) {
    const key = 'ROLE_' + role.toUpperCase() + '_' + what;
    if (!(key in N)) throw new Error('Roles: missing number ' + key);
    return N[key];
  }
  function stats(role, depth) {
    const dmg = row(role, 'DMG');
    return {
      role, hp: at(row(role, 'HP'), depth), acc: at(row(role, 'ACC'), depth), eva: at(row(role, 'EVA'), depth),
      pad: at(row(role, 'PAD'), depth), dmin: at(dmg.map(d => d[0]), depth), dmax: at(dmg.map(d => d[1]), depth),
    };
  }
  const ROLES = ['fodder', 'skirmisher', 'artillery', 'brute', 'controller', 'warden', 'support', 'swarm', 'ambusher', 'centrepiece'];
  return { at, stats, ROLES };
})();
