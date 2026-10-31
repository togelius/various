// ACCESSION — the perks you hold, and how the rules ask them (BUILD.md §8.7). Built by M4's
// skeleton and frozen after M4's Wave 0: each perk's rules are one file, rules/perks/<id>.js,
// registering its hooks with Perks.add, so no perk package edits this file. A rule asks a
// dispatcher below, which calls the hook of each perk you hold (state.run.perks, [{id,
// rank}]) at rank 1 or more and not switched off for the visit (Options.off), in the order
// the perks were added (index.html's order), so the answer never depends on the order you
// took them. Each hook gets the dispatcher's own arguments, then its perk's rank. With no
// perk held, every dispatcher gives what M3's rules do.
//
// Dispatchers (the rule that calls each is routed in M4's Wave 0):
//   ringDelta(state) → int              your ring's change: the sum of the hooks; 0
//   loseTrack(state, a) → int           turns a hunter that lost sight of you waits before
//                                       it searches: the fewest any hook gives (a hook
//                                       returns turns, or null to say nothing); else
//                                       LOSE_TRACK_TURNS
//   onLoseTrack(state, a, ev)           after hunter a, out of sight of you, began to search:
//                                       each hook (Vanishing Act's lost action at rank 2). A
//                                       hunter that searches sooner than LOSE_TRACK_TURNS
//                                       because a hook said so is `lost` with cause `vanished`
//   openCost(state, base) → int         ticks to open a case: each hook in turn gets the cost
//                                       so far as base and returns the new cost; base
//   openQuiet(state) → bool             opening a case makes no noise: true if any hook says so
//   lockBonus(state) → int              grades above yours whose locks you open: the sum; 0
//   padding(state) → int                Padding the perks add: the sum; 0
//   afterStep(state, a, from, ev)       after exhibit a steps from tile `from`: each hook
//   onLow(state, who, before, ev)       after who's health fell from `before` and who lived: each hook
//   onResolve(state, a, tel, struckYou, ev)   after a's shown special tel resolved: each hook
//   surprise(state, att, def) → bool    is att's blow on def a surprise blow: true if any hook says so
//   adjust(state, action, r, ev) → {r, why}   your action's cost: each hook in turn gets the
//                                       ticks so far as r and returns null (no change) or
//                                       {r, why}, why the perk's id; {r, why: null} if none
//   charges(state) → [{id, rank, charge}]     each perk you hold, in the order you took
//                                       them, with what its `charge` hook says (plain data:
//                                       a charge waiting, or uses left), or null
// The perk parts of a state (dept.perk {duck, sure, closed, filed, wind}) are absent until
// a perk first writes them (§4.1), so a perk's hook reads its own part as absent at first.
'use strict';
const Perks = (() => {
  const HOOKS = ['ringDelta', 'loseTrack', 'onLoseTrack', 'openCost', 'openQuiet', 'lockBonus', 'padding', 'afterStep', 'onLow', 'onResolve', 'surprise', 'adjust', 'charge'];
  const MAX_RANK = 2;
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const ids = [], table = {};

  // Perks.add(id, hooks): registers a perk's hooks, once; each named in HOOKS and a function.
  // Once the registry has its PERKS table, the id must be one of its entries.
  function add(id, hooks) {
    if (typeof id !== 'string' || !id) throw new Error('Perks.add: a perk needs a string id');
    if (Registry.TABLES.includes('PERKS') && !own(Registry.PERKS, id)) throw new Error(`Perks.add: ${id} is not in Registry.PERKS`);
    if (own(table, id)) throw new Error(`Perks.add: ${id} is added twice`);
    hooks = hooks || {};
    for (const k of Object.keys(hooks)) {
      if (!HOOKS.includes(k)) throw new Error(`Perks.add: ${id} has no hook called ${k}`);
      if (typeof hooks[k] !== 'function') throw new Error(`Perks.add: ${id}.${k} is not a function`);
    }
    table[id] = Object.assign({}, hooks);
    ids.push(id);
  }
  const added = id => own(table, id);

  // Perks.rank(state, id) → 0..2: the rank you hold it at, 0 if you do not.
  function rank(state, id) {
    const held = state && state.run && state.run.perks;
    if (!held) return 0;
    for (const p of held) if (p.id === id) return Number.isInteger(p.rank) ? Math.max(0, Math.min(MAX_RANK, p.rank)) : 0;
    return 0;
  }

  // The hooks called `name` of the perks you hold: [[fn, rank]…], in the order added.
  const NONE = [];
  function hooks(state, name) {
    const held = state && state.run && state.run.perks;
    if (!held || !held.length) return NONE;
    let out = NONE;
    for (const id of ids) {
      if (!own(table[id], name) || (state.options && Options.off(state, id))) continue;
      const r = rank(state, id);
      if (r < 1) continue;
      if (out === NONE) out = [];
      out.push([table[id][name], r]);
    }
    return out;
  }
  const sum = name => state => { let n = 0; for (const [f, r] of hooks(state, name)) n += f(state, r); return n; };
  const any = name => state => { for (const [f, r] of hooks(state, name)) if (f(state, r)) return true; return false; };

  const ringDelta = sum('ringDelta');
  const openQuiet = any('openQuiet');
  const lockBonus = sum('lockBonus');
  const padding = sum('padding');
  function loseTrack(state, a) {
    let turns = N.LOSE_TRACK_TURNS, said = false;
    for (const [f, r] of hooks(state, 'loseTrack')) {
      const t = f(state, a, r);
      if (t === null || t === undefined) continue;
      if (!Number.isInteger(t) || t < 0) throw new Error(`Perks.loseTrack: a hook gave ${t} turns`);
      turns = said ? Math.min(turns, t) : t;
      said = true;
    }
    return turns;
  }
  function openCost(state, base) {
    let cost = base;
    for (const [f, r] of hooks(state, 'openCost')) cost = f(state, cost, r);
    return cost;
  }
  function onLoseTrack(state, a, ev) { for (const [f, r] of hooks(state, 'onLoseTrack')) f(state, a, ev, r); }
  function afterStep(state, a, from, ev) { for (const [f, r] of hooks(state, 'afterStep')) f(state, a, from, ev, r); }
  function onLow(state, who, before, ev) { for (const [f, r] of hooks(state, 'onLow')) f(state, who, before, ev, r); }
  function onResolve(state, a, tel, struckYou, ev) { for (const [f, r] of hooks(state, 'onResolve')) f(state, a, tel, struckYou, ev, r); }
  function surprise(state, att, def) { for (const [f, r] of hooks(state, 'surprise')) if (f(state, att, def, r)) return true; return false; }
  function adjust(state, action, r, ev) {
    let out = { r, why: null };
    for (const [f, k] of hooks(state, 'adjust')) {
      const got = f(state, action, out.r, ev, k);
      if (got === null || got === undefined) continue;
      if (!Number.isInteger(got.r) || got.r < 0 || typeof got.why !== 'string') throw new Error(`Perks.adjust: a hook gave ${JSON.stringify(got)}`);
      out = { r: got.r, why: got.why };
    }
    return out;
  }

  // Each perk you hold with its charge, in the order you took them.
  function charges(state) {
    const held = state && state.run && state.run.perks;
    if (!held || !held.length) return [];
    return held.map(p => {
      const r = rank(state, p.id), f = own(table, p.id) && own(table[p.id], 'charge') ? table[p.id].charge : null;
      const c = f && r > 0 ? f(state, r) : null;
      return { id: p.id, rank: r, charge: c === undefined ? null : c };
    });
  }

  return { HOOKS: HOOKS.slice(), MAX_RANK, add, added, rank, charges, ringDelta, loseTrack, onLoseTrack, openCost, openQuiet, lockBonus, padding,
    afterStep, onLow, onResolve, surprise, adjust };
})();
