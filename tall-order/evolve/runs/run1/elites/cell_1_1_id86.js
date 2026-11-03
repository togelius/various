// score 0.329  trigger 0.07  pace 0.21  (2895 chars)
// slow, deliberate climber: holds fire only at the boss or a foe winding up an attack;
// rider: shake and jump; carried/hang: jump out; boss: circle and shoot; ladder: face west and push in;
// lift: stand still; stuck: hop and wander; otherwise steer to the goal at about a third pace, grabbing juice when hurt
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const stuck = stuckTicks(o, m, 25);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  // shoot only at the boss, or at a close foe that is telegraphing an attack
  const winding = o.foes.some(f => f.awake && f.band && f.d < 6 && /wind|rev|slam|throw|dive|crouch/.test(f.st || ''));
  const fire = !!o.aim.hit && (!!boss || winding);
  const near = o.foes.filter(f => f.awake && f.d < 10);
  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => s.d < 3);
  // use the selected pickup when outnumbered or facing the boss, at most every 20 ticks
  const use = !!((boss || near.length >= 2) && o.inv.length > 0 && m.n - (m.u || -99) > 20);
  if (use) m.u = m.n;
  const out = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), jump, fire, use, sel: 0 });

  if (boss) {
    // circle at range 6-9 with a sideways arc; shoot when in band; jump telegraphed shockwaves
    const arc = Math.floor(o.t / 3) % 2 ? 0.35 : -0.35;
    const want = boss.d < 6 ? -0.8 : boss.d > 9 ? 0.8 : 0.4;
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    return out(boss.b * 3 + arc, want > 0 && o.drop.f < 2 ? 0 : want, wave || threat);
  }

  // ladders: face west and push in once aligned; no hopping on the lattice
  const lattice = g.kind === 'ladder' || g.kind === 'ladder-approach';
  if (lattice && (g.kind === 'ladder' || g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, false);
  }

  // stuck escape: no vertical progress for ~2.5 s, so hop and wander
  if (stuck) return out(Math.sin(m.n * 0.7), edge ? 0 : 0.5, true);

  // grab nearby juice when hurt (below 50), otherwise head for the goal
  const heal = o.hp < 50 ? o.items.find(i => i.k === 'juice' && i.d < 5) : undefined;
  const tb = heal ? heal.b : g.b;
  if (g.kind === 'lift' && g.d < 1.2) return out(tb * 2.5, 0, threat);

  // crane steps are stepping stones over air: hop onto them
  const climb = g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  // slow pace: about a third of full speed when roughly facing the goal, a crawl on turns
  const walk = !edge && Math.abs(tb) < 1.2 ? 0.35 : 0.1;
  return out(tb * 2.5, edge ? 0 : walk, climb || threat);
}
