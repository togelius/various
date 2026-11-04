// g40 quality 0.321 wheels 0.73 (mostly car), trouble 2.28 per min (troublemaker) (2522 chars; crossover)
// merged: drive when a car is close and the route is long, else walk; unstick in both modes; skip/choose dialogue.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  m.n = (m.n || 0) + 1;
  const g = o.gps, gl = o.goal, me = o.me, tick = o.t % 1 < 0.1;
  // stuck detection: every 2 s, if barely moved, start an unstick burst and alternate its side
  if (m.n % 20 === 1) {
    m.moved = m.px === undefined ? 9 : Math.hypot(me.x - m.px, me.z - m.pz);
    m.px = me.x; m.pz = me.z;
    if (m.moved < 1.5 && !(gl && gl.d < 3) && me.mode !== 'entering') {
      m.un = 14;
      m.side = -(m.side || 1);
    }
  }
  if (me.mode === 'entering') return a;
  const b = g ? g.b : gl ? gl.b : 0.3, b2 = g ? g.b2 : 0;
  if (me.mode === 'car') {
    // close to a place goal: stop, climb out
    if (gl && gl.d < 14 && gl.kind !== 'car') {
      a.brake = 1;
      if (Math.abs(o.car.spd) < 2.5) a.use = tick;
      return a;
    }
    if (m.un > 0) { m.un--; a.brake = 1; a.steer = m.side; return a; }
    const t = Math.max(Math.abs(b), Math.abs(b2) * 0.8);
    let want = t > 0.9 ? 5 : t > 0.45 ? 9 : 15;
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') want = Math.min(want, 2);
    for (const k of o.peds) if (k.f > 0 && k.f < 9 && Math.abs(k.r) < 2.2) want = Math.min(want, 2);
    if (o.rays[3] < 6) want = Math.min(want, 4);
    a.steer = c(b * 1.6, -1, 1);
    a.gas = o.car.spd < want ? 1 : 0;
    a.brake = o.car.spd > want + 3 ? 0.6 : 0;
    return a;
  }
  // on foot
  const far = !gl || gl.d > 60, e = o.enter;
  // climb into a free car when it is close and either the route is long or the car is the goal
  if (e && e.free && e.d < 3.5 && (far || e.goal)) { a.use = tick; return a; }
  if (m.un > 0) { m.un--; a.move = -1; a.strafe = m.side; a.jump = true; return a; }
  let tb = b;
  if (far) {
    // walk to the nearest free parked car within 25 m
    let car = null;
    for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 25 && (!car || k.d < car.d)) car = k;
    if (car) tb = car.b;
  }
  // steer away from the side with the nearer wall when something is close ahead
  const R = o.rays, side = R[4] + R[5] > R[1] + R[2] ? 1 : -1;
  a.turn = c(tb * 2.2 + (R[3] < 4 ? side * 0.8 : 0), -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : 1;
  a.sprint = Math.abs(tb) < 0.5 && R[3] > 8;
  return a;
}
