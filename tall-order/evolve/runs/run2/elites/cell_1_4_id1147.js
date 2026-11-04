// score 0.396  trigger 0.03  pace 0.65  (2868 chars)
// runner: sprint at the goal, ignore most toys, fire in short bursts (steady at the boss), jump anything winding up; ladders: face west and push in; hanging/carried: jump out
// merged runner: rare shots (steady on the boss), jump anything winding up, ladders face west and push, one stuck-escape path
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const bw = o.foes.find(f => f.k === 'boss');
  const fire = !!o.aim.hit && (m.n % 64 === 0 || (m.n % 5 === 0 && !!bw));
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    if (g.kind === 'ladder-approach' && g.d > 1 && Math.abs(wrapA(Math.PI - o.yaw)) > 0.5) {
      return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.5 : 0, fire, jump: false };
    }
    return { ...ladderSteer(o), fire, jump: false };
  }
  if (bw && o.floor === 5 && !/crane-step|flag/.test(g.kind)) {
    const useB = o.inv.length > 0 && bw.d < 9 && Math.abs(bw.b) < 0.5 && m.n - (m.u || -99) > 25;
    if (useB) m.u = m.n;
    const mv = bw.d < 5 ? -1 : bw.d > 9 ? 1 : bw.band ? 0 : -0.5;
    return {
      turn: clampU(bw.b * 3 + (bw.d > 5 && bw.d < 9 ? 0.15 : 0)),
      move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv,
      fire, jump: telegraphed(o, 9) && o.ground, use: useB, sel: 0,
    };
  }
  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: false };
  const edge = o.drop.f < 1 && !/stairs|spring|crane|lift|ladder/.test(g.kind);
  // stuck: back off and wiggle for 15 ticks (direction flips each escape), then retry the goal
  if (stuckTicks(o, m, 30) && g.kind !== 'lift' && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7), fire, jump: m.esc % 4 === 0 && o.ground };
  }
  // loot: juice when hurt, other pickups when no foe is close; use pickups on a big or crowding threat
  const quiet = !o.foes.some(f => f.awake && f.d < 8);
  const heal = o.hp < 60 ? juiceNear(o, 9) : null;
  const loot = quiet ? o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5) : null;
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const big = o.foes.some(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.4 && /golem|car/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 25;
  if (useItem) m.u = m.n;
  const mv = edge ? 0 : Math.abs(tb) < 1.6 ? 0.95 : 0.5;
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 6);
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, use: useItem, sel: 0 };
}
