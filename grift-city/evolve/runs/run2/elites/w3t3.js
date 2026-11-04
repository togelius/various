// g96 quality 0.759 wheels 0.72 (mostly car), trouble 1.84 per min (troublemaker) (3732 chars; crossover)
// Combined walker + driver. Walks the route (sprinting when clear), climbs into a free car for car goals or long
// walks, drives at a bend/obstacle/cop-aware speed (hurrying when a timer runs), escapes when stuck, steps out of a
// burning car, parks at start markers, talks down debtors, and shoots only foes within 6 m.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0; // use is an edge: pulse every 0.4 s
  const g = o.gps, goal = o.goal, e = o.enter, tm = o.mission.timer;
  const car = o.me.mode === 'car';
  const sa = Math.abs(car ? o.car.spd : 0);
  const f = car ? null : nearestPie(o.pie.foe, 6);
  const fighting = !!(f && o.me.weapon && o.me.ammo > 0);
  const talking = !car && inTalkRange(o);
  const parked = car && goal && goal.kind === 'place' && goal.d < 12 && sa < 3;
  const idle = talking || fighting || parked || (goal && goal.d < 3);
  // stuck: back off in a random direction, then drive forward again
  if (stuck(o, m, 15, idle)) { m.esc = 15; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = m.dir; }
    else { a.move = m.esc > 7 ? -1 : 1; a.turn = m.dir; a.strafe = m.dir; }
    return a;
  }
  if (car) {
    // burning or wrecked: stop, then step out
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // start marker (no job running): brake to a stop, then step out
    if (goal && goal.kind === 'place' && !o.mission.name && goal.d < 10 + sa * sa / 16) {
      a.steer = clamp(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && goal.d < 25) a.use = pulse;
      return a;
    }
    const ca = copAvoid(o), cf = ca.front;
    if (!g && !goal) { a.gas = 0.3; a.steer = clamp(ca.push, -1, 1); return a; }
    const b = g ? g.b : goal.b;
    const rd = g ? g.d : goal.d;
    // bend speed, raised when a job timer needs the distance covered faster
    let bend = bendSpeed(g);
    if (tm > 0 && bend >= 9) bend = Math.max(bend, Math.min(rd / tm * 1.2, 30));
    const want = Math.min(bend, obstacleCap(o), cf < 15 ? 8 : 99);
    const lane = o.road.on ? clamp(-o.road.off * 0.1, -0.25, 0.25) : 0;
    a.steer = clamp(b * 1.6 + ca.push * 1.2 + lane, -1, 1);
    if (sa < want) a.gas = 0.8;
    else a.brake = sa > want + 3 ? 0.6 : 0;
    if (cf < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }
  // on foot
  if (talking) { a.talk = true; return a; }
  // climb into a free car next to us for a car goal or a long walk (never carjack)
  if (e && e.free && e.d < 4 && carWorthIt(o)) { a.use = pulse; return a; }
  // self-defence: face and shoot a foe that is close
  if (fighting) {
    a.turn = clamp(f.b * 2.2, -1, 1);
    a.aim = true;
    a.fire = Math.abs(f.b) < 0.3;
    return a;
  }
  // straight at the marker when close, otherwise along the route
  const tb = goal && goal.d < 12 ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10 && o.me.wanted < 2;
  // walls, props and vehicles close ahead: turn to the open side
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  // people close: sidestep away from the nearer side
  if (o.pie.ped[0] < 2.5 || o.pie.ped[1] < 2 || o.pie.ped[7] < 2) {
    a.strafe = o.pie.ped[1] < o.pie.ped[7] ? -0.8 : 0.8;
    a.move = 0.3;
    a.sprint = false;
  }
  return a;
}
