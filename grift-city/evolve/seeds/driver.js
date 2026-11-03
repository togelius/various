// driver: find a free car, drive it along the route, get out at the marker. Walks when there is no car.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  m.px = m.px === undefined ? o.me.x : m.px;
  const g = o.gps;
  if (o.me.mode === 'car') {
    const near = o.goal && o.goal.d < 14;
    if (near) { a.brake = 1; if (Math.abs(o.car.spd) < 2.5) a.use = o.t % 1 < 0.1; return a; }
    if (!g) { a.gas = 0.3; return a; }
    // stuck: pushing but not moving -> reverse for a moment
    if (Math.abs(o.car.spd) < 0.4) m.still = (m.still || 0) + 0.1; else m.still = 0;
    if (m.still > 1.5) { m.rev = 1.6; m.still = 0; }
    if (m.rev > 0) { m.rev -= 0.1; a.gas = 0; a.brake = 1; a.steer = -c(g.b * 2, -1, 1); return a; }
    a.steer = c(g.b * 1.6, -1, 1);
    const turn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.8);
    let want = turn > 0.9 ? 5 : turn > 0.45 ? 9 : 15;
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') want = Math.min(want, 2);
    for (const k of o.peds) if (k.f > 0 && k.f < 9 && Math.abs(k.r) < 2.2) want = Math.min(want, 2);
    if (o.rays[3] < 6) want = Math.min(want, 4);
    a.gas = o.car.spd < want ? 1 : 0; a.brake = o.car.spd > want + 3 ? 0.6 : 0;
    return a;
  }
  // on foot: a free car close by is worth taking
  const e = o.enter;
  let car = null; for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 30 && (!car || k.d < car.d)) car = k;
  if (e && e.free && e.d < 4) { a.use = o.t % 1 < 0.1; return a; }
  if (car && !(o.goal && o.goal.d < 40)) { a.turn = c(car.b * 2.2, -1, 1); a.move = Math.abs(car.b) > 1.2 ? 0.1 : 1; return a; }
  if (!g) { a.move = 0.5; a.turn = 0.3; return a; }
  a.turn = c(g.b * 2.2, -1, 1); a.move = Math.abs(g.b) > 1.2 ? 0.1 : 1; a.sprint = Math.abs(g.b) < 0.5;
  return a;
}
