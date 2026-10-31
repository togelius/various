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
//                                        n}, it needs n hits whatever its health (a swarm body);
//                                        {k: 'hits', n, halves: true}, n counts the hits on it
//                                        and on every half it splits off (a splitter that can
//                                        still split), and its line says so
// M4's hooks, added by M4's skeleton so the core can ask them (W0d1 routes the rules' calls):
//   huntsOnSight(state, a) → bool        does a hunt you on seeing you: false if any hook says so
//   marksAwake(state, a) → bool          may a mark its special while awake: true if any hook says so
//   immune(state, a, statusId) → bool    is a immune to the status (Status.apply asks): true if any says so
//   plan(state, a) → null | plan         its shown next move (clockwork): the first that is not null
//   wakeRegion(state, a, turns) → [[x, y]]   the tiles where standing for `turns` turns would wake
//                                        it: the default's (the ring at RING_MOVING with line of
//                                        sight) and every hook's, which each add their own (a
//                                        station its line, a patrol its round's sight); each tile
//                                        once, in row-major order (y, then x)
'use strict';
const Archetypes = (() => {
  const HOOKS = ['act', 'mayStep', 'costPct', 'speedApplies', 'adjustDamage', 'onDamaged', 'onDied', 'onTouched', 'onWake', 'onHome',
    'onResolve', 'init', 'present', 'pipless', 'readout', 'huntsOnSight', 'marksAwake', 'immune', 'plan', 'wakeRegion'];
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
  function huntsOnSight(state, a) { for (const f of hooks(state, a, 'huntsOnSight')) if (!f(state, a)) return false; return true; }
  function marksAwake(state, a) { for (const f of hooks(state, a, 'marksAwake')) if (f(state, a)) return true; return false; }
  function immune(state, a, statusId) { for (const f of hooks(state, a, 'immune')) if (f(state, a, statusId)) return true; return false; }
  function plan(state, a) { for (const f of hooks(state, a, 'plan')) { const r = f(state, a); if (r !== null && r !== undefined) return r; } return null; }
  // Plan A8: a hook adds its tiles to the default's, so it states only its own reach.
  const rowMajor = (p, q) => p[1] - q[1] || p[0] - q[0];
  function wakeRegion(state, a, turns) {
    let all = defaultWakeRegion(state, a, turns).slice();
    for (const f of hooks(state, a, 'wakeRegion')) all = all.concat(f(state, a, turns) || []);
    const out = [];
    for (const t of all.sort(rowMajor)) if (!out.length || rowMajor(out[out.length - 1], t) !== 0) out.push([t[0], t[1]]);
    return out;
  }
  // The default wake region (plan A8): your ring at RING_MOVING, as §8.2's ring pip measures
  // it (Vision.ringDist), with no loud floor, kit or perk counted: the tiles you could stand
  // on (walkable, not a closed door, none of a's own) from which some tile of a's footprint
  // that an exhibit can stand on (Grid.hold) is within RING_MOVING walking tiles (one beyond
  // its nearest neighbour you could step onto, for a tile you cannot) and in line of sight.
  // Being there at a turn boundary with that ring (a moving one: standing still, your ring is
  // RING_STILL; on a loud floor or with a lit Lamp, larger) gives it 1 ring pip (Wake.boundary),
  // and a pip a turn holds off its decay, so it wakes at the boundary that gives the pips it
  // still needs: the region is empty unless a sleeps, can gain pips (not pipless) and `turns`
  // is at least PIPS_TO_WAKE less its pips. Walking distance between tiles you can step onto
  // is the same either way (§8.2's step rule is symmetric), so it is measured out from a's
  // tiles.
  function defaultWakeRegion(state, a, turns) {
    const m = state && state.dept;
    if (!m || !a || a.gone || a.mode !== 'dormant' || pipless(state, a)) return [];
    if (!Number.isInteger(turns) || turns < Math.max(1, N.PIPS_TO_WAKE - (a.pips || 0))) return [];
    const r = N.RING_MOVING, fp = Actors.footprint(a), on = new Uint8Array(m.w * m.h), out = [];
    const mine = (x, y) => fp.some(t => t[0] === x && t[1] === y);
    for (const [tx, ty] of fp) {
      if (!Grid.inside(m, tx, ty) || !Grid.hold(m, tx, ty)) continue;
      // From a tile you can step onto, the walk starts there; from one you cannot, at each
      // neighbour you can step onto, one step further.
      const own = Grid.walkable(m, tx, ty), starts = [];
      if (own) starts.push([tx, ty]);
      else for (let d = 0; d < 8; d++) { const x = tx + Grid.DX[d], y = ty + Grid.DY[d]; if (Grid.inside(m, x, y) && Grid.walkable(m, x, y)) starts.push([x, y]); }
      if (!starts.length) continue;
      const dist = Grid.distances(m, starts, own ? r : r - 1);
      for (let y = Math.max(0, ty - r - 1); y <= Math.min(m.h - 1, ty + r + 1); y++) for (let x = Math.max(0, tx - r - 1); x <= Math.min(m.w - 1, tx + r + 1); x++) {
        const i = y * m.w + x;
        if (on[i] || dist[i] < 0 || !Grid.walkable(m, x, y) || Grid.closedDoor(m, x, y) || mine(x, y)) continue;
        if (Grid.los(m, x, y, tx, ty)) on[i] = 1;
      }
    }
    for (let i = 0; i < on.length; i++) if (on[i]) out.push([i % m.w, Int.idiv(i, m.w)]);
    return out;
  }

  return {
    HOOKS: HOOKS.slice(), add, addModifier, added, addedModifier,
    act, mayStep, costPct, speedApplies, adjustDamage, present, pipless, readout, huntsOnSight, marksAwake, immune, plan, wakeRegion,
    onDamaged: each('onDamaged'), onDied: each('onDied'), onTouched: each('onTouched'), onWake: each('onWake'),
    onHome: each('onHome'), onResolve: each('onResolve'), init: each('init'),
  };
})();
