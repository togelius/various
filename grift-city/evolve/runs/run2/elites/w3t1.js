// g117 quality 0.712 wheels 0.57 (mostly car), trouble 0.27 per min (a slip) (2602 chars; crossover)
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, G = o.goal, e = o.enter, car = o.me.mode === 'car';
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const b = g ? g.b : G ? G.b : 0;
  const talk = !car && inTalkRange(o);
  const idle = talk || (car && !!G && G.d < 12) || (!car && !!e && !!e.goal && e.d < 4);
  if (stuck(o, m, 15, idle)) { m.esc = 12; m.dir = m.n % 2 ? 1 : -1; }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = c(-b * 1.6, -1, 1); }
    else { a.move = m.esc > 6 ? -0.6 : 0.6; a.turn = m.dir; }
    return a;
  }

  if (car) {
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // stop and get out at a place goal, or to take the goal car
    if (G && ((G.kind !== 'car' && G.d < 10 + sa * sa / 16) || (G.kind === 'car' && !G.mine && G.d < 9))) {
      a.steer = c(G.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && G.d < 25) a.use = pulse;
      return a;
    }
    const ca = copAvoid(o);
    a.steer = c(b * 1.6 + ca.push * 1.2, -1, 1);
    let bs = bendSpeed(g);
    if (bs === 16) bs = o.rays[3] > 18 && o.range[0] > 28 ? 21 : 18;
    else bs *= 1.1;
    const want = Math.min(bs, obstacleCap(o), ca.front < 15 ? 8 : 99);
    driveTo(a, sa, want);
    if (ca.front < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (o.me.ammo > 0) {
    const f = nearestPie(o.pie.foe, 18);
    if (f && (o.me.wanted < 3 || f.d < 8)) {
      a.aim = true;
      a.turn = c(f.b * 2, -1, 1);
      a.fire = Math.abs(f.b) < 0.5;
      a.move = a.fire ? 0.3 : 0;
      return a;
    }
  }
  if (e && e.d < 3 && e.free && (e.goal || (o.me.wanted < 3 && g && g.d > 60 && !(G && G.kind === 'car')))) {
    a.use = pulse;
    return a;
  }
  if (e && e.goal && e.d < 3 && o.me.wanted < 3) { a.use = pulse; return a; }
  if (!g && !G) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  const tb = G && G.d < 12 ? G.b : b;
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  const p = o.pie.ped;
  if (p[0] < 2.5 || p[1] < 2 || p[7] < 2) {
    a.strafe = p[1] < p[7] ? -0.8 : 0.8;
    a.move = 0.3;
    a.sprint = false;
  }
  return a;
}
