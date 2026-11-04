// g167 quality 0.789 wheels 0.65 (mostly car), trouble 1.94 per min (troublemaker) (3879 chars; crossover)
function think(o, m) {
  const a = {}, c = clamp, goal = o.goal, g = o.gps, e = o.enter, car = o.me.mode === 'car';
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1; m.cs = m.cs || 0; m.rv = m.rv || 0; m.esc = m.esc || 0;
  const pulse = m.n % 4 === 0;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);
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
      if (o.range[6] > 4) { a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    }
    if (!g && !goal) { a.gas = 0.3; return a; }
    const ca = copAvoid(o);
    const lane = o.road.on ? c(-o.road.off * 0.1, -0.2, 0.2) : 0;
    const bend = bendSpeed(g);
    let bs = o.mission.timer > 0 && o.mission.timer < 150 && bend > 5 ? bend + 4 : bend;
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    if (o.rain > 0.5) bs = Math.min(bs, 14);
    if (o.me.wanted > 0 && ca.front < 25) bs = Math.max(bs, 18);
    if (goal && goal.kind !== 'car' && goal.d < 20) bs = Math.min(bs, 7);
    a.steer = c(b * 1.6 + ca.push * 0.8 + lane, -1, 1);
    if (o.range[0] < 8) a.steer = c(a.steer + (o.range[1] > o.range[11] ? 0.5 : -0.5), -1, 1);
    driveTo(a, sa, Math.min(bs, obstacleCap(o)));
    if (ca.front < 5 && o.me.wanted < 1) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  const copClose = cop && cop.d < 10;
  if (talk && !copClose) { a.talk = true; return a; }
  if (!copClose && !m.ck && o.pie.ped[0] < 2 && o.me.wanted === 0 && !(goal && goal.d < 15) && o.t > (m.cn || 0)) { m.ck = o.t + 4; m.cn = o.t + 15; }
  if (conning && !copClose) { a.talk = true; return a; }
  if (e && e.d < 4 && (e.goal ? e.free || o.me.wanted < 3 : carWorthIt(o))) { a.use = pulse; return a; }
  if (o.me.ammo > 0 && o.me.hp > 50 && o.me.wanted < 2 && !cop) {
    const t = nearestPie(o.pie.foe, 12);
    if (t) { a.aim = true; a.turn = c(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; return a; }
  }
  if (!g && !goal) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  let tb = goal && goal.d < 12 && !cop ? goal.b : b;
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);
  const p = o.pie.ped;
  if (p[0] < 2.5 || p[1] < 2 || p[7] < 2) { a.strafe = p[1] < p[7] ? -0.8 : 0.8; a.move = 0.4; }
  const cd = Math.min(o.pie.car[0], o.pie.car[1], o.pie.car[7]);
  if (cd < 4) { a.move = 0.2; a.strafe = o.pie.car[1] < o.pie.car[7] ? -1 : 1; }
  a.sprint = !!cop || o.me.wanted > 1 || (Math.abs(tb) < 0.5 && o.rays[3] > 6 && o.range[0] > 6 && p[0] > 5 && cd > 8);
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  return a;
}
