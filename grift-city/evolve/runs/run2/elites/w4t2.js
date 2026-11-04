// g93 quality 0.919 wheels 0.81 (car), trouble 0.99 per min (scuffles) (3507 chars; mutate)
// walker: follow the route on foot, sprinting when the way is clear; skip dialogue; never drive.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const goal = o.goal, g = o.gps, e = o.enter;
  const mv = m.px === undefined ? 1 : Math.hypot(o.me.x - m.px, o.me.z - m.pz);
  m.px = o.me.x; m.pz = o.me.z;
  const idle = (goal && goal.d < 3) || (e && e.d < 4);
  m.still = mv < 0.02 && !idle ? (m.still || 0) + 1 : 0;
  if (m.still > 15) { m.esc = 14; m.dir = Math.random() < 0.5 ? -1 : 1; m.still = 0; }
  if (m.esc > 0) {
    m.esc--;
    if (o.me.mode === 'car') { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }
  const b = g ? g.b : goal ? goal.b : 0;
  if (o.me.mode === 'car') {
    if (goal && goal.kind !== 'car' && goal.d < 12) {
      const st = Math.abs(o.car.spd) < 2.5;
      a.brake = st ? 0 : 1;
      if (st) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    // aim between the next two waypoints when close to a corner; side walls/cars push off; lane keeping; smoothed steering
    const tb = g && g.wd < 8 ? (b + (g.b2 || 0)) / 2 : b;
    let want = Math.min(bendSpeed(g), obstacleCap(o));
    if (want >= 16 && o.rays[3] > 18 && o.range[0] > 28) want = 20;
    const near = Math.min(o.range[0], o.range[1], o.range[11]);
    if (near < 6) want = Math.min(want, 3);
    const ca = copAvoid(o);
    if (ca.front < 12) want = Math.min(want, 8);
    const side = (o.range[1] < 10 ? -(10 - o.range[1]) * 0.1 : 0) + (o.range[11] < 10 ? (10 - o.range[11]) * 0.1 : 0);
    const lane = o.road.on ? c(-o.road.off * 0.1, -0.25, 0.25) : 0;
    let s = tb * 1.6 + side + lane * 0.5 + ca.push * 0.8;
    if (o.range[0] < 8) s += (o.range[1] > o.range[11] ? 0.5 : -0.5);
    m.st = (m.st || 0) * 0.5 + c(s, -1, 1) * 0.5;
    a.steer = m.st;
    a.gas = o.car.spd < want ? 1 : 0;
    a.brake = o.car.spd > want + 3 ? 0.6 : 0;
    return a;
  }
  if (goal && goal.kind === 'person' && goal.d < 3) { a.talk = true; return a; }
  if (e && e.d < 4 && e.free && (!goal || goal.kind === 'car' || goal.d > 25)) { a.use = pulse; return a; }
  if (e && e.goal && !e.free && e.d < 3 && o.me.wanted < 3) { a.use = pulse; return a; }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }
  // trouble: when armed and a hostile is close, face it and shoot it
  let fi = 0;
  for (let i = 1; i < 8; i++) if (o.pie.foe[i] < o.pie.foe[fi]) fi = i;
  const fd = o.pie.foe[fi], fb = (fi > 4 ? fi - 8 : fi) * 0.785;
  if (fd < 0) {
    a.turn = c(fb * 2.2, -1, 1);
    a.aim = true;
    a.fire = Math.abs(fb) < 0.3;
    return a;
  }
  let tb = (goal && goal.kind === 'car') ? goal.b : (goal && goal.d < 6 ? goal.b : b);
  const r = o.rays;
  if (r[3] < 4 || r[2] < 2 || r[4] < 2) {
    const side = (r[4] + r[5]) - (r[2] + r[1]);
    tb = c(tb * 0.3 + (side >= 0 ? 1 : -1) * 0.9, -1.5, 1.5);
  }
  a.turn = c(tb * 2.2, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : 1;
  const pd = o.pie.ped[0], pd1 = Math.min(o.pie.ped[1], o.pie.ped[7]);
  if (pd < 2.5) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  a.sprint = Math.abs(tb) < 0.5 && r[3] > 6 && pd > 5 && pd1 > 3 && o.range[0] > 6;
  return a;
}
