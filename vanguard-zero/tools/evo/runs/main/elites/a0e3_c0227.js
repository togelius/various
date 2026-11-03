// c0227  cell [0,3]  train 0.581  test 0.603  aggression 0.07  entropy 0.163  via improve/fast from c0114
// intent: bunny-hop steadily right with moderately randomised hop lengths and brief stutters, dash wide gaps, back off when stuck, and fire one slow shot every few seconds
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Number of columns ahead with no floor within 5 tiles below foot level.
function gapWidth(obs) {
  let w = 0, st = false;
  for (let dx = 1; dx <= 8; dx++) {
    let g = false;
    for (let dy = 1; dy <= 5; dy++) {
      const c = obs.tile(dx, dy);
      if (c === '~') break;
      if (solid(c) || c === '=') { g = true; break; }
    }
    if (g) { if (st) break; } else { st = true; w++; }
  }
  return w;
}

function floorAt(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (c === '~') return false;
    if (solid(c) || c === '=') return true;
  }
  return false;
}

function hazard(obs) {
  for (let dx = 1; dx <= 3; dx++) {
    if (bad(obs.tile(dx, 0)) || bad(obs.tile(dx, 1))) return true;
  }
  return false;
}

function wallAhead(obs) { return solid(obs.tile(1, 0)) || solid(obs.tile(1, -1)); }

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };

  if (mem.h === undefined) {
    mem.h = 12; mem.r = 3; mem.c = 0;
    mem.best = me.x; mem.since = 0; mem.back = 0;
  }

  // Progress tracking: back off briefly if no new ground for a while.
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;
  if (!obs.inArena) {
    if (mem.since > 120) { mem.since = 0; mem.back = 20; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  // Hop cycle: held jumps of varying length, separated by varying gaps.
  mem.c++;
  if (me.ground && mem.c > mem.h + mem.r) {
    mem.c = 0;
    mem.r = 2 + Math.floor(Math.random() * 4);
    if (gapWidth(obs) > 0 || hazard(obs) || wallAhead(obs)) mem.h = 18;
    else mem.h = 9 + Math.floor(Math.random() * 9);
  }
  // Pit, liquid or spikes within 3 columns: launch a long hop now, while there is still ground to jump from.
  if (me.ground && !mem.back && (!floorAt(obs, 1) || !floorAt(obs, 3) || hazard(obs))) { mem.c = 0; mem.h = 30; }
  out.jump = mem.c < mem.h;

  // Wall kick while sliding down a wall.
  if (!me.ground && me.wall !== 0 && me.vy > 0) out.jump = (obs.t % 3) === 0;

  // Dash over wide gaps.
  if (gapWidth(obs) > 2 && me.dashReady && !floorAt(obs, 1) && (me.ground || me.vy > -1)) out.dash = true;

  // Occasional short stutter for input variety, only when safe.
  if (me.ground && !hazard(obs) && Math.random() < 0.04) out.right = false;

  // One slow shot every ~170 frames (about 0.35 shots/s): press for a single frame.
  out.fire = obs.t % 170 === 0;

  // Boss: keep some distance.
  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 80) {
    out.right = false;
    out.left = true;
  }
  return out;
}
