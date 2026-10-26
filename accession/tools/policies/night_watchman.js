// ACCESSION — the Night Watchman arena's policies (BUILD.md §10.3: the night watch begins;
// reach the exit). The Night Watchman comes for you wherever you can be walked to, and if
// defeated another comes WATCHMAN_RETURN turns later (its Behaviour line), while each
// night-watch bell wakes more sleepers (§8.4); so the naive policy stays and fights, and the
// counterplay leaves. Both see only what a player sees (obs); neither needs to remember
// anything between decisions.
// A classic script, loaded into the hardened core context (tools/core-context.js).
'use strict';
(() => {
  // The hostile exhibit beside you that can be struck, the least health first, then by uid.
  function weakest(obs) {
    const list = Obs.hostiles(obs.vm).filter(f => Obs.attack(obs, f.uid));
    list.sort((a, b) => (a.hp - b.hp) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    return list.length ? list[0] : null;
  }
  const strike = (obs, f, why) => ({ action: Obs.attack(obs, f.uid), reason: `${why}strikes ${f.uid} beside it, which has ${f.hp} HP` });

  // The exit doors you know of (X on the map as you know it), nearest by the way you would
  // walk first, then the upper, then the left: [{x, y, way}] (way: Obs.path's tiles, [] where
  // you stand on it).
  function exits(obs) {
    const vm = obs.vm, me = Obs.you(vm), out = [];
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      if (vm.tiles[y][x] !== 'X') continue;
      if (x === me.x && y === me.y) { out.push({ x, y, way: [] }); continue; }
      const p = Obs.path(vm, x, y);
      if (p.length) out.push({ x, y, way: p });
    }
    return out.sort((a, b) => (a.way.length - b.way.length) || (a.y - b.y) || (a.x - b.x));
  }

  Policies.add('night_watchman', {
    naive: {
      card: {
        summary: 'Stays where it is and fights whatever comes, the night watch or not.',
        rules: ['If an exhibit beside you can be struck, strike the one with the least health (then by uid).',
          'Otherwise, wait where you are.'],
      },
      decide(obs) {
        const f = weakest(obs);
        if (f) return strike(obs, f, '');
        const foes = Obs.hostiles(obs.vm), me = Obs.you(obs.vm), d = foes.length ? Obs.dist(foes[0], me.x, me.y) : 0;
        return { action: { a: 'wait' }, reason: foes.length ? `waits for ${foes[0].uid}, ${d} ${d === 1 ? 'tile' : 'tiles'} away, to come to it` : 'waits: no exhibit in view' };
      },
    },
    counter: {
      card: {
        summary: 'Leaves: walks the shortest way to the nearest exit door it knows and leaves by it.',
        rules: ['Standing on an exit door, leave by it.',
          'Otherwise take the first step of the way a tap on the nearest exit door would walk.',
          'If no step is open, strike an exhibit beside you (the least health first), else wait.'],
      },
      decide(obs) {
        const list = exits(obs);
        if (!list.length) {
          const f = weakest(obs);
          return f ? strike(obs, f, 'no exit door it knows can be walked to; ') : { action: { a: 'wait' }, reason: 'waits: no exit door it knows can be walked to' };
        }
        const e = list[0], leave = Obs.legalOf(obs, 'leave')[0];
        if (!e.way.length && leave) return { action: leave, reason: `leaves by the exit door at ${e.x},${e.y}, where it stands` };
        const me = Obs.you(obs.vm), d = e.way.length ? Path.dirTo([me.x, me.y], e.way[0]) : -1;
        const s = d < 0 ? null : Obs.legalAs(obs, { a: 'move', dir: d });
        if (s) return { action: s, reason: `steps ${Obs.DIRS[d]} toward the exit door at ${e.x},${e.y}, ${e.way.length} ${e.way.length === 1 ? 'step' : 'steps'} away, to leave before the night watch catches it` };
        const f = weakest(obs);
        return f ? strike(obs, f, `no step toward the exit door at ${e.x},${e.y} is open; `) : { action: { a: 'wait' }, reason: `no step toward the exit door at ${e.x},${e.y} is open; waits` };
      },
    },
  });
})();
