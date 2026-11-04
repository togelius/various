// score 0.885  trigger 0.34  pace 0.57  (3421 chars)
// Brisk climber: B's sprint, kiting and dodges; A's ladder steering and steady boss fire
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const stuck = stuckTicks(o, m, 25); // called every tick so the counter stays valid
  if (o.dead) return {};
  const pulse = m.n % 2 === 0;
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.some(f => f.awake && f.d < 12);
  // fire whenever the band holds the boss or a live foe close by
  const fire = !!o.aim.hit && (!!boss || o.foes.some(f => f.awake && f.d < 8));

  // special states first
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: pulse };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: pulse };

  // ladder: face west and push in (A's rule); close approach hands over to it
  const atLadder = o.climbing || (g.kind === 'ladder' && g.d < 2.5) || (g.kind === 'ladder-approach' && g.d < 1.2);
  if (atLadder) {
    const L = ladderSteer(o);
    return { turn: L.turn, move: L.move, fire, jump: false };
  }
  // far from the ladder foot: walk to it without edge braking
  if (g.kind === 'ladder-approach') {
    return { turn: steerTo(g.b, 2.5), move: Math.abs(g.b) < 1 ? 0.7 : 0.2, fire, jump: telegraphed(o, 4) && o.ground };
  }

  // boss room on the top floor: kite it, jump its attacks, use pickups now and then
  if (boss && o.floor === 5 && g.kind !== 'crane-step' && g.kind !== 'flag') {
    const atk = boss.d < 9 && /slam|wind|crouch|rev|shock|stomp/.test(boss.st || '');
    const useNow = o.inv.length > 0 && m.n - (m.u || -99) > 25;
    if (useNow) m.u = m.n;
    const swirl = boss.d < 9 && boss.d > 5 ? 0.15 : 0;
    let mv = boss.d < 3 ? -0.5 : 0.8;
    if (mv > 0 && (Math.abs(boss.b) > 1.2 || o.drop.f < 2)) mv = 0;
    return {
      turn: clampU(boss.b * 3 + swirl),
      move: mv,
      fire,
      jump: (atk || telegraphed(o, 4)) && o.ground,
      use: useNow,
      sel: 0,
    };
  }

  // lift: stand still and let it carry us; hop only to dodge
  if (g.kind === 'lift' && g.d < 1) return { turn: 0, move: 0, fire, jump: telegraphed(o, 4) && o.ground };

  // stuck: back off and wiggle
  if (stuck && !(m.esc > 0) && g.kind !== 'lift') { m.esc = 15; m.dir = -(m.dir || 1); m.c = -30; }
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : (o.drop.f < 1.5 ? 0 : 0.7),
      fire,
      jump: m.esc % 4 === 0 && o.ground,
    };
  }

  // target: juice when hurt, loot when quiet, otherwise the goal
  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 9) : undefined;
  const loot = !near && o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5);
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const edge = ledgeAhead(o, g) || (o.drop.f < 2.5 && o.ground && !/stairs|spring|lift/.test(g.kind));

  // hop over telegraphed attacks, kitty pounces, and crane steps
  const pounce = o.foes.some(f => f.k === 'kitty' && f.awake && f.d < 2.5 && f.dy > -0.5);
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5) || pounce;

  // spring: square up to the pad and hit it at full speed
  const springRun = g.kind === 'spring' && g.d < 2;
  const fast = Math.abs(tb) < 1.6 || springRun;
  const turn = springRun ? steerTo(g.b, 4) : clampU(tb * 2.5);
  const move = edge ? 0 : fast ? 1 : 0.9;
  return { turn, move, fire, jump: hop && o.ground };
}
