// c0271  cell [7,4]  train 0.571  test 0.626  aggression 0.71  entropy 0.215  via tweak/fast from c0091
// intent: run right nonstop with varied hops and wall kicks, jumping early and air-dashing across pits, liquid and spikes up to six tiles ahead, while tap-firing rapidly and backing off briefly when stuck
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

function ahead(obs) {
  for (let dx = 1; dx <= 6; dx++) {
    if (footing(obs, dx) <= 0 || bad(obs.tile(dx, 0))) return dx;
  }
  return 99;
}

function gapAt(obs, s) {
  let w = 0;
  for (let dx = s; dx < s + 8; dx++) {
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

  if (!obs.inArena) {
    if (mem.since > 90 && mem.back <= 0) { mem.back = 20; mem.since = 0; }
    if (mem.back > 0) { mem.back--; out.right = false; out.left = true; }
  }

  const wall = solid(obs.tile(1, 0)) || solid(obs.tile(1, -1));
  const f1 = footing(obs, 1), f2 = footing(obs, 2), f3 = footing(obs, 3);
  const a = ahead(obs);
  const hz = a <= 4 || (a <= 6 && gapAt(obs, a) >= 4);
  const danger = f1 <= 0 || hz;
  const near = obs.enemies.some(e => e.kind !== 'flamer'
    ? (e.dx > 0 && e.dx < 50 && Math.abs(e.dy) < 30)
    : (e.dx > 0 && e.dx < 50));
  const incoming = obs.shots.some(s => Math.abs(s.dy) < 16 && Math.abs(s.dx) < 40 && s.dx * s.vx < 0 && s.warn <= 0);

  if (mem.cool > 0) mem.cool--;
  if (mem.hold > 0) {
    mem.hold--;
    out.jump = true;
    if (mem.hold === 0) mem.cool = 2;
  } else if (me.ground && mem.cool <= 0) {
    if (f1 <= 0) {
      mem.hold = 32; out.jump = true;
    } else if (wall) {
      mem.hold = 22; out.jump = true;
    } else if (hz) {
      mem.hold = 24; out.jump = true;
    } else if (near || incoming || Math.random() < 0.05) {
      mem.hold = 7 + Math.floor(Math.random() * 14); out.jump = true;
    }
  } else if (!me.ground && me.wall !== 0 && me.vy > 0 && mem.cool <= 0) {
    mem.hold = 10; out.jump = true;
  }

  if (!me.ground && ahead(obs) <= 6 && me.dashReady && !mem.back) {
    out.dash = true; out.right = true; out.left = false;
  }

  // Input variety: brief stutters when safe.
  if (me.ground && !danger && !wall && f1 > 0 && f2 > 0 && !near && Math.random() < 0.08) {
    out.right = false;
    if (Math.random() < 0.3) out.left = true;
  }

  // Rapid tap fire.
  out.fire = (obs.t % 8) < 4;

  if (obs.boss && obs.boss.dx > 0 && obs.boss.dx < 60) { out.right = false; out.left = true; }
  return out;
}
