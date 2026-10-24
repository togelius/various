// ACCESSION — replays (BUILD.md §3.6) and the player of the golden runs (§3.5). A replay is
// {coreHash, layoutPin, start, options, actions}: where the visit starts, its switches, and
// every action you took. A golden run is a monkey run or a replay with its expected hashes.
// This file is a classic script with no state of its own: the hash page, and Node through
// tools/core-context.js, load it beside the core and tools/monkey.js. It obeys the core's
// rules (integers only, no clock), since it runs inside the hardened context. Node can also
// require it, for `node tools/replay.js` and the helpers at the end of this file.
'use strict';
const Replay = (() => {
  // Checkpoints: a replay records the state's hash after every EVERY-th action; the monkey
  // folds one in after every 1,000th (tools/monkey.js).
  const EVERY = 100, MONKEY_EVERY = 1000;
  const KINDS = ['monkey', 'replay'];
  const STOP = { stop: 'Replay' };
  const starters = [];

  const plain = v => JSON.parse(State.canon(v));
  // A visit's options (Options.make); a core from before M3 has no Options, and a monkey or
  // replay on it (tools/golden.js --against) passes them on as they are.
  const options = o => typeof Options === 'object' ? Options.make(o) : (o || { rulesOff: [], without: [], invulnerable: false });
  // An action or event as one line of JSON, the same in every engine: its kind first, then
  // its other fields in key order (State.canon).
  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function json(v) {
    if (v === undefined) return 'nothing';
    try {
      if (!isObject(v) || !Object.prototype.hasOwnProperty.call(v, 'k')) return State.canon(v);
      const rest = {};
      for (const key of Object.keys(v)) if (key !== 'k') rest[key] = v[key];
      const body = State.canon(rest);
      return '{"k":' + State.canon(v.k) + (body === '{}' ? '}' : ',' + body.slice(1));
    } catch (e) { return JSON.stringify(v); }
  }
  const said = e => String((e && e.message) || e);

  // Another kind of start, for a tool that builds its own rooms: a start with the field
  // `key` set is made by fn(start, options) → state (an arena's, say).
  function starter(key, fn) {
    if (typeof key !== 'string' || typeof fn !== 'function') throw new Error('Replay.starter: needs a field name and a function');
    for (const s of starters) if (s.key === key) throw new Error(`Replay.starter: ${key} is registered twice`);
    starters.push({ key, fn });
  }

  // The state a replay starts from. start is one of:
  //   {seed, room: 'T0'}       the M0 test room (content/testroom.js);
  //   {seed, dept, depth}      a department visit (Dept.create);
  //   {state}                  a snapshot where logging restarted, which keeps its own options;
  //   a start with a field a tool registered with Replay.starter.
  // A run's seed alone (§3.6) needs the run, which M5 builds.
  function begin(start, o) {
    if (!start || typeof start !== 'object') throw new Error('Replay: a start is {seed, room}, {seed, dept, depth} or {state}, not ' + json(start));
    if (start.state) return State.clone(start.state);
    if (!Number.isSafeInteger(start.seed)) throw new Error('Replay: the start ' + json(start) + ' has no whole-number seed');
    const opts = options(o);
    if (start.room === 'T0') return Setup.room(start.seed, TestRoom.spec, opts);
    if (typeof start.dept === 'string') {
      if (!Number.isSafeInteger(start.depth)) throw new Error('Replay: the department start ' + json(start) + ' has no depth');
      return Dept.create(start.seed, start.dept, start.depth, opts);
    }
    for (const s of starters) if (start[s.key] !== undefined && start[s.key] !== null) return s.fn(start, opts);
    throw new Error('Replay: no way to make the start ' + json(start) + ' (a whole run starts with M5)');
  }

  // A replay (§3.6) of `actions` from `start` with `options`. coreHash is the build's, when
  // the caller knows it (tools/core-hash.js in Node; the build's stamp on a page).
  function make(start, o, actions, coreHash) {
    if (!Array.isArray(actions)) throw new Error('Replay.make: actions must be a list');
    const s = begin(start, o);
    return { coreHash: coreHash || null, layoutPin: s.dept && Number.isSafeInteger(s.dept.pin) ? s.dept.pin : null,
      start: plain(start), options: start.state ? plain(s.options) : options(o), actions: actions.map(plain) };
  }

  // Plays a replay. Returns {hash, checkpoints, steps, startHash, state, played, refused,
  // failure, diverged, log}: the final state's hash, its hash after every EVERY-th action,
  // and the final state. opts:
  //   steps      keep the hash after every action (steps, a list of u32);
  //   clone      replace the state with State.clone after every action (clone stability);
  //   check      (pre, action, events, post, i) → null | message | [violation]: checked after
  //              every action; the first failure stops the replay. A step that throws is a
  //              failure too. failure = {step, action, events, message, pre, post};
  //   log        true: log = [{i, action, events}]; or a function (i, action, events, state);
  //   against    per-step hashes to compare with: the replay stops at the first action whose
  //              hash differs, and diverged = {step, action, events, got, want};
  //   at         stop after action `at`, with diverged = {step, action, events, got, want: null};
  //   upTo       play only the first upTo actions.
  function play(r, opts) {
    opts = opts || {};
    let state = begin(r.start, r.options);
    const n = Number.isSafeInteger(opts.upTo) ? Math.min(opts.upTo, r.actions.length) : r.actions.length;
    const want = opts.against || null, keep = !!(opts.steps || want);
    const steps = keep ? [] : null, checkpoints = [], log = opts.log === true ? [] : null;
    const startHash = State.hash(state);
    let refused = 0, failure = null, diverged = null, played = 0;
    for (let i = 1; i <= n; i++) {
      const action = r.actions[i - 1];
      const pre = opts.check ? State.clone(state) : null;
      let ev;
      try { ev = Step.step(state, action); }
      catch (e) {
        let post = null;
        try { post = State.clone(state); } catch (e2) { post = null; }
        failure = { step: i, action: plain(action), events: [], message: 'threw ' + said(e), pre, post };
        break;
      }
      played = i;
      if (ev.length === 1 && ev[0].k === 'refused') refused++;
      if (log) log.push({ i, action, events: ev });
      else if (typeof opts.log === 'function') opts.log(i, action, ev, state);
      if (opts.clone) state = State.clone(state);
      if (opts.check) {
        const m = opts.check(pre, action, ev, state, i);
        const message = Array.isArray(m) ? m.map(v => (v && v.text) || json(v)).join('; ') : m;
        if (message) { failure = { step: i, action: plain(action), events: ev, message: String(message), pre, post: State.clone(state) }; break; }
      }
      const h = keep || i % EVERY === 0 || opts.at === i ? State.hash(state) : 0;
      if (steps) steps.push(h);
      if (i % EVERY === 0) checkpoints.push(h);
      if (want && h !== want[i - 1]) { diverged = { step: i, action: plain(action), events: ev, got: h, want: want.length >= i ? want[i - 1] : null }; break; }
      if (opts.at === i) { diverged = { step: i, action: plain(action), events: ev, got: h, want: null }; break; }
    }
    return { hash: State.hash(state), checkpoints, steps, startHash, state, played, refused, failure, diverged, log };
  }

  // fn() with every Step.step call also reported to spy(state, action, events); Step.step
  // is restored afterwards, whatever happens. This is how the monkey's actions are seen.
  function spying(spy, fn) {
    const real = Step.step;
    Step.step = (state, action) => { const ev = real(state, action); spy(state, action, ev); return ev; };
    try { return fn(); } finally { Step.step = real; }
  }

  const kindOf = g => g.kind || 'monkey';
  const count = g => kindOf(g) === 'replay' ? g.actions.length : g.actions;
  const every = g => kindOf(g) === 'replay' ? EVERY : MONKEY_EVERY;
  // A monkey run's rooms: the test room, or a department at a depth.
  const maker = g => g.make ? (seed => Dept.create(seed, g.make.dept, g.make.depth)) : (seed => TestRoom.create(seed));
  // The state a golden run starts from.
  const startOf = g => kindOf(g) === 'replay' ? begin(g.start, g.options) : maker(g)(g.seed);

  // A monkey run (tools/monkey.js) with the same options as play's steps, clone, against and at.
  function monkey(g, opts) {
    const want = opts.against || null, keep = !!(opts.steps || want), traced = !!(want || opts.at);
    const steps = keep ? [] : null;
    let last = null, diverged = null, r = null;
    const check = keep || opts.at ? (state, i) => {
      const h = keep || opts.at === i ? State.hash(state) : 0;
      if (steps) steps.push(h);
      if (want && h !== want[i - 1]) { diverged = { step: i, action: plain(last.action), events: last.events, got: h, want: want.length >= i ? want[i - 1] : null }; throw STOP; }
      if (opts.at === i) { diverged = { step: i, action: plain(last.action), events: last.events, got: h, want: null }; throw STOP; }
    } : undefined;
    const go = () => Monkey.run(g.seed, g.actions, { make: maker(g), cloneEachStep: !!opts.clone, check });
    try { r = traced ? spying((s, action, events) => { last = { action, events }; }, go) : go(); }
    catch (e) { if (e !== STOP) throw e; }
    return r ? { hash: r.hash, checkpoints: Array.from(r.checkpoints), visits: r.visits, steps, diverged }
      : { hash: null, checkpoints: [], visits: null, steps, diverged };
  }

  // One golden run (§3.5), of either kind, played once. Returns {hash, checkpoints, visits?,
  // steps, diverged}, with play's options steps, clone, against and at.
  function golden(g, opts) {
    opts = opts || {};
    const k = kindOf(g);
    if (!KINDS.includes(k)) throw new Error('Replay: no golden kind ' + k);
    if (k === 'monkey') return monkey(g, opts);
    const p = play(g, { steps: opts.steps, clone: opts.clone, against: opts.against, at: opts.at });
    if (p.failure) throw new Error(p.failure.message + ' at action ' + p.failure.step);
    return { hash: p.hash, checkpoints: p.checkpoints, steps: p.steps, diverged: p.diverged };
  }

  // A visit of a monkey run as a replay entry, so that a failure in it can be replayed from
  // its own seed and shrunk (tools/shrink.js). The monkey starts a new visit, on the next
  // seed, when one ends (you die, or the room is cleared). record(g, n): the first visit, at
  // most n actions of it. visit(g, step): the visit that holds the run's action number step,
  // with its actions up to and including that one; index is that action's place in it.
  const startFor = (g, seed) => g.make ? { seed, dept: g.make.dept, depth: g.make.depth } : { seed, room: 'T0' };
  function visits(g, stopAt) {
    let actions = [], visit = 0, ended = false;
    const over = state => state.over || state.actors.every(a => a.gone || a.uid === 'you');
    const check = (state, i) => {
      if (stopAt(i, actions.length, over(state))) throw STOP;
      if (over(state)) { visit++; actions = []; }
    };
    const go = () => Monkey.run(g.seed, g.actions, { make: maker(g), check });
    try { spying((s, action) => { actions.push(plain(action)); }, go); ended = true; }
    catch (e) { if (e !== STOP) throw e; }
    return { kind: 'replay', start: startFor(g, g.seed + visit), options: options(), actions, ended };
  }
  function record(g, n) {
    const r = visits(Object.assign({}, g, { actions: Math.max(g.actions || 0, n) }), (i, k, over) => k >= n || over);
    return { kind: r.kind, start: r.start, options: r.options, actions: r.actions };
  }
  function visit(g, step) {
    if (!Number.isSafeInteger(step) || step < 1 || step > g.actions) throw new Error(`Replay.visit: no action ${step} in a run of ${g.actions}`);
    const r = visits(g, i => i === step);
    return { replay: { kind: r.kind, start: r.start, options: r.options, actions: r.actions }, index: r.actions.length };
  }

  // Per-step hashes as text: 4 bytes a step, most significant first, in base64.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function encode(hashes) {
    const bytes = [];
    for (const h of hashes) bytes.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255);
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      s += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
      s += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
      s += i + 2 < bytes.length ? B64[b2 & 63] : '=';
    }
    return s;
  }
  function decode(s) {
    if (typeof s !== 'string' || s.length % 4) throw new Error('Replay.decode: not base64 of whole steps');
    const bytes = [];
    for (let i = 0; i < s.length; i += 4) {
      const c = [0, 1, 2, 3].map(j => s[i + j] === '=' ? 0 : B64.indexOf(s[i + j]));
      if (c.some(x => x < 0)) throw new Error('Replay.decode: not base64');
      bytes.push((c[0] << 2) | (c[1] >> 4));
      if (s[i + 2] !== '=') bytes.push(((c[1] & 15) << 4) | (c[2] >> 2));
      if (s[i + 3] !== '=') bytes.push(((c[2] & 3) << 6) | c[3]);
    }
    if (bytes.length % 4) throw new Error('Replay.decode: not base64 of whole steps');
    const out = [];
    for (let i = 0; i < bytes.length; i += 4) out.push(((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0);
    return out;
  }

  // The first index at which two lists of hashes differ, or -1.
  function firstDiff(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
    return -1;
  }

  // The words for a diverging step, the same in Node and on the hash page (§3.5).
  function describe(name, d, n, wantWord) {
    const lines = [`${name}: the first diverging step is step ${d.step} of ${n}.`,
      `Its action: ${json(d.action)}.`,
      `The state's hash after it: ${d.got}` + (d.want === null || d.want === undefined ? '.' : `, where ${wantWord || 'the pin'} has ${d.want}.`),
      d.events.length ? `Its events (${d.events.length}):` : 'It made no events.'];
    for (const e of d.events) lines.push('  ' + json(e));
    return lines.join('\n');
  }

  // A golden run against its pin, as the golden test, tools/golden.js --check and the hash
  // page check it. Returns {kind, actions, hash, checkpoints, visits, pending, ok, text,
  // diverged}: ok is null for a pending run; text says what differs, with the first
  // diverging step, its action and its events when the pin keeps per-step hashes.
  function verify(name, g, opts) {
    opts = opts || {};
    const r = golden(g, { clone: !!opts.clone });
    const out = { kind: kindOf(g), actions: count(g), hash: r.hash, checkpoints: r.checkpoints, visits: r.visits === undefined ? null : r.visits,
      pending: !!g.pending, ok: null, text: '', diverged: null };
    if (g.pending) return out;
    const pins = g.checkpoints || [];
    const first = firstDiff(r.checkpoints, pins);
    out.ok = r.hash === g.hash && first < 0;
    if (out.ok) return out;
    let text = `${name}: hash ${r.hash}, where the pin has ${g.hash}` +
      (first >= 0 ? `; the first checkpoint that differs is checkpoint ${first + 1} (action ${(first + 1) * every(g)})` : '; every checkpoint agrees') + '.';
    if (typeof g.steps === 'string' && g.steps) {
      const want = decode(g.steps);
      if (want.length !== count(g)) text += `\nThe pin keeps ${want.length} per-step hashes for ${count(g)} actions, so it cannot say which step differs.`;
      else {
        const d = golden(g, { against: want }).diverged;
        if (d) { out.diverged = d; text += '\n' + describe(name, d, count(g)); }
      }
    } else text += '\nThe pin keeps no per-step hashes (they are stored at a re-pin), so only the checkpoint is known.';
    out.text = text;
    return out;
  }

  return { EVERY, MONKEY_EVERY, KINDS, starter, begin, make, play, golden, verify, record, visit, startOf, kindOf, count, every,
    encode, decode, firstDiff, describe, spying, json };
})();

// Node: require('./replay.js') gives the helpers below, and `node tools/replay.js` plays a
// replay file. (In the hardened context and on the page, `module` does not exist.)
if (typeof module === 'object' && module && module.exports && typeof require === 'function') {
  module.exports = (() => {
    const fs = require('node:fs'), path = require('node:path');
    // A core with the monkey and this file loaded, through tools/core-context.js.
    const load = extra => require('./core-context.js').loadCore(['tools/monkey.js', 'tools/replay.js'].concat(extra || []));
    // A replay from a file: the replay itself, or a crash card holding one.
    const read = file => { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return v && v.replay ? v.replay : v; };
    // tools/invariants.js's checker as play's check: the invariants given (every one in
    // test/behaviour/*.inv.js if none are), after every step, counting steps from each
    // replay's first, so that one check can serve every replay of a shrink.
    const invariants = (C, invs) => {
      const Inv = require('./invariants.js'), list = invs || Inv.load(C);
      let c = null;
      return (pre, action, events, post, i) => { if (i === 1 || !c) c = Inv.checker(C, list); return c(pre, action, events, post); };
    };

    const USAGE = `Usage: node tools/replay.js <replay.json> [--log] [--inv]
  Plays a replay ({coreHash, layoutPin, start, options, actions}, or a crash card holding
  one) through this tree's core, and prints its final hash, its refusals and any failure.
  --log  prints each step's action and the log's sentences
  --inv  checks every invariant of test/behaviour/*.inv.js after every step`;

    function cli(argv) {
      const file = argv.find(a => !a.startsWith('--'));
      if (!file || argv.includes('--help')) { console.log(USAGE); return file ? 0 : 2; }
      const C = load(), r = read(path.resolve(file));
      const here = require('./core-hash.js').coreHash();
      const opts = {};
      if (argv.includes('--inv')) opts.check = invariants(C);
      if (argv.includes('--log')) opts.log = (i, action, ev, state) => {
        const nameOf = C.Labels.nameOf(state);
        console.log(`step ${i}: ${JSON.stringify(action)}`);
        for (const line of C.Text.log(ev, nameOf, () => true)) console.log('  ' + line);
      };
      console.log(`replay: ${r.actions.length} actions from ${JSON.stringify(r.start)}; coreHash ${r.coreHash || 'not recorded'}, this tree ${here}` +
        (r.coreHash && r.coreHash !== here ? ' (a different core: the replay may not play the same)' : ''));
      const p = C.Replay.play(r, opts);
      console.log(`played ${p.played} actions, ${p.refused} refused; final hash ${p.hash}${p.state.over ? `; the visit ended (${p.state.over.k}) at turn ${p.state.over.turn}` : ''}`);
      if (p.failure) { console.log(`failure at action ${p.failure.step} (${JSON.stringify(p.failure.action)}): ${p.failure.message}`); return 1; }
      return 0;
    }

    if (require.main === module) process.exit(cli(process.argv.slice(2)));
    return { load, read, invariants, cli, USAGE };
  })();
}
