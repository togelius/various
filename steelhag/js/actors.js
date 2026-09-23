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
    if (pose.wet > 0.05) {
      // marsh water soaked up to the shins
      ctx.strokeStyle = css(mix(col, '#0e1216', 0.5 * pose.wet)); ctx.lineWidth = 5.3;
      ctx.beginPath(); ctx.moveTo(lerp(kx, fx, 0.35), lerp(ky, fy, 0.35)); ctx.lineTo(fx, fy); ctx.stroke();
    }
    ctx.fillStyle = css(k(KID.boots)); ctx.beginPath(); ctx.ellipse(fx + 1.8, fy + 0.2, 4.2, 2.6, 0, 0, TAU); ctx.fill();
    if (pose.wet > 0.3) Art.line(ctx, fx, fy - 1.2, fx + 3.5, fy - 1.2, 0.8, '#9aa4ab', 0.6 * pose.wet);
  };
  const arm = (sw, col, front) => {
    let a = pose.air ? (front ? -2.2 : -1.2) : Math.sin(ph + sw) * 0.9 * run + 0.1;
    if (!pose.air && run < 0.1) a = 0.12 + Math.sin(pose.t * 2 + sw) * 0.03;
    if (front && pose.reach) a = lerp(a, 1.5, pose.reach);
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
  if (pose.snow > 0.05) {
    // snow settles on the hat, the pompom, the top of the pack and the shoulders
    const sn = pose.snow, white = amb && amb.night ? '#c9cfd9' : '#f6f7f4';
    ctx.fillStyle = css(white, 0.4 + sn * 0.55);
    ctx.beginPath(); ctx.ellipse(1, hy - 5.2, 4.2 * (0.5 + sn * 0.5), 1 + sn * 1.2, 0, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-3.2, hy - 7.2, 1.2 + sn, Math.PI, TAU); ctx.fill();
    ctx.fillRect(-11, hipY - 15.5 - sn, 7, 1 + sn * 1.4);
    ctx.beginPath(); ctx.ellipse(-2, hipY - 15.3, 3 * sn, 0.9 + sn * 0.6, 0, Math.PI, TAU); ctx.fill();
  }
  if (pose.torch) { ctx.fillStyle = '#fff3cf'; ctx.fillRect(4.6, hy - 3.2, 2, 1.8); }
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
  // sensor head, turned toward whatever it is watching
  const look = b.look || 0;
  ctx.save(); ctx.translate(8, by - 1); ctx.rotate(look);
  ctx.fillStyle = css(k('#c8c1ae')); ctx.beginPath(); ctx.roundRect(-2, -6, 10, 9, 2); ctx.fill();
  ctx.fillStyle = css('#1d2226'); ctx.fillRect(2, -4, 5, 4);
  const on = b.blink > 0.5;
  ctx.fillStyle = on ? '#ff5a3c' : '#6e2a22'; ctx.fillRect(3.2, -3, 2.6, 2.2);
  ctx.restore();
  // antenna
  ctx.strokeStyle = css(k('#3a3b3c')); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, by); ctx.lineTo(-10, by - 12); ctx.stroke();
  ctx.fillStyle = on ? '#ff8a5c' : '#5b2a22'; ctx.beginPath(); ctx.arc(-10, by - 12.5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
  b.tip = [x + face * 15, y + by - 2];
  const ex = 8 + Math.cos(look) * 4.5 - Math.sin(look) * -2, ey = by - 1 + Math.sin(look) * 4.5 + Math.cos(look) * -2;
  return on ? [x + face * ex, y + ey] : null;
}

// The machine goes from waypoint to waypoint, hopping, when you come close.
// It watches you, and whatever else moves; it startles if you jump at it,
// and if you stand still long enough it comes back to see why.
class Robot {
  constructor(world) {
    this.w = world;
    this.pts = (world.L.robot || []).map(x => ({ x, y: world.surfaceAt(x) ?? 560 }));
    this.absent = !this.pts.length;
    if (this.absent) this.pts = [{ x: -999, y: 0 }];
    this.i = 0; this.x = this.pts[0].x; this.y = this.pts[0].y; this.face = 1;
    this.t = 0; this.blink = 0; this.hopping = false; this.walk = false; this.path = null; this.beepT = 3;
    this.look = 0; this.noticed = 0; this.visit = null; this.stillT = 0; this.visitCool = 0;
    this.onBeep = null;
  }
  get last() { return this.i >= this.pts.length - 1; }
  update(dt, player, interest) {
    if (this.absent) return;
    this.t += dt;
    this.blink = (Math.sin(this.t * (this.path ? 9 : 3)) > 0.2) ? 1 : 0;
    // where to look: something happening nearby, otherwise you
    const tgt = interest && Math.abs(interest.x - this.x) < 500 ? interest : { x: player.x, y: player.y - 30 };
    const dx = tgt.x - this.x, dy = tgt.y - (this.y - 25);
    const want = clamp(Math.atan2(dy, Math.max(24, Math.abs(dx))), -0.75, 0.45);
    this.look = lerp(this.look, this.path ? 0 : want, 1 - Math.pow(0.02, dt));
    if (this.path) { this.follow(dt); return; }
    this.face = dx > 0 ? 1 : -1;
    if (this.hold) return;
    this.visitCool = Math.max(0, this.visitCool - dt);

    const gap = Math.abs(player.x - this.x);
    const near = gap < 170 && Math.abs(player.y - this.y) < 200;
    // on a visit: go back to its post once you move on
    if (this.visit) {
      if (Math.abs(player.x - this.visit.px) > 70 || Math.abs(player.vx) > 60) { this.visit = null; this.goTo(this.pts[this.i], false, 0.9); }
      return;
    }
    if (near && !this.last && player.x > this.x - 80) {
      // jumped at: off it goes at once
      if (!player.onGround && gap < 110) { this.noticed = 0; this.go(this.i + 1, true); return; }
      // otherwise a moment to look at you first
      this.noticed += dt;
      if (this.noticed > 0.7) { this.noticed = 0; this.go(this.i + 1); }
      return;
    }
    this.noticed = 0;
    // you've stopped, some way back: it comes to check on you
    this.stillT = player.onGround && Math.abs(player.vx) < 5 ? this.stillT + dt : 0;
    if (this.stillT > 5 && !this.visitCool && gap > 200 && gap < 700 && this.clearTo(player.x)) {
      const side = player.x < this.x ? 1 : -1;
      const x = player.x + side * 70;
      this.visit = { px: player.x }; this.stillT = 0; this.visitCool = 20;
      this.goTo({ x, y: this.w.surfaceAt(x) ?? this.y }, false, 0.9);
      return;
    }
    this.beepT -= dt;
    if (this.beepT < 0 && gap > 420) { this.beepT = 4 + Math.random() * 3; this.onBeep && this.onBeep(0.5); }
  }
  // a walkable line of ground or low things between here and x
  clearTo(x) {
    const a = Math.min(x, this.x), b = Math.max(x, this.x);
    let prev = this.w.surfaceAt(a, this.y - 60);
    for (let xx = a; xx <= b; xx += 16) {
      const y = this.w.surfaceAt(xx, this.y - 60);
      if (y === null || prev === null || Math.abs(y - prev) > 70) return false;
      prev = y;
    }
    return true;
  }
  follow(dt) {
    const p = this.path; p.t += dt;
    const seg = p.segs[p.k], u = clamp(p.t / seg.d, 0, 1);
    this.x = lerp(seg.x0, seg.x1, u);
    this.y = lerp(seg.y0, seg.y1, u) - Math.sin(u * Math.PI) * seg.h;
    this.hopping = true; this.walk = false;
    if (u >= 1) {
      p.k++; p.t = 0;
      if (p.k >= p.segs.length) { this.path = null; this.hopping = false; this.x = seg.x1; this.y = seg.y1; }
    }
  }
  go(i, startled) {
    this.i = i;
    this.goTo(this.pts[i], startled);
    this.onBeep && this.onBeep(startled ? 1.4 : 1);
  }
  goTo(b, fast, speed = 1) {
    const a = { x: this.x, y: this.y };
    this.face = b.x > a.x ? 1 : -1;
    const dist = Math.abs(b.x - a.x), segs = [], k = (fast ? 0.6 : 1) / speed;
    if (dist > 900) {
      segs.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, h: 220, d: dist / 360 });
    } else {
      const n = Math.max(1, Math.ceil(dist / 110));
      let px = a.x, py = a.y;
      for (let j = 1; j <= n; j++) {
        const x = lerp(a.x, b.x, j / n);
        let y = j === n ? b.y : (this.w.surfaceAt(x, Math.min(py, b.y) - 130) ?? lerp(a.y, b.y, j / n));
        if (j < n && Math.abs(y - lerp(a.y, b.y, j / n)) > 140) y = lerp(a.y, b.y, j / n);
        segs.push({ x0: px, y0: py, x1: x, y1: y, h: (fast ? 26 : 16) + Math.max(0, py - y) * 1.1, d: (0.3 + Math.max(0, py - y) / 500) * k });
        px = x; py = y;
      }
    }
    this.path = { segs, k: 0, t: 0 };
  }
  draw(ctx, cx, cy, amb) {
    if (this.absent) return null;
    return drawBot(ctx, this.x - cx, this.y - cy, this.face, this, amb);
  }
}
