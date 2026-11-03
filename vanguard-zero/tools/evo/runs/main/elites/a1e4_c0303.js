// c0303  cell [1,4]  train 0.784  test 0.778  aggression 0.18  entropy 0.212  via improve/fast from c0063
// intent: run right with randomly varied hops, wall kicks and brief stutters, firing a tap about every second or two at what is ahead
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

function gapWidth(obs) {
  let w = 0;
  for (let dx = 1; dx <= 8; dx++) {
    if (footing(obs, dx) > 0) break;
    w++;
  }
  return w;
}

function gapAhead(obs, k) {
  for (let dx = 1; dx <= k; dx++) {
    if (footing(obs, dx) <= 0 || bad(obs.tile(dx, 0))) return true;
  }
  return false;
}

function control(obs, mem) {
  const me = obs.me;
  const out = { right: true };
  if (mem.best === undefined) {
    mem.best = me.x; mem.since = 0; mem.back = 0;
    mem.hold = 0; mem.cool = 0; mem.nf = 30;
  }
  if (me.x > mem.best + 2) { mem.best = me.x; mem.since = 0; } else mem.since++;

  if (!obs.inArena) {
    if (mem.since > 80 && mem.back <= 0) { mem.back = 20; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2);
  const danger = f1 <= 0 || f2 < 0 || bad(obs.tile(1, 0));
  const near = obs.enemies.some(e => e.dx > 0 && e.dx < 55 && Math.abs(e.dy) < 30 && e.kind !== 'flamer' ? true : (e.kind === 'flamer' && e.dx > 0 && e.dx < 40));

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (f1 <= 0) {
      mem.hold = 32; out.jump = true;
      if (me.dashReady && !mem.back) out.dash = true;
    } else if (wall || danger) {
      mem.hold = 20; out.jump = true;
    } else if (gapAhead(obs, 2) && me.dashReady && !mem.back) {
      mem.hold = 24; out.jump = true; out.dash = true;
    } else if (!gapAhead(obs, 7) && (near || Math.random() < 0.035)) {
      mem.hold = 7 + Math.floor(Math.random() * 10); out.jump = true;
    }
  } else if (!me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!me.ground && me.vy > -2 && gapWidth(obs) >= 2 && me.dashReady) out.dash = true;

  // Input variety: brief stutters when it is safe.
  if (me.ground && !danger && !wall && f1 > 0 && Math.random() < 0.08) {
    out.right = false;
    if (Math.random() < 0.3) out.left = true;
  }

  // Sparse tap fire, a bit faster when something is lined up ahead.
  if (obs.t >= mem.nf) {
    out.fire = true;
    const lined = obs.enemies.some(e => e.dx > 0 && e.dx < 180 && Math.abs(e.dy) < 24);
    const base = obs.inArena ? 35 : (lined ? 45 : 80);
    mem.nf = obs.t + base + Math.random() * 40;
  }

  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 60) { out.right = false; out.left = true; }
  return out;
}
