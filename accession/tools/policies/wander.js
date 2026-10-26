// ACCESSION — the wander policy (BUILD.md §10.2, §10.3's M3 battery): a visitor who explores
// a department and fights what it meets, so that the battery's department runs see what a
// visit holds (rooms, doors, cases, items, the bell and the night watch) and end in deaths
// whose recaps can be checked. It sees only what a player sees (obs: the view model, the legal
// actions) and remembers only in obs.memory, where it keeps the tile it is walking to; its one
// chance, where to roam once everything it can reach is seen, is drawn on obs.rng.
// It never leaves: a visit ends when it dies, or at the run's cap.
// A classic script, loaded into the hardened core context (tools/core-context.js).
'use strict';
(() => {
  const NEAREST = 6;   // frontier tiles tried, nearest first, before it gives up on exploring
  const HOME_IN = 40;  // decisions of roaming toward one tile before it picks another

  const byUid = (a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);
  const tileWord = (x, y) => `${x},${y}`;
  // The exhibits in view it may go for: not in an intact case (it cannot strike into one).
  const foes = obs => Obs.hostiles(obs.vm).filter(f => !f.encased);

  // Walking distance from you over the board as shown (Obs.board: unseen tiles are walls).
  function reach(vm) {
    const me = Obs.you(vm), m = Obs.board(vm).dept;
    return { m, dist: Grid.distances(m, [[me.x, me.y]], m.w * m.h, null, 'you') };
  }
  // The frontier: tiles you have seen and can walk to, beside a tile you have not seen, the
  // nearest first (then the upper, then the left).
  function frontier(vm) {
    const { dist } = reach(vm), out = [];
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      const d = dist[y * vm.w + x];
      if (d <= 0) continue;
      let open = false;
      for (let k = 0; k < 8 && !open; k++) {
        const nx = x + Grid.DX[k], ny = y + Grid.DY[k];
        if (nx >= 0 && ny >= 0 && nx < vm.w && ny < vm.h && vm.tiles[ny][nx] === ' ') open = true;
      }
      if (open) out.push({ x, y, d });
    }
    return out.sort((a, b) => (a.d - b.d) || (a.y - b.y) || (a.x - b.x)).slice(0, NEAREST);
  }
  // The first legal step toward (x, y), the way a tap there would walk, or null.
  const toward = (obs, x, y) => Obs.step(obs, x, y);

  Policies.add('wander', {
    wander: {
      card: {
        summary: 'Explores the department and fights whatever it meets, so the battery sees whole visits and the deaths they end in; it never leaves.',
        rules: [
          'If an exhibit in view can be struck, strike the one with the least health (then the nearest, then by uid).',
          'Otherwise, if an exhibit in view stands outside a case, walk toward the nearest (then by uid), the way a tap on it would.',
          'Otherwise, if a case beside you can be opened, open it (the first in direction order).',
          'Otherwise, if an item beside you or under you can be taken, take it.',
          'Otherwise explore: walk toward the nearest tile you have seen beside one you have not (then the upper, then the left), trying the nearest 6.',
          'Otherwise roam: walk toward a tile you have seen, drawn at random among those you can reach, for at most 40 decisions, then draw another.',
          'Otherwise, wait.',
        ],
        weights: [['frontier tiles tried', NEAREST], ['decisions toward one roaming tile', HOME_IN]],
      },
      decide(obs) {
        const vm = obs.vm, me = Obs.you(vm), mem = obs.memory, list = foes(obs);
        const strikable = list.filter(f => Obs.attack(obs, f.uid))
          .sort((a, b) => (a.hp - b.hp) || (Obs.dist(a, me.x, me.y) - Obs.dist(b, me.x, me.y)) || byUid(a, b));
        if (strikable.length) { const f = strikable[0]; return { action: Obs.attack(obs, f.uid), reason: `strikes ${f.uid}, which has ${f.hp} HP` }; }
        const near = list.slice().sort((a, b) => (Obs.dist(a, me.x, me.y) - Obs.dist(b, me.x, me.y)) || byUid(a, b));
        for (const f of near) {
          const s = toward(obs, f.x, f.y);
          if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} toward ${f.uid}, ${Obs.dist(f, me.x, me.y)} tiles away, to fight it` };
        }
        const open = Obs.legalOf(obs, 'open')[0];
        if (open) return { action: open, reason: `opens the case at ${tileWord(open.x, open.y)}` };
        const take = Obs.legalOf(obs, 'take')[0];
        if (take) return { action: take, reason: `takes ${take.uid}` };
        mem.roam = mem.roam || null;
        for (const t of frontier(vm)) {
          const s = toward(obs, t.x, t.y);
          if (s) { mem.roam = null; return { action: s, reason: `steps ${Obs.DIRS[s.dir]} to explore, toward ${tileWord(t.x, t.y)} beside tiles it has not seen, ${t.d} steps away` }; }
        }
        // Everything it can reach is seen: roam to a tile drawn at random, for a while.
        if (mem.roam && (mem.roam.n >= HOME_IN || (mem.roam.x === me.x && mem.roam.y === me.y))) mem.roam = null;
        if (!mem.roam) {
          const { dist } = reach(vm), tiles = [];
          for (let i = 0; i < dist.length; i++) if (dist[i] > 0) tiles.push(i);
          if (tiles.length) { const i = obs.rng.pick(tiles); mem.roam = { x: i % vm.w, y: (i - (i % vm.w)) / vm.w, n: 0 }; }
        }
        if (mem.roam) {
          mem.roam.n++;
          const s = toward(obs, mem.roam.x, mem.roam.y);
          if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} to roam toward ${tileWord(mem.roam.x, mem.roam.y)}: it has seen all it can reach` };
          mem.roam = null;
        }
        return { action: { a: 'wait' }, reason: 'waits: nothing in view to fight, and no step to explore or roam' };
      },
    },
  });
})();
