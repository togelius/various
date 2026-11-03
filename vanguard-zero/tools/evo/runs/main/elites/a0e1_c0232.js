// c0232  cell [0,1]  train 0.713  test 0.796  aggression 0.00  entropy 0.094  via improve/strong from c0079
// intent: hold right constantly, hopping when a wall, spike, gap or nearby enemy is ahead, air-dashing across wide gaps, and backing off briefly when stuck
function solid(c) { return '#cC><|'.indexOf(c) >= 0; }
function hasGround(obs, dx) {
  for (let dy = 1; dy <= 4; dy++) {
    const c = obs.tile(dx, dy);
    if (solid(c) || c === '=') return true;
  }
  return false;
}
function hazard(obs, dx) {
  for (let dy = 0; dy <= 1; dy++) {
    const c = obs.tile(dx, dy);
    if (c === '^' || c === '~') return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) { mem.best = me.x; mem.since = 0; mem.back = 0; mem.hold = 0; mem.prev = false; }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  // Stuck for a few seconds: back up briefly, then go again.
  if (mem.since > 240 && mem.back <= 0) { mem.back = 30; mem.since = 0; }
  if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const gap = !hasGround(obs, 1);
  const spikes = hazard(obs, 1) || hazard(obs, 2);
  const foe = obs.enemies.some(e => e.dx > 14 && e.dx < 44 && e.dy > -28 && e.dy < 12);

  const under = obs.tile(0, 1);
  const crumb = under === 'c' || under === 'C';
  let want = me.ground && (wall || gap || spikes || foe || (crumb && !hasGround(obs, 2)));
  // Clinging to a wall while falling: kick off it.
  if (!me.ground && me.wall !== 0 && me.vy > 0) want = true;

  // Hold jump for a fixed span; a new press needs a released frame first.
  if (mem.hold > 0) { mem.hold--; out.jump = true; }
  else if (want && !mem.prev) { mem.hold = gap ? 32 : 20; out.jump = true; }

  // Airborne near the apex with a gap 2-4 tiles ahead: dash now so the 80 px burst reaches the far side.
  const gapAhead = !hasGround(obs, 2) || !hasGround(obs, 3) || !hasGround(obs, 4) || !hasGround(obs, 5);
  const blocked = solid(obs.tile(2, -1)) || solid(obs.tile(3, -1)) || solid(obs.tile(2, -2)) || solid(obs.tile(3, -2));
  const lands = hasGround(obs, 6) || hasGround(obs, 7) || hasGround(obs, 8);
  if (!me.ground && me.vy > -2 && me.dashReady && !me.dashing && gapAhead && lands && !blocked && mem.back <= 0) {
    out.dash = true; out.right = true; out.left = false;
  }

  mem.prev = !!out.jump;
  return out;
}
