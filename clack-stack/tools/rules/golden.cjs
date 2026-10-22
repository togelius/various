'use strict';
// The golden cases of DESIGN §18.9 / SPEC §9 through rules.js. Each case's last drop is checked in the full comparison
// format (SPEC §8). The expectations below were worked out by hand from SPEC §1–8 (not copied from rules.js), and every
// earlier drop must fit. `also` adds hand-derived checks on the strips of earlier tiles and on the drop with no way
// given (SPEC §6). node tools/rules/golden.cjs [--quiet]; exit code 0 when all pass.
const canon = require('../lib/canon.cjs');

const S = (a, b) => [a, b];
// x = col/2; points [X, p, q] with y = (p + q√3)/2
const CASES = [
  { n: 1, drops: ['■1'], last: '▲1.5', title: '▲ with half its base over the end of a square',
    caption: 'A triangle with half its base past the end of a square falls off: half of it is over nothing.',
    expect: { outcome: 'off', way: 'up', verts: [[3, 2, 0], [4, 2, 1], [5, 2, 0]], reason: 'OVER THE EDGE',
      contacts: { segments: [S([3, 2, 0], [4, 2, 0])], points: [] }, shine: [], strips: [true, false], gap: null },
    also: { auto: { outcome: 'off', way: 'up', reason: 'OVER THE EDGE' } } },
  { n: 2, drops: ['▲-2', '▲-1', '▲0', '▼-1.5', '▼-0.5'], last: '■-1', title: 'square across two ▼ tops that meet over a ▲ point',
    caption: 'A square across two upside-down triangles fits: their flat tops meet end to end under it.',
    expect: { outcome: 'fit', way: null, verts: [[-2, 0, 1], [-2, 2, 1], [0, 0, 1], [0, 2, 1]], reason: null,
      contacts: { segments: [S([-2, 0, 1], [-1, 0, 1]), S([-1, 0, 1], [0, 0, 1])], points: [] },
      shine: [S([-2, 0, 1], [-1, 0, 1]), S([-1, 0, 1], [0, 0, 1])], strips: [true, true], gap: null } },
  { n: 3, drops: ['▲-1.5', '▲-0.5'], last: '■-1', title: 'square bridging two ▲ points at its corners',
    caption: 'A square resting only on the tips of two triangles falls off: it touches at two points, not along an edge.',
    expect: { outcome: 'off', way: null, verts: [[-2, 0, 1], [-2, 2, 1], [0, 0, 1], [0, 2, 1]], reason: 'ONLY A POINT',
      contacts: { segments: [], points: [[-2, 0, 1], [0, 0, 1]] }, shine: [], strips: [false, false], gap: null } },
  { n: 4, drops: ['▲1'], last: '▼1.5', title: '▼ hung by one side off the outermost ▲',
    caption: 'An upside-down triangle snaps onto the side of the end triangle and fits, its outer half over the rug.',
    expect: { outcome: 'fit', way: 'down', verts: [[3, 0, 1], [4, 0, 0], [5, 0, 1]], reason: null,
      contacts: { segments: [S([3, 0, 1], [4, 0, 0])], points: [] }, shine: [S([3, 0, 1], [4, 0, 0])], strips: [true, false], gap: null },
    also: { auto: { outcome: 'fit', way: 'down', reason: null } } },
  { n: 5, drops: ['▲1', '▼1.5', '▲1.5'], last: '▼2', title: 'past the car: ▲, ▼ hung on it, ▲ on that, ▼ hung outward',
    caption: 'Hanging another triangle further out falls off: the side it would hang on is itself over the rug.',
    expect: { outcome: 'off', way: 'down', verts: [[4, 0, 2], [5, 0, 1], [6, 0, 2]], reason: 'TOO FAR OUT',
      contacts: { segments: [S([4, 0, 2], [5, 0, 1])], points: [] }, shine: [], strips: [false, false], gap: null },
    also: { strips: { 1: [true, false], 2: [true, false] }, auto: { outcome: 'off', way: 'down', reason: 'TOO FAR OUT' } } },
  { n: 6, drops: ['■-1', '■-1', '▲-1', '▼-1.5', '▲-1.5'], last: '▼-2', title: 'a stair inside the car span',
    caption: 'The same inside the car: the side it would hang on sticks out over air, so this triangle falls off.',
    expect: { outcome: 'off', way: 'down', verts: [[-4, 4, 2], [-3, 4, 1], [-2, 4, 2]], reason: 'TOO FAR OUT',
      contacts: { segments: [S([-3, 4, 1], [-2, 4, 2])], points: [] }, shine: [], strips: [false, false], gap: null },
    also: { strips: { 3: [false, true], 4: [false, true] }, auto: { outcome: 'off', way: 'down', reason: 'TOO FAR OUT' } } },
  { n: 7, drops: ['■-2', '▲-0.5', '▼-1'], last: '▲-1.5', title: 'the 0.134 near miss',
    caption: 'A triangle across a square and a lower triangle top falls off: the tops differ by a sliver (0.134 of a tile).',
    expect: { outcome: 'off', way: 'up', verts: [[-3, 2, 0], [-2, 2, 1], [-1, 2, 0]], reason: 'NOT LEVEL',
      contacts: { segments: [S([-3, 2, 0], [-2, 2, 0])], points: [] }, shine: [], strips: [true, false], gap: [2, -1] },
    also: { strips: { 2: [true, true] }, auto: { outcome: 'off', way: 'up', reason: 'NOT LEVEL' } } },
  { n: 8, drops: ['■-1', '■0'], last: '▲-0.5', title: '▲ at a half step across two level squares',
    caption: 'A triangle half a step over, across two squares of the same height, fits.',
    expect: { outcome: 'fit', way: 'up', verts: [[-1, 2, 0], [0, 2, 1], [1, 2, 0]], reason: null,
      contacts: { segments: [S([-1, 2, 0], [0, 2, 0]), S([0, 2, 0], [1, 2, 0])], points: [] },
      shine: [S([-1, 2, 0], [0, 2, 0]), S([0, 2, 0], [1, 2, 0])], strips: [true, true], gap: null },
    also: { auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 9, drops: ['▲-1', '▼-0.5'], last: '▲0', title: '▲ half on a ▼ top, half over the car',
    caption: 'A triangle half on a triangle top and half over the bare car falls off: one half is far below.',
    expect: { outcome: 'off', way: 'up', verts: [[0, 0, 1], [1, 0, 2], [2, 0, 1]], reason: 'NOT LEVEL',
      contacts: { segments: [S([0, 0, 1], [1, 0, 1])], points: [] }, shine: [], strips: [true, false], gap: [0, 1] },
    also: { strips: { 1: [true, true] }, auto: { outcome: 'off', way: 'up', reason: 'NOT LEVEL' } } },
  { n: 10, drops: ['▲0'], last: '▲0', title: "revision 4's triangle on a triangle's point",
    caption: 'A triangle on the point of another triangle falls off: it touches at one point only.',
    expect: { outcome: 'off', way: 'up', verts: [[0, 0, 1], [1, 0, 2], [2, 0, 1]], reason: 'ONLY A POINT',
      contacts: { segments: [], points: [[1, 0, 1]] }, shine: [], strips: [false, false], gap: null },
    also: { auto: { outcome: 'off', way: 'up', reason: 'ONLY A POINT' } } },
  { n: 11, drops: [], last: { piece: 'sq', col: -1, way: null }, title: "revision 4's square half a tile off", throws: true,
    caption: 'A square can never be half a tile off: the hand moves squares in whole tiles.' },
  { n: 12, drops: ['■-1', '■0', '▲-1', '▲0', '▼-0.5', '▼-1.5', '▼0.5', '▲-1.5', '▲-0.5', '▲0.5', '▼-1', '▼0', '■-1'], last: '■0',
    title: "the photo's wall",
    caption: "The photo's wall: squares, rows of triangles shifted by half, and squares again; every tile fits.",
    expect: { outcome: 'fit', way: null, verts: [[0, 2, 2], [0, 4, 2], [2, 2, 2], [2, 4, 2]], reason: null,
      contacts: { segments: [S([0, 2, 2], [0, 4, 2]), S([0, 2, 2], [2, 2, 2])], points: [] },
      shine: [S([0, 2, 2], [0, 4, 2]), S([0, 2, 2], [2, 2, 2])], strips: [true, true], gap: null },
    also: { strips: { 5: [false, true], 6: [true, false], 7: [false, true], 9: [true, false], 10: [true, true], 11: [true, true] } } }
];
for (const c of CASES) {
  c.log = c.drops.map(canon.parseDrop);
  c.lastDrop = typeof c.last === 'string' ? canon.parseDrop(c.last) : c.last;
}

// run every case through rules R; returns [{n, ok, msg}]
function runGolden(R) {
  const out = [];
  for (const c of CASES) {
    const fails = [];
    try {
      const B = canon.replay(R, 2, c.log);
      const d = c.lastDrop;
      if (c.throws) {
        let threw = false;
        try { R.drop(B, d.piece, d.col, d.way || undefined); } catch (e) { threw = true; }
        if (!threw) fails.push('expected a throw');
        // and the hand never offers it: no square col is odd
        if (R.cols && R.cols(B, 'sq').some(x => x % 2)) fails.push('an odd square col is offered');
      } else {
        const r = R.drop(B, d.piece, d.col, d.way || undefined);
        const df = canon.diff(r, c.expect);
        if (df) for (const f in df) fails.push(f + ': got ' + JSON.stringify(df[f][0]) + ' want ' + JSON.stringify(df[f][1]));
        if (c.n === 12) {
          // every drop of the wall fits, the last one too
          if (r.outcome !== 'fit') fails.push('the last tile of the wall does not fit');
        }
        if (c.also && c.also.strips) {
          const T = R.tiles ? R.tiles(B) : null;
          if (T) for (const i in c.also.strips) {
            if (JSON.stringify(T[i].strips) !== JSON.stringify(c.also.strips[i])) fails.push('tile ' + i + ' (' + c.drops[i] + ') strips ' + JSON.stringify(T[i].strips) + ' want ' + JSON.stringify(c.also.strips[i]));
          }
        }
        if (c.also && c.also.auto) {
          const a = R.drop(B, 'tri', d.col);
          for (const f of ['outcome', 'way', 'reason']) if (a[f] !== c.also.auto[f]) fails.push('no way given: ' + f + ' ' + a[f] + ' want ' + c.also.auto[f]);
        }
      }
    } catch (e) {
      fails.push('threw: ' + e.message);
    }
    out.push({ n: c.n, ok: fails.length === 0, msg: fails.join('; ') });
  }
  return out;
}

module.exports = { CASES, runGolden };

if (require.main === module) {
  const R = require('../lib/rules-vm.cjs').load();
  const res = runGolden(R);
  const quiet = process.argv.includes('--quiet');
  for (const r of res) if (!quiet || !r.ok) console.log((r.ok ? 'PASS' : 'FAIL') + ' golden ' + r.n + ' ' + CASES[r.n - 1].title + (r.ok ? '' : ': ' + r.msg));
  const bad = res.filter(r => !r.ok).length;
  console.log((bad ? 'FAIL' : 'PASS') + ' golden: ' + (res.length - bad) + '/' + res.length);
  process.exit(bad ? 1 : 0);
}
