// score 0.074  trigger 0.30  pace 0.05  (1890 chars)
// special states first; ladders: face west and push in; lift: stand still; otherwise walk slowly toward the goal, firing heavily
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function clamp(v) { return Math.max(-1, Math.min(1, v)); }
function step(o, m) {
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 3 === 0 };
  const g = o.goal;
  const near = o.foes.find(f => f.awake && f.d < 10);
  const fire = (!!o.aim.hit || !!near) && m.n % 3 === 0;
  m.c = Math.abs(o.y - (m.py === undefined ? o.y : m.py)) < 0.05 ? (m.c || 0) + 1 : 0;
  m.py = o.y;
  if (m.c > 40 && g.kind !== 'ladder' && g.kind !== 'lift') {
    if (m.c > 52) m.c = 0;
    return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.5, fire, jump: true };
  }
  const hold = o.foes.some(f => f.awake && f.band && f.d < 7);
  const slam = o.foes.some(f => f.st === 'slam' && f.d < 4);
  if (g.kind === 'ladder' || g.kind === 'ladder-approach') {
    const e = wrap(Math.PI - o.yaw);
    const ok = Math.abs(e) < 0.5;
    return { turn: clamp(e * 3), move: ok ? (g.kind === 'ladder' ? 1 : 0.4) : 0, fire, jump: slam };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: clamp(g.b * 2), move: 0, fire, jump: slam };
  // steady walk toward the goal; stairs treads are not drops, so only real edges stop us
  const edge = o.drop.f < 1.5 && g.kind !== 'spring' && g.kind !== 'stairs' && g.kind !== 'stairs-approach';
  const move = Math.abs(g.b) < 1.2 && !edge && !hold ? (Math.abs(g.b) < 0.5 ? 0.25 : 0.1) : 0;
  // at a drop, turn toward the side with more ground
  const turn = edge ? (o.drop.r > o.drop.l ? 0.6 : -0.6) : clamp(g.b * 2);
  return { turn, move, fire, jump: slam };
}
