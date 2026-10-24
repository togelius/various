// ACCESSION — crash cards (BUILD.md §10.2). A failing run (a monkey, a soak, a golden run, a
// scenario) is replayed from its start, and its action list is shrunk with ddmin (Zeller and
// Hildebrandt, 2002) to a list that still fails and from which no single action can be
// removed, within a time limit (60 s). The card then gives the seed, coreHash, the shrunk
// action count, the first bad step with its events, what that step changed in the state as
// a list of JSON paths, and the replay, with the command that plays it again.
// Node only: it keeps the time, which the core may not (it calls the core through a context
// from tools/core-context.js or tools/replay.js's load()).
'use strict';

// ddmin(actions, fails, {ms}) → {actions, tests, ms, timedOut, minimal, from}
//   fails(list) → false (it passes), true (it fails), or the 1-based number of the action at
//   which it fails, which also drops every action after it (nothing after the failure can
//   matter). The full list must fail. The result fails; if minimal, removing any single
//   action makes it pass. On running out of time it is the smallest failing list found.
function ddmin(actions, fails, opts) {
  const ms = (opts && opts.ms) || 60000, t0 = Date.now();
  let tests = 0, timedOut = false;
  const test = list => {
    tests++;
    const r = fails(list);
    if (r === true) return list;
    if (Number.isInteger(r) && r >= 1) return list.slice(0, r);
    return null;
  };
  let cur = test(actions.slice());
  if (!cur) throw new Error('Shrink.ddmin: the full action list does not fail');
  let n = 2, minimal = false;
  for (;;) {
    if (cur.length === 0) { minimal = true; break; }
    if (cur.length === 1) { if (test([])) { cur = []; } minimal = true; break; }
    n = Math.min(n, cur.length);
    const size = Math.ceil(cur.length / n), chunks = [];
    for (let i = 0; i < cur.length; i += size) chunks.push([i, Math.min(cur.length, i + size)]);
    let next = null, nextN = n;
    for (const [lo, hi] of chunks) {
      if (Date.now() - t0 > ms) { timedOut = true; break; }
      const got = test(cur.slice(lo, hi));
      if (got) { next = got; nextN = 2; break; }
    }
    if (!next && !timedOut && chunks.length > 2) for (const [lo, hi] of chunks) {
      if (Date.now() - t0 > ms) { timedOut = true; break; }
      const got = test(cur.slice(0, lo).concat(cur.slice(hi)));
      if (got) { next = got; nextN = Math.max(chunks.length - 1, 2); break; }
    }
    if (timedOut) break;
    if (next) { cur = next; n = nextN; continue; }
    if (n >= cur.length) { minimal = true; break; }
    n = Math.min(cur.length, 2 * n);
  }
  return { actions: cur, tests, ms: Date.now() - t0, timedOut, minimal, from: actions.length };
}

// The paths at which two plain values differ, in key order: [{path, from, to}], with each
// value as short JSON ('absent' where one side has no such key). At most `limit` (40).
function diff(a, b, opts) {
  const limit = (opts && opts.limit) || 40, out = [];
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const show = v => { if (v === undefined) return 'absent'; const s = JSON.stringify(v); return s.length > 80 ? s.slice(0, 77) + '...' : s; };
  const walk = (x, y, p) => {
    if (out.length >= limit) return;
    if (isObj(x) && isObj(y)) {
      const keys = Array.from(new Set(Object.keys(x).concat(Object.keys(y)))).sort((s, t) => (s < t ? -1 : s > t ? 1 : 0));
      for (const k of keys) walk(x[k], y[k], /^[A-Za-z_$][\w$]*$/.test(k) ? `${p}.${k}` : `${p}[${JSON.stringify(k)}]`);
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      for (let i = 0; i < Math.max(x.length, y.length); i++) walk(x[i], y[i], `${p}[${i}]`);
      return;
    }
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ path: p, from: show(x), to: show(y) });
  };
  walk(a, b, (opts && opts.root) || 'state');
  return out;
}

// The default sameness of two failures: the same message up to its first colon (the
// invariant's id, or "threw Step"), so a shrink keeps the failure it started with.
const sameFailure = (f, g) => !!f && !!g && f.message.split(':')[0] === g.message.split(':')[0];

// shrinkReplay(C, replay, check, {ms, same}) → {replay, failure, result}: replays from the
// start with check after every step (Replay.play's check) and shrinks the actions to the
// smallest list whose failure is the same as the full list's.
function shrinkReplay(C, replay, check, opts) {
  opts = opts || {};
  const same = opts.same || sameFailure;
  const first = C.Replay.play(replay, { check }).failure;
  if (!first) throw new Error('Shrink: the replay does not fail');
  const run = actions => C.Replay.play(Object.assign({}, replay, { actions }), { check }).failure;
  const result = ddmin(replay.actions, list => { const f = run(list); return f && same(f, first) ? f.step : false; }, { ms: opts.ms });
  result.firstStep = first.step;
  const shrunk = Object.assign({}, replay, { actions: result.actions });
  return { replay: shrunk, failure: run(result.actions), first, result };
}

// card(replay, failure, {from, firstStep, tests, ms, timedOut}) → the crash card: its fields,
// and its text in words. failure is Replay.play's ({step, action, events, message, pre,
// post}); the rest is ddmin's result (shrinkReplay adds firstStep, where the full list
// first failed), when the replay was shrunk.
function card(replay, failure, info) {
  info = info || {};
  const start = replay.start || {};
  const changes = failure.pre && failure.post ? diff(failure.pre, failure.post) : [];
  const shrunk = info.from !== undefined && info.from !== replay.actions.length;
  const lines = [
    `Crash card: ${failure.message}`,
    `Seed ${start.seed !== undefined ? start.seed : 'from a snapshot'}, start ${JSON.stringify(start.state ? { state: 'snapshot' } : start)}, coreHash ${replay.coreHash || 'not recorded'}, layout pin ${replay.layoutPin === null || replay.layoutPin === undefined ? 'none' : replay.layoutPin}.`,
    shrunk ? `Shrunk to ${replay.actions.length} actions from ${info.from}${info.firstStep ? ` (the full list first failed at action ${info.firstStep})` : ''}, in ${info.tests} replays and ${info.ms} ms${info.timedOut ? ', stopped by the time limit' : ''}.`
      : `${replay.actions.length} actions (not shrunk).`,
    `The first bad step is step ${failure.step}: ${JSON.stringify(failure.action)}.`,
    failure.events.length ? `Its events (${failure.events.length}):` : 'It made no events.',
  ];
  for (const e of failure.events) lines.push('  ' + JSON.stringify(e));
  lines.push(changes.length ? `What it changed in the state (${changes.length}${changes.length >= 40 ? ' or more' : ''}):` : 'It changed nothing in the state that can be compared.');
  for (const c of changes) lines.push(`  ${c.path}: ${c.from} → ${c.to}`);
  lines.push('Replay (save it as a file and play it with: node tools/replay.js <file> --log):');
  lines.push(JSON.stringify(replay));
  lines.push('Replay link: pending M5.');
  return { seed: start.seed !== undefined ? start.seed : null, coreHash: replay.coreHash || null, layoutPin: replay.layoutPin === undefined ? null : replay.layoutPin,
    actions: replay.actions.length, from: info.from === undefined ? replay.actions.length : info.from, firstStep: info.firstStep || null, step: failure.step, action: failure.action,
    message: failure.message, events: failure.events, changes, replay, command: 'node tools/replay.js <file> --log', link: 'pending M5', text: lines.join('\n') };
}

module.exports = { ddmin, diff, card, shrinkReplay, sameFailure };
