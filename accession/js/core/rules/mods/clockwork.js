// ACCESSION — the clockwork modifier's hooks (the clockwork exhibits; BUILD.md §5.1, §5.3, §8.2;
// rules/archetypes.js), owned by ARCH-CLOCKWORK. Its registry entry is in js/core/reg/arch-d.js
// and its sentences in js/core/text/arch-d.js.
//
// The rule, as its line says it ("Shows its next move as an arrow and makes it if it still can,
// else waits; cannot be dazed.", M4 plan A11, D3.12; "else", not A11's "otherwise", to keep
// M.11's stations' lines within the strip's budget):
//   - Its next move is shown (Archetypes.plan, this modifier's plan hook): the move it would
//     make if it acted now, chosen right after each of its actions and when it wakes, and
//     kept in a.plan (§4.1) until its next action. A move is one of:
//       {k: 'step', to: [x, y]}       a step of its anchor onto (x, y), a tile beside it (a
//                                     closed door there is opened, as any exhibit's step
//                                     into one opens it);
//       {k: 'strike', at: uid}        a blow at that actor (you);
//       {k: 'mark', sp, tiles}        marking its special on those tiles;
//       {k: 'resolve', sp}            its pending mark going off (§8.1: a mark resolves at
//                                     its owner's next action);
//       {k: 'wait'}                   a wait.
//     Shown, each also gives `tiles`, the tiles its arrow points at (the step's footprint,
//     the target's, the marked tiles; none for a wait).
//   - At its action (AI.act's step 4, its archetype's or this modifier's act), it makes the
//     move it showed if it still can, otherwise it waits:
//       if what it would do now is that very move (worked out on a copy of the state, which
//       is thrown away), it acts as its archetype does, so a change of mode its behaviour
//       makes with that move (giving up a search, arriving home) comes with it;
//       otherwise, if it still can make that move (the step's tile is still beside it, free,
//       and one it may step onto; you are still beside it for its blow; its archetype still
//       allows the mark: can), it makes it alone;
//       otherwise it waits.
//     Then it shows its next move. A move shown once its mark is pending is that mark going
//     off, which AI.act does before any archetype acts (§8.1).
//   - Statuses still come first (AI.act's step 1): a fixed clockwork exhibit only waits, and
//     keeps the move it showed, which it makes once it is free if it still can.
//   - Asleep it shows nothing and does nothing; a station (the demonstrator) never steps or
//     strikes, and its arrow is its line: the tiles its line would take if it were marked now
//     (HourlyDemonstration.line; D1.10: "the clockwork arrow shows it"), none with the chime
//     off, when it never strikes.
//   - It cannot be dazed (immune): Status.apply leaves dazed off it.
// Which exhibits it governs. A modifier's hooks come after its archetype's (Archetypes.act asks
// the archetype first), so clockwork makes the moves of an archetype that acts by mode alone
// (the plodder: AI.byMode), or of one that hands its action to it (Clockwork.add, the healer,
// rules/arch/conservator_healer.js, whose act gives null while clockwork is on). A station acts
// by its own act, always a wait. Any other archetype with clockwork is refused when the
// exhibit is made (init), so no line claims the rule for an exhibit that would not keep it.
//
// Clockwork, for the archetypes, the view model and the tests:
//   Clockwork.add(arch, {behave, can?, make?})   an archetype whose moves clockwork makes:
//                                behave(state, a, ev) → ticks, its whole action (never null);
//                                can(state, a, plan) → bool | undefined and make(state, a,
//                                plan, ev) → ticks | undefined, for a move of its own (a mark)
//   Clockwork.on(state, a) → bool        a carries clockwork, not switched off (Options.off)
//   Clockwork.governs(state, a) → bool   …and clockwork makes its moves (above)
//   Clockwork.next(state, a) → plan | null   the move it would make if it acted now
//   Clockwork.can(state, a, plan) → bool     could it make that move now
//   Clockwork.same(p, q) → bool              two moves are the same move
//   Clockwork.shown(state, a) → null | plan  what its arrow shows (the plan hook)
//   Clockwork.replan(state, a)               its next move, chosen now (a.plan)
'use strict';
const Clockwork = (() => {
  const ID = 'clockwork';
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const KINDS = {};

  // Clockwork.add(arch, def): clockwork makes the moves of this archetype through def.behave.
  function add(arch, def) {
    if (typeof arch !== 'string' || !own(Registry.ARCHETYPES, arch)) throw new Error(`Clockwork.add: ${arch} is not an archetype`);
    if (own(KINDS, arch)) throw new Error(`Clockwork.add: ${arch} is added twice`);
    if (!def || typeof def.behave !== 'function') throw new Error(`Clockwork.add: ${arch} needs behave(state, a, ev)`);
    for (const k of Object.keys(def)) {
      if (!['behave', 'can', 'make'].includes(k)) throw new Error(`Clockwork.add: ${arch} has no part called ${k}`);
      if (typeof def[k] !== 'function') throw new Error(`Clockwork.add: ${arch}.${k} is not a function`);
    }
    KINDS[arch] = def;
  }
  // The plodder acts by mode alone (rules/arch/plodder.js registers no act); the healer hands
  // its action to clockwork while it is on (rules/arch/conservator_healer.js, loaded before).
  add('plodder', { behave: (state, a, ev) => AI.byMode(state, a, ev) });
  add('conservator_healer', ConservatorHealer.clockwork);

  const on = (state, a) => !!a && Array.isArray(a.mods) && a.mods.includes(ID) && !Options.off(state, ID);
  const kindOf = a => a && own(KINDS, a.arch) ? KINDS[a.arch] : null;
  const governs = (state, a) => on(state, a) && kindOf(a) !== null;
  const STATION = 'demonstrator';

  const copyTile = t => [t[0], t[1]];
  const sameTiles = (p, q) => Array.isArray(p) && Array.isArray(q) && p.length === q.length && p.every((t, i) => t[0] === q[i][0] && t[1] === q[i][1]);
  // Two moves are the same move: the same kind, onto the same tile, at the same actor, the same
  // special on the same tiles.
  function same(p, q) {
    if (!p || !q || p.k !== q.k) return false;
    if (p.k === 'step') return p.to[0] === q.to[0] && p.to[1] === q.to[1];
    if (p.k === 'strike') return p.at === q.at;
    if (p.k === 'mark') return p.sp === q.sp && sameTiles(p.tiles, q.tiles);
    if (p.k === 'resolve') return p.sp === q.sp;
    return true;
  }

  // ---- What it would do now ----
  // While its plan is being worked out on a copy (next), nothing on that copy works out
  // another's: the copy is thrown away.
  let dry = 0;
  // The move a's own action made, read from that action's events: its first step (moved with
  // no cause: an exhibit's own), door opened (as the step onto it), blow or mark; else a wait.
  function describe(b, ev) {
    for (const e of ev) {
      if (e.k === 'moved' && e.who === b.uid && e.cause === undefined) return { k: 'step', to: copyTile(e.to) };
      if (e.k === 'opened' && e.who === b.uid && e.cause && e.cause.k === 'door') return { k: 'step', to: doorStep(b, e.x, e.y) };
      if (e.k === 'attacked' && e.by === b.uid) return { k: 'strike', at: e.at };
      if (e.k === 'telegraphed' && e.who === b.uid) return { k: 'mark', sp: e.sp, tiles: e.tiles.map(copyTile) };
    }
    return { k: 'wait' };
  }
  // The anchor tile of a step whose footprint takes in the door at (x, y): the first direction
  // in compass order whose step covers it (for a one-tile exhibit, the door's own tile).
  function doorStep(b, x, y) {
    const s = b.size || 1;
    for (let d = 0; d < 8; d++) {
      const nx = b.x + Grid.DX[d], ny = b.y + Grid.DY[d];
      if (x >= nx && y >= ny && x < nx + s && y < ny + s) return [nx, ny];
    }
    return [x, y];
  }
  // Clockwork.next(state, a) → the move a would make if it acted now: none asleep or gone; its
  // pending mark going off; otherwise what its behaviour does, after it looks for you, on a
  // copy of the state (AI.act's steps 2 and 4, a status that holds it aside: the move it will
  // make once free).
  function next(state, a) {
    if (!a || a.gone || a.mode === 'dormant') return null;
    if (a.telegraph) return { k: 'resolve', sp: a.telegraph.sp };
    const K = kindOf(a);
    if (!K) return { k: 'wait' };
    const i = state.actors.indexOf(a);
    if (i < 0) throw new Error(`Clockwork.next: ${a.uid} is not an actor of this state`);
    // A copy for the dry run only: it is thrown away, never hashed, and the core never reads an
    // object's keys in order (§3.3), so a plain JSON copy does what State.clone's canonical one
    // does, about ten times faster.
    const copy = JSON.parse(JSON.stringify(state)), b = copy.actors[i], ev = [];
    dry++;
    try {
      AI.look(copy, b, ev);
      K.behave(copy, b, ev);
    } finally { dry--; }
    return describe(b, ev);
  }
  // Clockwork.replan(state, a): a shows its next move now (a.plan); none once the visit is over.
  function replan(state, a) {
    if (dry || !governs(state, a)) return;
    a.plan = state.over ? null : next(state, a);
  }

  // ---- Making a move ----
  // The direction of a one-step move from (x0, y0) to (x1, y1), or -1.
  function dirTo(x0, y0, x1, y1) {
    for (let d = 0; d < 8; d++) if (x0 + Grid.DX[d] === x1 && y0 + Grid.DY[d] === y1) return d;
    return -1;
  }
  // Can a's whole footprint step in direction d now: each tile by the exhibits' step rule
  // (§8.2; a closed door may be stepped into, which opens it), no other actor where it would
  // stand, and its archetype and modifiers allow the tile.
  function canStep(state, a, d) {
    const m = state.dept, s = a.size || 1, nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d];
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      if (!Grid.canStep(m, a.x + dx, a.y + dy, d, 'exhibit')) return false;
      if (Actors.at(state, nx + dx, ny + dy, a)) return false;
    }
    return Archetypes.mayStep(state, a, nx, ny);
  }
  // Clockwork.can(state, a, plan) → bool: could a make this move now? Not from inside an intact
  // case (§8.3), save a wait.
  function can(state, a, plan) {
    if (!plan || a.gone) return false;
    if (plan.k === 'wait') return true;
    const K = kindOf(a);
    if (K && K.can) { const r = K.can(state, a, plan); if (r === true || r === false) return r; }
    if (Cases.encased(state, a)) return false;
    if (plan.k === 'step') { const d = dirTo(a.x, a.y, plan.to[0], plan.to[1]); return d >= 0 && canStep(state, a, d); }
    if (plan.k === 'strike') { const b = Actors.byUid(state, plan.at); return !!b && !b.gone && Combat.canStrike(state, a, b, { kind: 'melee' }) === null; }
    if (plan.k === 'resolve') return !!a.telegraph && a.telegraph.sp === plan.sp;
    return false;
  }
  // Make a move can allowed. Returns its cost.
  function make(state, a, plan, ev) {
    const K = kindOf(a);
    if (K && K.make) { const r = K.make(state, a, plan, ev); if (r !== undefined) return r; }
    if (plan.k === 'step') {
      const x = a.x, y = a.y, r = Step.moveInto(state, a, dirTo(a.x, a.y, plan.to[0], plan.to[1]), ev);
      if (typeof r !== 'number') throw new Error(`Clockwork: ${a.uid}'s step to ${plan.to} was refused (${r})`);
      if (a.x !== x || a.y !== y) AI.afterStep(state, a, ev);
      return r;
    }
    if (plan.k === 'strike') return Combat.strike(state, a, Actors.byUid(state, plan.at), ev);
    return AI.wait(state, a, ev);
  }

  // Its act (AI.act's step 4, after its archetype's gives null): the move it showed, if it still
  // can make it, else a wait; then its next move.
  function act(state, a, ev) {
    const K = kindOf(a);
    if (!K || !on(state, a)) return null;
    const plan = a.plan;
    let r = null;
    if (plan && plan.k !== 'resolve') {
      if (same(next(state, a), plan)) r = K.behave(state, a, ev);
      else if (can(state, a, plan)) r = make(state, a, plan, ev);
    }
    if (r === null) r = AI.wait(state, a, ev);
    replan(state, a);
    return r;
  }

  // ---- What it shows ----
  // The tiles a move's arrow points at.
  function tilesOf(state, a, p) {
    if (p.k === 'step') { const s = a.size || 1, out = []; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push([p.to[0] + dx, p.to[1] + dy]); return out; }
    if (p.k === 'strike') { const b = Actors.byUid(state, p.at); return b && !b.gone ? Actors.footprint(b) : []; }
    if (p.k === 'mark') return p.tiles.map(copyTile);
    if (p.k === 'resolve') return a.telegraph ? a.telegraph.tiles.map(copyTile) : [];
    return [];
  }
  // Clockwork.shown(state, a) → null | {k, …, tiles}: a station's line (k 'line') while its
  // chime is on; for any other, nothing while it sleeps, else the move it showed (a copy).
  function shown(state, a) {
    if (!a || a.gone || !on(state, a)) return null;
    if (a.arch === STATION) {
      if (!HourlyDemonstration.isStation(state, a)) return null;
      return { k: 'line', tiles: HourlyDemonstration.line(state, a) };
    }
    if (a.mode === 'dormant' || !a.plan) return null;
    return Object.assign(JSON.parse(JSON.stringify(a.plan)), { tiles: tilesOf(state, a, a.plan) });
  }

  // Made: no move shown yet. One made awake (a room for tests) shows its first at its first action.
  function init(state, a) {
    if (a.arch !== STATION && !kindOf(a)) throw new Error(`clockwork: ${a.uid} is a ${a.arch}, whose moves clockwork does not make (rules/mods/clockwork.js)`);
    a.plan = null;
  }
  // Woken, it shows the move it would make now.
  function onWake(state, a) { replan(state, a); }

  Archetypes.addModifier(ID, {
    init, onWake, act,
    immune: (state, a, statusId) => statusId === 'dazed',
    plan: shown,
    // The label's line for its next move (Labels.odds).
    readout: (state, a) => { const p = shown(state, a); return p ? [{ k: 'plan', plan: p }] : []; },
  });

  return { add, on, governs, next, can, same, shown, replan };
})();
