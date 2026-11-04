// score 0.858  trigger 0.26  pace 0.53  (2887 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  // runner: fire only when the blaster already bears on a target; never stop to aim
  const fire = !!o.aim.hit && m.n % 3 !== 0;
  if (o.climbing || g.kind === 'ladder') return { ...ladderSteer(o), fire, jump: false };
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(wrapA(Math.PI - o.yaw)) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    }
    return { ...ladderSteer(o), fire, jump: false };
  }
  const ladderish = g.kind === 'ladder-approach' || g.kind === 'ladder';
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const mv = Math.abs(bw.b) > 1.2 || o.drop.f < 2 ? 0 : bw.d < 3 ? -0.5 : 1;
    return { turn: clampU(bw.b * 3), move: mv, fire, jump: (atk || telegraphed(o, 4)) && o.ground };
  }
  if (g.kind === 'lift' && g.d < 1.2) {
    return { turn: steerTo(g.b, 2), move: 0, fire, jump: telegraphed(o, 4) && o.ground };
  }
  const stuck = stuckTicks(o, m, 20) && !ladderish && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 12; m.dir = -(m.dir || 1); m.c = -25; }
  if (m.esc > 0) {
    m.esc--;
    const back = m.esc > 6;
    return { turn: clampU(m.dir * 0.8), move: back ? -0.8 : ledgeAhead(o, g) ? 0 : 0.8, fire, jump: m.esc % 4 === 0 && o.ground };
  }
  if (g.kind === 'spring' && g.d < 2.5) {
    return { turn: steerTo(g.b, 3), move: Math.abs(g.b) < 0.6 ? 1 : 0.3, fire, jump: false };
  }
  // runner hops only for real threats: telegraphed attacks, fast kittens, rising crane steps
  const hop = telegraphed(o, 5) || (g.kind === 'crane-step' && g.d < 2.5) ||
    o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5);
  const big = o.foes.find(f => f.awake && f.d < 5 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const useItem = o.inv.length > 0 && big && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  // heal only when low; grab loot only when it is straight ahead
  const heal = o.hp < 40 ? juiceNear(o, 6) : null;
  const loot = o.items.find(i => i.d < 4 && Math.abs(i.b) < 0.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.3 : side < 0.8 ? 0.6 : 1;
  const turn = edge ? (o.drop.r > o.drop.l ? 0.6 : -0.6) : clampU(tb * 3);
  return { turn, move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
