/* VANGUARD ZERO - navigation for the play agent.
 *
 * Two layers, deliberately:
 *   1. A cheap approximate distance-to-goal field over standing tiles, built
 *      once per stage. Tile checks only, no physics.
 *   2. An exact short-horizon search at every decision point: simulate each
 *      candidate input program with the frame-exact model and pick whichever
 *      lands closest to the goal.
 *
 * The field only has to be roughly right - it is a heuristic. The search is
 * what actually commits, and it is exact, so a chosen program replays in the
 * real game frame for frame.
 *
 * Exposes window.AGENT.plan.
 */
(function (global) {
  'use strict';
  var AGENT = global.AGENT || (global.AGENT = {});
  var VZ = global.VZ;
  var T = VZ.TILE;

  // ===================================================== distance-to-goal field
  function tileKey(tx, ty) { return ty * 4096 + tx; }

  /* Backward Dijkstra from the goal over a movement graph that includes wall
   * cling states. This is the same model tools/validate.js uses to prove the
   * stages are completable, so the field covers everything a player can reach
   * - including the wall-jump chimneys, which a ground-only model misses. */
  function buildField(level, goalTx, goalTy) {
    var W = level.w, H = level.h;
    var TL = VZ.tiles;
    var solid = function (x, y) { return level.solidAt(x, y); };
    var support = function (x, y) { return level.solidAt(x, y) || level.at(x, y) === TL.PLATFORM; };
    var fatal = function (x, y) { return level.at(x, y) === TL.LIQUID; };
    var spike = function (x, y) {
      var id = level.at(x, y);
      return id === TL.SPIKE_UP || id === TL.SPIKE_DOWN || id === TL.SPIKE_L || id === TL.SPIKE_R;
    };
    var canStand = function (x, y) {
      if (x < 0 || x >= W || y < 1 || y >= H) return false;
      if (solid(x, y) || solid(x, y - 1)) return false;
      if (fatal(x, y) || fatal(x, y - 1)) return false;
      return support(x, y + 1);
    };
    var canBe = function (x, y) {
      if (x < 0 || x >= W || y < 1 || y >= H) return false;
      return !solid(x, y) && !solid(x, y - 1) && !fatal(x, y) && !fatal(x, y - 1);
    };
    var canCling = function (x, y) {
      return canBe(x, y) && (solid(x - 1, y) || solid(x + 1, y));
    };
    var fallTo = function (x, y) {
      for (var ty = y; ty < H; ty++) {
        if (!canBe(x, ty)) return -1;
        if (fatal(x, ty + 1)) return -1;
        if (support(x, ty + 1)) return ty;
      }
      return -1;
    };
    var clearRun = function (x0, x1, y) {
      var d = x1 >= x0 ? 1 : -1;
      for (var x = x0; x !== x1 + d; x += d) if (!canBe(x, y)) return false;
      return true;
    };

    var JUMP_UP = 3, JUMP_RUN = 4, DASH_RUN = 6, WALL_UP = 3;

    // node ids: mode 0 = standing, mode 1 = clinging
    var ids = {}, nodes = [];
    var nid = function (x, y, m) {
      var k = (m * 4096 + x) * 4096 + y;
      var v = ids[k];
      if (v === undefined) { v = nodes.length; ids[k] = v; nodes.push([x, y, m]); }
      return v;
    };
    var edges = [];   // [from, to, cost]
    var cost = function (x0, y0, x1, y1) {
      return 5 + Math.abs(x1 - x0) * 7 + Math.abs(y1 - y0) * 5;
    };
    var link = function (ax, ay, am, bx, by, bm) {
      edges.push([nid(ax, ay, am), nid(bx, by, bm), cost(ax, ay, bx, by)]);
    };

    var x, y;
    for (y = 1; y < H; y++) {
      for (x = 0; x < W; x++) {
        if (!canStand(x, y)) continue;
        // walk / step
        for (var dxs = -1; dxs <= 1; dxs += 2) {
          for (var dys = -1; dys <= 1; dys++) {
            if (canBe(x + dxs, y) && canStand(x + dxs, y + dys)) link(x, y, 0, x + dxs, y + dys, 0);
          }
        }
        // step off and fall, with drift
        for (var d1 = -DASH_RUN; d1 <= DASH_RUN; d1++) {
          if (!d1 || !clearRun(x, x + d1, y)) continue;
          var l1 = fallTo(x + d1, y);
          if (l1 >= 0 && canStand(x + d1, l1)) link(x, y, 0, x + d1, l1, 0);
        }
        // jump
        for (var up = 1; up <= JUMP_UP; up++) {
          if (!canBe(x, y - up)) break;
          var reach = up <= 2 ? DASH_RUN : JUMP_RUN;
          for (var dx2 = -reach; dx2 <= reach; dx2++) {
            var nx = x + dx2, ny = y - up;
            if (!clearRun(x, nx, ny)) continue;
            if (canStand(nx, ny)) link(x, y, 0, nx, ny, 0);
            var l2 = fallTo(nx, ny);
            if (l2 >= 0 && canStand(nx, l2)) link(x, y, 0, nx, l2, 0);
            if (canCling(nx, ny)) link(x, y, 0, nx, ny, 1);
          }
          if (canCling(x, y - up)) link(x, y, 0, x, y - up, 1);
        }
      }
    }
    // cling nodes: kick off and up, or let go
    var seedCount = nodes.length;
    for (var i = 0; i < seedCount; i++) {
      if (nodes[i][2] !== 1) continue;
      x = nodes[i][0]; y = nodes[i][1];
      for (var up2 = 1; up2 <= WALL_UP; up2++) {
        for (var dx3 = -JUMP_RUN; dx3 <= JUMP_RUN; dx3++) {
          var mx = x + dx3, my = y - up2;
          if (!canBe(mx, my) || !clearRun(x, mx, my)) continue;
          if (canCling(mx, my)) link(x, y, 1, mx, my, 1);
          if (canStand(mx, my)) link(x, y, 1, mx, my, 0);
          var l3 = fallTo(mx, my);
          if (l3 >= 0 && canStand(mx, l3)) link(x, y, 1, mx, l3, 0);
        }
      }
      var l4 = fallTo(x, y);
      if (l4 >= 0 && canStand(x, l4)) link(x, y, 1, x, l4, 0);
    }
    // Cling nodes created after their own expansion pass still need outgoing
    // edges, so sweep until the node list stops growing.
    var guard = 0;
    while (nodes.length > seedCount && guard++ < 12) {
      var from = seedCount; seedCount = nodes.length;
      for (var j = from; j < nodes.length; j++) {
        if (nodes[j][2] !== 1) continue;
        x = nodes[j][0]; y = nodes[j][1];
        for (var u3 = 1; u3 <= WALL_UP; u3++) {
          for (var d4 = -JUMP_RUN; d4 <= JUMP_RUN; d4++) {
            var ax2 = x + d4, ay2 = y - u3;
            if (!canBe(ax2, ay2) || !clearRun(x, ax2, ay2)) continue;
            if (canCling(ax2, ay2)) link(x, y, 1, ax2, ay2, 1);
            if (canStand(ax2, ay2)) link(x, y, 1, ax2, ay2, 0);
            var l5 = fallTo(ax2, ay2);
            if (l5 >= 0 && canStand(ax2, l5)) link(x, y, 1, ax2, l5, 0);
          }
        }
        var l6 = fallTo(x, y);
        if (l6 >= 0 && canStand(x, l6)) link(x, y, 1, x, l6, 0);
      }
    }

    // reverse adjacency
    var rev = nodes.map(function () { return []; });
    for (var e = 0; e < edges.length; e++) rev[edges[e][1]].push([edges[e][0], edges[e][2]]);

    /* What it costs to *be* at a node, as opposed to to move between two.
     * A standing body occupies rows y and y-1, so that is where a spike hurts.
     * This has to be part of the shortest path, not a decoration added to the
     * answer afterwards: added afterwards, the field still routes straight
     * through a spike bed and the only signal the agent gets is "do not stand
     * exactly here" - so clearing five tiles of spikes in one dash-jump looks
     * barely better than shuffling along the edge of them, and the agent
     * shuffles until it dies. Folded into the relaxation, the whole approach
     * to the bed inherits the cost and jumping it is worth a fortune. */
    var SPIKE_COST = 4000;
    var nodeCost = new Float64Array(nodes.length);
    for (i = 0; i < nodes.length; i++) {
      if (spike(nodes[i][0], nodes[i][1]) || spike(nodes[i][0], nodes[i][1] - 1)) {
        nodeCost[i] = SPIKE_COST;
      }
    }

    // goal = nearest standing node
    var gi = -1, best = 1e9;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i][2] !== 0) continue;
      var dg = Math.abs(nodes[i][0] - goalTx) * 2 + Math.abs(nodes[i][1] - goalTy);
      if (dg < best) { best = dg; gi = i; }
    }
    if (gi < 0) return null;

    // Dijkstra with a binary heap (node counts get into the thousands here)
    var INF = 1e15;
    var dist = new Float64Array(nodes.length);
    for (i = 0; i < nodes.length; i++) dist[i] = INF;
    dist[gi] = 0;
    var heap = [[0, gi]];
    var pop = function () {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var k = 0;
        for (;;) {
          var l = k * 2 + 1, r = l + 1, m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          var t = heap[k]; heap[k] = heap[m]; heap[m] = t; k = m;
        }
      }
      return top;
    };
    var push = function (d, n) {
      heap.push([d, n]);
      var k = heap.length - 1;
      while (k > 0) {
        var par = (k - 1) >> 1;
        if (heap[par][0] <= heap[k][0]) break;
        var t = heap[k]; heap[k] = heap[par]; heap[par] = t; k = par;
      }
    };
    while (heap.length) {
      var top = pop();
      var u = top[1];
      if (top[0] > dist[u]) continue;
      var list = rev[u];
      for (var q = 0; q < list.length; q++) {
        var v = list[q][0], w = list[q][1];
        var nd = dist[u] + w + nodeCost[v];
        if (nd < dist[v]) { dist[v] = nd; push(nd, v); }
      }
    }

    var map = {};
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i][2] !== 0 || dist[i] >= INF) continue;
      var d = dist[i];
      var kk = tileKey(nodes[i][0], nodes[i][1]);
      if (map[kk] === undefined || d < map[kk]) map[kk] = d;
    }
    return { map: map, nodes: nodes, goal: nodes[gi], reached: Object.keys(map).length };
  }

  // Field lookup for an arbitrary pixel position: falls back to a nearby tile.
  function distAt(field, px, py) {
    var tx = Math.floor(px / T), ty = Math.floor((py + VZ.P.H / 2 - 1) / T);
    var m = field.map;
    for (var dy = 0; dy <= 3; dy++) {
      var v = m[tileKey(tx, ty + dy)];
      if (v !== undefined) return v;
    }
    for (var dx = -1; dx <= 1; dx += 2) {
      var v2 = m[tileKey(tx + dx, ty)];
      if (v2 !== undefined) return v2 + 10;
    }
    return null;
  }

  // ================================================================ primitives
  /* Each primitive is a function (frame, state) -> input object, plus a stop
   * rule. They are all self-contained from a near-standstill, so the executor
   * can start one at any grounded moment. */
  function mkJump(dir, hold, dashAt, runup) {
    return {
      name: 'jmp' + (dir > 0 ? 'R' : 'L') + hold + (dashAt >= 0 ? 'd' + dashAt : '') + 'r' + runup,
      fn: function (f) {
        var inp = {};
        if (dir) inp[dir > 0 ? 'right' : 'left'] = true;
        if (f >= runup && f < runup + hold) inp.jump = true;
        if (dashAt >= 0 && f === runup + dashAt) inp.dash = true;
        return inp;
      },
      maxFrames: 110
    };
  }
  /* Dash along the ground first, jump once the speed is there.
   *
   * mkJump's `dashAt` is measured from the jump, so it can only produce a
   * dash *at* or *after* take-off - it never builds ground speed first. That
   * left the whole "run up and dash-jump it" idea outside the search space,
   * and the five-tile spike beds in the Void Citadel need exactly that: from
   * a standstill nothing clears them, with a dash already at full speed the
   * jump lands four tiles clear. */
  function mkDashJump(dir, hold, delay) {
    return {
      name: 'djmp' + (dir > 0 ? 'R' : 'L') + hold + 'w' + delay,
      fn: function (f) {
        var inp = {};
        inp[dir > 0 ? 'right' : 'left'] = true;
        if (f === 0) inp.dash = true;
        if (f >= delay && f < delay + hold) inp.jump = true;
        return inp;
      },
      maxFrames: 110
    };
  }
  function mkRun(dir, frames) {
    return {
      groundMove: true, runFrames: frames,
      name: 'run' + (dir > 0 ? 'R' : 'L') + frames,
      fn: function (f) {
        var inp = {};
        if (f < frames) inp[dir > 0 ? 'right' : 'left'] = true;
        return inp;
      },
      maxFrames: frames + 40
    };
  }
  function mkDashRun(dir) {
    return {
      groundMove: true, runFrames: 22,
      name: 'dash' + (dir > 0 ? 'R' : 'L'),
      fn: function (f) {
        var inp = {};
        inp[dir > 0 ? 'right' : 'left'] = true;
        if (f === 0) inp.dash = true;
        return inp;
      },
      maxFrames: 40
    };
  }
  function mkDrop(dir) {
    return {
      name: 'drop' + (dir > 0 ? 'R' : dir < 0 ? 'L' : ''),
      fn: function (f) {
        var inp = { down: f < 3 };
        if (f < 3) inp.jump = true;
        if (dir) inp[dir > 0 ? 'right' : 'left'] = true;
        return inp;
      },
      maxFrames: 70
    };
  }
  // Reactive wall climb: kick off whenever we start sliding, steer back after
  // the control lock, alternate. `exitDir` biases which way we leave the shaft.
  function mkClimb(exitDir) {
    return {
      name: 'climb' + (exitDir > 0 ? 'R' : 'L'),
      fn: function (f, s) {
        var inp = {};
        if (s.grounded && f < 4) {
          inp[exitDir > 0 ? 'right' : 'left'] = true;
          inp.jump = true;
          return inp;
        }
        if (s.sliding) {
          inp.jump = true;
          inp[s.wallDir > 0 ? 'left' : 'right'] = true;
          s._kick = -s.wallDir;
          s._kickT = 0;
          return inp;
        }
        if (s._kick) {
          s._kickT = (s._kickT || 0) + 1;
          inp[s._kick > 0 ? 'right' : 'left'] = true;
          if (s._kickT < 6) inp.jump = true;
          if (s._kickT > 40) s._kick = 0;
          return inp;
        }
        inp[exitDir > 0 ? 'right' : 'left'] = true;
        if (!s.grounded && f % 12 < 3) inp.jump = true;
        return inp;
      },
      maxFrames: 200
    };
  }

  var PRIMS = [];
  [1, -1].forEach(function (dir) {
    [4, 9, 14, 22].forEach(function (hold) {
      [0, 8].forEach(function (runup) {
        PRIMS.push(mkJump(dir, hold, -1, runup));
      });
      PRIMS.push(mkJump(dir, hold, 0, 6));    // dash then jump
      PRIMS.push(mkJump(dir, hold, 4, 0));    // jump then air-dash
    });
    [9, 22].forEach(function (hold) {
      [8, 16].forEach(function (delay) { PRIMS.push(mkDashJump(dir, hold, delay)); });
    });
    PRIMS.push(mkRun(dir, 10));
    PRIMS.push(mkRun(dir, 26));
    PRIMS.push(mkDashRun(dir));
    PRIMS.push(mkDrop(dir));
    PRIMS.push(mkClimb(dir));
  });
  PRIMS.push({ groundMove: true, runFrames: 8, name: 'wait',
               fn: function () { return {}; }, maxFrames: 10 });

  // ============================================================ local search
  /* Simulate one primitive from `state`, stopping when it settles. Returns the
   * end state plus what it cost. */
  /* Simulate one primitive until the move has *resolved*, and return the end
   * state. Resolution is a property of the state, not the input: an airborne
   * move ends when it lands, a ground move ends when its run finishes. Testing
   * the input instead means a program that holds a direction never terminates
   * and every candidate is scored mid-flight, which is useless. */
  function rollout(sim, state, prim, stopAfter) {
    var s = sim.cloneState(state);
    s._kick = 0; s._kickT = 0;
    var maxF = Math.min(prim.maxFrames, stopAfter || prim.maxFrames);
    var inputs = [];
    var traj = [];
    var spikeHits = 0, wasHazard = false;
    var leftGround = !s.grounded;
    var settleFor = 0;
    for (var f = 0; f < maxF; f++) {
      var inp = prim.fn(f, s) || {};
      inputs.push(inp);
      // Record the position the input is applied AT, not the one it produces,
      // so the executor can compare like with like when checking whether the
      // plan is still valid.
      traj.push(s.body.x, s.body.y);
      sim.step(s, inp);

      if (s.dead === 'liquid' || s.dead === 'pit') {
        return { s: s, inputs: inputs, traj: traj, dead: s.dead };
      }
      if (s.dead === 'spike') {
        if (!wasHazard) spikeHits++;
        wasHazard = true;
        s.dead = null;                 // spikes hurt; they do not end the run
      } else wasHazard = false;

      if (!s.grounded) { leftGround = true; settleFor = 0; continue; }

      if (prim.groundMove) {
        // a run or dash: finished once its programmed frames are done and it
        // has stopped sliding
        if (f >= prim.runFrames && Math.abs(s.vx) < 0.35) break;
      } else if (leftGround) {
        // an airborne move: finished a couple of frames after touching down,
        // so the landing frame's velocity has resolved
        if (++settleFor >= 2) break;
      } else if (f > 24) {
        // never actually left the ground (a jump that hit a ceiling, say)
        break;
      }
    }
    return { s: s, inputs: inputs, traj: traj, dead: null, spikeHits: spikeHits };
  }

  AGENT.plan = {
    buildField: buildField,
    distAt: distAt,
    tileKey: tileKey,
    PRIMS: PRIMS,
    rollout: rollout
  };

})(typeof window !== 'undefined' ? window : globalThis);
