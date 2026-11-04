// g80 quality 0.815 wheels 0.57 (mostly car), trouble 1.53 per min (troublemaker) (3597 chars; mutate)
// crime spree: walks the route, carjacks or climbs into cars on long walks, drives fast through traffic and
// people, ignores police, shoots foes and cops in reach, talks to debtors; backs off when stuck.
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, goal = o.goal, e = o.enter, open = openSide(o);
  if (m.t0 === undefined) { m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0; m.cs = 0; m.rv = 0; m.n = 0; m.ft = -9; }
  m.n++;
  const pulse = m.n % 4 === 0; // use is an edge: pulse every 0.4 s
  const b = g ? g.b : goal ? goal.b : 0;

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // at a place marker, or next to a car goal we do not drive: stop, then step out
    const atPlace = goal && goal.kind !== 'car' && (goal.d < 10 + sa * sa / 16 || (goal.d < 120 && sa < 12));
    const carGoal = goal && goal.kind === 'car' && !goal.mine && goal.d < 9;
    if (atPlace || carGoal) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && (carGoal || goal.d < 125)) a.use = pulse;
      return a;
    }
    // stuck: reverse and turn for 1.5 s
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    a.steer = c(b * 1.6, -1, 1);
    let bs = bendSpeed(g);
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    const ahead = Math.min(o.range[0], o.pie.car[0]);
    const cap = ahead < 8 ? 3 : ahead < 30 ? 4 + ahead * 0.35 : 99;
    return driveTo(a, sa, Math.min(bs, cap));
  }

  // on foot
  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  // stall breaker: under 1 m of progress in 4 s -> back off and turn for 1.5 s (not right after a fight or talk)
  if (o.t - m.t0 >= 4) {
    if (Math.hypot(o.me.x - m.px, o.me.z - m.pz) < 1 && o.t - m.ft > 1) { m.bk = 1.5; m.side = open; }
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z;
  }
  // debtor: hold talk next to him, or next to his occupied car
  if (goal && goal.d < 2.5 && goal.kind === 'person') { a.talk = true; m.ft = o.t; return a; }
  if (goal && goal.kind === 'car' && !goal.free && goal.d < 4 && !(e && e.goal && e.d < 3)) { a.talk = true; m.ft = o.t; return a; }
  // shoot foes within 25 m, or cops within 15 m, stopping to aim
  if (o.me.ammo > 0) {
    const t = nearestPie(o.pie.foe, 25) || nearestPie(o.pie.cop, 15);
    if (t) { a.aim = true; a.turn = c(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; m.ft = o.t; return a; }
  }
  // carjack the goal car, take a car on a long walk, or jack an occupied car ahead when the walk is still medium
  if (e && e.d < 3 && (e.goal || (g && g.d > 350) || (!e.free && g && g.d > 120 && o.me.wanted < 4))) { a.use = pulse; return a; }
  // straight at the marker when close, otherwise along the route
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8;
  // walls, props and vehicles close ahead: turn to the open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  return a;
}
