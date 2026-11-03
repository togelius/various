// score 0.141  trigger 0.16  pace 0.41  (2813 chars)
// rider: shake and jump; carried/hang: jump out; boss: circle, shoot, hop shockwaves; ladder: face west, push in;
// stuck: hop and wander; fast melee toys in close range: face them, back off if cornered;
// otherwise steady walk to goal, grabbing juice when hurt or items when calm, firing at targets in band
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
  const fire = !!o.aim.hit || near.some(f => f.band && Math.abs(f.b) < 0.5);
  const use = !!((boss || near.length >= 2) && o.inv.length > 0 && m.n - (m.u || -99) > 20);
  if (use) m.u = m.n;
  const out = (turn, move, jump) => ({ turn: clampU(turn), move: clampU(move), jump, fire, use, sel: 0 });

  if (boss) {
    const arc = Math.floor(o.t / 3) % 2 ? 0.35 : -0.35;
    const want = boss.d < 6 ? -0.8 : boss.d > 9 ? 0.8 : 0.4;
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    return out(boss.b * 3 + arc, want > 0 && o.drop.f < 2 ? 0 : want, wave || threat);
  }

  // ladder: face west and push in (approach only once close)
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 2.5)) {
    const e = wrapA(Math.PI - o.yaw);
    return out(e * 3, Math.abs(e) < 0.5 ? 1 : 0, false);
  }

  if (stuck) return out(Math.sin(m.n * 0.7), edge ? 0 : 0.7, true);

  // close-range fight vs fast melee toys: face them and hold ground
  const pest = near.filter(f => f.d < 5 && Math.abs(f.dy) < 2 && /kitty|wolf|bee/.test(f.k))
    .sort((a, b) => a.d - b.d)[0];
  if (pest && !ramp && g.kind !== 'lift') {
    const back = pest.d < 1.5 && o.drop.l > 1.5 && o.drop.r > 1.5 ? -0.5 : 0;
    return out(pest.b * 3, back, threat || pest.st === 'dive');
  }

  // juice when hurt; other items when calm; otherwise the goal
  const heal = o.hp < 60 ? o.items.find(i => i.k === 'juice' && i.d < 7) : undefined;
  const calm = !near.some(f => f.d < 5);
  const it = heal || (calm ? o.items.find(i => i.d < 4) : undefined);
  const tb = it ? it.b : g.b;
  if (!it && g.kind === 'lift' && g.d < 1.2) return out(tb * 2, 0, threat);

  // crane steps are stepping stones over air: hop onto them
  const climb = !it && g.kind === 'crane-step' && g.d < 1.5 && o.ground;
  const walk = !edge && Math.abs(tb) < 1.2 ? 0.9 : 0.25;
  return out(tb * 2, edge && !it ? 0 : walk, climb || threat);
}
