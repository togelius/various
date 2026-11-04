// g88 quality 0.620 wheels 0.96 (only car), trouble 0.24 per min (a slip) (3970 chars; mutate)
// pedestrian-sprinter: never drives. Walks or sprints straight at the goal, cutting across open ground,
// sidestepping people and cars, backing off when stuck. Stalls on van/car jobs (no vehicles used).
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const me = o.me, gl = o.goal, g = o.gps, R = o.rays;
  if (me.mode === 'entering' || !me.alive) return a;
  const pulse = o.t % 1 < 0.1;
  if (me.mode === 'car') {
    if (!o.car) return a;
  }
  const gd = gl ? gl.d : 999;
  // stuck check every 2 s
  if (m.sx === undefined) { m.sx = me.x; m.sz = me.z; m.st = o.t; m.stuck = 0; m.rec = 0; m.side = 1; }
  if (o.t - m.st >= 2) {
    const mv = Math.hypot(me.x - m.sx, me.z - m.sz);
    m.stuck = mv < 1.2 && gd > 4 ? m.stuck + 1 : 0;
    if (m.stuck >= 1) { m.rec = o.t + 1.2; m.side = -m.side; }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'car') {
    const car = o.car, txt = o.mission.text || '';
    const out = car.burning || car.hp < 0.2 || (gl && gl.kind !== 'car' && gd < 14 && (gl.kind === 'person' || !o.mission.name || /talk|goon|inside|collect|get out/i.test(txt)));
    if (out) { a.brake = car.spd > 1.5 ? 1 : 0; a.use = car.spd < 2 && pulse; return a; }
    if (!g) { a.gas = 0.4; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    if (o.t < m.rec) { a.brake = 1; a.steer = m.side; return a; }
    let s = g.b * 1.6;
    if (R[3] < 10) s += (R[4] > R[2] ? 1 : -1) * 0.6 * (1 - R[3] / 10);
    const tn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.9);
    let want = tn > 0.9 ? 5 : tn > 0.5 ? 9 : 16, hot = false;
    want = Math.min(want, 2 + R[3]);
    if (gd < 25) want = Math.min(want, 4 + gd / 2);
    for (const k of o.cars) {
      if (k.f > 0 && k.f < 16 && Math.abs(k.r) < 2.6) {
        s += (k.r > 0 ? -1 : 1) * 0.35;
        if (k.kind !== 'parked') { want = Math.min(want, Math.max(2, k.spd * 0.9)); if (k.f < 7) hot = true; }
      }
    }
    for (const k of o.peds) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.5) { want = Math.min(want, 3); if (k.f < 7) hot = true; }
    a.steer = c(s, -1, 1);
    a.gas = car.spd < want && !hot ? 1 : 0;
    a.brake = hot && car.spd > 1 ? 1 : 0;
    return a;
  }
  const en = o.enter;
  if (en && en.free && en.d < 3 && (gd > 50 || en.goal)) { a.use = pulse; return a; }
  if (gl && gl.kind === 'person' && gd < 3) { a.talk = true; a.turn = c(gl.b * 2, -1, 1); return a; }
  if (o.t < m.rec) { a.move = -0.8; a.strafe = m.side; a.turn = m.side * 0.8; a.jump = pulse; return a; }
  // direction: straight across open ground when clear, otherwise the sidewalk route (blending in the next waypoint)
  const w = g ? c(1 - g.wd / 10, 0, 0.5) : 0;
  let tb = gl && gd <= 40 && R[3] > Math.min(gd, 10) ? gl.b
    : g ? g.b * (1 - w) + g.b2 * w
    : gl ? gl.b : 0;
  let tc = null;
  for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 35 && (!tc || k.d < tc.d)) tc = k;
  if (gl && gl.kind === 'car' && gl.free && gd < 60) tb = gl.b;
  else if (tc && gd > 50) tb = tc.b;
  // avoid people (hostile ones at a wider berth) and vehicles
  let av = 0, close = false;
  for (const k of o.peds) {
    if (k.f < -1 || k.d > 9) continue;
    if (gl && gl.kind === 'person' && Math.abs(k.d - gd) < 1.5) continue;
    const L = k.hostile ? 9 : 6;
    if (k.d < L && Math.abs(k.r) < 2.5) av -= (k.r >= 0 ? 1 : -1) * (L - k.d) / 4;
    if (k.d < 2.5) close = true;
  }
  for (const k of o.cars) {
    if (k.f < -2 || k.f > 9 || Math.abs(k.r) > 3) continue;
    av -= (k.r >= 0 ? 1 : -1) * 1.5;
    if (k.f < 4) close = true;
  }
  let t = tb * 2.2 + av * 0.6;
  if (R[3] < 3) t += (R[4] > R[2] ? 1 : -1) * 0.8;
  if (R[2] < 1.5) t += 0.5;
  if (R[4] < 1.5) t -= 0.5;
  a.turn = c(t, -1, 1);
  a.move = close ? 0.3 : Math.abs(tb) > 1.2 ? 0.2 : R[3] < 1.2 ? 0.4 : 1;
  a.sprint = a.move === 1 && Math.abs(av) < 1;
  return a;
}
