// score 0.676  trigger 0.08  pace 0.42  (3245 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = (!!bw && o.aim.hit === 'boss' && m.n % 4 === 0) || (m.esc > 0 && !!o.aim.hit && m.n % 8 === 0);
  if (o.climbing || g.kind === 'ladder') return { ...ladderSteer(o), fire, jump: false };
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(wrapA(Math.PI - o.yaw)) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    }
    return { ...ladderSteer(o), fire, jump: false };
  }
  const ladderish = g.kind === 'ladder-approach' || g.kind === 'ladder';
  const near = o.foes.some(f => f.awake && f.d < 12);

  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useNow = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useNow) m.u = m.n;
  const pick = { use: useNow, sel: 0 };

  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const mv = Math.abs(bw.b) > 1.2 || o.drop.f < 2 ? 0 : bw.d < 3 ? -0.5 : 0.7;
    return { turn: clampU(bw.b * 3), move: mv, fire, jump: (atk || telegraphed(o, 4)) && o.ground, ...pick };
  }

  const heal = o.hp < 40 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  if (g.kind === 'lift' && g.d < 1.2) {
    const c = g.d > 0.4;
    return { turn: c ? steerTo(g.b, 2) : 0, move: c ? 0.5 : 0, fire, jump: telegraphed(o, 4) && o.ground, ...pick };
  }

  const stuck = stuckTicks(o, m, 20) && !ladderish && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 12; m.dir = -(m.dir || 1); m.c = -25; }
  if (m.esc > 0) {
    m.esc--;
    const back = m.esc > 6;
    return {
      turn: clampU(m.dir * 0.8),
      move: back ? -0.7 : edge ? 0 : 0.7,
      fire, jump: m.esc % 4 === 0 && o.ground, ...pick,
    };
  }

  if (g.kind === 'spring' && g.d < 2.5) {
    return { turn: steerTo(g.b, 3), move: Math.abs(g.b) < 0.6 ? 1 : 0.3, fire, jump: false, ...pick };
  }

  const hop = telegraphed(o, 5) || (g.kind === 'crane-step' && g.d < 2.5) ||
    o.foes.some(f => f.st === 'throw' && f.d < 6) ||
    o.foes.some(f => (f.st === 'slam' && f.d < 6) ||
      (f.k === 'car' && f.d < 7 && /rev|charge/.test(f.st || '')) ||
      (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5));

  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const fast = Math.abs(tb) < 1.2 || (g.kind === 'spring' && g.d < 2);
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.3 : side < 1 ? 0.5 : fast ? 0.8 : 0.6;
  const turn = edge ? (o.drop.r > o.drop.l ? 0.6 : -0.6) : clampU(tb * 2.5);
  return { turn, move: mv, fire, jump: hop && o.ground, ...pick };
}
