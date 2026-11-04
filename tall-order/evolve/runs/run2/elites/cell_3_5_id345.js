// score 0.563  trigger 0.19  pace 0.70  (2038 chars)
// runner: sprint at the goal, ignore most toys, fire in short bursts (steady at the boss), jump anything winding up; ladders: face west and push in; hanging/carried: jump out
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const fire = !!o.aim.hit && (m.n % 3 === 0 || o.foes.some(f => f.k === 'boss'));
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
  // stuck: back off and wiggle for 15 ticks (direction flips each escape), then retry the goal
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift';
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7), fire, jump: m.esc % 4 === 0 && o.ground };
  }
  const turn = clampU(g.b * 2.5);
  const mv = edge ? 0 : Math.abs(g.b) < 1.6 ? 1 : 0.4;
  return { turn, move: mv, fire, jump: (hop || telegraphed(o, 6)) && o.ground };
}
