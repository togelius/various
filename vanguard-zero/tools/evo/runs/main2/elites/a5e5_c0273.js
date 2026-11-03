// c0273  cell [5,5]  train 0.760  test 0.737  aggression 0.58  entropy 0.253  via improve/strong from c0241
// intent: bunny-hop right with randomised hop and rest lengths, take off long from pits and hazards ahead, air-dash wide gaps at the jump apex, and tap a shot about every eight frames
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

// Solid floor under column dx within 5 tiles below feet, with no spikes or liquid right under the feet.
function floorAt(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (dy <= 2 && bad(c)) return false;
    if (solid(c) || c === '=') return true;
  }
  return false;
}

// Number of floorless columns ahead before solid footing.
function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 8 && !floorAt(obs, dx); dx++) w++;
  return w;
}

function hazard(obs) {
  for (let dx = 1; dx <= 3; dx++) {
    if (bad(obs.tile(dx, 0)) || bad(obs.tile(dx, 1))) return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };

  if (mem.h === undefined) { mem.h = 12; mem.r = 2; mem.c = 0; }
  mem.c++;

  const gap = gapWidth(obs);
  const pit = gap > 0 && gap <= 6;

  // Take off when grounded and the rest period is over, or at once at a pit edge if the jump button is free.
  // At a pit edge with jump still held from a hop: release for a frame so the next press registers.
  const rel = me.ground && pit && mem.jp;
  if (rel) { mem.c = 1000; mem.h = 0; }
  if (!rel && me.ground && (mem.c >= mem.h + mem.r || (pit && !mem.jp))) {
    mem.c = 0;
    if (pit) {
      mem.h = 16 + gap * 2; mem.r = 1;
    } else if (hazard(obs)) {
      mem.h = 18; mem.r = 1;
    } else {
      mem.h = 7 + Math.floor(Math.random() * 10);
      mem.r = 1 + Math.floor(Math.random() * 4);
    }
  }
  // Held for mem.h frames, then released for at least one frame before the next takeoff.
  out.jump = mem.c < mem.h;

  // Air-dash across gaps.
  if (!me.ground && gap >= 2 && me.vy > -1.5 && !me.dashing && me.dashReady) out.dash = true;

  // Wall slide: kick off by tapping jump.
  if (!me.ground && me.wall !== 0 && me.vy > 0) out.jump = (obs.t % 3) === 0;

  // Small random stutters for variety.
  if (!gap && Math.random() < 0.05) out.right = false;

  // Fire pressed every 8 frames (tap, release within 3 frames), for a higher shot rate.
  out.fire = (obs.t % 8) < 3;

  // Boss: keep some distance.
  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 80) {
    out.right = false;
    out.left = true;
  }
  mem.jp = !!out.jump;
  return out;
}
