// c0171  cell [6,1]  train 0.540  test 0.582  aggression 0.60  entropy 0.087  via improve/fast from c0042
// intent: run steadily right while tapping fire on a fixed 18-frame rhythm, hopping early over walls, spikes, liquid and gaps, and air-dashing across any gap ahead near the apex of the hop
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function hard(c) { return c === '^' || c === '~'; }
// Is there ground under the column dx, within 4 tiles below the feet?
function floorAt(obs, dx) {
  for (let dy = 1; dy <= 4; dy++) {
    const c = obs.tile(dx, dy);
    if (c === '~' || c === '^') return false;
    if (solid(c) || c === '=') return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  // Fixed rhythm: fire 9 frames on, 9 off (about 3.3 shots/s).
  const out = { right: true, fire: (obs.t % 18) < 9 };
  const cool = mem.cool || 0;
  mem.cool = cool > 0 ? cool - 1 : 0;
  if (mem.hold > 0) { mem.hold--; out.jump = true; }
  // Air dash across any gap within 5 tiles ahead.
  const ahead = [1, 2, 3, 4].some(d => !floorAt(obs, d));
  if (!me.ground && ahead && me.vy > -2 && me.dashReady) out.dash = true;
  if (cool > 0) return out;
  let go = false;
  if (me.ground) {
    const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1)) || hard(obs.tile(1, 0)) || hard(obs.tile(2, 0));
    const gap = !floorAt(obs, 1) || !floorAt(obs, 2) || !floorAt(obs, 3) || !floorAt(obs, 4);
    go = wall || gap;
    if (gap && !wall) mem.hold = 20;
  } else if (me.wall !== 0 && me.vy > 0) {
    // Clinging to a wall while falling: kick off it.
    go = true;
  }
  if (go) { out.jump = true; mem.cool = 20; }
  return out;
}
