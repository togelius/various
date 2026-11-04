// score 0.432  trigger 0.04  pace 0.71  (2202 chars)
// slow, heavy-fire climber; boss: hold range, keep facing, jump telegraphs, use pickups
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const fire = o.shots.some(s => s.shootable && s.d < 8 && Math.abs(s.b) < 0.15);
  if (o.carried) return { turn: 0, move: 0, fire, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 3.5)) {
    const e = wrapA(Math.PI - o.yaw);
    const walk = g.kind === 'ladder-approach' && g.d > 1.5 && Math.abs(e) > 0.5;
    if (walk) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0, fire, jump: false };
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    // circle at range (orbit bias on the turn), sprint in, back off when close, fire in short bursts when aimed
    const atk = /slam|wind|crouch|rev|shock|stomp|throw/.test(bw.st || '') && bw.d < 10;
    const orbit = bw.d > 4 && bw.d < 11 ? 0.35 : 0;
    const mv = bw.d < 5 ? -0.8 : 1;
    const use = o.inv.length > 0 && bw.d < 13 && m.n % 20 === 0;
    const sel = Math.min(3, m.n % 4);
    return {
      turn: clampU(bw.b * 3 + orbit),
      move: (Math.abs(bw.b) > 1.2 || o.drop.f < 2) && mv > 0 ? 0 : mv,
      fire: !!o.aim.hit && m.n % 10 < 2,
      jump: (atk || telegraphed(o, 5)) && o.ground,
      use, sel: use ? sel : undefined
    };
  }
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift';
  const ledge = ledgeAhead(o, g);
  const near = o.foes.find(f => f.d < 3.5 && /slam|rev|wind|crouch/.test(f.st || ''));
  const turn = ledge ? (o.drop.r > o.drop.l ? 0.7 : -0.7) : clampU(g.b * 2 + (stuck ? Math.sin(m.n * 0.7) : 0));
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) || stuck;
  const onLift = g.kind === 'lift' && g.d < 1.2;
  const mv = onLift || ledge ? 0 : near ? -0.6 : Math.abs(g.b) < 1.2 ? 1 : 0;
  return { turn, move: mv, fire, jump: hop && o.ground };
}
