// score 0.475  trigger 0.02  pace 0.42  (2219 chars)
// Brisk runner: ignores toys, relies on speed + jumps. Fires only rarely at the boss.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 20);
  if (o.dead) return {};
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!boss && !!o.aim.hit && m.n % 12 === 0;
  const danger = telegraphed(o, 4.5);

  // ladder: face west and push in, no jumping
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1.2) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0.2, fire: false, jump: false };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }

  // boss fight on top floor: keep distance, face it, jump attacks
  if (boss && o.floor === 5 && boss.d < 14 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    let mv = boss.d > 9 ? 1 : boss.d < 6 ? -0.7 : 0.1;
    if (!boss.band && boss.d < 12) mv = -0.6;
    if (mv > 0 && o.drop.f < 2) mv = 0;
    const weave = Math.floor(o.t / 2) % 2 ? 0.12 : -0.12;
    return { turn: steerTo(boss.b + weave, 2.5), move: mv, fire, jump: danger && o.ground };
  }

  // lift: stand still on it
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: danger };

  if (stuck) {
    return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.8, fire: false, jump: true };
  }

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = !ramp && o.drop.f < 1.5;
  const heal = o.hp < 50 ? o.items.find(i => i.k === 'juice' && i.d < 6) : null;
  const tb = heal ? heal.b : g.b;
  const hop = danger || (g.kind === 'crane-step' && g.d < 1.8 && o.ground);
  const ab = Math.abs(tb);
  const move = edge ? 0 : g.kind === 'spring' && g.d < 2 ? 1 : ab > 1.4 ? 0 : ab > 0.8 ? 0.4 : 0.85;
  return { turn: steerTo(tb, 3), move, fire: false, jump: hop && o.ground };
}
