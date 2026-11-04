// score 0.375  trigger 0.05  pace 0.59  (2846 chars)
// runner: sprint at the goal, ignore most toys, fire in short bursts (steady at the boss), jump anything winding up; ladders: face west and push in; hanging/carried: jump out
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const fire = !!o.aim.hit && (m.n % 16 === 0 || (m.n % 5 === 0 && o.foes.some(f => f.k === 'boss')));
  if (o.carried || o.hang) return { turn: 0, move: 0, fire, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire, jump: m.n % 2 === 0 };
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }
  const bw = o.foes.find(f => f.k === 'boss');
  if (bw && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = /slam|windup|crouch|rev/.test(bw.st) && bw.d < 9;
    const mv = bw.d < 5 ? -1 : bw.d > 9 ? 1 : (bw.band ? 0 : -0.5);
    const swirl = bw.d < 9 && bw.d > 5 ? 0.15 : 0;
    const useB = o.inv.length > 0 && bw.d < 9 && Math.abs(bw.b) < 0.5 && m.n - (m.u || -99) > 25;
    if (useB) m.u = m.n;
    return { turn: clampU(bw.b * 3 + swirl), move: Math.abs(bw.b) > 1.2 && mv > 0 ? 0 : mv, fire, jump: (atk || shotDanger(o, 3, 0.6)) && o.ground, use: useB, sel: 0 };
  }
  const ramp = /stairs|spring|crane|lift|ladder/.test(g.kind);
  const edge = o.drop.f < 1 && !ramp;
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || o.foes.some(f => f.st === 'slam' && f.d < 5) || shotDanger(o, 3, 0.6);
  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: false };
  // stuck: back off and wiggle for 15 ticks (direction flips each escape), then retry the goal
  const stuck = stuckTicks(o, m, 30) && g.kind !== 'lift';
  if (stuck && !(m.esc > 0)) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 8 ? -0.7 : (edge ? 0 : 0.7), fire, jump: m.esc % 4 === 0 && o.ground };
  }
  // loot: juice when hurt, other pickups when no foe is close; use pickups on a big or crowding threat
  const quiet = !o.foes.some(f => f.awake && f.d < 8);
  const heal = o.hp < 60 ? juiceNear(o, 9) : null;
  const loot = quiet ? o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5) : null;
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const big = o.foes.find(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.4 && /golem|car/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 25;
  if (useItem) m.u = m.n;
  const mv = edge ? 0 : Math.abs(tb) < 1.6 ? 0.85 : 0.4;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: (hop || telegraphed(o, 6)) && o.ground, use: useItem, sel: 0 };
}
