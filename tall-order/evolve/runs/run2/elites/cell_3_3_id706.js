// score 0.623  trigger 0.17  pace 0.49  (2985 chars)
// Hybrid: sprint-and-climb core, juice/item pickups, boss-wave jumps, fire at any hittable toy
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  if (o.carried) return { jump: true };
  if (o.hang) return { jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const hit = o.aim.hit;
  const fire = !!hit && (!!boss || m.n % 2 === 0);
  const tele = telegraphed(o, 4.5);
  const e = wrapA(Math.PI - o.yaw);

  // ladder: face west and push in
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.6 : 0, fire };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire };
  }

  // mega wolf on the top floor: circle, keep distance, jump its wind-ups
  if (boss && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    let mv = boss.d < 4 ? -0.6 : boss.d > 8 ? 1 : 0.3;
    if (mv > 0 && (Math.abs(boss.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const useBoss = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useBoss) m.u = m.n;
    return {
      turn: clampU(boss.b * 3), move: mv, fire: !!hit && m.n % 3 !== 0,
      jump: (tele || wave) && o.ground, use: useBoss, sel: 0,
    };
  }

  // lift: stand still on it as it rises
  if (g.kind === 'lift' && g.d < 1) return { turn: steerTo(g.b, 2), move: 0, fire, jump: tele };

  // stuck escape: back off and wiggle
  const stuck = stuckTicks(o, m, 20) && g.kind !== 'lift';
  if (stuck && !(m.esc > 0)) { m.esc = 12; m.dir = -(m.dir || 1); m.c = -25; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 6 ? -0.7 : (o.drop.f < 1.5 ? 0 : 0.8),
      fire,
      jump: m.esc % 4 === 0 && o.ground,
    };
  }

  // detour for juice when hurt, or any nearby item when no awake foe is close
  const safe = !o.foes.some(f => f.awake && f.d < 5);
  const heal = o.hp < 60 ? juiceNear(o, 8) : null;
  const pick = heal || (safe ? o.items.find(i => i.d < 4) : null) || null;
  const tb = pick ? pick.b : g.b;

  const edge = ledgeAhead(o, g);
  const mv = edge || Math.abs(tb) > 1.6 ? 0 : Math.abs(tb) < 1.0 ? 1 : 0.5;
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || tele;

  // pickups: use slot 0 when a golem/car is close ahead, or 3+ foes crowd in; 20-tick cooldown
  const big = o.foes.some(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.5 && /golem|car/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 5).length >= 3;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;

  return { turn: steerTo(tb, 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
