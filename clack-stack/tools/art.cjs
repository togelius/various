#!/usr/bin/env node
// Art contract test, run on the Art module INSIDE index.html (the game page is loaded, its main loop halted with
// CS.halt(), and the checks draw on a canvas of their own):  node clack-stack/tools/art.cjs
//  1. calls every Art API function with typical and edge arguments and checks that the
//     canvas 2D state (transform, alpha, composite op, line dash, filter, styles, save depth)
//     is unchanged afterwards and nothing throws;
//  2. checks the data fields (TILE_COLORS, PAL, titleBuild, titleLetterBoxes);
//  3. pixel checks: rug colour, multiply mixing, night visibility;
//  4. times a frame of a 15 L tower + 60 debris tiles (+ room, rug, light, cars, hand, ring,
//     ribbon): Art time must average <= 4 ms once caches are warm; reports raster time too;
//  5. non-finite arguments (NaN / Infinity in every numeric slot) never throw or leak state;
//  6. Art composes with the caller's globalAlpha; floating rings read on wall and armchair;
//     flat rings stay magenta on every tile colour; the light stays on the rug band and dims
//     at night; the rug dims with the room; the cube net folds into the cube without a pop;
//  7. live canvas memory stays bounded through a dpr-3 zoom sweep over every sprite;
//  8. odd argument TYPES (strings, objects, arrays, null, prototype keys such as 'toString')
//     in every slot never throw; drawCubeNet with the fold omitted works; resize / drawRoom / drawRug
//     with a missing, non-numeric or infinite groundY never throw, and a correct call afterwards recovers;
//  9. room + rug cover the whole screen under a screen-shake translate of up to 24 px, at
//     any camera height (the game never clears the canvas);
// 10. the ghost reads on the near-white wall (filled with the held piece's colour) and its
//     outline grows with L; the night room is blue with warm lamp light; the cube's
//     oblique extrusion stays within 0.2 L of its 2L x 2L cell; the cube net (held flat and
//     folding) is cheap;
// 11. (fixes since the component build) a skyT ramp 0 -> 1 never costs a frame over 16 ms; the stained-glass
//     light lands on open rug beside the base; a down triangle is lit from the top-left like an up one; the
//     cube's red top reads red; car wheels turn with o.roll; night tiles stand out from a lamp-lit wall too;
//     the holding arm slants from the upper right (it is not a vertical pole) and bends at an elbow, and with the hand
//     low its upper arm on screen is at most twice its forearm (a child's arm reaching in);
//     on wide layouts the tile box (the L2 goal) is in the room clear of the 4 L base.
'use strict';
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const { gameUrl } = require('./lib.cjs');
const BUDGET_MS = 4;

async function run(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  // count live canvas memory: every canvas Art creates, at its current size (zeroed = freed); installed before the
  // game's script runs, so the game's own layers count too
  await page.addInitScript(() => {
    const made = (window.__canvases = []);
    const ce = document.createElement.bind(document);
    document.createElement = (tag, o) => { const el = ce(tag, o); if (String(tag).toLowerCase() === 'canvas') made.push(new WeakRef(el)); return el; };
    window.__canvasBytes = () => { let b = 0, n = 0; for (const r of made) { const c = r.deref(); if (c && c.width * c.height > 0) { b += c.width * c.height * 4; n++; } } return { mb: +(b / 1048576).toFixed(1), n }; };
  });
  await page.goto(gameUrl({ mute: 1, nohint: 1, seed: 5 }), { waitUntil: 'load' });
  await page.waitForFunction(() => window.CS && typeof Art === 'object', null, { timeout: 10000 });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    CS.halt();
    // the tests draw on a canvas of their own, over the (stopped) game
    const c = document.createElement('canvas');
    c.id = 'artc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:5';
    document.body.appendChild(c);
  });
  const res = await page.evaluate(async ({ BUDGET_MS }) => {
    const out = { fails: [], calls: 0, notes: [] };
    const fail = (s) => { if (out.fails.length < 60) out.fails.push(s); };
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio;
    const c = document.getElementById('artc');
    c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    const ctx = c.getContext('2d');
    const G = Math.round(H * 0.86);

    // ------------------------------------------------------------ API surface
    const FN = ['resize', 'drawRoom', 'drawRug', 'drawLight', 'drawTile', 'drawCubeNet', 'drawCar', 'drawHand', 'drawArm',
      'drawRing', 'drawGear', 'drawRibbon', 'drawGoalIcon', 'drawFoot', 'drawShadowBlob', 'drawTitle', 'titleLetterBoxes', 'drawTileBox'];
    if (typeof Art !== 'object') { fail('Art is not a global object'); return out; }
    for (const f of FN) if (typeof Art[f] !== 'function') fail('missing function Art.' + f);
    const own = Object.keys(Art).sort().join(',');
    const want = FN.concat(['TILE_COLORS', 'PAL', 'titleBuild']).sort().join(',');
    if (own !== want) fail('Art keys differ: ' + own);
    if (JSON.stringify(Art.TILE_COLORS) !== JSON.stringify(['red', 'orange', 'yellow', 'green', 'blue', 'lightBlue', 'purple'])) fail('TILE_COLORS');
    const hexes = ['#E8323C', '#FF7A1A', '#FFD21F', '#2EBF4F', '#2F5BEA', '#5EC8F2', '#8A4FE0', '#D6247F', '#B9A3F0', '#7CC23A',
      '#1E2541', '#E8C547', '#8FA6C9', '#EDE3D3', '#D9793F', '#E5A487', '#A9BFD0', '#7F99B3', '#E3A3A8', '#F2EEE8', '#9C7B5E',
      '#F7F5F0', '#B3244A', '#C99A64', '#FFC531', '#1B2140', '#F6F1D9'];
    const pv = Object.values(Art.PAL).map((v) => String(v).toUpperCase());
    for (const hx of hexes) if (!pv.includes(hx)) fail('PAL is missing ' + hx);
    for (const cn of Art.TILE_COLORS) if (!/^#[0-9A-F]{6}$/i.test(Art.PAL[cn] || '')) fail('PAL.' + cn);

    // ------------------------------------------------------------ state checks
    const snap = () => {
      const m = ctx.getTransform();
      return JSON.stringify([m.a, m.b, m.c, m.d, m.e, m.f, ctx.globalAlpha, ctx.globalCompositeOperation, ctx.getLineDash(),
        ctx.lineDashOffset, ctx.filter, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.lineCap, ctx.lineJoin, ctx.font,
        ctx.textAlign, ctx.textBaseline, ctx.shadowBlur, ctx.shadowColor, ctx.imageSmoothingEnabled]);
    };
    const call = (name, args) => {
      out.calls++;
      ctx.fillStyle = '#010203';
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 3.5, -2.25); // dpr + a screen shake
      ctx.globalAlpha = 0.95; ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = 1.5; ctx.filter = 'none';
      ctx.fillStyle = '#123456'; ctx.strokeStyle = '#654321'; ctx.lineWidth = 1.25; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.font = '12px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;
      ctx.shadowColor = 'rgba(0, 0, 0, 0)'; ctx.imageSmoothingEnabled = true;
      const before = snap();
      let ret;
      try { ret = Art[name].apply(Art, [ctx].concat(args)); } catch (e) { fail(name + '(' + JSON.stringify(args).slice(0, 80) + ') threw ' + e.message); }
      const after = snap();
      if (after !== before) fail(name + '(' + JSON.stringify(args).slice(0, 80) + ') changed state\n   ' + before + '\n   ' + after);
      ctx.restore();
      if (ctx.fillStyle !== '#010203') fail(name + ' left an unbalanced save()');
      return ret;
    };
    const callNoCtx = (name, args) => {
      out.calls++;
      try { return Art[name].apply(Art, args); } catch (e) { fail(name + ' threw ' + e.message); }
    };

    callNoCtx('resize', [W, H, dpr, G]);
    callNoCtx('resize', [W, H, dpr, G]);
    callNoCtx('resize', [0, 0, 1, 0]);
    callNoCtx('resize', [W, H, 7, NaN]);
    callNoCtx('resize', [W, H, dpr, G]);

    for (const cam of [0, 120, 900, 6000, -40]) for (const sky of [0, 0.5, 1, -1, 2]) call('drawRoom', [W, H, G, cam, sky]);
    call('drawRoom', [W, H, G]);
    for (const cam of [0, 50, 2000, -30]) call('drawRug', [W, H, G, cam]);
    call('drawRug', [W, H, G]);

    const COLS = Art.TILE_COLORS, SHAPES = ['sq', 'tri', 'cube', 'marble', 'crown'];
    const lt = [];
    for (let i = 0; i < 12; i++) lt.push({ shape: SHAPES[i % 5], color: COLS[i % 7], cx: W / 2 + (i % 3 - 1) * 40, cy: G - 30 - i * 30, rot: i % 2 ? Math.PI : 0 });
    lt.push({ shape: 'bogus', color: 'nope', cx: 10, cy: 10, rot: 0 }, null);
    for (const L of [8, 40, 120]) for (const a of [0, 0.5, 1]) for (const cam of [0, 300]) call('drawLight', [lt, L, G, cam, a]);
    call('drawLight', [[], 40, G, 0, 1]); call('drawLight', [null, 40, G, 0, 1]);

    const optsList = [undefined, {}, { alpha: 0.5 }, { alpha: 0 }, { flash: 0.6 }, { flash: 1 }, { tint: 0.7 }, { ghost: 'white' }, { ghost: 'gold' },
      { ghost: 'red' }, { night: true }, { variant: 1 }, { variant: 2 }, { variant: 7 }, { variant: -3 }, { glint: 0.5 }, { glint: 1 },
      { layer: 'body' }, { layer: 'detail' }, { layer: 'both', flash: 0.3, tint: 0.4, glint: 0.2, night: true, variant: 2 }];
    for (const shape of SHAPES) for (const color of COLS) for (const L of [8, 40, 120]) {
      for (const o of optsList) call('drawTile', [shape, color, 100.3, 200.7, 0.4, L, o]);
    }
    call('drawTile', ['xx', 'red', 50, 50, 0, 30]); call('drawTile', ['sq', 'mauve', 50, 50, 0, 30]);
    call('drawTile', ['sq', 'red', NaN, 50, 0, 30]); call('drawTile', ['sq', 'red', 50, 50, 0, 0]); call('drawTile', ['tri', 'red', 50, 50, -7, 2000]);

    for (const f of [-1, 0, 0.1, 0.33, 0.5, 0.77, 0.99, 1, 2, NaN]) for (const L of [8, 40, 120]) call('drawCubeNet', [W / 2, H / 2, L, f, 0.3]);
    // the fold omitted, or not a number at all
    call('drawCubeNet', [W / 2, H / 2, 30]);
    for (const f of [undefined, 'abc', '0.5', {}, null, [0.5], true]) for (const L of [8, 40]) call('drawCubeNet', [W / 2, H / 2, L, f, 0]);
    for (const col of ['red', 'green', 'blue']) for (const L of [8, 40, 120]) for (const o of [undefined, {}, { squash: 1, t: 2 }, { squash: 0.5 }])
      call('drawCar', [W / 2, G - 0.5 * L, -0.1, L, col, o]);
    for (const L of [8, 40, 120]) for (const op of [0, 0.4, 1, 3]) call('drawHand', [W / 2, 120, L, op, 1.7]);
    call('drawHand', [W / 2, 120, 40]);
    for (const L of [8, 40, 120]) call('drawArm', [W / 3, G - L, L, 0.4]);
    call('drawArm', [0, 0, 40]);
    for (const L of [8, 40, 120]) for (const fl of [0, 0.5, 1]) call('drawRing', [W / 2, 300, L, fl, 2.2]);
    call('drawRing', [W / 2, 300, 40]);
    for (const L of [8, 40, 120]) call('drawGear', [W / 2, 300, L, 1.1]);
    for (const L of [8, 40, 120]) for (const tr of [0, 0.01, 0.5, 1, 4]) call('drawRibbon', [8, W - 40, 260, L, tr, 3.3]);
    call('drawRibbon', [W - 40, 8, 260, 40, 0, 0]); call('drawRibbon', [8, 8, 260, 40, 0.5, 0]);
    const keys = ['melon', 'box', 'armchair', 'eggchair', 'table', 'armback', 'window', 'eggtop', 'ac', 'you', 'lamp', 'shelf', 'grownup', 'door', 'ceiling', 'roof', 'clouds', 'moon', 'unknown'];
    for (const k of keys) for (const sz of [8, 36, 120]) call('drawGoalIcon', [k, W - 30, 260, sz]);
    for (const L of [8, 40, 120]) for (const t of [0, 0.3, 0.8, 1]) for (const side of [-1, 1]) call('drawFoot', [W / 2 + side * 2 * L, G, L, t, side]);
    for (const a of [[100, 100, 40, 8, 0.5], [100, 100, 0, 0, 1], [100, 100, 10, 4, 0]]) call('drawShadowBlob', a);
    for (const w of [120, 320, 700, 1300]) {
      call('drawTitle', [W / 2, 150, w, 1.2, [0, 0.5, 1, 0, 0, 0, 0, 0.2, 0, 0]]);
      call('drawTitle', [W / 2, 150, w, 0]);
      const boxes = callNoCtx('titleLetterBoxes', [W / 2, 150, w]);
      if (!Array.isArray(boxes) || boxes.length !== 10) fail('titleLetterBoxes length');
      else for (const b of boxes) if (![b.x, b.y, b.w, b.h].every(Number.isFinite) || b.w <= 0) fail('titleLetterBoxes bad box ' + JSON.stringify(b));
    }
    for (const w of [8, 160, 300]) for (const lines of [undefined, [], ['BEST 12,345'], ['BEST 99,999,999', 'LEVEL 14 · 245 cm', 'STREAK 31', 'x']])
      call('drawTileBox', [W * 0.7, H - 10, w, lines]);

    // titleBuild data
    const B = Art.titleBuild;
    if (!B || !Array.isArray(B.tiles) || B.tiles.length < 24 || B.tiles.length > 40) fail('titleBuild.tiles count');
    else {
      for (const t of B.tiles) {
        if (!SHAPES.includes(t.shape) || (t.shape !== 'cube' && !COLS.includes(t.color)) || ![t.x, t.y, t.rot, t.variant].every(Number.isFinite)) fail('titleBuild tile ' + JSON.stringify(t));
      }
      const has = (f) => B.tiles.some(f);
      if (!has((t) => t.shape === 'marble')) fail('titleBuild: no marble squares');
      if (!has((t) => Math.abs(t.rot + 18 * Math.PI / 180) < 0.02)) fail('titleBuild: no -18deg wall');
      if (!has((t) => t.color === 'orange' && (t.shape === 'tri' || t.shape === 'crown'))) fail('titleBuild: no orange triangle');
      const peak = B.tiles.reduce((a, t) => (t.y > a.y ? t : a));
      if (!(peak.color === 'orange' && (peak.shape === 'tri' || peak.shape === 'crown'))) fail('titleBuild: the orange triangle is not on the peak');
    }
    if (!B || !Array.isArray(B.rings) || B.rings.length !== 2) fail('titleBuild.rings');
    if (!B || !B.cube || !Number.isFinite(B.cube.x) || !Number.isFinite(B.cube.y)) fail('titleBuild.cube');

    // ------------------------------------------------------------ non-finite arguments
    const BAD = [Infinity, -Infinity, NaN, 1e300];
    for (const bad of BAD) {
      call('drawTile', ['sq', 'red', 100, 100, 0, bad, { glint: 0.5 }]);
      call('drawTile', ['crown', 'orange', bad, 100, 0, 40, { glint: 0.5, flash: 0.5, tint: 0.5 }]);
      call('drawTile', ['tri', 'blue', 100, bad, 0, 40, { ghost: 'gold' }]);
      call('drawTile', ['sq', 'blue', 100, 100, bad, 40, { glint: bad, flash: bad, tint: bad, alpha: bad, variant: bad }]);
      call('drawTile', ['cube', 'orange', 100, 100, 0, 40, { night: true, alpha: bad }]);
      call('drawCubeNet', [100, 100, bad, 0.5, 0]); call('drawCubeNet', [bad, 100, 40, 0.5, 0]);
      call('drawCubeNet', [100, 100, 40, bad, 0]); call('drawCubeNet', [100, 100, 40, 0.5, bad]);
      call('drawCar', [100, 100, 0, bad, 'red', { squash: 0.5 }]); call('drawCar', [bad, 100, bad, 40, 'red', { squash: bad }]);
      call('drawHand', [100, 100, bad, 0, 1]); call('drawHand', [bad, 100, 40, bad, bad]); call('drawHand', [100, bad, 40, 0, 0]);
      call('drawArm', [100, 100, bad, 1]); call('drawArm', [bad, 100, 40, bad]);
      call('drawRing', [100, 100, bad, 0, 1]); call('drawRing', [bad, 100, 40, bad, bad]); call('drawRing', [100, 100, 40, 0.5, bad]);
      call('drawGear', [100, 100, bad, 0]); call('drawGear', [100, 100, 40, bad]);
      call('drawRibbon', [0, bad, 100, 40, 0, 1]); call('drawRibbon', [0, 200, 100, bad, bad, bad]); call('drawRibbon', [0, 200, bad, 40, 0.5, 1]);
      call('drawGoalIcon', ['melon', 100, 100, bad]); call('drawGoalIcon', ['moon', bad, 100, 40]);
      call('drawFoot', [100, G, bad, 0.5, 1]); call('drawFoot', [bad, G, 40, bad, bad]); call('drawFoot', [100, bad, 40, 0.5, 1]);
      call('drawShadowBlob', [100, 100, bad, 5, 0.5]); call('drawShadowBlob', [bad, 100, 40, 5, bad]);
      call('drawTitle', [bad, 100, 400, 1, null]); call('drawTitle', [200, 100, bad, bad, [bad, 1, 0]]);
      call('drawTileBox', [100, 100, bad, ['x']]); call('drawTileBox', [bad, 100, 150, ['x']]);
      call('drawLight', [lt, bad, G, 0, 1]); call('drawLight', [lt, 40, G, bad, 1]); call('drawLight', [lt, 40, bad, 0, 1]);
      call('drawLight', [[{ shape: 'sq', color: 'red', cx: bad, cy: 300, rot: bad }], 40, G, 0, bad]);
      call('drawRoom', [W, H, G, bad, bad]); call('drawRoom', [W, H, bad, 0, 0]);
      call('drawRug', [W, H, G, bad]); call('drawRug', [W, H, bad, 0]);
      const bx = callNoCtx('titleLetterBoxes', [bad, bad, bad]);
      if (!Array.isArray(bx) || !bx.every((b) => [b.x, b.y, b.w, b.h].every(Number.isFinite))) fail('titleLetterBoxes with ' + bad);
    }
    callNoCtx('resize', [W, H, dpr, G]);

    // ------------------------------------------------------------ odd argument types
    const ODD = ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf', {}, [], [1, 2], null, undefined, true, '12', 'abc', () => 1];
    for (const v of ODD) {
      call('drawTile', [v, v, 100, 100, v, 40, { ghost: 'gold', variant: v, flash: v, tint: v, glint: v, alpha: v, layer: v, night: v }]);
      call('drawTile', ['sq', v, 100, 100, 0, 40, { ghost: v }]);
      call('drawTile', [v, 'red', 100, 100, 0, 40, v]);
      call('drawTile', ['tri', 'blue', 100, 100, 0, v, null]);
      call('drawCubeNet', [100, 100, 30, v, v]);
      call('drawCar', [100, 100, v, 40, v, v]);
      call('drawHand', [100, 100, 40, v, v]);
      call('drawArm', [100, 100, 40, v]);
      call('drawRing', [100, 100, 40, v, v]);
      call('drawGear', [100, 100, 40, v]);
      call('drawRibbon', [0, 200, 100, 40, v, v]);
      call('drawGoalIcon', [v, 100, 100, 40]);
      call('drawFoot', [100, G, 40, v, v]);
      call('drawShadowBlob', [100, 100, 40, 8, v]);
      call('drawTitle', [200, 100, 300, v, v]);
      call('drawTileBox', [100, 300, 150, v]);
      call('drawLight', [[{ shape: v, color: v, cx: 100, cy: G - 30, rot: v }], 40, G, 0, 1]);
      call('drawLight', [v, 40, G, 0, 1]);
      call('drawRoom', [W, H, G, v, v]); call('drawRug', [W, H, G, v]);
      const bx = callNoCtx('titleLetterBoxes', [v, v, v]);
      if (!Array.isArray(bx) || !bx.every((b) => [b.x, b.y, b.w, b.h].every(Number.isFinite))) fail('titleLetterBoxes with ' + String(v));
    }
    callNoCtx('resize', [W, H, dpr, G]);
    // a bad groundY (missing, not a number, infinite): nothing throws, and a correct call afterwards recovers
    {
      const rugPx = () => { const d = ctx.getImageData(Math.round(W / 2 * dpr), Math.round((H - 4) * dpr), 1, 1).data; return d[3]; };
      for (const g of [undefined, 'abc', {}, Infinity, -Infinity, null, NaN, '700']) {
        callNoCtx('resize', [W, H, dpr, g]);
        call('drawRoom', [W, H, g, 0, 0]); call('drawRug', [W, H, g, 0]);
        callNoCtx('resize', [W, H, dpr, G]);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        try { Art.drawRoom(ctx, W, H, G, 0, 0); Art.drawRug(ctx, W, H, G, 0); } catch (e) { fail('drawRoom/drawRug after resize(groundY ' + String(g) + ') threw ' + e.message); }
        if (rugPx() < 250) fail('the rug is not painted after resize(groundY ' + String(g) + ') and a correct resize');
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ------------------------------------------------------------ screen-shake coverage
    {
      // the game translates for screen shake (SMASH 18 px) and never clears the canvas: the
      // room and the rug together must still paint every pixel, at any camera height
      let worst = 0, worstAt = '';
      for (const [sx, sy] of [[18, 0], [-18, 0], [0, 18], [0, -18], [17, -17], [-24, 24]]) {
        for (const cam of [0, 400, 3000]) for (const sky of [0, 1]) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(sx, sy);
          Art.drawRoom(ctx, W, H, G, cam, sky); Art.drawRug(ctx, W, H, G, cam);
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200) n++;
          if (n > worst) { worst = n; worstAt = 'shake(' + sx + ',' + sy + ') camY ' + cam + ' skyT ' + sky; }
        }
      }
      out.shakeGapPx = worst;
      if (worst > 0) fail('room + rug leave ' + Math.round(worst / dpr / dpr) + ' CSS px unpainted at ' + worstAt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ------------------------------------------------------------ pixel checks
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    Art.resize(W, H, dpr, G);
    Art.drawRoom(ctx, W, H, G, 0, 0);
    Art.drawRug(ctx, W, H, G, 0);
    const px = (x, y) => ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
    {
      const y0 = Math.round((G + 4) * dpr), h = Math.round((H - G - 4) * dpr);
      const d = ctx.getImageData(0, y0, Math.round(W * dpr), h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      r /= n; g /= n; b /= n;
      out.rugMean = [r, g, b].map(Math.round);
      if (Math.abs(r - 0xED) > 30 || Math.abs(g - 0xE3) > 30 || Math.abs(b - 0xD3) > 30) fail('rug mean colour ' + out.rugMean + ' not within 30 of #EDE3D3');
    }
    {
      const L = 50, x = W / 2, y = G + 30;
      ctx.fillStyle = '#EDE3D3'; ctx.fillRect(x - 3 * L, y - L, 6 * L, 2 * L); // flat rug-cream patch: no texture luck
      const bg = px(x - 2 * L, y);
      Art.drawTile(ctx, 'sq', 'blue', x - 0.3 * L, y, 0, L, { layer: 'body' });
      Art.drawTile(ctx, 'sq', 'yellow', x + 0.3 * L, y, 0, L, { layer: 'body' });
      const a = px(x - 0.6 * L, y), b = px(x + 0.6 * L, y), o = px(x, y);
      const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      out.mix = { blue: [...a].slice(0, 3), yellow: [...b].slice(0, 3), overlap: [...o].slice(0, 3) };
      if (!(lum(o) < lum(a) && lum(o) < lum(b))) fail('multiply: overlap is not darker than either tile ' + JSON.stringify(out.mix));
      if (!(o[1] > o[0] && o[1] > o[2])) fail('multiply: blue over yellow does not read green ' + JSON.stringify(out.mix));
      if (lum(bg) - lum(a) < 20) fail('tile body barely visible over the rug');
    }
    {
      // night: tile must stand out from the night sky by >= 40 luminance
      Art.drawRoom(ctx, W, H, G, 6000, 1);
      const L = 30, x = W / 2, y = 60;
      const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      const sky = px(x + 3 * L, y);
      let worst = 999;
      for (const col of COLS) {
        Art.drawRoom(ctx, W, H, G, 6000, 1);
        Art.drawTile(ctx, 'sq', col, x, y, 0, L, { night: true });
        worst = Math.min(worst, Math.abs(lum(px(x - 0.15 * L, y + 0.1 * L)) - lum(sky)));
      }
      out.nightContrast = Math.round(worst);
      if (worst < 40) fail('night tiles too dark against the sky: ' + worst);
    }

    {
      // a groundY that drifts between draw calls must not rebuild the cached layers
      Art.resize(W, H, dpr, G);
      Art.drawRoom(ctx, W, H, G, 0, 0); Art.drawRug(ctx, W, H, G, 0);
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) { const g2 = G + (i % 2 ? 5.3 : -2.1); Art.drawRoom(ctx, W, H, g2, 0, 0); Art.drawRug(ctx, W, H, g2, 0); }
      const ms = (performance.now() - t0) / 20;
      out.groundDriftMs = +ms.toFixed(2);
      if (ms > 3) fail('drawRoom/drawRug rebuild when groundY drifts: ' + ms.toFixed(2) + ' ms per call pair');
      Art.resize(W, H, dpr, G);
    }
    {
      // the folding net at fold -> 1 must land exactly on the closed cube sprite
      const L = 40, x = 120, y = 120;
      const grab = (fn) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 240, 240); fn(); return ctx.getImageData(0, 0, Math.round(240 * dpr), Math.round(240 * dpr)).data; };
      const a = grab(() => Art.drawTile(ctx, 'cube', 'orange', x, y, 0, L));
      const b = grab(() => Art.drawCubeNet(ctx, x, y, L, 0.9999, 0));
      const e = grab(() => Art.drawCubeNet(ctx, x, y, L, 1, 0));
      let diff = 0, diffE = 0, n = 0;
      for (let i = 0; i < a.length; i += 4) { diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); diffE += Math.abs(a[i] - e[i]) + Math.abs(a[i + 1] - e[i + 1]); n++; }
      out.cubeNetDiff = +(diff / n).toFixed(3);
      if (diffE !== 0) fail('drawCubeNet(fold 1) differs from drawTile cube');
      if (diff / n > 3) fail('drawCubeNet(fold 0.9999) far from the closed cube: ' + (diff / n).toFixed(2));
      // no colour pop as the fold completes: fold 0.97 / 0.99 against the closed cube (L = 60)
      const L2 = 60;
      const grab2 = (fn) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#EDE3D3'; ctx.fillRect(0, 0, 240, 240); fn(); return ctx.getImageData(0, 0, Math.round(240 * dpr), Math.round(240 * dpr)).data; };
      const cube = grab2(() => Art.drawTile(ctx, 'cube', 'orange', 120, 125, 0, L2));
      out.cubeFold = {};
      for (const f of [0.97, 0.99]) {
        const d2 = grab2(() => Art.drawCubeNet(ctx, 120, 125, L2, f, 0));
        let sum = 0, big = 0, m = 0;
        for (let i = 0; i < cube.length; i += 4) {
          const dd = (Math.abs(cube[i] - d2[i]) + Math.abs(cube[i + 1] - d2[i + 1]) + Math.abs(cube[i + 2] - d2[i + 2])) / 3;
          sum += dd; if (dd > 60) big++; m++;
        }
        out.cubeFold[f] = { meanDiff: +(sum / m).toFixed(2), over60: big };
        if (sum / m > 3) fail('cube net fold ' + f + ' pops against the closed cube: mean diff ' + (sum / m).toFixed(2));
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    }
    const lumP = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    {
      // Art composes with the caller's globalAlpha: ink at alpha 0.3 is ~0.3 of the ink at 1
      const ink = (fn, ga) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = ga; fn(); ctx.globalAlpha = 1;
        const d = ctx.getImageData(0, 0, Math.round(300 * dpr), Math.round(300 * dpr)).data;
        let s = 0; for (let i = 0; i < d.length; i += 4) s += 765 - d[i] - d[i + 1] - d[i + 2];
        return s;
      };
      const F = {
        drawTile: () => Art.drawTile(ctx, 'sq', 'blue', 150, 150, 0.2, 60),
        drawTileGhost: () => Art.drawTile(ctx, 'sq', 'blue', 150, 150, 0, 60, { ghost: 'gold' }),
        drawTileNight: () => Art.drawTile(ctx, 'tri', 'purple', 150, 150, 0, 60, { night: true }),
        drawCubeNet: () => Art.drawCubeNet(ctx, 150, 150, 30, 0.5, 0),
        drawRingFloat: () => Art.drawRing(ctx, 150, 150, 80, 0, 1),
        drawRingFlat: () => Art.drawRing(ctx, 150, 150, 80, 1, 1),
        drawShadowBlob: () => Art.drawShadowBlob(ctx, 150, 150, 80, 30, 0.8),
        drawCar: () => Art.drawCar(ctx, 150, 150, 0, 60, 'red'),
        drawHand: () => Art.drawHand(ctx, 150, 200, 60, 0, 1),
        drawArm: () => Art.drawArm(ctx, 200, 150, 60, 1),
        drawGear: () => Art.drawGear(ctx, 150, 150, 120, 0),
        drawRibbon: () => Art.drawRibbon(ctx, 10, 290, 150, 60, 0, 1),
        drawGoalIcon: () => Art.drawGoalIcon(ctx, 'melon', 150, 150, 120),
        drawFoot: () => Art.drawFoot(ctx, 120, 280, 50, 1, -1),
        drawTileBox: () => Art.drawTileBox(ctx, 150, 280, 220, ['BEST 1']),
        drawTitle: () => Art.drawTitle(ctx, 150, 150, 280, 0),
      };
      out.alphaRatio = {};
      for (const k in F) {
        const a1 = ink(F[k], 1), a3 = ink(F[k], 0.3);
        const r = a1 > 0 ? a3 / a1 : 0;
        out.alphaRatio[k] = +r.toFixed(2);
        // layered strokes (ribbon, lettering) compound a little; the defect is ~1.0 (alpha ignored)
        if (!(r > 0.2 && r < 0.56)) fail('globalAlpha 0.3 leaves ' + r.toFixed(2) + ' of the ink in ' + k);
      }
    }
    {
      // floating ring pickup reads on the near-white wall AND on the raspberry armchair;
      // a ring stuck flat stays magenta on every tile colour
      const L = 40;
      const legible = (bg) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
        const ref = ctx.getImageData(0, 0, Math.round(120 * dpr), Math.round(120 * dpr)).data;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Art.drawRing(ctx, 60, 60, L, 0, 1.0);
        const d = ctx.getImageData(0, 0, Math.round(120 * dpr), Math.round(120 * dpr)).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(lumP(d, i) - lumP(ref, i)) > 40) n++;
        return Math.round(n / (dpr * dpr));
      };
      const onWall = legible('#F2EEE8'), onChair = legible('#B3244A'), onNight = legible('#1B2140');
      out.ringLegible = { wall: onWall, armchair: onChair, night: onNight };
      if (onWall < 150 || onChair < 100 || onNight < 100) fail('floating ring not legible (px > 40 lum off the background): ' + JSON.stringify(out.ringLegible));
      out.flatRing = {};
      for (const col of COLS) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#EDE3D3'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        Art.drawTile(ctx, 'sq', col, 60, 60, 0, 60);
        Art.drawRing(ctx, 60, 60, 60, 1, 0);
        // sample the ring body at mid-radius, between the moulded ridges, away from highlights
        const a = (0.62 + 1 / 24) * Math.PI * 2 / 1, rr = 0.255 * 60;
        const pxl = ctx.getImageData(Math.round((60 + Math.cos(0.3) * rr) * dpr), Math.round((60 + Math.sin(0.3) * rr) * dpr), 1, 1).data;
        out.flatRing[col] = [pxl[0], pxl[1], pxl[2]];
        if (!(pxl[0] > pxl[1] + 50 && pxl[2] > pxl[1] + 25)) fail('flat ring on ' + col + ' is not magenta: ' + out.flatRing[col]);
      }
    }
    {
      // light pass: lands only on the rug band, fades before its back edge, dims at night;
      // the rug itself dims with the room at night
      const backY = G - Math.min(110, Math.max(12, 0.45 * (H - G) + 0.025 * H)); // = art.js computeLayout
      const L = 30, tw = [];
      for (let r = 0; r < 15; r++) for (let k = 0; k < 2; k++) tw.push({ shape: 'sq', color: COLS[(r * 2 + k) % 7], cx: W / 2 + (k - 0.5) * L, cy: G - 0.5 * L - (r + 0.5) * L, rot: 0.02 });
      const shot = (sky, light) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        Art.drawRoom(ctx, W, H, G, 0, sky); Art.drawRug(ctx, W, H, G, 0);
        if (light) Art.drawLight(ctx, tw, L, G, 0, 1);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      // two identical base shots: pixels that differ between them are raster noise, not light
      const base = shot(0, false), lit = shot(0, true), base2 = shot(0, false);
      let above = 0, changed = 0, deep = 0;
      const rowBack = Math.floor(backY * dpr) - 1;
      for (let i = 0; i < base.length; i += 4) {
        const dd = Math.abs(base[i] - lit[i]) + Math.abs(base[i + 1] - lit[i + 1]) + Math.abs(base[i + 2] - lit[i + 2]);
        const noise = base[i] !== base2[i] || base[i + 1] !== base2[i + 1] || base[i + 2] !== base2[i + 2];
        if (dd > 3 && !noise) {
          changed++; const y = (i / 4 / c.width) | 0;
          if (y < rowBack) { above++; if (!out.lightAboveAt) out.lightAboveAt = [(i / 4) % c.width, y, [...base.slice(i, i + 3)], [...lit.slice(i, i + 3)]]; }
          if (y < rowBack + 0.08 * (G - backY) * dpr) deep++;
        }
      }
      out.light = { changedPx: changed, aboveRugPx: above, nearBackEdgePx: deep, firstAbove: out.lightAboveAt };
      if (changed < 50) fail('light pass invisible on the rug: ' + changed + ' px');
      if (above > 0) fail('light pass paints above the rug back edge: ' + above + ' px');
      if (deep > changed * 0.01) fail('light pass does not fade before the rug back edge: ' + deep + ' px');
      const night = shot(1, false), nightLit = shot(1, true);
      let dDay = 0, dNight = 0;
      for (let i = 0; i < base.length; i += 4) {
        dDay += Math.abs(base[i] - lit[i]) + Math.abs(base[i + 1] - lit[i + 1]) + Math.abs(base[i + 2] - lit[i + 2]);
        dNight += Math.abs(night[i] - nightLit[i]) + Math.abs(night[i + 1] - nightLit[i + 1]) + Math.abs(night[i + 2] - nightLit[i + 2]);
      }
      out.light.nightVsDay = +(dNight / Math.max(1, dDay)).toFixed(2);
      if (dNight > 0.6 * dDay) fail('light pass not dimmed at night: ' + out.light.nightVsDay);
      const mean = (d, y0, y1) => { let s2 = 0, n = 0; for (let y = Math.round(y0 * dpr); y < Math.round(y1 * dpr); y += 3) for (let x = 0; x < c.width; x += 5) { s2 += lumP(d, (y * c.width + x) * 4); n++; } return s2 / n; };
      const rugDay = mean(base, G + 4, H), rugNight = mean(night, G + 4, H), roomDay = mean(base, 0, backY - 30), roomNight = mean(night, 0, backY - 30);
      out.nightDim = { rugDay: Math.round(rugDay), rugNight: Math.round(rugNight), roomDay: Math.round(roomDay), roomNight: Math.round(roomNight) };
      if (rugNight - roomNight > 40 || rugDay - rugNight < 0.5 * (roomDay - roomNight)) fail('rug does not dim with the room at night: ' + JSON.stringify(out.nightDim));
      Art.drawRoom(ctx, W, H, G, 0, 0);
    }

    {
      // the ghost: on the near-white wall its fill (the held piece's colour) shows, and its
      // outline grows with L (a fixed 2 px line vanishes on a 70 px tile)
      const wall = [0xF2, 0xEE, 0xE8];
      const ghostInk = (L, col) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#F2EEE8'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        Art.drawTile(ctx, 'sq', col, 150, 150, 0, L, { ghost: 'white' });
        const d = ctx.getImageData(0, 0, Math.round(300 * dpr), Math.round(300 * dpr)).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 4) if (Math.abs(lumP(d, i) - 238) > 40) ink++;
        const m = ctx.getImageData(Math.round(150 * dpr), Math.round(150 * dpr), 1, 1).data;
        return { ink: ink / dpr / dpr, fill: Math.abs(m[0] - wall[0]) + Math.abs(m[1] - wall[1]) + Math.abs(m[2] - wall[2]) };
      };
      const g36 = ghostInk(36, 'blue'), g72 = ghostInk(72, 'blue');
      out.ghost = { ink36: Math.round(g36.ink), ink72: Math.round(g72.ink), fill: {} };
      if (!(g72.ink > 2.5 * g36.ink)) fail('ghost outline does not grow with L: ink ' + JSON.stringify(out.ghost));
      for (const col of COLS) {
        const f = ghostInk(48, col).fill;
        out.ghost.fill[col] = f;
        if (f < 30) fail('ghost fill invisible on the wall for ' + col + ': ' + f);
      }
    }
    {
      // night: the room is multiplied blue-dark, not veiled, and lit warm by the floor lamp
      Art.resize(W, H, dpr, G);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Art.drawRoom(ctx, W, H, G, 0, 1);
      const backY = G - Math.min(110, Math.max(12, 0.45 * (H - G) + 0.025 * H));
      const d = ctx.getImageData(0, 0, c.width, Math.round((backY - 10) * dpr)).data;
      let r = 0, g = 0, b = 0, n = 0, warm = 0;
      for (let i = 0; i < d.length; i += 4 * 3) {
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        if (d[i] > d[i + 2] + 40 && lumP(d, i) > 110) warm++;
      }
      out.nightRoom = { mean: [r / n, g / n, b / n].map(Math.round), warmPct: +(100 * warm / n).toFixed(2) };
      if (!(b / n > r / n + 20)) fail('night room is not blue: ' + JSON.stringify(out.nightRoom));
      if (warm < 0.002 * n) fail('night room has no warm lamp light: ' + JSON.stringify(out.nightRoom));
      Art.drawRoom(ctx, W, H, G, 0, 0);
    }
    {
      // the cube's oblique top and left faces stay within 0.2 L of its 2L x 2L cell, so tiles
      // stacked on or beside it do not read as interpenetrating
      const L = 50, x = 150, y = 150;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Art.drawTile(ctx, 'cube', 'orange', x, y, 0, L);
      const d = ctx.getImageData(0, 0, Math.round(300 * dpr), Math.round(300 * dpr)).data, w = Math.round(300 * dpr);
      let top = 1e9, left = 1e9;
      for (let py = 0; py < w; py++) for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        if (d[i] + d[i + 1] + d[i + 2] < 740) { if (py < top) top = py; if (px < left) left = px; }
      }
      out.cubeExtrusion = { top: +((y - L) - top / dpr).toFixed(1), left: +((x - L) - left / dpr).toFixed(1) };
      if (out.cubeExtrusion.top > 0.2 * L || out.cubeExtrusion.left > 0.2 * L) fail('cube extrusion too deep: ' + JSON.stringify(out.cubeExtrusion));
    }
    {
      // the cube net: drawn every frame the cube waits in the hand (flat) and while it falls (folding)
      // (the median of 41 timed frames, after a warm-up over every argument the timed frames use: a single
      // garbage-collector pause or scheduler hiccup inside one sub-millisecond sample used to drag the mean of 40 over
      // the budget now and then; the median still catches a net that is slow on every frame)
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bench = async (fn) => {
        for (let i = 0; i < 41; i++) fn(i);
        const ts = [];
        for (let i = 0; i < 41; i++) { await raf(); const t0 = performance.now(); fn(i); ts.push(performance.now() - t0); ctx.getImageData(0, 0, 1, 1); }
        ts.sort((a, b) => a - b);
        return ts[20];
      };
      const tile = await bench(() => Art.drawTile(ctx, 'cube', 'orange', 150, 300, 0, 45));
      const flat = await bench(() => Art.drawCubeNet(ctx, 150, 150, 24, 0, 0));
      const fold = await bench((i) => Art.drawCubeNet(ctx, 150, 300, 45, (i % 40) / 40, 0.1));
      out.cubeNetMs = { tile: +tile.toFixed(3), flat: +flat.toFixed(3), folding: +fold.toFixed(3) };
      if (flat > 0.3) fail('flat cube net (held) too slow: ' + flat.toFixed(3) + ' ms');
      if (fold > 0.6) fail('folding cube net too slow: ' + fold.toFixed(3) + ' ms');
    }

    // ------------------------------------------------------------ performance
    const L = 30;
    const R = (() => { let a = 77; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    const tower = [];
    const H3 = Math.sqrt(3) / 2;
    let y = 0, k = 0;
    while (y < 15) {
      if (k % 4 === 3) {
        tower.push({ shape: 'tri', color: COLS[k % 7], x: -0.5, y: y + H3 / 3, rot: 0 }, { shape: 'tri', color: COLS[(k + 2) % 7], x: 0.5, y: y + H3 / 3, rot: 0 },
          { shape: 'tri', color: COLS[(k + 4) % 7], x: 0, y: y + 2 * H3 / 3, rot: Math.PI });
        y += H3;
      } else {
        tower.push({ shape: k % 5 === 2 ? 'marble' : 'sq', color: COLS[k % 7], x: -0.5, y: y + 0.5, rot: 0 }, { shape: 'sq', color: COLS[(k + 3) % 7], x: 0.5, y: y + 0.5, rot: 0 });
        y += 1;
      }
      k++;
    }
    tower.push({ shape: 'cube', color: 'orange', x: 0, y: 4, rot: 0 });
    const debris = [];
    for (let i = 0; i < 60; i++) debris.push({ shape: ['sq', 'tri', 'sq', 'marble', 'cube'][(R() * 4.2) | 0], color: COLS[(R() * 7) | 0],
      x: (R() - 0.5) * W * 0.9, y: G + (R() - 0.2) * 40, rot: R() * 6.28, variant: (R() * 3) | 0 });
    const lightTiles = tower.map((t) => ({ shape: t.shape, color: t.color, cx: 0, cy: 0, rot: 0 }));
    const towerTop = 15;
    const camY = Math.max(0, 90 + (towerTop + 3) * L - (G - 0.5 * L));
    const bodyO = { layer: 'body', variant: 0 }, detO = { layer: 'detail', variant: 0, tint: 0, flash: 0 };
    const ghostO = { ghost: 'gold' };
    const frame = (t) => {
      ctx.setTransform(dpr, 0, 0, dpr, Math.sin(t * 40) * 1.5, 0);
      const cx = W / 2, baseY = G + camY - 0.5 * L, flex = Math.sin(t * 2) * 0.2, th = Math.sin(t * 1.3) * 0.02;
      for (let i = 0; i < tower.length; i++) {
        const p = tower[i], lt2 = lightTiles[i];
        const fx = flex * (p.y / towerTop) * (p.y / towerTop);
        lt2.cx = cx + (p.x + fx) * L + p.y * L * th; lt2.cy = baseY - p.y * L; lt2.rot = p.rot + th;
      }
      Art.drawRoom(ctx, W, H, G, camY, 1);
      Art.drawRug(ctx, W, H, G, camY);
      Art.drawLight(ctx, lightTiles, L, G, camY, 1);
      for (const d of debris) Art.drawShadowBlob(ctx, d.x + cx, d.y + camY + 0.3 * L, 0.6 * L, 0.12 * L, 0.3);
      Art.drawCar(ctx, cx, baseY, th, L, 'red', null);
      for (const d of debris) { bodyO.variant = d.variant; Art.drawTile(ctx, d.shape, d.color, d.x + cx, d.y + camY, d.rot, L, bodyO); }
      for (const d of debris) { detO.variant = d.variant; Art.drawTile(ctx, d.shape, d.color, d.x + cx, d.y + camY, d.rot, L, detO); }
      for (const p of lightTiles) Art.drawTile(ctx, p.shape, p.color, p.cx, p.cy, p.rot, L, bodyO);
      for (const p of lightTiles) Art.drawTile(ctx, p.shape, p.color, p.cx, p.cy, p.rot, L, detO);
      Art.drawRing(ctx, cx + 2 * L, baseY - 8 * L, L, 0, t);
      Art.drawRing(ctx, lightTiles[5].cx, lightTiles[5].cy, L, 1, t);
      Art.drawRibbon(ctx, 8, W - 50, baseY - 16 * L, L, 0, t);
      Art.drawGoalIcon(ctx, 'moon', W - 25, baseY - 16 * L, 34);
      Art.drawTile(ctx, 'sq', 'blue', cx, 90 + 2 * L, 0, L, ghostO);
      Art.drawTile(ctx, 'sq', 'blue', cx, 90 + 0.5 * L, 0, L, null);
      // a cube folding on its way down, and the next one waiting flat in the hand
      Art.drawCubeNet(ctx, cx + L, 90 + 5 * L, L * 0.7, (t * 3) % 1, 0.05);
      Art.drawCubeNet(ctx, cx, 90 + 1.2 * L, L * 0.4, 0, 0);
      Art.drawHand(ctx, cx, 90, L, 0, t);
    };
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i < 40; i++) { frame(i / 60); await raf(); }
    const times = [];
    let flushTotal = 0;
    for (let i = 0; i < 150; i++) {
      await raf();
      const t0 = performance.now();
      frame(1 + i / 60);
      const t1 = performance.now();
      times.push(t1 - t0);
      ctx.getImageData(0, 0, 1, 1); // force the raster so the next frame starts clean
      flushTotal += performance.now() - t1;
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    out.perf = { tiles: tower.length + debris.length, avgMs: +avg.toFixed(3), p50: +times[times.length >> 1].toFixed(3),
      p95: +times[Math.floor(times.length * 0.95)].toFixed(3), max: +times[times.length - 1].toFixed(3), rasterFlushAvgMs: +(flushTotal / 150).toFixed(3) };
    if (avg > BUDGET_MS) fail('perf: Art time ' + avg.toFixed(2) + ' ms > ' + BUDGET_MS + ' ms');
    // a zoom ease (L 72 -> 30 over 1 s): sprites rebuild under the per-frame budget; report the worst frame
    let worstZoom = 0;
    for (let i = 0; i <= 60; i++) {
      const Lz = 72 - (42 * i) / 60;
      const t0 = performance.now();
      for (const p of lightTiles) Art.drawTile(ctx, p.shape, p.color, p.cx, p.cy, p.rot, Lz, bodyO);
      for (const p of lightTiles) Art.drawTile(ctx, p.shape, p.color, p.cx, p.cy, p.rot, Lz, detO);
      worstZoom = Math.max(worstZoom, performance.now() - t0);
      await raf();
    }
    out.perf.zoomEaseWorstMs = +worstZoom.toFixed(2);
    // live canvas memory through a full zoom sweep over every sprite kind (worst case)
    const sweepO = [{}, { night: true }, { flash: 0.5, tint: 0.5 }, { variant: 1 }, { variant: 2 }];
    let peak = 0;
    for (let i = 0; i <= 18; i++) {
      const Lz = 72 / Math.pow(1.05, i);
      Art.drawRoom(ctx, W, H, G, 0, 0);
      for (const sh of SHAPES) for (const col of COLS) for (const o of sweepO) Art.drawTile(ctx, sh, col, 100, 100, 0, Lz, o);
      Art.drawCar(ctx, 100, 100, 0, Lz, 'red'); Art.drawRing(ctx, 100, 100, Lz, 0, 1); Art.drawHand(ctx, 100, 100, Lz, 0, 1);
      peak = Math.max(peak, window.__canvasBytes().mb);
      await raf();
    }
    out.canvasMB = { peak, end: window.__canvasBytes().mb, live: window.__canvasBytes().n };
    if (peak > 120) fail('live canvas memory ' + peak + ' MB through a zoom sweep');

    // ------------------------------------------------------------ 11. fixes since the component build
    const lumA = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const raf2 = () => new Promise((r) => requestAnimationFrame(r));
    {
      // a skyT ramp 0 -> 1 over 180 frames while the camera scrolls: no frame over 16 ms (the evening light is
      // composed a band of rows per frame into a second buffer, never rebuilt inside one frame)
      Art.resize(W, H, dpr, G);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Art.drawRoom(ctx, W, H, G, 0, 0); Art.drawRug(ctx, W, H, G, 0);
      let worst = 0, sum = 0;
      for (let i = 0; i <= 180; i++) {
        await raf2();
        const t0 = performance.now();
        Art.drawRoom(ctx, W, H, G, i * 4, i / 180); Art.drawRug(ctx, W, H, G, i * 4);
        const ms = performance.now() - t0; sum += ms; if (ms > worst) worst = ms;
      }
      out.skyRamp = { worstMs: +worst.toFixed(2), avgMs: +(sum / 181).toFixed(2) };
      if (worst > 16) fail('a skyT ramp costs a frame of ' + worst.toFixed(1) + ' ms (> 16)');
      // and it does arrive at the night room: a frame pair later the room is the dark blue one
      for (let i = 0; i < 120; i++) { await raf2(); Art.drawRoom(ctx, W, H, G, 0, 1); }
      const d = ctx.getImageData(0, 0, c.width, Math.round(G * 0.5 * dpr)).data;
      let r = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 9) { r += d[i]; b += d[i + 2]; n++; }
      out.skyRamp.nightRB = [Math.round(r / n), Math.round(b / n)];
      if (!(b / n > r / n + 15)) fail('after a skyT ramp the room never turns night blue: ' + out.skyRamp.nightRB);
      Art.drawRoom(ctx, W, H, G, 0, 0);
    }
    {
      // the stained-glass light of a 6 L tower on one car lands on open rug beside the base, not only behind it
      const backY = G - Math.min(110, Math.max(12, 0.45 * (H - G) + 0.025 * H));
      const L = Math.min(52, W / 7.5), tw = [];
      for (let r = 0; r < 6; r++) for (let k = 0; k < 2; k++) tw.push({ shape: 'sq', color: COLS[(r * 2 + k) % 7], cx: W / 2 + (k - 0.5) * L, cy: G - 0.5 * L - (r + 0.5) * L, rot: 0 });
      const shot = (light) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        Art.drawRoom(ctx, W, H, G, 0, 0); Art.drawRug(ctx, W, H, G, 0);
        if (light) Art.drawLight(ctx, tw, L, G, 0, 1);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const a0 = shot(false), a1 = shot(true), a2 = shot(false);
      let open = 0;
      const x0 = Math.round((W / 2 + 1.3 * L) * dpr);
      for (let y = Math.round(backY * dpr); y < Math.round(G * dpr); y++) for (let x = x0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const noise = a0[i] !== a2[i] || a0[i + 1] !== a2[i + 1] || a0[i + 2] !== a2[i + 2];
        if (!noise && Math.abs(a0[i] - a1[i]) + Math.abs(a0[i + 1] - a1[i + 1]) + Math.abs(a0[i + 2] - a1[i + 2]) > 6) open++;
      }
      out.lightOpenPx = Math.round(open / dpr / dpr);
      if (out.lightOpenPx < 400) fail('the stained-glass light hardly reaches the open rug beside the base: ' + out.lightOpenPx + ' px');
    }
    {
      // a down triangle is lit from the top-left like an up one: the upper-left half of its detail is the brighter
      const L = 80;
      const grabTri = (rot) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Art.drawTile(ctx, 'tri', 'blue', 100, 100, rot, L, { layer: 'detail' });
        const w = Math.round(80 * dpr), d = ctx.getImageData(Math.round(60 * dpr), Math.round(60 * dpr), w, w).data;
        let ul = 0, nul = 0, lr = 0, nlr = 0;
        for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4, v = lumA(d, i);
          if (Math.abs(v - 128) < 2) continue;
          if (x + y < w) { ul += v; nul++; } else { lr += v; nlr++; }
        }
        return ul / Math.max(1, nul) - lr / Math.max(1, nlr);
      };
      const up = grabTri(0), dn = grabTri(Math.PI), dn2 = grabTri(Math.PI + 0.05);
      out.triLight = { up: +up.toFixed(1), down: +dn.toFixed(1), downRocking: +dn2.toFixed(1) };
      if (!(up > 0 && dn > 0 && dn2 > 0)) fail('triangles are not all lit from the top-left: ' + JSON.stringify(out.triLight));
    }
    {
      // the cube's oblique top strip reads red (photo 3: the red lid)
      const L = 60, x = 150, y = 150;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Art.drawTile(ctx, 'cube', 'orange', x, y, 0, L);
      const d = ctx.getImageData(Math.round((x - 0.6 * L) * dpr), Math.round((y - L - 0.1 * L) * dpr), Math.round(L * dpr), 1).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      out.cubeTop = [r / n, g / n, b / n].map(Math.round);
      if (!(r / n > g / n + 70 && r / n > b / n + 60)) fail('the cube top does not read red: ' + out.cubeTop);
    }
    {
      // car wheels turn with the distance rolled (o.roll)
      const L = 60;
      const grabCar = (roll) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#EDE3D3'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Art.drawCar(ctx, 150, 150, 0, L, 'red', { roll });
        return ctx.getImageData(Math.round((150 + 0.6 * L) * dpr), Math.round((150 + 0.1 * L) * dpr), Math.round(0.4 * L * dpr), Math.round(0.4 * L * dpr)).data;
      };
      const a = grabCar(0), b = grabCar(0.35);
      let diff = 0;
      for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      out.wheelTurn = +(diff / (a.length / 4)).toFixed(2);
      if (out.wheelTurn < 2) fail('car wheels do not turn with o.roll: ' + out.wheelTurn);
    }
    {
      // night tiles stand out by 40+ luminance against the night sky AND a lamp-lit wall
      let worst = 999, at = '';
      for (const bg of ['#141936', '#6E6A72']) for (const col of COLS) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Art.drawTile(ctx, 'sq', col, 100, 100, 0, 50, { night: true });
        const t = ctx.getImageData(Math.round(100 * dpr), Math.round(109 * dpr), 1, 1).data, b = ctx.getImageData(2, 2, 1, 1).data;
        const dd = Math.abs(lumA(t, 0) - lumA(b, 0));
        if (dd < worst) { worst = dd; at = col + ' on ' + bg; }
      }
      out.nightLit = { worst: Math.round(worst), at };
      // (40 is the floor; the lit glass keeps a comfortable margin over it: 52)
      if (worst < 52) fail('a night tile does not stand out by 40 luminance with a margin (52): ' + JSON.stringify(out.nightLit));
    }
    {
      // the holding arm comes down from the upper right (it slants, it is not a vertical pole) and bends at the
      // elbow: the forearm's direction and the upper arm's differ
      const L = Math.min(52, W / 7.5), hx = W * 0.4, hy = H * 0.55;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Art.drawHand(ctx, hx, hy, L, 0, 0);
      const navyX = (y) => {
        const d = ctx.getImageData(0, Math.round(y * dpr), c.width, 1).data;
        let sx = 0, n = 0;
        for (let x = 0; x < c.width; x++) { const i = x * 4; if (d[i] < 70 && d[i + 1] < 80 && d[i + 2] > 35 && d[i + 2] < 120 && d[i + 2] > d[i] + 15) { sx += x; n++; } }
        return n ? sx / n / dpr : NaN;
      };
      const yw = hy - 0.7 * L, yA = yw - 1.1 * L, yB = yw * 0.45, yC = yw * 0.2;
      const xA = navyX(yA), xB = navyX(yB), xC = navyX(yC);
      const fore = Math.atan2(xA - hx, yw - yA), upper = Math.atan2(xC - xB, yB - yC);
      out.arm = { hand: Math.round(hx), forearmDeg: Math.round(fore * 57.3), upperDeg: Math.round(upper * 57.3), xMid: Math.round(xB) };
      if (!(xB > hx + 1.0 * L)) fail('the holding arm does not slant in from the upper right: ' + JSON.stringify(out.arm));
      if (!(Math.abs(upper - fore) > 0.2)) fail('the holding arm has no elbow (one straight pole): ' + JSON.stringify(out.arm));
      // a child's arm reaching in, not a pole: with the hand this low, the elbow (the centre line's farthest point from
      // the wrist-to-screen-edge chord) splits it so the upper arm on screen is at most twice the forearm
      const line = [];
      for (let y = Math.round(yw - 0.1 * L); y >= 2; y -= 3) { const x = navyX(y); if (x === x) line.push([x, y]); }
      if (line.length > 6) {
        const [ax, ay] = line[0], [bx, by] = line[line.length - 1], cl = Math.hypot(bx - ax, by - ay);
        let e = 0, ed = -1;
        for (let i = 1; i < line.length - 1; i++) { const d = Math.abs((bx - ax) * (ay - line[i][1]) - (ax - line[i][0]) * (by - ay)) / cl; if (d > ed) { ed = d; e = i; } }
        const fl = Math.hypot(line[e][0] - ax, line[e][1] - ay), ul = Math.hypot(bx - line[e][0], by - line[e][1]);
        out.arm.upperOverFore = +(ul / fl).toFixed(2);
        if (!(ul <= 2 * fl)) fail('the holding arm is mostly a long upper arm (a pole), not a child\'s arm reaching in: ' + JSON.stringify(out.arm));
      } else fail('the holding arm\'s centre line was not found: ' + line.length + ' rows');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return out;
  }, { BUDGET_MS });
  await ctx.close();
  return { res, errors };
}

// the tile box (the L2 goal) shows in the room on wide layouts, clear of the 4 L base (its light-blue lid panel,
// #7CC6EE through the room's haze and blur, lies right of the base's right end)
async function tileBoxCheck(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(gameUrl({ mute: 1, nohint: 1, seed: 5, level: 2, autostart: 1 }), { waitUntil: 'load' });
  await page.waitForFunction(() => window.CS && CS.state().phase === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    CS.halt();
    const cam = CS.cam(), c = document.createElement('canvas');
    c.width = cam.W; c.height = cam.H;
    const g = c.getContext('2d');
    Art.drawRoom(g, cam.W, cam.H, cam.groundY, 0, 0);
    const d = g.getImageData(0, 0, cam.W, cam.H).data;
    let n = 0, x0 = 1e9, x1 = -1e9;
    for (let y = 0; y < cam.groundY; y++) for (let x = 0; x < cam.W; x++) {
      const i = (y * cam.W + x) * 4;
      if (Math.abs(d[i] - 143) < 26 && Math.abs(d[i + 1] - 204) < 22 && Math.abs(d[i + 2] - 237) < 22) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
    return { n, x0, x1, L: +cam.L.toFixed(1), baseRight: Math.round(cam.originX + 2 * cam.L) };
  });
  await context.close();
  const fails = [];
  if (!(r.n >= 30 && r.x0 > r.baseRight)) fails.push('tile box lid not clear of the base at ' + vp.w + 'x' + vp.h + ': ' + JSON.stringify(r));
  return { r, fails, errors };
}

(async () => {
  const browser = await pw.chromium.launch();
  let bad = 0;
  try {
    for (const vp of [{ w: 1366, h: 1024 }, { w: 1024, h: 768 }, { w: 844, h: 390 }]) {
      const { r, fails, errors } = await tileBoxCheck(browser, vp);
      console.log(vp.w + 'x' + vp.h + ': tile box lid ' + JSON.stringify(r));
      for (const f of fails) console.log('  FAIL ' + f);
      for (const e of errors) console.log('  ERROR ' + e);
      bad += fails.length + errors.length;
    }
    for (const vp of [{ w: 390, h: 844, dpr: 2 }, { w: 1366, h: 1024, dpr: 1 }, { w: 390, h: 844, dpr: 3 }]) {
      const { res, errors } = await run(browser, vp);
      const tag = vp.w + 'x' + vp.h + '@' + vp.dpr;
      console.log(tag + ': ' + res.calls + ' calls, rug mean ' + res.rugMean + ', mix ' + JSON.stringify(res.mix) + ', night contrast ' + res.nightContrast +
        ', groundY drift ' + res.groundDriftMs + ' ms, cube net diff ' + res.cubeNetDiff);
      console.log(tag + ': perf ' + JSON.stringify(res.perf) + ' canvasMB ' + JSON.stringify(res.canvasMB));
      console.log(tag + ': alpha ' + JSON.stringify(res.alphaRatio));
      console.log(tag + ': ring ' + JSON.stringify(res.ringLegible) + ' flat ' + JSON.stringify(res.flatRing));
      console.log(tag + ': light ' + JSON.stringify(res.light) + ' night ' + JSON.stringify(res.nightDim) + ' cubeFold ' + JSON.stringify(res.cubeFold));
      console.log(tag + ': shake gaps ' + res.shakeGapPx + ' px, ghost ' + JSON.stringify(res.ghost) + ', night room ' + JSON.stringify(res.nightRoom) +
        ', cube extrusion ' + JSON.stringify(res.cubeExtrusion) + ', cube net ms ' + JSON.stringify(res.cubeNetMs));
      console.log(tag + ': skyT ramp ' + JSON.stringify(res.skyRamp) + ', light on open rug ' + res.lightOpenPx + ' px, triangles ' + JSON.stringify(res.triLight) +
        ', cube top ' + res.cubeTop + ', wheel turn ' + res.wheelTurn + ', night lit ' + JSON.stringify(res.nightLit) + ', arm ' + JSON.stringify(res.arm));
      for (const f of res.fails) console.log('  FAIL ' + f);
      for (const e of errors) console.log('  ERROR ' + e);
      bad += res.fails.length + errors.length;
    }
  } finally {
    await browser.close();
  }
  if (bad) { console.log('art: ' + bad + ' problem(s)'); process.exit(1); }
  console.log('art OK');
})().catch((e) => { console.error(e); process.exit(1); });
