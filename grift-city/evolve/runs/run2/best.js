// g57 quality 0.952 wheels 0.81 (car), trouble 0.09 per min (law-abiding)
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, goal = o.goal, e = o.enter;
  const open = openSide(o);
  if (m.t0 === undefined) { m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0; m.cs = 0; m.rv = 0; m.n = 0; m.ft = -9; }
  m.n++;
  const pulse = m.n % 4 === 0;

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sp = o.car.spd, sa = Math.abs(sp);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    if (goal && goal.kind !== 'car' && goal.d < 10 + sa * sa / 16) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && goal.d < 25) a.use = pulse;
      return a;
    }
    // goal car close and not the one we drive: stop and get out to take it
    if (goal && goal.kind === 'car' && !goal.mine && goal.d < 9) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    const b = g ? g.b : goal ? goal.b : 0;
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
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

  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  if (o.t - m.t0 >= 4) {
    if (Math.hypot(o.me.x - m.px, o.me.z - m.pz) < 1 && o.t - m.ft > 1) { m.bk = 1.5; m.side = open; }
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z;
  }
  // debtor: hold talk when next to him (person goal, or his car)
  if (goal && goal.d < 2.5 && goal.kind === 'person') { a.talk = true; m.ft = o.t; return a; }
  if (goal && goal.kind === 'car' && !goal.free && goal.d < 4 && !(e && e.goal && e.d < 3)) {
    a.talk = true; m.ft = o.t; return a;
  }
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
  // enter the goal car (even occupied), or a free car that saves a long walk
  if (e && e.d < 3) {
    if (e.goal && (e.free || o.me.wanted < 3)) { a.use = pulse; return a; }
    if (e.free && o.me.wanted < 3 && g && g.d > 60 && !(goal && goal.kind === 'car')) { a.use = pulse; return a; }
  }
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.move = 0.3;
    a.sprint = false;
  }
  return a;
}
