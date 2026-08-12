/* Level regression harness.
 *
 * For every level: the stored solution must win, within budget, without
 * paradox — and doing nothing must NOT win, or the level isn't a level.
 * Doubt levels additionally have to survive Ananke forgetting any one place.
 *
 *   node ananke/test/check.js
 */
'use strict';

var A = require('../js/engine.js');
require('../js/levels.js');
var LEVELS = globalThis.Ananke.LEVELS;

var fails = 0, checks = 0;

function ok(cond, label) {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + label); }
  else console.log('  ok    ' + label);
}

// Thin stone starts shut; that is what holds the level together until Ananke
// decides otherwise.
function closedOf(world, opened) {
  return world.breakable.filter(function (p) { return (opened || []).indexOf(p) < 0; });
}
function withClosed(world, seals, opened) {
  return seals.concat(closedOf(world, opened).map(function (p) {
    return { p: p, a: 0, b: world.T };
  }));
}

function toSeals(world, list) {
  return list.map(function (s) {
    var p = world.idxAt[s.y * world.w + s.x];
    if (p < 0) throw new Error('seal on stone at ' + s.x + ',' + s.y);
    return { p: p, a: s.a, b: Math.min(s.b, world.T) };
  });
}

LEVELS.forEach(function (lv) {
  console.log('\n' + lv.name + '  [' + lv.id + ']');

  // Grid sanity: rectangular, walled, and every declared point is open ground.
  ok(lv.grid.length === lv.h, 'grid height ' + lv.h);
  ok(lv.grid.every(function (r) { return r.length === lv.w; }), 'grid width ' + lv.w);

  var world = A.compile(lv);
  var t0 = Date.now();
  var empty = A.solve(world, withClosed(world, [], []));
  var ms = Date.now() - t0;

  lv.agents.forEach(function (ag, i) {
    ok(lv.grid[ag.start[1]][ag.start[0]] !== '#', 'agent ' + i + ' starts on open ground');
  });
  ok(!empty.paradox, 'the empty world is possible');
  ok(!empty.won, 'the empty world does NOT already satisfy the objectives');
  ok(ms < 400, 'solve takes ' + ms + 'ms (interactive)');

  var seals = toSeals(world, lv.solution);
  ok(seals.length <= lv.budget, 'solution uses ' + seals.length + ' of ' + lv.budget + ' seals');

  var res = A.solve(world, withClosed(world, seals, []));
  ok(!res.paradox, 'solution leaves at least one future standing');
  res.status.forEach(function (s, i) {
    ok(s.necessary, 'necessary: ' + lv.objectives[i].text);
  });

  if (res.won && !res.paradox) {
    // A uniform sample must exist, and must obey what we just made necessary.
    var path = A.sampleFuture(world, withClosed(world, seals, []), Math.random);
    ok(path && path.length === lv.T + 1, 'a future can be drawn from the survivors');
  }

  if (lv.doubt > 0) {
    var er = A.erosionTest(world, withClosed(world, seals, []));
    ok(er.survives, 'necessity survives Ananke forgetting any one place');
  } else if (res.won) {
    // Levels without doubt should be *tight*: dropping any one place should
    // break them. Otherwise the budget is padded and the level is mush.
    var er2 = A.erosionTest(world, withClosed(world, seals, []));
    ok(!er2.survives, 'solution is tight (no seal is spare)');
  }

  // Play the whole argument out: base answer, then each of Ananke's openings
  // met by the cheapest repair (shut the door it just opened). The player has
  // to finish necessary AND inside budget, or the level is unwinnable.
  if (lv.ananke) {
    var opened = [], live = seals.slice(), conceded = false;
    for (var rd = 0; rd < lv.ananke; rd++) {
      var mv = A.anankeOpens(world, live, closedOf(world, opened));
      if (!mv) { conceded = true; break; }
      opened.push(mv.pos);
      ok(A.solve(world, withClosed(world, live, opened)).won === false,
         'round ' + (rd + 1) + ': the opening at ' + world.posX[mv.pos] + ',' +
         world.posY[mv.pos] + ' really does break necessity');
      live.push({ p: mv.pos, a: 0, b: world.T });   // shut the door it opened
      var rr = A.solve(world, withClosed(world, live, opened));
      ok(rr.won && !rr.paradox, 'round ' + (rd + 1) + ': one seal answers it');
    }
    ok(live.length <= lv.budget,
       'the whole argument costs ' + live.length + ' of ' + lv.budget + ' seals' +
       (conceded ? ' (Ananke conceded early)' : ''));
  }

  // Counterexamples must be real: replay the witness and confirm it violates.
  if (!empty.won) {
    var bad = -1;
    empty.status.forEach(function (s, i) { if (!s.necessary && bad < 0) bad = i; });
    var wit = A.counterexample(world, withClosed(world, [], []), bad);
    ok(wit && wit.length === lv.T + 1, 'Ananke can produce a witness against the empty world');
  }
});

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + '  (' + checks + ' checks)');
process.exit(fails ? 1 : 0);
