// g133 quality 0.699 wheels 0.52 (mostly car), trouble 2.62 per min (troublemaker) (3632 chars; crossover)
// Combined controller: A's road driving and walking, B's cop/foe/ped repulsion on foot.
// Talks only with no cop near, flees cops by bending the route, shoots only at close foes.
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
  const tb = g ? g.b : goal ? goal.b : 0;
  let cd = 50;
  for (let i = 0; i < 8; i++) if (o.pie.cop[i] < cd) cd = o.pie.cop[i];
  const talk = !inCar && cd > 12 && inTalkRange(o);
  const near = !inCar && !!goal && goal.kind === 'place' && goal.d < 8;
  const idle = talk || (!!e && e.d < 4) || (inCar && !!goal && goal.d < 12);
  if (stuck(o, m, 15, idle)) { m.esc = 14; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (inCar) { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }

  if (inCar) {
    const sp = Math.abs(o.car.spd);
    // place goal: brake in time, stop, then step out once close
    if (goal && goal.kind !== 'car' && goal.d < 6 + sp * sp / 10) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sp > 1.5 ? 1 : 0;
      if (sp <= 1.5 && goal.d < 6) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    const ca = copAvoid(o);
    let want = Math.min(bendSpeed(g), obstacleCap(o), ca.front < 12 ? 8 : 99);
    if (want >= 16 && o.rays[3] > 18 && o.range[0] > 28) want = 20;
    const aim = g && g.wd < 8 ? (tb + (g.b2 || 0)) / 2 : tb;
    const side = (o.range[1] < 10 ? -(10 - o.range[1]) * 0.1 : 0) +
                 (o.range[11] < 10 ? (10 - o.range[11]) * 0.1 : 0);
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    let s = aim * 1.6 + side + lane * 0.5 + ca.push * 0.8;
    if (o.range[0] < 8) s += o.range[1] > o.range[11] ? 0.5 : -0.5;
    m.st = (m.st || 0) * 0.5 + clamp(s, -1, 1) * 0.5;
    a.steer = m.st;
    driveTo(a, sp, want);
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (carWorthIt(o)) { a.use = pulse; return a; }
  if (e && e.goal && !e.free && e.d < 3 && o.me.wanted < 3 && cd > 12) { a.use = pulse; return a; }

  // shoot back only at a foe close and in reach
  const fo = nearestPie(o.pie.foe, 5);
  if (fo && o.me.ammo > 0) {
    a.turn = clamp(fo.b * 2.2, -1, 1);
    a.aim = true;
    a.fire = Math.abs(fo.b) < 0.3;
    return a;
  }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }

  // repel from cops (weight 2), foes (1) and pedestrians (0.5) in the pie slices
  let rx = 0, rz = 0;
  const sets = [[o.pie.cop, 2], [o.pie.foe, 1], [o.pie.ped, 0.5]];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 8; i++) {
      const d = sets[k][0][i];
      if (d >= 25) continue;
      const th = sliceBearing(i);
      const w = sets[k][1] * (25 - d) / (25 * Math.max(d, 1));
      rx -= w * Math.sin(th);
      rz -= w * Math.cos(th);
    }
  }
  let db = near && cd > 8 ? goal.b : Math.atan2(Math.sin(tb) + rx, Math.cos(tb) + rz);
  if (o.rays[3] < 3 && !near) db = clamp(db + openSide(o) * 0.8, -1.5, 1.5);
  a.turn = clamp(db * 2.2, -1, 1);
  a.move = Math.abs(db) > 1.6 ? 0.2 : 1;
  if (o.rays[3] < 2 && !near) a.move = 0.3;
  if (near && goal.d < 2.5) a.move = 0.5;
  a.sprint = a.move > 0.5 && (cd < 25 || (Math.abs(db) < 0.5 && o.rays[3] > 6 && !near));
  return a;
}
