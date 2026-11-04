// score 0.488  trigger 0.04  pace 0.45  (2504 chars)
// Sprint-first climber: runs at the goal, hops telegraphed attacks, fires only every 10th tick at the boss.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 20);
  const e = wrapA(Math.PI - o.yaw);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!bw && !!o.aim.hit && m.n % 10 === 0;
  if (o.dead) return {};
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 }; // jump to let go of the eagle
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 }; // jump repeatedly to haul up
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire };
  }
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const use = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (use) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : 1;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return {
      turn: clampU(bw.b * 3 + (bw.d > 5 && bw.d < 9 ? 0.15 : 0)), move: mv, fire,
      jump: (atk || telegraphed(o, 4)) && o.ground, use, sel: 0,
    };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: telegraphed(o, 4) }; // stand still, it rises
  if (g.kind === 'spring' && g.d < 1.5) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 0.9 ? 1 : 0.4, fire, jump: telegraphed(o, 4) && o.ground }; // commit to the pad
  if (stuck && !(g.kind === 'lift' && g.d < 2)) {
    return /stairs|crane/.test(g.kind)
      ? { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0.3, fire, jump: m.n % 6 < 3 }
      : { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.8, fire, jump: true };
  }
  const heal = o.hp < 55 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const speed = Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? 1 : 0.7;
  return {
    turn: steerTo(tb, 2.5),
    move: ledgeAhead(o, g) ? 0 : speed,
    fire,
    jump: (g.kind === 'crane-step' && g.d < 1.5 && o.ground) || telegraphed(o, 5),
  };
}
