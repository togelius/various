// score 0.341  trigger 0.12  pace 0.50  (3043 chars)
// Brisk climber: near-full pace on its goal, fires in bursts at hittable foes, orbits the boss, hops telegraphs.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 20);
  if (o.dead) return {};
  if (o.carried) return { jump: true };
  if (o.hang) return { jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = nearestHittable(o);
  const fire = !!o.aim.hit && (!!boss || (!!near && near.d < 10)) && m.n % 4 !== 0;
  const ramp = /stairs|spring|crane/.test(g.kind);
  const hop = (telegraphed(o, 5) || (g.kind === 'crane-step' && g.d < 2)) && o.ground;
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length >= 3;
  const useNow = si >= 0 && (crowd || (!!boss && boss.d < 12)) && m.n - (m.u || -99) > 20;
  if (useNow) m.u = m.n;
  const base = { fire, jump: hop, use: useNow, sel: Math.max(si, 0) };

  // Top floor: orbit the mega wolf at range, keep it in sight, jump its telegraphed attacks.
  if (boss && boss.d < 14 && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    let mv = boss.d > 9 ? 0.8 : boss.d < 6 ? -0.5 : 0.3;
    if (mv > 0 && (o.drop.f < 2 || Math.abs(boss.b) > 1.2)) mv = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return { ...base, turn: steerTo(boss.b + weave, 2.5), move: mv };
  }

  // Ladders: approach from the east, face west, then climb.
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (!o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5)
      return { ...base, turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.6 : 0, jump: false };
    return { ...base, turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, jump: false };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { ...base, turn: steerTo(g.b, 2), move: 0 };

  // Stuck: ramps get a forced push with hops; anything else backs off and turns for a bit.
  if (stuck && ramp) return { ...base, turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 1 : 0.3, jump: m.n % 6 < 3 };
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

  // Ground and ramps: head for the goal, detour for juice when hurt or loot when calm.
  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 9) : null;
  const calm = !o.foes.some(f => f.awake && f.d < 4);
  const loot = calm && o.items.find(i => i.d < 5 && Math.abs(i.dy) < 1.5);
  const tb = (heal || loot || g).b;
  const mv = ledgeAhead(o, g) || Math.abs(tb) >= 1.4 ? 0 : Math.abs(tb) < 0.9 ? 1 : 0.7;
  return { ...base, turn: steerTo(tb, 2.5), move: mv };
}
