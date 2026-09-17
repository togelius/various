/* SCRIPTPROF — GAVEL-style search over PuzzleScript genes.
 *
 * GAVEL used a language model as a mutation operator inside MAP-Elites.
 * ScriptDoctor's own future-work paragraph asks for the same wrapping:
 * take compile + BFS metrics and put them in a novelty-seeking loop.
 *
 * Here the mutation operator is grammatical, not neural — every child still
 * compiles, which is the point of mutating a gene rather than a string.
 * Optional LLM mutation can sit in the same slot later.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScriptProf = Object.assign(root.ScriptProf || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MECHANICS = ['push', 'pull', 'swap', 'match3'];

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pick(rand, arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  function cloneGene(g) {
    return {
      title: g.title,
      mechanics: { push: !!g.mechanics.push, pull: !!g.mechanics.pull, swap: !!g.mechanics.swap, match3: !!g.mechanics.match3 },
      grid: g.grid.map(function (row) { return row.slice(); }),
      id: g.id
    };
  }

  function randomGene(rand, parent) {
    if (parent) {
      var g = cloneGene(parent);
      mutate(g, rand);
      return g;
    }
    var h = 6, w = 6;
    var grid = [];
    var y, x;
    for (y = 0; y < h; y++) {
      var row = '';
      for (x = 0; x < w; x++) {
        if (y === 0 || x === 0 || y === h - 1 || x === w - 1) row += '#';
        else row += '.';
      }
      grid.push(row);
    }
    function put(ch) {
      var spots = [];
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        if (grid[y][x] === '.') spots.push([x, y]);
      }
      if (!spots.length) return;
      var p = pick(rand, spots);
      grid[p[1]] = grid[p[1]].slice(0, p[0]) + ch + grid[p[1]].slice(p[0] + 1);
    }
    put('P');
    var crates = 1 + (rand() < 0.5 ? 1 : 0);
    var i;
    for (i = 0; i < crates; i++) { put('*'); put('O'); }
    var mech = { push: true, pull: false, swap: false, match3: false };
    if (rand() < 0.35) mech.pull = true;
    if (rand() < 0.2) { mech.swap = true; mech.push = false; }
    if (rand() < 0.2) mech.match3 = true;
    return { title: 'mutant', mechanics: mech, grid: grid };
  }

  function mutate(g, rand) {
    var r = rand();
    if (r < 0.35) {
      var k = pick(rand, MECHANICS);
      if (k === 'push' && g.mechanics.swap) g.mechanics.swap = false;
      if (k === 'swap' && g.mechanics.push) g.mechanics.push = false;
      g.mechanics[k] = !g.mechanics[k];
      if (!g.mechanics.push && !g.mechanics.pull && !g.mechanics.swap) g.mechanics.push = true;
    } else if (r < 0.55) {
      // flip a wall / floor
      var x = 1 + Math.floor(rand() * (g.grid[0].length - 2));
      var y = 1 + Math.floor(rand() * (g.grid.length - 2));
      var ch = g.grid[y][x];
      var next = ch === '#' ? '.' : ch === '.' ? (rand() < 0.5 ? '#' : ch) : ch;
      if (ch === '.' || ch === '#') {
        g.grid[y] = g.grid[y].slice(0, x) + next + g.grid[y].slice(x + 1);
      }
    } else if (r < 0.75) {
      // shuffle two interior tiles that aren't both player
      var cells = [];
      for (y = 1; y < g.grid.length - 1; y++) {
        for (x = 1; x < g.grid[0].length - 2 && x < g.grid[0].length - 1; x++) {
          cells.push([x, y]);
        }
      }
      if (cells.length >= 2) {
        var a = pick(rand, cells), b = pick(rand, cells);
        var ca = g.grid[a[1]][a[0]], cb = g.grid[b[1]][b[0]];
        g.grid[a[1]] = g.grid[a[1]].slice(0, a[0]) + cb + g.grid[a[1]].slice(a[0] + 1);
        g.grid[b[1]] = g.grid[b[1]].slice(0, b[0]) + ca + g.grid[b[1]].slice(b[0] + 1);
      }
    } else {
      // add or remove a paper/desk pair
      var papers = countChar(g.grid, '*') + countChar(g.grid, '@');
      if (papers > 1 && rand() < 0.5) {
        replaceOne(g, rand, '*', '.');
        replaceOne(g, rand, 'O', '.');
      } else {
        replaceOne(g, rand, '.', '*');
        replaceOne(g, rand, '.', 'O');
      }
    }
    // keep exactly one player
    var ps = [];
    for (y = 0; y < g.grid.length; y++) {
      for (x = 0; x < g.grid[y].length; x++) {
        if (g.grid[y][x] === 'P') ps.push([x, y]);
      }
    }
    if (ps.length === 0) replaceOne(g, rand, '.', 'P');
    if (ps.length > 1) {
      ps.slice(1).forEach(function (p) {
        g.grid[p[1]] = g.grid[p[1]].slice(0, p[0]) + '.' + g.grid[p[1]].slice(p[0] + 1);
      });
    }
  }

  function countChar(grid, ch) {
    var n = 0, y, x;
    for (y = 0; y < grid.length; y++) for (x = 0; x < grid[y].length; x++) if (grid[y][x] === ch) n++;
    return n;
  }

  function replaceOne(g, rand, from, to) {
    var spots = [];
    var y, x;
    for (y = 1; y < g.grid.length - 1; y++) {
      for (x = 1; x < g.grid[y].length - 1; x++) {
        if (g.grid[y][x] === from) spots.push([x, y]);
      }
    }
    if (!spots.length) return false;
    var p = pick(rand, spots);
    g.grid[p[1]] = g.grid[p[1]].slice(0, p[0]) + to + g.grid[p[1]].slice(p[0] + 1);
    return true;
  }

  function emitGene(g) {
    var rules = [];
    if (g.mechanics.push) rules.push('[ > Player | Paper ] -> [ > Player | > Paper ]');
    if (g.mechanics.pull) rules.push('[ < Player | Paper ] -> [ < Player | < Paper ]');
    if (g.mechanics.swap) rules.push('[ > Player | Paper ] -> [ Paper | Player ]');
    if (g.mechanics.match3) rules.push('late [ Paper | Paper | Paper ] -> [ | | ]');
    var win = g.mechanics.match3 && !g.mechanics.push && !g.mechanics.pull && !g.mechanics.swap
      ? 'No Paper'
      : (g.mechanics.match3 ? 'No Paper' : 'All Paper on Desk');
    var tags = MECHANICS.filter(function (k) { return g.mechanics[k]; }).join('+') || 'empty';
    return [
      'title ' + (g.title || 'mutant') + ' (' + tags + ')',
      'author ScriptProf',
      '',
      '========', 'OBJECTS', '========', '',
      'Background', '#e8dcc4', '',
      'Desk', 'DarkBlue', '.....', '.000.', '.0.0.', '.000.', '.....', '',
      'Wall', 'DarkBrown Brown', '00010', '11111', '01000', '11111', '00010', '',
      'Player', 'Black Orange White Blue', '.000.', '.111.', '22222', '.333.', '.3.3.', '',
      'Paper', 'Orange Yellow', '00000', '0...0', '0...0', '0...0', '00000', '',
      '=======', 'LEGEND', '=======', '',
      '. = Background',
      '# = Wall',
      'P = Player',
      '* = Paper',
      '@ = Paper and Desk',
      'O = Desk',
      '',
      '================', 'COLLISIONLAYERS', '================', '',
      'Background',
      'Desk',
      'Player, Wall, Paper',
      '',
      '======', 'RULES', '======', '',
      rules.join('\n') || '(no rules)',
      '',
      '==============', 'WINCONDITIONS', '==============', '',
      win,
      '',
      '=======', 'LEVELS', '=======', '',
      g.grid.join('\n'),
      ''
    ].join('\n');
  }

  function geneFromSeed(seed, SP) {
    var parsed = SP.parse(seed.source);
    var lv = parsed.levels[0];
    var mech = {
      push: /\[\s*>\s*Player\s*\|\s*Paper\s*\]\s*->\s*\[\s*>\s*Player\s*\|\s*>\s*Paper/i.test(seed.source),
      pull: /\[\s*<\s*Player\s*\|\s*Paper\s*\]/i.test(seed.source),
      swap: /->\s*\[\s*Paper\s*\|\s*Player\s*\]/i.test(seed.source),
      match3: /Paper\s*\|\s*Paper\s*\|\s*Paper/i.test(seed.source)
    };
    if (!mech.push && !mech.pull && !mech.swap && !mech.match3) mech.push = true;
    return { title: parsed.title, mechanics: mech, grid: lv.grid.slice(), id: seed.id };
  }

  function evaluate(g, opts) {
    var SP = globalThis.ScriptProf;
    var source = emitGene(g);
    var parsed, compiled, report;
    try {
      parsed = SP.parse(source);
      compiled = SP.compile(parsed);
      report = SP.solveGame(compiled, { limit: (opts && opts.evalLimit) || 8000, maxDepth: 30 });
    } catch (err) {
      return { compiles: false, fitness: -1, source: source, error: String(err), length: 0, nodes: 0 };
    }
    var length = 0;
    var solved = report.allSolvable;
    if (report.levels[0] && report.levels[0].solved) length = report.levels[0].length;
    // ScriptDoctor wanted solutions longer than 10; on these tiny boards, >2 is already a puzzle.
    var fitness = 0;
    if (solved && length >= 2) {
      fitness = length;
      if (length >= 4) fitness += 2;
      if (g.mechanics.pull) fitness += 1;
      if (g.mechanics.swap) fitness += 1;
      if (g.mechanics.match3) fitness += 2;
    }
    return {
      compiles: true,
      solved: solved,
      fitness: fitness,
      length: length,
      nodes: report.complexity,
      source: source,
      mechanics: g.mechanics,
      grid: g.grid
    };
  }

  function binOf(ev) {
    var len = ev.length || 0;
    var li = len <= 1 ? 0 : len <= 3 ? 1 : len <= 6 ? 2 : len <= 10 ? 3 : len <= 16 ? 4 : 5;
    var m = 0;
    if (ev.mechanics) {
      if (ev.mechanics.push) m++;
      if (ev.mechanics.pull) m++;
      if (ev.mechanics.swap) m++;
      if (ev.mechanics.match3) m++;
    }
    var mi = Math.min(3, Math.max(0, m - 1));
    return li + '-' + mi;
  }

  function evolve(opts) {
    opts = opts || {};
    var SP = globalThis.ScriptProf;
    var rand = rng(opts.seed || 1);
    var generations = opts.generations || 12;
    var evalLimit = opts.evalLimit || 8000;
    var archive = Object.create(null);
    var stats = { tried: 0, compiled: 0, solved: 0, best: 0 };
    var seeds = (SP.SEEDS || []).filter(function (s) {
      return /Paper/.test(s.source);
    });
    var pool = seeds.length ? seeds.map(function (s) { return geneFromSeed(s, SP); }) : [randomGene(rand)];

    function consider(g) {
      stats.tried++;
      var ev = evaluate(g, { evalLimit: evalLimit });
      ev.gene = g;
      ev.title = (g.title || 'mutant');
      if (ev.compiles) stats.compiled++;
      if (ev.solved) stats.solved++;
      if (ev.fitness > stats.best) stats.best = ev.fitness;
      if (ev.fitness <= 0) return ev;
      var bin = binOf(ev);
      ev.bin = bin;
      if (!archive[bin] || ev.fitness > archive[bin].fitness) archive[bin] = ev;
      return ev;
    }

    pool.forEach(function (g) { consider(g); });

    var gen;
    for (gen = 0; gen < generations; gen++) {
      var elites = Object.keys(archive).map(function (k) { return archive[k].gene; });
      var parent = elites.length && rand() < 0.7 ? pick(rand, elites) : pick(rand, pool);
      var child = randomGene(rand, parent);
      child.title = 'gen' + (gen + 1);
      consider(child);
      if (opts.onStep) opts.onStep({ gen: gen + 1, stats: stats, archive: archiveList(archive) });
    }

    return { archive: archiveList(archive), stats: stats };
  }

  function archiveList(archive) {
    return Object.keys(archive).sort().map(function (k) {
      var e = archive[k];
      return {
        bin: k,
        fitness: e.fitness,
        length: e.length,
        nodes: e.nodes,
        source: e.source,
        title: e.title,
        mechanics: e.mechanics,
        grid: e.grid
      };
    });
  }

  function evolveStepwise(opts) {
    // Same as evolve, but yields after each generation for the UI.
    opts = opts || {};
    var SP = globalThis.ScriptProf;
    var rand = rng(opts.seed || Date.now());
    var evalLimit = opts.evalLimit || 6000;
    var archive = Object.create(null);
    var stats = { tried: 0, compiled: 0, solved: 0, best: 0 };
    var seeds = (SP.SEEDS || []).filter(function (s) { return /Paper/.test(s.source); });
    var pool = seeds.map(function (s) { return geneFromSeed(s, SP); });
    if (!pool.length) pool = [randomGene(rand)];

    function consider(g) {
      stats.tried++;
      var ev = evaluate(g, { evalLimit: evalLimit });
      ev.gene = g;
      ev.title = g.title || 'mutant';
      if (ev.compiles) stats.compiled++;
      if (ev.solved) stats.solved++;
      if (ev.fitness > stats.best) stats.best = ev.fitness;
      if (ev.fitness <= 0) return;
      var bin = binOf(ev);
      ev.bin = bin;
      if (!archive[bin] || ev.fitness > archive[bin].fitness) archive[bin] = ev;
    }
    pool.forEach(consider);

    return {
      stats: stats,
      snapshot: function () { return { stats: stats, archive: archiveList(archive) }; },
      step: function (n) {
        var i, elites, parent, child;
        n = n || 1;
        for (i = 0; i < n; i++) {
          elites = Object.keys(archive).map(function (k) { return archive[k].gene; });
          parent = elites.length && rand() < 0.7 ? pick(rand, elites.concat(pool)) : pick(rand, pool);
          child = randomGene(rand, parent);
          child.title = 'gen' + stats.tried;
          consider(child);
        }
        return { stats: stats, archive: archiveList(archive) };
      }
    };
  }

  return {
    MECHANICS: MECHANICS,
    emitGene: emitGene,
    mutate: mutate,
    evaluate: evaluate,
    evolve: evolve,
    evolveStepwise: evolveStepwise,
    geneFromSeed: geneFromSeed
  };
});
