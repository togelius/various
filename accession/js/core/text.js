// ACCESSION — every sentence about the rules is made here, from events and data (BUILD.md
// §3.4). This file holds the API; the sentences live in fragments, js/core/text/<part>.js,
// one per owner, as the registry's entries do (§5.1). A sentence is keyed by the event's
// kind and its cause, because many rules emit the same kind for their own reasons.
'use strict';
const Text = (() => {
  const KINDS = Object.create(null), CAUSES = Object.create(null), REFUSALS = Object.create(null), MAKERS = Object.create(null), LOG = Object.create(null),
    AGAIN = Object.create(null), GROUPS = Object.create(null);
  const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const once = (o, k, what) => { if (has(o, k)) throw new Error(`Text: ${what} is defined twice`); };
  const isFn = (f, what) => { if (typeof f !== 'function') throw new Error(`Text: ${what} needs a function`); };

  // Text.define(k, fn, {log, again}?): the kind's default sentence, by its base owner. `log`
  // says whether Text.log shows the kind: true (the default), false (never), or 'seen' (only
  // when the actor it is about, `who`, is you or in view). `again(n)`, for a kind two actors
  // of one name can tell word for word in one step (a swarm's bodies stirring), is what
  // Text.log adds to the first such sentence in place of the n more ('So does another…').
  function define(k, fn, opts) {
    once(KINDS, k, `the sentence for ${k}`); isFn(fn, k);
    const log = opts && opts.log !== undefined ? opts.log : true;
    if (log !== true && log !== false && log !== 'seen') throw new Error(`Text: ${k} has log ${JSON.stringify(log)}`);
    KINDS[k] = fn; LOG[k] = log;
    if (opts && opts.again !== undefined) { isFn(opts.again, k + ' again'); AGAIN[k] = opts.again; }
  }
  // Text.defineCause(k, causeK, fn): the sentence for one cause of a kind, by that cause's owner.
  function defineCause(k, causeK, fn) {
    if (!has(CAUSES, k)) CAUSES[k] = Object.create(null);
    once(CAUSES[k], causeK, `the sentence for ${k}.${causeK}`); isFn(fn, k + '.' + causeK);
    CAUSES[k][causeK] = fn;
  }
  // Text.defineGroup(k, causeK, fn, key?): how Text.log tells, in one sentence, two or more
  // events of kind k with cause causeK that one step makes for one reason (an alarm waking
  // every sleeper that can hear, a chime waking every station, an original's spares losing
  // heart), by that cause's owner. fn(events, w) → the sentence, given the events in the order
  // they came; key(e) → a string, the reason they share (by default they all share one), so
  // that two reasons in one step are two sentences, or null for an event that is told alone,
  // by its own sentence, since it does not mean what the group's sentence says. A single
  // such event is told by its own sentence (Text.event).
  function defineGroup(k, causeK, fn, key) {
    if (!has(GROUPS, k)) GROUPS[k] = Object.create(null);
    once(GROUPS[k], causeK, `the group for ${k}.${causeK}`); isFn(fn, k + '.' + causeK + ' group');
    if (key !== undefined) isFn(key, k + '.' + causeK + ' group key');
    GROUPS[k][causeK] = { say: fn, key: key || (() => '') };
  }
  // Text.defineRefusal(code, fn): the sentence for a refusal code, fn(data) → sentence.
  function defineRefusal(code, fn) { once(REFUSALS, code, `the refusal ${code}`); isFn(fn, code); REFUSALS[code] = fn; }
  // Text.provide(name, fn): a named sentence maker ('clock', 'stage', 'recap', 'confirm',
  // 'rest'), by its one owner.
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
  // The stage chip's words (§7.2), {name, next}, from Clock.view(state), or null with no clock.
  const stage = view => has(MAKERS, 'stage') ? MAKERS.stage(view) : null;
  const recap = (state, nameOf) => has(MAKERS, 'recap') ? MAKERS.recap(state, nameOf) : null;
  // Text.count(n, noun, plural?): a whole number with its noun, as a player reads it: '1 turn',
  // '0 turns', '3 turns', never '1 turns'. The plural is the one given, or the noun with s
  // (es after s, x, z, ch or sh; ies in place of a y after a consonant: '2 bodies').
  function count(n, noun, plural) {
    if (!Number.isInteger(n)) throw new Error(`Text.count: ${JSON.stringify(n)} is not a whole number`);
    if (typeof noun !== 'string' || !noun) throw new Error('Text.count needs a noun');
    if (n === 1) return `1 ${noun}`;
    if (typeof plural === 'string' && plural) return `${n} ${plural}`;
    const many = /(s|x|z|ch|sh)$/.test(noun) ? noun + 'es' : /[^aeiou]y$/.test(noun) ? noun.slice(0, -1) + 'ies' : noun + 's';
    return `${n} ${many}`;
  }
  // A count of tiles in words: '1 tile', '3 tiles' (a distance or a range from an event can be 1).
  const tiles = n => n === 1 ? '1 tile' : `${n} tiles`;
  // Text.grade(n): a grade as the badge prints it, in Roman numerals (§8.7: 'Handling
  // Clearance, Grade IV'): 1 is 'I', 7 is 'VII'. A grade is a whole number from 1; anything
  // else throws, so that no arabic or broken grade reaches a sentence.
  const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  function grade(n) {
    if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error(`Text.grade: ${JSON.stringify(n)} is not a grade`);
    let out = '', left = n;
    for (const [v, s] of ROMAN) while (left >= v) { out += s; left -= v; }
    return out;
  }
  // A confirmation's words (§7.1), {title, yes, line}, or null for a kind with none.
  const confirm = (k, data, nameOf) => has(MAKERS, 'confirm') ? MAKERS.confirm(k, data, nameOf) : null;
  // A long rest's one line in the log (§7.1): data {turns, regained, hp, maxHp}, or null.
  const rest = data => has(MAKERS, 'rest') ? MAKERS.rest(data) : null;

  // Text.log(events, nameOf, visible): the sentences of one step for the player's log.
  // It leaves out the kinds defined with log: false, and those with log: 'seen' about an
  // actor that visible(uid) says is out of view (everything is in view without visible; an
  // event about no actor, with no `who`, is always in view). An exhibit that wakes straight
  // into a hunt emits woke, then hunting; the log shows the hunting sentence alone, which
  // says that it woke. Of a kind with `again`, a sentence the step has already told word for
  // word is not told twice: the first says how many more. Events of a kind and cause with a
  // group (Text.defineGroup) that share their reason are told in one sentence, where the
  // first of them came, when there are two or more of them (one whose key is not a string is
  // told alone).
  function log(events, nameOf, visible) {
    const seen = uid => uid === undefined || uid === 'you' || typeof visible !== 'function' || !!visible(uid);
    const out = [], told = new Map(), byReason = new Map();
    for (let i = 0; i < events.length; i++) {
      const e = events[i], how = has(LOG, e.k) ? LOG[e.k] : true;
      if (how === false || (how === 'seen' && !seen(e.who))) continue;
      if (e.k === 'woke' && e.mode === 'hunting' && events.slice(i + 1).some(f => f.k === 'hunting' && f.who === e.who)) continue;
      const c = e.cause && typeof e.cause.k === 'string' ? e.cause.k : null;
      const g = c !== null && has(GROUPS, e.k) && has(GROUPS[e.k], c) ? GROUPS[e.k][c] : null, gk = g ? g.key(e) : null;
      if (typeof gk === 'string') {
        const key = e.k + '\n' + c + '\n' + gk, t = byReason.get(key);
        if (t) { t.events.push(e); continue; }
        byReason.set(key, { at: out.length, g, events: [e] });
        out.push(null);
        continue;
      }
      const s = event(e, nameOf);
      if (!s) continue;
      if (has(AGAIN, e.k)) {
        const key = e.k + '\n' + s, t = told.get(key);
        if (t) { t.n++; continue; }
        told.set(key, { at: out.length, k: e.k, n: 0 });
      }
      out.push(s);
    }
    for (const t of told.values()) if (t.n > 0) out[t.at] += ' ' + AGAIN[t.k](t.n);
    for (const t of byReason.values()) out[t.at] = t.events.length > 1 ? t.g.say(t.events.slice(), words(nameOf)) : event(t.events[0], nameOf);
    return out.filter(s => typeof s === 'string' && s.length > 0);
  }

  // What is defined, for lint-registry and the tests.
  const defined = (k, causeK) => causeK === undefined ? has(KINDS, k) : has(CAUSES, k) && has(CAUSES[k], causeK);
  const grouped = (k, causeK) => has(GROUPS, k) && has(GROUPS[k], causeK);
  const refusalDefined = code => has(REFUSALS, code);
  const provided = name => has(MAKERS, name);
  function list() {
    const causes = [], groups = [];
    for (const k of Object.keys(CAUSES)) for (const c of Object.keys(CAUSES[k])) causes.push([k, c]);
    for (const k of Object.keys(GROUPS)) for (const c of Object.keys(GROUPS[k])) groups.push([k, c]);
    return { kinds: Object.keys(KINDS), causes, refusals: Object.keys(REFUSALS), makers: Object.keys(MAKERS), groups };
  }
  const logs = k => has(LOG, k) ? LOG[k] : true;

  return { define, defineCause, defineGroup, defineRefusal, provide, event, refusal, clock, stage, recap, confirm, rest, count, tiles, grade, log, defined, grouped, refusalDefined, provided, list, logs };
})();
