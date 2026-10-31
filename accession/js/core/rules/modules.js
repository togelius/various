// ACCESSION — the department modules (BUILD.md §5.4; M4 plan A7): the form a module's rules are
// written in, the small interpreter that runs them, and the hooks the core asks. Built by M4's
// W0e; frozen after M4's Wave 0. Each module registers itself from its own file
// (rules/modules/<id>.js) with Modules.define; its words are its registry entry's
// (Registry.MODULES[id]: the panel sentence, and the clause its flagged species' Behaviour
// lines carry, js/core/clauses.js), and its sentences its text fragment's.
//
// The form, Modules.define(id, {rules, bespoke, init, turn, alarmDecay, pipsDecay, mayReturn,
// threat}), every part but rules optional:
//   rules: [{rule, on, every?, at?, who?, when?, do: [effect…], fields?, cause?, telegraph?}]
//     rule       its name, which its module event carries (module {id, rule, …}, §3.4)
//     on         an event kind (every kind but `module`: no rule listens to a module's event),
//                'turn' (each turn boundary, step 8) or 'period' (the boundaries whose count
//                from the module's start, turn − since, is `at` modulo `every`)
//     every, at  a period's length (a whole number ≥ 1) and its place in it (0 ≤ at < every,
//                0 if not given); either may be fn(state, m, a), read for each target
//     who        fn(state, e, m) → [actor…]: the exhibits the rule acts on, in the order
//                given; none given, it acts once, on no exhibit
//     when       fn(state, e, m, a) → bool: asked for each target, just before it acts
//                (so a rule's own earlier targets can change the answer)
//     do         a list from the closed effect table (EFFECTS, below); any other throws here
//     fields     fn(state, e, m, a) → {at?, n?, turns?}: the module event's other fields
//     cause      fn(state, e, m, a) → {…}: more of its cause than {k: id}
//     telegraph  null, or {turns, shown}: what is shown first and for how many turns,
//                `shown` naming another rule of the module or a special; data for the
//                validation log and the module's words (§5.4), which the interpreter does
//                not act on: what shows it is that rule or that special's mark
//   init(state, pack, m)   sets the module's state as the department is made, whether or not
//                          the module is switched off (switched off, it makes its draws and
//                          discards them, so population is the same, plan A10)
//   bespoke: [name…]       the hand-written parts, for the validation log (Modules.bespoke);
//                          each hook below that a module gives must be named in it:
//   turn(state, ev, m)                 at each boundary (step 8), after its rules
//   alarmDecay(state, ev, m)           at each boundary (step 7)
//   pipsDecay(state, m) → bool         may pips decay now (false: not while its alarm runs)
//   mayReturn(state, a, m) → bool      may idle awake exhibit a go back
//   threat(state, untilTick, m) → [mark]   its marks falling due before untilTick (below)
// Every rule and hook gets the module's state, m: its entry in dept.modules,
// {id, role, on, since, params, …its own}, plain data a rule may add to (the flag and alarm
// effects write there). Module state keeps turns, never counters (since, until).
//
// When a rule acts on a target (or on none), its module event comes first, module {id, rule,
// who?, at?, n?, turns?} with cause {k: id, …}, so the log says why, and then its effects,
// in order. An effect that cannot do what it says throws, rather than leaving the event to
// claim it (an exhibit immune to the status, one not asleep for a wake, no step to take):
// the rule's who and when choose only targets it can act on.
//
// Order, re-entry and streams:
//   - modules act in pack order (dept.modules), each rule in the order written, each target
//     in the order who gives;
//   - an event a rule makes goes through Causes.emit, so other rules may act on it, after
//     the rule that made it; a rule acting three deep (a rule acting on an event of a rule
//     acting on an event of a rule) throws, naming the chain;
//   - a module draws only on its own stream, module/<id>/<acc>/d<depth> (Modules.rng);
//   - once the visit is over (state.over), no module acts.
//
// The hooks the core asks, each called from its one place:
//   Modules.onEvent(state, e, ev)   by Causes.emit, after e is pushed and recorded
//   Modules.alarmDecay(state, ev)   turn boundary step 7
//   Modules.turn(state, ev)         turn boundary step 8: first the due lines whose boundary
//                                   this is go off (Specials.resolveDue, §8.1's due lines),
//                                   then each module's turn and period rules, then its turn
//   Modules.pipsDecay(state) → bool        false while any module present says so
//   Modules.mayReturn(state, a) → bool     false while any module present says so
//   Modules.threat(state, untilTick) → [mark]   every module's marks falling due before
//                                   untilTick, for Specials.threat; a mark is plain data read
//                                   as a telegraph is, {by, sp, tiles: [[x, y]…], gross, due}:
//                                   by the uid of an exhibit present that marks it, sp its
//                                   special, gross a whole number, due the boundary tick it
//                                   goes off, after now and before untilTick; anything else
//                                   throws
//   Modules.init(state, pack)       each module's state and init, in pack order (Dept.create)
//   Modules.on(state, id) → bool    is module id present in the visit and not switched off
//   Modules.offFor(pack, met) → [id]   the pack's modules a first visit switches off, given
//                                   the modules met (M5's; shipped unwired, §8.9)
'use strict';
const Modules = (() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const isFn = f => typeof f === 'function';
  const NAME = /^[a-z][a-z0-9_]*$/;

  // The closed effect table (§5.4), and the parts each effect may give. A part may be a value
  // or fn(state, e, m, a) → value, read when the effect runs.
  const EFFECT_PARTS = {
    status: ['id', 'turns', 'cause'],
    surface: ['kind', 'size', 'turns', 'at', 'cause'],
    wake: ['mode', 'cause', 'target'],
    pips: ['n', 'cause'],
    move: ['to', 'how'],
    special: ['sp', 'tiles', 'due'],
    alarm: ['turns'],
    clock: ['n', 'cause'],
    tier: ['pct', 'acc'],
    flag: ['name', 'value'],
  };
  const EFFECTS = ['status', 'surface', 'wake', 'pips', 'move', 'special', 'alarm', 'clock', 'tier', 'flag'];
  const NEEDS = { status: ['id', 'turns'], surface: ['kind', 'size', 'turns'], wake: ['mode', 'cause'], pips: ['n', 'cause'], move: ['to'], special: ['sp'],
    alarm: ['turns'], clock: ['n'], tier: ['pct', 'acc'], flag: ['name', 'value'] };
  // The effects that act on the rule's target, an exhibit (surface does when it gives no `at`).
  const ON_TARGET = ['status', 'wake', 'pips', 'move', 'special', 'alarm', 'tier'];
  const RULE_PARTS = ['rule', 'on', 'every', 'at', 'who', 'when', 'do', 'fields', 'cause', 'telegraph'];
  const HOOKS = ['turn', 'alarmDecay', 'pipsDecay', 'mayReturn', 'threat'];
  const FORM = ['rules', 'bespoke', 'init'].concat(HOOKS);
  // A module's state: the entry's own fields, which neither a rule nor flag may set.
  const RESERVED = ['id', 'role', 'on', 'since', 'params', 'alarm'];
  const EVENT_FIELDS = ['at', 'n', 'turns'];

  const DEFS = {}, ORDER = [];

  // ---- Modules.define ----
  function checkRule(id, r, names) {
    const where = `Modules.define: ${id}'s rule ${r && typeof r.rule === 'string' ? r.rule : JSON.stringify(r && r.rule)}`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error(`Modules.define: ${id}'s rules must be records`);
    for (const k of Object.keys(r)) if (!RULE_PARTS.includes(k)) throw new Error(`${where} has the unknown part ${k} (${RULE_PARTS.join(', ')})`);
    if (typeof r.rule !== 'string' || !NAME.test(r.rule)) throw new Error(`${where}: a rule needs a name (rule), in lower case`);
    if (names.includes(r.rule)) throw new Error(`${where} is written twice`);
    names.push(r.rule);
    if (r.on === 'module') throw new Error(`${where}: no rule acts on a module event (re-entry, §5.4)`);
    if (r.on !== 'turn' && r.on !== 'period' && !Registry.EVENT_KINDS.includes(r.on)) throw new Error(`${where}: on ${JSON.stringify(r.on)} is not an event kind, 'turn' or 'period'`);
    if (r.on === 'period') {
      if (!isFn(r.every) && !(Number.isInteger(r.every) && r.every >= 1)) throw new Error(`${where}: a period needs every, a whole number of turns ≥ 1`);
      if (r.at !== undefined && !isFn(r.at) && !(Number.isInteger(r.at) && r.at >= 0 && (isFn(r.every) || r.at < r.every))) throw new Error(`${where}: at ${r.at} is not a place in its period`);
    } else if (r.every !== undefined || r.at !== undefined) throw new Error(`${where}: only a period rule has every and at`);
    for (const k of ['who', 'when', 'fields']) if (r[k] !== undefined && !isFn(r[k])) throw new Error(`${where}: ${k} is not a function`);
    if (r.cause !== undefined && !isFn(r.cause)) throw new Error(`${where}: cause is not a function`);
    if (!Array.isArray(r.do) || !r.do.length) throw new Error(`${where}: do lists no effect`);
    for (const f of r.do) {
      if (!f || typeof f !== 'object' || !own(EFFECT_PARTS, f.k)) throw new Error(`${where}: ${JSON.stringify(f && f.k)} is not an effect (${EFFECTS.join(', ')})`);
      for (const k of Object.keys(f)) if (k !== 'k' && !EFFECT_PARTS[f.k].includes(k)) throw new Error(`${where}: the ${f.k} effect has no part ${k} (${EFFECT_PARTS[f.k].join(', ')})`);
      for (const k of NEEDS[f.k]) if (f[k] === undefined) throw new Error(`${where}: the ${f.k} effect needs ${k}`);
      if (f.k === 'status' && !isFn(f.id) && !own(Registry.STATUSES, f.id)) throw new Error(`${where}: there is no status ${f.id}`);
      if (f.k === 'surface' && !isFn(f.kind) && !own(Registry.SURFACES, f.kind)) throw new Error(`${where}: there is no surface ${f.kind}`);
      if (f.k === 'special' && !isFn(f.sp) && !own(Registry.SPECIALS, f.sp)) throw new Error(`${where}: there is no special ${f.sp}`);
      if (f.k === 'wake' && f.mode !== 'awake' && f.mode !== 'hunting') throw new Error(`${where}: a wake is into awake or hunting, not ${f.mode}`);
      if (f.k === 'move' && f.how !== undefined && !['onto', 'beside', 'anchor'].includes(f.how)) throw new Error(`${where}: a move goes onto, beside or to the anchor of its goal, not ${f.how}`);
      if (f.k === 'flag' && (typeof f.name !== 'string' || !/^[a-z][A-Za-z0-9_]*$/.test(f.name) || RESERVED.includes(f.name))) throw new Error(`${where}: a flag's name ${JSON.stringify(f.name)} is not one a module may set`);
    }
    if (r.telegraph !== undefined && r.telegraph !== null) {
      const t = r.telegraph;
      if (typeof t !== 'object' || !Number.isInteger(t.turns) || t.turns < 1 || typeof t.shown !== 'string' || Object.keys(t).some(k => k !== 'turns' && k !== 'shown'))
        throw new Error(`${where}: a telegraph is {turns, shown}`);
    }
  }
  function define(id, def) {
    if (!own(Registry.MODULES, id)) throw new Error(`Modules.define: ${id} is not in Registry.MODULES`);
    if (own(DEFS, id)) throw new Error(`Modules.define: ${id} is defined twice`);
    if (!def || typeof def !== 'object') throw new Error(`Modules.define: ${id}'s form is not a record`);
    for (const k of Object.keys(def)) {
      if (k === 'params' || k === 'sentence') throw new Error(`Modules.define: ${id}'s ${k} is its registry entry's (Registry.MODULES.${id}.${k}), and a pack's values are its params (m.params)`);
      if (!FORM.includes(k)) throw new Error(`Modules.define: ${id}'s form has the unknown part ${k} (${FORM.join(', ')})`);
    }
    const rules = def.rules === undefined ? [] : def.rules;
    if (!Array.isArray(rules)) throw new Error(`Modules.define: ${id}'s rules are not a list`);
    const names = [];
    for (const r of rules) checkRule(id, r, names);
    for (const r of rules) if (r.telegraph && !names.includes(r.telegraph.shown) && !own(Registry.SPECIALS, r.telegraph.shown))
      throw new Error(`Modules.define: ${id}'s rule ${r.rule} is telegraphed by ${r.telegraph.shown}, which is neither one of its rules nor a special`);
    const bespoke = def.bespoke === undefined || def.bespoke === null ? [] : def.bespoke;
    if (!Array.isArray(bespoke) || bespoke.some(b => typeof b !== 'string' || !b.length)) throw new Error(`Modules.define: ${id}'s bespoke is not a list of names`);
    if (def.init !== undefined && !isFn(def.init)) throw new Error(`Modules.define: ${id}'s init is not a function`);
    for (const h of HOOKS) {
      if (def[h] === undefined) continue;
      if (!isFn(def[h])) throw new Error(`Modules.define: ${id}'s ${h} is not a function`);
      if (!bespoke.includes(h)) throw new Error(`Modules.define: ${id}'s ${h} is written by hand, so its bespoke list must name it (the validation log, §5.4)`);
    }
    DEFS[id] = { id, rules: rules.slice(), bespoke: bespoke.slice(), init: def.init || null };
    for (const h of HOOKS) DEFS[id][h] = def[h] || null;
    ORDER.push(id);
  }
  // Modules.defined() → [id…], in the order defined; Modules.defined(id) → bool.
  const defined = id => id === undefined ? ORDER.slice() : own(DEFS, id);
  // Modules.bespoke() → [{id, bespoke: [name…]}]: the modules that needed hand-written parts,
  // and which, for the validation log (§5.4: evidence for DECISIONS D2).
  const bespokeList = () => ORDER.filter(id => DEFS[id].bespoke.length).map(id => ({ id, bespoke: DEFS[id].bespoke.slice() }));
  // Modules.form(id) → {rules: [{rule, on, do: [effect…], telegraph}], bespoke}: a module's form
  // as data (its effects by name), for the log and the words; null for one not defined.
  function form(id) {
    if (!own(DEFS, id)) return null;
    const d = DEFS[id];
    return { rules: d.rules.map(r => ({ rule: r.rule, on: r.on, do: r.do.map(f => f.k), telegraph: r.telegraph ? { turns: r.telegraph.turns, shown: r.telegraph.shown } : null })), bespoke: d.bespoke.slice() };
  }

  // ---- A visit's modules ----
  const entries = state => state && state.dept && Array.isArray(state.dept.modules) ? state.dept.modules : [];
  // Modules.of(state, id) → the module's state (its dept.modules entry), or null if absent.
  function of(state, id) { for (const m of entries(state)) if (m.id === id) return m; return null; }
  const isOn = (state, m) => !!m.on && !Options.off(state, m.id) && own(DEFS, m.id);
  // Modules.on(state, id) → bool: present in the visit and not switched off (rulesOff).
  function on(state, id) { const m = of(state, id); return !!m && isOn(state, m); }
  // Modules.active(state) → [id…]: the modules present and on, in pack order (what a label
  // passes to Clauses as ctx.modules).
  const active = state => entries(state).filter(m => isOn(state, m)).map(m => m.id);
  // Modules.flagged(state, a, id) → bool: does module id act on a's species: on, and the
  // species (Packs.speciesFor) flagged with it (§5.2: flags, the modules whose rules it carries).
  function flagged(state, a, id) {
    if (!on(state, id)) return false;
    const sp = Packs.speciesFor(state, a);
    return !!sp && Array.isArray(sp.flags) && sp.flags.includes(id);
  }
  // Modules.rng(state, id): module id's own stream (§3.2), module/<id>/<acc>/d<depth>.
  function rng(state, id) {
    if (!own(DEFS, id)) throw new Error(`Modules.rng: there is no module ${id}`);
    return Rng.stream(state, `module/${id}/${state.dept.acc}/d${state.dept.depth || 1}`);
  }

  // Modules.init(state, pack): as a department is made (plan A10, step 12), each of the pack's
  // modules, in pack order, gets its state, {id, role, on, since, params}, appended to
  // dept.modules, and then its init. A module no rule file has defined yet is left absent: its
  // rules are not built, so nothing acts and no line may say it does (A3, A10's readiness).
  function init(state, pack) {
    const list = entries(state);
    if (!state.dept || !Array.isArray(state.dept.modules)) throw new Error('Modules.init: the state has no dept.modules');
    for (const pm of (pack && pack.modules) || []) {
      if (!pm || typeof pm.id !== 'string') throw new Error(`Modules.init: ${pack.acc} lists the module ${JSON.stringify(pm)}`);
      if (!own(DEFS, pm.id)) continue;
      if (list.some(m => m.id === pm.id)) throw new Error(`Modules.init: ${pm.id} is already in the visit`);
      const m = { id: pm.id, role: pm.role || null, on: !Options.off(state, pm.id), since: state.turn, params: Causes.copy(pm.params || {}, `${pm.id}.params`) };
      list.push(m);
      if (DEFS[pm.id].init) DEFS[pm.id].init(state, pack, m);
    }
  }

  // Modules.offFor(pack, met) → [id…]: at most one new system a visit (§8.9): when none of a
  // pack's modules is among those met and it has more than one, every module but its
  // signature (role 'signature', else the first) is off for that visit; otherwise none.
  function offFor(pack, met) {
    const mods = (pack && pack.modules) || [], seen = met || [];
    if (mods.length < 2 || mods.some(m => seen.includes(m.id))) return [];
    const sig = (mods.find(m => m.role === 'signature') || mods[0]).id;
    return mods.filter(m => m.id !== sig).map(m => m.id);
  }

  // ---- The interpreter ----
  // The rules acting now, outermost first, for re-entry: a rule acting three deep throws.
  const acting = [];
  function nest(what, fn) {
    if (acting.length >= 2) throw new Error(`Modules: ${what} would act three deep, on an event of ${acting[1]}, itself acting on an event of ${acting[0]} (re-entry stops at two, §5.4)`);
    acting.push(what);
    try { return fn(); } finally { acting.pop(); }
  }
  const nameOf = a => a ? a.uid : 'nothing';
  // The actors a rule's who gave, checked: each an actor of the state that is not gone.
  function targets(state, m, r, e) {
    if (!r.who) return [null];
    const got = r.who(state, e, m);
    if (!Array.isArray(got)) throw new Error(`Modules: ${m.id}.${r.rule}'s who gave ${JSON.stringify(got)}, not a list of exhibits`);
    for (const a of got) if (!a || typeof a.uid !== 'string' || !state.actors.includes(a) || a.gone) throw new Error(`Modules: ${m.id}.${r.rule}'s who gave ${a && a.uid}, not an exhibit present`);
    return got;
  }
  function inPeriod(state, m, r, a) {
    const every = isFn(r.every) ? r.every(state, m, a) : r.every, at = r.at === undefined ? 0 : isFn(r.at) ? r.at(state, m, a) : r.at;
    if (!Number.isInteger(every) || every < 1 || !Number.isInteger(at) || at < 0 || at >= every) throw new Error(`Modules: ${m.id}.${r.rule}'s period is every ${every} at ${at}`);
    return (state.turn - m.since) % every === at;
  }
  // One rule, for an event (e) or a boundary (e null): each target that is due (a period's)
  // and passes when acts, in order.
  function run(state, m, r, e, ev) {
    for (const a of targets(state, m, r, e)) {
      if (state.over) return;
      if (a && a.gone) continue;
      if (r.on === 'period' && !inPeriod(state, m, r, a)) continue;
      if (r.when && !r.when(state, e, m, a)) continue;
      nest(`${m.id}.${r.rule}`, () => act(state, m, r, e, a, ev));
    }
  }
  // The rule acts on a (or on nothing): its module event, then its effects.
  function act(state, m, r, e, a, ev) {
    const more = r.fields ? r.fields(state, e, m, a) : {};
    if (!more || typeof more !== 'object') throw new Error(`Modules: ${m.id}.${r.rule}'s fields gave ${JSON.stringify(more)}`);
    for (const k of Object.keys(more)) if (!EVENT_FIELDS.includes(k)) throw new Error(`Modules: ${m.id}.${r.rule}'s fields gave ${k}, not one of ${EVENT_FIELDS.join(', ')}`);
    const fields = Object.assign({ id: m.id, rule: r.rule }, a ? { who: a.uid } : {}, more);
    const extra = r.cause ? r.cause(state, e, m, a) : {};
    if (!extra || typeof extra !== 'object' || own(extra, 'k')) throw new Error(`Modules: ${m.id}.${r.rule}'s cause gave ${JSON.stringify(extra)}`);
    Causes.emit(state, ev, 'module', fields, Object.assign({ k: m.id }, extra));
    for (const f of r.do) {
      if (state.over) return;
      if (ON_TARGET.includes(f.k) && !a) throw new Error(`Modules: ${m.id}.${r.rule}'s ${f.k} effect acts on an exhibit, and the rule has none (who)`);
      // A target an earlier effect of this rule destroyed takes no more effects.
      if (a && a.gone && ON_TARGET.includes(f.k)) continue;
      DO[f.k](state, { state, m, r, e, a, f }, ev);
    }
  }
  // A part of an effect, read now.
  const part = (x, k) => isFn(x.f[k]) ? x.f[k](x.state, x.e, x.m, x.a) : x.f[k];
  function causeOf(x) {
    const c = x.f.cause === undefined ? { k: x.m.id } : part(x, 'cause');
    if (!c || typeof c.k !== 'string') throw new Error(`Modules: ${x.m.id}.${x.r.rule}'s ${x.f.k} effect has the cause ${JSON.stringify(c)}`);
    return c;
  }
  const where = x => `Modules: ${x.m.id}.${x.r.rule}'s ${x.f.k} effect on ${nameOf(x.a)}`;
  const int = (x, k, lo) => { const v = part(x, k); if (!Number.isInteger(v) || v < lo) throw new Error(`${where(x)}: ${k} ${v} is not a whole number ≥ ${lo}`); return v; };
  const isTile = t => Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]);

  // The closed effect table: what each does, through the rule of record that owns it.
  const DO = {
    // status: the status id on a for `turns` turns, or for the rest of the visit ('perm')
    // (Status.apply). An exhibit immune to it is a rule that cannot act: it throws.
    status(state, x, ev) {
      const id = part(x, 'id'), turns = part(x, 'turns');
      if (!Status.apply(state, x.a, id, turns, causeOf(x), ev)) throw new Error(`${where(x)}: ${x.a.uid} is immune to ${id}`);
    },
    // surface: a surface of `kind`, size tiles a side, for `turns` turns, centred on `at` (or
    // on a's tile), laid by a (Surfaces.add, which says so).
    surface(state, x, ev) {
      const at = x.f.at === undefined ? (x.a ? [x.a.x, x.a.y] : null) : part(x, 'at');
      if (!isTile(at) || !Grid.inside(state.dept, at[0], at[1])) throw new Error(`${where(x)}: it is laid at ${JSON.stringify(at)}, not a tile of the map`);
      Surfaces.add(state, part(x, 'kind'), at[0], at[1], int(x, 'size', 1), int(x, 'turns', 1), x.a ? x.a.uid : null, ev, causeOf(x));
    },
    // wake: a sleeping exhibit wakes into `mode`, with `cause` (a wake cause, §8.2), set off
    // toward `target` if given (Wake.wake). One not asleep, or a pipless one that this cause
    // does not wake, throws.
    wake(state, x, ev) {
      const a = x.a, target = x.f.target === undefined ? undefined : part(x, 'target');
      if (a.mode !== 'dormant') throw new Error(`${where(x)}: ${a.uid} is not asleep (${a.mode})`);
      if (target !== undefined && !isTile(target)) throw new Error(`${where(x)}: its target ${JSON.stringify(target)} is not a tile`);
      if (!Wake.wake(state, a, x.f.mode, causeOf(x), ev, target === undefined ? {} : { target })) throw new Error(`${where(x)}: this cause does not wake ${a.uid}`);
    },
    // pips: n pips (or −n) for a sleeping exhibit, with cause (Wake.addPips: once a turn for
    // each cause, between 0 and PIPS_TO_WAKE, waking it at the last). One that gains no pips
    // (awake, gone, or pipless) throws.
    pips(state, x, ev) {
      const a = x.a, n = part(x, 'n');
      if (!Number.isInteger(n) || !n) throw new Error(`${where(x)}: n ${n} is not a whole number of pips`);
      if (a.mode !== 'dormant' || Archetypes.pipless(state, a)) throw new Error(`${where(x)}: ${a.uid} gains no pips`);
      Wake.addPips(state, a, n, causeOf(x), ev);
    },
    // move: a takes one step toward `to` (a tile) along a shortest walk, onto it, beside it or
    // to its anchor (`how`, onto if not given), as an exhibit steps (AI.route, Step.moveInto,
    // then AI.afterStep); ties between equal steps on the module's own stream. The step costs
    // a nothing: it is the rule's. With no step to take, it throws.
    move(state, x, ev) {
      const a = x.a, to = part(x, 'to');
      if (!isTile(to)) throw new Error(`${where(x)}: its goal ${JSON.stringify(to)} is not a tile`);
      const way = AI.route(state, a, to, x.f.how || 'onto');
      if (!way.options.length) throw new Error(`${where(x)}: ${a.uid} has no step toward ${JSON.stringify(to)}`);
      const d = way.options.length === 1 ? way.options[0] : rng(state, x.m.id).pick(way.options), x0 = a.x, y0 = a.y;
      const r = Step.moveInto(state, a, d, ev);
      if (typeof r !== 'number' || (a.x === x0 && a.y === y0)) throw new Error(`${where(x)}: ${a.uid}'s step failed (${r})`);
      AI.afterStep(state, a, ev);
    },
    // special: a marks special `sp` on `tiles` (its shape's, Specials.tiles, if not given), due
    // at the boundary tick `due` if given (a due line, §8.1), else resolved at a's next action
    // (Specials.mark, which refuses what canMark does not allow). The mark costs a nothing.
    special(state, x, ev) {
      const a = x.a, sp = part(x, 'sp');
      if (!own(Registry.SPECIALS, sp)) throw new Error(`${where(x)}: there is no special ${sp}`);
      const tiles = x.f.tiles === undefined ? Specials.tiles(state, a, Registry.SPECIALS[sp].shape) : part(x, 'tiles');
      const due = x.f.due === undefined ? null : part(x, 'due');
      Specials.mark(state, a, sp, tiles, ev, due === null ? undefined : { due });
    },
    // alarm: a raises the module's alarm for `turns` turns: m.alarm = {by, since, until}, and
    // the alarm event {by, until} (§4.3), its cause the module. What an alarm does while it
    // runs is the module's own (pipsDecay, mayReturn, alarmDecay: bespoke, plan A7). A second
    // while one runs throws: the rule's when must not raise it.
    alarm(state, x, ev) {
      const turns = int(x, 'turns', 1), m = x.m;
      if (m.alarm && Number.isInteger(m.alarm.until) && m.alarm.until > state.turn) throw new Error(`${where(x)}: an alarm already runs until turn ${m.alarm.until}`);
      m.alarm = { by: x.a.uid, since: state.turn, until: state.turn + turns };
      Causes.emit(state, ev, 'alarm', { by: x.a.uid, until: m.alarm.until }, { k: m.id });
    },
    // clock: the next clock stage n turns closer (ClockRules.advance, which clamps it and says
    // so in its stage event, with this cause).
    clock(state, x, ev) {
      ClockRules.advance(state, int(x, 'n', 0), causeOf(x), ev);
    },
    // tier: a loses a tier, as §5.4's weakened spares do (exhibits have no tier, so it is said
    // directly): its maximum and current health and its damage each lose pct% of themselves,
    // rounded down and at least 1, never falling below 1 (one at 1 or below keeps what it has),
    // and it loses `acc` Acc. Its module event says so; no other event does.
    tier(state, x) {
      const a = x.a, pct = int(x, 'pct', 1), acc = int(x, 'acc', 0);
      if (pct >= 100) throw new Error(`${where(x)}: pct ${pct} would take all`);
      const lose = v => v > 1 ? Math.max(1, v - Math.max(1, Int.pct(v, pct))) : v;
      a.maxHp = lose(a.maxHp); a.hp = Math.min(a.maxHp, lose(a.hp));
      a.dmax = lose(a.dmax); a.dmin = Math.min(a.dmax, lose(a.dmin));
      a.acc -= acc;
    },
    // flag: the module's state gets name = value (plain data), for its rules to read.
    flag(state, x) {
      const v = part(x, 'value');
      x.m[x.f.name] = Causes.copy(v, `${x.m.id}.${x.f.name}`);
    },
  };

  // ---- The hooks the core asks ----
  // The modules present and on, each with its form, in pack order.
  const live = state => entries(state).filter(m => isOn(state, m)).map(m => ({ m, d: DEFS[m.id] }));

  // Causes.emit, after every event: each rule of each module on that acts on its kind. A
  // module event goes to no module (re-entry, §5.4), and once the visit is over none acts.
  function onEvent(state, e, ev) {
    const list = entries(state);
    if (!list.length || e.k === 'module' || state.over) return;
    for (const { m, d } of live(state)) for (const r of d.rules) {
      if (state.over) return;
      if (r.on === e.k) run(state, m, r, e, ev);
    }
  }
  // Turn boundary step 7: each module's alarmDecay.
  function alarmDecay(state, ev) {
    if (!entries(state).length) return;
    for (const { m, d } of live(state)) {
      if (state.over) return;
      if (d.alarmDecay) nest(`${m.id}.alarmDecay`, () => d.alarmDecay(state, ev, m));
    }
  }
  // Turn boundary step 8: the due lines first (Specials.resolveDue), then, while the visit
  // goes on, each module's turn and period rules, then its turn.
  function turn(state, ev) {
    Specials.resolveDue(state, ev);
    if (!entries(state).length) return;
    for (const { m, d } of live(state)) {
      for (const r of d.rules) {
        if (state.over) return;
        if (r.on === 'turn' || r.on === 'period') run(state, m, r, null, ev);
      }
      if (state.over) return;
      if (d.turn) nest(`${m.id}.turn`, () => d.turn(state, ev, m));
    }
  }
  function ask(state, h, args, what) {
    for (const { m, d } of live(state)) {
      if (!d[h]) continue;
      const v = d[h](state, ...args, m);
      if (typeof v !== 'boolean') throw new Error(`Modules: ${m.id}.${h} gave ${JSON.stringify(v)}, not true or false (${what})`);
      if (!v) return false;
    }
    return true;
  }
  // May pips decay now? Not while a module says no (its alarm runs, §5.4).
  const pipsDecay = state => !entries(state).length || ask(state, 'pipsDecay', [], 'may pips decay');
  // May idle awake exhibit a go back? Not while a module says no.
  const mayReturn = (state, a) => !entries(state).length || ask(state, 'mayReturn', [a], 'may it go back');

  // A module's mark, checked (above), and copied out, so nothing reaches back into the module.
  const MARK = ['by', 'sp', 'tiles', 'gross', 'due'];
  function mark(state, id, mk, untilTick) {
    const bad = why => { throw new Error(`Modules.threat: ${id} gave ${JSON.stringify(mk)}: ${why}`); };
    if (!mk || typeof mk !== 'object' || Array.isArray(mk)) bad('not {by, sp, tiles, gross, due}');
    const keys = Object.keys(mk);
    if (keys.length !== MARK.length || MARK.some(k => !keys.includes(k))) bad('not {by, sp, tiles, gross, due}');
    if (typeof mk.by !== 'string' || !state.actors.some(a => a.uid === mk.by && !a.gone)) bad('by is no exhibit present');
    if (!own(Registry.SPECIALS, mk.sp)) bad('sp is no special');
    if (!Array.isArray(mk.tiles) || !mk.tiles.length || !mk.tiles.every(t => isTile(t) && Grid.inside(state.dept, t[0], t[1]))) bad('tiles are not tiles of the map');
    if (!Number.isInteger(mk.gross) || mk.gross < 0) bad('gross is not a whole number');
    if (!Number.isInteger(mk.due) || mk.due % N.TICKS_PER_TURN !== 0 || mk.due <= state.tick || mk.due >= untilTick) bad(`due is not a boundary tick after ${state.tick} and before ${untilTick}`);
    return JSON.parse(JSON.stringify(mk));
  }
  function threat(state, untilTick) {
    if (!Number.isInteger(untilTick)) throw new Error(`Modules.threat: until ${untilTick} is not a tick`);
    if (!entries(state).length) return [];
    const out = [];
    for (const { m, d } of live(state)) {
      if (!d.threat) continue;
      const got = d.threat(state, untilTick, m);
      if (!Array.isArray(got)) throw new Error(`Modules.threat: ${m.id} gave ${JSON.stringify(got)}, not a list of marks`);
      for (const mk of got) out.push(mark(state, m.id, mk, untilTick));
    }
    return out;
  }

  return { EFFECTS: EFFECTS.slice(), define, defined, bespoke: bespokeList, form, of, on, active, flagged, rng, init, offFor,
    onEvent, alarmDecay, turn, pipsDecay, mayReturn, threat };
})();
