// score 0.462  trigger 0.21  pace 0.49  (2561 chars)
// Brisk climber: walks the goal at a steady pace, jumps telegraphed attacks and brick throws,
// never steps off ledges, fires rarely (boss, or a close hittable foe that is winding up).
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true, use: false, sel: 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0, use: false, sel: 0 };
  const out = (turn, move, jump, fire, use) => ({
    turn: clampU(turn), move: clampU(move), fire: !!fire, jump: !!jump, use: !!use, sel: 0,
  });
  const danger = !!o.ground && telegraphed(o, 4.5);
  const close = o.foes.find(f => f.awake && f.band && f.d < 3) || null;
  const shootNow = !!close && telegraphed(o, 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);

  if (boss && boss.d < 14 && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const wind = boss.d < 9 && /slam|wind|shock|stomp|charge|throw/.test(boss.st || '');
    let move = boss.d > 9 ? 0.7 : boss.d < 5 ? -0.6 : 0.2;
    if (move > 0 && o.drop.f < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    const use = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (use) m.u = m.n;
    return out(steerTo(boss.b + weave, 2.5), move, wind || danger, !!o.aim.hit, use);
  }

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, danger, false, false);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, danger, false, false);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, danger, false, false);

  const stuck = stuckTicks(o, m, 20);
  if (stuck) {
    if (/stairs|crane/.test(g.kind)) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 1 : 0.3, m.n % 6 < 3, shootNow, false);
    }
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true, shootNow, false);
  }

  const heal = o.hp < 55 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const edge = ledgeAhead(o, g);
  const move = edge || Math.abs(tb) > 1.3 ? 0 : Math.abs(tb) < 0.7 ? 0.9 : 0.5;
  const use = o.inv.length > 0 && o.hp < 40 && m.n - (m.u || -99) > 30;
  if (use) m.u = m.n;
  return out(steerTo(tb, 2.5), move, hop || danger, shootNow, use);
}
