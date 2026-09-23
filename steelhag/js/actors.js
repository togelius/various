'use strict';
// The kid in the orange parka, and the little machine.

const KID = {
  jacket: '#c9542a', jacketDark: '#8a3620', jacketLight: '#f08a52',
  jeans: '#34425c', jeansDark: '#232d42', boots: '#2b2521',
  skin: '#e6bca0', hat: '#e3be45', hatDark: '#a9862a', pack: '#3d5c70', packDark: '#2a3f4d', mitten: '#2c3a4a',
};

// x,y = feet. face = 1 right, -1 left. pose: {run 0..1, phase, air, vy, idle t}
function drawKid(ctx, x, y, face, pose, light, amb) {
  const k = amb ? (c, t = amb.t) => mix(c, amb.c, t) : c => hex(c);
  ctx.save();
  ctx.translate(x, y); ctx.scale(face * 1.08, 1.08);
  const run = pose.run, ph = pose.phase;
  const bob = pose.air ? 0 : Math.abs(Math.sin(ph)) * -2.2 * run + Math.sin(pose.t * 2) * 0.4 * (1 - run);
  const lean = run * 0.12 + (pose.air ? clamp(pose.vy / 3000, -0.08, 0.1) : 0);
  const hipY = -17 + bob;

  const leg = (sw, col, front) => {
    let th, sh;
    if (pose.air) { th = front ? -0.7 : 0.35; sh = front ? 1.1 : 0.5; if (pose.vy > 200) { th *= 0.4; sh *= 0.5; } }
    else { th = Math.sin(ph + sw) * 0.85 * run; sh = Math.max(0, -Math.cos(ph + sw)) * 1.1 * run + 0.05; }
    const kx = Math.sin(th) * 8.5, ky = hipY + Math.cos(th) * 8.5;
    const fx = kx + Math.sin(th - sh) * 8.5, fy = ky + Math.cos(th - sh) * 8.5;
    ctx.strokeStyle = css(col); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 5.2;
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = css(k(KID.boots)); ctx.beginPath(); ctx.ellipse(fx + 1.8, fy + 0.2, 4.2, 2.6, 0, 0, TAU); ctx.fill();
  };
  const arm = (sw, col, front) => {
    let a = pose.air ? (front ? -2.2 : -1.2) : Math.sin(ph + sw) * 0.9 * run + 0.1;
    if (!pose.air && run < 0.1) a = 0.12 + Math.sin(pose.t * 2 + sw) * 0.03;
    const sx = 1, sy = hipY - 12;
    const ex = sx + Math.sin(a) * 6, ey = sy + Math.cos(a) * 6;
    const hx = ex + Math.sin(a - 0.5) * 6, hy = ey + Math.cos(a - 0.5) * 6;
    ctx.strokeStyle = css(col); ctx.lineWidth = 4.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = css(k(KID.mitten)); ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, TAU); ctx.fill();
  };

  ctx.rotate(lean);
  arm(0, k(KID.jacketDark), false);
  leg(Math.PI, k(KID.jeansDark), false);
  // backpack
  ctx.fillStyle = css(k(KID.pack)); ctx.beginPath(); ctx.roundRect(-11, hipY - 15, 7, 12, 2.5); ctx.fill();
  ctx.fillStyle = css(k(KID.packDark)); ctx.fillRect(-11, hipY - 7, 7, 2);
  // parka
  ctx.fillStyle = css(k(KID.jacket));
  ctx.beginPath();
  ctx.moveTo(-6, hipY - 15); ctx.quadraticCurveTo(-8, hipY - 6, -7, hipY + 3);
  ctx.lineTo(7, hipY + 3); ctx.quadraticCurveTo(8, hipY - 6, 6, hipY - 15);
  ctx.quadraticCurveTo(0, hipY - 18, -6, hipY - 15); ctx.fill();
  ctx.fillStyle = css(k(KID.jacketDark)); ctx.fillRect(-7, hipY + 1, 14, 2.2);
  Art.line(ctx, 1.5, hipY - 14, 1.5, hipY + 2, 0.8, k(KID.jacketDark), 0.8);
  // rim light from the sun's side
  const lit = (light || 1) * face > 0;
  ctx.strokeStyle = css(KID.jacketLight, amb && amb.night ? 0.25 : 0.6); ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (lit) { ctx.moveTo(6.2, hipY - 14); ctx.quadraticCurveTo(7.6, hipY - 6, 6.8, hipY + 2); }
  else { ctx.moveTo(-6.2, hipY - 14); ctx.quadraticCurveTo(-7.8, hipY - 6, -6.8, hipY + 2); }
  ctx.stroke();
  leg(0, k(KID.jeans), true);
  // head
  const hy = hipY - 22;
  ctx.fillStyle = css(k(KID.skin)); ctx.beginPath(); ctx.arc(1.5, hy, 5.2, 0, TAU); ctx.fill();
  ctx.fillStyle = css(k(KID.jacketDark)); ctx.beginPath(); ctx.ellipse(0.5, hy + 5, 6, 2.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = css(k(KID.hat)); ctx.beginPath(); ctx.arc(1, hy - 0.6, 5.7, Math.PI * 1.02, Math.PI * 2.08); ctx.closePath(); ctx.fill();
  ctx.fillStyle = css(k(KID.hatDark)); ctx.fillRect(-4.8, hy - 1.2, 11.5, 2);
  ctx.fillStyle = css(k(KID.hat)); ctx.beginPath(); ctx.arc(-3.2, hy - 6, 2.3, 0, TAU); ctx.fill();
  ctx.fillStyle = css('#2b2522'); ctx.fillRect(4.3, hy + 0.2, 1.1, 1.3);
  arm(Math.PI, k(KID.jacket), true);
  ctx.restore();
}

// The little machine: a beige 80s instrument case on four thin legs.
function drawBot(ctx, x, y, face, b, amb) {
  const k = amb ? c => mix(c, amb.c, amb.t) : c => hex(c);
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  const hop = b.hopping, t = b.t;
  const lift = hop ? -3 : Math.sin(t * 3) * 0.5;
  // legs
  ctx.strokeStyle = css(k('#3a3b3c')); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const [lx, ph] of [[-8, 0], [-4, Math.PI], [5, Math.PI / 2], [9, Math.PI * 1.5]]) {
    const sw = b.walk ? Math.sin(t * 14 + ph) * 2.5 : 0;
    const kneeY = -9 + lift, footY = hop ? -4 : 0;
    ctx.beginPath(); ctx.moveTo(lx, -11 + lift); ctx.lineTo(lx + 2 + sw * 0.4, kneeY + 3); ctx.lineTo(lx + sw, footY); ctx.stroke();
  }
  // body
  const by = -24 + lift;
  ctx.fillStyle = css(k('#d9d2c0')); ctx.beginPath(); ctx.roundRect(-12, by, 24, 14, 3); ctx.fill();
  ctx.fillStyle = css(k('#a69f8e')); ctx.fillRect(-12, by + 10, 24, 4);
  ctx.fillStyle = css(k('#d7782f')); ctx.fillRect(-12, by + 5, 24, 2.5);
  ctx.fillStyle = css(k('#57544c')); ctx.font = 'bold 5px Arial'; ctx.fillText('04', -9, by + 4.8);
  // sensor head
  ctx.fillStyle = css(k('#c8c1ae')); ctx.beginPath(); ctx.roundRect(6, by - 7, 10, 9, 2); ctx.fill();
  ctx.fillStyle = css('#1d2226'); ctx.fillRect(10, by - 5, 5, 4);
  const on = b.blink > 0.5;
  ctx.fillStyle = on ? '#ff5a3c' : '#6e2a22'; ctx.fillRect(11.2, by - 4, 2.6, 2.2);
  // antenna
  ctx.strokeStyle = css(k('#3a3b3c')); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, by); ctx.lineTo(-10, by - 12); ctx.stroke();
  ctx.fillStyle = on ? '#ff8a5c' : '#5b2a22'; ctx.beginPath(); ctx.arc(-10, by - 12.5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
  return on ? [x + face * 12.5, y + by - 3] : null;
}

// The machine goes from waypoint to waypoint, hopping, when you come close.
class Robot {
  constructor(world) {
    this.w = world;
    this.pts = world.L.robot.map(x => ({ x, y: world.surfaceAt(x) ?? 560 }));
    this.i = 0; this.x = this.pts[0].x; this.y = this.pts[0].y; this.face = 1;
    this.t = 0; this.blink = 0; this.hopping = false; this.walk = false; this.path = null; this.beepT = 3;
    this.done = false; this.onBeep = null;
  }
  get last() { return this.i >= this.pts.length - 1; }
  update(dt, player) {
    this.t += dt;
    this.blink = (Math.sin(this.t * (this.path ? 9 : 3)) > 0.2) ? 1 : 0;
    if (this.path) {
      const p = this.path; p.t += dt;
      const seg = p.segs[p.k], u = clamp(p.t / seg.d, 0, 1);
      this.x = lerp(seg.x0, seg.x1, u);
      this.y = lerp(seg.y0, seg.y1, u) - Math.sin(u * Math.PI) * seg.h;
      this.hopping = true; this.walk = false;
      if (u >= 1) {
        p.k++; p.t = 0;
        if (p.k >= p.segs.length) { this.path = null; this.hopping = false; this.x = seg.x1; this.y = seg.y1; }
      }
      return;
    }
    this.face = player.x > this.x ? 1 : -1;
    if (this.hold) return;
    const near = Math.abs(player.x - this.x) < 170 && Math.abs(player.y - this.y) < 200;
    if (near && !this.last && player.x > this.x - 80) this.go(this.i + 1);
    this.beepT -= dt;
    if (this.beepT < 0 && Math.abs(player.x - this.x) > 420) { this.beepT = 4 + Math.random() * 3; this.onBeep && this.onBeep(0.5); }
  }
  go(i) {
    const a = { x: this.x, y: this.y }, b = this.pts[i];
    this.i = i; this.face = b.x > a.x ? 1 : -1;
    const dist = Math.abs(b.x - a.x), segs = [];
    if (dist > 900) {
      segs.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, h: 220, d: dist / 360 });
    } else {
      const n = Math.max(1, Math.ceil(dist / 110));
      let px = a.x, py = a.y;
      for (let k = 1; k <= n; k++) {
        const x = lerp(a.x, b.x, k / n);
        let y = k === n ? b.y : (this.w.surfaceAt(x, Math.min(py, b.y) - 130) ?? lerp(a.y, b.y, k / n));
        if (k < n && Math.abs(y - lerp(a.y, b.y, k / n)) > 140) y = lerp(a.y, b.y, k / n);
        segs.push({ x0: px, y0: py, x1: x, y1: y, h: 16 + Math.max(0, py - y) * 1.1, d: 0.3 + Math.max(0, py - y) / 500 });
        px = x; py = y;
      }
    }
    this.path = { segs, k: 0, t: 0 };
    this.onBeep && this.onBeep(1);
  }
  draw(ctx, cx, cy, amb) {
    return drawBot(ctx, this.x - cx, this.y - cy, this.face, this, amb);
  }
}
