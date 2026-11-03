// score 0.226  trigger 0.11  pace 0.07  (2412 chars)
// special states first: carried/hang: jump; kitty on head: jump and shake;
// ladder: face west and push in; lift: stand still; otherwise creep (0.2) toward the goal,
// firing rarely, jumping over telegraphed attacks and crane-step gaps
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 30);
  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  // hold fire almost never: only at a close, hittable foe, every sixth tick; always at the boss
  const close = o.foes.some(f => f.awake && f.d < 3);
  const fire = !!o.aim.hit && (!!boss || (close && m.n % 6 === 0));

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.2 : boss.d < 5 ? -0.2 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || threat };
  }

  // ladder: the lattice is only climbable facing west from the east; push in once aligned
  const lattice = g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5);
  if (lattice) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }

  // lift: stand still on it, it rises as long as you stand there
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: threat };

  // stuck: no vertical progress for ~3 s, so hop and wander
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.2, fire, jump: true };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  // grab nearby juice when hurt
  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 6) : undefined;
  const tb = heal ? heal.b : g.b;
  // spring: walk onto the pad and let it throw you; crane-step: hop across gaps
  const hop = threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  const walk = edge ? 0 : Math.abs(tb) < 1.2 ? 0.2 : 0.05;
  return { turn: steerTo(tb, 2), move: walk, fire, jump: hop };
}
