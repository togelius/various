/* SCRIPTPROF — lab UI. */
(function () {
  'use strict';
  var SP = globalThis.ScriptProf;
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');

  var state = {
    mode: 'play',
    seedIndex: 0,
    level: 0,
    compiled: null,
    game: null,
    board: null,
    undo: [],
    replaying: false,
    evo: null,
    evoTimer: 0,
    catalog: []
  };

  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('on'); });
    document.getElementById(id).classList.add('on');
  }

  function highlightSource(text) {
    var esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return esc
      .replace(/^(title|author|homepage)\b/gim, '<span class="kw">$1</span>')
      .replace(/^(OBJECTS|LEGEND|SOUNDS|COLLISIONLAYERS|RULES|WINCONDITIONS|LEVELS)$/gm, '<span class="kw">$1</span>')
      .replace(/^(\[.*)$/gm, '<span class="rule">$1</span>')
      .replace(/^(All |Some |No ).*$/gm, '<span class="win">$&</span>');
  }

  function loadSource(source, name, blurb) {
    var game = SP.parse(source);
    var compiled = SP.compile(game);
    state.game = game;
    state.compiled = compiled;
    state.level = 0;
    state.extraName = name;
    state.extraBlurb = blurb;
    bootLevel(0);
    document.getElementById('source').innerHTML = highlightSource(source);
    document.getElementById('stagetitle').textContent = game.title;
    document.getElementById('stagemeta').textContent = (game.author ? game.author + ' · ' : '') +
      compiled.levels.length + ' level' + (compiled.levels.length === 1 ? '' : 's') + ' · ' +
      compiled.rules.length + ' rule' + (compiled.rules.length === 1 ? '' : 's');
  }

  function bootLevel(i) {
    state.level = i;
    state.board = SP.boot(state.compiled, i);
    state.undo = [];
    var lv = state.compiled.levels[i];
    document.getElementById('msg').textContent = lv.message || '';
    document.getElementById('winbanner').classList.remove('on');
    draw();
    statusLine('level ' + (i + 1) + '/' + state.compiled.levels.length);
  }

  function statusLine(s) {
    document.getElementById('status').textContent = s;
  }

  function draw() {
    if (!state.board || !state.compiled) return;
    var w = state.board.w, h = state.board.h;
    var max = Math.min(520, (document.getElementById('boardwrap').clientWidth || 400) - 8);
    var cell = Math.max(8, Math.floor(max / Math.max(w, h)));
    cell = Math.floor(cell / 5) * 5;
    if (cell < 10) cell = 10;
    canvas.width = w * cell;
    canvas.height = h * cell;
    ctx.fillStyle = '#e4d8bc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var y, x, ids, i, id, obj, layerOrder;
    layerOrder = [];
    for (i = 0; i < state.compiled.n; i++) layerOrder.push(i);
    layerOrder.sort(function (a, b) {
      return (state.compiled.layerOf[a] - state.compiled.layerOf[b]) || (a - b);
    });

    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        ids = SP.objectsAt(state.compiled, state.board, x, y);
        ids.sort(function (a, b) { return layerOrder.indexOf(a) - layerOrder.indexOf(b); });
        for (i = 0; i < ids.length; i++) {
          id = ids[i];
          obj = state.compiled.objects[id];
          blit(obj, x * cell, y * cell, cell);
        }
      }
    }

    ctx.strokeStyle = 'rgba(42,38,32,0.08)';
    ctx.lineWidth = 1;
    for (x = 0; x <= w; x++) {
      ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, h * cell); ctx.stroke();
    }
    for (y = 0; y <= h; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(w * cell, y * cell + 0.5); ctx.stroke();
    }

    if (state.board.won) document.getElementById('winbanner').classList.add('on');
    else document.getElementById('winbanner').classList.remove('on');
  }

  function blit(obj, px, py, cell) {
    var colors = obj.colors || ['#888'];
    var sprite = obj.sprite;
    var s = cell / 5;
    var r, c, v, col;
    if (!sprite || !sprite.length) {
      ctx.fillStyle = colors[0];
      ctx.fillRect(px, py, cell, cell);
      return;
    }
    for (r = 0; r < 5; r++) {
      var row = sprite[r] || [];
      for (c = 0; c < 5; c++) {
        v = row[c];
        if (v === undefined) v = -1;
        if (v < 0) continue;
        col = colors[v] || colors[0];
        if (col === 'transparent') continue;
        ctx.fillStyle = col;
        ctx.fillRect(px + c * s, py + r * s, Math.ceil(s), Math.ceil(s));
      }
    }
  }

  function act(dir) {
    if (state.replaying || !state.board || state.board.won) return;
    var next = SP.tick(state.compiled, state.board, dir);
    if (SP.keyState(next) === SP.keyState(state.board)) return;
    state.undo.push(state.board);
    state.board = next;
    draw();
    if (next.won) {
      statusLine('solved in ' + state.undo.length + ' moves');
    }
  }

  function undo() {
    if (!state.undo.length || state.replaying) return;
    state.board = state.undo.pop();
    draw();
    statusLine('undo · ' + state.undo.length + ' moves');
  }

  function restart() { bootLevel(state.level); }

  function nextLevel() {
    var n = (state.level + 1) % state.compiled.levels.length;
    bootLevel(n);
  }

  function solve() {
    if (!state.compiled) return;
    statusLine('searching…');
    var t0 = Date.now();
    var result = SP.bfs(state.compiled, SP.boot(state.compiled, state.level), { limit: 40000, maxDepth: 60 });
    var dt = Date.now() - t0;
    if (!result.solved) {
      statusLine((result.truncated ? 'truncated' : 'unsolved') + ' · ' + result.nodes + ' nodes · ' + dt + 'ms');
      return;
    }
    statusLine('solution ' + result.length + ' · ' + result.nodes + ' nodes · ' + dt + 'ms');
    replay(result.path);
  }

  function replay(path) {
    state.replaying = true;
    bootLevel(state.level);
    var i = 0;
    function step() {
      if (i >= path.length) { state.replaying = false; return; }
      state.undo.push(state.board);
      state.board = SP.tick(state.compiled, state.board, path[i]);
      i++;
      draw();
      statusLine('replay ' + i + '/' + path.length);
      setTimeout(step, 140);
    }
    setTimeout(step, 200);
  }

  function buildCatalog() {
    state.catalog = SP.SEEDS.map(function (s, i) {
      return { kind: 'seed', i: i, name: s.name, blurb: s.blurb, source: s.source };
    });
    renderCatalog();
    loadSource(state.catalog[0].source);
  }

  function renderCatalog() {
    var box = document.getElementById('gamelist');
    box.innerHTML = '';
    state.catalog.forEach(function (g, i) {
      var b = document.createElement('button');
      b.className = 'gamebtn' + (i === state.seedIndex ? ' on' : '');
      b.innerHTML = '<span class="nm">' + g.name + '</span><span class="bl">' + (g.blurb || '') + '</span>';
      b.addEventListener('click', function () {
        state.seedIndex = i;
        renderCatalog();
        loadSource(g.source, g.name, g.blurb);
      });
      box.appendChild(b);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('#modes [data-mode]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
    });
    var lab = mode === 'evolve';
    document.getElementById('labpane').classList.toggle('hidden', !lab);
    document.getElementById('scriptpane').classList.toggle('hidden', lab);
    if (lab) renderArchive((state.evo && state.evo.snapshot()) || { archive: [], stats: { tried: 0, compiled: 0, solved: 0, best: 0 } });
    if (mode === 'solve') solve();
  }

  function log(line) {
    var el = document.getElementById('log');
    el.textContent = line + '\n' + el.textContent;
  }

  function renderArchive(snap) {
    var stats = snap.stats;
    document.getElementById('labstats').textContent =
      stats.tried + ' evaluated · ' + stats.compiled + ' compiled · ' +
      stats.solved + ' solvable · best fitness ' + stats.best;
    var byBin = {};
    (snap.archive || []).forEach(function (e) { byBin[e.bin] = e; });
    var box = document.getElementById('archive');
    box.innerHTML = '';
    var li, mi;
    for (li = 0; li < 6; li++) {
      for (mi = 0; mi < 4; mi++) {
        var bin = li + '-' + mi;
        var e = byBin[bin];
        var b = document.createElement('button');
        b.className = 'elite' + (e ? ' has' : '');
        var lenlab = ['0–1', '2–3', '4–6', '7–10', '11–16', '17+'][li];
        if (e) {
          b.innerHTML = '<span class="t">' + (e.title || 'elite') + '</span>' +
            '<span class="f">' + e.length + ' moves · fit ' + e.fitness + '</span>' +
            lenlab + ' × ' + (mi + 1) + ' mech';
          b.addEventListener('click', function (ev) {
            return function () {
              var entry = {
                kind: 'elite',
                name: ev.title,
                blurb: 'evolved · ' + ev.length + ' ply · bin ' + ev.bin,
                source: ev.source
              };
              state.catalog = SP.SEEDS.map(function (s, i) {
                return { kind: 'seed', i: i, name: s.name, blurb: s.blurb, source: s.source };
              }).concat([entry]);
              state.seedIndex = state.catalog.length - 1;
              renderCatalog();
              loadSource(ev.source);
              setMode('play');
            };
          }(e));
        } else {
          b.innerHTML = '<span class="dim">' + lenlab + ' × ' + (mi + 1) + '</span>';
        }
        box.appendChild(b);
      }
    }
  }

  function runEvolve() {
    if (state.evoRunning) return;
    state.evoRunning = true;
    state.evo = SP.evolveStepwise({ seed: Date.now() % 99991, evalLimit: 5000 });
    renderArchive(state.evo.snapshot());
    log('seeded from human games');
    var left = 12;
    function more() {
      if (!state.evoRunning) return;
      var snap = state.evo.step(1);
      left--;
      log('gen done · ' + snap.stats.solved + ' solvable / ' + snap.stats.tried);
      renderArchive(snap);
      if (left > 0 && state.evoRunning) state.evoTimer = setTimeout(more, 30);
      else { state.evoTimer = 0; state.evoRunning = false; }
    }
    state.evoTimer = setTimeout(more, 30);
  }

  function stopEvolve() {
    state.evoRunning = false;
    if (state.evoTimer) { clearTimeout(state.evoTimer); state.evoTimer = 0; }
  }

  document.getElementById('begin').addEventListener('click', function () {
    show('app');
    buildCatalog();
    draw();
  });
  document.getElementById('toTitle').addEventListener('click', function () { show('title'); });
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('restart').addEventListener('click', restart);
  document.getElementById('nextlv').addEventListener('click', nextLevel);
  document.getElementById('solvebtn').addEventListener('click', solve);
  document.getElementById('evolvebtn').addEventListener('click', runEvolve);
  document.getElementById('evolvestop').addEventListener('click', stopEvolve);

  document.querySelectorAll('#modes [data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
  });
  document.querySelectorAll('#dpad [data-dir]').forEach(function (b) {
    b.addEventListener('click', function () {
      act({ left: 1, right: 2, up: 3, down: 4 }[b.getAttribute('data-dir')]);
    });
  });

  window.addEventListener('keydown', function (e) {
    if (!document.getElementById('app').classList.contains('on')) {
      if (e.key === 'Enter' || e.key === ' ') { document.getElementById('begin').click(); e.preventDefault(); }
      return;
    }
    var map = { ArrowLeft: 1, ArrowRight: 2, ArrowUp: 3, ArrowDown: 4, a: 1, d: 2, w: 3, s: 4, h: 1, l: 2, k: 3, j: 4 };
    if (map[e.key]) { act(map[e.key]); e.preventDefault(); }
    else if (e.key === 'z' || e.key === 'u') undo();
    else if (e.key === 'r') restart();
    else if (e.key === 'Enter') solve();
    else if (e.key === 'n') nextLevel();
  });

  var touch = null;
  canvas.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    if (!touch) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) + Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 2 : 1);
    else act(dy > 0 ? 4 : 3);
  }, { passive: true });

  window.addEventListener('resize', draw);
})();
