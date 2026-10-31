// SQUARE OFF — Render A: ground atlas bake (lawns, paths, plaza, roads, crosswalks, AO), curbs,
// outer city ground, and the ground height function (fountain basin).
(function (SQ) {
  'use strict';
  var env = SQ.env = SQ.env || {};
  var U = env.util = env.util || {};
  var G = env.ground = env.ground || {};

  var EXT = G.EXTENT = { x0: -260, x1: 260, z0: -180, z1: 180 };
  // Fountain basin profile (radius → height). Rim top 0.45 m; basin floor −0.6 m; water at −0.18 m.
  var F = G.FOUNTAIN = { x: 0.5, z: 0.2, floorR: 9.3, step1R: 10.0, innerR: 10.6, outerR: 11.6, floorY: -0.6, step1Y: -0.3, step2Y: 0.0, rimY: 0.45, waterY: -0.18 };

  G.heightAt = function (x, z) {
    var r = Math.hypot(x - F.x, z - F.z);
    if (r >= F.outerR + 0.25) return 0;
    if (r > F.outerR) return F.rimY * (1 - (r - F.outerR) / 0.25);
    if (r > F.innerR) return F.rimY;
    if (r > F.step1R) return F.step2Y;
    if (r > F.floorR) return F.step1Y;
    return F.floorY;
  };

  // ------------------------------------------------------------ road model
  G.roadWidth = function (r) {
    if (r.name === 'Washington Mews') return 7;
    if (r.kind === 'secondary') return r.lanes >= 2 ? 14 : 11.5;
    if (r.kind === 'primary') return 16;
    return r.lanes >= 2 ? 11 : 9.5;
  };
  function roadArms() {
    // Intersections: polyline vertices shared by ≥3 arms.
    var nodes = {};
    (GEO.roads || []).forEach(function (r, ri) {
      for (var i = 0; i < r.pts.length; i++) {
        var p = r.pts[i], k = Math.round(p[0]) + ',' + Math.round(p[1]);
        var n = nodes[k] || (nodes[k] = { x: p[0], z: p[1], arms: [] });
        [i - 1, i + 1].forEach(function (j) {
          if (j < 0 || j >= r.pts.length) return;
          var q = r.pts[j], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
          if (L < 0.5) return;
          // walk further along the polyline if the neighbour is very close (short OSM segments)
          var jj = j, step = j - i;
          while (L < 12 && jj + step >= 0 && jj + step < r.pts.length) { jj += step; q = r.pts[jj]; dx = q[0] - p[0]; dz = q[1] - p[1]; L = Math.hypot(dx, dz); }
          var a = Math.atan2(dz, dx);
          if (n.arms.some(function (m) { return Math.abs(Math.atan2(Math.sin(m.a - a), Math.cos(m.a - a))) < 0.35; })) return;
          n.arms.push({ a: a, dx: dx / L, dz: dz / L, len: L, road: r, w: G.roadWidth(r) });
        });
      }
    });
    return Object.keys(nodes).map(function (k) { return nodes[k]; }).filter(function (n) { return n.arms.length >= 3; });
  }
  G.intersections = function () { return G._ints || (G._ints = roadArms()); };

  // ------------------------------------------------------------ painting helpers
  function polyPath(ctx, pts) { ctx.beginPath(); for (var i = 0; i < pts.length; i++) ctx[i ? 'lineTo' : 'moveTo'](pts[i][0], pts[i][1]); ctx.closePath(); }
  function linePath(ctx, pts) { ctx.beginPath(); for (var i = 0; i < pts.length; i++) ctx[i ? 'lineTo' : 'moveTo'](pts[i][0], pts[i][1]); }
  function pattern(ctx, canvas, mpp) {
    var p = ctx.createPattern(canvas, 'repeat');
    if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(mpp, mpp));
    return p;
  }
  function overlay(ctx, pts, pat, op, alpha) {
    ctx.save();
    var b = [EXT.x0, EXT.x1, EXT.z0, EXT.z1];
    if (pts) { polyPath(ctx, pts); ctx.clip(); b = U.polyBBox(pts); }
    ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha; ctx.fillStyle = pat;
    ctx.fillRect(b[0] - 1, b[2] - 1, b[1] - b[0] + 2, b[3] - b[2] + 2);
    ctx.restore();
  }
  function inExt(x, z, m) { m = m || 0; return x > EXT.x0 - m && x < EXT.x1 + m && z > EXT.z0 - m && z < EXT.z1 + m; }

  // ------------------------------------------------------------ atlas bake
  G.bake = function (quality) {
    var hi = quality === 'high';
    var W = hi ? 4096 : 2048, H = hi ? 2816 : 1408;
    var c = U.canvas(W, H), ctx = c.getContext('2d');
    var MW = W / 4, MH = H / 4, mc = U.canvas(MW, MH), m = mc.getContext('2d');
    var kx = W / (EXT.x1 - EXT.x0), kz = H / (EXT.z1 - EXT.z0);
    ctx.setTransform(kx, 0, 0, kz, -EXT.x0 * kx, -EXT.z0 * kz);
    m.setTransform(kx / 4, 0, 0, kz / 4, -EXT.x0 * kx / 4, -EXT.z0 * kz / 4);
    var TEX = SQ.tex, rnd = U.rng(2024), prof = G.profile = {}, pt0 = performance.now();
    function lap(k) { if (G.profFlush) ctx.getImageData(0, 0, 1, 1); var n = performance.now(); prof[k] = Math.round(n - pt0); pt0 = n; }
    var mpp = 1 / kx; // metres per atlas pixel
    var nzBig = TEX.noise(256, 40, 3, 0, 255, 4), nzFine = TEX.noise(128, 8, 4, 0, 255, 2);
    var patBig = pattern(ctx, nzBig, 0.12), patMid = pattern(ctx, nzBig, 0.035), patFine = pattern(ctx, nzFine, Math.max(mpp, 0.05));
    var grit = TEX.speckle(256, 900, 9, ['rgba(40,38,36,0.35)', 'rgba(255,255,255,0.18)', 'rgba(20,20,20,0.25)'], 0.6, 1.6);
    var patGrit = pattern(ctx, grit, 0.04);
    var gum = TEX.speckle(256, 160, 10, ['rgba(30,30,30,0.35)', 'rgba(60,56,50,0.25)'], 1, 2.2);
    var patGum = pattern(ctx, gum, 0.05);
    var park = (GEO.areas.filter(function (a) { return a.name === 'Washington Square Park'; })[0] || {}).pts;

    // mask helper: R paver, G grass, B asphalt/concrete
    function mfill(pts, col) { m.fillStyle = col; polyPath(m, pts); m.fill(); }
    function mstroke(pts, col, w) { m.strokeStyle = col; m.lineWidth = w; m.lineJoin = m.lineCap = 'round'; linePath(m, pts); m.stroke(); }

    lap('setup');
    // 1. base sidewalk concrete + joint grid
    // one pre-composited concrete tile (6 m, 4 joints) filled once: cheap on phones
    (function () {
      var T = 256, tc = U.canvas(T, T), t = tc.getContext('2d');
      t.fillStyle = '#b4afa6'; t.fillRect(0, 0, T, T);
      t.globalAlpha = 0.18; t.drawImage(nzFine, 0, 0, T, T); t.globalAlpha = 1;
      t.drawImage(gum, 0, 0, T, T);
      t.strokeStyle = 'rgba(80,76,70,0.42)'; t.lineWidth = 2; t.beginPath();
      for (var k = 0; k <= 4; k++) { t.moveTo(k * T / 4, 0); t.lineTo(k * T / 4, T); t.moveTo(0, k * T / 4); t.lineTo(T, k * T / 4); }
      t.stroke();
      ctx.fillStyle = pattern(ctx, tc, 6 / T); ctx.fillRect(EXT.x0, EXT.z0, EXT.x1 - EXT.x0, EXT.z1 - EXT.z0);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.25;
      ctx.drawImage(nzBig, EXT.x0, EXT.z0, EXT.x1 - EXT.x0, EXT.z1 - EXT.z0); ctx.restore();
    })();
    m.fillStyle = 'rgb(0,0,255)'; m.fillRect(EXT.x0, EXT.z0, EXT.x1 - EXT.x0, EXT.z1 - EXT.z0);

    // 2. other area kinds outside the park (courts, plazas)
    GEO.paths.forEach(function (p) {
      if (!p.area) return;
      ctx.fillStyle = p.surface === 'asphalt' ? '#6a6864' : '#bdb6aa'; polyPath(ctx, p.pts); ctx.fill();
    });

    lap('other');
    // 3. park interior: hexagonal asphalt pavers
    if (park) {
      ctx.fillStyle = '#7a756e'; polyPath(ctx, park); ctx.fill();
      overlay(ctx, park, patBig, 'multiply', 0.25);
      overlay(ctx, park, patMid, 'soft-light', 0.4);
      overlay(ctx, park, patGum, 'source-over', 0.5);
      mfill(park, 'rgb(255,0,0)');
    }
    // 4. footpaths: bluestone / pavers stroked at their width, lighter edge stroke
    GEO.paths.forEach(function (p) {
      if (p.area || p.pts.length < 2) return;
      var c0 = U.polyCentroid(p.pts), inPark = park && U.pointInPoly(c0[0], c0[1], park);
      var w = p.kind === 'steps' ? 3 : inPark ? 4.2 : 2.6;
      if (!inPark && p.kind === 'footway' && (p.surface === 'concrete' || !p.surface)) return; // sidewalks are the base
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(160,154,144,0.55)'; ctx.lineWidth = w + 0.6; linePath(ctx, p.pts); ctx.stroke();
      ctx.strokeStyle = p.surface === 'asphalt' ? '#66635f' : inPark ? '#827c74' : '#a29b90'; ctx.lineWidth = w; linePath(ctx, p.pts); ctx.stroke();
      mstroke(p.pts, 'rgb(255,0,0)', w);
    });
    lap('parkpaths');
    // 5. fountain plaza: granite ring with concentric seams out to r 30
    (function () {
      ctx.save();
      if (park) { polyPath(ctx, park); ctx.clip(); }
      var g = ctx.createRadialGradient(F.x, F.z, F.outerR, F.x, F.z, 31);
      g.addColorStop(0, '#cbc3b8'); g.addColorStop(0.85, '#bdb4a8'); g.addColorStop(1, 'rgba(170,162,152,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(F.x, F.z, 31, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(100,92,84,0.3)'; ctx.lineWidth = Math.max(mpp, 0.04);
      for (var r = F.outerR + 0.8; r < 30; r += 1.2) { ctx.beginPath(); ctx.arc(F.x, F.z, r, 0, Math.PI * 2); ctx.stroke(); }
      for (var r2 = F.outerR + 0.8; r2 < 29; r2 += 1.2) {
        var n = Math.round(2 * Math.PI * r2 / 1.4), off = rnd();
        ctx.beginPath();
        for (var i = 0; i < n; i++) { var a = (i + off) / n * Math.PI * 2; ctx.moveTo(F.x + Math.cos(a) * r2, F.z + Math.sin(a) * r2); ctx.lineTo(F.x + Math.cos(a) * (r2 + 1.2), F.z + Math.sin(a) * (r2 + 1.2)); }
        ctx.stroke();
      }
      // darker granite band (bench ledge foot) and drains
      ctx.strokeStyle = 'rgba(70,64,60,0.5)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(F.x, F.z, F.outerR + 0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      m.fillStyle = 'rgb(70,0,90)'; m.beginPath(); m.arc(F.x, F.z, 30, 0, Math.PI * 2); m.fill();
    })();

    lap('plaza');
    // 6. areas
    var areas = GEO.areas.slice().sort(function (a, b) { return Math.abs(U.polyArea(b.pts)) - Math.abs(U.polyArea(a.pts)); });
    var lawns = [];
    areas.forEach(function (a) {
      var pts = a.pts, A = Math.abs(U.polyArea(pts)), bb = U.polyBBox(pts);
      if (!inExt((bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2, 40)) return;
      var k = a.kind;
      if (k === 'grass' || (k === 'garden' && A > 600 && a.name == null)) { lawns.push(a); paintLawn(pts, A, bb); return; }
      if (k === 'garden') {
        if (A < 8) { // tree pit
          ctx.fillStyle = '#4a3a2c'; polyPath(ctx, pts); ctx.fill();
          ctx.strokeStyle = 'rgba(40,36,32,0.8)'; ctx.lineWidth = 0.15; ctx.stroke();
          overlay(ctx, pts, patGrit, 'source-over', 0.6);
          return;
        }
        // planting bed: mulch with shrubs and flowers
        ctx.fillStyle = '#4c3b2b'; polyPath(ctx, pts); ctx.fill();
        overlay(ctx, pts, patMid, 'multiply', 0.35);
        ctx.save(); polyPath(ctx, pts); ctx.clip();
        var n = Math.min(400, A * 0.9);
        for (var i = 0; i < n; i++) {
          var x = bb[0] + rnd() * (bb[1] - bb[0]), z = bb[2] + rnd() * (bb[3] - bb[2]), rr = 0.3 + rnd() * 0.9;
          var gcol = ['#3f6a2c', '#4f7a34', '#355e2a', '#5d8540'][(rnd() * 4) | 0];
          ctx.fillStyle = gcol; ctx.beginPath(); ctx.arc(x, z, rr, 0, 7); ctx.fill();
          if (rnd() < 0.25) { ctx.fillStyle = ['#e8d34a', '#d9534f', '#f2f0e8', '#b56bd1', '#f08a3c'][(rnd() * 5) | 0]; ctx.beginPath(); ctx.arc(x + 0.1, z - 0.1, rr * 0.35, 0, 7); ctx.fill(); }
        }
        ctx.restore();
        ctx.strokeStyle = '#9d968a'; ctx.lineWidth = 0.2; polyPath(ctx, pts); ctx.stroke();
        mfill(pts, 'rgb(0,140,0)');
        return;
      }
      if (k === 'flowerbed') {
        ctx.fillStyle = '#4a3828'; polyPath(ctx, pts); ctx.fill();
        ctx.save(); polyPath(ctx, pts); ctx.clip();
        for (var j = 0; j < A * 6; j++) {
          var fx = bb[0] + rnd() * (bb[1] - bb[0]), fz = bb[2] + rnd() * (bb[3] - bb[2]);
          ctx.fillStyle = rnd() < 0.5 ? '#3e6b2e' : ['#e04848', '#f2c53d', '#f6f2ea', '#d46bb0', '#7f5fd6'][(rnd() * 5) | 0];
          ctx.beginPath(); ctx.arc(fx, fz, 0.12 + rnd() * 0.18, 0, 7); ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = '#8f887e'; ctx.lineWidth = 0.3; polyPath(ctx, pts); ctx.stroke();
        mfill(pts, 'rgb(0,90,0)');
        return;
      }
      if (k === 'shrubbery') { ctx.fillStyle = '#3c5e2c'; polyPath(ctx, pts); ctx.fill(); overlay(ctx, pts, patMid, 'multiply', 0.5); mfill(pts, 'rgb(0,200,0)'); return; }
      if (k === 'dog_park') {
        var big = A > 600;
        ctx.fillStyle = big ? '#a69580' : '#9b8a74'; polyPath(ctx, pts); ctx.fill();
        overlay(ctx, pts, patMid, 'multiply', 0.45);
        overlay(ctx, pts, patGrit, 'source-over', 0.9);
        // worn paths where dogs run laps, a few dark wet patches
        ctx.save(); polyPath(ctx, pts); ctx.clip();
        ctx.strokeStyle = 'rgba(120,104,84,0.35)'; ctx.lineWidth = 2.2;
        var cx = (bb[0] + bb[1]) / 2, cz = (bb[2] + bb[3]) / 2;
        ctx.beginPath(); ctx.ellipse(cx, cz, (bb[1] - bb[0]) * 0.36, (bb[3] - bb[2]) * 0.3, 0, 0, 7); ctx.stroke();
        for (var q = 0; q < 6; q++) { ctx.fillStyle = 'rgba(90,76,60,0.25)'; ctx.beginPath(); ctx.ellipse(bb[0] + rnd() * (bb[1] - bb[0]), bb[2] + rnd() * (bb[3] - bb[2]), 1 + rnd() * 2, 0.6 + rnd(), rnd() * 3, 0, 7); ctx.fill(); }
        ctx.restore();
        mfill(pts, 'rgb(0,0,200)');
        return;
      }
      if (k === 'playground') {
        var s = a.surface;
        ctx.fillStyle = s === 'artificial_turf' ? '#4f9a4a' : s === 'rubber' ? '#3f6f8f' : '#5d5b58'; polyPath(ctx, pts); ctx.fill();
        overlay(ctx, pts, patMid, 'multiply', 0.2);
        if (s === 'artificial_turf') { // Play Hills: turf mounds, shaded
          ctx.save(); polyPath(ctx, pts); ctx.clip();
          for (var h = 0; h < 5; h++) { var hx = bb[0] + (0.2 + rnd() * 0.6) * (bb[1] - bb[0]), hz = bb[2] + (0.2 + rnd() * 0.6) * (bb[3] - bb[2]); var gr = ctx.createRadialGradient(hx - 1, hz - 1, 0, hx, hz, 5); gr.addColorStop(0, 'rgba(160,220,120,0.35)'); gr.addColorStop(1, 'rgba(0,40,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hz, 5, 0, 7); ctx.fill(); }
          ctx.restore();
          mfill(pts, 'rgb(0,160,0)');
        } else mfill(pts, 'rgb(0,0,120)');
        // safety surfacing pads under equipment
        var layout = env.layout && env.layout.playground ? env.layout.playground() : [];
        ctx.save(); polyPath(ctx, pts); ctx.clip();
        layout.forEach(function (e) {
          ctx.fillStyle = e.pad || '#3d7a6a'; ctx.beginPath(); ctx.ellipse(e.x, e.z, e.pr || 3, (e.pr || 3) * 0.8, e.ry || 0, 0, 7); ctx.fill();
        });
        ctx.restore();
        ctx.strokeStyle = '#8a857c'; ctx.lineWidth = 0.3; polyPath(ctx, pts); ctx.stroke();
        return;
      }
      if (k === 'sand') { ctx.fillStyle = '#d8c39a'; polyPath(ctx, pts); ctx.fill(); overlay(ctx, pts, patGrit, 'source-over', 0.5); ctx.strokeStyle = '#a49c90'; ctx.lineWidth = 0.4; ctx.stroke(); mfill(pts, 'rgb(0,0,60)'); return; }
      if (k === 'pitch') {
        ctx.fillStyle = '#3d6d55'; polyPath(ctx, pts); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.1;
        ctx.strokeRect(bb[0] + 1, bb[2] + 1, bb[1] - bb[0] - 2, bb[3] - bb[2] - 2);
        ctx.beginPath(); ctx.moveTo(bb[0] + 1, (bb[2] + bb[3]) / 2); ctx.lineTo(bb[1] - 1, (bb[2] + bb[3]) / 2); ctx.stroke();
        return;
      }
      if (k === 'park' && a.name !== 'Washington Square Park') { ctx.fillStyle = '#6a6c66'; polyPath(ctx, pts); ctx.fill(); return; }
      if (k === 'water') { ctx.fillStyle = '#56646a'; polyPath(ctx, pts); ctx.fill(); return; }
    });

    function paintLawn(pts, A, bb) {
      ctx.fillStyle = '#5c8a38'; polyPath(ctx, pts); ctx.fill();
      overlay(ctx, pts, patBig, 'multiply', 0.38);   // three-tone value noise
      overlay(ctx, pts, patMid, 'overlay', 0.28);
      ctx.save(); polyPath(ctx, pts); ctx.clip();
      // mow stripes along the long axis
      var horiz = (bb[1] - bb[0]) > (bb[3] - bb[2]);
      ctx.fillStyle = 'rgba(220,255,170,0.07)';
      if (horiz) for (var z = bb[2]; z < bb[3]; z += 5) ctx.fillRect(bb[0], z, bb[1] - bb[0], 2.5);
      else for (var x = bb[0]; x < bb[1]; x += 5) ctx.fillRect(x, bb[2], 2.5, bb[3] - bb[2]);
      // worn edges (people sit on lawn edges) — inner stroke, soft
      ctx.lineJoin = 'round';
      for (var e = 0; e < 3; e++) { ctx.strokeStyle = 'rgba(150,128,86,' + (0.14 - e * 0.04) + ')'; ctx.lineWidth = 1 + e * 1.6; polyPath(ctx, pts); ctx.stroke(); }
      // desire lines and sunbathing-worn patches on big lawns
      if (A > 700) {
        var nl = 1 + ((rnd() * 2) | 0);
        for (var l = 0; l < nl; l++) {
          ctx.strokeStyle = 'rgba(150,126,84,0.22)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
          ctx.beginPath(); var x0 = bb[0] + rnd() * (bb[1] - bb[0]), z0 = bb[2], x1 = bb[0] + rnd() * (bb[1] - bb[0]), z1 = bb[3];
          if (horiz) { x0 = bb[0]; z0 = bb[2] + rnd() * (bb[3] - bb[2]); x1 = bb[1]; z1 = bb[2] + rnd() * (bb[3] - bb[2]); }
          ctx.moveTo(x0, z0); ctx.quadraticCurveTo((x0 + x1) / 2 + (rnd() - 0.5) * 10, (z0 + z1) / 2 + (rnd() - 0.5) * 10, x1, z1); ctx.stroke();
        }
        for (var p = 0; p < A / 400; p++) {
          var px = bb[0] + rnd() * (bb[1] - bb[0]), pz = bb[2] + rnd() * (bb[3] - bb[2]);
          var g = ctx.createRadialGradient(px, pz, 0, px, pz, 3 + rnd() * 3); g.addColorStop(0, 'rgba(170,150,96,0.25)'); g.addColorStop(1, 'rgba(170,150,96,0)');
          ctx.fillStyle = g; ctx.fillRect(px - 6, pz - 6, 12, 12);
        }
      }
      // clover / weeds speckles
      for (var s = 0; s < A * 0.25; s++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(40,80,30,0.35)' : 'rgba(150,190,90,0.3)'; ctx.fillRect(bb[0] + rnd() * (bb[1] - bb[0]), bb[2] + rnd() * (bb[3] - bb[2]), 0.3, 0.3); }
      ctx.restore();
      // granite edging
      ctx.strokeStyle = 'rgba(176,170,160,0.9)'; ctx.lineWidth = 0.22; polyPath(ctx, pts); ctx.stroke();
      mfill(pts, 'rgb(0,255,0)');
    }

    lap('areas');
    // 7. roads: asphalt, then markings and crosswalks
    var roads = GEO.roads || [];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    roads.forEach(function (r) { ctx.strokeStyle = '#4b4b4e'; ctx.lineWidth = G.roadWidth(r); linePath(ctx, r.pts); ctx.stroke(); mstroke(r.pts, 'rgb(0,0,255)', G.roadWidth(r)); });
    // asphalt grain and patching (clip to road strokes via a temporary canvas mask)
    (function () {
      var rc = U.canvas(W, H), r2 = rc.getContext('2d');
      r2.setTransform(kx, 0, 0, kz, -EXT.x0 * kx, -EXT.z0 * kz);
      r2.lineJoin = r2.lineCap = 'round'; r2.strokeStyle = '#fff';
      roads.forEach(function (r) { r2.lineWidth = G.roadWidth(r); linePath(r2, r.pts); r2.stroke(); });
      r2.globalCompositeOperation = 'source-in';
      r2.fillStyle = pattern(r2, nzBig, 0.08); r2.fillRect(EXT.x0, EXT.z0, EXT.x1 - EXT.x0, EXT.z1 - EXT.z0);
      r2.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.drawImage(rc, 0, 0); ctx.restore();
      // patches, manholes, oil stains (drawn on top, roads only)
      roads.forEach(function (r) {
        var L = U.polyLen(r.pts), w = G.roadWidth(r);
        for (var d = rnd() * 20; d < L; d += 14 + rnd() * 26) {
          var p = along(r.pts, d), side = (rnd() - 0.5) * w * 0.6;
          var x = p.x - p.dz * side, z = p.z + p.dx * side;
          if (!inExt(x, z)) continue;
          var t = rnd();
          if (t < 0.3) { ctx.fillStyle = 'rgba(30,30,32,0.5)'; ctx.beginPath(); ctx.arc(x, z, 0.38, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(110,110,110,0.5)'; ctx.lineWidth = 0.05; ctx.stroke(); }
          else if (t < 0.65) { ctx.fillStyle = 'rgba(70,70,74,0.45)'; ctx.save(); ctx.translate(x, z); ctx.rotate(Math.atan2(p.dz, p.dx)); ctx.fillRect(-1 - rnd() * 2, -0.6 - rnd(), 2 + rnd() * 4, 1.2 + rnd() * 2); ctx.restore(); }
          else { ctx.fillStyle = 'rgba(20,20,22,0.25)'; ctx.beginPath(); ctx.ellipse(x, z, 0.5 + rnd(), 0.4 + rnd() * 0.6, rnd() * 3, 0, 7); ctx.fill(); }
        }
      });
    })();
    // Washington Mews: Belgian block
    roads.forEach(function (r) {
      if (r.name !== 'Washington Mews') return;
      ctx.save(); ctx.strokeStyle = '#6b6058'; ctx.lineWidth = 7; linePath(ctx, r.pts); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,36,32,0.6)'; ctx.lineWidth = 7; ctx.setLineDash([0.12, 0.16]); linePath(ctx, r.pts); ctx.stroke(); ctx.restore();
    });
    // centre lines and lane lines
    roads.forEach(function (r) {
      if (r.name === 'Washington Mews') return;
      ctx.lineCap = 'butt';
      if (!r.oneway) {
        ctx.strokeStyle = '#d8b63a'; ctx.lineWidth = 0.12;
        offsetStroke(r.pts, 0.12); offsetStroke(r.pts, -0.12);
      } else if (r.lanes >= 2) {
        ctx.strokeStyle = 'rgba(235,235,230,0.85)'; ctx.lineWidth = 0.12; ctx.setLineDash([3, 9]);
        offsetStroke(r.pts, 0); ctx.setLineDash([]);
      }
      // parking lane edges (faint)
      ctx.strokeStyle = 'rgba(230,230,225,0.25)'; ctx.lineWidth = 0.1;
      var hw = G.roadWidth(r) / 2 - 2.4; offsetStroke(r.pts, hw); offsetStroke(r.pts, -hw);
    });
    function offsetStroke(pts, off) {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        ctx[i ? 'lineTo' : 'moveTo'](pts[i][0] - dz / L * off, pts[i][1] + dx / L * off);
      }
      ctx.stroke();
    }
    // crosswalks ("continental" bars) and stop bars at every intersection
    G.intersections().forEach(function (n) {
      if (!inExt(n.x, n.z, -2)) return;
      var maxW = 0; n.arms.forEach(function (a) { maxW = Math.max(maxW, a.w); });
      n.arms.forEach(function (a) {
        if (a.len < 10) return;
        var d = maxW / 2 + 2.2, cx = n.x + a.dx * d, cz = n.z + a.dz * d, w = a.w, ang = Math.atan2(a.dz, a.dx);
        ctx.save(); ctx.translate(cx, cz); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(240,240,236,0.92)';
        for (var y = -w / 2 + 0.5; y < w / 2 - 0.4; y += 1.2) ctx.fillRect(-1.6, y, 3.2, 0.6);
        ctx.fillStyle = 'rgba(240,240,236,0.85)'; ctx.fillRect(2.4, -w / 2 + 0.3, 0.4, w - 0.6); // stop bar
        ctx.restore();
      });
    });

    lap('roads');
    // 8. building ground halo (AO) and dark footprints
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 2.2 * kx;
    ctx.fillStyle = 'rgba(30,28,26,0.9)';
    GEO.buildings.forEach(function (b) { var c0 = U.polyCentroid(b.pts); if (!inExt(c0[0], c0[1], 30)) return; polyPath(ctx, b.pts); ctx.fill(); });
    ctx.restore();
    lap('halo');
    // 9. tree AO and fallen-leaf scatter
    GEO.trees.forEach(function (t) {
      if (!inExt(t[0], t[1], 5)) return;
      var r = 3.5 + U.hash2(t[0], t[1]) * 2.5;
      var g = ctx.createRadialGradient(t[0], t[1], 0, t[0], t[1], r);
      g.addColorStop(0, 'rgba(10,20,5,0.34)'); g.addColorStop(0.5, 'rgba(10,20,5,0.16)'); g.addColorStop(1, 'rgba(10,20,5,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t[0], t[1], r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(45,35,25,0.55)'; ctx.beginPath(); ctx.arc(t[0], t[1], 0.6, 0, 7); ctx.fill();
      for (var i = 0; i < 10; i++) { var a = rnd() * 7, rr = rnd() * r; ctx.fillStyle = rnd() < 0.5 ? 'rgba(150,120,60,0.35)' : 'rgba(110,120,50,0.3)'; ctx.fillRect(t[0] + Math.cos(a) * rr, t[1] + Math.sin(a) * rr, 0.18, 0.12); }
    });
    lap('trees');
    // 10. bench and lamp contact shadows
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    (env.layout && env.layout.benches ? env.layout.benches() : []).forEach(function (b) {
      ctx.save(); ctx.translate(b.x, b.z); ctx.rotate(-b.ry); ctx.fillRect(-1.0, -0.45, 2.0, 0.9); ctx.restore();
    });
    GEO.lamps.forEach(function (l) { ctx.beginPath(); ctx.arc(l[0], l[1], 0.35, 0, 7); ctx.fill(); });

    lap('benches');
    return { canvas: c, mask: mc, W: W, H: H };
  };

  function along(pts, d) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= L || i === pts.length - 1) { var t = L ? Math.min(1, d / L) : 0; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / (L || 1), dz: (b[1] - a[1]) / (L || 1) }; }
      d -= L;
    }
    return { x: pts[0][0], z: pts[0][1], dx: 1, dz: 0 };
  }
  G.along = along;

  // ------------------------------------------------------------ curbs (marching squares on the road mask)
  G.buildCurbs = function () {
    var res = 2, W = (EXT.x1 - EXT.x0) * res, H = (EXT.z1 - EXT.z0) * res;
    var c = U.canvas(W, H), ctx = U.ctxR(c);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(res, 0, 0, res, -EXT.x0 * res, -EXT.z0 * res);
    ctx.strokeStyle = '#fff'; ctx.lineJoin = ctx.lineCap = 'round';
    (GEO.roads || []).forEach(function (r) {
      if (r.name === 'Washington Mews') return; // a curbless private mews
      ctx.lineWidth = G.roadWidth(r); linePath(ctx, r.pts); ctx.stroke();
    });
    var d = ctx.getImageData(0, 0, W, H).data, v = new Float32Array(W * H);
    for (var i = 0; i < W * H; i++) v[i] = d[i * 4] / 255;
    // marching squares; crossing points are identified by grid-edge id (h-edge: 2k, v-edge: 2k+1),
    // segments are oriented consistently (road on the right), so chaining is a successor lookup.
    var succ = new Int32Array(W * H * 2).fill(-1), starts = [];
    function hE(x, y) { return (y * W + x) * 2; }
    function vE(x, y) { return (y * W + x) * 2 + 1; }
    function seg(a, b) { if (succ[a] === -1) { succ[a] = b; starts.push(a); } }
    for (var y = 0; y < H - 1; y++) for (var x = 0; x < W - 1; x++) {
      var a = v[y * W + x] > 0.5, b = v[y * W + x + 1] > 0.5, cc = v[(y + 1) * W + x + 1] > 0.5, dd = v[(y + 1) * W + x] > 0.5;
      var idx = (a ? 8 : 0) | (b ? 4 : 0) | (cc ? 2 : 0) | (dd ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      var T = hE(x, y), Bm = hE(x, y + 1), L = vE(x, y), R = vE(x + 1, y);
      switch (idx) {
        case 1: seg(L, Bm); break; case 2: seg(Bm, R); break; case 3: seg(L, R); break; case 4: seg(R, T); break;
        case 5: seg(L, T); seg(R, Bm); break; case 6: seg(Bm, T); break; case 7: seg(L, T); break; case 8: seg(T, L); break;
        case 9: seg(T, Bm); break; case 10: seg(T, R); seg(Bm, L); break; case 11: seg(T, R); break; case 12: seg(R, L); break;
        case 13: seg(R, Bm); break; case 14: seg(Bm, L); break;
      }
    }
    function pt(e) {
      var k = e >> 1, x = k % W, y = (k / W) | 0, f;
      if ((e & 1) === 0) { f = (0.5 - v[y * W + x]) / ((v[y * W + x + 1] - v[y * W + x]) || 1e-6); return [EXT.x0 + (x + f + 0.5) / res, EXT.z0 + (y + 0.5) / res]; }
      f = (0.5 - v[y * W + x]) / ((v[(y + 1) * W + x] - v[y * W + x]) || 1e-6); return [EXT.x0 + (x + 0.5) / res, EXT.z0 + (y + f + 0.5) / res];
    }
    var used = new Uint8Array(W * H * 2), lines = [];
    starts.forEach(function (s0) {
      if (used[s0]) return;
      var line = [pt(s0)], cur = s0;
      used[cur] = 1;
      for (var guard = 0; guard < 200000; guard++) {
        var n = succ[cur]; if (n < 0) break;
        line.push(pt(n));
        if (used[n]) break;
        used[n] = 1; cur = n;
      }
      if (line.length > 2) lines.push(line);
    });
    // simplify (RDP) and build strips
    var pos = [], nor = [], col = [], idxs = [];
    var stone = new THREE.Color(0xa8a49c), stoneTop = new THREE.Color(0xbfbab1);
    lines.forEach(function (l) {
      var p = rdp(l, 0.18);
      if (p.length < 2) return;
      for (var i = 1; i < p.length; i++) {
        var A = p[i - 1], B = p[i], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
        if (L < 0.05) continue;
        // which side is road? sample mask a little to the left
        var nx = -dz / L, nz = dx / L, mx = (A[0] + B[0]) / 2 + nx * 0.6, mz = (A[1] + B[1]) / 2 + nz * 0.6;
        var px = Math.round((mx - EXT.x0) * res), pz = Math.round((mz - EXT.z0) * res);
        var leftRoad = px >= 0 && pz >= 0 && px < W && pz < H && v[pz * W + px] > 0.5;
        if (!leftRoad) { nx = -nx; nz = -nz; }           // n points into the road
        var h = 0.15, t = 0.3;
        var a0 = [A[0], A[1]], b0 = [B[0], B[1]];          // road edge
        var a1 = [A[0] - nx * t, A[1] - nz * t], b1 = [B[0] - nx * t, B[1] - nz * t]; // sidewalk side
        quad([a0[0], 0, a0[1]], [b0[0], 0, b0[1]], [b0[0], h, b0[1]], [a0[0], h, a0[1]], [nx, 0.15, nz], stone);
        quad([a0[0], h, a0[1]], [b0[0], h, b0[1]], [b1[0], h, b1[1]], [a1[0], h, a1[1]], [0, 1, 0], stoneTop);
        quad([b1[0], 0, b1[1]], [a1[0], 0, a1[1]], [a1[0], h, a1[1]], [b1[0], h, b1[1]], [-nx, 0, -nz], stone);
      }
    });
    function quad(p0, p1, p2, p3, n, c) {
      var base = pos.length / 3;
      [p0, p1, p2, p3].forEach(function (p) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c.r, c.g, c.b); });
      // winding: ensure facing n
      var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
      var cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) idxs.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else idxs.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idxs, 1) : new THREE.Uint16BufferAttribute(idxs, 1));
    g.computeBoundingSphere();
    return g;
  };
  function rdp(pts, eps) {
    if (pts.length < 3) return pts;
    var a = pts[0], b = pts[pts.length - 1], best = -1, bi = 0;
    for (var i = 1; i < pts.length - 1; i++) { var d = U.segDist2(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]).d2; if (d > best) { best = d; bi = i; } }
    if (best > eps * eps) { var l = rdp(pts.slice(0, bi + 1), eps), r = rdp(pts.slice(bi), eps); return l.slice(0, -1).concat(r); }
    return [a, b];
  }

  // ------------------------------------------------------------ outer ground (beyond the atlas)
  G.buildOuter = function () {
    var S = 1600, R = 1024, c = U.canvas(R, R), ctx = c.getContext('2d'), k = R / S;
    ctx.fillStyle = '#8f8b84'; ctx.fillRect(0, 0, R, R);
    ctx.globalAlpha = 0.3; ctx.drawImage(SQ.tex.noise(256, 30, 12, 60, 200, 3), 0, 0, R, R); ctx.globalAlpha = 1;
    ctx.setTransform(k, 0, 0, k, S / 2 * k, S / 2 * k);
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = '#47474a';
    (GEO.roads || []).forEach(function (r) { ctx.lineWidth = G.roadWidth(r); linePath(ctx, r.pts); ctx.stroke(); });
    // the street grid continues: avenues (north–south, along z) and streets (along x)
    var grid = G.cityGrid();
    grid.av.forEach(function (x) { ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(x.x0, -S / 2); ctx.lineTo(x.x1, S / 2); ctx.stroke(); });
    grid.st.forEach(function (z) { ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-S / 2, z); ctx.lineTo(S / 2, z); ctx.stroke(); });
    var tex = U.tex(c, {});
    var mat = U.mat({ map: tex, color: 0xffffff });
    U.patch(mat, { key: 'outer' });
    // four slabs around the atlas rectangle
    var geoms = [], y = -0.02;
    function slab(x0, x1, z0, z1) {
      var g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      var uv = g.attributes.uv, p = g.attributes.position;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + S / 2) / S, 1 - (p.getZ(i) + S / 2) / S);
      geoms.push(g);
    }
    var H = S / 2;
    slab(-H, H, -H, EXT.z0); slab(-H, H, EXT.z1, H); slab(-H, EXT.x0, EXT.z0, EXT.z1); slab(EXT.x1, H, EXT.z0, EXT.z1);
    var mesh = new THREE.Mesh(U.merge(geoms), mat);
    mesh.receiveShadow = true; mesh.name = 'outerGround';
    return mesh;
  };
  // Approximate Manhattan grid in the local frame (used by ground + filler blocks).
  G.cityGrid = function () {
    if (G._grid) return G._grid;
    var av = [
      { x0: -5 + 0.066 * 800, x1: -5 - 0.066 * 800 },   // Fifth Ave (slight lean)
      { x0: -165, x1: -165 }, { x0: 140, x1: 142 },      // MacDougal / University Pl
      { x0: 265, x1: 265 }, { x0: -330, x1: -330 }, { x0: 420, x1: 420 }, { x0: -500, x1: -500 }, { x0: 580, x1: 580 }
    ];
    var st = [];
    for (var z = -77; z > -800; z -= 80) st.push(z);
    for (var z2 = 78; z2 < 800; z2 += 80) st.push(z2);
    st.push(0, -183, 159);
    return (G._grid = { av: av, st: st });
  };

  // ------------------------------------------------------------ build
  G.build = function (ctx) {
    var q = ctx.quality, bake = G.bake(q);
    var map = U.tex(bake.canvas, { aniso: q === 'high' ? 16 : 8 });
    var mask = U.tex(bake.mask, { srgb: false });
    var useDetail = q !== 'low';
    var detail = useDetail ? U.tex(SQ.tex.groundDetail(512), { srgb: false, repeat: true }) : null;
    var mat = U.mat({ map: map, color: 0xffffff, roughness: 0.95 });
    var uni = { uDetail: { value: detail }, uMaskT: { value: mask } };
    U.patch(mat, {
      key: 'ground' + (useDetail ? 'd' : ''),
      uniforms: uni,
      fragHead: (useDetail ? 'uniform sampler2D uDetail; uniform sampler2D uMaskT;\n' : '') + 'const vec3 SQ_FC = vec3(' + F.x.toFixed(2) + ', 0.0, ' + F.z.toFixed(2) + ');\n',
      frag: function (f) {
        f = f.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (distance(vSqW.xz, SQ_FC.xz) < ' + (F.outerR - 0.05).toFixed(2) + ') discard;');
        if (useDetail) f = f.replace('#include <map_fragment>', [
          '#include <map_fragment>',
          '{ vec4 sqM = texture2D(uMaskT, vMapUv); vec3 sqD = texture2D(uDetail, vSqW.xz / 4.0).rgb; vec3 sqD2 = texture2D(uDetail, vSqW.xz / 1.3).rgb;',
          '  float sqFd = 1.0 - smoothstep(25.0, 120.0, length(vViewPosition));',
          '  float sqMod = sqM.r * (sqD.r - 0.62) * 0.95 + sqM.g * ((sqD.g - 0.5) * 0.7 + (sqD2.g - 0.5) * 0.35) + sqM.b * (sqD.b - 0.5) * 0.45;',
          '  diffuseColor.rgb *= 1.0 + sqFd * sqMod; }'
        ].join('\n'));
        return f;
      }
    });
    var geo = new THREE.PlaneGeometry(EXT.x1 - EXT.x0, EXT.z1 - EXT.z0, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate((EXT.x0 + EXT.x1) / 2, 0, (EXT.z0 + EXT.z1) / 2);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true; mesh.name = 'ground'; mesh.renderOrder = -2;
    var curbMat = U.mat({ vertexColors: true, roughness: 0.9 });
    U.patch(curbMat, { key: 'curb' });
    var curbs = new THREE.Mesh(G.buildCurbs(), curbMat);
    curbs.receiveShadow = true; curbs.name = 'curbs';
    var outer = G.buildOuter();
    var group = new THREE.Group(); group.name = 'groundGroup';
    group.add(mesh, curbs, outer);
    return { group: group, ground: mesh, textures: [map, mask, detail], dispose: function () { [map, mask, detail].forEach(function (t) { if (t) t.dispose(); }); } };
  };
})(window.SQ = window.SQ || {});
