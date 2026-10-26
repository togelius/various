// ACCESSION — the kiter arena's policies (BUILD.md §10.3; test/arena/kiter.txt): a room of
// pillars and a kiter (a Signal Lamp, M11.3) that keeps its distance and shoots; kill it. A
// classic script in the hardened core context, seeing only obs (lib.js).
//
//   naive    walks straight at the kiter, the way a tap on it walks, and strikes it.
//   counter  reads its label (how near it lets you come before it backs away, and how far it
//            shoots) and fights it from behind the pillars: out of its line of fire while it
//            is far enough to shoot, waiting out of sight for it to come looking, pressing it
//            when it is near enough to back away (stepping out of its sight after a long chase,
//            so that it comes looking), and striking it when it is beside you.
// What each remembers (where it last saw the kiter, what the label said) is in obs.memory.
'use strict';
(() => {
  // The cost of stepping onto a tile the kiter could shoot, beyond the step itself.
  const EXPOSED = 6;
  // How many turns the counter waits behind cover for an unseen kiter to come looking.
  const WAIT = 12;
  // How many steps in a row the counter chases a kiter that keeps backing away before it
  // hides instead.
  const CHASE = 10;

  // The target: the nearest hostile exhibit in view (the arena has one), else the last one
  // seen, from memory: {uid, x, y, seen: whether it is in view now}.
  function target(obs) {
    const vm = obs.vm, mem = obs.memory, f = Obs.hostiles(vm)[0] || null;
    if (f) { mem.last = { uid: f.uid, x: f.x, y: f.y }; return { uid: f.uid, x: f.x, y: f.y, seen: true }; }
    return mem.last ? { uid: mem.last.uid, x: mem.last.x, y: mem.last.y, seen: false } : null;
  }
  const occupied = (vm, x, y) => vm.actors.some(a => a.uid !== 'you' && Obs.dist(a, x, y) === 0);
  // The legal move onto (x, y)'s neighbour in direction d, if no exhibit stands there.
  function moves(obs) {
    const vm = obs.vm, me = Obs.you(vm);
    return Obs.legalOf(obs, 'move').filter(l => !occupied(vm, me.x + Grid.DX[l.dir], me.y + Grid.DY[l.dir]));
  }

  // What the counter reads in a kiter's label: "Keeps L to H tiles from you and shoots
  // within R tiles"; null if the label says no such thing.
  const KEEPS = /Keeps (\d+) to (\d+) tiles from you and shoots within (\d+) tiles/;
  function readKiter(obs, uid) {
    const mem = obs.memory;
    if (!mem.labels) mem.labels = [];
    for (const l of mem.labels) if (l.uid === uid) return l.kiter;
    const m = KEEPS.exec(obs.read(uid) || '');
    const kiter = m ? { lo: Number(m[1]), hi: Number(m[2]), range: Number(m[3]) } : null;
    mem.labels.push({ uid, kiter });
    return kiter;
  }
  // Could a kiter at (kx, ky) shoot (x, y)? Within its range (the disc of "within r",
  // §8.2), in its sight, and nothing but you on the bolt's line: no wall or glass, and no
  // other body in view.
  function shootable(vm, k, x, y, range) {
    if (!Grid.disc(x - k.x, y - k.y, range)) return false;
    const m = Obs.board(vm).dept;
    if (!Grid.los(m, k.x, k.y, x, y)) return false;
    const pts = Ranged.bresenham(k.x, k.y, x, y);
    for (let i = 1; i < pts.length - 1; i++) {
      const [tx, ty] = pts[i];
      if (!Grid.bolt(m, tx, ty) || occupied(vm, tx, ty)) return false;
    }
    return true;
  }

  Policies.add('kiter', {
    naive: {
      card: {
        summary: 'Walks straight at the kiter, the way a tap on it would walk, and strikes it whenever it is beside you.',
        rules: ['If the kiter is beside you and can be struck, strike it.',
          'Otherwise, if it is in view, take the first step of the way a tap on it would walk.',
          'Otherwise take the first step of the way to where you last saw it.',
          'Otherwise wait.'],
      },
      decide(obs) {
        const t = target(obs);
        if (!t) return { action: { a: 'wait' }, reason: 'waits: no exhibit seen yet' };
        const hit = t.seen ? Obs.attack(obs, t.uid) : null;
        if (hit) return { action: hit, reason: `attacks ${t.uid} beside you` };
        const s = Obs.step(obs, t.x, t.y);
        if (s) return { action: s, reason: t.seen ? `steps ${Obs.DIRS[s.dir]} straight toward ${t.uid} at ${t.x},${t.y}` : `steps ${Obs.DIRS[s.dir]} toward ${t.x},${t.y}, where ${t.uid} was last seen` };
        return { action: { a: 'wait' }, reason: `waits: no way toward ${t.uid}` };
      },
    },
    counter: {
      card: {
        summary: 'Reads the kiter\'s label and fights it from behind the pillars: it keeps out of the kiter\'s line of fire whenever the kiter is far enough to shoot rather than back away, lets it come looking while it is out of sight, presses it when it is near enough to back away, and strikes it whenever it is beside you.',
        rules: ['If the kiter is beside you and can be struck, strike it.',
          'Read its label once: how near it lets you come before it backs away (L in "Keeps L to H tiles from you") and how far it shoots (R in "shoots within R tiles"). A tile is in its line of fire if it is within R of the kiter, in its sight, and nothing stands on the bolt\'s line between.',
          'If it is in view, L or more steps away, and you stand in its line of fire, step to the tile beside you out of its line of fire that is nearest it; if there is none, step toward it by the cheapest way (below).',
          'If it is in view and nearer than L steps, step toward it by the cheapest way: each step costs 1, and a step onto a tile in its line of fire costs the exposure weight more. After more than the chase limit of such steps in a row, step out of its sight instead (the tile beside you nearest it), so that it comes looking.',
          'If it is in view, L or more steps away, and you are out of its line of fire, step toward it by the cheapest way that stays out of its line of fire, or wait.',
          'If it is out of view, and you saw it within the wait limit and stand out of the line of fire of where you saw it, wait: it comes looking for you. Otherwise step toward where you last saw it by the cheapest way.',
          'Otherwise wait.'],
        weights: [['exposure weight', EXPOSED], ['chase limit (turns)', CHASE], ['wait limit (turns)', WAIT]],
      },
      decide(obs) {
        const vm = obs.vm, me = Obs.you(vm), mem = obs.memory, t = target(obs);
        if (!t) return { action: { a: 'wait' }, reason: 'waits: no exhibit seen yet' };
        if (t.seen) mem.seenTurn = vm.turn;
        const hit = t.seen ? Obs.attack(obs, t.uid) : null;
        if (hit) { mem.chase = 0; return { action: hit, reason: `attacks ${t.uid} beside you` }; }
        const k = readKiter(obs, t.uid), range = k ? k.range : Math.max(vm.w, vm.h), lo = k ? k.lo : 1;
        const m = Obs.board(vm).dept, far = m.w * m.h * (EXPOSED + 1);
        const open = (x, y) => shootable(vm, t, x, y, range);
        // The kiter's walking distance from you, by the tiles (actors aside), which is how near
        // it counts you.
        const fromIt = Grid.distances(m, [[t.x, t.y]], m.w * m.h, null);
        const w = fromIt[me.y * m.w + me.x];
        // The cheapest way to a tile a blow at it could come from (beside it, no corner in the
        // way): each step 1, a tile in its line of fire EXPOSED more, an exhibit's never.
        const starts = [];
        for (let d = 0; d < 8; d++) {
          const x = t.x + Grid.DX[d], y = t.y + Grid.DY[d];
          if (Grid.inside(m, x, y) && Grid.walkable(m, x, y) && !occupied(vm, x, y) && Grid.canStep(m, x, y, (d + 4) % 8)) starts.push([x, y]);
        }
        const field = starts.length ? Grid.distances(m, starts, far, (x, y) => occupied(vm, x, y) ? far : open(x, y) ? EXPOSED : 0) : null;
        const at = (f, x, y) => f[y * m.w + x];
        // The legal step onto no exhibit whose tile has the least value of f, among those ok allows.
        const pick = (f, ok) => {
          let best = null, bc = -1;
          for (const l of moves(obs)) {
            const x = me.x + Grid.DX[l.dir], y = me.y + Grid.DY[l.dir], v = at(f, x, y);
            if (v >= 0 && ok(x, y) && (best === null || v < bc)) { best = l; bc = v; }
          }
          return best === null ? null : { l: best, v: bc };
        };
        // A step along the cheapest way, if one lowers its cost.
        const toward = (ok, why) => {
          if (!field) return null;
          const s = pick(field, ok), here = at(field, me.x, me.y);
          return s && (here < 0 || s.v < here) ? { action: s.l, reason: `steps ${Obs.DIRS[s.l.dir]} ${why}` } : null;
        };
        if (t.seen && w >= lo && open(me.x, me.y)) {
          mem.chase = 0;
          const cover = pick(fromIt, (x, y) => !open(x, y));
          if (cover) return { action: cover.l, reason: `steps ${Obs.DIRS[cover.l.dir]} out of the line of fire of ${t.uid}, ${w} steps away at ${t.x},${t.y}` };
          return toward(() => true, `toward ${t.uid}, ${w} steps away: no tile beside you is out of its line of fire`)
            || { action: { a: 'wait' }, reason: `waits in the line of fire of ${t.uid}: no step leaves it or comes nearer` };
        }
        if (t.seen && w < lo) {
          // A chase round a pillar can go on for ever: after CHASE steps of it, step out of its
          // sight instead, so that it comes looking.
          mem.chase = (mem.chase || 0) + 1;
          if (mem.chase > CHASE) {
            const hide = pick(fromIt, (x, y) => !Grid.los(m, t.x, t.y, x, y));
            if (hide) { mem.chase = 0; return { action: hide.l, reason: `steps ${Obs.DIRS[hide.l.dir]} out of the sight of ${t.uid} after a chase of ${CHASE} steps, so that it comes looking` }; }
          }
          return toward(() => true, `after ${t.uid}, ${w} steps away, near enough that it backs away rather than shoots`)
            || { action: { a: 'wait' }, reason: `waits: no step brings ${t.uid}, ${w} steps away, nearer` };
        }
        if (t.seen) {
          mem.chase = 0;
          return toward((x, y) => !open(x, y), `toward ${t.uid} at ${t.x},${t.y}, ${w} steps away, out of its line of fire`)
            || { action: { a: 'wait' }, reason: `waits out of the line of fire of ${t.uid}, ${w} steps away: every step nearer enters it` };
        }
        mem.chase = 0;
        if (mem.seenTurn !== undefined && vm.turn - mem.seenTurn < WAIT && !open(me.x, me.y))
          return { action: { a: 'wait' }, reason: `waits out of sight of ${t.uid}, last seen at ${t.x},${t.y} on turn ${mem.seenTurn}: it comes looking` };
        return toward(() => true, `toward ${t.x},${t.y}, where ${t.uid} was last seen, by the cheapest way`)
          || { action: { a: 'wait' }, reason: `waits: no step brings ${t.x},${t.y}, where ${t.uid} was last seen, nearer` };
      },
    },
  });
})();
