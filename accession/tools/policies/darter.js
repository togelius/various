// ACCESSION — the darter arena's policies (BUILD.md §10.3; test/arena/darter.txt): a darter in
// an open room. A darter steps two tiles a turn and, beside you, strikes and at once steps
// back in the same action (§8.1). Naive chases it: each turn it walks up to the darter, which
// then strikes and steps away before naive's next turn, so naive rarely strikes at all. The
// counterplay puts its back to the walls of the nearest corner and holds still there: the
// darter has to come back beside it to strike, and on some of those turns it is still
// there when the counterplay's turn comes, and is struck.
//
// A classic script, loaded after lib.js into the hardened core context. Each policy sees only
// obs (Obs.make: the view model, the labels it reads, the legal actions) and keeps what it
// remembers in obs.memory, fresh for each run; this file keeps nothing of its own (§10.2).
'use strict';
(() => {
  // Turns without an exhibit in view before a policy leaves its place to look for one.
  const PATIENCE = 10;

  const at = (a, p) => !!p && a.x === p[0] && a.y === p[1];
  const byUid = (a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);

  // The exhibits you can strike now (a legal attack), the weakest first, then the nearest,
  // then by uid.
  function strikable(obs) {
    const me = Obs.you(obs.vm);
    return Obs.hostiles(obs.vm).filter(f => Obs.attack(obs, f.uid))
      .sort((a, b) => (a.hp - b.hp) || (Obs.dist(a, me.x, me.y) - Obs.dist(b, me.x, me.y)) || byUid(a, b));
  }
  const strike = (f, where) => ({ action: { a: 'attack', uid: f.uid }, reason: `attacks ${f.uid} beside it${where}, ${f.hp} of ${f.maxHp} HP left` });

  // The nearest corner: a tile you can walk on with walls on two sides that meet (north and
  // west, north and east, south and west, or south and east), the nearest by the way a tap
  // would walk you there; null if none is in view or none can be walked to.
  function corner(vm) {
    const m = Obs.board(vm).dept, me = Obs.you(vm), wall = (x, y) => !Grid.walkable(m, x, y);
    let best = null, bestLen = 0;
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      if (wall(x, y) || !((wall(x, y - 1) || wall(x, y + 1)) && (wall(x - 1, y) || wall(x + 1, y)))) continue;
      const here = me.x === x && me.y === y, len = here ? 0 : Obs.path(vm, x, y).length;
      if (!here && !len) continue;
      if (best === null || len < bestLen) { best = [x, y]; bestLen = len; }
    }
    return best;
  }

  // Where an exhibit was last seen, and when (in memory), so that a policy that has seen none
  // for PATIENCE turns goes to look; then the step toward that place, or null.
  function remember(obs) {
    const mem = obs.memory, foes = Obs.hostiles(obs.vm);
    if (mem.since === undefined) mem.since = obs.vm.turn;
    if (foes.length) { mem.since = obs.vm.turn; mem.last = [foes[0].x, foes[0].y]; }
    return foes;
  }
  function look(obs) {
    const mem = obs.memory, me = Obs.you(obs.vm);
    if (obs.vm.turn - mem.since < PATIENCE || !mem.last || at(me, mem.last)) return null;
    const s = Obs.step(obs, mem.last[0], mem.last[1]);
    return s ? { action: s, reason: `steps ${Obs.DIRS[s.dir]} toward ${mem.last[0]},${mem.last[1]}, where it last saw an exhibit ${obs.vm.turn - mem.since} turns ago` } : null;
  }

  // The label of each exhibit, read the first time it is in view: the line of the label that
  // gives your odds against it, for the reason, or '' (a rule-aware policy reads labels).
  function readNew(obs, foes) {
    const mem = obs.memory;
    if (!mem.read) mem.read = [];
    const out = [];
    for (const f of foes) {
      if (mem.read.includes(f.uid)) continue;
      mem.read.push(f.uid);
      const t = obs.read(f.uid), line = t ? t.split('\n').find(l => l.startsWith('You have a')) : null;
      out.push(line ? `reads the label of ${f.uid} ("${line}")` : `reads the label of ${f.uid}`);
    }
    return out.length ? out.join('; ') + '; then ' : '';
  }

  Policies.add('darter', {
    naive: {
      card: {
        summary: 'Chases the darter: strikes it when it is beside it, and otherwise walks after it.',
        rules: [
          'If an exhibit beside it can be struck, strike the one with the least health (then the nearest, then by uid).',
          'Otherwise, if an exhibit is in view, take the first step of the way a tap on the nearest would walk.',
          `Otherwise, if it has seen no exhibit for ${PATIENCE} turns, walk toward where it last saw one.`,
          'Otherwise, wait.',
        ],
        weights: [['turns without an exhibit in view before it goes to look', PATIENCE]],
      },
      decide(obs) {
        const foes = remember(obs), me = Obs.you(obs.vm), s = strikable(obs);
        if (s.length) return strike(s[0], '');
        for (const f of foes) {
          const st = Obs.step(obs, f.x, f.y);
          if (st) return { action: st, reason: `steps ${Obs.DIRS[st.dir]} after ${f.uid}, ${Obs.dist(f, me.x, me.y)} tiles away` };
        }
        const l = look(obs);
        if (l) return l;
        return { action: { a: 'wait' }, reason: foes.length ? 'waits: no way toward an exhibit in view' : 'waits: no exhibit in view' };
      },
    },
    counter: {
      card: {
        summary: 'Puts its back to a wall: goes to the nearest corner and holds still there, striking the darter whenever it is beside it, never walking after it.',
        rules: [
          'Find the nearest corner once, at its first decision: a tile with walls on two sides that meet.',
          'Read the label of each exhibit the first time it is in view.',
          'If an exhibit beside it can be struck, strike the one with the least health (then the nearest, then by uid).',
          'Otherwise, if it is not standing in the corner, take the first step of the way a tap on the corner would walk.',
          `Otherwise, if it has seen no exhibit for ${PATIENCE} turns, walk toward where it last saw one.`,
          'Otherwise, wait in the corner for the darter to come back beside it.',
        ],
        weights: [['turns without an exhibit in view before it goes to look', PATIENCE]],
      },
      decide(obs) {
        const vm = obs.vm, mem = obs.memory, me = Obs.you(vm);
        if (mem.corner === undefined) mem.corner = corner(vm);
        const foes = remember(obs), read = readNew(obs, foes), s = strikable(obs);
        if (s.length) { const d = strike(s[0], at(me, mem.corner) ? ', its back to the corner' : ''); d.reason = read + d.reason; return d; }
        if (mem.corner && !at(me, mem.corner)) {
          const st = Obs.step(obs, mem.corner[0], mem.corner[1]);
          if (st) return { action: st, reason: `${read}steps ${Obs.DIRS[st.dir]} toward the corner at ${mem.corner[0]},${mem.corner[1]}, to put its back to the walls` };
        }
        const l = look(obs);
        if (l) { l.reason = read + l.reason; return l; }
        const where = at(me, mem.corner) ? 'with its back to the corner' : mem.corner ? 'where it is, with no way into the corner now' : 'where it is, with no corner in view';
        if (!foes.length) return { action: { a: 'wait' }, reason: `${read}holds still ${where}: no exhibit in view` };
        const f = foes[0];
        return { action: { a: 'wait' }, reason: `${read}holds still ${where} while ${f.uid} is ${Obs.dist(f, me.x, me.y)} tiles away, for it to come back beside it` };
      },
    },
  });
})();
