// score 0.919  trigger 0.30  pace 0.55  (3296 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  const canUse = gap => si >= 0 && m.n - (m.u || -99) > gap;
  const fire = (!!o.aim.hit && m.n % 8 < 2) || (!!bw && m.n % 4 !== 0);
  const st = stuckTicks(o, m, g.kind === 'ladder-approach' ? 60 : 25);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  const free = !o.climbing && !bw && !(g.kind === 'lift' && g.d < 2);
  if (st && free && !(m.esc > 0)) { m.esc = 16; m.dir = -(m.dir || 1); m.c = -30; m.kk = (m.kk || 0) + 1; }
  if (m.esc > 0 && !o.climbing) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (ledgeAhead(o, g) ? 0 : 0.7),
      fire, jump: (m.esc % 4 === 0 || m.kk % 3 === 0) && o.ground,
    };
  }
  if (o.climbing || g.kind === 'ladder') return { ...ladderSteer(o), fire, jump: false };
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(wrapA(Math.PI - o.yaw)) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    }
    return { ...ladderSteer(o), fire, jump: false };
  }
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const useNow = canUse(25);
    if (useNow) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : 0.8;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return {
      turn: clampU(bw.b * 3), move: mv, fire,
      jump: (atk || telegraphed(o, 4)) && o.ground, use: useNow, sel: Math.max(0, si),
    };
  }
  const calm = !o.foes.some(f => f.awake && f.d < 4) && o.shots.length === 0;
  const heal = o.hp < 80 ? juiceNear(o, 9) : null;
  const loot = calm && o.items.find(i => i.d < 5 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);
  if (g.kind === 'lift' && g.d < 1.2) {
    const c = g.d > 0.4;
    return { turn: c ? steerTo(g.b, 2) : 0, move: c ? 0.3 : 0, fire, jump: telegraphed(o, 4) && o.ground };
  }
  if (g.kind === 'spring' && g.d < 2.5) {
    return { turn: steerTo(g.b, 3), move: Math.abs(g.b) < 0.6 ? 1 : 0.5, fire, jump: false };
  }
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) ||
    o.foes.some(f => f.d < 6 && (f.st === 'throw' || f.st === 'slam' || (f.k === 'car' && /rev|charge/.test(f.st || '')))) ||
    o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5);
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = canUse(20) && (big || crowd);
  if (useItem) m.u = m.n;
  const fast = Math.abs(tb) < 1.2 || (g.kind === 'spring' && g.d < 2);
  const side = tb > 0 ? o.drop.r : o.drop.l;
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.5 : side < 1.2 ? 0.7 : fast ? 1 : 0.9;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: Math.max(0, si) };
}
