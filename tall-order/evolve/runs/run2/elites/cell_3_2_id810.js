// score 0.693  trigger 0.20  pace 0.39  (2569 chars)
// Hybrid climber: A's steady boss fire, ladder/lift/boss logic and telegraph jumps;
// B's back-off escape when stuck, pickup use in boss fights or when hurt, brisker walk.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 20);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const bossFight = !!boss && boss.d < 14 && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag';
  const fire = !!boss && !!o.aim.hit && boss.d < 14;
  const slam = o.foes.some(f => /slam|windup|rev|dive|crouch/.test(f.st || '') && f.d < 5) || shotDanger(o, 3.5, 0.5);
  const danger = o.hp < 30 && o.foes.some(f => f.awake && f.d < 4);
  const use = o.inv.length > 0 && m.n - (m.u || -99) > 25 && (bossFight || danger);
  if (use) m.u = m.n;
  const out = (turn, move, jump, u = false) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!u, sel: 0,
  });

  if (bossFight) {
    const ang = Math.atan2(boss.dy, boss.d);
    let move = boss.d > 9 ? 0.6 : boss.d < 6 ? -0.5 : 0.1;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return out(steerTo(boss.b + weave, 2.5), move, slam, use);
  }

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, slam);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, slam);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, slam);

  // stuck (no vertical progress): back off and turn for 12 ticks, then retry the goal
  if (stuck && !(m.esc > 0)) { m.esc = 12; m.dir = -(m.dir || 1); m.c = -20; }
  if (m.esc > 0) {
    m.esc--;
    return out(m.dir * 0.8, m.esc > 6 ? -0.7 : (o.drop.f < 1.5 ? 0 : 0.7), m.esc % 4 === 0);
  }

  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 9) : null;
  const tb = heal ? heal.b : g.b;
  const move = ledgeAhead(o, g) || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? 0.75 : 0.45;
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  return out(steerTo(tb, 2.5), move, hop || slam, use);
}
