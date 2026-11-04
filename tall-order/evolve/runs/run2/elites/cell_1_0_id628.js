// score 0.263  trigger 0.05  pace 0.08  (2658 chars)
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
  const fire = !!o.aim.hit && !!boss && boss.band && m.n % 2 === 0;
  // pickups: use slot 0 when a golem/car/boss is close in front, or 3+ foes crowd in; 20-tick cooldown
  const big = o.foes.some(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.6 && /golem|car|boss/.test(f.k || ''));
  const crowd = o.foes.filter(f => f.awake && f.d < 5).length >= 3;
  const useIt = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useIt) m.u = m.n;

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.4 : boss.d < 5 ? -0.3 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || threat, use: useIt, sel: 0 };
  }

  const e = wrapA(Math.PI - o.yaw);
  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: threat };

  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.4, fire: false, jump: true };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  // walk to juice when hurt; walk to any nearby item when no awake foe is within 5 m
  const safe = !o.foes.some(f => f.awake && f.d < 5);
  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const pick = heal || (safe ? o.items.find(i => i.d < 4) : undefined);
  const tb = pick ? pick.b : g.b;
  const hop = threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge || m.n % 4 !== 0 ? 0 : Math.abs(tb) < 1.2 ? 0.5 : 0.25;
  return { turn: steerTo(tb, 2), move: walk, fire: !!o.aim.hit && m.n % 16 === 0, jump: hop, use: useIt, sel: 0 };
}
