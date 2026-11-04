// g232 quality 0.823 wheels 0.76 (car), trouble 0.18 per min (a slip) (3247 chars; mutate)
// driver/walker: follow the route at bend/traffic-limited speeds, stop and exit at the goal,
// bail from burning or wrecked cars, unstick by reversing, talk on foot, fire only at close foes.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const car = o.me.mode === 'car', sa = car ? Math.abs(o.car.spd) : 0;
  const g = o.gps, goal = o.goal, e = o.enter;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);
  const idle = car ? (!!goal && goal.kind !== 'car' && goal.d < 14) : (inTalkRange(o) || !!(e && e.d < 4));
  if (stuck(o, m, 18, idle)) { m.esc = 26; m.dir = car ? (b >= 0 ? 1 : -1) : openSide(o); }
  if (m.esc > 0) {
    m.esc--;
    if (car) {
      if (m.esc > 10) { a.brake = 1; a.steer = -m.dir; } else { a.gas = 0.7; a.steer = m.dir; }
    } else if (m.esc > 14) { a.move = -1; a.strafe = m.dir; }
    else { a.move = 1; a.turn = m.dir; a.strafe = m.dir * 0.5; }
    return a;
  }
  if (car) {
    // burning or wrecked: get out (and do not re-enter this car for a while)
    if (o.car.burning || o.car.hp < 0.15) { m.bail = o.t; return parkOut(a, o, pulse); }
    // stop at the place, or beside an occupied car goal, then step out
    const park = goal && (goal.kind !== 'car' ? goal.d < 10 + sa * sa / 16 : (!goal.free && goal.d < 9));
    if (park) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    const ca = copAvoid(o);
    const sidestep = (o.pie.car[7] < 5 ? 0.4 : 0) - (o.pie.car[1] < 5 ? 0.4 : 0);
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.2, 0.2) : 0;
    a.steer = clamp(b * 1.6 + ca.push * 0.6 + sidestep + lane, -1, 1);
    const want = Math.min(bendSpeed(g), obstacleCap(o));
    driveTo(a, sa, want);
    // something close ahead, or a person right in front: stop
    if ((o.pie.car[0] < 6 || o.pie.ped[0] < 5) && sa > 2) { a.gas = 0; a.brake = 1; }
    return a;
  }
  // on foot
  if (inTalkRange(o) && !(cop && cop.d < 10)) { a.talk = true; return a; }
  if (carWorthIt(o) && o.t - (m.bail || -99) > 30) { a.use = pulse; return a; }
  if (o.me.ammo > 0 && !cop && o.me.wanted < 2) {
    const t = nearestPie(o.pie.foe, 6);
    if (t) { a.aim = true; a.turn = clamp(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; return a; }
  }
  let tb = goal && goal.d < 12 && !cop ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = o.rays[3] > 4 ? 0.8 : 0.2; a.turn = o.rays[3] > 4 ? 0 : openSide(o); return a; }
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);
  const pd = o.pie.ped[0];
  if (pd < 2) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  a.sprint = !!cop ? pd > 3 : (Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && pd > 5);
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
