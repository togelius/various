// score 0.331  trigger 0.14  pace 0.60  (632 chars)
// walk toward the goal marker, shoot whatever is in the aim band
// ladders: at the approach, face west (yaw PI) and push in; hanging/carried: jump out
function step(o, m) {
  const g = o.goal;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: !!o.aim.hit, jump: false };
  }
  const turn = Math.max(-1, Math.min(1, g.b * 2));
  return { turn, move: Math.abs(g.b) < 1 ? 1 : 0, fire: !!o.aim.hit, jump: false };
}
