// g134 quality 0.584 wheels 0.43 (mixed), trouble 0.04 per min (law-abiding) (2583 chars; mutate)
function think(o, m) {
  const a = {}, c = clamp, goal = o.goal, g = o.gps, e = o.enter, car = o.me.mode === 'car';
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  const pulse = m.n % 4 === 0, talk = !car && inTalkRange(o);
  const idle = talk || (car ? !!goal && goal.d < 4 : !!e && !!e.goal && e.d < 4);
  // no progress for 1.5 s while not waiting on purpose: back off toward open room
  if (stuck(o, m, 15, idle)) { m.esc = 15; m.dir = openSide(o); }
  if (m.esc > 0) {
    m.esc--;
    if (car) { a.brake = 1; a.steer = m.dir; } else { a.move = -0.6; a.turn = m.dir; }
    return a;
  }

  if (car) {
    const sa = Math.abs(o.car.spd), ca = copAvoid(o);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    // place goal: brake to a stop and step out; goal car not ours: stop beside it and climb out
    if (goal && (goal.kind === 'car' ? !goal.mine && goal.d < 9 : goal.d < 10 + sa * sa / 16)) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5) a.use = pulse;
      return a;
    }
    const b = g ? g.b : goal ? goal.b : 0;
    let bs = bendSpeed(g);
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    a.steer = c(b * 1.6 + ca.push * 1.2, -1, 1);
    driveTo(a, sa, Math.min(bs, obstacleCap(o), ca.front < 15 ? 8 : 99));
    if (ca.front < 6) { a.gas = 0; a.brake = sa > 1 ? 1 : 0; }
    return a;
  }

  // on foot
  if (talk) { a.talk = true; return a; }
  if (o.me.ammo > 0) {
    const f = nearestPie(o.pie.foe, 18);
    if (f && (o.me.wanted < 3 || f.d < 8)) {
      a.aim = true;
      a.turn = c(f.b * 2, -1, 1);
      a.fire = Math.abs(f.b) < 0.5;
      a.move = a.fire ? 0.3 : 0;
      return a;
    }
  }
  // climb into a goal car (if free or we are not wanted), or a free car that saves a long walk
  if (e && e.d < 3 && (e.goal ? e.free || o.me.wanted < 3 : carWorthIt(o))) { a.use = pulse; return a; }
  const tb = goal && (goal.d < 12 || !g) ? goal.b : g ? g.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  walkAt(a, tb);
  a.sprint = Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8 && o.pie.ped[0] > 10;
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = openSide(o); a.move = 0.3; a.sprint = false; }
  const p = o.pie.ped;
  if (p[0] < 2.5 || p[1] < 2 || p[7] < 2) { a.strafe = p[1] < p[7] ? -0.8 : 0.8; a.move = 0.3; a.sprint = false; }
  return a;
}
