// score 0.494  trigger 0.01  pace 0.44  (3383 chars)
// Steady-fire climber at moderate pace: short bursts at close foes and the boss, 3-6 m boss standoff, slower walking
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 12);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && !!bw && m.n % 40 === 0;
  m.cc = o.carried ? (m.cc || 0) + 1 : 0;
  if (o.carried) return { turn: 0, move: 0, fire, jump: m.cc > 30 && m.n % 4 === 0 };
  if (o.hang) return { turn: 0, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder') {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.6 : 0.3, fire, jump: false };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }

  // boss room: hold a 3-6 m standoff, hop wind-ups, use pickups periodically
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : bw.d > 6 ? 0.5 : 0.3;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl), move: mv, fire,
      jump: (atk || telegraphed(o, 4)) && o.ground, use: useNow, sel: 0,
    };
  }

  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) };

  const stuck = stuckTicks(o, m, 25) && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.5 : (edge ? 0 : 0.5),
      fire, jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const cs = g.kind === 'crane-step' && (g.stepY || 0) - o.y > 0.8;
  const hop = (cs && g.d < 3.5 && Math.abs(g.b) < 0.5) || (g.kind === 'crane-step' && g.d < 2.5) ||
    telegraphed(o, 4) ||
    o.foes.some(f => (f.st === 'slam' && f.d < 6) ||
      (f.k === 'car' && f.d < 7 && /rev|charge/.test(f.st || '')) ||
      (f.k === 'kitty' && f.d < 3.5 && Math.abs(f.dy) < 1.5));
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.6 : side < 1 ? 0.5 : 1;
  return {
    turn: clampU(tb * 2.5),
    move: g.kind === 'spring' ? 1 : mv,
    fire, jump: hop && o.ground, use: useItem, sel: 0,
  };
}
