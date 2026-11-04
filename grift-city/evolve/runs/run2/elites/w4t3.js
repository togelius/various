// g47 quality 0.610 wheels 0.80 (car), trouble 1.62 per min (troublemaker) (3926 chars; repair)
// driver + walker: walks the route, climbs into a free car for a car goal or a long walk, drives with bend- and
// obstacle-aware speed, steers away from police, bails out of a burning car, reverses when stuck.
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, goal = o.goal, e = o.enter;
  const open = openSide(o);
  if (m.t0 === undefined) { m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0; m.cs = 0; m.rv = 0; m.n = 0; }
  m.n++;
  const pulse = m.n % 4 === 0; // use is an edge: pulse every 0.4 s

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sp = o.car.spd, sa = Math.abs(sp);
    // burning or wrecked: stop, then step out
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // close to a place marker: brake to a stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 10 + sa * sa / 16) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && goal.d < 25) a.use = pulse;
      return a;
    }
    // stuck (stopped while wanting to move): reverse for 1.5 s
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    const b = g ? g.b : goal ? goal.b : 0;
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    // police within 25 m push the steering away from their side; a cop close ahead slows us
    let push = 0, cf = 50;
    for (let i = 0; i < 8; i++) {
      const d = o.pie.cop[i];
      if (d >= 25) continue;
      push -= (25 - d) / 25 * Math.sin(i * Math.PI / 4);
      if (i === 0 || i === 1 || i === 7) cf = Math.min(cf, d);
    }
    a.steer = c(b * 1.6 + push * 1.2, -1, 1);
    const want = Math.min(bendSpeed(g), obstacleCap(o), cf < 15 ? 8 : 99);
    if (sa < want) a.gas = 0.8;
    else a.brake = sa > want + 3 ? 0.6 : 0;
    if (cf < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  // on foot
  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  // stall breaker: under 1 m of progress in 4 s -> back off and turn for 1.5 s
  if (o.t - m.t0 >= 4) {
    if (Math.hypot(o.me.x - m.px, o.me.z - m.pz) < 1) { m.bk = 1.5; m.side = open; }
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z;
  }
  // debtor in front: hold talk
  if (goal && goal.kind === 'person' && goal.d < 2.5) {
    a.talk = true; m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; return a;
  }
  // armed: shoot the nearest hostile within 18 m
  if (o.me.ammo > 0) {
    let bi = -1, bd = 18;
    for (let i = 0; i < 8; i++) if (o.pie.foe[i] < bd) { bd = o.pie.foe[i]; bi = i; }
    if (bi >= 0) {
      const ang = (bi > 4 ? bi - 8 : bi) * 0.785;
      a.aim = true; a.turn = c(ang * 2, -1, 1);
      a.fire = Math.abs(ang) < 0.5;
      return a;
    }
  }
  // climb into a free car next to us for a car goal or a long walk (never carjack)
  if (e && e.free && e.d < 3 && ((goal && goal.kind === 'car') || (g && g.d > 120))) {
    a.use = o.t % 0.5 < 0.1; return a;
  }
  // straight at the marker when close, otherwise along the route
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  // walls, props and vehicles close ahead: turn to the open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  // people close: sidestep away from the nearer side
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8; a.move = 0.3; a.sprint = false;
  }
  return a;
}
