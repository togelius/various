// score 0.526  trigger 0.07  pace 0.39  (2033 chars)
// special states first; ladders: face west and push in; lift: stand still; otherwise walk slowly toward the goal, firing heavily
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function clamp(v) { return Math.max(-1, Math.min(1, v)); }
function step(o, m) {
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 3 === 0 };
  const g = o.goal;
  // fire sparingly at what the blaster already covers; dodge telegraphed attacks and kitties
  const fire = !!o.aim.hit && (m.n % 8 === 0 || (o.floor === 5 && m.n % 3 === 0));
  const hop = telegraphed(o, 5) || o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5) || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  // no vertical progress for 3 s: back off, turning a fresh way each time (not when waiting for a lift)
  if (stuckTicks(o, m, 30) && !(m.esc > 0) && !(g.kind === 'lift' && g.d < 2)) { m.esc = 14; m.dir = -(m.dir || 1); m.c = -20; }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clamp(m.dir * 0.9), move: m.esc > 6 ? -0.6 : o.drop.f < 1.5 ? 0 : 0.6, fire, jump: m.esc % 5 === 0 && o.ground };
  }
  if (g.kind === 'ladder' || g.kind === 'ladder-approach') {
    const e = wrap(Math.PI - o.yaw);
    if (g.kind === 'ladder-approach' && g.d > 2.5) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 && o.drop.f > 1.5 ? 0.8 : 0, fire, jump: hop };
    const ok = Math.abs(e) < 0.5;
    return { turn: clamp(e * 3), move: ok ? (g.kind === 'ladder' ? 1 : 0.6) : 0, fire, jump: hop };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: clamp(g.b * 2), move: 0, fire, jump: hop };
  const edge = o.drop.f < 1.5 && !/spring|stairs|crane/.test(g.kind);
  const aimed = Math.abs(g.b) < 1;
  const move = edge || !aimed ? 0 : Math.abs(g.b) < 0.4 ? 0.9 : 0.5;
  return { turn: clamp(g.b * 2.5), move, fire, jump: hop };
}
