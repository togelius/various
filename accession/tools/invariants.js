// ACCESSION — Behaviour-line invariants (BUILD.md §5.3, check 1). Each clause's invariant
// lives with its tests, in test/behaviour/<file>.inv.js, and the registry entry's `inv`
// names that file. A file exports a function of the loaded core,
//   module.exports = (C) => ({ id, applies(actor, state), check(pre, events, post, ctx) → null | message })
// or a list of such objects, one per clause it holds. load(C) gathers every file;
// checker(C, invs) gives the function that the harness, the monkeys, the soaks and the
// bots call after every step.
//
// Which actors a check sees. An invariant with `applies` is checked once for each actor
// that applies(actor, post) accepts, in spawn order, among the actors that were not gone
// when the step began and those the step created (so an exhibit destroyed during the step
// is checked on that step, and never again). ctx is
//   { uid, actor (in post), before (in pre, or null if the step created it), action, step }
// where step counts the checker's calls from 1. An invariant without `applies` is checked
// once a step, with uid, actor and before null. A check returns null when the clause held,
// or a message saying what broke it; a check that throws, or returns anything else (a
// boolean, say), is reported as a violation too.
// pre and post must not be changed: pre is a clone, post the live state.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, '..', 'test', 'behaviour');
const SUFFIX = '.inv.js';

const cache = new WeakMap();

// Every invariant in dir (test/behaviour/ by default), files in name order, each object as
// {id, file, applies, check}, where file is the file's id (its name without .inv.js).
function load(C, opts) {
  const dir = path.resolve((opts && opts.dir) || DIR);
  let byDir = cache.get(C);
  if (!byDir) { byDir = new Map(); cache.set(C, byDir); }
  if (byDir.has(dir)) return byDir.get(dir).slice();
  const out = [], seen = new Set();
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(SUFFIX)).sort() : [];
  for (const name of names) {
    const file = name.slice(0, -SUFFIX.length), where = path.join(dir, name);
    const factory = require(where);
    if (typeof factory !== 'function') throw new Error(`invariants: ${name} must export (C) => invariant`);
    const got = factory(C);
    for (const inv of Array.isArray(got) ? got : [got]) {
      if (!inv || typeof inv.id !== 'string' || !inv.id) throw new Error(`invariants: ${name} gives an invariant with no id`);
      if (typeof inv.check !== 'function') throw new Error(`invariants: ${name}: ${inv.id} has no check(pre, events, post, ctx)`);
      if (inv.applies !== undefined && inv.applies !== null && typeof inv.applies !== 'function') throw new Error(`invariants: ${name}: ${inv.id}.applies must be a function`);
      if (seen.has(inv.id)) throw new Error(`invariants: ${inv.id} is defined twice (${name})`);
      seen.add(inv.id);
      out.push({ id: inv.id, file, applies: inv.applies || null, check: inv.check });
    }
  }
  byDir.set(dir, out);
  return out.slice();
}

// The invariants a run asks for: 'all' (every file's), false or [] (none), or a list whose
// entries are ids, file ids, or invariant objects ({id, applies?, check}) given directly.
function select(C, which, opts) {
  if (which === undefined || which === 'all') return load(C, opts);
  if (which === false || which === null) return [];
  if (!Array.isArray(which)) throw new Error(`invariants: cannot select ${JSON.stringify(which)}; give 'all' or a list`);
  const out = [];
  let all = null;
  for (const w of which) {
    if (w && typeof w === 'object') {
      if (typeof w.id !== 'string' || typeof w.check !== 'function') throw new Error('invariants: an invariant object needs id and check');
      out.push({ id: w.id, file: w.file || null, applies: w.applies || null, check: w.check });
      continue;
    }
    if (!all) all = load(C, opts);
    const hit = all.filter(i => i.id === w || i.file === w);
    if (!hit.length) throw new Error(`invariants: no invariant or file named ${w}`);
    for (const h of hit) if (!out.includes(h)) out.push(h);
  }
  return out;
}

// checker(C, invs) → (pre, action, events, post) → [violation]. A violation is
//   { inv, file, uid, sp, step, action, message, text }
// where text is one line naming the clause's invariant, the actor and the step.
function checker(C, invs) {
  let step = 0;
  return function check(pre, action, events, post) {
    step++;
    const out = [];
    const report = (inv, a, msg) => {
      const message = String(msg);
      out.push({ inv: inv.id, file: inv.file, uid: a ? a.uid : null, sp: a ? a.sp || null : null, step, action, message,
        text: `${inv.id}: ${message}${a ? ` (${a.uid}${a.sp ? ', ' + a.sp : ''})` : ''}, at step ${step}, action ${JSON.stringify(action)}` });
    };
    const run = (inv, a, ctx) => {
      let msg;
      try { msg = inv.check(pre, events, post, ctx); } catch (e) { msg = 'threw ' + (e && e.message || String(e)); }
      if (msg === null || msg === undefined) return;
      report(inv, a, typeof msg === 'string' && msg ? msg : `check returned ${JSON.stringify(msg)}; it must return null when the clause holds, or a message`);
    };
    for (const inv of invs) {
      if (!inv.applies) { run(inv, null, { uid: null, actor: null, before: null, action, step }); continue; }
      for (let i = 0; i < post.actors.length; i++) {
        const a = post.actors[i], b = i < pre.actors.length && pre.actors[i].uid === a.uid ? pre.actors[i] : pre.actors.find(x => x.uid === a.uid) || null;
        if (b && b.gone) continue;
        let yes;
        try { yes = inv.applies(a, post); } catch (e) { report(inv, a, 'applies threw ' + (e && e.message || String(e))); continue; }
        if (yes) run(inv, a, { uid: a.uid, actor: a, before: b, action, step });
      }
    }
    return out;
  };
}

module.exports = { DIR, load, select, checker };
