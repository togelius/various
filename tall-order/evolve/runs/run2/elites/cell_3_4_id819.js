// score 0.852  trigger 0.24  pace 0.56  (3244 chars)
function incomingHit(o) {
  if (shotDanger(o, 4, 0.6)) return true;
  return o.foes.some(f => f.awake && (
    (f.k === 'golem' && f.d < 4.5 && /slam|wind|crouch|shock|stomp/.test(f.st || '')) ||
    (f.k === 'car' && f.d < 7 && Math.abs(f.b) < 0.7 && /rev|charge/.test(f.st || '')) ||
    (f.k === 'bee' && f.d < 3.5 && /dive/.test(f.st || '')) ||
    (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5) ||
    (f.k === 'wolf' && f.d < 2.5 && /wind|swipe/.test(f.st || ''))
  ));
}

function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = (!!o.aim.hit && m.n % 4 === 0) || (!!bw && !!o.aim.hit && m.n % 3 !== 0);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder') return ladderSteer(o);
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.6 : 0.1, fire: false, jump: false };
    }
    return ladderSteer(o);
  }

  const hit = incomingHit(o);
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;

  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const useBoss = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useBoss) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : 1;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl), move: mv, fire,
      jump: (hit || telegraphed(o, 4)) && o.ground, use: useBoss, sel: 0,
    };
  }

  const heal = o.hp < 60 ? juiceNear(o, 9) : null;
  const near = o.foes.some(f => f.awake && f.d < 12);
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: hit };

  const stuck = stuckTicks(o, m, 25) && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.5 : (edge ? 0 : 0.8),
      fire: false, jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  const usePk = si >= 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (usePk) m.u = m.n;
  const pk = usePk ? { sel: si, use: true } : {};

  const cs = g.kind === 'crane-step' && (g.stepY || 0) - o.y > 0.8;
  const hop = hit || (cs && g.d < 3.5 && Math.abs(g.b) < 0.5) || (g.kind === 'crane-step' && g.d < 2.5);
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const mv = edge ? 0 : Math.abs(tb) > 1.8 ? 0.3 : side < 0.8 ? 0.7 : 1;
  return { turn: clampU(tb * 2.7), move: mv, fire, jump: hop && o.ground, ...pk };
}
