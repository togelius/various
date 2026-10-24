// ACCESSION — the action table (BUILD.md §4.2), frozen after M3's Wave 0. Each of your
// actions is defined once, by the file of the system that owns it, and step() dispatches on
// the action's `a`. ORDER is closed: an id outside it cannot be defined, and Step.legal lists
// the legal actions in this order.
'use strict';
const Actions = (() => {
  // push (weather jars) and view (viewing the Centrepiece) are reserved for M4 and have no
  // handler in M3, so step() refuses them as unknown.
  const ORDER = ['wait', 'rest', 'sit', 'move', 'attack', 'close', 'open', 'bash', 'push', 'take', 'drop', 'equip', 'unequip',
    'use', 'throw', 'read', 'view', 'choose', 'leave'];
  const handlers = {}, choices = {};
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // Actions.define(id, {legal, candidates, apply}):
  //   legal(state) → [action]       the legal actions of this kind now (step() accepts exactly these)
  //   candidates(state) → [action]  a superset, illegal ones included, for the parity test (§4.2)
  //   apply(state, action, ev) → ticks, or a refusal code; it checks everything before it
  //                                 changes anything, so a refusal leaves the state and every
  //                                 stream as they were (§4.2)
  function define(id, h) {
    if (!ORDER.includes(id)) throw new Error(`Actions: ${id} is not in Actions.ORDER`);
    if (own(handlers, id)) throw new Error(`Actions: ${id} is defined twice`);
    for (const k of ['legal', 'candidates', 'apply']) if (typeof (h && h[k]) !== 'function') throw new Error(`Actions: ${id} needs ${k}`);
    handlers[id] = h;
    return h;
  }
  const get = id => typeof id === 'string' && own(handlers, id) ? handlers[id] : null;

  // A pending choice (state.ui.pendingChoice, such as the Card's seal) is answered by
  // choose(index), which hands it to the function defined for its k:
  // (state, index, ev) → ticks or a refusal code.
  function defineChoice(k, fn) {
    if (own(choices, k)) throw new Error(`Actions: the choice ${k} is defined twice`);
    if (typeof fn !== 'function') throw new Error(`Actions: the choice ${k} needs a function`);
    choices[k] = fn;
  }
  const choice = k => typeof k === 'string' && own(choices, k) ? choices[k] : null;

  return { ORDER: ORDER.slice(), define, get, defineChoice, choice };
})();
