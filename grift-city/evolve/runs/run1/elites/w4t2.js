// g84 quality 0.660 wheels 0.92 (car), trouble 1.05 per min (scuffles) (3624 chars; mutate)
// car-first: grab a free car when far, drive gps route fast on straights, slow for bends/traffic, exit near on-foot goals, unstick.
function think(o, m) {
  const a = {}, c = (v) => Math.max(-1, Math.min(1, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const g = o.gps, gl = o.goal, R = o.rays, me = o.me, car = o.car;
  const gd = gl ? gl.d : 999, pulse = o.t % 1 < 0.1, n = Math.floor(o.t);
  if (m.st === undefined || o.t - m.st >= 2) {
    const mv = m.st === undefined ? 9 : Math.hypot(me.x - m.sx, me.z - m.sz);
    if (mv < 1.2 && gd > 8 && !(me.mode === 'car' && m.hold)) m.rec = o.t + 2;
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'entering') return a;
  const rec = o.t < (m.rec || 0);
  const tb = g ? g.b : gl ? gl.b : 0.3;
  const txt = o.mission.text || '';
  if (me.mode === 'car') {
    m.hold = false;
    const needOut = gl && (gl.kind === 'person' || (gl.kind === 'place' && (!o.mission.name || /talk|goon|inside|collect|on foot|get out/i.test(txt))));
    if (car.burning || car.hp < 0.2 || (needOut && gd < 14)) {
      a.brake = car.spd > 1.5 ? 1 : 0; a.use = car.spd < 2 && pulse; m.hold = true; return a;
    }
    if (!g) { a.gas = 0.4; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    if (rec) { a.brake = 1; a.steer = n % 2 ? 1 : -1; return a; }
    let s = tb * 1.6;
    if (R[3] < 10) s += (R[4] > R[2] ? 1 : -1) * 0.6 * (1 - R[3] / 10);
    if (R[1] < 3) s += 0.4;
    if (R[5] < 3) s -= 0.4;
    let want = 20, hot = false;
    const turn = g ? Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.9, Math.abs(g.b3) * 0.6) : 0;
    if (turn > 0.9) want = 5; else if (turn > 0.5) want = 9; else if (turn > 0.25) want = 14;
    if (g.wd < 12 && Math.abs(g.b) > 0.5) want = Math.min(want, 5);
    want = Math.min(want, 2 + R[3] * 1.1);
    if (needOut || (gl && gl.kind !== 'car' && gd < 40 && !o.mission.name)) want = Math.min(want, 2 + gd / 3);
    else if (gd < 25) want = Math.min(want, 4 + gd / 2);
    for (const k of o.cars) {
      if (k.f > 0 && k.f < 18 && Math.abs(k.r) < 2.6) {
        s += (k.r > 0 ? -1 : 1) * 0.35 * (1 - k.f / 18);
        if (k.kind !== 'parked' && k.kind !== 'cop') { want = Math.min(want, Math.max(2, k.spd * 0.9)); if (k.f < 7) hot = true; }
        else if (k.f < 6 && Math.abs(k.r) < 1.6) want = Math.min(want, 3);
      }
    }
    for (const k of o.peds) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.5) { want = Math.min(want, 3); if (k.f < 7) hot = true; }
    a.steer = c(s);
    a.gas = car.spd < want && !hot ? 1 : 0;
    a.brake = hot && car.spd > 1 ? 1 : car.spd > want + 3 ? 0.6 : 0;
    if (Math.abs(car.lat) > 4 && car.spd > 10) { a.gas = 0; }
    return a;
  }
  const e = o.enter, far = gd > 50;
  if (e && e.free && e.d < 3.2 && (far || e.goal)) { a.use = pulse; return a; }
  let b = tb;
  if (gl && gd < 150 && R[3] > 10 && R[2] > 6 && R[4] > 6) b = gl.b;
  if (far || (gl && gl.kind === 'car' && gl.free)) {
    let t = null;
    for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 35 && (!t || k.d < t.d)) t = k;
    if (t && (far || t.goal)) b = t.b;
    if (gl && gl.kind === 'car' && gl.free) b = gl.b;
  }
  if (gl && gl.kind === 'person' && gd < 3) {
    a.turn = c(gl.b * 2); a.talk = true; return a;
  }
  a.turn = c(b * 2.2 + (R[3] < 3 ? (R[4] > R[2] ? 0.8 : -0.8) : 0) + (R[2] < 1.5 ? 0.5 : 0) - (R[4] < 1.5 ? 0.5 : 0));
  a.move = Math.abs(b) > 1.2 ? 0.2 : R[3] < 1.2 ? 0.4 : 1;
  a.sprint = Math.abs(b) < 0.4 && R[3] > 6;
  if (rec) { a.move = -0.8; a.sprint = false; a.strafe = n % 2 ? 1 : -1; a.jump = pulse; }
  return a;
}
