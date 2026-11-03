// score 0.485  trigger 0.51  pace 0.39  (2248 chars)
// Hybrid: A's brisk walking + ladder push; B's survival rules, boss spacing, stuck recovery.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const hit = !!o.aim.hit || o.foes.some(f => f.awake && f.band);
  const fire = hit && (boss ? true : m.n % 5 < 3);
  const slam = o.foes.some(f => (f.st === 'slam' || f.st === 'windup') && f.d < 4.5) || shotDanger(o, 3, 0.5);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!use, sel: 0,
  });

  if (boss && boss.d < 14) {
    const ang = Math.atan2(boss.dy, boss.d);
    const wind = boss.d < 9 && /slam|wind|shock|stomp|charge|throw/.test(boss.st || '');
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 9 ? 0.8 : boss.d < 5 ? -0.6 : 0.3;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = 0;
    if (move < 0 && o.drop.b !== undefined && o.drop.b < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return out(steerTo(boss.b + weave, 2.5), move, wind || slam, useNow);
  }

  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, false);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2.5), 0, slam);

  if (stuck) return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);

  const heal = o.hp < 55 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const crane = /crane/.test(g.kind);
  const climb = g.kind === 'crane-step' && g.d < 1.5 && o.ground && (g.stepY || 0) > o.y + 0.3;
  const edge = !crane && g.kind !== 'spring' && g.kind.indexOf('stairs') < 0 && o.drop.f < 1.5;
  const move = edge || Math.abs(tb) >= 1.3 ? 0 : Math.abs(tb) < 0.6 ? 1 : 0.6;
  return out(steerTo(tb, 2.5), move, climb || slam);
}
