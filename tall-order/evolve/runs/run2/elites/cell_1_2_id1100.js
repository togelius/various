// score 0.386  trigger 0.05  pace 0.32  (2323 chars)
// A's sprinter base + B's ladder-approach alignment, pickup use and closer-range firing
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30);
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const threat = telegraphed(o, 4);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.find(f => f.awake && f.band && f.d < 7);
  const fire = !!o.aim.hit && (boss ? m.n % 3 === 0 : near ? m.n % 3 === 0 : m.n % 10 === 0);
  const si = o.inv.findIndex(i => i.n > 0);
  const canUse = si >= 0 && m.n - (m.u || -99) > 25;

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp|crouch|rev/.test(boss.st || '');
    const mv = boss.d < 4 ? -0.4 : boss.d > 12 ? 0.3 : 0;
    const pk = canUse && boss.d < 10;
    if (pk) m.u = m.n;
    m.c = 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: (wave || threat) && o.ground, use: pk, sel: Math.max(0, si) };
  }

  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder' && g.d < 2.5 || g.kind === 'ladder-approach' && g.d < 1.2) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }
  if (g.kind === 'ladder-approach' && g.d < 2.5 && Math.abs(e) > 0.5) {
    return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire: false };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: threat };
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.4, fire: false, jump: true };

  const edge = ledgeAhead(o, g);
  const heal = o.hp < 70 ? juiceNear(o, 7) : null;
  const tb = heal ? heal.b : g.b;
  const kitty = o.foes.some(f => f.k === 'kitty' && f.awake && f.d < 2 && Math.abs(f.dy) < 1.5);
  const hop = (threat || kitty || (g.kind === 'crane-step' && g.d < 1.5)) && o.ground;
  const use = canUse && !!near && near.d < 4;
  if (use) m.u = m.n;
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 1.2 ? 1 : 0.5;
  return { turn: steerTo(tb, 2), move: walk, fire, jump: hop, use, sel: Math.max(0, si) };
}
