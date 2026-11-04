// g186 quality 0.672 wheels 0.56 (mostly car), trouble 0.49 per min (a slip) (3099 chars; crossover)
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const g = o.gps, G = o.goal, e = o.enter, car = o.me.mode === 'car';
  const idle = !!((G && G.d < 3) || (e && e.d < 3) || m.ck > o.t);
  const st = stuck(o, m, 20, idle);
  if (st) { m.esc = 15; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }
  const b = g ? g.b : G ? G.b : 0;
  const cop = nearestPie(o.pie.cop, 14);

  if (car) {
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.12) return parkOut(a, o, pulse);
    const atPlace = G && G.kind !== 'car' && G.d < 10 + sa * sa / 16;
    const carGoal = G && G.kind === 'car' && !G.mine && G.d < 9;
    if (atPlace || carGoal) {
      a.steer = c(G.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (!g && !G) { a.gas = 0.3; return a; }
    const ca = copAvoid(o);
    const side = (o.pie.car[7] < 5 ? 0.4 : 0) - (o.pie.car[1] < 5 ? 0.4 : 0);
    const lane = o.road.on ? c(-o.road.off * 0.1, -0.2, 0.2) : 0;
    let s = b * 1.6 + side + lane + ca.push * 0.6;
    if (o.range[0] < 8) s += o.range[1] > o.range[11] ? 0.5 : -0.5;
    a.steer = c(s, -1, 1);
    let bs = bendSpeed(g);
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    if (o.me.wanted > 0 && ca.front < 25) bs = Math.max(bs, 18);
    let want = Math.min(bs, obstacleCap(o));
    if (o.pie.car[0] < 6 && sa > 2) { a.brake = 1; return a; }
    return driveTo(a, sa, want);
  }

  const copClose = cop && cop.d < 10;
  if (!copClose) {
    if (inTalkRange(o)) { a.talk = true; return a; }
    if (!m.ck && o.pie.ped[0] < 2 && o.me.wanted === 0 && !(G && G.d < 15) && o.t > (m.cn || 0)) { m.ck = o.t + 4; m.cn = o.t + 15; }
    if (m.ck && o.t < m.ck) { a.talk = true; return a; }
    m.ck = 0;
  }
  if (e && e.d < 3 && e.free && o.me.wanted < 3 && (e.goal || (G && G.kind === 'car') || !G || G.d > 60 || (g && g.d > 120))) { a.use = pulse; return a; }
  let tb = G && G.d < 12 && !cop ? G.b : g ? g.b : G ? G.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  const r = o.rays;
  if (r[3] < 4 || r[2] < 2 || r[4] < 2) {
    const sd = (r[4] + r[5]) - (r[2] + r[1]);
    tb = c(tb * 0.3 + (sd >= 0 ? 1 : -1) * 0.9, -1.5, 1.5);
  }
  walkAt(a, tb);
  const pd = o.pie.ped[0], pd1 = Math.min(o.pie.ped[1], o.pie.ped[7]);
  if (pd < 2.5 && !m.ck) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  a.sprint = !!cop || o.me.wanted > 1 || (Math.abs(tb) < 0.5 && r[3] > 7 && pd > 5 && pd1 > 3 && o.range[0] > 7);
  return a;
}
