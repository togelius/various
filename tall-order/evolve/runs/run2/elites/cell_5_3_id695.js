// score 0.813  trigger 0.73  pace 0.43  (2376 chars)
// Simplified climber: ladder/boss/escape logic kept, stands and shoots nearby hittable foes.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 25);
  if (o.dead) return {};
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const hit = nearestHittable(o);
  const near = o.foes.some(f => f.awake && f.d < 12);
  const fire = !!o.aim.hit || (near && m.n % 3 !== 0) || (!!bw && m.n % 3 !== 0);
  if (o.carried || o.hang) return { fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, fire, jump: m.n % 2 === 0 };

  const e = wrapA(Math.PI - o.yaw);
  const lad = o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5);
  if (lad) {
    if (!o.climbing && g.kind === 'ladder-approach' && g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire };
    }
    const l = ladderSteer(o);
    return { turn: l.turn, move: l.move, fire };
  }

  const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25 &&
    (!!bw || o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2);
  if (useNow) m.u = m.n;
  const jumpy = telegraphed(o, 5);

  if (bw && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    let mv = bw.d < 3 ? -0.5 : bw.d > 8 ? 1 : 0;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return { turn: clampU(bw.b * 3), move: mv, fire, jump: jumpy && o.ground, use: useNow, sel: 0 };
  }

  if (g.kind === 'lift' && g.d < 1) return { fire, jump: jumpy };

  if (stuck && !(m.esc > 0) && g.kind !== 'lift') { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : ledgeAhead(o, g) ? 0 : 0.7,
      fire,
      jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const ramp = /stairs|spring|lift/.test(g.kind);
  if (hit && hit.d < 6 && !ramp) {
    return { turn: clampU(hit.b * 3), move: 0, fire: true, jump: jumpy && o.ground, use: useNow, sel: 0 };
  }

  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const tb = heal ? heal.b : g.b;
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || jumpy;
  const mv = ledgeAhead(o, g) ? 0 : Math.abs(tb) < 1.2 || ramp ? 0.9 : 0.5;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useNow, sel: 0 };
}
