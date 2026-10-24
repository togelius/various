'use strict';
// The golden sheet (DESIGN §18.8 G0), revision 5d: all 18 golden cases of §18.9 / SPEC §9, each with its build, the tile in
// the hand above it with its fall line, and the outcome drawn, with a caption in plain words. Writes
// tools/oracle/golden.png and any extra paths given:
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
  const png = await S.renderSheet(items(), 4, {
    title: 'CLACK STACK revision 5d: the golden cases',
    subtitle: 'Each picture shows the tiles on the car, the next tile in the hand with dotted lines down to where it will land, and what happens when it is let go. ' +
      'A tile stays when it meets the tower edge to edge, along at least half an edge, and nothing tips: it is drawn in place, and the edges it meets shine gold (×2 when it meets two tiles). ' +
      'A tile that touches only at points falls off: it is drawn red and dashed where it stops, with ONLY A POINT and a red dot at each point it touches. ' +
      'Tiles joined along a whole edge are locked together by their magnets and move as one piece; half an edge or a point holds a piece up but does not lock it. ' +
      'A tile that would put the weight of a piece, and everything resting on it, past what holds it up falls off too: it is drawn red and dashed, and the group that would tip is drawn as one shape, tinted and outlined in red, ' +
      'with a red dot at the corner it would tip over and a small plumb line from its centre of weight, past the corner (TIPS OVER). ' +
      'A thin gap under part of a tile is left open, with a fine dotted outline: it is air, not a piece.',
    dpr: 1.5
  });
  for (const o of outs) { fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, png); console.log('wrote ' + o + ' (' + png.length + ' bytes)'); }
  await S.close();
}
module.exports = { items };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
