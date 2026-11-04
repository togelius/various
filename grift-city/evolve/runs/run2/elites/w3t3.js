// g16 quality 0.622 wheels 0.70 (mostly car), trouble 1.83 per min (troublemaker) (3677 chars; mutate)
// walker with a stall breaker: walks the route (straight at the marker when near), dodges walls and people,
// talks to a debtor, takes a free car for a car goal or a long walk, drives gently, reverses when stuck.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, goal = o.goal, e = o.enter;
  const open = o.rays[5] > o.rays[1] ? 1 : -1; // turn towards the more open side
  if (m.t0 === undefined) { m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0; m.cs = 0; m.rv = 0; m.n = 0; }

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sp = o.car.spd, sa = Math.abs(sp);
    // close to the goal: brake to a stop, then step out (use pulses every 0.4 s)
    if (goal && goal.kind !== 'car' && goal.d < 10 + sa * sa / 16) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && goal.d < 25) { m.n++; a.use = m.n % 4 === 0; }
      return a;
    }
    // stuck (stopped while wanting to move): reverse for 1.5 s
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    const b = g ? g.b : goal ? goal.b : 0;
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    const ahead = Math.min(o.pie.car[0], o.pie.car[1], o.pie.car[7]);
    const ped = Math.min(o.pie.ped[0], o.pie.ped[1], o.pie.ped[7]);
    a.steer = c(b * 1.6, -1, 1);
    if (sa < (ahead < 20 ? 4 : 11) && ahead > 6 && ped > 8) a.gas = 0.6;
    else a.brake = sa > 1 ? 0.8 : 0;
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
  // armed: shoot the nearest hostile within 18 m, stopping to aim if it is in the way
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
  // climb into a free car next to us for a car goal or a long walk (use pulses every 0.5 s)
  if (e && (e.free || o.me.wanted < 3) && e.d < 3 && ((goal && goal.kind === 'car') || (g && g.d > 250))) {
    a.use = o.t % 0.5 < 0.1; return a;
  }
  // straight at the marker when close, otherwise along the route
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  a.turn = c(tb * 2.2, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : 1;
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 12 && o.range[0] > 12 && o.pie.ped[0] > 15;
  // walls, props and vehicles close ahead: turn to the open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  // people close: sidestep away from the nearer side
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8; a.move = 0.3; a.sprint = false;
  }
  return a;
}
