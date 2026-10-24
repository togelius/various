'use strict';
// StackBot (DESIGN §18.8 G4): always aims for the highest landing among the places the tile fits, after a 0.3 s
// reaction. It sees only percepts (tools/bots/harness.cjs) and acts only by real input: it looks at every column the
// hand reaches (a pointer move and a glance at the ghost each) and lets go where the ghost lands highest (ties: nearest
// the car's middle). With no fit anywhere it lets go over the middle. It never waits and never reads the ghost weight.
const P = require('./percept.cjs');

function create(o) {
  return P.lookingBot('StackBot', o, {
    cols: ctx => P.handCols(ctx.piece),
    choose(looks) {
      const fits = looks.filter(l => l.says === 'fit');
      if (!fits.length) return { go: P.leastBy(looks, l => Math.abs(l.c + 1)).c };
      let best = fits[0];
      for (const l of fits) if (l.top > best.top + 0.05 || (Math.abs(l.top - best.top) <= 0.05 && Math.abs(l.x) < Math.abs(best.x) - 1e-6)) best = l;
      return { go: best.c };
    },
  });
}

module.exports = { create, name: 'StackBot' };
