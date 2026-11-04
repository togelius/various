// score 0.584  trigger 0.30  pace 0.49  (1724 chars)
// walk toward the goal marker, shoot whatever is in the aim band
// ladders: at the approach, face west (yaw PI) and push in; hanging/carried: jump out
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 3.5)) {
    const e = wrapA(Math.PI - o.yaw);
    const walk = g.kind === 'ladder-approach' && g.d > 1.5 && Math.abs(e) > 0.5;
    if (walk) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire: !!o.aim.hit, jump: false };
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: !!o.aim.hit, jump: false };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|windup|crouch|rev/.test(bw.st) && bw.d < 9;
    const brick = o.shots.some(s => !s.shootable && s.d < 3 && Math.abs(s.b) < 0.6);
    const mv = bw.d < 5 ? -1 : bw.d > 9 ? 1 : (bw.band ? 0 : -0.5);
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return { turn: clampU(bw.b * 3 + swirl), move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv, fire: !!o.aim.hit, jump: (atk || brick) && o.ground };
  }
  const turn = Math.max(-1, Math.min(1, g.b * 2));
  const hop = g.kind === 'crane-step' && g.d < 2.5 && o.ground;
  const onLift = g.kind === 'lift' && g.d < 1.2;
  const mv = onLift || ledgeAhead(o, g) ? 0 : Math.abs(g.b) < 1 ? 1 : 0;
  return { turn, move: mv, fire: !!o.aim.hit, jump: hop };
}
