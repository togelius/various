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
// Low-fire, careful climber: fires only at the boss, jumps over telegraphed attacks, handles hang/rider/carried/ladder/lift.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 15);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!boss && !!o.aim.hit && boss.d < 14;
  const slam = o.foes.some(f => /slam|windup|rev|dive|crouch/.test(f.st || '') && f.d < 5.5) || shotDanger(o, 3.5, 0.5);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!use, sel: 0,
  });

  if (boss && boss.d < 14 && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const ang = Math.atan2(boss.dy, boss.d);
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 9 ? 0.6 : boss.d < 6 ? -0.5 : 0.1;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return out(steerTo(boss.b + weave, 2.5), move, slam, useNow);
  }

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, slam);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, slam);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, slam);

  const ramp = /stairs|spring|crane/.test(g.kind);
  if (stuck) {
    if (/stairs|crane/.test(g.kind)) return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 1 : 0.3, m.n % 6 < 3);
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);
  }

  const heal = o.hp < 65 ? o.items.find(i => i.k === 'juice' && i.d < 9) : null;
  const tb = heal ? heal.b : g.b;
  const edge = !ramp && o.drop.f < 1.5;
  const move = edge || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? 0.6 : 0.4;
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  return out(steerTo(tb, 2.5), move, hop || slam);
}
