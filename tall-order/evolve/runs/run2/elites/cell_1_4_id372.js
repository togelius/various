// score 0.283  trigger 0.06  pace 0.55  (2563 chars)
// Sprinting climber: fast on ramps, orbits the mega wolf at range and fires in short bursts, jumps telegraphed attacks.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 20);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const burst = m.n % 3 === 0; // fire duty about one tick in three, only when the aim band holds a target
  const slam = o.foes.some(f => f.d < 6 && /slam|windup|rev|dive|crouch|shock|stomp/.test(f.st || '')) || shotDanger(o, 3.5, 0.6);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire: burst && !!o.aim.hit, jump: !!jump, use: !!use, sel: 0,
  });

  // Top floor: orbit the wolf at 5-9 m, keep it in sight, jump slams and shockwaves.
  if (boss && boss.d < 16 && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const side = Math.floor(o.t / 4) % 2 ? 0.35 : -0.35; // off-centre aim when moving makes an arc around it
    const orbit = boss.d > 5 && boss.d < 9 ? side : 0;
    let move = boss.d < 5 ? -1 : boss.d < 8 ? 0.4 : boss.d > 10 ? 1 : 0.7;
    if (move > 0 && o.drop.f < 2) move = 0;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    return out(steerTo(boss.b + orbit, 2.5), move, slam, useNow);
  }

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, slam);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, slam);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, slam);

  if (stuck) {
    if (/stairs|crane/.test(g.kind)) return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 1 : 0.3, m.n % 6 < 3);
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);
  }

  // Ground and ramps: sprint on the goal, detour for juice when hurt, hop the crane steps.
  const heal = o.hp < 55 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const hop = g.kind === 'crane-step' && g.d < 2 && o.ground;
  const move = ledgeAhead(o, g) || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? 1 : 0.5;
  return out(steerTo(tb, 2.5), move, hop || slam);
}
