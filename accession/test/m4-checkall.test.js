// check-all, its pool and its gates (BUILD.md §10.2, §6.3; tools/pool.js, test/run.js).
//   - The pool, on planted jobs: every job runs exactly once, never more at once than its slots,
//     the longest first (a job counting the time of those that wait for it); a failure is printed
//     in its place, whole, and fails the run; a job after a failure is not run, and fails; a job
//     that cannot run (77) is SKIPPED; a job's CPU time counts a process under it that it never
//     waited for (as a browser's are); a cycle or an unknown job to wait for is refused.
//   - `--fast` leaves out exactly the revert test and the 3D, keys and touch checks, `--with`
//     puts back exactly those it names, and nothing else changes: the same steps, the same
//     jobs. Every tools/browser/check-*.mjs is in the pool with no edit (a planted folder's
//     too), and the revert test's jobs are the reverted copy's build, every Node test file a
//     plain `node test/run.js` runs, and its smoke and screen checks. Bad flags are refused.
//   - check-all's last line counts every step and job, and fails on a failure, on a skip unless
//     --allow-skip is given, and when the pool did not finish; the step budgets are flagged.
//   - The short battery's gate is CPU time: under busy loops in other processes on its CPU,
//     its wall time is over a gate that its CPU time keeps within.
//   - The test runner shares files out the longest first by test/timings.json, reckons a file
//     it has no time for from its size, runs one file by `--file=`, and records each file's
//     CPU time with `--write-timings`, keeping the pool's.
//   - The budgets check-all prints are BUILD.md §10.2's.
'use strict';
module.exports = ({ test, assert, root, fs, path }) => {
  const os = require('node:os'), { spawnSync } = require('node:child_process');
  const Pool = require(path.join(root, 'tools/pool.js'));
  const Runner = require(path.join(root, 'test/run.js'));
  const Battery = require(path.join(root, 'tools/battery.js'));
  const json = x => JSON.stringify(x);
  const temp = name => fs.mkdtempSync(path.join(os.tmpdir(), `accession-${name}-`));

  test('the pool runs every job once, on its slots, the longest first; a failure is printed in its place and fails the run; a job after it is not run; 77 is a skip; CPU under a job is counted', () => {
    const dir = temp('pool');
    try {
      // Each job notes its start, and how many jobs are running then, waits ms, notes its end,
      // prints two lines and exits with code.
      const job = (name, est, ms, code, after) => ({ name, est, after, cmd: [process.execPath, '-e', `
        const fs = require('fs'), p = require('path'), d = ${json(dir)}, log = s => fs.appendFileSync(p.join(d, 'log'), s + '\\n');
        fs.mkdirSync(p.join(d, 'run-' + ${json(name)}));
        log('start ${name} ' + fs.readdirSync(d).filter(n => n.startsWith('run-')).length);
        setTimeout(() => { fs.rmdirSync(p.join(d, 'run-' + ${json(name)})); log('end ${name}'); console.log('${name} says hello'); console.log('${name} ends'); process.exit(${code}); }, ${ms});`] });
      // A job that starts a process it never waits for (as a browser's renderer is never waited
      // for by its check), which burns 0.6 CPU-seconds, says so, and idles on after the job ends;
      // the job ends 0.6 s after hearing it, whatever the load, so the pool samples it at rest.
      const spent = path.join(dir, 'spent');
      const burn = `const c = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; }; while (c() < 600); require('fs').writeFileSync(${json(spent)}, ''); setTimeout(() => {}, 4000);`;
      const burner = { name: 'burner', est: 300, cmd: [process.execPath, '-e', `
        const fs = require('fs'), p = require('path'), d = ${json(dir)};
        fs.mkdirSync(p.join(d, 'run-burner'));
        fs.appendFileSync(p.join(d, 'log'), 'start burner ' + fs.readdirSync(d).filter(n => n.startsWith('run-')).length + '\\n');
        require('child_process').spawn(process.execPath, ['-e', ${json(burn)}], { detached: true, stdio: 'ignore' }).unref();
        const poll = setInterval(() => { if (!fs.existsSync(${json(spent)})) return; clearInterval(poll);
          setTimeout(() => { fs.rmdirSync(p.join(d, 'run-burner')); fs.appendFileSync(p.join(d, 'log'), 'end burner\\n'); console.log('burner done'); process.exit(0); }, 600); }, 20);`] };
      const jobs = [
        job('quick', 100, 50, 0), job('broken', 400, 150, 2), job('after-broken', 900, 10, 0, ['broken']), job('long', 800, 400, 0),
        job('middle', 500, 200, 0), job('skipped', 50, 10, 77), job('after-long', 10, 10, 0, ['long']), burner,
      ];
      const file = path.join(dir, 'jobs.json');
      fs.writeFileSync(file, json(jobs));
      const timeline = path.join(dir, 'timeline');
      const r = spawnSync(process.execPath, [path.join(root, 'tools/pool.js'), '--jobs', file, '--slots', '2'], { encoding: 'utf8', env: Object.assign({}, process.env, { ACCESSION_POOL_TIMELINE: timeline }) });
      assert.equal(r.status, 1, 'a failed job fails the run:\n' + r.stdout + r.stderr);
      const out = r.stdout.trimEnd().split('\n');
      // Each job's report in the listed order; the failure whole, in its place.
      const heads = out.filter(l => /^(ok|FAIL|SKIP)\s/.test(l)).map(l => l.split(/\s+/).slice(0, 2).join(' '));
      assert.equal(json(heads), json(['ok quick', 'FAIL broken', 'FAIL after-broken', 'ok long', 'ok middle', 'SKIP skipped', 'ok after-long', 'ok burner']), r.stdout);
      const at = out.findIndex(l => l.startsWith('FAIL  broken'));
      assert.equal(json(out.slice(at + 1, at + 3)), json(['      broken says hello', '      broken ends']), r.stdout);
      assert.match(out[at + 3], /^FAIL  after-broken /);
      assert.equal(out[at + 4], '      not run, since broken failed');
      assert.match(out.find(l => l.startsWith('ok    quick')), /^ok    quick \[\d+\.\d s, \d+\.\d CPU-s\]: quick ends$/);
      assert.match(out.find(l => l.startsWith('SKIP  skipped')), /: skipped ends$/);
      assert.equal(out[out.length - 1], 'pool: 8 jobs on 2 slots, 2 failed');
      // Every job that could run ran exactly once, never more than two at once, and the one
      // after the failure never ran.
      const log = fs.readFileSync(path.join(dir, 'log'), 'utf8').trim().split('\n');
      const starts = log.filter(l => l.startsWith('start ')).map(l => l.split(' ')[1]);
      assert.equal(json(starts.slice().sort()), json(['after-long', 'broken', 'burner', 'long', 'middle', 'quick', 'skipped']), log.join('\n'));
      assert.ok(log.filter(l => l.startsWith('start ')).every(l => Number(l.split(' ')[2]) <= 2), log.join('\n'));
      // The longest first, in the order the pool started them: broken counts the job waiting
      // for it (400 + 900), long the one waiting for it (800 + 10); then middle, burner, quick,
      // skipped. after-long only once long had ended; after-broken never.
      const events = fs.readFileSync(timeline, 'utf8').trim().split('\n').map(l => JSON.parse(l)), seq = events.map(e => `${e.event} ${e.name}`);
      const order = events.filter(e => e.event === 'start').map(e => e.name);
      assert.equal(json(order.filter(n => n !== 'after-long')), json(['broken', 'long', 'middle', 'burner', 'quick', 'skipped']), seq.join('\n'));
      assert.ok(seq.indexOf('end long') < seq.indexOf('start after-long'), seq.join('\n'));
      assert.ok(seq.includes('end after-broken') && !seq.includes('start after-broken'), seq.join('\n'));
      // The burner's own process takes next to no CPU; what it started and never waited for
      // took 0.6 s of it, and is counted (on Linux, from /proc).
      if (fs.existsSync('/proc/self/stat')) {
        const cpu = Number(/^ok    burner \[[\d.]+ s, ([\d.]+) CPU-s\]/m.exec(r.stdout)[1]);
        assert.ok(cpu >= 0.4, `the burner's CPU time was ${cpu} s, without the process it never waited for:\n${r.stdout}`);
      }
      // What the pool refuses.
      const cmd = ['true'];
      assert.throws(() => Pool.run([{ name: 'a', cmd, after: ['b'] }, { name: 'b', cmd, after: ['a'] }]), /wait for each other: a, b/);
      assert.throws(() => Pool.run([{ name: 'a', cmd, after: ['nobody'] }]), /runs after nobody, which is not a job/);
      assert.throws(() => Pool.run([{ name: 'a', cmd }, { name: 'a', cmd }]), /two jobs are named a/);
      // Priorities: a job's time plus that of every job that waits for it, at any remove.
      const p = Pool.priorities([{ name: 'x', est: 5 }, { name: 'y', est: 7, after: ['x'] }, { name: 'z', est: 11, after: ['y'] }, { name: 'w', est: 1 }]);
      assert.equal(json([p.get('x'), p.get('y'), p.get('z'), p.get('w')]), json([23, 18, 11, 1]));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('--fast leaves out exactly the revert test and the 3D, keys and touch checks, --with puts back what it names, and every browser check and test file is in the full run', () => {
    const list = (...a) => spawnSync('bash', [path.join(root, 'check-all.sh'), '--list', ...a], { encoding: 'utf8' });
    const parse = r => {
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const steps = [], groups = new Map();
      for (const l of r.stdout.split('\n')) {
        let m = /^step  ([\w-]+): /.exec(l);
        if (m) { steps.push(m[1]); continue; }
        m = /^job   ([\w-]+): (.+)$/.exec(l);
        if (m) { if (!groups.has(m[1])) groups.set(m[1], []); groups.get(m[1]).push(m[2]); }
      }
      return { steps, groups };
    };
    const full = parse(list()), fast = parse(list('--fast')), some = parse(list('--fast', '--with', 'check-keys,check-touch'));
    assert.equal(json(full.steps), json(['lint-core', 'lint-tools', 'lint-numbers', 'lint-registry', 'art-up-to-date', 'linked-builds', 'tests', 'build']));
    assert.equal(json(fast.steps), json(full.steps));
    assert.equal(json(some.steps), json(full.steps));
    const out = (a, b) => [...a.groups.keys()].filter(g => !b.groups.has(g));
    const present = names => names.filter(g => full.groups.has(g));
    assert.equal(json(out(full, fast)), json(present(['check-3d', 'check-keys', 'check-touch', 'revert-3d'])));
    assert.equal(json(out(full, some)), json(present(['check-3d', 'revert-3d'])));
    assert.equal(json(out(fast, full)), '[]');
    // What --fast keeps, it keeps whole.
    for (const [g, jobs] of fast.groups) assert.equal(json(jobs), json(full.groups.get(g)), g);
    // The full pool: the short sims, every check on disk (so a new one joins with no edit), and
    // the revert test while there is one.
    const checks = fs.readdirSync(path.join(root, 'tools/browser')).filter(n => /^check-.+\.mjs$/.test(n)).map(n => n.slice(0, -4)).sort();
    const revert = fs.existsSync(path.join(root, 'tools/revert-test.sh'));
    assert.equal(json([...full.groups.keys()]), json(['short-sims', ...checks].concat(revert ? ['revert-3d'] : [])));
    assert.ok(checks.includes('check-smoke') && checks.includes('check-screens'), json(checks));
    if (revert) {
      assert.ok(checks.includes('check-3d'), 'a tree with the revert test has the 3D check to leave out');
      const files = Runner.files(path.join(root, 'test'), '').filter(f => !Runner.ALONE.includes(f));
      assert.ok(files.length >= 50 && files.includes('m4-checkall.test.js') && !files.includes('m3-battery.test.js'));
      assert.equal(json(full.groups.get('revert-3d')), json(['revert-3d: copy and build', ...files.map(f => 'revert-3d: ' + f), 'revert-3d: check-smoke', 'revert-3d: check-screens']));
    }
    // A planted folder: only check-*.mjs files are checks.
    const dir = temp('checks');
    try {
      fs.mkdirSync(path.join(dir, 'tools/browser'), { recursive: true });
      for (const n of ['check-b.mjs', 'check-orient.mjs', 'lib.mjs', 'check-x.js', 'scenes.mjs', 'check-a.mjs']) fs.writeFileSync(path.join(dir, 'tools/browser', n), '');
      assert.equal(json(Pool.browserChecks(dir)), json(['check-a', 'check-b', 'check-orient']));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // Bad flags are refused before anything runs.
    for (const bad of [['--with', 'check-keys'], ['--fast', '--with', 'check-bag'], ['--fast', '--with'], ['--bogus'], ['--fast', '--timings']]) {
      const r = list(...bad);
      assert.equal(r.status, 2, `${bad.join(' ')}: ${r.stdout}`);
      assert.match(r.stdout, /^check-all: .+\nusage: \.\/check-all\.sh /, bad.join(' '));
    }
    assert.equal(json(Pool.FAST_LEAVES_OUT), json(['revert-3d', 'check-3d', 'check-keys', 'check-touch']));
  });

  test('check-all\'s last line counts every step and job; a failure, a skip without --allow-skip, or a pool that did not finish fails it', () => {
    const dir = temp('summary');
    try {
      const summary = (lines, ...flags) => {
        const file = path.join(dir, 'results');
        fs.writeFileSync(file, [`start ${Date.now()}`].concat(lines).join('\n') + '\n');
        const r = spawnSync(process.execPath, [path.join(root, 'tools/pool.js'), '--summary', '--results', file, ...flags], { encoding: 'utf8' });
        return { code: r.status, last: r.stdout.trimEnd().split('\n').pop(), out: r.stdout };
      };
      const steps = ['step lint-core pass 200 400', 'step tests pass 96000 344000', 'step build pass 100 100'];
      const pool = ['group short-sims pass 28000 24000', 'group check-smoke pass 2800 2800', 'pool 183000 675000 4'];
      let r = summary(steps.concat(pool));
      assert.equal(json([r.code, r.last]), json([0, 'check-all: 5 passed, 0 skipped, 0 failed']), r.out);
      assert.match(r.out, /^  Node tests +96\.0 s +344\.0 CPU-s  budget 175 s, 650 CPU-s$/m);
      assert.match(r.out, /^  the pool \(4 slots\) +183\.0 s +675\.0 CPU-s  budget 320 s$/m);
      r = summary(steps.concat(['group check-smoke fail 2800 2800', 'pool 183000 675000 4']), '--fast');
      assert.equal(json([r.code, r.last]), json([1, 'check-all --fast (left out: revert-3d, check-3d, check-keys, check-touch): 3 passed, 0 skipped, 1 failed (check-smoke)']), r.out);
      assert.ok(!/budget 175 s/.test(r.out), 'a fast run is not held to the full run\'s step budgets');
      r = summary(steps.concat(['group check-smoke skip 0 0', 'pool 183000 675000 4']));
      assert.equal(json([r.code, r.last]), json([1, 'check-all: 3 passed, 1 skipped (check-smoke), 0 failed']));
      assert.equal(summary(steps.concat(['group check-smoke skip 0 0', 'pool 183000 675000 4']), '--allow-skip').code, 0);
      // A step whose timer stopped (check-all.sh records it failed) and no pool line at all.
      r = summary(['step lint-core pass 200 400', 'step tests fail 0 0', 'step build pass 100 100']);
      assert.equal(json([r.code, r.last]), json([1, 'check-all: 2 passed, 0 skipped, 2 failed (tests pool)']), r.out);
      assert.match(r.out, /the pool did not finish/);
      r = summary(steps.concat(['group short-sims pass 28000 24000', 'group pool fail 0 0']));
      assert.equal(json([r.code, r.last]), json([1, 'check-all: 4 passed, 0 skipped, 1 failed (pool)']), r.out);
      // The step budgets flag a step over them.
      assert.match(summary(['step tests pass 200000 700000'].concat(pool)).out, /^  Node tests +200\.0 s +700\.0 CPU-s  budget 175 s, 650 CPU-s OVER$/m);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('the short battery\'s gate is CPU time: under busy loops in other processes on its CPU, its wall time is over a gate its CPU time keeps', () => {
    const script = `const B = require(${json(path.join(root, 'tools/battery.js'))}); const r = B.run([{ kind: 'monkey', room: 'T0', seed: 1, actions: 800, name: 'the test room, 800 actions' }]); console.log(JSON.stringify({ ms: r.ms, cpuMs: r.cpuMs, pass: r.pass }));`;
    const battery = prefix => {
      const r = spawnSync(prefix[0], prefix.slice(1).concat([process.execPath, '-e', script]), { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const x = JSON.parse(r.stdout.trim().split('\n').pop());
      assert.ok(x.pass, json(x));
      return x;
    };
    // On Linux, the battery and three busy loops share one CPU, so it gets about a quarter of
    // it; elsewhere, it runs at a lower priority than a busy loop on every CPU. Its CPU time
    // moves a little under such load (sharing a CPU costs some), so the gate is twice it quiet.
    const cpu = String(os.cpus().length - 1);
    const pinned = spawnSync('taskset', ['-c', cpu, 'true']).status === 0;
    const prefix = pinned ? ['taskset', '-c', cpu] : ['nice', '-n', '10'];
    const quiet = battery(prefix);
    const loops = [];
    try {
      const spin = [process.execPath, '-e', 'for (;;) {}'], loop = pinned ? prefix.concat(spin) : spin;
      for (let i = 0; i < (pinned ? 3 : os.cpus().length); i++) loops.push(require('node:child_process').spawn(loop[0], loop.slice(1), { stdio: 'ignore' }));
      const loaded = battery(prefix);
      const gate = 2 * quiet.cpuMs / 1000;
      // The load was real: the battery had at most half a CPU.
      assert.ok(loaded.ms >= 2 * loaded.cpuMs, `quiet ${json(quiet)}, loaded ${json(loaded)}`);
      // The gate holds on CPU time; held to wall time it would have failed.
      assert.equal(Battery.overGate(loaded, gate), null, `quiet ${json(quiet)}, loaded ${json(loaded)}, gate ${gate} CPU-s`);
      assert.ok(Battery.overGate({ cpuMs: loaded.ms }, gate), `a wall-clock gate would have passed too, so the load showed nothing: quiet ${json(quiet)}, loaded ${json(loaded)}`);
      assert.match(Battery.overGate({ cpuMs: 61000 }, 60), /^battery: 61\.0 CPU-s is over the gate of 60 CPU-s$/);
      assert.equal(Battery.GATE_CPU_MS, 60000);
    } finally { for (const l of loops) l.kill('SIGKILL'); }
  });

  test('the runner shares files out the longest first by timings.json, reckons an untimed file from its size, runs one file by --file, and records CPU times', () => {
    const dir = temp('runner');
    try {
      const mark = (name, pad) => `module.exports = ({ test }) => { test('${name}', () => { console.log('RAN ${name}'); }); };\n${'//'.padEnd(pad, 'x')}\n`;
      fs.writeFileSync(path.join(dir, 'a.test.js'), mark('a', 100));
      fs.writeFileSync(path.join(dir, 'b.test.js'), mark('b', 1000));
      fs.writeFileSync(path.join(dir, 'c.test.js'), mark('c', 300));
      fs.writeFileSync(path.join(dir, 'd.test.js'), mark('d', 10));
      fs.writeFileSync(path.join(dir, Runner.TIMINGS), json({ files: { 'a.test.js': 900, 'b.test.js': 100, 'd.test.js': 500, 'gone.test.js': 7 }, jobs: { 'check-x': 1234 } }));
      const list = Runner.files(dir, ''), size = f => fs.statSync(path.join(dir, f)).size;
      const est = Runner.estimates(dir, list);
      // c is untimed: its size times the median CPU-ms a byte of a, b and d.
      const rates = ['a.test.js', 'b.test.js', 'd.test.js'].map(f => Runner.timings(dir).files[f] / size(f)).sort((x, y) => x - y);
      assert.equal(json([est['a.test.js'], est['b.test.js'], est['d.test.js']]), json([900, 100, 500]));
      assert.equal(est['c.test.js'], Math.round(size('c.test.js') * rates[1]));
      // The longest first, each to the worker with the least so far.
      const e = { 'a.test.js': 900, 'b.test.js': 100, 'c.test.js': 600, 'd.test.js': 500 };
      assert.equal(json(Runner.share(dir, list, 2, e)), json([['a.test.js', 'b.test.js'], ['c.test.js', 'd.test.js']]));
      assert.equal(json(Runner.share(dir, list, 3, e)), json([['a.test.js'], ['c.test.js'], ['d.test.js', 'b.test.js']]));
      // With no timings.json, by size.
      fs.renameSync(path.join(dir, Runner.TIMINGS), path.join(dir, 'kept.json'));
      assert.equal(json(Runner.share(dir, list, 2)), json([['b.test.js'], ['c.test.js', 'a.test.js', 'd.test.js']]));
      fs.renameSync(path.join(dir, 'kept.json'), path.join(dir, Runner.TIMINGS));
      const run = (...a) => spawnSync(process.execPath, [path.join(root, 'test/run.js'), ...a], { encoding: 'utf8', env: Object.assign({}, process.env, { ACCESSION_TEST_DIR: dir, ACCESSION_TEST_JOBS: '2' }) });
      let r = run('--file=c.test.js');
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(json(r.stdout.match(/RAN \w/g)), json(['RAN c']));
      assert.match(r.stdout, /^tests: 1\/1 passed in \d+ ms \(\d+\.\d CPU-s, 1 process\)$/m);
      r = run('--file=nope.test.js');
      assert.equal(r.status, 1);
      assert.match(r.stdout, /there is no test file nope\.test\.js/);
      r = run('--write-timings');
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /tests: 4\/4 passed in \d+ ms \(\d+\.\d CPU-s, 2 workers\)/);
      const t = JSON.parse(fs.readFileSync(path.join(dir, Runner.TIMINGS), 'utf8'));
      assert.equal(json(Object.keys(t.files)), json(['a.test.js', 'b.test.js', 'c.test.js', 'd.test.js']), 'every file timed, in order, the one gone dropped');
      assert.ok(Object.values(t.files).every(ms => Number.isInteger(ms) && ms >= 10 && ms % 10 === 0), json(t.files));
      assert.equal(json(t.jobs), json({ 'check-x': 1234 }), 'the pool\'s times are kept');
      assert.match(t.about, /Generated/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // This tree's timings.json is the runner's and the pool's, and names only files and jobs it has.
    const t = Runner.timings(path.join(root, 'test')), all = Runner.files(path.join(root, 'test'), '');
    for (const f of Object.keys(t.files)) assert.ok(all.includes(f), `timings.json times ${f}, which is not a test file`);
  });

  test('the budgets check-all prints are BUILD.md §10.2\'s', () => {
    const build = fs.readFileSync(path.join(root, 'BUILD.md'), 'utf8');
    const at = build.indexOf('**Budgets,**');
    assert.ok(at > 0, 'BUILD.md has no budgets');
    const rows = build.slice(at).split('\n\n')[1].split('\n').filter(l => /^\s*\| [^-]/.test(l)).slice(1).map(l => l.split('|').map(c => c.trim()).filter(Boolean));
    const B = Pool.BUDGETS;
    assert.equal(json(rows), json([
      ['Lints, art and linked builds', `≤ ${B.lints.wall} s`],
      ['Node tests', `≤ ${B.tests.cpu} CPU-s, ≤ ${B.tests.wall} s`],
      ['The build', `≤ ${B.build.wall} s`],
      ['The pool', `≤ ${B.pool.wall} s`],
      ['The full check-all', `≤ ${B.total.wall} s`],
      ['The short battery (its gate)', `≤ ${B.shortSims.cpu} CPU-s`],
      ['`--fast` on 2 CPUs', `≤ ${B.fast.wall} s`],
    ]));
    assert.equal(Battery.GATE_CPU_MS, B.shortSims.cpu * 1000);
  });
};
