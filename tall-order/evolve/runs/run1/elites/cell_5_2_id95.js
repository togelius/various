// score 0.118  trigger 0.67  pace 0.29  (2531 chars)
// Boss (top floor): hold range 6-10, face the MEGA WOLF, back off when it is outside the blaster band,
// fire constantly, jump its wind-ups and incoming shells, use pickups every ~2.5 s. Then climb the crane steps.
// Elsewhere: ladders face west and push in; lifts stand still; otherwise walk to the goal, firing at anything in band.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 25);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit || o.foes.some(f => f.awake && f.band);
  const slam = o.foes.some(f => f.st === 'slam' && f.d < 5) || shotDanger(o, 3, 0.5);
  const out = (turn, move, jump, use) => ({
    turn: clampU(turn), move: clampU(move), fire, jump: !!jump, use: !!use, sel: 0,
  });

  if (boss) {
    const ang = Math.atan2(boss.dy, boss.d);
    const wind = boss.d < 9 && /slam|wind|shock|stomp|charge|throw/.test(boss.st || '');
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let move = boss.d > 10 ? 0.8 : boss.d < 6 ? -0.6 : 0.3;
    // out of the band vertically and not far: backing away lowers the angle into the band
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) move = -0.6;
    if (move > 0 && o.drop.f < 2) move = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.2 : -0.2;
    return out(steerTo(boss.b + weave, 2), move, wind || slam, useNow);
  }

  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? (g.kind === 'ladder' ? 1 : 0.4) : 0, slam);
  }
  if (g.kind === 'lift' && g.d < 1.2) return out(steerTo(g.b, 2), 0, slam);

  if (stuck) return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.7, true);

  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 6) : null;
  const tb = heal ? heal.b : g.b;
  const crane = /crane/.test(g.kind);
  // crane steps are stepping stones over air: no edge check, hop up when the next step is higher
  const climb = g.kind === 'crane-step' && g.d < 1.5 && o.ground && (g.stepY || 0) > o.y + 0.3;
  const edge = !crane && g.kind !== 'spring' && g.kind.indexOf('stairs') < 0 && o.drop.f < 1.5;
  const pace = crane ? 0.8 : 0.6;
  return out(steerTo(tb, 2), !edge && Math.abs(tb) < 1.2 ? pace : 0, climb || slam);
}
