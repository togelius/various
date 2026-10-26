// ACCESSION — the tethered warden arena's policies (BUILD.md §10.3: take the item a tethered
// warden guards; you carry a Tuning Fork). The warden stays within its tether of what it
// guards, wakes at once when you come within it, and, hunting you while you stand outside
// it, goes back to its place instead of fighting, waiting there while it sees you (its
// Behaviour line, §8.2). A noise draws a sleeper's pips, and once awake it goes to look at the
// noise, as far as the edge of its tether. So the naive policy walks in and takes the item;
// the counterplay lures the warden with the fork into a corner of its tether from which it
// cannot see the far side of the item, and takes the item from that side while it is there.
// Both see only what a player sees (obs); the counterplay keeps in obs.memory the labels it
// has read (read), the item ({uid, x, y}, as last seen), the warden ({uid, r}), its place
// and pips when last seen asleep (place, pips), its plan (plan), the fork's uses (forks), its
// actions since the warden woke (since), and whether it has given the lure up (off).
// A classic script, loaded into the hardened core context (tools/core-context.js).
'use strict';
(() => {
  // The item to take: the first one in view not carried and not in a shut case.
  const itemOf = vm => vm.items.find(i => !i.inCase) || vm.items.find(i => i.inCase && vm.cases.some(c => c.x === i.x && c.y === i.y && c.st !== 'shut')) || null;
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

  // The tiles you can take the item at (x, y) from: its own and those beside it, by the hand's
  // reach (a diagonal past no corner), that you can stand on.
  function takeTiles(m, x, y) {
    const out = [[x, y]];
    for (let d = 0; d < 8; d++) {
      const tx = x + Grid.DX[d], ty = y + Grid.DY[d];
      if (!Grid.walkable(m, tx, ty)) continue;
      if (Grid.DX[d] !== 0 && Grid.DY[d] !== 0 && !(Grid.walkable(m, x, ty) && Grid.walkable(m, tx, y))) continue;
      out.push([tx, ty]);
    }
    return out;
  }
  // A step along a way (Path.to's tiles), as the legal move, or null.
  function along(obs, p) {
    if (!p.length) return null;
    const me = Obs.you(obs.vm), d = Path.dirTo([me.x, me.y], p[0]);
    return d < 0 ? null : Obs.legalAs(obs, { a: 'move', dir: d });
  }
  // The board of the view model with the given tiles walled off (your own tile and the goal
  // excepted), for Path.to.
  function walled(obs, off, gx, gy) {
    const vm = obs.vm, me = Obs.you(vm), b = Obs.board(vm), m = b.dept, tiles = [];
    for (let y = 0; y < m.h; y++) {
      let row = '';
      for (let x = 0; x < m.w; x++) row += off(x, y) && !(x === me.x && y === me.y) && !(x === gx && y === gy) ? '#' : m.tiles[y][x];
      tiles.push(row);
    }
    return { dept: { w: m.w, h: m.h, tiles, fixtures: m.fixtures }, actors: b.actors, run: b.run };
  }
  // When no step is open: strike an exhibit beside you, else wait.
  function blocked(obs, why) {
    const foe = Obs.hostiles(obs.vm).find(f => Obs.attack(obs, f.uid));
    if (foe) return { action: Obs.attack(obs, foe.uid), reason: `${why}; strikes ${foe.uid} beside it, which has ${foe.hp} HP` };
    return { action: { a: 'wait' }, reason: `${why}; waits` };
  }
  const at = t => `${t[0]},${t[1]}`;

  // Walk in: take the item if you can; otherwise the first step of the shortest way to a tile
  // you could take it from.
  function walkIn(obs, it, why) {
    const take = Obs.legalAs(obs, { a: 'take', uid: it.uid });
    if (take) return { action: take, reason: `takes ${it.uid} at ${it.x},${it.y}${why}` };
    const vm = obs.vm, m = Obs.board(vm).dept;
    let best = null;
    for (const t of takeTiles(m, it.x, it.y)) {
      // A tile an exhibit stands on is no place to take it from (a step there is a blow).
      if (vm.actors.some(a => a.uid !== 'you' && Obs.dist(a, t[0], t[1]) === 0)) continue;
      const p = Obs.path(vm, t[0], t[1]);
      if (p.length && (best === null || p.length < best.length)) best = p;
    }
    const s = best ? along(obs, best) : null;
    if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} toward ${it.uid} at ${it.x},${it.y}, ${best.length} ${best.length === 1 ? 'step' : 'steps'} from taking it${why}` };
    return blocked(obs, `no open step toward ${it.uid} at ${it.x},${it.y}${why}`);
  }
  const nothing = () => ({ action: { a: 'wait' }, reason: 'waits: no item to take is in view' });

  // The counterplay's reading: the warden, an exhibit whose Behaviour line says it stays
  // within r tiles of what it guards. Each exhibit in view is read once.
  const STAYS = /Stays within (\d+) tiles of what it guards/;
  function warden(obs) {
    const mem = obs.memory;
    if (!mem.read) mem.read = [];
    for (const a of obs.vm.actors) {
      if (a.uid === 'you' || mem.read.includes(a.uid)) continue;
      mem.read.push(a.uid);
      const m = STAYS.exec(obs.read(a.uid) || '');
      if (m && !mem.warden) mem.warden = { uid: a.uid, r: Number(m[1]) };
    }
    return mem.warden || null;
  }

  // Can an exhibit on (ax, ay) strike you on (bx, by): beside it, a diagonal past no corner?
  const strikes = (m, ax, ay, bx, by) => cheb(ax, ay, bx, by) === 1 && (ax === bx || ay === by || (Grid.walkable(m, ax, by) && Grid.walkable(m, bx, ay)));
  // An exhibit's steps from (x, y) to every tile it can walk to without leaving the tiles
  // ok(x, y) allows: an Int32Array over the board, -1 where it cannot.
  function steps(m, x, y, ok) {
    const out = new Int32Array(m.w * m.h).fill(-1), queue = [y * m.w + x];
    out[queue[0]] = 0;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], px = p % m.w, py = (p - px) / m.w;
      for (let d = 0; d < 8; d++) {
        const nx = px + Grid.DX[d], ny = py + Grid.DY[d], q = ny * m.w + nx;
        if (!Grid.canStep(m, px, py, d, 'exhibit') || !ok(nx, ny) || out[q] >= 0) continue;
        out[q] = out[p] + 1;
        queue.push(q);
      }
    }
    return out;
  }

  // THE LURE, planned once from the board as you know it, the item (ix, iy), the warden's
  // place (hx, hy) and its tether (the tiles within r of the item):
  //   take    a tile you could take the item from, not the warden's place;
  //   entry   a tile of the tether a step from take, and out a tile outside the tether a step
  //           from entry, where you wait;
  //   pocket  the tiles of the tether the warden can walk to from its place, from which it
  //           could not see take, entry or out, and from which it needs at least `deep`
  //           steps to stand where it could strike you on take;
  //   fork    a pocket tile the fork's soft noise there reaches the warden's place from
  //           (NOISE_SOFT walking tiles), so that the noise wakes it and sends it to look;
  //   spot    where you use the fork: outside the tether, outside the warden's ring at its
  //           place (RING_MOVING walking tiles with a line to it), with a line to fork within
  //           the fork's range;
  //   way     from spot to out, a tile for each of your actions after the use that wakes it
  //           (staying is a tile too), on which the warden, walking from its place to fork by
  //           its shortest way and looking at the start of each of its actions, never sees
  //           you, reaching out no sooner than it reaches fork.
  // It reaches fork at its d-th action, waits there at its next (it has arrived), and walks
  // on from the one after: so it cannot strike before its (d + deep + 2)-th action, and you,
  // stepping onto entry, then take, then taking the item after the way, are done before
  // that if the way takes at most d + deep - 2 actions. The plan with the deepest pocket,
  // then the largest, then the soonest way, then the nearest spot, then the first in reading
  // order of take, entry, out, fork and spot is chosen; null if there is none.
  function lure(obs, ix, iy, hx, hy, r) {
    const vm = obs.vm, m = Obs.board(vm).dept, me = Obs.you(vm), n = m.w * m.h;
    const inside = (x, y) => Grid.disc(x - ix, y - iy, r);
    const sees = (wx, wy, x, y) => Grid.disc(x - wx, y - wy, N.SIGHT_EXHIBIT) && Grid.los(m, wx, wy, x, y);
    const fromPlace = steps(m, hx, hy, inside);
    const tether = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (fromPlace[y * m.w + x] >= 0) tether.push([x, y]);
    // The fork's spots: outside the tether, a tile you can stand on and walk to, outside
    // the warden's ring at its place.
    const ringAt = Grid.distances(m, [[hx, hy]], N.RING_MOVING);
    const mine = Grid.distances(m, [[me.x, me.y]], n);
    const spots = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (inside(x, y) || !Grid.walkable(m, x, y) || mine[y * m.w + x] < 0) continue;
      if (ringAt[y * m.w + x] >= 0 && Grid.los(m, hx, hy, x, y)) continue;
      spots.push([x, y]);
    }
    const heard = Noise.reach(m, hx, hy, N.NOISE_SOFT);
    let best = null;
    const better = c => best === null || (c.deep - best.deep || c.pocket - best.pocket || best.way.length - c.way.length || best.walk - c.walk) > 0;
    for (const take of takeTiles(m, ix, iy)) {
      if (take[0] === hx && take[1] === hy) continue;
      // Each tether tile's steps to stand where the warden could strike take.
      const toStrike = new Int32Array(n).fill(-1);
      for (let d = 0; d < 8; d++) {
        const sx = take[0] + Grid.DX[d], sy = take[1] + Grid.DY[d];
        if (!inside(sx, sy) || fromPlace[sy * m.w + sx] < 0 || !strikes(m, sx, sy, take[0], take[1])) continue;
        const f = steps(m, sx, sy, inside);
        for (let i = 0; i < n; i++) if (f[i] >= 0 && (toStrike[i] < 0 || f[i] < toStrike[i])) toStrike[i] = f[i];
      }
      for (let d = 0; d < 8; d++) {
        const ax = take[0] - Grid.DX[d], ay = take[1] - Grid.DY[d];
        if (!inside(ax, ay) || !Grid.canStep(m, ax, ay, d)) continue;
        for (let e = 0; e < 8; e++) {
          const ox = ax - Grid.DX[e], oy = ay - Grid.DY[e];
          if (inside(ox, oy) || !Grid.canStep(m, ox, oy, e) || mine[oy * m.w + ox] < 0) continue;
          const hidden = (x, y) => !sees(x, y, take[0], take[1]) && !sees(x, y, ax, ay) && !sees(x, y, ox, oy);
          const pocket = tether.filter(([x, y]) => toStrike[y * m.w + x] >= 2 && hidden(x, y));
          for (const fork of pocket) {
            if (heard[fork[1] * m.w + fork[0]] < 0) continue;
            const deep = toStrike[fork[1] * m.w + fork[0]], dist = fromPlace[fork[1] * m.w + fork[0]];
            const toFork = steps(m, fork[0], fork[1], inside);
            // Where the warden looks from at its k-th action after it wakes.
            const looks = k => { const s = Math.min(k - 1, dist); return tether.filter(([x, y]) => fromPlace[y * m.w + x] === s && toFork[y * m.w + x] === dist - s); };
            for (const spot of spots) {
              if (!Grid.disc(fork[0] - spot[0], fork[1] - spot[1], N.TUNING_FORK[2]) || !Grid.los(m, spot[0], spot[1], fork[0], fork[1])) continue;
              // The way, an action at a time, outside the tether and out of the warden's sight.
              let ways = [[spot]], found = null;
              for (let k = 1; k <= dist + deep - 2 && ways.length && !found; k++) {
                const seen = looks(k), next = [], at = [];
                for (const w of ways) {
                  const [x, y] = w[w.length - 1];
                  for (let d2 = -1; d2 < 8; d2++) {
                    const nx = d2 < 0 ? x : x + Grid.DX[d2], ny = d2 < 0 ? y : y + Grid.DY[d2];
                    if (d2 >= 0 && (inside(nx, ny) || !Grid.canStep(m, x, y, d2))) continue;
                    if (at.includes(ny * m.w + nx) || seen.some(([wx, wy]) => sees(wx, wy, nx, ny))) continue;
                    at.push(ny * m.w + nx);
                    next.push(w.concat([[nx, ny]]));
                  }
                }
                ways = next;
                if (k >= dist) found = ways.find(w => { const t = w[w.length - 1]; return t[0] === ox && t[1] === oy; }) || null;
              }
              if (!found) continue;
              const c = { take, entry: [ax, ay], out: [ox, oy], fork, spot, way: found.slice(1), d: dist, deep, pocket: pocket.length, walk: mine[spot[1] * m.w + spot[0]] };
              if (better(c)) best = c;
            }
          }
        }
      }
    }
    if (!best) return null;
    return { take: best.take, entry: best.entry, out: best.out, fork: best.fork, spot: best.spot, way: best.way, d: best.d, deep: best.deep, pocket: best.pocket };
  }

  // A move to the tile beside you, or a wait if it is your own, as the legal action; or null.
  function moveTo(obs, t) {
    const me = Obs.you(obs.vm);
    if (me.x === t[0] && me.y === t[1]) return { a: 'wait' };
    const d = Path.dirTo([me.x, me.y], t);
    return d < 0 ? null : Obs.legalAs(obs, { a: 'move', dir: d });
  }

  Policies.add('tethered_warden', {
    naive: {
      card: {
        summary: 'Walks in: goes the shortest way to the item and takes it, whatever guards it.',
        rules: ['Beside the item (or on it), take it.',
          'Otherwise take the first step of the shortest way to a tile you could take it from (its own or one beside it, past no corner, that no exhibit stands on).',
          'If no step is open, strike an exhibit beside you, else wait.'],
      },
      decide(obs) {
        const it = itemOf(obs.vm);
        return it ? walkIn(obs, it, '') : nothing();
      },
    },
    counter: {
      card: {
        summary: 'Lures the warden with the Tuning Fork into a corner of its tether from which it cannot see the far side of the item, then, while it is there, goes round out of its sight and takes the item from that side.',
        rules: ['Read the label of every exhibit in view once; one whose Behaviour line says it stays within r tiles of what it guards is the warden, the item in view is what it guards, and its tether is the tiles within r of the item. Remember where the warden sleeps (its place) and its pips.',
          'Beside the item (or on it), take it.',
          'Plan the lure once: a tile to take the item from, a tile of the tether a step from it, and a tile outside the tether a step from that; a pocket of the tether from which the warden could not see those three tiles and would need at least two steps to strike you on the first; a pocket tile whose soft noise reaches the warden\'s place; a spot outside the tether and outside the warden\'s ring, with a line to that tile within the fork\'s range; and a way from the spot to the tile outside, a tile an action, on which the warden, walking from its place to the noise and looking at each of its actions, would not see you, and which ends no sooner than it gets there and soon enough that it cannot then reach you before you are done. Prefer the deepest pocket, then the largest, then the shortest way, then the nearest spot.',
          'While the warden sleeps, go to the spot round the outside of the tether and of its ring, and use the fork on the pocket tile until the pips it has wake it.',
          'Once it is awake, follow the way an action a tile, then step onto the tile of the tether, then the tile to take the item from, and take it.',
          'With no warden read, no plan, or once the warden is seen hunting before you have the item, walk in as the naive policy does.'],
        weights: [['pips that wake an exhibit (PIPS_TO_WAKE)', N.PIPS_TO_WAKE], ['the fork\'s range (TUNING_FORK)', N.TUNING_FORK[2]], ['the reach of a soft noise, walking tiles (NOISE_SOFT)', N.NOISE_SOFT]],
      },
      decide(obs) {
        // The item, as last seen (a pillar may hide it on the way round).
        const vm = obs.vm, mem = obs.memory, seen = itemOf(vm);
        if (seen) mem.item = { uid: seen.uid, x: seen.x, y: seen.y };
        const it = mem.item || null;
        if (!it) return nothing();
        const w = warden(obs);
        const take = Obs.legalAs(obs, { a: 'take', uid: it.uid });
        if (take) return { action: take, reason: `takes ${it.uid} at ${it.x},${it.y}` };
        const foe = w ? vm.actors.find(a => a.uid === w.uid) || null : null;
        if (!w) return walkIn(obs, it, '; no warden read');
        if (foe && foe.mode === 'dormant' && mem.since === undefined) { mem.place = [foe.x, foe.y]; mem.pips = foe.pips; mem.forks = 0; }
        if (!mem.place) return walkIn(obs, it, `; ${w.uid} was not seen asleep`);
        if (mem.plan === undefined) mem.plan = lure(obs, it.x, it.y, mem.place[0], mem.place[1], w.r) || false;
        if (foe && foe.mode === 'hunting') mem.off = true;
        if (mem.off) return walkIn(obs, it, `; ${w.uid} hunts it`);
        const p = mem.plan;
        if (!p) return walkIn(obs, it, `; no corner of ${w.uid}'s tether hides the far side of ${it.uid} from it`);
        const me = Obs.you(vm), fork = vm.you.charges && vm.you.charges.charges > 0 ? vm.you.charges : null;
        if (mem.since === undefined) {
          // The lure: to the spot, then the fork until the warden's pips wake it.
          if (me.x === p.spot[0] && me.y === p.spot[1]) {
            const use = fork ? Obs.legalAs(obs, { a: 'use', uid: fork.uid, x: p.fork[0], y: p.fork[1] }) : null;
            if (!use) { mem.off = true; return walkIn(obs, it, `; the fork cannot be used on ${at(p.fork)}`); }
            mem.forks += 1;
            const left = N.PIPS_TO_WAKE - mem.pips - mem.forks;
            if (left <= 0) mem.since = 0;
            return { action: use, reason: `uses the Tuning Fork on ${at(p.fork)}, in a corner of ${w.uid}'s tether that cannot see ${at(p.take)}, from ${at(p.spot)}: ${left <= 0 ? `its pips wake it, and it goes to look there` : `${left} more ${left === 1 ? 'pip wakes' : 'pips wake'} it`}` };
          }
          const ringAt = Grid.distances(Obs.board(vm).dept, [mem.place], N.RING_MOVING);
          const m = Obs.board(vm).dept;
          const off = (x, y) => Grid.disc(x - it.x, y - it.y, w.r) || (ringAt[y * m.w + x] >= 0 && Grid.los(m, mem.place[0], mem.place[1], x, y));
          const s = along(obs, Path.to(walled(obs, off, p.spot[0], p.spot[1]), p.spot[0], p.spot[1]));
          if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} toward ${at(p.spot)}, round the outside of ${w.uid}'s tether and its ring, to use the fork on ${at(p.fork)} from there` };
          mem.off = true;
          return walkIn(obs, it, `; no way to ${at(p.spot)} keeps out of ${w.uid}'s tether and its ring`);
        }
        // The way, an action a tile; then the tile of the tether, the tile to take from, and the take.
        mem.since += 1;
        const k = mem.since;
        const target = k <= p.way.length ? p.way[k - 1] : k === p.way.length + 1 ? p.entry : p.take;
        const s = moveTo(obs, target);
        if (!s) { mem.off = true; return walkIn(obs, it, `; it cannot step onto ${at(target)}`); }
        const why = k <= p.way.length ? `out of ${w.uid}'s sight while it walks to the noise at ${at(p.fork)}` : k === p.way.length + 1 ? `into the tether, ${w.uid} being at the noise at ${at(p.fork)}, from which it cannot see ${at(p.take)}` : `beside ${it.uid}, to take it before ${w.uid} can come back`;
        return { action: s, reason: s.a === 'wait' ? `waits at ${at(target)}, ${why}` : `steps ${Obs.DIRS[s.dir]} onto ${at(target)}, ${why}` };
      },
    },
  });
})();
