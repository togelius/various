// ---- helper library ----
// wrap an angle into -PI..PI
function wrapA(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
// clamp a control value into -1..1
function clampU(v) { return Math.max(-1, Math.min(1, v)); }
// turn command that faces bearing b (positive turns right); gain 2 is a steady turn
function steerTo(b, gain) { return clampU((gain || 2) * b); }
// nearest awake foe the blaster can hit right now, or null
function nearestHittable(o) {
  let best = null;
  for (const f of o.foes) if (f.awake && f.band && (!best || f.d < best.d)) best = f;
  return best;
}
// true if a non-shootable (unstoppable) shot is within dist metres and within ang radians ahead
function shotDanger(o, dist, ang) {
  return o.shots.some(s => !s.shootable && s.d < dist && Math.abs(s.b) < ang);
}
// stuck detector: counts ticks with no vertical progress in m.c; true once it exceeds maxT ticks
function stuckTicks(o, m, maxT) {
  m.c = Math.abs(o.y - (m.py === undefined ? o.y : m.py)) < 0.05 ? (m.c || 0) + 1 : 0;
  m.py = o.y;
  return m.c > (maxT || 25);
}

// turn/move that face west and push into a ladder
function ladderSteer(o) {
  const e = wrapA(Math.PI - o.yaw);
  return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0 };
}
// foe in a wind-up state within d m, or a dangerous shot: jump now
function telegraphed(o, d) {
  return o.foes.some(f => f.d < d && /slam|wind|crouch|rev|dive|shock|stomp/.test(f.st || '')) || shotDanger(o, 3, 0.6);
}
// true if stepping forward would fall off a ledge (ramps are exempt)
function ledgeAhead(o, g) {
  return o.drop.f < 1.5 && !/stairs|spring|crane|lift|ladder/.test(g.kind);
}

// nearest juice within d m, or null (heals; most controllers use it)
function juiceNear(o, d) { return o.items.find(i => i.k === 'juice' && i.d < d) || null; }
// ---- controller ----
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 12);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && (m.n % 2 === 0 || (!!bw && m.n % 3 !== 0));
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder') return { ...ladderSteer(o), fire, jump: false };
  // ladder approach: commit from 4 m, line up on the approach point, then push west
  if (g.kind === 'ladder-approach' && g.d < 4) {
    if (g.d > 1 && (Math.abs(e) > 0.5 || Math.abs(g.b) > 0.5)) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    return { ...ladderSteer(o), fire, jump: false };
  }

  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = bw.d < 3 ? -0.5 : 1;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl),
      move: mv,
      fire,
      jump: (atk || telegraphed(o, 4)) && o.ground,
      use: useNow,
      sel: 0,
    };
  }

  const heal = o.hp < 70 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  // lift: creep onto the pad, then stand still
  if (g.kind === 'lift' && g.d < 1.2) {
    const c = g.d > 0.4;
    return { turn: c ? steerTo(g.b, 2) : 0, move: c ? 0.3 : 0, fire, jump: telegraphed(o, 4) && o.ground };
  }

  // stuck: back off and wiggle, flipping direction each escape
  const stuck = stuckTicks(o, m, 25) && (g.kind !== 'lift' || g.d > 2);
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7),
      fire,
      jump: m.esc % 4 === 0 && o.ground,
    };
  }

  if (g.kind === 'spring' && g.d < 2.5) {
    return { turn: steerTo(g.b, 3), move: Math.abs(g.b) < 0.6 ? 1 : 0.3, fire, jump: false };
  }
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) ||
    o.foes.some(f => f.d < 6 && (f.st === 'throw' || f.st === 'slam' || (f.k === 'car' && /rev|charge/.test(f.st || '')))) ||
    o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5);
  const fast = Math.abs(tb) < 1.2 || (g.kind === 'spring' && g.d < 2);
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const mv = edge ? 0 : Math.abs(tb) > 1.6 ? 0.3 : side < 1.5 ? 0.5 : fast ? 1 : 0.85;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
