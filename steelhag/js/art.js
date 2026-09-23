'use strict';
// The paint box. Everything in the game is drawn from these procedures,
// once per chapter, into large offscreen canvases. Nothing is a bitmap.
// The look comes from three habits: many soft low-alpha dabs instead of flat
// fills, colours pulled toward the haze with distance, and one light source.

const Art = {};

Art.dab = (ctx, x, y, rx, ry, rot, c, a) => {
  ctx.fillStyle = css(c, a);
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rot, 0, TAU); ctx.fill();
};

Art.stroke = (ctx, x, y, len, w, ang, c, a) => {
  ctx.strokeStyle = css(c, a); ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
};

Art.line = (ctx, x1, y1, x2, y2, w, c, a = 1) => {
  ctx.strokeStyle = css(c, a); ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
};

Art.blur = (canvas, px) => {
  const t = makeCanvas(canvas.width, canvas.height), tc = t.getContext('2d');
  if (!('filter' in tc)) return;
  tc.filter = `blur(${px}px)`; tc.drawImage(canvas, 0, 0);
  const c = canvas.getContext('2d');
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(t, 0, 0); c.restore();
  t.width = 0;
};

// ------------------------------------------------------------------ sky
Art.sky = (ctx, W, top, pal, r) => {
  const g = ctx.createLinearGradient(0, -top, 0, VIEW_H);
  const span = VIEW_H + top;
  for (const [y, c] of pal.skyStops) g.addColorStop(clamp((y + top) / span, 0, 1), css(c));
  ctx.fillStyle = g; ctx.fillRect(0, -top, W, span);

  // long horizontal brush drags keep the gradient from looking digital
  for (let i = 0; i < W * 0.8; i++) {
    const y = -top + r() * span, x = r() * W;
    Art.stroke(ctx, x, y, 40 + r() * 160, 2 + r() * 7, (r() - 0.5) * 0.03, mono(stopsAt(pal.skyStops, y), r, 8), 0.12);
  }

  const sun = pal.sun;
  if (sun) {
    const sx = sun.x * W, sy = sun.y;
    let rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sun.glow);
    rg.addColorStop(0, css(sun.color, sun.glowA));
    rg.addColorStop(0.35, css(sun.color, sun.glowA * 0.35));
    rg.addColorStop(1, css(sun.color, 0));
    ctx.fillStyle = rg; ctx.fillRect(sx - sun.glow, sy - sun.glow, sun.glow * 2, sun.glow * 2);
    if (sun.disk) { Art.dab(ctx, sx, sy, sun.disk, sun.disk, 0, shade(sun.color, 0.6), sun.diskA ?? 0.95); }
  }

  for (const b of pal.clouds || []) {
    const light = hex(b.light), dark = hex(b.dark);
    // very faint dabs stall at different levels per 8-bit channel and tint the sky,
    // so trade count for opacity
    const ba = Math.max(b.a, 0.12), bn = b.n * b.a / ba;
    for (let i = 0; i < bn; i++) {
      const x = r() * W, y = b.y + gauss(r) * b.h;
      const t = clamp((y - (b.y - b.h)) / (2 * b.h), 0, 1);
      let c = mix(light, dark, Math.pow(t, b.curve || 1));
      if (sun) {
        const d = Math.hypot(x - sun.x * W, y - sun.y);
        c = mix(c, sun.rim || sun.color, clamp(1 - d / (b.sunReach || 420), 0, 1) * 0.7);
      }
      const rx = b.rx[0] + r() * (b.rx[1] - b.rx[0]);
      Art.dab(ctx, x, y, rx, rx * (b.flat || 0.16) * (0.6 + r() * 0.8), (r() - 0.5) * 0.05, mono(c, r, 8), ba);
    }
  }
};

// ------------------------------------------------------------------ land
// A silhouette from x0..x1 whose top is f(x); painted with texture strokes.
Art.ridge = (ctx, x0, x1, f, bottom, col, r, o = {}) => {
  col = hex(col);
  ctx.beginPath(); ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + 3; x += 3) ctx.lineTo(x, f(x));
  ctx.lineTo(x1, bottom); ctx.closePath();
  ctx.fillStyle = css(col); ctx.fill();
  if (o.tex) {
    ctx.save(); ctx.clip();
    const n = ((x1 - x0) * 40 / 1000 * o.tex) | 0;
    for (let i = 0; i < n * 25; i++) {
      const x = x0 + r() * (x1 - x0), top = f(x), y = top + Math.pow(r(), 1.5) * (bottom - top);
      const d = clamp((y - top) / 120, 0, 1);
      let c = o.topCol ? mix(o.topCol, col, d) : col;
      if (o.botCol) c = mix(c, o.botCol, clamp((y - top) / (o.botDepth || 300), 0, 1));
      Art.stroke(ctx, x, y, 6 + r() * 26, 1.5 + r() * 4, (r() - 0.5) * 0.3, jit(c, r, o.jit || 14), o.texA || 0.25);
    }
    ctx.restore();
  }
};

// Narrow Nordic spruce: a stack of drooping skirts.
Art.pine = (ctx, x, y, h, col, r, o = {}) => {
  const c = hex(col);
  ctx.fillStyle = css(c, o.a ?? 1);
  const tiers = Math.max(5, Math.min(26, (h / 5) | 0));
  const wide = (o.wide || 1) * (0.85 + r() * 0.3);
  ctx.beginPath();
  ctx.moveTo(x - 0.6, y - h * 1.03); ctx.lineTo(x + 0.6, y - h * 1.03); ctx.lineTo(x + 1.2, y - h * 0.8); ctx.lineTo(x - 1.2, y - h * 0.8); ctx.closePath();
  for (let j = 0; j < tiers; j++) {
    const t = j / tiers, yy = y - h + t * h * 0.9, dy = h / tiers * 1.9;
    const hw = (0.03 + Math.pow(t, 0.85) * 0.2) * h * wide * (0.75 + r() * 0.5);
    const sag = dy * (0.7 + r() * 0.5);
    ctx.moveTo(x, yy - 1);
    ctx.lineTo(x - hw, yy + sag); ctx.lineTo(x - hw * 0.4, yy + sag * 0.8);
    ctx.lineTo(x + hw * 0.4, yy + sag * 0.8); ctx.lineTo(x + hw * (0.8 + r() * 0.4), yy + sag * (0.9 + r() * 0.3));
    ctx.closePath();
  }
  ctx.fill();
  ctx.fillRect(x - Math.max(0.8, h * 0.012), y - h * 0.12, Math.max(1.6, h * 0.024), h * 0.12);
  if (o.light && h > 30) {
    // a lit edge on the sun side, and snow if it is winter
    const side = o.light;
    for (let j = 0; j < tiers; j++) {
      const t = j / tiers, yy = y - h + t * h * 0.9 + h / tiers * 1.2;
      const hw = (0.03 + Math.pow(t, 0.85) * 0.2) * h * wide * 0.8;
      Art.stroke(ctx, x, yy, hw * (0.6 + r() * 0.5), 1 + h * 0.008, side > 0 ? 0.35 : Math.PI - 0.35, o.lightCol, o.lightA ?? 0.35);
      if (o.snow && r() < 0.8) Art.stroke(ctx, x + (r() - 0.5) * hw, yy - 1, hw * 0.7, 1.4 + h * 0.01, side > 0 ? 0.25 : Math.PI - 0.25, o.snow, 0.8);
    }
  }
};

Art.branch = (ctx, x, y, len, ang, w, depth, col, r, a = 1) => {
  if (depth <= 0 || len < 1.5) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  Art.line(ctx, x, y, x2, y2, Math.max(0.5, w), col, a);
  const n = 2 + (r() < 0.35 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    Art.branch(ctx, x2, y2, len * (0.62 + r() * 0.22), ang + (r() - 0.5) * 1.15 - 0.05, w * 0.66, depth - 1, col, r, a);
  }
};

Art.bareTree = (ctx, x, y, h, col, r, a = 1) => {
  Art.line(ctx, x, y, x + (r() - 0.5) * h * 0.06, y - h * 0.35, h * 0.035, col, a);
  const bx = x, by = y - h * 0.3;
  for (let i = 0; i < 4; i++) Art.branch(ctx, bx, by, h * (0.28 + r() * 0.12), -Math.PI / 2 + (r() - 0.5) * 1.3, h * 0.022, 6, col, r, a);
};

// Birch: pale bark with black marks and a crown of small leaf dabs.
Art.birch = (ctx, x, y, h, pal, r, o = {}) => {
  const bark = hex(pal.bark), dark = hex(pal.barkDark), light = o.light || 1;
  const w = Math.max(1.2, h * (0.016 + r() * 0.008));
  const lean = (r() - 0.5) * 0.12, bend = (r() - 0.5) * h * 0.05;
  const px = t => x + lean * h * t + Math.sin(t * Math.PI) * bend;
  // trunk
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) { const t = i / 12; ctx.lineTo(px(t) - w * (1 - t * 0.7), y - t * h); }
  for (let i = 12; i >= 0; i--) { const t = i / 12; ctx.lineTo(px(t) + w * (1 - t * 0.7), y - t * h); }
  ctx.closePath(); ctx.fillStyle = css(o.fade ? mix(bark, o.fade, o.fadeT) : bark); ctx.fill();
  if (h > 40) {
    // shadow side, marks, dark foot
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      Art.line(ctx, px(t) - light * w * 0.5 * (1 - t * 0.7), y - t * h, px(t + 1 / 12) - light * w * 0.5 * (1 - t * 0.7), y - (t + 1 / 12) * h, w * 0.7 * (1 - t * 0.6), pal.barkShade, 0.55);
    }
    const marks = (h / 6) | 0;
    for (let i = 0; i < marks; i++) {
      const t = r() * 0.85, ww = w * (1 - t * 0.7);
      Art.line(ctx, px(t) - ww * r(), y - t * h, px(t) + ww * (0.2 + r() * 0.6), y - t * h + (r() - 0.5), 0.8 + r() * h * 0.006, dark, 0.8);
    }
    ctx.fillStyle = css(dark, 0.85);
    ctx.beginPath(); ctx.moveTo(px(0) - w * 1.1, y);
    for (let i = 0; i < 6; i++) ctx.lineTo(px(i * 0.02) - w, y - i * h * 0.02 - r() * h * 0.03);
    for (let i = 5; i >= 0; i--) ctx.lineTo(px(i * 0.02) + w, y - i * h * 0.02 - r() * h * 0.02);
    ctx.lineTo(px(0) + w * 1.1, y); ctx.fill();
  }
  // branches & leaves
  const crown = o.bare ? 0 : 1;
  const leafN = crown * Math.min(1400, h * 4.6 * (o.leafy || 1));
  const tips = [];
  for (let i = 0; i < 7 + h / 20; i++) {
    const t = 0.35 + r() * 0.62, side = r() < 0.5 ? -1 : 1;
    const sx = px(t), sy = y - t * h, len = h * (0.1 + r() * 0.18) * (1.1 - t * 0.5);
    const ex = sx + side * len, ey = sy - len * (0.1 + r() * 0.5);
    ctx.strokeStyle = css(pal.barkShade, 0.5); ctx.lineWidth = Math.max(0.5, w * 0.2); ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + side * len * 0.6, sy - len * 0.35, ex, ey + len * 0.1); ctx.stroke();
    tips.push([ex, ey, len]);
  }
  tips.push([px(0.98), y - h, h * 0.12]);
  if (!leafN) return;
  const L = hex(pal.leaf), LL = hex(pal.leafLight), LD = hex(pal.leafDark || shade(pal.leaf, -0.3));
  for (let i = 0; i < leafN; i++) {
    const tp = tips[(r() * tips.length) | 0];
    const lx = tp[0] + gauss(r) * tp[2] * 0.7, ly = tp[1] + gauss(r) * tp[2] * 0.55 + tp[2] * 0.2;
    const lit = clamp(0.5 + (lx - px(0.7)) / (h * 0.3) * light * 0.5 + (r() - 0.5) * 0.5 - (ly - (y - h)) / h * 0.3, 0, 1);
    const c = lit > 0.5 ? mix(L, LL, (lit - 0.5) * 2) : mix(LD, L, lit * 2);
    const s = Math.max(0.8, h * 0.014) * (0.6 + r() * 0.8);
    Art.dab(ctx, lx, ly, s, s * 0.8, 0, o.fade ? mix(c, o.fade, o.fadeT) : jit(c, r, 12), o.leafA ?? 0.8);
  }
};

// Lattice transmission tower. Returns the wire attachment points.
Art.pylon = (ctx, x, y, h, col, lw, a = 1) => {
  const c = hex(col), bw = h * 0.2, tw = h * 0.045, ty = y - h * 0.82;
  const L = t => [lerp(x - bw, x - tw, t), lerp(y, ty, t)], R = t => [lerp(x + bw, x + tw, t), lerp(y, ty, t)];
  ctx.strokeStyle = css(c, a); ctx.lineWidth = lw * 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...L(0)); ctx.lineTo(...L(1)); ctx.lineTo(x, y - h); ctx.lineTo(...R(1)); ctx.lineTo(...R(0)); ctx.stroke();
  ctx.lineWidth = lw * 0.7; ctx.beginPath();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t0 = Math.pow(i / n, 0.8), t1 = Math.pow((i + 1) / n, 0.8);
    ctx.moveTo(...L(t0)); ctx.lineTo(...R(t1)); ctx.moveTo(...R(t0)); ctx.lineTo(...L(t1));
    ctx.moveTo(...L(t1)); ctx.lineTo(...R(t1));
  }
  ctx.stroke();
  const arms = [[y - h * 0.82, h * 0.34], [y - h * 0.93, h * 0.22]];
  const pts = [];
  ctx.lineWidth = lw * 1.2; ctx.beginPath();
  for (const [ay, aw] of arms) {
    ctx.moveTo(x - aw, ay); ctx.lineTo(x + aw, ay);
    ctx.moveTo(x - aw, ay); ctx.lineTo(x - tw, ay + h * 0.05); ctx.moveTo(x + aw, ay); ctx.lineTo(x + tw, ay + h * 0.05);
    pts.push([x - aw, ay + h * 0.03], [x + aw, ay + h * 0.03]);
  }
  ctx.stroke();
  ctx.lineWidth = lw * 0.8; ctx.beginPath();
  for (const p of pts) { ctx.moveTo(p[0], p[1] - h * 0.03); ctx.lineTo(p[0], p[1]); }
  ctx.stroke();
  return pts;
};

Art.wire = (ctx, x1, y1, x2, y2, sag, col, lw, a = 1) => {
  ctx.strokeStyle = css(col, a); ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag * 2, x2, y2); ctx.stroke();
};

// Wooden utility pole with a crossbar.
Art.pole = (ctx, x, y, h, col, lw) => {
  Art.line(ctx, x, y, x, y - h, lw, col);
  Art.line(ctx, x - h * 0.12, y - h * 0.92, x + h * 0.12, y - h * 0.92, lw * 0.7, col);
  return [[x - h * 0.1, y - h * 0.93], [x + h * 0.1, y - h * 0.93]];
};

// Hyperboloid cooling tower with its plume of steam.
Art.coolingTower = (ctx, x, y, h, pal, r, o = {}) => {
  const rb = h * 0.37, rw = h * 0.22, rt = h * 0.26, tw = 0.74;
  const k = tw / Math.sqrt((rb / rw) ** 2 - 1);
  const hw = t => rw * Math.sqrt(1 + ((t - tw) / k) ** 2);
  const base = hex(o.col), side = o.light || 1;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const t = i / 40; ctx.lineTo(x - hw(t), y - t * h); }
  for (let i = 40; i >= 0; i--) { const t = i / 40; ctx.lineTo(x + hw(t), y - t * h); }
  ctx.closePath();
  const g = ctx.createLinearGradient(x - rb, 0, x + rb, 0);
  const lit = shade(base, o.lit ?? 0.18), drk = shade(base, -(o.dark ?? 0.25));
  g.addColorStop(0, css(side > 0 ? drk : lit)); g.addColorStop(0.5, css(base)); g.addColorStop(1, css(side > 0 ? lit : drk));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < h * 1.2; i++) {
    const xx = x + (r() - 0.5) * rb * 2, yy = y - r() * h;
    Art.stroke(ctx, xx, yy, 5 + r() * h * 0.2, 1 + r() * 2, Math.PI / 2, jit(shade(base, -0.2), r, 10), 0.12);
  }
  for (let i = 1; i < 4; i++) Art.line(ctx, x - rb, y - h * i * 0.07, x + rb, y - h * i * 0.07, 0.8, shade(base, -0.3), 0.2);
  ctx.restore();
  ctx.fillStyle = css(shade(base, -0.45));
  ctx.beginPath(); ctx.ellipse(x, y - h, hw(1), Math.max(1, hw(1) * 0.08), 0, 0, TAU); ctx.fill();
  if (o.steam) Art.plume(ctx, x, y - h, hw(1), h, o.steam, r);
};

Art.plume = (ctx, x, y, w, h, s, r) => {
  const a0 = Math.max(s.a || 0.07, 0.12), n = (s.n || 260) * (s.a || 0.07) / a0;
  for (let i = 0; i < n; i++) {
    const t = Math.pow(r(), 0.8);
    const px = x + t * h * s.drift + gauss(r) * w * (0.5 + t * 1.4);
    const py = y - t * h * (s.rise || 0.9) + gauss(r) * w * 0.3 - w * 0.2;
    const rad = w * (0.45 + t * 1.3) * (0.6 + r() * 0.6);
    const shadeT = clamp(0.35 + gauss(r) * 0.3 + (s.lightDir || 1) * (px - x) / (w * 6) * 0.3, 0, 1);
    Art.dab(ctx, px, py, rad, rad * 0.7, 0, mix(s.dark, s.light, shadeT), a0 * (1 - t * 0.7));
  }
};

// A big smooth sphere with seams, lit from one side.
Art.sphere = (ctx, x, y, R, o) => {
  const lx = x + R * 0.45 * o.light, ly = y - R * 0.4;
  const g = ctx.createRadialGradient(lx, ly, R * 0.05, x, y, R);
  g.addColorStop(0, css(o.hi)); g.addColorStop(0.45, css(o.col)); g.addColorStop(0.92, css(o.dark)); g.addColorStop(1, css(o.rim || o.dark));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  ctx.strokeStyle = css(o.seam, o.seamA ?? 0.3); ctx.lineWidth = Math.max(0.6, R * 0.006);
  for (let i = -3; i <= 3; i++) {
    const yy = y + i * R * 0.27;
    ctx.beginPath(); ctx.ellipse(x, yy, Math.sqrt(Math.max(0, R * R - (yy - y) ** 2)), R * 0.06, 0, 0, TAU); ctx.stroke();
  }
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(i) * R * 0.35, R, 0, 0, TAU); ctx.stroke(); }
  // reflection of the ground in the lower half
  const gr = ctx.createLinearGradient(0, y, 0, y + R);
  gr.addColorStop(0, css(o.ground || o.dark, 0)); gr.addColorStop(1, css(o.ground || o.dark, 0.45));
  ctx.fillStyle = gr; ctx.fillRect(x - R, y, R * 2, R);
  ctx.restore();
  if (o.rimLight) {
    ctx.strokeStyle = css(o.rimLight, 0.6); ctx.lineWidth = Math.max(1, R * 0.02);
    ctx.beginPath(); ctx.arc(x, y, R - R * 0.01, o.light > 0 ? -1.3 : Math.PI + 0.1, o.light > 0 ? 0.2 : Math.PI + 1.5); ctx.stroke();
  }
};

// A distant standing machine: a heavy hull carried on two jointed legs.
Art.walker = (ctx, x, y, h, col, r, o = {}) => {
  col = hex(col);
  const lw = h * 0.045, dark = shade(col, -0.18), side = o.light || 1;
  const hullW = h * 0.42, hullH = h * 0.2, hy = y - h * 0.8;
  const leg = (hx, dir, c) => {
    const kx = hx + dir * h * 0.11, ky = y - h * 0.42, fx = hx - dir * h * 0.02, fy = y;
    ctx.strokeStyle = css(c); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 1.3; ctx.beginPath(); ctx.moveTo(hx, hy + hullH * 0.7); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy - h * 0.04); ctx.stroke();
    // piston alongside the shin
    ctx.lineWidth = lw * 0.35; ctx.beginPath(); ctx.moveTo(kx - dir * lw, ky - h * 0.06); ctx.lineTo(fx + dir * lw * 1.2, fy - h * 0.12); ctx.stroke();
    Art.dab(ctx, kx, ky, lw * 0.95, lw * 0.95, 0, shade(c, -0.1), 1);
    Art.dab(ctx, hx, hy + hullH * 0.7, lw * 1.1, lw * 1.1, 0, c, 1);
    ctx.fillStyle = css(c);
    ctx.beginPath(); ctx.moveTo(fx - h * 0.06, fy); ctx.lineTo(fx - h * 0.04, fy - h * 0.045); ctx.lineTo(fx + h * 0.04, fy - h * 0.045); ctx.lineTo(fx + h * 0.065, fy); ctx.fill();
  };
  leg(x + hullW * 0.18, -1, dark);
  leg(x - hullW * 0.2, 1, col);
  // hull: a slab with a chamfered nose
  const L = x - hullW / 2, R = x + hullW / 2;
  ctx.fillStyle = css(col);
  ctx.beginPath();
  ctx.moveTo(L, hy + hullH * 0.15); ctx.lineTo(L + hullW * 0.08, hy); ctx.lineTo(R - hullW * 0.2, hy - hullH * 0.05);
  ctx.lineTo(R, hy + hullH * 0.35); ctx.lineTo(R - hullW * 0.06, hy + hullH * 0.8); ctx.lineTo(L + hullW * 0.1, hy + hullH);
  ctx.lineTo(L, hy + hullH * 0.8); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, hy, 0, hy + hullH);
  g.addColorStop(0, css(shade(col, 0.1), 0.6)); g.addColorStop(0.5, css(col, 0)); g.addColorStop(1, css(shade(col, -0.25), 0.8));
  ctx.fillStyle = g; ctx.fillRect(L, hy - hullH, hullW, hullH * 2.2);
  ctx.strokeStyle = css(shade(col, -0.25), 0.7); ctx.lineWidth = Math.max(0.6, h * 0.003);
  ctx.beginPath();
  for (let i = 1; i < 6; i++) { const px = L + hullW * i / 6; ctx.moveTo(px, hy - 5); ctx.lineTo(px + hullW * 0.02, hy + hullH); }
  ctx.moveTo(L, hy + hullH * 0.55); ctx.lineTo(R, hy + hullH * 0.55);
  ctx.stroke();
  if (o.stripes) { ctx.fillStyle = css(o.stripes, 0.6); ctx.fillRect(L, hy + hullH * 0.6, hullW, hullH * 0.08); }
  ctx.restore();
  // a turret/cab, antennae, lights
  ctx.fillStyle = css(shade(col, 0.03));
  ctx.beginPath(); ctx.roundRect(x - hullW * 0.1, hy - hullH * 0.45, hullW * 0.32, hullH * 0.48, h * 0.01); ctx.fill();
  ctx.fillStyle = css(shade(col, -0.35)); ctx.fillRect(x + hullW * 0.02, hy - hullH * 0.33, hullW * 0.16, hullH * 0.12);
  Art.line(ctx, x - hullW * 0.05, hy - hullH * 0.45, x - hullW * 0.08, hy - h * 0.2, Math.max(0.6, h * 0.004), col);
  Art.line(ctx, x + hullW * 0.15, hy - hullH * 0.45, x + hullW * 0.17, hy - h * 0.13, Math.max(0.6, h * 0.003), col);
  if (o.lit) {
    ctx.strokeStyle = css(o.lit, 0.5); ctx.lineWidth = Math.max(1, h * 0.005);
    ctx.beginPath();
    if (side < 0) { ctx.moveTo(L + 1, hy + hullH * 0.8); ctx.lineTo(L + 1, hy + hullH * 0.15); ctx.lineTo(L + hullW * 0.08, hy + 1); ctx.lineTo(R - hullW * 0.2, hy - hullH * 0.05 + 1); }
    else { ctx.moveTo(L + hullW * 0.08, hy + 1); ctx.lineTo(R - hullW * 0.2, hy - hullH * 0.05 + 1); ctx.lineTo(R - 1, hy + hullH * 0.35); ctx.lineTo(R - hullW * 0.06, hy + hullH * 0.8); }
    ctx.stroke();
  }
  // cables hanging from the belly
  for (let i = 0; i < 4; i++) {
    const cx = L + hullW * (0.2 + r() * 0.6);
    Art.wire(ctx, cx, hy + hullH * 0.9, cx + hullW * 0.1, hy + hullH * 0.95, h * 0.03, shade(col, -0.2), Math.max(0.5, h * 0.003));
  }
  if (o.lamp) { Art.dab(ctx, R - hullW * 0.04, hy + hullH * 0.4, h * 0.01, h * 0.01, 0, o.lamp, 1); }
};

// ---------------------------------------------------------------- props
// Weathered steel plate: panels, rivets, rust running down from the seams.
Art.metal = (ctx, x, y, w, h, base, r, o = {}) => {
  base = hex(base);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, css(shade(base, o.topLit ?? 0.12))); g.addColorStop(1, css(shade(base, -0.28)));
  ctx.fillStyle = g;
  const rr = o.round || 0;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, rr) : ctx.rect(x, y, w, h); ctx.fill();
  ctx.save(); ctx.clip();
  const rust = hex(o.rust || '#8a4a2a');
  for (let i = 0; i < w * h / 90; i++) {
    const xx = x + r() * w, yy = y + r() * h;
    Art.stroke(ctx, xx, yy, 3 + r() * 16, 1 + r() * 3, Math.PI / 2 + (r() - 0.5) * 0.1, jit(r() < 0.35 ? rust : shade(base, (r() - 0.5) * 0.3), r, 16), 0.16);
  }
  const pw = o.panel || 48;
  ctx.strokeStyle = css(shade(base, -0.45), 0.55); ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let px = x + pw; px < x + w - 6; px += pw) { ctx.moveTo(px, y); ctx.lineTo(px, y + h); }
  if (h > 50) for (let py = y + (o.panelH || 40); py < y + h - 6; py += (o.panelH || 40)) { ctx.moveTo(x, py); ctx.lineTo(x + w, py); }
  ctx.stroke();
  ctx.strokeStyle = css(shade(base, 0.25), 0.35); ctx.beginPath();
  for (let px = x + pw + 1.5; px < x + w - 6; px += pw) { ctx.moveTo(px, y); ctx.lineTo(px, y + h); }
  ctx.stroke();
  for (let px = x + pw; px < x + w - 6; px += pw) {
    for (let k = 0; k < 6; k++) {
      Art.stroke(ctx, px + (r() - 0.5) * 3, y + r() * h * 0.6, 8 + r() * 40, 1.5 + r() * 2.5, Math.PI / 2, rust, 0.22);
    }
  }
  if (o.stripes) {
    const sy = y + (o.stripeY ?? 6), sh = o.stripeH || 14;
    ctx.fillStyle = css(o.stripes[0]); ctx.fillRect(x, sy, w, sh);
    ctx.save(); ctx.beginPath(); ctx.rect(x, sy, w, sh); ctx.clip();
    ctx.fillStyle = css(o.stripes[1]);
    for (let sx = x - sh; sx < x + w + sh; sx += sh * 2) { ctx.beginPath(); ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sh, sy); ctx.lineTo(sx + sh * 2, sy); ctx.lineTo(sx + sh, sy + sh); ctx.fill(); }
    for (let i = 0; i < w / 3; i++) Art.stroke(ctx, x + r() * w, sy + r() * sh, 2 + r() * 6, 1 + r() * 2, 0, shade(base, -0.3), 0.25);
    ctx.restore();
  }
  if (o.label) {
    ctx.font = `bold ${o.labelSize || 16}px "Arial Narrow", Arial, sans-serif`;
    ctx.fillStyle = css(o.labelCol || '#e8e2d2', 0.7);
    ctx.fillText(o.label, x + (o.labelX ?? 10), y + (o.labelY ?? h * 0.6));
  }
  ctx.fillStyle = css(shade(base, -0.5), 0.5);
  if (o.rivets !== false) for (let px = x + 6; px < x + w - 3; px += 12) { ctx.fillRect(px, y + 4, 2, 2); ctx.fillRect(px, y + h - 6, 2, 2); }
  // grime at the foot
  const gg = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h);
  gg.addColorStop(0, css(o.grime || '#2a2420', 0)); gg.addColorStop(1, css(o.grime || '#2a2420', 0.45));
  ctx.fillStyle = gg; ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
  ctx.restore();
  // a thin highlight on the top edge
  Art.line(ctx, x + 2, y + 1, x + w - 2, y + 1, 1.5, shade(base, 0.4), 0.5);
  if (o.snow) Art.snowCap(ctx, x, y, w, o.snow, r);
  if (o.moss) Art.mossCap(ctx, x, y, w, o.moss, r);
};

Art.snowCap = (ctx, x, y, w, snow, r, depth = 7) => {
  const s = hex(snow.c || snow), sh = hex(snow.s || shade(s, -0.25));
  ctx.fillStyle = css(sh);
  ctx.beginPath(); ctx.moveTo(x - 2, y + 2);
  for (let xx = x - 2; xx <= x + w + 2; xx += 4) ctx.lineTo(xx, y - depth * (0.6 + 0.4 * Math.sin((xx - x) / w * Math.PI)) + (r() - 0.5) * 2);
  ctx.lineTo(x + w + 2, y + 2);
  for (let xx = x + w; xx >= x; xx -= 6) ctx.lineTo(xx, y + 2 + r() * 4 + (r() < 0.1 ? r() * 8 : 0));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = css(s);
  ctx.beginPath(); ctx.moveTo(x - 1, y);
  for (let xx = x - 1; xx <= x + w + 1; xx += 4) ctx.lineTo(xx, y - depth * (0.7 + 0.3 * Math.sin((xx - x) / w * Math.PI)) + (r() - 0.5) * 1.5 - 1);
  ctx.lineTo(x + w + 1, y); ctx.closePath(); ctx.fill();
};

Art.mossCap = (ctx, x, y, w, moss, r) => {
  for (let i = 0; i < w * 1.2; i++) {
    const xx = x + r() * w, yy = y - 1 + Math.abs(gauss(r)) * 8;
    Art.dab(ctx, xx, yy, 1.5 + r() * 3, 1 + r() * 2, 0, jit(r() < 0.5 ? moss[0] : moss[1], r, 20), 0.7);
  }
};

// Silage bale wrapped in plastic — the white marshmallows of the Swedish field.
Art.bale = (ctx, x, y, w, h, o, r) => {
  const c = hex(o.c || '#dfe3df');
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, css(shade(c, 0.1))); g.addColorStop(0.55, css(c)); g.addColorStop(1, css(shade(c, -0.35)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.3); ctx.fill();
  for (let i = 0; i < 12; i++) Art.stroke(ctx, x + 6 + r() * (w - 12), y + 4, h * (0.4 + r() * 0.5), 1, Math.PI / 2, shade(c, -0.2), 0.25);
  Art.stroke(ctx, x + w * 0.2, y + h * 0.25, w * 0.5, 3, 0, '#ffffff', 0.5);
  if (o.snow) Art.snowCap(ctx, x + 4, y + 2, w - 8, o.snow, r, 5);
};

// Boxy 240-style estate car.
Art.car = (ctx, x, y, w, o, r) => {
  const s = w / 150, c = hex(o.c);
  const P = (px, py) => [x + px * s, y - py * s];
  ctx.fillStyle = css(shade(c, -0.1));
  ctx.beginPath();
  for (const p of [[0, 12], [2, 30], [30, 33], [44, 52], [128, 52], [150, 34], [150, 12]]) ctx.lineTo(...P(...p));
  ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, y - 52 * s, 0, y);
  g.addColorStop(0, css(shade(c, 0.15))); g.addColorStop(1, css(shade(c, -0.35)));
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = css(o.glass);
  ctx.beginPath(); for (const p of [[48, 49], [80, 49], [80, 35], [36, 35]]) ctx.lineTo(...P(...p)); ctx.fill();
  ctx.beginPath(); for (const p of [[84, 49], [125, 49], [140, 35], [84, 35]]) ctx.lineTo(...P(...p)); ctx.fill();
  Art.line(ctx, ...P(38, 36), ...P(62, 48), 2 * s, '#ffffff', 0.25);
  Art.line(ctx, ...P(2, 22), ...P(150, 22), 1.2, shade(c, -0.4), 0.7);
  ctx.fillStyle = css('#d8d0b8'); ctx.fillRect(...P(0, 26), 4 * s, 6 * s);
  ctx.fillStyle = css('#a33a2a'); ctx.fillRect(...P(146, 30), 4 * s, 10 * s);
  for (const wx of [28, 122]) {
    Art.dab(ctx, ...P(wx, 10), 12 * s, 12 * s, 0, '#1b1c1e', 1);
    Art.dab(ctx, ...P(wx, 10), 5 * s, 5 * s, 0, '#8d8f8c', 1);
  }
  if (o.snow) { Art.snowCap(ctx, ...P(44, 52), 84 * s, o.snow, r, 6); Art.snowCap(ctx, ...P(2, 33), 28 * s, o.snow, r, 4); }
};

// Falu-red wooden house with white trim and a warm window.
Art.house = (ctx, x, y, w, h, o, r) => {
  const wall = hex(o.wall), roofH = h * 0.55;
  ctx.fillStyle = css(wall); ctx.fillRect(x, y - h, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - h, w, h); ctx.clip();
  for (let bx = x; bx < x + w; bx += 5) Art.line(ctx, bx, y - h, bx, y, 1, shade(wall, -0.3), 0.35);
  for (let i = 0; i < w * h / 60; i++) Art.stroke(ctx, x + r() * w, y - r() * h, 4 + r() * 12, 2, Math.PI / 2, jit(wall, r, 30), 0.2);
  ctx.restore();
  ctx.fillStyle = css(o.roof);
  ctx.beginPath(); ctx.moveTo(x - w * 0.06, y - h); ctx.lineTo(x + w / 2, y - h - roofH); ctx.lineTo(x + w * 1.06, y - h); ctx.fill();
  if (o.snow) {
    ctx.fillStyle = css(o.snow);
    ctx.beginPath(); ctx.moveTo(x - w * 0.07, y - h + 1); ctx.lineTo(x + w / 2, y - h - roofH - 2); ctx.lineTo(x + w * 1.07, y - h + 1);
    ctx.lineTo(x + w * 1.0, y - h + 4); ctx.lineTo(x + w / 2, y - h - roofH + 5); ctx.lineTo(x - w * 0.0, y - h + 4); ctx.fill();
  }
  Art.line(ctx, x + 1, y - h, x + 1, y, 2.5, o.trim); Art.line(ctx, x + w - 1, y - h, x + w - 1, y, 2.5, o.trim);
  const wn = Math.max(1, Math.round(w / 45));
  for (let i = 0; i < wn; i++) {
    const wx = x + (i + 0.5) * w / wn - 7, wy = y - h * 0.65;
    ctx.fillStyle = css(o.trim); ctx.fillRect(wx - 2, wy - 2, 18, 22);
    ctx.fillStyle = css(o.window || '#3a4450'); ctx.fillRect(wx, wy, 14, 18);
    Art.line(ctx, wx + 7, wy, wx + 7, wy + 18, 1.5, o.trim); Art.line(ctx, wx, wy + 9, wx + 14, wy + 9, 1.5, o.trim);
  }
  // chimney
  ctx.fillStyle = css(shade(o.roof, 0.1)); ctx.fillRect(x + w * 0.7, y - h - roofH * 0.75, w * 0.07, roofH * 0.45);
};

Art.rock = (ctx, x, y, w, h, o, r) => {
  const c = hex(o.c), n = 11, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + i / n * Math.PI;
    const rr = 0.85 + r() * 0.2;
    pts.push([x + w / 2 + Math.cos(a) * w / 2 * rr, y + h + Math.sin(a) * h * rr * (i === 0 || i === n ? 0 : 1)]);
  }
  ctx.beginPath(); pts.forEach(p => ctx.lineTo(...p)); ctx.closePath();
  const g = ctx.createLinearGradient(x + (o.light > 0 ? w : 0), y, x + (o.light > 0 ? 0 : w), y + h);
  g.addColorStop(0, css(shade(c, 0.25))); g.addColorStop(0.5, css(c)); g.addColorStop(1, css(shade(c, -0.4)));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < w * h / 30; i++) Art.dab(ctx, x + r() * w, y + r() * h, 1 + r() * 4, 1 + r() * 2.5, r() * 3, jit(shade(c, (r() - 0.5) * 0.35), r, 12), 0.35);
  if (o.lichen) for (let i = 0; i < w * h / 200; i++) Art.dab(ctx, x + r() * w, y + r() * h * 0.6, 1 + r() * 3, 1 + r() * 2, 0, o.lichen, 0.35);
  for (let i = 0; i < 3; i++) Art.line(ctx, x + r() * w, y + r() * h * 0.3, x + r() * w, y + h * (0.5 + r() * 0.5), 0.8, shade(c, -0.5), 0.4);
  ctx.restore();
  if (o.snow) Art.snowCap(ctx, x + w * 0.15, y + h * 0.1, w * 0.7, o.snow, r, 6);
  if (o.moss) Art.mossCap(ctx, x + w * 0.2, y + h * 0.08, w * 0.6, o.moss, r);
};

Art.log = (ctx, x, y, w, h, o, r) => {
  const c = hex(o.c);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, css(shade(c, 0.2))); g.addColorStop(0.5, css(c)); g.addColorStop(1, css(shade(c, -0.45)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  for (let i = 0; i < w / 4; i++) Art.stroke(ctx, x + r() * w, y + 2 + r() * (h - 4), 4 + r() * 12, 1, 0, jit(o.mark || shade(c, -0.5), r, 10), 0.6);
  Art.dab(ctx, x + w - h * 0.2, y + h / 2, h * 0.22, h * 0.45, 0, o.end || '#c7b58f', 1);
  if (o.moss) Art.mossCap(ctx, x + 6, y + 2, w - 12, o.moss, r);
  if (o.snow) Art.snowCap(ctx, x + 4, y + 2, w - 8, o.snow, r, 5);
};

Art.plank = (ctx, x, y, w, h, o, r) => {
  const c = hex(o.c);
  for (let px = x; px < x + w; px += 22) {
    const pw = Math.min(21, x + w - px);
    ctx.fillStyle = css(mono(c, r, 18)); ctx.fillRect(px, y, pw, h);
    Art.line(ctx, px, y + h, px + pw, y + h, 1.5, shade(c, -0.5), 0.6);
    Art.line(ctx, px, y + 1, px + pw, y + 1, 1, shade(c, 0.3), 0.5);
  }
};

Art.concrete = (ctx, x, y, w, h, o, r) => {
  const c = hex(o.c);
  ctx.fillStyle = css(c); ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i < w * h / 70; i++) Art.stroke(ctx, x + r() * w, y + r() * h, 2 + r() * 14, 1 + r() * 3, Math.PI / 2 + (r() - 0.5) * 0.3, jit(shade(c, (r() - 0.6) * 0.3), r, 10), 0.18);
  for (let i = 0; i < w / 30; i++) Art.stroke(ctx, x + r() * w, y, 10 + r() * h * 0.7, 2 + r() * 5, Math.PI / 2, shade(c, -0.35), 0.15);
  ctx.strokeStyle = css(shade(c, -0.4), 0.4); ctx.lineWidth = 1;
  ctx.beginPath(); for (let px = x + 80; px < x + w; px += 80) { ctx.moveTo(px, y); ctx.lineTo(px, y + h); } ctx.stroke();
  const gg = ctx.createLinearGradient(0, y, 0, y + h);
  gg.addColorStop(0, css('#000', 0)); gg.addColorStop(1, css('#000', 0.35));
  ctx.fillStyle = gg; ctx.fillRect(x, y, w, h);
  ctx.restore();
  Art.line(ctx, x, y + 1, x + w, y + 1, 1.5, shade(c, 0.3), 0.6);
  if (o.snow) Art.snowCap(ctx, x, y, w, o.snow, r, 5);
};

Art.pipe = (ctx, x, y, w, h, o, r) => {
  const c = hex(o.c);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, css(shade(c, -0.2))); g.addColorStop(0.3, css(shade(c, 0.3))); g.addColorStop(0.6, css(c)); g.addColorStop(1, css(shade(c, -0.5)));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  for (let px = x + 30; px < x + w; px += 90) { ctx.fillStyle = css(shade(c, -0.3)); ctx.fillRect(px, y - 2, 8, h + 4); }
  for (let i = 0; i < w / 8; i++) Art.stroke(ctx, x + r() * w, y + h * 0.5, 3 + r() * 8, 1 + r() * 2, Math.PI / 2, o.rust || '#7a4428', 0.2);
  if (o.snow) Art.snowCap(ctx, x, y, w, o.snow, r, 4);
};

Art.reeds = (ctx, x, y, h, col, r, n = 18, a = 1) => {
  for (let i = 0; i < n; i++) {
    const bx = x + gauss(r) * h * 0.25, hh = h * (0.5 + r() * 0.6), lean = (r() - 0.4) * h * 0.25;
    ctx.strokeStyle = css(jit(col, r, 20), a); ctx.lineWidth = 0.8 + r() * 1.2;
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + lean * 0.2, y - hh * 0.6, bx + lean, y - hh); ctx.stroke();
    if (r() < 0.3) Art.dab(ctx, bx + lean, y - hh - 3, 1.6, 5, lean / hh, shade(col, -0.35), a);
  }
};

Art.grass = (ctx, x, y, h, col, r, n = 10, a = 0.8) => {
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * h * 0.8, hh = h * (0.4 + r() * 0.7);
    Art.stroke(ctx, bx, y + 2, hh, 0.8 + r() * 1.3, -Math.PI / 2 + (r() - 0.5) * 0.7, jit(col, r, 26), a);
  }
};

Art.fence = (ctx, x0, x1, fy, col, r, o = {}) => {
  const gap = o.gap || 46;
  let prev = null;
  for (let x = x0; x < x1; x += gap * (0.85 + r() * 0.3)) {
    const y = fy(x), h = (o.h || 30) * (0.85 + r() * 0.3), lean = (r() - 0.5) * 3;
    Art.line(ctx, x, y + 2, x + lean, y - h, o.w || 3, col);
    if (o.snow) Art.dab(ctx, x + lean, y - h - 1, 2.5, 1.6, 0, o.snow, 1);
    if (prev) for (const k of [0.3, 0.65]) Art.wire(ctx, prev[0], prev[1] - prev[2] * k, x + lean * k, y - h * k, 2, o.wireCol || col, 0.8, 0.8);
    prev = [x, y, h];
  }
};

// Soft fog texture used live, scrolled between parallax layers.
Art.fogTexture = (w, h, seed) => {
  const c = makeCanvas(w, h), ctx = c.getContext('2d'), r = rng32(seed);
  for (let i = 0; i < 380; i++) {
    const x = r() * w, y = h * 0.5 + gauss(r) * h * 0.22, rx = 40 + r() * 180;
    for (const dx of [-w, 0, w]) Art.dab(ctx, x + dx, y, rx, rx * 0.22, 0, '#ffffff', 0.05);
  }
  return c;
};
