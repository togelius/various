'use strict';
// Golden cases of SPEC.md §9 (revision 5b, half = 2). Exit code 0 iff every case passes.
// -v : print every drop's result
const { newBuild, drop, place } = require('./oracle.cjs');

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
const hasSeg = (r, s) => r.contacts.segments.some((t) => J(t) === J(s));

// expect: {outcome, reason, gap} for the last drop (gap is checked always: null unless given);
// check(results) checks the notes in the spec text
const CASES = [
  { n: 1, drops: '■1 ▲1.5', expect: { outcome: 'fit', gap: null },
    note: 'half its base on the square top, the other half past the car',
    check: (rs) => {
      const r = rs[1];
      if (J(r.verts) !== J([[3, 2, 0], [4, 2, 1], [5, 2, 0]])) return `verts ${J(r.verts)}`;
      return hasSeg(r, seg([3, 2, 0], [4, 2, 0])) ? null : `no contact on the square top ${J(r.contacts)}`;
    } },
  { n: 2, drops: '▲-2 ▲-1 ▲0 ▼-1.5 ▼-0.5 ■-1', expect: { outcome: 'fit', gap: null },
    note: 'spans two ▼ tops meeting over ▲−1\'s apex',
    check: (rs) => {
      const r = rs[5];
      // bottom edge at y=h on [-1,-0.5] (top of ▼-1.5) and [-0.5,0] (top of ▼-0.5); apex (-0.5,h) under the seam
      const want = [seg([-2, ...H], [-1, ...H]), seg([-1, ...H], [0, ...H])];
      const have = r.contacts.segments.filter((s) => s[0][1] === 0 && s[0][2] === 1 && s[1][1] === 0 && s[1][2] === 1);
      return J(have) === J(want) && J(r.verts[0]) === J([-2, ...H]) ? null : `bottom contacts ${J(have)}`;
    } },
  { n: 3, drops: '▲-1.5 ▲-0.5 ■-1', expect: { outcome: 'off', reason: 'ONLY A POINT' },
    check: (rs) => (J(rs[2].contacts) === J({ segments: [], points: [[-2, 0, 1], [0, 0, 1]] }) && J(rs[2].shine) === '[]' ? null : `contacts ${J(rs[2].contacts)}`) },
  { n: 4, drops: '▲1 ▼1.5', expect: { outcome: 'fit' },
    note: 'hung by one side; free half over air beyond the car',
    check: (rs) => {
      const side = seg([3, ...H], [4, 0, 0]); // ▼ lower-left side = ▲1 right slant
      return hasSeg(rs[1], side) ? null : `no side contact ${J(rs[1].contacts.segments)}`;
    } },
  { n: 5, drops: '▼0', expect: { outcome: 'off', reason: 'ONLY A POINT' },
    check: (rs) => (J(rs[0].contacts) === J({ segments: [], points: [[1, 0, 0]] }) ? null : `contacts ${J(rs[0].contacts)}`) },
  { n: 6, drops: '■-1 ■-1 ▲-1 ▼-1.5 ▲-1.5 ▼-2', expect: { outcome: 'fit' },
    note: '▼−1.5 on ▲−1\'s left side; ▲−1.5 on ▼−1.5\'s top; ▼−2 on ▲−1.5\'s left side',
    check: (rs) => {
      const yb = (r) => r.verts.reduce((m, v) => (v[1] < m[1] || (v[1] === m[1] && v[2] < m[2]) ? v : m));
      if (J(yb(rs[1]).slice(1)) !== J([2, 0])) return `second square base ${J(yb(rs[1]))}`;
      if (J(yb(rs[2]).slice(1)) !== J([4, 0])) return `▲-1 base ${J(yb(rs[2]))}`;
      if (!hasSeg(rs[3], seg([-2, 4, 0], [-1, 4, 1]))) return `▼-1.5 not on ▲-1 left side ${J(rs[3].contacts.segments)}`;
      if (!hasSeg(rs[4], seg([-3, 4, 1], [-1, 4, 1]))) return `▲-1.5 not on ▼-1.5 top ${J(rs[4].contacts.segments)}`;
      if (!hasSeg(rs[5], seg([-3, 4, 1], [-2, 4, 2]))) return `▼-2 not on ▲-1.5 left side ${J(rs[5].contacts.segments)}`;
      return null;
    } },
  { n: 7, drops: '■-2 ▲-0.5 ▼-1 ▲-1.5', expect: { outcome: 'fit', gap: [2, -1] },
    note: 'gap 1 − √3/2: right half over ▼−1\'s top',
    check: (rs) => (hasSeg(rs[3], seg([-3, 2, 0], [-2, 2, 0])) ? null : `no contact on the square top ${J(rs[3].contacts)}`) },
  { n: 8, drops: '■-1 ■0 ▲-0.5', expect: { outcome: 'fit', gap: null } },
  { n: 9, drops: '▲-1 ▼-0.5 ▲0', expect: { outcome: 'fit', gap: [0, 1] }, note: 'gap √3/2: right half over the car top' },
  { n: 10, drops: '▲0 ▲0', expect: { outcome: 'off', reason: 'ONLY A POINT' } },
  { n: 11, drops: null, expect: { throws: true }, run: (b) => drop(b, 'sq', -1) },
  { n: 12, drops: '■-1 ■0 ▲-1 ▲0 ▼-0.5 ▼-1.5 ▼0.5 ▲-1.5 ▲-0.5 ▲0.5 ▼-1 ▼0 ■-1 ■0', expect: { allFit: true } },
];

let failed = 0;
for (const c of CASES) {
  let b = newBuild({ half: 2 });
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
        // every result: reason/shine/gap consistent with the outcome (section 8)
        if (r.outcome === 'fit' && (r.reason !== null || J(r.shine) !== J(r.contacts.segments))) { verdict = `drop ${i + 1}: fit with reason/shine ${J(r)}`; break; }
        if (r.outcome === 'off' && (r.reason !== 'ONLY A POINT' || J(r.shine) !== '[]' || r.gap !== null)) { verdict = `drop ${i + 1}: off with ${J(r)}`; break; }
        const last = i === ds.length - 1;
        if (!last || c.expect.allFit) {
          if (r.outcome !== 'fit') { verdict = `drop ${i + 1} (${d.tok}) should fit, got ${r.outcome} ${r.reason}`; break; }
          b = place(b, r);
          continue;
        }
        const e = c.expect;
        if (r.outcome !== e.outcome) { verdict = `got ${r.outcome} ${r.reason}`; break; }
        if (r.reason !== (e.reason === undefined ? null : e.reason)) { verdict = `got reason ${r.reason}`; break; }
        if (J(r.gap) !== J(e.gap === undefined ? null : e.gap)) { verdict = `got gap ${J(r.gap)}`; break; }
        if (e.outcome === 'fit') b = place(b, r);
      }
      if (verdict === null && c.check) verdict = c.check(rs);
    }
  } catch (e) {
    verdict = `error: ${e.stack}`;
  }
  const want = c.expect.throws ? 'throws' : c.expect.allFit ? 'every drop fits' :
    `${c.expect.outcome}${c.expect.reason ? ', ' + c.expect.reason : ''}, gap ${J(c.expect.gap === undefined ? null : c.expect.gap)}`;
  if (verdict === null) console.log(`PASS golden ${c.n}: ${want}${c.note ? '  [' + c.note + ']' : ''}`);
  else { failed++; console.log(`FAIL golden ${c.n}: want ${want}; ${verdict}`); }
}
console.log(`${CASES.length - failed}/${CASES.length} golden cases pass`);
process.exit(failed === 0 ? 0 : 1);
