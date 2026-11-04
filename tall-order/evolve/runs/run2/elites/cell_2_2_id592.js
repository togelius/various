// score 0.499  trigger 0.15  pace 0.30  (3243 chars)
// Hybrid climber: ladder/lift/boss handling, target firing, telegraph dodges, edge turns
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 20);
  const tele = telegraphed(o, 4);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const tgt = nearestHittable(o);

  // use slot 0 when a big toy is close in front or 3+ foes crowd in; 20-tick cooldown
  const big = o.foes.some(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.6 && /golem|car|boss/.test(f.k || ''));
  const crowd = o.foes.filter(f => f.awake && f.d < 5).length >= 3;
  const useIt = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useIt) m.u = m.n;

  // fire when the blaster holds a target: the boss, or any hittable foe within 8 m
  const fire = !!o.aim.hit && (!!boss || (!!tgt && tgt.d < 8));

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.6 : boss.d < 5 ? -0.4 : 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return {
      turn: steerTo(boss.b + weave, 2.5),
      move: o.drop.f < 2 && mv > 0 ? 0 : mv,
      fire, jump: wave || tele, use: useIt, sel: 0,
    };
  }

  // ladder: face west and push into the lattice
  const e = wrapA(Math.PI - o.yaw);
  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire, jump: false };
  }

  // lift: stand still as it rises
  if (g.kind === 'lift' && g.d < 1.2) {
    return { turn: steerTo(g.b, 2), move: 0, fire, jump: tele, use: useIt, sel: 0 };
  }

  const ramp = /stairs|spring|crane/.test(g.kind);

  // stuck: on ramps keep pushing at the goal, elsewhere wiggle and hop
  if (stuck) {
    if (ramp) return { turn: steerTo(g.b, 2.5), move: 1, fire, jump: m.n % 6 < 3, use: useIt, sel: 0 };
    return { turn: Math.sin(m.n * 0.7), move: o.drop.f < 1.5 ? 0 : 0.6, fire, jump: true };
  }

  // juice when hurt, or any close item when no awake foe is within 5 m
  const safe = !o.foes.some(f => f.awake && f.d < 5);
  const heal = o.hp < 65 ? juiceNear(o, 7) : null;
  const pick = heal || (safe ? o.items.find(i => i.d < 4) : null);
  const tb = pick ? pick.b : g.b;

  // ledge ahead: stop and turn toward the longer drop-free side
  const edge = o.drop.f < 1.5 && !ramp;
  if (edge) {
    return { turn: o.drop.r > o.drop.l ? 0.7 : -0.7, move: 0, fire, jump: tele, use: useIt, sel: 0 };
  }

  // pace: brisk when lined up, slower when turning hard or a foe is in front
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const near = !!tgt && tgt.d < 2 && !ramp;
  let move = Math.abs(tb) >= 1.4 ? 0.2 : Math.abs(tb) < 0.5 ? 1 : 0.6;
  if (g.kind === 'spring' && g.d < 2) move = 1;
  if (near) move = Math.min(move, 0.4);
  return { turn: steerTo(tb, 2.5), move, fire, jump: hop || tele, use: useIt, sel: 0 };
}
