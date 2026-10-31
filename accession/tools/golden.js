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
// A run is pending by name (--pending "reason" <name…>), so a stretch of work that moves some
// runs leaves the others held to their pins (M4 plan, "Golden hash and determinism"). A run a
// change retires on purpose moves to test/golden/retired.js (--retire), kept with its pin and
// the release build it plays in (dist/builds/<coreHash>.html, BUILD.md §3.6), where the golden
// test still plays it. A replay with a recipe, test/golden/recipes/<name>.js, is recorded from
// it (--record), and the recipe's story is checked at every commit, pending or not.
// Usage: USAGE below, which `node tools/golden.js --help` prints. Only the bare command
// re-pins; --help, an option or word it does not know, and two modes at once write nothing.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process'), vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'test/golden/golden.js');
const RETIRED_FILE = path.join(ROOT, 'test/golden/retired.js');
const RECIPE_DIR = path.join(ROOT, 'test/golden/recipes');
const { readGolden } = require('./hash-compare.js');
const Shrink = require('./shrink.js');

// What --help prints.
const USAGE = `Usage:
  node tools/golden.js                        re-pin every run: its hash, checkpoints and
                                              per-step hashes; this ends any pending stretch,
                                              and prints old → new with the first step that
                                              changed, where the old pin kept its steps
  node tools/golden.js --pending "reason" <name…>
                                              keep the pins and mark the named runs pending
                                              (each a run of the file); the others stay
                                              held to their pins
  node tools/golden.js --check                compare the runs with the file and write
                                              nothing; a pinned run that differs fails, with
                                              its first diverging step, action and events;
                                              so does a recipe's story that does not hold
                                              (pending or not), and a retired run that does
                                              not play to its pin in its build
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
  node tools/golden.js --retire <name> --build <dist/builds/<coreHash>.html>
                                              move a run to test/golden/retired.js, pinned
                                              in that release build (its core is played,
                                              from the build alone): the build's scripts
                                              are named by the index.html git has where the
                                              build was added, and must hash to its coreHash
  node tools/golden.js --record <name> [--pending "reason"]
                                              record a replay from its recipe,
                                              test/golden/recipes/<name>.js (twice, which
                                              must agree), check its story, and write it,
                                              pinned now, or pending (a run pending before
                                              keeps its reason); its story failing writes
                                              nothing
  node tools/golden.js --help                 print this, writing nothing
  --golden <file> reads and writes another golden file, --retired <file> another retired
  file, --recipes <dir> other recipes; --root <dir> takes this tree and git from another
  checkout (tests use these). An option or word not listed here, or two of --add, --against,
  --pending, --check, --retire and --record at once, is refused, and nothing is written.`;

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

// The file's text: one field a line, and a replay's actions one a line. A retired run's
// file (formatRetired) keeps its build too.
const field = (k, v, kind) => k === 'actions' && kind === 'replay'
  ? `  "actions": [${v.length ? '\n   ' + v.map(a => JSON.stringify(a)).join(',\n   ') + '\n  ' : ''}]`
  : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
const entryText = (name, g, more) => {
  const kind = kindOf(g), keys = DEFINES[kind].concat(PINS[kind], more);
  return ` ${JSON.stringify(name)}: {\n` + keys.filter(k => g[k] !== undefined).map(k => field(k, g[k], kind)).join(',\n') + '\n }';
};
function format(golden) {
  const entry = (name, g) => entryText(name, g, ['pending']);
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

// A refusal: the command was not done, and nothing was written (exit status 2).
function refused(m) {
  const e = new Error(`golden: ${m}; nothing was written (node tools/golden.js --help lists the usage)`);
  e.refused = true;
  return e;
}

// --pending: the named runs marked pending with the reason, each pin kept; the others are
// left as they are, so a run not named stays held to its pin. A name that is not a run of
// the file, a name given twice, no name or no reason is refused before anything is written.
function markPending(file, reason, names) {
  if (typeof reason !== 'string' || !reason.trim()) throw refused('--pending needs a reason in words');
  if (!Array.isArray(names) || !names.length) throw refused('--pending needs the names of the runs it marks: --pending "reason" <name…>');
  const old = read(file), lines = [];
  names.forEach((n, i) => {
    if (!Object.prototype.hasOwnProperty.call(old, n)) throw refused(`there is no run ${n} in ${shown(ROOT, file)} (its runs: ${Object.keys(old).join(', ')})`);
    if (names.indexOf(n) !== i) throw refused(`${n} is named twice`);
  });
  for (const name of names) { old[name].pending = reason; lines.push(`golden: ${name} pending (pin ${old[name].hash} kept): ${reason}`); }
  const held = Object.keys(old).filter(n => !old[n].pending);
  lines.push(held.length ? `golden: still held to their pins: ${held.join(', ')}` : 'golden: every run is now pending');
  write(file, old);
  return lines;
}

// --check: every run against its pin, writing nothing; with opts.recipes (a folder), the
// story of every run that has a recipe there, pending or not; with opts.retired (a file),
// every retired run in its build (checkRetired). Returns {bad, lines}.
function check(C, file, opts) {
  opts = opts || {};
  const golden = read(file), lines = [];
  let bad = 0;
  for (const name of Object.keys(golden)) {
    const g = golden[name], v = C.Replay.verify(name, g);
    if (g.pending) lines.push(`golden: ${name} is pending (${g.pending}): hash ${v.hash}, pin ${g.hash === null ? 'none' : g.hash}${v.hash === g.hash ? ', unchanged' : ''}`);
    else if (!v.ok) { bad++; lines.push(`golden: ${name} differs from ${path.relative(ROOT, file)}:\n` + v.text.split('\n').map(l => '  ' + l).join('\n')); }
  }
  const open = Object.keys(golden).filter(n => golden[n].pending).length;
  if (!bad) lines.push('golden: every pinned run matches its pin' + (open ? ` (${open} pending)` : ''));
  if (opts.recipes) for (const name of recipeNames(opts.recipes)) {
    if (!golden[name]) { bad++; lines.push(`golden: the recipe ${name} has no run in ${shown(ROOT, file)}: record it (node tools/golden.js --record ${name})`); continue; }
    const problem = story(C, name, golden[name], loadRecipe(opts.recipes, name));
    if (problem) { bad++; lines.push(`golden: ${name}'s story does not hold${golden[name].pending ? ' (it is pending, and its story is still held)' : ''}: ${problem}`); }
    else lines.push(`golden: ${name}'s story holds${golden[name].pending ? ' (pending)' : ''}`);
  }
  if (opts.retired) { const r = checkRetired(opts.retired, { root: opts.root }); bad += r.bad; for (const l of r.lines) lines.push(l); }
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

// ---- Retired runs (test/golden/retired.js) ----
// A run that a change retires on purpose (M3's replay, once layout version 3 changes its
// department) keeps its definition, its pin and the release build it plays in: build is
// {file, coreHash, blocks}, file the build from the tree's root (dist/builds/<coreHash>.html),
// and blocks the path of each of the build's script blocks, in order, up to its last block of
// js/core or content/ (null for another's), so that the test finds the build's core with no
// git: the blocks named are written out as those files and loaded as a core is, with this
// tree's monkey and replay player, as --against plays a commit's.
const RETIRED_HEAD = "// ACCESSION — retired golden runs (BUILD.md §3.5): runs of test/golden/golden.js retired on\n" +
  "// purpose (node tools/golden.js --retire), each with its pin and the release build it plays\n" +
  "// in (build: the file, its coreHash, and the path of each of its scripts up to its core's last);\n" +
  "// test/golden.test.js plays each in its build's core and holds it to its pin.\n";
function formatRetired(retired) {
  return RETIRED_HEAD + "'use strict';\nconst RETIRED = {\n" + Object.keys(retired).map(n => entryText(n, retired[n], ['build'])).join(',\n') + (Object.keys(retired).length ? '\n' : '') + '};\n';
}
const readRetired = file => fs.existsSync(file) ? JSON.parse(JSON.stringify(vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\n;RETIRED', {}, { filename: file }))) : {};
function writeRetired(file, retired) {
  const out = {};
  for (const n of Object.keys(retired)) {
    const g = retired[n], b = g.build;
    if (!b || typeof b.file !== 'string' || !/^[0-9a-f]{8}$/.test(b.coreHash) || !Array.isArray(b.blocks)) throw new Error(`golden: the retired run ${n} has no build {file, coreHash, blocks}`);
    out[n] = Object.assign(normalize(n, g), { build: { file: b.file, coreHash: b.coreHash, blocks: b.blocks.slice() } });
    delete out[n].pending;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, formatRetired(out));
}

// A build's script blocks, in order: [{type: null | 'x-…', text}], as build-single.py inlines
// them (each script's text between a line break after its tag and one before its end tag, any
// </script in it written <\/script).
function buildScripts(html) {
  const out = [], re = /<script(?: type="text\/(x-[a-z0-9-]+)")?>\n([\s\S]*?)\n<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push({ type: m[1] || null, text: m[2].replace(/<\\\/script/g, '</script') });
  return out;
}
// index.html's script tags, in order: [src | null] (null for an inert placeholder).
function indexScripts(html) {
  const out = [], re = /<script(?: src="([^"]+)")?(?: type="text\/x-[a-z0-9-]+" data-src="[^"]+")?><\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1] || null);
  return out;
}
// A file as a line names it: from the tree's root when it is inside it, else whole.
const shown = (root, f) => { const r = path.relative(root, f); return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.split(path.sep).join('/') : f; };
const isCore = f => typeof f === 'string' && (f.startsWith('js/core/') || f.startsWith('content/'));
// The build's coreHash, as its head stamps it.
function stampedHash(html) {
  const m = /<meta name="accession-core-hash" content="([0-9a-f]{8})">/.exec(html);
  return m ? m[1] : null;
}
// coreHash (tools/core-hash.js) over the build's core: the named blocks but viewmodel.js, each
// as its path, a line break, its text and a line break, in path order.
function blocksHash(blocks, scripts) {
  const H = require('./core-hash.js'), files = [];
  blocks.forEach((f, i) => { if (f && f !== H.VIEW_MODEL) files.push({ f, text: scripts[i].text.replace(/\r\n/g, '\n') }); });
  files.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  return H.fnv1a(files.map(x => x.f + '\n' + x.text + '\n').join('')).toString(16).padStart(8, '0');
}
// The build's core, named: {coreHash, blocks} from the build's html and the index.html it was
// made from, checked: the two hold the same script tags in the same order, and the core they
// name hashes to the coreHash the build is stamped with.
function nameBuild(html, indexHtml, label) {
  const scripts = buildScripts(html), tags = indexScripts(indexHtml), stamped = stampedHash(html);
  if (!stamped) throw refused(`${label} carries no coreHash (<meta name="accession-core-hash">), so it is no build of the game`);
  if (scripts.length !== tags.length) throw refused(`${label} has ${scripts.length} scripts, and the index.html it was built from lists ${tags.length}`);
  const blocks = tags.map(f => isCore(f) ? f : null);
  while (blocks.length && blocks[blocks.length - 1] === null) blocks.pop();
  if (!blocks.length) throw refused(`the index.html ${label} was built from lists no file of js/core or content/`);
  const got = blocksHash(blocks, scripts);
  if (got !== stamped) throw refused(`the core in ${label}, named by the index.html it was built from, hashes to ${got}, not to the coreHash ${stamped} it is stamped with`);
  return { coreHash: stamped, blocks };
}
// The index.html a build in the tree was made from: git's at the commit that added the build.
function indexAtBuild(root, rel) {
  const git = args => cp.execFileSync('git', ['-C', root].concat(args), { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  let sha;
  try { sha = git(['log', '--diff-filter=A', '--format=%H', '--', rel]).trim().split('\n').filter(Boolean).pop(); }
  catch (e) { throw refused(`git cannot say where ${rel} was added (${String((e && e.stderr) || e).trim().split('\n')[0]})`); }
  if (!sha) throw refused(`${rel} is not a release build git has (python3 tools/build-single.py --release, committed)`);
  try { return git(['show', `${sha}:./index.html`]); }
  catch (e) { throw refused(`git has no index.html beside ${rel} at ${sha.slice(0, 7)}, where it was added`); }
}
// A core context from a build's core (blocks, as nameBuild gives them, checked against its
// coreHash), with this tree's core context, monkey and replay player, in a temporary
// directory, as commitCore makes one from a commit.
const buildCache = new Map();
function buildCore(root, build) {
  const file = path.resolve(root, build.file), key = file + '|' + build.coreHash + '|' + build.blocks.join(',');
  if (!fs.existsSync(file)) throw new Error(`golden: the build ${build.file} is not there (release builds are kept, BUILD.md §3.6)`);
  // Checked every time, so that a build changed since is never played from a core made before.
  const html = fs.readFileSync(file, 'utf8'), scripts = buildScripts(html);
  if (stampedHash(html) !== build.coreHash) throw new Error(`golden: ${build.file} is stamped with coreHash ${stampedHash(html)}, not ${build.coreHash}`);
  if (scripts.length < build.blocks.length) throw new Error(`golden: ${build.file} has ${scripts.length} scripts, fewer than the ${build.blocks.length} its retired runs name`);
  const got = blocksHash(build.blocks, scripts);
  if (got !== build.coreHash) throw new Error(`golden: the scripts of ${build.file} named as its core hash to ${got}, not ${build.coreHash}`);
  if (buildCache.has(key)) return buildCache.get(key);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-build-'));
  try {
    const listed = [];
    build.blocks.forEach((f, i) => {
      if (!f) return;
      const dest = path.join(tmp, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, scripts[i].text);
      listed.push(`<script src="${f}"></script>`);
    });
    fs.writeFileSync(path.join(tmp, 'index.html'), listed.join('\n') + '\n');
    fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
    for (const f of ['core-context.js', 'monkey.js', 'replay.js']) fs.copyFileSync(path.join(root, 'tools', f), path.join(tmp, 'tools', f));
    const C = treeCore(tmp);
    buildCache.set(key, C);
    return C;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// --retire: the run moved from the golden file to the retired one, pinned by playing it in
// the build's core (its pin in the golden file may be another core's, as M3's replay's is once
// M4 re-pins it). opts: root; index, the text of the index.html the build was made from (git's
// where the build was added, by default). Returns the log line.
function retire(file, retiredFile, name, buildRel, opts) {
  opts = opts || {};
  const root = opts.root || ROOT;
  if (typeof buildRel !== 'string' || !buildRel) throw refused('--retire needs the release build the run plays in: --build dist/builds/<coreHash>.html');
  const golden = read(file), retired = readRetired(retiredFile);
  if (!golden[name]) throw refused(`there is no run ${name} in ${shown(root, file)}`);
  if (retired[name]) throw refused(`${name} is already retired, in ${shown(root, retiredFile)}`);
  const abs = path.resolve(root, buildRel), rel = path.relative(root, abs).split(path.sep).join('/');
  if (!fs.existsSync(abs)) throw refused(`there is no build ${rel}`);
  const b = nameBuild(fs.readFileSync(abs, 'utf8'), opts.index !== undefined ? opts.index : indexAtBuild(root, rel), rel);
  const build = { file: rel, coreHash: b.coreHash, blocks: b.blocks }, C = buildCore(root, build), d = definition(name, golden[name]);
  let p;
  try { p = pin(C, name, d); }
  catch (e) { throw new Error(`golden: ${name} does not play in ${rel}: ${(e && e.message) || e}; nothing was written`); }
  const was = golden[name].hash;
  retired[name] = Object.assign(p, { build });
  delete golden[name];
  writeRetired(retiredFile, retired);
  write(file, golden);
  return `golden: ${name} retired to ${shown(root, retiredFile)}: it plays in ${rel} (coreHash ${b.coreHash}) to hash ${p.hash}` +
    (was === p.hash ? ', its pin' : `; its pin in ${shown(root, file)} was ${was === null ? 'none' : was}, on another core`);
}

// Every retired run played in its build and held to its pin, writing nothing. Returns
// {bad, lines}; opts.root, and opts.names to check only those.
function checkRetired(retiredFile, opts) {
  opts = opts || {};
  const root = opts.root || ROOT, retired = readRetired(retiredFile), lines = [];
  let bad = 0;
  for (const name of Object.keys(retired)) {
    if (opts.names && !opts.names.includes(name)) continue;
    const g = retired[name];
    let v;
    try { v = buildCore(root, g.build).Replay.verify(name, g); }
    catch (e) { bad++; lines.push(`golden: the retired ${name} cannot be played in its build: ${(e && e.message) || e}`); continue; }
    if (v.ok) lines.push(`golden: the retired ${name} plays in ${g.build.file} to its pin ${g.hash}`);
    else { bad++; lines.push(`golden: the retired ${name} differs in its build ${g.build.file}:\n` + v.text.split('\n').map(l => '  ' + l).join('\n')); }
  }
  return { bad, lines };
}

// ---- Recipes (test/golden/recipes/<name>.js) ----
// A recipe is how a replay is made, so that a landing that changes what it would do can make
// it again (--record) instead of editing actions by hand, and the story it must show is
// checked at every commit (story), pending or not. A recipe is a Node module:
//   about    what the replay shows, in words;
//   start    where it starts, as a replay's start ({seed, dept, depth, carry?} or {seed, room});
//   options  its switches ({rulesOff, without, invulnerable}; none if absent);
//   cap      the most actions it records (3,000 if absent; a recipe that still has an action
//            then is refused);
//   next(C, state, ctx) → action | null   its next action, or null to stop (it stops too when
//            the visit is over). state is a copy (it cannot change the game, and may read all
//            of it); ctx: i (the action's number, from 0), events (every event so far), last
//            (the last step's), memory (one object for the recording), and policy(ref) → the
//            action the policy would take now (tools/policies, on its own stream for the
//            start's seed, as tools/sim.js plays it);
//   story(C, run) → null | what is missing, in words   the story the replay must show, where
//            run is {start (its first state), state (its last), events, steps: [{action,
//            events}], actions}.
// Recording plays the recipe on this tree twice, and the two must agree.
const CAP = 3000;
const recipeNames = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) : [];
function loadRecipe(dir, name) {
  const file = path.join(dir, name + '.js');
  if (!fs.existsSync(file)) throw refused(`there is no recipe ${name} (${shown(ROOT, file)})`);
  delete require.cache[require.resolve(file)];
  const r = require(file);
  const bad = !r || typeof r !== 'object' ? 'it exports no recipe' : typeof r.about !== 'string' || !r.about ? 'it says nothing about what it shows (about)'
    : !r.start || typeof r.start !== 'object' ? 'it has no start' : typeof r.next !== 'function' ? 'it has no next(C, state, ctx)'
      : typeof r.story !== 'function' ? 'it has no story(C, run)' : r.cap !== undefined && !(Number.isSafeInteger(r.cap) && r.cap > 0) ? 'its cap is no whole number' : null;
  if (bad) throw new Error(`golden: the recipe ${name}: ${bad}`);
  return r;
}
const plainOf = v => JSON.parse(JSON.stringify(v));
const optionsOf = o => ({ rulesOff: ((o && o.rulesOff) || []).slice(), without: ((o && o.without) || []).slice(), invulnerable: !!(o && o.invulnerable) });

// The recipe played once on core C (with the policies loaded, for ctx.policy): {def, run}.
function recordOnce(C, recipe, name) {
  const start = plainOf(recipe.start), options = optionsOf(recipe.options), cap = recipe.cap || CAP;
  const state = C.Replay.begin(start, options), first = C.State.clone(state);
  const actions = [], events = [], steps = [], memory = {}, pols = new Map();
  let last = [], drawn = [];
  const policy = ref => {
    let p = pols.get(ref);
    if (!p) {
      const r = C.Policies && C.Policies.get(ref);
      if (!r) throw new Error(`golden: the recipe ${name} asks for the policy ${ref}, which tools/policies does not have`);
      p = { name: r.name, policy: r.policy, rng: C.Rng.stream({ seed: start.seed, rng: {} }, `policy/${r.name}/${start.seed}`), memory: {}, reads: [] };
      pols.set(ref, p);
    }
    const d = p.policy.decide(C.Obs.make(state, last, p.reads, p.rng, { drawn, memory: p.memory }));
    if (!d || !d.action) throw new Error(`golden: the recipe ${name}'s policy ${ref} decided no action at turn ${state.turn}`);
    return plainOf(d.action);
  };
  for (let i = 0; ; i++) {
    if (state.over) break;
    const a = recipe.next(C, C.State.clone(state), { i, events, last, memory, policy });
    if (a === null || a === undefined) break;
    if (i >= cap) throw new Error(`golden: the recipe ${name} still had an action after its cap of ${cap}`);
    if (typeof a !== 'object' || typeof a.a !== 'string') throw new Error(`golden: the recipe ${name} gave ${JSON.stringify(a)} at action ${i + 1}, not an action`);
    const action = plainOf(a), tick = state.tick, ev = C.Step.step(state, action);
    actions.push(action); steps.push({ action, events: ev }); last = ev;
    for (const e of ev) events.push(e);
    if (state.tick !== tick) drawn = ev;
  }
  return { def: { kind: 'replay', start, options, actions }, run: { start: first, state, events, steps, actions } };
}

// A replay's story, as its recipe tells it: the replay g played on core C from its start, and
// the recipe's story asked of it. null when it holds, or what is missing, in words.
function story(C, name, g, recipe) {
  try {
    const d = definition(name, g);
    if (d.kind !== 'replay') return `${name} is a ${d.kind} run, and a recipe makes a replay`;
    const state = C.Replay.begin(d.start, d.options), first = C.State.clone(state), events = [], steps = [];
    for (const action of d.actions) { const ev = C.Step.step(state, action); steps.push({ action, events: ev }); for (const e of ev) events.push(e); }
    const m = recipe.story(C, { start: first, state, events, steps, actions: d.actions });
    return m === null || m === undefined ? null : typeof m === 'string' && m ? m : `its story answered ${JSON.stringify(m)}, not null or what is missing`;
  } catch (e) { return `its story threw ${(e && e.message) || e}`; }
}

// The core a recipe is recorded on: the core, the monkey, the replay player and every policy
// (tools/sim.js's), from the tree at root.
const recorder = root => require(path.join(root, 'tools/sim.js')).load([path.join(root, 'tools/monkey.js')]);

// A recipe recorded: twice, which must agree, and its story asked. Returns {def, problem}.
function record(C, recipe, name) {
  const a = recordOnce(C, recipe, name), b = recordOnce(C, recipe, name);
  if (C.State.canon(a.def) !== C.State.canon(b.def)) {
    const i = C.Replay.firstDiff(a.def.actions.map(x => C.State.canon(x)), b.def.actions.map(x => C.State.canon(x)));
    throw new Error(`golden: the recipe ${name} recorded two different replays (first at action ${i + 1}); a recipe must decide the same on the same game`);
  }
  return { def: a.def, problem: story(C, name, a.def, recipe) };
}

// --record: the run recorded from its recipe, its story checked, and written: pinned on this
// tree, or pending with reason (a run pending before keeps its reason when none is given).
// Returns the log line.
function recordInto(file, dir, name, reason, opts) {
  opts = opts || {};
  const recipe = loadRecipe(dir, name), C = opts.C || recorder(opts.root || ROOT);
  const { def, problem } = record(C, recipe, name);
  if (problem) throw new Error(`golden: ${name}'s recipe records ${def.actions.length} actions, but its story does not hold: ${problem}; nothing was written`);
  const golden = read(file), old = golden[name] || null;
  const why = reason !== null && reason !== undefined ? reason : old && old.pending ? old.pending : null;
  const same = !!old && C.State.canon(definition(name, old)) === C.State.canon(def);
  golden[name] = Object.assign(pin(C, name, def), why ? { pending: why } : {});
  write(file, golden);
  return `golden: ${name} recorded from its recipe: ${def.actions.length} actions, hash ${golden[name].hash}` +
    (!old ? ', a new run' : same ? ', as it was' : `, where the file had ${old.hash === null ? 'no pin' : old.hash}`) + (why ? `; pending: ${why}` : '; pinned') + '; its story holds';
}

// The command line, read: {mode: 'help' | 'repin' | 'pending' | 'check' | 'add' | 'against' |
// 'retire' | 'record', root, file, retired, recipes, reason, commit, name, def, names, build}.
// Anything it does not know is refused by a throw, before any run is played or any file is
// written, so that only the bare command re-pins.
function parseArgs(args) {
  const argv = args.slice();
  const refuse = m => { throw refused(m); };
  if (argv.includes('--help') || argv.includes('-h')) return { mode: 'help' };
  const VALUED = ['--root', '--golden', '--retired', '--recipes', '--pending', '--against', '--retire', '--record', '--build'];
  const opt = k => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; if (!v || v.startsWith('--')) refuse(`${k} needs a value`); argv.splice(i, 2); return v; };
  const root = path.resolve(opt('--root') || ROOT);
  const file = path.resolve(opt('--golden') || path.join(root, 'test/golden/golden.js'));
  const retired = path.resolve(opt('--retired') || path.join(root, 'test/golden/retired.js'));
  const recipes = path.resolve(opt('--recipes') || path.join(root, 'test/golden/recipes'));
  const reason = opt('--pending'), commit = opt('--against'), retire = opt('--retire'), rec = opt('--record'), build = opt('--build');
  for (const a of argv) {
    if (VALUED.includes(a)) refuse(`${a} is given twice`);
    if (a.startsWith('-') && a !== '--add' && a !== '--check') refuse(`${a} is not an option`);
  }
  const isAdd = argv.includes('--add'), isCheck = argv.includes('--check');
  const withPending = isAdd || rec !== null;
  const modes = [isAdd && '--add', commit !== null && '--against', !withPending && reason !== null && '--pending', isCheck && '--check',
    retire !== null && '--retire', rec !== null && '--record'].filter(Boolean);
  if (modes.length > 1) refuse(`${modes.join(' and ')} cannot be given together`);
  const twice = ['--add', '--check'].find(k => argv.filter(a => a === k).length > 1);
  if (twice) refuse(`${twice} is given twice`);
  if (build !== null && retire === null) refuse('--build goes with --retire <name>');
  if (isAdd) {
    const i = argv.indexOf('--add'), name = argv[i + 1], def = argv[i + 2];
    if (!name || !def || name.startsWith('-') || def.startsWith('-')) refuse('--add needs a name and a JSON file');
    const extra = argv.filter((a, j) => !a.startsWith('-') && j !== i + 1 && j !== i + 2);
    if (extra.length) refuse(`${extra[0]} is not an option (--add takes a name and a JSON file)`);
    return { mode: 'add', root, file, reason, name, def };
  }
  const words = argv.filter(a => !a.startsWith('-'));
  if (commit !== null) return { mode: 'against', root, file, commit, names: words };
  if (retire !== null) {
    if (words.length) refuse(`${words[0]} is not an option (--retire takes one name, and --build)`);
    if (build === null) refuse('--retire needs the release build the run plays in: --build dist/builds/<coreHash>.html');
    return { mode: 'retire', root, file, retired, name: retire, build };
  }
  if (rec !== null) {
    if (words.length) refuse(`${words[0]} is not an option (--record takes one name)`);
    return { mode: 'record', root, file, recipes, name: rec, reason };
  }
  if (reason !== null) {
    if (!words.length) refuse('--pending needs the names of the runs it marks: --pending "reason" <name…>');
    return { mode: 'pending', root, file, reason, names: words };
  }
  if (words.length) refuse(`${words[0]} is not an option`);
  return isCheck ? { mode: 'check', root, file, retired, recipes } : { mode: 'repin', root, file };
}

module.exports = { FILE, RETIRED_FILE, RECIPE_DIR, DEFAULTS, USAGE, definition, format, read, write, pin, repin, markPending, check, add, selfCheck, against, commitCore, treeCore,
  formatRetired, readRetired, writeRetired, buildScripts, indexScripts, nameBuild, indexAtBuild, buildCore, retire, checkRetired,
  recipeNames, loadRecipe, recordOnce, record, story, recordInto, recorder, parseArgs };

if (require.main === module) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.mode === 'help') console.log(USAGE);
    else if (o.mode === 'add') console.log(add(treeCore(o.root), o.file, o.name, JSON.parse(fs.readFileSync(o.def, 'utf8')), o.reason));
    else if (o.mode === 'against') { for (const r of against(o.commit, { root: o.root, file: o.file, names: o.names })) console.log(r.text); }
    else if (o.mode === 'pending') { for (const l of markPending(o.file, o.reason, o.names)) console.log(l); }
    else if (o.mode === 'retire') console.log(retire(o.file, o.retired, o.name, o.build, { root: o.root }));
    else if (o.mode === 'record') console.log(recordInto(o.file, o.recipes, o.name, o.reason, { root: o.root }));
    else if (o.mode === 'check') {
      const r = check(treeCore(o.root), o.file, { recipes: o.recipes, retired: o.retired, root: o.root });
      for (const l of r.lines) console.log(l);
      process.exit(r.bad ? 1 : 0);
    } else { for (const l of repin(treeCore(o.root), o.file)) console.log(l); }
  } catch (e) { console.log((e && e.message) || e); process.exit(e && e.refused ? 2 : 1); }
}
