// ACCESSION — the plodder arena's policies (BUILD.md §10.3; test/arena/plodder.txt): three
// plodders in a room with a doorway one tile wide. Naive fights them in the open, where all
// three can reach it at once; the counterplay steps back into the doorway, where the walls on
// either side let only the plodder in front of it strike (a diagonal blow may not cross a
// corner, §8.1), and fights them there one at a time.
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

  // The doorway: a tile you can walk on with a wall on two opposite sides and open tiles on
  // the other two (a gap one tile wide in a wall), the nearest by the way a tap would walk
  // you there; null if none is in view or none can be walked to.
  function doorway(vm) {
    const m = Obs.board(vm).dept, me = Obs.you(vm), open = (x, y) => Grid.walkable(m, x, y);
    let best = null, bestLen = 0;
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      if (!open(x, y)) continue;
      const across = !open(x, y - 1) && !open(x, y + 1) && open(x - 1, y) && open(x + 1, y);
      const along = !open(x - 1, y) && !open(x + 1, y) && open(x, y - 1) && open(x, y + 1);
      if (!across && !along) continue;
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

  Policies.add('plodder', {
    naive: {
      card: {
        summary: 'Fights the plodders in the open: strikes one beside it, the weakest first, and otherwise walks toward the nearest.',
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
          if (st) return { action: st, reason: `steps ${Obs.DIRS[st.dir]} toward ${f.uid}, ${Obs.dist(f, me.x, me.y)} tiles away, to fight it where it is` };
        }
        const l = look(obs);
        if (l) return l;
        return { action: { a: 'wait' }, reason: foes.length ? 'waits: no way toward an exhibit in view' : 'waits: no exhibit in view' };
      },
    },
    counter: {
      card: {
        summary: 'Fights the plodders from the doorway: steps into the gap one tile wide in the wall, where only the plodder in front of it can strike, and fights them there one at a time.',
        rules: [
          'Find the doorway once, at its first decision: the nearest tile with a wall on two opposite sides and open tiles on the other two.',
          'Read the label of each exhibit the first time it is in view.',
          `If it is not standing in the doorway, and it has seen an exhibit in the last ${PATIENCE} turns, take the first step of the way a tap on the doorway would walk, whatever is beside it.`,
          'Otherwise, if an exhibit beside it can be struck, strike the one with the least health (then the nearest, then by uid).',
          `Otherwise, if it has seen no exhibit for ${PATIENCE} turns, walk toward where it last saw one, striking any it meets on the way.`,
          'Otherwise, wait in the doorway for them to come to it.',
        ],
        weights: [['turns without an exhibit in view before it goes to look', PATIENCE]],
      },
      decide(obs) {
        const vm = obs.vm, mem = obs.memory, me = Obs.you(vm);
        if (mem.door === undefined) mem.door = doorway(vm);
        const foes = remember(obs), read = readNew(obs, foes), s = strikable(obs);
        const lost = vm.turn - mem.since >= PATIENCE;
        if (mem.door && !at(me, mem.door) && !lost) {
          const st = Obs.step(obs, mem.door[0], mem.door[1]);
          if (st) return { action: st, reason: `${read}steps ${Obs.DIRS[st.dir]} toward the doorway at ${mem.door[0]},${mem.door[1]}, where only one exhibit at a time can reach it` };
        }
        if (s.length) { const d = strike(s[0], at(me, mem.door) ? ' in the doorway' : ''); d.reason = read + d.reason; return d; }
        const l = look(obs);
        if (l) { l.reason = read + l.reason; return l; }
        const where = at(me, mem.door) ? 'in the doorway' : mem.door ? 'where it is, with no way into the doorway now' : 'where it is, with no doorway in view';
        if (!foes.length) return { action: { a: 'wait' }, reason: `${read}waits ${where}: no exhibit in view` };
        return { action: { a: 'wait' }, reason: `${read}waits ${where} for ${foes.length === 1 ? 'the exhibit' : `the ${foes.length} exhibits`} in view to come to it` };
      },
    },
  });
})();
