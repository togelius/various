// score 0.181  trigger 0.46  pace 0.40  (2771 chars)
// B's brisk walk, ladder/lift handling and stuck escape; A's boss arc, pickups and close-pest turning. Fire whenever a foe is in band.
function step(o, m) {
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };
  const g = o.goal;
  const stuck = stuckTicks(o, m, 25);
  const near = o.foes.filter(f => f.awake && f.d < 10);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const pest = near.filter(f => f.d < 4 && Math.abs(f.dy) < 2 && /kitty|wolf|bee/.test(f.k)).sort((a, b) => a.d - b.d)[0];
  const fire = !!o.aim.hit || near.some(f => f.band);
  const threat = o.foes.some(f => (f.st === 'slam' && f.d < 5) || (f.st === 'dive' && f.d < 3)) || shotDanger(o, 3, 0.6) || o.shots.some(s => s.d < 2);
  const use = !!((boss || near.length >= 2 || o.hp < 40) && o.inv.length > 0 && m.n - (m.u || -99) > 15);
  if (use) m.u = m.n;
  const ret = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), fire, jump, use, sel: 0 });

  // boss: circle at range 6-9 with a sideways arc, jump telegraphed shockwaves
  if (boss) {
    const arc = Math.floor(o.t / 3) % 2 ? 0.35 : -0.35;
    const want = boss.d < 6 ? -0.8 : boss.d > 9 ? 0.8 : 0.4;
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    return ret(boss.b * 3 + arc, want > 0 && o.drop.f < 2 ? 0 : want, wave || threat);
  }

  // stuck escape: no vertical progress for ~2.5 s, so hop and wander
  if (stuck && g.kind !== 'lift') return ret(Math.sin(m.n * 0.7), o.drop.f < 1.5 ? 0 : 0.8, true);

  // ladders: face west and push in once aligned
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 3)) {
    const e = wrapA(Math.PI - o.yaw);
    return ret(e * 3, Math.abs(e) < 0.5 ? 1 : 0, false);
  }

  // lift: stand still as it rises
  if (g.kind === 'lift' && g.d < 1.2) return ret(steerTo(g.b, 2.5), 0, threat);

  // walk toward pickups (when calm or healing) or the goal; turn to close pests but keep moving
  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const calm = !near.some(f => f.d < 5);
  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const it = heal || (calm ? o.items.find(i => i.d < 4) : undefined);
  let tb = it ? it.b : g.b;
  if (pest && pest.d < 3 && !it) tb = pest.b;
  // crane steps are stepping stones over air: hop onto them
  const hop = g.kind === 'crane-step' && g.d < 1.5 && o.ground && !it;
  return ret(steerTo(tb, 2.5), edge ? 0 : Math.abs(tb) < 1.2 ? 0.9 : 0.25, threat || hop || (pest && pest.st === 'dive'));
}
