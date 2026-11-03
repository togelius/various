// g19 quality 0.391 wheels 0.31 (mixed), trouble 0.22 per min (a slip) (3803 chars; mutate)
// walker-driver: skip dialogue; walk the route, sprinting when clear and dodging people and walls;
// reverse out of stalls; drive only if already in a car, and stop at the marker.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  const g = o.gps, gl = o.goal, R = o.rays, n = Math.floor(o.t), pulse = o.t % 1 < 0.1;
  const gd = gl ? gl.d : 999;
  // stall check every 2 s; on a stall, back out for 2 s
  if (m.sx === undefined || o.t - m.st >= 2) {
    const mv = m.sx === undefined ? 9 : Math.hypot(o.me.x - m.sx, o.me.z - m.sz);
    m.stuck = mv < (o.me.mode === 'car' ? 1.5 : 1) && gd > 8 ? (m.stuck || 0) + 1 : 0;
    if (m.stuck > 1) { m.rec = o.t + 2; m.stuck = 0; }
    m.sx = o.me.x; m.sz = o.me.z; m.st = o.t;
  }
  const rec = o.t < (m.rec || 0);

  if (o.me.mode === 'car') {
    const car = o.car;
    // burning or wrecked: get out now
    if (car.burning || car.hp < 0.25) { a.brake = car.spd > 1 ? 1 : 0; a.use = pulse; return a; }
    // near a place or person goal: slow to a stop, climb out, walk in
    const exit = gl && gl.kind !== 'car' && gd < 40;
    if (exit && gd < 6 && car.spd < 2) { a.use = pulse; return a; }
    if (!g) { a.gas = 0.3; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    if (rec) { a.brake = 1; a.steer = n % 2 ? 1 : -1; return a; }
    let s = g.b * 1.6;
    if (R[3] < 8) s += (R[4] > R[2] ? 1 : -1) * 0.5 * (1 - R[3] / 8);
    if (R[1] < 3) s += 0.4;
    if (R[5] < 3) s -= 0.4;
    for (const k of o.cars) if (k.kind === 'cop' && k.f > 0 && k.f < 18 && Math.abs(k.r) < 3.5) s += k.r > 0 ? -0.6 : 0.6;
    a.steer = c(s, -1, 1);
    const turn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.8);
    let want = turn > 0.6 ? 6 : 12, hot = false;
    if (R[3] < 7) want = Math.min(want, 3);
    if (exit) want = Math.min(want, 1 + gd / 4);
    for (const k of o.peds) if (k.f > 0 && k.f < 16 && Math.abs(k.r) < 3) { want = Math.min(want, 2); if (k.f < 8) hot = true; }
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') { want = Math.min(want, 3); if (k.f < 7) hot = true; }
    if (o.me.wanted > 0 && !hot && !exit) want = Math.max(want, 9);
    a.gas = car.spd < want && !hot ? 1 : 0;
    a.brake = hot && car.spd > 1 ? 1 : car.spd > want + 2 ? 0.6 : 0;
    return a;
  }

  // on foot: follow the route (or the goal bearing), steer around people and walls
  const tb = g ? g.b : gl ? gl.b : 0.3;
  let av = 0, threat = false, slow = false;
  for (const k of o.peds) {
    const cop = k.kind === 'cop', rg = cop ? 16 : 10;
    if (k.d > rg || (k.f < -1 && !cop)) continue;
    const bad = k.hostile || k.kind !== 'civ';
    av -= (k.r >= 0 ? 1 : -1) * (cop ? 3 : bad ? 2 : 1) * (rg - k.d) / 10;
    if (bad && k.d < (cop ? 14 : 9)) threat = true;
    if (k.f > 0 && k.f < 4 && Math.abs(k.r) < 1.5) slow = true;
  }
  // at the debtor: hold talk, facing him
  if (gl && gl.kind === 'person' && gd < 3 && !threat) { a.turn = c(gl.b * 2, -1, 1); a.talk = true; return a; }
  let t = tb * 2.2 + av * 0.6;
  if (R[3] < 3) t += (R[4] > R[2] ? 1 : -1) * 0.8;
  if (R[2] < 1.5) t += 0.5;
  if (R[4] < 1.5) t -= 0.5;
  a.turn = c(t, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : R[3] < 1.2 || slow ? 0.4 : 1;
  if (threat) a.move = 1;
  if (o.me.wanted > 0 && R[3] > 2) a.move = Math.abs(tb) > 1.2 ? 0.3 : 1;
  const bend = g ? Math.max(Math.abs(g.b2), Math.abs(g.b3) * 0.6) : 0;
  a.sprint = threat || (o.me.wanted > 0 && Math.abs(tb) < 0.9 && R[3] > 2) || (Math.abs(tb) < 0.4 && bend < 0.7 && R[3] > 4 && !slow);
  if (rec) { a.move = -0.8; a.sprint = false; a.strafe = n % 2 ? 1 : -1; a.jump = pulse; }
  return a;
}
