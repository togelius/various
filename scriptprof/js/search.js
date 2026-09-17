/* SCRIPTPROF — breadth-first playtester (ScriptDoctor).
 *
 * A generated script is a success when it compiles and every level admits a
 * solution longer than a small threshold. We search the state graph with BFS
 * up to a node budget, the same signal ScriptDoctor fed back to the LLM.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScriptProf = Object.assign(root.ScriptProf || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ACTIONS = [1, 2, 3, 4]; // left right up down

  function bfs(compiled, state, opts) {
    opts = opts || {};
    var limit = opts.limit || 20000;
    var maxDepth = opts.maxDepth || 80;
    var E = rootEngine();
    var start = E.cloneState(state);
    if (start.won || E.checkWin(compiled, start)) {
      return { solved: true, path: [], nodes: 0, length: 0, trivial: true };
    }
    var q = [start];
    var how = [null];
    var seen = Object.create(null);
    seen[E.keyState(start)] = true;
    var nodes = 0;
    var head = 0;
    while (head < q.length) {
      var cur = q[head];
      var prev = how[head];
      head++;
      var depth = prev ? prev.depth : 0;
      if (depth >= maxDepth) continue;
      var a, i;
      for (i = 0; i < ACTIONS.length; i++) {
        a = ACTIONS[i];
        var next = E.tick(compiled, cur, a);
        nodes++;
        if (nodes > limit) {
          return { solved: false, path: null, nodes: nodes, length: 0, truncated: true };
        }
        var k = E.keyState(next);
        if (seen[k]) continue;
        seen[k] = true;
        var step = { prev: prev, action: a, depth: depth + 1, state: next };
        if (next.won) {
          var path = unwind(step);
          return { solved: true, path: path, nodes: nodes, length: path.length };
        }
        q.push(next);
        how.push(step);
      }
    }
    return { solved: false, path: null, nodes: nodes, length: 0 };
  }

  function unwind(step) {
    var acts = [];
    while (step && step.action) {
      acts.push(step.action);
      step = step.prev;
    }
    acts.reverse();
    return acts;
  }

  function solveGame(compiled, opts) {
    var E = rootEngine();
    var levels = [];
    var i, all = true, any = false, complexity = 0;
    for (i = 0; i < compiled.levels.length; i++) {
      var st = E.boot(compiled, i);
      var r = bfs(compiled, st, opts);
      levels.push(r);
      complexity += r.nodes;
      if (r.solved && r.length > 0) any = true;
      if (!r.solved) all = false;
    }
    return {
      compiles: true,
      anySolvable: any,
      allSolvable: all && compiled.levels.length > 0,
      levels: levels,
      complexity: complexity
    };
  }

  function rootEngine() {
    var SP = (typeof globalThis !== 'undefined' ? globalThis : this).ScriptProf;
    if (!SP || !SP.tick) throw new Error('engine not loaded');
    return SP;
  }

  return {
    ACTIONS: ACTIONS,
    bfs: bfs,
    solveGame: solveGame
  };
});
