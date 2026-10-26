// ACCESSION — how archetype and modifier behaviour plugs into the rules (BUILD.md §5.1,
// §5.3), frozen after M3's Wave 0. Each archetype's code is one file, rules/arch/<id>.js,
// registering its hooks with Archetypes.add; each modifier's is rules/mods/<id>.js, with
// Archetypes.addModifier. A rule asks through the dispatchers below: the archetype first,
// then each modifier in the species' order, skipping a modifier switched off for the visit
// (Options.off). An actor whose archetype or modifier registered no hook gets the default.
//
// Hooks, each a function of (state, a, …):
//   act(state, a, ev) → ticks | null     the first that is not null (null: AI.byMode acts)
//   mayStep(state, a, x, y) → bool       true unless some hook says false
//   costPct(state, a, kind) → int %      multiplied together, 100 by default
//   speedApplies(a) → ['move'] | ['move', 'act']   which costs its speed scales; the first given
//                                        (the hook takes only a; its dispatcher,
//                                        Archetypes.speedApplies(state, a), skips a modifier
//                                        switched off, as every dispatcher does)
//   adjustDamage(state, def, amount, cause) → int  each in turn; cause.from is the tile the blow came from
//   onDamaged(state, a, amount, cause, ev), onDied(state, a, cause, ev), onTouched(state, a, how, by, ev),
//   onWake(state, a), onHome(state, a, ev), onResolve(state, a, tel, ev), init(state, a)   each in turn
//   present(state, a) → null | {as: 'case'}   the first that is not null
//   pipless(state, a) → bool             true if any hook says so (a disguised mimic)
//   readout(state, a, you) → [{k, …}]    every hook's lines, in turn, for the odds readout
//                                        (Labels): {k: 'noBlow'}, it has no blow (no chance
//                                        of hitting you is given; the axis_sniper); {k: 'hits',
//                                        n}, it needs n hits whatever its health (a swarm body)
'use strict';
const Archetypes = (() => {
  const HOOKS = ['act', 'mayStep', 'costPct', 'speedApplies', 'adjustDamage', 'onDamaged', 'onDied', 'onTouched', 'onWake', 'onHome',
    'onResolve', 'init', 'present', 'pipless', 'readout'];
  const ARCH = {}, MODS = {};
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function register(table, kind, reg, id, impl) {
    if (!Registry[reg][id]) throw new Error(`Archetypes: ${id} is not in Registry.${reg}`);
    if (own(table, id)) throw new Error(`Archetypes: the ${kind} ${id} is added twice`);
    impl = impl || {};
    for (const k of Object.keys(impl)) {
      if (!HOOKS.includes(k)) throw new Error(`Archetypes: ${id} has no hook called ${k}`);
      if (typeof impl[k] !== 'function') throw new Error(`Archetypes: ${id}.${k} is not a function`);
    }
    table[id] = impl;
  }
  const add = (id, impl) => register(ARCH, 'archetype', 'ARCHETYPES', id, impl);
  const addModifier = (id, impl) => register(MODS, 'modifier', 'MODIFIERS', id, impl);
  const added = id => own(ARCH, id);
  const addedModifier = id => own(MODS, id);

  // The hook functions called `name` that answer for a, in order: its archetype's, then its
  // modifiers', leaving out a modifier switched off for the visit (Options.off; with no
  // state, as for an actor made outside one, none is switched off).
  const NONE = [];
  function hooks(state, a, name) {
    let out = NONE;
    const A = a.arch && own(ARCH, a.arch) ? ARCH[a.arch] : null;
    if (A && own(A, name)) out = [A[name]];
    if (a.mods) for (const id of a.mods) {
      if (!own(MODS, id) || !own(MODS[id], name) || (state && Options.off(state, id))) continue;
      if (out === NONE) out = [];
      out.push(MODS[id][name]);
    }
    return out;
  }
  const each = name => (state, a, ...args) => { for (const f of hooks(state, a, name)) f(state, a, ...args); };
  function first(name) {
    return (state, a, ...args) => { for (const f of hooks(state, a, name)) { const r = f(state, a, ...args); if (r !== null && r !== undefined) return r; } return null; };
  }

  const act = first('act');
  const present = first('present');
  function mayStep(state, a, x, y) { for (const f of hooks(state, a, 'mayStep')) if (!f(state, a, x, y)) return false; return true; }
  function costPct(state, a, kind) { let p = 100; for (const f of hooks(state, a, 'costPct')) p = Int.pct(p, f(state, a, kind)); return p; }
  function speedApplies(state, a) { const fs = hooks(state, a, 'speedApplies'); return fs.length ? fs[0](a) : ['move']; }
  function adjustDamage(state, def, amount, cause) { for (const f of hooks(state, def, 'adjustDamage')) amount = f(state, def, amount, cause); return amount; }
  function pipless(state, a) { for (const f of hooks(state, a, 'pipless')) if (f(state, a)) return true; return false; }
  function readout(state, a, you) { let out = []; for (const f of hooks(state, a, 'readout')) out = out.concat(f(state, a, you) || []); return out; }

  return {
    HOOKS: HOOKS.slice(), add, addModifier, added, addedModifier,
    act, mayStep, costPct, speedApplies, adjustDamage, present, pipless, readout,
    onDamaged: each('onDamaged'), onDied: each('onDied'), onTouched: each('onTouched'), onWake: each('onWake'),
    onHome: each('onHome'), onResolve: each('onResolve'), init: each('init'),
  };
})();
