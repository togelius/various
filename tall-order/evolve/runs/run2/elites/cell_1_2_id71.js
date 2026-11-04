// score 0.249  trigger 0.07  pace 0.27  (2658 chars)
// specials first; boss circling; close-range fight vs fast toys; ladder; stuck escape;
// otherwise steady walk to goal, heal/pickup items, fire when a target is in band
function step(o, m) {
  const g = o.goal;
  m.n = (m.n || 0) + 1;
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 2 === 0 };

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  const stuck = stuckTicks(o, m, 25);
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const near = o.foes.filter(f => f.awake && f.d < 10);
  const threat = o.foes.some(f => f.st === 'slam' && f.d < 5) || o.shots.some(s => s.d < 3);
  const fire = !!o.aim.hit && (m.n % 2 === 0 || !!boss);
  const big = near.some(f => Math.abs(f.b) < 0.6 && (f.k === 'golem' || f.k === 'car' || f.k === 'boss'));
  const use = !!((boss || big || near.length >= 2) && o.inv.length > 0 && m.n - (m.u || -99) > 15);
  if (use) m.u = m.n;
  const out = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), jump, fire, use, sel: 0 });

  if (boss) {
    const arc = Math.floor(o.t / 3) % 2 ? 0.35 : -0.35;
    const want = boss.d < 6 ? -0.8 : boss.d > 9 ? 0.6 : 0.3;
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    return out(boss.b * 3 + arc, want > 0 && o.drop.f < 2 ? 0 : want, wave || threat);
  }

  const lattice = g.kind === 'ladder' || g.kind === 'ladder-approach';
  if (lattice && (g.kind === 'ladder' || g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, false);
  }

  if (stuck) return out(Math.sin(m.n * 0.7), edge ? 0 : 0.7, true);

  // close-range fight: face fast melee toys that are in reach, hold ground and shoot
  const pest = near.filter(f => f.d < 4 && Math.abs(f.dy) < 2 && /kitty|wolf|bee/.test(f.k))
    .sort((a, b) => a.d - b.d)[0];
  if (pest && !ramp && g.kind !== 'lift') {
    const back = pest.d < 2 && o.drop.l > 1.5 && o.drop.r > 1.5 ? -0.5 : 0;
    return out(pest.b * 3, back, threat || pest.st === 'dive');
  }

  const heal = o.hp < 70 ? o.items.find(i => i.k === 'juice' && i.d < 8) : undefined;
  const calm = !o.foes.some(f => f.awake && f.d < 5);
  const it = heal || (calm ? o.items.find(i => i.d < 4) : undefined);
  const tb = it ? it.b : g.b;
  if (!it && g.kind === 'lift' && g.d < 1.2) return out(tb * 2, 0, threat);

  const climb = !it && g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const walk = !edge && Math.abs(tb) < 1.2 ? 0.55 : 0.2;
  return out(tb * 2, edge && !it ? 0 : walk, climb || threat);
}
