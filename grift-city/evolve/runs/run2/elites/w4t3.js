// g101 quality 0.612 wheels 0.76 (car), trouble 2.65 per min (troublemaker) (2850 chars; crossover)
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const goal = o.goal, g = o.gps, e = o.enter;
  const inCar = o.me.mode === 'car';
  const jobOn = !!o.mission.name;
  const near = !!goal && goal.kind === 'place' && goal.d < 8;

  // repulsion from cops, hostiles, pedestrians
  const sets = [[o.pie.cop, 2], [o.pie.foe, 1], [o.pie.ped, 0.5]];
  let rx = 0, rz = 0, cd = 99;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 8; i++) {
      const d = sets[k][0][i];
      if (d >= 25) continue;
      if (k === 0 && d < cd) cd = d;
      const th = sliceBearing(i);
      const w = sets[k][1] * (25 - d) / (25 * Math.max(d, 1));
      rx -= w * Math.sin(th); rz -= w * Math.cos(th);
    }
  }
  const tb = g ? g.b : goal ? goal.b : 0;
  let db = near && cd > 8 ? goal.b : Math.atan2(Math.sin(tb) + rx, Math.cos(tb) + rz);
  if (!inCar && o.rays[3] < 3 && !near) db = clamp(db + openSide(o) * 0.8, -1.5, 1.5);

  const talk = !inCar && cd > 12 && !!goal && goal.d < 3 &&
    (goal.kind === 'person' || (goal.kind === 'car' && goal.free === false));
  const idle = talk || (!inCar && !!e && e.free && e.d < 4 && !!e.goal) ||
    (inCar && !!goal && goal.d < 12);
  if (stuck(o, m, 15, idle)) { m.esc = 12; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (inCar) { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 6 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }

  if (inCar) {
    const sp = Math.abs(o.car.spd);
    if (goal && goal.kind === 'place' && !jobOn && goal.d < 12 + sp * sp / 12) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      return parkOut(a, o, pulse);
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    const ca = copAvoid(o);
    let want = Math.min(bendSpeed(g) * 1.3, obstacleCap(o));
    if (goal && goal.kind === 'place' && goal.d < 20) want = Math.min(want, 6);
    let s = db * 1.6 + ca.push * 0.3;
    if (o.range[0] < 8) s += o.range[1] > o.range[11] ? 0.5 : -0.5;
    a.steer = clamp(s, -1, 1);
    driveTo(a, sp, want);
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (e && e.free && e.d < 4 && (e.goal || carWorthIt(o))) { a.use = pulse; return a; }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }
  a.turn = clamp(db * 2.2, -1, 1);
  a.move = Math.abs(db) > 1.4 ? 0.2 : 1;
  if (o.rays[3] < 2 && !near) a.move = 0.3;
  if (near && goal.d < 2.5) a.move = 0.5;
  const pd = o.pie.ped[0];
  if (pd < 2.5) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  a.sprint = a.move > 0.5 && (cd < 25 || (Math.abs(db) < 0.5 && o.rays[3] > 6 && !near && pd > 5));
  return a;
}
