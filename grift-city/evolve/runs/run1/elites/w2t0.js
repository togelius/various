// g91 quality 0.580 wheels 0.32 (mixed), trouble 0.05 per min (law-abiding) (3159 chars; mutate)
// sidewalker: walk and sprint everywhere, cut straight across open ground, never take a car unless the job needs that car.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const g = o.gps, gl = o.goal, R = o.rays, me = o.me, car = o.car;
  const n = Math.floor(o.t), pulse = o.t % 1 < 0.1;
  const gd = gl ? gl.d : 999;
  // stall check every 2 s; back out briefly if stuck
  if (m.sx === undefined || o.t - m.st >= 2) {
    const mv = m.sx === undefined ? 9 : Math.hypot(me.x - m.sx, me.z - m.sz);
    m.stuck = mv < 1 && gd > 8 ? (m.stuck || 0) + 1 : 0;
    if (m.stuck > 1) { m.rec = o.t + 2; m.stuck = 0; }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'entering') return a;
  if (me.mode === 'car') {
    if (car.burning || car.hp < 0.25) { a.brake = car.spd > 1 ? 1 : 0; a.use = pulse; return a; }
    // near a place marker: stop, climb out, walk in
    if (gl && gl.kind !== 'car' && gd < 25) { a.brake = car.spd > 2 ? 1 : 0; a.use = car.spd < 1 && pulse; return a; }
    if (!g) { a.gas = 0.3; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    if (o.t < (m.rec || 0)) { a.brake = 1; a.steer = n % 2 ? 1 : -1; return a; }
    const bend = Math.max(Math.abs(g.b2), Math.abs(g.b3) * 0.7, Math.abs(g.b));
    let want = bend > 0.8 ? 6 : bend > 0.4 ? 10 : 15;
    if (R[3] < 10) want = Math.min(want, 6);
    a.steer = c(g.b * 1.6 + (R[2] < 5 ? 0.3 : 0) - (R[4] < 5 ? 0.3 : 0), -1, 1);
    let hot = false;
    for (const k of o.peds) if (k.f > 0 && k.f < 10 && Math.abs(k.r) < 2) hot = true;
    a.gas = car.spd < want && !hot ? 1 : 0;
    a.brake = hot && car.spd > 1 ? 1 : 0;
    return a;
  }
  // on foot
  // pedestrian: walk everywhere, climb in only for a job car
  const e = o.enter;
  if (e && e.free && e.d < 3.5 && e.goal) { a.use = pulse; return a; }
  let tb = g ? g.b : gl ? gl.b : 0.3;
  if (g && g.wd < 5) tb = g.b * (0.4 + 0.12 * g.wd) + g.b2 * (0.6 - 0.12 * g.wd);
  // straight-line shortcut across open ground
  if (gl && R[3] > 10 && R[2] > 6 && R[4] > 6) tb = gl.b;
  // no car detours: the sidewalk route and the shortcut are enough
  if (gl && gl.kind === 'person' && gd < 3) tb = gl.b;
  let av = 0, threat = false;
  for (const k of o.peds) {
    if (k.d > 8 || k.f < -1) continue;
    const bad = k.hostile || k.kind !== 'civ';
    av -= (k.r >= 0 ? 1 : -1) * (bad ? 2 : 1) * (8 - k.d) / 8;
    if (bad && k.d < 8) threat = true;
  }
  // at the debtor: hold talk, facing him
  if (gl && gl.kind === 'person' && gd < 3 && !threat) { a.turn = c(tb * 2, -1, 1); a.talk = true; return a; }
  let t = tb * 2.2 + av * 0.6;
  if (R[3] < 3) t += (R[4] > R[2] ? 1 : -1) * 0.8;
  if (R[2] < 1.5) t += 0.5;
  if (R[4] < 1.5) t -= 0.5;
  a.turn = c(t, -1, 1);
  a.move = threat ? 1 : Math.abs(tb) > 1.2 ? 0.2 : R[3] < 1.2 ? 0.4 : 1;
  a.sprint = threat || (Math.abs(tb) < 0.5 && (!g || Math.abs(g.b2) < 0.7) && R[3] > 6 && Math.abs(av) < 0.5);
  if (o.t < (m.rec || 0)) { a.move = -0.8; a.sprint = false; a.strafe = n % 2 ? 1 : -1; a.jump = pulse; }
  return a;
}
