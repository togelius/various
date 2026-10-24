// ACCESSION — every sentence about the rules is made here, from events and data (BUILD.md
// §3.4). This file holds the API; the sentences live in fragments, js/core/text/<part>.js,
// one per owner, as the registry's entries do (§5.1). A sentence is keyed by the event's
// kind and its cause, because many rules emit the same kind for their own reasons.
'use strict';
const Text = (() => {
  const KINDS = Object.create(null), CAUSES = Object.create(null), REFUSALS = Object.create(null), MAKERS = Object.create(null), LOG = Object.create(null);
  const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const once = (o, k, what) => { if (has(o, k)) throw new Error(`Text: ${what} is defined twice`); };
  const isFn = (f, what) => { if (typeof f !== 'function') throw new Error(`Text: ${what} needs a function`); };

  // Text.define(k, fn, {log}?): the kind's default sentence, by its base owner. `log` says
  // whether Text.log shows the kind: true (the default), false (never), or 'seen' (only when
  // the actor it is about, `who`, is you or in view).
  function define(k, fn, opts) {
    once(KINDS, k, `the sentence for ${k}`); isFn(fn, k);
    const log = opts && opts.log !== undefined ? opts.log : true;
    if (log !== true && log !== false && log !== 'seen') throw new Error(`Text: ${k} has log ${JSON.stringify(log)}`);
    KINDS[k] = fn; LOG[k] = log;
  }
  // Text.defineCause(k, causeK, fn): the sentence for one cause of a kind, by that cause's owner.
  function defineCause(k, causeK, fn) {
    if (!has(CAUSES, k)) CAUSES[k] = Object.create(null);
    once(CAUSES[k], causeK, `the sentence for ${k}.${causeK}`); isFn(fn, k + '.' + causeK);
    CAUSES[k][causeK] = fn;
  }
  // Text.defineRefusal(code, fn): the sentence for a refusal code, fn(data) → sentence.
  function defineRefusal(code, fn) { once(REFUSALS, code, `the refusal ${code}`); isFn(fn, code); REFUSALS[code] = fn; }
  // Text.provide(name, fn): a named sentence maker ('clock', 'recap'), by its one owner.
  function provide(name, fn) { once(MAKERS, name, `the sentence maker ${name}`); isFn(fn, name); MAKERS[name] = fn; }

  // The words a sentence uses for an actor. nameOf(uid) gives an actor's name in
  // mid-sentence ('the Lantern-Crop Wader'; Labels.nameOf(state) makes one). Without it, or
  // where it gives null, an exhibit is the test room's 'the training dummy'. Called as a map
  // callback, the index is ignored. A sentence fn(e, w) gets these words as w:
  //   w.name(uid) mid-sentence, w.Name(uid) to start one, w.is(uid) 'are' for you, else 'is'.
  function words(nameOf) {
    const name = uid => uid === 'you' ? 'you' : (typeof nameOf === 'function' && nameOf(uid)) || 'the training dummy';
    const Name = uid => { const s = name(uid); return s.charAt(0).toUpperCase() + s.slice(1); };
    const is = uid => uid === 'you' ? 'are' : 'is';
    return { name, Name, is };
  }

  // Text.event(e, nameOf): the sentence for its kind and cause, falling back to the kind's
  // default; null for a kind with no sentence (lint-registry fails on one).
  function event(e, nameOf) {
    const c = e.cause && typeof e.cause.k === 'string' ? e.cause.k : null;
    const fn = (c !== null && has(CAUSES, e.k) && has(CAUSES[e.k], c)) ? CAUSES[e.k][c] : has(KINDS, e.k) ? KINDS[e.k] : null;
    return fn ? fn(e, words(nameOf)) : null;
  }
  // A refusal code's sentence; a reason with no sentence defined is shown as it is.
  const refusal = (code, data) => has(REFUSALS, code) ? REFUSALS[code](data === undefined ? null : data) : String(code);
  const clock = view => has(MAKERS, 'clock') ? MAKERS.clock(view) : null;
  const recap = (state, nameOf) => has(MAKERS, 'recap') ? MAKERS.recap(state, nameOf) : null;

  // Text.log(events, nameOf, visible): the sentences of one step for the player's log.
  // It leaves out the kinds defined with log: false, and those with log: 'seen' about an
  // actor that visible(uid) says is out of view (everything is in view without visible).
  // An exhibit that wakes straight into a hunt emits woke, then hunting; the log shows the
  // hunting sentence alone, which says that it woke.
  function log(events, nameOf, visible) {
    const seen = uid => uid === 'you' || typeof visible !== 'function' || !!visible(uid);
    const out = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i], how = has(LOG, e.k) ? LOG[e.k] : true;
      if (how === false || (how === 'seen' && !seen(e.who))) continue;
      if (e.k === 'woke' && e.mode === 'hunting' && events.slice(i + 1).some(f => f.k === 'hunting' && f.who === e.who)) continue;
      const s = event(e, nameOf);
      if (s) out.push(s);
    }
    return out;
  }

  // What is defined, for lint-registry and the tests.
  const defined = (k, causeK) => causeK === undefined ? has(KINDS, k) : has(CAUSES, k) && has(CAUSES[k], causeK);
  const refusalDefined = code => has(REFUSALS, code);
  const provided = name => has(MAKERS, name);
  function list() {
    const causes = [];
    for (const k of Object.keys(CAUSES)) for (const c of Object.keys(CAUSES[k])) causes.push([k, c]);
    return { kinds: Object.keys(KINDS), causes, refusals: Object.keys(REFUSALS), makers: Object.keys(MAKERS) };
  }
  const logs = k => has(LOG, k) ? LOG[k] : true;

  return { define, defineCause, defineRefusal, provide, event, refusal, clock, recap, log, defined, refusalDefined, provided, list, logs };
})();
