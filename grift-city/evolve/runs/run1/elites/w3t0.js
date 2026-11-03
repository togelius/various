// g14 quality 0.560 wheels 0.66 (mostly car), trouble 0.00 per min (law-abiding) (3740 chars; mutate)
// careful walker: follow the route on foot, sidestep people and walls, run from hostiles and cops, never hit anyone, bail out of burning or wrecked cars, talk to the goal person. Drives only when already in a car, then stops and walks in near the marker.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const g = o.gps, R = o.rays, gl = o.goal, me = o.me, car = o.car;
  const pulse = o.t % 1 < 0.1, n = Math.floor(o.t);
  const gd = gl ? gl.d : 999;
  // stall check every 2 s; on a stall, back out for 2 s
  if (m.sx === undefined || o.t - m.st >= 2) {
    const mv = m.sx === undefined ? 9 : Math.hypot(me.x - m.sx, me.z - m.sz);
    m.stuck = mv < (me.mode === 'car' ? 1.5 : 1) && gd > 8 ? (m.stuck || 0) + 1 : 0;
    if (m.stuck > 1) { m.rec = o.t + 2; m.stuck = 0; }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'entering') return a;
  if (me.mode === 'car') {
    // burning or wrecked: get out now
    if (car.burning || car.hp < 0.25) { a.brake = car.spd > 1 ? 1 : 0; a.use = pulse; return a; }
    // close to a place marker: slow down, stop, climb out, walk in
    const exit = gl && gl.kind !== 'car' && gd < 60;
    if (exit && (car.spd < 2.5 || !g)) { a.brake = car.spd > 1 ? 1 : 0; a.use = pulse; return a; }
    if (!g) { a.gas = 0.3; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    if (o.t < (m.rec || 0)) { a.brake = 1; a.steer = n % 2 ? 1 : -1; return a; }
    let s = g.b * 1.6;
    if (R[3] < 8) s += (R[4] > R[2] ? 1 : -1) * 0.5 * (1 - R[3] / 8);
    if (R[1] < 3) s += 0.4;
    if (R[5] < 3) s -= 0.4;
    a.steer = c(s, -1, 1);
    const turn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.8);
    let want = turn > 0.6 ? 6 : 12, hot = false;
    if (R[3] < 7) want = Math.min(want, 3);
    if (exit) want = Math.min(want, 5);
    for (const k of o.peds) if (k.f > 0 && k.f < 16 && Math.abs(k.r) < 3) { want = Math.min(want, 2); if (k.f < 8) hot = true; }
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') { want = Math.min(want, 3); if (k.f < 7) hot = true; }
    a.gas = car.spd < want && !hot ? 1 : 0;
    a.brake = hot && car.spd > 1 ? 1 : car.spd > want + 2 ? 0.6 : 0;
    return a;
  }
  // on foot
  const e = o.enter, far = gd > 120;
  if (e && e.free && e.d < 3.5 && far) { a.use = pulse; return a; }
  let tb = g ? g.b : gl ? gl.b : 0.3, tcar = null;
  if (far) {
    for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 8 && (!tcar || k.d < tcar.d)) tcar = k;
    if (tcar) tb = tcar.b;
  }
  if (gl && gl.kind === 'person' && gd < 3) tb = gl.b;
  let av = 0, threat = false, slow = false;
  for (const k of o.peds) {
    if (k.d > 10 || k.f < -1) continue;
    const bad = k.hostile || k.kind !== 'civ';
    av -= (k.r >= 0 ? 1 : -1) * (bad ? 2 : 1) * (10 - k.d) / 10;
    if (bad && k.d < 9) threat = true;
    if (k.f > 0 && k.f < 4 && Math.abs(k.r) < 1.5) slow = true;
  }
  // at the debtor: hold talk, facing him
  if (gl && gl.kind === 'person' && gd < 3 && !threat) { a.turn = c(tb * 2, -1, 1); a.talk = true; return a; }
  let t = tb * 2.2 + av * 0.6;
  if (R[3] < 3) t += (R[4] > R[2] ? 1 : -1) * 0.8;
  if (R[2] < 1.5) t += 0.5;
  if (R[4] < 1.5) t -= 0.5;
  a.turn = c(t, -1, 1);
  a.move = Math.abs(tb) > 1.2 ? 0.1 : R[3] < 1.2 || slow ? 0.4 : 1;
  if (threat) a.move = 1;
  const bend = g && !tcar ? Math.max(Math.abs(g.b2), Math.abs(g.b3) * 0.6) : 0;
  a.sprint = threat || (Math.abs(tb) < 0.4 && bend < 0.7 && R[3] > 4 && !slow);
  if (o.t < (m.rec || 0)) { a.move = -0.8; a.sprint = false; a.strafe = n % 2 ? 1 : -1; a.jump = pulse; }
  return a;
}
