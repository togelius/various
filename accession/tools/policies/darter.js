// ACCESSION — the darter arena's policies (BUILD.md §10.3; test/arena/darter.txt): a darter in
// an open room, and you with a Pin-Driver. A darter steps two tiles a turn and, beside you,
// strikes and at once steps back in the same action, to an empty tile beside it that is
// farther from you by walking distance; with no such tile it is cornered and stays (§8.1).
// Naive chases it, and never uses its Pin-Driver: each turn it walks up to the darter, which
// then strikes and steps away before naive's next turn, so naive strikes only when the
// darter happens to be cornered. The counterplay does both things the design names ("corner
// it against walls or glass; ranged", vocabulary.md §2.1): while the darter is out of reach
// of a blow it shoots it, as long as a charge is left; otherwise it corners it, its back to a
// wall: it comes at the darter from the side that leaves it the fewest tiles to step back
// to, so each step back takes it toward a wall, until it stands with its back to the wall
// and you square in front of it, where it has none; there it strikes and stays beside you,
// and is struck back.
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
  // The legal shot of your Pin-Driver at the exhibit f (a use of your instrument at its tile;
  // legal only with a charge left, within its reach and with a clear line, §8.5), or null.
  const shot = (obs, f) => Obs.legalOf(obs, 'use').find(l => l.x === f.x && l.y === f.y && l.on === undefined) || null;

  // The tiles a darter at d could step back to after its blow if you stood on (px, py): the
  // empty tiles beside it, not a closed door, that are farther from (px, py) than it
  // is by the exhibits' walking distance (§8.1, AI.field's rule), over the tiles the view
  // model shows. None when its back is to a wall and you stand square in front of it.
  function room(vm, d, px, py) {
    const m = Obs.board(vm).dept, far = Grid.distances(m, [[px, py]], m.w * m.h, null, 'exhibit'), here = far[d.y * m.w + d.x];
    if (here < 0) return 0;
    let n = 0;
    for (let k = 0; k < 8; k++) {
      const nx = d.x + Grid.DX[k], ny = d.y + Grid.DY[k];
      if (!Grid.canStep(m, d.x, d.y, k, 'exhibit') || Grid.closedDoor(m, nx, ny) || far[ny * m.w + nx] <= here) continue;
      if (vm.actors.some(a => a.uid !== 'you' && a.uid !== d.uid && Obs.dist(a, nx, ny) === 0)) continue;
      n++;
    }
    return n;
  }

  // The step toward the exhibit f (one that ends nearer it) after which it would have the
  // fewest tiles to step back to; ties go to the step that ends nearer it, then by direction.
  // {action, room, dist} or null.
  function corner(obs, f) {
    const vm = obs.vm, me = Obs.you(vm), now = Obs.dist(f, me.x, me.y);
    let best = null;
    for (const l of Obs.legalOf(obs, 'move')) {
      const x = me.x + Grid.DX[l.dir], y = me.y + Grid.DY[l.dir], dd = Obs.dist(f, x, y);
      if (dd >= now || vm.actors.some(a => a.uid !== 'you' && Obs.dist(a, x, y) === 0)) continue;
      const r = room(vm, f, x, y);
      if (best === null || r < best.room || (r === best.room && dd < best.dist)) best = { action: l, room: r, dist: dd };
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
        summary: 'Chases the darter: strikes it when it is beside it, and otherwise walks after it. It never uses the Pin-Driver it carries.',
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
        summary: 'Shoots the darter with its Pin-Driver while it is out of reach, and corners it, its back to a wall: comes at it from the side that leaves it the fewest tiles to step back to, until it has none, and strikes it whenever it is beside it.',
        rules: [
          'Read the label of each exhibit the first time it is in view (a darter steps back after its blow only if it has room).',
          'If an exhibit beside it can be struck, strike the one with the least health (then the nearest, then by uid).',
          'Otherwise, if its Pin-Driver can shoot the nearest exhibit in view (a charge left, within its reach, a clear line), shoot it.',
          'Otherwise, if an exhibit is in view, step toward the nearest by the step after which it would have the fewest tiles to step back to: the empty tiles beside it, not a closed door, that are farther from you by walking distance, none when its back is to a wall and you stand square in front of it. Ties go to the step that ends nearer it, then by direction.',
          `Otherwise, if it has seen no exhibit for ${PATIENCE} turns, walk toward where it last saw one.`,
          'Otherwise, wait.',
        ],
        weights: [['turns without an exhibit in view before it goes to look', PATIENCE]],
      },
      decide(obs) {
        const vm = obs.vm, me = Obs.you(vm), foes = remember(obs), read = readNew(obs, foes), s = strikable(obs);
        if (s.length) {
          const f = s[0], r = room(vm, f, me.x, me.y);
          return { action: { a: 'attack', uid: f.uid }, reason: `${read}attacks ${f.uid} beside it, ${f.hp} of ${f.maxHp} HP left, ` +
            (r ? `with ${r === 1 ? '1 tile' : `${r} tiles`} it could step back to` : 'its back to a wall: it has no tile to step back to') };
        }
        if (foes.length) {
          const f = foes[0], b = shot(obs, f);
          if (b) return { action: b, reason: `${read}shoots ${f.uid} with its Pin-Driver, ${Obs.dist(f, me.x, me.y)} tiles away and out of reach of a blow, ${f.hp} of ${f.maxHp} HP left` };
          const c = corner(obs, f);
          if (c) {
            const where = c.dist === 1 ? `beside ${f.uid}` : `toward ${f.uid}, ${c.dist} tiles from it`;
            return { action: c.action, reason: `${read}steps ${Obs.DIRS[c.action.dir]} ${where}, where it would have ` +
              (c.room ? `${c.room === 1 ? '1 tile' : `${c.room} tiles`} to step back to, the fewest of its steps` : 'no tile to step back to, its back to a wall') };
          }
        }
        const l = look(obs);
        if (l) { l.reason = read + l.reason; return l; }
        return { action: { a: 'wait' }, reason: `${read}waits: ${foes.length ? 'no step brings it nearer the exhibit in view' : 'no exhibit in view'}` };
      },
    },
  });
})();
