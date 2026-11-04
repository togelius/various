// ---- helper library ----
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
// ---- controller ----
// Hybrid: brisk walk that eases off near foes, spray fire, A's ladder/boss/escape logic, B's boss spacing, and telegraph/shot hops.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const near = o.foes.some(f => f.awake && f.d < 8);
  const fire = !!o.aim.hit || (m.n % 3 !== 0 && near);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2)) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev/.test(bw.st) && bw.d < 9;
    const mv = bw.d < 5 ? -0.8 : bw.d > 9 ? 0.8 : (bw.band ? 0 : -0.4);
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl),
      move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv,
      fire: true, // steady fire at the boss
      jump: (atk || shotDanger(o, 3, 0.6)) && o.ground,
    };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: false };
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) || shotDanger(o, 3, 0.6);
  // stuck: back off and wiggle for 15 ticks (direction flips each escape), then retry the goal
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift' && g.kind !== 'boss';
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  const edge = ledgeAhead(o, g);
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7), fire, jump: m.esc % 4 === 0 && o.ground };
  }
  const turn = clampU(g.b * 2.5);
  const brisk = Math.abs(g.b) < 1.6;
  const slow = o.foes.some(f => f.awake && f.d < 2.5);
  const mv = edge ? 0 : brisk ? (slow ? 0.6 : 1) : 0.5;
  return { turn, move: mv, fire, jump: hop && o.ground };
}
