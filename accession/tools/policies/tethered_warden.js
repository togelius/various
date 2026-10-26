// ACCESSION — the tethered warden arena's policies (BUILD.md §10.3: take the item a tethered
// warden guards; you carry a Tuning Fork). The warden stays within its tether of what it
// guards, wakes at once when you come within it, and, hunting you while you stand outside
// it, goes back to its place instead of fighting (its Behaviour line). The naive policy walks
// in and takes the item; the counterplay wakes it from outside the tether with the fork, on
// the far side of the item, and steps in to take it only once the warden is too far from
// the tile it takes from to strike before it is done. Both see only what a player sees
// (obs); the counterplay remembers in obs.memory the warden it read (warden: {uid, r}) and
// the labels it has read (read).
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
  // The counterplay steps in only with the warden at least GAP tiles from the tile it takes
  // from (so the warden needs two steps to come beside it, and the take comes first), and
  // waits for that at most PATIENCE turns before walking in regardless.
  const GAP = 3, PATIENCE = 10;

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
        summary: 'Lures the warden aside with the Tuning Fork: wakes it from outside its tether with a noise on the far side of the item, then steps in to take the item only when the warden is too far from that tile to strike first.',
        rules: ['Read the label of every exhibit in view once; one whose Behaviour line says it stays within r tiles of what it guards is the warden, and the item in view is what it guards. Its tether is the tiles within r of the item.',
          'Beside the item (or on it), take it.',
          'While the warden sleeps, the fork has a charge and you stand outside the tether: use the fork on the tile of the tether farthest from you of those it can reach from where you stand (within its range, in your sight).',
          `Otherwise (the warden awake, the fork spent, or no tile of the tether in its reach): of the tiles you could take the item from that you can step onto from a tile outside the tether, choose the one farthest from the warden. Go round the outside of the tether to the tile a step from it, and step onto it while the warden sleeps or is at least ${GAP} tiles from it. Until then wait outside the tether, stepping away from the warden if it is beside you or you are inside the tether.`,
          `Without a warden in view, or after waiting ${PATIENCE} turns, walk in as the naive policy does.`],
        weights: [['tiles between the warden and the take tile before stepping in', GAP], ['turns it waits before walking in regardless', PATIENCE]],
      },
      decide(obs) {
        const vm = obs.vm, it = itemOf(vm);
        if (!it) return nothing();
        const w = warden(obs);
        const take = Obs.legalAs(obs, { a: 'take', uid: it.uid });
        if (take) return { action: take, reason: `takes ${it.uid} at ${it.x},${it.y}` };
        const foe = w ? vm.actors.find(a => a.uid === w.uid) || null : null;
        if (!w || !foe) return walkIn(obs, it, w ? `; the warden ${w.uid} is out of view` : '; no warden read');
        const mem = obs.memory;
        if ((mem.waited || 0) >= PATIENCE) return walkIn(obs, it, `; it has waited ${mem.waited} turns for ${w.uid} to go far enough`);
        const me = Obs.you(vm), m = Obs.board(vm).dept;
        const inside = (x, y) => Grid.disc(x - it.x, y - it.y, w.r);
        const fork = vm.you.charges && vm.you.charges.charges > 0 ? vm.you.charges : null;
        if (foe.mode === 'dormant' && fork) {
          // The fork's targets now: the legal uses of it, on tiles of the tether.
          const aims = Obs.legalOf(obs, 'use').filter(u => u.uid === fork.uid && inside(u.x, u.y));
          if (aims.length && !inside(me.x, me.y)) {
            aims.sort((a, b) => (cheb(b.x, b.y, me.x, me.y) - cheb(a.x, a.y, me.x, me.y)) || (a.y - b.y) || (a.x - b.x));
            const f = aims[0];
            return { action: f, reason: `uses the Tuning Fork at ${f.x},${f.y}, the tile of ${w.uid}'s tether farthest from it, to wake it on the far side of ${it.uid} (${fork.charges} ${fork.charges === 1 ? 'charge' : 'charges'} left before)` };
          }
        }
        // Step in: the take tiles reached in one step from outside the tether.
        const entries = [];
        for (const t of takeTiles(m, it.x, it.y)) {
          if (vm.actors.some(a => a.uid !== 'you' && a.x === t[0] && a.y === t[1])) continue;
          for (let d = 0; d < 8; d++) {
            const ox = t[0] - Grid.DX[d], oy = t[1] - Grid.DY[d];
            if (inside(ox, oy) || !Grid.canStep(m, ox, oy, d)) continue;
            entries.push({ t, o: [ox, oy], d, far: cheb(foe.x, foe.y, t[0], t[1]) });
          }
        }
        entries.sort((a, b) => (b.far - a.far) || (a.t[1] - b.t[1]) || (a.t[0] - b.t[0]) || (a.d - b.d));
        const e = entries.length ? entries[0] : null;
        if (!e) return walkIn(obs, it, `; no tile it could take ${it.uid} from is a step from outside ${w.uid}'s tether`);
        const away = foe.mode === 'dormant' ? 'asleep' : `${e.far} ${e.far === 1 ? 'tile' : 'tiles'} from ${at(e.t)}`;
        if (me.x === e.o[0] && me.y === e.o[1]) {
          if (e.far >= GAP || foe.mode === 'dormant') {
            const s = Obs.legalAs(obs, { a: 'move', dir: e.d });
            if (s) return { action: s, reason: `steps ${Obs.DIRS[e.d]} into the tether onto ${at(e.t)}, beside ${it.uid}: ${w.uid} is ${away}` };
          }
        } else if (!inside(me.x, me.y) || e.far >= GAP) {
          // Go to the tile outside the tether, by a way outside it.
          const p = Path.to(walled(obs, inside, e.o[0], e.o[1]), e.o[0], e.o[1]), s = along(obs, p);
          if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} round the outside of ${w.uid}'s tether toward ${at(e.o)}, a step from ${at(e.t)} beside ${it.uid}; ${w.uid} is ${away}` };
        }
        if (Obs.dist(foe, me.x, me.y) <= 1 || inside(me.x, me.y)) {
          const s = Obs.away(obs, foe.x, foe.y);
          if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} away from ${w.uid}, which is ${away}` };
        }
        mem.waited = (mem.waited || 0) + 1;
        return { action: { a: 'wait' }, reason: `waits outside ${w.uid}'s tether: it is ${away}, too near to step in and take ${it.uid} (wait ${mem.waited} of ${PATIENCE})` };
      },
    },
  });
})();
