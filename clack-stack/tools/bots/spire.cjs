'use strict';
// The spire bots (DESIGN §18.8 G4): stacking straight up, one wide or two, the triangles kept off the spire. They see
// only percepts (tools/bots/harness.cjs) and act only by real input; each tile after a 0.3 s reaction, each look a
// pointer move and a glance at the ghost. None of them reads the ghost weight's colour.
//   SpireBot         a one-wide spire of squares on the column left of the car's middle (x −1…0), as fast as it can
//   Spire2Bot        a two-wide spire of squares over the car's middle (x −1…1), each square on the lower of its two
//                    columns (ties: the one whose ghost weight settles nearer the middle), as fast as it can
//   PatientSpireBot  SpireBot's spire, but before each tile it waits for the tower to be still, as long as the fuse
//                    allows (CarefulBot's wait)
// Squares that do not fit on the spire go to the lowest fit nearest it (or, fitting nowhere, fall off). Triangles go to
// the lowest place they fit beside the spire, never over it (ties: the one whose ghost weight settles nearer the
// middle); with none, the bot lets the triangle fall off beside it.
const P = require('./percept.cjs');

// spire: the square columns of the spire; side: the triangle columns clear of it (a triangle's left x c/2, its right
// x c/2 + 1, never over the spire's x0…x1)
function plan(spire, x0, x1) {
  const side = P.handCols('tri').filter(c => c / 2 + 1 <= x0 || c / 2 >= x1);
  const mid = (x0 + x1) / 2;
  const lowest = list => {
    let best = null;
    for (const l of list) if (!best || l.foot < best.foot - 0.05 || (Math.abs(l.foot - best.foot) <= 0.05 && Math.abs(l.settle) < Math.abs(best.settle) - 1e-6)) best = l;
    return best;
  };
  return {
    cols: ctx => (ctx.piece === 'sq' ? spire : side),
    choose(looks, ctx) {
      const fits = looks.filter(l => l.says === 'fit');
      if (ctx.piece === 'sq') {
        const on = fits.filter(l => spire.includes(l.c));
        if (on.length) return { go: lowest(on).c };
        const rest = P.handCols('sq').filter(c => !looks.some(l => l.c === c));
        if (rest.length) return { more: rest };
        if (fits.length) return { go: P.leastBy(fits, l => l.foot + 0.01 * Math.abs(l.x - mid)).c };
        return { go: P.leastBy(looks, l => Math.abs(l.x - mid)).c };
      }
      if (fits.length) return { go: lowest(fits).c };
      const off = looks.filter(l => l.says === 'off');
      return { go: (off.length ? P.leastBy(off, l => Math.abs(l.x)) : looks[0]).c };
    },
  };
}
const SPIRE1 = () => plan([-2], -1, 0), SPIRE2 = () => plan([-2, 0], -1, 1);

const SpireBot = { name: 'SpireBot', create: o => P.lookingBot('SpireBot', o, SPIRE1()) };
const Spire2Bot = { name: 'Spire2Bot', create: o => P.lookingBot('Spire2Bot', o, SPIRE2()) };
const PatientSpireBot = { name: 'PatientSpireBot', create: o => P.lookingBot('PatientSpireBot', Object.assign({}, o, { patient: true }), SPIRE1()) };

module.exports = { SpireBot, Spire2Bot, PatientSpireBot };
