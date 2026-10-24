// ACCESSION — the grammar registry (BUILD.md §5.1). This file holds the nine universal
// systems and the API; every entry, clause template and event schema lives in a fragment,
// js/core/reg/<part>.js, owned by the package that implements and tests it (§5.1). A clause
// states exactly what the rule code does; the scenario tests named in `tests` prove it.
'use strict';
const Registry = (() => {
  // DECISIONS.md, "Nine universal systems": the sentence the player is taught.
  const SYSTEMS = [
    { id: 'moving', icon: 'damage', name: 'Moving and fighting', sentence: 'Tap to move; bump into something to attack it. Ordinary blows roll dice, and the odds are shown before you commit. Dangerous moves are marked on the floor with their exact damage, and never miss. Your health recovers slowly.' },
    { id: 'waking', icon: 'ring', name: 'Waking', sentence: 'Every exhibit is asleep, stirring or awake. Being close or making noise fills its three pips; the ring around you shows what counts as close. A species may have one extra trigger, shown as one icon.' },
    { id: 'cases', icon: 'touch_case', name: 'Cases', sentence: 'You can see through glass but not walk through it. Open a case if your grade allows, or break it, loudly.' },
    { id: 'clock', icon: 'clock', name: 'The clock', sentence: 'At the bell your recovery slows; later the night watch begins its rounds, waking whatever is nearest to you.' },
    { id: 'kit', icon: 'kit', name: 'Your kit', sentence: 'A weapon, a garment, two curios and an instrument. Restoration kits improve them.' },
    { id: 'consumables', icon: 'seal', name: 'Consumables', sentence: 'A handful of kinds, unlabelled until you have used one or read about it.' },
    { id: 'grade', icon: 'certificate', name: 'Grade', sentence: 'Each department’s Certificate, earned by defeating or viewing its Centrepiece, raises your grade by one: more health, a perk chosen from three, heavier objects, higher-grade cases.' },
    { id: 'labels', icon: 'reads', name: 'Labels', sentence: 'Every exhibit and object has one: a plain Behaviour line that states exactly what it does, and a paragraph that is only for reading.' },
    { id: 'doors', icon: 'highlight', name: 'Doors', sentence: 'Each department ends in doors whose placards say what kind of trouble lies behind each.' },
  ];
  const MAX_SYSTEMS = 10;

  // The tables. Each is a plain object keyed by id, and Registry.order(name) gives its ids in
  // definition order, so the core never iterates an object's keys (§3.1). CLAUSES holds the
  // clauses that belong to no other id: the generic wake clause and its pipless form. KITS
  // holds the Restoration kit.
  const NAMES = ['TRIGGERS', 'ARCHETYPES', 'MODIFIERS', 'SPECIALS', 'STATUSES', 'SURFACES', 'ITEM_PRIMS', 'INSTRUMENTS', 'KITS',
    'CONSUMABLES', 'SEALS', 'FIXTURES', 'GLASS', 'WAKE_CAUSES', 'REFUSALS', 'MODULES', 'CLAUSES'];
  const tables = {}, orders = {};
  for (const t of NAMES) { tables[t] = {}; orders[t] = []; }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // `ready` (§5.1): false until the owner's scenarios pass; 'unit' when they pass with the
  // other systems' hooks stubbed or driven directly; true when the joined-up scenarios pass.
  const READY = [false, 'unit', true];
  const BUILT = ['M3', 'M4'];

  // Registry.define(table, id, entry): one owner per id, so a second definition throws.
  // Every entry gets the standard fields, so none is ever undefined:
  //   built 'M3' | 'M4'; ready; tests (scenario files that prove the clause); inv (the
  //   invariant file's id, test/behaviour/<inv>.inv.js, or null).
  // A clause-bearing entry also has clause (a template, §5.3), params ({name: reference},
  // read by Clauses), covers (the event kinds its clause accounts for) and icon.
  function define(table, id, entry) {
    if (!own(tables, table)) throw new Error(`Registry: no table ${table}`);
    if (typeof id !== 'string' || !id) throw new Error(`Registry: ${table} needs a string id`);
    if (own(tables[table], id)) throw new Error(`Registry: ${table}.${id} is defined twice`);
    const e = Object.assign({ built: 'M3', ready: false, tests: [], inv: null }, entry);
    if (!BUILT.includes(e.built)) throw new Error(`Registry: ${table}.${id} has built ${JSON.stringify(e.built)}`);
    if (!READY.includes(e.ready)) throw new Error(`Registry: ${table}.${id} has ready ${JSON.stringify(e.ready)}`);
    if (e.clause !== undefined) {
      if (typeof e.clause !== 'string') throw new Error(`Registry: ${table}.${id} has a clause that is not a string`);
      for (const [k, v] of [['params', {}], ['covers', []], ['icon', null]]) if (e[k] === undefined) e[k] = v;
    }
    tables[table][id] = e;
    orders[table].push(id);
    return e;
  }
  function order(table) {
    if (!own(orders, table)) throw new Error(`Registry: no table ${table}`);
    return orders[table].slice();
  }

  // Event schemas (§3.4, §4.3). A schema's fields map each field to a type, with ? for an
  // optional one (absent or null): uid (an actor's or item's uid), uids (a list of them),
  // int, str, bool, tile ([x, y]), tiles (a list of them), obj (a plain object).
  //   Registry.defineEvent(k, {fields, record?, exempt?, built?})  one owner per kind;
  //     record: Causes.record keeps it for the recap; exempt: its cause is not checked
  //     (moved, closed, refused, BUILD.md §3.4).
  //   Registry.defineCause(k, causeK, {fields, built?})            one owner per pair; the
  //     kind may be defined by a fragment that loads later, and lint-registry checks it is.
  // Each schema keeps its fields both as written and as a list [{name, type, optional}], in
  // the order written, for the code that checks events.
  const TYPES = ['uid', 'uids', 'int', 'str', 'bool', 'tile', 'tiles', 'obj'];
  const EVENT_KINDS = [], EVENTS = {}, CAUSES = {};
  function fieldList(where, fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error(`Registry: ${where} needs a fields object`);
    // A schema is code, never state, so its keys come in the order they are written.
    return Object.keys(fields).map(name => {
      const t = fields[name], optional = typeof t === 'string' && t.endsWith('?'), type = optional ? t.slice(0, -1) : t;
      if (!TYPES.includes(type)) throw new Error(`Registry: ${where}.${name} has the type ${JSON.stringify(t)}`);
      return { name, type, optional };
    });
  }
  function defineEvent(k, schema) {
    if (own(EVENTS, k)) throw new Error(`Registry: the event kind ${k} is defined twice`);
    const s = schema || {};
    const e = { k, fields: s.fields || {}, list: fieldList(k, s.fields || {}), record: !!s.record, exempt: !!s.exempt, built: s.built || 'M3' };
    if (!BUILT.includes(e.built)) throw new Error(`Registry: the event kind ${k} has built ${JSON.stringify(e.built)}`);
    EVENTS[k] = e;
    EVENT_KINDS.push(k);
    if (!own(CAUSES, k)) CAUSES[k] = {};
    return e;
  }
  function defineCause(k, causeK, schema) {
    if (!own(CAUSES, k)) CAUSES[k] = {};
    if (own(CAUSES[k], causeK)) throw new Error(`Registry: the cause ${k}.${causeK} is defined twice`);
    const s = schema || {};
    const c = { k: causeK, fields: s.fields || {}, list: fieldList(k + '.' + causeK, s.fields || {}), built: s.built || 'M3' };
    if (!BUILT.includes(c.built)) throw new Error(`Registry: the cause ${k}.${causeK} has built ${JSON.stringify(c.built)}`);
    CAUSES[k][causeK] = c;
    return c;
  }

  return Object.assign({ SYSTEMS, MAX_SYSTEMS, TABLES: NAMES.slice(), TYPES: TYPES.slice(), READY, define, order, defineEvent, defineCause, EVENT_KINDS, EVENTS, CAUSES }, tables);
})();
