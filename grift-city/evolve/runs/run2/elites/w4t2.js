// g156 quality 0.975 wheels 0.81 (car), trouble 1.00 per min (scuffles) (3047 chars; mutate)
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
    const tb = g ? Math.max(Math.abs(g.b), Math.abs(g.b2 || 0) * 0.8) : Math.abs(b);
    let want = Math.min(tb > 0.9 ? 5 : tb > 0.45 ? 9 : 15, obstacleCap(o));
    const pn = Math.min(o.pie.ped[0], o.pie.ped[1], o.pie.ped[7]);
    if (pn < 6) want = Math.min(want, 3);
    // sidestep vehicles ahead-left / ahead-right, and keep to the lane
    const sidestep = (o.pie.car[7] < 5 ? 0.4 : 0) - (o.pie.car[1] < 5 ? 0.4 : 0);
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.2, 0.2) : 0;
    let s = b * 1.6 + sidestep + lane;
    if (o.range[0] < 8) s += (o.range[1] > o.range[11] ? 0.5 : -0.5);
    a.steer = c(s, -1, 1);
    a.gas = o.car.spd < want ? 1 : 0;
    a.brake = o.car.spd > want + 3 ? 0.6 : 0;
    // car close ahead: lift off and brake hard
    if (o.pie.car[0] < 6 && o.car.spd > 2) { a.gas = 0; a.brake = 1; }
    return a;
  }
  if (goal && goal.kind === 'person' && goal.d < 3) { a.talk = true; return a; }
  if (e && e.d < 4 && (goal && (goal.kind === 'car' || (goal.d > 60 && e.free && o.me.wanted < 3)))) { a.use = pulse; return a; }

  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }
  // trouble: when armed and a hostile is close, face it and shoot it

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
