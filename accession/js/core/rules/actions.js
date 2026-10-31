// ACCESSION — the action table (BUILD.md §4.2), frozen after M3's Wave 0. Each of your
// actions is defined once, by the file of the system that owns it, and step() dispatches on
// the action's `a`. ORDER is closed: an id outside it cannot be defined, and Step.legal lists
// the legal actions in this order. M4's Wave 0 (W0d1) added the refusers, the free kinds and
// the generic choose(index), which this file defines.
'use strict';
const Actions = (() => {
  // push (weather jars) is reserved and has no handler, so step() refuses it as unknown (M4
  // cuts it, plan A4); view is defined by rules/viewing.js.
  const ORDER = ['wait', 'rest', 'sit', 'move', 'attack', 'close', 'open', 'bash', 'push', 'take', 'drop', 'equip', 'unequip',
    'use', 'throw', 'read', 'view', 'choose', 'leave'];
  const handlers = {}, choices = {}, refusers = [];
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

  // Actions.addRefuser(fn): fn(state, action) → a refusal code or null, asked by step() after
  // Status.blocks and before the action's handler, and by Step.legal, so a refused action is
  // never listed (plan A4). Refusers are asked in the order added, and the first code given
  // is the refusal. A refuser only reads: it changes nothing and emits nothing. Each refusal
  // belongs to the rule that makes it (a shutter's `sealed`, the dust sheet's `sheeted`), which
  // adds its refuser from its own file.
  function addRefuser(fn) {
    if (typeof fn !== 'function') throw new Error('Actions.addRefuser: a refuser is a function');
    refusers.push(fn);
  }
  // Actions.refusal(state, action) → the first refuser's code, or null.
  function refusal(state, action) {
    for (const fn of refusers) {
      const code = fn(state, action);
      if (code === null || code === undefined) continue;
      if (typeof code !== 'string' || !code) throw new Error(`Actions: a refuser gave ${JSON.stringify(code)}, not a refusal code`);
      return code;
    }
    return null;
  }

  // Actions.free(kind): does an action of this kind cost no time (§8.1: reading, answering a
  // choice, leaving by an exit)? Such an action never sets your ring, and step() accepts 0
  // ticks for it; any other action that costs no time is one a perk made free (Step).
  const FREE = ['read', 'choose', 'leave'];
  const free = kind => FREE.includes(kind);

  // choose(index) (§4.2): the answer to the choice waiting (state.ui.pendingChoice {k,
  // options}), handed to the function defined for its kind (defineChoice). It costs what that
  // function says (a seal or a perk: nothing). The choice is cleared unless the function asked
  // a new one; then, if no choice is left waiting, Progress.afterChoice raises an offer that
  // waited behind the one answered (a perk offer behind a Card's seal, plan A4).
  define('choose', {
    legal(state) {
      const p = state.ui && state.ui.pendingChoice;
      if (!p || !choice(p.k) || !Array.isArray(p.options)) return [];
      return p.options.map((o, index) => ({ a: 'choose', index }));
    },
    candidates(state) {
      const p = state.ui && state.ui.pendingChoice, n = p && Array.isArray(p.options) ? p.options.length : 1, out = [];
      for (let index = -1; index <= Math.max(n, 1); index++) out.push({ a: 'choose', index });
      return out.concat([{ a: 'choose' }]);
    },
    apply(state, action, ev) {
      const p = state.ui && state.ui.pendingChoice, fn = p ? choice(p.k) : null;
      if (!p || !fn || !Array.isArray(p.options)) return 'choice_none';
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= p.options.length) return 'choice_bad';
      const r = fn(state, action.index, ev);
      if (typeof r === 'string') return r;
      if (state.ui.pendingChoice === p) state.ui.pendingChoice = null;
      if (!state.ui.pendingChoice) Progress.afterChoice(state, ev);
      return r;
    },
  });

  return { ORDER: ORDER.slice(), define, get, defineChoice, choice, addRefuser, refusal, free };
})();
