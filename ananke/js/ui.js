/* ANANKE — interface.
 *
 * The whole difficulty of presenting this game is that there is no world to
 * draw. There is a *set* of worlds. So the board shows marginals: how much of
 * the surviving future set has each figure standing in each cell at the hour
 * you are looking at. A filled disc at full strength means that figure is
 * there in every remaining future — which is what necessity looks like.
 */
(function () {
  'use strict';

  var A = window.Ananke;
  var LEVELS = A.LEVELS;
  var $ = function (id) { return document.getElementById(id); };

  var S = {
    li: 0, level: null, world: null,
    seals: [],            // {p, a} — a prohibition, once begun, never lifts
    viewT: 0, mode: 'wall',
    res: null, hist: [],
    stroke: null, playing: false, anim: null,
    opened: [], roundsLeft: 0,
    erosion: null, erosionKey: null, teachStep: 0, revealed: false,
    done: load()
  };

  function load() {
    try { return JSON.parse(localStorage.getItem('ananke.done') || '{}'); }
    catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem('ananke.done', JSON.stringify(S.done)); } catch (e) {}
  }

  /* ── screens ──────────────────────────────────────────────────────── */
  function show(id) {
    ['title', 'menu', 'game', 'epilogue'].forEach(function (s) {
      $(s).classList.toggle('on', s === id);
    });
    if (id === 'menu') buildMenu();
    if (id === 'game') { layout(); }
  }

  function buildMenu() {
    var ul = $('levellist');
    ul.innerHTML = '';
    LEVELS.forEach(function (lv, i) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="n">' + (i + 1) + '</span>' +
        '<span class="nm">' + lv.name + '</span>' +
        '<span class="st' + (S.done[lv.id] ? ' done' : '') + '">' +
        (S.done[lv.id] ? 'NECESSARY' : 'open') + '</span>';
      li.onclick = function () { startLevel(i); };
      ul.appendChild(li);
    });
  }

  /* ── level lifecycle ──────────────────────────────────────────────── */
  function startLevel(i) {
    S.li = i;
    S.level = LEVELS[i];
    S.world = A.compile(S.level);
    S.seals = []; S.hist = []; S.viewT = 0; S.anim = null;
    S.opened = []; S.roundsLeft = S.level.ananke || 0;
    S.erosion = null; S.erosionKey = null;
    S.teachStep = 0; S.revealed = false;
    S.mode = 'wall'; setMode('wall');
    // The untouched world's future count is the yardstick for the "futures
    // remaining" meter: from here it only ever goes down.
    var base = A.solve(S.world, []);
    S.baseTotal = base.total;
    S.baseSpread = 1;
    for (var bt = 0; bt <= S.world.T; bt++) {
      S.baseSpread = Math.max(S.baseSpread, spreadAt(base.margA, bt));
      if (base.margB) S.baseSpread = Math.max(S.baseSpread, spreadAt(base.margB, bt));
    }
    $('lvname').textContent = S.level.name;
    $('lvepi').textContent = '“' + S.level.epigraph + '”';
    $('brief').innerHTML = S.level.brief;
    $('sealbudget').textContent = S.level.budget;
    $('doubtline').classList.toggle('hidden', !S.level.doubt);
    show('game');
    recompute();
  }

  function engineSeals() {
    var T = S.world.T;
    var out = S.seals.map(function (s) { return { p: s.p, a: s.a, b: T }; });
    // Thin stone is open ground held shut. It costs the player nothing; it is
    // simply how the wall stands until Ananke opens it.
    closedStone().forEach(function (p) { out.push({ p: p, a: 0, b: T }); });
    return out;
  }
  function playerSeals() {
    var T = S.world.T;
    return S.seals.map(function (s) { return { p: s.p, a: s.a, b: T }; });
  }
  function closedStone() {
    return S.world.breakable.filter(function (p) { return S.opened.indexOf(p) < 0; });
  }
  function isClosedStone(p) {
    return S.world.breakable.indexOf(p) >= 0 && S.opened.indexOf(p) < 0;
  }

  function recompute() {
    S.res = A.solve(S.world, engineSeals());
    S.erosion = null;
    refresh();
    // Doubt is expensive (one full solve per forbidden place), so it is only
    // asked once the position is otherwise winning, and asked off the frame.
    if (S.level.doubt && S.res.won && !S.res.paradox) {
      var key = S.seals.map(function (s) { return s.p + ':' + s.a; }).sort().join(',');
      S.erosionKey = key;
      setTimeout(function () {
        if (S.erosionKey !== key) return;
        S.erosion = A.erosionTest(S.world, engineSeals());
        refresh();
      }, 30);
    }
  }

  function pushHist() {
    S.hist.push(S.seals.map(function (s) { return { p: s.p, a: s.a }; }));
    if (S.hist.length > 80) S.hist.shift();
  }

  /* ── panel ────────────────────────────────────────────────────────── */
  function fmtBig(x) {
    if (!(x > 0)) return '0';
    if (x < 1e6) return Math.round(x).toLocaleString();
    var e = Math.floor(Math.log10(x));
    return (x / Math.pow(10, e)).toFixed(2) + ' × 10' + sup(e);
  }
  function sup(n) {
    var m = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
              '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(n).split('').map(function (c) { return m[c] || c; }).join('');
  }

  function spreadAt(marg, t) {
    // exp(entropy): "how many places, effectively, she might be"
    var nP = S.world.nP, H = 0, o = t * nP, any = 0;
    for (var p = 0; p < nP; p++) {
      var v = marg[o + p];
      if (v > 1e-12) { H -= v * Math.log(v); any++; }
    }
    return any ? Math.exp(H) : 0;
  }

  function teachTick() {
    var lv = S.level, band = $('teach');
    if (!lv.teach) { band.classList.add('hidden'); return; }
    band.classList.remove('hidden');
    // Advance past every beat whose condition is now met — but only one per
    // pass, so each beat gets read before the next one replaces it.
    var step = lv.teach[S.teachStep];
    if (step && step.done && step.done({
          viewT: S.viewT, seals: S.seals, res: S.res, world: S.world })) {
      S.teachStep++;
      step = lv.teach[S.teachStep];
    }
    var last = S.teachStep >= lv.teach.length;
    band.classList.toggle('done', last);
    $('teachn').textContent = last ? '✓ DONE'
      : (S.teachStep + 1) + ' / ' + lv.teach.length;
    $('teachtext').innerHTML = last
      ? 'That is the whole game. Everything after this is the same move in ' +
        'harder company.'
      : step.say;
  }

  function refresh() {
    var res = S.res, lv = S.level;
    teachTick();

    var ul = $('objectives');
    ul.innerHTML = '';
    res.status.forEach(function (st, i) {
      var li = document.createElement('li');
      li.className = st.necessary ? 'yes' : 'no';
      li.innerHTML = lv.objectives[i].text +
        '<span class="tag">' + (st.necessary ? 'NECESSARY' :
          (res.paradox ? 'NO FUTURES LEFT' : 'MERELY POSSIBLE')) + '</span>';
      ul.appendChild(li);
    });

    $('sealcount').textContent = S.seals.length;
    var frac = S.seals.length / lv.budget;
    $('sealbar').style.width = Math.min(100, frac * 100) + '%';
    $('sealbar').classList.toggle('over', S.seals.length > lv.budget);

    if (res.paradox) {
      $('futures').textContent = 'NONE — the world is impossible';
      $('futbar').style.width = '0%';
      $('spreadline').textContent = 'You have forbidden every way the world could go.';
    } else {
      $('futures').textContent = fmtBig(res.total);
      var l = Math.log10(res.total + 1), l0 = Math.log10(S.baseTotal + 1);
      $('futbar').style.width = Math.max(1, Math.min(100, (l / (l0 || 1)) * 100)) + '%';
      var sa = spreadAt(res.margA, S.viewT);
      var line = 'hour ' + S.viewT + ' — the Pilgrim might be in ' +
                 sa.toFixed(1) + ' places';
      if (res.margB) line += '; the Hound in ' + spreadAt(res.margB, S.viewT).toFixed(1);
      $('spreadline').textContent = line;
    }

    $('argline').classList.toggle('hidden', !lv.ananke);
    if (lv.ananke) {
      $('argstate').textContent = S.roundsLeft
        ? S.roundsLeft + ' opening' + (S.roundsLeft === 1 ? '' : 's') + ' left to it'
        : 'it has nothing left to open';
    }

    if (lv.doubt) {
      var d = $('doubtstate');
      if (!res.won || res.paradox) d.textContent = '';
      else if (!S.erosion) d.textContent = 'weighing…';
      else d.textContent = S.erosion.survives
        ? '✓ YOUR NECESSITY IS ROBUST'
        : '✗ ONE FORGOTTEN PLACE UNDOES IT';
    }

    $('commit').textContent = (lv.ananke && S.roundsLeft)
      ? 'PRESS THE POINT' : ((!res.paradox && res.won) ? 'LET IT HAPPEN' : 'LET IT HAPPEN…');
    drawBoard(); drawTime();
  }

  /* ── board ────────────────────────────────────────────────────────── */
  var bc = $('board'), bx = bc.getContext('2d'), CS = 40;

  function layout() {
    if (!S.world) return;
    var wrap = bc.parentElement;
    var availW = wrap.clientWidth - 8, availH = wrap.clientHeight - 34;
    CS = Math.max(22, Math.min(84, Math.floor(Math.min(
      availW / S.world.w, availH / S.world.h))));
    var dpr = window.devicePixelRatio || 1;
    bc.style.width = (S.world.w * CS) + 'px';
    bc.style.height = (S.world.h * CS) + 'px';
    bc.width = Math.round(S.world.w * CS * dpr);
    bc.height = Math.round(S.world.h * CS * dpr);
    bx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var tc = $('time'), tw = tc.parentElement.clientWidth;
    tc.width = Math.round(tw * dpr); tc.height = Math.round(86 * dpr);
    tc.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBoard(); drawTime();
  }

  function sealAt(p) {
    for (var i = 0; i < S.seals.length; i++) if (S.seals[i].p === p) return S.seals[i];
    return null;
  }

  function drawBoard() {
    if (!S.world) return;
    var W = S.world, t = S.viewT, res = S.res;
    bx.clearRect(0, 0, W.w * CS, W.h * CS);

    for (var y = 0; y < W.h; y++) {
      for (var x = 0; x < W.w; x++) {
        var X = x * CS, Y = y * CS;
        var here = W.idxAt[y * W.w + x];
        if (W.grid[y][x] === '#' || (here >= 0 && isClosedStone(here))) {
          bx.fillStyle = '#05070e';
          bx.fillRect(X, Y, CS, CS);
          bx.fillStyle = 'rgba(44,51,82,.20)';
          bx.fillRect(X + 1, Y + 1, CS - 2, 1.5);   // a dim lip of rock
          if (here >= 0) {                          // thin: it has a seam
            bx.strokeStyle = 'rgba(79,195,217,.30)';
            bx.lineWidth = 1; bx.setLineDash([2, 4]);
            bx.strokeRect(X + 5.5, Y + 5.5, CS - 11, CS - 11);
            bx.setLineDash([]);
          }
        } else {
          bx.fillStyle = '#1d2444';
          bx.fillRect(X + 1, Y + 1, CS - 2, CS - 2);
          bx.strokeStyle = '#2b3358'; bx.lineWidth = 1;
          bx.strokeRect(X + 1.5, Y + 1.5, CS - 3, CS - 3);
        }
      }
    }

    // shrines
    (S.level.shrines || []).forEach(function (c) {
      var X = c[0] * CS + CS / 2, Y = c[1] * CS + CS / 2, r = CS * .30;
      bx.strokeStyle = 'rgba(224,162,74,.55)'; bx.lineWidth = 1.4;
      bx.beginPath(); bx.arc(X, Y, r, 0, 6.284); bx.stroke();
      bx.beginPath();
      for (var k = 0; k < 4; k++) {
        var an = k * Math.PI / 4;
        bx.moveTo(X - Math.cos(an) * r * .62, Y - Math.sin(an) * r * .62);
        bx.lineTo(X + Math.cos(an) * r * .62, Y + Math.sin(an) * r * .62);
      }
      bx.stroke();
    });

    // the clouds — or, mid-animation, the one future that actually happened
    if (S.anim) {
      drawFigure(S.anim.path[S.anim.t].p1, 0, 1);
      if (W.nP2 > 1) drawFigure(S.anim.path[S.anim.t].p2, 1, 1);
    } else if (res && !res.paradox) {
      for (var p = 0; p < W.nP; p++) {
        var a = res.margA[t * W.nP + p];
        if (a > 1e-9) drawFigure(p, 0, a);
        if (res.margB) {
          var b = res.margB[t * W.nP + p];
          if (b > 1e-9) drawFigure(p, 1, b);
        }
      }
    }

    // seals: solid where already in force, pending where they begin later
    S.seals.forEach(function (s) { drawSeal(s.p, s.a, false); });
    if (S.stroke) S.stroke.cells.forEach(function (c, i) {
      if (S.stroke.erase) return;
      drawSeal(c, strokeStart(i), true);
    });
    if (S.stroke && S.stroke.erase) {
      S.stroke.cells.forEach(function (c) {
        var X = W.posX[c] * CS, Y = W.posY[c] * CS;
        bx.strokeStyle = 'rgba(200,206,230,.75)'; bx.lineWidth = 2;
        bx.strokeRect(X + 2.5, Y + 2.5, CS - 5, CS - 5);
      });
    }
  }

  function drawFigure(p, who, amt) {
    var X = S.world.posX[p] * CS + CS / 2, Y = S.world.posY[p] * CS + CS / 2;
    var r = CS * (0.14 + 0.30 * Math.pow(amt, 0.55));
    var sure = amt > 0.9995;
    if (who === 0) {
      bx.fillStyle = 'rgba(224,162,74,' + (0.16 + 0.74 * Math.pow(amt, .55)) + ')';
      bx.beginPath(); bx.arc(X, Y, r, 0, 6.284); bx.fill();
      if (sure) {
        bx.strokeStyle = 'rgba(255,225,180,.95)'; bx.lineWidth = 1.2;
        bx.beginPath(); bx.arc(X, Y, r + 3.5, 0, 6.284); bx.stroke();
      }
    } else {
      bx.strokeStyle = 'rgba(79,195,217,' + (0.22 + 0.72 * Math.pow(amt, .55)) + ')';
      bx.lineWidth = sure ? 2.6 : 1.5;
      bx.beginPath(); bx.arc(X, Y, r * .95, 0, 6.284); bx.stroke();
      if (sure) {
        bx.beginPath(); bx.arc(X, Y, r * .42, 0, 6.284);
        bx.fillStyle = 'rgba(79,195,217,.9)'; bx.fill();
      }
    }
  }

  function drawSeal(p, from, pending) {
    var X = S.world.posX[p] * CS, Y = S.world.posY[p] * CS;
    var live = S.viewT >= from;
    bx.save();
    bx.beginPath(); bx.rect(X, Y, CS, CS); bx.clip();
    if (live) {
      bx.fillStyle = pending ? 'rgba(10,6,10,.72)' : '#07040a';
      bx.fillRect(X, Y, CS, CS);
      bx.strokeStyle = 'rgba(201,79,82,' + (pending ? .55 : .40) + ')';
      bx.lineWidth = 1;
      for (var d = -CS; d < CS; d += 7) {
        bx.beginPath(); bx.moveTo(X + d, Y + CS); bx.lineTo(X + d + CS, Y); bx.stroke();
      }
      bx.strokeStyle = 'rgba(201,79,82,.85)'; bx.lineWidth = 1.5;
      bx.strokeRect(X + .75, Y + .75, CS - 1.5, CS - 1.5);
    } else {
      bx.fillStyle = 'rgba(201,79,82,.10)';
      bx.fillRect(X, Y, CS, CS);
      bx.strokeStyle = 'rgba(201,79,82,.5)'; bx.lineWidth = 1;
      bx.setLineDash([3, 3]);
      bx.strokeRect(X + 3.5, Y + 3.5, CS - 7, CS - 7);
      bx.setLineDash([]);
      bx.fillStyle = 'rgba(201,79,82,.85)';
      bx.font = '500 ' + Math.round(CS * .30) + "px 'IBM Plex Mono',ui-monospace,monospace";
      bx.textAlign = 'center'; bx.textBaseline = 'middle';
      bx.fillText(String(from), X + CS / 2, Y + CS / 2);
    }
    bx.restore();
  }

  /* ── timeline ─────────────────────────────────────────────────────── */
  function drawTime() {
    var c = $('time'), g = c.getContext('2d');
    var W = c.clientWidth || c.parentElement.clientWidth, H = 86;
    if (!S.world) return;
    g.clearRect(0, 0, W, H);
    var T = S.world.T, pad = 26, span = (W - pad * 2) / T;

    // Normalised against the *untouched* world, not against itself: the whole
    // point is to watch the possible collapse as you forbid.
    var spreadsA = [], spreadsB = [], mx = Math.max(1, S.baseSpread || 1);
    for (var t = 0; t <= T; t++) {
      var a = S.res && !S.res.paradox ? spreadAt(S.res.margA, t) : 0;
      var b = S.res && !S.res.paradox && S.res.margB ? spreadAt(S.res.margB, t) : 0;
      spreadsA.push(a); spreadsB.push(b);
    }

    g.strokeStyle = '#232a49'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad, 56.5); g.lineTo(W - pad, 56.5); g.stroke();

    for (t = 0; t <= T; t++) {
      var X = pad + t * span;
      var ha = (spreadsA[t] / mx) * 40, hb = (spreadsB[t] / mx) * 40;
      g.fillStyle = 'rgba(224,162,74,.55)';
      g.fillRect(X - 4, 56 - ha, 3.5, ha);
      if (S.res && S.res.margB) {
        g.fillStyle = 'rgba(79,195,217,.5)';
        g.fillRect(X + .5, 56 - hb, 3.5, hb);
      }
      g.fillStyle = t === S.viewT ? '#e0a24a' : '#4b5578';
      g.font = "10px 'IBM Plex Mono',ui-monospace,monospace";
      g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(String(t), X, 62);
      // hours at which a prohibition begins
      var begins = S.seals.filter(function (s) { return s.a === t; }).length;
      if (begins) {
        g.fillStyle = 'rgba(201,79,82,.9)';
        g.beginPath(); g.arc(X, 78, 2.4, 0, 6.284); g.fill();
      }
    }

    var PX = pad + S.viewT * span;
    g.strokeStyle = 'rgba(224,162,74,.85)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(PX + .5, 6); g.lineTo(PX + .5, 58); g.stroke();
    g.fillStyle = '#e0a24a';
    g.beginPath(); g.moveTo(PX, 4); g.lineTo(PX - 4, -2); g.lineTo(PX + 4, -2);
    g.closePath(); g.fill();

  }

  /* ── input: board ─────────────────────────────────────────────────── */
  function cellFromEvent(e) {
    var r = bc.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / (r.width / S.world.w));
    var y = Math.floor((e.clientY - r.top) / (r.height / S.world.h));
    if (x < 0 || y < 0 || x >= S.world.w || y >= S.world.h) return -1;
    return S.world.idxAt[y * S.world.w + x];
  }

  function strokeStart(i) {
    return Math.min(S.world.T, S.mode === 'sweep' ? S.viewT + 1 + i : S.viewT);
  }

  bc.addEventListener('pointerdown', function (e) {
    if (S.anim || !S.world) return;
    var p = cellFromEvent(e);
    if (p < 0 || isClosedStone(p)) return;
    bc.setPointerCapture(e.pointerId);
    S.stroke = { cells: [], erase: !!sealAt(p) };
    addToStroke(p);
    drawBoard();
  });
  bc.addEventListener('pointermove', function (e) {
    if (!S.stroke) return;
    var p = cellFromEvent(e);
    if (p >= 0) { addToStroke(p); drawBoard(); }
  });
  function endStroke() {
    if (!S.stroke) return;
    var st = S.stroke; S.stroke = null;
    if (!st.cells.length) return;
    pushHist();
    if (st.erase) {
      S.seals = S.seals.filter(function (s) { return st.cells.indexOf(s.p) < 0; });
    } else {
      st.cells.forEach(function (c, i) {
        if (sealAt(c)) return;
        S.seals.push({ p: c, a: strokeStart(i) });
      });
    }
    recompute();
  }
  bc.addEventListener('pointerup', endStroke);
  bc.addEventListener('pointercancel', endStroke);

  function addToStroke(p) {
    var st = S.stroke;
    if (st.cells.indexOf(p) >= 0) return;
    if (st.erase) { if (sealAt(p)) st.cells.push(p); return; }
    if (sealAt(p) || isClosedStone(p)) return;
    if (S.seals.length + st.cells.length >= S.level.budget) return;
    if (S.mode === 'sweep' && st.cells.length) {
      // a sweep is a walk: each new cell must touch the last
      var last = st.cells[st.cells.length - 1];
      var dx = Math.abs(S.world.posX[p] - S.world.posX[last]);
      var dy = Math.abs(S.world.posY[p] - S.world.posY[last]);
      if (dx + dy !== 1) return;
    }
    st.cells.push(p);
  }

  /* ── input: timeline ──────────────────────────────────────────────── */
  var tcv = $('time');
  function scrub(e) {
    var r = tcv.getBoundingClientRect(), pad = 26;
    var span = (r.width - pad * 2) / S.world.T;
    var t = Math.round((e.clientX - r.left - pad) / span);
    S.viewT = Math.max(0, Math.min(S.world.T, t));
    refresh();
  }
  tcv.addEventListener('pointerdown', function (e) {
    if (!S.world) return;
    tcv.setPointerCapture(e.pointerId); tcv._d = true; scrub(e);
  });
  tcv.addEventListener('pointermove', function (e) { if (tcv._d) scrub(e); });
  tcv.addEventListener('pointerup', function () { tcv._d = false; });

  /* ── controls ─────────────────────────────────────────────────────── */
  function setMode(m) {
    S.mode = m;
    $('mWall').classList.toggle('on', m === 'wall');
    $('mSweep').classList.toggle('on', m === 'sweep');
    $('modehelp').innerHTML = m === 'wall'
      ? 'WALL — every cell you drag over is forbidden from hour ' +
        '<b>' + S.viewT + '</b> onward.'
      : 'SWEEP — drag a path. Each step is forbidden one hour later than the ' +
        'last, so the ground closes behind her.';
  }
  $('mWall').onclick = function () { setMode('wall'); };
  $('mSweep').onclick = function () { setMode('sweep'); };
  $('undo').onclick = function () {
    if (!S.hist.length) return;
    S.seals = S.hist.pop(); recompute();
  };
  $('clear').onclick = function () { pushHist(); S.seals = []; recompute(); };
  $('showme').onclick = function () {
    if (!S.level.solution) return;
    pushHist();
    S.revealed = true;
    S.seals = S.level.solution.map(function (c) {
      return { p: S.world.idxAt[c.y * S.world.w + c.x], a: Math.min(c.a, S.world.T) };
    }).filter(function (c) { return c.p >= 0; });
    recompute();
    $('brief').innerHTML = '<span style="color:#e0a24a">THE ANSWER — </span>' +
      'this is the shape it wants. Scrub the hours to see why it works, then ' +
      'press <b>clear</b> and lay it yourself.';
  };
  $('hint').onclick = function () {
    $('brief').innerHTML = '<span style="color:#e0a24a">HINT — </span>' + S.level.hint;
  };
  $('begin').onclick = function () { show('menu'); };
  document.querySelectorAll('[data-goto]').forEach(function (b) {
    b.onclick = function () { show(b.dataset.goto); };
  });

  document.addEventListener('keydown', function (e) {
    if (!$('game').classList.contains('on') || S.anim) return;
    if (e.key === 'ArrowRight') { S.viewT = Math.min(S.world.T, S.viewT + 1); refresh(); setMode(S.mode); }
    else if (e.key === 'ArrowLeft') { S.viewT = Math.max(0, S.viewT - 1); refresh(); setMode(S.mode); }
    else if (e.key === 'z') $('undo').onclick();
    else if (e.key === 'r') $('clear').onclick();
    else if (e.key === 'h') $('hint').onclick();
    else if (e.key === '?') $('showme').onclick();
    else if (e.key === 'w') setMode('wall');
    else if (e.key === 's') setMode('sweep');
    else if (e.key === 'Enter') $('commit').onclick();
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  });

  var playTimer = null;
  function togglePlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; return; }
    playTimer = setInterval(function () {
      S.viewT = (S.viewT + 1) % (S.world.T + 1); refresh();
    }, 480);
  }

  /* ── the commitment ───────────────────────────────────────────────── */
  $('commit').onclick = function () {
    if (S.anim) return;
    if (playTimer) togglePlay();
    var res = S.res, lv = S.level;

    if (res.paradox) return verdict(false, null,
      'THE WORLD IS IMPOSSIBLE',
      '<p>There is no history at all that obeys what you have forbidden. Not ' +
      'one. A world that cannot have happened does not get to happen.</p>' +
      '<p class="said">Necessity is not the same as prohibition of everything.</p>');

    if (S.seals.length > lv.budget) return verdict(false, null, 'TOO MUCH FORBIDDEN',
      '<p>You have sealed ' + S.seals.length + ' places. You were given ' +
      lv.budget + '.</p>');

    // THE ARGUMENT: you may not simply outlast it. Each time you reach
    // necessity, Ananke gets to open one wall and take it away again.
    if (lv.ananke && S.roundsLeft > 0 && res.won && !res.paradox) {
      var mv = A.anankeOpens(S.world, playerSeals(), closedStone());
      if (!mv) {
        S.roundsLeft = 0;
        return verdict(null, null, 'ANANKE HAS NOTHING TO SAY',
          '<p>It looked for a wall thin enough to matter and could not find ' +
          'one. Every door it might have opened leads only into a future you ' +
          'have already forbidden.</p>' +
          '<p class="said">The argument is over. Let it happen.</p>',
          function () { show('game'); refresh(); });
      }
      S.roundsLeft--;
      S.opened.push(mv.pos);
      recompute();
      return verdict(null, null, 'ANANKE ANSWERS',
        '<p>It opens the wall at <b>' + place(mv.pos) + '</b>. There was ' +
        'always a door there; you simply had no reason to think so.</p>' +
        '<p>' + fmtBig(S.res.total) + ' futures stand again, and in some of ' +
        'them she goes in there and never comes out. You have <b>' +
        (lv.budget - S.seals.length) + '</b> seal' +
        (lv.budget - S.seals.length === 1 ? '' : 's') + ' left.</p>' +
        (S.roundsLeft ? '<p class="said">It has ' + S.roundsLeft +
          ' more to open.</p>' : '<p class="said">That was its last door.</p>'),
        function () { show('game'); refresh(); });
    }

    var sealsNow = engineSeals(), eroded = null;
    if (lv.doubt) {
      var er = S.erosion || A.erosionTest(S.world, sealsNow);
      S.erosion = er;
      if (!er.survives) {
        eroded = sealsNow.filter(function (s) { return s.p !== er.pos; });
      }
    }

    var useSeals = eroded || sealsNow;
    var check = eroded ? A.solve(S.world, useSeals) : res;

    if (check.paradox) {
      return verdict(false, null, 'DOUBT BROKE IT',
        '<p>Ananke forgot that ' + place(er.pos) + ' was ever forbidden, and ' +
        'with that one place restored, nothing you allowed can happen at all.</p>');
    }

    var badIdx = -1;
    check.status.forEach(function (st, i) { if (!st.necessary && badIdx < 0) badIdx = i; });

    if (badIdx < 0 && !eroded) {
      // Everything you wanted is true in every remaining future. So it does
      // not matter which one the world draws — draw it uniformly at random.
      var path = A.sampleFuture(S.world, useSeals, Math.random);
      return animate(path, function () {
        S.done[lv.id] = true; save();
        verdict(true, path, 'IT WAS NECESSARY', epilogue(path, check, true, null));
      });
    }

    var wit = A.counterexample(S.world, useSeals, badIdx);
    if (!wit) return verdict(false, null, 'IT WAS MERELY POSSIBLE',
      '<p>' + lv.objectives[badIdx].text + ' — but not in every future.</p>');

    animate(wit, function () {
      verdict(false, wit, eroded ? 'DOUBT BROKE IT' : 'IT WAS MERELY POSSIBLE',
        epilogue(wit, check, false, eroded ? er.pos : null, badIdx));
    });
  };

  function place(p) {
    return '(' + S.world.posX[p] + ',' + S.world.posY[p] + ')';
  }

  function animate(path, done) {
    S.anim = { path: path, t: 0 };
    var iv = setInterval(function () {
      S.anim.t++;
      if (S.anim.t >= path.length) {
        clearInterval(iv);
        setTimeout(function () { S.anim = null; drawBoard(); done(); }, 700);
        return;
      }
      S.viewT = S.anim.t; drawBoard(); drawTime();
    }, 340);
    S.viewT = 0; drawBoard(); drawTime();
  }

  /* ── prose ────────────────────────────────────────────────────────── */
  var DIRW = { '0,-1': 'north', '0,1': 'south', '1,0': 'east', '-1,0': 'west' };
  function ordinal(n) {
    var w = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
             'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
    return w[n] || (n + 'th');
  }

  function epilogue(path, res, good, erodedPos, badIdx) {
    var W = S.world, lv = S.level, out = [];
    var waits = 0, arrive = -1, minD = 99, firstMove = -1;

    var shrineP = lv.shrines && lv.shrines.length
      ? W.idxAt[lv.shrines[0][1] * W.w + lv.shrines[0][0]] : -1;

    for (var t = 0; t < path.length; t++) {
      var s = path[t];
      if (t > 0) {
        if (s.p1 === path[t - 1].p1) waits++;
        else if (firstMove < 0) firstMove = t;
      }
      if (shrineP >= 0 && s.p1 === shrineP && arrive < 0) arrive = t;
      if (W.nP2 > 1) {
        var d = Math.abs(W.posX[s.p1] - W.posX[s.p2]) +
                Math.abs(W.posY[s.p1] - W.posY[s.p2]);
        if (d < minD) minD = d;
      }
    }

    var sent = [];
    if (firstMove > 0) {
      var a = path[firstMove - 1], b = path[firstMove];
      var key = (W.posX[b.p1] - W.posX[a.p1]) + ',' + (W.posY[b.p1] - W.posY[a.p1]);
      sent.push('At the ' + ordinal(firstMove) + ' hour she went ' +
                (DIRW[key] || 'on') + '.');
    } else {
      sent.push('She never moved at all.');
    }
    if (waits === 0) sent.push('She did not once stand still.');
    else if (waits === 1) sent.push('She stood still exactly once.');
    else sent.push('She stood still ' + waits + ' times.');
    if (arrive >= 0) sent.push('She came to the shrine at the ' + ordinal(arrive) + ' hour.');
    else if (shrineP >= 0) sent.push('She never came to the shrine.');
    if (W.nP2 > 1) {
      sent.push(minD === 0
        ? 'The Hound stood where she stood.'
        : 'The Hound came within ' + minD + ' step' + (minD === 1 ? '' : 's') + ' of her.');
    }
    out.push('<p>' + sent.join(' ') + '</p>');

    if (good) {
      out.push(res.total < 1.5
        ? '<p>You left <b>exactly one</b> future standing. There was nothing ' +
          'for the world to choose. In it:</p>'
        : '<p>Of the <b>' + fmtBig(res.total) + '</b> futures you left standing, ' +
          'the world drew this one at random. It did not matter which — in ' +
          'every single one of them:</p>');
      out.push('<p class="said">' + lv.objectives.map(function (o) { return o.text; })
        .join('; and ') + '.</p>');
    } else {
      if (erodedPos != null) {
        out.push('<p>Ananke forgot that ' + place(erodedPos) + ' was ever ' +
          'forbidden — it chose the one place that would cost you most — and ' +
          'in the world that came back, this future was waiting.</p>');
      } else {
        out.push('<p>You did not forbid this one. It was in there all along, ' +
          'among the <b>' + fmtBig(res.total) + '</b> futures you allowed, ' +
          'waiting to be drawn.</p>');
      }
      out.push('<p class="said">You needed it to be true that ' +
        lv.objectives[badIdx == null ? 0 : badIdx].text + '. You made it ' +
        'possible. Possible is not necessary.</p>');
    }
    return out.join('');
  }

  function verdict(good, path, title, html, onNext) {
    $('epiverdict').textContent = title;
    $('epiverdict').className = good === null ? '' : (good ? 'good' : 'bad');
    $('epitext').innerHTML = html;
    $('epinext').textContent = good === null ? 'GO ON'
      : (good ? (S.li + 1 < LEVELS.length ? 'NEXT' : 'RETURN') : 'TRY AGAIN');
    $('epiretry').classList.toggle('hidden', good !== true);
    $('epinext').onclick = function () {
      if (onNext) return onNext();
      if (!good) { show('game'); refresh(); return; }
      if (S.li + 1 < LEVELS.length) startLevel(S.li + 1); else show('menu');
    };
    $('epiretry').onclick = function () { startLevel(S.li); };
    show('epilogue');
  }

  /* ── boot ─────────────────────────────────────────────────────────── */
  window.addEventListener('resize', layout);
  show('title');
})();
