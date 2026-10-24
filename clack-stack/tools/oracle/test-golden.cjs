'use strict';
// Golden cases of SPEC.md §9 (revision 5e, half = 2). Exit code 0 iff every case passes.
// -v : print every drop's result
const { newBuild, drop, place, _details, _record, _variant } = require('./oracle.cjs');
_record(true); // keep every piece's group for the notes of cases 6, 9, 17, 18 and 19

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
// the group record of the piece holding tile t (index in drop order) in the new build of result r:
// piece and group as tile indices, W8 = 8W, M32 = 32M, xmin/xmax in X (= 2x)
function groupOf(r, t) { return (_details(r).groups || []).find((g) => g.piece.includes(t)) || null; }
// the piece's weight exactly over the support end X: 32M = 32 W x = W8 * 2X
const overEnd = (g, X) => J(g.M32) === J([2 * X * g.W8[0], 2 * X * g.W8[1]]);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// expect: {outcome, reason, gap, tips} for the last drop (reason, gap and tips are checked always:
// null unless given); check(results) checks the notes in the spec text
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
    note: 'all six tiles are one piece (five whole-edge locks), one group, standing on the car from x −1 to 0',
    check: (rs) => {
      const gs = _details(rs[5]).groups;
      if (gs.length !== 1 || J(gs[0].piece) !== J(range(0, 5)) || J(gs[0].group) !== J(range(0, 5))) return `pieces ${J(gs)}`;
      if (gs[0].xmin !== -2 || gs[0].xmax !== 0 || gs[0].side !== null) return `support or side ${J(gs[0])}`;
      if (J(_details(rs[5]).locksAll.map((L) => L.join('-'))) !== J(['0-1', '1-2', '2-3', '3-4', '4-5'])) return `locks ${J(_details(rs[5]).locksAll)}`;
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
  { n: 9, drops: '▲-1 ▼-0.5 ▲0', expect: { outcome: 'fit', gap: [0, 1] },
    note: 'gap √3/2: right half over the car top; the group of the piece ▲−1 + ▼−0.5 (with ▲0, half on its top, unlocked) has its weight exactly over x = 0, the end of its support',
    check: (rs) => {
      const g = groupOf(rs[2], 0), g2 = groupOf(rs[2], 2);
      if (J(g.piece) !== J([0, 1]) || J(g.group) !== J([0, 1, 2]) || g.xmin !== -2 || g.xmax !== 0 || !overEnd(g, 0) || g.fails) return `▲-1 + ▼-0.5 group ${J(g)}`;
      if (J(g2.piece) !== J([2]) || J(g2.group) !== J([2]) || !overEnd(g2, 1)) return `▲0 group ${J(g2)}`;
      return J(_details(rs[2]).locksNew) === '[]' ? null : `▲0 locked ${J(_details(rs[2]).locksNew)}`;
    } },
  { n: 10, drops: '▲0 ▲0', expect: { outcome: 'off', reason: 'ONLY A POINT' } },
  { n: 11, drops: null, expect: { throws: true }, run: (b) => drop(b, 'sq', -1) },
  { n: 12, drops: '■-1 ■0 ▲-1 ▲0 ▼-0.5 ▼-1.5 ▼0.5 ▲-1.5 ▲-0.5 ▲0.5 ▼-1 ▼0 ■-1 ■0', expect: { allFit: true } },
  { n: 13, drops: '■-2 ▲-2 ▲-1 ▼-0.5 ▲-0.5 ▼-1 ▲-1.5', expect: { outcome: 'off', reason: 'ONLY A POINT' },
    note: 'left corner on ▲−2\'s apex, 1 + h − √3 ≈ 0.134 above ▼−1\'s top',
    check: (rs) => {
      const r = rs[6];
      if (J(r.verts) !== J([[-3, 2, 1], [-2, 2, 2], [-1, 2, 1]])) return `verts ${J(r.verts)}`; // base at y = 1 + h
      return J(r.contacts) === J({ segments: [], points: [[-3, 2, 1]] }) ? null : `contacts ${J(r.contacts)}`;
    } },
  { n: 14, drops: '▲-2.5 ▼-2 ▲-1.5 ▼-1', expect: { outcome: 'off', reason: 'TIPS OVER',
    tips: { base: [[-5, 0, 0], [-4, 0, 1], [-3, 0, 0]], members: 4, side: 'right', pivot: [-3, 0, 0] } },
    note: 'base ▲−2.5, members 4, right, pivot (−1.5, 0)',
    check: (rs) => (J(rs[3].verts) === J([[-2, 0, 2], [-1, 0, 1], [0, 0, 2]]) && J(rs[3].contacts.segments) === J([[[-2, 0, 2], [-1, 0, 1]]]) ? null : `last tile ${J(rs[3])}`) },
  { n: 15, drops: '■-2 ▲-1.5 ▼-1', expect: { outcome: 'off', reason: 'TIPS OVER',
    tips: { base: [[-3, 2, 0], [-2, 2, 1], [-1, 2, 0]], members: 2, side: 'right', pivot: [-2, 2, 0] } },
    note: 'base ▲−1.5, members 2, right, pivot (−1, 1)' },
  { n: 16, drops: '▲-1 ▼-0.5 ■0', expect: { outcome: 'off', reason: 'TIPS OVER',
    tips: { base: [[-2, 0, 0], [-1, 0, 1], [0, 0, 0]], members: 3, side: 'right', pivot: [0, 0, 0] } },
    note: 'base ▲−1, members 3, right, pivot (0, 0): the piece ▲−1 + ▼−0.5 (tie on the lowest point inside it, smaller col); the ■ alone is over the end of its half edge',
    check: (rs) => {
      if (J(rs[2].contacts) !== J({ segments: [[[0, 0, 1], [1, 0, 1]]], points: [] })) return `contacts ${J(rs[2].contacts)}`;
      const d = _details(rs[2]);
      return d.failing.length === 1 && d.baseTileTie && d.tie === null && d.baseIdx === 0 ? null : `failing ${J(d)}`;
    } },
  { n: 17, drops: '▲0.5 ▼0 ▲0 ▼0.5 ■1', expect: { outcome: 'fit', gap: [0, 2] },
    note: 'the four triangles are one piece standing on the car from x 0.5 to 1.5; the ■, half on ▼0.5\'s top and unlocked, keeps the weight over it',
    check: (rs) => {
      const r = rs[4], g = groupOf(r, 0), gs = groupOf(r, 4);
      if (J(g.piece) !== J([0, 1, 2, 3]) || J(g.group) !== J([0, 1, 2, 3, 4]) || g.xmin !== 1 || g.xmax !== 3 || g.fails) return `triangle piece ${J(g)}`;
      if (J(gs.piece) !== J([4]) || J(gs.group) !== J([4])) return `square piece ${J(gs)}`;
      if (!hasSeg(r, seg([2, 0, 2], [3, 0, 2]))) return `■ not half on ▼0.5's top ${J(r.contacts)}`;
      return J(_details(r).locksNew) === '[]' ? null : `■ locked ${J(_details(r).locksNew)}`;
    } },
  { n: 18, drops: '■-2 ▲-1.5 ▼-2 ■-2 ▲-2.5 ▼-1 ■-1 ■-1', expect: { outcome: 'off', reason: 'TIPS OVER',
    tips: { base: [[-4, 2, 1], [-3, 2, 0], [-2, 2, 1]], members: 7, side: 'right', pivot: [-2, 2, 0] } },
    note: 'base ▼−2, members 7, right, pivot (−1, 1): a piece of six (one lock is two squares side by side) plus ▲−2.5 on top; three tiles tie on its lowest point',
    check: (rs) => {
      const r = rs[7], d = _details(r);
      if (!d.locksAll.some((L) => J(L) === J([3, 6]))) return `no side-by-side lock ■-2 / ■-1 ${J(d.locksAll)}`;
      if (!hasSeg(rs[6], seg([-2, 2, 1], [-2, 4, 1]))) return `■-1 not beside ■-2 ${J(rs[6].contacts)}`;
      const g = groupOf(r, 1);
      if (J(g.piece) !== J([1, 2, 3, 5, 6, 7]) || J(g.group) !== J([1, 2, 3, 4, 5, 6, 7]) || !g.fails) return `failing group ${J(g)}`;
      return d.failing.length === 1 && d.baseTileTie && d.baseIdx === 2 ? null : `failing ${J(d.failing)} base ${d.baseIdx}`;
    } },
  { n: 19, drops: '■0 ▲-2 ▼-1.5 ■-2 ■-1 ■-1', expect: { outcome: 'fit', gap: null },
    note: 'the group of the piece ▲−2 + ▼−1.5 leans right past its pivot (−1, 0); ■−1 (the lower one) presses on ■0 along x = 0 from y = √3/2 to 1, above the pivot: propped',
    check: (rs) => {
      const r = rs[5], d = _details(r), g = groupOf(r, 1);
      // tiles: 0 ■0, 1 ▲-2, 2 ▼-1.5, 3 ■-2, 4 ■-1 (at y = h), 5 ■-1 (on top)
      if (J(g.piece) !== J([1, 2]) || J(g.group) !== J([1, 2, 3, 4, 5]) || g.side !== 'right' || J(g.pivot) !== J([-2, 0, 0]) || g.fails) return `▲-2 + ▼-1.5 group ${J(g)}`;
      if (J(g.props) !== J([{ u: 4, v: 0, seg: [[0, 0, 1], [0, 2, 0]] }])) return `props ${J(g.props)}`;
      if (!hasSeg(rs[4], seg([0, 0, 1], [0, 2, 0]))) return `■-1 not beside ■0 from h to 1 ${J(rs[4].contacts)}`;
      if (d.groups.some((x) => x !== g && x.side !== null)) return `another group leans ${J(d.groups)}`;
      if (d.failing.length !== 0 || d.propped.length !== 1) return `failing ${J(d.failing)} propped ${J(d.propped)}`;
      // without props (5d) the same drop tips, and that group is the one reported
      let b = newBuild({ half: 2 });
      for (const x of rs.slice(0, 5)) b = place(b, x);
      _variant({ props: false });
      let r5d;
      try { r5d = drop(b, 'sq', -2); } finally { _variant({}); }
      const want = { base: [[-4, 0, 0], [-3, 0, 1], [-2, 0, 0]], members: 5, side: 'right', pivot: [-2, 0, 0] };
      return r5d.reason === 'TIPS OVER' && J(r5d.tips) === J(want) ? null : `5d reading ${J(r5d)}`;
    } },
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
        if (J(Object.keys(r)) !== J(['outcome', 'way', 'verts', 'reason', 'contacts', 'shine', 'gap', 'tips'])) { verdict = `drop ${i + 1}: keys ${J(Object.keys(r))}`; break; }
        if (r.outcome === 'fit' && (r.reason !== null || J(r.shine) !== J(r.contacts.segments) || r.tips !== null)) { verdict = `drop ${i + 1}: fit with reason/shine/tips ${J(r)}`; break; }
        if (r.outcome === 'off' && (!['ONLY A POINT', 'TIPS OVER'].includes(r.reason) || J(r.shine) !== '[]' || r.gap !== null || (r.tips === null) !== (r.reason === 'ONLY A POINT'))) { verdict = `drop ${i + 1}: off with ${J(r)}`; break; }
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
        if (J(r.tips) !== J(e.tips === undefined ? null : e.tips)) { verdict = `got tips ${J(r.tips)}`; break; }
        if (e.outcome === 'fit') b = place(b, r);
      }
      if (verdict === null && c.check) verdict = c.check(rs);
    }
  } catch (e) {
    verdict = `error: ${e.stack}`;
  }
  const want = c.expect.throws ? 'throws' : c.expect.allFit ? 'every drop fits' :
    `${c.expect.outcome}${c.expect.reason ? ', ' + c.expect.reason : ''}, gap ${J(c.expect.gap === undefined ? null : c.expect.gap)}` +
    (c.expect.tips ? `, tips ${J(c.expect.tips)}` : '');
  if (verdict === null) console.log(`PASS golden ${c.n}: ${want}${c.note ? '  [' + c.note + ']' : ''}`);
  else { failed++; console.log(`FAIL golden ${c.n}: want ${want}; ${verdict}`); }
}
console.log(`${CASES.length - failed}/${CASES.length} golden cases pass`);
process.exit(failed === 0 ? 0 : 1);
