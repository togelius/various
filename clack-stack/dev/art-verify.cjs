#!/usr/bin/env node
// Independent verifier for the Art module: node clack-stack/dev/art-verify.cjs
// Checks what art-contract.cjs does not: exact parameter counts, extreme L (1, 2, 6, 200, 500),
// extra ctx state fields, odd groundY values in resize/drawRoom/drawRug (and recovery after
// them), triangle centroids + the shared edges of a Δ∇Δ band, car wheel contact 0.5 L below the
// plate top, the hand's grip on a tile whose top-edge midpoint is (x,y), drawCubeNet(fold 1) vs
// drawTile('cube') under rotation + caller alpha, titleBuild geometry (L units, y up), and the
// JS time of a crash frame where all 60 debris pieces spin (no pre-rotated sprites).
'use strict';
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const ART = path.join(__dirname, 'art.js');

async function run(browser, vp) {
  const bctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr });
  const page = await bctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.setContent('<!doctype html><html><body style="margin:0"><canvas id="c"></canvas></body></html>');
  await page.addScriptTag({ path: ART });
  const res = await page.evaluate(async () => {
    const out = { fails: [], info: {} };
    const fail = (s) => { if (out.fails.length < 80) out.fails.push(s); };
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio;
    const c = document.getElementById('c');
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const G = Math.round(H * 0.905);

    // ---------------------------------------------------------------- 1. signatures
    const SIG = { resize: 4, drawRoom: 6, drawRug: 5, drawLight: 6, drawTile: 8, drawCubeNet: 6, drawCar: 7, drawHand: 6, drawArm: 5,
      drawRing: 6, drawGear: 5, drawRibbon: 7, drawGoalIcon: 5, drawFoot: 6, drawShadowBlob: 6, drawTitle: 6, titleLetterBoxes: 3, drawTileBox: 5 };
    for (const k in SIG) if (typeof Art[k] !== 'function' || Art[k].length !== SIG[k]) fail('signature Art.' + k + ' has ' + (Art[k] && Art[k].length) + ' params, BUILD.md has ' + SIG[k]);

    // ---------------------------------------------------------------- 2. extreme L + extra state fields
    const snap = () => { const m = ctx.getTransform(); return JSON.stringify([m.a, m.b, m.c, m.d, m.e, m.f, ctx.globalAlpha, ctx.globalCompositeOperation,
      ctx.getLineDash(), ctx.lineDashOffset, ctx.filter, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.lineCap, ctx.lineJoin, ctx.miterLimit,
      ctx.font, ctx.textAlign, ctx.textBaseline, ctx.direction, ctx.shadowBlur, ctx.shadowColor, ctx.shadowOffsetX, ctx.imageSmoothingEnabled,
      ctx.imageSmoothingQuality, ctx.letterSpacing, ctx.fontKerning]); };
    let calls = 0;
    const call = (name, args) => {
      calls++;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, -7, 5);
      ctx.globalAlpha = 0.8; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([4, 2]); ctx.lineDashOffset = 0.5;
      ctx.miterLimit = 7; ctx.imageSmoothingQuality = 'medium'; ctx.shadowOffsetX = 0; ctx.fillStyle = '#0a0b0c'; ctx.strokeStyle = '#0c0b0a';
      const b = snap();
      try { Art[name].apply(Art, [ctx].concat(args)); } catch (e) { fail(name + '(' + JSON.stringify(args).slice(0, 90) + ') threw ' + e.message); }
      const a = snap();
      if (a !== b) fail(name + ' changed ctx state\n    ' + b + '\n    ' + a);
      ctx.restore();
    };
    Art.resize(W, H, dpr, G);
    const SH = ['sq', 'tri', 'cube', 'marble', 'crown'], COLS = Art.TILE_COLORS;
    for (const L of [1, 2, 6, 200, 500]) {
      call('drawRoom', [W, H, G, L * 3, 0.7]); call('drawRug', [W, H, G, L]);
      call('drawLight', [[{ shape: 'tri', color: 'blue', cx: W / 2, cy: G - L, rot: Math.PI }, { shape: 'cube', color: 'x', cx: W / 2, cy: G - 3 * L, rot: 0.1 }], L, G, 0, 1]);
      for (const s of SH) for (const o of [undefined, { ghost: 'gold' }, { ghost: 'white', night: true }, { night: true, flash: 0.5, tint: 0.5, glint: 0.4 }, { layer: 'body' }, { layer: 'detail', variant: 2 }])
        call('drawTile', [s, COLS[(L | 0) % 7], W / 2, H / 2, 0.37, L, o]);
      for (const f of [0, 0.3, 0.97, 1]) call('drawCubeNet', [W / 2, H / 2, L, f, 0.2]);
      call('drawCar', [W / 2, G - 0.5 * L, 0.1, L, 'green', { squash: 0.6, t: 1 }]);
      for (const op of [0, 1]) call('drawHand', [W / 2, 90, L, op, 2]);
      call('drawArm', [W / 2, G - L, L, 0.3]);
      for (const fl of [0, 1]) call('drawRing', [W / 2, 200, L, fl, 1]);
      call('drawGear', [W / 2, 200, L, 1]);
      call('drawRibbon', [10, W - 10, 300, L, 0.5, 1]);
      call('drawGoalIcon', ['you', 100, 100, L]);
      call('drawFoot', [W / 2, G, L, 0.5, 1]);
      call('drawShadowBlob', [W / 2, G, L, L / 4, 0.5]);
      call('drawTitle', [W / 2, 150, L * 4, 1, [1, 0, 0.5]]);
      call('drawTileBox', [W / 2, G, L, ['BEST 1', 'x']]);
    }
    out.info.calls = calls;

    // ---------------------------------------------------------------- 3. odd groundY in the layout entry points
    // each case on a NEW size, then a correct resize at that size: Art must not throw and must recover
    const oddG = { undefined: undefined, null: null, NaN: NaN, Infinity: Infinity, '-Infinity': -Infinity, '1e300': 1e300, "'700'": '700', "'abc'": 'abc', '{}': {} };
    let wv = W - 40;
    out.info.groundY = {};
    for (const k in oddG) {
      wv += 3;
      const r = [];
      try { Art.resize(wv, H, dpr, oddG[k]); r.push('resize ok'); } catch (e) { r.push('resize THREW'); fail('resize(W,H,dpr,' + k + ') threw: ' + e.message); }
      try { Art.drawRoom(ctx, wv, H, oddG[k], 0, 0); Art.drawRug(ctx, wv, H, oddG[k], 0); r.push('draw ok'); } catch (e) { r.push('draw THREW'); fail('drawRoom/drawRug(groundY ' + k + ') threw: ' + e.message); }
      // recovery: a correct call at the same size must work and paint the rug
      Art.resize(wv, H, dpr, G);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try { Art.drawRoom(ctx, wv, H, G, 0, 0); Art.drawRug(ctx, wv, H, G, 0); } catch (e) { r.push('RECOVERY THREW'); fail('after groundY ' + k + ', a correct resize + drawRoom still throws: ' + e.message); }
      const p = ctx.getImageData(Math.round(W / 2 * dpr), Math.round((H - 6) * dpr), 1, 1).data;
      if (p[3] < 255) { r.push('rug not painted'); fail('after groundY ' + k + ', a correct resize leaves the rug unpainted'); }
      out.info.groundY[k] = r.join(', ');
    }
    Art.resize(W, H, dpr, G);

    // ---------------------------------------------------------------- helpers: draw on a transparent offscreen, read alpha
    const S = 2; // offscreen px per CSS px
    const off = document.createElement('canvas'); off.width = 600 * S; off.height = 600 * S;
    const o2 = off.getContext('2d', { willReadFrequently: true });
    const shot = (fn) => { o2.setTransform(1, 0, 0, 1, 0, 0); o2.clearRect(0, 0, off.width, off.height); o2.setTransform(S, 0, 0, S, 0, 0); fn(o2); return o2.getImageData(0, 0, off.width, off.height).data; };
    const alphaAt = (d, x, y) => d[(Math.round(y * S) * off.width + Math.round(x * S)) * 4 + 3] / 255;
    const maskStats = (d, test) => {
      let n = 0, sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        if (!test(d, i)) continue;
        const x = (p % off.width) / S, y = ((p / off.width) | 0) / S;
        n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return { n, cx: sx / n + 0.5 / S, cy: sy / n + 0.5 / S, x0, y0, x1: x1 + 1 / S, y1: y1 + 1 / S };
    };
    const solid = (d, i) => d[i + 3] > 127;

    // ---------------------------------------------------------------- 4. triangles: centroid, rot + PI, Δ∇Δ shared edges
    {
      const L = 120, h = L * Math.sqrt(3) / 2, cx = 300, cy = 300;
      const up = maskStats(shot((g) => Art.drawTile(g, 'tri', 'blue', cx, cy, 0, L, { layer: 'body' })), solid);
      const dn = maskStats(shot((g) => Art.drawTile(g, 'tri', 'blue', cx, cy, Math.PI, L, { layer: 'body' })), solid);
      out.info.triUp = { dCx: +(up.cx - cx).toFixed(2), dCy: +(up.cy - cy).toFixed(2), base: +(up.y1 - (cy + h / 3)).toFixed(2), w: +(up.x1 - up.x0).toFixed(1) };
      out.info.triDown = { dCx: +(dn.cx - cx).toFixed(2), dCy: +(dn.cy - cy).toFixed(2), top: +(dn.y0 - (cy - h / 3)).toFixed(2) };
      if (Math.hypot(up.cx - cx, up.cy - cy) > 0.6) fail('up triangle is not centred on its centroid: ' + JSON.stringify(out.info.triUp));
      if (Math.abs(up.y1 - (cy + h / 3)) > 0.6) fail('up triangle base not at centroid + h/3: ' + JSON.stringify(out.info.triUp));
      if (Math.hypot(dn.cx - cx, dn.cy - cy) > 0.6) fail('down triangle (rot+PI) not centred on its centroid: ' + JSON.stringify(out.info.triDown));
      if (Math.abs(dn.y0 - (cy - h / 3)) > 0.6) fail('down triangle top edge not at centroid - h/3: ' + JSON.stringify(out.info.triDown));
      // a Δ∇Δ band on a base line yb: ups at x0 and x0+L, the down between them
      const yb = 400, x0 = 200;
      const A = shot((g) => Art.drawTile(g, 'tri', 'red', x0, yb - h / 3, 0, L, { layer: 'body' }));
      const B = shot((g) => Art.drawTile(g, 'tri', 'red', x0 + L / 2, yb - 2 * h / 3, Math.PI, L, { layer: 'body' }));
      const C = shot((g) => Art.drawTile(g, 'tri', 'red', x0 + L, yb - h / 3, 0, L, { layer: 'body' }));
      // walk the shared edge A|B (from (x0+L/2, yb) to (x0, yb-h)) between 15% and 85%, probing across it
      const ux = -0.5, uy = -Math.sqrt(3) / 2, nx = -uy, ny = ux; // edge dir, normal toward B (right/down)
      let overlap = 0, gap = 0, probes = 0;
      for (let s = 0.15; s <= 0.85; s += 0.01) {
        const ex = x0 + L / 2 + ux * L * s, ey = yb + uy * L * s;
        probes++;
        let any = false, both = false;
        for (let k = -1.5; k <= 1.5; k += 0.5) {
          const px = ex + nx * k, py = ey + ny * k;
          const a = alphaAt(A, px, py), b = alphaAt(B, px, py);
          if (a > 0.5 && b > 0.5) both = true;
          if (a > 0.5 || b > 0.5) any = true;
        }
        if (both) overlap++;
        // a gap: the probe line crosses the edge with neither tile solid on some point 1 px away from it
        const la = alphaAt(A, ex - nx * 1, ey - ny * 1), rb = alphaAt(B, ex + nx * 1, ey + ny * 1);
        if (la < 0.5 || rb < 0.5) gap++;
      }
      out.info.band = { probes, overlapProbes: overlap, gapProbes: gap };
      if (gap > 0) fail('Δ∇Δ band: a gap along the shared slanted edge at ' + gap + '/' + probes + ' probes');
      if (overlap > probes * 0.2) fail('Δ∇Δ band: the down triangle overlaps its neighbour along the shared edge at ' + overlap + '/' + probes + ' probes');
      // and the right edge B|C by symmetry: the down triangle's right edge meets C
      let gapR = 0;
      for (let s = 0.15; s <= 0.85; s += 0.01) {
        const ex = x0 + L / 2 + 0.5 * L * s, ey = yb - h * s; // from (x0+L/2,yb) up to (x0+L, yb-h)
        const bx = ex - Math.sqrt(3) / 2, by = ey - 0.5, cx2 = ex + Math.sqrt(3) / 2, cy2 = ey + 0.5;
        if (alphaAt(B, bx, by) < 0.5 || alphaAt(C, cx2, cy2) < 0.5) gapR++;
      }
      out.info.band.gapRight = gapR;
      if (gapR > 0) fail('Δ∇Δ band: a gap along the right shared edge at ' + gapR + ' probes');
    }

    // ---------------------------------------------------------------- 5. car: wheels touch 0.5 L below the plate top, 0.8 L from centre
    {
      const L = 100, x = 300, y = 250;
      const d = shot((g) => Art.drawCar(g, x, y, 0, L, 'red', {}));
      const dark = (d2, i) => d2[i + 3] > 200 && d2[i] < 60 && d2[i + 1] < 60 && d2[i + 2] < 60;
      const all = maskStats(d, dark);
      const left = maskStats(d, (d2, i) => dark(d2, i) && ((i / 4) % off.width) / S < x);
      const right = maskStats(d, (d2, i) => dark(d2, i) && ((i / 4) % off.width) / S > x);
      out.info.car = { contactBelowTop: +((all.y1 - y) / L).toFixed(3), wheelL: +((left.cx - x) / L).toFixed(3), wheelR: +((right.cx - x) / L).toFixed(3) };
      if (Math.abs(all.y1 - y - 0.5 * L) > 1.5) fail('car wheels do not touch 0.5 L below the plate top: ' + JSON.stringify(out.info.car));
      // rotation is about (x, y): the plate-top point (x, y) does not move when rot changes. Check the
      // contact under rot: a car rotated about (x,y) by th puts its right wheel bottom at x+0.8L*cos - (-0.5L)*sin ...
      const th = 0.15;
      const dr = shot((g) => Art.drawCar(g, x, y, th, L, 'red', {}));
      const rr = maskStats(dr, (d2, i) => dark(d2, i) && ((i / 4) % off.width) / S > x + 0.4 * L);
      const ex = x + Math.cos(th) * 0.8 * L - Math.sin(th) * 0.3 * L, ey = y + Math.sin(th) * 0.8 * L + Math.cos(th) * 0.3 * L; // near right hub centre
      out.info.car.rotHubErr = +Math.hypot(rr.cx - ex, rr.cy - ey).toFixed(2);
      if (out.info.car.rotHubErr > 0.06 * L) fail('car does not rotate about (x,y): right hub off by ' + out.info.car.rotHubErr + ' px');
    }

    // ---------------------------------------------------------------- 6. hand grips a tile whose top-edge midpoint is (x,y)
    {
      const L = 100, x = 300, y = 300;
      const skin = (d2, i) => d2[i + 3] > 200 && d2[i] > 200 && d2[i + 1] > 140 && d2[i + 1] < 225 && d2[i + 2] > 110 && d2[i + 2] < 200 && d2[i] - d2[i + 2] > 30;
      const g0 = maskStats(shot((g) => Art.drawHand(g, x, y, L, 0, 0)), skin);
      const g1 = maskStats(shot((g) => Art.drawHand(g, x, y, L, 1, 0)), skin);
      out.info.hand = { grip: { tipsBelowTop: +((g0.y1 - y) / L).toFixed(3), cx: +((g0.cx - x) / L).toFixed(3), top: +((g0.y0 - y) / L).toFixed(3), w: +((g0.x1 - g0.x0) / L).toFixed(2) },
        open: { tipsBelowTop: +((g1.y1 - y) / L).toFixed(3), w: +((g1.x1 - g1.x0) / L).toFixed(2) } };
      if (!(g0.y1 > y + 0.08 * L && g0.y1 < y + 0.4 * L)) fail('gripping fingers do not reach over the tile top edge at y: ' + JSON.stringify(out.info.hand));
      if (Math.abs(g0.cx - x) > 0.08 * L) fail('hand not centred on x: ' + JSON.stringify(out.info.hand));
      if (!(g0.y0 < y - 0.4 * L)) fail('hand does not rise above the tile: ' + JSON.stringify(out.info.hand));
    }

    // ---------------------------------------------------------------- 7. cube net fold 1 == drawTile cube, under rotation and the caller's alpha
    {
      for (const [rot, ga] of [[0, 1], [0.3, 1], [-0.7, 0.5], [Math.PI / 2, 1]]) {
        const bg = (g) => { g.fillStyle = '#E7DCCB'; g.fillRect(0, 0, 600, 600); g.globalAlpha = ga; };
        // drawTile itself switches a still, rotated tile to a pre-rotated sprite after 4 frames and
        // may draw a neighbouring size rung while over its build budget: bracket the net between two
        // drawTile shots and compare with the nearer one
        const e = shot((g) => { bg(g); Art.drawCubeNet(g, 300, 300, 70, 0.999, rot); });
        const a = shot((g) => { bg(g); Art.drawTile(g, 'cube', 'orange', 300, 300, rot, 70); });
        const b = shot((g) => { bg(g); Art.drawCubeNet(g, 300, 300, 70, 1, rot); });
        const a2 = shot((g) => { bg(g); Art.drawTile(g, 'cube', 'orange', 300, 300, rot, 70); });
        let dExact = 0, dExact2 = 0, dNear = 0, n = 0;
        for (let i = 0; i < a.length; i += 4) {
          dExact += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
          dExact2 += Math.abs(a2[i] - b[i]) + Math.abs(a2[i + 1] - b[i + 1]) + Math.abs(a2[i + 2] - b[i + 2]);
          dNear += (Math.abs(a[i] - e[i]) + Math.abs(a[i + 1] - e[i + 1]) + Math.abs(a[i + 2] - e[i + 2])) / 3; n++;
        }
        dExact = Math.min(dExact, dExact2);
        out.info['cubeNet rot ' + rot.toFixed(2) + ' a ' + ga] = { fold1: dExact, fold0999mean: +(dNear / n).toFixed(3) };
        if (dExact !== 0) fail('drawCubeNet(fold 1, rot ' + rot + ', alpha ' + ga + ') differs from drawTile cube');
        if (dNear / n > 2) fail('drawCubeNet(fold 0.999, rot ' + rot + ') pops against the cube: ' + (dNear / n).toFixed(2));
      }
      // the cube body is the 2L x 2L front face centred at (cx, cy) (plus the thin oblique extrusion up-left)
      const m = maskStats(shot((g) => Art.drawTile(g, 'cube', 'orange', 300, 300, 0, 60)), solid);
      out.info.cubeBox = { right: +(m.x1 - 360).toFixed(1), bottom: +(m.y1 - 360).toFixed(1), left: +(240 - m.x0).toFixed(1), top: +(240 - m.y0).toFixed(1) };
      if (Math.abs(m.x1 - 360) > 1 || Math.abs(m.y1 - 360) > 1) fail('cube front face not 2L x 2L about its centre: ' + JSON.stringify(out.info.cubeBox));
    }

    // ---------------------------------------------------------------- 8. titleBuild: L units, y up, centroids
    {
      const B = Art.titleBuild, R3 = Math.sqrt(3);
      const verts = (t) => {
        // local offsets in y-UP coordinates; screen rot is clockwise-positive, i.e. -rot in y-up
        const loc = t.shape === 'tri' || t.shape === 'crown' ? [[0, 1 / R3], [0.5, -0.5 / R3], [-0.5, -0.5 / R3]] : [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
        const a = -t.rot, ca = Math.cos(a), sa = Math.sin(a);
        return loc.map(([u, v]) => [t.x + u * ca - v * sa, t.y + u * sa + v * ca]);
      };
      let minY = 1e9, maxY = -1e9, top = null, minX = 1e9, maxX = -1e9;
      for (const t of B.tiles) for (const [vx, vy] of verts(t)) {
        if (vy < minY) minY = vy; if (vy > maxY) { maxY = vy; top = t; }
        if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
      }
      minX = Math.min(minX, B.cube.x - 1); maxX = Math.max(maxX, B.cube.x + 1);
      const wall = B.tiles.filter((t) => Math.abs(t.rot + 18 * Math.PI / 180) < 0.02 && t.shape === 'sq');
      const inPoly = (p, poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); s += cr > 0 ? 1 : cr < 0 ? -1 : 0; } return Math.abs(s) === poly.length; };
      const ringsOnWall = B.rings.every((r) => wall.some((t) => inPoly([r.x, r.y], verts(t))));
      const cnt = {}; for (const t of B.tiles) cnt[t.shape + ':' + t.color] = (cnt[t.shape + ':' + t.color] || 0) + 1;
      out.info.titleBuild = { tiles: B.tiles.length, minY: +minY.toFixed(3), maxY: +maxY.toFixed(3), topPiece: top && top.shape + ':' + top.color,
        spanX: [+minX.toFixed(2), +maxX.toFixed(2)], cubeBottom: B.cube.y - 1, wall: wall.length,
        wallColors: [...new Set(wall.map((t) => t.color))].join('/'), ringsOnWall, domeTris: B.tiles.filter((t) => t.shape === 'tri').length,
        marble: B.tiles.filter((t) => t.shape === 'marble').length };
      if (minY < -0.02) fail('titleBuild: a tile pokes ' + (-minY).toFixed(3) + ' L below the rug');
      if (Math.abs(B.cube.y - 1) > 0.02) fail('titleBuild: the cube (centroid y ' + B.cube.y + ') does not stand on the rug');
      if (!top || top.shape !== 'crown' && !(top.shape === 'tri' && top.color === 'orange')) fail('titleBuild: the orange triangle is not the highest point');
      if (!ringsOnWall) fail('titleBuild: rings are not on wall tiles');
      if (Math.abs((minX + maxX) / 2) > 0.8) fail('titleBuild: origin not at the base centre, span ' + minX.toFixed(2) + '..' + maxX.toFixed(2));
      // how deep the sloped wall cuts into the triangle dome (2D overlap of tile polygons), by sampling
      const dome = B.tiles.filter((t) => t.shape === 'tri');
      let ov = 0, step = 0.02;
      for (let x = minX; x < maxX; x += step) for (let y = 0; y < maxY; y += step) {
        const p = [x, y];
        if (wall.some((t) => inPoly(p, verts(t))) && dome.some((t) => inPoly(p, verts(t)))) ov += step * step;
      }
      out.info.titleBuild.wallDomeOverlapL2 = +ov.toFixed(2);
    }

    // ---------------------------------------------------------------- 9. crash frame: 60 debris all spinning + 15 L tower, 'both' layer per tile like the game
    {
      Art.resize(W, H, dpr, G);
      const L = 30, raf = () => new Promise((r) => requestAnimationFrame(r));
      const tw = [];
      for (let r = 0; r < 15; r++) for (let k = 0; k < 2; k++) tw.push({ s: (r * 2 + k) % 9 === 4 ? 'marble' : 'sq', c: COLS[(r * 2 + k) % 7], x: W / 2 + (k - 0.5) * L, y: G - 0.5 * L - (r + 0.5) * L });
      const deb = [];
      let a = 9;
      const R = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
      for (let i = 0; i < 60; i++) deb.push({ s: ['sq', 'tri', 'sq', 'marble'][(R() * 4) | 0], c: COLS[(R() * 7) | 0], x: R() * W, y: G - R() * 3 * L, r0: R() * 6, w: 4 + R() * 8 });
      const O = { layer: 'both', alpha: 1, variant: 0, flash: 0, tint: 0, ghost: null, night: false, glint: 0 };
      const LT = tw.map((t) => ({ shape: t.s, color: t.c, cx: t.x, cy: t.y, rot: 0 }));
      const frame = (t) => {
        ctx.setTransform(dpr, 0, 0, dpr, Math.sin(t * 50) * 6, Math.cos(t * 43) * 6);
        Art.drawRoom(ctx, W, H, G, 0, 0); Art.drawRug(ctx, W, H, G, 0); Art.drawLight(ctx, LT, L, G, 0, 1);
        Art.drawCar(ctx, W / 2, G - 0.5 * L, 0, L, 'red', null);
        for (const p of tw) { O.variant = 0; Art.drawTile(ctx, p.s, p.c, p.x, p.y, 0, L, O); }
        for (const d of deb) { Art.drawShadowBlob(ctx, d.x, G + 2, 0.6 * L, 0.12 * L, 0.3); Art.drawTile(ctx, d.s, d.c, d.x, d.y, d.r0 + d.w * t, L, O); }
        Art.drawHand(ctx, W / 2, 90, L, 0, t);
      };
      for (let i = 0; i < 30; i++) { frame(i / 60); await raf(); }
      const ts = []; let flush = 0;
      for (let i = 0; i < 90; i++) { await raf(); const t0 = performance.now(); frame(1 + i / 60); const t1 = performance.now(); ts.push(t1 - t0); ctx.getImageData(0, 0, 1, 1); flush += performance.now() - t1; }
      ts.sort((p, q) => p - q);
      const avg = ts.reduce((p, q) => p + q, 0) / ts.length;
      out.info.crashFrame = { avgMs: +avg.toFixed(2), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(2), rasterMs: +(flush / 90).toFixed(1) };
      if (avg > 4) fail('crash frame (60 spinning debris) Art JS time ' + avg.toFixed(2) + ' ms > 4 ms');
    }
    return out;
  });
  await bctx.close();
  return { res, errors };
}

(async () => {
  const browser = await pw.chromium.launch();
  let bad = 0;
  try {
    for (const vp of [{ w: 390, h: 844, dpr: 2 }, { w: 844, h: 390, dpr: 2 }]) {
      const { res, errors } = await run(browser, vp);
      const tag = vp.w + 'x' + vp.h + '@' + vp.dpr;
      for (const k in res.info) console.log(tag + ' ' + k + ': ' + JSON.stringify(res.info[k]));
      for (const f of res.fails) console.log('  FAIL ' + f);
      for (const e of errors) console.log('  ERROR ' + e);
      bad += res.fails.length + errors.length;
    }
  } finally {
    await browser.close();
  }
  if (bad) { console.log('art-verify: ' + bad + ' problem(s)'); process.exit(1); }
  console.log('art-verify OK');
})().catch((e) => { console.error(e); process.exit(1); });
