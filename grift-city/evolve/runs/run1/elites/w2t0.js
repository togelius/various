// g12 quality 0.454 wheels 0.31 (mixed), trouble 0.00 per min (law-abiding) (3360 chars; mutate)
// mixed: walk the route; take a free parked car only when the place marker is over 200 m away;
// drive until ~140 m out, then leave and walk in. Stall recovery; pedestrians slow us but rarely stop us.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const g = o.gps, R = o.rays, gl = o.goal, me = o.me, car = o.car;
  const pulse = o.t % 1 < 0.1, n = Math.floor(o.t);
  const gd = gl ? gl.d : 999, carGoal = !!gl && gl.kind === 'car';
  if (m.noCar === undefined) { m.noCar = 0; m.stuck = 0; m.rec = 0; }
  // stall check every 2 s; on a stall, back out for 2.5 s
  if (m.sx === undefined || o.t - m.st >= 2) {
    const mv = m.sx === undefined ? 9 : Math.hypot(me.x - m.sx, me.z - m.sz);
    m.stuck = mv < (me.mode === 'car' ? 1.5 : 1) && gd > 14 ? m.stuck + 1 : 0;
    if (m.stuck > 1) { m.rec = o.t + 2.5; m.stuck = 0; }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'entering') return a;
  if (o.t < m.rec) {
    if (me.mode === 'car') { a.brake = 1; a.steer = n % 2 ? 1 : -1; }
    else { a.move = -0.8; a.strafe = n % 2 ? 1 : -1; a.jump = pulse; }
    return a;
  }
  if (me.mode === 'car') {
    // leave the car ~140 m from a place marker, then walk the rest
    if (gl && !carGoal && gd < 140) {
      a.brake = 1;
      if (Math.abs(car.spd) < 2.5) { a.use = pulse; m.noCar = o.t + 60; }
      return a;
    }
    if (!g) { a.gas = 0.3; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    // steer at the waypoint, bend away from walls and kerbs
    let s = g.b * 1.6;
    if (R[3] < 8) s += (R[4] > R[2] ? 1 : -1) * 0.5 * (1 - R[3] / 8);
    if (R[1] < 3) s += 0.4;
    if (R[5] < 3) s -= 0.4;
    a.steer = c(s, -1, 1);
    const turn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.8, Math.abs(g.b3) * 0.5);
    let want = turn > 0.9 ? 5 : turn > 0.45 ? 9 : 16, hot = false;
    if (gd < 50) want = Math.min(want, 8);
    if (g.wd < 12 && turn > 0.4) want = Math.min(want, 6);
    if (R[3] < 7) want = Math.min(want, 4);
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') {
      want = Math.min(want, 2); if (k.f < 6) hot = true;
    }
    // pedestrians only slow us down, so some clips happen
    for (const k of o.peds) if (k.f > 0 && k.f < 6 && Math.abs(k.r) < 1.5) want = Math.min(want, 4);
    a.gas = car.spd < want && !hot ? 1 : 0;
    a.brake = hot ? 1 : car.spd > want + 3 ? 0.6 : 0;
    return a;
  }
  // on foot: take a free car only when the place marker is far (or the goal is a car)
  const e = o.enter, far = !gl || gd > 200 || carGoal;
  if (e && e.free && far && o.t > m.noCar && e.d < 3.5) { a.use = pulse; return a; }
  let tb = g ? g.b : gl ? gl.b : 0.3, tcar = null;
  if (far && o.t > m.noCar) {
    for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 25 && (!tcar || k.d < tcar.d)) tcar = k;
    if (tcar) tb = tcar.b;
  }
  let t = tb * 2.2;
  if (R[3] < 3) t += (R[4] > R[2] ? 1 : -1) * 0.8;
  if (R[2] < 1.5) t += 0.5;
  if (R[4] < 1.5) t -= 0.5;
  a.turn = c(t, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : R[3] < 1.2 ? 0.3 : 1;
  const bend = g && !tcar ? Math.max(Math.abs(g.b2), Math.abs(g.b3) * 0.6) : 0;
  a.sprint = Math.abs(tb) < 0.4 && bend < 0.7 && R[3] > 4;
  return a;
}
