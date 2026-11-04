// g41 quality 0.681 wheels 0.38 (mixed), trouble 0.24 per min (a slip) (3168 chars; mutate)
// walker with police avoidance: follows the route on foot and bends its bearing away from cops (weight 2),
// hostile people (1) and pedestrians (0.5) using their pie slices. Sprints when fleeing or clear, never
// stops to talk near police. Climbs in only for a car goal; drives the route with the same steering if in a car.
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

  // repulsion from threats in the pie slices (x = right, z = ahead); cd = nearest cop
  const sets = [[o.pie.cop, 2], [o.pie.foe, 1], [o.pie.ped, 0.5]];
  let rx = 0, rz = 0, cd = 99;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 8; i++) {
      const d = sets[k][0][i];
      if (d >= 25) continue;
      if (k === 0 && d < cd) cd = d;
      const th = i * Math.PI / 4 > Math.PI ? i * Math.PI / 4 - 2 * Math.PI : i * Math.PI / 4;
      const w = sets[k][1] * (25 - d) / (25 * Math.max(d, 1));
      rx -= w * Math.sin(th); rz -= w * Math.cos(th);
    }
  }

  // steer by the route bearing plus repulsion; at a place marker, go straight in unless cops are on us
  const tb = g ? g.b : goal ? goal.b : 0;
  let db = near && cd > 8 ? goal.b : Math.atan2(Math.sin(tb) + rx, Math.cos(tb) + rz);
  if (!inCar && o.rays[3] < 3 && !near) db = clamp(db + openSide(o) * 0.8, -1.5, 1.5);

  // never talk with police close; stuck -> back away
  const talk = !inCar && cd > 12 && !!goal && goal.d < 3 &&
    (goal.kind === 'person' || (goal.kind === 'car' && goal.free === false));
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
      a.brake = sp > 1.5 ? 1 : 0;
      if (sp <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    const want = Math.min(bendSpeed(g), obstacleCap(o));
    a.steer = clamp(db * 1.6, -1, 1);
    a.gas = sp < want ? 1 : 0;
    a.brake = sp > want + 3 ? 0.6 : 0;
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (e && e.free && e.d < 4 && e.goal) { a.use = pulse; return a; }
  a.turn = clamp(db * 2.2, -1, 1);
  a.move = Math.abs(db) > 1.6 ? 0.2 : 1;
  if (o.rays[3] < 2 && !near) a.move = 0.3;
  if (near && goal.d < 2.5) a.move = 0.5;
  const fleeing = cd < 25;
  a.sprint = a.move > 0.5 && (fleeing || (Math.abs(db) < 0.5 && o.rays[3] > 6 && !near));
  return a;
}
