// score 0.419  trigger 0.02  pace 0.47  (1933 chars)
// Brisk runner: sprints for the goal, ignores toys, jumps telegraphed attacks; fires rarely, only at the boss
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 20);
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!boss && !!o.aim.hit && m.n % 12 === 0;
  const danger = telegraphed(o, 4);
  const e = wrapA(Math.PI - o.yaw);

  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1.2) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0.2, fire: false, jump: false };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }
  if (boss && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    let mv = boss.d > 8 ? 1 : boss.d < 5 ? -0.6 : 0.3;
    if (mv > 0 && o.drop.f < 2) mv = 0;
    return { turn: steerTo(boss.b, 2.5), move: mv, fire, jump: danger && o.ground, use: m.n % 30 === 0 && o.inv.length > 0 };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: danger };
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.8, fire: false, jump: true };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = !ramp && o.drop.f < 1.5;
  const heal = o.hp < 50 ? o.items.find(i => i.k === 'juice' && i.d < 6) : null;
  const tb = heal ? heal.b : g.b;
  const ab = Math.abs(tb);
  const move = edge ? 0 : ab > 1.4 ? 0 : ab > 0.8 ? 0.6 : 1;
  const hop = danger || (g.kind === 'crane-step' && g.d < 1.8);
  return { turn: steerTo(tb, 3), move, fire: false, jump: hop && o.ground };
}
