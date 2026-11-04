// score 0.375  trigger 0.05  pace 0.50  (2373 chars)
// Circle the boss at range (turn and walk at once, flip direction every 4 s), hop telegraphed attacks, fire ~1 in 3 ticks only when it is hittable; elsewhere sprint and fire rarely
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 20);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const danger = telegraphed(o, 6);
  const out = (turn, move, fire, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire: !!fire, jump: !!jump, use: !!use, sel: 0,
  });

  if (boss && boss.d < 14) {
    if (!m.dir) m.dir = 1;
    if (m.n % 40 === 0) m.dir = -m.dir;
    const ang = Math.atan2(boss.dy, boss.d);
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 9 ? 0.8 : boss.d < 5 ? -0.6 : 0.5;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = -0.3;
    const fire = !!boss.band && m.n % 3 === 0;
    return out(steerTo(boss.b + 0.35 * m.dir, 2.5), move, fire, danger, useNow);
  }

  const e = wrapA(Math.PI - o.yaw);
  const shoot = !!o.aim.hit && m.n % 8 === 0;
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, shoot, false);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, shoot, false);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, shoot, danger);

  if (stuck) {
    if (/stairs|crane/.test(g.kind)) return out(steerTo(g.b, 2.5), 1, false, m.n % 6 < 3);
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, false, true);
  }

  const heal = o.hp < 50 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const hop = danger || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  let move = Math.abs(tb) >= 1.4 ? 0.3 : Math.abs(tb) < 0.9 ? 1 : 0.7;
  if (g.kind === 'spring' && g.d < 2) move = 1;
  if (ledgeAhead(o, g)) move = 0;
  return out(steerTo(tb, 2.5), move, shoot, hop);
}
