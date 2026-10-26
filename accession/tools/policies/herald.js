// ACCESSION — the herald arena's policies (BUILD.md §10.3: a herald and three sleeping fodder
// within its call; reach the far door). A herald calls the first time it sees you after it
// wakes, and the call wakes every sleeper within HERALD_RANGE of it (its Behaviour line), so
// the naive policy walks the straight way past it and the counterplay keeps a wall between
// them. Both see only what a player sees (obs), and keep what they remember in obs.memory:
//   door      the far door: the open door on the board farthest from where you start;
//   heralds   [{uid, x, y}]: the exhibits whose label says they call, where last seen;
//   read      the uids whose labels they have read.
// A classic script, loaded into the hardened core context (tools/core-context.js).
'use strict';
(() => {
  // The far door, chosen at the first decision and remembered: of the open doors on the map
  // as you know it, the farthest from you (Chebyshev), ties row-major.
  function door(obs) {
    const mem = obs.memory, vm = obs.vm, me = Obs.you(vm);
    if (mem.door) return mem.door;
    let best = null, bd = -1;
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      if (vm.tiles[y][x] !== "'") continue;
      const d = Math.max(Math.abs(x - me.x), Math.abs(y - me.y));
      if (d > bd) { best = [x, y]; bd = d; }
    }
    mem.door = best;
    return best;
  }

  // Reads the label of every exhibit in view not read before (reading takes no time), and
  // remembers each herald (its Behaviour line: "the first time it sees you it calls") where
  // it is seen now.
  const CALLS = /the first time it sees you it calls/;
  function heralds(obs) {
    const mem = obs.memory;
    if (!mem.read) { mem.read = []; mem.heralds = []; }
    for (const a of obs.vm.actors) {
      if (a.uid === 'you') continue;
      if (!mem.read.includes(a.uid)) {
        mem.read.push(a.uid);
        const text = obs.read(a.uid);
        if (text && CALLS.test(text)) mem.heralds.push({ uid: a.uid, x: a.x, y: a.y });
      }
      const h = mem.heralds.find(k => k.uid === a.uid);
      if (h) { h.x = a.x; h.y = a.y; }
    }
    return mem.heralds;
  }

  // A step along a path (a list of tiles from Path.to), as the legal move, or null.
  function along(obs, p) {
    if (!p.length) return null;
    const me = Obs.you(obs.vm), d = Path.dirTo([me.x, me.y], p[0]);
    return d < 0 ? null : Obs.legalAs(obs, { a: 'move', dir: d });
  }

  // The tiles a herald at (hx, hy) could see you on: within SIGHT_EXHIBIT of it, with a
  // straight line to it (§8.2). A Uint8Array over the board, 1 on each such tile.
  function sight(m, hx, hy) {
    const out = new Uint8Array(m.w * m.h), r = N.SIGHT_EXHIBIT;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++)
      if (Grid.disc(x - hx, y - hy, r) && Grid.los(m, hx, hy, x, y)) out[y * m.w + x] = 1;
    return out;
  }

  // The shortest way to (gx, gy) over tiles no remembered herald could see you on (your own
  // tile and the goal excepted), as Path.to finds it on the board with those tiles walled
  // off; [] if there is none.
  function hiddenWay(obs, list, gx, gy) {
    const vm = obs.vm, me = Obs.you(vm), b = Obs.board(vm), m = b.dept;
    const seen = list.map(h => sight(m, h.x, h.y));
    const tiles = [];
    for (let y = 0; y < m.h; y++) {
      let row = '';
      for (let x = 0; x < m.w; x++) {
        const keep = (x === me.x && y === me.y) || (x === gx && y === gy);
        row += !keep && seen.some(s => s[y * m.w + x] === 1) ? '#' : m.tiles[y][x];
      }
      tiles.push(row);
    }
    return Path.to({ dept: { w: m.w, h: m.h, tiles, fixtures: m.fixtures }, actors: b.actors, run: b.run }, gx, gy);
  }

  // When no step is open: strike an exhibit beside you that blocks the way, else wait.
  function blocked(obs, why) {
    const foe = Obs.hostiles(obs.vm).find(f => Obs.attack(obs, f.uid));
    if (foe) return { action: Obs.attack(obs, foe.uid), reason: `${why}; strikes ${foe.uid} beside it, which has ${foe.hp} HP` };
    return { action: { a: 'wait' }, reason: `${why}; waits` };
  }
  const where = t => `${t[0]},${t[1]}`;
  const steps = n => `${n} ${n === 1 ? 'step' : 'steps'} away`;
  const noDoor = () => ({ action: { a: 'wait' }, reason: 'waits: no open door is on the map it knows' });

  Policies.add('herald', {
    naive: {
      card: {
        summary: 'Walks the shortest way to the far door, whatever sees it on the way.',
        rules: ['The goal is the open door farthest from where you start.',
          'Take the first step of the way a tap on the door would walk.',
          'If no step is open, strike an exhibit beside you, else wait.'],
      },
      decide(obs) {
        const g = door(obs);
        if (!g) return noDoor();
        const p = Obs.path(obs.vm, g[0], g[1]), s = along(obs, p);
        if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} on the shortest way to the far door at ${where(g)}, ${steps(p.length)}` };
        return blocked(obs, `no open step toward the far door at ${where(g)}`);
      },
    },
    counter: {
      card: {
        summary: 'Reads each exhibit in view to find the heralds, then walks to the far door by the shortest way on which no herald could see it, keeping a wall between them.',
        rules: ['The goal is the open door farthest from where you start.',
          'Read the label of every exhibit in view once; an exhibit whose Behaviour line says that the first time it sees you it calls is a herald. Remember where each herald was last seen.',
          'A herald could see you on a tile within its sight (SIGHT_EXHIBIT tiles) with a straight line to it. Take the first step of the shortest way to the door over tiles no remembered herald could see you on.',
          'If there is no such way, take the first step of the shortest way.',
          'If no step is open, strike an exhibit beside you, else wait.'],
        weights: [['a herald\'s sight, in tiles (SIGHT_EXHIBIT)', N.SIGHT_EXHIBIT]],
      },
      decide(obs) {
        const g = door(obs);
        if (!g) return noDoor();
        const list = heralds(obs), names = list.map(h => `${h.uid} at ${h.x},${h.y}`).join(' and ');
        if (list.length) {
          const p = hiddenWay(obs, list, g[0], g[1]), s = along(obs, p);
          if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} on the way to the far door at ${where(g)} that ${names} cannot see, ${steps(p.length)}` };
        }
        const p = Obs.path(obs.vm, g[0], g[1]), s = along(obs, p);
        const why = list.length ? `no way to the far door at ${where(g)} is hidden from ${names}` : `no herald seen`;
        if (s) return { action: s, reason: `${why}; steps ${Obs.DIRS[s.dir]} on the shortest way, ${steps(p.length)}` };
        return blocked(obs, `${why}, and no step toward the door is open`);
      },
    },
  });
})();
