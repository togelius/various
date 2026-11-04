// score 0.728  trigger 0.37  pace 0.39  (2609 chars)
// Lean climber: fire only on real targets, pause to shoot close foes, hop telegraphs, ladder/lift/stuck handling
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && (m.n % 4 !== 0 || !!bw);
  if (o.carried || o.hang) return { fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };
  const e = wrapA(Math.PI - o.yaw);
  const lad = o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 1);
  if (lad) return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire };
  if (g.kind === 'ladder-approach' && g.d < 2.5 && Math.abs(e) > 0.5) {
    return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire };
  }

  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    let mv = bw.d < 3 ? -0.5 : bw.d > 7 ? 1 : 0;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    return { turn: clampU(bw.b * 3), move: mv, fire: true, jump: (atk || telegraphed(o, 4)) && o.ground, use: useNow, sel: 0 };
  }

  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const tb = heal ? heal.b : g.b;
  const edge = ledgeAhead(o, g);
  if (g.kind === 'lift' && g.d < 1) return { fire, jump: telegraphed(o, 4) };

  if (stuckTicks(o, m, 25) && !(m.esc > 0) && (g.kind !== 'lift' || g.d > 2)) {
    m.esc = 15; m.dir = -(m.dir || 1); m.c = -30;
  }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : edge ? 0 : 0.7, fire, jump: m.esc % 4 === 0 && o.ground };
  }

  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 4) ||
    o.foes.some(f => (f.st === 'slam' && f.d < 6) || (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5));
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const useItem = o.inv.length > 0 && !!big && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  // pause to shoot a close hittable foe (bounded so we never stall)
  const tgt = nearestHittable(o);
  m.p = tgt && tgt.d < 7 ? (m.p || 0) + 1 : 0;
  const hold = m.p > 0 && m.p < 12 && g.kind !== 'stairs' && g.kind !== 'spring';
  const mv = edge || hold ? 0 : Math.abs(tb) > 1.6 ? 0.3 : 0.9;
  return { turn: clampU(tb * 2.5), move: mv, fire: fire || hold, jump: hop && o.ground, use: useItem, sel: 0 };
}
