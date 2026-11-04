// g122 quality 0.963 wheels 0.76 (car), trouble 1.95 per min (troublemaker) (3203 chars; crossover)
// combined: A's route-following, talk/skip and car handling; B's stuck recovery, reversing and cop-aware steering; no early shooting
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  m.cs = m.cs || 0; m.rv = m.rv || 0; m.esc = m.esc || 0;
  const pulse = m.n % 4 === 0;
  const g = o.gps, goal = o.goal, e = o.enter;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);
  const idle = (goal && goal.d < 3) || (e && e.d < 4);
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
    // at a place goal: stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 8 + sa * sa / 16) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    // stopped for a while: reverse if the way behind is clear
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 3) { m.rv = 1.5; m.cs = 0; }
    if (m.rv > 0) {
      m.rv = Math.max(0, m.rv - 0.1);
      if (o.range[6] > 4) { a.brake = 1; a.steer = clamp(-b * 1.6, -1, 1); return a; }
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    // drive the route: cop repulsion, wall nudge, speed limited by bends, rain and obstacles
    const ca = copAvoid(o);
    let bs = bendSpeed(g);
    if (o.rain > 0.5) bs = Math.min(bs, 12);
    if (o.me.wanted > 0 && ca.front < 25) bs = Math.max(bs, 18);
    a.steer = clamp(b * 1.6 + ca.push * 0.6, -1, 1);
    if (o.range[0] < 8) a.steer = clamp(a.steer + (o.range[1] > o.range[11] ? 0.5 : -0.5), -1, 1);
    return driveTo(a, sa, Math.min(bs, obstacleCap(o)));
  }

  // on foot
  if (inTalkRange(o) && !(cop && cop.d < 10)) { a.talk = true; return a; }
  if (e && e.d < 4 && carWorthIt(o)) { a.use = pulse; return a; }
  // shoot only at hostiles close by, and only while wanted level is low
  if (o.me.ammo > 0 && o.me.wanted < 2) {
    const t = nearestPie(o.pie.foe, 8);
    if (t) { a.aim = true; a.turn = clamp(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; return a; }
  }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }
  let tb = goal && goal.d < 12 && !cop ? goal.b : g ? g.b : goal.b;
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);
  const pd = o.pie.ped[0];
  if (pd < 2.5) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  a.sprint = !cop && Math.abs(tb) < 0.5 && o.rays[3] > 6 && o.range[0] > 6 && pd > 5;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
