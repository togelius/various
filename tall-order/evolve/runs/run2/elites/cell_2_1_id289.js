// score 0.545  trigger 0.14  pace 0.17  (2530 chars)
// special states first: carried/hang -> alternate jump; kitty on head -> jump and shake;
// ladder: align west and push in (never jump there, a hop releases the lattice);
// lift: stand still on it; spring: drive onto the pad; otherwise creep toward the goal
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30); // called every tick so its counter stays current
  if (o.dead) return {};
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const close = o.foes.some(f => f.awake && f.d < 6);
  const fire = !!o.aim.hit && ((!!boss && m.n % 4 === 0) || (close && m.n % 3 === 0));

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.15 : boss.d < 5 ? -0.2 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || threat };
  }

  // ladder: face west (yaw ~ PI) and push in once aligned; no jumps when on the lattice
  const e = wrapA(Math.PI - o.yaw);
  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }

  // lift: stand still on it, it rises as long as you stand there
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: threat };

  // stuck: no vertical progress for ~3 s, so hop and wander
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.2, fire, jump: true };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  // grab nearby juice when hurt
  const heal = o.hp < 75 ? o.items.find(i => i.k === 'juice' && i.d < 8) : undefined;
  const tb = heal ? heal.b : g.b;
  // crane-step: hop across gaps
  const hop = threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  // spring: once near the pad, keep driving onto it so the throw fires
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 0.8 ? 0.6 : 0.1;
  return { turn: steerTo(tb, 3), move: walk, fire, jump: hop };
}
