// g147 quality 0.850 wheels 0.70 (mostly car), trouble 1.25 per min (scuffles) (3935 chars; repair)
// Merged controller: driving (lanes, cops, speed, park out) and on foot (talk, car entry, walking, shooting).
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  m.esc = m.esc || 0;
  const pulse = m.n % 4 === 0;
  const g = o.gps, goal = o.goal, e = o.enter;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);
  const carPark = o.me.mode === 'car' && goal && goal.kind !== 'car' && goal.d < 8 && Math.abs(o.car.spd) < 1.5;
  const idle = (goal && goal.d < 3) || (e && e.d < 4) || inTalkRange(o) || carPark;

  // stuck: back off or sidestep for a moment
  if (stuck(o, m, 15, idle) && m.esc <= 0) { m.esc = 14; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (o.me.mode === 'car') { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }

  if (o.me.mode === 'car') {
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // at a place goal: brake to a stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 8 + sa * sa / 16) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }

    // steering: route, cop repulsion, lane keeping, wall nudge; smoothed
    const ca = copAvoid(o);
    const lane = o.road.on && (!g || g.wd > 12) ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    const wl = (o.rays[1] < 5 ? 0.3 : 0) - (o.rays[5] < 5 ? 0.3 : 0);
    let raw = b * (sa > 14 ? 1.2 : 1.6) + ca.push * 1.2 + lane + wl;
    if (o.range[0] < 8) raw += o.range[1] > o.range[11] ? 0.5 : -0.5;
    m.st = (m.st || 0) * 0.5 + clamp(raw, -1, 1) * 0.5;
    a.steer = clamp(m.st, -1, 1);

    // speed: bends, rain, police, obstacles; mission timer adds speed on gentle bends
    const bend = bendSpeed(g);
    const rush = o.mission.timer > 0 && o.mission.timer < 150 && bend > 5;
    let want = rush ? bend + 4 : bend;
    if (o.rain > 0.5) want = Math.min(want, 12);
    if (o.me.wanted > 0 && ca.front < 25) want = Math.max(want, 18);
    want = Math.min(want, obstacleCap(o));
    if (Math.abs(b) > 0.6) want = Math.min(want, 7);
    if (ca.front < 15) want = Math.min(want, 8);
    if (ca.front < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; return a; }
    return driveTo(a, sa, want);
  }

  // on foot
  if (inTalkRange(o) && !(cop && cop.d < 10)) { a.talk = true; return a; }
  if (e && e.d < 4 && carWorthIt(o)) { a.use = pulse; return a; }

  // shoot only at close hostiles, and only while wanted level is low
  if (o.me.ammo > 0 && o.me.wanted < 2) {
    const t = nearestPie(o.pie.foe, 8);
    if (t) { a.aim = true; a.turn = clamp(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; return a; }
  }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }

  // route, bent away from police
  let tb = goal && goal.d < 12 && !cop ? goal.b : g ? g.b : goal.b;
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);

  // people and traffic close: sidestep away from the nearer side
  const pd = o.pie.ped[0];
  if (pd < 2.5) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  const cd = Math.min(o.pie.car[0], o.pie.car[1], o.pie.car[7]);
  if (cd < 4) { a.move = 0.2; a.strafe = o.pie.car[1] < o.pie.car[7] ? -1 : 1; }

  a.sprint = !cop && Math.abs(tb) < 0.5 && o.rays[3] > 6 && o.range[0] > 6 && pd > 5 && cd > 8;
  // walls or props close ahead: turn to the open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
