// score 0.453  trigger 0.24  pace 0.36  (2060 chars)
// Hybrid: fire only when the blaster can hit something (skip 1 in 5 except vs boss),
// brisk walk toward goal, slow when foes are close; A's ladder/boss/stuck logic, B's pace
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  const bw = o.foes.find(f => f.k === 'boss');
  const fire = !!o.aim.hit && (!!bw || m.n % 5 !== 0);
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift' && g.kind !== 'boss';
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 3)) {
    const e = wrapA(Math.PI - o.yaw);
    const walk = g.kind === 'ladder-approach' && g.d > 1.5 && Math.abs(e) > 0.5;
    if (walk) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.7 : 0, fire, jump: false };
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|windup|crouch|rev/.test(bw.st) && bw.d < 9;
    const brick = shotDanger(o, 3, 0.6);
    const mv = bw.d < 5 ? -0.8 : bw.d > 9 ? 0.8 : (bw.band ? 0 : -0.4);
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return { turn: clampU(bw.b * 3 + swirl), move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv, fire, jump: (atk || brick) && o.ground };
  }
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 4) || o.foes.some(f => f.st === 'slam' && f.d < 5);
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: false };
  const turn = clampU(g.b * 2.5 + (stuck ? Math.sin(m.n * 0.7) : 0));
  const near = o.foes.some(f => f.awake && f.d < 3);
  const pace = Math.abs(g.b) < 1.2 ? (near ? 0.5 : 0.85) : 0;
  const mv = stuck && !ledgeAhead(o, g) ? 0.7 : ledgeAhead(o, g) ? 0 : pace;
  return { turn, move: mv, fire, jump: (hop || stuck) && o.ground };
}
