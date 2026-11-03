// c0320  cell [5,1]  train 0.859  test 0.839  aggression 0.53  entropy 0.077  via steer/fast from c0090
// intent: run steadily right, tap fire on a fixed 18-frame beat, and hop with varied held jumps over walls, spikes and pits ahead
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }
// Distance down to footing in column dx: >0 solid within 4 tiles, -1 hazard first, 0 nothing.
function footing(obs, dx) {
  for (let dy = 1; dy <= 4; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return -1;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

function control(obs, mem) {
  const me = obs.me;
  if (mem.hold === undefined) { mem.hold = 0; mem.cool = 0; }
  const out = { right: true, fire: (obs.t % 18) === 0 };
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
    return out;
  }
  if (mem.cool > 0) { mem.cool--; return out; }
  const f1 = footing(obs, 1), f2 = footing(obs, 2), f3 = footing(obs, 3);
  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0));
  if (!me.ground && me.vy > -1 && me.dashReady && f2 <= 0 && f3 <= 0) out.dash = true;
  if (me.ground) {
    if (wall || hz || f1 <= 0 || f2 < 0) {
      mem.hold = 10 + (obs.t % 9);
      out.jump = true;
    }
  } else if (me.wall !== 0 && me.vy > 0) {
    mem.hold = 8 + (obs.t % 5);
    out.jump = true;
  }
  return out;
}
