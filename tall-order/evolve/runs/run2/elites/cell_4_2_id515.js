// score 0.547  trigger 0.35  pace 0.38  (2586 chars)
// Brisk climber: steady fire at close threats/boss, dodge telegraphs, avoid edges.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried) return { jump: true };
  if (o.hang) return { jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 18);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const tgt = nearestHittable(o);
  let fire = false;
  if (boss && o.aim.hit && boss.d < 14) fire = m.n % 3 !== 0;
  else if (tgt && tgt.d < 8) fire = m.n % 3 !== 0;
  else if (o.aim.hit && o.aim.hit !== 'boss') fire = m.n % 6 === 0;

  const tele = o.foes.some(f => f.d < 5 && /slam|windup|rev|dive|crouch|shock/.test(f.st || '')) || shotDanger(o, 3.5, 0.6);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!use, sel: 0,
  });

  if (boss && boss.d < 14 && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const ang = Math.atan2(boss.dy, boss.d);
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 9 ? 0.9 : boss.d < 6 ? -0.5 : 0.2;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return out(steerTo(boss.b + weave, 2.5), move, tele, useNow);
  }

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && Math.abs(e) > 0.5 && g.d > 1) {
      return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 0.6 : 0, tele);
    }
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, tele);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, tele);

  const ramp = /stairs|spring|crane/.test(g.kind);
  if (stuck) {
    if (/stairs|crane/.test(g.kind)) return out(steerTo(g.b, 2.5), Math.abs(g.b) < 1 ? 1 : 0.3, m.n % 6 < 3);
    return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);
  }

  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 8) : null;
  const tb = heal ? heal.b : g.b;
  const edge = !ramp && (o.drop.f < 1.5 || ledgeAhead(o, g));
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  let move = edge || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.5 ? 1 : 0.5;
  if (tgt && tgt.d < 2 && !ramp) move = Math.min(move, 0.4);
  const turn = edge ? (o.drop.r > o.drop.l ? 0.7 : -0.7) : steerTo(tb, 2.5);
  return out(turn, move, hop || tele);
}
