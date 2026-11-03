// c0289  cell [1,5]  train 0.698  test 0.691  aggression 0.12  entropy 0.271  via improve/fast from c0215
// intent: bunny-hop right with randomised hop lengths, take off early and long from any pit within six tiles and dash across it, and tap a shot about every 1.7 seconds
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 8; dx++) {
    let ground = false;
    for (let dy = 1; dy <= 5; dy++) {
      const c = obs.tile(dx, dy);
      if (c === '~') break;
      if (solid(c) || c === '=') { ground = true; break; }
    }
    if (ground) break;
    w++;
  }
  return w;
}
function gapFrom(obs, s) {
  let w = 0;
  for (let dx = s; dx <= s + 7; dx++) {
    let ground = false;
    for (let dy = 1; dy <= 5; dy++) {
      const c = obs.tile(dx, dy);
      if (c === '~') break;
      if (solid(c) || c === '=') { ground = true; break; }
    }
    if (ground) break;
    w++;
  }
  return w;
}
function hazard(obs) {
  for (let dx = 1; dx <= 3; dx++) {
    const a = obs.tile(dx, 0), b = obs.tile(dx, 1);
    if (a === '^' || a === '~' || b === '^' || b === '~') return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };

  if (mem.hold === undefined) { mem.hold = 0; mem.wait = 0; mem.j = false; }
  if (mem.wait > 0) mem.wait--;
  const gap = gapWidth(obs);
  const lip = gapFrom(obs, 3);
  const early = gapFrom(obs, 2) === 0 && lip >= 3 && lip <= 6;
  const pit = gap > 0 && gap <= 6;
  const launch = pit || early;
  const lg = pit ? gap : lip;
  // a press needs a released frame first; a pit at or just ahead of the edge overrides the wait
  if (me.ground && !mem.j && mem.hold === 0 && (mem.wait === 0 || launch)) {
    mem.hold = launch ? 14 + lg * 2 : (hazard(obs) ? 18 : 7 + Math.floor(Math.random() * 10));
    mem.wait = 0;
  }
  if (mem.hold > 0) {
    out.jump = true;
    mem.hold--;
    if (mem.hold === 0) mem.wait = 1 + Math.floor(Math.random() * 4);
  }
  // take off from a pit edge with a ground dash so the boost covers the whole gap
  if (launch && me.ground && lg >= 3 && me.dashReady) out.dash = true;

  // dash over wide gaps
  if (!me.ground && gap >= 2 && !me.dashing && me.dashReady) out.dash = true;

  // wall kick
  if (!me.ground && me.wall !== 0 && me.vy > 0) out.jump = (obs.t % 3) === 0;

  // small random stutters for variety
  if (!gap && Math.random() < 0.05) out.right = false;

  // one shot about every 100 frames
  out.fire = (obs.t % 100) < 3;

  // boss: keep some distance
  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 80) {
    out.right = false;
    out.left = true;
  }
  mem.j = !!out.jump;
  return out;
}
