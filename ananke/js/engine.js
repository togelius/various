/* ANANKE — possibility engine.
 *
 * The world is not simulated. It is *enumerated*. We build the product
 * automaton over (position of figure A, position of figure B, latched flags,
 * time) and count, exactly, how many complete futures pass through every
 * state. Sealing a cell for a window of time deletes states; the counts
 * recompute; the clouds you see on screen are the true marginals of the
 * surviving future set.
 *
 * Nothing here is approximate. If the engine says an outcome is necessary, it
 * has checked every one of the (often astronomically many) remaining futures.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Ananke = Object.assign(root.Ananke || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Wait, then the four steps. Waiting is a move: that is why forcing someone
  // to act means forbidding the ground under their feet.
  var DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

  function compile(level) {
    var w = level.w, h = level.h, grid = level.grid, x, y, p, i;

    var idxAt = new Int32Array(w * h).fill(-1);
    var posX = [], posY = [];
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (grid[y][x] !== '#') {
          idxAt[y * w + x] = posX.length;
          posX.push(x); posY.push(y);
        }
      }
    }
    var nP = posX.length;

    // Thin stone: cells that are shut now but could have been otherwise.
    // They compile as open ground and are held closed by implicit seals, so
    // Ananke can open one mid-game without invalidating any index.
    var breakable = [];
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (grid[y][x] === '~') breakable.push(idxAt[y * w + x]);
      }
    }

    // Flat adjacency (CSR). Every open cell is adjacent to itself.
    var nbStart = new Int32Array(nP + 1), nbList = [];
    for (p = 0; p < nP; p++) {
      nbStart[p] = nbList.length;
      for (i = 0; i < DIRS.length; i++) {
        var nx = posX[p] + DIRS[i][0], ny = posY[p] + DIRS[i][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var q = idxAt[ny * w + nx];
        if (q >= 0) nbList.push(q);
      }
    }
    nbStart[nP] = nbList.length;

    var nA = level.agents.length;
    var nP1 = nP, nP2 = nA === 2 ? nP : 1;

    // --- flags -------------------------------------------------------------
    // Every objective is compiled into a latching bit: once set, set forever.
    // "Reach the shrine" becomes "the bit that latches when she stands on the
    // shrine". This is what lets us ask modal questions with a flat scan.
    var flags = [], checks = [];
    function flagFor(spec) {
      for (var k = 0; k < flags.length; k++) {
        if (flags[k].key === spec.key) return k;
      }
      flags.push(spec);
      return flags.length - 1;
    }

    for (i = 0; i < level.objectives.length; i++) {
      var ob = level.objectives[i], fi;
      if (ob.type === 'reach' || ob.type === 'avoid') {
        var tp = idxAt[ob.at[1] * w + ob.at[0]];
        fi = flagFor({ kind: 'visit', agent: ob.agent | 0, pos: tp,
                       key: 'v' + ob.agent + ':' + tp });
        checks.push({
          obj: ob, flag: fi,
          mode: ob.type === 'reach' ? 'mustSetBy' : 'mustNeverSet',
          by: ob.by == null ? level.T : ob.by
        });
      } else if (ob.type === 'noContact' || ob.type === 'meet') {
        var r = ob.radius == null ? 1 : ob.radius;
        fi = flagFor({ kind: 'contact', radius: r, key: 'c' + r });
        checks.push({
          obj: ob, flag: fi,
          mode: ob.type === 'meet' ? 'mustSetBy' : 'mustNeverSet',
          by: ob.by == null ? level.T : ob.by
        });
      } else {
        throw new Error('unknown objective type ' + ob.type);
      }
    }
    if (flags.length > 4) throw new Error('too many flags in ' + level.id);
    var nFS = 1 << flags.length;

    // Which flags latch for each joint position? Precomputed once.
    var trig = new Int32Array(nP1 * nP2);
    for (var a = 0; a < nP1; a++) {
      for (var b = 0; b < nP2; b++) {
        var m = 0;
        for (var f = 0; f < flags.length; f++) {
          var fl = flags[f];
          if (fl.kind === 'visit') {
            if ((fl.agent === 0 ? a : b) === fl.pos) m |= (1 << f);
          } else {
            if (nA === 2) {
              // Manhattan: the scent carries through stone, but a single
              // forbidden cell between them is a real separation.
              var dx = Math.abs(posX[a] - posX[b]), dy = Math.abs(posY[a] - posY[b]);
              if (dx + dy <= fl.radius) m |= (1 << f);
            }
          }
        }
        trig[a * nP2 + b] = m;
      }
    }

    var start1 = idxAt[level.agents[0].start[1] * w + level.agents[0].start[0]];
    var start2 = nA === 2 ? idxAt[level.agents[1].start[1] * w + level.agents[1].start[0]] : 0;

    var T = level.T;
    var size = (T + 1) * nFS * nP1 * nP2;

    return {
      level: level, w: w, h: h, grid: grid, idxAt: idxAt, posX: posX, posY: posY,
      nP: nP, nP1: nP1, nP2: nP2, nA: nA, nbStart: nbStart, breakable: breakable,
      nbList: new Int32Array(nbList), T: T, flags: flags, checks: checks,
      nFS: nFS, trig: trig, start1: start1, start2: start2, size: size,
      _fwd: new Float64Array(size), _bwd: new Float64Array(size),
      strideT: nFS * nP1 * nP2, strideF: nP1 * nP2
    };
  }

  function sealMaskOf(world, seals) {
    var mask = new Uint8Array((world.T + 1) * world.nP);
    for (var i = 0; i < seals.length; i++) {
      var s = seals[i];
      var lo = Math.max(0, s.a), hi = Math.min(world.T, s.b);
      for (var t = lo; t <= hi; t++) mask[t * world.nP + s.p] = 1;
    }
    return mask;
  }

  /* The whole game, mathematically: forward counts x backward counts. */
  function solve(world, seals) {
    var T = world.T, nFS = world.nFS, nP1 = world.nP1, nP2 = world.nP2, nP = world.nP;
    var sT = world.strideT, sF = world.strideF;
    var nbStart = world.nbStart, nbList = world.nbList, trig = world.trig;
    var fwd = world._fwd, bwd = world._bwd;
    fwd.fill(0); bwd.fill(0);

    var mask = sealMaskOf(world, seals);
    var t, f, p1, p2, i, j, base, v;

    // Forward: how many prefixes arrive at this state.
    if (!mask[0 * nP + world.start1] && !(nP2 > 1 && mask[0 * nP + world.start2])) {
      var f0 = trig[world.start1 * nP2 + world.start2];
      fwd[f0 * sF + world.start1 * nP2 + world.start2] = 1;
    }
    for (t = 0; t < T; t++) {
      var offT = t * sT, offT1 = (t + 1) * sT, mNext = (t + 1) * nP;
      for (f = 0; f < nFS; f++) {
        var offF = offT + f * sF;
        for (p1 = 0; p1 < nP1; p1++) {
          var rowBase = offF + p1 * nP2;
          for (p2 = 0; p2 < nP2; p2++) {
            v = fwd[rowBase + p2];
            if (v === 0) continue;
            for (i = nbStart[p1]; i < nbStart[p1 + 1]; i++) {
              var n1 = nbList[i];
              if (mask[mNext + n1]) continue;
              if (nP2 === 1) {
                var g1 = f | trig[n1];
                fwd[offT1 + g1 * sF + n1] += v;
              } else {
                for (j = nbStart[p2]; j < nbStart[p2 + 1]; j++) {
                  var n2 = nbList[j];
                  if (mask[mNext + n2]) continue;
                  var g = f | trig[n1 * nP2 + n2];
                  fwd[offT1 + g * sF + n1 * nP2 + n2] += v;
                }
              }
            }
          }
        }
      }
    }

    // Backward: how many suffixes run from this state out to the horizon.
    var offTT = T * sT, mT = T * nP;
    for (f = 0; f < nFS; f++) {
      for (p1 = 0; p1 < nP1; p1++) {
        if (mask[mT + p1]) continue;
        for (p2 = 0; p2 < nP2; p2++) {
          if (nP2 > 1 && mask[mT + p2]) continue;
          bwd[offTT + f * sF + p1 * nP2 + p2] = 1;
        }
      }
    }
    for (t = T - 1; t >= 0; t--) {
      var oT = t * sT, oT1 = (t + 1) * sT, mN = (t + 1) * nP, mC = t * nP;
      for (f = 0; f < nFS; f++) {
        var oF = oT + f * sF;
        for (p1 = 0; p1 < nP1; p1++) {
          if (mask[mC + p1]) continue;
          for (p2 = 0; p2 < nP2; p2++) {
            if (nP2 > 1 && mask[mC + p2]) continue;
            var acc = 0;
            for (i = nbStart[p1]; i < nbStart[p1 + 1]; i++) {
              var m1 = nbList[i];
              if (mask[mN + m1]) continue;
              if (nP2 === 1) {
                acc += bwd[oT1 + (f | trig[m1]) * sF + m1];
              } else {
                for (j = nbStart[p2]; j < nbStart[p2 + 1]; j++) {
                  var m2 = nbList[j];
                  if (mask[mN + m2]) continue;
                  acc += bwd[oT1 + (f | trig[m1 * nP2 + m2]) * sF + m1 * nP2 + m2];
                }
              }
            }
            bwd[oF + p1 * nP2 + p2] = acc;
          }
        }
      }
    }

    var startIdx = trig[world.start1 * nP2 + world.start2] * sF +
                   world.start1 * nP2 + world.start2;
    var total = fwd[startIdx] * bwd[startIdx];

    var res = {
      total: total,
      paradox: !(total > 0),
      mask: mask,
      margA: new Float64Array((T + 1) * nP),
      margB: nP2 > 1 ? new Float64Array((T + 1) * nP) : null,
      status: [],
      seals: seals
    };
    if (res.paradox) {
      for (var c = 0; c < world.checks.length; c++) {
        res.status.push({ check: world.checks[c], necessary: false, paradox: true });
      }
      return res;
    }

    // Marginals, and the modal question, in one scan.
    var flagSeen = new Uint8Array(nFS * (T + 1));
    for (t = 0; t <= T; t++) {
      var o = t * sT, mo = t * nP;
      for (f = 0; f < nFS; f++) {
        var of2 = o + f * sF;
        for (p1 = 0; p1 < nP1; p1++) {
          var rb = of2 + p1 * nP2;
          for (p2 = 0; p2 < nP2; p2++) {
            var pr = fwd[rb + p2] * bwd[rb + p2];
            if (pr === 0) continue;
            pr /= total;
            res.margA[mo + p1] += pr;
            if (nP2 > 1) res.margB[mo + p2] += pr;
            flagSeen[t * nFS + f] = 1;
          }
        }
      }
    }

    for (var ci = 0; ci < world.checks.length; ci++) {
      var chk = world.checks[ci], bit = 1 << chk.flag, ok = true;
      if (chk.mode === 'mustSetBy') {
        // Violable if some surviving future is still flag-less at the deadline.
        for (f = 0; f < nFS; f++) {
          if (!(f & bit) && flagSeen[chk.by * nFS + f]) { ok = false; break; }
        }
      } else {
        for (t = 0; t <= T && ok; t++) {
          for (f = 0; f < nFS; f++) {
            if ((f & bit) && flagSeen[t * nFS + f]) { ok = false; break; }
          }
        }
      }
      res.status.push({ check: chk, necessary: ok, paradox: false });
    }
    res.won = res.status.every(function (s) { return s.necessary; });
    return res;
  }

  /* Ananke's answer when you have left a crack open: not "wrong", but a
   * witness — one concrete future in which the thing you feared happens. */
  function counterexample(world, seals, checkIndex) {
    var T = world.T, nFS = world.nFS, nP1 = world.nP1, nP2 = world.nP2, nP = world.nP;
    var sT = world.strideT, sF = world.strideF;
    var trig = world.trig;
    var nbStart = world.nbStart, nbList = world.nbList;
    solve(world, seals); // the DP buffers are shared; make sure they are ours
    var fwd = world._fwd, bwd = world._bwd;
    var mask = sealMaskOf(world, seals);
    var chk = world.checks[checkIndex], bit = 1 << chk.flag;

    var hit = -1, hitT = -1, t, f, p1, p2;
    var tLo = chk.mode === 'mustSetBy' ? chk.by : 0;
    var tHi = chk.mode === 'mustSetBy' ? chk.by : T;
    for (t = tLo; t <= tHi && hit < 0; t++) {
      for (f = 0; f < nFS && hit < 0; f++) {
        var want = chk.mode === 'mustSetBy' ? !(f & bit) : !!(f & bit);
        if (!want) continue;
        var oF = t * sT + f * sF;
        for (p1 = 0; p1 < nP1 && hit < 0; p1++) {
          for (p2 = 0; p2 < nP2; p2++) {
            if (fwd[oF + p1 * nP2 + p2] > 0 && bwd[oF + p1 * nP2 + p2] > 0) {
              hit = f * sF + p1 * nP2 + p2; hitT = t; break;
            }
          }
        }
      }
    }
    if (hit < 0) return null;

    var path = new Array(T + 1);
    var hf = Math.floor(hit / sF), rest = hit - hf * sF;
    var hp1 = Math.floor(rest / nP2), hp2 = rest - hp1 * nP2;
    path[hitT] = { f: hf, p1: hp1, p2: hp2 };

    // Walk backwards through any live predecessor...
    for (t = hitT - 1; t >= 0; t--) {
      var nx = path[t + 1], found = null;
      for (var q1 = 0; q1 < nP1 && !found; q1++) {
        if (mask[t * nP + q1]) continue;
        if (!adjacent(world, q1, nx.p1)) continue;
        for (var q2 = 0; q2 < nP2; q2++) {
          if (nP2 > 1 && mask[t * nP + q2]) continue;
          if (nP2 > 1 && !adjacent(world, q2, nx.p2)) continue;
          for (var g = 0; g < nFS; g++) {
            if ((g | trig[nx.p1 * nP2 + nx.p2]) !== nx.f) continue;
            if (fwd[t * sT + g * sF + q1 * nP2 + q2] > 0) {
              found = { f: g, p1: q1, p2: q2 }; break;
            }
          }
          if (found) break;
        }
      }
      path[t] = found;
      if (!found) return null;
    }
    // ...and forwards through any future that still has somewhere to go.
    for (t = hitT; t < T; t++) {
      var cu = path[t], nxt = null;
      for (var i = nbStart[cu.p1]; i < nbStart[cu.p1 + 1] && !nxt; i++) {
        var n1 = nbList[i];
        if (mask[(t + 1) * nP + n1]) continue;
        if (nP2 === 1) {
          var gf = cu.f | trig[n1];
          if (bwd[(t + 1) * sT + gf * sF + n1] > 0) nxt = { f: gf, p1: n1, p2: 0 };
        } else {
          for (var j = nbStart[cu.p2]; j < nbStart[cu.p2 + 1]; j++) {
            var n2 = nbList[j];
            if (mask[(t + 1) * nP + n2]) continue;
            var g2 = cu.f | trig[n1 * nP2 + n2];
            if (bwd[(t + 1) * sT + g2 * sF + n1 * nP2 + n2] > 0) {
              nxt = { f: g2, p1: n1, p2: n2 }; break;
            }
          }
        }
      }
      if (!nxt) return null;
      path[t + 1] = nxt;
    }
    return path;
  }

  function adjacent(world, a, b) {
    for (var i = world.nbStart[a]; i < world.nbStart[a + 1]; i++) {
      if (world.nbList[i] === b) return true;
    }
    return false;
  }

  /* Uniform sample over the surviving futures. Exactly uniform: the weight of
   * each next step is the number of ways the world could finish from there. */
  function sampleFuture(world, seals, rnd) {
    rnd = rnd || Math.random;
    var T = world.T, nFS = world.nFS, nP1 = world.nP1, nP2 = world.nP2, nP = world.nP;
    var sT = world.strideT, sF = world.strideF, trig = world.trig;
    var nbStart = world.nbStart, nbList = world.nbList;
    solve(world, seals); // ditto: sampling reads the backward counts
    var bwd = world._bwd;
    var mask = sealMaskOf(world, seals);

    var cur = {
      f: trig[world.start1 * nP2 + world.start2],
      p1: world.start1, p2: world.start2
    };
    if (mask[world.start1] || (nP2 > 1 && mask[world.start2])) return null;
    var path = [cur];
    for (var t = 0; t < T; t++) {
      var opts = [], wsum = 0, i, j;
      for (i = nbStart[cur.p1]; i < nbStart[cur.p1 + 1]; i++) {
        var n1 = nbList[i];
        if (mask[(t + 1) * nP + n1]) continue;
        if (nP2 === 1) {
          var g = cur.f | trig[n1];
          var wv = bwd[(t + 1) * sT + g * sF + n1];
          if (wv > 0) { opts.push({ f: g, p1: n1, p2: 0, w: wv }); wsum += wv; }
        } else {
          for (j = nbStart[cur.p2]; j < nbStart[cur.p2 + 1]; j++) {
            var n2 = nbList[j];
            if (mask[(t + 1) * nP + n2]) continue;
            var g2 = cur.f | trig[n1 * nP2 + n2];
            var w2 = bwd[(t + 1) * sT + g2 * sF + n1 * nP2 + n2];
            if (w2 > 0) { opts.push({ f: g2, p1: n1, p2: n2, w: w2 }); wsum += w2; }
          }
        }
      }
      if (!opts.length) return null;
      var r = rnd() * wsum, acc = 0, pick = opts[opts.length - 1];
      for (i = 0; i < opts.length; i++) {
        acc += opts[i].w;
        if (r <= acc) { pick = opts[i]; break; }
      }
      cur = { f: pick.f, p1: pick.p1, p2: pick.p2 };
      path.push(cur);
    }
    return path;
  }

  /* Doubt: a fate that depends on every single one of your prohibitions is
   * brittle. Under doubt, one *place* forgets it was ever forbidden — all its
   * seals at once, so you cannot buy redundancy by sealing a cell twice — and
   * Ananke picks the place that hurts most. Necessity has to survive that. */
  function erosionTest(world, seals) {
    var cells = [];
    for (var i = 0; i < seals.length; i++) {
      if (cells.indexOf(seals[i].p) < 0) cells.push(seals[i].p);
    }
    for (var c = 0; c < cells.length; c++) {
      var cell = cells[c];
      var without = seals.filter(function (s) { return s.p !== cell; });
      var r = solve(world, without);
      if (r.paradox || !r.won) return { survives: false, pos: cell, result: r };
    }
    return { survives: true };
  }

  /* THE ARGUMENT. Your prohibitions only ever shrink the set of futures, so
   * an opponent who also prohibited could never really fight you — pruning is
   * monotone, and every cut of theirs would do half your work. So Ananke is
   * given the exact dual power: it does not forbid, it *permits*. It opens a
   * wall that was always thin, and the futures come flooding back.
   *
   * It opens the wall that breaks your necessity and leaves the world widest.
   * If no wall it can open breaks anything, it has nothing to say, and the
   * argument is over. */
  function anankeOpens(world, playerSeals, closed) {
    var best = null;
    for (var i = 0; i < closed.length; i++) {
      var cand = closed[i];
      var seals = playerSeals.slice();
      for (var j = 0; j < closed.length; j++) {
        if (closed[j] !== cand) seals.push({ p: closed[j], a: 0, b: world.T });
      }
      var r = solve(world, seals);
      if (r.paradox || r.won) continue;          // says nothing; not worth saying
      if (!best || r.total > best.total) best = { pos: cand, total: r.total };
    }
    return best;
  }

  return {
    compile: compile,
    anankeOpens: anankeOpens,
    solve: solve,
    counterexample: counterexample,
    sampleFuture: sampleFuture,
    erosionTest: erosionTest,
    DIRS: DIRS
  };
});
