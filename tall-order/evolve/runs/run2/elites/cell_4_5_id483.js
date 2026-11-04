// score 0.318  trigger 0.40  pace 0.71  (2713 chars)
// Sprint at the goal and spray (3 ticks in 4) when foes are near; boss room: B's strafe-and-spray; telegraph dodge; juice detours; ladders: face west and push in
function core(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const near = o.foes.some(f => f.awake && f.d < 12);
  const fire = !!o.aim.hit || (m.n % 7 < 2 && near);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }

  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|wind|crouch|rev|shock|stomp/.test(bw.st || '') && bw.d < 9;
    const mv = bw.d < 3 ? -0.5 : 1;
  // (boss room keeps full-speed approach)
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    return {
      turn: clampU(bw.b * 3 + swirl),
      move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv,
      fire,
      jump: (atk || telegraphed(o, 4)) && o.ground,
    };
  }

  const close = o.foes.some(f => f.awake && f.d < 4);
  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 8)
    : (!close && o.drop.f > 2 ? o.items.find(i => i.d < 4 && Math.abs(i.b) < 1.5) : undefined);
  const tb = heal ? heal.b : g.b;
  const edge = ledgeAhead(o, g);

  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) };

  // stuck: back off and wiggle for 15 ticks (direction flips each escape), then retry
  const stuck = stuckTicks(o, m, 25) && g.kind !== 'lift';
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7), fire, jump: m.esc % 4 === 0 && o.ground };
  }

  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 4) || o.foes.some(f => f.st === 'slam' && f.d < 5);
  const fast = Math.abs(tb) < 1.8 || (g.kind === 'spring' && g.d < 2);
  const mv = edge ? 0 : fast ? 1 : 0.85;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground };
}

function step(o, m) {
  const r = core(o, m) || {};
  const t = o.foes.find(f => f.awake && f.d < 8 && Math.abs(f.b) < 0.6 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 6).length >= 3;
  if (o.inv.length && (t || crowd) && (m.u === undefined || o.t - m.u > 2.5)) {
    m.u = o.t; r.use = true; r.sel = 0;
  }
  return r;
}
