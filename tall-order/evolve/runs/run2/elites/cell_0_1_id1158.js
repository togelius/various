// score 0.457  trigger 0.02  pace 0.22  (2797 chars)
// Slow, mostly non-firing climber: special states first; ladder: face west and push in; lift: stand still; creep toward goal at ~1/3 pace; fire only at boss
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  const moved = Math.hypot(o.x - (m.px === undefined ? o.x : m.px), o.z - (m.pz === undefined ? o.z : m.pz));
  m.px = o.x;
  m.pz = o.z;
  m.c = moved < 0.03 ? (m.c || 0) + 1 : 0;
  const stuck = m.c > 12;
  if (o.dead) return {};
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const fire = !!o.aim.hit && !!boss && boss.band && m.n % 10 === 0;
  const big = o.foes.find(f => f.awake && f.d < 6 && Math.abs(f.b) < 0.4 && /golem|car|boss/.test(f.k));
  const crowd = o.foes.filter(f => f.awake && f.d < 7 && Math.abs(f.b) < 0.6).length > 2;
  const useItem = o.inv.length > 0 && (big || crowd) && m.n - (m.u || -99) > 20;
  if (useItem) m.u = m.n;

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.3 : boss.d < 5 ? -0.3 : 0;
    return { turn: clampU(boss.b * 3), move: o.drop.f < 2 && mv > 0 ? 0 : mv, fire, jump: wave || threat, use: useItem, sel: 0 };
  }

  const e = wrapA(Math.PI - o.yaw);
  const atLadder = g.kind === 'ladder' ? g.d < 2.5 : g.kind === 'ladder-approach' && g.d < 1.2;
  if (o.climbing || atLadder) {
    return { turn: clampU(e * 3), move: Math.abs(e) < 0.5 ? 1 : 0, fire: false, jump: false };
  }

  if (g.kind === 'lift' && g.d < 1.2) return { turn: steerTo(g.b, 2), move: 0, fire: false, jump: threat };

  if (stuck && !(m.esc > 0)) { m.esc = 14; m.dir = -(m.dir || 1); m.c = -25; }
  if (m.esc > 0) {
    m.esc--;
    return { turn: clampU(m.dir * 0.8), move: m.esc > 7 ? -0.6 : o.drop.f < 1.5 ? 0 : 0.6, fire: false, jump: m.esc % 4 === 0 && o.ground };
  }

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const quiet = !o.foes.some(f => f.awake && f.d < 8);
  const loot = quiet ? o.items.find(i => i.d < 6 && Math.abs(i.b) < 1.5) : undefined;
  const tb = heal ? heal.b : loot ? loot.b : g.b;
  const hop = threat || (g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  const walk = g.kind === 'spring' && g.d < 2 ? 1 : edge ? 0 : Math.abs(tb) < 1.2 ? 1 : 0.6;
  return { turn: steerTo(tb, 2), move: walk, fire: false, jump: hop, use: useItem, sel: 0 };
}
