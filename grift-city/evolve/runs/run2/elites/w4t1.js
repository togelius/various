// g84 quality 0.909 wheels 0.79 (car), trouble 0.34 per min (a slip) (3687 chars; mutate)
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
  const sp = inCar ? Math.abs(o.car.spd) : 0;
  const near = !!goal && goal.kind === 'place' && goal.d < 8;
  // route bearing; near a waypoint, aim between it and the next one to cut the corner smoothly
  const tb = g ? (g.wd < 8 ? (g.b + (g.b2 || 0)) / 2 : g.b) : goal ? goal.b : 0;

  // repulsion: cops, gang people, pedestrians, vehicles (pie slices), and walls (rays)
  const sets = [[o.pie.cop, 2, 25], [o.pie.foe, 1, 20], [o.pie.ped, 0.5, inCar ? 5 : 8], [o.pie.car, 1.5, inCar ? 10 : 6]];
  const RB = [-1.571, -0.785, -0.349, 0, 0.349, 0.785, 1.571];
  let rx = 0, rz = 0, cd = 99;
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 8; i++) {
      const d = sets[k][0][i];
      if (d >= sets[k][2]) continue;
      if (k === 0 && d < cd) cd = d;
      const w = sets[k][1] * (sets[k][2] - d) / sets[k][2];
      rx -= w * Math.sin(i * Math.PI / 4);
      rz -= w * Math.cos(i * Math.PI / 4);
    }
  }
  for (let j = 0; j < 7; j++) {
    const d = o.rays[j];
    if (d >= 5) continue;
    const w = 1.5 * (5 - d) / 5;
    rx -= w * Math.sin(RB[j]);
    rz -= w * Math.cos(RB[j]);
  }

  // on foot, aim through the repulsion; in a car, only the lateral part steers
  let db = near && cd > 8 ? goal.b : clamp(Math.atan2(Math.sin(tb) + rx, Math.cos(tb) + rz), -1.5, 1.5);
  if (!near && o.rays[3] < 3) db = clamp(db + openSide(o) * 0.8, -1.5, 1.5);

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
    // near a place marker: brake to a stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 12 + sp * sp / 12) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sp > 1.5 ? 1 : 0;
      if (sp <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    // lane keeping (pull back to lane centre), weaker while dodging something
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    const s = tb * 1.6 + rx * 0.8 + lane * Math.max(0, 1 - Math.abs(rx));
    m.st = (m.st || 0) * 0.5 + clamp(s, -1, 1) * 0.5; // smoothed steering
    a.steer = m.st;
    // speed: slow for bends ahead and for anything close in front
    const cap = Math.min(bendSpeed(g), obstacleCap(o));
    const stop = o.range[0] < 4 || o.pie.car[0] < 4;
    a.gas = !stop && sp < cap ? 1 : 0;
    a.brake = stop && sp > 1 ? 1 : sp > cap + 3 ? 0.6 : 0;
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (carWorthIt(o)) { a.use = pulse; return a; }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }
  a.turn = clamp(db * 2.2, -1, 1);
  a.move = Math.abs(db) > 1.6 ? 0.2 : 1;
  if (o.rays[3] < 2 && !near) a.move = 0.3;
  if (near && goal.d < 2.5) a.move = 0.5;
  const fleeing = cd < 25;
  a.sprint = a.move > 0.5 && (fleeing || (Math.abs(db) < 0.5 && o.rays[3] > 6 && !near));
  return a;
}
