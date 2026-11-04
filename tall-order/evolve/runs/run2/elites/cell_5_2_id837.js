// score 0.498  trigger 0.70  pace 0.30  (3462 chars)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 10);
  const fire = !!o.aim.hit || (near && m.n % 3 !== 0);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (!o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0.1, fire, jump: false };
    }
    return Object.assign({ fire, jump: false }, ladderSteer(o));
  }
  // pickups: use on big threats/crowds
  let pk = {};
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  if (si >= 0 && m.n - (m.u || -99) > 20) {
    const front = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6);
    const big = front.some(f => /golem|boss|car/.test(f.k) && f.d < 6);
    if (big || front.length >= 3) { pk = { sel: si, use: true }; m.u = m.n; }
  }
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    let mv = bw.d < 4 ? -0.6 : bw.d > 9 ? 0.8 : 0.3;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    if (mv < 0 && o.drop.f < 2) mv = 0;
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl), move: mv, fire: true,
      jump: (atk || telegraphed(o, 4)) && o.ground, ...pk,
    };
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
    o.foes.some(f => (f.st === 'slam' && f.d < 6) ||
      (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5));
  // back off from car/golem
  const car = o.foes.find(f => f.k === 'car' && f.d < 8 && /rev|charge/.test(f.st || ''));
  const golem = o.foes.find(f => f.k === 'golem' && f.awake && f.d < 3.5 && Math.abs(f.dy) < 2);
  if ((car || golem) && o.drop.f > 3 && !edge) {
    return { turn: clampU((car || golem).b * 2), move: -0.5, fire, jump: hop && o.ground, ...pk };
  }
  const calm = !o.foes.some(f => f.awake && f.d < 4) && o.shots.length === 0;
  const want = calm && o.items.find(i =>
    Math.abs(i.dy) < 1.5 && Math.abs(i.b) < 2 && (i.k === 'juice' ? (o.hp < 75 && i.d < 9) : i.d < 5));
  const tb = want && !edge ? want.b : g.b;
  const slow = o.foes.some(f => f.awake && f.d < 3);
  const springRun = g.kind === 'spring' && g.d < 2.5;
  const fast = Math.abs(tb) < 1.0 || springRun;
  const mv = edge ? 0 : springRun ? 0.6 : Math.abs(tb) > 1.4 ? 0.15 : slow ? 0.4 : fast ? 0.65 : 0.5;
  const turn = springRun ? steerTo(g.b, 4) : clampU(tb * 2.5);
  return { turn, move: mv, fire, jump: hop && o.ground, ...pk };
}
