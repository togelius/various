// ACCESSION — events and their causes (BUILD.md §3.4, §4.3), frozen after M3's Wave 0. Every
// rule emits its events through Causes.emit, so each carries its turn, tick and cause, the
// recorded kinds reach the cause records, and Causes.check can test any event against the
// registry's schema for its kind and for its cause.
'use strict';
const Causes = (() => {
  const copy = c => JSON.parse(JSON.stringify(c));

  // An event, not yet emitted: {k, turn, tick, ...fields, cause}. Fields and cause are
  // copied, so a rule can go on changing its own objects, and nothing outside the state can
  // reach into it through an event.
  function make(state, k, fields, cause) {
    const e = Object.assign({ k, turn: state.turn, tick: state.tick }, copy(fields || {}));
    if (cause !== undefined && cause !== null) e.cause = copy(cause);
    return e;
  }

  // Emit an event: push it onto ev, keep it in the cause records if its kind is recorded
  // (§3.4), then give M4's modules their look at it. Returns the event.
  function emit(state, ev, k, fields, cause) {
    const e = make(state, k, fields, cause);
    ev.push(e);
    const kind = Registry.EVENTS[k];
    if (kind && kind.record) record(state, e);
    Modules.onEvent(state, e, ev);
    return e;
  }

  // The last CAUSE_RECORDS records, for the recap's narrative. Records are copied in.
  function record(state, rec) {
    state.causes.push(copy(rec));
    if (state.causes.length > N.CAUSE_RECORDS) state.causes.splice(0, state.causes.length - N.CAUSE_RECORDS);
  }

  // Types of record (§4.3): what each schema type accepts.
  const isInt = v => Number.isSafeInteger(v);
  const isTile = v => Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const TYPE = {
    uid: v => typeof v === 'string' && v.length > 0,
    uids: v => Array.isArray(v) && v.every(u => typeof u === 'string' && u.length > 0),
    int: isInt, str: v => typeof v === 'string', bool: v => typeof v === 'boolean',
    tile: isTile, tiles: v => Array.isArray(v) && v.every(isTile), obj: isObj,
  };
  const show = v => v === undefined ? 'undefined' : JSON.stringify(v);
  // Check obj's fields against a schema's field list; `where` names it ('damaged' or
  // 'damaged.cause'); `skip` lists the keys that belong to the envelope, not the schema.
  function fieldsOf(where, obj, list, skip) {
    for (const f of list) {
      const v = obj[f.name];
      if (v === undefined || v === null) { if (!f.optional) return `${where}.${f.name}: missing ${f.type}`; continue; }
      if (!TYPE[f.type](v)) return `${where}.${f.name}: ${show(v)} is not a ${f.type}`;
    }
    for (const key of Object.keys(obj)) if (!skip.includes(key) && !list.some(f => f.name === key)) return `${where}.${key}: not in the schema`;
    return null;
  }

  // Causes.check(e) → null, or the first problem, such as 'damaged.cause.roll: missing int'.
  // The event's fields are checked against Registry.EVENTS[k], and its cause against
  // Registry.CAUSES[k][cause.k]; moved, closed and refused are exempt from the cause check
  // (§3.4). A field marked optional may be absent or null; no field outside the schema is allowed.
  function check(e) {
    if (!isObj(e) || typeof e.k !== 'string') return 'event: no kind';
    const kind = Registry.EVENTS[e.k];
    if (!kind) return `${e.k}: not an event kind`;
    if (!isInt(e.turn)) return `${e.k}.turn: missing int`;
    if (!isInt(e.tick)) return `${e.k}.tick: missing int`;
    const bad = fieldsOf(e.k, e, kind.list, ['k', 'turn', 'tick', 'cause']);
    if (bad) return bad;
    if (kind.exempt) return e.cause === undefined || isObj(e.cause) ? null : `${e.k}.cause: not an object`;
    if (!isObj(e.cause) || typeof e.cause.k !== 'string') return `${e.k}.cause: missing`;
    const schema = Registry.CAUSES[e.k] && Registry.CAUSES[e.k][e.cause.k];
    if (!schema) return `${e.k}.cause: no schema for the cause ${e.cause.k}`;
    return fieldsOf(`${e.k}.cause`, e.cause, schema.list, ['k']);
  }

  return { make, emit, record, check };
})();
