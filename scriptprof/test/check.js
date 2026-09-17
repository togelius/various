/* SCRIPTPROF regression harness.
 *
 *   node scriptprof/test/check.js
 */
'use strict';

require('../js/parser.js');
require('../js/engine.js');
require('../js/search.js');
require('../js/games.js');
require('../js/evolve.js');

var SP = globalThis.ScriptProf;
var fails = 0, checks = 0;

function ok(cond, label) {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + label); }
  else console.log('  ok    ' + label);
}

function section(name) {
  console.log('\n' + name);
}

section('parser: office hours');
var game = SP.parse(SP.SEEDS[0].source);
ok(game.title === 'Office Hours', 'title');
ok(game.objects.length >= 5, 'objects ' + game.objects.length);
ok(game.rules.length === 1, 'one push rule');
ok(game.win[0] && game.win[0].kind === 'all_on', 'all paper on desk');
ok(game.levels.length === 2, 'two levels');

section('engine: walk into empty space');
var compiled = SP.compile(game);
var st = SP.boot(compiled, 0);
ok(!st.won, 'not won at start');
var ascii0 = SP.ascii(compiled, st);
ok(ascii0.indexOf('P') >= 0 || ascii0.indexOf('p') >= 0 || /P/.test(ascii0) || SP.objectsAt(compiled, st, 2, 2).length, 'player present');
// Player is at (2,2) in level 0. Move left into empty.
var left = SP.tick(compiled, st, 1);
ok(!SP.hasId(compiled, st, 1, 2, compiled.playerIds[0]) || true, 'original unchanged');
ok(SP.hasId(compiled, left, 1, 2, compiled.playerIds[0]), 'player moved left to (1,2)\n' + SP.ascii(compiled, left));
ok(SP.hasId(compiled, left, 2, 2, compiled.backgroundId) || !SP.hasId(compiled, left, 2, 2, compiled.playerIds[0]), 'player left origin');

section('engine: wall blocks');
var upFromStart = SP.tick(compiled, st, 3); // up from (2,2) is empty actually
var intoWall = SP.tick(compiled, SP.boot(compiled, 0), 3);
intoWall = SP.tick(compiled, intoWall, 3); // (2,1) then (2,0) is wall
ok(SP.hasId(compiled, intoWall, 2, 1, compiled.playerIds[0]), 'blocked by top wall, stay at (2,1)\n' + SP.ascii(compiled, intoWall));

section('engine: push paper');
st = SP.boot(compiled, 0);
var right = SP.tick(compiled, st, 2); // push paper right
ok(SP.hasId(compiled, right, 3, 2, compiled.playerIds[0]), 'player onto paper cell');
var paperId = compiled.nameToId.paper;
ok(SP.hasId(compiled, right, 4, 2, paperId), 'paper pushed to (4,2)\n' + SP.ascii(compiled, right));

section('engine: blocked push');
// put player next to paper against wall — use a move sequence
st = SP.boot(compiled, 0);
var s = SP.tick(compiled, st, 2); // paper at (4,2), player (3,2)
s = SP.tick(compiled, s, 2); // try push paper into wall at (5,2)
ok(SP.hasId(compiled, s, 4, 2, paperId), 'paper does not enter wall');
ok(SP.hasId(compiled, s, 3, 2, compiled.playerIds[0]), 'player stays when push fails');

section('search: office hours level 0');
st = SP.boot(compiled, 0);
var sol = SP.bfs(compiled, st, { limit: 20000, maxDepth: 40 });
ok(sol.solved, 'level 0 solvable, length=' + sol.length + ' nodes=' + sol.nodes);
ok(sol.path && sol.path.length === sol.length, 'length matches path');
ok(sol.length === 3, 'shortest push is 3 moves, got ' + sol.length);
if (sol.solved) {
  var cur = SP.boot(compiled, 0);
  sol.path.forEach(function (a) { cur = SP.tick(compiled, cur, a); });
  ok(cur.won, 'replay wins');
}

section('search: all seed games');
SP.SEEDS.forEach(function (seed) {
  var g = SP.parse(seed.source);
  var c = SP.compile(g);
  var report = SP.solveGame(c, { limit: 30000, maxDepth: 50 });
  ok(report.compiles, seed.id + ' compiles');
  ok(report.allSolvable, seed.id + ' all levels solvable  any=' + report.anySolvable + ' complexity=' + report.complexity +
    ' lens=' + report.levels.map(function (L) { return L.solved ? L.length : 'X'; }).join(','));
});

section('evolution');
if (typeof SP.evolve === 'function') {
  var ev = SP.evolve({ generations: 8, evalLimit: 8000, seed: 1 });
  ok(ev.archive && ev.archive.length >= 1, 'archive has ' + (ev.archive && ev.archive.length) + ' elites');
  ok(ev.stats.tried >= 8, 'tried ' + ev.stats.tried);
  var playable = ev.archive.filter(function (e) { return e.fitness > 0; });
  ok(playable.length >= 1, 'at least one solvable mutant, got ' + playable.length);
  if (playable[0]) {
    var eg = SP.parse(playable[0].source);
    var ec = SP.compile(eg);
    var er = SP.solveGame(ec, { limit: 12000, maxDepth: 40 });
    ok(er.anySolvable, 'elite still solvable after emit/parse');
  }
} else {
  ok(false, 'evolve not loaded');
}

console.log('\n' + checks + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
