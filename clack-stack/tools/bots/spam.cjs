'use strict';
// SpamBot (DESIGN §18.8 G4): clicks at a fixed place, the middle of the screen, as fast as it can (a click every
// frame). It sees only percepts (tools/bots/harness.cjs: whether the run is over) and acts only by real input.
function create(o) {
  const X = (o.w || 390) / 2, Y = (o.h || 844) * 0.6, maxT = o.maxT || 1200;
  const R = { name: 'SpamBot', clicks: 0, timedOut: false };
  let t = 0, down = false;
  function act(p) {
    if (p.results) return { done: true };
    if (t > maxT) { R.timedOut = true; return { done: true }; }
    down = !down;
    if (down) { R.clicks++; return { release: true, at: [X, Y] }; }
    t += 1 / 60;
    return { wait: 1 / 60 };
  }
  return { name: 'SpamBot', act, report: () => R };
}

module.exports = { create, name: 'SpamBot' };
