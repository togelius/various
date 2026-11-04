// g168 quality 0.674 wheels 0.48 (mixed), trouble 1.02 per min (scuffles) (3925 chars; mutate)
// driver + walker: walks the route, climbs into a free car when it is the car goal or saves a long walk,
// drives at the speed the bends and traffic allow (a little faster while a mission timer runs), talks down
// debtors for 8 s before trying to jack, backs off when stalled, and shoots only close hostiles.
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  if (m.n === undefined) { m.n = 0; m.bk = 0; m.rv = 0; m.cs = 0; m.tk = 0; m.side = 1; m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.ft = -9; }
  m.n++;
  const pulse = m.n % 4 === 0; // use is an edge: pulse every 0.4 s
  const g = o.gps, goal = o.goal, e = o.enter;
  const b = g ? g.b : goal ? goal.b : 0;
  const open = openSide(o);

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // at a place marker: brake to a stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 10 + sa * sa / 16) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && goal.d < 25) a.use = pulse;
      return a;
    }
    // stuck (under 0.4 m/s for 1.5 s): reverse for 1.5 s
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    // steer away from police; a cop right in front stops us
    const ca = copAvoid(o);
    a.steer = c(b * 1.6 + ca.push * 0.6, -1, 1);
    let want = Math.min(bendSpeed(g) * (o.mission.timer > 0 ? 1.25 : 1), obstacleCap(o));
    if (ca.front < 6) want = 0;
    return driveTo(a, sa, want);
  }

  // on foot
  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  // stall breaker: under 1 m of progress in 4 s (not talking or fighting) -> back off
  if (o.t - m.t0 >= 4) {
    if (Math.hypot(o.me.x - m.px, o.me.z - m.pz) < 1 && o.t - m.ft > 1) { m.bk = 1.5; m.side = open; }
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z;
  }
  // debtor or occupied goal car in reach: talk for 8 s, then rest 4 s, jacking the car during the rest
  const talkNow = goal && ((goal.kind === 'person' && goal.d < 2.5) || (goal.kind === 'car' && !goal.free && goal.d < 3));
  if (talkNow) {
    m.tk = (m.tk + 0.1) % 12; m.ft = o.t;
    if (m.tk < 8) { a.talk = true; return a; }
    if (e && e.goal && e.d < 3 && o.me.wanted < 3) a.use = pulse;
    return a;
  }
  m.tk = 0;
  // climb in: a free goal car, or a free car that saves a long walk
  if (e && e.d < 3 && e.free && (e.goal || (g && g.d > 60))) { a.use = pulse; return a; }
  // hostiles close by: shoot back (close ones only, and not while the police are on us)
  if (o.me.ammo > 0 && o.me.wanted < 3) {
    const t = nearestPie(o.pie.foe, 6);
    if (t) { a.aim = true; a.turn = c(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; m.ft = o.t; return a; }
  }
  // straight at the marker when close (or a car goal within 40 m), otherwise along the route
  const tb = goal && (goal.d < 12 || (goal.kind === 'car' && goal.d < 40)) ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10 && !(goal && goal.d < 6);
  // walls or vehicles close ahead: turn to the open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  // people close: sidestep away from the nearer side
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.move = 0.3;
    a.sprint = false;
  }
  return a;
}
