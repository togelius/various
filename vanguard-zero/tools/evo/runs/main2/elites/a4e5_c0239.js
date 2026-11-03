// c0239  cell [4,5]  train 0.923  test 0.913  aggression 0.47  entropy 0.274  via tweak/fast from c0235
// intent: run right with steady hops timed by footing, walls, spikes, enemies and stalls, shoot steadily at about two shots a second, and keep stirring the run, steer and hop inputs on safe ground and in the boss arena for high input variety
const SOLID = '#cC><|';
function solid(c) { return SOLID.indexOf(c) >= 0; }
function bad(c) { return c === '^' || c === '~'; }

function footing(obs, dx) {
  for (let dy = 1; dy <= 5; dy++) {
    const c = obs.tile(dx, dy);
    if (bad(c)) return 0;
    if (solid(c) || c === '=') return dy;
  }
  return 0;
}

function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 9; dx++) {
    if (footing(obs, dx) > 0) break;
    w++;
  }
  return w;
}

function landingOk(obs) {
  for (let dx = 3; dx <= 7; dx++) if (footing(obs, dx) > 0) return true;
  return false;
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
    if (mem.since > 100 && mem.back <= 0 && me.ground) { mem.back = 18; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1);
  const hz = bad(obs.tile(1, 0)) || bad(obs.tile(2, 0)) || bad(obs.tile(3, 0));
  const gw = gapWidth(obs);
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 45 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 45));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < 40 && s.dx * s.vx < 0 && s.warn <= 0);
  const arenaThreat = arena && obs.shots.some(s => Math.abs(s.dy) < 20 && Math.abs(s.dx) < 60 && s.dx * s.vx < 0 && s.warn <= 0);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (!arena && f1 <= 0) {
      mem.hold = gw >= 4 ? 46 : (gw >= 3 ? 38 : 32); out.jump = true;
    } else if (!arena && wall) {
      mem.hold = 22; out.jump = true;
    } else if (!arena && hz) {
      mem.hold = 24; out.jump = true;
    } else if ((!arena && near) || incoming || arenaThreat) {
      mem.hold = 14 + (obs.t % 3); out.jump = true;
    } else if (arena && Math.random() < 0.04) {
      mem.hold = 6 + Math.floor(Math.random() * 10); out.jump = true;
    }
  } else if (!arena && !me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!arena && me.dashReady && !mem.back && ((!me.ground && me.vy > -2 && gw >= 2 && landingOk(obs)) || (me.ground && (obs.tile(0, 1) === '<' || obs.tile(1, 1) === '<')))) {
    out.dash = true; out.right = true; out.left = false;
  }

  // input variety on safe flat ground
  if (!arena && me.ground && !near && !mem.hold && !mem.back && gw === 0 && f1 > 0 && footing(obs, 2) > 0 && footing(obs, 3) > 0 && !hz && !wall) {
    const r = Math.random();
    if (r < 0.22) out.right = false;
    else if (r < 0.28) { out.right = false; out.left = true; }
  }

  if (arena) {
    const b = obs.boss;
    if (b) {
      out.right = false; out.left = false;
      if (b.dx > 70) out.right = true;
      else if (b.dx < -70) out.left = true;
      else if (b.dx < 0 && me.facing > 0) out.left = true;
      else if (b.dx >= 0 && me.facing < 0) out.right = true;
      else if (Math.random() < 0.15) { if (b.dx >= 0) out.right = true; else out.left = true; }
    }
    const facingBoss = !b || (b.dx >= 0 ? me.facing > 0 : me.facing < 0);
    out.fire = facingBoss && (obs.t % 8) < 4;
  } else {
    const tgt = obs.enemies.some(e => e.kind !== 'flamer' && e.dx > 10 && e.dx < 140 && Math.abs(e.dy) < 24);
    out.fire = tgt ? (obs.t % 12) < 4 : (obs.t % 26) < 3;
  }
  return out;
}
