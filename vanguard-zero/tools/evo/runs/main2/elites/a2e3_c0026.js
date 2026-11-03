// c0026  cell [2,3]  train 0.949  test 0.903  aggression 0.25  entropy 0.187  via improve/strong from main:c0156
// intent: run right with proven jumps and air-dash gaps, fire a rare single shot in levels, and add frequent random stutter-steps and small hops on safe ground for varied inputs while holding a mid distance at the boss
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

function footing(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return -1;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

function flat(obs, n) {
  for (let dx = 4; dx <= n; dx++) if (footing(obs, dx) !== 1) return false;
  return true;
}

function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 8; dx++) {
    if (footing(obs, dx) > 0) break;
    w++;
  }
  return w;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.cool = 0;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  const arena = obs.inArena;
  if (!arena) {
    if (mem.since > 100 && mem.back <= 0) { mem.back = 18; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2), f3 = footing(obs, 3);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0)) || f2 < 0 || f3 < 0;
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 45));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < (arena ? 70 : 40) && s.dx * s.vx < 0 && s.warn <= 0);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (arena) {
      if (incoming || near) { mem.hold = 16 + (obs.t % 3); out.jump = true; }
    } else if (f1 <= 0) {
      mem.hold = 32; out.jump = true;
    } else if (wall) {
      mem.hold = 22; out.jump = true;
    } else if (hz) {
      mem.hold = 24; out.jump = true;
    } else if (near || incoming) {
      mem.hold = 14 + (obs.t % 3); out.jump = true;
    }
  } else if (!arena && !me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!arena && !me.ground && me.vy > -2 && gapWidth(obs) >= 2 && me.dashReady && !mem.back) {
    out.dash = true; out.right = true; out.left = false;
  }

  // variety on clearly safe flat ground
  const clear = me.ground && !mem.hold && !mem.back && mem.cool <= 0 &&
    f1 === 1 && f2 === 1 && f3 === 1 && flat(obs, 11) && me.vx > 1.5 &&
    !hz && !wall && !near && !incoming;
  if (!arena && clear) {
    const r = Math.random();
    if (r < 0.03) { mem.hold = 3 + Math.floor(Math.random() * 7); out.jump = true; }
    else if (r < 0.2) out.right = false;
    else if (r < 0.24) { out.right = false; out.left = true; }
  }

  if (arena) {
    const b = obs.boss;
    out.right = false; out.left = false;
    let facingBoss = true;
    if (b) {
      const tw = b.dx >= 0 ? 1 : -1;
      const dist = Math.abs(b.dx);
      facingBoss = me.facing === tw;
      let dir = 0;
      if (dist < 70) dir = -tw;
      else if (dist > 110) dir = tw;
      else if (!facingBoss) dir = tw;
      else if (Math.random() < 0.15) dir = Math.random() < 0.5 ? tw : -tw;
      if (dir > 0) out.right = true;
      if (dir < 0) out.left = true;
    }
    out.fire = facingBoss && (obs.t % 10) < 4;
  } else {
    out.fire = (obs.t % 90) < 3;
  }
  return out;
}
