// score 0.544  trigger 0.19  pace 0.20  (1821 chars)
// Slow, mostly non-firing climber: special states first; ladder: face west and push in; lift: stand still; creep toward goal at ~1/3 pace; fire only at boss
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30);
  if (o.dead) return {};
  if (o.carried || o.hang) return { jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };

  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && !!boss && boss.band;

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.4 : boss.d < 5 ? -0.3 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || threat };
  }

  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) return ladderSteer(o);

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), jump: threat };

  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (o.drop.f < 1.5 ? 0 : 0.7),
      fire: false, jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const edge = ledgeAhead(o, g);
  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const tb = heal ? heal.b : g.b;
  const hop = threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 1.2 ? 0.5 : 0.25;
  return { turn: steerTo(tb, 2), move: walk, fire: false, jump: hop };
}
