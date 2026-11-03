// stand and fight: face the nearest awake toy, hold the trigger, only then move on
function step(o, m) {
  const f = o.foes.find(f => f.awake && f.d < 14);
  if (f) {
    const turn = Math.max(-1, Math.min(1, f.b * 3));
    return { turn, move: f.d < 4 ? -0.6 : 0, fire: true, jump: o.hang || o.rider || o.carried };
  }
  const g = o.goal;
  return { turn: Math.max(-1, Math.min(1, g.b * 2)), move: Math.abs(g.b) < 1 ? 0.8 : 0, fire: !!o.aim.hit, jump: o.hang };
}
