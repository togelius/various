// g203 quality 0.570 wheels 0.42 (mixed), trouble 0.37 per min (a slip) (3494 chars; mutate)
// Law-abiding driver/walker: follows the route, brakes for people and cars, steers round cops,
// never climbs into an occupied car, never fires. Talks to a debtor only when no cop is close.
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0;
  const car = o.me.mode === 'car', G = o.goal, g = o.gps, e = o.enter;
  const b = g ? g.b : G ? G.b : 0;
  const ca = copAvoid(o);
  const cop = nearestPie(o.pie.cop, 15);
  const talk = !car && inTalkRange(o) && !cop;
  const idle = talk || (car && !!G && G.d < 12) || (!car && !!e && !!e.goal && e.d < 4);

  // no progress for 1.5 s while not waiting on purpose: back off toward open room
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

    // place goal: brake to a stop and step out
    if (G && G.kind !== 'car' && G.d < 10 + sa * sa / 16) {
      a.steer = c(G.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && G.d < 25) a.use = pulse;
      return a;
    }

    // time to contact with the nearest thing ahead (walls, cars, people)
    const fwd = Math.min(o.range[0], o.pie.car[0], o.pie.ped[0]);
    const closing = m.pf === undefined || m.pf > 30 ? 0 : (m.pf - fwd) * 10;
    m.pf = Math.min(fwd, 30);
    const ttc = closing > 0.3 ? fwd / closing : 99;

    // steer: route, cop repulsion, away from people beside the path, keep to lane centre
    const p = o.pie.ped;
    const side = (p[1] < 12 ? -0.5 : 0) + (p[7] < 12 ? 0.5 : 0);
    const lane = o.road.on ? c(-o.road.off * 0.06, -0.2, 0.2) : 0;
    a.steer = c(b * 1.6 + ca.push * 1.2 + side + lane, -1, 1);

    // target speed: bends, obstacles, cops, and a distance cap when things are close ahead
    let want = Math.min(bendSpeed(g), obstacleCap(o), ca.front < 15 ? 8 : 99);
    if (fwd < 25) want = Math.min(want, 3 + fwd * 0.45);

    if (fwd < 5 && sa > 1) { a.gas = 0; a.brake = 1; }
    else if (ttc < 2.5 && sa > 2) { a.gas = 0; a.brake = 1; }
    else if (sa < want) a.gas = 0.8;
    else if (sa > want + 3) a.brake = sa > want + 8 ? 1 : 0.6;
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }

  // climb in only if the car is free (no carjacking) and it is worth it
  if (e && e.free && e.d < 3 && o.me.wanted < 3 && (e.goal || (g && g.d > 60))) {
    a.use = pulse;
    return a;
  }

  // cop close: walk away from it, never toward it
  if (cop) {
    a.turn = c(-cop.b * 2, -1, 1);
    a.move = 0.8;
    a.sprint = o.me.wanted > 0;
    return a;
  }

  if (!g && !G) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  const tb = G && G.d < 12 ? G.b : b;
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10 && o.me.wanted === 0;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  const p = o.pie.ped;
  if (p[0] < 2.5 || p[1] < 2 || p[7] < 2) {
    a.strafe = p[1] < p[7] ? -0.8 : 0.8;
    a.move = 0.3;
    a.sprint = false;
  }
  return a;
}
