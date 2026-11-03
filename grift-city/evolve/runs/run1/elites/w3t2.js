// g15 quality 0.528 wheels 0.60 (mostly car), trouble 1.06 per min (scuffles) (3020 chars; mutate)
// car-first: take any free car while far from the goal, drive the route with look-ahead, get out near the marker.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const me = o.me, g = o.gps, gl = o.goal, R = o.rays, pulse = o.t % 1 < 0.15;
  const gd = gl ? gl.d : 999;
  if (m.noCar === undefined) { m.noCar = 0; m.sx = me.x; m.sz = me.z; m.st = 0; m.rec = 0; m.k = 0; }
  if (me.mode === 'entering') return a;
  // stall detection every 2 s
  if (o.t - m.st >= 2) {
    const mv = Math.hypot(me.x - m.sx, me.z - m.sz);
    m.k = mv < 1.2 && gd > 6 ? m.k + 1 : 0;
    if (m.k >= 2) { m.rec = o.t + 2; m.k = 0; }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  const flip = Math.floor(o.t / 2) % 2 ? 1 : -1;
  if (me.mode === 'car') {
    const stopHere = gl && gd < 12 && gl.kind !== 'car';
    if (stopHere) {
      a.brake = 1;
      if (Math.abs(o.car.spd) < 2.5) { a.use = pulse; m.noCar = o.t + 20; }
      return a;
    }
    if (o.t < m.rec) { a.brake = 1; a.steer = flip; return a; }
    if (!g) { a.gas = 0.4; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    let s = g.b * 1.5 + g.b2 * 0.2;
    if (R[3] < 9) s += (R[4] > R[2] ? 1 : -1) * 0.5 * (1 - R[3] / 9);
    if (R[1] < 2.5) s += 0.3;
    if (R[5] < 2.5) s -= 0.3;
    a.steer = c(s, -1, 1);
    const turn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.8, Math.abs(g.b3) * 0.5);
    let want = turn > 0.9 ? 5 : turn > 0.5 ? 8 : 17;
    if (g.wd < 15 && turn > 0.4) want = Math.min(want, 6);
    if (gd < 40) want = Math.min(want, 7);
    if (R[3] < 8) want = Math.min(want, 3 + R[3] * 0.4);
    let hot = false;
    for (const k of o.cars) if (k.f > 0 && k.f < 16 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') {
      want = Math.min(want, 2); if (k.f < 6) hot = true;
    }
    for (const k of o.peds) if (k.f > 0 && k.f < 12 && Math.abs(k.r) < 2.3) {
      want = Math.min(want, 3); if (k.f < 5) hot = true;
    }
    a.gas = o.car.spd < want && !hot ? 1 : 0;
    a.brake = hot ? 1 : o.car.spd > want + 3 ? 0.6 : 0;
    return a;
  }
  // on foot
  if (o.t < m.rec) { a.move = -0.8; a.strafe = flip; a.jump = pulse; return a; }
  const carGoal = !!gl && gl.kind === 'car';
  const want = (gd > 45 || carGoal) && (o.t > m.noCar || carGoal);
  const e = o.enter;
  if (want && e && e.free && e.d < 3.5) { a.use = pulse; return a; }
  let tb = g ? g.b : gl ? gl.b : 0.3, tcar = null;
  if (want) {
    for (const k of o.cars) if (k.free && (k.kind === 'parked') && k.d < 45 && (!tcar || k.d < tcar.d)) tcar = k;
    if (tcar && !carGoal) tb = tcar.b;
  }
  if (gl && gl.kind === 'person' && gd < 4) { a.talk = true; return a; }
  let t = tb * 2.2;
  if (R[3] < 3) t += (R[4] > R[2] ? 1 : -1) * 0.8;
  if (R[2] < 1.5) t += 0.5;
  if (R[4] < 1.5) t -= 0.5;
  a.turn = c(t, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : R[3] < 1.2 ? 0.3 : 1;
  a.sprint = Math.abs(tb) < 0.5 && R[3] > 3;
  return a;
}
