// score 0.290  trigger 0.17  pace 0.41  (2243 chars)
// special states first; boss: hold range, arc, shoot, jump shockwaves; ladder: face west; lift: stand; else brisk walk to goal
function step(o, m) {
  m.n = (m.n || 0) + 1;
  const g = o.goal;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 3 === 0 };

  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  const slam = o.foes.some(f => /slam|shock|stomp/.test(f.st || '') && f.d < 5);
  const shell = o.shots.some(s => s.d < 3 && Math.abs(s.b) < 0.7);
  const near = o.foes.filter(f => f.awake && f.d < 10);
  const stuck = stuckTicks(o, m, 25);
  const fire = !!o.aim.hit && (m.n % 3 !== 0 || !!boss);
  const use = !!((boss || near.length >= 2) && o.inv.length > 0 && m.n - (m.u || -99) > 15);
  if (use) m.u = m.n;
  const out = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), jump: !!jump, fire, use, sel: 0 });

  if (boss) {
    const arc = Math.floor(o.t / 3) % 2 ? 0.3 : -0.3;
    const want = !boss.band ? -0.7 : boss.d < 6 ? -0.8 : boss.d > 9 ? 0.7 : 0.35;
    const wave = boss.d < 14 && /slam|wind|shock|stomp|jump|leap|crouch/.test(boss.st || '');
    const r = out(boss.b * 3 + arc, want > 0 && o.drop.f < 2 ? 0 : want, wave || shell || slam);
    r.fire = !!o.aim.hit || boss.band;
    return r;
  }

  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, slam);
  }
  if (g.kind === 'lift' && g.d < 1.2) {
    const t = nearestHittable(o);
    return out(steerTo(t ? t.b : g.b, 2), 0, slam);
  }

  const ramp = /stairs|spring|crane/.test(g.kind);
  const edge = o.drop.f < 1.5 && !ramp;
  if (stuck && g.kind !== 'lift') return out(Math.sin(m.n * 0.7), edge ? 0 : 0.8, true);

  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 6) : undefined;
  const tb = heal ? heal.b : g.b;
  const hop = !heal && g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const move = edge ? 0 : Math.abs(tb) < 0.5 ? 1 : Math.abs(tb) < 1.2 ? 0.6 : 0.1;
  return out(tb * 2, move, hop || slam || shell);
}
