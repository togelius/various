'use strict';
// The golden sheet (DESIGN §18.8 G0), revision 5b: all 12 golden cases of §18.9 / SPEC §9, each with its build, the tile in the
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
    const seq = c.throws ? '■ at x = −0.5 (col −1)' : c.drops.length ? c.drops.join(', ') + ', then ' + c.last : c.last + ' on the bare car';
    return { drops: c.drops, hand, outcome: true, title: c.n + '. ' + c.title, sub: seq.replace(/-/g, '−'), caption: c.caption };
  });
}
async function main() {
  const outs = [path.join(__dirname, '..', 'oracle', 'golden.png')].concat(process.argv.slice(2));
  const png = await S.renderSheet(items(), 3, {
    title: 'CLACK STACK revision 5b: the golden cases',
    subtitle: 'Each picture shows the tiles on the car, the next tile in the hand with dotted lines down to where it will land, and what happens when it is let go. ' +
      'A tile stays when it meets the tower edge to edge, along at least half an edge: it is drawn in place, and the edges it meets shine gold (×2 when it meets two tiles). ' +
      'A tile that touches only at points falls off: it is drawn red and dashed where it stops, with ONLY A POINT and a red dot at each point it touches. ' +
      'A thin gap under part of a tile is filled dark, so it does not look like a joint.',
    dpr: 1.5
  });
  for (const o of outs) { fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, png); console.log('wrote ' + o + ' (' + png.length + ' bytes)'); }
  await S.close();
}
module.exports = { items };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
