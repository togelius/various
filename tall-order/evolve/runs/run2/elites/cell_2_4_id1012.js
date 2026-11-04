// score 0.627  trigger 0.16  pace 0.60  (3352 chars)
// Steady-fire climber with dodging: hops telegraphed attacks, sidesteps shells, avoids edges, boss standoff
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 12);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const pulse = m.n % 4;
  const close = o.foes.some(f => f.awake && f.d < 6);
  const fire = !!o.aim.hit && (bw ? pulse < 3 : close && m.n % 4 < 2);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    return { ...ladderSteer(o), fire, jump: false };
  }

  // dodge helpers
  const shell = o.shots.find(s => !s.shootable && s.d < 5 && Math.abs(s.b) < 0.7);
  const charge = o.foes.find(f => f.k === 'car' && f.d < 8 && /rev|charge|windup/.test(f.st || ''));
  const slamF = o.foes.find(f => f.d < 6 && /slam|shock|stomp/.test(f.st || ''));
  const danger = !!(shell || charge || slamF) || telegraphed(o, 4);

  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = bw.d < 3 ? -0.6 : bw.d > 6 ? 1 : 0.7;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl), move: mv, fire,
      jump: (atk || danger) && o.ground, use: useNow, sel: 0,
    };
  }

  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: danger && o.ground };

  const stuck = stuckTicks(o, m, 25) && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7),
      fire, jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const cs = g.kind === 'crane-step' && (g.stepY || 0) - o.y > 0.8;
  const hop = (cs && g.d < 3.5 && Math.abs(g.b) < 0.5) || (g.kind === 'crane-step' && g.d < 2.5) ||
    danger ||
    o.foes.some(f => (f.k === 'kitty' && f.d < 3.5 && Math.abs(f.dy) < 1.5));
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const retreat = (charge || slamF) && !edge && o.drop.f > 2 && g.kind !== 'lift';
  let mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.7 : side < 1 ? 0.5 : 1;
  if (retreat && (charge ? charge.d > 3 : slamF.d < 3)) mv = -0.5;
  if (side < 0.8 && Math.abs(tb) > 0.3) mv = Math.min(mv, 0.3);
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
