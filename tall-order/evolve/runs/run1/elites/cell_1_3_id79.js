// score 0.395  trigger 0.08  pace 0.55  (1492 chars)
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
  const fire = !!o.aim.hit && m.n % 2 === 0;
  const stuck = stuckTicks(o, m, 25);
  const slam = o.foes.some(f => f.st === 'slam' && f.d < 4);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrap(Math.PI - o.yaw);
    const ok = Math.abs(e) < 0.5;
    return { turn: clamp(e * 3), move: ok ? 1 : 0, fire, jump: slam };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: clamp(g.b * 2), move: 0, fire, jump: slam };
  const edge = o.drop.f < 1.5 && g.kind !== 'spring' && g.kind.indexOf('stairs') < 0 && g.kind !== 'crane-step';
  if (stuck && g.kind !== 'lift') return { turn: Math.sin(m.n * 0.7), move: edge ? 0 : 0.8, fire, jump: true };
  const move = Math.abs(g.b) < 1 && !edge ? 1 : 0;
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  return { turn: clamp(g.b * 2), move, fire, jump: slam || hop };
}
