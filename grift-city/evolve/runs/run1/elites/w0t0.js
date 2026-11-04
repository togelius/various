// g77 quality 0.425 wheels 0.00 (on foot), trouble 0.00 per min (law-abiding) (2426 chars; mutate)
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
    // get out of whatever we are in
    if (Math.abs(o.car.spd) < 2.5) a.use = pulse; else a.brake = 1;
    return a;
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
  if (gl && gl.kind === 'person' && gd < 3) { a.talk = true; a.turn = c(gl.b * 2, -1, 1); return a; }
  if (o.t < m.rec) { a.move = -0.8; a.strafe = m.side; a.turn = m.side * 0.8; a.jump = pulse; return a; }
  // direction: straight across open ground when clear, otherwise the sidewalk route (blending in the next waypoint)
  const w = g ? c(1 - g.wd / 10, 0, 0.5) : 0;
  const tb = gl && gd <= 40 && R[3] > Math.min(gd, 10) ? gl.b
    : g ? g.b * (1 - w) + g.b2 * w
    : gl ? gl.b : 0;
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
