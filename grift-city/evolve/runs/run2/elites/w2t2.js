// g130 quality 0.583 wheels 0.49 (mixed), trouble 1.01 per min (scuffles) (3363 chars; mutate)
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const car = o.me.mode === 'car';
  const G = o.goal, g = o.gps, e = o.enter;
  const b = g ? g.b : G ? G.b : 0;
  const ca = copAvoid(o);
  const side = o.range[1] + o.range[2] >= o.range[10] + o.range[11] ? 1 : -1;
  const talk = !car && inTalkRange(o) && ca.front > 12;
  const idle = talk || (car && !!G && G.d < 12) || (!car && !!e && !!e.goal && e.d < 4);
  if (stuck(o, m, 15, idle)) { m.esc = 12; m.dir = m.n % 2 ? 1 : -1; }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = c(-b * 1.6, -1, 1); }
    else { a.move = m.esc > 6 ? -0.6 : 0.6; a.turn = m.dir; }
    return a;
  }
  if (car) {
    const sp = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    if (G && ((G.kind !== 'car' && G.d < 10 + sp * sp / 16) || (G.kind === 'car' && !G.mine && G.d < 9))) {
      a.steer = c(G.b * 1.6, -1, 1);
      a.brake = sp > 1.5 ? 1 : 0;
      if (sp <= 1.5 && G.d < 25) a.use = pulse;
      return a;
    }
    // route steering; hold lane centre on straights; swing round a car ahead toward open room
    let steer = b * 1.6 + ca.push * 1.2;
    if (o.road.on && Math.abs(b) < 0.25) steer -= o.road.off * 0.08;
    const blk = Math.min(o.range[0], o.pie.car[0]);
    if (blk < 14) steer += side * 0.6 * (1 - blk / 14);
    // speed: bend, walls and cars ahead, cars alongside, pedestrians ahead
    let bs = bendSpeed(g);
    if (bs === 16) bs = o.rays[3] > 18 && o.range[0] > 28 ? 21 : 18;
    else bs *= 1.1;
    const sideCar = Math.min(o.pie.car[1], o.pie.car[7]);
    const pedAhead = o.pie.ped[0] < 15 ? 3 + o.pie.ped[0] * 0.4 : 99;
    const want = Math.min(bs, obstacleCap(o), sideCar < 6 ? 6 : 99, ca.front < 15 ? 8 : 99, pedAhead);
    if (sp < want) a.gas = 0.8; else a.brake = sp > want + 3 ? 0.6 : 0;
    if (ca.front < 6 || o.pie.car[0] < 5) { a.gas = 0; a.brake = sp > 1 ? 1 : 0; }
    a.steer = c(steer, -1, 1);
    return a;
  }
  if (talk) { a.talk = true; return a; }
  if (o.me.ammo > 0) {
    const f = nearestPie(o.pie.foe, 18);
    if (f && (o.me.wanted < 3 || f.d < 8)) {
      a.aim = true; a.turn = c(f.b * 2, -1, 1); a.fire = Math.abs(f.b) < 0.5; a.move = a.fire ? 0.3 : 0;
      return a;
    }
  }
  if (carWorthIt(o) || (e && e.goal && e.d < 3 && o.me.wanted < 3)) { a.use = pulse; return a; }
  if (!g && !G) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  // walk the route, bending away from pedestrians within 4 m and from cops
  let tb = G && G.d < 12 ? G.b : b;
  for (let i = 0; i < 8; i++) if (o.pie.ped[i] < 4) tb -= (4 - o.pie.ped[i]) / 4 * Math.sin(sliceBearing(i)) * 0.7;
  walkAt(a, c(tb + ca.push * 0.8, -1.5, 1.5));
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  if (o.pie.car[0] < 5) a.move = Math.min(a.move, 0.3);
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.move = 0.3; a.sprint = false;
  }
  return a;
}
