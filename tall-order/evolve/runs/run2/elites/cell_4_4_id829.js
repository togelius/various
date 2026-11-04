// score 0.568  trigger 0.39  pace 0.59  (3238 chars)
// A's sprint-and-spray base + B's ramp push-through, lift stand, and boss weave
function step(o, m) {
  const g = o.goal, e = wrapA(Math.PI - o.yaw);
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const stuck = stuckTicks(o, m, 25) && (g.kind !== 'lift' || g.d > 2);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.some(f => f.awake && f.d < 12);
  const fire = (!!o.aim.hit && (m.n % 3 !== 0 || !!bw)) || (m.n % 5 === 0 && near);
  if (o.carried || o.hang) return { fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (!o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5)
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0.1, fire };
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire };
  }
  if (bw && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : 1;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const atk = bw.d < 9 && /slam|wind|crouch|shock|stomp/.test(bw.st || '');
    const weave = bw.d < 9 && bw.d > 5 ? 0.15 : Math.sin(m.n / 6) * 0.15;
    return { turn: clampU(bw.b * 3 + weave), move: mv, fire, jump: (atk || telegraphed(o, 4)) && o.ground, use: useNow, sel: 0 };
  }
  const ramp = /stairs|spring|crane/.test(g.kind);
  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) };
  if (stuck) {
    m.c = -25;
    if (ramp) m.push = 12;
    else if (!(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); }
  }
  if (m.push > 0) {
    m.push--;
    return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0.3, fire, jump: m.push % 4 < 2 && o.ground };
  }
  const edge = ledgeAhead(o, g);
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : edge ? 0 : 0.7, fire, jump: m.esc % 4 === 0 && o.ground };
  }
  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const cs = g.kind === 'crane-step' && (g.stepY || 0) - o.y > 0.8;
  const hop = (cs && g.d < 3.5 && Math.abs(g.b) < 0.5) || (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 4) ||
    o.foes.some(f => (f.k === 'car' && f.d < 7 && /rev|charge/.test(f.st || '')) || (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5));
  const big = o.foes.some(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const fast = Math.abs(tb) < 1.2 || (g.kind === 'spring' && g.d < 2);
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.3 : side < 1 ? 0.6 : fast ? 1 : 0.9;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
