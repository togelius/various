#!/usr/bin/env node
// ACCESSION — the golden runs of test/golden/golden.js (BUILD.md §3.5). Re-pin only when a
// rule changed on purpose, and say why in DEVELOPMENT.md's validation log.
// A golden run is one of two kinds, each with its pin (hash, checkpoints and, from a re-pin,
// the hash after every step) and, while a stretch of work changes the state on purpose, a
// pending reason:
//   {kind: 'monkey', seed, actions: <count>, make: null | {dept, depth}}   the monkey
//       (tools/monkey.js) for that many actions, in the test room or a department
//   {kind: 'replay', start, options, actions: [action…]}                     a replay (§3.6;
//       start as tools/replay.js's Replay.begin takes it)
// Usage: USAGE below, which `node tools/golden.js --help` prints. Only the bare command
// re-pins; --help, an option or word it does not know, and two modes at once write nothing.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'test/golden/golden.js');
const { readGolden } = require('./hash-compare.js');
const Shrink = require('./shrink.js');

// What --help prints.
const USAGE = `Usage:
  node tools/golden.js                        re-pin every run: its hash, checkpoints and
                                              per-step hashes; this ends any pending stretch,
                                              and prints old → new with the first step that
                                              changed, where the old pin kept its steps
  node tools/golden.js --pending "reason"     keep the pins and mark every run pending
  node tools/golden.js --check                compare the runs with the file and write
                                              nothing; a pinned run that differs fails, with
                                              its first diverging step, action and events
  node tools/golden.js --add <name> <file.json> [--pending "reason"]
                                              add a run from its definition (a JSON file: a
                                              golden entry, a replay as tools write it, or a
                                              crash card holding one), pinned now, or
                                              unpinned and pending
  node tools/golden.js --against <commit> [name…]
                                              play each run (or the named ones) on this tree
                                              and on <commit>'s core, taken from git into a
                                              temporary directory, and print the first step
                                              at which they differ, with each side's action
                                              and events
  node tools/golden.js --help                 print this, writing nothing
  --golden <file> reads and writes another golden file; --root <dir> takes this tree and
  git from another checkout (tests use both). An option or word not listed here, or two of
  --add, --against, --pending and --check at once, is refused, and nothing is written.`;

// The run a fresh file starts with.
const DEFAULTS = { m0Monkey: { kind: 'monkey', seed: 20261023, actions: 10000, make: null } };
const DEFINES = { monkey: ['kind', 'seed', 'actions', 'make'], replay: ['kind', 'start', 'options', 'actions'] };
const PINS = { monkey: ['hash', 'checkpoints', 'visits', 'steps'], replay: ['hash', 'checkpoints', 'steps'] };

// A run's definition alone (no pin, no pending), checked. An entry with no kind is a replay
// when it has a start or a list of actions (a replay as §3.6 writes it, {coreHash, layoutPin,
// start, options, actions}, whose coreHash and layoutPin a golden run does not keep), and a
// monkey otherwise.
const kindOf = g => g.kind || (g.start !== undefined || Array.isArray(g.actions) ? 'replay' : 'monkey');
function definition(name, g) {
  if (!g || typeof g !== 'object') throw new Error(`golden: ${name} is not a run's definition`);
  const kind = kindOf(g);
  if (!DEFINES[kind]) throw new Error(`golden: ${name} has no kind ${kind} (monkey or replay)`);
  const d = { kind };
  if (kind === 'monkey') {
    if (!Number.isSafeInteger(g.seed) || !Number.isSafeInteger(g.actions) || g.actions < 1) throw new Error(`golden: the monkey ${name} needs a whole-number seed and a count of actions`);
    const mk = g.make || null;
    if (mk && (typeof mk.dept !== 'string' || !Number.isSafeInteger(mk.depth))) throw new Error(`golden: the monkey ${name} makes {dept, depth}, not ${JSON.stringify(mk)}`);
    Object.assign(d, { seed: g.seed, actions: g.actions, make: mk ? { dept: mk.dept, depth: mk.depth } : null });
  } else {
    if (!g.start || typeof g.start !== 'object' || !Array.isArray(g.actions)) throw new Error(`golden: the replay ${name} needs a start and a list of actions`);
    Object.assign(d, { start: g.start, options: g.options || { rulesOff: [], without: [], invulnerable: false }, actions: g.actions });
  }
  return d;
}

// The file's text: one field a line, and a replay's actions one a line.
function format(golden) {
  const field = (k, v, kind) => k === 'actions' && kind === 'replay'
    ? `  "actions": [${v.length ? '\n   ' + v.map(a => JSON.stringify(a)).join(',\n   ') + '\n  ' : ''}]`
    : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  const entry = (name, g) => {
    const kind = kindOf(g), keys = DEFINES[kind].concat(PINS[kind], ['pending']);
    return ` ${JSON.stringify(name)}: {\n` + keys.filter(k => g[k] !== undefined).map(k => field(k, g[k], kind)).join(',\n') + '\n }';
  };
  return "// ACCESSION — golden runs: expected hashes for fixed seeds and action lists (BUILD.md §3.5).\n" +
    "// Regenerate only on purpose (node tools/golden.js), and log why in DEVELOPMENT.md.\n" +
    "// Each run is a monkey ({kind: 'monkey', seed, actions: count, make}) or a replay ({kind:\n" +
    "// 'replay', start, options, actions: list}), with its pin: the final hash, the checkpoints and,\n" +
    "// from a re-pin, steps (the hash after every action, 4 bytes each, base64); pending, while set,\n" +
    "// says why the run is not held to its pin.\n" +
    "'use strict';\nconst GOLDEN = {\n" + Object.keys(golden).map(n => entry(n, golden[n])).join(',\n') + '\n};\n';
}

// An entry as the file keeps it: its definition, its pin (null where it has none yet: a
// new run, or per-step hashes before a re-pin), and pending if set.
function normalize(name, g) {
  const d = definition(name, g), out = Object.assign({}, d, { hash: g.hash === undefined ? null : g.hash, checkpoints: g.checkpoints || [] });
  if (d.kind === 'monkey') out.visits = g.visits === undefined ? null : g.visits;
  out.steps = typeof g.steps === 'string' && g.steps ? g.steps : null;
  if (g.pending) out.pending = g.pending;
  return out;
}
const read = file => fs.existsSync(file) ? readGolden(file) : {};
const write = (file, golden) => { const out = {}; for (const n of Object.keys(golden)) out[n] = normalize(n, golden[n]); fs.writeFileSync(file, format(out)); };
// A core with the monkey and the replay player, from the checkout at root.
const treeCore = root => require(path.join(root, 'tools/core-context.js')).loadCore(['tools/monkey.js', 'tools/replay.js']);

// A run pinned on core C: its definition with its hash, checkpoints and per-step hashes.
function pin(C, name, g) {
  const d = definition(name, g), r = C.Replay.golden(d, { steps: true });
  const out = Object.assign({}, d, { hash: r.hash, checkpoints: r.checkpoints });
  if (d.kind === 'monkey') out.visits = r.visits;
  out.steps = C.Replay.encode(r.steps);
  return out;
}

// node tools/golden.js: every run re-pinned. Returns the log lines.
function repin(C, file) {
  const old = read(file), names = Object.keys(old).length ? Object.keys(old) : Object.keys(DEFAULTS);
  const out = {}, lines = [];
  for (const name of names) {
    const o = old[name] || DEFAULTS[name], n = pin(C, name, o);
    let since = '';
    if (old[name] && typeof o.steps === 'string' && o.steps) {
      const at = C.Replay.firstDiff(C.Replay.decode(o.steps), C.Replay.decode(n.steps));
      since = at < 0 ? '; no step differs from the old pin' : `; first divergence from the old pin at step ${at + 1}`;
    } else if (old[name]) since = '; the old pin kept no per-step hashes (node tools/golden.js --against <commit> finds the first step that differs)';
    lines.push(`golden: ${name} ${old[name] && old[name].hash !== null ? old[name].hash : 'new'} → ${n.hash}${o.pending ? ' (was pending: ' + o.pending + ')' : ''}${since}`);
    out[name] = n;
  }
  write(file, out);
  return lines;
}

// --pending: every run marked pending, its pin kept.
function markPending(file, reason) {
  const old = read(file), lines = [];
  for (const name of Object.keys(old)) { old[name].pending = reason; lines.push(`golden: ${name} pending (pin ${old[name].hash} kept): ${reason}`); }
  write(file, old);
  return lines;
}

// --check: every run against its pin, writing nothing. Returns {bad, lines}.
function check(C, file) {
  const golden = read(file), lines = [];
  let bad = 0;
  for (const name of Object.keys(golden)) {
    const g = golden[name], v = C.Replay.verify(name, g);
    if (g.pending) lines.push(`golden: ${name} is pending (${g.pending}): hash ${v.hash}, pin ${g.hash === null ? 'none' : g.hash}${v.hash === g.hash ? ', unchanged' : ''}`);
    else if (!v.ok) { bad++; lines.push(`golden: ${name} differs from ${path.relative(ROOT, file)}:\n` + v.text.split('\n').map(l => '  ' + l).join('\n')); }
  }
  const open = Object.keys(golden).filter(n => golden[n].pending).length;
  if (!bad) lines.push('golden: every pinned run matches its pin' + (open ? ` (${open} pending)` : ''));
  return { bad, lines };
}

// --add: a new run from its definition, pinned on C, or unpinned and pending. def may also be
// a crash card (tools/shrink.js), whose replay is taken.
function add(C, file, name, def, reason) {
  const golden = read(file);
  if (golden[name]) throw new Error(`golden: ${name} is already a golden run`);
  const d = definition(name, def && def.replay && typeof def.replay === 'object' ? def.replay : def);
  golden[name] = reason ? Object.assign({}, d, { pending: reason }) : pin(C, name, d);
  write(file, golden);
  const g = golden[name];
  return `golden: ${name} added (${d.kind}, ${C.Replay.count(d)} actions)` + (reason ? `, unpinned and pending: ${reason}` : `, pinned at ${g.hash}`);
}

// The golden test's check of one run on core C (test/golden.test.js; §3.5): it is played
// twice, then once with the state cloned after every step, and the three must agree.
// Returns {run, problem}: run is the first play's result; problem is null, or what went
// wrong in words. When a play threw, or the second play or the cloned one differs, the
// problem also holds the crash card (§10.2) of the visit it happened in, replayed from that
// visit's seed and shrunk within opts.ms (60 s), when the replay fails the same way.
function selfCheck(C, name, g, opts) {
  opts = opts || {};
  const R = C.Replay, kind = R.kindOf(g), n = R.count(g);
  const plays = [{ what: 'two runs of the same seed and actions differ', o: {} },
    { what: 'a cloned state does not behave exactly like the original', o: { clone: true } }];
  let run;
  try { run = R.golden(g); } catch (e) { return { run: null, problem: crashed(C, name, g, false, e, opts) }; }
  for (const { what, o } of plays) {
    let b;
    try { b = R.golden(g, o); } catch (e) { return { run, problem: crashed(C, name, g, !!o.clone, e, opts) }; }
    if (b.hash === run.hash && R.firstDiff(b.checkpoints, run.checkpoints) < 0) continue;
    // Where they first differ: both played again with every step's hash.
    const a = R.golden(g, { steps: true }), d = R.golden(g, Object.assign({ against: a.steps }, o)).diverged;
    let text = `${name}: ${what}` + (d ? '\n' + R.describe(name, d, n, 'the first play') : ', though no step\'s hash differs');
    if (d) text += cardText(C, kind === 'replay' ? { replay: entryOf(g, d.step), index: d.step } : R.visit(g, d.step), Shrink.twin(C, o), opts);
    return { run, problem: text };
  }
  return { run, problem: null };
}
const entryOf = (g, k) => ({ kind: 'replay', start: g.start, options: g.options, actions: g.actions.slice(0, k) });
// A run that threw: where, and its crash card.
function crashed(C, name, g, clone, e, opts) {
  const f = C.Replay.failing(g, clone), how = clone ? ', cloned after every step,' : '';
  if (!f) return `${name}: the ${C.Replay.kindOf(g)}${how} threw ${(e && e.message) || e}, but not when played again to find where`;
  return `${name}: the ${C.Replay.kindOf(g)}${how} threw at action ${f.step} of ${C.Replay.count(g)}: ${f.message}` +
    cardText(C, f, (r, lean) => C.Replay.play(r, { clone, lean }).failure, opts);
}
// The crash card of a visit replay ({replay, index}) that fails as fails(replay, lean) finds,
// as text to append to a problem; or why there is none.
function cardText(C, v, fails, opts) {
  const seed = v.replay.start.seed;
  const where = `action ${v.index} of ` + (Number.isSafeInteger(seed) ? `the visit with seed ${seed}` : 'the replay');
  try {
    const replay = C.Replay.make(v.replay.start, v.replay.options, v.replay.actions, require('./core-hash.js').coreHash());
    const s = Shrink.shrinkReplay(C, replay, null, { ms: opts.ms, fails });
    return `\nIt happens at ${where}. Replayed from that seed and shrunk:\n` + Shrink.card(s.replay, s.failure, s.result).text;
  } catch (e) {
    return `\nIt happens at ${where}, but a replay of that visit does not fail the same way, so there is no crash card (${(e && e.message) || e}).`;
  }
}

// The core at a commit: index.html, js/core and content/ as git has them there, run with this
// tree's core context, monkey and replay player, in a temporary directory.
function commitCore(root, commit) {
  const git = (args, enc) => cp.execFileSync('git', ['-C', root].concat(args), { encoding: enc === undefined ? 'utf8' : enc, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  let sha;
  try { sha = git(['rev-parse', '--verify', '--quiet', commit + '^{commit}']).trim(); }
  catch (e) { throw new Error(`golden: ${commit} is not a commit here`); }
  const files = git(['ls-tree', '-r', '--name-only', sha, '--', 'index.html', 'js/core', 'content']).split('\n').filter(Boolean);
  if (!files.includes('index.html')) throw new Error(`golden: ${commit} has no index.html beside tools/ (is it from before the game?)`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-against-'));
  try {
    for (const f of files) {
      const dest = path.join(tmp, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, git(['show', `${sha}:./${f}`], null));
    }
    fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
    for (const f of ['core-context.js', 'monkey.js', 'replay.js']) fs.copyFileSync(path.join(__dirname, f), path.join(tmp, 'tools', f));
    return { C: treeCore(tmp), sha };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// --against: for each run, the first step at which this tree and the commit's core differ.
// Returns [{name, step: null | n, text}].
function against(commit, opts) {
  opts = opts || {};
  const root = opts.root || ROOT, golden = opts.golden || read(opts.file || FILE);
  const names = opts.names && opts.names.length ? opts.names : Object.keys(golden);
  const here = opts.here || treeCore(root), { C: there, sha } = commitCore(root, commit);
  const label = sha.startsWith(commit) ? sha.slice(0, 7) : `${commit} (${sha.slice(0, 7)})`, out = [];
  for (const name of names) {
    if (!golden[name]) throw new Error(`golden: no run ${name}`);
    const d = definition(name, golden[name]), n = here.Replay.count(d);
    let a, b, startThere;
    try { startThere = there.Replay.startOf(d); b = there.Replay.golden(d, { steps: true }); }
    catch (e) { out.push({ name, step: null, text: `${name}: the core at ${label} cannot play it: ${(e && e.message) || e}` }); continue; }
    const startHere = here.Replay.startOf(d);
    a = here.Replay.golden(d, { steps: true });
    const i = here.Replay.firstDiff(a.steps, b.steps);
    if (i < 0) { out.push({ name, step: null, text: `${name}: no step differs in ${n} actions between this tree and ${label}; both end with hash ${a.hash}.` }); continue; }
    const da = here.Replay.golden(d, { at: i + 1 }).diverged, db = there.Replay.golden(d, { at: i + 1 }).diverged;
    const side = (who, dv) => [`${who}: action ${here.Replay.json(dv.action)}, then hash ${dv.got}; its events (${dv.events.length}):`].concat(dv.events.map(e => '  ' + here.Replay.json(e)));
    const lines = [`${name}: the first diverging step is step ${i + 1} of ${n}, between this tree and ${label}.`];
    const ha = here.State.hash(startHere), hb = there.State.hash(startThere);
    if (i === 0 && ha !== hb) {
      const changes = Shrink.diff(JSON.parse(there.State.canon(startThere)), JSON.parse(here.State.canon(startHere)), { limit: 12 });
      lines.push(`The starting states already differ (hash ${hb} at ${label}, ${ha} here), first at:`);
      for (const c of changes) lines.push(`  ${c.path}: ${c.from} → ${c.to}`);
    }
    out.push({ name, step: i + 1, text: lines.concat(side('This tree', da), side(label, db)).join('\n') });
  }
  return out;
}

// The command line, read: {mode: 'help' | 'repin' | 'pending' | 'check' | 'add' | 'against',
// root, file, reason, commit, name, def, names}. Anything it does not know is refused by a
// throw, before any run is played or any file is written, so that only the bare command
// re-pins.
function parseArgs(args) {
  const argv = args.slice();
  const refuse = m => { const e = new Error(`golden: ${m}; nothing was written (node tools/golden.js --help lists the usage)`); e.refused = true; throw e; };
  if (argv.includes('--help') || argv.includes('-h')) return { mode: 'help' };
  const VALUED = ['--root', '--golden', '--pending', '--against'];
  const opt = k => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; if (!v || v.startsWith('--')) refuse(`${k} needs a value`); argv.splice(i, 2); return v; };
  const root = path.resolve(opt('--root') || ROOT);
  const file = path.resolve(opt('--golden') || path.join(root, 'test/golden/golden.js'));
  const reason = opt('--pending'), commit = opt('--against');
  for (const a of argv) {
    if (VALUED.includes(a)) refuse(`${a} is given twice`);
    if (a.startsWith('-') && a !== '--add' && a !== '--check') refuse(`${a} is not an option`);
  }
  const isAdd = argv.includes('--add'), isCheck = argv.includes('--check');
  const modes = [isAdd && '--add', commit !== null && '--against', !isAdd && reason !== null && '--pending', isCheck && '--check'].filter(Boolean);
  if (modes.length > 1) refuse(`${modes.join(' and ')} cannot be given together`);
  const twice = ['--add', '--check'].find(k => argv.filter(a => a === k).length > 1);
  if (twice) refuse(`${twice} is given twice`);
  if (isAdd) {
    const i = argv.indexOf('--add'), name = argv[i + 1], def = argv[i + 2];
    if (!name || !def || name.startsWith('-') || def.startsWith('-')) refuse('--add needs a name and a JSON file');
    const extra = argv.filter((a, j) => !a.startsWith('-') && j !== i + 1 && j !== i + 2);
    if (extra.length) refuse(`${extra[0]} is not an option (--add takes a name and a JSON file)`);
    return { mode: 'add', root, file, reason, name, def };
  }
  const words = argv.filter(a => !a.startsWith('-'));
  if (commit !== null) return { mode: 'against', root, file, commit, names: words };
  if (words.length) refuse(`${words[0]} is not an option`);
  if (reason !== null) return { mode: 'pending', root, file, reason };
  return { mode: isCheck ? 'check' : 'repin', root, file };
}

module.exports = { FILE, DEFAULTS, USAGE, definition, format, read, write, pin, repin, markPending, check, add, selfCheck, against, commitCore, treeCore, parseArgs };

if (require.main === module) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.mode === 'help') console.log(USAGE);
    else if (o.mode === 'add') console.log(add(treeCore(o.root), o.file, o.name, JSON.parse(fs.readFileSync(o.def, 'utf8')), o.reason));
    else if (o.mode === 'against') { for (const r of against(o.commit, { root: o.root, file: o.file, names: o.names })) console.log(r.text); }
    else if (o.mode === 'pending') { for (const l of markPending(o.file, o.reason)) console.log(l); }
    else if (o.mode === 'check') {
      const r = check(treeCore(o.root), o.file);
      for (const l of r.lines) console.log(l);
      process.exit(r.bad ? 1 : 0);
    } else { for (const l of repin(treeCore(o.root), o.file)) console.log(l); }
  } catch (e) { console.log((e && e.message) || e); process.exit(e && e.refused ? 2 : 1); }
}
