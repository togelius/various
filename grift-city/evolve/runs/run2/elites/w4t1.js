// g172 quality 0.731 wheels 0.76 (car), trouble 0.54 per min (a slip) (3102 chars; mutate)
// driver/walker with threat avoidance: follows the route, bends away from cops (weight 2), gang (1) and
// people (0.5), brakes for people and cars ahead, drives faster when wanted, unsticks itself.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0; // use is an edge: pulse every 0.4 s
  const goal = o.goal, g = o.gps, e = o.enter;
  const inCar = o.me.mode === 'car';
  const near = !!goal && goal.kind === 'place' && goal.d < 8;
  const cop = copAvoid(o);
  const cd = Math.min(...o.pie.cop);
  const foe = nearestPie(o.pie.foe, 10);
  const hot = cd < 25 || !!foe;

  // repulsion from threats (x = right, z = ahead)
  const sets = [[o.pie.cop, 2], [o.pie.foe, 1], [o.pie.ped, 0.5]];
  let rx = 0, rz = 0;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 8; i++) {
      const d = sets[k][0][i];
      if (d >= 25) continue;
      const th = sliceBearing(i);
      const w = sets[k][1] * (25 - d) / (25 * Math.max(d, 1));
      rx -= w * Math.sin(th); rz -= w * Math.cos(th);
    }
  }
  const tb = g ? g.b : goal ? goal.b : 0;
  let db = near && cop.front > 8 ? goal.b : Math.atan2(Math.sin(tb) + rx, Math.cos(tb) + rz);

  // never talk with police or gang close by
  const talk = !inCar && inTalkRange(o) && cd > 12 && !foe;
  const idle = talk || (!inCar && !!e && e.free && e.d < 4 && !!e.goal) || (inCar && !!goal && goal.d < 12);
  if (stuck(o, m, 20, idle)) { m.esc = 12; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (inCar) { a.brake = 1; a.steer = m.dir; } else { a.move = -1; a.turn = m.dir; }
    return a;
  }

  if (inCar) {
    const sp = Math.abs(o.car.spd);
    // near a place marker: brake to a stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 12 + sp * sp / 12) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      parkOut(a, o, pulse);
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    let want = Math.min(bendSpeed(g), obstacleCap(o));
    if (o.me.wanted >= 2 && cop.front < 30) want = Math.max(want, 18);
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.2, 0.2) : 0;
    a.steer = clamp(db * 1.6 + lane, -1, 1);
    a.gas = sp < want ? 1 : 0;
    a.brake = sp > want + 3 ? 0.6 : 0;
    // person or car right ahead: lift off and brake hard
    if (Math.min(o.pie.ped[0], o.pie.car[0]) < 5 && sp > 2) { a.gas = 0; a.brake = 1; }
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (carWorthIt(o)) { a.use = pulse; return a; }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }
  if (o.rays[3] < 3 && !near) db = clamp(db + openSide(o) * 0.8, -1.5, 1.5);
  a.turn = clamp(db * 2.2, -1, 1);
  a.move = Math.abs(db) > 1.6 ? 0.2 : 1;
  if (o.rays[3] < 2 && !near) a.move = 0.3;
  if (near && goal.d < 2.5) a.move = 0.5;
  a.sprint = a.move > 0.5 && (hot || (Math.abs(db) < 0.5 && o.rays[3] > 6 && !near));
  return a;
}
