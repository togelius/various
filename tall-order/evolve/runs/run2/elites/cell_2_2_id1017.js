// score 0.833  trigger 0.14  pace 0.38  (3258 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 12);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && (bw ? m.n % 4 < 2 : near && m.n % 8 < 2);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };

  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder') {
    return { ...ladderSteer(o), fire, jump: false };
  }
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    }
    return { ...ladderSteer(o), fire, jump: false };
  }
  const ladderish = g.kind === 'ladder-approach' || g.kind === 'ladder';

  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : 0.6;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return {
      turn: clampU(bw.b * 3), move: mv, fire,
      jump: (atk || telegraphed(o, 4)) && o.ground, use: useNow, sel: 0,
    };
  }

  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) };

  const stuck = stuckTicks(o, m, 25) && !ladderish && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7),
      fire, jump: m.esc % 4 === 0 && o.ground,
    };
  }

  if (g.kind === 'spring' && g.d < 2.5) {
    return { turn: steerTo(g.b, 3), move: Math.abs(g.b) < 0.6 ? 1 : 0.3, fire, jump: false };
  }

  const cs = g.kind === 'crane-step' && (g.stepY || 0) - o.y > 0.8;
  const hop = (cs && g.d < 3.5 && Math.abs(g.b) < 0.5) || (g.kind === 'crane-step' && g.d < 2.5) ||
    telegraphed(o, 4) || o.foes.some(f => f.st === 'throw' && f.d < 6) ||
    o.foes.some(f => (f.st === 'slam' && f.d < 6) ||
      (f.k === 'car' && f.d < 7 && /rev|charge/.test(f.st || '')) ||
      (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5));

  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;

  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const fast = Math.abs(tb) < 1.2 || (g.kind === 'spring' && g.d < 2);
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.2 : side < 1 ? 0.4 : fast ? 0.6 : 0.5;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
