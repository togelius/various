// score 0.558  trigger 0.60  pace 0.42  (2675 chars)
// Hybrid climber: brisk, fires when something is in the band, ladder-aware, jumps telegraphed attacks
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const stuck = stuckTicks(o, m, 20) && !(g.kind === 'lift' && g.d < 1.5);
  const near = o.foes.some(f => f.awake && f.d < 10);
  const fire = !!o.aim.hit || (near && m.n % 2 === 0);
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };

  const e = wrapA(Math.PI - o.yaw);
  if (o.climbing || g.kind === 'ladder') return Object.assign({ fire, jump: false }, ladderSteer(o));
  if (g.kind === 'ladder-approach' && g.d < 3) {
    if (g.d > 1.2 && Math.abs(e) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.7 : 0.1, fire, jump: false };
    }
    return Object.assign({ fire, jump: false }, ladderSteer(o));
  }

  const bw = o.foes.find(f => f.k === 'boss' && f.awake);
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    let mv = bw.d < 4 ? -0.6 : bw.d > 9 ? 0.8 : 0.3;
    if (o.drop.f < 2 || (mv > 0 && Math.abs(bw.b) > 1.2)) mv = 0;
    return {
      turn: clampU(bw.b * 3), move: mv, fire: true,
      jump: telegraphed(o, 5) && o.ground, use: useNow, sel: 0,
    };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) };
  if (stuck) return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.8, fire, jump: true };

  const heal = o.hp < 60 ? juiceNear(o, 8) : null;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5 && Math.abs(i.dy) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g);
  const hop = (g.kind === 'crane-step' && g.d < 2) || telegraphed(o, 4) ||
    o.foes.some(f => f.k === 'kitty' && f.d < 2.5 && Math.abs(f.dy) < 1.5);

  const bad = o.foes.find(f => f.awake && f.d < 3.5 && Math.abs(f.dy) < 2 &&
    (f.k === 'golem' || (f.k === 'car' && /rev|charge/.test(f.st || ''))));
  if (bad && o.drop.f > 3 && !edge) {
    return { turn: clampU(bad.b * 2), move: -0.5, fire, jump: hop && o.ground };
  }

  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car/.test(f.k));
  const useItem = o.inv.length > 0 && big && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;
  const ab = Math.abs(tb);
  const move = edge ? 0 : ab > 1.4 ? 0 : ab > 0.8 ? 0.5 : 0.85;
  return { turn: steerTo(tb, 3), move, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
