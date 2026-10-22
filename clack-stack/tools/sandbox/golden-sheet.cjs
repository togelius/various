'use strict';
// The golden sheet (DESIGN §18.8 G0): all 12 golden cases of §18.9 / SPEC §9, each with its build, the tile in the
// hand above it with its fall line, and the outcome drawn. Writes tools/oracle/golden.png and any extra paths given:
//   node tools/sandbox/golden-sheet.cjs [out.png ...]
const fs = require('fs');
const path = require('path');
const S = require('./render.cjs');
const { CASES } = require('../rules/golden.cjs');
const canon = require('../lib/canon.cjs');

function items() {
  return CASES.map(c => {
    const last = c.lastDrop;
    const hand = { piece: last.piece, col: last.col, way: last.way || undefined };
    const seq = c.drops.length ? c.drops.join(', ') + ', then ' + (typeof c.last === 'string' ? c.last : '■ at x = −0.5') : '■ at x = −0.5 (col −1)';
    return { drops: c.drops, hand, outcome: true, title: c.n + '. ' + c.title, sub: seq.replace(/-/g, '−'), caption: c.caption };
  });
}
async function main() {
  const outs = [path.join(__dirname, '..', 'oracle', 'golden.png')].concat(process.argv.slice(2));
  const png = await S.renderSheet(items(), 3, {
    title: 'CLACK STACK revision 5: the golden cases',
    subtitle: 'Each picture: the build on the car, the tile in the hand with its dotted fall line, and what happens when it is let go. ' +
      'Fits: the tile in place, its contact edges shining gold. Falls off: red dashed where it stops, with the reason and its mark. ' +
      'Grey hatching marks the half of a placed tile that is over air.',
    dpr: 1.5
  });
  for (const o of outs) { fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, png); console.log('wrote ' + o + ' (' + png.length + ' bytes)'); }
  await S.close();
}
module.exports = { items };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
