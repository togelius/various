// g27 quality 0.572 wheels 0.00 (on foot), trouble 0.00 per min (law-abiding) (996 chars; mutate)
// walker: follow the route on foot, sprinting when the way is clear; skip dialogue; never drive.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'entering') return a;
  if (o.me.mode === 'car') { a.use = o.t % 2 < 0.2; a.brake = 1; return a; }
  const g = o.gps, G = o.goal;
  const talk = G && G.kind === 'person' && G.d < 3;
  if (talk) { a.talk = true; }
  if (stuck(o, m, 15, talk)) { m.esc = 12; m.dir = Math.random() < 0.5 ? -1 : 1; }
  if (m.esc > 0) { m.esc--; a.move = -1; a.turn = m.dir; return a; }
  if (talk) return a;
  const b = g ? g.b : G ? G.b : null;
  if (b === null) { a.move = 0.5; a.turn = 0.3; return a; }
  walkAt(a, b);
  if (o.rays[3] < 2.5 && !(G && G.d < 4)) { a.turn = o.rays[5] > o.rays[1] ? 1 : -1; a.move = 0.4; return a; }
  a.sprint = Math.abs(b) < 0.5 && o.rays[3] > 6 && !(G && G.d < 6);
  return a;
}
