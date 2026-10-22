'use strict';
// Golden cases of SPEC.md §9 (half = 2). Exit code 0 iff every case passes.
// --loose-cols : build with strictCols:false (not the spec; shows golden 5 apart from the col table)
// -v           : print every drop's result
const { newBuild, drop, place } = require('./oracle.cjs');

const LOOSE = process.argv.includes('--loose-cols');
const VERBOSE = process.argv.includes('-v');
const H = [0, 1]; // sqrt3/2 as [p,q]

// '■1' -> square at x=1 (col 2); '▲-0.5' -> up at col -1; '▼2' -> down at col 4
function parse(tok) {
  const sym = tok[0], x = Number(tok.slice(1));
  const col = Math.round(2 * x);
  if (col !== 2 * x) throw new Error(`bad token ${tok}`);
  if (sym === '■') return { tok, piece: 'sq', col, way: undefined };
  if (sym === '▲') return { tok, piece: 'tri', col, way: 'up' };
  if (sym === '▼') return { tok, piece: 'tri', col, way: 'down' };
  throw new Error(`bad token ${tok}`);
}
const J = (v) => JSON.stringify(v);
const seg = (a, b) => [a, b];

// expect: {outcome, reason, gap?} for the last drop; check(results) for the notes in the spec text
const CASES = [
  { n: 1, drops: '■1 ▲1.5', expect: { outcome: 'off', reason: 'OVER THE EDGE' } },
  { n: 2, drops: '▲-2 ▲-1 ▲0 ▼-1.5 ▼-0.5 ■-1', expect: { outcome: 'fit' },
    note: 'spans two ▼ tops meeting over ▲−1\'s apex',
    check: (rs) => {
      const r = rs[5];
      // bottom edge at y=h on [-1,-0.5] (top of ▼-1.5) and [-0.5,0] (top of ▼-0.5); apex (-0.5,h) under the seam
      const want = [seg([-2, ...H], [-1, ...H]), seg([-1, ...H], [0, ...H])];
      const have = r.contacts.segments.filter((s) => s[0][1] === 0 && s[0][2] === 1 && s[1][1] === 0 && s[1][2] === 1);
      return J(have) === J(want) && J(r.verts[0]) === J([-2, ...H]) ? null : `bottom contacts ${J(have)}`;
    } },
  { n: 3, drops: '▲-1.5 ▲-0.5 ■-1', expect: { outcome: 'off', reason: 'ONLY A POINT' } },
  { n: 4, drops: '▲1 ▼1.5', expect: { outcome: 'fit' },
    note: 'hung by one side; free half over air beyond the car',
    check: (rs) => {
      const r = rs[1];
      const side = seg([3, ...H], [4, 0, 0]); // ▼ lower-left side = ▲1 right slant
      if (!r.contacts.segments.some((s) => J(s) === J(side))) return `no side contact ${J(r.contacts.segments)}`;
      return J(r.strips) === J([true, false]) ? null : `strips ${J(r.strips)}`;
    } },
  { n: 5, drops: '▲1 ▼1.5 ▲1.5 ▼2', expect: { outcome: 'off', reason: 'TOO FAR OUT' } },
  { n: 6, drops: '■-1 ■-1 ▲-1 ▼-1.5 ▲-1.5 ▼-2', expect: { outcome: 'off', reason: 'TOO FAR OUT' },
    note: 'second ■−1 on the first; ▲−1 on the column; ▼−1.5 on ▲−1 left side, left strip over air; ▲−1.5 on ▼−1.5 top; ▼−2 on ▲−1.5 left side, no pocket',
    check: (rs) => {
      const yb = (r) => r.verts.reduce((m, v) => (v[1] < m[1] || (v[1] === m[1] && v[2] < m[2]) ? v : m));
      if (J(yb(rs[1]).slice(1)) !== J([2, 0])) return `second square base ${J(yb(rs[1]))}`;
      if (J(yb(rs[2]).slice(1)) !== J([4, 0])) return `▲-1 base ${J(yb(rs[2]))}`;
      const hasSeg = (r, s) => r.contacts.segments.some((t) => J(t) === J(s));
      if (!hasSeg(rs[3], seg([-2, 4, 0], [-1, 4, 1]))) return `▼-1.5 not on ▲-1 left side ${J(rs[3].contacts.segments)}`;
      if (J(rs[3].strips) !== J([false, true])) return `▼-1.5 strips ${J(rs[3].strips)}`;
      if (!hasSeg(rs[4], seg([-3, 4, 1], [-1, 4, 1]))) return `▲-1.5 not on ▼-1.5 top ${J(rs[4].contacts.segments)}`;
      if (!hasSeg(rs[5], seg([-3, 4, 1], [-2, 4, 2]))) return `▼-2 not on ▲-1.5 left side ${J(rs[5].contacts.segments)}`;
      return J(rs[5].strips) === J([false, false]) ? null : `▼-2 strips ${J(rs[5].strips)}`;
    } },
  { n: 7, drops: '■-2 ▲-0.5 ▼-1 ▲-1.5', expect: { outcome: 'off', reason: 'NOT LEVEL', gap: [2, -1] } },
  { n: 8, drops: '■-1 ■0 ▲-0.5', expect: { outcome: 'fit' } },
  { n: 9, drops: '▲-1 ▼-0.5 ▲0', expect: { outcome: 'off', reason: 'NOT LEVEL' } },
  { n: 10, drops: '▲0 ▲0', expect: { outcome: 'off', reason: 'ONLY A POINT' } },
  { n: 11, drops: null, expect: { throws: true }, run: (b) => drop(b, 'sq', -1) },
  { n: 12, drops: '■-1 ■0 ▲-1 ▲0 ▼-0.5 ▼-1.5 ▼0.5 ▲-1.5 ▲-0.5 ▲0.5 ▼-1 ▼0 ■-1 ■0', expect: { allFit: true } },
];

let failed = 0;
for (const c of CASES) {
  let b = newBuild({ half: 2, strictCols: !LOOSE });
  let verdict = null;
  const rs = [];
  try {
    if (c.run) {
      try { const r = c.run(b); verdict = `expected a throw, got ${J(r)}`; } catch (e) { verdict = null; if (VERBOSE) console.log(`   throws: ${e.message}`); }
    } else {
      const ds = c.drops.split(/\s+/).map(parse);
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        let r;
        try { r = drop(b, d.piece, d.col, d.way); } catch (e) { verdict = `drop ${i + 1} (${d.tok}, col ${d.col}) threw: ${e.message}`; break; }
        rs.push(r);
        if (VERBOSE) console.log(`   ${d.tok.padEnd(6)} ${J(r)}`);
        const last = i === ds.length - 1;
        if (!last || c.expect.allFit) {
          if (r.outcome !== 'fit') { verdict = `drop ${i + 1} (${d.tok}) should fit, got ${r.outcome} ${r.reason}`; break; }
          b = place(b, r);
          continue;
        }
        const e = c.expect;
        if (r.outcome !== e.outcome) { verdict = `got ${r.outcome} ${r.reason}`; break; }
        if (e.reason !== undefined && r.reason !== e.reason) { verdict = `got reason ${r.reason}`; break; }
        if (e.gap !== undefined && J(r.gap) !== J(e.gap)) { verdict = `got gap ${J(r.gap)}`; break; }
        if (e.outcome === 'fit') b = place(b, r);
      }
      if (verdict === null && c.check) verdict = c.check(rs);
    }
  } catch (e) {
    verdict = `error: ${e.stack}`;
  }
  const want = c.expect.throws ? 'throws' : c.expect.allFit ? 'every drop fits' :
    `${c.expect.outcome}${c.expect.reason ? ', ' + c.expect.reason : ''}${c.expect.gap ? ', gap ' + J(c.expect.gap) : ''}`;
  if (verdict === null) console.log(`PASS golden ${c.n}: ${want}${c.note ? '  [' + c.note + ']' : ''}`);
  else { failed++; console.log(`FAIL golden ${c.n}: want ${want}; ${verdict}`); }
}
console.log(`${CASES.length - failed}/${CASES.length} golden cases pass${LOOSE ? ' (strictCols:false, not the spec)' : ''}`);
process.exit(failed === 0 ? 0 : 1);
