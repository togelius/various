// score 0.665  trigger 0.15  pace 0.54  (2917 chars)
// Rare steady shots (more on the boss), one shared pickup rule, sprint-first movement.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  if (o.carried || o.hang) return { jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };
  const e = wrapA(Math.PI - o.yaw);
  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.some(f => f.awake && f.d < 12);
  const sh = o.shots.find(s => s.shootable && s.d < 14 && Math.abs(s.b) < 0.3 && Math.abs(s.dy) < 2);
  const fire = (!!o.aim.hit && (m.n % 8 === 0 || (!!bw && m.n % 3 === 0))) || (!!sh && !!o.aim.hit);
  const hop = telegraphed(o, 6) || o.foes.some(f => (f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5) || (f.k === 'golem' && f.d < 6 && /slam|wind|crouch/.test(f.st || '')) || (f.k === 'car' && f.d < 8 && /rev|charge|wind/.test(f.st || '')));
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5 && (g.d <= 1 || Math.abs(e) < 0.5))) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0 };
  }
  if (g.kind === 'ladder-approach' && g.d < 2.5) return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.6 : 0.1 };

  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useIt = si >= 0 && (big || crowd || !!bw) && m.n - (m.u || -99) > 20;
  if (useIt) m.u = m.n;
  const act = { fire, use: useIt, sel: Math.max(si, 0) };

  if (bw && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    let mv = bw.d < 3 ? -0.5 : 1;
    if (mv > 0 && (Math.abs(bw.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return { ...act, turn: clampU(bw.b * 3 + (bw.d < 9 && bw.d > 5 ? 0.15 : 0)), move: mv, jump: hop && o.ground };
  }

  const heal = o.hp < 60 ? juiceNear(o, 9) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);
  if (g.kind === 'lift' && g.d < 1) return { ...act, turn: 0, move: 0, jump: hop };

  if (stuckTicks(o, m, 25) && (g.kind !== 'lift' || g.d > 2) && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return { ...act, turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.5 : edge ? 0 : 0.8, jump: m.esc % 4 === 0 && o.ground };
  }

  const cs = g.kind === 'crane-step' && (g.stepY || 0) - o.y > 0.8;
  const crane = (cs && g.d < 3.5 && Math.abs(g.b) < 0.5) || (g.kind === 'crane-step' && g.d < 2.5);
  const side = g.kind === 'crane-step' ? 9 : tb > 0 ? o.drop.r : o.drop.l;
  const mv = edge ? 0 : Math.abs(tb) > 1.8 ? 0.4 : side < 0.8 ? 0.7 : 1;
  return { ...act, turn: clampU(tb * 2.7), move: mv, jump: (hop || crane) && o.ground };
}
