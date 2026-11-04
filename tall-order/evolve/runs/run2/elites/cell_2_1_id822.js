// score 0.340  trigger 0.11  pace 0.18  (2895 chars)
// Planted climber: fires at anything the blaster reaches, walks in short bursts (continuously only on stairs/springs/crane-steps), hops telegraphs, uses pickups on big threats.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const n = m.n;
  if (o.dead) return {};
  const e = wrapA(Math.PI - o.yaw);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: n % 2 === 0 };
  if (o.rider) return { turn: n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: n % 2 === 0 };
  const ladder = o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5);
  if (ladder) {
    if (!o.climbing && g.kind !== 'ladder' && g.d > 1 && Math.abs(e) > 0.5)
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire: false };
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false };
  }
  // pickups: big threat or crowd in front
  const big = o.foes.some(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.5 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const use = o.inv.length > 0 && (big || crowd) && n - (m.u || -99) > 20;
  if (use) m.u = n;
  const fire = !!o.aim.hit && n % 4 !== 0;
  const hop = telegraphed(o, 5) || (g.kind === 'crane-step' && g.d < 2.5 && (g.stepY || 0) - o.y > 1) ||
    o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5);
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    let mv = bw.d < 5 ? -0.5 : bw.d > 9 ? 0.3 : 0.12; // hold range, drift
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const swirl = bw.d > 5 && bw.d < 10 ? 0.1 : 0; // slow arc round the wolf
    return {
      turn: clampU(bw.b * 3 + swirl), move: mv, fire: !!o.aim.hit,
      jump: (atk || shotDanger(o, 3, 0.6) || telegraphed(o, 4)) && o.ground, use, sel: 0,
    };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: hop, use, sel: 0 };
  // unstick: back off, then go forward again
  if (stuckTicks(o, m, 50) && g.kind !== 'lift' && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  const edge = ledgeAhead(o, g);
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7),
      fire, jump: m.esc % 4 === 0 && o.ground, use, sel: 0,
    };
  }
  const heal = o.hp < 55 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const climb = /stairs|spring|crane/.test(g.kind);
  const walk = !edge && Math.abs(tb) < (climb ? 0.8 : 1) && (climb || n % 8 === 0);
  return { turn: steerTo(tb, 2.5), move: walk ? 0.5 : 0, fire, jump: hop && o.ground, use, sel: 0 };
}
