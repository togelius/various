// score 0.760  trigger 0.16  pace 0.62  (2041 chars)
// slow, heavy-fire climber; boss: hold range, keep facing, jump telegraphs, use pickups
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const near = o.foes.some(f => f.awake && f.d < 12);
  const fire = !!o.aim.hit && m.n % 4 === 0;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    const walk = !o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5;
    if (walk) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0, fire, jump: false };
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp|throw/.test(bw.st || '') && bw.d < 10;
    const mv = bw.d < 6 ? -0.6 : bw.d > 10 ? 0.5 : (bw.band ? 0 : -0.3);
    const swirl = bw.d < 10 && bw.d > 5 ? 0.2 : 0;
    const use = o.inv.length > 0 && bw.d < 13 && m.n % 15 === 0;
    const sel = Math.min(3, m.n % 4);
    return {
      turn: clampU(bw.b * 3 + swirl),
      move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv,
      fire: !!o.aim.hit && m.n % 3 !== 0,
      jump: (atk || shotDanger(o, 3, 0.6)) && o.ground,
      use, sel: use ? sel : undefined
    };
  }
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift';
  const turn = clampU(g.b * 2.5 + (stuck ? Math.sin(m.n * 0.7) : 0));
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || o.foes.some(f => f.st === 'slam' && f.d < 5) || shotDanger(o, 3, 0.6) || stuck;
  const onLift = g.kind === 'lift' && g.d < 1.2;
  const mv = onLift || ledgeAhead(o, g) ? 0 : Math.abs(g.b) < 1.2 ? 1 : 0.5;
  return { turn, move: mv, fire, jump: hop && o.ground };
}
