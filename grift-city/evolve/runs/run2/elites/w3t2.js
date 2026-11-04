// g182 quality 0.789 wheels 0.62 (mostly car), trouble 0.76 per min (scuffles) (3356 chars; mutate)
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
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);
  const carPark = o.me.mode === 'car' && goal && goal.kind !== 'car' && goal.d < 8 && Math.abs(o.car.spd) < 1.5;
  const idle = (goal && goal.d < 3) || (e && e.d < 4) || inTalkRange(o) || carPark;

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
    if (goal && goal.kind !== 'car' && goal.d < 8 + sa * sa / 16) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !goal) { a.gas = 0.3; return a; }

    const ca = copAvoid(o);
    const lane = o.road.on && (!g || g.wd > 12) ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    const wl = (o.rays[1] < 5 ? 0.3 : 0) - (o.rays[5] < 5 ? 0.3 : 0);
    m.st = (m.st || 0) * 0.5 + clamp(b * (sa > 14 ? 1.2 : 1.6) + ca.push * 1.2 + lane + wl, -1, 1) * 0.5;
    a.steer = clamp(m.st, -1, 1);
    if (o.range[0] < 8) a.steer = clamp(a.steer + (o.range[1] > o.range[11] ? 0.5 : -0.5), -1, 1);

    const bend = bendSpeed(g);
    const rush = o.mission.timer > 0 && o.mission.timer < 150 && bend > 5;
    let want = rush ? bend + 4 : bend;
    if (o.rain > 0.5) want = Math.min(want, 12);
    if (o.me.wanted > 0 && ca.front < 25) want = Math.max(want, 18);
    want = Math.min(want, obstacleCap(o));
    if (Math.abs(b) > 0.6) want = Math.min(want, 7);
    if (ca.front < 15) want = Math.min(want, 8);

    const near = Math.min(o.pie.car[0], o.pie.ped[0], o.pie.ped[1] + 2, o.pie.ped[7] + 2);
    if (ca.front < 6 || near < 4) { a.brake = sa > 1 ? 1 : 0; return a; }
    if (near < 14) want = Math.min(want, 3 + near * 0.5);
    return driveTo(a, sa, want);
  }

  if (inTalkRange(o) && !(cop && cop.d < 10)) return { talk: true };
  if (e && e.d < 4 && carWorthIt(o)) { a.use = pulse; return a; }

  if (!g && !goal) { a.move = 0.5; a.turn = 0.3; return a; }

  let tb = goal && goal.d < 12 && !cop ? goal.b : g ? g.b : goal.b;
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);

  const pd = o.pie.ped[0];
  const pn = Math.min(pd, o.pie.ped[1], o.pie.ped[7]);
  if (pn < 4.5) { a.move = pn < 2 ? 0 : 0.3; a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -1 : 1; }
  const cd = Math.min(o.pie.car[0], o.pie.car[1], o.pie.car[7]);
  if (cd < 4) { a.move = 0.2; a.strafe = o.pie.car[1] < o.pie.car[7] ? -1 : 1; }

  a.sprint = !cop && Math.abs(tb) < 0.5 && o.rays[3] > 6 && o.range[0] > 6 && pn > 9 && cd > 8;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
