// score 0.237  trigger 0.02  pace 0.43  (1716 chars)
// Tall Order controller v2: special states, lift/spring/ladder, rare shots
function step(o, m) {
  const g = o.goal;
  const clamp = v => Math.max(-1, Math.min(1, v));
  const pulse = Math.floor(o.t * 5) % 2 === 0; // alternate jump presses
  if (o.dead) return { turn: 0, move: 0, fire: false, jump: false };
  if (o.carried || o.hang) return { turn: 0, move: 0, fire: false, jump: pulse };
  if (o.rider) return { turn: Math.floor(o.t * 2) % 2 ? 1 : -1, move: 0, fire: false, jump: pulse };

  // jump over telegraphed slams (golem) and incoming shells/bricks
  let jump = o.shots.some(s => !s.shootable && s.d < 2.5 && Math.abs(s.b) < 0.5);
  for (const f of o.foes) if (/slam|windup/.test(f.st) && f.d < 3 && f.dy < 1) jump = true;

  // shoot now and then when something is in the band
  const fire = !!o.aim.hit && Math.floor(o.t * 10) % 5 === 0;

  let turn = 0, move = 0;
  if (!m.s) m.s = 1;
  if (g.kind === 'ladder' || (g.kind === 'ladder-approach' && g.d < 1.5)) {
    // stand east of the lattice, face west (yaw ~ PI), then push in
    const a = Math.abs(o.yaw);
    if (m.lt && a < m.ly - 0.02) m.s = -m.s; // last turn made us less west: flip
    m.ly = a; m.lt = false;
    const e = Math.PI - a;
    if (e > 0.25) { turn = clamp(m.s * e * 3); m.lt = true; } else move = 1;
  } else if (g.kind === 'lift') {
    // stand on the platform; it rises as long as you stay on it
    turn = clamp(g.b * 2);
    move = g.d > 1 ? 1 : 0;
  } else {
    const edge = o.drop.f < 1.5 && g.kind !== 'spring';
    turn = clamp(g.b * 3);
    move = Math.abs(g.b) < 1.2 && !edge ? 1 : 0;
    if (edge) turn = (o.drop.r > o.drop.l ? 1 : -1) * 0.6; // look for solid ground
  }
  return { turn, move, fire, jump };
}
