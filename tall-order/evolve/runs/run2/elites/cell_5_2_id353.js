// score 0.429  trigger 0.72  pace 0.40  (2390 chars)
// Spray and slow: fire on ~3 of 4 ticks when a foe is near (always during the boss fight); walk at about a third speed; heal earlier
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 20);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.some(f => f.awake && f.d < 12);
  const fire = (!!o.aim.hit || near) && (!!boss || m.n % 3 !== 0);
  const slam = o.foes.some(f => /slam|windup|rev|dive|shock/.test(f.st || '') && f.d < 4.5) || shotDanger(o, 3, 0.5);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!use, sel: 0,
  });

  if (boss && boss.d < 14) {
    const ang = Math.atan2(boss.dy, boss.d);
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 9 ? 0.8 : boss.d < 6 ? -0.5 : 0.2;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return out(steerTo(boss.b + weave, 2.5), move, slam, useNow);
  }

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, slam);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, slam);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, slam);

  const ramp = /stairs|spring|crane/.test(g.kind);
  if (stuck) {
    if (/stairs|crane/.test(g.kind)) return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 1 : 0.3, m.n % 6 < 3);
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);
  }

  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 10) : null;
  const tb = heal ? heal.b : g.b;
  const edge = !ramp && o.drop.f < 1.5;
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const move = edge || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? 0.9 : 0.6;
  return out(steerTo(tb, 2.5), move, hop || slam);
}
