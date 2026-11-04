// score 0.222  trigger 0.44  pace 0.16  (1838 chars)
// special states first; ladders: face west and push in; lift: stand still; otherwise walk slowly toward the goal, firing heavily
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function clamp(v) { return Math.max(-1, Math.min(1, v)); }
function step(o, m) {
  m.n = (m.n || 0) + 1;
  if (o.carried) return { turn: 0, move: 0, fire: false, jump: true };
  if (o.hang) return { turn: 0, move: 0, fire: false, jump: m.n % 2 === 0 };
  if (o.rider) return { turn: m.n % 4 < 2 ? -1 : 1, move: 0, fire: false, jump: m.n % 3 === 0 };
  // boss: circle at range, face it, keep firing, jump its slam/shockwave telegraphs
  const boss = o.foes.find(f => f.k === 'boss' && f.awake);
  if (boss) {
    const arc = Math.floor(o.t / 3) % 2 ? 0.4 : -0.4;
    const want = boss.d < 6 ? -0.8 : boss.d > 9 ? 0.8 : 0.3;
    const wave = boss.d < 14 && /slam|wind|shock|stomp/.test(boss.st || '');
    const close = o.foes.some(f => f.st === 'slam' && f.d < 4);
    const move = want > 0 && o.drop.f < 2 ? 0 : want;
    return { turn: clamp(boss.b * 3 + arc), move, fire: !!boss.band || !!o.aim.hit, jump: wave || close };
  }
  const g = o.goal;
  const near = o.foes.find(f => f.awake && f.d < 10);
  const fire = !!o.aim.hit || (!!near && m.n % 2 === 0);
  const slam = o.foes.some(f => f.st === 'slam' && f.d < 4);
  if (g.kind === 'ladder' || g.kind === 'ladder-approach') {
    const e = wrap(Math.PI - o.yaw);
    const ok = Math.abs(e) < 0.5;
    return { turn: clamp(e * 3), move: ok ? (g.kind === 'ladder' ? 1 : 0.4) : 0, fire, jump: slam };
  }
  if (g.kind === 'lift' && g.d < 1.2) return { turn: clamp(g.b * 2), move: 0, fire, jump: slam };
  const edge = o.drop.f < 1.5 && !/stairs|spring|crane/.test(g.kind);
  const move = Math.abs(g.b) < 1 && !edge ? 0.35 : 0;
  return { turn: clamp(g.b * 2), move, fire, jump: slam };
}
