// score 0.598  trigger 0.93  pace 0.42  (2837 chars)
// Merged climber: fires whenever a foe is near (the blaster only hits what is in its band), dodges telegraphed attacks,
// fights the boss with a weave and periodic pickups, uses items on big threats, grabs juice when hurt or nearby items when calm.
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.dead) return {};
  const stuck = stuckTicks(o, m, 25);
  if (o.carried) return { jump: true };
  if (o.hang) return { jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, jump: m.n % 2 === 0 };
  const fire = o.foes.some(f => f.awake && f.d < 12);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const front = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6);
  const threat = front.length >= 3 || front.some(f => /golem|car|boss/.test(f.k) && f.d < 6);
  const si = o.inv.findIndex(i => i.n > 0 && i.k !== 'balloon');
  const bossUse = !!boss && boss.d < 12 && m.n % 25 === 0;
  const pk = si >= 0 ? { sel: si, use: (threat && m.n % 4 === 0) || bossUse } : {};
  if (o.climbing || g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2)) {
    return { ...ladderSteer(o), fire, jump: false, ...pk };
  }
  if (boss && boss.d < 14 && o.floor === 5 && !/crane|flag/.test(g.kind)) {
    const ang = Math.atan2(boss.dy, boss.d);
    let mv = boss.d > 9 ? 0.8 : boss.d < 6 ? -0.6 : 0.2;
    if (!boss.band && Math.abs(ang) > 0.15 && boss.d < 12) mv = -0.6;
    if (mv > 0 && o.drop.f < 2) mv = 0;
    const weave = Math.floor(o.t / 3) % 2 ? 0.15 : -0.15;
    return {
      turn: steerTo(boss.b + weave, 2.5),
      move: mv,
      fire,
      jump: telegraphed(o, 5) && o.ground,
      ...pk,
    };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire, jump: false, ...pk };
  if (stuck && !(m.esc > 0) && g.kind !== 'lift' && !boss) { m.esc = 15; m.dir = -(m.dir || 1); m.c = -25; }
  const edge = ledgeAhead(o, g);
  if (m.esc > 0) {
    m.esc--;
    return {
      turn: clampU(m.dir * 0.8),
      move: m.esc > 8 ? -0.7 : edge ? 0 : 0.7,
      fire,
      jump: m.esc % 4 === 0 && o.ground,
      ...pk,
    };
  }
  const hop = (g.kind === 'crane-step' && g.d < 2.5) || telegraphed(o, 5);
  const calm = !o.foes.some(f => f.awake && f.d < 4);
  const heal = o.items.find(i => i.k === 'juice' && i.d < 9 && Math.abs(i.dy) < 1.5);
  const grab = o.items.find(i => i.k !== 'juice' && i.d < 5 && Math.abs(i.dy) < 1.5);
  const healNow = heal && (o.hp < 55 || (calm && o.hp < 80)) ? heal : null;
  const item = healNow || (calm && o.shots.length === 0 ? grab : null);
  const tb = item && !edge ? item.b : g.b;
  const slow = o.foes.some(f => f.awake && f.d < 3);
  const mv = edge ? 0 : Math.abs(tb) < 1.4 ? (slow ? 0.5 : 0.85) : 0.3;
  return { turn: clampU(tb * 2.5), move: mv, fire, jump: hop && o.ground, ...pk };
}
