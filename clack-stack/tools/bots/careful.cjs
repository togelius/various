'use strict';
// CarefulBot (DESIGN §18.8 G4): patience, balance and a plan for one box. It sees only percepts
// (tools/bots/harness.cjs) and acts only by real input. For each tile, after a 0.3 s reaction, it waits for the tower to
// be still (the highest tile steady to 0.2 L for 0.6 s, both wheels down) as long as the fuse allows, keeping 0.45 s of
// it; then it looks at the columns its plan names (a pointer move and a glance at the ghost and the ghost weight each)
// and never takes a drop whose ghost weight is red. Its plan: a tower two tiles wide over the car's middle (x −1…1), each
// square on the lower of its two columns so its top stays flat; the triangles kept off it, low at the sides where they
// widen the base; THE TOPPER on the very top (its ghost gold). How balanced a drop is: bal = 2·|where the ghost weight
// settles| + 2·(the far end of its swing) / (the wheel's distance), all in L from the car's middle.
//   ■: of its two columns the safe one with the least foot + 0.3·bal
//   ▲▼: of the side columns (left x −2.5, −2, 1, 1.5) the safe one with the least foot + bal (+0.2 if held by half
//       an edge)
//   with no safe drop in its plan: it looks at every other column and takes the safe one with the least
//       bal + 1.2·foot + 3·(how far its middle is past 1.25 L out) (+0.6 if held by half an edge)
//   with no safe drop anywhere: it lets the tile fall off where it does no harm, or, if it fits everywhere, takes the
//       one whose weight settles nearest the middle
// As it lets go it looks once more: if the ghost weight has turned red (or the ghost changed), it looks again (once).
const P = require('./percept.cjs');

const bal = l => 2 * Math.abs(l.settle) + 2 * Math.max(Math.abs(l.lo), Math.abs(l.hi)) / l.wheel;
const safe = l => l.says === 'fit' && !l.red;

function create(o) {
  return P.lookingBot('CarefulBot', Object.assign({}, o, { patient: true }), {
    cols(ctx) {
      if (ctx.topper) return P.handCols('tri');
      return ctx.piece === 'sq' ? [-2, 0] : [-5, -4, 2, 3];
    },
    choose(looks, ctx) {
      const ok = looks.filter(safe);
      if (ctx.topper) {
        const gold = ok.filter(l => l.gold);
        const best = gold.length ? P.leastBy(gold, bal) : P.leastBy(ok, l => -l.top + 0.1 * bal(l));
        if (best) return { go: best.c };
      } else {
        const inPlan = ctx.piece === 'sq' ? [-2, 0] : [-5, -4, 2, 3];
        const planned = ok.filter(l => inPlan.includes(l.c));
        const best = ctx.piece === 'sq' ? P.leastBy(planned, l => l.foot + 0.3 * bal(l)) : P.leastBy(planned, l => l.foot + bal(l) + (l.half ? 0.2 : 0));
        if (best) return { go: best.c };
        const rest = P.handCols(ctx.piece).filter(c => !looks.some(l => l.c === c));
        if (rest.length) return { more: rest };
        const any = P.leastBy(ok, l => bal(l) + 1.2 * l.foot + 3 * Math.max(0, Math.abs(l.x) - 1.25) + (l.half ? 0.6 : 0));
        if (any) return { go: any.c };
      }
      if (ctx.topper && looks.length < P.handCols('tri').length) return { more: P.handCols('tri').filter(c => !looks.some(l => l.c === c)) };
      // no safe drop: let it fall off where it does no harm, or the least bad
      const off = looks.filter(l => l.says === 'off');
      if (off.length) return { go: P.leastBy(off, l => Math.abs(l.x)).c };
      return { go: P.leastBy(looks, l => Math.abs(l.settle)).c };
    },
    recheck(now, then) { return !!then && now.says === then.says && (now.says !== 'fit' || !now.red); },
  });
}

module.exports = { create, name: 'CarefulBot' };
