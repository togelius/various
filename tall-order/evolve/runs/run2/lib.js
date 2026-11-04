// wrap an angle into -PI..PI
function wrapA(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
// clamp a control value into -1..1
function clampU(v) { return Math.max(-1, Math.min(1, v)); }
// turn command that faces bearing b (positive turns right); gain 2 is a steady turn
function steerTo(b, gain) { return clampU((gain || 2) * b); }
// nearest awake foe the blaster can hit right now, or null
function nearestHittable(o) {
  let best = null;
  for (const f of o.foes) if (f.awake && f.band && (!best || f.d < best.d)) best = f;
  return best;
}
// true if a non-shootable (unstoppable) shot is within dist metres and within ang radians ahead
function shotDanger(o, dist, ang) {
  return o.shots.some(s => !s.shootable && s.d < dist && Math.abs(s.b) < ang);
}
// stuck detector: counts ticks with no vertical progress in m.c; true once it exceeds maxT ticks
function stuckTicks(o, m, maxT) {
  m.c = Math.abs(o.y - (m.py === undefined ? o.y : m.py)) < 0.05 ? (m.c || 0) + 1 : 0;
  m.py = o.y;
  return m.c > (maxT || 25);
}

// turn/move that face west and push into a ladder
function ladderSteer(o) {
  const e = wrapA(Math.PI - o.yaw);
  return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0 };
}
// foe in a wind-up state within d m, or a dangerous shot: jump now
function telegraphed(o, d) {
  return o.foes.some(f => f.d < d && /slam|wind|crouch|rev|dive|shock|stomp/.test(f.st || '')) || shotDanger(o, 3, 0.6);
}
// true if stepping forward would fall off a ledge (ramps are exempt)
function ledgeAhead(o, g) {
  return o.drop.f < 1.5 && !/stairs|spring|crane|lift|ladder/.test(g.kind);
}
