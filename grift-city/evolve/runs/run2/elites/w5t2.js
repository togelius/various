// g189 quality 0.698 wheels 0.96 (only car), trouble 0.78 per min (scuffles) (3209 chars; mutate)
function think(o, m) {
  const a = {};
  if (o.ui.retry) return { retry: true };
  if (o.ui.dialogue) return { skip: true };
  if (o.ui.choice) return { choose: 1 };
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  m.esc = m.esc || 0;
  const pulse = m.n % 4 === 0;
  const g = o.gps, goal = o.goal, e = o.enter;
  const car = o.me.mode === 'car';
  const b = g ? g.b : goal ? goal.b : 0;
  const far = !goal || goal.kind === 'car' || goal.d > 25;
  const idle = (goal && goal.d < 3) || (e && e.d < 4) || inTalkRange(o) ||
    (car && goal && goal.kind !== 'car' && goal.d < 8 && Math.abs(o.car.spd) < 1.5);

  if (stuck(o, m, 15, idle) && m.esc <= 0) { m.esc = 14; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }

  if (car) {
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    if (goal && goal.kind !== 'car' && goal.d < 8 + sa * sa / 16) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.4; return a; }
    const ca = copAvoid(o);
    const lane = o.road.on && (!g || g.wd > 12) ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    const wl = (o.rays[1] < 5 ? 0.3 : 0) - (o.rays[5] < 5 ? 0.3 : 0);
    m.st = (m.st || 0) * 0.5 + clamp(b * (sa > 14 ? 1.2 : 1.6) + ca.push * 0.6 + lane + wl, -1, 1) * 0.5;
    a.steer = clamp(m.st, -1, 1);
    if (o.range[0] < 8) a.steer = clamp(a.steer + (o.range[1] > o.range[11] ? 0.5 : -0.5), -1, 1);
    let want = bendSpeed(g) + 4;
    if (o.rain > 0.5) want = Math.min(want, 13);
    if (o.me.wanted > 0) want = Math.max(want, 18);
    want = Math.min(want, obstacleCap(o) + 2);
    if (Math.abs(b) > 0.6) want = Math.min(want, 7);
    const near = Math.min(o.pie.car[0], o.pie.ped[0], o.pie.ped[1] + 2, o.pie.ped[7] + 2);
    if (near < 3.5) { a.brake = sa > 1 ? 1 : 0; return a; }
    if (near < 12) want = Math.min(want, 3 + near * 0.6);
    return driveTo(a, sa, want);
  }

  // on foot: shoot foes if armed
  if (o.me.ammo > 0) {
    const f = nearestPie(o.pie.foe, 15);
    if (f && !(e && e.d < 4)) {
      a.aim = true;
      a.turn = clamp(f.b * 2, -1, 1);
      a.fire = Math.abs(f.b) < 0.5;
      return a;
    }
  }
  if (inTalkRange(o)) return { talk: true };
  // jack any nearby car (occupied or not) unless we are at a place marker
  if (e && e.d < 4 && far) { a.use = pulse; a.move = 0.2; return a; }
  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }

  let tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal.b;
  if (far) {
    const c = nearestPie(o.pie.car, 30);
    if (c) tb = c.b + (e ? e.b - c.b : 0);
  }
  walkAt(a, tb);
  const pn = Math.min(o.pie.ped[0], o.pie.ped[1], o.pie.ped[7]);
  if (pn < 2) { a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -1 : 1; a.move = 0.3; }
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 6 && o.range[0] > 6 && pn > 6;
  if (o.rays[3] < 2.5 || (o.range[0] < 3 && !far)) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
