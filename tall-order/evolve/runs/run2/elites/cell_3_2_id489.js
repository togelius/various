// score 0.134  trigger 0.20  pace 0.35  (2256 chars)
// Hybrid: sprint at the goal (B's pace) and fire whenever the blaster holds a target (A's safety, not its creeping); A's ladder/lift/hang handling; boss: keep range, sidestep waves; fight close foes before moving on
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30);
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const fire = !!o.aim.hit;
  const use = o.inv.length > 0 && o.foes.some(f => f.awake && f.d < 4);
  const e = wrapA(Math.PI - o.yaw);

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.5 : boss.d < 5 ? -0.3 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || telegraphed(o, 4), use, sel: 0 };
  }

  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: telegraphed(o, 4), use, sel: 0 };
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.4, fire: false, jump: true };

  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const hop = telegraphed(o, 4) || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);

  // close fight: turn to the hittable foe, shoot, creep forward only when lined up
  const tgt = nearestHittable(o);
  if (tgt && tgt.d < 6) {
    const lined = Math.abs(tgt.b) < 0.2 && !ledgeAhead(o, g);
    return { turn: steerTo(tgt.b, 3), move: lined ? 0.5 : 0, fire: true, jump: hop, use, sel: 0 };
  }

  // sprint: full pace when roughly facing the goal, half pace during turns
  const tb = heal ? heal.b : g.b;
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : ledgeAhead(o, g) ? 0 : Math.abs(tb) < 1.2 ? 1 : 0.5;
  return { turn: steerTo(tb, 2), move: walk, fire, jump: hop, use, sel: 0 };
}
