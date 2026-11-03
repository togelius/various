// c0161  cell [6,2]  train 0.914  test 0.901  aggression 0.63  entropy 0.138  via improve/strong from c0040
// intent: run right nonstop while tap-firing, jumping early over pits, liquid, spikes, walls and nearby enemies or shots, air-dashing wide gaps, and backing off briefly when stuck
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Solid floor under column dx within 5 tiles below feet, with no liquid or spikes right under the feet.
function floorAt(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (dy <= 2 && bad(c)) return false;
    if (solid(c) || c === '=') return true;
  }
  return false;
}

// [columns to the first floorless column ahead, width of that gap]
function gapInfo(obs) {
  let d = 0, w = 0;
  for (let dx = 1; dx <= 9 && !d; dx++) if (!floorAt(obs, dx)) d = dx;
  if (!d) return [99, 0];
  for (let dx = d; dx < d + 10 && !floorAt(obs, dx); dx++) w++;
  return [d, w];
}

function control(obs, mem) {
  const me = obs.me;
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.age = 0; mem.pj = false; mem.stut = 0;
  }
  mem.age++;
  if (me.x > mem.best + 3) { mem.best = me.x; mem.since = 0; } else mem.since++;
  if (!obs.inArena && mem.since > 100 && mem.back <= 0) { mem.back = 22; mem.since = 0; }

  const gi = gapInfo(obs);
  const near = obs.enemies.some(e => e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 24);
  const shot = obs.shots.some(p => p.warn <= 0 && Math.abs(p.dy) < 16 && Math.abs(p.dx) < 50 && p.dx * p.vx < 0);

  // Forward unless backing off, too close to the boss, or taking a short stutter.
  let dir = 1;
  if (mem.back > 0) { mem.back--; dir = -1; }
  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 60) dir = -1;
  if (dir < 0 && !floorAt(obs, -1)) dir = 1;
  if (mem.stut === 0 && me.ground && dir > 0 && gi[0] > 6 && !near && !shot && Math.random() < 0.03) mem.stut = 4;
  if (mem.stut > 0) { mem.stut--; dir = 0; }

  const f = dir || 1;
  const wall = solid(obs.tile(f, 0)) || solid(obs.tile(f, -1));
  const spike = bad(obs.tile(f, 0));
  const [gd, gw] = dir > 0 ? gi : [99, 0];

  let want = false, len = 0;
  if (me.ground) {
    if (gd <= (gw >= 3 ? 1 : 2) && gw > 0) { want = true; len = gw >= 3 ? 40 : 32; }
    else if (wall || spike) { want = true; len = 20; }
    else if ((near || shot) && !(gw > 0 && gd <= 9)) { want = true; len = 12 + Math.floor(Math.random() * 6); }
  } else if (me.wall !== 0 && me.vy > 0) {
    want = true; len = 2; // wall kick
  }

  // Air-dash across gaps; holds height while dashing.
  const dash = !me.ground && me.dashReady && me.vy > -2 && dir > 0 && gw >= 2 && gd <= 6;

  // Jump is an edge: hold for len frames, then release at least one frame before the next press.
  if (me.ground && mem.age > 4) mem.hold = 0;
  let j = false;
  if (mem.hold > 0) { mem.hold--; j = true; }
  else if (want && !mem.pj) { mem.hold = len - 1; mem.age = 0; j = true; }
  mem.pj = j;

  const out = { fire: (obs.t % 8) < 4 };
  if (dir > 0) out.right = true;
  if (dir < 0) out.left = true;
  if (j) out.jump = true;
  if (dash) out.dash = true;
  return out;
}
