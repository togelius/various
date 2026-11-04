// score 0.657  trigger 0.30  pace 0.36  (3298 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 9);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const bossFight = o.floor === 5 && bw && g.kind !== 'crane-step' && g.kind !== 'flag';
  const fire = !!o.aim.hit && (bossFight || near || m.n % 3 === 0);
  if (o.carried) return { fire, jump: true };
  if (o.hang) return { fire, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    if (!o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0.1, fire };
    }
    return Object.assign({ fire, jump: false }, ladderSteer(o));
  }
  // pickups on big threats or crowds
  let pk = {};
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  if (si >= 0 && m.n - (m.u || -99) > 20) {
    const fr = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6);
    if (fr.some(f => /golem|boss|car/.test(f.k)) || fr.length >= 3) {
      pk = { sel: si, use: true };
      m.u = m.n;
    }
  }
  if (bossFight) {
    const atk = /slam|wind|crouch|rev|shock|stomp|throw/.test(bw.st || '') && bw.d < 9;
    let mv = bw.d < 4 ? -0.7 : bw.d > 9 ? 0.9 : 0.4;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    if (mv < 0 && o.drop.f < 2) mv = 0;
    const swirl = bw.d >= 4 && bw.d <= 9 ? 0.25 : 0;
    return { turn: clampU(bw.b * 3 + swirl), move: mv, fire: true, jump: (atk || telegraphed(o, 4)) && o.ground, ...pk };
  }
  if (g.kind === 'lift' && g.d < 1.2) {
    return { turn: steerTo(g.b, 2), move: 0, fire, jump: telegraphed(o, 4), ...pk };
  }
  const edge = ledgeAhead(o, g);
  const stuck = stuckTicks(o, m, 28) && g.kind !== 'lift' && g.kind !== 'boss';
  if (stuck && !m.esc) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? (o.drop.f < 9 ? 0 : -0.7) : (edge ? 0 : 0.7),
      fire, jump: m.esc % 4 === 0 && o.ground, ...pk,
    };
  }
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) ||
    o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5);
  const back = o.foes.find(f => f.awake && f.d < 4 && Math.abs(f.b) < 1.2 && /slam|wind|crouch|rev|dive|throw/.test(f.st || '')) ||
    o.foes.find(f => (f.k === 'car' && f.d < 8 && /rev|charge/.test(f.st || '')) ||
      (f.k === 'golem' && f.awake && f.d < 3.5 && Math.abs(f.dy) < 2));
  if (back && o.drop.f > 3 && !edge) {
    return { turn: clampU(back.b * 2), move: -0.5, fire, jump: hop && o.ground, ...pk };
  }
  // detour to juice when hurt
  const ju = o.hp < 65 ? juiceNear(o, 6) : null;
  const tb = ju ? ju.b : g.b;
  const springRun = g.kind === 'spring' && g.d < 2.5 && !ju;
  const slow = o.foes.some(f => f.awake && f.d < 2.5);
  const mv = edge ? 0 : springRun ? 0.7 : Math.abs(tb) > 1.5 ? 0.2 : slow ? 0.5 : Math.abs(tb) < 0.5 ? 1 : 0.7;
  const turn = springRun ? steerTo(tb, 4) : clampU(tb * 2.5);
  return { turn, move: mv, fire, jump: hop && o.ground, ...pk };
}
