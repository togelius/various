// score 0.356  trigger 0.04  pace 0.49  (2528 chars)
// Runner: sprints the goal path, ignores most toys, jumps telegraphed attacks and close foes.
// Holds fire only in short bursts during the boss fight, so trigger stays near zero elsewhere.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const bossFloor = o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag';
  const fire = !!boss && bossFloor && !!o.aim.hit && m.n % 4 === 0;
  const close = o.foes.some(f => f.awake && f.d < 2.5 && Math.abs(f.b) < 0.8);
  const hopNow = telegraphed(o, 4) || close || shotDanger(o, 3, 0.6);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!use, sel: 0,
  });

  // Boss fight: keep 6-9 m away, face it, use a pickup every so often.
  if (bossFloor && boss && boss.d < 14) {
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 9 ? 0.8 : boss.d < 5 ? -0.8 : 0.3;
    if (move > 0 && o.drop.f < 2) move = 0;
    return out(steerTo(boss.b, 2.5), move, hopNow, useNow);
  }

  // Ladder: face west and push in.
  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, hopNow);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, hopNow);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, hopNow);

  // Stuck: back off and wiggle for 12 ticks, flipping direction each time.
  if (stuckTicks(o, m, 30) && !(m.esc > 0)) { m.esc = 12; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return out(m.dir * 0.8, -0.7, m.esc % 3 === 0 && o.ground);
  }

  // Ground and ramps: sprint on the goal, grab juice when hurt, hop crane steps.
  const heal = o.hp < 40 ? o.items.find(i => i.k === 'juice' && i.d < 6) : null;
  const tb = heal ? heal.b : g.b;
  const edge = ledgeAhead(o, g);
  const hop = (g.kind === 'crane-step' && g.d < 2 && o.ground) || hopNow;
  const move = edge ? 0 : Math.abs(tb) < 0.9 ? 0.95 : Math.abs(tb) < 1.4 ? 0.5 : 0;
  return out(steerTo(tb, 2.5), move, hop && o.ground);
}
