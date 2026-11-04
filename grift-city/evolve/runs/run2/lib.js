// helper library of run run2 (append-only), generation 24
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

// pie slice index (0-7, clockwise from ahead) -> signed bearing in radians (right positive)
function sliceBearing(i) { return (i > 4 ? i - 8 : i) * 0.785; }

// nearest threat in a pie array within maxD: returns {i, d, b} (b = signed bearing), or null if none
function nearestPie(arr, maxD) {
  let bi = -1, bd = maxD;
  for (let i = 0; i < 8; i++) if (arr[i] < bd) { bd = arr[i]; bi = i; }
  return bi < 0 ? null : { i: bi, d: bd, b: sliceBearing(bi) };
}

// cop repulsion for driving: returns {push (add to steer, left/right), front (nearest cop in ahead slices, 50 = none)}
function copAvoid(o) {
  let push = 0, front = 50;
  for (let i = 0; i < 8; i++) {
    const d = o.pie.cop[i];
    if (d >= 25) continue;
    push -= (25 - d) / 25 * Math.sin(i * Math.PI / 4);
    if (i === 0 || i === 1 || i === 7) front = Math.min(front, d);
  }
  return { push: push, front: front };
}

// car throttle/brake for a target speed: sets a.gas or a.brake from current speed sa (abs m/s) and want
function driveTo(a, sa, want) {
  if (sa < want) a.gas = 0.8;
  else a.brake = sa > want + 3 ? 0.6 : 0;
  return a;
}

// debtor in talk range (person within 2.5 m, or occupied goal car within 4 m)
function inTalkRange(o) {
  const G = o.goal, e = o.enter;
  if (!G) return false;
  return G.kind === 'person' ? G.d < 2.5 : G.kind === 'car' && !G.free && G.d < 4 && !(e && e.goal && e.d < 3);
}
