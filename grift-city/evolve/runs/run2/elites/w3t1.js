// g86 quality 0.637 wheels 0.66 (mostly car), trouble 0.18 per min (a slip) (2047 chars; mutate)
// walker: follow the route on foot, sprinting when the way is clear; skip dialogue; never drive.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const pulse = Math.floor(o.t * 10) % 4 === 0;
  if (o.me.mode === 'car') {
    const sa = Math.abs(o.car.spd), g = o.gps, G = o.goal;
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    if (G && (G.kind !== 'car' ? G.d < 10 + sa * sa / 16 : !G.mine && G.d < 9)) {
      a.steer = clamp(G.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && (G.kind === 'car' || G.d < 25)) a.use = pulse;
      return a;
    }
    m.cs = sa < 0.4 ? (m.cs || 0) + 0.1 : 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    const b = g ? g.b : G ? G.b : 0;
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = clamp(-b * 1.6, -1, 1); return a; }
    const ca = copAvoid(o);
    a.steer = clamp(b * 1.6 + ca.push * 1.2, -1, 1);
    driveTo(a, sa, Math.min(bendSpeed(g), obstacleCap(o), ca.front < 15 ? 8 : 99));
    if (ca.front < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }
  const g = o.gps, G = o.goal;
  const e = o.enter;
  const jack = e && e.d < 3 && e.goal && (e.free || o.me.wanted < 3);
  const talk = G && ((G.kind === 'person' && G.d < 3) || (G.kind === 'car' && !G.free && G.d < 4 && !jack));
  if (talk) { a.talk = true; }
  if (stuck(o, m, 15, talk)) { m.esc = 12; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) { m.esc--; a.move = -1; a.turn = m.dir; return a; }
  if (talk) return a;
  if (jack || carWorthIt(o)) { a.use = pulse; return a; }
  const b = g ? g.b : G ? G.b : null;
  if (b === null) { a.move = 0.5; a.turn = 0.3; return a; }
  walkAt(a, b);
  if (o.rays[3] < 2.5 && !(G && G.d < 4)) { a.turn = o.rays[5] > o.rays[1] ? 1 : -1; a.move = 0.4; return a; }
  a.sprint = Math.abs(b) < 0.5 && o.rays[3] > 6 && !(G && G.d < 6);
  return a;
}
