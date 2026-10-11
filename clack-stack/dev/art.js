/* CLACK STACK: the Art module.
 *
 * One global: `const Art`. Everything is drawn in code (Canvas 2D), nothing is loaded.
 * Contract: clack-stack/dev/BUILD.md ("The Art API (exact)").
 *
 * Conventions used here (read with BUILD.md):
 *  - All coordinates are CSS px. The caller has set ctx.setTransform(dpr,0,0,dpr,0,0)
 *    (plus maybe a shake translate). Every function save()s/restore()s.
 *  - groundY passed to resize/drawRoom/drawRug/drawLight is the UNSCROLLED ground line;
 *    on screen the ground line is at groundY + camY (camY >= 0 = camera scrolled up).
 *    drawFoot/drawShadowBlob/drawCar take plain screen coordinates.
 *  - Static layers are cached: rug texture (once), floor warp + room + sky (per resize),
 *    tile/car/ring/gear/icon sprites on a 5% size ladder keyed by integers.
 *  - Art never touches the game's RNG: it has its own seeded mulberry32.
 */
const Art = (() => {
  'use strict';

  /* ---------------------------------------------------------------- palette */
  const TILE_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'lightBlue', 'purple'];
  const PAL = {
    // tiles
    red: '#E8323C', orange: '#FF7A1A', yellow: '#FFD21F', green: '#2EBF4F',
    blue: '#2F5BEA', lightBlue: '#5EC8F2', purple: '#8A4FE0',
    // pieces
    ring: '#D6247F', marble: '#B9A3F0', gear: '#7CC23A',
    // sleeve
    sleeve: '#1E2541', stripeYellow: '#E8C547', stripeBlue: '#8FA6C9',
    // rug
    rugCream: '#EDE3D3', rugRust: '#D9793F', rugSalmon: '#E5A487', rugPaleBlue: '#A9BFD0',
    rugSlate: '#7F99B3', rugPink: '#E3A3A8',
    // room
    wall: '#F2EEE8', floor: '#9C7B5E', eggChair: '#F7F5F0', armchair: '#B3244A', armchairLegs: '#C99A64',
    // ui / sky
    navy: '#1E2541', gold: '#FFC531', night: '#1B2140', moon: '#F6F1D9', white: '#FFFFFF',
    skin: '#F3C9A8', skinShade: '#DFA286', marker: '#D9333B',
  };
  // deeper shade of each tile colour, used for frames (tuned against the photos)
  const FRAME = {
    red: '#A11526', orange: '#D14A09', yellow: '#E3A200', green: '#13903A',
    blue: '#19349E', lightBlue: '#2593CF', purple: '#6430BB', crown: '#E04A00',
  };
  // the multiply "filter" colour of each body: PAL hue, a touch deeper where the photos'
  // plastic is deeper than the spec swatch (red, blue); the crown is the most vivid piece
  const BODY = {
    red: '#E02634', orange: '#FF7A1A', yellow: '#FFD21F', green: '#2EBF4F',
    blue: '#2A52E0', lightBlue: '#5EC8F2', purple: '#8A4FE0', crown: '#FF5A00',
  };
  const BODY_A = 0.84, CROWN_A = 0.9;
  // lookup tables without a prototype: a caller's 'toString' or 'constructor' is just unknown
  const table = (o) => Object.assign(Object.create(null), o);
  const COLOR_IDX = table({ red: 0, orange: 1, yellow: 2, green: 3, blue: 4, lightBlue: 5, purple: 6 });
  const SHAPE_IDX = table({ sq: 0, tri: 1, cube: 2, marble: 3, crown: 4 });
  const SHAPES = ['sq', 'tri', 'cube', 'marble', 'crown'];

  /* ---------------------------------------------------------------- utils */
  const SQ3 = Math.sqrt(3);
  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // argument guards: every entry point returns quietly on NaN / Infinity / absurd sizes
  const fin = Number.isFinite;
  const okL = (L) => L >= 1 && L < 1e5;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(r, g, b) {
    return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) |
      clamp(Math.round(b), 0, 255)).toString(16).slice(1);
  }
  function mix(h1, h2, t) {
    const a = rgbOf(h1), b = rgbOf(h2);
    return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  const lighten = (h, t) => mix(h, '#ffffff', t);
  const darken = (h, t) => mix(h, '#000000', t);
  function rgba(h, a) {
    const c = rgbOf(h);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // closed polygon with rounded corners; pts = flat [x0,y0,x1,y1,...]
  function polyPath(g, pts, r) {
    const n = pts.length >> 1;
    const lx = pts[2 * n - 2], ly = pts[2 * n - 1];
    g.moveTo((pts[0] + lx) / 2, (pts[1] + ly) / 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (r > 0) g.arcTo(pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1], r);
      else g.lineTo(pts[2 * i], pts[2 * i + 1]);
    }
    g.closePath();
  }
  function rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // outline of a sq/tri shape about its centroid, inset by d (CSS px)
  function shapePts(shape, L, d) {
    if (shape === 'tri' || shape === 'crown') {
      const R = L / SQ3, k = (R / 2 - d) / (R / 2);
      return [0, -R * k, (L / 2) * k, (R / 2) * k, (-L / 2) * k, (R / 2) * k];
    }
    const h = L / 2 - d;
    return [-h, -h, h, -h, h, h, -h, h];
  }

  /* ---------------------------------------------------------------- state */
  let DPR = 1;       // device px per CSS px, from resize()
  let SPR = 1;       // sprite raster scale: DPR capped at 2 (phone memory; sprites are small)
  let curDim = 0;    // night dimming of the room from the last drawRoom (0 day .. 1 night), quantised

  // a canvas we are done with: zero it so mobile Safari releases its backing store now, not at GC
  function freeCanvas(c) { if (c) { c.width = 0; c.height = 0; } }

  /* ------------------------------------------------------- sprite cache
   * Sprites live on a 5% size ladder so a zoom ease reuses a handful of sizes; the
   * nearest cached rung is drawn scaled while new rungs build under a per-frame budget.
   * The cache is capped in BYTES; eviction drops sprites not used in the last two frames,
   * farthest from the current tile size first, and zeroes their canvases.
   */
  const LADDER = Math.log(1.05);
  // sprites above ~220 CSS px are drawn scaled from the 220 px rung (keeps memory bounded)
  const Q_MAX = Math.round(Math.log(220) / LADDER);
  const qOf = (L) => Math.min(Q_MAX, Math.round(Math.log(Math.max(2, L)) / LADDER));
  const Lof = (q) => Math.exp(q * LADDER);
  const cache = new Map();
  // sprite builds get a time budget per frame; drawRoom() marks a new frame (with a
  // time-window fallback for screens that skip it)
  const BUILD_MS = 3, MAX_BYTES = 40 * 1024 * 1024;
  let frameT = -1e9, frameBuildMs = 0, frameNo = 0, curQ = 0, cacheBytes = 0, evictFrame = -1;
  function frameMark() { frameT = performance.now(); frameBuildMs = 0; frameNo++; }
  function canBuild() {
    if (performance.now() - frameT > 16) frameMark();
    return frameBuildMs < BUILD_MS;
  }
  function evict() {
    if (evictFrame === frameNo) return; // at most one scan per frame
    evictFrame = frameNo;
    const list = [];
    for (const s of cache.values()) if (s.u < frameNo - 1) list.push(s);
    list.sort((a, b) => (Math.abs(b.q - curQ) - Math.abs(a.q - curQ)) || (a.u - b.u));
    // gradual: freeing canvases is synchronous work, so at most 40 per frame (no hitch)
    const target = MAX_BYTES * 0.9;
    for (let i = 0; i < list.length && i < 40 && cacheBytes > target; i++) {
      const s = list[i];
      cache.delete(s.key); cacheBytes -= s.bytes;
      freeCanvas(s.c); s.c = null;
    }
  }
  function clearCache() {
    for (const s of cache.values()) { freeCanvas(s.c); s.c = null; }
    cache.clear(); cacheBytes = 0;
  }
  function store(key, q, spr) {
    spr.key = key; spr.q = q; spr.u = frameNo; spr.bytes = spr.c.width * spr.c.height * 4;
    cache.set(key, spr);
    cacheBytes += spr.bytes;
    if (cacheBytes > MAX_BYTES) evict();
    return spr;
  }
  function neighbour(key) {
    for (let k = 1; k <= 24; k++) {
      const s = cache.get(key - k) || cache.get(key + k);
      if (s) { s.u = frameNo; return s; }
    }
    return null;
  }
  // key = base * 512 + q ; base packs kind/shape/colour/variant. May return null (no memory).
  function getSprite(base, q, builder, a, b, c, d) {
    const key = base * 512 + q;
    let s = cache.get(key);
    if (s) { s.u = frameNo; return s; }
    // over budget: draw the nearest cached rung scaled, build this one in a later frame
    if (!canBuild() && (s = neighbour(key))) return s;
    const t0 = performance.now();
    s = builder(Lof(q), a, b, c, d);
    // the raster happens at first use, outside this timing: charge about twice the recording
    frameBuildMs += Math.max(0.6, 2 * (performance.now() - t0));
    // no canvas memory left (getContext returned null): make do with a cached neighbour
    return s ? store(key, q, s) : neighbour(key);
  }
  // sprite object: canvas c, offset of the anchor (ox,oy) and size (w,h) in CSS px at size L.
  // Returns null when the browser refuses a 2D context (iOS canvas-memory cap).
  function makeSprite(L, minx, miny, maxx, maxy, pad) {
    const w = maxx - minx + 2 * pad, h = maxy - miny + 2 * pad;
    const c = mkCanvas(w * SPR, h * SPR);
    const g = c.getContext('2d');
    if (!g) { freeCanvas(c); return null; }
    g.scale(c.width / w, c.height / h);
    g.translate(pad - minx, pad - miny);
    return { c, g, ox: pad - minx, oy: pad - miny, w, h, L, key: 0, q: 0, u: 0, bytes: 0, rot: 0 };
  }
  function blit(ctx, s, L) {
    if (!s) return;
    const f = L / s.L;
    ctx.drawImage(s.c, -s.ox * f, -s.oy * f, s.w * f, s.h * f);
  }
  function finish(s) { s.g = null; return s; }
  // rotate, but exact quarter turns (and near-misses within 0.002 rad) become pure
  // axis-aligned matrices: software rasterisers take a much faster path for those
  function rotQ(ctx, rot) {
    if (!quarter(ctx, rot)) ctx.rotate(rot);
  }
  // applies rot if it is (within 0.002 rad of) a quarter turn and returns true; else false
  function quarter(ctx, rot) {
    if (rot === 0) return true;
    const k = Math.round(rot / HALF_PI), r = rot - k * HALF_PI;
    if (!(r > -0.002 && r < 0.002)) return false;
    switch (k & 3) {
      case 1: ctx.transform(0, 1, -1, 0, 0, 0); break;
      case 2: ctx.scale(-1, -1); break;
      case 3: ctx.transform(0, -1, 1, 0, 0, 0); break;
      default: break;
    }
    return true;
  }

  /* Pre-rotated sprites for tiles that lie still. A rotated blit costs ~15x an axis-aligned
   * one in a software rasteriser (headless CI, GPU-blocklisted phones). A sprite asked for at
   * exactly the same angle on every frame for 4+ frames, e.g. sleeping debris, is rendered
   * rotated once into its own canvas (same byte-capped cache) and from then on blitted
   * axis-aligned. Anything turning, even slowly, takes the normal path at its exact angle
   * (no stepping); so do tiles during a zoom ease (their sprite rung changes every few frames).
   */
  const RSTEP = Math.PI / 360, ROT_STILL = 4;
  // stillness tracker: a fixed open table (no per-frame allocation); a collision just resets
  // a slot, which only delays a still tile by a few frames
  const RT_N = 4093;
  const rtKey = new Float64Array(RT_N), rtRot = new Float64Array(RT_N);
  const rtFirst = new Int32Array(RT_N), rtLast = new Int32Array(RT_N);
  function heldStill(key, rot) {
    const h = -key % RT_N;
    if (rtKey[h] !== key || rtLast[h] < frameNo - 1 || Math.abs(rtRot[h] - rot) > 1e-4) {
      rtKey[h] = key; rtRot[h] = rot; rtFirst[h] = frameNo; rtLast[h] = frameNo;
      return false;
    }
    rtLast[h] = frameNo;
    return frameNo - rtFirst[h] >= ROT_STILL;
  }
  function rotatedSprite(s, rot, L) {
    let rq = Math.round(rot / RSTEP) % 720;
    if (rq < 0) rq += 720;
    const key = -(s.key * 1024 + rq) - 1; // negative: never collides with plain sprite keys
    let r = cache.get(key);
    if (r && Math.abs(r.rot - rot) <= 1e-4) { r.u = frameNo; return r; }
    if (!heldStill(key, rot)) return null;
    if (r) {
      // the bucket holds another angle: keep it while it is in use, else hand it over
      if (r.u >= frameNo - 1) return null;
      cache.delete(key); cacheBytes -= r.bytes; freeCanvas(r.c); r.c = null;
    }
    if (!canBuild()) return null;
    const f = L / s.L, a = rot, ca = Math.cos(a), sa = Math.sin(a);
    const x0 = -s.ox * f, y0 = -s.oy * f, x1 = x0 + s.w * f, y1 = y0 + s.h * f;
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? x1 : x0, y = k & 2 ? y1 : y0;
      const X = x * ca - y * sa, Y = x * sa + y * ca;
      if (X < mnx) mnx = X; if (X > mxx) mxx = X; if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
    }
    const t0 = performance.now();
    const pad = 1;
    const c = mkCanvas((mxx - mnx + 2 * pad) * SPR, (mxy - mny + 2 * pad) * SPR);
    const g = c.getContext('2d');
    if (!g) { freeCanvas(c); return null; }
    const w = c.width / SPR, h = c.height / SPR;
    g.setTransform(SPR, 0, 0, SPR, (pad - mnx) * SPR, (pad - mny) * SPR);
    g.rotate(a);
    g.drawImage(s.c, x0, y0, s.w * f, s.h * f);
    // the rotated raster runs at the first blit, inside the frame: charge it by area
    frameBuildMs += Math.max(0.3, 2 * (performance.now() - t0), c.width * c.height * 4e-5);
    r = { c, g: null, ox: pad - mnx, oy: pad - mny, w, h, L, key: 0, q: s.q, u: 0, bytes: 0, rot };
    return store(key, s.q, r);
  }
  // blit sprite s at size L, rotated by rr (a general angle, or 0)
  function blitR(ctx, s, L, rr) {
    if (!s) return;
    if (rr === 0) { blit(ctx, s, L); return; }
    const r = rotatedSprite(s, rr, L);
    if (r) { blit(ctx, r, L); return; }
    ctx.save(); ctx.rotate(rr); blit(ctx, s, L); ctx.restore();
  }

  /* ---------------------------------------------------------------- tiles */
  const K_BODY = 0, K_DETAIL = 1, K_NIGHT = 2, K_WHITE = 4, K_RIM = 5; // (3: the old separate night glow, now baked into K_NIGHT)
  // emboss pattern variants per shape
  function patternOf(shape, color, variant) {
    const v = Math.abs(variant | 0);
    if (shape === 'sq') return color === 'orange' ? 3 : v % 3; // 0 inset+logo, 1 big inset, 2 plain, 3 X-diamond
    if (shape === 'tri') return v % 2;
    return 0;
  }

  function shapeBounds(shape, L) {
    if (shape === 'tri' || shape === 'crown') { const R = L / SQ3; return [-L / 2, -R, L / 2, R / 2]; }
    if (shape === 'cube') return [-L * (1 + 2 * CUBE_KX), -L * (1 + 2 * CUBE_KY), L, L];
    return [-L / 2, -L / 2, L / 2, L / 2];
  }

  function bodyGrad(g, base, L, a) {
    const gr = g.createLinearGradient(-L / 2, -L / 2, L / 2, L / 2);
    gr.addColorStop(0, rgba(lighten(base, 0.12), a));
    gr.addColorStop(1, rgba(darken(base, 0.08), a));
    return gr;
  }

  const NIGHT_PAD = 0.24; // glow halo around night sprites, in L
  function buildTile(L, kind, shape, color, pat) {
    if (shape === 'cube') return buildCube(L, kind);
    const bb = shapeBounds(shape, L);
    const pad = kind === K_NIGHT ? Math.ceil(NIGHT_PAD * L + 2) : 2;
    const s = makeSprite(L, bb[0], bb[1], bb[2], bb[3], pad);
    if (!s) return null;
    const g = s.g;
    const crown = shape === 'crown';
    const base = crown ? BODY.crown : BODY[color];
    const r = 0.07 * L;
    const outer = shapePts(shape, L, 0);
    if (kind === K_BODY) {
      g.fillStyle = bodyGrad(g, base, L, crown ? CROWN_A : BODY_A);
      g.beginPath(); polyPath(g, outer, r); g.fill();
      // the rim plastic is thicker: a denser band under the frame
      g.fillStyle = rgba(base, 0.22);
      g.beginPath(); polyPath(g, outer, r); polyPath(g, shapePts(shape, L, 0.1 * L), r * 0.5); g.fill('evenodd');
      if (shape === 'marble') marbleBody(g, L, false);
    } else if (kind === K_NIGHT) {
      // lit glass against a dark sky, drawn source-over: the glow halo is baked in under
      // the body so a night tile is ONE blit (two blits plus 'screen' cost 3x in software)
      const nb = PAL[crown ? 'orange' : color];
      g.save();
      g.shadowColor = rgba(lighten(nb, 0.25), 0.85);
      g.shadowBlur = 0.22 * L * SPR;
      g.fillStyle = rgba(lighten(nb, 0.35), 0.5);
      g.beginPath(); polyPath(g, outer, r); g.fill();
      g.restore();
      g.fillStyle = bodyGrad(g, lighten(nb, 0.04), L, 0.8);
      g.beginPath(); polyPath(g, outer, r); g.fill();
      g.fillStyle = rgba(lighten(nb, 0.1), 0.15);
      g.beginPath(); polyPath(g, outer, r); polyPath(g, shapePts(shape, L, 0.1 * L), r * 0.5); g.fill('evenodd');
      if (shape === 'marble') marbleBody(g, L, true);
    } else if (kind === K_DETAIL) {
      tileDetail(g, shape, color, pat, L);
    } else if (kind === K_WHITE) {
      g.fillStyle = '#ffffff';
      g.beginPath(); polyPath(g, outer, r); g.fill();
      if (shape === 'marble') { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, 0.2 * L, 0, TAU); g.fill(); }
    } else if (kind === K_RIM) {
      g.fillStyle = 'rgba(255,40,48,0.16)';
      g.beginPath(); polyPath(g, outer, r); g.fill();
      g.fillStyle = 'rgba(255,34,44,0.95)';
      g.beginPath(); polyPath(g, outer, r); polyPath(g, shapePts(shape, L, 0.11 * L), r * 0.5); g.fill('evenodd');
    }
    return finish(s);
  }

  function marbleBody(g, L, night) {
    // lavender-frosted, porthole cut clean through
    g.fillStyle = rgba(PAL.marble, night ? 0.25 : 0.28);
    g.beginPath(); polyPath(g, shapePts('sq', L, 0), 0.07 * L); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(0, 0, 0.2 * L, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  // embossed line: shadow below-right, highlight above-left
  function embossStroke(g, fc, L, pathFn) {
    const o = Math.max(0.6, 0.012 * L);
    g.lineWidth = Math.max(0.8, 0.022 * L);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.save(); g.translate(o, o); g.strokeStyle = rgba(darken(fc, 0.25), 0.34); g.beginPath(); pathFn(); g.stroke(); g.restore();
    g.save(); g.translate(-o * 0.7, -o * 0.7); g.strokeStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); pathFn(); g.stroke(); g.restore();
  }

  function rivet(g, x, y, rr, fc) {
    g.fillStyle = rgba(lighten(fc, 0.45), 0.9);
    g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.fillStyle = rgba(darken(fc, 0.3), 0.55);
    g.beginPath(); g.arc(x + rr * 0.3, y + rr * 0.3, rr * 0.55, 0, TAU); g.fill();
  }

  function tileDetail(g, shape, color, pat, L) {
    const isTri = shape === 'tri' || shape === 'crown';
    const fc = shape === 'crown' ? FRAME.crown : FRAME[color];
    const base = shape === 'crown' ? PAL.orange : PAL[color];
    const fw = 0.09 * L, r = 0.07 * L;
    const outer = shapePts(shape, L, 0), inner = shapePts(shape, L, fw);
    // frame
    g.fillStyle = rgba(fc, 0.9);
    g.beginPath(); polyPath(g, outer, r); polyPath(g, inner, r * 0.4); g.fill('evenodd');
    // bevel: bright inner lip + dark outer edge
    g.lineWidth = Math.max(0.7, 0.016 * L);
    g.strokeStyle = rgba(lighten(base, 0.55), 0.55);
    g.beginPath(); polyPath(g, inner, r * 0.4); g.stroke();
    g.strokeStyle = rgba(darken(fc, 0.35), 0.5);
    g.beginPath(); polyPath(g, shapePts(shape, L, 0.006 * L), r); g.stroke();
    // magnet pockets: two per edge, darker slots inside the frame band
    const n = outer.length >> 1;
    g.fillStyle = rgba(darken(fc, 0.5), 0.5);
    for (let i = 0; i < n; i++) {
      const x0 = outer[2 * i], y0 = outer[2 * i + 1];
      const j = (i + 1) % n, x1 = outer[2 * j], y1 = outer[2 * j + 1];
      const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const nx = -uy, ny = ux; // inward for clockwise-on-screen polygons
      const ang = Math.atan2(uy, ux);
      for (let k = 0; k < 2; k++) {
        const t = isTri ? (k ? 0.68 : 0.32) : (k ? 0.72 : 0.28);
        const px = x0 + ux * len * t + nx * fw * 0.5, py = y0 + uy * len * t + ny * fw * 0.5;
        g.save(); g.translate(px, py); g.rotate(ang);
        g.beginPath(); rrect(g, -0.11 * L, -0.019 * L, 0.22 * L, 0.038 * L, 0.012 * L); g.fill();
        g.restore();
      }
    }
    // rivets at the corners and edge middles
    const rr = Math.max(0.7, 0.03 * L);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ix = inner[2 * i], iy = inner[2 * i + 1];
      const ox = outer[2 * i], oy = outer[2 * i + 1];
      rivet(g, lerp(ox, ix, 0.62), lerp(oy, iy, 0.62), rr, fc);
      const mx = (outer[2 * i] + outer[2 * j]) / 2, my = (outer[2 * i + 1] + outer[2 * j + 1]) / 2;
      const mix2 = (inner[2 * i] + inner[2 * j]) / 2, miy = (inner[2 * i + 1] + inner[2 * j + 1]) / 2;
      rivet(g, lerp(mx, mix2, 0.5), lerp(my, miy, 0.5), rr * 0.8, fc);
    }
    // embossed pattern
    if (isTri) {
      const R = L / SQ3, k = 0.42;
      const tri = [0, -R * k, (L / 2) * k, (R / 2) * k, (-L / 2) * k, (R / 2) * k];
      embossStroke(g, fc, L, () => {
        polyPath(g, tri, 0.02 * L);
        if (pat === 0 || shape === 'crown') {
          const ii = shapePts(shape, L, fw * 1.1);
          for (let i = 0; i < 3; i++) { g.moveTo(ii[2 * i], ii[2 * i + 1]); g.lineTo(tri[2 * i], tri[2 * i + 1]); }
        }
      });
      g.fillStyle = rgba(lighten(base, 0.4), 0.55);
      g.beginPath(); g.arc(0, 0, 0.05 * L, 0, TAU); g.fill();
      g.strokeStyle = rgba(darken(fc, 0.2), 0.45); g.lineWidth = Math.max(0.6, 0.014 * L);
      g.beginPath(); g.arc(0, 0, 0.05 * L, 0, TAU); g.stroke();
    } else if (shape === 'marble') {
      marbleDetail(g, L, fc, base);
    } else if (pat === 3) {
      const a = L / 2 - fw * 1.05;
      embossStroke(g, fc, L, () => {
        g.moveTo(-a, -a); g.lineTo(a, a); g.moveTo(a, -a); g.lineTo(-a, a);
        g.moveTo(0, -a); g.lineTo(a, 0); g.lineTo(0, a); g.lineTo(-a, 0); g.closePath();
        g.moveTo(0, -a); g.lineTo(0, a); g.moveTo(-a, 0); g.lineTo(a, 0);
      });
      g.fillStyle = rgba(lighten(base, 0.45), 0.5);
      g.beginPath(); g.arc(0, 0, 0.045 * L, 0, TAU); g.fill();
    } else {
      const ins = pat === 1 ? 0.3 * L : 0.24 * L;
      if (pat !== 2) {
        embossStroke(g, fc, L, () => { rrect(g, -L / 2 + ins, -L / 2 + ins, L - 2 * ins, L - 2 * ins, 0.03 * L); });
      }
      // little moulded logo mark in the middle
      g.strokeStyle = rgba(darken(fc, 0.1), 0.3); g.lineWidth = Math.max(0.6, 0.012 * L);
      g.beginPath(); g.arc(0, 0, 0.032 * L, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(-0.012 * L, -0.012 * L, 0.012 * L, 0, TAU); g.fill();
    }
    // gloss: soft diagonal streak + bright top-left edge, clipped to the tile
    g.save();
    g.beginPath(); polyPath(g, outer, r); g.clip();
    const gl = g.createLinearGradient(-L * 0.55, -L * 0.55, L * 0.2, L * 0.2);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.42, 'rgba(255,255,255,0.0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.26)');
    gl.addColorStop(0.62, 'rgba(255,255,255,0.05)');
    gl.addColorStop(0.7, 'rgba(255,255,255,0)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.fillRect(-L, -L, 2 * L, 2 * L);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.42)';
    g.lineWidth = Math.max(0.7, 0.018 * L);
    g.beginPath();
    if (isTri) { const R = L / SQ3; g.moveTo(-L / 2 + 0.06 * L, R / 2 - 0.08 * L); g.lineTo(-0.03 * L, -R + 0.1 * L); }
    else { const a = L / 2 - 0.012 * L; g.moveTo(-a, a - 0.12 * L); g.lineTo(-a, -a + r * 0.6); g.arcTo(-a, -a, -a + r, -a, r * 0.7); g.lineTo(a - 0.12 * L, -a); }
    g.stroke();
    if (shape === 'crown') {
      // the crown always wears a faint gold rim, so it reads as THE piece even at rest
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,197,49,0.75)';
      g.lineWidth = Math.max(1, 0.035 * L);
      g.beginPath(); polyPath(g, shapePts(shape, L, 0.012 * L), r); g.stroke();
      g.strokeStyle = 'rgba(255,240,180,0.6)';
      g.lineWidth = Math.max(0.7, 0.014 * L);
      g.beginPath(); polyPath(g, shapePts(shape, L, fw + 0.01 * L), r * 0.4); g.stroke();
    }
  }

  function marbleDetail(g, L, fc, base) {
    // porthole: raised ring around a clean hole, a ring of screw dots, corner screws
    const hr = 0.2 * L;
    g.lineWidth = 0.06 * L;
    g.strokeStyle = rgba(lighten(base, 0.25), 0.55);
    g.beginPath(); g.arc(0, 0, hr + 0.03 * L, 0, TAU); g.stroke();
    g.lineWidth = Math.max(0.7, 0.016 * L);
    g.strokeStyle = rgba(darken(fc, 0.25), 0.7);
    g.beginPath(); g.arc(0, 0, hr, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(0, 0, hr + 0.065 * L, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    embossStroke(g, fc, L, () => { g.arc(0, 0, 0.34 * L, 0, TAU); });
    const dr = Math.max(0.7, 0.024 * L);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.31;
      rivet(g, Math.cos(a) * 0.29 * L, Math.sin(a) * 0.29 * L, dr, fc);
    }
    const c = 0.3 * L;
    for (let i = 0; i < 4; i++) {
      const x = i & 1 ? c : -c, y = i & 2 ? c : -c;
      g.fillStyle = rgba(darken(fc, 0.45), 0.6);
      g.beginPath(); g.arc(x, y, 0.035 * L, 0, TAU); g.fill();
      g.strokeStyle = rgba(lighten(base, 0.5), 0.6); g.lineWidth = Math.max(0.6, 0.012 * L);
      g.beginPath(); g.arc(x, y, 0.05 * L, 0, TAU); g.stroke();
    }
  }

  /* ---------------------------------------------------------------- cube
   * Photo-3 cube: 2L faces made of 2x2 squares; orange front, red top, yellow left.
   * One renderer serves both the closed cube sprite and the folding net, so fold = 1
   * draws exactly the sprite. Face bodies are composed with 'multiply' inside the body
   * sprite too: multiply is associative, so the folding net can multiply each face straight
   * onto the scene (no offscreen) and still land exactly on the closed cube's colours. 3D: x right, y down, z into the screen (cube = 2 units);
   * oblique projection X = x - z*KX, Y = y - z*KY.
   */
  // A subtle extrusion: in a tower the oblique faces sit behind the tiles stacked on and
  // beside the cube, so a deep one reads as tiles interpenetrating the cube
  const CUBE_KX = 0.07, CUBE_KY = 0.08;
  const CF_COL = ['orange', 'red', 'orange', 'yellow', 'yellow', 'red']; // front top back left right bottom
  const CF_CI = [0, 1, 0, 2, 2, 1];                                         // orange, red, yellow
  const CQ = new Float64Array(6 * 8); // per face: ox oy ux uy vx vy z vis
  const CA = new Float64Array(6);     // per face: body alpha factor
  const CORD = [0, 1, 2, 3, 4, 5];
  // the oblique top and left faces of the closed cube get a lighter body: tiles stacked on
  // or beside the cube overlap them, and a full-strength red/yellow multiplies into mud
  const CUBE_SIDE_A = 0.7;

  // any fold argument -> 0..1: undefined, NaN, strings that are not numbers and objects are 0
  const fold01 = (f) => (f > 0 ? (f < 1 ? +f : 1) : 0);
  // hinge i's progress: the five hinges close one after the other
  const hinge = (fold, i) => ease(clamp(fold * 5 - i, 0, 1));
  let ckx = CUBE_KX, cky = CUBE_KY;
  function cset(i, Ox, Oy, Oz, Ux, Uy, Uz, Vx, Vy, Vz, vis) {
    const b = i * 8;
    CQ[b] = Ox - Oz * ckx; CQ[b + 1] = Oy - Oz * cky;
    CQ[b + 2] = Ux - Uz * ckx; CQ[b + 3] = Uy - Uz * cky;
    CQ[b + 4] = Vx - Vz * ckx; CQ[b + 5] = Vy - Vz * cky;
    CQ[b + 6] = Oz + (Uz + Vz) / 2; CQ[b + 7] = vis;
  }
  function cubeGeom(fold) {
    fold = fold01(fold);
    const fB = hinge(fold, 0), fR = hinge(fold, 1), fL = hinge(fold, 2), fT = hinge(fold, 3), fK = hinge(fold, 4);
    const H = HALF_PI;
    // depth exaggeration while the net is open (the fold reads as 3D in flight); back to 1
    // by fold 0.8 so the landing is static
    const k = 1 + 3.4 * Math.sin(Math.PI * Math.min(1, fold / 0.8));
    ckx = CUBE_KX * k; cky = CUBE_KY * k;
    cset(0, -1, -1, 0, 2, 0, 0, 0, 2, 0, 1);
    const cT = Math.cos(fT * H), sT = Math.sin(fT * H);
    cset(1, -1, -1, 0, 2, 0, 0, 0, -2 * cT, 2 * sT, 1);
    const cK = Math.cos(fK * H), sK = Math.sin(fK * H);
    // back hangs off the top's far edge: dir = topDir*cos + n*sin, n = (0, sinT, cosT)
    cset(2, -1, -1 - 2 * cT, 2 * sT, 2, 0, 0, 0, 2 * (-cT * cK + sT * sK), 2 * (sT * cK + cT * sK), 1 - 0.55 * Math.min(fT, fK));
    const cL = Math.cos(fL * H), sL = Math.sin(fL * H);
    cset(3, -1, -1, 0, 0, 2, 0, -2 * cL, 0, 2 * sL, 1);
    const cR = Math.cos(fR * H), sR = Math.sin(fR * H);
    cset(4, 1, -1, 0, 0, 2, 0, 2 * cR, 0, 2 * sR, 1 - 0.55 * fR);
    const cB = Math.cos(fB * H), sB = Math.sin(fB * H);
    cset(5, -1, 1, 0, 2, 0, 0, 0, 2 * cB, 2 * sB, 1 - 0.55 * fB);
    CA[0] = CA[2] = CA[4] = CA[5] = 1;
    CA[1] = 1 - (1 - CUBE_SIDE_A) * fT;
    CA[3] = 1 - (1 - CUBE_SIDE_A) * fL;
    // far faces first (insertion sort, no allocation)
    for (let i = 0; i < 6; i++) CORD[i] = i;
    for (let i = 1; i < 6; i++) {
      const v = CORD[i]; let j = i - 1;
      while (j >= 0 && CQ[CORD[j] * 8 + 6] < CQ[v * 8 + 6]) { CORD[j + 1] = CORD[j]; j--; }
      CORD[j + 1] = v;
    }
  }

  function cubeFaceT(g, i, L) {
    const b = i * 8;
    g.transform(CQ[b + 2] * L, CQ[b + 3] * L, CQ[b + 4] * L, CQ[b + 5] * L, CQ[b] * L, CQ[b + 1] * L);
  }
  const faceDet = (i) => { const b = i * 8; return Math.abs(CQ[b + 2] * CQ[b + 5] - CQ[b + 3] * CQ[b + 4]); };

  // face body gradients in unit face space, built once (day and night per face colour);
  // the face transform places them, a face's visibility goes in globalAlpha
  const CUBE_GRAD = [null, null, null, null, null, null];
  function cubeGrad(g, ci, night) {
    const k = ci + (night ? 3 : 0);
    let gr = CUBE_GRAD[k];
    if (!gr) {
      const col = ci === 0 ? 'orange' : ci === 1 ? 'red' : 'yellow';
      const bc = night ? PAL[col] : BODY[col];
      gr = g.createLinearGradient(0, 0, 1, 1);
      gr.addColorStop(0, rgba(night ? lighten(bc, 0.25) : lighten(bc, 0.1), 0.8));
      gr.addColorStop(1, rgba(darken(bc, 0.08), 0.8));
      CUBE_GRAD[k] = gr;
    }
    return gr;
  }

  // mode: 'body' | 'night' | 'detail' | 'white' | 'rim' | 'glow'
  function renderCube(g, L, fold, mode) {
    cubeGeom(fold);
    const ga = g.globalAlpha;
    for (let n = 0; n < 6; n++) {
      const i = CORD[n], vis = CQ[i * 8 + 7];
      const col = CF_COL[i];
      if (faceDet(i) < 1e-4) continue;
      g.save();
      cubeFaceT(g, i, L);
      if (mode === 'body' || mode === 'night') {
        g.globalAlpha = ga * vis * (mode === 'body' ? CA[i] : 1);
        g.fillStyle = cubeGrad(g, CF_CI[i], mode === 'night');
        g.fillRect(0, 0, 1, 1);
      } else if (mode === 'detail') {
        cubeFaceDetail(g, col, vis);
      } else if (mode === 'white') {
        g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
      } else if (mode === 'rim') {
        g.fillStyle = 'rgba(255,40,48,0.14)'; g.fillRect(0, 0, 1, 1);
        g.fillStyle = 'rgba(255,34,44,0.9)';
        g.beginPath(); g.rect(0, 0, 1, 1); g.rect(0.05, 0.05, 0.9, 0.9); g.fill('evenodd');
      } else if (mode === 'glow') {
        g.fillStyle = rgba(lighten(PAL[col], 0.3), 0.3); g.fillRect(0, 0, 1, 1);
      }
      g.restore();
    }
  }

  function cubeFaceDetail(g, col, vis) {
    const fc = FRAME[col], base = PAL[col];
    const fw = 0.045, r = 0.03;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x = i * 0.5, y = j * 0.5;
      g.fillStyle = rgba(fc, 0.9 * vis);
      g.beginPath(); rrect(g, x, y, 0.5, 0.5, r); rrect(g, x + fw, y + fw, 0.5 - 2 * fw, 0.5 - 2 * fw, r * 0.4); g.fill('evenodd');
      g.lineWidth = 0.008;
      g.strokeStyle = rgba(lighten(base, 0.55), 0.5 * vis);
      g.beginPath(); rrect(g, x + fw, y + fw, 0.5 - 2 * fw, 0.5 - 2 * fw, r * 0.4); g.stroke();
      // pockets
      g.fillStyle = rgba(darken(fc, 0.5), 0.45 * vis);
      for (let k = 0; k < 2; k++) {
        const t = k ? 0.36 : 0.14;
        g.fillRect(x + t - 0.0001, y + fw * 0.5 - 0.01, 0.1, 0.02);
        g.fillRect(x + t - 0.0001, y + 0.5 - fw * 0.5 - 0.01, 0.1, 0.02);
        g.fillRect(x + fw * 0.5 - 0.01, y + t, 0.02, 0.1);
        g.fillRect(x + 0.5 - fw * 0.5 - 0.01, y + t, 0.02, 0.1);
      }
      // inset square emboss
      g.strokeStyle = rgba(darken(fc, 0.2), 0.3 * vis); g.lineWidth = 0.01;
      g.strokeRect(x + 0.13, y + 0.13, 0.24, 0.24);
      g.strokeStyle = 'rgba(255,255,255,' + 0.25 * vis + ')';
      g.strokeRect(x + 0.125, y + 0.125, 0.24, 0.24);
      // corner rivets
      g.fillStyle = rgba(lighten(fc, 0.45), 0.85 * vis);
      for (let k = 0; k < 4; k++) {
        g.beginPath(); g.arc(x + (k & 1 ? 0.5 - 0.028 : 0.028), y + (k & 2 ? 0.5 - 0.028 : 0.028), 0.014, 0, TAU); g.fill();
      }
    }
    // gloss streak across the whole face
    const gl = g.createLinearGradient(0, 0, 0.7, 0.7);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.45, 'rgba(255,255,255,0)');
    gl.addColorStop(0.52, 'rgba(255,255,255,' + 0.22 * vis + ')');
    gl.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, 1, 1);
    g.strokeStyle = 'rgba(255,255,255,' + 0.4 * vis + ')'; g.lineWidth = 0.009;
    g.beginPath(); g.moveTo(0.006, 0.9); g.lineTo(0.006, 0.006); g.lineTo(0.9, 0.006); g.stroke();
  }

  function buildCube(L, kind) {
    const bb = shapeBounds('cube', L);
    const pad = kind === K_NIGHT ? Math.ceil(NIGHT_PAD * L + 2) : 2;
    const s = makeSprite(L, bb[0], bb[1], bb[2], bb[3], pad);
    if (!s) return null;
    const g = s.g;
    if (kind === K_BODY) { g.globalCompositeOperation = 'multiply'; renderCube(g, L, 1, 'body'); }
    else if (kind === K_NIGHT) {
      // glow halo baked under the lit-glass body (one blit at night)
      g.save();
      g.shadowColor = 'rgba(255,170,80,0.9)'; g.shadowBlur = 0.22 * L * SPR;
      renderCube(g, L, 1, 'glow');
      g.restore();
      renderCube(g, L, 1, 'night');
    }
    else if (kind === K_DETAIL) renderCube(g, L, 1, 'detail');
    else if (kind === K_WHITE) renderCube(g, L, 1, 'white');
    else if (kind === K_RIM) renderCube(g, L, 1, 'rim');
    return finish(s);
  }

  // One face's detail (the 2x2 grid, frames, pockets, emboss, rivets, gloss) as a sprite
  // covering the face at size L: the folding net draws it under each face's affine map, one
  // drawImage per face instead of ~100 path operations
  function buildFace(L, col) {
    const s = makeSprite(L, 0, 0, 2 * L, 2 * L, 1);
    if (!s) return null;
    s.g.scale(2 * L, 2 * L);
    cubeFaceDetail(s.g, col, 1);
    return finish(s);
  }
  // The flat net (fold 0) as a body and a detail sprite: it is drawn every frame the cube
  // waits in the hand, so it costs two blits like any tile
  const NET0_BB = [-3, -5, 3, 3];
  function buildNet0(L, kind) {
    const s = makeSprite(L, NET0_BB[0] * L, NET0_BB[1] * L, NET0_BB[2] * L, NET0_BB[3] * L, 2);
    if (!s) return null;
    if (kind === K_BODY) s.g.globalCompositeOperation = 'multiply';
    renderCube(s.g, L, 0, kind === K_BODY ? 'body' : 'detail');
    return finish(s);
  }

  /* ---------------------------------------------------------------- drawTile */
  const NO_OPTS = {};
  const GHOST_COL = table({ white: '#ffffff', gold: '#FFC531', red: '#FF3B3B' });
  const DASH = [6, 4];
  const NO_DASH = [];

  function tileSprite(kind, shape, si, color, ci, pat, q) {
    // flash and tint overlays are colour-independent silhouettes: one sprite per shape
    if (kind === K_WHITE || kind === K_RIM) ci = 0;
    const base = (((si * 8 + ci) * 4 + (kind === K_DETAIL ? pat : 0)) * 8 + kind);
    return getSprite(base, q, buildTile, kind, shape, color, pat);
  }

  function outlinePath(ctx, shape, L) {
    ctx.beginPath();
    if (shape === 'cube') {
      const dx = 2 * CUBE_KX * L, dy = 2 * CUBE_KY * L;
      ctx.moveTo(-L - dx, -L - dy); ctx.lineTo(L - dx, -L - dy); ctx.lineTo(L, -L);
      ctx.lineTo(L, L); ctx.lineTo(-L, L); ctx.lineTo(-L - dx, L - dy); ctx.closePath();
    } else polyPath(ctx, shapePts(shape, L, 0), 0.07 * L);
  }

  /* The aiming ghost, the main aid of a fast game, so it must read at a glance on anything.
   * The outline scales with L (a fixed 2 px line vanishes on a 70 px tile) over a navy
   * underlay; the slot is filled with the held piece's own colour, multiplied in like a faint
   * tile, plus a soft glow inside the rim: "this tile goes here" on the near-white wall, on
   * other tiles and on the armchair. White / gold / red are told apart by the outline.
   * A = effective alpha (option alpha x caller's globalAlpha). At night (caller passes night,
   * or the room is dimmed) multiply only darkens the navy room, so the fill is light instead:
   * an additive colour wash and an additive glow band along the inside of the outline.
   */
  function drawGhost(ctx, shape, color, L, kind, A, night) {
    const gc = GHOST_COL[kind] || GHOST_COL.white;
    const tc = PAL[color] || PAL.orange;
    const lw = Math.max(2, 0.045 * L), uw = Math.max(3.5, 0.075 * L);
    outlinePath(ctx, shape, L);
    ctx.lineJoin = 'round';
    if (night) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.14 * A;
      ctx.fillStyle = tc;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = gc;
      ctx.lineWidth = 0.34 * L;
      ctx.globalAlpha = 0.28 * A;
      ctx.stroke();
      ctx.lineWidth = 0.14 * L;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.26 * A;
      ctx.fillStyle = tc;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = kind === 'gold' ? '#FFF1BF' : kind === 'red' ? '#FFD9D9' : '#FFFFFF';
      ctx.globalAlpha = 0.3 * A;
      ctx.lineWidth = 0.16 * L;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = (night ? 0.3 : 0.55) * A;
    ctx.strokeStyle = '#1E2541';
    ctx.lineWidth = uw;
    ctx.stroke();
    ctx.globalAlpha = A;
    ctx.strokeStyle = gc;
    ctx.lineWidth = lw;
    DASH[0] = 3 * lw; DASH[1] = 2 * lw;
    ctx.setLineDash(DASH);
    ctx.lineDashOffset = -((performance.now() * 0.02) % (5 * lw));
    ctx.stroke();
    if (kind === 'gold') {
      // twinkling sparkles at the corners
      ctx.setLineDash(NO_DASH);
      const now = performance.now() * 0.006;
      const pts = shape === 'tri' || shape === 'crown' ? 3 : 4;
      const R = shape === 'cube' ? L * 1.1 : shape === 'tri' || shape === 'crown' ? L / SQ3 : L * 0.62;
      ctx.fillStyle = '#FFF6C8';
      for (let i = 0; i < pts; i++) {
        const a = (shape === 'tri' || shape === 'crown' ? -Math.PI / 2 : -Math.PI * 0.75) + (i * TAU) / pts;
        const sz = (0.09 + 0.06 * Math.sin(now + i * 2.1)) * L;
        sparkle(ctx, Math.cos(a) * R, Math.sin(a) * R, sz);
      }
    }
  }

  function sparkle(ctx, x, y, s) {
    if (s <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }

  // the crown's gold sweep: one cached gradient in unit space, placed by the transform
  let glintGrad = null;
  function glintSweep(ctx, shape, L, glint, A) {
    ctx.save();
    outlinePath(ctx, shape, L);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = A * 0.3 * Math.sin(Math.PI * glint);
    ctx.fillStyle = '#FFC531';
    ctx.fillRect(-1.5 * L, -1.5 * L, 3 * L, 3 * L);
    if (!glintGrad) {
      glintGrad = ctx.createLinearGradient(-0.35, -0.35, 0.35, 0.35);
      glintGrad.addColorStop(0, 'rgba(255,214,90,0)');
      glintGrad.addColorStop(0.5, 'rgba(255,246,190,0.95)');
      glintGrad.addColorStop(1, 'rgba(255,214,90,0)');
    }
    const p = lerp(-1.1, 1.1, glint) * L;
    ctx.translate(p, p);
    ctx.scale(L, L);
    ctx.globalAlpha = A;
    ctx.fillStyle = glintGrad;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  function drawTile(ctx, shape, color, cx, cy, rot, L, o) {
    if (!okL(L) || !fin(cx) || !fin(cy)) return;
    let si = SHAPE_IDX[shape];
    if (si === undefined) { shape = 'sq'; si = 0; }
    if (shape === 'crown') color = 'orange';
    let ci = COLOR_IDX[color];
    if (ci === undefined) { color = 'red'; ci = 0; }
    if (shape === 'cube') { color = 'orange'; ci = 1; }
    o = o || NO_OPTS;
    const alpha = o.alpha == null ? 1 : clamp(+o.alpha, 0, 1);
    const A = alpha * ctx.globalAlpha; // compose with the caller's alpha (fades)
    if (!(A > 0.003)) return;
    const q = qOf(L);
    curQ = q;
    ctx.save();
    try {
      ctx.translate(cx, cy);
      // quarter turns become exact axis-aligned matrices; any other angle is kept in rr
      let rr = rot && fin(rot) && !quarter(ctx, rot) ? rot : 0;
      if (o.ghost) {
        if (rr) ctx.rotate(rr);
        drawGhost(ctx, shape, color, L, o.ghost, A, !!o.night || curDim >= 0.5);
      } else {
        const pat = patternOf(shape, color, o.variant || 0);
        const layer = o.layer || 'both';
        if (layer !== 'detail') {
          ctx.globalAlpha = A;
          if (o.night) {
            ctx.globalCompositeOperation = 'source-over';
            blitR(ctx, tileSprite(K_NIGHT, shape, si, color, ci, 0, q), L, rr);
          } else {
            ctx.globalCompositeOperation = 'multiply';
            blitR(ctx, tileSprite(K_BODY, shape, si, color, ci, 0, q), L, rr);
          }
        }
        if (layer !== 'body') {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = A;
          blitR(ctx, tileSprite(K_DETAIL, shape, si, color, ci, pat, q), L, rr);
          const fl = o.flash || 0, ti = o.tint || 0, gl = o.glint || 0;
          if (fl > 0 || ti > 0 || (gl > 0 && gl < 1)) {
            if (rr) ctx.rotate(rr);
            if (fl > 0) { ctx.globalAlpha = A * Math.min(1, fl); blit(ctx, tileSprite(K_WHITE, shape, si, color, ci, 0, q), L); }
            if (ti > 0) { ctx.globalAlpha = A * Math.min(1, ti); blit(ctx, tileSprite(K_RIM, shape, si, color, ci, 0, q), L); }
            if (gl > 0 && gl < 1) glintSweep(ctx, shape, L, gl, A);
          }
        }
      }
    } finally {
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- cube net
   * The open net's faces are painted source-over into one reusable offscreen and that is
   * multiplied onto the scene ONCE: the same pipeline as the closed cube sprite, so the
   * colours do not jump when the fold completes and drawTile('cube') takes over.
   */
  const FACE_BASE = 9500, NET_BASE = 9510;
  function drawCubeNet(ctx, cx, cy, L, fold, rot) {
    if (!okL(L) || !fin(cx) || !fin(cy)) return;
    fold = fold01(fold);
    if (fold >= 1) { drawTile(ctx, 'cube', 'orange', cx, cy, rot, L); return; }
    const A = ctx.globalAlpha;
    if (!(A > 0.003)) return;
    const q = qOf(L);
    curQ = q;
    if (fold <= 0) {
      // the flat net waiting in the hand: two cached sprites
      ctx.save();
      try {
        ctx.translate(cx, cy);
        const rr = rot && fin(rot) && !quarter(ctx, rot) ? rot : 0;
        ctx.globalCompositeOperation = 'multiply';
        blitR(ctx, getSprite(NET_BASE, q, buildNet0, K_BODY), L, rr);
        ctx.globalCompositeOperation = 'source-over';
        blitR(ctx, getSprite(NET_BASE + 1, q, buildNet0, K_DETAIL), L, rr);
      } finally {
        ctx.restore();
      }
      return;
    }
    ctx.save();
    try {
      ctx.translate(cx, cy);
      if (rot && fin(rot)) rotQ(ctx, rot);
      // bodies: each face multiplied straight onto the scene (cached unit-space gradients)
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = A;
      renderCube(ctx, L, fold, 'body');
      // details: each face's cached sprite under the face's affine map, far faces first
      ctx.globalCompositeOperation = 'source-over';
      for (let n = 0; n < 6; n++) {
        const i = CORD[n];
        if (faceDet(i) < 1e-4) continue;
        const s = getSprite(FACE_BASE + CF_CI[i], q, buildFace, CF_COL[i]);
        if (!s) continue;
        ctx.save();
        cubeFaceT(ctx, i, L);
        ctx.globalAlpha = A * CQ[i * 8 + 7];
        const k = 1 / (2 * s.L);
        ctx.drawImage(s.c, -s.ox * k, -s.oy * k, s.w * k, s.h * k);
        ctx.restore();
      }
    } finally {
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- car base */
  function carWheel(g, x, y, r, far) {
    g.fillStyle = far ? '#0c0c0e' : '#151517';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = far ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)';
    g.lineWidth = r * 0.12;
    g.beginPath(); g.arc(x, y, r * 0.86, Math.PI * 1.05, Math.PI * 1.65); g.stroke();
    g.fillStyle = far ? '#4a4a4e' : '#9C9CA2';
    g.beginPath(); g.arc(x, y, r * 0.4, 0, TAU); g.fill();
    g.fillStyle = far ? '#333' : '#6E6E74';
    g.beginPath(); g.arc(x + r * 0.05, y + r * 0.05, r * 0.2, 0, TAU); g.fill();
    if (!far) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(x - r * 0.14, y - r * 0.14, r * 0.1, 0, TAU); g.fill();
    }
  }

  function buildCar(L, part, colorName) {
    const s = makeSprite(L, -1.32 * L, -0.4 * L, 1.32 * L, 0.56 * L, 2);
    if (!s) return null;
    const g = s.g;
    const base = PAL[colorName], fc = FRAME[colorName];
    const yb = -0.21 * L, yf = 0.05 * L, sk = 0.08 * L, y2 = 0.23 * L;
    const top = [-L, yf, L, yf, L + sk, yb, -L + sk, yb];
    if (part === 0) {
      carWheel(g, -0.8 * L + sk, 0.26 * L, 0.19 * L, true);
      carWheel(g, 0.8 * L + sk, 0.26 * L, 0.19 * L, true);
    } else if (part === 1) {
      const gr = g.createLinearGradient(-L, yb, L, y2);
      gr.addColorStop(0, rgba(lighten(base, 0.15), 0.6));
      gr.addColorStop(1, rgba(darken(base, 0.05), 0.6));
      g.fillStyle = gr;
      g.beginPath(); polyPath(g, top, 0.05 * L); g.fill();
      g.fillStyle = rgba(darken(base, 0.08), 0.8);
      g.beginPath(); rrect(g, -L, yf - 0.01 * L, 2 * L, y2 - yf + 0.01 * L, 0.04 * L); g.fill();
      // tow hooks: loop on the right, peg on the left
      g.strokeStyle = rgba(base, 0.8); g.lineWidth = 0.05 * L;
      g.beginPath(); g.arc(L + 0.13 * L, 0.03 * L, 0.07 * L, 0, TAU); g.stroke();
      g.fillStyle = rgba(base, 0.8);
      g.fillRect(L - 0.02 * L, 0.0, 0.1 * L, 0.08 * L);
      g.fillRect(-L - 0.12 * L, 0.02 * L, 0.14 * L, 0.08 * L);
      g.beginPath(); rrect(g, -L - 0.1 * L, -0.16 * L, 0.07 * L, 0.2 * L, 0.03 * L); g.fill();
    } else {
      // frame of the top plate and the 2x4 inner grid
      g.lineJoin = 'round';
      g.strokeStyle = rgba(fc, 0.9); g.lineWidth = 0.05 * L;
      g.beginPath(); polyPath(g, top, 0.05 * L); g.stroke();
      g.lineWidth = 0.032 * L; g.strokeStyle = rgba(fc, 0.75);
      g.beginPath();
      for (let i = 1; i < 4; i++) {
        const f = i / 4;
        g.moveTo(-L + 2 * L * f, yf); g.lineTo(-L + sk + 2 * L * f, yb);
      }
      g.moveTo(-L + sk / 2, (yf + yb) / 2); g.lineTo(L + sk / 2, (yf + yb) / 2);
      g.stroke();
      g.strokeStyle = rgba(lighten(base, 0.6), 0.55); g.lineWidth = Math.max(0.6, 0.012 * L);
      g.beginPath();
      for (let i = 0; i <= 4; i++) {
        const f = i / 4;
        g.moveTo(-L + 2 * L * f + 0.02 * L, yf - 0.02 * L); g.lineTo(-L + sk + 2 * L * f + 0.02 * L, yb + 0.02 * L);
      }
      g.stroke();
      // front face: lip highlight, pockets, dark bottom edge
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(-L + 0.03 * L, yf, 2 * L - 0.06 * L, Math.max(0.8, 0.02 * L));
      g.fillStyle = rgba(darken(fc, 0.5), 0.45);
      for (let i = 0; i < 4; i++) g.fillRect(-L + (0.3 + i * 0.47) * L, yf + 0.07 * L, 0.2 * L, 0.04 * L);
      g.fillStyle = rgba(darken(fc, 0.4), 0.7);
      g.fillRect(-L + 0.02 * L, y2 - 0.025 * L, 2 * L - 0.04 * L, 0.025 * L);
      g.strokeStyle = rgba(fc, 0.95); g.lineWidth = Math.max(0.8, 0.02 * L);
      g.beginPath(); rrect(g, -L, yf - 0.01 * L, 2 * L, y2 - yf + 0.01 * L, 0.04 * L); g.stroke();
      // hooks outline + highlight
      g.strokeStyle = rgba(fc, 0.95); g.lineWidth = Math.max(0.7, 0.016 * L);
      g.beginPath(); g.arc(L + 0.13 * L, 0.03 * L, 0.095 * L, 0, TAU); g.stroke();
      g.beginPath(); g.arc(L + 0.13 * L, 0.03 * L, 0.045 * L, 0, TAU); g.stroke();
      g.beginPath(); rrect(g, -L - 0.1 * L, -0.16 * L, 0.07 * L, 0.2 * L, 0.03 * L); g.stroke();
      g.fillStyle = rgba(lighten(base, 0.5), 0.8);
      g.beginPath(); g.ellipse(-L - 0.065 * L, -0.155 * L, 0.035 * L, 0.015 * L, 0, 0, TAU); g.fill();
      // near wheels: radius 0.2L, 0.2L in from each end, contact 0.5L below the plate top
      carWheel(g, -0.8 * L, 0.3 * L, 0.2 * L, false);
      carWheel(g, 0.8 * L, 0.3 * L, 0.2 * L, false);
    }
    return finish(s);
  }

  function drawCar(ctx, x, y, rot, L, color, o) {
    if (!okL(L) || !fin(x) || !fin(y)) return;
    const cn = color === 'green' ? 'green' : 'red';
    const ci = COLOR_IDX[cn];
    const q = qOf(L);
    const sq = o && o.squash > 0 ? Math.min(1, o.squash) : 0;
    ctx.save();
    try {
      ctx.translate(x, y);
      if (rot && fin(rot)) rotQ(ctx, rot);
      if (sq) { ctx.translate(0, 0.5 * L); ctx.scale(1 + 0.08 * sq, 1 - 0.22 * sq); ctx.translate(0, -0.5 * L); }
      const b0 = 9000 + ci * 4;
      blit(ctx, getSprite(b0, q, buildCar, 0, cn), L);
      ctx.globalCompositeOperation = 'multiply';
      blit(ctx, getSprite(b0 + 1, q, buildCar, 1, cn), L);
      ctx.globalCompositeOperation = 'source-over';
      blit(ctx, getSprite(b0 + 2, q, buildCar, 2, cn), L);
    } finally {
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- sleeve, hand, arm */
  // one period of the striped sleeve, cached per size: navy, yellow, navy, pale blue
  const SLEEVE_P = 0.4; // period in L
  function buildSleeve(L) {
    const w = 0.62 * L, P = SLEEVE_P * L, n = 4;
    const s = makeSprite(L, -w / 2, 0, w / 2, P * n, 0);
    if (!s) return null;
    const g = s.g;
    for (let k = 0; k < n; k++) {
      const y0 = k * P;
      g.fillStyle = PAL.sleeve; g.fillRect(-w / 2, y0, w, P);
      g.fillStyle = PAL.stripeYellow; g.fillRect(-w / 2, y0 + 0.17 * L, w, 0.06 * L);
      g.fillStyle = PAL.stripeBlue; g.fillRect(-w / 2, y0 + 0.27 * L, w, 0.045 * L);
    }
    // volume: dark sides, soft highlight left of centre
    const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    gr.addColorStop(0, 'rgba(8,10,25,0.55)');
    gr.addColorStop(0.18, 'rgba(8,10,25,0.12)');
    gr.addColorStop(0.38, 'rgba(255,255,255,0.10)');
    gr.addColorStop(0.62, 'rgba(8,10,25,0.05)');
    gr.addColorStop(1, 'rgba(8,10,25,0.6)');
    g.fillStyle = gr; g.fillRect(-w / 2, 0, w, P * n);
    // soft fabric folds
    for (let k = 0; k < n; k++) {
      const y0 = k * P + (k % 2 ? 0.05 : 0.22) * L;
      const fg = g.createLinearGradient(0, y0 - 0.08 * L, 0, y0 + 0.08 * L);
      fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.45, 'rgba(255,255,255,0.08)');
      fg.addColorStop(0.55, 'rgba(0,0,0,0.16)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(-w / 2, y0 - 0.08 * L + (k % 2 ? 0.05 : -0.04) * L); g.lineTo(w / 2, y0 - 0.08 * L + (k % 2 ? -0.04 : 0.05) * L);
      g.lineTo(w / 2, y0 + 0.08 * L + (k % 2 ? -0.04 : 0.05) * L); g.lineTo(-w / 2, y0 + 0.08 * L + (k % 2 ? 0.05 : -0.04) * L);
      g.closePath(); g.fill();
    }
    // knit texture
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < P * n; y += Math.max(1, 0.03 * L)) g.fillRect(-w / 2, y, w, Math.max(0.5, 0.008 * L));
    return finish(s);
  }

  // draws the sleeve along local -y from y0 (cuff end) to yTop (negative, far end)
  function sleeveRun(ctx, L, y0, yTop) {
    const s = getSprite(9100, qOf(L), buildSleeve);
    if (!s) return;
    const f = L / s.L, segH = s.h * f;
    let y = y0 - segH;
    let guard = 0;
    while (y + segH > yTop && guard++ < 64) {
      ctx.drawImage(s.c, -s.ox * f, y, s.w * f, segH);
      y -= segH;
    }
  }

  // Parts of a hand are drawn twice: first every part stroked wide in the outline colour,
  // then every part filled with skin, so the outline hugs the union of the parts.
  const SKIN_LINE = 'rgba(150,84,58,0.62)';
  function capsule(ctx, x, y, ang, len, w) {
    // from (x,y) along direction ang (0 = pointing down), rounded both ends
    const s = Math.sin(ang), c = Math.cos(ang);
    const ex = x - s * len, ey = y + c * len, r = w / 2;
    const nx = c * r, ny = s * r;
    ctx.moveTo(x + nx, y + ny);
    ctx.lineTo(ex + nx, ey + ny);
    ctx.arc(ex, ey, r, ang, ang + Math.PI);
    ctx.lineTo(x - nx, y - ny);
    ctx.arc(x, y, r, ang + Math.PI, ang + TAU);
    ctx.closePath();
  }
  const HF = new Float64Array(4 * 4); // per finger: kx, ky, ang, len
  function handParts(ctx, L, open, pass) {
    const ow = Math.max(1.2, 0.03 * L);
    // thumb (behind the tile's top edge, pinching from the left)
    const ta = lerp(-0.62, -1.25, open);
    ctx.beginPath(); capsule(ctx, -0.27 * L, -0.4 * L, ta, 0.3 * L, 0.15 * L);
    pass ? ctx.fill() : ctx.stroke();
    // back of the hand
    ctx.beginPath();
    ctx.moveTo(-0.24 * L, -0.7 * L);
    ctx.bezierCurveTo(-0.25 * L, -0.48 * L, -0.33 * L, -0.34 * L, -0.31 * L, -0.16 * L);
    ctx.quadraticCurveTo(-0.3 * L, -0.08 * L, -0.2 * L, -0.08 * L);
    ctx.lineTo(0.2 * L, -0.08 * L);
    ctx.quadraticCurveTo(0.31 * L, -0.08 * L, 0.32 * L, -0.18 * L);
    ctx.bezierCurveTo(0.33 * L, -0.34 * L, 0.26 * L, -0.48 * L, 0.24 * L, -0.7 * L);
    ctx.closePath();
    pass ? ctx.fill() : ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      capsule(ctx, HF[i * 4], HF[i * 4 + 1], HF[i * 4 + 2], HF[i * 4 + 3], i === 3 ? 0.13 * L : 0.155 * L);
      pass ? ctx.fill() : ctx.stroke();
    }
    return ow;
  }

  function scribbles(ctx, L) {
    ctx.strokeStyle = 'rgba(217,51,59,0.62)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 0.032 * L);
    ctx.beginPath();
    ctx.moveTo(-0.15 * L, -0.46 * L);
    ctx.quadraticCurveTo(-0.04 * L, -0.38 * L, 0.03 * L, -0.47 * L);
    ctx.quadraticCurveTo(0.1 * L, -0.55 * L, 0.15 * L, -0.4 * L);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.024 * L);
    ctx.beginPath(); ctx.moveTo(-0.08 * L, -0.27 * L); ctx.lineTo(0.06 * L, -0.23 * L); ctx.stroke();
    ctx.fillStyle = 'rgba(217,51,59,0.5)';
    ctx.beginPath(); ctx.arc(0.19 * L, -0.24 * L, 0.028 * L, 0, TAU); ctx.fill();
  }

  function cuff(ctx, L, y) {
    ctx.fillStyle = '#161B33';
    ctx.beginPath(); rrect(ctx, -0.335 * L, y - 0.13 * L, 0.67 * L, 0.15 * L, 0.05 * L); ctx.fill();
    ctx.strokeStyle = 'rgba(143,166,201,0.35)'; ctx.lineWidth = Math.max(0.6, 0.012 * L);
    ctx.beginPath();
    for (let i = -6; i <= 6; i++) { ctx.moveTo(i * 0.05 * L, y - 0.11 * L); ctx.lineTo(i * 0.05 * L, y); }
    ctx.stroke();
  }

  const FINGER_LEN = [0.33, 0.36, 0.34, 0.28];
  function drawHand(ctx, x, y, L, open, t) {
    if (!okL(L) || !fin(x) || !fin(y)) return;
    open = open > 0 ? Math.min(1, open) : 0;
    t = fin(t) ? t : 0;
    ctx.save();
    try { handBody(ctx, x, y, L, open, t); } finally { ctx.restore(); }
  }
  function handBody(ctx, x, y, L, open, t) {
    const LEN = FINGER_LEN;
    ctx.translate(x, y - open * 0.12 * L);
    ctx.rotate(Math.sin(t * 1.9) * 0.02);
    sleeveRun(ctx, L, -0.66 * L, -(y + 60));
    // finger poses: curled over the tile's top edge when gripping, fanned out when open
    for (let i = 0; i < 4; i++) {
      HF[i * 4] = (-0.215 + 0.145 * i) * L;
      HF[i * 4 + 1] = -0.14 * L;
      HF[i * 4 + 2] = lerp((1.5 - i) * -0.03, (1.5 - i) * 0.34, open);
      HF[i * 4 + 3] = lerp(LEN[i], LEN[i] + 0.05, open) * L;
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 2 * Math.max(1.2, 0.03 * L);
    handParts(ctx, L, open, 0);
    ctx.fillStyle = PAL.skin;
    handParts(ctx, L, open, 1);
    // shading: shadow on the far side, soft light on the near side
    ctx.fillStyle = 'rgba(200,120,90,0.22)';
    ctx.beginPath(); ctx.ellipse(0.2 * L, -0.36 * L, 0.11 * L, 0.3 * L, -0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,238,225,0.4)';
    ctx.beginPath(); ctx.ellipse(-0.1 * L, -0.42 * L, 0.1 * L, 0.2 * L, 0.25, 0, TAU); ctx.fill();
    // creases between fingers, knuckle dimples, nails
    ctx.strokeStyle = 'rgba(165,92,66,0.45)';
    ctx.lineWidth = Math.max(0.8, 0.016 * L);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const kx = HF[i * 4], ky = HF[i * 4 + 1], a = HF[i * 4 + 2], len = HF[i * 4 + 3];
      const sa = Math.sin(a), ca = Math.cos(a);
      const w = i === 3 ? 0.13 * L : 0.155 * L;
      if (i > 0 && open < 0.5) {
        const bx = kx - w / 2;
        ctx.beginPath(); ctx.moveTo(bx - sa * 0.05 * L, ky + ca * 0.05 * L); ctx.lineTo(bx - sa * len * 0.9, ky + ca * len * 0.9); ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(kx - sa * len * 0.45, ky + ca * len * 0.45, w * 0.28, a + 0.4, a + Math.PI - 0.4);
      ctx.stroke();
      const nx = kx - sa * (len - w * 0.05), ny = ky + ca * (len - w * 0.05);
      ctx.fillStyle = 'rgba(255,226,214,0.9)';
      ctx.beginPath(); ctx.ellipse(nx, ny, w * 0.27, w * 0.3, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(185,110,85,0.3)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(HF[i * 4], -0.13 * L, 0.02 * L, 0, TAU); ctx.fill(); }
    scribbles(ctx, L);
    ctx.fillStyle = 'rgba(217,51,59,0.5)';
    ctx.beginPath(); ctx.ellipse(HF[4] - Math.sin(HF[6]) * 0.2 * L, HF[5] + Math.cos(HF[6]) * 0.2 * L, 0.035 * L, 0.02 * L, 0.4, 0, TAU); ctx.fill();
    cuff(ctx, L, -0.6 * L);
  }

  /* The SMASH / title-shove arm: a child's arm reaching in from the left screen edge. The
   * hand is side-on and flat against the push face at local x = 0: a tall palm slab whose
   * right edge is pressed straight against the face, four fingers pointing up and fanning
   * back a little (seen from the back-left, as the cube's left face is), the thumb tucked
   * low against the heel of the palm, a knuckle crease, nails, and the red marker scribbles
   * on the back of the hand. The sleeve bends at the elbow: the forearm droops from the
   * wrist down to the elbow, the upper arm rises off-screen toward the shoulder. A shove
   * pulse driven by t squashes the hand against the face and sinks the elbow.
   */
  const AF = [ // fingers, index (against the face) to pinky: base x, base y, angle (PI = up), length, width (in L)
    -0.074, -0.44, Math.PI + 0.02, 0.6, 0.148,
    -0.19, -0.455, Math.PI - 0.09, 0.68, 0.15,
    -0.3, -0.44, Math.PI - 0.2, 0.62, 0.142,
    -0.39, -0.4, Math.PI - 0.34, 0.5, 0.126,
  ];
  function armParts(ctx, L, pass) {
    const done = () => { if (pass) ctx.fill(); else ctx.stroke(); };
    // fingers, pinky (furthest back) first
    for (let i = 3; i >= 0; i--) {
      const b = i * 5;
      ctx.beginPath(); capsule(ctx, AF[b] * L, AF[b + 1] * L, AF[b + 2], AF[b + 3] * L, AF[b + 4] * L); done();
    }
    // palm slab: right edge flat on the face, heel rounded, back of the hand to the wrist
    ctx.beginPath();
    ctx.moveTo(0, -0.46 * L);
    ctx.lineTo(0, 0.2 * L);
    ctx.quadraticCurveTo(0.005 * L, 0.38 * L, -0.15 * L, 0.4 * L);
    ctx.lineTo(-0.48 * L, 0.44 * L);
    ctx.lineTo(-0.54 * L, 0.02 * L);
    ctx.quadraticCurveTo(-0.46 * L, -0.14 * L, -0.45 * L, -0.34 * L);
    ctx.quadraticCurveTo(-0.44 * L, -0.47 * L, -0.28 * L, -0.5 * L);
    ctx.quadraticCurveTo(-0.08 * L, -0.52 * L, 0, -0.46 * L);
    ctx.closePath();
    done();
  }
  function thumbPart(ctx, L) {
    // tucked low along the heel of the palm, tip pointing up and back
    ctx.beginPath(); capsule(ctx, -0.08 * L, 0.27 * L, Math.PI - 0.92, 0.36 * L, 0.165 * L);
  }

  function drawArm(ctx, x, y, L, t) {
    if (!okL(L) || !fin(x) || !fin(y)) return;
    t = fin(t) ? t : 0;
    ctx.save();
    try { armBody(ctx, x, y, L, t); } finally { ctx.restore(); }
  }

  // one straight run of sleeve from P along (dx, dy), cut square at both ends: from `over`
  // behind P to `len` ahead of it
  function sleeveSeg(ctx, L, px, py, dx, dy, len, over) {
    const w = 0.62 * L;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(dx, -dy));
    ctx.beginPath(); ctx.rect(-w / 2 - 2, -len, w + 4, len + over); ctx.clip();
    sleeveRun(ctx, L, over, -len);
    ctx.restore();
  }

  function armBody(ctx, x, y, L, t) {
    // the shove: a quick pulse (about twice a second) squashes the hand flat on the face and
    // sinks the elbow
    const sp = Math.sin(t * 13);
    const p = sp > 0 ? sp * sp : 0;
    ctx.translate(x + Math.sin(t * 31) * 0.008 * L, y);
    // wrist W -> elbow E (the forearm droops), then up toward the shoulder, off-screen left
    const wx = -0.5 * L, wy = 0.22 * L;
    const ex = (-2.45 + 0.16 * p) * L, ey = (0.62 + 0.08 * p) * L;
    let fx = ex - wx, fy = ey - wy;
    const lf = Math.hypot(fx, fy); fx /= lf; fy /= lf;
    const ux = -0.9, uy = -0.436;                                 // elbow -> shoulder, ~26 deg up
    // reach past the left screen edge (local x = -x), with room for the screen shake
    const lu = Math.max(1.5 * L, (x + ex + 80) / -ux);
    const r = 0.31 * L;
    // upper arm, the rounded elbow, then the forearm over them
    sleeveSeg(ctx, L, ex, ey, ux, uy, lu, 0);
    ctx.fillStyle = PAL.sleeve;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
    const eg = ctx.createRadialGradient(ex - 0.08 * L, ey - 0.1 * L, 0.02 * L, ex, ey, r);
    eg.addColorStop(0, 'rgba(143,166,201,0.28)'); eg.addColorStop(1, 'rgba(5,7,20,0.35)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
    sleeveSeg(ctx, L, wx, wy, fx, fy, lf, 0.06 * L);
    // fabric bunching at the inside of the bend
    ctx.strokeStyle = 'rgba(5,7,20,0.5)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 0.035 * L);
    ctx.beginPath();
    ctx.moveTo(ex + 0.05 * L, ey - 0.27 * L); ctx.quadraticCurveTo(ex + 0.12 * L, ey - 0.12 * L, ex + 0.05 * L, ey);
    ctx.stroke();

    // the hand, squashed against the face by the shove (about the push face, x = 0)
    ctx.save();
    ctx.translate(0, -0.1 * L);
    ctx.scale(1 - 0.08 * p, 1 + 0.035 * p);
    ctx.translate(0, 0.1 * L);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 2 * Math.max(1.2, 0.03 * L);
    armParts(ctx, L, 0);
    ctx.fillStyle = PAL.skin;
    armParts(ctx, L, 1);
    // light on the back of the hand; the side pressed on the face in shadow
    ctx.fillStyle = 'rgba(255,238,225,0.4)';
    ctx.beginPath(); ctx.ellipse(-0.33 * L, -0.12 * L, 0.08 * L, 0.26 * L, 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(196,112,84,0.26)';
    ctx.beginPath(); ctx.rect(-0.055 * L, -0.46 * L, 0.055 * L, 0.7 * L); ctx.fill();
    // fingers: the line where each overlaps the next one back, joint creases, nails
    for (let i = 0; i < 4; i++) {
      const b = i * 5;
      const bx = AF[b] * L, by = AF[b + 1] * L, a = AF[b + 2], len = AF[b + 3] * L, w = AF[b + 4] * L;
      const dx = -Math.sin(a), dy = Math.cos(a);   // along the finger, base -> tip
      const nx = Math.cos(a), ny = Math.sin(a);    // across it, toward the back of the hand
      ctx.strokeStyle = 'rgba(160,86,60,0.55)';
      ctx.lineWidth = Math.max(0.8, 0.02 * L);
      if (i < 3) {
        ctx.beginPath();
        ctx.moveTo(bx + nx * w * 0.5 + dx * 0.04 * L, by + ny * w * 0.5 + dy * 0.04 * L);
        ctx.lineTo(bx + nx * w * 0.5 + dx * len * 0.92, by + ny * w * 0.5 + dy * len * 0.92);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(165,92,66,0.4)';
      ctx.lineWidth = Math.max(0.7, 0.014 * L);
      for (let k = 0; k < 2; k++) {
        const f = k ? 0.68 : 0.38, jx = bx + dx * len * f, jy = by + dy * len * f;
        ctx.beginPath(); ctx.moveTo(jx + nx * w * 0.38, jy + ny * w * 0.38); ctx.lineTo(jx + nx * w * 0.02, jy + ny * w * 0.02); ctx.stroke();
      }
      const tx = bx + dx * (len - w * 0.5) + nx * w * 0.16, ty = by + dy * (len - w * 0.5) + ny * w * 0.16;
      ctx.fillStyle = 'rgba(255,230,218,0.95)';
      ctx.beginPath(); ctx.ellipse(tx, ty, w * 0.2, w * 0.3, a, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190,120,95,0.5)';
      ctx.lineWidth = Math.max(0.6, 0.01 * L);
      ctx.stroke();
    }
    // knuckle crease across the top of the palm, knuckle dimples
    ctx.strokeStyle = 'rgba(160,86,60,0.5)';
    ctx.lineWidth = Math.max(0.8, 0.018 * L);
    ctx.beginPath(); ctx.moveTo(-0.42 * L, -0.38 * L); ctx.quadraticCurveTo(-0.22 * L, -0.36 * L, -0.03 * L, -0.4 * L); ctx.stroke();
    ctx.fillStyle = 'rgba(185,110,85,0.3)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(AF[i * 5] * L, AF[i * 5 + 1] * L + 0.035 * L, 0.024 * L, 0, TAU); ctx.fill(); }
    // red marker scribbles on the back of the hand
    ctx.save();
    ctx.translate(-0.2 * L, 0.12 * L);
    ctx.rotate(-0.3);
    scribbles(ctx, 0.64 * L);
    ctx.restore();
    // the thumb, tucked over the heel of the palm
    ctx.lineWidth = Math.max(1, 0.026 * L);
    ctx.strokeStyle = 'rgba(160,86,60,0.6)';
    thumbPart(ctx, L); ctx.stroke();
    ctx.fillStyle = PAL.skin;
    thumbPart(ctx, L); ctx.fill();
    ctx.fillStyle = 'rgba(200,120,90,0.18)';
    ctx.beginPath(); ctx.ellipse(-0.14 * L, 0.27 * L, 0.06 * L, 0.11 * L, -0.92, 0, TAU); ctx.fill();
    const ta = Math.PI - 0.92, tdx = -Math.sin(ta), tdy = Math.cos(ta);
    ctx.fillStyle = 'rgba(255,230,218,0.95)';
    ctx.beginPath(); ctx.ellipse(-0.08 * L + tdx * 0.29 * L, 0.27 * L + tdy * 0.29 * L, 0.045 * L, 0.06 * L, ta, 0, TAU); ctx.fill();
    ctx.restore();
    // the cuff over the wrist, across the forearm
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(Math.atan2(fx, -fy));
    cuff(ctx, L, 0.09 * L);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- ring and gear
   * Ring sprites: 0 body (opaque magenta annulus), 1 detail (ridges, edges, highlights),
   * 2 soft pink glow, 3 pickup body (body + white halo + navy hairline, readable on any
   * background: the near-white wall, the raspberry armchair, the night sky).
   */
  const RING_RO = 0.31, RING_RI = 0.2;
  function ringBody(g, L, ro, ri) {
    g.fillStyle = PAL.ring;
    g.beginPath(); g.arc(0, 0, ro, 0, TAU); g.arc(0, 0, ri, 0, TAU, true); g.fill();
    g.fillStyle = rgba(darken(PAL.ring, 0.28), 0.5);
    g.beginPath(); g.arc(0, 0, ro, 0, TAU); g.arc(0, 0, ro - 0.035 * L, 0, TAU, true); g.fill();
    g.beginPath(); g.arc(0, 0, ri + 0.03 * L, 0, TAU); g.arc(0, 0, ri, 0, TAU, true); g.fill();
  }
  function buildRing(L, part) {
    const ro = RING_RO * L, ri = RING_RI * L;
    const pad = part === 2 ? 0.3 * L : part === 3 ? 4 : 2;
    const s = makeSprite(L, -ro, -ro, ro, ro, pad);
    if (!s) return null;
    const g = s.g;
    if (part === 0) {
      ringBody(g, L, ro, ri);
    } else if (part === 3) {
      // white halo 1.5 px outside both edges, then a navy hairline, then the body
      g.lineWidth = 3.4;
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.arc(0, 0, ro + 0.4, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, Math.max(0.5, ri - 0.4), 0, TAU); g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(30,37,65,0.9)';
      g.beginPath(); g.arc(0, 0, ro + 0.2, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, Math.max(0.5, ri - 0.2), 0, TAU); g.stroke();
      ringBody(g, L, ro, ri);
    } else if (part === 1) {
      const mid = (ro + ri) / 2;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineCap = 'round';
      g.lineWidth = 0.035 * L;
      g.beginPath(); g.arc(0, 0, mid, Math.PI * 1.08, Math.PI * 1.5); g.stroke();
      g.lineWidth = 0.018 * L; g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(0, 0, mid, Math.PI * 0.15, Math.PI * 0.35); g.stroke();
      // moulded ridges
      g.strokeStyle = rgba(darken(PAL.ring, 0.35), 0.45); g.lineWidth = Math.max(0.6, 0.014 * L);
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.moveTo(Math.cos(a) * (ri + 0.025 * L), Math.sin(a) * (ri + 0.025 * L));
        g.lineTo(Math.cos(a) * (ro - 0.025 * L), Math.sin(a) * (ro - 0.025 * L));
      }
      g.stroke();
      g.strokeStyle = rgba(darken(PAL.ring, 0.45), 0.7); g.lineWidth = Math.max(0.7, 0.016 * L);
      g.beginPath(); g.arc(0, 0, ro - 0.008 * L, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, ri, 0, TAU); g.stroke();
    } else {
      const gr = g.createRadialGradient(0, 0, ri * 0.6, 0, 0, ro + 0.3 * L);
      gr.addColorStop(0, 'rgba(255,120,200,0)');
      gr.addColorStop(0.45, 'rgba(255,92,178,0.9)');
      gr.addColorStop(1, 'rgba(255,110,190,0)');
      g.fillStyle = gr;
      g.fillRect(-ro - 0.3 * L, -ro - 0.3 * L, 2 * (ro + 0.3 * L), 2 * (ro + 0.3 * L));
    }
    return finish(s);
  }

  function drawRing(ctx, x, y, L, flat, t) {
    if (!okL(L) || !fin(x) || !fin(y)) return;
    flat = flat > 0 ? Math.min(1, flat) : 0;
    t = fin(t) ? t : 0;
    const ga = ctx.globalAlpha;
    if (!(ga > 0.003)) return;
    const q = qOf(L), air = 1 - flat;
    ctx.save();
    try {
      ctx.translate(x, y + Math.sin(t * 2.6) * 0.07 * L * air);
      ctx.globalCompositeOperation = 'source-over';
      if (air > 0) {
        // floating pickup: soft pink glow (source-over, so it shows on the white wall too),
        // then an opaque ring with a white halo and navy hairline, tilted and bobbing
        ctx.rotate(Math.sin(t * 1.3) * 0.18 * air);
        const sy = lerp(0.42 + 0.08 * Math.sin(t * 2.1), 1, flat);
        ctx.scale(1, Math.min(1, sy * 1.5));
        ctx.globalAlpha = ga * 0.35 * Math.min(1, air * 2) * (0.85 + 0.15 * Math.sin(t * 5));
        blit(ctx, getSprite(9203, q, buildRing, 2), L);
        ctx.scale(1, sy / Math.min(1, sy * 1.5));
        const pick = getSprite(9204, q, buildRing, 3);
        // the ring's thickness shows below the rim when it is tilted
        const dy = 0.09 * L * air;
        ctx.translate(0, dy);
        ctx.globalAlpha = ga * 0.7;
        blit(ctx, pick, L);
        ctx.translate(0, -dy);
        ctx.globalAlpha = ga * 0.92;
        blit(ctx, pick, L);
      } else {
        // stuck flat on a tile face: mostly magenta, plus a light multiply pass so the tile
        // colour tints it like see-through plastic; it stays magenta on every tile colour
        const body = getSprite(9201, q, buildRing, 0);
        ctx.globalAlpha = ga * 0.75;
        blit(ctx, body, L);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = ga * 0.3;
        blit(ctx, body, L);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = ga;
      blit(ctx, getSprite(9202, q, buildRing, 1), L);
    } finally {
      ctx.restore();
    }
  }

  function buildGear(L) {
    const R = 0.2 * L;
    const s = makeSprite(L, -R, -R, R, R, 2);
    if (!s) return null;
    const g = s.g;
    const teeth = 8;
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * TAU, a1 = ((i + 1) / (teeth * 2)) * TAU;
      const r = i % 2 ? R * 0.74 : R;
      if (i === 0) g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
      g.arc(0, 0, r, a0 + (i % 2 ? 0 : 0.06), a1 - (i % 2 ? 0 : 0.06));
      const rn = i % 2 ? R : R * 0.74;
      g.lineTo(Math.cos(a1) * rn, Math.sin(a1) * rn);
    }
    g.closePath();
    g.fillStyle = PAL.gear; g.fill();
    g.strokeStyle = darken(PAL.gear, 0.35); g.lineWidth = Math.max(0.7, 0.02 * L); g.stroke();
    g.fillStyle = lighten(PAL.gear, 0.2);
    g.beginPath(); g.arc(0, 0, R * 0.52, 0, TAU); g.fill();
    g.fillStyle = darken(PAL.gear, 0.3);
    g.fillRect(-R * 0.36, -R * 0.07, R * 0.72, R * 0.14);
    g.fillRect(-R * 0.07, -R * 0.36, R * 0.14, R * 0.72);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.arc(-R * 0.3, -R * 0.3, R * 0.16, 0, TAU); g.fill();
    return finish(s);
  }

  function drawGear(ctx, x, y, L, rot) {
    if (!okL(L) || !fin(x) || !fin(y)) return;
    ctx.save();
    try {
      ctx.translate(x, y);
      if (rot && fin(rot)) ctx.rotate(rot);
      blit(ctx, getSprite(9300, qOf(L), buildGear), L);
    } finally {
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- shadow blob */
  let blobC = null;
  function blob() {
    if (blobC) return blobC;
    blobC = mkCanvas(64, 64);
    const g = blobC.getContext('2d');
    if (!g) { blobC = null; return null; }
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(40,25,15,0.55)');
    gr.addColorStop(0.5, 'rgba(40,25,15,0.3)');
    gr.addColorStop(1, 'rgba(40,25,15,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return blobC;
  }
  function drawShadowBlob(ctx, x, y, rx, ry, a) {
    if (!(rx > 0 && rx < 1e5) || !(ry > 0 && ry < 1e5) || !(a > 0) || !fin(x) || !fin(y)) return;
    const b = blob();
    if (!b) return;
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * Math.min(1, a);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(b, x - rx, y - ry, 2 * rx, 2 * ry);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- noise */
  function makeNoise(seed) {
    const r = mulberry32(seed);
    const perm = new Uint8Array(512), val = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
      const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  /* ---------------------------------------------------------------- rug texture (once) */
  const TEX_W = 1024, TEX_H = 512, FRINGE = 18;
  let rugTex = null;

  function stepDiamond(g, x, y, rx, ry, steps) {
    // stepped lozenge, the classic worn-Persian outline
    g.beginPath();
    const sx = rx / steps, sy = ry / steps;
    g.moveTo(x, y - ry);
    for (let i = 0; i < steps; i++) { g.lineTo(x + sx * i, y - ry + sy * (i + 1)); g.lineTo(x + sx * (i + 1), y - ry + sy * (i + 1)); }
    for (let i = 0; i < steps; i++) { g.lineTo(x + rx - sx * (i + 1), y + sy * i); g.lineTo(x + rx - sx * (i + 1), y + sy * (i + 1)); }
    for (let i = 0; i < steps; i++) { g.lineTo(x - sx * i, y + ry - sy * (i + 1)); g.lineTo(x - sx * (i + 1), y + ry - sy * (i + 1)); }
    for (let i = 0; i < steps; i++) { g.lineTo(x - rx + sx * (i + 1), y - sy * i); g.lineTo(x - rx + sx * (i + 1), y - sy * (i + 1)); }
    g.closePath();
  }

  function rugPattern(r) {
    const c = mkCanvas(TEX_W, TEX_H);
    const g = c.getContext('2d');
    const P = PAL, T = FRINGE;
    // pale blue washes ("abrash" clouds) in the field
    for (let i = 0; i < 14; i++) {
      g.fillStyle = rgba(i % 3 ? P.rugPaleBlue : P.rugSlate, 0.55);
      g.beginPath(); g.ellipse(r() * TEX_W, T + 110 + r() * 380, 40 + r() * 120, 12 + r() * 40, (r() - 0.5) * 0.6, 0, TAU); g.fill();
    }
    // outer guard stripes and the main border
    g.fillStyle = P.rugSlate; g.fillRect(0, T + 4, TEX_W, 5);
    g.fillStyle = P.rugRust; g.fillRect(0, T + 12, TEX_W, 4);
    g.fillStyle = rgba(P.rugPaleBlue, 0.9); g.fillRect(0, T + 18, TEX_W, 44);
    for (let x = 0; x < TEX_W + 64; x += 64) {
      g.fillStyle = P.rugRust; stepDiamond(g, x, T + 40, 26, 19, 4); g.fill();
      g.fillStyle = P.rugSalmon; stepDiamond(g, x, T + 40, 15, 11, 3); g.fill();
      g.fillStyle = P.rugPink; g.fillRect(x - 4, T + 37, 8, 6);
      g.fillStyle = P.rugSalmon; stepDiamond(g, x + 32, T + 40, 9, 14, 2); g.fill();
    }
    g.strokeStyle = P.rugRust; g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= TEX_W; x += 16) g.lineTo(x, T + 22 + ((x / 16) % 2) * 6);
    g.stroke();
    g.fillStyle = P.rugRust; g.fillRect(0, T + 64, TEX_W, 4);
    g.fillStyle = P.rugPink; g.fillRect(0, T + 72, TEX_W, 3);
    g.fillStyle = P.rugSlate; g.fillRect(0, T + 79, TEX_W, 2);
    // central medallion: nested stepped lozenges with pendants
    const mx = TEX_W / 2, my = 360;
    const rings = [[330, 150, P.rugPaleBlue], [300, 132, P.rugRust], [262, 112, P.rugSalmon], [220, 92, P.rugPaleBlue],
      [170, 72, P.rugRust], [120, 52, P.rugPink], [80, 34, P.rugSalmon], [40, 18, P.rugRust]];
    for (let i = 0; i < rings.length; i++) {
      g.fillStyle = rings[i][2]; stepDiamond(g, mx, my, rings[i][0], rings[i][1], 6 + (i % 3)); g.fill();
    }
    g.fillStyle = P.rugSlate; stepDiamond(g, mx, my - 175, 34, 24, 3); g.fill();
    g.fillStyle = P.rugRust; stepDiamond(g, mx, my - 175, 18, 12, 2); g.fill();
    // corner spandrels at the field edges
    for (const sx of [0, TEX_W]) {
      g.fillStyle = P.rugSalmon; stepDiamond(g, sx, T + 130, 170, 60, 6); g.fill();
      g.fillStyle = P.rugRust; stepDiamond(g, sx, T + 130, 120, 40, 5); g.fill();
      g.fillStyle = P.rugPaleBlue; stepDiamond(g, sx, T + 130, 60, 20, 3); g.fill();
    }
    // scattered small motifs: stepped crosses, rosettes, hooks
    for (let i = 0; i < 46; i++) {
      const x = r() * TEX_W, y = T + 100 + r() * 400;
      if (Math.abs(x - mx) < 330 * (1 - Math.abs(y - my) / 150) && Math.abs(y - my) < 150) continue;
      const k = r(), col = [P.rugRust, P.rugSalmon, P.rugPink, P.rugSlate, P.rugPaleBlue][(r() * 5) | 0];
      g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 3;
      if (k < 0.35) { g.fillRect(x - 10, y - 3, 20, 6); g.fillRect(x - 3, y - 10, 6, 20); }
      else if (k < 0.6) { for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * 8, y + Math.sin(a) * 5, 5, 3, a, 0, TAU); g.fill(); } }
      else if (k < 0.8) { stepDiamond(g, x, y, 14, 10, 3); g.fill(); }
      else { g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x - 7, y - 12, x, y); g.quadraticCurveTo(x + 7, y + 12, x + 14, y); g.stroke(); }
    }
    return c;
  }

  function buildRugTexture() {
    const r = mulberry32(7331);
    const pat = rugPattern(r);
    const pd = pat.getContext('2d').getImageData(0, 0, TEX_W, TEX_H).data;
    const c = mkCanvas(TEX_W, TEX_H);
    const g = c.getContext('2d');
    const img = g.createImageData(TEX_W, TEX_H);
    const d = img.data;
    const nA = makeNoise(11), nB = makeNoise(23), nC = makeNoise(37);
    const cr = rgbOf(PAL.rugCream);
    for (let y = FRINGE; y < TEX_H; y++) {
      for (let x = 0; x < TEX_W; x++) {
        const i = (y * TEX_W + x) * 4;
        // abrash: slow shifts in the cream
        const ab = nA(x / 90, y / 60) - 0.5;
        const warm = nB(x / 140 + 9, y / 90) - 0.5;
        let R = cr[0] + ab * 14 + warm * 6, G = cr[1] + ab * 13, B = cr[2] + ab * 12 - warm * 8;
        // sample the design through a small domain warp so stepped edges read hand-knotted and worn
        const wx = clamp(Math.round(x + (nB(x / 26, y / 26) - 0.5) * 16), 0, TEX_W - 1);
        const wy = clamp(Math.round(y + (nC(x / 26 + 5, y / 26) - 0.5) * 10), FRINGE, TEX_H - 1);
        const j = (wy * TEX_W + wx) * 4;
        const pa = pd[j + 3] / 255;
        if (pa > 0) {
          // wear: low-freq zones where the pattern survives, broken into pile speckle
          const wear = nC(x / 70, y / 45) * 0.55 + nB(x / 22, y / 14) * 0.3 + nA(x / 6, y / 4) * 0.15;
          const keep = r() < clamp((wear - 0.3) * 1.5, 0.0, 0.72);
          const k = keep ? 0.78 : 0.07;
          R = lerp(R, pd[j], k * pa); G = lerp(G, pd[j + 1], k * pa); B = lerp(B, pd[j + 2], k * pa);
        }
        // pile grain
        const gr = (r() - 0.5) * 16;
        d[i] = R + gr; d[i + 1] = G + gr; d[i + 2] = B + gr * 0.9; d[i + 3] = 255;
      }
    }
    // fringe threads above the back edge
    for (let x = 0; x < TEX_W; x += 3) {
      const len = 10 + ((r() * 8) | 0), sh = r() * 18 - 9;
      for (let y = FRINGE - len; y < FRINGE; y++) {
        const i = (y * TEX_W + x) * 4;
        const v = 222 + sh, fa = 120 + ((FRINGE - y) / len) * -60 + 60;
        d[i] = v + 4; d[i + 1] = v - 4; d[i + 2] = v - 16; d[i + 3] = fa;
      }
    }
    g.putImageData(img, 0, 0);
    // pile speckle: ~6000 one-to-two-pixel flecks
    for (let i = 0; i < 6000; i++) {
      const x = r() * TEX_W, y = FRINGE + r() * (TEX_H - FRINGE);
      const k = r();
      g.fillStyle = k < 0.45 ? 'rgba(170,150,125,0.5)' : k < 0.8 ? 'rgba(255,252,246,0.7)' :
        k < 0.9 ? rgba(PAL.rugRust, 0.7) : k < 0.96 ? rgba(PAL.rugSlate, 0.6) : rgba(PAL.rugPink, 0.7);
      const s = r() < 0.7 ? 1 : 2;
      g.fillRect(x, y, s, s);
    }
    // binding line along the back edge
    g.fillStyle = 'rgba(150,130,110,0.5)'; g.fillRect(0, FRINGE, TEX_W, 2);
    return c;
  }

  /* ---------------------------------------------------------------- layout (per resize) */
  /* The room and the floor overdraw a margin of M CSS px on every side: the game shakes the
   * screen by up to 18 px (SMASH) with a plain translate and never clears the canvas, so a
   * layer that stopped at the screen edge would leave a strip of the previous frame. */
  const M = 24;
  const LAY = { W: 0, H: 0, G: 0, dpr: 0, backY: 0, yWall: 0, U: 0, floorTop: 0, floorH: 0, roomTop: 0, roomH: 0,
    fringeH: 0, lampX: 0, lampY: 0, winX: 0, winY: 0, winW: 0, winH: 0 };
  let floorC = null, roomC = null, roomFull = null, roomNightC = null, roomDim = -1, starsC = null, moonC = null;
  let floorDimC = null, floorDimV = -1;

  function computeLayout(W, H, G) {
    LAY.W = W; LAY.H = H; LAY.G = G;
    const under = Math.max(0, H - G);
    LAY.backY = G - clamp(0.45 * under + 0.025 * H, 12, 110);
    LAY.yWall = LAY.backY - clamp(0.05 * H, 10, 60);
    LAY.U = clamp(Math.min(H * 0.085, W * 0.12), 18, 84);
    LAY.fringeH = clamp(0.008 * H, 3, 7);
    LAY.floorTop = LAY.backY - LAY.fringeH;
    LAY.floorH = H - LAY.floorTop + 4 + M;
    // the ceiling (and the fade into the sky above it) always starts above the screen at
    // camY = 0, and sits 12 U over the floor so a tall late-game tower scrolls the room down
    // far enough to open the sky on large screens too
    LAY.roomTop = Math.min(LAY.yWall - 12 * LAY.U, -1.6 * LAY.U - 12 - M);
    LAY.roomH = H - LAY.roomTop + 2 + M;
  }

  // Rebuilds on a size/dpr change, or on a groundY change passed to resize(). A groundY that
  // differs in a draw call only offsets the cached layers (see gOff), so it never thrashes.
  function ensureLayout(W, H, G, fromResize) {
    W = Math.round(W); H = Math.round(H);
    if (!(W > 0 && H > 0)) return false;
    if (!(G === G)) G = LAY.G > 0 && LAY.H === H ? LAY.G : H * 0.86;
    if (W === LAY.W && H === LAY.H && LAY.dpr === DPR && floorC && !(fromResize && Math.abs(G - LAY.G) >= 0.5)) return true;
    computeLayout(W, H, G);
    LAY.dpr = DPR;
    // drop the old size's layers right away (mobile Safari counts canvas memory until GC)
    freeCanvas(floorC); freeCanvas(floorDimC); freeCanvas(roomC); freeCanvas(roomFull); freeCanvas(roomNightC); freeCanvas(litC); freeCanvas(starsC);
    floorC = floorDimC = roomC = roomFull = roomNightC = litC = starsC = null;
    floorDimV = -1;
    if (!rugTex) rugTex = buildRugTexture();
    buildFloor();
    buildRoom();
    buildStars();
    return true;
  }

  const gOff = (G) => (G === G ? G - LAY.G : 0);

  function buildFloor() {
    const { W, backY, floorTop, floorH, H } = LAY;
    const s = Math.min(DPR, 2);
    // CSS x from -M to W + M, y from floorTop to H + 4 + M
    floorC = mkCanvas((W + 2 * M) * s, floorH * s);
    const g = floorC.getContext('2d');
    g.scale(s, s);
    g.translate(M, -floorTop);
    g.imageSmoothingQuality = 'high';
    const frontY = H + Math.max(M + 4, 0.15 * (H - backY));
    const zb = 1.65, zf = 1, Wf = W * 1.95, cx = W / 2;
    const N = 80, rows = TEX_H - FRINGE;
    const yAt = (v) => { const z = zb + (zf - zb) * v; return backY + (frontY - backY) * ((1 / z - 1 / zb) / (1 / zf - 1 / zb)); };
    const wAt = (v) => Wf / (zb + (zf - zb) * v);
    for (let i = 0; i < N; i++) {
      const v0 = i / N, v1 = (i + 1) / N;
      const y0 = yAt(v0), y1 = yAt(v1);
      if (y0 > H + M + 4) break;
      const w = wAt((v0 + v1) / 2);
      g.drawImage(rugTex, 0, FRINGE + v0 * rows, TEX_W, rows / N, cx - w / 2, y0, w, y1 - y0 + 0.6);
    }
    const wb = wAt(0);
    g.drawImage(rugTex, 0, 0, TEX_W, FRINGE, cx - wb / 2, floorTop, wb, LAY.fringeH + 0.5);
    // light from the window at the upper left, darker toward the viewer's knees
    const lg = g.createLinearGradient(0, backY, W, H);
    lg.addColorStop(0, 'rgba(255,250,240,0.10)');
    lg.addColorStop(1, 'rgba(90,60,40,0.10)');
    g.fillStyle = lg; g.fillRect(-M, backY, W + 2 * M, H + M + 4 - backY);
    const vg = g.createLinearGradient(0, backY, 0, backY + 10);
    vg.addColorStop(0, 'rgba(80,60,40,0.18)'); vg.addColorStop(1, 'rgba(80,60,40,0)');
    g.fillStyle = vg; g.fillRect(-M, backY, W + 2 * M, 10);
    // the two loose tiles lying at the back of the rug (photo 1): pink and yellow
    const band = H - backY;
    flatTile(g, W * 0.16, backY + band * 0.16, LAY.U * 0.62, '#F07FB0', 0.15);
    flatTile(g, W * 0.29, backY + band * 0.22, LAY.U * 0.5, PAL.yellow, -0.1);
    floorGrain(g, s);
  }

  // pile grain at screen resolution so the upscaled texture never looks blocky
  function floorGrain(g, s) {
    const c = g.canvas, w = c.width, h = c.height;
    const y0 = Math.max(0, Math.floor((LAY.backY - LAY.floorTop) * s));
    if (h - y0 <= 0) return;
    const img = g.getImageData(0, y0, w, h - y0), d = img.data;
    const r = mulberry32(919);
    for (let i = 0; i < d.length; i += 4) {
      const k = r();
      let n = (k - 0.5) * 14;
      if (k < 0.02) n -= 26; else if (k > 0.985) n += 22;
      d[i] = d[i] + n; d[i + 1] = d[i + 1] + n; d[i + 2] = d[i + 2] + n * 0.9;
    }
    g.putImageData(img, 0, y0);
  }

  function flatTile(g, x, y, w, col, sk) {
    const h = w * 0.32;
    const pts = [x - w / 2 + sk * w, y - h / 2, x + w / 2 + sk * w, y - h / 2, x + w / 2, y + h / 2, x - w / 2, y + h / 2];
    g.save();
    g.fillStyle = 'rgba(60,40,30,0.15)';
    g.beginPath(); polyPath(g, pts.map((v, i) => v + (i % 2 ? 2 : 1)), 2); g.fill();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = rgba(col, 0.75);
    g.beginPath(); polyPath(g, pts, 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = rgba(darken(col, 0.2), 0.8); g.lineWidth = Math.max(1, w * 0.06);
    g.beginPath(); polyPath(g, pts, 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pts[6] + 2, pts[7] - 1); g.lineTo(pts[0] + 2, pts[1] + 1); g.stroke();
    g.restore();
  }

  /* ---------------------------------------------------------------- room (per resize, 1/4 res) */
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function vgrad(g, y0, y1, c0, c1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
  function hgrad(g, x0, x1, c0, c1) { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }

  function paintRoom(g) {
    const { W, H, yWall: yW, U, backY, roomTop } = LAY;
    const cx = W / 2;
    // narrow (portrait) screens get photo 2's composition: egg chair left, window and side
    // table behind, the armchair cut by the right edge, the bag and box on the floor
    const narrow = W / U < 12;
    let sh = 0;
    const at = (wide, nar) => { sh = narrow ? nar - wide : 0; };
    const X = (u) => cx + (u + sh) * U;
    const fy = (k) => yW + (backY - yW) * k; // floor depth: 0 at the wall, 1 at the rug edge
    // full-width bands cover the overdraw margin too: x from -M to W + M
    const x0 = -M, xw = W + 2 * M, yB = H + M + 2;
    // wall + ceiling
    g.fillStyle = vgrad(g, roomTop, yW, '#E6E1D8', PAL.wall);
    g.fillRect(x0, roomTop, xw, yW - roomTop + 1);
    g.fillStyle = '#DCD6CC'; g.fillRect(x0, roomTop, xw, 0.55 * U);
    g.fillStyle = '#FBF9F5'; g.fillRect(x0, roomTop + 0.55 * U, xw, 0.25 * U);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x0, roomTop + 0.8 * U, xw, 0.12 * U);
    // window light falling across the wall
    const wl = g.createRadialGradient(X(1.6), yW - 6 * U, U, X(1.6), yW - 6 * U, 8 * U);
    wl.addColorStop(0, 'rgba(255,255,250,0.55)'); wl.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = wl; g.fillRect(x0, roomTop, xw, yW - roomTop);
    // wood floor
    g.fillStyle = vgrad(g, yW, H, '#8A6B50', '#A7876A');
    g.fillRect(x0, yW, xw, yB - yW);
    g.strokeStyle = 'rgba(60,40,25,0.25)'; g.lineWidth = Math.max(1, U * 0.03);
    for (let k = 0, y = yW + 0.15 * U; y < yB; k++) {
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + xw, y); g.stroke();
      y += (0.12 + k * 0.05) * U;
    }
    g.fillStyle = 'rgba(255,245,225,0.18)'; ell(g, X(0), fy(0.5), 6 * U, 0.25 * U); g.fill();
    // baseboard
    g.fillStyle = '#FBF9F6'; g.fillRect(x0, yW - 0.3 * U, xw, 0.3 * U);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, yW - 0.02 * U, xw, 0.06 * U);

    // door (far left)
    g.fillStyle = '#F7F4EE'; g.fillRect(X(-13.4), yW - 9.6 * U, 3.6 * U, 9.6 * U);
    g.strokeStyle = '#DAD3C7'; g.lineWidth = 0.25 * U; g.strokeRect(X(-13.4), yW - 9.6 * U, 3.6 * U, 9.6 * U);
    g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 0.08 * U;
    g.strokeRect(X(-13), yW - 9 * U, 2.8 * U, 3.8 * U); g.strokeRect(X(-13), yW - 4.6 * U, 2.8 * U, 4 * U);
    g.fillStyle = '#C9A55A'; ell(g, X(-10.3), yW - 4.8 * U, 0.16 * U, 0.16 * U); g.fill();

    // floor lamp (the L11 goal), in view: wide screens between the console and the egg
    // chair, narrow ones beside the window (drawn there, in front of the window frame)
    const lamp = (lx) => {
      LAY.lampX = lx; LAY.lampY = yW - 7.55 * U;
      g.fillStyle = '#3A3A3A'; ell(g, lx, yW + 0.05 * U, 0.6 * U, 0.12 * U); g.fill();
      g.fillRect(lx - 0.05 * U, yW - 7 * U, 0.1 * U, 7 * U);
      g.fillStyle = vgrad(g, yW - 8.3 * U, yW - 6.8 * U, '#F6EEDC', '#E3D2B2');
      g.beginPath(); g.moveTo(lx - 0.6 * U, yW - 6.8 * U); g.lineTo(lx + 0.6 * U, yW - 6.8 * U); g.lineTo(lx + 0.3 * U, yW - 8.3 * U); g.lineTo(lx - 0.3 * U, yW - 8.3 * U); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,100,70,0.18)'; g.fillRect(lx - 0.6 * U, yW - 6.86 * U, 1.2 * U, 0.06 * U);
    };
    if (!narrow) lamp(cx - 5.6 * U);

    at(-6.7, -4.4);
    // white console standing by the wall, cables to the outlet
    g.fillStyle = '#EDEDEF'; ell(g, X(-6.7), yW + 0.02 * U, 0.7 * U, 0.12 * U); g.fill();
    g.fillStyle = hgrad(g, X(-7.2), X(-6.2), '#FFFFFF', '#D9D9DE');
    g.beginPath(); g.moveTo(X(-7.15), yW - 0.05 * U); g.quadraticCurveTo(X(-7.3), yW - 2 * U, X(-7.0), yW - 3.3 * U);
    g.lineTo(X(-6.35), yW - 3.15 * U); g.quadraticCurveTo(X(-6.15), yW - 1.6 * U, X(-6.3), yW - 0.05 * U); g.closePath(); g.fill();
    g.fillStyle = '#1D1D22'; g.fillRect(X(-6.8), yW - 3.1 * U, 0.2 * U, 3.0 * U);
    g.fillStyle = '#FFFFFF'; g.fillRect(X(-6.2), yW - 1.5 * U, 0.4 * U, 0.4 * U);
    g.fillStyle = '#E2DED6'; g.fillRect(X(-5.85), yW - 1.4 * U, 0.3 * U, 0.4 * U);
    g.strokeStyle = 'rgba(40,40,45,0.8)'; g.lineWidth = Math.max(1, 0.05 * U);
    g.beginPath(); g.moveTo(X(-6.4), yW - 1.6 * U); g.bezierCurveTo(X(-6.0), yW - 1.2 * U, X(-5.9), yW - 0.3 * U, X(-5.4), fy(0.25)); g.stroke();
    g.beginPath(); g.moveTo(X(-5.7), yW - 1.1 * U); g.bezierCurveTo(X(-5.6), yW - 0.2 * U, X(-6.6), fy(0.5), X(-7.8), fy(0.8)); g.stroke();
    g.strokeStyle = 'rgba(150,150,155,0.9)';
    const cm = narrow ? -4.2 : -7.3, cp = narrow ? -5.0 : -8.0; // mint / pink controller x
    g.beginPath(); g.moveTo(X(-5.4), fy(0.25)); g.bezierCurveTo(X(-5.0), fy(0.6), X(cm - 0.4), fy(0.3), X(cm - 0.1), fy(0.55)); g.stroke();
    g.beginPath(); g.moveTo(X(-5.4), fy(0.25)); g.bezierCurveTo(X(-5.7), fy(0.7), X(cp - 0.1), fy(0.9), X(cp + 0.1), fy(0.75)); g.stroke();
    // controllers: mint and pink
    controller(g, X(cm), fy(0.58), 0.75 * U, '#9FE3C9', 0.15);
    controller(g, X(cp), fy(0.78), 0.6 * U, '#F4A6C6', -0.25);

    at(-3.3, -2.3);
    // egg pod chair: pedestal, shell with its opening, fabric canopy
    const ex = X(-3.3), ey = yW - 3.25 * U, er = 2.15 * U;
    g.fillStyle = 'rgba(0,0,0,0.12)'; ell(g, ex + 0.2 * U, fy(0.35), 1.6 * U, 0.22 * U); g.fill();
    g.fillStyle = vgrad(g, yW - 0.4 * U, fy(0.3), '#FFFFFF', '#E3DFD8'); ell(g, ex, fy(0.22), 1.35 * U, 0.3 * U); g.fill();
    g.fillStyle = hgrad(g, ex - 0.6 * U, ex + 0.6 * U, '#FFFFFF', '#DCD7CF');
    g.beginPath(); g.moveTo(ex - 0.45 * U, fy(0.2)); g.quadraticCurveTo(ex - 0.3 * U, yW - 0.6 * U, ex - 0.35 * U, ey + er * 0.82);
    g.lineTo(ex + 0.35 * U, ey + er * 0.82); g.quadraticCurveTo(ex + 0.3 * U, yW - 0.6 * U, ex + 0.45 * U, fy(0.2)); g.closePath(); g.fill();
    const sg = g.createRadialGradient(ex - er * 0.4, ey - er * 0.4, er * 0.2, ex, ey, er * 1.05);
    sg.addColorStop(0, '#FFFFFF'); sg.addColorStop(0.7, '#F3F0EA'); sg.addColorStop(1, '#D6D0C6');
    g.fillStyle = sg; ell(g, ex, ey, er, er * 1.02); g.fill();
    g.fillStyle = vgrad(g, ey - er, ey + er, '#E9E4DB', '#CFC8BC'); ell(g, ex + 0.62 * U, ey + 0.05 * U, er * 0.62, er * 0.88, -0.12); g.fill();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 0.14 * U; ell(g, ex + 0.62 * U, ey + 0.05 * U, er * 0.62, er * 0.88, -0.12); g.stroke();
    g.fillStyle = '#F2EDE4'; ell(g, ex + 0.75 * U, ey + 0.9 * U, er * 0.42, er * 0.25, -0.1); g.fill();
    // canopy: a ribbed fabric hood fanning up and back from a hub on the shell's crown
    const hx = ex + 0.55 * er, hy = ey - 0.92 * er;
    const rim = [[ex - 1.75 * U, ey - 0.62 * er], [ex - 1.55 * U, ey - er - 1.3 * U], [ex - 0.6 * U, ey - er - 2.25 * U],
      [ex + 0.7 * U, ey - er - 2.45 * U], [ex + 1.9 * U, ey - er - 1.75 * U], [ex + 2.25 * U, ey - er - 0.7 * U]];
    g.fillStyle = vgrad(g, ey - er - 2.5 * U, ey - er * 0.3, '#FFFFFF', '#E6E2DA');
    g.beginPath(); g.moveTo(hx, hy);
    g.lineTo(rim[0][0], rim[0][1]);
    for (let i = 1; i < rim.length; i++) {
      const mx = (rim[i - 1][0] + rim[i][0]) / 2, my = (rim[i - 1][1] + rim[i][1]) / 2;
      g.quadraticCurveTo(mx + (mx - hx) * 0.08, my + (my - hy) * 0.08, rim[i][0], rim[i][1]);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(150,140,125,0.45)'; g.lineWidth = 0.06 * U;
    for (let i = 0; i < rim.length; i++) { g.beginPath(); g.moveTo(hx, hy); g.lineTo(rim[i][0], rim[i][1]); g.stroke(); }
    g.fillStyle = 'rgba(170,160,145,0.18)';
    for (let i = 1; i < rim.length; i += 2) { g.beginPath(); g.moveTo(hx, hy); g.lineTo(rim[i - 1][0], rim[i - 1][1]); g.lineTo(rim[i][0], rim[i][1]); g.closePath(); g.fill(); }
    g.fillStyle = '#B9B4AC'; ell(g, hx, hy, 0.16 * U, 0.16 * U); g.fill();

    at(0.8, -0.9);
    // window with the AC unit
    const wx = X(0.8), wy = yW - 9.4 * U, ww = 4.0 * U, wh = 5.6 * U;
    LAY.winX = wx; LAY.winY = wy; LAY.winW = ww; LAY.winH = wh;
    g.fillStyle = '#FAF9F6'; g.fillRect(wx - 0.25 * U, wy - 0.25 * U, ww + 0.5 * U, wh + 0.5 * U);
    g.fillStyle = vgrad(g, wy, wy + wh, '#DDEBF5', '#F4F8FA'); g.fillRect(wx, wy, ww, wh);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.moveTo(wx + 0.4 * U, wy + wh); g.lineTo(wx + 1.4 * U, wy); g.lineTo(wx + 1.9 * U, wy); g.lineTo(wx + 0.9 * U, wy + wh); g.fill();
    g.fillStyle = '#FAF9F6'; g.fillRect(wx + ww / 2 - 0.08 * U, wy, 0.16 * U, wh * 0.55); g.fillRect(wx, wy + wh * 0.5, ww, 0.16 * U);
    g.fillStyle = '#EFECE6'; g.fillRect(wx - 0.4 * U, wy + wh + 0.2 * U, ww + 0.8 * U, 0.2 * U);
    const ax = wx + 0.7 * U, ay = wy + wh - 1.55 * U;
    g.fillStyle = vgrad(g, ay, ay + 1.5 * U, '#FFFFFF', '#E3E1DC'); g.fillRect(ax, ay, 2.6 * U, 1.5 * U);
    g.strokeStyle = 'rgba(120,120,120,0.45)'; g.lineWidth = 0.05 * U;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(ax + 0.2 * U, ay + (0.25 + i * 0.2) * U); g.lineTo(ax + 2.4 * U, ay + (0.25 + i * 0.2) * U); g.stroke(); }
    g.fillStyle = '#D5D2CB'; g.fillRect(wx + 0.05 * U, ay + 0.1 * U, 0.6 * U, 1.3 * U); g.fillRect(ax + 2.6 * U, ay + 0.1 * U, 0.6 * U, 1.3 * U);

    if (narrow) lamp(cx + 3.9 * U);

    at(3.4, 1.3);
    // dark side table with a white top and a black pad on it
    const tx = X(3.4), ty = yW - 2.2 * U;
    g.strokeStyle = '#2E231C'; g.lineWidth = 0.16 * U; g.lineCap = 'round';
    g.beginPath(); g.moveTo(tx - 0.5 * U, ty); g.lineTo(tx - 0.75 * U, fy(0.15));
    g.moveTo(tx + 0.5 * U, ty); g.lineTo(tx + 0.75 * U, fy(0.15));
    g.moveTo(tx - 0.2 * U, ty); g.lineTo(tx - 0.25 * U, yW - 0.05 * U);
    g.moveTo(tx + 0.2 * U, ty); g.lineTo(tx + 0.3 * U, yW - 0.05 * U); g.stroke();
    g.fillStyle = '#3A2C22'; g.fillRect(tx - 0.65 * U, ty - 0.05 * U, 1.3 * U, 0.2 * U);
    g.fillStyle = '#ECE9E3'; ell(g, tx, ty - 0.12 * U, 0.9 * U, 0.18 * U); g.fill();
    g.fillStyle = '#1C1C20'; ell(g, tx + 0.1 * U, ty - 0.28 * U, 0.35 * U, 0.14 * U); g.fill();

    at(4.6, 2.5);
    // raspberry armchair with tapered wooden legs
    const ax0 = X(4.6), aw = 3.6 * U;
    g.fillStyle = 'rgba(0,0,0,0.14)'; ell(g, ax0 + aw / 2, fy(0.3), aw * 0.55, 0.22 * U); g.fill();
    g.strokeStyle = PAL.armchairLegs; g.lineWidth = 0.17 * U;
    g.beginPath(); g.moveTo(ax0 + 0.35 * U, yW - 0.6 * U); g.lineTo(ax0 + 0.15 * U, fy(0.3));
    g.moveTo(ax0 + aw - 0.35 * U, yW - 0.6 * U); g.lineTo(ax0 + aw - 0.15 * U, fy(0.3));
    g.moveTo(ax0 + 0.7 * U, yW - 0.6 * U); g.lineTo(ax0 + 0.8 * U, yW - 0.05 * U);
    g.moveTo(ax0 + aw - 0.7 * U, yW - 0.6 * U); g.lineTo(ax0 + aw - 0.6 * U, yW - 0.05 * U); g.stroke();
    const rasp = PAL.armchair;
    g.fillStyle = darken(rasp, 0.1); g.beginPath(); rrect(g, ax0 + 0.2 * U, yW - 3.9 * U, aw - 0.4 * U, 2.6 * U, 0.5 * U); g.fill();
    g.fillStyle = vgrad(g, yW - 3.9 * U, yW - 1.4 * U, lighten(rasp, 0.08), darken(rasp, 0.12));
    g.beginPath(); rrect(g, ax0 + 0.35 * U, yW - 3.8 * U, aw - 0.7 * U, 2.3 * U, 0.4 * U); g.fill();
    g.fillStyle = darken(rasp, 0.15); g.beginPath(); rrect(g, ax0, yW - 1.25 * U, aw, 0.7 * U, 0.15 * U); g.fill();
    g.fillStyle = vgrad(g, yW - 1.8 * U, yW - 1.1 * U, lighten(rasp, 0.12), rasp);
    g.beginPath(); rrect(g, ax0 + 0.45 * U, yW - 1.85 * U, aw - 0.9 * U, 0.75 * U, 0.25 * U); g.fill();
    g.fillStyle = vgrad(g, yW - 2.6 * U, yW - 0.6 * U, lighten(rasp, 0.1), darken(rasp, 0.18));
    g.beginPath(); rrect(g, ax0 - 0.05 * U, yW - 2.55 * U, 0.65 * U, 2.0 * U, 0.3 * U); g.fill();
    g.beginPath(); rrect(g, ax0 + aw - 0.6 * U, yW - 2.55 * U, 0.65 * U, 2.0 * U, 0.3 * U); g.fill();

    at(0, 0);
    // bookshelf (far right)
    const bx = X(8.4), by = yW - 7.8 * U;
    g.fillStyle = '#EDE7DD'; g.fillRect(bx, by, 2.8 * U, 7.8 * U);
    g.fillStyle = '#D5CCBE';
    const bookCols = ['#C4473A', '#3E6FB0', '#E2B33B', '#5C9C5A', '#8A5BA8', '#E07A3A', '#2F3B55'];
    const br = mulberry32(99);
    for (let s = 0; s < 4; s++) {
      const sy = by + (s + 1) * 1.9 * U;
      g.fillStyle = '#D5CCBE'; g.fillRect(bx, sy - 0.12 * U, 2.8 * U, 0.12 * U);
      let x = bx + 0.15 * U;
      while (x < bx + 2.5 * U) {
        const w = (0.18 + br() * 0.16) * U, h = (1.1 + br() * 0.55) * U;
        g.fillStyle = bookCols[(br() * bookCols.length) | 0];
        g.fillRect(x, sy - 0.12 * U - h, w, h);
        x += w + 0.03 * U;
      }
    }

    // watermelon bag on the floor (the L1 goal, so it must be visible beside the tower):
    // green stripes, purple handle, no logo. Wide layouts: by the egg chair's pedestal.
    at(-4.75, -2.9);
    const bs = narrow ? 1 : 1.4;
    const mx = X(-4.75), my = fy(0.62), mrx = 0.95 * U * bs, mry = 0.62 * U * bs;
    const bu = U * bs;
    g.fillStyle = 'rgba(0,0,0,0.15)'; ell(g, mx + 0.1 * bu, my + mry * 0.9, mrx * 1.05, 0.16 * bu); g.fill();
    g.strokeStyle = '#6A3C9E'; g.lineWidth = 0.2 * bu;
    g.beginPath(); g.ellipse(mx - mrx * 0.95, my + 0.05 * bu, 0.38 * bu, 0.3 * bu, 0, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    g.fillStyle = '#86DA5A'; ell(g, mx, my, mrx, mry); g.fill();
    g.save(); ell(g, mx, my, mrx, mry); g.clip();
    g.fillStyle = '#3FA63A';
    for (let i = -3; i <= 3; i++) {
      g.beginPath(); g.ellipse(mx + i * 0.32 * bu, my, 0.09 * bu, mry * 1.1, i * 0.08, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.25)'; ell(g, mx - 0.3 * bu, my - 0.3 * bu, 0.4 * bu, 0.15 * bu, -0.2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)'; ell(g, mx + 0.2 * bu, my + 0.5 * bu, mrx, 0.25 * bu); g.fill();
    g.restore();
    g.fillStyle = '#A6E57C'; ell(g, mx + 0.1 * bu, my - mry * 0.75, 0.3 * bu, 0.1 * bu); g.fill();

    // the tile set's box lying on the floor, made-up colourful panel
    at(0.2, 2.9);
    boxShape(g, X(0.2), fy(0.92), 2.7 * U, false);
    sh = 0;
  }

  function controller(g, x, y, w, col, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.15)'; ell(g, 0.05 * w, 0.22 * w, 0.55 * w, 0.12 * w); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-0.5 * w, 0.05 * w);
    g.quadraticCurveTo(-0.55 * w, -0.25 * w, -0.2 * w, -0.2 * w); g.lineTo(0.2 * w, -0.2 * w);
    g.quadraticCurveTo(0.55 * w, -0.25 * w, 0.5 * w, 0.05 * w); g.quadraticCurveTo(0.45 * w, 0.28 * w, 0.25 * w, 0.18 * w);
    g.lineTo(-0.25 * w, 0.18 * w); g.quadraticCurveTo(-0.45 * w, 0.28 * w, -0.5 * w, 0.05 * w); g.fill();
    g.fillStyle = darken(col, 0.25); ell(g, -0.22 * w, -0.03 * w, 0.08 * w, 0.06 * w); g.fill(); ell(g, 0.22 * w, -0.03 * w, 0.08 * w, 0.06 * w); g.fill();
    g.restore();
  }

  // the tile-set box: white with a colourful made-up panel (also used by drawTileBox)
  function boxShape(g, x, yb, w, lid) {
    const side = 0.3 * w, depth = 0.26 * w, sk = 0.06 * w;
    const y1 = yb - side, y0 = y1 - depth;
    g.fillStyle = 'rgba(40,30,20,0.18)'; ell(g, x + 0.03 * w, yb + 0.02 * w, w * 0.56, 0.06 * w); g.fill();
    // front face
    g.fillStyle = vgrad(g, y1, yb, '#FFFFFF', '#E6E3DE'); g.fillRect(x - w / 2, y1, w, side);
    g.fillStyle = '#2F79C9'; g.fillRect(x + w * 0.3, y1, w * 0.2, side);
    g.fillStyle = '#F2C230'; ell(g, x + w * 0.4, y1 + side * 0.55, w * 0.05, side * 0.25); g.fill();
    const blocks = ['#E8323C', '#FFD21F', '#2EBF4F', '#2F5BEA', '#8A4FE0'];
    for (let i = 0; i < 5; i++) { g.fillStyle = blocks[i]; g.fillRect(x - w * 0.42 + i * w * 0.075, y1 + side * 0.62, w * 0.055, side * 0.2); }
    g.fillStyle = 'rgba(60,60,70,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(x - w * 0.42 + i * w * 0.16, y1 + side * 0.25, w * 0.11, side * 0.12);
    // top face (lid)
    g.fillStyle = '#FBFAF7';
    g.beginPath(); g.moveTo(x - w / 2, y1); g.lineTo(x + w / 2, y1); g.lineTo(x + w / 2 + sk, y0); g.lineTo(x - w / 2 + sk, y0); g.closePath(); g.fill();
    if (!lid) {
      g.fillStyle = '#7CC6EE';
      g.beginPath(); g.moveTo(x - w * 0.42, y1 - depth * 0.1); g.lineTo(x + w * 0.42, y1 - depth * 0.1);
      g.lineTo(x + w * 0.42 + sk * 0.8, y0 + depth * 0.1); g.lineTo(x - w * 0.42 + sk * 0.8, y0 + depth * 0.1); g.closePath(); g.fill();
      for (let i = 0; i < 5; i++) { g.fillStyle = blocks[i]; g.fillRect(x - w * 0.3 + i * w * 0.12 + sk * 0.5, y0 + depth * 0.3, w * 0.08, depth * 0.4); }
    }
    g.strokeStyle = 'rgba(120,110,100,0.35)'; g.lineWidth = Math.max(1, w * 0.008);
    g.beginPath(); g.moveTo(x - w / 2, y1); g.lineTo(x + w / 2, y1); g.lineTo(x + w / 2 + sk, y0); g.stroke();
    return { y0, y1, side, depth, sk };
  }

  function buildRoom() {
    const { W, roomTop, roomH } = LAY;
    // paint at half res, then shrink to a quarter: smooth, cheap depth-of-field blur
    // the room covers x from -M to W + M (the overdraw margin)
    const s2 = 0.5, s4 = 0.25, RW = W + 2 * M;
    const c2 = mkCanvas(RW * s2, roomH * s2);
    const g2 = c2.getContext('2d');
    g2.scale(s2, s2); g2.translate(M, -roomTop);
    paintRoom(g2);
    // soft haze so the tiles pop in front
    g2.fillStyle = 'rgba(242,238,232,0.16)'; g2.fillRect(-M, roomTop, RW, roomH);
    roomC = mkCanvas(RW * s4, roomH * s4);
    const g4 = roomC.getContext('2d');
    g4.imageSmoothingQuality = 'high';
    g4.drawImage(c2, 0, 0, roomC.width, roomC.height);
    freeCanvas(c2);
    roomDim = -1;
    roomFull = null;
  }

  /* Night is light, not a veil: the room is MULTIPLIED by the evening colour (warm at dusk,
   * deep blue at night), so whites go blue-dark while the armchair keeps its raspberry, and
   * then lit ('lighter') by the warm floor lamp and the cool moonlit window. */
  const NIGHT_KEYS = ['#FFFFFF', '#D6AFA6', '#3A4270']; // day, dusk (0.5), night (1)
  function nightMul(dim) {
    return dim <= 0.5 ? mix(NIGHT_KEYS[0], NIGHT_KEYS[1], dim / 0.5) : mix(NIGHT_KEYS[1], NIGHT_KEYS[2], (dim - 0.5) / 0.5);
  }
  function mulHex(a, b) {
    const x = rgbOf(a), y = rgbOf(b);
    return toHex((x[0] * y[0]) / 255, (x[1] * y[1]) / 255, (x[2] * y[2]) / 255);
  }
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // soft elliptical glow (radial gradient squashed by the transform), drawn 'lighter'
  function glow(g, x, y, rx, ry, rgb, a) {
    if (!(a > 0.004)) return;
    g.save();
    g.translate(x, y); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')');
    gr.addColorStop(0.45, 'rgba(' + rgb + ',' + (a * 0.38).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  }
  // Re-light part of the dark room: the DAY room, tinted by the light's colour, laid back
  // over the night room through a soft elliptical mask. Lit surfaces keep their own colours
  // (a cream wall near the lamp, not an orange smudge on blue). Quarter res, once per dim.
  let litC = null;
  function relight(g, k, x, y, rx, ry, tint, a) {
    if (!(a > 0.004)) return;
    const w = roomC.width, h = roomC.height;
    if (!litC || litC.width !== w || litC.height !== h) { freeCanvas(litC); litC = mkCanvas(w, h); }
    const l = litC.getContext('2d');
    if (!l) return;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, w, h);
    l.drawImage(roomC, 0, 0);
    l.globalCompositeOperation = 'multiply';
    l.fillStyle = tint;
    l.fillRect(0, 0, w, h);
    l.globalCompositeOperation = 'destination-in';
    l.setTransform(k, 0, 0, k, M * k, -LAY.roomTop * k);
    l.translate(x, y); l.scale(rx, ry);
    const gr = l.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')');
    gr.addColorStop(0.5, 'rgba(0,0,0,' + (a * 0.55).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = gr;
    l.fillRect(-1e3, -1e3, 2e3, 2e3);
    l.globalCompositeOperation = 'source-over';
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(litC, 0, 0);
    g.restore();
  }
  function nightLights(g, k, dim) {
    const { U, yWall: yW, backY } = LAY;
    const kL = smooth(0.35, 0.95, dim), kM = smooth(0.55, 1, dim);
    // the floor lamp lights the wall and the floor around it warm, and glows
    const lx = LAY.lampX, ly = LAY.lampY;
    relight(g, k, lx, ly + 1.2 * U, 3.6 * U, 5.6 * U, '#FFD2A0', 0.85 * kL);
    g.globalCompositeOperation = 'lighter';
    glow(g, lx, ly, 2.6 * U, 2.3 * U, '255,160,80', 0.22 * kL);
    glow(g, lx, ly - 1.6 * U, 1.3 * U, 2.0 * U, '255,190,120', 0.14 * kL);
    glow(g, lx, ly, 0.85 * U, 0.8 * U, '255,226,170', 0.95 * kL);
    // the moonlit window: cool light spilling down the wall and onto the floor below it, the
    // glass showing the night outside (deep blue, a few stars, moonlight catching a corner)
    const wx = LAY.winX, wy = LAY.winY, ww = LAY.winW, wh = LAY.winH;
    if (kM > 0.004) {
      relight(g, k, wx + ww * 0.45, yW - 0.6 * U, ww * 0.85, 1.6 * U + (backY - yW), '#9DB2EE', 0.45 * kM);
      const gh = wh - 1.65 * U; // the glass above the AC unit
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(14,20,52,' + (0.6 * kM).toFixed(3) + ')';
      g.fillRect(wx, wy, ww, gh);
      g.globalCompositeOperation = 'lighter';
      glow(g, wx + ww * 0.8, wy + gh * 0.16, ww * 0.38, gh * 0.3, '170,190,255', 0.2 * kM);
      const r = mulberry32(515);
      g.fillStyle = 'rgba(255,250,230,' + (0.75 * kM).toFixed(3) + ')';
      for (let i = 0; i < 7; i++) {
        const sx = wx + (0.08 + 0.84 * r()) * ww, sy = wy + (0.06 + 0.8 * r()) * gh, ss = (0.06 + 0.06 * r()) * U;
        g.beginPath(); g.arc(sx, sy, ss / 2, 0, TAU); g.fill();
      }
      glow(g, wx + ww / 2, wy + wh * 0.45, ww * 0.95, wh * 0.78, '100,130,220', 0.1 * kM);
    }
    g.globalCompositeOperation = 'source-over';
  }

  // the blurred room scaled up once to device resolution, with the night light baked in and
  // its top edge fading into the sky; per frame it is a single 1:1 blit
  function roomAt(dim) {
    if (roomFull && Math.abs(dim - roomDim) < 0.04) return roomFull;
    const { W, roomH, roomTop, U } = LAY;
    const rs = Math.min(DPR, 2), RW = W + 2 * M;
    if (!roomFull || roomFull.width !== Math.ceil(RW * rs) || roomFull.height !== Math.ceil(roomH * rs)) { freeCanvas(roomFull); roomFull = mkCanvas(RW * rs, roomH * rs); }
    const g = roomFull.getContext('2d');
    if (!g) return null;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, roomFull.width, roomFull.height);
    let src = roomC;
    if (dim > 0.02) {
      // evening light is applied to the quarter-res room, so the lamp, the window and its
      // stars get the same depth-of-field blur as everything else in the room
      if (!roomNightC || roomNightC.width !== roomC.width || roomNightC.height !== roomC.height) {
        freeCanvas(roomNightC);
        roomNightC = mkCanvas(roomC.width, roomC.height);
      }
      const n = roomNightC.getContext('2d');
      if (n) {
        n.setTransform(1, 0, 0, 1, 0, 0);
        n.globalCompositeOperation = 'source-over';
        n.drawImage(roomC, 0, 0);
        n.globalCompositeOperation = 'multiply';
        n.fillStyle = nightMul(dim);
        n.fillRect(0, 0, roomNightC.width, roomNightC.height);
        const k = roomC.width / (W + 2 * M);
        n.setTransform(k, 0, 0, k, M * k, -roomTop * k); // CSS px from here
        nightLights(n, k, dim);
        n.setTransform(1, 0, 0, 1, 0, 0);
        src = roomNightC;
      }
    }
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, roomFull.width, roomFull.height);
    const fh = 1.6 * U * rs;
    const gr = g.createLinearGradient(0, 0, 0, fh);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gr; g.fillRect(0, 0, roomFull.width, fh);
    g.globalCompositeOperation = 'source-over';
    roomDim = dim;
    return roomFull;
  }

  function buildStars() {
    const { W, H } = LAY;
    const rs = Math.min(DPR, 2);
    starsC = mkCanvas(W * rs, H * rs);
    const g = starsC.getContext('2d');
    g.scale(rs, rs);
    const r = mulberry32(4242);
    const n = Math.round((W * H) / 2600);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, s = r() < 0.85 ? 1 : 2;
      g.fillStyle = 'rgba(255,250,235,' + (0.35 + r() * 0.6).toFixed(2) + ')';
      g.fillRect(x, y, s, s);
      if (s === 2 && r() < 0.4) { g.fillStyle = 'rgba(255,250,235,0.25)'; g.fillRect(x - 2, y + 0.5, 6, 1); g.fillRect(x + 0.5, y - 2, 1, 6); }
    }
    if (!moonC) {
      moonC = mkCanvas(160, 160);
      const m = moonC.getContext('2d');
      const gl = m.createRadialGradient(80, 80, 20, 80, 80, 80);
      gl.addColorStop(0, 'rgba(246,241,217,0.45)'); gl.addColorStop(1, 'rgba(246,241,217,0)');
      m.fillStyle = gl; m.fillRect(0, 0, 160, 160);
      m.fillStyle = PAL.moon; m.beginPath(); m.arc(80, 80, 30, 0, TAU); m.fill();
      m.fillStyle = 'rgba(200,190,160,0.35)';
      m.beginPath(); m.arc(70, 72, 7, 0, TAU); m.fill(); m.beginPath(); m.arc(90, 92, 5, 0, TAU); m.fill(); m.beginPath(); m.arc(88, 68, 3.5, 0, TAU); m.fill();
    }
  }

  /* ---------------------------------------------------------------- sky + room + rug per frame */
  const SKY_KEYS = [
    // t, top, bottom
    [0, '#7DBDEB', '#D9EEFA'],
    [0.5, '#4A3E86', '#F2A36B'],
    [1, '#141936', '#2A3260'],
  ];
  let skyGrad = null, skyGradKey = -1;
  function skyColors(t, out) {
    const a = t < 0.5 ? SKY_KEYS[0] : SKY_KEYS[1], b = t < 0.5 ? SKY_KEYS[1] : SKY_KEYS[2];
    const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    out[0] = mix(a[1], b[1], k); out[1] = mix(a[2], b[2], k);
    return out;
  }
  const SKY_TMP = ['', ''];

  function drawRoom(ctx, W, H, groundY, camY, skyT) {
    frameMark();
    if (!fin(W) || !fin(H) || !ensureLayout(W, H, groundY)) return;
    camY = fin(camY) ? camY : 0;
    skyT = skyT > 0 ? Math.min(1, skyT) : 0;
    // remembered for this frame's drawRug / drawLight / ghosts: they dim with the room
    curDim = Math.round(skyT * 25) / 25;
    const ga = ctx.globalAlpha;
    const oy = camY * 0.4 + gOff(groundY);
    const top = LAY.roomTop + oy;
    const fade = 1.6 * LAY.U;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    // everything below covers the screen plus the overdraw margin M on every side
    if (top + fade > -M - 2) {
      const key = Math.round(skyT * 50) + 64 * Math.round(H);
      if (key !== skyGradKey) {
        skyColors(skyT, SKY_TMP);
        skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, SKY_TMP[0]); skyGrad.addColorStop(1, SKY_TMP[1]);
        skyGradKey = key;
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-M, -M, W + 2 * M, top + fade + M + 2);
      const night = clamp((skyT - 0.45) / 0.55, 0, 1);
      if (night > 0 && starsC) {
        ctx.save();
        ctx.beginPath(); ctx.rect(-M, -M, W + 2 * M, top + fade + M); ctx.clip();
        ctx.globalAlpha = ga * night;
        const sy = (camY * 0.1) % H;
        if (sy > 0) ctx.drawImage(starsC, 0, sy - H, W, H);
        ctx.drawImage(starsC, 0, sy, W, H);
        const ms = clamp(Math.min(W, H) * 0.32, 90, 220);
        ctx.drawImage(moonC, W * 0.78 - ms / 2, H * 0.16 - ms / 2 + camY * 0.05, ms, ms);
        ctx.restore();
      }
    }
    const rf = roomAt(curDim);
    // blit only the part on screen. Nearest sampling: at DPR <= 2 the cached room is at
    // device resolution (exact), at DPR 3 it is a 1.5x upscale of an already blurred
    // picture (no visible difference); bilinear would cost ~10 ms a frame in software
    // (the room canvas is W + 2M wide, so x maps 1:1 from -M; off-canvas parts cost nothing)
    const sTop = Math.max(0, -M - top), sBot = Math.min(LAY.roomH, H + M - top);
    if (rf && sBot > sTop) {
      ctx.imageSmoothingEnabled = false;
      const k = rf.height / LAY.roomH;
      ctx.drawImage(rf, 0, sTop * k, rf.width, (sBot - sTop) * k, -M, top + sTop, W + 2 * M, sBot - sTop);
    }
    const bot = top + LAY.roomH;
    if (bot < H + M) {
      if (floorFillDim !== curDim) { floorFillDim = curDim; floorFillCol = curDim > 0.02 ? mulHex('#A7876A', nightMul(curDim)) : '#A7876A'; }
      ctx.fillStyle = floorFillCol; ctx.fillRect(-M, bot - 1, W + 2 * M, H + M - bot + 1);
    }
    ctx.restore();
  }
  let floorFillDim = -1, floorFillCol = '#A7876A';

  // the rug at dusk / night: multiplied by the same evening colour as the room, cached
  function floorAt(dim) {
    if (!(dim > 0.02) || !floorC) return floorC;
    if (floorDimC && floorDimV === dim) return floorDimC;
    if (!floorDimC || floorDimC.width !== floorC.width || floorDimC.height !== floorC.height) {
      freeCanvas(floorDimC);
      floorDimC = mkCanvas(floorC.width, floorC.height);
    }
    const g = floorDimC.getContext('2d');
    if (!g) return floorC;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, floorDimC.width, floorDimC.height);
    g.drawImage(floorC, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = nightMul(dim);
    g.fillRect(0, 0, floorDimC.width, floorDimC.height);
    g.globalCompositeOperation = 'destination-in'; // keep the fringe gaps transparent
    g.drawImage(floorC, 0, 0);
    g.globalCompositeOperation = 'source-over';
    floorDimV = dim;
    return floorDimC;
  }

  function drawRug(ctx, W, H, groundY, camY) {
    if (!fin(W) || !fin(H) || !ensureLayout(W, H, groundY)) return;
    camY = fin(camY) ? camY : 0;
    const y = LAY.floorTop + camY + gOff(groundY);
    const fc = floorAt(curDim);
    if (!fc || !(y < H + M)) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = DPR > 2; // device resolution at DPR <= 2: nearest is exact
    // x from -M to W + M: the floor canvas carries the overdraw margin (1:1, no stretch)
    ctx.drawImage(fc, -M, y, W + 2 * M, LAY.floorH);
    ctx.restore();
  }

  /* Stained-glass light: the standing build's tile bodies sheared back-and-right onto the
   * rug (y squashed to 0.22 about the ground line, skewed right). It is painted into a
   * small reusable offscreen at about 1/4 resolution (cheap, and the upscale gives the
   * soft penumbra edges), confined to the rug band and faded out well before the rug's
   * back edge, then laid on the rug twice: multiply (the tint) + 'lighter' (a bright core).
   * It dims with the room at night.
   */
  const LIGHT_SK = 0.42, LIGHT_SQ = 0.22, LIGHT_KX = 0.25, LIGHT_KY = 0.5;
  let lightC = null, lightG = null, lightFade = null, lightFadeKey = -1;
  function drawLight(ctx, tiles, L, groundY, camY, alpha) {
    if (!tiles || !tiles.length || !(alpha > 0) || !okL(L) || !floorC) return;
    camY = fin(camY) ? camY : 0;
    const go = gOff(groundY);
    const gy = LAY.G + go + camY;                       // ground line on screen
    const yBack = LAY.backY + go + camY;                // rug back edge on screen
    const band = gy - yBack;
    if (!(yBack < LAY.H) || !(band > 2)) return;
    const a = Math.min(1, alpha) * ctx.globalAlpha * (1 - 0.7 * curDim);
    if (!(a > 0.003)) return;
    const y0 = Math.floor(yBack), y1 = Math.min(LAY.H + 2, Math.ceil(gy + 2));
    if (!(y1 > y0)) return;
    const bw = Math.ceil(LAY.W * LIGHT_KX) + 2, bh = Math.ceil((y1 - y0) * LIGHT_KY) + 2;
    if (!lightC || lightC.width < bw || lightC.height < bh) {
      freeCanvas(lightC);
      lightC = mkCanvas(bw, bh + 8);
      lightG = lightC.getContext('2d');
      lightFadeKey = -1;
    }
    const g = lightG;
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, bw, bh);
    // screen CSS px -> buffer, then the shear-and-squash about the ground line
    g.setTransform(LIGHT_KX, 0, 0, LIGHT_KY, 0, -y0 * LIGHT_KY);
    g.transform(1, 0, -LIGHT_SK, LIGHT_SQ, LIGHT_SK * gy, (1 - LIGHT_SQ) * gy);
    g.globalCompositeOperation = 'multiply'; // overlaps mix in the light too
    const q = qOf(L);
    let n = 0;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t || !fin(t.cx) || !fin(t.cy)) continue;
      // only tiles low enough to land on the rug band
      if ((gy - t.cy) * LIGHT_SQ > band + L) continue;
      let si = SHAPE_IDX[t.shape], shape = t.shape;
      if (si === undefined) { si = 0; shape = 'sq'; }
      let color = shape === 'crown' || shape === 'cube' ? 'orange' : t.color;
      let ci = COLOR_IDX[color];
      if (ci === undefined) { ci = 0; color = 'red'; }
      const rot = fin(t.rot) ? t.rot : 0;
      g.save();
      g.translate(t.cx, t.cy);
      if (rot) g.rotate(rot);
      blit(g, tileSprite(K_BODY, shape, si, color, ci, 0, q), L);
      g.restore();
      n++;
    }
    if (!n) return;
    // fade to nothing ~2.5 L of tower height before the back edge (0.22 * 2.5 L on screen)
    g.setTransform(1, 0, 0, 1, 0, 0);
    const fEnd = clamp(0.55 * L, 0.12 * band, 0.45 * band), fStart = Math.max(fEnd + 2, 0.8 * band);
    const yE = (yBack - y0 + fEnd) * LIGHT_KY, yS = (yBack - y0 + fStart) * LIGHT_KY;
    const key = Math.round(yE * 4) * 65536 + Math.round(yS * 4);
    if (key !== lightFadeKey) {
      lightFade = g.createLinearGradient(0, yE, 0, yS);
      lightFade.addColorStop(0, 'rgba(0,0,0,0)');
      lightFade.addColorStop(1, 'rgba(0,0,0,1)');
      lightFadeKey = key;
    }
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = lightFade;
    g.fillRect(0, 0, bw, bh);
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = true;
      ctx.beginPath(); ctx.rect(-20, yBack, LAY.W + 40, y1 - yBack + 20); ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = a * 0.5;
      ctx.drawImage(lightC, 0, 0, bw, bh, 0, y0, bw / LIGHT_KX, bh / LIGHT_KY);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.16;
      ctx.drawImage(lightC, 0, 0, bw, bh, 0, y0, bw / LIGHT_KX, bh / LIGHT_KY);
    } finally {
      ctx.restore();
    }
  }

  function resize(W, H, dpr, groundY) {
    const d = clamp(+dpr || 1, 1, 3);
    if (d !== DPR) { DPR = d; SPR = Math.min(d, 2); clearCache(); }
    if (fin(W) && fin(H)) ensureLayout(W, H, groundY, true);
  }

  /* ---------------------------------------------------------------- goal ribbon */
  const RIB_DASH = [8, 6];
  function ribbonPath(ctx, len, h, t, phase, curl) {
    const N = 18;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s = i / N, x = s * len;
      const y = Math.sin(t * 3.1 + phase + s * 5) * h * 0.22 + curl * s * s * len * 0.35;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  function ribbonStroke(ctx, len, h, t, phase, curl) {
    ribbonPath(ctx, len, h, t, phase, curl);
    ctx.setLineDash(NO_DASH);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(30,37,65,0.55)'; ctx.lineWidth = h + 3; ctx.stroke();
    ctx.strokeStyle = '#FFC531'; ctx.lineWidth = h; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = h * 0.25;
    ctx.save(); ctx.translate(0, -h * 0.25); ctx.stroke(); ctx.restore();
    RIB_DASH[0] = h * 1.3; RIB_DASH[1] = h * 1.0;
    ctx.setLineDash(RIB_DASH);
    ctx.lineDashOffset = -t * h * 2;
    ctx.strokeStyle = '#E8323C'; ctx.lineWidth = h * 0.42; ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
  function drawRibbon(ctx, x0, x1, y, L, tear, t) {
    if (!okL(L) || !fin(x0) || !fin(x1) || !fin(y)) return;
    if (x1 < x0) { const tmp = x0; x0 = x1; x1 = tmp; }
    tear = tear > 0 ? Math.min(1, tear) : 0;
    t = fin(t) ? t : 0;
    ctx.save();
    try { ribbonBody(ctx, x0, x1, y, L, tear, t); } finally { ctx.restore(); }
  }
  function ribbonBody(ctx, x0, x1, y, L, tear, t) {
    const h = clamp(0.14 * L, 3, 15);
    ctx.globalCompositeOperation = 'source-over';
    if (tear <= 0) {
      ctx.save(); ctx.translate(x0, y); ribbonStroke(ctx, x1 - x0, h, t, 0, 0); ctx.restore();
    } else {
      const half = (x1 - x0) / 2 - h * 0.3 * tear;
      const a = (1 - Math.pow(1 - tear, 3)) * 1.25 + Math.sin(t * 13) * 0.06 * (1 - tear);
      ctx.save(); ctx.translate(x0, y); ctx.rotate(a); ribbonStroke(ctx, half, h, t, 0, tear * 0.6); ctx.restore();
      ctx.save(); ctx.translate(x1, y); ctx.scale(-1, 1); ctx.rotate(a); ribbonStroke(ctx, half, h, t, 1.7, tear * 0.6); ctx.restore();
    }
    // pins at both ends
    ctx.fillStyle = '#1E2541';
    ctx.beginPath(); ctx.arc(x0, y, h * 0.55, 0, TAU); ctx.arc(x1, y, h * 0.55, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFC531';
    ctx.beginPath(); ctx.arc(x0, y, h * 0.32, 0, TAU); ctx.arc(x1, y, h * 0.32, 0, TAU); ctx.fill();
  }

  /* ---------------------------------------------------------------- goal icons */
  const ICON_KEYS = ['melon', 'box', 'armchair', 'eggchair', 'table', 'armback', 'window', 'eggtop',
    'ac', 'you', 'lamp', 'shelf', 'grownup', 'door', 'ceiling', 'roof', 'clouds', 'moon'];
  const ICON_IDX = Object.create(null);
  ICON_KEYS.forEach((k, i) => { ICON_IDX[k] = i; });

  function heightArrow(g, x, y) {
    g.strokeStyle = '#E39B00'; g.lineWidth = 3; g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(14, y); g.lineTo(86, y); g.stroke(); g.setLineDash(NO_DASH);
    g.fillStyle = '#FFC531'; g.strokeStyle = '#1E2541'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x - 9, y - 9); g.lineTo(x - 4, y - 9); g.lineTo(x - 4, y - 20);
    g.lineTo(x + 4, y - 20); g.lineTo(x + 4, y - 9); g.lineTo(x + 9, y - 9); g.closePath(); g.fill(); g.stroke();
  }
  function iconChair(g, sx) {
    g.fillStyle = '#C99A64';
    g.fillRect(28, 70, 5, 14); g.fillRect(67, 70, 5, 14);
    g.fillStyle = '#B3244A';
    g.beginPath(); rrect(g, 26, 26, 48, 34, 9); g.fill(); g.stroke();
    g.beginPath(); rrect(g, 20, 52, 60, 20, 6); g.fill(); g.stroke();
    g.fillStyle = '#C7385E';
    g.beginPath(); rrect(g, 18, 44, 13, 28, 6); g.fill(); g.stroke();
    g.beginPath(); rrect(g, 69, 44, 13, 28, 6); g.fill(); g.stroke();
  }
  function iconEgg(g) {
    g.fillStyle = '#F7F5F0';
    g.beginPath(); g.ellipse(50, 84, 18, 5, 0, 0, TAU); g.fill(); g.stroke();
    g.fillRect(45, 64, 10, 20); g.strokeRect(45, 64, 10, 20);
    g.beginPath(); g.arc(48, 46, 24, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#DCD5CA'; g.beginPath(); g.ellipse(56, 48, 13, 18, -0.15, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.moveTo(26, 34); g.quadraticCurveTo(32, 8, 60, 12); g.quadraticCurveTo(78, 16, 76, 34); g.closePath(); g.fill(); g.stroke();
  }

  function buildIcon(L, key) {
    const size = L;
    const s = makeSprite(L, -size / 2, -size / 2, size / 2, size / 2, 2);
    if (!s) return null;
    const g = s.g;
    g.scale(size / 100, size / 100);
    g.translate(-50, -50);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // badge
    g.fillStyle = 'rgba(30,37,65,0.25)'; g.beginPath(); g.arc(51, 53, 47, 0, TAU); g.fill();
    g.fillStyle = key === 'moon' ? '#1B2140' : key === 'clouds' || key === 'roof' ? '#BFE3FA' : '#FFFFFF';
    g.beginPath(); g.arc(50, 50, 46, 0, TAU); g.fill();
    g.strokeStyle = '#1E2541'; g.lineWidth = 4; g.stroke();
    g.lineWidth = 3;
    switch (key) {
      case 'melon': {
        g.strokeStyle = '#6A3C9E'; g.lineWidth = 6;
        g.beginPath(); g.ellipse(26, 54, 10, 9, 0, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
        g.lineWidth = 3; g.strokeStyle = '#1E2541';
        g.fillStyle = '#86DA5A'; g.beginPath(); g.ellipse(53, 55, 27, 20, 0, 0, TAU); g.fill();
        g.save(); g.clip(); g.fillStyle = '#3FA63A';
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(53 + i * 11, 55, 3.5, 22, 0, 0, TAU); g.fill(); }
        g.restore();
        g.beginPath(); g.ellipse(53, 55, 27, 20, 0, 0, TAU); g.stroke();
        break;
      }
      case 'box': {
        g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(18, 48); g.lineTo(76, 48); g.lineTo(84, 36); g.lineTo(26, 36); g.closePath(); g.fill(); g.stroke();
        g.fillRect(18, 48, 58, 28); g.strokeRect(18, 48, 58, 28);
        g.fillStyle = '#2F79C9'; g.fillRect(58, 49.5, 16, 25);
        const bc = ['#E8323C', '#FFD21F', '#2EBF4F', '#2F5BEA'];
        for (let i = 0; i < 4; i++) { g.fillStyle = bc[i]; g.fillRect(23 + i * 8, 60, 6, 8); }
        g.beginPath(); g.moveTo(84, 36); g.lineTo(84, 64); g.lineTo(76, 76); g.stroke();
        break;
      }
      case 'armchair': iconChair(g); break;
      case 'armback': iconChair(g); heightArrow(g, 50, 24); break;
      case 'eggchair': iconEgg(g); break;
      case 'eggtop': iconEgg(g); heightArrow(g, 50, 13); break;
      case 'table': {
        g.strokeStyle = '#2E231C'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(36, 42); g.lineTo(28, 82); g.moveTo(64, 42); g.lineTo(72, 82); g.moveTo(46, 42); g.lineTo(44, 78); g.moveTo(54, 42); g.lineTo(57, 78); g.stroke();
        g.lineWidth = 3; g.strokeStyle = '#1E2541';
        g.fillStyle = '#ECE9E3'; g.beginPath(); g.ellipse(50, 38, 28, 8, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#1C1C20'; g.beginPath(); g.ellipse(52, 34, 9, 4, 0, 0, TAU); g.fill();
        break;
      }
      case 'window': {
        g.fillStyle = '#DDEEF8'; g.fillRect(22, 18, 56, 64); g.strokeRect(22, 18, 56, 64);
        g.beginPath(); g.moveTo(50, 18); g.lineTo(50, 82); g.moveTo(22, 50); g.lineTo(78, 50); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(28, 46); g.lineTo(40, 22); g.lineTo(46, 22); g.lineTo(34, 46); g.fill();
        g.fillStyle = '#EFECE6'; g.fillRect(16, 82, 68, 6); g.strokeRect(16, 82, 68, 6);
        break;
      }
      case 'ac': {
        g.fillStyle = '#FFFFFF'; g.beginPath(); rrect(g, 18, 30, 64, 34, 5); g.fill(); g.stroke();
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(24, 38 + i * 6); g.lineTo(76, 38 + i * 6); g.stroke(); }
        g.strokeStyle = '#5EC8F2'; g.lineWidth = 3;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(30 + i * 18, 70); g.quadraticCurveTo(26 + i * 18, 78, 32 + i * 18, 86); g.stroke(); }
        break;
      }
      case 'you': {
        g.strokeStyle = '#1E2541'; g.lineWidth = 2.5;
        for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(18, 22 + i * 10); g.lineTo(i % 2 ? 24 : 28, 22 + i * 10); g.stroke(); }
        g.beginPath(); g.moveTo(18, 18); g.lineTo(18, 86); g.stroke();
        g.save();
        g.beginPath();
        g.moveTo(40, 30); g.lineTo(50, 26); g.quadraticCurveTo(58, 32, 66, 26); g.lineTo(76, 30); g.lineTo(84, 44);
        g.lineTo(75, 48); g.lineTo(73, 42); g.lineTo(73, 76); g.lineTo(43, 76); g.lineTo(43, 42); g.lineTo(41, 48); g.lineTo(32, 44); g.closePath();
        g.fillStyle = '#1E2541'; g.fill();
        g.clip();
        for (let i = 0; i < 6; i++) { g.fillStyle = '#E8C547'; g.fillRect(30, 34 + i * 8, 60, 2.6); g.fillStyle = '#8FA6C9'; g.fillRect(30, 37.5 + i * 8, 60, 1.8); }
        g.restore();
        g.strokeStyle = '#1E2541'; g.lineWidth = 3;
        g.strokeStyle = '#FFC531'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(18, 22); g.lineTo(86, 22); g.stroke(); g.setLineDash(NO_DASH);
        break;
      }
      case 'lamp': {
        g.fillStyle = '#3A3A3A'; g.beginPath(); g.ellipse(50, 84, 14, 4, 0, 0, TAU); g.fill();
        g.fillRect(48, 36, 4, 48);
        g.fillStyle = '#F6EEDC'; g.beginPath(); g.moveTo(32, 40); g.lineTo(68, 40); g.lineTo(60, 16); g.lineTo(40, 16); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,214,120,0.55)'; g.beginPath(); g.moveTo(34, 42); g.lineTo(66, 42); g.lineTo(78, 64); g.lineTo(22, 64); g.closePath(); g.fill();
        break;
      }
      case 'shelf': {
        g.fillStyle = '#EDE7DD'; g.fillRect(24, 14, 52, 72); g.strokeRect(24, 14, 52, 72);
        const bc = ['#C4473A', '#3E6FB0', '#E2B33B', '#5C9C5A', '#8A5BA8', '#E07A3A'];
        for (let r = 0; r < 3; r++) {
          g.beginPath(); g.moveTo(24, 38 + r * 24); g.lineTo(76, 38 + r * 24); g.stroke();
          for (let i = 0; i < 5; i++) { g.fillStyle = bc[(i + r * 2) % 6]; g.fillRect(28 + i * 9, 20 + r * 24 - (i % 2) * 2, 7, 16 + (i % 2) * 2); }
        }
        break;
      }
      case 'grownup': {
        g.fillStyle = '#BFD8B8';
        g.beginPath(); g.moveTo(30, 10); g.lineTo(48, 10); g.lineTo(46, 64); g.lineTo(32, 64); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(52, 10); g.lineTo(70, 10); g.lineTo(68, 64); g.lineTo(54, 64); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#F0C2A0';
        g.beginPath(); g.moveTo(33, 64); g.lineTo(45, 64); g.lineTo(46, 76); g.quadraticCurveTo(46, 84, 38, 84); g.lineTo(20, 84); g.quadraticCurveTo(16, 78, 24, 75); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(55, 64); g.lineTo(67, 64); g.lineTo(76, 75); g.quadraticCurveTo(84, 78, 80, 84); g.lineTo(62, 84); g.quadraticCurveTo(54, 84, 54, 76); g.closePath(); g.fill(); g.stroke();
        break;
      }
      case 'door': {
        g.fillStyle = '#F2E6D3'; g.fillRect(30, 12, 40, 76); g.strokeRect(30, 12, 40, 76);
        g.strokeRect(36, 18, 28, 26); g.strokeRect(36, 50, 28, 32);
        g.fillStyle = '#C9A55A'; g.beginPath(); g.arc(63, 50, 3.5, 0, TAU); g.fill(); g.stroke();
        break;
      }
      case 'ceiling': {
        g.fillStyle = '#E6E1D8'; g.fillRect(8, 14, 84, 14); g.beginPath(); g.moveTo(8, 28); g.lineTo(92, 28); g.stroke();
        g.beginPath(); g.moveTo(50, 28); g.lineTo(50, 46); g.stroke();
        g.fillStyle = '#FFE08A'; g.beginPath(); g.moveTo(36, 62); g.quadraticCurveTo(50, 36, 64, 62); g.closePath(); g.fill(); g.stroke();
        heightArrow(g, 50, 28);
        break;
      }
      case 'roof': {
        g.fillStyle = '#F7F4EE'; g.fillRect(28, 50, 44, 34); g.strokeRect(28, 50, 44, 34);
        g.fillStyle = '#E8323C'; g.beginPath(); g.moveTo(18, 52); g.lineTo(50, 22); g.lineTo(82, 52); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#9C7B5E'; g.fillRect(62, 24, 8, 16); g.strokeRect(62, 24, 8, 16);
        g.fillStyle = '#5EC8F2'; g.fillRect(43, 60, 14, 12); g.strokeRect(43, 60, 14, 12);
        break;
      }
      case 'clouds': {
        g.fillStyle = '#FFFFFF';
        g.beginPath(); g.arc(36, 56, 13, 0, TAU); g.arc(52, 46, 17, 0, TAU); g.arc(68, 56, 12, 0, TAU); g.rect(36, 56, 32, 13); g.fill();
        g.beginPath(); g.moveTo(36, 69); g.lineTo(68, 69); g.stroke();
        g.beginPath(); g.arc(36, 56, 13, Math.PI * 0.5, Math.PI * 1.55); g.stroke();
        g.beginPath(); g.arc(52, 46, 17, Math.PI * 1.1, Math.PI * 1.95); g.stroke();
        g.beginPath(); g.arc(68, 56, 12, Math.PI * 1.45, Math.PI * 0.5); g.stroke();
        break;
      }
      case 'moon': {
        g.fillStyle = '#F6F1D9';
        g.beginPath(); g.arc(50, 50, 24, 0, TAU); g.fill();
        g.fillStyle = '#1B2140'; g.beginPath(); g.arc(62, 42, 21, 0, TAU); g.fill();
        g.fillStyle = '#FFF6C8'; sparkle(g, 72, 66, 6); sparkle(g, 76, 26, 4); sparkle(g, 30, 24, 3.5);
        break;
      }
      default: {
        g.fillStyle = '#FFC531'; sparkle(g, 50, 50, 26);
      }
    }
    return finish(s);
  }

  function drawGoalIcon(ctx, key, x, y, size) {
    if (!(size >= 2 && size < 1e5) || !fin(x) || !fin(y)) return;
    let k = ICON_IDX[key];
    if (k === undefined) { key = '?'; k = 31; }
    ctx.save();
    try {
      ctx.translate(x, y);
      ctx.globalCompositeOperation = 'source-over';
      blit(ctx, getSprite(9400 + k, qOf(size), buildIcon, key), size);
    } finally {
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- grown-up's foot */
  function drawFoot(ctx, x, groundY, L, t, side) {
    if (!okL(L) || !fin(x) || !fin(groundY)) return;
    t = t > 0 ? Math.min(1, t) : 0;
    const FL = 3.1 * L;
    drawShadowBlob(ctx, x, groundY + 0.08 * L, FL * (0.25 + 0.35 * t), 0.3 * L * (0.4 + 0.6 * t), 0.15 + 0.5 * t);
    ctx.save();
    try { footBody(ctx, x, groundY, L, t, side); } finally { ctx.restore(); }
  }
  function footBody(ctx, x, groundY, L, t, side) {
    const e = t * t;
    const lift = (1 - e) * (groundY + 5 * L);
    ctx.translate(x, groundY - lift);
    if (side === 1) ctx.scale(-1, 1);
    // trouser leg rising past the top of the screen
    const top = -(groundY - lift) - 60;
    ctx.fillStyle = '#BFD8B8';
    ctx.beginPath(); ctx.moveTo(-0.95 * L, top); ctx.lineTo(0.45 * L, top); ctx.lineTo(0.4 * L, -1.05 * L); ctx.lineTo(-0.95 * L, -1.05 * L); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(70,100,70,0.18)'; ctx.fillRect(-0.95 * L, top, 0.35 * L, -top - 1.05 * L);
    ctx.fillStyle = '#AFCAA8'; ctx.fillRect(-1.0 * L, -1.18 * L, 1.48 * L, 0.18 * L);
    // bare foot, toes toward +x
    ctx.fillStyle = '#F0C2A0';
    ctx.beginPath();
    ctx.moveTo(-0.85 * L, -1.02 * L);
    ctx.lineTo(0.3 * L, -1.02 * L);
    ctx.quadraticCurveTo(0.45 * L, -0.55 * L, 1.15 * L, -0.42 * L);
    ctx.quadraticCurveTo(1.75 * L, -0.33 * L, 2.05 * L, -0.22 * L);
    ctx.quadraticCurveTo(2.22 * L, -0.12 * L, 2.1 * L, 0);
    ctx.lineTo(-0.7 * L, 0);
    ctx.quadraticCurveTo(-1.1 * L, -0.02 * L, -1.05 * L, -0.42 * L);
    ctx.quadraticCurveTo(-1.0 * L, -0.8 * L, -0.85 * L, -1.02 * L);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(190,110,80,0.28)';
    ctx.beginPath(); ctx.moveTo(-0.7 * L, 0); ctx.lineTo(2.1 * L, 0); ctx.quadraticCurveTo(0.8 * L, -0.25 * L, -0.9 * L, -0.12 * L); ctx.closePath(); ctx.fill();
    // toes
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#F0C2A0';
      ctx.beginPath(); ctx.ellipse((1.45 + i * 0.17) * L, (-0.24 + i * 0.04) * L, 0.16 * L, 0.13 * L, 0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,90,65,0.4)'; ctx.lineWidth = Math.max(0.7, 0.02 * L); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,236,226,0.95)';
    ctx.beginPath(); ctx.ellipse(2.02 * L, -0.17 * L, 0.08 * L, 0.06 * L, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,85,60,0.45)'; ctx.lineWidth = Math.max(0.8, 0.025 * L);
    ctx.beginPath(); ctx.moveTo(-0.6 * L, -0.55 * L); ctx.quadraticCurveTo(-0.3 * L, -0.45 * L, -0.15 * L, -0.62 * L); ctx.stroke();
  }

  /* ---------------------------------------------------------------- title */
  const TITLE = 'CLACKSTACK';
  const TITLE_COLS = ['red', 'orange', 'yellow', 'green', 'blue', 'lightBlue', 'purple', 'red', 'orange', 'yellow'];
  const TL = []; // reused layout records
  for (let i = 0; i < 10; i++) TL.push({ x: 0, y: 0, s: 0 });
  const FONT_STACK = 'Fredoka, ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
  let titleFont = '', titleFontS = -1;

  function titleLayout(cx, cy, w) {
    w = fin(w) ? Math.min(1e4, Math.max(40, w)) : 40;
    if (w >= 620) {
      const s = Math.min((w * 0.94) / (10 + 9 * 0.1 + 0.6), 100);
      let x = cx - (10 * s + 9 * 0.1 * s + 0.6 * s) / 2 + s / 2;
      for (let i = 0; i < 10; i++) {
        TL[i].x = x; TL[i].y = cy; TL[i].s = s;
        x += s * 1.1 + (i === 4 ? 0.6 * s : 0);
      }
    } else {
      const s = Math.min((w * 0.94) / (5 + 4 * 0.12), 110);
      for (let i = 0; i < 10; i++) {
        const row = i < 5 ? 0 : 1, k = i % 5;
        TL[i].x = cx + (k - 2) * s * 1.12 + (row ? 0.22 * s : -0.22 * s);
        TL[i].y = cy + (row ? 0.6 : -0.6) * s * 1.05;
        TL[i].s = s;
      }
    }
    return TL;
  }

  // the returned array and its 10 boxes are reused on every call (no per-frame garbage):
  // read them straight away, copy them if you need to keep them
  const TBOX = [];
  for (let i = 0; i < 10; i++) TBOX.push({ x: 0, y: 0, w: 0, h: 0 });
  function titleLetterBoxes(cx, cy, w) {
    titleLayout(fin(cx) ? cx : 0, fin(cy) ? cy : 0, w);
    for (let i = 0; i < 10; i++) {
      const r = TL[i], b = TBOX[i];
      b.x = r.x - r.s / 2; b.y = r.y - r.s / 2; b.w = r.s; b.h = r.s;
    }
    return TBOX;
  }

  const TITLE_TILE_O = { variant: 2, flash: 0 };
  function drawTitle(ctx, cx, cy, w, t, wobble) {
    if (!fin(cx) || !fin(cy)) return;
    titleLayout(cx, cy, w);
    t = fin(t) ? t : 0;
    const s = TL[0].s;
    if (s !== titleFontS) { titleFontS = s; titleFont = '700 ' + Math.round(s * 0.74) + 'px ' + FONT_STACK; }
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const r = TL[i];
      const wb = wobble && wobble[i] > 0 ? Math.min(1, wobble[i]) : 0;
      const bob = Math.sin(t * 2.2 + i * 0.7) * 0.035 * s;
      const y = r.y + bob - 0.3 * s * wb;
      const rot = Math.sin(t * 1.3 + i * 1.9) * 0.03 + (i % 2 ? 0.2 : -0.2) * wb;
      TITLE_TILE_O.flash = wb * 0.5;
      drawTile(ctx, 'sq', TITLE_COLS[i], r.x, y, rot, s, TITLE_TILE_O);
      ctx.save();
      ctx.translate(r.x, y);
      ctx.rotate(rot);
      ctx.font = titleFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#1E2541';
      ctx.fillText(TITLE[i], 0.04 * s, 0.1 * s);
      ctx.strokeStyle = '#1E2541';
      ctx.lineWidth = 0.13 * s;
      ctx.strokeText(TITLE[i], 0, 0.05 * s);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(TITLE[i], 0, 0.05 * s);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- title build (data) */
  /* The boy's build, mirrored to the photo-3 side so the wall keeps the contract's -18 deg
   * (screen convention: counter-clockwise, top edge rising to the right): the wall of
   * blue / light-blue / yellow squares leans LEFT onto the triangle dome's flank, its foot
   * stands behind a front row of marble squares (no empty wedge under it, nothing
   * overhangs), the orange triangle balances on its high corner, the cube waits at the left.
   * Array order is draw order: wall first (it is behind), then dome, front row, crown.
   */
  const titleBuild = (() => {
    const tiles = [], rings = [];
    const h = SQ3 / 2;
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const add = (shape, color, x, y, rot, variant) => tiles.push({ shape, color, x: r3(x), y: r3(y), rot: r3(rot || 0), variant: variant || 0 });
    const d = -1.8; // left edge of the dome's base row
    // the sloped wall: 3 columns x 5 rows, pivot at its bottom-left corner on the rug,
    // hidden behind the dome's base; the bottom row is mostly behind the front row
    const th = (18 * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th);
    const px = d + 2.8, py = 0;
    const W = (lx, ly) => [px + lx * c - ly * sn, py + lx * sn + ly * c];
    const cols = [
      ['green', 'yellow', 'yellow', 'yellow', 'yellow'],          // against the dome
      ['orange', 'blue', 'lightBlue', 'blue', 'lightBlue'],
      ['yellow', 'lightBlue', 'blue', 'lightBlue', 'blue'],
    ];
    for (let col = 0; col < 3; col++) for (let row = 0; row < 5; row++) {
      const p = W(col + 0.5, row + 0.5);
      add('sq', cols[col][row], p[0], p[1], -th, (col + row) % 3 === 2 ? 1 : 0);
    }
    const ra = W(1.5, 4.5), rb = W(0.5, 3.5);
    rings.push({ x: r3(ra[0]), y: r3(ra[1]) }, { x: r3(rb[0]), y: r3(rb[1]) });
    // the dome: green squares and a marble square, then Δ∇Δ bands of triangles
    add('sq', 'green', d + 0.5, 0.5, 0, 1);
    add('marble', 'lightBlue', d + 1.5, 0.5, 0, 0);
    add('sq', 'green', d + 2.5, 0.5, 0, 0);
    const triC = ['red', 'orange', 'blue', 'purple', 'green', 'orange', 'purple', 'blue', 'red'];
    let ti = 0;
    for (let row = 0; row < 3; row++) {
      const nUp = 3 - row, y0 = 1 + row * h;
      for (let k = 0; k < nUp; k++) add('tri', triC[ti++], d + 0.5 + row * 0.5 + k, y0 + h / 3, 0, k % 2);
      for (let k = 0; k < nUp - 1; k++) add('tri', triC[ti++], d + 1 + row * 0.5 + k, y0 + (2 * h) / 3, Math.PI, 0);
    }
    // marble squares at the front, standing in front of the wall's foot
    add('marble', 'red', d + 3.5, 0.5, 0, 0);
    add('marble', 'purple', d + 4.5, 0.5, 0, 1);
    add('sq', 'green', d + 5.5, 0.5, 0, 2);
    // the orange triangle balanced on the wall's high corner, the very peak
    const pk = W(2.5, 5 + h / 3);
    add('crown', 'orange', pk[0], pk[1], -th, 0);
    return { tiles, rings, cube: { x: r3(d - 1.15), y: 1 } };
  })();

  /* ---------------------------------------------------------------- tile box (best scores) */
  const BOX_COLS = ['#E8323C', '#FF7A1A', '#FFD21F', '#2EBF4F', '#2F5BEA', '#5EC8F2', '#8A4FE0'];
  function drawTileBox(ctx, x, y, w, lines) {
    if (!(w >= 8 && w < 1e5) || !fin(x) || !fin(y)) return;
    ctx.save();
    try { tileBoxBody(ctx, x, y, w, lines); } finally { ctx.restore(); }
  }
  function tileBoxBody(ctx, x, y, w, lines) {
    ctx.globalCompositeOperation = 'source-over';
    const side = 0.17 * w, depth = 0.46 * w, sk = 0.07 * w;
    const y1 = y - side, y0 = y1 - depth;
    drawShadowBlob(ctx, x + 0.04 * w, y + 0.01 * w, w * 0.6, 0.07 * w, 0.6);
    // side
    ctx.fillStyle = '#ECE9E4'; ctx.fillRect(x - w / 2, y1, w, side);
    ctx.fillStyle = '#2F79C9'; ctx.fillRect(x + w * 0.28, y1, w * 0.22, side);
    const bc = BOX_COLS;
    for (let i = 0; i < 7; i++) { ctx.fillStyle = bc[i]; ctx.fillRect(x - w * 0.45 + i * w * 0.095, y1 + side * 0.32, w * 0.075, side * 0.36); }
    ctx.strokeStyle = 'rgba(30,37,65,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y1, w, side);
    // lid rim: the lid is a touch bigger than the box, its edge shows as a band
    const rimH = 0.035 * w;
    ctx.fillStyle = '#F4F2EE'; ctx.fillRect(x - w / 2 - 0.01 * w, y1 - rimH * 0.2, w + 0.02 * w, rimH);
    ctx.fillStyle = 'rgba(30,37,65,0.18)'; ctx.fillRect(x - w / 2 - 0.01 * w, y1 + rimH * 0.8, w + 0.02 * w, Math.max(1, 0.006 * w));
    // lid
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(x - w / 2, y1); ctx.lineTo(x + w / 2, y1); ctx.lineTo(x + w / 2 + sk, y0); ctx.lineTo(x - w / 2 + sk, y0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // made-up colourful panel: sky band with tiny tiles along the back of the lid
    ctx.save();
    ctx.transform(1, 0, -sk / depth, 1, sk * (y1 / depth), 0);
    ctx.fillStyle = '#7CC6EE'; ctx.fillRect(x - w * 0.46, y0 + depth * 0.06, w * 0.92, depth * 0.24);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = bc[i];
      const tx = x - w * 0.4 + i * w * 0.13, ty = y0 + depth * 0.18;
      if (i % 2) { ctx.beginPath(); ctx.moveTo(tx, ty - depth * 0.08); ctx.lineTo(tx + w * 0.045, ty + depth * 0.07); ctx.lineTo(tx - w * 0.045, ty + depth * 0.07); ctx.fill(); }
      else ctx.fillRect(tx - w * 0.04, ty - depth * 0.075, w * 0.08, depth * 0.15);
    }
    // text lines (best scores)
    const n = lines && lines.length ? Math.min(lines.length, 4) : 0;
    if (n) {
      const area = depth * 0.62, top = y0 + depth * 0.34;
      const fs = Math.min(w * 0.1, (area / n) * 0.78);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1E2541';
      for (let i = 0; i < n; i++) {
        const big = i === 0 ? 1.15 : 0.9;
        let f = fs * big;
        ctx.font = (i === 0 ? '700 ' : '600 ') + Math.round(f) + 'px ' + FONT_STACK;
        const str = String(lines[i]);
        const mw = ctx.measureText(str).width;
        if (mw > w * 0.86) { f *= (w * 0.86) / mw; ctx.font = (i === 0 ? '700 ' : '600 ') + Math.round(f) + 'px ' + FONT_STACK; }
        ctx.fillText(str, x, top + (i + 0.5) * (area / n));
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 2, y1 - 1); ctx.lineTo(x - w / 2 + sk + 2, y0 + 1); ctx.stroke();
  }

  return {
    TILE_COLORS, PAL,
    resize, drawRoom, drawRug, drawLight, drawTile, drawCubeNet, drawCar, drawHand, drawArm,
    drawRing, drawGear, drawRibbon, drawGoalIcon, drawFoot, drawShadowBlob,
    drawTitle, titleLetterBoxes, titleBuild, drawTileBox,
  };
})();
