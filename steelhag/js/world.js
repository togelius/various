'use strict';
// A chapter turned into something you can stand on and something you can look at.

const LAYER_DEFS = [
  { key: 'sky', f: 0.03, blur: 0 },
  { key: 'far', f: 0.13, blur: 1.4 },
  { key: 'mid', f: 0.32, blur: 0.8 },
  { key: 'near', f: 0.6, blur: 0.35 },
  { key: 'play', f: 1, blur: 0 },
];

class World {
  constructor(L) {
    this.L = L;
    this.W = L.width;
    this.top = L.top || 200;
    this.noise = makeNoise(L.seed * 7 + 3);
    this.solids = [];
    this.movers = [];
    this.lamps = (L.lamps || []).slice();
    this.buildObjects();
  }

  // --- ground ---------------------------------------------------------
  baseAt(x) {
    const g = this.L.ground;
    if (x <= g[0][0]) return g[0][1];
    for (let i = 1; i < g.length; i++) {
      if (x <= g[i][0]) {
        const t = (x - g[i - 1][0]) / (g[i][0] - g[i - 1][0]);
        const s = t * t * (3 - 2 * t);
        return lerp(g[i - 1][1], g[i][1], lerp(t, s, 0.7));
      }
    }
    return g[g.length - 1][1];
  }
  inGap(x) {
    for (const gp of this.L.gaps || []) if (x > gp.x0 && x < gp.x1) return gp;
    return null;
  }
  groundAt(x) {
    if (this.inGap(x)) return null;
    return this.baseAt(x) + (fbm(this.noise, x / 90, 3) - 0.5) * (this.L.bumps ?? 8);
  }
  // Surface drawn up to gap edges falls off steeply so banks read as banks.
  drawGroundAt(x) {
    const b = this.baseAt(x) + (fbm(this.noise, x / 90, 3) - 0.5) * (this.L.bumps ?? 8);
    return b;
  }
  // The highest thing to stand on at x (for the little machine and cameras).
  surfaceAt(x, below = -1e9) {
    let best = null;
    for (const s of this.solids) if (x >= s.x && x <= s.x + s.w && s.y >= below && (best === null || s.y < best)) best = s.y;
    const g = this.groundAt(x);
    if (g !== null && (best === null || g < best)) best = g;
    return best;
  }

  // --- objects -> solids ---------------------------------------------
  place(o, h) {
    if (o.y !== undefined) return o.y;
    const w = o.w || 0;
    const g = Math.max(this.groundAt(o.x + 4) ?? 0, this.groundAt(o.x + w / 2) ?? 0, this.groundAt(o.x + w - 4) ?? 0);
    return g - h + (o.sink ?? 5) - (o.lift || 0);
  }
  buildObjects() {
    for (const o of this.L.objects || []) {
      const add = (x, y, w, h, extra = {}) => { const s = { x, y, w, h, o, ...extra }; this.solids.push(s); return s; };
      switch (o.t) {
        case 'car': {
          const s = o.w / 150, y = this.place({ ...o, sink: 4 }, 0);
          o._y = y;
          add(o.x + 2, y - 33 * s, o.w - 4, 31 * s, { hidden: true });
          add(o.x + 42 * s, y - 52 * s, 88 * s, 20 * s, { hidden: true });
          break;
        }
        case 'plank': {
          const y = o.y ?? this.place(o, 0) - (o.lift || 0);
          add(o.x, y, o.w, o.h || 10, { oneway: true });
          break;
        }
        default: {
          const h = o.h, y = this.place(o, h);
          o._y = y;
          add(o.x, y, o.w, h, { oneway: !!o.oneway });
        }
      }
    }
    for (const m of this.L.movers || []) {
      this.movers.push({ ...m, bx: m.x, by: m.y, x: m.x, y: m.y, vx: 0, vy: 0, moving: true, oneway: m.oneway ?? false });
    }
  }

  updateMovers(t) {
    for (const m of this.movers) {
      const ph = (t / m.period + (m.phase || 0)) * TAU;
      let k;
      if (m.kind === 'bob') k = Math.sin(ph);
      else k = -Math.cos(ph) * 0.5 + 0.5;         // lifts: 0..1 with eased ends
      const nx = m.bx + (m.dx || 0) * k, ny = m.by + (m.dy || 0) * k;
      m.vx = nx - m.x; m.vy = ny - m.y; m.x = nx; m.y = ny;
    }
  }

  // --- painting --------------------------------------------------------
  buildLayers(Q) {
    const L = this.L, layers = [];
    for (const d of LAYER_DEFS) {
      const lw = VIEW_W + (this.W - VIEW_W) * d.f;
      const lh = VIEW_H + this.top;
      const c = makeCanvas(lw * Q, lh * Q), ctx = c.getContext('2d');
      ctx.scale(Q, Q); ctx.translate(0, this.top);
      const r = rng32(L.seed * 101 + d.key.length * 13 + d.f * 1000);
      if (d.key === 'sky') Art.sky(ctx, lw, this.top, L.pal, r);
      else if (d.key === 'play') this.paintPlay(ctx, r);
      if (L.paint[d.key]) L.paint[d.key](ctx, lw, r, this);
      if (d.key !== 'sky' && d.key !== 'play') this.hazeLayer(ctx, lw, d);
      if (d.blur) Art.blur(c, d.blur * Q);
      layers.push({ ...d, canvas: c, w: lw, h: lh });
    }
    return layers;
  }

  // A final wash of haze at the foot of distant layers: atmosphere pooling low.
  hazeLayer(ctx, lw, d) {
    const p = this.L.pal, a = (p.lowHaze ?? 0.25) * (1 - d.f);
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, p.horizon - 60, 0, VIEW_H);
    g.addColorStop(0, css(p.haze, 0)); g.addColorStop(0.35, css(p.haze, a)); g.addColorStop(1, css(p.haze, a * 0.6));
    ctx.fillStyle = g; ctx.fillRect(0, p.horizon - 60, lw, VIEW_H);
    ctx.restore();
  }

  paintPlay(ctx, r) {
    const L = this.L, p = L.pal, G = p.ground;
    if (L.paint.playBack) L.paint.playBack(ctx, this.W, r, this);
    // water first, so banks overlap it
    if (G.island) this.paintWater(ctx, 0, this.W, L.waterLevel, r);
    else for (const gp of L.gaps || []) {
      if (gp.water === undefined) continue;
      this.paintWater(ctx, gp.x0 - 30, gp.x1 + 30, gp.water, r);
    }
    // dry pits read as deep, shadowed cuts
    for (const gp of L.gaps || []) {
      if (gp.water !== undefined || gp.void) continue;
      const top = Math.min(this.drawGroundAt(gp.x0), this.drawGroundAt(gp.x1)) - 10;
      const g = ctx.createLinearGradient(0, top, 0, VIEW_H);
      g.addColorStop(0, css(G.lo)); g.addColorStop(0.5, css(shade(G.lo, -0.5))); g.addColorStop(1, css(shade(G.lo, -0.8)));
      ctx.fillStyle = g; ctx.fillRect(gp.x0 - 20, top, gp.x1 - gp.x0 + 40, VIEW_H - top + 20);
    }
    // ground segments between gaps
    const edges = [0];
    for (const gp of (L.gaps || []).slice().sort((a, b) => a.x0 - b.x0)) edges.push(gp.x0, gp.x1);
    edges.push(this.W);
    const bottom = VIEW_H + 20;
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], b = edges[i + 1];
      const drop = (x) => {
        // banks curl down in the last few pixels before a gap
        const da = x - a, db = b - x;
        let y = this.drawGroundAt(x);
        if (i > 0 && da < 16) y += (16 - da) * (16 - da) * 0.5;
        if (i + 1 < edges.length - 1 && db < 16) y += (16 - db) * (16 - db) * 0.5;
        return y;
      };
      // islands in a marsh are lumps with water in front; elsewhere the ground runs to the viewer
      const n2 = this.noise;
      const under = G.island
        ? x => drop(x) + G.island * (0.55 + fbm(n2, x / 70 + 50, 2) * 0.9) * smooth(a - 1, a + 60, x) * smooth(b + 1, b - 60, x) + 4
        : () => bottom;
      ctx.beginPath(); ctx.moveTo(a, under(a));
      for (let x = a; x <= b; x += 3) ctx.lineTo(x, drop(x));
      ctx.lineTo(b, drop(b));
      for (let x = b; x >= a; x -= 4) ctx.lineTo(x, under(x));
      ctx.closePath();
      if (G.island) {
        // dark reflection of the island below it
        ctx.save(); ctx.fillStyle = css(G.lo, 0.35);
        ctx.beginPath(); for (let x = a; x <= b; x += 4) ctx.lineTo(x, under(x) - 2);
        for (let x = b; x >= a; x -= 4) ctx.lineTo(x, under(x) + (under(x) - drop(x)) * 0.8);
        ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(a, under(a));
        for (let x = a; x <= b; x += 3) ctx.lineTo(x, drop(x));
        ctx.lineTo(b, drop(b));
        for (let x = b; x >= a; x -= 4) ctx.lineTo(x, under(x));
        ctx.closePath();
      }
      const gg = ctx.createLinearGradient(0, 560, 0, VIEW_H);
      gg.addColorStop(0, css(G.fieldTop)); gg.addColorStop(1, css(G.fieldBottom));
      ctx.fillStyle = gg; ctx.fill();
      ctx.save(); ctx.clip();
      this.paintField(ctx, a, b, drop, bottom, r);
      // surface band
      const band = G.band || 14;
      for (let x = a; x <= b; x += 2) {
        const y = drop(x), slope = (drop(x + 4) - drop(x - 4)) / 8;
        const lit = clamp(0.55 - slope * (p.light || 1) * 2.5 + (r() - 0.5) * 0.3, 0, 1);
        const c = mix(G.surfShadow, G.surfLight, lit);
        Art.stroke(ctx, x, y + band * 0.5 * r(), 3 + r() * 8, band * (0.4 + r() * 0.6), (r() - 0.5) * 0.3, jit(c, r, 10), 0.55);
        if (r() < 0.5) Art.stroke(ctx, x, y + 1, 4 + r() * 6, 2 + r() * 3, (r() - 0.5) * 0.2, G.surfTop || G.surfLight, 0.5);
      }
      // underside of the surface band
      for (let x = a; x <= b; x += 3) {
        const y = drop(x) + band * (0.9 + r() * 0.5);
        Art.stroke(ctx, x, y, 4 + r() * 8, 3 + r() * 5, 0, G.bandLow || G.surfShadow, 0.35);
      }
      ctx.restore();
      // tufts sticking up
      if (G.tuft) {
        const n = (b - a) * (G.tuftDensity ?? 0.05);
        for (let k = 0; k < n; k++) {
          const x = a + 10 + r() * (b - a - 20);
          Art.grass(ctx, x, drop(x) + 2, (G.tuftH || 14) * (0.5 + r()), r() < 0.5 ? G.tuft : (G.tuft2 || G.tuft), r, 5 + (r() * 8 | 0), 0.8);
        }
      }
      if (G.sparkle) for (let k = 0; k < (b - a) * 0.15; k++) {
        const x = a + r() * (b - a);
        Art.dab(ctx, x, drop(x) + r() * 6, 0.8, 0.8, 0, '#ffffff', 0.9);
      }
    }
    if (L.paint.playFront) L.paint.playFront(ctx, this.W, r, this);
    if (L.paint.playMid) L.paint.playMid(ctx, this.W, r, this);
    for (const o of L.objects || []) this.paintObject(ctx, o, r);
  }

  // The ground in front of the path, seen receding: detail grows toward the viewer.
  paintField(ctx, a, b, drop, bottom, r) {
    const p = this.L.pal, G = p.ground, kind = G.kind, n = makeNoise(this.L.seed + 5);
    const depth = (x, y) => clamp((y - drop(x)) / (bottom - drop(x)), 0, 1);
    const area = (b - a) * 130;
    const count = area / 55;
    for (let k = 0; k < count; k++) {
      const x = a + r() * (b - a), top = drop(x), y = top + Math.pow(r(), 0.9) * (bottom - top), d = depth(x, y);
      const wave = fbm(n, x / 260 + y / 40, 3);
      if (kind === 'grass') {
        const c = wave > 0.5 ? mix(G.tuft2, G.surfLight, (wave - 0.5) * 1.6) : mix(G.fieldBottom, G.tuft2, wave * 1.6);
        Art.stroke(ctx, x, y, 3 + d * 22, 0.8 + d * 2.4, -Math.PI / 2 + (r() - 0.5) * 0.9, jit(c, r, 24), 0.35);
      } else {
        const c = wave > 0.52 ? mix(G.fieldTop, G.hi, (wave - 0.52) * 2.4) : mix(G.lo, G.fieldTop, clamp(wave * 2, 0, 1));
        Art.stroke(ctx, x, y, 6 + d * 70, 1 + d * 5, (r() - 0.5) * 0.08, jit(c, r, 8), 0.22);
      }
    }
    // drift rows: a highlight lip with a soft shadow under it
    if (kind === 'snow' || kind === 'asphalt') {
      for (let row = 1; row < 7; row++) {
        const t = Math.pow(row / 7, 1.4);
        const f = x => drop(x) + (bottom - drop(x)) * t + Math.sin(x / (120 + row * 40) + row * 2) * (3 + t * 12) + (fbm(n, x / 90 + row * 9) - 0.5) * 14 * t;
        for (let x = a; x < b; x += 3 + t * 5) {
          if (fbm(n, x / 400 + row * 3.1) < 0.42) continue;
          const y = f(x);
          Art.stroke(ctx, x, y + 2 + t * 5, 6 + t * 16, 3 + t * 12, 0, G.lo, 0.07 + t * 0.03);
          Art.stroke(ctx, x, y, 5 + t * 12, 1 + t * 2.5, 0, G.hi, 0.35);
        }
      }
    }
    if (kind === 'marsh') {
      for (let k = 0; k < (b - a) / 60; k++) {
        const x = a + r() * (b - a), top = drop(x), y = top + (0.15 + r() * 0.8) * (bottom - top), d = depth(x, y);
        const w = 20 + d * 120;
        Art.dab(ctx, x, y, w, 2 + d * 7, 0, G.puddle, 0.55);
        Art.stroke(ctx, x - w * 0.6, y - 1, w * 0.9, 1, 0, G.hi, 0.35);
      }
    }
    if (kind === 'asphalt') {
      // wet reflections of the lamps
      for (const [lx, ly] of this.lamps) {
        if (lx < a || lx > b) continue;
        for (let k = 0; k < 40; k++) Art.stroke(ctx, lx + gauss(r) * 10, drop(lx) + 8 + r() * 100, 6 + r() * 20, 2 + r() * 4, Math.PI / 2, p.lampCol, 0.08);
      }
      for (let x = a + 20; x < b; x += 90) Art.stroke(ctx, x, drop(x) + 60 + Math.sin(x) * 2, 40, 3, 0, '#c9a640', 0.35);
    }
    // tussocks, twigs, pebbles — larger toward the viewer
    const nt = (b - a) * (G.fieldTufts ?? 0.03);
    for (let k = 0; k < nt; k++) {
      const x = a + r() * (b - a), top = drop(x), y = top + Math.pow(r(), 0.8) * (bottom - top), d = depth(x, y);
      if (G.tuft && kind !== 'asphalt') Art.grass(ctx, x, y, (6 + d * 40) * (0.6 + r() * 0.8), r() < 0.5 ? G.tuft : (G.tuft2 || G.tuft), r, 4 + (d * 10 | 0), 0.7);
      if (r() < 0.15) Art.dab(ctx, x + 8, y, 2 + d * 8, 1 + d * 4, 0, G.lo, 0.6);
    }
    if (kind === 'snow') {
      // a line of animal tracks
      let x = a + 40 + r() * 200;
      while (x < b - 40) {
        const y = drop(x) + 18 + fbm(n, x / 300) * 20;
        for (let i = 0; i < 16 && x < b - 20; i++, x += 14 + r() * 4) Art.dab(ctx, x, y + (i % 2) * 4, 2.2, 1.1, 0, G.lo, 0.5);
        x += 600 + r() * 900;
      }
    }
  }

  paintWater(ctx, x0, x1, wy, r) {
    const p = this.L.pal, W = p.water;
    const g = ctx.createLinearGradient(0, wy, 0, VIEW_H);
    g.addColorStop(0, css(W.top)); g.addColorStop(1, css(W.deep));
    ctx.fillStyle = g; ctx.fillRect(x0, wy, x1 - x0, VIEW_H - wy + 20);
    for (let i = 0; i < (x1 - x0) * 0.6; i++) {
      const y = wy + Math.pow(r(), 2) * (VIEW_H - wy);
      Art.stroke(ctx, x0 + r() * (x1 - x0), y, 6 + r() * 40, 1 + r() * 2, 0, r() < 0.5 ? W.glint : W.dark, 0.25 * (1 - (y - wy) / 200));
    }
    Art.line(ctx, x0, wy, x1, wy, 1.5, W.glint, 0.6);
    if (W.ice) {
      for (let x = x0 + 10; x < x1 - 10; x += 14 + r() * 26) Art.stroke(ctx, x, wy + 1, 8 + r() * 22, 2 + r() * 2, 0, W.ice, 0.8);
    }
  }

  paintObject(ctx, o, r) {
    const p = this.L.pal, M = p.metal || {};
    const y = o._y, snow = p.snow && !o.noSnow ? p.snow : null, moss = !o.noMoss && p.moss ? p.moss : null;
    switch (o.t) {
      case 'bale': Art.bale(ctx, o.x, y, o.w, o.h, { c: o.c || p.bale, snow }, r); break;
      case 'car': Art.car(ctx, o.x, y, o.w, { c: o.c, glass: p.glass || '#4a5560', snow }, r); break;
      case 'metal': Art.metal(ctx, o.x, y, o.w, o.h, o.c || M.c, r, { rust: M.rust, stripes: o.stripes ? p.stripes : null, stripeY: o.stripeY, label: o.label, labelSize: o.labelSize, labelY: o.labelY, labelCol: M.label, snow, moss: o.moss ? moss : null, round: o.round, panel: o.panel, grime: M.grime }); break;
      case 'rock': Art.rock(ctx, o.x - 4, y, o.w + 8, o.h + 4, { c: o.c || p.rock, light: p.light, snow, moss, lichen: p.lichen }, r); break;
      case 'log': Art.log(ctx, o.x, y, o.w, o.h, { c: o.c || p.log, snow, moss, end: p.logEnd }, r); break;
      case 'plank': {
        const s = this.solids.find(s => s.o === o);
        const py = s.y;
        if (o.piles !== false) for (let px = o.x + 8; px < o.x + o.w; px += 44) Art.line(ctx, px, py + 4, px + (r() - 0.5) * 4, VIEW_H, 5, shade(p.plank, -0.45));
        Art.plank(ctx, o.x, py, o.w, o.h || 10, { c: o.c || p.plank }, r);
        break;
      }
      case 'concrete': Art.concrete(ctx, o.x, y, o.w, o.h, { c: o.c || p.concrete, snow }, r); break;
      case 'pipe': Art.pipe(ctx, o.x, y, o.w, o.h, { c: o.c || p.pipe, snow, rust: M.rust }, r); break;
      case 'hidden': break;
    }
    if (o.draw) o.draw(ctx, o, r, this);
  }
}

// Draws a mover (lifts, drifting plates, floating drums) — cached per mover.
function moverSprite(world, m, Q) {
  const pad = 12, c = makeCanvas((m.w + pad * 2) * Q, (m.h + pad * 2 + (m.tail || 0)) * Q), ctx = c.getContext('2d');
  ctx.scale(Q, Q); ctx.translate(pad, pad);
  const r = rng32((m.bx * 13) | 0), p = world.L.pal;
  const snow = p.snow || null;
  if (m.art === 'drum') {
    Art.metal(ctx, 0, 0, m.w, m.h, m.c || '#6f3b26', r, { panel: 18, rivets: false, round: 4, rust: '#b0602e' });
  } else if (m.art === 'lift') {
    Art.metal(ctx, 0, 0, m.w, m.h, m.c || p.metal.c, r, { stripes: p.stripes, stripeY: 0, stripeH: 8, panel: 30 });
    if (m.tail) { for (const dx of [8, m.w - 8]) Art.line(ctx, dx, m.h, dx, m.h + m.tail, 3, shade(p.metal.c, -0.4)); }
  } else if (m.art === 'debris') {
    Art.metal(ctx, 0, 0, m.w, m.h, m.c || p.metal.c, r, { panel: 40, snow, rust: p.metal.rust });
    for (let i = 0; i < 3; i++) Art.line(ctx, r() * m.w, m.h, r() * m.w, m.h + 6 + r() * 16, 2, shade(p.metal.c, -0.3), 0.8);
  } else if (m.art === 'rock') {
    Art.rock(ctx, -4, 0, m.w + 8, m.h + 6, { c: p.rock, light: p.light, snow }, r);
  } else {
    Art.plank(ctx, 0, 0, m.w, m.h, { c: p.plank || '#6b5a45' }, r);
  }
  return { canvas: c, pad };
}
