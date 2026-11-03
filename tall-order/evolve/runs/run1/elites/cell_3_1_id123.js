// score 0.322  trigger 0.18  pace 0.20  (2547 chars)
// special states first (carried/hang, rider), then boss, ladder, lift, stuck recovery,
// melee pests, healing/items, otherwise walk steadily to the goal and keep firing
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const stuck = stuckTicks(o, m, 28);
  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.filter(f => f.awake && f.d < 10);
  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => !s.shootable && s.d < 3);
  const fire = !!o.aim.hit || near.some(f => f.band && Math.abs(f.b) < 0.4);
  const use = !!((boss || near.length >= 2) && o.inv.length > 0 && m.n - (m.u || -99) > 20);
  if (use) m.u = m.n;
  const out = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), jump: !!jump, fire, use, sel: 0 });

  if (boss) {
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const mv = boss.d > 8 ? 0.5 : boss.d < 5 ? -0.5 : 0;
    return out(boss.b * 3, mv > 0 && o.drop.f < 2 ? 0 : mv, wave || threat);
  }

  // ladder: face west (yaw ~ PI) and push in
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, false);
  }

  // lift: stand still on it
  if (g.kind === 'lift' && g.d < 1.2) return out(g.b * 2, 0, threat);

  if (stuck) return out(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.5, true);

  // close fast melee toys: face them, back off a little if safe
  const pest = near.filter(f => f.d < 4 && Math.abs(f.dy) < 2 && /kitty|wolf|bee/.test(f.k))
    .sort((a, b) => a.d - b.d)[0];
  if (pest && !ramp && g.kind !== 'lift') {
    const back = pest.d < 1.5 && o.drop.l > 1.5 && o.drop.r > 1.5 && o.drop.f > 1.5 ? -0.4 : 0;
    return out(pest.b * 3, back, threat || pest.st === 'dive');
  }

  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const calm = !near.some(f => f.d < 5);
  const it = heal || (calm ? o.items.find(i => i.d < 3) : undefined);
  const tb = it ? it.b : g.b;

  const hop = threat || (!it && g.kind === 'crane-step' && g.d < 1.5 && o.ground);
  const walk = edge && !it ? 0 : Math.abs(tb) < 0.5 ? 0.7 : Math.abs(tb) < 1.2 ? 0.3 : 0;
  return out(tb * 2, walk, hop);
}
