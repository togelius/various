// g221 quality 1.099 wheels 0.64 (mostly car), trouble 0.91 per min (scuffles)
function think(o, m) {
  const a = {}, c = clamp, goal = o.goal, g = o.gps, e = o.enter, car = o.me.mode === 'car';
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1; m.cs = m.cs || 0; m.rv = m.rv || 0; m.esc = m.esc || 0;
  const pulse = m.n % 4 === 0, R = o.range, P = o.pie;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(P.cop, 14);
  const talk = !car && inTalkRange(o);
  const conning = !car && m.ck && o.t < m.ck;
  const idle = talk || conning || (goal && goal.d < 3) || (e && e.d < 4 && e.goal);
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
    const free = !o.mission.name;
    const carG = goal && goal.kind === 'car' && !goal.mine && goal.d < 9;
    const placeG = goal && goal.kind !== 'car' && free && goal.d < 8 + sa * sa / 16;
    if (carG || placeG) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 2) { m.rv = 1.5; m.cs = 0; }
    if (m.rv > 0) {
      m.rv = Math.max(0, m.rv - 0.1);
      if (R[6] > 4) { a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    const ca = copAvoid(o);
    const lane = o.road.on ? c(-o.road.off * 0.1, -0.2, 0.2) : 0;
    let bs = bendSpeed(g);
    if (o.mission.timer > 0 && o.mission.timer < 150 && bs > 5) bs += 4;
    if (bs === 16 && o.rays[3] > 18 && R[0] > 28) bs = 20;
    if (o.rain > 0.5) bs = Math.min(bs, 14);
    if (o.me.wanted > 0 && ca.front < 25) bs = Math.max(bs, 18);
    if (goal && goal.kind !== 'car' && goal.d < 20) bs = Math.min(bs, 7);
    let s = b * 1.6 + ca.push * 0.8 + lane;
    const fr = Math.min(R[0], P.car[0], P.ped[0]);
    const arc = Math.min(R[11], R[0], R[1]);
    const left = R[10] + R[11], right = R[1] + R[2];
    if (arc < 20) s += (right >= left ? 0.45 : -0.45) * (1 - arc / 20);
    const pedN = Math.min(P.ped[0], P.ped[1], P.ped[7]);
    if (pedN < 10) s += (P.ped[1] < P.ped[7] ? -0.3 : 0.3);
    a.steer = c(s, -1, 1);
    driveTo(a, sa, Math.min(bs, obstacleCap(o)));
    const stopD = sa * sa / 14 + 3;
    if (sa > 3 && (fr < stopD || arc < stopD * 0.6 || pedN < 5)) { a.gas = 0; a.brake = 1; }
    return a;
  }

  const copClose = cop && cop.d < 10;
  if (talk && !copClose) { a.talk = true; return a; }
  if (!copClose && !m.ck && P.ped[0] < 2 && o.me.wanted === 0 && !(goal && goal.d < 15) && o.t > (m.cn || 0)) { m.ck = o.t + 4; m.cn = o.t + 15; }
  if (conning && !copClose) { a.talk = true; return a; }
  if (e && e.d < 4 && (e.goal ? e.free || o.me.wanted < 3 : carWorthIt(o))) { a.use = pulse; return a; }
  if (!g && !goal) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  let tb = goal && goal.d < 12 && !cop ? goal.b : b;
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);
  const p = P.ped;
  if (p[0] < 2.5 || p[1] < 2 || p[7] < 2) { a.strafe = p[1] < p[7] ? -0.8 : 0.8; a.move = 0.4; }
  const cd = Math.min(P.car[0], P.car[1], P.car[7]);
  if (cd < 4) { a.move = 0.2; a.strafe = P.car[1] < P.car[7] ? -1 : 1; }
  a.sprint = !!cop || o.me.wanted > 1 || (Math.abs(tb) < 0.5 && o.rays[3] > 6 && R[0] > 6 && p[0] > 5 && cd > 8);
  if (o.rays[3] < 2.5 || R[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
