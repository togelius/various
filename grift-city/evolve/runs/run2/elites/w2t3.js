// g118 quality 0.843 wheels 0.26 (mixed), trouble 1.99 per min (troublemaker) (3756 chars; mutate)
function think(o, m) {
  const a = {}, c = clamp;
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, goal = o.goal, e = o.enter, open = openSide(o);
  if (m.t0 === undefined) { m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0; m.cs = 0; m.rv = 0; m.n = 0; m.ft = -9; }
  m.n++;
  const pulse = m.n % 4 === 0;
  const b = g ? g.b : goal ? goal.b : 0;
  const cop = nearestPie(o.pie.cop, 14);

  if (o.me.mode === 'car') {
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z; m.bk = 0;
    const sa = Math.abs(o.car.spd);
    if (o.car.burning || o.car.hp < 0.15) return parkOut(a, o, pulse);
    const atPlace = goal && goal.kind !== 'car' && (goal.d < 10 + sa * sa / 16 || (goal.d < 120 && sa < 12));
    const carGoal = goal && goal.kind === 'car' && !goal.mine && goal.d < 9;
    if (atPlace || carGoal) {
      a.steer = c(goal.b * 1.6, -1, 1);
      a.brake = sa > 1.5 ? 1 : 0;
      if (sa <= 1.5 && (carGoal || goal.d < 125)) a.use = pulse;
      return a;
    }
    if (sa < 0.4) m.cs += 0.1; else m.cs = 0;
    if (m.cs > 1.5) { m.rv = 1.5; m.cs = 0; }
    if (m.rv > 0) { m.rv -= 0.1; a.brake = 1; a.steer = c(-b * 1.6, -1, 1); return a; }
    // drift: short handbrake flick on a clear bend at speed (style cash); never during a timed job
    if (m.dr > 0) { m.dr -= 0.1; a.hand = m.dr > 0.6; a.gas = 0.9; a.steer = c(m.ds * 1.4, -1, 1); return a; }
    m.dc = (m.dc || 0) - 0.1;
    if (sa > 14 && m.dc <= 0 && !(o.mission.timer > 0) && Math.abs(b) > 0.2 && Math.abs(b) < 0.7 && o.range[0] > 25 && (!cop || cop.d > 20)) { m.dr = 1; m.ds = b > 0 ? 1 : -1; m.dc = 6; }
    const ca = copAvoid(o);
    a.steer = c(b * 1.6 + ca.push * 0.6, -1, 1);
    let bs = bendSpeed(g);
    if (bs === 16 && o.rays[3] > 18 && o.range[0] > 28) bs = 20;
    if (o.me.wanted > 0 && ca.front < 25) bs = Math.max(bs, 18);
    return driveTo(a, sa, Math.min(bs, obstacleCap(o)));
  }

  // on foot
  if (m.bk > 0) { m.bk -= 0.1; a.move = -0.6; a.turn = m.side; return a; }
  if (o.t - m.t0 >= 4) {
    if (Math.hypot(o.me.x - m.px, o.me.z - m.pz) < 1 && o.t - m.ft > 1) { m.bk = 1.5; m.side = open; }
    m.t0 = o.t; m.px = o.me.x; m.pz = o.me.z;
  }
  const copClose = cop && cop.d < 10;
  if (!copClose) {
    if (goal && goal.d < 2.5 && goal.kind === 'person') { a.talk = true; m.ft = o.t; return a; }
    if (goal && goal.kind === 'car' && !goal.free && goal.d < 4 && !(e && e.goal && e.d < 3)) { a.talk = true; m.ft = o.t; return a; }
    // con a stranger directly ahead (cheap cash) when not wanted and no job marker is close; 4 s hold, 15 s cooldown
    if (!m.ck && o.pie.ped[0] < 2 && o.me.wanted === 0 && !(goal && goal.d < 15) && o.t > (m.cn || 0)) { m.ck = o.t + 4; m.cn = o.t + 15; }
    if (m.ck && o.t < m.ck) { a.talk = true; m.ft = o.t; return a; }
    m.ck = 0;
  }
  if (o.me.ammo > 0 && !cop) {
    const t = nearestPie(o.pie.foe, 25);
    if (t) { a.aim = true; a.turn = c(t.b * 2, -1, 1); a.fire = Math.abs(t.b) < 0.5; m.ft = o.t; return a; }
  }
  if (e && e.d < 3 && (e.goal || (g && g.d > 300) || (!e.free && g && g.d > 120 && o.me.wanted < 3))) { a.use = pulse; return a; }
  let tb = goal && goal.d < 12 && !cop ? goal.b : g ? g.b : goal ? goal.b : null;
  if (tb === null) { a.move = 0.6; a.turn = Math.sin(o.t * 0.7) * 0.8; return a; }
  if (cop) {
    const k = (14 - cop.d) / 14 * 1.5;
    tb = Math.atan2(Math.sin(tb) - k * Math.sin(cop.b), Math.cos(tb) - k * Math.cos(cop.b));
  }
  walkAt(a, tb);
  a.sprint = !!cop || (Math.abs(tb) < 0.5 && o.rays[3] > 8 && o.range[0] > 8);
  if (o.rays[3] < 2.5 || o.range[0] < 3) { a.turn = open; a.move = 0.3; a.sprint = false; }
  return a;
}
