// score 0.339  trigger 0.75  pace 0.77  (1619 chars)
// sprint up the goal marker, spraying the blaster (3 ticks in 4); ladders: face west and push in; hanging/carried: jump out
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const fire = m.n % 4 !== 0;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|windup|crouch|rev/.test(bw.st) && bw.d < 9;
    const mv = bw.d < 5 ? -1 : bw.d > 9 ? 1 : (bw.band ? 0 : -0.5);
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return { turn: clampU(bw.b * 3 + swirl), move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv, fire, jump: (atk || shotDanger(o, 3, 0.6)) && o.ground };
  }
  const ramp = /stairs|spring|crane|lift|ladder/.test(g.kind);
  const edge = o.drop.f < 1 && !ramp;
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || o.foes.some(f => f.st === 'slam' && f.d < 5) || shotDanger(o, 3, 0.6);
  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: false };
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift';
  const turn = clampU(g.b * 2.5 + (stuck ? Math.sin(m.n * 0.7) : 0));
  const mv = edge ? 0 : Math.abs(g.b) < 1.6 ? 1 : 0;
  return { turn, move: mv, fire, jump: (hop || stuck) && o.ground };
}
