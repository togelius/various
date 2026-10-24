// ACCESSION — the tethered_warden archetype's hooks (BUILD.md §5.1, §5.3, §8.1, §8.2;
// rules/archetypes.js), owned by W1-ARCH-C. Its Behaviour-line clause and registry entry are
// in js/core/reg/arch-c.js.
//
// The rule, as its line says it:
//   - Its tether. It guards a tile (`guards`, its own tile when it is made, unless given), and
//     never steps off the disc of TETHER_RANGE round it (Grid.disc, "within r", §8.2): mayStep
//     refuses any step that would take a tile of it outside. So nothing, a noise to look at
//     included, draws it past the edge. (Put outside the disc by something else, it may only
//     step nearer to what it guards.)
//   - Leaving. When you stand outside that disc at its action while it hunts or searches for
//     you, it goes back (Wake.setMode to returning, cause tether), and then acts by its mode,
//     which walks it home; it never fights you outside its tether. An exhibit with no home
//     cannot go back, so it holds its place instead.
//   - Its ring. Its special, `ring`, marks the tiles round it (Specials.tiles) and strikes them
//     at its next action. It marks only while hunting, with you on one of those tiles, at its
//     ROLE_WARDEN_SPECIAL_EVERY-th action since it woke or at the first one after that where
//     you are on its ring, and then no sooner than ROLE_WARDEN_SPECIAL_EVERY actions after each
//     mark (ax.due: the count of actions, `acts`, at which the next ring is due; D2.14). A ring
//     the overlap rule holds back (Specials.canMark) waits for the next action.
//   - Home. When it reaches home going back (onHome, called by AI.byMode), it heals to full
//     (healed, cause home), then settles as every exhibit does.
//   - Otherwise it fights as a plodder (AI.byMode): it strikes from beside you.
'use strict';
(() => {
  const within = (g, x, y) => Grid.disc(x - g[0], y - g[1], N.TETHER_RANGE);
  // Is every tile of a's footprint, with its anchor at (x, y), within its tether?
  function inside(a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!within(a.guards, x + dx, y + dy)) return false;
    return true;
  }
  const sq = (g, x, y) => (x - g[0]) * (x - g[0]) + (y - g[1]) * (y - g[1]);
  const due = a => a.ax && Number.isInteger(a.ax.due) ? a.ax.due : N.ROLE_WARDEN_SPECIAL_EVERY;

  // It guards the tile it is made on, unless it was given one, and its first ring is due at
  // its ROLE_WARDEN_SPECIAL_EVERY-th action.
  function init(state, a) {
    if (!a.guards) a.guards = [a.x, a.y];
    if (!Number.isInteger(a.ax.due)) a.ax.due = N.ROLE_WARDEN_SPECIAL_EVERY;
  }
  // Its actions are counted again from each waking (acts), and so is its ring.
  function onWake(state, a) {
    a.ax.due = N.ROLE_WARDEN_SPECIAL_EVERY;
  }

  // A step to anchor (x, y) keeps it within its tether; from outside, only a step nearer.
  function mayStep(state, a, x, y) {
    if (!a.guards) return true;
    if (inside(a, x, y)) return true;
    return !inside(a, a.x, a.y) && sq(a.guards, x, y) < sq(a.guards, a.x, a.y);
  }

  function act(state, a, ev) {
    if (!a.guards) return null;
    const you = state.actors[0];
    if ((a.mode === 'hunting' || a.mode === 'searching') && !within(a.guards, you.x, you.y)) {
      if (!a.home) return AI.wait(state, a, ev);
      Wake.setMode(state, a, 'returning', { k: 'tether' }, ev);
      return null;
    }
    if (a.mode === 'hunting' && a.acts >= due(a)) {
      const tiles = Specials.tiles(state, a, 'ring');
      if (tiles.some(t => t[0] === you.x && t[1] === you.y) && Specials.canMark(state, a, 'ring', tiles)) {
        a.ax.due = a.acts + N.ROLE_WARDEN_SPECIAL_EVERY;
        return Specials.mark(state, a, 'ring', tiles, ev);
      }
    }
    return null;
  }

  // Home again: it heals to full (nothing to tell if it is not hurt).
  function onHome(state, a, ev) {
    const amount = a.maxHp - a.hp;
    if (a.gone || amount <= 0) return;
    a.hp = a.maxHp;
    Causes.emit(state, ev, 'healed', { who: a.uid, amount, hp: a.hp }, { k: 'home', by: a.uid });
  }

  Archetypes.add('tethered_warden', { init, onWake, mayStep, act, onHome });
})();
