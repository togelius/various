// g8 quality 0.570 wheels 0.32 (mixed), trouble 0.24 per min (a slip) (1430 chars; mutate)
// walker: follow the route on foot, sprinting when the way is clear; skip dialogue; never drive.
function think(o, m) {
  const a = {};
  if (o.ui.retry) { a.retry = true; return a; }
  if (o.ui.dialogue) { a.skip = true; return a; }
  if (o.ui.choice) { a.choose = 1; return a; }
  const goal = o.goal, g = o.gps;
  if (o.me.mode === 'car') {
    const spd = o.car.spd, sp = Math.abs(spd);
    // close to a place: brake to a stop, then step out (use pulses every 0.4 s)
    if (goal && goal.kind !== 'car' && goal.d < 12 + spd * spd / 12) {
      a.steer = Math.max(-1, Math.min(1, goal.b * 1.6));
      a.brake = sp > 1.5 ? 1 : 0;
      if (sp <= 1.5 && goal.d < 25) { m.n = (m.n || 0) + 1; a.use = m.n % 4 === 0; }
      return a;
    }
    // otherwise drive along the route
    const b = g ? g.b : goal ? goal.b : 0;
    a.steer = Math.max(-1, Math.min(1, b * 1.6));
    a.gas = sp < 12 ? 0.7 : 0;
    a.brake = sp > 14 ? 0.5 : 0;
    return a;
  }
  // on foot, last 8 m: walk straight into the marker (the job starts inside it)
  if (goal && goal.kind !== 'car' && goal.d < 8) {
    a.turn = Math.max(-1, Math.min(1, goal.b * 2.2));
    a.move = goal.d < 2.5 ? 0.5 : Math.abs(goal.b) > 1.2 ? 0.1 : 1;
    return a;
  }
  if (!g) { a.move = 0.5; a.turn = 0.3; return a; }
  const b = g.b;
  a.turn = Math.max(-1, Math.min(1, b * 2.2));
  a.move = Math.abs(b) > 1.2 ? 0.1 : 1;
  a.sprint = Math.abs(b) < 0.5;
  return a;
}
