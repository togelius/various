// score 0.497  trigger 0.18  pace 0.54  (3280 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const e = wrapA(Math.PI - o.yaw);
  const fire = !!o.aim.hit;
  const awake = o.foes.filter(f => f.awake);
  const near = awake.some(f => f.d < 12);
  const ramp = /stairs|spring|crane/.test(g.kind);
  const up = { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };

  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder') return up;
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(e) > 0.5) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    return up;
  }

  // Boss on the top floor: kite, weave, and jump on telegraphs
  const boss = awake.find(f => f.k === 'boss');
  if (boss && boss.d < 14 && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    let mv = boss.d > 9 ? 0.8 : boss.d < 6 ? -0.5 : 0.2;
    if (!boss.band && Math.abs(Math.atan2(boss.dy, boss.d)) > 0.15 && boss.d < 12) mv = -0.6;
    if (mv > 0 && (Math.abs(boss.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return { turn: steerTo(boss.b + weave, 2.5), move: mv, fire, jump: o.ground && telegraphed(o, 5), use: useNow, sel: 0 };
  }

  if (g.kind === 'lift' && g.d < 1) return { turn: steerTo(g.b, 2), move: 0, fire, jump: telegraphed(o, 5) };

  // Stuck: ramps get a forward push with jumps; others back off and turn
  const stuck = stuckTicks(o, m, 30) && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !m.esc) {
    if (/stairs|crane/.test(g.kind)) return { turn: steerTo(g.b, 2.5), move: m.n % 20 < 12 ? 1 : -0.5, fire, jump: m.n % 6 < 3 };
    m.esc = 15; m.dir = -(m.dir || 1); m.c = -30;
  }
  const edge = ledgeAhead(o, g);
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : edge ? 0 : 0.7, fire, jump: m.esc % 4 === 0 && o.ground };
  }

  // Normal navigation: heal or loot, then go for the goal
  const heal = o.hp < 60 ? juiceNear(o, 8) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const fast = Math.abs(tb) < 1.2 || (g.kind === 'spring' && g.d < 2);
  let mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.4 : side < 1 ? 0.6 : fast ? 0.9 : 0.7;
  if (fire && !ramp && awake.some(f => f.d < 7)) mv *= 0.5;

  const big = awake.some(f => f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car/.test(f.k));
  const crowd = awake.filter(f => f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;

  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 4.5) ||
    o.foes.some(f => (f.k === 'car' && f.d < 7 && /rev|charge/.test(f.st || '')) ||
      (f.k === 'kitty' && f.d < 3.5 && Math.abs(f.dy) < 1.5));
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
