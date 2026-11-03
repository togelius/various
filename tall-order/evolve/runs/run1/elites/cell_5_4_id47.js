// score 0.212  trigger 0.75  pace 0.56  (2603 chars)
// rider: shake and jump; carried/hang: jump out; boss: hold range, arc, shoot, jump telegraphed attacks;
// stuck: hop and wander; ladder: face west and push in; lift: stand still;
// otherwise walk at a steady pace toward the goal, firing only at targets in band
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: true, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const stuck = stuckTicks(o, m, 25);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.filter(f => f.awake && f.d < 10);
  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) ||
                 o.shots.some(s => s.shootable !== false && s.d < 3);
  const fire = m.n % 4 !== 0; // spray: hold trigger on 3 of every 4 ticks
  // use the selected pickup when outnumbered or facing the boss, at most every 20 ticks
  const use = !!((boss || near.length >= 2) && o.inv.length > 0 && m.n - (m.u || -99) > 20);
  if (use) m.u = m.n;
  const out = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), jump, fire, use, sel: 0 });

  if (boss) {
    // circle at range 6-9 with a sideways arc; keep shooting; jump telegraphed shockwaves and close shells
    const arc = Math.floor(o.t / 3) % 2 ? 0.35 : -0.35;
    const want = boss.d < 6 ? -0.8 : boss.d > 9 ? 0.8 : 0.4;
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const shell = o.shots.some(s => s.d < 3 && Math.abs(s.b) < 0.6);
    return out(boss.b * 3 + arc, want > 0 && o.drop.f < 2 ? 0 : want, wave || shell || threat);
  }

  // stuck escape: no vertical progress for ~2.5 s, so hop and wander
  if (stuck) return out(Math.sin(m.n * 0.7), edge ? 0 : 0.7, true);

  const e = wrapA(Math.PI - o.yaw);
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, threat); // face west, then push in
  }

  // grab nearby juice when hurt, otherwise head for the goal
  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 6) : undefined;
  const tb = heal ? heal.b : g.b;
  if (g.kind === 'lift' && g.d < 1.2) return out(tb * 2, 0, threat);

  // crane steps are stepping stones over air: hop onto them
  const climb = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const walk = !edge && Math.abs(tb) < 1.2 ? 1 : 0.6;
  return out(tb * 2, edge ? 0 : walk, climb || threat);
}
