// g108 quality 0.580 wheels 0.96 (only car), trouble 1.51 per min (troublemaker) (3916 chars; mutate)
// car-first grifter: takes the nearest free car, drives every objective, brakes for people and traffic.
// Walks only to reach a car, to talk to a person goal, or to go in on foot at a place.
function think(o, m) {
  const a = {}, c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const me = o.me, gl = o.goal, g = o.gps, R = o.rays;
  if (me.mode === 'entering' || !me.alive) return a;
  const pulse = o.t % 1 < 0.1, gd = gl ? gl.d : 999, txt = o.mission.text || '';
  // stuck check every 2 s: back off briefly
  if (m.sx === undefined) { m.sx = me.x; m.sz = me.z; m.st = o.t; m.stuck = 0; m.rec = 0; m.side = 1; }
  if (o.t - m.st >= 2) {
    const mv = Math.hypot(me.x - m.sx, me.z - m.sz);
    m.stuck = mv < 1.2 && gd > 4 ? m.stuck + 1 : 0;
    if (m.stuck >= 1) { m.rec = o.t + 1.5; m.side = -m.side; }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'car') {
    const car = o.car;
    if (!car) return a;
    // get out at a person goal, or at a place goal that needs a foot visit
    const onFoot = gl && gl.kind !== 'car' && gd < 12 && (gl.kind === 'person' || !o.mission.name || /walk|foot|enter|talk|goon|inside|collect|get out|go in/i.test(txt));
    if (car.burning || car.hp < 0.2 || onFoot) { a.brake = car.spd > 2 ? 1 : 0; a.use = car.spd < 2 && pulse; return a; }
    if (!g) { a.steer = c((gl ? gl.b : 0) * 1.6, -1, 1); a.gas = 0.4; return a; }
    if (o.t < m.rec) { a.brake = 1; a.steer = m.side; return a; }
    let s = g.b * 1.6;
    if (R[3] < 10) s += (R[4] > R[2] ? 1 : -1) * 0.6 * (1 - R[3] / 10);
    const tn = Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.9);
    let want = tn > 0.9 ? 6 : tn > 0.5 ? 11 : 22, block = false;
    want = Math.min(want, 3 + R[3] * 1.5);
    if (gd < 30) want = Math.min(want, 3 + gd / 2);
    for (const k of o.cars) if (k.f > 0 && k.f < 22 && Math.abs(k.r) < 2.6) {
      s += (k.r > 0 ? -1 : 1) * 0.35;
      if (k.kind !== 'parked') { want = Math.min(want, Math.max(2, k.spd * 0.9 + (k.f - 8) * 0.3)); if (k.f < 9) block = true; }
    }
    for (const k of o.peds) if (k.f > -1 && k.f < 16 && Math.abs(k.r) < 3) { want = Math.min(want, k.f < 8 ? 0.5 : 4); if (k.f < 9) block = true; }
    a.steer = c(s, -1, 1);
    a.gas = car.spd < want && !block ? 1 : 0;
    a.brake = block && car.spd > 0.5 ? 1 : car.spd > want + 1.5 ? c((car.spd - want) / 8, 0.3, 1) : 0;
    return a;
  }
  // on foot: climb into the job car or the nearest free parked car, unless a place or person is close
  const e = o.enter;
  if (e && e.free && (e.goal || gd > 15)) { a.use = pulse; return a; }
  if (gl && gl.kind === 'person' && gd < 3) { a.talk = true; a.turn = c(gl.b * 2, -1, 1); return a; }
  let tc = gl && gl.kind === 'car' && gl.free ? gl : null;
  if (!tc && gd > 15) for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 45 && (!tc || k.d < tc.d)) tc = k;
  let tb = tc ? tc.b : g ? g.b : gl ? gl.b : 0.3;
  if (!tc && gl && R[3] > 10 && R[2] > 6 && R[4] > 6) tb = gl.b;
  let av = 0, close = false;
  for (const k of o.peds) {
    if (k.f < -1 || k.d > 8) continue;
    if (gl && gl.kind === 'person' && Math.abs(k.d - gd) < 1.5) continue;
    if (Math.abs(k.r) < 2.5) av -= (k.r >= 0 ? 1 : -1) * (8 - k.d) / 4;
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
  if (o.t < m.rec) { a.move = -0.8; a.sprint = false; a.strafe = m.side; a.turn = m.side * 0.8; a.jump = pulse; }
  return a;
}
