// g6 quality 0.620 wheels 0.96 (only car), trouble 0.39 per min (a slip) (2172 chars; crossover)
// hybrid: grab a close free car if the goal is far, drive the route, exit near the goal, walk in; unstick when blocked.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  m.n = (m.n || 0) + 1;
  const g = o.gps, gl = o.goal, me = o.me;
  // stuck detection: sample position every 20 ticks
  if (m.n % 20 === 1) {
    m.moved = m.px === undefined ? 9 : Math.hypot(me.x - m.px, me.z - m.pz);
    m.px = me.x; m.pz = me.z;
    if (m.moved < 1.5 && !(gl && gl.d < 3)) m.un = 14;
  }
  const tick = o.t % 1 < 0.1;
  if (me.mode === 'car') {
    if (gl && gl.d < 14 && gl.kind !== 'car') {
      a.brake = 1;
      if (Math.abs(o.car.spd) < 2.5) a.use = tick;
      return a;
    }
    if (m.un > 0) {
      m.un--; a.brake = 1; a.steer = (m.n >> 5) % 2 ? 1 : -1; return a;
    }
    const b = g ? g.b : gl ? gl.b : 0, b2 = g ? g.b2 : 0;
    a.steer = c(b * 1.6, -1, 1);
    const t = Math.max(Math.abs(b), Math.abs(b2) * 0.8);
    let want = t > 0.9 ? 5 : t > 0.45 ? 9 : 15;
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') want = Math.min(want, 2);
    for (const k of o.peds) if (k.f > 0 && k.f < 9 && Math.abs(k.r) < 2.2) want = Math.min(want, 2);
    if (o.rays[3] < 6) want = Math.min(want, 4);
    a.gas = o.car.spd < want ? 1 : 0;
    a.brake = o.car.spd > want + 3 ? 0.6 : 0;
    return a;
  }
  if (me.mode === 'entering') return a;
  // on foot
  const far = !gl || gl.d > 60;
  const e = o.enter;
  if (e && e.free && e.d < 3.5 && (far || e.goal)) { a.use = tick; return a; }
  if (m.un > 0) {
    m.un--; a.move = -1; a.strafe = (m.n >> 5) % 2 ? 1 : -1; a.jump = true; return a;
  }
  let tb = null;
  if (far && me.mode === 'foot') {
    let car = null;
    for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 25 && (!car || k.d < car.d)) car = k;
    if (car) tb = car.b;
  }
  if (tb === null) tb = g ? g.b : gl ? gl.b : 0.3;
  a.turn = c(tb * 2.2, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : 1;
  a.sprint = Math.abs(tb) < 0.5;
  return a;
}
