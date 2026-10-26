// ACCESSION — the splitter archetype's hooks (BUILD.md §3.2, §5.1, §5.3, §8.1;
// rules/archetypes.js), owned by W1-ARCH-A. Its Behaviour-line clause and registry entry are
// in js/core/reg/arch-a.js.
//
// "Each hit it survives with 2 or more health splits it into two halves of that health, if
// there is room beside it; halves split again, up to {SPLIT_MAX} splits deep."
//   - After any damage that leaves it standing (Archetypes.onDamaged, called by Combat.hurt
//     once health has fallen and the hit has woken it into a hunt), a body of generation
//     gen < SPLIT_MAX with 2 or more health splits: a new half takes
//     max(1, SPLIT_HP_PCT% of its health, rounded down) and the body keeps the rest, so the
//     two together have exactly the health it had. Both are then of generation gen + 1, so
//     no line of bodies is split more than SPLIT_MAX times (§8.10: splits per lineage).
//   - The half appears on the first free tile beside it, in direction order (N, NE, E, SE,
//     S, SW, W, NW): one it could step to by the exhibits' step rule, not a closed door, and
//     with nobody on it. With no such tile, or with 1 health, it does not split. No draw.
//   - The half is the same exhibit: it copies the body's species, archetype, role, modifiers,
//     trigger, group, Acc, Eva, Padding, damage, speed and maximum health; its mode is the
//     body's (a hunt, since the hit made it hunt) and it knows your tile as the body did. It
//     starts with no statuses and no pips, its home is the tile it appeared on, and its uid is
//     <body uid>/<k>, k the body's count of halves made (kids, from 1; §3.2).
//   - A half that options.without names (§3.6, by its uid) is made and at once marked gone,
//     with no event: the body still pays its share of health and counts it, so later halves
//     keep their uids and nothing else is renumbered.
//   - Its story (§3.4) is the creation cause summoned {how: 'split', from: the body, by: who
//     hit it, parent: a copy of the body's own woke}, with a creation woke event, and it first
//     acts one action after it appears (Wake.created's beat, §8.1), never in the same instant.
'use strict';
(() => {
  // The first free tile beside a, in direction order, or null.
  function freeBeside(state, a) {
    const m = state.dept;
    for (let d = 0; d < 8; d++) {
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d];
      if (!Grid.canStep(m, a.x, a.y, d, 'exhibit') || Grid.closedDoor(m, nx, ny) || Actors.at(state, nx, ny)) continue;
      return [nx, ny];
    }
    return null;
  }

  function onDamaged(state, a, amount, cause, ev) {
    if (a.gone || a.hp < 2 || a.gen >= N.SPLIT_MAX || a.mode === 'dormant' || (a.size || 1) !== 1) return;
    const at = freeBeside(state, a);
    if (!at) return;
    const share = Math.max(1, Int.pct(a.hp, N.SPLIT_HP_PCT));
    a.hp -= share;
    a.gen += 1;
    a.kids += 1;
    const half = Actors.spawn(state, {
      uid: `${a.uid}/${a.kids}`, sp: a.sp, arch: a.arch, role: a.role, mods: a.mods, modParams: a.modParams, trigger: a.trigger, group: a.group,
      size: 1, x: at[0], y: at[1], hp: share, maxHp: a.maxHp, acc: a.acc, eva: a.eva, pad: a.pad, dmin: a.dmin, dmax: a.dmax, speed: a.speed,
      mode: a.mode, gen: a.gen, target: a.target, lastKnown: a.lastKnown, sawYou: a.sawYou,
    });
    // A half that options.without names (§3.6) is made and at once marked gone, with no event,
    // as a Night Watchman is: the body has still paid its share and counted it, so every
    // later half keeps its uid.
    if ((state.options.without || []).includes(half.uid)) { half.gone = 1; return; }
    const extra = { how: 'split', from: a.uid };
    if (cause && typeof cause.by === 'string') extra.by = cause.by;
    if (a.woke) extra.parent = a.woke;
    Wake.created(state, half, 'summoned', extra, ev);
  }

  Archetypes.add('splitter', { onDamaged });
})();
