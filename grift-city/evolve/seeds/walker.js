// walker: follow the route on foot, sprinting when the way is clear; skip dialogue; never drive.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  if (o.me.mode === 'car') { a.use = o.t % 2 < 0.2; a.brake = 1; return a; }
  const g = o.gps;
  if (!g) { a.move = 0.5; a.turn = 0.3; return a; }
  const b = g.b;
  a.turn = Math.max(-1, Math.min(1, b * 2.2));
  a.move = Math.abs(b) > 1.2 ? 0.1 : 1;
  a.sprint = Math.abs(b) < 0.5;
  return a;
}
