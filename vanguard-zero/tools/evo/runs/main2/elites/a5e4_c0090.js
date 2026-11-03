// c0090  cell [5,4]  train 0.697  test 0.688  aggression 0.54  entropy 0.220  via improve/fast from c0060
// intent: advance steadily while tapping fire, halting only to shoot enemies in the way, jumping as soon as a pit, spike or liquid shows up ahead, dashing mid-air across gaps and spike strips, reversing mid-air only when the ground behind is safe, and pushing on after a stall
const SOLID = '#cC|';
const FLOOR = '#cC|=><';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function floor(c) { return FLOOR.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Depth of the first floor in column dx (>0), 0 for a pit, -1 if a hazard comes first.
function footing(obs, dx) {
  if (bad(obs.tile(dx, 0))) return -1;
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return -1;
    if (floor(c)) return dy;
  }
  return 0;
}
// True if a spike, liquid or pit starts within n columns ahead.
function hazSoon(obs, n) {
  for (let dx = 1; dx <= n; dx++) if (footing(obs, dx) < 0) return true;
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = {};
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.unstick = 0; mem.hold = 0; mem.prev = false;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;
  // Stalled for about 2.5 s: stop halting and push through for 2 s.
  if (mem.since > 150 && mem.unstick <= 0 && !obs.inArena) { mem.unstick = 120; mem.since = 0; }
  const pushing = mem.unstick > 0;
  if (pushing) mem.unstick--;

  // Nearest thing worth shooting (flamers cannot be killed).
  let target = null;
  for (const e of obs.enemies) {
    if (e.kind === 'flamer' || e.kind === 'shielder') continue;
    if (Math.abs(e.dy) < 40 && Math.abs(e.dx) < 200) { target = e; break; }
  }
  if (obs.boss) target = obs.boss;

  let dir = 1;
  if (target && !pushing) {
    const face = target.dx >= 0 ? 1 : -1;
    const range = obs.boss ? 110 : 90;
    if (Math.abs(target.dx) > range) dir = face;
    else if (Math.abs(target.dx) < range - 40) dir = (obs.boss || footing(obs, -face) > 0) ? -face : 0;
    else dir = 0;
    // Must face the target to hit it.
    if (dir === 0 && me.facing !== face) dir = face;
  }

  const ahead = dir || me.facing;
  const wall = solid(obs.tile(ahead, 0)) || solid(obs.tile(ahead, -1));
  const f1 = footing(obs, ahead), f2 = footing(obs, 2 * ahead), f3 = footing(obs, 3 * ahead);
  // Jump when a pit or hazard is three columns ahead, so wide gaps get a longer run-up.
  const danger = f1 <= 0 || f2 <= 0 || f3 <= 0;
  // Never halt on the edge of a hazard; keep moving so we can jump it.
  if (danger && dir === 0) dir = me.facing;

  const near = obs.enemies.some(e => e.kind !== 'flamer' && e.dx > 0 && e.dx < 50 && Math.abs(e.dy) < 30);
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < 50 && s.dx * s.vx < 0);
  const cling = !me.ground && me.wall !== 0 && me.vy > 0;

  // Mid-air: dash across gaps and spike strips ahead when possible; otherwise brake before hazards.
  const brake = !me.ground && me.vy > -1 && (footing(obs, ahead) < 0 || footing(obs, 2 * ahead) < 0) && footing(obs, -ahead) > 0;
  if (!me.ground && me.dashReady && me.vy > -3 && (f1 <= 0 || f2 <= 0 || hazSoon(obs, 5))) {
    out.dash = true;
    dir = me.facing;
  } else if (brake) dir = -ahead;

  // Input variety: brief stutters on safe open ground.
  if (me.ground && !danger && !wall && !target && Math.random() < 0.05) dir = 0;

  // Jumping: holds for a full hop, edge-triggered so a release frame separates jumps.
  if (mem.hold > 0) { mem.hold--; out.jump = true; }
  else if (!mem.prev) {
    if (me.ground && (wall || danger || incoming || (near && !pushing) || Math.random() < 0.02)) {
      mem.hold = danger ? 30 : (wall ? 22 : 14); out.jump = true;
    } else if (cling) {
      mem.hold = 9; out.jump = true;
    }
  }
  mem.prev = !!out.jump;

  if (dir > 0) out.right = true;
  if (dir < 0) out.left = true;

  // Rapid tap fire: press 4 frames, release 4.
  out.fire = (obs.t % 8) < 4;
  return out;
}
