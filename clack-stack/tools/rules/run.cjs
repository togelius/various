'use strict';
// The rules tiers (DESIGN §18.8), revision 5d:
//   node tools/rules/run.cjs --tier=1 [--workers=4] [--compare=path|none] [--out=dir] [--resume] [--depth=7] [--mutant-depth=6]
//                                     [--diff=path/to/other-rules.js]
//   node tools/rules/run.cjs --tier=2 [--workers=4] [--compare=path|none] [--out=dir] [--resume] [--depth=10] [--diff=…]
// (also through node tools/run.cjs --tier=N).
// Tier 1, on every rules change, about 10 minutes: rules.js loads pure; the golden cases through rules.js; the
// exhaustive enumeration to depth 7 with every invariant (I1, the game equals the oracle field by field on every drop,
// when there is a SPEC 5d oracle); the coverage floors; the mutants (killed by golden and the enumeration to depth 6);
// and fitsAll's speed on 40-tile builds (the game calls it every frame while aiming). --diff=<another rules.js> (such
// as revision 5c's) also counts, over the enumeration, the drops whose outcome those rules give otherwise.
// Tier 2, at G2 and before release, hours: the enumeration to depth 10 with I1 on every drop. It writes a checkpoint in
// its report directory after every finished chunk and depth, so a run the machine cut short goes on with --resume.
// I1 runs when there is a SPEC 5d oracle: --compare=path, or by default tools/oracle/oracle.cjs if it is sealed
// (tools/oracle/SEALED) and answers SPEC 5d (enumerate.cjs defaultOracle); --compare=none runs rules-only (tier 2
// rules-only too, which proves the invariants to depth 10 but not I1). OPEN lines are disagreements triaged as
// questions SPEC.md does not decide (enumerate.cjs OPEN): reported on every run, they do not fail it. One line per
// check; exit code 0 when no line FAILs.
const fs = require('fs');
const path = require('path');
const os = require('os');
const rulesVm = require('../lib/rules-vm.cjs');
const { runGolden } = require('./golden.cjs');
const E = require('./enumerate.cjs');
const { runAll } = require('./mutants.cjs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const tier = +arg('tier', 1);
const ORACLE = E.ORACLE;
const SCRATCH = '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5d';
const LABEL = {
  I1: 'I1 the game equals the oracle (SPEC §8, field by field, every drop, forced way and none)', I1CACHE: 'I1 the oracle cache gives what a fresh oracle drop gives (sampled)', I2: 'I2 fitsAll equals drop', I3: 'I3 drop is pure',
  I4: 'I4 tile order makes no difference (every build rebuilds from its tiles; key() is canonical)',
  I5: 'I5 mirror symmetry (a TIPS OVER: the mirror group and side; the base may differ by the col tie rule)', I6: 'I6 translation on a wide base', I7: 'I7 locality (a far tile changes a drop only through a group the drop joins)', I8: 'I8 replaying the drop log rebuilds the build',
  I9: 'I9 re-dropping a top tile puts it back', I10: 'I10 state: no overlap, lattice, whole-tile squares, joined to the car, every tile held by at least half an edge, every piece\'s group balanced',
  I11: 'I11 at most one way up fits at a column', I12: 'I12 pull obeys §18.6', I13: 'I13 the shine explains the outcome, and a TIPS OVER names the group SPEC §5c reports (base, members, side, pivot), which really is unbalanced',
  FORMAT: 'comparison format (SPEC §8, tips included)', GAP: 'the gap of SPEC §5a, recomputed from the polygons',
  OUTLINE: 'meeting the tower edge to edge depends only on the top outline under the tile', AUTO: 'no way given: the way of SPEC §6 (the neither-fits rule included)', THROWS: 'the API throws where SPEC §2 says, and only there'
};

let failed = 0;
function line(ok, what, ms, extra) {
  if (ok === false) failed++;
  console.log(`${ok === null ? 'SKIP' : ok === 'OPEN' ? 'OPEN' : ok === 'INFO' ? 'INFO' : ok ? 'PASS' : 'FAIL'} ${what}${extra ? ': ' + extra : ''}${ms !== undefined ? ` (${(ms / 1000).toFixed(1)} s)` : ''}`);
}

// fitsAll on 40-tile builds: the first call on a build (nothing cached) and every later call (the hand's every frame)
function fitsAllSpeed(R) {
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const build = n => {
    for (let tries = 0; tries < 200; tries++) {
      let B = R.newBuild({ half: 2 });
      for (let i = 0; i < n; i++) {
        const piece = rnd() < 0.7 ? 'sq' : 'tri';
        let opts = R.fitsAll(B, piece).filter(r => r.outcome === 'fit');
        if (!opts.length) opts = R.fitsAll(B, piece === 'sq' ? 'tri' : 'sq').filter(r => r.outcome === 'fit');
        if (!opts.length) break;
        B = R.place(B, opts[Math.floor(rnd() * opts.length)]);
      }
      if (B.tiles.length === n) return B;
    }
    return null;
  };
  // the first call on a build: cycle through more builds than rules.js keeps answers for (8), so none is kept
  const Bs = [];
  for (let k = 0; k < 10; k++) { const B = build(40); if (B) Bs.push(B); }
  const out = { cold: 0, warm: 0, builds: Bs.length };
  if (Bs.length < 10) return out;
  for (const piece of ['sq', 'tri']) {
    const N = 60;
    let t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) for (const B of Bs) R.fitsAll(B, piece);
    out.cold = Math.max(out.cold, Number(process.hrtime.bigint() - t0) / 1000 / N / Bs.length);
    for (const B of Bs) {
      R.fitsAll(B, piece);
      t0 = process.hrtime.bigint();
      for (let i = 0; i < N * 5; i++) R.fitsAll(B, piece);
      out.warm = Math.max(out.warm, Number(process.hrtime.bigint() - t0) / 1000 / N / 5);
    }
  }
  return out;
}

async function rulesTier(cfg) {
  const T0 = Date.now();
  const depth = +arg('depth', cfg.depth), workers = +arg('workers', Math.min(4, os.cpus().length));
  const cmpArg = arg('compare', null), probe = E.defaultOracle();
  const compare = cmpArg === 'none' ? null : cmpArg ? path.resolve(cmpArg) : probe.path;
  const oracleDepth = +arg('oracle-depth', depth);
  const open = new Set(); let t;
  const diff = arg('diff', null);
  console.log(`tier ${tier}: revision 5d rules, enumeration to depth ${depth}${cfg.mutants ? ', mutants' : ''}${compare ? ', I1 against ' + compare : ', rules-only'}${diff ? ', diff against ' + diff : ''}`);
  if (!compare) {
    if (cfg.needsOracle && cmpArg !== 'none') { line(false, 'the oracle (I1)', undefined, probe.why + '; tier 2 is the I1 run (--compare=none runs it rules-only)'); return; }
    else line(null, 'the oracle (I1)', undefined, cmpArg === 'none' ? 'rules-only run (--compare=none)' : probe.why);
  }
  // the oracle: sealed, and its own golden cases
  if (compare === ORACLE) {
    t = Date.now();
    const sealed = path.join(path.dirname(ORACLE), 'SEALED');
    const want = fs.existsSync(sealed) ? (fs.readFileSync(sealed, 'utf8').match(/^([0-9a-f]{64})\s+oracle\.cjs$/m) || [])[1] : null;
    const have = crypto.createHash('sha256').update(fs.readFileSync(ORACLE)).digest('hex');
    line(!!want && want === have, 'the oracle is the sealed one (tools/oracle/SEALED)', Date.now() - t, want ? (want === have ? have.slice(0, 16) + '…' : 'oracle.cjs is ' + have.slice(0, 16) + '…, SEALED says ' + want.slice(0, 16) + '…') : 'no SEALED file');
    t = Date.now();
    const g = spawnSync(process.execPath, [path.join(path.dirname(ORACLE), 'test-golden.cjs')], { encoding: 'utf8' });
    const gl = (g.stdout || '').split('\n'), gfail = gl.filter(l => l.startsWith('FAIL golden')), gpass = gl.filter(l => l.startsWith('PASS golden')).length;
    line(!gfail.length && gpass > 0 && g.status === 0, 'the oracle passes its golden cases (tools/oracle/test-golden.cjs)', Date.now() - t, `${gpass}/${gpass + gfail.length}` + (gfail.length ? ' — ' + gfail.join(' | ') : ''));
  }
  // rules.js is pure and loads in an empty vm context
  t = Date.now(); let R = null;
  try { R = rulesVm.load(); line(true, 'rules.js loads in an empty vm context, with no DOM, time or randomness', Date.now() - t); }
  catch (e) { line(false, 'rules.js loads in an empty vm context', Date.now() - t, e.message); return; }
  line(JSON.stringify(R.REASONS) === JSON.stringify(['ONLY A POINT', 'TIPS OVER']), 'REASONS in precedence order (DESIGN §18.7)', undefined, JSON.stringify(R.REASONS));
  // golden
  t = Date.now();
  const g = runGolden(R), gbad = g.filter(r => !r.ok);
  line(!gbad.length, 'golden cases (§18.9, SPEC §9: 1–18, the regression cases R1–R5, and §6\'s way pairs)', Date.now() - t, `${g.length - gbad.length}/${g.length}` + (gbad.length ? ' — ' + gbad.map(r => r.n + ': ' + r.msg).join(' | ') : ''));
  // fitsAll speed
  if (cfg.speed) {
    t = Date.now();
    const sp = fitsAllSpeed(R);
    line(sp.builds > 0 && sp.cold < 2000 && sp.warm < 100, 'fitsAll is fast enough for every frame (40-tile builds; bars: 2 ms on a new build, 0.1 ms after)', Date.now() - t,
      `${sp.builds} random builds; ■ and △ (both ways): ${sp.cold.toFixed(0)} µs a call on a new build (mean; worst piece), ${sp.warm.toFixed(1)} µs on every later call (worst build; rules.js keeps the last 8 builds' drops)`);
  }
  // enumeration and invariants
  const out = arg('out', cfg.out);
  t = Date.now();
  const fmtO = o => o ? `; oracle ${o.drops} drops, cache hits ${o.hits}, misses ${o.misses}, verified ${o.verified}` : '';
  const res = await E.enumerate({ depth, half: 2, workers, compare, oracleDepth, fullTo: 6, sampleHeavy: 8, checkpoint: path.join(out, 'checkpoint'), resume: process.argv.includes('--resume'), diff,
    onDepth: (p, s, restored) => console.log(`     depth ${p.depth}: ${p.builds} builds (${(p.ms / 1000).toFixed(1)} s${fmtO(p.oracle)})${restored ? ' [from the checkpoint]' : p.chunksReused ? ` [${p.chunksReused} chunks from the checkpoint]` : ''}`) });
  if (res.resumed) console.log(`     resumed at depth ${res.resumed.fromDepth}, after ${(res.resumed.elapsedBefore / 1000).toFixed(1)} s of enumeration before the restart`);
  const sum = E.writeReports(out, res, { depth, half: 2, compare, oracleDepth, diff });
  line(true, `enumeration to depth ${depth} on the real base (mirror images merged)`, res.ms, `${sum.builds} builds, ${sum.drops} drops; per depth ${JSON.stringify(sum.buildsPerDepth)}`);
  for (const k of E.INVS) {
    if ((k === 'I1' || k === 'I1CACHE') && !compare) continue;
    const n = sum.checks[k], f = sum.failCount[k];
    const ex = sum.fails.find(x => x.inv === k);
    line(!f && n > 0, LABEL[k] + (k === 'I1' ? ` to depth ${sum.oracleDepth}` : ''), undefined, `${n} checks` + (f ? `, ${f} failed — ${ex ? ex.msg + (ex.log ? ' after ' + ex.log : '') : ''}` : '') +
      (k === 'I1' ? `; ${sum.oracleDrops} oracle drops, cache hits ${sum.oracleCache.hits} misses ${sum.oracleCache.misses}` : ''));
    if (k === 'I1') {
      for (const c of sum.i1.filter(c => !c.open)) console.log(`     DIFF ${c.n}× ${c.label}; e.g. ${c.examples[0].log.join(' ') || '(bare car)'} then ${JSON.stringify(c.examples[0].drop)}`);
      for (const o of E.OPEN) {
        const cs = sum.i1.filter(c => c.open === o.id);
        if (!cs.length) continue;
        open.add(o.id);
        line('OPEN', `${o.id} ${o.what}`, undefined, cs.map(c => `${c.n}× ${c.label.replace(/^outside §2 cols: /, '')}`).join('; ') + `; e.g. ${cs[0].examples[0].log.join(' ')} then ${JSON.stringify(cs[0].examples[0].drop)}`);
      }
    }
  }
  // coverage floors and near misses
  for (const fl of sum.floors) line(fl.n >= fl.min, 'coverage: ' + fl.what, undefined, `${fl.n} (floor ${fl.min})`);
  // TIPS OVER, and what the balance leaves standing
  const tt = sum.tips;
  for (const pc of ['■', '▲', '▼']) {
    const r = tt[pc];
    line('INFO', `TIPS OVER ${pc} (forced way)`, undefined, `${r.all}; by side ${JSON.stringify(r.side)}; by tiles in the reported piece ${JSON.stringify(r.piece)}; by tiles in its group ${JSON.stringify(r.group)}; the piece is ${JSON.stringify(r.base)}`);
  }
  line('INFO', 'which of SPEC §5c\'s rules picked the group reported (TIPS OVER, forced ways)', undefined, JSON.stringify(sum.ties));
  line('INFO', 'neither way up fits a triangle (forced ways at one column)', undefined, JSON.stringify(tt.neitherWayFits));
  if (Object.keys(tt.locality).length) line('INFO', 'I7: a tile added away from a drop, in a group the drop joins', undefined, JSON.stringify(tt.locality));
  const xs = sum.extremes, fx = k => xs[k] ? `${JSON.stringify(xs[k].value)} after ${xs[k].log.join(' ')}` : 'none';
  line('INFO', 'locks made by fitting drops, by direction', undefined, JSON.stringify(Object.fromEntries(Object.entries(sum.locks).filter(([k]) => /fits locking/.test(k)))));
  line('INFO', 'the largest locked piece', undefined, fx('largest locked piece (tiles)'));
  line('INFO', 'the tallest group standing on half an edge', undefined, fx('tallest group standing on half an edge (from its foot to its top, tiles)'));
  line('INFO', 'the tallest group of a locked piece (2+ tiles) standing on half an edge', undefined, fx('tallest group of a locked piece (2+ tiles) standing on half an edge (tiles)'));
  line('INFO', 'knife-edges: groups exactly over an end of their support (summed over builds)', undefined, `${sum.locks['groups exactly over an end of their support (knife-edge), summed over builds'] || 0}; the most tiles in one: ${fx('most tiles in a group exactly over an end of its support')}`);
  line('INFO', 'the tallest structure standing on a hung ▼', undefined, fx('tallest structure standing on a ▼ held by one side (its height above the ▼\'s top, tiles)'));
  line('INFO', 'nothing fits at all (no square, no triangle either way, anywhere)', undefined, `${sum.noFit} of ${sum.builds} builds` + (sum.nothingFits.length ? '; e.g. ' + sum.nothingFits.map(e => e.log.join(' ')).join(' | ') : ''));
  line('INFO', 'builds that do not rebuild lowest first (a counterweight must come before the tile it balances)', undefined, `${sum.reordered} of ${sum.builds}`);
  console.log(`INFO both ways fit at ${sum.bothWays.cols} of ${sum.bothWays.ofTriangleCols} triangle columns; no square fits on ${sum.noSquare} of ${sum.builds} builds, no triangle on ${sum.noTriangle}; ▼ fits: ${sum.notchDown} in a notch, ${sum.oneSideDown} by one side, ${sum.pointAir} with the point in the air`);
  if (diff) {
    const d = sum.diff;
    line('INFO', `the other rules (${diff}) on the same builds`, undefined, `${d.builds || 0} of ${sum.builds} builds can be made by them too (${d['builds the other rules cannot make'] || 0} cannot)`);
    for (const m of ['sq', 'up', 'down', 'auto']) {
      const ks = Object.keys(d).filter(k => k.startsWith(m + ': '));
      line('INFO', `diff, ${m === 'auto' ? 'triangles with no way given' : m === 'sq' ? 'squares' : 'triangles forced ' + m}`, undefined, `${d[m + ' drops'] || 0} drops; ` + (ks.length ? ks.map(k => `${k.slice(m.length + 2)}: ${d[k]}`).join('; ') : 'no change'));
    }
  }
  // mutants
  if (cfg.mutants) {
    t = Date.now();
    const md = +arg('mutant-depth', 6);
    const M = await runAll({ depth: md, jobs: workers, compare });
    const alive = M.filter(m => !m.killed && !m.equivalent), eq = M.filter(m => !m.killed && m.equivalent), bal = M.filter(m => /^(balance|lock):/.test(m.what)), locks = M.filter(m => /^lock:/.test(m.what));
    line(!alive.length && M.length >= 15 && bal.length >= 10 && locks.filter(m => m.killed).length >= 10, `mutants killed by golden + enumeration to depth ${md} + invariants` + (compare ? ' (I1 among them)' : ''), Date.now() - t, `${M.length - alive.length - eq.length}/${M.length} killed (${bal.length} balance mutants, ${locks.length} of them lock mutants, ${locks.filter(m => m.killed).length} of those killed)` + (eq.length ? `; ${eq.length} equivalent` : '') + (alive.length ? ' — survivors: ' + alive.map(m => m.name).join(', ') : '') +
      (compare ? `; I1 alone kills ${M.filter(m => m.i1).length}/${M.length} (not: ${M.filter(m => !m.i1).map(m => m.name).join(', ') || 'none'})` : ''));
    for (const m of bal) console.log(`     ${m.killed ? 'killed  ' : m.equivalent ? 'EQUIVAL.' : 'SURVIVED'} ${m.name}: ${m.by.join('; ').slice(0, 220)}`);
    if (eq.length) { open.add('mutants'); line('OPEN', `mutants no build tells apart from the rules (marked equivalent in mutants.json): ${eq.map(m => m.name).join(', ')}`, undefined, eq[0].equivalent.slice(0, 200) + '…'); }
    fs.writeFileSync(path.join(out, 'mutants.json'), JSON.stringify(M, null, 1));
  }
  console.log(`${failed ? 'FAIL' : 'PASS'} tier ${tier}: ${failed} failing check(s), ${open.size} open question(s) for the designer${open.size ? ' (' + [...open].join(', ') + ')' : ''}, in ${((Date.now() - T0 + (res.resumed ? res.resumed.elapsedBefore : 0)) / 1000).toFixed(1)} s${res.resumed ? ' (with the enumeration before the restart)' : ''}; reports in ${out}`);
}

(async () => {
  if (tier === 1) await rulesTier({ depth: 7, mutants: true, speed: true, out: path.join(SCRATCH, 'tier1') });
  else if (tier === 2) {
    await rulesTier({ depth: 10, mutants: false, speed: false, needsOracle: true, out: path.join(SCRATCH, 'tier2') });
    console.log('INFO not built yet in tier 2 (DESIGN §18.8): the 2-wide base to depth 14 and the million fuzz drops');
  } else { console.log(`tier ${tier} is not part of the rules tiers (tier 3 is the browser tests, tier 4 the agent-run checks)`); failed++; }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
