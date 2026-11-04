// score 0.452  trigger 0.45  pace 0.34  (3118 chars)
// Hybrid climber: B's pathing and low fire (boss, or hittable foes within 6 m), A's boss weave, threat item use, stuck escape.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 20);
  if (o.dead) return {};
  if (o.carried || o.hang) return { jump: o.carried || m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = nearestHittable(o);
  const fire = (!!boss && !!o.aim.hit && boss.band) || (!!near && near.d < 6);
  const front = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6);
  const threat = front.length >= 3 || front.some(f => /golem|car|boss/.test(f.k) && f.d < 6);
  const slam = telegraphed(o, 5);
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  const useNow = si >= 0 && (threat || (!!boss && boss.d < 12)) && m.n - (m.u || -99) > 20;
  if (useNow) m.u = m.n;
  const base = { fire, use: useNow, sel: Math.max(si, 0) };

  if (boss && boss.d < 14 && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    const ang = Math.atan2(boss.dy, boss.d);
    let mv = boss.d > 9 ? 0.6 : boss.d < 6 ? -0.5 : 0.1;
    if (!boss.band && Math.abs(ang) > 0.15) mv = -0.6;
    if (mv > 0 && o.drop.f < 2) mv = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return { ...base, turn: steerTo(boss.b + weave, 2.5), move: mv, jump: slam && o.ground };
  }

  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (!o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(wrapA(Math.PI - o.yaw)) > 0.5) {
      return { ...base, turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, jump: false };
    }
    return { ...base, ...ladderSteer(o), jump: false };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { ...base, turn: steerTo(g.b, 2), move: 0, jump: false };

  const ramp = /stairs|spring|crane/.test(g.kind);
  if (stuck && ramp) {
    return { ...base, turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0.3, jump: m.n % 6 < 3 };
  }
  if (stuck && !m.esc && g.kind !== 'lift') { m.esc = 15; m.dir = -(m.dir || 1); m.c = -25; }
  if (m.esc > 0) {
    m.esc--;
    return {
      ...base,
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : ledgeAhead(o, g) ? 0 : 0.7,
      jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const edge = !ramp && o.drop.f < 1.5;
  const calm = !o.foes.some(f => f.awake && f.d < 4);
  const heal = o.items.find(i => i.k === 'juice' && i.d < 9 && Math.abs(i.dy) < 1.5);
  const grab = o.items.find(i => i.k !== 'juice' && i.d < 5 && Math.abs(i.dy) < 1.5);
  const item = (heal && (o.hp < 60 || (calm && o.hp < 80))) || (calm && o.shots.length === 0 ? grab : null) || null;
  const tb = item && !edge ? item.b : g.b;
  const slow = o.foes.some(f => f.awake && f.d < 3);
  const mv = edge || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? (slow ? 0.5 : 1) : 0.6;
  const hop = (g.kind === 'crane-step' && g.d < 2) || slam;
  return { ...base, turn: steerTo(tb, 2.5), move: mv, jump: hop && o.ground };
}
