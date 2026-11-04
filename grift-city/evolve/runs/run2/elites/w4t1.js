// g63 quality 0.919 wheels 0.75 (car), trouble 0.54 per min (a slip) (3949 chars; crossover)
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, goal = o.goal, e = o.enter;
  if (m.t0 === undefined) { m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0; m.cs = 0; m.rv = 0; m.n = 0; m.ft = -9; }
  m.n++;
  const pulse = m.n % 4 === 0;

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // stop at a place goal, or next to a car goal we do not drive, then get out
    const atPlace = goal && goal.kind !== 'car' && goal.d < 10 + sa * sa / 16;
    const carGoal = goal && goal.kind === 'car' && !goal.mine && goal.d < 9;
    if (atPlace || carGoal) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && (carGoal || goal.d < 25)) a.use = pulse;
      return a;
    }
    // stuck against something: reverse and turn for 1.5 s
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    const b = g ? g.b : goal ? goal.b : 0;
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    // steer away from police, and slow down when they are close ahead
    let push = 0, cf = 50;
    for (let i = 0; i < 8; i++) {
      const d = o.pie.cop[i];
      if (d >= 25) continue;
      push -= (25 - d) / 25 * Math.sin(i * Math.PI / 4);
      if (i === 0 || i === 1 || i === 7) cf = Math.min(cf, d);
    }
    a.steer = c(b * 1.6 + push * 1.2, -1, 1);
    let bs = bendSpeed(g);
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    const want = Math.min(bs, obstacleCap(o), cf < 15 ? 8 : 99);
    if (sa < want) a.gas = 0.8;
    else a.brake = sa > want + 3 ? 0.6 : 0;
    if (cf < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  // on foot: unstick by backing off if we have not moved 1 m in 4 s
  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  if (o.t - m.t0 >= 4) {
    if (Math.hypot(o.me.x - m.px, o.me.z - m.pz) < 1 && o.t - m.ft > 1) { m.bk = 1.5; m.side = openSide(o); }
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z;
  }
  // debtor: hold talk next to him, or next to his occupied car
  if (goal && goal.d < 2.5 && goal.kind === 'person') { a.talk = true; m.ft = o.t; return a; }
  if (goal && goal.kind === 'car' && !goal.free && goal.d < 4 && !(e && e.goal && e.d < 3)) { a.talk = true; m.ft = o.t; return a; }
  // shoot the nearest hostile in reach (close ones even when wanted)
  if (o.me.ammo > 0) {
    let bi = -1, bd = 18;
    for (let i = 0; i < 8; i++) if (o.pie.foe[i] < bd) { bd = o.pie.foe[i]; bi = i; }
    if (bi >= 0 && (o.me.wanted < 3 || bd < 8)) {
      const ang = (bi > 4 ? bi - 8 : bi) * 0.785;
      a.aim = true;
      a.turn = c(ang * 2, -1, 1);
      a.fire = Math.abs(ang) < 0.5;
      a.move = Math.abs(ang) < 0.5 ? 0.3 : 0;
      m.ft = o.t;
      return a;
    }
  }
  // climb into the goal car, or a free car that saves a long walk
  if (e && e.d < 3 && ((e.goal && (e.free || o.me.wanted < 3)) || carWorthIt(o))) { a.use = pulse; return a; }
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  // sidestep people early, and slow down when one is very close ahead
  const pd = o.pie.ped[0];
  if (pd < 4 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.sprint = false;
  }
  if (pd < 2.5) a.move = 0.3;
  return a;
}
