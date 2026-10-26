// ACCESSION — the axis_sniper arena's policies (BUILD.md §10.3; test/arena/axis_sniper.txt):
// cross a gallery to its exit door, with a Heliograph (an axis_sniper) in the row the straight
// way runs along. A classic script in the hardened core context, seeing only obs (lib.js).
//
//   naive    walks straight to the door, the way a tap on it walks, and leaves.
//   counter  reads each exhibit's label; for one whose Behaviour line says it moves to share
//            your row or column and fires a beam along it, it keeps off that row and column
//            within the reach the label gives (its beam's, and its axis trigger's while it
//            sleeps), never ends a step on a tile a mark covers, and leaves.
// What the counter remembers (the snipers it has read, where it last saw them) is in
// obs.memory, as every policy's is.
'use strict';
(() => {
  // The cost of stepping onto a tile in a sniper's line, beyond the step itself: a detour of
  // up to this many steps is taken to keep off it.
  const DANGER = 30;
  // The exit doors on the board (X), row-major.
  function exits(vm) {
    const out = [];
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) if (vm.tiles[y].charAt(x) === 'X') out.push([x, y]);
    return out;
  }
  // Is an exhibit in view standing on (x, y)?
  const occupied = (vm, x, y) => vm.actors.some(a => a.uid !== 'you' && Obs.dist(a, x, y) === 0);
  // The legal leave, if you stand on an exit door.
  const leave = obs => { const l = Obs.legalOf(obs, 'leave'); return l.length ? l[0] : null; };
  // The exit door nearest you by walking (the tap's way), ties in row-major order: [x, y, steps].
  function door(vm) {
    let best = null;
    for (const [x, y] of exits(vm)) {
      const n = Obs.path(vm, x, y).length;
      if (n && (!best || n < best[2])) best = [x, y, n];
    }
    return best;
  }
  // A tile a pending damage mark covers.
  const marked = (vm, x, y) => (vm.marks || []).some(m => m.kind === 'telegraph' && m.x === x && m.y === y);

  // What the counter reads in a label: a sniper is an exhibit whose Behaviour line says it
  // moves to share your row or column; its reach is the longer of its beam's ("a beam up to N
  // tiles") and, while it sleeps, its axis trigger's ("in its row or column within N tiles");
  // a reach the label does not give is the whole row or column.
  const SNIPES = /share your row or column/;
  const BEAM = /beam up to (\d+) tiles/;
  const AXIS = /row or column within (\d+) tiles/;
  function readSniper(text) {
    if (!text || !SNIPES.test(text)) return null;
    const b = BEAM.exec(text), a = AXIS.exec(text);
    return { beam: b ? Number(b[1]) : null, axis: a ? Number(a[1]) : null };
  }
  // memory.snipers: [{uid, x, y, beam, axis, asleep}], the snipers read so far, where each was
  // last seen and whether it slept then; memory.read: the uids whose labels were read.
  function learn(obs) {
    const mem = obs.memory, vm = obs.vm;
    if (!mem.read) { mem.read = []; mem.snipers = []; }
    for (const a of Obs.hostiles(vm)) {
      if (!mem.read.includes(a.uid)) {
        mem.read.push(a.uid);
        const s = readSniper(obs.read(a.uid));
        if (s) mem.snipers.push({ uid: a.uid, x: a.x, y: a.y, beam: s.beam, axis: s.axis, asleep: a.mode === 'dormant' });
      }
      for (const s of mem.snipers) if (s.uid === a.uid) { s.x = a.x; s.y = a.y; s.asleep = a.mode === 'dormant'; }
    }
    return mem.snipers;
  }
  // The reach of a sniper's row and column: its beam, or its axis trigger's while it sleeps,
  // whichever is longer; the whole board if its label gave neither.
  const reach = (s, vm) => {
    const r = Math.max(s.beam || 0, s.asleep ? s.axis || 0 : 0);
    return r > 0 ? r : Math.max(vm.w, vm.h);
  };
  // Is (x, y) in a sniper's row or column, within its reach, with nothing that blocks sight
  // between (a beam stops there, and so does its axis trigger)?
  function inLine(vm, s, x, y) {
    if ((x !== s.x && y !== s.y) || (x === s.x && y === s.y)) return false;
    if (Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) > reach(s, vm)) return false;
    return Grid.los(Obs.board(vm).dept, s.x, s.y, x, y);
  }
  const exposed = (vm, snipers, x, y) => snipers.some(s => inLine(vm, s, x, y));
  // Who covers (x, y), for reasons.
  const whose = (vm, snipers, x, y) => snipers.filter(s => inLine(vm, s, x, y)).map(s => s.uid);

  // The legal step (no exhibit on its tile, no mark on it) that lowers `cost` the most from
  // here, ties in direction order; cost(x, y) is a whole number, or -1 for a tile it cannot
  // reach.
  function bestStep(obs, cost) {
    const vm = obs.vm, me = Obs.you(vm);
    let best = null, bc = -1;
    for (const l of Obs.legalOf(obs, 'move')) {
      const x = me.x + Grid.DX[l.dir], y = me.y + Grid.DY[l.dir];
      if (occupied(vm, x, y) || marked(vm, x, y)) continue;
      const c = cost(x, y);
      if (c < 0) continue;
      if (best === null || c < bc) { best = l; bc = c; }
    }
    return best === null ? null : { action: best, cost: bc };
  }

  Policies.add('axis_sniper', {
    naive: {
      card: {
        summary: 'Walks straight across to the exit door, the way a tap on it would walk, and leaves; it pays the Heliograph and its marks no attention.',
        rules: ['If you stand on an exit door, leave by it.',
          'Otherwise take the first step of the way a tap on the nearest exit door would walk.',
          'Otherwise wait.'],
      },
      decide(obs) {
        const vm = obs.vm, me = Obs.you(vm), out = leave(obs);
        if (out) return { action: out, reason: `leaves by the exit door at ${me.x},${me.y}` };
        const d = door(vm), s = d ? Obs.step(obs, d[0], d[1]) : null;
        if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} on the straight way to the exit door at ${d[0]},${d[1]}, ${d[2]} ${d[2] === 1 ? 'step' : 'steps'} away` };
        return { action: { a: 'wait' }, reason: 'waits: no way to an exit door' };
      },
    },
    counter: {
      card: {
        summary: 'Crosses to the exit door off the row and column of every exhibit whose label says it moves to share them and fires along them, and never ends a step on a marked tile.',
        rules: ['Read the label of each exhibit in view once; one whose Behaviour line says it moves to share your row or column is a sniper, whose row and column are dangerous within the longer of its beam\'s reach and, while it sleeps, its axis trigger\'s, as the label gives them (the whole row and column if it gives neither), up to a tile that blocks sight.',
          'If you stand on an exit door, leave by it.',
          'The cost of a way to the nearest exit door: each step costs 1, a step onto a dangerous tile 1 + the danger weight, and a step onto a marked tile or an exhibit\'s more than any way round it.',
          'If a mark covers your tile, take the step onto no mark and no exhibit whose tile has the cheapest way to the door.',
          'Otherwise take the step onto no mark and no exhibit that lowers the cost of the way most; wait if none lowers it.'],
        weights: [['danger weight', DANGER]],
      },
      decide(obs) {
        const vm = obs.vm, me = Obs.you(vm), snipers = learn(obs), out = leave(obs);
        if (out) return { action: out, reason: `leaves by the exit door at ${me.x},${me.y}` };
        const d = door(vm);
        if (!d) return { action: { a: 'wait' }, reason: 'waits: no way to an exit door' };
        const m = Obs.board(vm).dept, far = m.w * m.h * (DANGER + 1);
        // The way to the door: each step 1, a dangerous tile DANGER more, and a marked tile or
        // an exhibit's more than any way round it (the step itself never goes onto one: below).
        const field = Grid.distances(m, [[d[0], d[1]]], far * far,
          (x, y) => marked(vm, x, y) || occupied(vm, x, y) ? far : exposed(vm, snipers, x, y) ? DANGER : 0);
        const cost = (x, y) => field[y * m.w + x];
        const here = cost(me.x, me.y), onMark = marked(vm, me.x, me.y);
        const s = bestStep(obs, cost);
        const names = list => list.join(' and ');
        if (onMark && s) return { action: s.action, reason: `steps ${Obs.DIRS[s.action.dir]} off the mark on ${me.x},${me.y}, toward the exit door at ${d[0]},${d[1]}` };
        if (s && (here < 0 || s.cost < here)) {
          const by = whose(vm, snipers, me.x + Grid.DX[s.action.dir], me.y + Grid.DY[s.action.dir]);
          return { action: s.action, reason: by.length ? `steps ${Obs.DIRS[s.action.dir]} toward the exit door at ${d[0]},${d[1]}, into the line of ${names(by)}, since no way round it is shorter`
            : snipers.length ? `steps ${Obs.DIRS[s.action.dir]} toward the exit door at ${d[0]},${d[1]}, outside the line of ${names(snipers.map(x => x.uid))} (its row and column within its reach)`
              : `steps ${Obs.DIRS[s.action.dir]} toward the exit door at ${d[0]},${d[1]} by the shortest way: no exhibit seen yet moves to share your row or column` };
        }
        return { action: { a: 'wait' }, reason: onMark ? `waits on the mark at ${me.x},${me.y}: every step off it is blocked` : `waits: no step brings the exit door at ${d[0]},${d[1]} nearer` };
      },
    },
  });
})();
