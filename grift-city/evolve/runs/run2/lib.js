// helper library of run run2 (append-only), generation 8
// clamp v into the range [lo, hi]
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
// true once progress is under 0.2 m/s for more than n ticks (call once per tick; state in m; idle = waiting on purpose)
function stuck(o, m, n, idle) {
  const mv = m.px === undefined ? 1 : Math.hypot(o.me.x - m.px, o.me.z - m.pz);
  m.px = o.me.x; m.pz = o.me.z;
  m.still = mv < 0.02 && !idle ? (m.still || 0) + 1 : 0;
  if (m.still > n) { m.still = 0; return true; }
  return false;
}
// target car speed for the bend ahead, from the next three gps bearings (sharp bend -> slow)
function bendSpeed(g) {
  if (!g) return 15;
  const sharp = Math.max(Math.abs(g.b), Math.abs(g.b2 || 0) * 0.8, Math.abs(g.b3 || 0) * 0.6);
  return sharp > 0.9 ? 5 : sharp > 0.45 ? 9 : 16;
}
// on foot: turn toward bearing b and step forward only when nearly facing it (sets a.turn and a.move)
function walkAt(a, b) {
  a.turn = clamp(b * 2.2, -1, 1);
  a.move = Math.abs(b) > 1.2 ? 0.1 : 1;
  return a;
}

// side with more clear room from the wall rays: +1 = right, -1 = left
function openSide(o) { return o.rays[4] + o.rays[5] >= o.rays[1] + o.rays[2] ? 1 : -1; }
// car speed cap (m/s) from what is close ahead: cars and walls in front, pedestrians nearby
function obstacleCap(o) {
  const ahead = Math.min(o.range[0], o.pie.car[0], o.pie.ped[0]);
  const ped = Math.min(o.pie.ped[0], o.pie.ped[1], o.pie.ped[7]);
  const fwd = ahead < 30 ? 4 + ahead * 0.35 : 99;
  const side = ped < 14 ? 2 + ped * 0.25 : 99;
  return Math.min(fwd, side, ahead < 8 ? 3 : 99);
}
// true when a free car in reach is worth climbing into: a car goal, or a long walk ahead
function carWorthIt(o) {
  const G = o.goal, e = o.enter;
  if (!e || !e.free) return false;
  return e.d < 4 && o.me.wanted < 3 && (e.goal || !G || G.d > 40);
}
// stop the car, then press use on pulse ticks (pulse = true every 0.4 s) to step out
function parkOut(a, o, pulse) {
  const stopped = Math.abs(o.car.spd) < 2.5;
  a.brake = stopped ? 0 : 1;
  if (stopped) a.use = pulse;
  return a;
}
