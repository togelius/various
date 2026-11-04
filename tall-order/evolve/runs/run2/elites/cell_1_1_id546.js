// score 0.488  trigger 0.07  pace 0.21  (2316 chars)
// Sprinter: special states first; ladder: face west and push in; lift: stand still; otherwise sprint at the goal, firing rarely (boss: steadier fire, keep range)
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 30);
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  // rare fire: every 12th tick on regular foes, every 3rd when the boss is in the band
  const fire = !!o.aim.hit && m.n % (boss ? 4 : 12) === 0;

  if (boss) {
    // stand and track; back off only when crowded, creep in when far; jump telegraphed waves; pickup every 3 s
    const wave = boss.d < 14 && /slam|wind|shock|stomp|crouch|rev/.test(boss.st || '');
    const mv = boss.d < 4 ? -0.4 : boss.d > 12 ? 0.3 : 0;
    const pk = o.inv.length > 0 && boss.d < 9 && m.n % 30 === 0;
    m.c = 0; // standing here is not a stall
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: (wave || threat) && o.ground, use: pk, sel: 0 };
  }

  const e = wrapA(Math.PI - o.yaw);
  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: threat };
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.4, fire: false, jump: true };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const tb = heal ? heal.b : g.b;
  const hop = threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  // sprint: full pace when roughly facing the goal, half pace when turning
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 1.2 ? 1 : 0.5;
  return { turn: steerTo(tb, 2), move: walk, fire, jump: hop };
}
