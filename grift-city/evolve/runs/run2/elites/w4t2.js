// g43 quality 0.860 wheels 0.92 (car), trouble 0.97 per min (scuffles) (2584 chars; mutate)
function think(o, m) {
  const a = {}, G = o.goal, g = o.gps, e = o.enter;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const inCar = o.me.mode === 'car', sa = inCar ? Math.abs(o.car.spd) : 0;
  const idle = !o.mission.name, pulse = o.t % 0.5 < 0.1, bl = sa * sa / 16;
  const talking = !inCar && G && G.kind === 'person' && G.d < 2.5;
  const park = inCar && G && ((G.kind === 'place' && idle && G.d < 10 + bl) || (G.kind === 'person' && G.d < 7 + bl));
  const near = G && G.d < 25;
  const sb = g ? g.b : G ? G.b : 0;
  const fb = near ? G.b : sb;
  const open = openSide(o);
  if (stuck(o, m, 20, talking || park)) { m.rv = 15; m.side = open; }
  if (m.rv > 0) {
    m.rv--;
    if (inCar) { a.brake = 1; a.steer = clamp(-sb * 2, -1, 1); }
    else { a.move = -0.6; a.turn = m.side; }
    return a;
  }
  if (inCar) {
    if (park) {
      a.steer = clamp(sb * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    let want = bendSpeed(g);
    if (want >= 15 && o.range[0] > 28) want = 23;
    if (G && G.kind === 'place' && G.d < 40) want = Math.min(want, idle ? 4 + G.d * 0.25 : 8);
    want = Math.min(want, obstacleCap(o));
    if (o.rays[3] < 6 || o.range[0] < 6) want = Math.min(want, 2.5);
    const L = Math.min(o.range[10], o.range[11]), R = Math.min(o.range[1], o.range[2]);
    let steer = sb * 1.6;
    if (o.range[0] < 22) steer += clamp((R - L) * 0.04, -0.6, 0.6);
    if (o.road.on) steer -= clamp(o.road.off * 0.1, -0.25, 0.25);
    if (o.range[3] < 3) steer -= 0.3;
    if (o.range[9] < 3) steer += 0.3;
    a.steer = clamp(steer, -1, 1);
    const ped = Math.min(o.pie.ped[0], o.pie.ped[1], o.pie.ped[7]);
    const stop = o.pie.car[0] < 5 || ped < 3 || o.range[0] < 4;
    a.gas = !stop && sa < want ? 1 : 0;
    a.brake = stop ? (sa > 1 ? 1 : 0) : sa > want + 3 ? 0.6 : 0;
    return a;
  }
  if (talking) { a.talk = true; return a; }
  if (e && e.free && e.d < 4 && (e.goal || carWorthIt(o))) { a.use = pulse; return a; }
  if (!G && !g) { a.move = 0.5; a.turn = 0.3; return a; }
  if ((o.rays[3] < 2.5 || o.range[0] < 3) && !(near && G.d < 4)) { a.turn = open; a.move = 0.4; return a; }
  walkAt(a, fb);
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.move = 0.3;
  } else {
    a.sprint = !near && Math.abs(fb) < 0.5 && o.rays[3] > 12 && o.pie.ped[0] > 12;
  }
  return a;
}
