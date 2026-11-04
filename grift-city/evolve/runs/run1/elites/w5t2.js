// g57 quality 0.620 wheels 0.95 (only car), trouble 0.76 per min (scuffles) (2245 chars; mutate)
// compact: walk/drive along route, grab a nearby free car when far, shortcut across open ground, unstick, talk to debtor.
function think(o, m) {
  const a = {}, c = (v) => Math.max(-1, Math.min(1, v));
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const g = o.gps, gl = o.goal, R = o.rays, me = o.me, car = o.car;
  const gd = gl ? gl.d : 999, pulse = o.t % 1 < 0.1, n = Math.floor(o.t);
  if (m.st === undefined || o.t - m.st >= 2) {
    const mv = m.st === undefined ? 9 : Math.hypot(me.x - m.sx, me.z - m.sz);
    if (mv < 1 && gd > 8) m.rec = o.t + 2;
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  if (me.mode === 'entering') return a;
  const rec = o.t < (m.rec || 0);
  const tb = g ? g.b : gl ? gl.b : 0.3;
  if (me.mode === 'car') {
    if (car.burning || car.hp < 0.25 || (gl && gl.kind !== 'car' && gd < 25 && !(o.mission.name && /deliver|crate|pier|drive|back|voss|car/i.test(o.mission.text || '')))) {
      a.brake = car.spd > 2 ? 1 : 0; a.use = car.spd < 1 && pulse; return a;
    }
    if (!g) { a.gas = 0.3; a.steer = R[4] > R[2] ? 0.3 : -0.3; return a; }
    if (rec) { a.brake = 1; a.steer = n % 2 ? 1 : -1; return a; }
    let hot = false;
    for (const k of o.peds) if (k.f > 0 && k.f < 10 && Math.abs(k.r) < 2) hot = true;
    a.steer = c(tb * 1.6);
    a.gas = car.spd < (gd < 30 ? 6 : 14) && !hot ? 1 : 0;
    a.brake = hot && car.spd > 1 ? 1 : 0;
    return a;
  }
  const e = o.enter, far = gd > 60;
  if (e && e.free && e.d < 3.5 && (far || e.goal)) { a.use = pulse; return a; }
  let b = tb;
  if (gl && gd < 150 && R[3] > 10 && R[2] > 6 && R[4] > 6) b = gl.b;
  if (far) {
    let t = null;
    for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 30 && (!t || k.d < t.d)) t = k;
    if (t) b = t.b;
  }
  if (gl && gl.kind === 'person' && gd < 3) {
    a.turn = c(gl.b * 2); a.talk = true; return a;
  }
  a.turn = c(b * 2.2 + (R[3] < 3 ? (R[4] > R[2] ? 0.8 : -0.8) : 0) + (R[2] < 1.5 ? 0.5 : 0) - (R[4] < 1.5 ? 0.5 : 0));
  a.move = Math.abs(b) > 1.2 ? 0.2 : R[3] < 1.2 ? 0.4 : 1;
  a.sprint = Math.abs(b) < 0.4 && R[3] > 6;
  if (rec) { a.move = -0.8; a.sprint = false; a.strafe = n % 2 ? 1 : -1; a.jump = pulse; }
  return a;
}
