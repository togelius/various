// g195 quality 1.131 wheels 0.72 (mostly car), trouble 0.27 per min (a slip)
function repel(arr, r) {
  let p = 0;
  for (let i = 0; i < 8; i++) if (arr[i] < r) p -= (r - arr[i]) / r * Math.sin(i * Math.PI / 4);
  return p;
}
function think(o, m) {
  const a = {}, c = clamp, goal = o.goal, g = o.gps, e = o.enter, car = o.me.mode === 'car';
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  if (m.n === undefined) { m.n = 0; m.esc = 0; m.dir = 1; m.tk = 0; }
  m.n++;
  const pulse = m.n % 4 === 0;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);
  const copClose = !!cop && cop.d < 10;
  const talkNow = !car && !!goal && (goal.kind === 'person' ? goal.d < 2.5 : goal.kind === 'car' && !goal.free && goal.d < 3);
  const idle = talkNow || (goal && goal.d < 3) || (e && e.d < 4 && e.goal);
  if (stuck(o, m, 15, idle) && m.esc <= 0) { m.esc = 14; m.dir = openSide(o); }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = m.esc > 7 ? -m.dir : m.dir; }
    else { a.move = m.esc > 7 ? -0.8 : 0.8; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }

  if (car) {
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    const carG = goal && goal.kind === 'car' && !goal.mine && goal.d < 9;
    const placeG = goal && goal.kind !== 'car' && !o.mission.name && goal.d < 8 + sa * sa / 16;
    if (carG || placeG) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    const ca = copAvoid(o);
    if (!g && !goal) { a.steer = c(ca.push * 0.8, -1, 1); return driveTo(a, sa, Math.min(8, obstacleCap(o))); }
    const lane = c(-o.road.off * 0.15, -0.25, 0.25);
    let bs = bendSpeed(g);
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    if (o.me.wanted > 0 && ca.front < 25) bs = Math.max(bs, 18);
    if (goal && goal.kind !== 'car' && goal.d < 20) bs = Math.min(bs, 7);
    const push = ca.push + repel(o.pie.car, 6) + repel(o.pie.ped, 6);
    a.steer = c(b * 1.6 + push * 0.8 + lane, -1, 1);
    if (o.range[0] < 8) a.steer = c(a.steer + (o.range[1] > o.range[11] ? 0.5 : -0.5), -1, 1);
    driveTo(a, sa, Math.min(bs, obstacleCap(o)));
    if (ca.front < 5 && o.me.wanted < 1) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  if (talkNow && !copClose) {
    m.tk = (m.tk + 0.1) % 12;
    if (m.tk < 8) { a.talk = true; return a; }
    if (e && e.goal && e.d < 3 && o.me.wanted < 3) a.use = pulse;
    return a;
  }
  m.tk = 0;
  if (carWorthIt(o)) { a.use = pulse; return a; }
  const cw = !!e && e.free && o.me.wanted < 3 && e.d < 60 && (e.goal || !goal || goal.d > 40);
  if (!g && !goal && !cw) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  let tb = cw ? e.b : goal && (goal.d < 12 || (goal.kind === 'car' && goal.d < 40)) ? goal.b : b;
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);
  const p = o.pie.ped;
  const cd = Math.min(o.pie.car[0], o.pie.car[1], o.pie.car[7]);
  if (p[0] < 2.5 || p[1] < 2 || p[7] < 2) { a.strafe = p[1] < p[7] ? -0.8 : 0.8; a.move = 0.4; }
  if (cd < 4) { a.move = 0.2; a.strafe = o.pie.car[1] < o.pie.car[7] ? -1 : 1; }
  a.sprint = !!cop || o.me.wanted > 1 || (Math.abs(tb) < 0.5 && o.rays[3] > 6 && o.range[0] > 6 && p[0] > 5 && cd > 8);
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
