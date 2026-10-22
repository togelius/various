'use strict';
// The rules tier (DESIGN §18.8): node tools/rules/run.cjs --tier=1 [--depth=10] [--oracle-depth=10] [--workers=4] [--compare=path]
// Tier 1: rules.js loads pure; the oracle is the sealed one (tools/oracle/SEALED) and passes its own golden cases; the
// golden cases through rules.js; the exhaustive enumeration to depth 10 with every invariant, I1 (the game equals the
// oracle, field by field on every drop, with and without a forced way) among them; the coverage floors and near
// misses; the mutants (killed by golden, the enumeration with I1, and I1 alone). One line per check, with times.
// OPEN lines are disagreements triaged as questions SPEC.md does not decide (enumerate.cjs OPEN): they are reported on
// every run but do not fail it. Exit code 0 when no line FAILs.
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
const ORACLE = path.join(__dirname, '..', 'oracle', 'oracle.cjs');
const LABEL = {
  I1: 'I1 the game equals the oracle (SPEC §8, field by field, every drop, forced way and none)', I1CACHE: 'I1 the oracle cache gives what a fresh oracle drop gives (sampled)', I2: 'I2 fitsAll equals drop', I3: 'I3 drop is pure', I4: 'I4 tile order makes no difference (and key() is canonical)',
  I5: 'I5 mirror symmetry', I6: 'I6 translation on a wide base', I7: 'I7 locality', I8: 'I8 replaying the drop log rebuilds the build',
  I9: 'I9 re-dropping a top tile puts it back', I10: 'I10 state: no overlap, lattice, whole-tile squares, joined to the car, fit rules, half off never more',
  I11: 'I11 at most one way up fits at a column', I12: 'I12 pull obeys §18.6', I13: 'I13 the shine explains the outcome',
  FORMAT: 'comparison format (SPEC §8)', POINT: 'a fitted ▼ rests its point on a flat top', SOME_TRI: 'some triangle fits on every build',
  OUTLINE: 'the outcome depends only on the top outline and the over-air strips', AUTO: 'no way given: the way of SPEC §6', THROWS: 'the API throws where SPEC §2 says'
};

let failed = 0;
function line(ok, what, ms, extra) {
  if (ok === false) failed++;
  console.log(`${ok === null ? 'SKIP' : ok === 'OPEN' ? 'OPEN' : ok ? 'PASS' : 'FAIL'} ${what}${extra ? ': ' + extra : ''}${ms !== undefined ? ` (${(ms / 1000).toFixed(1)} s)` : ''}`);
}

async function tier1() {
  const T0 = Date.now();
  const depth = +arg('depth', 10), workers = +arg('workers', Math.min(4, os.cpus().length));
  const compare = arg('compare', fs.existsSync(ORACLE) ? ORACLE : null);
  const oracleDepth = +arg('oracle-depth', depth);
  const open = new Set(); let t;
  // the oracle: sealed, and its own golden cases
  if (compare === ORACLE) {
    t = Date.now();
    const sealed = path.join(path.dirname(ORACLE), 'SEALED');
    const want = fs.existsSync(sealed) ? (fs.readFileSync(sealed, 'utf8').match(/^([0-9a-f]{64})\s+oracle\.cjs$/m) || [])[1] : null;
    const have = crypto.createHash('sha256').update(fs.readFileSync(ORACLE)).digest('hex');
    line(!!want && want === have, 'the oracle is the sealed one (tools/oracle/SEALED)', Date.now() - t, want ? (want === have ? have.slice(0, 16) + '…' : 'oracle.cjs is ' + have.slice(0, 16) + '…, SEALED says ' + want.slice(0, 16) + '…') : 'no SEALED file');
    t = Date.now();
    const g = spawnSync(process.execPath, [path.join(path.dirname(ORACLE), 'test-golden.cjs')], { encoding: 'utf8' });
    const gl = (g.stdout || '').split('\n'), gfail = gl.filter(l => l.startsWith('FAIL golden'));
    // golden 5 against SPEC §2's cols is the open question A1: the oracle throws on ▼2 (col 4), §9 expects TOO FAR OUT
    const gopen = gfail.filter(l => /^FAIL golden 5:.*threw: drop: col 4 outside the allowed triangle cols/.test(l));
    const gpass = gl.filter(l => l.startsWith('PASS golden')).length;
    line(gfail.length === gopen.length && gpass > 0, 'the oracle passes its golden cases (tools/oracle/test-golden.cjs)', Date.now() - t, `${gpass}/${gpass + gfail.length}` + (gopen.length ? ', golden 5 is open question A1' : '') + (gfail.length > gopen.length ? ' — ' + gfail.filter(l => !gopen.includes(l)).join(' | ') : ''));
    for (const l of gopen) { open.add('A1'); line('OPEN', 'A1 the oracle on golden 5', undefined, l.replace(/^FAIL /, '') + ' (SPEC §2 against §9; see the A1 line below)'); }
  }
  // rules.js is pure and loads in an empty vm context
  t = Date.now(); let R = null;
  try { R = rulesVm.load(); line(true, 'rules.js loads in an empty vm context, with no DOM, time or randomness', Date.now() - t); }
  catch (e) { line(false, 'rules.js loads in an empty vm context', Date.now() - t, e.message); return; }
  // golden
  t = Date.now();
  const g = runGolden(R), gbad = g.filter(r => !r.ok);
  line(!gbad.length, 'golden cases (§18.9, SPEC §9)', Date.now() - t, `${g.length - gbad.length}/${g.length}` + (gbad.length ? ' — ' + gbad.map(r => r.n + ': ' + r.msg).join(' | ') : ''));
  // enumeration and invariants
  t = Date.now();
  const res = await E.enumerate({ depth, half: 2, workers, compare, oracleDepth, fullTo: 6, sampleHeavy: 8 });
  const sum = E.writeReports(E.OUT_DEFAULT, res, { depth, half: 2, compare, oracleDepth });
  const tEnum = Date.now() - t;
  line(true, `enumeration to depth ${depth} on the real base (mirror images merged)`, tEnum, `${sum.builds} builds, ${sum.drops} drops; per depth ${JSON.stringify(sum.buildsPerDepth)}`);
  if (!compare) line(null, LABEL.I1, undefined, 'no oracle yet (tools/oracle/oracle.cjs, or --compare=path)');
  for (const k of E.INVS) {
    if (k === 'I1' && !compare) continue;
    const n = sum.checks[k], f = sum.failCount[k];
    const ex = sum.fails.find(x => x.inv === k);
    line(!f && n > 0, LABEL[k] + (k === 'I1' ? ` to depth ${sum.oracleDepth}` : ''), undefined, `${n} checks` + (f ? `, ${f} failed — ${ex ? ex.msg + (ex.log ? ' after ' + ex.log : '') : ''}` : '') +
      (k === 'I1' ? `; ${sum.oracleDrops} oracle drops, cache hits ${sum.oracleCache.hits} misses ${sum.oracleCache.misses}` : ''));
    if (k === 'I1') {
      // every disagreement class: the failing ones, then the open questions (grouped by question)
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
  // mutants
  t = Date.now();
  const M = await runAll({ depth: 6, jobs: workers, compare });
  const alive = M.filter(m => !m.killed);
  line(!alive.length && M.length >= 15, 'mutants killed by golden + enumeration to depth 6 + invariants' + (compare ? ' (I1 among them)' : ''), Date.now() - t, `${M.length - alive.length}/${M.length}` + (alive.length ? ' — survivors: ' + alive.map(m => m.name).join(', ') : '') +
    (compare ? `; I1 alone kills ${M.filter(m => m.i1).length}/${M.length} (not: ${M.filter(m => !m.i1).map(m => m.name).join(', ') || 'none'})` : ''));
  fs.writeFileSync(path.join(E.OUT_DEFAULT, 'mutants.json'), JSON.stringify(M, null, 1));
  console.log(`${failed ? 'FAIL' : 'PASS'} tier 1: ${failed} failing check(s), ${open.size} open question(s) for the designer${open.size ? ' (' + [...open].join(', ') + ')' : ''}, in ${((Date.now() - T0) / 1000).toFixed(1)} s; reports in ${E.OUT_DEFAULT}`);
}

(async () => {
  if (tier === 1) await tier1();
  else { console.log(`tier ${tier} is not built yet (DESIGN §18.8: tier 2 is depth 11, a 2-wide base to depth 14 and a million fuzz drops)`); failed++; }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
