// score 0.132  trigger 0.67  pace 0.25  (2572 chars)
// A's spray/boss/ladder/stuck logic with a faster pace, facing close foes, B-style edge turns, telegraph jumps, cooldown pickups
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 20);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.filter(f => f.awake && f.d < 8).sort((a, b) => a.d - b.d)[0];
  const fire = (boss && boss.d < 14) || ((!!o.aim.hit || !!near) && m.n % 4 !== 0);
  const jumpT = telegraphed(o, 4);
  const useNow = o.inv.length > 0 && (boss ? boss.d < 14 : o.hp < 40 && !!near) && m.n - (m.u || -99) > 25;
  if (useNow) m.u = m.n;
  const out = (turn, move, jump) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: useNow, sel: 0,
  });

  if (boss && boss.d < 14) {
    const ang = Math.atan2(boss.dy, boss.d);
    let mv = boss.d > 9 ? 0.8 : boss.d < 6 ? -0.5 : 0.2;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) mv = -0.6;
    if (mv > 0 && o.drop.f < 2) mv = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return out(steerTo(boss.b + weave, 2.5), mv, jumpT);
  }

  if (g.kind === 'ladder') {
    const ls = ladderSteer(o);
    return out(ls.turn, ls.move, false);
  }
  if (g.kind === 'ladder-approach') {
    if (g.d > 1 && Math.abs(wrapA(Math.PI - o.yaw)) > 0.5) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.5 : 0, false);
    }
    const ls = ladderSteer(o);
    return out(ls.turn, ls.move, false);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, jumpT);

  if (stuck) {
    if (/stairs|crane/.test(g.kind)) return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 1 : 0.3, m.n % 6 < 3);
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);
  }

  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 10) : null;
  const facing = near && near.d < 6;
  const tb = facing ? near.b : heal ? heal.b : g.b;
  if (ledgeAhead(o, g)) {
    const side = Math.abs(tb) < 0.5 ? (o.drop.r > o.drop.l ? 0.6 : -0.6) : steerTo(tb, 2.5);
    return out(side, 0, false);
  }
  const base = Math.abs(tb) < 0.9 ? 0.9 : Math.abs(tb) < 1.4 ? 0.5 : 0;
  const move = facing ? Math.min(base, 0.4) : base;
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  return out(steerTo(tb, 2.5), move, hop || jumpT);
}
