// g180 quality 0.582 wheels 0.00 (on foot), trouble 0.00 per min (law-abiding) (1679 chars; mutate)
// walker: follow the route on foot, sprinting when the way is clear; skip dialogue; never drive.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  m.n = (m.n || 0) + 1;
  if (o.me.mode === 'car') return parkOut(a, o, m.n % 4 === 0);
  const g = o.gps, G = o.goal;
  const talk = G && G.kind === 'person' && G.d < 3;
  if (talk) a.talk = true;
  if (stuck(o, m, 15, talk)) { m.esc = 12; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) { m.esc--; a.move = -1; a.strafe = m.dir * 0.5; a.turn = m.dir; return a; }
  if (talk) return a;
  // route bearing; near a waypoint, blend toward the next one so bends are taken early
  let b = g ? g.b : G ? G.b : null;
  if (b === null) { a.move = 0.5; a.turn = 0.3; return a; }
  if (g && g.wd < 4 && g.b2 !== undefined) b = b * 0.4 + g.b2 * 0.6;
  // walls and props ahead: bend toward the side with more room
  const r = o.rays;
  const near = !!G && G.d < 6;
  if (!near && r[3] < 3) b = clamp(b + openSide(o) * 0.9, -1.5, 1.5);
  // pedestrian directly ahead: sidestep toward the freer side
  const pd = o.pie.ped[0];
  const st = !near && pd < 2.5 ? (o.pie.ped[1] < o.pie.ped[7] ? -0.6 : 0.6) : 0;
  // smooth steering: gentle turn, slower forward speed while the bearing is large
  a.turn = clamp(b * 2.0, -1, 1);
  a.strafe = st;
  a.move = Math.abs(b) > 1.2 ? 0.2 : Math.abs(b) > 0.5 ? 0.6 : 1;
  if (r[3] < 2 && !near) a.move = Math.min(a.move, 0.3);
  a.sprint = a.move > 0.9 && Math.abs(b) < 0.4 && r[3] > 6 && pd > 5 && !near;
  return a;
}
