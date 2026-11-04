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
// Sprint-and-spray: timed jumps when hanging/riding/carried, lift wait, spring run-up, ladder steer, boss kiting
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 25); // call every tick so the counter stays valid
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 12);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = o.aim.hit ? m.n % 3 !== 0 : (near && m.n % 5 < 2) || (!!bw && m.n % 4 !== 0);
  const pulse = m.n % 2 === 0;

  // special states first
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: pulse };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: pulse };
  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder') {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  if (g.kind === 'ladder-approach' && g.d < 2.5) {
    if (g.d > 1 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    }
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }

  // boss room on the top floor: kite it, jump its attacks
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

  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 9) : undefined;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);

  // lift: stand still and let it carry us; only hop to dodge
  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) };

  // stuck: back off and wiggle for 15 ticks, flipping direction each escape
  if (stuck && !(m.esc > 0) && g.kind !== 'lift') { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7),
      fire,
      jump: m.esc % 4 === 0 && o.ground,
    };
  }

  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 4) || o.foes.some(f => f.st === 'slam' && f.d < 5);
  // spring: square up to the pad and hit it at full speed
  const springRun = g.kind === 'spring' && g.d < 2;
  const fast = Math.abs(tb) < 1.2 || springRun;
  const turn = springRun ? steerTo(g.b, 4) : clampU(tb * 2.5);

  // pickups: golem/car/boss close ahead, or three or more foes crowding the front
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;

  const mv = edge ? 0 : fast ? 1 : 0.9;
  return { turn, move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
