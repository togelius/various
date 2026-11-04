// score 0.785  trigger 0.19  pace 0.48  (2435 chars)
// Sprint runner: full speed toward goal, jump over telegraphs, fire only when aim has a target (burst-limited).
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  if (o.carried) return { jump: true };
  if (o.hang) return { jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const hit = o.aim.hit;
  const fire = (!!boss && !!hit && m.n % 4 !== 0) ||
    (!!hit && (hit === 'kitty' || hit === 'cannon' || hit === 'bee') && m.n % 3 === 0);
  const tele = telegraphed(o, 4.5);
  const e = wrapA(Math.PI - o.yaw);

  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.6 : 0, fire };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire };
  }

  if (boss && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = boss.d < 4 ? -0.6 : boss.d > 8 ? 1 : 0.3;
    if (mv > 0 && (Math.abs(boss.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return { turn: clampU(boss.b * 3), move: mv, fire: !!hit && m.n % 4 !== 0, jump: tele && o.ground, use: useNow, sel: 0 };
  }

  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: tele };

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

  const heal = o.hp < 60 ? juiceNear(o, 8) : null;
  const tb = heal ? heal.b : g.b;
  const edge = ledgeAhead(o, g);
  const mv = edge || Math.abs(tb) > 1.6 ? 0 : Math.abs(tb) < 1.0 ? 1 : 0.5;
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || tele;
  const big = o.foes.some(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car/.test(f.k));
  const useItem = o.inv.length > 0 && big && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  return { turn: steerTo(tb, 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
