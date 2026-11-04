// score 0.578  trigger 0.73  pace 0.36  (2714 chars)
// Steady-fire climber: fires whenever foes are near, uses pickups on big threats, grabs nearby items when safe (juice when hurt)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 10);
  const fire = !!o.aim.hit || (near && m.n % 4 !== 0);
  // pickup use: big threat or crowd close and in front
  let pk = {};
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  if (si >= 0) {
    const front = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6);
    const big = front.some(f => /golem|boss|car/.test(f.k) && f.d < 6);
    if (big || front.length >= 3) pk = { sel: si, use: m.n % 4 === 0 };
  }
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2)) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false, ...pk };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev/.test(bw.st || '') && bw.d < 9;
    const mv = bw.d < 5 ? -0.8 : bw.d > 9 ? 0.8 : (bw.band ? 0 : -0.4);
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl),
      move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv,
      fire: true,
      jump: (atk || shotDanger(o, 3, 0.6)) && o.ground,
      ...pk,
    };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: false, ...pk };
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) || shotDanger(o, 3, 0.6);
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift' && g.kind !== 'boss';
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  const edge = ledgeAhead(o, g);
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7), fire, jump: m.esc % 4 === 0 && o.ground, ...pk };
  }
  // item detour when calm
  const calm = !o.foes.some(f => f.awake && f.d < 4);
  let tb = g.b;
  const want = calm && o.shots.length === 0 && o.items.find(i =>
    Math.abs(i.dy) < 1.5 && (i.k === 'juice' ? (o.hp < 80 && i.d < 9) : i.d < 5));
  if (want && !edge) tb = want.b;
  const brisk = Math.abs(tb) < 1.4;
  const slow = o.foes.some(f => f.awake && f.d < 3);
  const mv = edge ? 0 : brisk ? (slow ? 0.45 : 0.7) : 0.3;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, ...pk };
}
