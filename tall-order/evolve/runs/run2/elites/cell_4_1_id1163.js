// score 0.337  trigger 0.50  pace 0.25  (2066 chars)
// Hybrid: B's safe state handling + A's targeted firing and faster pace when clear
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift';
  if (o.dead) return {};
  const tgt = nearestHittable(o);
  const fire = !!o.aim.hit || (!!tgt && tgt.d < 12);
  if (o.carried) return { move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.hang) return { move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };

  const threat = telegraphed(o, 4.5);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  if (boss && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = boss.d < 14 && /slam|wind|crouch|shock|stomp|throw/.test(boss.st || '');
    const mv = boss.d > 9 ? 0.5 : boss.d < 6 ? -0.5 : 0;
    const use = o.inv.length > 0 && boss.d < 13 && m.n % 15 === 0;
    return {
      turn: clampU(boss.b * 3),
      move: o.drop.f < 2 && mv > 0 ? 0 : mv,
      fire: !!o.aim.hit || boss.band,
      jump: (atk || threat) && o.ground,
      use, sel: use ? m.n % 4 : undefined
    };
  }

  const atLadder = g.kind === 'ladder' ? g.d < 3 : g.kind === 'ladder-approach' && g.d < 1.5;
  if (o.climbing || atLadder) {
    const l = ladderSteer(o);
    return { turn: l.turn, move: l.move, fire: false, jump: false };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: threat && o.ground };

  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.5, fire, jump: true };

  const heal = o.hp < 60 ? juiceNear(o, 7) : null;
  const tb = heal ? heal.b : g.b;
  const near = o.foes.some(f => f.awake && f.d < 8);
  const edge = ledgeAhead(o, g);
  const base = near ? 0.45 : 0.8;
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 1.2 ? base : 0.15;
  const hop = threat || (g.kind === 'crane-step' && g.d < 2 && o.ground);
  return { turn: steerTo(tb, 2.5), move: walk, fire, jump: hop && o.ground };
}
