#!/usr/bin/env node
// ACCESSION — check-all's pool and its step timer (BUILD.md §10.2, §6.3).
//
// The pool runs jobs on a fixed number of CPU slots: whenever a slot is free it starts the
// ready job that comes first, longest first by the time test/timings.json records for it (a
// job that others wait for counts their time too, so the reverted copy's build starts at
// once). A job is ready once every job it runs after has passed; a job after one that failed
// is not run, and fails. Every job runs exactly once. What each job prints is kept, and each
// group of jobs is reported in its place, in the listed order, as soon as it and every group
// before it is done: one line if it passed, its whole output if it failed.
// Each job's wall time is measured, and its CPU time: what bash's `times` gives for the
// processes it waited for, or, if larger, the sum over every process under it seen in /proc
// every 200 ms (a browser's processes are not waited for, so only the second counts them).
//
// check-all's pool (Pool.checkAll) holds, longest first, the short sims (test/m3-battery,
// held to 60 CPU-s), every tools/browser/check-*.mjs, and the revert test (§6.3) as jobs:
// the reverted copy made and built (tools/revert-test.sh --prepare), then each Node test file
// run in it as a job of its own, and its smoke and screen checks. `--fast` leaves out
// FAST_LEAVES_OUT unless `--with` names them.
//
// Usage (check-all.sh calls it; each call appends to the results file):
//   node tools/pool.js --begin --results <file> [check-all's flags]   checks the flags, notes the start
//   node tools/pool.js --step <name> --results <file> [flags] -- <command...>   runs one step, timed
//   node tools/pool.js --check-all --results <file> [flags]           runs the pool
//   node tools/pool.js --summary --results <file> [flags]             the times, the budgets and the last line
//   node tools/pool.js --jobs <file.json> [--slots n]                 runs a list of jobs (tests use it)
// check-all's flags: --fast, --with <step,...>, --no-browser, --allow-skip, --list, --timings.
// ACCESSION_CHECK_JOBS sets the slots (default: one per CPU up to 4). ACCESSION_POOL_TIMELINE
// names a file to which the pool writes each job's start and end as they happen, one JSON line
// each ({event, name, at} in ms from the pool's start, with cpu and code at the end), to see
// where a run's time went.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const Runner = require('../test/run.js');
const root = path.join(__dirname, '..');

// The steps --fast leaves out (the revert test and the three longest browser checks), unless
// --with names them.
const FAST_LEAVES_OUT = ['revert-3d', 'check-3d', 'check-keys', 'check-touch'];
// The budgets of BUILD.md §10.2, for a run alone: wall seconds, and CPU seconds where set.
const BUDGETS = { lints: { wall: 25 }, tests: { wall: 175, cpu: 650 }, build: { wall: 10 }, pool: { wall: 320 }, total: { wall: 540 }, fast: { wall: 500 }, shortSims: { cpu: 60 } };
// The steps check-all.sh runs before the tests count as its lints (with the art and the linked builds).
const LINTS = ['lint-core', 'lint-tools', 'lint-numbers', 'lint-registry', 'art-up-to-date', 'linked-builds'];
// What a job is reckoned to take when timings.json has no time for it yet.
const GUESS = { browser: 60000, prepare: 10000, job: 30000 };
const USAGE = 'usage: ./check-all.sh [--fast [--with revert-3d,check-3d,check-keys,check-touch]] [--no-browser] [--allow-skip] [--list] [--timings]';

const sec = ms => (ms / 1000).toFixed(1);
const lastLine = s => { const l = s.replace(/\s+$/, '').split('\n'); return l[l.length - 1]; };
const indent = (s, by) => s.replace(/\s+$/, '').split('\n').map(l => by + l).join('\n');

// ------------------------------------------------------------------ CPU time
let tick = null;
const clockTick = () => {
  if (tick === null) { try { tick = 1000 / Number(cp.execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim()) || 10; } catch (e) { tick = 10; } }
  return tick;
};
const PROC = fs.existsSync('/proc/self/stat');
// Every process's parent and CPU ticks so far (utime + stime), from /proc.
function processes() {
  const out = new Map();
  for (const p of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(p)) continue;
    try {
      const s = fs.readFileSync(`/proc/${p}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' ');
      out.set(Number(p), { ppid: Number(f[1]), ticks: Number(f[11]) + Number(f[12]) });
    } catch (e) { /* gone meanwhile */ }
  }
  return out;
}
// For each running job, the most CPU ticks seen for each process under it.
function sampleAll(running) {
  if (!running.size) return;
  const all = processes(), kids = new Map();
  for (const [p, x] of all) { if (!kids.has(x.ppid)) kids.set(x.ppid, []); kids.get(x.ppid).push(p); }
  for (const r of running.values()) {
    const todo = [r.pid];
    while (todo.length) {
      const p = todo.pop(), x = all.get(p);
      if (x) r.seen.set(p, Math.max(r.seen.get(p) || 0, x.ticks));
      for (const k of kids.get(p) || []) todo.push(k);
    }
  }
}
// bash's `times`: "0m0.002s 0m0.000s\n0m1.667s 0m0.252s"; the second line is its children's.
function timesMs(s) {
  const m = /(\d+)m([\d.]+)s\s+(\d+)m([\d.]+)s\s*$/.exec(s.trim());
  return m ? Math.round((Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) * 60 + Number(m[4])) * 1000) : 0;
}

// ------------------------------------------------------------------ the pool
// Pool.run(jobs, {slots, onStart(job), onDone(result), sampleMs}) → Promise<[result]> in the
// jobs' order. A job is {name, cmd: [file, ...args], cwd, env, after: [name], est: ms}; a result
// is {name, code (null if not run), ran, why, out, start, end, wall, cpu} (times in ms).
function check(jobs) {
  const names = new Set();
  for (const j of jobs) {
    if (!j || typeof j.name !== 'string' || !j.name) throw new Error('pool: every job needs a name');
    if (names.has(j.name)) throw new Error(`pool: two jobs are named ${j.name}`);
    if (!Array.isArray(j.cmd) || !j.cmd.length) throw new Error(`pool: ${j.name} has no command`);
    names.add(j.name);
  }
  for (const j of jobs) for (const d of j.after || []) if (!names.has(d)) throw new Error(`pool: ${j.name} runs after ${d}, which is not a job`);
  // No cycles: every job must be reachable by removing jobs with nothing left to wait for.
  const left = new Map(jobs.map(j => [j.name, new Set(j.after || [])]));
  for (let changed = true; changed;) {
    changed = false;
    for (const [n, deps] of left) if (!deps.size) { left.delete(n); for (const d of left.values()) d.delete(n); changed = true; }
  }
  if (left.size) throw new Error(`pool: these jobs wait for each other: ${[...left.keys()].join(', ')}`);
}

// A job's priority: its own time plus that of every job that waits for it, at any remove.
function priorities(jobs) {
  const by = new Map(jobs.map(j => [j.name, j])), out = new Map();
  const waiters = n => jobs.filter(j => (j.after || []).includes(n)).map(j => j.name);
  for (const j of jobs) {
    const seen = new Set(), todo = waiters(j.name);
    while (todo.length) { const n = todo.pop(); if (seen.has(n)) continue; seen.add(n); todo.push(...waiters(n)); }
    let p = j.est || 0;
    for (const n of seen) p += by.get(n).est || 0;
    out.set(j.name, p);
  }
  return out;
}

function run(jobs, opts) {
  opts = opts || {};
  check(jobs);
  const slots = Math.max(1, opts.slots || 1), prio = priorities(jobs), t0 = Date.now();
  const results = new Map(), running = new Map(), pending = jobs.slice();
  const order = (a, b) => prio.get(b.name) - prio.get(a.name) || (a.name < b.name ? -1 : 1);
  let timer = null;
  const sampleMs = opts.sampleMs === undefined ? 200 : opts.sampleMs;
  if (PROC && sampleMs > 0) { timer = setInterval(() => sampleAll(running), sampleMs); timer.unref(); }
  const stopAll = () => { for (const r of running.values()) { try { process.kill(-r.pid, 'SIGKILL'); } catch (e) { /* gone */ } } };
  return new Promise(resolve => {
    const finish = r => { results.set(r.name, r); if (opts.onDone) opts.onDone(r); };
    const start = j => {
      const child = cp.spawn('bash', ['-c', 'exec 2>&1; "$@"; c=$?; times >&3; exit $c', j.name, ...j.cmd],
        { cwd: j.cwd || root, env: j.env ? Object.assign({}, process.env, j.env) : process.env, stdio: ['ignore', 'pipe', 'ignore', 'pipe'], detached: true });
      const r = { pid: child.pid, seen: new Map(), out: '', times: '', start: Date.now() - t0 };
      running.set(j.name, r);
      if (opts.onStart) opts.onStart(j);
      child.stdout.on('data', d => { r.out += d; });
      child.stdio[3].on('data', d => { r.times += d; });
      child.on('close', (code, signal) => {
        running.delete(j.name);
        let ticks = 0;
        for (const v of r.seen.values()) ticks += v;
        const end = Date.now() - t0;
        finish({ name: j.name, code: code === null ? 128 : code, ran: true, why: signal ? `stopped by ${signal}` : null, out: r.out, start: r.start, end, wall: end - r.start, cpu: Math.max(timesMs(r.times), Math.round(ticks * clockTick())) });
        settle();
      });
      child.on('error', e => { r.out += String(e && e.message || e) + '\n'; });
    };
    const settle = () => {
      // A job after one that did not pass is not run: skipped after a skip, failed otherwise.
      for (let changed = true; changed;) {
        changed = false;
        for (const j of pending.slice()) {
          const bad = (j.after || []).map(d => results.get(d)).find(r => r && r.code !== 0);
          if (!bad) continue;
          pending.splice(pending.indexOf(j), 1); changed = true;
          const skipped = bad.code === 77;
          finish({ name: j.name, code: skipped ? 77 : null, ran: false, why: `not run, since ${bad.name} ${skipped ? 'was skipped' : bad.ran ? 'failed' : 'was not run'}`, out: '', start: Date.now() - t0, end: Date.now() - t0, wall: 0, cpu: 0 });
        }
      }
      const ready = pending.filter(j => (j.after || []).every(d => results.has(d) && results.get(d).code === 0)).sort(order);
      while (running.size < slots && ready.length) { const j = ready.shift(); pending.splice(pending.indexOf(j), 1); start(j); }
      if (!pending.length && !running.size) { if (timer) clearInterval(timer); resolve(jobs.map(j => results.get(j.name))); }
    };
    run.stopAll = stopAll;
    settle();
  });
}

// ------------------------------------------------------------------ groups and lines
// A group's status: fail if a job failed or was not run (other than after a skip), skip if a
// job could not run (77), pass otherwise.
function status(rs) {
  if (rs.some(r => r.code !== 0 && r.code !== 77)) return 'fail';
  return rs.some(r => r.code === 77) ? 'skip' : 'pass';
}
function groupTimes(rs) {
  const ran = rs.filter(r => r.ran);
  const wall = ran.length ? Math.max(...ran.map(r => r.end)) - Math.min(...ran.map(r => r.start)) : 0;
  return { wall, cpu: rs.reduce((s, r) => s + r.cpu, 0) };
}
// The report of one group: "ok    name [wall, CPU]: what it says", or its failures in full.
function report(group, rs) {
  const st = status(rs), t = groupTimes(rs), many = rs.length > 1;
  const tag = `${group.name} [${sec(t.wall)} s, ${sec(t.cpu)} CPU-s${many ? `, ${rs.length} jobs` : ''}]`;
  if (st === 'pass') return `ok    ${tag}: ${group.say ? group.say(rs) : lastLine(rs[0].out)}`;
  if (st === 'skip') { const s = rs.find(r => r.code === 77); return `SKIP  ${tag}: ${s.ran ? lastLine(s.out) : s.why}`; }
  const lines = [`FAIL  ${tag}`];
  for (const r of rs.filter(x => x.code !== 0 && x.code !== 77)) {
    if (many) lines.push(`      ${r.name}: ${r.ran ? `exit ${r.code}${r.why ? `, ${r.why}` : ''}` : r.why}`);
    if (r.out.trim()) lines.push(indent(r.out, many ? '        ' : '      '));
    else if (!many) lines.push(`      ${r.ran ? `exit ${r.code}, no output${r.why ? `, ${r.why}` : ''}` : r.why}`);
  }
  return lines.join('\n');
}

// Runs groups ([{name, jobs, say}]) in one pool, printing each group's report in the listed
// order as soon as it and the groups before it are done. Resolves to [{group, results, status}].
async function runGroups(groups, opts) {
  const jobs = [].concat(...groups.map(g => g.jobs)), got = new Map();
  let next = 0;
  const print = opts.print || (s => process.stdout.write(s + '\n'));
  const flush = () => {
    while (next < groups.length && groups[next].jobs.every(j => got.has(j.name))) {
      const g = groups[next++];
      print(report(g, g.jobs.map(j => got.get(j.name))));
    }
  };
  const timeline = process.env.ACCESSION_POOL_TIMELINE, t0 = Date.now();
  const note = x => { if (timeline) fs.appendFileSync(timeline, JSON.stringify(x) + '\n'); };
  await run(jobs, {
    slots: opts.slots, sampleMs: opts.sampleMs,
    onStart(j) { note({ event: 'start', name: j.name, at: Date.now() - t0 }); },
    onDone(r) { note({ event: 'end', name: r.name, at: r.end, cpu: r.cpu, code: r.code }); got.set(r.name, r); flush(); },
  });
  flush();
  return groups.map(g => { const rs = g.jobs.map(j => got.get(j.name)); return { group: g, results: rs, status: status(rs), times: groupTimes(rs) }; });
}

// ------------------------------------------------------------------ check-all's pool
function parseFlags(argv) {
  const f = { fast: false, with: [], noBrowser: false, allowSkip: false, list: false, timings: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fast') f.fast = true;
    else if (a === '--no-browser') f.noBrowser = true;
    else if (a === '--allow-skip') f.allowSkip = true;
    else if (a === '--list') f.list = true;
    else if (a === '--timings') f.timings = true;
    else if (a === '--with' || a.startsWith('--with=')) {
      const v = a === '--with' ? argv[++i] : a.slice(7);
      if (!v) throw new Error('--with names the steps to run, as --with check-keys,check-touch');
      f.with.push(...v.split(',').filter(Boolean));
    } else throw new Error(`there is no flag ${a}`);
  }
  for (const w of f.with) if (!FAST_LEAVES_OUT.includes(w)) throw new Error(`--with takes ${FAST_LEAVES_OUT.join(', ')} (the steps --fast leaves out), not ${w}`);
  if (f.with.length && !f.fast) throw new Error('--with goes with --fast: without it every step runs');
  if (f.timings && f.fast) throw new Error('--timings records a full run; it does not go with --fast');
  return f;
}
const leftOut = f => f.fast ? FAST_LEAVES_OUT.filter(s => !f.with.includes(s)) : [];

// The browser checks: every tools/browser/check-*.mjs, so a new one joins with no edit here.
const browserChecks = dir => fs.readdirSync(path.join(dir, 'tools/browser')).filter(n => /^check-.+\.mjs$/.test(n)).sort().map(n => n.slice(0, -4));

// Whether dir has a 3D view to revert (§6.3): a file under js/ that tools/3d-allowlist.txt
// names is there. The 3D guard (test/guard-3d.test.js) keeps that list whole while the view is
// there, and a real revert removes both. Whether tools/revert-test.sh is there does not decide
// it, so a tree that has lost the script but kept the view fails, as before the pool. (Named
// so, not by the view's file, which only the allowlisted files may name.)
function has3d(dir) {
  const list = path.join(dir, 'tools/3d-allowlist.txt');
  if (!fs.existsSync(list)) return false;
  return fs.readFileSync(list, 'utf8').split('\n').map(l => l.trim()).filter(l => l.startsWith('js/')).some(f => fs.existsSync(path.join(dir, f)));
}

// The groups of check-all's pool. copy is the reverted copy's folder; dir is the tree checked
// (this one unless a test names another). The revert test is in it while dir has a 3D view.
function checkAll(f, copy, dir) {
  dir = dir || root;
  const T = Runner.timings(path.join(dir, 'test')), node = process.execPath;
  const est = (name, guess) => T.jobs[name] > 0 ? T.jobs[name] : guess;
  const one = (name, cmd, cwd, guess) => ({ name, jobs: [{ name, cmd, cwd, est: est(name, guess) }] });
  const groups = [one('short-sims', [node, 'test/run.js', '--file=m3-battery.test.js'], dir, GUESS.job)];
  for (const c of browserChecks(dir)) {
    const g = one(c, [node, `tools/browser/${c}.mjs`], dir, GUESS.browser);
    g.browser = true;
    groups.push(g);
  }
  if (has3d(dir)) groups.push(revertGroup(copy, T, dir));
  const out = groups.filter(g => !leftOut(f).includes(g.name));
  for (const g of out) if (g.browser && f.noBrowser) g.skip = '--no-browser';
  return out;
}

// The revert test as jobs: the copy made and built, then each Node test file (all of them but
// the steps run alone, as `node test/run.js` runs them) and the smoke and screen checks in it.
function revertGroup(copy, T, dir) {
  const node = process.execPath, prep = 'revert-3d: copy and build';
  const tests = Runner.files(path.join(dir, 'test'), '').filter(f => !Runner.ALONE.includes(f));
  const est = Runner.estimates(path.join(dir, 'test'), tests, T);
  const jobs = [{ name: prep, cmd: ['bash', path.join(dir, 'tools/revert-test.sh'), '--prepare', copy], cwd: dir, est: T.jobs[prep] || GUESS.prepare }];
  for (const f of tests) jobs.push({ name: `revert-3d: ${f}`, cmd: [node, 'test/run.js', `--file=${f}`], cwd: copy, after: [prep], est: est[f], file: f });
  for (const c of ['check-smoke', 'check-screens']) jobs.push({ name: `revert-3d: ${c}`, cmd: [node, `tools/browser/${c}.mjs`], cwd: copy, after: [prep], est: T.jobs[`revert-3d: ${c}`] || GUESS.browser });
  const say = rs => {
    let passed = 0, total = 0;
    for (const r of rs.slice(1, 1 + tests.length)) { const m = /^tests: (\d+)\/(\d+) passed/m.exec(r.out); if (m) { passed += Number(m[1]); total += Number(m[2]); } }
    return `${lastLine(rs[0].out)}, ${passed}/${total} passed in ${tests.length} test files, smoke and screens pass`;
  };
  return { name: 'revert-3d', jobs, say, revert: true };
}

// ------------------------------------------------------------------ the results file
// One line a record: "start <ms>", "step <name> <pass|fail|skip> <wall> <cpu>",
// "pool <wall> <cpu> <slots>", "group <name> <status> <wall> <cpu>".
const append = (file, line) => fs.appendFileSync(file, line + '\n');
function readResults(file) {
  const out = { start: null, steps: [], groups: [], pool: null };
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    const w = l.split(' ');
    if (w[0] === 'start') out.start = Number(w[1]);
    else if (w[0] === 'step' || w[0] === 'group') out[w[0] === 'step' ? 'steps' : 'groups'].push({ name: w[1], status: w[2], wall: Number(w[3]), cpu: Number(w[4]) });
    else if (w[0] === 'pool') out.pool = { wall: Number(w[1]), cpu: Number(w[2]), slots: Number(w[3]) };
  }
  return out;
}
const slotsWanted = () => { const n = parseInt(process.env.ACCESSION_CHECK_JOBS || '', 10); return n > 0 ? n : Math.min(4, os.cpus().length); };

// The step-time table and check-all's last line; returns the exit code. A pool that did not
// say how it went failed. The budgets of each step are for the full run; --fast has its own.
function summary(file, f) {
  const r = readResults(file), all = r.steps.concat(r.groups);
  if (!r.pool && !all.some(x => x.name === 'pool')) all.push({ name: 'pool', status: 'fail', wall: 0, cpu: 0 });
  const budget = k => f.fast ? null : BUDGETS[k];
  const total = { wall: r.start === null ? 0 : Date.now() - r.start, cpu: all.reduce((s, x) => s + x.cpu, 0) };
  const sum = names => { const xs = r.steps.filter(x => names.includes(x.name)); return { wall: xs.reduce((s, x) => s + x.wall, 0), cpu: xs.reduce((s, x) => s + x.cpu, 0) }; };
  const row = (name, t, budget) => {
    const over = budget && ((budget.wall && t.wall > budget.wall * 1000) || (budget.cpu && t.cpu > budget.cpu * 1000));
    const b = budget ? `  budget ${[budget.wall ? `${budget.wall} s` : null, budget.cpu ? `${budget.cpu} CPU-s` : null].filter(Boolean).join(', ')}${over ? ' OVER' : ''}` : '';
    return `  ${name.padEnd(28)}${sec(t.wall).padStart(7)} s ${sec(t.cpu).padStart(8)} CPU-s${b}`;
  };
  const lines = ['', 'Step times, wall and CPU (BUILD.md §10.2; the budgets hold for a run alone):'];
  for (const s of r.steps.filter(x => LINTS.includes(x.name))) lines.push(row('  ' + s.name, s));
  lines.push(row('lints, art and linked builds', sum(LINTS), budget('lints')));
  const steps = { tests: ['Node tests', budget('tests')], build: ['the build', budget('build')] };
  for (const s of r.steps.filter(x => !LINTS.includes(x.name))) lines.push(steps[s.name] ? row(steps[s.name][0], s, steps[s.name][1]) : row(s.name, s));
  if (r.pool) {
    lines.push(row(`the pool (${r.pool.slots} ${r.pool.slots === 1 ? 'slot' : 'slots'})`, r.pool, budget('pool')));
    for (const g of r.groups.filter(x => x.status !== 'skip' || x.wall)) lines.push(row('  ' + g.name, g, g.name === 'short-sims' ? BUDGETS.shortSims : null));
  } else lines.push('  the pool did not finish');
  lines.push(row(f.fast ? 'check-all --fast' : 'check-all', total, f.fast ? BUDGETS.fast : BUDGETS.total));
  console.log(lines.join('\n'));
  const pass = all.filter(x => x.status === 'pass').map(x => x.name), skip = all.filter(x => x.status === 'skip').map(x => x.name), fail = all.filter(x => x.status === 'fail').map(x => x.name);
  const named = xs => xs.length ? ` (${xs.join(' ')})` : '';
  const head = f.fast ? `check-all --fast (left out: ${leftOut(f).join(', ') || 'nothing'})` : 'check-all';
  console.log(`\n${head}: ${pass.length} passed, ${skip.length} skipped${named(skip)}, ${fail.length} failed${named(fail)}`);
  return !fail.length && (!skip.length || f.allowSkip) ? 0 : 1;
}

// ------------------------------------------------------------------ the command line
async function main(argv) {
  const take = k => { const i = argv.indexOf(k); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const has = k => { const i = argv.indexOf(k); if (i < 0) return false; argv.splice(i, 1); return true; };
  // A list of jobs from a JSON file, each group of one job (the pool's own tests).
  const jobsFile = take('--jobs');
  if (jobsFile !== undefined) {
    const slots = Number(take('--slots') || slotsWanted());
    const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
    const done = await runGroups(jobs.map(j => ({ name: j.name, jobs: [j] })), { slots });
    const fail = done.filter(d => d.status === 'fail').length;
    console.log(`pool: ${done.length} jobs on ${slots} ${slots === 1 ? 'slot' : 'slots'}, ${fail} failed`);
    return fail ? 1 : 0;
  }
  const dash = argv.indexOf('--');
  const command = dash >= 0 ? argv.splice(dash).slice(1) : null;
  const mode = ['--begin', '--step', '--check-all', '--summary'].find(m => argv.includes(m));
  if (!mode) { console.log(USAGE); return 2; }
  const stepName = mode === '--step' ? take('--step') : (has(mode), null);
  const results = take('--results');
  let f;
  try { f = parseFlags(argv); } catch (e) { console.log(`check-all: ${e.message}\n${USAGE}`); return 2; }
  if (mode === '--begin') { if (!f.list) fs.writeFileSync(results, `start ${Date.now()}\n`); return 0; }
  if (mode === '--step') {
    if (f.list) { console.log(`step  ${stepName}: ${command.join(' ')}`); return 0; }
    const [r] = await run([{ name: stepName, cmd: command, cwd: process.cwd() }], { slots: 1 });
    console.log(report({ name: stepName }, [r]));
    append(results, `step ${stepName} ${status([r])} ${r.wall} ${r.cpu}`);
    return 0;
  }
  if (mode === '--summary') return f.list ? 0 : summary(results, f);
  // --check-all: the pool.
  const slots = slotsWanted();
  if (f.list) {
    for (const g of checkAll(f, '<the reverted copy>')) for (const j of g.jobs) console.log(`job   ${g.name}: ${j.name}${g.skip ? ` (skipped: ${g.skip})` : ''}`);
    return 0;
  }
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-revert-'));
  const clean = () => fs.rmSync(copy, { recursive: true, force: true });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (run.stopAll) run.stopAll(); clean(); process.exit(sig === 'SIGINT' ? 130 : 143); });
  try {
    const groups = checkAll(f, copy);
    if (!has3d(root)) console.log('ok    revert-3d: no 3D view in this tree, nothing to revert');
    for (const g of groups.filter(x => x.skip)) { console.log(`SKIP  ${g.name}: ${g.skip}`); append(results, `group ${g.name} skip 0 0`); }
    const t0 = Date.now();
    const done = await runGroups(groups.filter(x => !x.skip), { slots });
    const wall = Date.now() - t0;
    for (const d of done) append(results, `group ${d.group.name} ${d.status} ${d.times.wall} ${d.times.cpu}`);
    append(results, `pool ${wall} ${done.reduce((s, d) => s + d.times.cpu, 0)} ${slots}`);
    if (f.timings) recordTimings(done);
  } finally { clean(); }
  return 0;
}

// --timings: each pool job's wall time (rounded to 100 ms) into test/timings.json's jobs, but
// for the reverted copy's test files, whose CPU time `node test/run.js --write-timings` records.
function recordTimings(done) {
  const file = path.join(root, 'test', Runner.TIMINGS), t = Runner.timings(path.join(root, 'test'));
  const jobs = {};
  for (const d of done) for (let i = 0; i < d.results.length; i++) {
    const j = d.group.jobs[i], r = d.results[i];
    if (!j.file && r.ran && r.code === 0) jobs[j.name] = Math.max(100, Math.round(r.wall / 100) * 100);
  }
  const merged = Object.assign({}, t.jobs, jobs), sorted = {};
  for (const k of Object.keys(merged).sort()) sorted[k] = merged[k];
  // What the runner wrote this run (or before it); a file that cannot be read is written anew.
  let old = {};
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { old = {}; }
  old.jobs = sorted;
  if (!old.files) old.files = t.files;
  fs.writeFileSync(file, JSON.stringify(old, null, 1) + '\n');
}

module.exports = { run, runGroups, report, status, checkAll, parseFlags, browserChecks, has3d, priorities, leftOut, FAST_LEAVES_OUT, BUDGETS, LINTS };
if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.log(`pool: ${e && e.stack || e}`); process.exitCode = 1; });
}
