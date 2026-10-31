// SQUARE OFF — Render A: shared world utilities and procedural canvas textures.
// SQ.env.util : hashing, RNG, geometry builder/merger, polygon helpers, material factory, shader patching.
// SQ.tex      : canvas generators (facade atlases, ground detail, chess top, marble, arch faces,
//               leaves, skyline, glyph atlas). Everything is generated at load; no image files.
(function (SQ) {
  'use strict';
  var env = SQ.env = SQ.env || {};
  var U = env.util = env.util || {};
  var TEX = SQ.tex = SQ.tex || {};

  // ---------------------------------------------------------------- hashing / random
  function fract(v) { return v - Math.floor(v); }
  U.hash1 = function (x) { return fract(Math.sin(x * 127.1 + 311.7) * 43758.5453); };
  U.hash2 = function (x, z) { return fract(Math.sin(x * 127.1 + z * 311.7 + 17.13) * 43758.5453); };
  U.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smooth = function (a, b, v) { var t = U.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- polygons
  U.polyArea = function (p) { var a = 0; for (var i = 0, n = p.length; i < n; i++) { var q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
  U.polyCentroid = function (p) { var x = 0, z = 0; for (var i = 0; i < p.length; i++) { x += p[i][0]; z += p[i][1]; } return [x / p.length, z / p.length]; };
  U.polyBBox = function (p) {
    var b = [Infinity, -Infinity, Infinity, -Infinity];
    for (var i = 0; i < p.length; i++) { var q = p[i]; if (q[0] < b[0]) b[0] = q[0]; if (q[0] > b[1]) b[1] = q[0]; if (q[1] < b[2]) b[2] = q[1]; if (q[1] > b[3]) b[3] = q[1]; }
    return b;
  };
  U.pointInPoly = function (x, z, p) {
    var c = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      var xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  };
  U.segDist2 = function (px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = ax + dx * t - px, ez = az + dz * t - pz;
    return { d2: ex * ex + ez * ez, t: t, x: ax + dx * t, z: az + dz * t };
  };
  U.polyLen = function (p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  // Park bounds (GEO park polygon bbox) — used by several modules.
  U.PARK = { x0: -162, x1: 135, z0: -72, z1: 73 };
  U.distToPark = function (x, z) {
    var P = U.PARK, dx = Math.max(P.x0 - x, 0, x - P.x1), dz = Math.max(P.z0 - z, 0, z - P.z1);
    return Math.hypot(dx, dz);
  };

  // ---------------------------------------------------------------- geometry merge / builder
  // Merge BufferGeometries (indexed or not) into one indexed geometry; missing attributes default
  // (color -> 1, everything else -> 0). Inputs must already be transformed.
  U.merge = function (geoms) {
    geoms = geoms.filter(function (g) { return g && g.attributes.position && g.attributes.position.count; });
    var out = new THREE.BufferGeometry();
    if (!geoms.length) { out.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); return out; }
    var sizes = {}, vcount = 0, icount = 0;
    geoms.forEach(function (g) {
      if (!g.attributes.normal) g.computeVertexNormals();
      Object.keys(g.attributes).forEach(function (n) { sizes[n] = g.attributes[n].itemSize; });
      vcount += g.attributes.position.count;
      icount += g.index ? g.index.count : g.attributes.position.count;
    });
    var arrays = {};
    Object.keys(sizes).forEach(function (n) {
      arrays[n] = new Float32Array(vcount * sizes[n]);
      if (n === 'color') arrays[n].fill(1);
    });
    var index = vcount > 65535 ? new Uint32Array(icount) : new Uint16Array(icount);
    var vo = 0, io = 0;
    geoms.forEach(function (g) {
      var c = g.attributes.position.count;
      Object.keys(sizes).forEach(function (n) {
        var a = g.attributes[n];
        if (!a) return;
        var s = sizes[n];
        if (a.isInterleavedBufferAttribute || a.itemSize !== s) {
          for (var i = 0; i < c; i++) for (var k = 0; k < s; k++) arrays[n][(vo + i) * s + k] = k < a.itemSize ? a.getComponent ? a.getComponent(i, k) : a.array[i * a.itemSize + k] : 0;
        } else arrays[n].set(a.array.subarray(0, c * s), vo * s);
      });
      if (g.index) { var gi = g.index.array; for (var j = 0; j < g.index.count; j++) index[io++] = gi[j] + vo; }
      else for (var j2 = 0; j2 < c; j2++) index[io++] = vo + j2;
      vo += c;
    });
    Object.keys(sizes).forEach(function (n) { out.setAttribute(n, new THREE.BufferAttribute(arrays[n], sizes[n])); });
    out.setIndex(new THREE.BufferAttribute(index, 1));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  };
  U.colorize = function (g, color, extra) {
    var c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    var jit = extra && extra.jitter || 0, rnd = extra && extra.rnd;
    for (var i = 0; i < n; i++) {
      var j = jit ? 1 + (rnd() - 0.5) * jit : 1;
      a[i * 3] = c.r * j; a[i * 3 + 1] = c.g * j; a[i * 3 + 2] = c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  // Builder: accumulate coloured primitives, then merge into one vertex-coloured geometry.
  U.builder = function () {
    var parts = [], tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
    function place(g, o) {
      o = o || {};
      tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
      tmpQ.setFromEuler(tmpE);
      tmpS.set(o.sx || 1, o.sy || 1, o.sz || 1);
      tmpP.set(o.x || 0, o.y || 0, o.z || 0);
      tmpM.compose(tmpP, tmpQ, tmpS);
      if (o.m) tmpM.premultiply(o.m);
      g.applyMatrix4(tmpM);
      return g;
    }
    var api = {
      add: function (g, color, o) {
        if (g.index === null && g.attributes.uv === undefined) { /* fine */ }
        U.colorize(g, color === undefined ? 0xffffff : color, o);
        parts.push(place(g, o));
        return api;
      },
      box: function (w, h, d, color, o) { var g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return api.add(g, color, o); },
      cyl: function (r0, r1, h, seg, color, o) { var g = new THREE.CylinderGeometry(r1, r0, h, seg || 8, 1); g.translate(0, h / 2, 0); return api.add(g, color, o); },
      cone: function (r, h, seg, color, o) { var g = new THREE.ConeGeometry(r, h, seg || 8, 1); g.translate(0, h / 2, 0); return api.add(g, color, o); },
      sphere: function (r, ws, hs, color, o) { return api.add(new THREE.SphereGeometry(r, ws || 8, hs || 6), color, o); },
      ico: function (r, d, color, o) { return api.add(new THREE.IcosahedronGeometry(r, d || 0), color, o); },
      // A cylinder between two points (for legs, rails, arms…)
      rod: function (a, b, r, seg, color, o) {
        var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
        var g = new THREE.CylinderGeometry(r, r, L, seg || 5, 1);
        g.translate(0, L / 2, 0);
        var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
        var m = new THREE.Matrix4().compose(new THREE.Vector3(a[0], a[1], a[2]), q, new THREE.Vector3(1, 1, 1));
        if (o && o.m) m.premultiply(o.m);
        g.applyMatrix4(m);
        U.colorize(g, color);
        parts.push(g);
        return api;
      },
      geom: function (g, o) { parts.push(o ? place(g, o) : g); return api; },
      count: function () { return parts.length; },
      build: function () { var g = U.merge(parts); parts.forEach(function (p) { p.dispose(); }); parts = []; return g; }
    };
    return api;
  };

  // ---------------------------------------------------------------- canvas / texture helpers
  U.canvas = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // 2D context for canvases we read back (getImageData): CPU-backed, avoids a GPU readback stall.
  U.ctxR = function (c) { return c.getContext('2d', { willReadFrequently: true }); };
  U.tex = function (canvas, o) {
    o = o || {};
    var t = new THREE.CanvasTexture(canvas);
    if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = Math.min(env.maxAniso || 4, o.aniso || (env.quality === 'high' ? 8 : 4));
    if (o.nomip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
    t.needsUpdate = true;
    return t;
  };
  function rgb(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
  function rgba(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')'; }
  function jitter(c, rnd, amt) { var k = 1 + (rnd() - 0.5) * amt; return [c[0] * k, c[1] * k, c[2] * k]; }
  TEX.rgb = rgb; TEX.rgba = rgba;

  // Value-noise tile (seamless) as a canvas: used for ground layers and grime.
  TEX.noise = function (size, cell, seed, lo, hi, octaves) {
    var c = U.canvas(size, size), ctx = U.ctxR(c), img = ctx.createImageData(size, size), d = img.data;
    var r = U.rng(seed || 7), oct = octaves || 3, grids = [];
    for (var o = 0; o < oct; o++) {
      var n = Math.max(2, Math.round(size / (cell / Math.pow(2, o)))), g = new Float32Array(n * n);
      for (var i = 0; i < g.length; i++) g[i] = r();
      grids.push({ n: n, g: g });
    }
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var v = 0, amp = 1, tot = 0;
      for (var k = 0; k < oct; k++) {
        var G = grids[k], fx = x / size * G.n, fy = y / size * G.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var a = G.g[(iy % G.n) * G.n + ix % G.n], b = G.g[(iy % G.n) * G.n + (ix + 1) % G.n];
        var cc = G.g[((iy + 1) % G.n) * G.n + ix % G.n], dd = G.g[((iy + 1) % G.n) * G.n + (ix + 1) % G.n];
        v += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty);
        tot += amp; amp *= 0.5;
      }
      v /= tot;
      var p = (y * size + x) * 4, L = (lo === undefined ? 0 : lo) + v * ((hi === undefined ? 255 : hi) - (lo || 0));
      d[p] = d[p + 1] = d[p + 2] = L; d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };
  // Sparse speckle tile (alpha) for grit, gum spots, leaves.
  TEX.speckle = function (size, count, seed, colors, rmin, rmax) {
    var c = U.canvas(size, size), ctx = c.getContext('2d'), r = U.rng(seed);
    for (var i = 0; i < count; i++) {
      var col = colors[(r() * colors.length) | 0], rad = rmin + r() * (rmax - rmin), x = r() * size, y = r() * size;
      ctx.fillStyle = col;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) { // wrap
        var X = x + ox * size, Y = y + oy * size;
        if (X < -rad || Y < -rad || X > size + rad || Y > size + rad) continue;
        ctx.beginPath(); ctx.ellipse(X, Y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    return c;
  };

  // ---------------------------------------------------------------- facades
  // Facade atlas: 4 variant columns × 2 rows (row 0 = upper floor, row 1 = ground floor).
  // Each tile = one bay × one floor. Glass pixels carry alpha ≈ 0.55 (the shader lights them at night).
  var FACADE = TEX.FACADE = {
    row:    { bay: 2.6, floor: 3.8, flat: 0x9c4a36 },
    nyu:    { bay: 2.6, floor: 3.4, flat: 0x8a4a3c },
    judson: { bay: 3.4, floor: 6.8, flat: 0xc9a86a },
    brown:  { bay: 2.6, floor: 3.4, flat: 0x6e4a3a },
    lime:   { bay: 2.6, floor: 3.4, flat: 0xbdb3a0 },
    glass:  { bay: 2.6, floor: 3.6, flat: 0x5f7484 },
    brick:  { bay: 2.6, floor: 3.2, flat: 0x8f5642 }
  };
  var TW = 256, TH = 336;

  function brickWall(ctx, x, y, w, h, o, rnd) {
    ctx.fillStyle = o.mortar; ctx.fillRect(x, y, w, h);
    var bw = o.bw, bh = o.bh, row = 0;
    for (var yy = y + h - bh; yy > y - bh; yy -= bh, row++) {
      var flemish = o.bond === 'flemish', off = flemish ? (row % 2 ? bw * 0.75 : 0) : (row % 2 ? bw / 2 : 0), k = 0;
      for (var xx = x - bw * 2 + off; xx < x + w; k++) {
        var len = flemish ? (k % 2 ? bw * 0.5 : bw) : bw;
        var c = jitter(o.brick, rnd, o.var);
        if (rnd() < 0.08) c = jitter(o.brick2 || o.brick, rnd, o.var * 1.5);
        if (flemish && k % 2) c = [c[0] * 0.86, c[1] * 0.84, c[2] * 0.84]; // headers darker, the Flemish look
        ctx.fillStyle = rgb(c[0], c[1], c[2]);
        ctx.fillRect(xx + 0.6, yy + 0.6, len - 1.2, bh - 1.2);
        xx += len;
      }
    }
  }
  function ashlar(ctx, x, y, w, h, base, bw, bh, rnd, joint, varAmt) {
    ctx.fillStyle = joint; ctx.fillRect(x, y, w, h);
    var row = 0;
    for (var yy = y + h - bh; yy > y - bh; yy -= bh, row++) {
      var off = row % 2 ? bw * 0.5 : 0;
      for (var xx = x - bw + off; xx < x + w; xx += bw) {
        var c = jitter(base, rnd, varAmt || 0.08);
        ctx.fillStyle = rgb(c[0], c[1], c[2]);
        ctx.fillRect(xx + 0.8, yy + 0.8, bw - 1.6, bh - 1.6);
      }
    }
  }
  function grime(ctx, x, y, w, h, rnd, amt) {
    // vertical streaks and darker base: weathering
    for (var i = 0; i < 10; i++) {
      var gx = x + rnd() * w, gw = 3 + rnd() * 14, gy = y + h * (0.3 + rnd() * 0.5);
      var g = ctx.createLinearGradient(0, gy, 0, y + h);
      g.addColorStop(0, 'rgba(20,15,10,0)'); g.addColorStop(1, rgba(20, 15, 10, amt * 0.5 * rnd()));
      ctx.fillStyle = g; ctx.fillRect(gx, gy, gw, y + h - gy);
    }
  }
  // Glass with a sky-gradient reflection; registers the pane in the mask canvas.
  function glass(ctx, mctx, x, y, w, h, rnd, o) {
    o = o || {};
    var g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    var tint = o.tint || [120, 140, 158];
    g.addColorStop(0, rgb(tint[0] + 50, tint[1] + 52, tint[2] + 55));
    g.addColorStop(0.45, rgb(tint[0], tint[1], tint[2]));
    g.addColorStop(1, rgb(tint[0] * 0.45, tint[1] * 0.5, tint[2] * 0.55));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // diagonal reflection streak
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); var s = x + rnd() * w; ctx.moveTo(s, y); ctx.lineTo(s + w * 0.35, y); ctx.lineTo(s - w * 0.2, y + h); ctx.lineTo(s - w * 0.55, y + h); ctx.fill();
    ctx.restore();
    // interior: blinds / curtains
    var blind = o.blind !== undefined ? o.blind : rnd();
    if (blind > 0.35) {
      var bh = h * (blind - 0.35) * 1.4;
      var bc = o.blindColor || (rnd() < 0.5 ? [226, 214, 186] : rnd() < 0.5 ? [238, 236, 228] : [176, 150, 116]);
      var bg = ctx.createLinearGradient(0, y, 0, y + Math.min(h, bh));
      bg.addColorStop(0, rgb(bc[0] * 0.85, bc[1] * 0.85, bc[2] * 0.85)); bg.addColorStop(1, rgb(bc[0] * 0.7, bc[1] * 0.7, bc[2] * 0.7));
      ctx.fillStyle = bg; ctx.fillRect(x, y, w, Math.min(h, bh));
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + Math.min(h, bh) - 2, w, 2);
    } else if (blind > 0.2) {
      ctx.fillStyle = 'rgba(230,220,200,0.55)'; ctx.fillRect(x, y, w * 0.22, h); ctx.fillRect(x + w * 0.78, y, w * 0.22, h);
    }
    if (mctx) { mctx.fillStyle = '#fff'; mctx.fillRect(x, y, w, h); }
  }
  function sash(ctx, mctx, x, y, w, h, rnd, o) {
    // a double-hung window: frame, two sashes with muntins
    var fr = o.frame || '#f2efe6', ft = Math.max(2, w * 0.07);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); // reveal shadow
    ctx.fillStyle = fr; ctx.fillRect(x, y, w, h);
    glass(ctx, mctx, x + ft, y + ft, w - 2 * ft, h - 2 * ft, rnd, o);
    ctx.fillStyle = fr;
    ctx.fillRect(x, y + h / 2 - ft * 0.5, w, ft); // meeting rail
    var mx = o.mx || 0, my = o.my || 0, k;
    for (k = 1; k < mx; k++) ctx.fillRect(x + w * k / mx - 1, y, 2, h);
    for (k = 1; k < my; k++) { ctx.fillRect(x, y + (h / 2) * k / my - 1, w, 2); ctx.fillRect(x, y + h / 2 + (h / 2) * k / my - 1, w, 2); }
    // reveal shading at top
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + ft, y + ft, w - 2 * ft, 3);
  }
  function awning(ctx, x, y, w, h, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + 4, y + h); ctx.lineTo(x - 4, y + h); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (var i = 0; i < w; i += 14) ctx.fillRect(x + i, y, 7, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 4, y + h - 3, w + 8, 3);
  }
  function storefront(ctx, mctx, x, y, w, h, rnd, frameCol, stone) {
    // y,h = whole tile; shop glass with transom and kickplate
    var top = y + h * 0.18, bot = y + h * 0.9;
    ctx.fillStyle = frameCol; ctx.fillRect(x + 4, top - 6, w - 8, bot - top + 10);
    glass(ctx, mctx, x + 10, top, w - 20, (bot - top) * 0.78, rnd, { tint: [96, 108, 112], blind: 0.1 });
    // goods inside
    for (var i = 0; i < 6; i++) { ctx.fillStyle = rgba(150 + rnd() * 100, 100 + rnd() * 120, 60 + rnd() * 120, 0.5); ctx.fillRect(x + 14 + rnd() * (w - 40), top + (bot - top) * (0.4 + rnd() * 0.3), 6 + rnd() * 12, 6 + rnd() * 10); }
    ctx.fillStyle = frameCol; ctx.fillRect(x + w / 2 - 2, top, 4, (bot - top) * 0.78);
    ctx.fillStyle = stone || '#3a3330'; ctx.fillRect(x + 4, top + (bot - top) * 0.78, w - 8, (bot - top) * 0.22 + 4);
    // signband
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x + 4, y + h * 0.06, w - 8, h * 0.09);
    var cols = ['#c8a24a', '#e8e2d0', '#d0563c', '#7fb3c8'];
    ctx.fillStyle = cols[(rnd() * cols.length) | 0];
    for (var k = 0; k < 5; k++) ctx.fillRect(x + 20 + k * (w - 40) / 5, y + h * 0.085, (w - 40) / 7, h * 0.04);
    if (rnd() < 0.6) awning(ctx, x + 6, top - 4, w - 12, h * 0.1, ['#1f4d3a', '#7a1f24', '#23325a', '#2b2b2b', '#8a6a2a'][(rnd() * 5) | 0]);
  }

  var painters = {
    row: function (ctx, m, x, y, v, ground, rnd) {
      // Greek Revival row house: red Flemish-bond brick, 6-over-6 sash, white stone lintel & sill
      brickWall(ctx, x, y, TW, TH, { mortar: '#cdbfae', brick: [150, 62, 44], brick2: [120, 48, 36], var: 0.18, bw: 20, bh: 6.6, bond: 'flemish' }, rnd);
      grime(ctx, x, y, TW, TH, rnd, 0.12);
      var ww = 96, wx = x + (TW - ww) / 2;
      if (!ground) {
        var wh = 176, wy = y + 70;
        ctx.fillStyle = '#ece6d6'; ctx.fillRect(wx - 10, wy - 22, ww + 20, 20); // lintel
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wx - 10, wy - 3, ww + 20, 3);
        sash(ctx, m, wx, wy, ww, wh, rnd, { mx: 3, my: 2, frame: '#f4f1e8' });
        ctx.fillStyle = '#e6dfcc'; ctx.fillRect(wx - 8, wy + wh, ww + 16, 10); // sill
        if (v === 3) { ctx.fillStyle = '#1d1f1c'; ctx.fillRect(wx - 30, wy, 18, wh); ctx.fillRect(wx + ww + 12, wy, 18, wh); } // shutters
      } else if (v === 0) {
        // Greek Revival doorway: white columns, entablature, fanlight-less transom
        var dx = x + 58, dw = 140;
        ctx.fillStyle = '#efeadd'; ctx.fillRect(dx - 14, y + 34, dw + 28, 30); ctx.fillRect(dx - 10, y + 64, 22, TH - 64); ctx.fillRect(dx + dw - 12, y + 64, 22, TH - 64);
        ctx.fillStyle = '#2a1a14'; ctx.fillRect(dx + 26, y + 92, dw - 52, TH - 92);
        glass(ctx, m, dx + 26, y + 70, dw - 52, 18, rnd, { blind: 0 });
        ctx.fillStyle = '#3a2418'; ctx.fillRect(dx + 34, y + 100, dw / 2 - 40, TH - 110); ctx.fillRect(dx + dw / 2 + 6, y + 100, dw / 2 - 40, TH - 110);
        ctx.fillStyle = '#c9a548'; ctx.fillRect(dx + dw / 2 - 4, y + 200, 8, 8);
      } else {
        // tall parlour window with iron balconette, basement window below
        var wh2 = 210, wy2 = y + 30;
        ctx.fillStyle = '#ece6d6'; ctx.fillRect(wx - 10, wy2 - 18, ww + 20, 16);
        sash(ctx, m, wx, wy2, ww, wh2, rnd, { mx: 3, my: 3, frame: '#f4f1e8' });
        ctx.strokeStyle = '#151515'; ctx.lineWidth = 2;
        for (var i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(wx - 6 + i * (ww + 12) / 10, wy2 + wh2 - 50); ctx.lineTo(wx - 6 + i * (ww + 12) / 10, wy2 + wh2); ctx.stroke(); }
        ctx.fillStyle = '#151515'; ctx.fillRect(wx - 8, wy2 + wh2 - 52, ww + 16, 4);
        ctx.fillStyle = '#d9d2c0'; ctx.fillRect(x, y + TH - 70, TW, 70); // brownstone/limestone base course
        ctx.fillStyle = '#b8b0a0'; ctx.fillRect(x, y + TH - 70, TW, 4);
        sash(ctx, m, wx + 10, y + TH - 56, ww - 20, 40, rnd, { mx: 2, my: 0, frame: '#222' });
      }
    },
    brick: function (ctx, m, x, y, v, ground, rnd) {
      // generic Village walk-up: running-bond brick (varied hue), 1-over-1 sash, fire-escape hint
      var hues = [[146, 74, 52], [120, 66, 52], [168, 104, 78], [110, 58, 48]];
      brickWall(ctx, x, y, TW, TH, { mortar: '#bfb3a3', brick: hues[v], var: 0.16, bw: 21, bh: 7, bond: 'running' }, rnd);
      grime(ctx, x, y, TW, TH, rnd, 0.18);
      if (ground) { storefront(ctx, m, x, y, TW, TH, rnd, '#2c2a28'); return; }
      var ww = 92, wh = 160, wx = x + (TW - ww) / 2, wy = y + 84;
      ctx.fillStyle = '#d8d0bf'; ctx.fillRect(wx - 8, wy - 14, ww + 16, 12);
      sash(ctx, m, wx, wy, ww, wh, rnd, { mx: 0, my: 0, frame: v % 2 ? '#e8e4da' : '#262626' });
      ctx.fillStyle = '#d8d0bf'; ctx.fillRect(wx - 6, wy + wh, ww + 12, 8);
      if (v === 2) { // fire escape
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x, wy + wh + 8, TW, 5);
        for (var i = 0; i < TW; i += 8) ctx.fillRect(x + i, wy + wh - 34, 2, 42);
        ctx.fillRect(x, wy + wh - 36, TW, 3);
      }
    },
    brown: function (ctx, m, x, y, v, ground, rnd) {
      ashlar(ctx, x, y, TW, TH, [104, 70, 54], 64, 28, rnd, '#5a3d30', 0.07);
      grime(ctx, x, y, TW, TH, rnd, 0.2);
      if (ground) {
        if (v < 2) { storefront(ctx, m, x, y, TW, TH, rnd, '#2a201b', '#4a3428'); return; }
        // stoop door level: rusticated
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (var yy = y + 20; yy < y + TH; yy += 28) ctx.fillRect(x, yy, TW, 4);
      }
      var ww = 90, wh = 168, wx = x + (TW - ww) / 2, wy = y + 80;
      // heavy hood with pediment
      ctx.fillStyle = '#7d5643'; ctx.beginPath(); ctx.moveTo(wx - 16, wy - 14); ctx.lineTo(wx + ww / 2, wy - 44); ctx.lineTo(wx + ww + 16, wy - 14); ctx.fill();
      ctx.fillRect(wx - 16, wy - 16, ww + 32, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(wx - 16, wy - 3, ww + 32, 3);
      ctx.fillStyle = '#7d5643'; ctx.fillRect(wx - 10, wy - 2, ww + 20, wh + 14);
      sash(ctx, m, wx, wy, ww, wh, rnd, { mx: v === 1 ? 2 : 0, my: v === 1 ? 2 : 0, frame: v === 3 ? '#1f1f1f' : '#e9e3d4' });
      ctx.fillStyle = '#866050'; ctx.fillRect(wx - 12, wy + wh, ww + 24, 12);
    },
    lime: function (ctx, m, x, y, v, ground, rnd) {
      var base = [[200, 192, 174], [188, 182, 168], [210, 200, 180], [180, 176, 166]][v];
      ashlar(ctx, x, y, TW, TH, base, 86, 30, rnd, rgb(base[0] * 0.8, base[1] * 0.8, base[2] * 0.8), 0.05);
      grime(ctx, x, y, TW, TH, rnd, 0.22);
      if (ground) { storefront(ctx, m, x, y, TW, TH, rnd, '#20201e', '#58544c'); return; }
      var ww = 100, wh = 170, wx = x + (TW - ww) / 2, wy = y + 78;
      ctx.fillStyle = rgb(base[0] * 1.05, base[1] * 1.05, base[2] * 1.05); ctx.fillRect(wx - 12, wy - 12, ww + 24, wh + 24);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(wx - 12, wy + wh + 8, ww + 24, 4);
      sash(ctx, m, wx, wy, ww, wh, rnd, { mx: v === 2 ? 2 : 0, my: v === 2 ? 1 : 0, frame: v % 2 ? '#2a2a2a' : '#d9d4c6' });
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(wx - 12, wy - 12, ww + 24, 3);
    },
    nyu: function (ctx, m, x, y, v, ground, rnd) {
      // Bobst/Kimmel-style red sandstone slab with spandrel bands and a dense window grid
      var base = [[132, 62, 48], [140, 70, 54], [124, 58, 46], [146, 76, 58]][v];
      ctx.fillStyle = rgb(base[0], base[1], base[2]); ctx.fillRect(x, y, TW, TH);
      var n = TEX.noiseCache || (TEX.noiseCache = TEX.noise(128, 32, 3, 0, 255, 3));
      ctx.globalAlpha = 0.18; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(n, x, y, TW, TH); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // slab joints
      ctx.fillStyle = 'rgba(40,15,10,0.45)'; ctx.fillRect(x, y, 2, TH); ctx.fillRect(x, y + TH - 2, TW, 2); ctx.fillRect(x, y + TH * 0.55, TW, 1.5);
      if (ground) {
        ctx.fillStyle = '#5a2c22'; ctx.fillRect(x, y, TW, TH);
        glass(ctx, m, x + 12, y + 40, TW - 24, TH - 60, rnd, { tint: [70, 82, 90], blind: 0 });
        ctx.fillStyle = '#2c1c18'; for (var i = 0; i < 4; i++) ctx.fillRect(x + 12 + i * (TW - 24) / 3 - 2, y + 40, 5, TH - 60);
        return;
      }
      var wy = y + 70, wh = 196;
      ctx.fillStyle = '#3a1f19'; ctx.fillRect(x + 22, wy - 4, TW - 44, wh + 8);
      glass(ctx, m, x + 26, wy, TW - 52, wh, rnd, { tint: [86, 100, 112], blindColor: [205, 200, 188] });
      ctx.fillStyle = '#2a1712'; ctx.fillRect(x + TW / 2 - 3, wy, 6, wh); ctx.fillRect(x + 26, wy + wh * 0.72, TW - 52, 5);
      ctx.fillStyle = rgb(base[0] * 0.82, base[1] * 0.8, base[2] * 0.8); ctx.fillRect(x, y + TH - 36, TW, 36); // spandrel band
      ctx.fillStyle = 'rgba(255,220,200,0.12)'; ctx.fillRect(x, y + TH - 36, TW, 3);
    },
    judson: function (ctx, m, x, y, v, ground, rnd) {
      // Stanford White's yellow Roman brick with terracotta trim and round-arched windows
      brickWall(ctx, x, y, TW, TH, { mortar: '#e2d6bb', brick: [206, 172, 112], brick2: [190, 150, 96], var: 0.12, bw: 38, bh: 5, bond: 'running' }, rnd);
      grime(ctx, x, y, TW, TH, rnd, 0.1);
      var ww = ground ? 120 : 92, wx = x + (TW - ww) / 2, wy = y + (ground ? 96 : 92), wh = ground ? 200 : 170;
      var r = ww / 2;
      ctx.fillStyle = '#c9926a'; // terracotta archivolt
      ctx.beginPath(); ctx.arc(wx + r, wy + r, r + 14, Math.PI, 0); ctx.lineTo(wx + ww + 14, wy + wh); ctx.lineTo(wx - 14, wy + wh); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(wx + r, wy + r, r, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.lineTo(wx, wy + wh); ctx.closePath(); ctx.clip();
      glass(ctx, m, wx, wy, ww, wh, rnd, { tint: v === 1 ? [120, 96, 140] : [104, 120, 132], blind: 0.1 });
      ctx.fillStyle = '#5b4632'; ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh); for (var i = 1; i < 4; i++) ctx.fillRect(wx, wy + r + i * (wh - r) / 4, ww, 3);
      ctx.restore();
      ctx.fillStyle = '#dcc49a'; ctx.fillRect(wx - 16, wy + wh, ww + 32, 10);
    },
    glass: function (ctx, m, x, y, v, ground, rnd) {
      ctx.fillStyle = '#6d7c86'; ctx.fillRect(x, y, TW, TH);
      var tint = [[128, 152, 170], [118, 142, 160], [140, 158, 168], [110, 134, 156]][v];
      var gh = TH - (ground ? 24 : 64);
      glass(ctx, m, x + 4, y + (ground ? 20 : 4), TW - 8, gh, rnd, { tint: tint, blind: ground ? 0 : (v === 1 ? 0.75 : v === 3 ? 0.55 : 0), blindColor: [220, 222, 222] });
      ctx.fillStyle = '#8f9aa2'; // aluminium mullions
      ctx.fillRect(x, y, 5, TH); ctx.fillRect(x + TW / 2 - 2, y, 4, gh + 4);
      if (!ground) { ctx.fillStyle = '#5e6b74'; ctx.fillRect(x, y + TH - 60, TW, 60); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y + TH - 60, TW, 3); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y + TH - 4, TW, 4); }
    }
  };

  var facadeCache = {};
  TEX.facade = function (cls) {
    if (facadeCache[cls]) return facadeCache[cls];
    var W = TW * 4, H = TH * 2, c = U.canvas(W, H), ctx = U.ctxR(c), mc = U.canvas(W, H), mctx = U.ctxR(mc);
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
    var p = painters[cls] || painters.brick;
    for (var row = 0; row < 2; row++) for (var v = 0; v < 4; v++) {
      var rnd = U.rng(1000 + v * 31 + row * 7 + cls.length * 101);
      ctx.save(); ctx.beginPath(); ctx.rect(v * TW, row * TH, TW, TH); ctx.clip();
      mctx.save(); mctx.beginPath(); mctx.rect(v * TW, row * TH, TW, TH); mctx.clip();
      p(ctx, mctx, v * TW, row * TH, v, row === 1, rnd);
      ctx.restore(); mctx.restore();
    }
    // glass -> alpha 140
    var img = ctx.getImageData(0, 0, W, H), mimg = mctx.getImageData(0, 0, W, H), d = img.data, md = mimg.data;
    for (var i = 0; i < d.length; i += 4) d[i + 3] = md[i] > 127 ? 140 : 255;
    ctx.putImageData(img, 0, 0);
    facadeCache[cls] = c;
    return c;
  };

  // ---------------------------------------------------------------- ground detail (data texture)
  // R: hex paver / bluestone pattern luminance, G: grass blades, B: asphalt/concrete grain. 4 m tile.
  TEX.groundDetail = function (size) {
    size = size || 512;
    var c = U.canvas(size, size), ctx = U.ctxR(c);
    var hexC = U.canvas(size, size), h = U.ctxR(hexC);
    h.fillStyle = 'rgb(90,90,90)'; h.fillRect(0, 0, size, size);
    var rnd = U.rng(77), R = size / 4 / 4 * 0.58; // ~0.23 m across in a 4 m tile
    var dx = R * Math.sqrt(3), dy = R * 1.5;
    var cols = Math.round(size / dx), rows = Math.round(size / dy / 2) * 2;
    dx = size / cols; dy = size / rows; R = dy / 1.5;
    for (var j = -1; j <= rows; j++) for (var i = -1; i <= cols; i++) {
      var cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * dy, L = 150 + rnd() * 60;
      h.fillStyle = 'rgb(' + (L | 0) + ',' + (L | 0) + ',' + (L | 0) + ')';
      h.beginPath();
      for (var k = 0; k < 6; k++) { var a = Math.PI / 6 + k * Math.PI / 3, rr = R * 0.9; h[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      h.fill();
      h.fillStyle = 'rgba(255,255,255,0.18)'; h.beginPath(); h.arc(cx - R * 0.2, cy - R * 0.2, R * 0.35, 0, 7); h.fill();
    }
    var grassC = U.canvas(size, size), g = U.ctxR(grassC);
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
    g.lineWidth = 1;
    for (var bkt = 0; bkt < 8; bkt++) {
      var L2 = 60 + bkt * 26;
      g.strokeStyle = 'rgb(' + L2 + ',' + L2 + ',' + L2 + ')'; g.beginPath();
      for (var n = 0; n < size * 5; n++) { var x = rnd() * size, y = rnd() * size, l = 2 + rnd() * 6; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - l); }
      g.stroke();
    }
    var nz = TEX.noise(size, size / 16, 5, 70, 190, 4);
    var a = h.getImageData(0, 0, size, size).data, b = g.getImageData(0, 0, size, size).data, cn = nz.getContext('2d').getImageData(0, 0, size, size).data;
    var img = ctx.createImageData(size, size), d = img.data;
    var rr2 = U.rng(9);
    for (var p = 0; p < d.length; p += 4) {
      d[p] = a[p]; d[p + 1] = b[p]; d[p + 2] = U.clamp(cn[p] + (rr2() - 0.5) * 60, 0, 255); d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  // ---------------------------------------------------------------- small textures
  TEX.chessTop = function () {
    var s = 256, c = U.canvas(s, s), ctx = c.getContext('2d');
    ctx.drawImage(TEX.noise(s, 24, 41, 120, 150, 3), 0, 0);
    ctx.fillStyle = 'rgba(160,150,140,0.55)'; ctx.fillRect(0, 0, s, s);
    var m = s * 0.16, q = (s - 2 * m) / 8;
    ctx.fillStyle = '#2a2726'; ctx.fillRect(m - 4, m - 4, s - 2 * m + 8, s - 2 * m + 8);
    for (var i = 0; i < 8; i++) for (var j = 0; j < 8; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#38302c' : '#d8cfbf';
      ctx.fillRect(m + i * q, m + j * q, q, q);
    }
    return c;
  };
  TEX.marble = function (size) {
    size = size || 512;
    var c = U.canvas(size, size), ctx = c.getContext('2d'), rnd = U.rng(5);
    ctx.drawImage(TEX.noise(size, size / 6, 11, 214, 246, 4), 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,248,236)'; ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    for (var v = 0; v < 14; v++) { // veins
      ctx.strokeStyle = 'rgba(120,118,120,' + (0.05 + rnd() * 0.12) + ')'; ctx.lineWidth = 0.6 + rnd() * 1.6;
      ctx.beginPath(); var x = rnd() * size, y = rnd() * size; ctx.moveTo(x, y);
      for (var k = 0; k < 12; k++) { x += (rnd() - 0.3) * 40; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // ashlar joints: blocks 1.0 m tall x 2.0 m long in a 4 m tile
    ctx.strokeStyle = 'rgba(110,104,96,0.45)'; ctx.lineWidth = 1.5;
    for (var r = 0; r < 4; r++) {
      var yy = r * size / 4; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(size, yy); ctx.stroke();
      for (var b = 0; b < 2; b++) { var xx = (b + (r % 2) * 0.5) * size / 2; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + size / 4); ctx.stroke(); }
    }
    return c;
  };
  // Arch face: the north/south faces of the Washington Square Arch mapped over 19.1 m × 23.5 m.
  // geometry passed in: {W, H, span, impost, crown, frieze0, frieze1, cornice, attic}
  TEX.archFace = function (A, side) {
    var W = 1024, H = Math.round(1024 * A.H / A.W), c = U.canvas(W, H), ctx = c.getContext('2d'), rnd = U.rng(side === 'north' ? 3 : 4);
    var kx = W / A.W, ky = H / A.H;
    function X(m) { return (m + A.W / 2) * kx; }
    function Y(m) { return H - m * ky; }
    ctx.drawImage(TEX.marble(512), 0, 0, W, H);
    ctx.fillStyle = 'rgba(255,250,240,0.25)'; ctx.fillRect(0, 0, W, H);
    // rusticated courses on the piers up to the impost
    ctx.strokeStyle = 'rgba(100,94,86,0.55)'; ctx.lineWidth = 2;
    for (var y = 0.9; y < A.impost; y += 0.75) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(X(-A.span / 2), Y(y)); ctx.moveTo(X(A.span / 2), Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); }
    // plinth
    ctx.fillStyle = 'rgba(150,144,134,0.5)'; ctx.fillRect(0, Y(0.9), W, 0.9 * ky);
    // pilaster-like vertical margins on the piers
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(X(-A.W / 2 + 0.6), Y(A.frieze0), 0.5 * kx, (A.frieze0 - 0.9) * ky); ctx.fillRect(X(A.W / 2 - 1.1), Y(A.frieze0), 0.5 * kx, (A.frieze0 - 0.9) * ky);
    // impost cornice band
    ctx.fillStyle = 'rgba(120,112,100,0.55)'; ctx.fillRect(0, Y(A.impost + 0.35), X(-A.span / 2), 0.35 * ky); ctx.fillRect(X(A.span / 2), Y(A.impost + 0.35), W, 0.35 * ky);
    // archivolt mouldings
    var cx = X(0), cy = Y(A.impost), r = A.span / 2 * kx;
    for (var k = 0; k < 4; k++) { ctx.strokeStyle = 'rgba(110,104,96,' + (0.5 - k * 0.08) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 8 + k * 9, Math.PI, 0); ctx.stroke(); }
    // keystone with scroll
    ctx.fillStyle = '#efe9dd'; ctx.beginPath(); ctx.moveTo(cx - 22, cy - r - 52); ctx.lineTo(cx + 22, cy - r - 52); ctx.lineTo(cx + 14, cy - r + 6); ctx.lineTo(cx - 14, cy - r + 6); ctx.fill();
    ctx.strokeStyle = 'rgba(90,84,76,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    // spandrel figures: winged Victories (relief) — soft shaded silhouettes
    function relief(draw) { // carved look: dark offset shadow, light body, highlight rim
      ctx.save(); ctx.translate(2, 3); ctx.fillStyle = 'rgba(90,82,72,0.35)'; draw(); ctx.restore();
      ctx.fillStyle = 'rgba(252,249,242,0.95)'; draw();
      ctx.save(); ctx.translate(-1, -1); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; draw(); ctx.restore();
    }
    function victory(sx, flip) {
      var s = kx * 1.0, cyy = Y(A.impost + (A.frieze0 - A.impost) * 0.5);
      ctx.save(); ctx.translate(sx, cyy); ctx.scale(flip, 1); ctx.rotate(-0.42);
      relief(function () {
        // reclining draped figure: torso, flowing drapery to the feet, head, arm holding a wreath/trumpet
        ctx.beginPath(); ctx.moveTo(-3.0 * s, -0.2 * s);
        ctx.quadraticCurveTo(-1.6 * s, -0.75 * s, 0.4 * s, -0.45 * s); ctx.quadraticCurveTo(2.0 * s, -0.25 * s, 3.1 * s, 0.25 * s);
        ctx.quadraticCurveTo(1.8 * s, 0.55 * s, 0.2 * s, 0.45 * s); ctx.quadraticCurveTo(-1.5 * s, 0.35 * s, -3.0 * s, -0.2 * s); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-3.25 * s, -0.45 * s, 0.32 * s, 0.38 * s, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2.9 * s, -0.6 * s); ctx.lineTo(-3.9 * s, -1.7 * s); ctx.lineTo(-3.75 * s, -1.8 * s); ctx.lineTo(-2.6 * s, -0.7 * s); ctx.fill();
        ctx.beginPath(); ctx.arc(-4.0 * s, -1.95 * s, 0.32 * s, 0, 7); ctx.fill();
        // wing: fan of long feathers rising behind the shoulders
        for (var f = 0; f < 7; f++) {
          var ang = -1.25 + f * 0.13, len = (2.0 + f * 0.22) * s;
          ctx.save(); ctx.translate(-1.9 * s, -0.55 * s); ctx.rotate(ang);
          ctx.beginPath(); ctx.ellipse(len / 2, 0, len / 2, 0.16 * s, 0, 0, 7); ctx.fill(); ctx.restore();
        }
      });
      ctx.restore();
    }
    victory(X(-A.span / 2 - 0.6), 1); victory(X(A.span / 2 + 0.6), -1);
    // frieze with eagle centre and garlands
    ctx.fillStyle = 'rgba(130,122,110,0.18)'; ctx.fillRect(0, Y(A.frieze1), W, (A.frieze1 - A.frieze0) * ky);
    ctx.fillStyle = 'rgba(100,94,86,0.6)'; ctx.fillRect(0, Y(A.frieze0) - 2, W, 4); ctx.fillRect(0, Y(A.frieze1) - 2, W, 4);
    ctx.strokeStyle = 'rgba(110,100,90,0.45)'; ctx.lineWidth = 3;
    for (var g = 0; g < 8; g++) { var gx = X(-A.W / 2 + 1 + g * (A.W - 2) / 8); ctx.beginPath(); ctx.moveTo(gx, Y(A.frieze1 - 0.4)); ctx.quadraticCurveTo(gx + 0.6 * kx, Y(A.frieze0 + 0.3), gx + 1.2 * kx * (A.W - 2) / 8 / 1.2, Y(A.frieze1 - 0.4)); ctx.stroke(); }
    // central eagle / shield in the frieze
    (function () {
      var ey = Y((A.frieze0 + A.frieze1) / 2);
      relief(function () {
        ctx.beginPath(); ctx.ellipse(cx, ey, 0.35 * kx, 0.55 * ky, 0, 0, 7); ctx.fill();
        for (var sd = -1; sd <= 1; sd += 2) for (var f = 0; f < 5; f++) { ctx.save(); ctx.translate(cx + sd * 0.25 * kx, ey - 0.1 * ky); ctx.rotate(sd * (0.25 + f * 0.22)); ctx.beginPath(); ctx.ellipse(sd * 0.75 * kx, 0, 0.75 * kx, 0.09 * ky, 0, 0, 7); ctx.fill(); ctx.restore(); }
      });
    })();
    // cornice: dentils
    ctx.fillStyle = 'rgba(90,84,76,0.65)'; ctx.fillRect(0, Y(A.cornice), W, 3);
    for (var dxx = 0; dxx < W; dxx += 9) ctx.fillRect(dxx, Y(A.cornice) + 4, 5, 8);
    // attic with inscription (south face) — Washington, 1787, public domain
    ctx.fillStyle = 'rgba(90,84,76,0.7)';
    ctx.font = 'bold ' + Math.round(0.42 * ky) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var ay = Y((A.cornice + A.H) / 2 + 0.1);
    if (side === 'south') {
      ctx.fillText('LET US RAISE A STANDARD TO WHICH THE WISE AND THE HONEST CAN REPAIR.', cx, ay - 0.32 * ky);
      ctx.fillText('THE EVENT IS IN THE HAND OF GOD.   WASHINGTON', cx, ay + 0.32 * ky);
    } else {
      ctx.fillText('WASHINGTON', cx, ay);
    }
    // attic panels
    ctx.strokeStyle = 'rgba(100,94,86,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(X(-A.W / 2 + 0.5), Y(A.H - 0.4), (A.W - 1) * kx, (A.H - 0.4 - A.cornice - 0.3) * ky);
    // weathering at the base and below the cornice
    var gb = ctx.createLinearGradient(0, Y(2), 0, H); gb.addColorStop(0, 'rgba(60,55,50,0)'); gb.addColorStop(1, 'rgba(60,55,50,0.25)'); ctx.fillStyle = gb; ctx.fillRect(0, Y(2), W, 2 * ky);
    return c;
  };
  // Coffered soffit for the arch's intrados: square coffers with rosettes. 1 m tiles.
  TEX.coffers = function () {
    var s = 256, c = U.canvas(s, s), ctx = c.getContext('2d');
    ctx.drawImage(TEX.marble(256), 0, 0);
    ctx.fillStyle = 'rgba(80,74,66,0.35)'; ctx.fillRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.64);
    ctx.fillStyle = 'rgba(90,84,76,0.3)'; ctx.fillRect(s * 0.18, s * 0.18, s * 0.64, s * 0.05);
    ctx.translate(s / 2, s / 2);
    for (var i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = 'rgba(120,112,100,0.45)'; ctx.beginPath(); ctx.ellipse(s * 0.12, 0, s * 0.12, s * 0.045, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(240,236,228,0.9)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.05, 0, 7); ctx.fill();
    return c;
  };
  // Leaf clumps for tree crowns (grayscale, tinted by vertex colour).
  TEX.leaves = function () {
    var s = 256, c = U.canvas(s, s), ctx = c.getContext('2d'), rnd = U.rng(21);
    ctx.fillStyle = 'rgba(60,60,60,0.0)'; ctx.fillRect(0, 0, s, s);
    // clusters of small leaves; darker underneath, light catching tops
    for (var k = 0; k < 140; k++) {
      var cx = rnd() * s, cy = rnd() * s, cr = 9 + rnd() * 14;
      for (var i = 0; i < 26; i++) {
        var a = rnd() * 6.283, d = Math.sqrt(rnd()) * cr, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = 2.2 + rnd() * 2.6;
        var L = 95 + (1 - d / cr) * 90 + (cy - y) / cr * 40 + rnd() * 40;
        ctx.fillStyle = 'rgb(' + (L | 0) + ',' + (L | 0) + ',' + (L | 0) + ')';
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var X = x + ox * s, Y = y + oy * s; if (X < -8 || Y < -8 || X > s + 8 || Y > s + 8) continue;
          ctx.beginPath(); ctx.ellipse(X, Y, r, r * 0.6, rnd() * 3, 0, 7); ctx.fill();
        }
      }
    }
    return c;
  };
  // London plane bark: camouflage patches.
  TEX.bark = function () {
    var s = 128, c = U.canvas(s, s), ctx = c.getContext('2d'), rnd = U.rng(31);
    ctx.fillStyle = 'rgb(200,196,170)'; ctx.fillRect(0, 0, s, s);
    var cols = ['rgb(150,140,110)', 'rgb(120,116,92)', 'rgb(220,214,190)', 'rgb(170,168,140)', 'rgb(110,100,80)'];
    for (var i = 0; i < 90; i++) {
      ctx.fillStyle = cols[(rnd() * cols.length) | 0];
      var x = rnd() * s, y = rnd() * s, r = 4 + rnd() * 12;
      for (var ox = -1; ox <= 1; ox++) { ctx.beginPath(); ctx.ellipse(x + ox * s, y, r, r * 1.4, 0, 0, 7); ctx.fill(); }
    }
    return c;
  };
  // Radial glow / light-pool sprite (white, alpha falloff).
  TEX.glow = function (size, hard) {
    var s = size || 128, c = U.canvas(s, s), ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard ? 0.25 : 0.12, 'rgba(255,255,255,' + (hard ? 0.8 : 0.55) + ')');
    g.addColorStop(0.5, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return c;
  };
  // Soft round blob (for AO/contact shadows and mist).
  TEX.blob = function (size) {
    var s = size || 64, c = U.canvas(s, s), ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return c;
  };

  // Midtown skyline silhouette strip (RGB = haze-lit silhouette, A = coverage) plus a light map of
  // windows for night. width spans `span` metres of horizon; heights in metres → px.
  TEX.skyline = function (seed, span, maxH) {
    var W = 2048, H = 512, c = U.canvas(W, H), ctx = c.getContext('2d'), lc = U.canvas(W, H), lctx = lc.getContext('2d');
    lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, H);
    var rnd = U.rng(seed), kx = W / span, ky = H / maxH, x = 0;
    var layers = [{ c: [150, 160, 176], f: 0.55 }, { c: [120, 130, 148], f: 0.8 }, { c: [96, 106, 124], f: 1.0 }];
    layers.forEach(function (L, li) {
      x = -rnd() * 20;
      while (x < W) {
        var bw = (14 + rnd() * 50) * kx * (li === 2 ? 0.8 : 1), bh = (20 + Math.pow(rnd(), 2.2) * (maxH * 0.55)) * ky * L.f;
        if (rnd() < 0.06 && li > 0) bh = (90 + rnd() * 90) * ky; // the occasional tower
        var col = jitter(L.c, rnd, 0.1);
        ctx.fillStyle = rgb(col[0], col[1], col[2]);
        ctx.fillRect(x, H - bh, bw, bh);
        if (rnd() < 0.25) { ctx.fillRect(x + bw * 0.3, H - bh - 8 * ky, bw * 0.4, 8 * ky); }
        if (rnd() < 0.08) { ctx.fillRect(x + bw * 0.48, H - bh - 30 * ky, 2, 30 * ky); }
        // windows
        for (var wy = H - bh + 4; wy < H - 4; wy += 5) for (var wx = x + 2; wx < x + bw - 2; wx += 4) {
          if (rnd() < 0.28) { lctx.fillStyle = rnd() < 0.8 ? 'rgba(255,214,150,0.9)' : 'rgba(210,230,255,0.9)'; lctx.fillRect(wx, wy, 2, 2); }
        }
        x += bw + rnd() * 6 * kx;
      }
    });
    return { color: c, lights: lc };
  };
  // The Empire State Building as a card: setbacks, mast. Height in px proportional (443 m).
  TEX.empireState = function () {
    var W = 256, H = 1024, c = U.canvas(W, H), ctx = c.getContext('2d'), lc = U.canvas(W, H), l = lc.getContext('2d');
    l.fillStyle = '#000'; l.fillRect(0, 0, W, H);
    var k = H / 443, cx = W / 2;
    function tier(w, y0, y1, col) { ctx.fillStyle = col; ctx.fillRect(cx - w / 2 * k, H - y1 * k, w * k, (y1 - y0) * k); }
    var stone = '#8f96a3';
    tier(56, 0, 25, '#7e8592'); tier(48, 25, 85, stone); tier(40, 85, 270, '#949ba8'); tier(32, 270, 320, '#9aa1ad');
    tier(26, 320, 365, '#a0a6b2'); tier(16, 365, 381, '#a6acb6'); tier(9, 381, 400, '#b0b5bd'); tier(4, 400, 420, '#b8bcc2'); tier(1.5, 420, 443, '#c0c2c6');
    // vertical piers
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (var i = -6; i <= 6; i++) ctx.fillRect(cx + i * 2.9 * k, H - 365 * k, 1.2, 280 * k);
    // night: lights + floodlit crown
    var rnd = U.rng(443);
    for (var y = 30; y < 360; y += 3.7) for (var x = -18; x <= 18; x += 3) {
      var w = y < 85 ? 24 : y < 270 ? 20 : y < 320 ? 16 : 13; if (Math.abs(x) > w) continue;
      if (rnd() < 0.35) { l.fillStyle = 'rgba(255,220,160,0.85)'; l.fillRect(cx + x * k, H - y * k, 2, 2); }
    }
    var g = l.createLinearGradient(0, H - 443 * k, 0, H - 320 * k);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,190,90,0.9)'); g.addColorStop(1, 'rgba(255,170,80,0.0)');
    l.fillStyle = g; l.fillRect(cx - 14 * k, H - 420 * k, 28 * k, 100 * k);
    return { color: c, lights: lc };
  };

  // Class glyph atlas for unit renderers: ● ▲ ■ in white with dark outline (row 0) and outline only (row 1).
  TEX.glyphAtlas = function (size) {
    var s = size || 128, c = U.canvas(s * 3, s * 2), ctx = c.getContext('2d');
    function shape(i, row) {
      var cx = i * s + s / 2, cy = row * s + s / 2, r = s * 0.36;
      ctx.beginPath();
      if (i === 0) ctx.arc(cx, cy, r, 0, Math.PI * 2);
      else if (i === 1) { ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r * 1.05, cy + r * 0.75); ctx.lineTo(cx - r * 1.05, cy + r * 0.75); ctx.closePath(); }
      else ctx.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
      ctx.lineJoin = 'round';
      if (row === 0) { ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = s * 0.07; ctx.strokeStyle = 'rgba(20,20,24,0.9)'; ctx.stroke(); }
      else { ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    }
    for (var i = 0; i < 3; i++) { shape(i, 0); shape(i, 1); }
    return c;
  };
  TEX.GLYPH_INDEX = { crowd: 0, talker: 1, heavy: 2 };

  // ---------------------------------------------------------------- materials & shader patching
  // Shared uniforms for every world material (time, night, fades).
  env.U = env.U || {
    uTime: { value: 0 }, uNight: { value: 0 }, uWind: { value: 1 }, uSat: { value: 0.88 },
    uFadeCam: { value: null }, uFadeFocus: { value: null }, uFadeAmt: { value: 0 }, uFadeR: { value: 14 },
    uCanopyPts: { value: null }, uCanopyAmt: { value: 0 }, uLampWave: { value: 0 }, uCityFog: { value: 0.0028 }
  };
  U.initUniforms = function () {
    var u = env.U;
    if (!u.uFadeCam.value) u.uFadeCam.value = new THREE.Vector3(0, 200, 200);
    if (!u.uFadeFocus.value) u.uFadeFocus.value = new THREE.Vector3(0, 0, 0);
    if (!u.uCanopyPts.value) u.uCanopyPts.value = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  };
  // Pick Standard on high, Lambert otherwise (cheap per-fragment lighting on phones).
  U.mat = function (p, force) {
    p = Object.assign({}, p);
    var std = force === 'standard' || (force !== 'lambert' && env.quality === 'high');
    if (!std) { delete p.roughness; delete p.metalness; delete p.envMapIntensity; delete p.roughnessMap; }
    else { if (p.roughness === undefined) p.roughness = 0.9; if (p.metalness === undefined) p.metalness = 0; }
    var m = std ? new THREE.MeshStandardMaterial(p) : new THREE.MeshLambertMaterial(p);
    return m;
  };
  var GLSL_COMMON = [
    'uniform float uTime; uniform float uNight; uniform float uWind; uniform float uSat;',
    'uniform vec3 uFadeCam; uniform vec3 uFadeFocus; uniform float uFadeAmt; uniform float uFadeR;',
    'uniform vec4 uCanopyPts[4]; uniform float uCanopyAmt; uniform float uLampWave; uniform float uCityFog;',
    'varying vec3 vSqW; varying float vSqFade;',
    'float sqHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  ].join('\n');
  var GLSL_BAYER = [
    'float sqBayer(vec2 p){ ivec2 q = ivec2(mod(floor(p), 4.0)); int i = q.x + q.y * 4;',
    ' float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);',
    ' return (m[i] + 0.5) / 16.0; }'
  ].join('\n');
  // o: { see:bool (see-through cylinder), canopy:bool (instance fade), wind:float (sway amount),
  //      vert(sh), frag(sh): extra injectors, key:string, noDesat }
  U.patch = function (mat, o) {
    o = o || {};
    var key = 'sq|' + (o.key || '') + '|' + (o.see ? 's' : '') + (o.canopy ? 'c' : '') + (o.wind ? 'w' : '') + (o.noDesat ? 'n' : '');
    mat.customProgramCacheKey = function () { return key; };
    mat.onBeforeCompile = function (sh) {
      var U2 = env.U;
      ['uTime', 'uNight', 'uWind', 'uSat', 'uFadeCam', 'uFadeFocus', 'uFadeAmt', 'uFadeR', 'uCanopyPts', 'uCanopyAmt', 'uLampWave', 'uCityFog'].forEach(function (n) { sh.uniforms[n] = U2[n]; });
      var v = sh.vertexShader, f = sh.fragmentShader;
      v = v.replace('#include <common>', '#include <common>\n' + GLSL_COMMON + '\n' + (o.vertHead || ''));
      var bv = '#include <begin_vertex>\n';
      if (o.wind) {
        bv += [
          '{ vec3 sqIP = vec3(0.0);',
          '#ifdef USE_INSTANCING',
          ' sqIP = instanceMatrix[3].xyz;',
          '#endif',
          ' float sqH = max(position.y - 2.5, 0.0);',
          ' float sqPh = uTime * 1.1 + sqIP.x * 0.31 + sqIP.z * 0.17;',
          ' transformed.x += (sin(sqPh) + 0.4 * sin(sqPh * 2.7 + position.y)) * sqH * 0.010 * uWind * ' + o.wind.toFixed(3) + ';',
          ' transformed.z += cos(sqPh * 0.8 + 1.3) * sqH * 0.008 * uWind * ' + o.wind.toFixed(3) + '; }'
        ].join('\n');
      }
      if (o.vertBegin) bv += o.vertBegin + '\n';
      v = v.replace('#include <begin_vertex>', bv);
      var pv = '#include <project_vertex>\n{ vec4 sqW4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n sqW4 = instanceMatrix * sqW4;\n#endif\n sqW4 = modelMatrix * sqW4; vSqW = sqW4.xyz; }\n vSqFade = 0.0;\n';
      if (o.canopy) {
        pv += [
          '{ vec3 sqC = vec3(0.0);',
          '#ifdef USE_INSTANCING',
          ' sqC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
          '#else',
          ' sqC = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
          '#endif',
          ' float sqF = 0.0;',
          ' for (int i = 0; i < 4; i++) { vec4 fp = uCanopyPts[i]; if (fp.w > 0.0) sqF = max(sqF, 1.0 - smoothstep(fp.w * 0.65, fp.w, distance(sqC.xz, fp.xz))); }',
          ' // crowns on the sightline camera→focus also clear',
          ' if (uFadeAmt > 0.001) { vec3 sqD = uFadeFocus - uFadeCam; vec3 sqCC = sqC + vec3(0.0, 9.0, 0.0); float sqT = clamp(dot(sqCC - uFadeCam, sqD) / max(dot(sqD, sqD), 1e-3), 0.0, 1.0);',
          '   float sqDD = distance(sqCC, uFadeCam + sqD * sqT); sqF = max(sqF, (1.0 - smoothstep(6.0, 10.0, sqDD)) * (1.0 - smoothstep(0.85, 1.0, sqT)) * uFadeAmt); }',
          ' vSqFade = sqF * uCanopyAmt; }'
        ].join('\n');
      }
      if (o.vertEnd) pv += o.vertEnd + '\n';
      v = v.replace('#include <project_vertex>', pv);
      f = f.replace('#include <common>', '#include <common>\n' + GLSL_COMMON + '\n' + GLSL_BAYER + '\n' + (o.fragHead || ''));
      var clip = '#include <clipping_planes_fragment>\n';
      if (o.canopy) clip += 'if (vSqFade > 0.001 && sqBayer(gl_FragCoord.xy) < vSqFade) discard;\n';
      if (o.see) clip += [
        'if (uFadeAmt > 0.001) { vec3 sqD = uFadeFocus - uFadeCam; float sqT = clamp(dot(vSqW - uFadeCam, sqD) / max(dot(sqD, sqD), 1e-3), 0.0, 1.0);',
        ' float sqDD = distance(vSqW, uFadeCam + sqD * sqT);',
        ' float sqS = uFadeAmt * (1.0 - smoothstep(uFadeR * 0.55, uFadeR, sqDD)) * (1.0 - smoothstep(0.8, 0.95, sqT)) * step(1.5, vSqW.y);',
        ' if (sqS > 0.001 && sqBayer(gl_FragCoord.xy) < sqS * 0.75) discard; }'
      ].join('\n') + '\n';
      f = f.replace('#include <clipping_planes_fragment>', clip);
      if (o.frag) f = o.frag(f);
      // aerial perspective: haze grows with distance from the park (camera-independent), on top of scene fog
      f = f.replace('#include <fog_fragment>', '#include <fog_fragment>\n#ifdef USE_FOG\n{ float sqFd = max(length(vSqW.xz - vec2(-14.0, 0.0)) - 185.0, 0.0); float sqFf = 1.0 - exp(-uCityFog * uCityFog * sqFd * sqFd); gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, sqFf * 0.92); }\n#endif');
      if (!o.noDesat) f = f.replace('#include <tonemapping_fragment>', '{ float sqL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor.rgb = mix(vec3(sqL), gl_FragColor.rgb, uSat); }\n#include <tonemapping_fragment>');
      sh.vertexShader = v; sh.fragmentShader = f;
      if (o.uniforms) Object.keys(o.uniforms).forEach(function (k) { sh.uniforms[k] = o.uniforms[k]; });
    };
    return mat;
  };
})(window.SQ = window.SQ || {});
