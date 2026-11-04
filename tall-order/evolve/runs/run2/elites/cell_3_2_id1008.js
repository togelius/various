// score 0.696  trigger 0.18  pace 0.39  (2179 chars)
// Slow, mostly non-firing climber: special states first; ladder: face west and push in; lift: stand still; creep toward goal at ~1/3 pace; fire only at boss
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30);
  if (o.dead) return {};
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && m.n % 4 < 3 && (!!boss ? !!boss.band : o.foes.some(f => f.awake && f.d < 6));

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.4 : boss.d < 5 ? -0.3 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || threat };
  }

  const e = wrapA(Math.PI - o.yaw);
  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: threat };

  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (o.drop.f < 1.5 ? 0 : 0.7),
      fire: false, jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const heal = o.hp < 80 ? juiceNear(o, 9) : null;
  const tb = heal ? heal.b : g.b;
  const hop = telegraphed(o, 4) || threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 1.2 ? 0.9 : 0.6;
  return { turn: steerTo(tb, 2.5), move: walk, fire: false, jump: hop };
}
