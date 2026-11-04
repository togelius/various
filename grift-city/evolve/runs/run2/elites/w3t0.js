// g200 quality 0.975 wheels 0.69 (mostly car), trouble 0.09 per min (law-abiding) (3479 chars; mutate)
// Driver and walker: drive to markers, take goal cars, shoot hostiles, climb free cars for long walks.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  if (m.n === undefined) { m.n = 0; m.bk = 0; m.rv = 0; m.ft = -9; m.side = 1; }
  const g = o.gps, goal = o.goal, e = o.enter, open = openSide(o);
  const car = o.me.mode === 'car';
  m.n++;
  const pulse = m.n % 4 === 0; // use is an edge: pulse every 0.4 s
  // no progress: 1.5 s in a car, 4 s on foot (not while fighting or talking)
  const st = stuck(o, m, car ? 15 : 40, !car && o.t - m.ft < 1);

  if (car) {
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // close to a place marker: brake to a stop, then step out
    if (goal && goal.kind !== 'car' && goal.d < 10 + sa * sa / 16) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && goal.d < 25) a.use = pulse;
      return a;
    }
    // goal car close and not the one we drive: stop and get out to take it
    if (goal && goal.kind === 'car' && !goal.mine && goal.d < 9) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    if (st) m.rv = 1.5; // stuck: reverse for 1.5 s
    const b = g ? g.b : goal ? goal.b : 0;
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = clamp(-b * 1.6, -1, 1); return a; }
    const cp = copAvoid(o); // police push the steering away; a cop close ahead slows us
    a.steer = clamp(b * 1.6 + cp.push * 1.2, -1, 1);
    // bends matter only when the next waypoint is near; otherwise grid corners crawl the whole run
    const bs = g && g.wd > 40 ? 20 : bendSpeed(g);
    driveTo(a, sa, Math.min(bs, obstacleCap(o), cp.front < 15 ? 8 : 99));
    if (cp.front < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  // on foot
  if (st) { m.bk = 1.5; m.side = open; }
  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  // debtor in talk range: hold talk
  if (inTalkRange(o)) { a.talk = true; m.ft = o.t; return a; }
  // armed: shoot the nearest hostile (18 m; only 8 m once wanted 3+)
  if (o.me.ammo > 0) {
    const t = nearestPie(o.pie.foe, o.me.wanted < 3 ? 18 : 8);
    if (t) {
      a.aim = true;
      a.turn = clamp(t.b * 2, -1, 1);
      a.fire = Math.abs(t.b) < 0.5;
      a.move = Math.abs(t.b) < 0.5 ? 0.3 : 0;
      m.ft = o.t;
      return a;
    }
  }
  // climb goal car (not if wanted 3+), or a free car that saves a long walk
  if (e && e.d < 3 && ((e.goal && (e.free || o.me.wanted < 3)) || carWorthIt(o))) { a.use = pulse; return a; }
  // marker when close, else route
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.8 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  // wall/vehicle close ahead: turn to open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  // people close: sidestep away
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.move = 0.3;
    a.sprint = false;
  }
  return a;
}
