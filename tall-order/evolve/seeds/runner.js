// ignore toys, run for the goal, jump now and then; never shoots
function step(o, m) {
  const g = o.goal;
  const turn = Math.max(-1, Math.min(1, g.b * 3));
  const edge = o.drop.f < 1.5 && g.kind !== 'spring';
  return { turn, move: Math.abs(g.b) < 1.2 && !edge ? 1 : 0, fire: false, jump: o.hang || o.rider || o.carried || (o.foes.length > 0 && o.foes[0].d < 2 && o.t % 1 < 0.2) };
}
