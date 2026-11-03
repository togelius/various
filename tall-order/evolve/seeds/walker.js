// walk toward the goal marker, shoot whatever is in the aim band
function step(o, m) {
  const g = o.goal;
  const turn = Math.max(-1, Math.min(1, g.b * 2));
  return { turn, move: Math.abs(g.b) < 1 ? 1 : 0, fire: !!o.aim.hit, jump: false };
}
