// g127 quality 0.675 wheels 0.65 (mostly car), trouble 0.85 per min (scuffles) (2425 chars; crossover)
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const G = o.goal, g = o.gps, e = o.enter, r = o.rays;
  const idle = (G && G.d < 3) || (e && e.d < 4);
  if (stuck(o, m, 15, idle)) { m.esc = 14; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (o.me.mode === 'car') { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }
  const b = g ? g.b : G ? G.b : 0;
  if (o.me.mode === 'car') {
    if (G && G.kind !== 'car' && G.d < 12) return parkOut(a, o, pulse);
    if (!g && !G) { a.gas = 0.3; return a; }
    const tb = g && g.wd < 8 ? (b + (g.b2 || 0)) / 2 : b;
    let want = Math.min(bendSpeed(g), obstacleCap(o));
    if (want >= 16 && r[3] > 18 && o.range[0] > 28) want = 20;
    const near = Math.min(o.range[0], o.range[1], o.range[11]);
    if (near < 6) want = Math.min(want, 3);
    const ca = copAvoid(o);
    if (ca.front < 12) want = Math.min(want, 8);
    const side = (o.range[1] < 10 ? -(10 - o.range[1]) * 0.1 : 0) + (o.range[11] < 10 ? (10 - o.range[11]) * 0.1 : 0);
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    let s = tb * 1.6 + side + lane * 0.5 + ca.push * 0.8;
    if (o.range[0] < 8) s += (o.range[1] > o.range[11] ? 0.5 : -0.5);
    m.st = (m.st || 0) * 0.5 + clamp(s, -1, 1) * 0.5;
    a.steer = m.st;
    driveTo(a, Math.abs(o.car.spd), want);
    a.gas = o.car.spd < want ? 1 : 0;
    return a;
  }
  if (G && G.kind === 'person' && G.d < 3) { a.talk = true; return a; }
  if (e && e.d < 4 && e.free && (!G || G.kind === 'car' || G.d > 25)) { a.use = pulse; return a; }
  if (e && e.goal && !e.free && e.d < 3 && o.me.wanted < 3) { a.use = pulse; return a; }
  if (!g && !G) { a.move = 0.5; a.turn = 0.3; return a; }
  let tb = G && (G.kind === 'car' || G.d < 6) ? G.b : b;
  if (r[3] < 4 || r[2] < 2 || r[4] < 2) {
    tb = clamp(tb * 0.3 + openSide(o) * 0.9, -1.5, 1.5);
  }
  walkAt(a, tb);
  const pd = o.pie.ped[0], pd1 = Math.min(o.pie.ped[1], o.pie.ped[7]);
  if (pd < 2.5) a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
  a.sprint = Math.abs(tb) < 0.5 && r[3] > 6 && pd > 5 && pd1 > 3 && o.range[0] > 6;
  return a;
}
