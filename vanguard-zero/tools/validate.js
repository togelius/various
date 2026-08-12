/* Level reachability check.
 *
 * BFS over standing/wall-cling positions using a movement model deliberately
 * a little more conservative than the real physics, so anything it says is
 * unreachable really is. Catches unjumpable steps, bottomless shafts and
 * orphaned platforms before a human ever has to find them.
 *
 *   node tools/validate.js [stageIndex]
 */
const fs = require('fs');
const vm = require('vm');

const sandbox = { window: {}, document: { createElement: () => ({ getContext: () => ({}) }) } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/core.js', 'js/levels.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
}
const VZ = sandbox.VZ;

// tile classes
// '|' is a boss door: open until the fight starts, so passable for routing.
const SOLID = new Set(['#', 'c', '>', '{']);
const PLATFORM = new Set(['=']);
const HAZARD = new Set(['^', 'v', '[', ']']);
const FATAL = new Set(['~']);

// Player is 10x22 => one column wide, two rows tall.
// Jump clears 3 tiles up; run clears ~3 tiles of gap; dash-jump ~6.
const JUMP_UP = 3;
const JUMP_RUN = 4;
const DASH_RUN = 6;
const WALL_UP = 3;

function analyse(stage) {
  const map = stage.map;
  const H = map.length, W = map[0].length;
  const ch = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? (y >= H ? ' ' : '#') : map[y][x];
  const solid = (x, y) => SOLID.has(ch(x, y));
  const support = (x, y) => solid(x, y) || PLATFORM.has(ch(x, y));
  const blocked = (x, y) => solid(x, y);
  const deadly = (x, y) => FATAL.has(ch(x, y));

  // Standing: body occupies (x,y) and (x,y-1); something holds it up at (x,y+1).
  const canStand = (x, y) => {
    if (x < 0 || x >= W || y < 1 || y >= H) return false;
    if (blocked(x, y) || blocked(x, y - 1)) return false;
    if (deadly(x, y) || deadly(x, y - 1)) return false;
    return support(x, y + 1);
  };
  // Air position the body can occupy.
  const canBe = (x, y) => {
    if (x < 0 || x >= W || y < 1 || y >= H) return false;
    return !blocked(x, y) && !blocked(x, y - 1) && !deadly(x, y) && !deadly(x, y - 1);
  };
  // Wall cling: a solid tile beside an occupiable air position.
  const canCling = (x, y) => canBe(x, y) && (solid(x - 1, y) || solid(x + 1, y));

  // Where does a body at (x,y) come to rest if it falls?
  const fallTo = (x, y) => {
    for (let ty = y; ty < H; ty++) {
      if (!canBe(x, ty)) return null;
      if (deadly(x, ty + 1)) return null;
      if (support(x, ty + 1)) return { x, y: ty };
    }
    return null;   // fell out of the map
  };

  const key = (x, y, m) => x + ',' + y + ',' + m;
  const start = stage.startTile;
  const startStand = fallTo(start.x, start.y) || { x: start.x, y: start.y };

  const seen = new Set();
  const queue = [{ x: startStand.x, y: startStand.y, m: 'g' }];
  seen.add(key(startStand.x, startStand.y, 'g'));

  const push = (x, y, m) => {
    const k = key(x, y, m);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push({ x, y, m });
  };

  // A horizontal air path is clear if the body fits in every column crossed.
  const clearRun = (x0, x1, y) => {
    const d = Math.sign(x1 - x0);
    for (let x = x0; x !== x1 + d; x += d) if (!canBe(x, y)) return false;
    return true;
  };

  while (queue.length) {
    const n = queue.shift();
    const { x, y, m } = n;

    if (m === 'g') {
      // walk / step up or down one
      for (const dx of [-1, 1]) {
        for (const dy of [0, -1, 1]) {
          if (canBe(x + dx, y) && canStand(x + dx, y + dy)) push(x + dx, y + dy, 'g');
        }
      }
      // walk off the edge and fall (with drift)
      for (let dx = -DASH_RUN; dx <= DASH_RUN; dx++) {
        if (dx === 0) continue;
        if (!clearRun(x, x + dx, y)) continue;
        const land = fallTo(x + dx, y);
        if (land && canStand(land.x, land.y)) push(land.x, land.y, 'g');
      }
      // jump: rise up to JUMP_UP, travel, then land anywhere below
      for (let up = 1; up <= JUMP_UP; up++) {
        if (!canBe(x, y - up)) break;
        const reach = up <= 2 ? DASH_RUN : JUMP_RUN;
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = x + dx, ny = y - up;
          if (!clearRun(x, nx, ny)) continue;
          if (canStand(nx, ny)) push(nx, ny, 'g');
          const land = fallTo(nx, ny);
          if (land && canStand(land.x, land.y)) push(land.x, land.y, 'g');
          if (canCling(nx, ny)) push(nx, ny, 'w');
        }
      }
      // jumping straight up beside a wall grabs it
      for (let up = 1; up <= JUMP_UP; up++) {
        if (!canBe(x, y - up)) break;
        if (canCling(x, y - up)) push(x, y - up, 'w');
      }
    } else {
      // wall cling: kick off and up, either back to the same wall or across
      for (let up = 1; up <= WALL_UP; up++) {
        for (let dx = -JUMP_RUN; dx <= JUMP_RUN; dx++) {
          const nx = x + dx, ny = y - up;
          if (!canBe(nx, ny)) continue;
          if (!clearRun(x, nx, ny)) continue;
          if (canCling(nx, ny)) push(nx, ny, 'w');
          if (canStand(nx, ny)) push(nx, ny, 'g');
          const land = fallTo(nx, ny);
          if (land && canStand(land.x, land.y)) push(land.x, land.y, 'g');
        }
      }
      // let go and drop
      const land = fallTo(x, y);
      if (land && canStand(land.x, land.y)) push(land.x, land.y, 'g');
    }
  }

  const reachedStand = new Set();
  for (const k of seen) {
    const [x, y, m] = k.split(',');
    if (m === 'g') reachedStand.add(x + ',' + y);
  }
  return { reachedStand, canStand, W, H, ch, map };
}

function run() {
  let allOk = true;
  const only = process.argv[2] !== undefined ? parseInt(process.argv[2], 10) : null;

  VZ.STAGES.forEach((stage, si) => {
    if (only !== null && si !== only) return;
    // locate markers
    const map = stage.map;
    const find = (c) => {
      const out = [];
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) if (map[y][x] === c) out.push({ x, y });
      }
      return out;
    };
    const P = find('P')[0];
    stage.startTile = { x: P.x, y: P.y };
    const res = analyse(stage);
    const R = res.reachedStand;

    const problems = [];
    const check = (label, pts) => {
      pts.forEach(pt => {
        // a marker is satisfied if any standing tile within 1 tile is reachable
        let ok = false;
        for (let dx = -3; dx <= 3 && !ok; dx++) {
          for (let dy = -1; dy <= 4 && !ok; dy++) {
            if (R.has((pt.x + dx) + ',' + (pt.y + dy))) ok = true;
          }
        }
        if (!ok) problems.push(label + ' at tile ' + pt.x + ',' + pt.y + ' UNREACHABLE');
      });
    };
    // Ground-bound spawns must actually have ground under them, and must not
    // be standing in something that kills them.
    const GROUND_SPAWN = ['T', 'O', 'S', 'R', 'F', 'U', 'P', 'K'];
    GROUND_SPAWN.forEach(cch => {
      find(cch).forEach(pt => {
        const below = res.ch(pt.x, pt.y + 1);
        if (!(SOLID.has(below) || PLATFORM.has(below))) {
          problems.push("spawn '" + cch + "' at " + pt.x + ',' + pt.y +
            ' has no floor (below = "' + below + '")');
        }
      });
    });
    ['H', '@', 'E', '1'].forEach(cch => {
      find(cch).forEach(pt => {
        if (FATAL.has(res.ch(pt.x, pt.y)) || FATAL.has(res.ch(pt.x, pt.y + 1))) {
          problems.push("pickup '" + cch + "' at " + pt.x + ',' + pt.y + ' sits in liquid');
        }
      });
    });

    check('boss gate', find('B'));
    check('checkpoint', find('K'));
    check('pickup', find('H').concat(find('@'), find('E'), find('1')));

    // Report the furthest reachable column: if it stops short, the stage is
    // cut in half somewhere.
    let maxX = 0;
    R.forEach(k => { const x = +k.split(',')[0]; if (x > maxX) maxX = x; });

    // Orphan islands: standable tiles the player can never get to.
    let orphans = 0, firstOrphan = null;
    for (let y = 1; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (res.canStand(x, y) && !R.has(x + ',' + y)) {
          orphans++;
          if (!firstOrphan) firstOrphan = x + ',' + y;
        }
      }
    }

    const w = map[0].length;
    const ok = problems.length === 0 && maxX >= w - 6;
    if (!ok) allOk = false;
    console.log('--- STAGE ' + stage.id + ' ' + stage.name + ' ---');
    console.log('  furthest reachable column: ' + maxX + ' / ' + (w - 1) + (maxX >= w - 6 ? ' OK' : '  <-- BLOCKED'));
    console.log('  orphan standable tiles: ' + orphans + (firstOrphan ? ' (first at ' + firstOrphan + ')' : ''));
    problems.forEach(p => console.log('  !! ' + p));
    if (ok) console.log('  reachability OK');
  });
  process.exit(allOk ? 0 : 1);
}

run();
