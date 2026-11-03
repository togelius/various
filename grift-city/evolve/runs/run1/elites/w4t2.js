// g20 quality 0.468 wheels 0.79 (car), trouble 0.78 per min (scuffles) (3659 chars; mutate)
// grifter v2: smooth gps steering, bend-aware speed, ray wall repulsion, position-based unstick, take free cars, talk down debtors.
const C = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function think(o, m) {
  const a = {}, G = o.goal, g = o.gps, R = o.rays, me = o.me;
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (me.mode === 'entering') return a;
  const pulse = o.t % 1 < 0.1, car = me.mode === 'car', gd = G ? G.d : 999;
  // stall check every 2 s by position; escalate recovery length
  if (m.sx === undefined) { m.sx = me.x; m.sz = me.z; m.st = o.t; m.stuck = 0; m.rec = 0; m.side = 1; }
  if (o.t - m.st >= 2) {
    const mv = Math.hypot(me.x - m.sx, me.z - m.sz);
    m.stuck = mv < (car ? 2 : 1.2) && gd > 4 ? m.stuck + 1 : 0;
    if (m.stuck >= 1 && !(car && G && G.kind === 'place' && gd < 14)) {
      m.rec = o.t + 1.5 + Math.min(m.stuck, 3); m.side = -m.side; if (m.stuck > 3) m.stuck = 0;
    }
    m.sx = me.x; m.sz = me.z; m.st = o.t;
  }
  const rec = o.t < m.rec;
  // wall repulsion from rays: positive pushes right
  const wall = (R[2] < R[4] ? 1 : -1) * C(1 - Math.min(R[2], R[4], R[3]) / 10, 0, 1) * 0.5
    + (R[1] < 4 ? (4 - R[1]) * 0.12 : 0) - (R[5] < 4 ? (4 - R[5]) * 0.12 : 0);
  const wallSide = (R[4] - R[2]) > 0 ? 1 : -1;
  const wallPush = R[3] < 12 ? wallSide * (1 - R[3] / 12) * 0.7 : 0;
  const side = (R[1] < 4 ? (4 - R[1]) * 0.12 : 0) - (R[5] < 4 ? (4 - R[5]) * 0.12 : 0);

  if (car) {
    if (G && G.kind === 'place' && gd < 14) { // park at the marker, step out
      a.brake = 1;
      if (Math.abs(o.car.spd) < 2.5) a.use = pulse;
      return a;
    }
    if (o.car.burning || o.car.hp < 0.15) { a.brake = o.car.spd > 1 ? 1 : 0; a.use = pulse; return a; }
    if (rec) { a.brake = 1; a.steer = m.side; return a; } // reverse swinging
    const tb = g ? g.b : G ? G.b : 0;
    a.steer = C(tb * 1.7 + wallPush + side, -1, 1);
    const turn = g ? Math.max(Math.abs(g.b), Math.abs(g.b2) * 0.9, Math.abs(g.b3) * 0.6) : Math.abs(tb);
    let want = !g ? 6 : turn > 1 ? 5 : turn > 0.6 ? 7 : turn > 0.3 ? 11 : 17;
    if (g && g.wd < 12 && Math.abs(g.b2) > 0.6) want = Math.min(want, 6);
    for (const k of o.cars) if (k.f > 0 && k.f < 14 && Math.abs(k.r) < 2.6 && k.kind !== 'parked') want = Math.min(want, k.f < 7 ? 0 : 3);
    for (const k of o.peds) if (k.f > 0 && k.f < 10 && Math.abs(k.r) < 2.4) want = Math.min(want, 2);
    if (R[3] < 10) want = Math.min(want, 2 + R[3] * 0.5);
    a.gas = o.car.spd < want ? (o.car.spd < want - 3 ? 1 : 0.5) : 0;
    a.brake = o.car.spd > want + 3 ? C((o.car.spd - want) / 8, 0.3, 1) : 0;
    return a;
  }

  // on foot
  const e = o.enter;
  if (e && e.free && e.d < 3 && (!G || gd > 40)) { a.use = pulse; return a; }
  let tcar = null;
  for (const k of o.cars) if (k.free && k.kind === 'parked' && k.d < 30 && (!tcar || k.d < tcar.d)) tcar = k;
  if (G && G.kind === 'person' && gd < 3) { a.talk = true; a.turn = C(G.b * 2, -1, 1); return a; }
  if (rec) { a.move = -0.8; a.strafe = m.side; a.turn = m.side * 0.6; a.jump = pulse; return a; }
  const direct = G && gd <= 20;
  let tb = direct ? G.b : g ? g.b : G ? G.b : 0;
  const chase = tcar && gd > 40;
  if (chase) tb = tcar.b;
  let av = 0;
  for (const k of o.peds) if (k.d < 6 && k.f > -1 && Math.abs(k.r) < 2) av -= (k.r >= 0 ? 1 : -1) * (6 - k.d) / 6;
  a.turn = C(tb * 2 + wallPush * 1.2 + side + av * 0.5, -1, 1);
  const bend = g && !chase && !direct ? Math.max(Math.abs(g.b2), Math.abs(g.b3) * 0.6) : 0;
  a.move = Math.abs(tb) > 1.2 ? 0.1 : R[3] < 1.2 ? 0.4 : 1;
  a.sprint = Math.abs(tb) < 0.4 && bend < 0.7 && R[3] > 6;
  return a;
}
