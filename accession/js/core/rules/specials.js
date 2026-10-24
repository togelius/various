// ACCESSION — specials and their telegraphs (BUILD.md §8.1). W0d built the core: which special
// an exhibit has, the tiles it marks, marking, resolving and cancelling, and the marks the
// view model draws. W1-COMBAT owns the file after, and adds the readout (the label's line for
// a special) and the threat (the mark an action of yours would leave you standing on).
//
// The rules (§8.1):
//   - One action marks the tiles; the exhibit's next action resolves the special, with no
//     roll; the resolve costs an attack plus SPECIAL_RECOVERY, so its next action comes
//     after that gap (mark at 400, resolve at 500, next action at 700).
//   - No unseen special: after a mark, the exhibit's next action comes no earlier than your
//     next decision (notBefore), and ties go to you, so you always see a mark before it resolves.
//   - No overlaps: no two pending damage marks share a tile. A call mark never blocks one
//     and is never blocked.
//   - Each actor standing on a marked tile is hit once, with its own Padding. Only a beam
//     passes glass: a ring never marks the tile of an intact case, nor strikes into one.
//   - A special that hits several actors applies every hit, with its wakes, before any
//     noise, the noise of an exhibit it destroys included (Noise.hold; §8.2).
//   - A pending mark is cancelled when its owner is fixed (at once, Status.apply), leaves
//     hunting, goes dormant or is destroyed. Only a hunting exhibit marks.
'use strict';
const Specials = (() => {
  const SHAPES = ['ring', 'call', 'line'];

  // What a special does at this depth: {id, shape, effect, gross, every, range}, from its
  // registry entry; gross is its role curve at the department's depth (0 for a call, which
  // deals no damage), every and range its §8.10 rows (null where it has none).
  function info(state, id) {
    const S = Registry.SPECIALS[id];
    if (!S) throw new Error('Specials: no special ' + id);
    const num = key => { if (!(key in N)) throw new Error(`Specials: ${id} names no number ${key}`); return N[key]; };
    return { id, shape: S.shape, effect: S.effect, gross: S.curve ? Roles.at(num(S.curve), state.dept.depth || 1) : 0,
      every: S.every ? num(S.every) : null, range: S.range ? num(S.range) : null };
  }
  // Specials.of(state, a) → null | {id, shape, effect, gross, every, range}: a's archetype's special.
  function of(state, a) {
    const A = a.arch ? Registry.ARCHETYPES[a.arch] : null;
    return A && A.special ? info(state, A.special) : null;
  }

  const rowMajor = (p, q) => p[1] - q[1] || p[0] - q[0];
  function unique(tiles) {
    const out = [];
    for (const t of tiles.slice().sort(rowMajor)) if (!out.length || rowMajor(out[out.length - 1], t) !== 0) out.push([t[0], t[1]]);
    return out;
  }
  // The direction from a along the row or column it shares with you (N, E, S or W), or -1.
  function axisTo(a, you) {
    if (a.x === you.x && a.y !== you.y) return you.y < a.y ? 0 : 4;
    if (a.y === you.y && a.x !== you.x) return you.x > a.x ? 2 : 6;
    return -1;
  }

  // Specials.tiles(state, a, shape) → [[x, y]…], in row-major order, each tile once:
  //   'ring': the tiles round a's footprint an exhibit could stand on (Grid.hold), except an
  //           intact case's (a vitrine, a mimic's disguise included): a ring is blows, and
  //           nothing strikes into a case (§8.3);
  //   'call': the tiles an exhibit could stand on within HERALD_RANGE of a (Grid.disc);
  //   'line': the tiles of a beam of AXIS_BEAM_RANGE along the row or column a shares with
  //           you (Ranged.beam: through glass, and back along its line from a reflector);
  //           none if it shares neither.
  function tiles(state, a, shape) {
    const m = state.dept, out = [];
    if (shape === 'ring') {
      const s = a.size || 1;
      for (let y = a.y - 1; y <= a.y + s; y++) for (let x = a.x - 1; x <= a.x + s; x++)
        if (Actors.dist(a, x, y) === 1 && Grid.inside(m, x, y) && Grid.hold(m, x, y) && Grid.ch(m, x, y) !== 'v') out.push([x, y]);
    } else if (shape === 'call') {
      const r = N.HERALD_RANGE, foot = Actors.footprint(a), s = a.size || 1;
      for (let y = a.y - r; y < a.y + s + r; y++) for (let x = a.x - r; x < a.x + s + r; x++)
        if (Grid.inside(m, x, y) && Grid.hold(m, x, y) && foot.some(([fx, fy]) => Grid.disc(x - fx, y - fy, r))) out.push([x, y]);
    } else if (shape === 'line') {
      const d = axisTo(a, state.actors[0]);
      if (d >= 0) return unique(Ranged.beam(state, a, d, N.AXIS_BEAM_RANGE));
    } else throw new Error('Specials.tiles: no shape ' + shape);
    return unique(out);
  }

  // For each tile, the tile its damage comes from (cause.from, §8.1): for a line, the tile the
  // beam entered it from; otherwise the tile of a's footprint nearest it (ties in row-major order).
  function fromFor(state, a, shape, list) {
    const near = ([x, y]) => {
      let best = null, bd = -1;
      for (const t of Actors.footprint(a)) { const d = Math.max(Math.abs(t[0] - x), Math.abs(t[1] - y)); if (bd < 0 || d < bd) { best = t; bd = d; } }
      return best;
    };
    let beam = null, came = null;
    if (shape === 'line') { const d = axisTo(a, state.actors[0]); if (d >= 0) { beam = Ranged.beam(state, a, d, N.AXIS_BEAM_RANGE); came = Ranged.beamFrom(state, a, d, N.AXIS_BEAM_RANGE); } }
    return list.map(t => {
      if (beam) for (let i = 0; i < beam.length; i++) if (beam[i][0] === t[0] && beam[i][1] === t[1]) return came[i].slice();
      return near(t);
    });
  }

  const hasTile = (list, x, y) => list.some(t => t[0] === x && t[1] === y);

  // Specials.canMark(state, a, id, tiles) → bool: may a mark special id on these tiles now?
  // Only a hunting exhibit that is not gone and has no mark pending, on at least one tile.
  // An encased exhibit (in an intact case) may mark only a line, which passes glass, or a
  // call. A damage special may not mark a tile another pending damage mark holds.
  function canMark(state, a, id, list) {
    const S = Registry.SPECIALS[id];
    if (!S || a.gone || a.mode !== 'hunting' || a.telegraph || !list || !list.length) return false;
    if (Cases.encased(state, a) && S.shape !== 'line' && S.shape !== 'call') return false;
    if (S.effect === 'damage') for (const b of state.actors) {
      if (b === a || b.gone || !b.telegraph || b.telegraph.effect !== 'damage') continue;
      if (list.some(([x, y]) => hasTile(b.telegraph.tiles, x, y))) return false;
    }
    return true;
  }

  // Specials.mark(state, a, id, tiles, ev) → ticks: a marks special id on the tiles, which
  // canMark must allow. a.telegraph becomes {sp, tiles (row-major, each once, fixed now),
  // from (for each tile, where its damage comes from), gross, effect, turn, tick}; it emits
  // telegraphed {who, sp, tiles}; and a's next action may come no earlier than your next
  // decision (a.notBefore). Marking costs an action (COST_ATTACK).
  function mark(state, a, id, list, ev) {
    if (!canMark(state, a, id, list)) throw new Error(`Specials.mark: ${a.uid} may not mark ${id} here`);
    const sp = info(state, id), t = unique(list);
    a.telegraph = { sp: id, tiles: t, from: fromFor(state, a, sp.shape, t), gross: sp.gross, effect: sp.effect, turn: state.turn, tick: state.tick };
    const yours = state.actors[0].next;
    a.notBefore = a.notBefore === null || a.notBefore < yours ? yours : a.notBefore;
    const cause = { k: 'special', by: a.uid, sp: id, gross: sp.gross };
    if (sp.every !== null) cause.every = sp.every;
    Causes.emit(state, ev, 'telegraphed', { who: a.uid, sp: id, tiles: t }, cause);
    return Actors.cost(state, a, N.COST_ATTACK, 'act');
  }

  // Specials.net(gross, pad): what a special deals through Padding, at least DMG_MIN_ON_HIT.
  const net = (gross, pad) => Math.max(N.DMG_MIN_ON_HIT, gross - pad);

  // Specials.resolve(state, a, ev) → ticks: a's pending special goes off. A damage special
  // hurts each actor standing on a marked tile, once (its first marked tile in row-major
  // order), in spawn order, each through its own Padding, with cause special {by, sp, gross,
  // pad, net, x, y, from}; an actor in an intact case is struck only by a shape that passes
  // glass (a line). Every hit, and the wakes it causes, comes before any noise: the noise of
  // an exhibit destroyed is held until the last hit (Noise.hold), then comes the soft noise
  // at a's tile that any attack makes. A call (a hook) goes to its archetype's onResolve.
  // Then special {who, sp, hits}. The mark is no longer pending once it resolves. Costs an
  // attack plus SPECIAL_RECOVERY.
  const PASSES_GLASS = ['line'];
  function resolve(state, a, ev) {
    const tel = a.telegraph;
    if (!tel) throw new Error(`Specials.resolve: ${a.uid} has no mark pending`);
    a.telegraph = null;
    const fields = { who: a.uid, sp: tel.sp };
    if (tel.effect === 'damage') {
      const hits = [], S = Registry.SPECIALS[tel.sp], glass = !!S && PASSES_GLASS.includes(S.shape);
      Noise.hold(() => {
        for (const b of state.actors.slice()) {
          if (b.gone || (!glass && Cases.encased(state, b))) continue;
          let k = -1;
          for (const [x, y] of Actors.footprint(b)) for (let i = 0; i < tel.tiles.length; i++) if (tel.tiles[i][0] === x && tel.tiles[i][1] === y && (k < 0 || i < k)) k = i;
          if (k < 0) continue;
          const d = net(tel.gross, b.pad);
          Combat.hurt(state, b, d, { k: 'special', by: a.uid, sp: tel.sp, gross: tel.gross, pad: b.pad, net: d, x: tel.tiles[k][0], y: tel.tiles[k][1], from: tel.from[k].slice() }, ev);
          hits.push(b.uid);
        }
      });
      Noise.emit(state, a.x, a.y, 'soft', { k: 'special', by: a.uid }, ev);
      fields.hits = hits;
    } else Archetypes.onResolve(state, a, tel, ev);
    Causes.emit(state, ev, 'special', fields, { k: 'special', by: a.uid, sp: tel.sp });
    return Actors.cost(state, a, N.COST_ATTACK, 'act') + N.SPECIAL_RECOVERY;
  }

  // Specials.cancel(state, a, why, ev) → bool: a's pending mark is withdrawn (why: 'fixed',
  // 'died', or the cause of the change of mode), with special {who, sp, cancelled: true}.
  function cancel(state, a, why, ev) {
    if (!a.telegraph) return false;
    const sp = a.telegraph.sp;
    a.telegraph = null;
    Causes.emit(state, ev, 'special', { who: a.uid, sp, cancelled: true }, { k: 'cancel', by: a.uid, why: String(why) });
    return true;
  }

  // Specials.marks(state) → [{x, y, dmg, by, kind}]: every pending mark's tiles, in spawn
  // order: kind 'telegraph' with dmg what you would take there (net of your Padding now),
  // or kind 'call' (dmg null). The view model keeps those on visible tiles.
  function marks(state) {
    const you = state.actors[0], out = [];
    for (const a of state.actors) {
      if (a.gone || !a.telegraph) continue;
      const t = a.telegraph, dmg = t.effect === 'damage' ? net(t.gross, you.pad) : null;
      for (const [x, y] of t.tiles) out.push({ x, y, dmg, by: a.uid, kind: t.effect === 'damage' ? 'telegraph' : 'call' });
    }
    return out;
  }

  // Specials.readout(state, a, you) → [{sp, net, gross, effect, every, shape, range}]: the odds
  // readout's line for a's special (§8.1: "one line per special, with its exact net damage and
  // cadence"), none if it has none. net is what it would deal you now through your Padding
  // (Specials.net, as its marks show), or null for a special that deals no damage (a call);
  // every its cadence in actions and range its reach in tiles (null where it has none).
  function readout(state, a, you) {
    const sp = of(state, a);
    if (!sp) return [];
    return [{ sp: sp.id, net: sp.effect === 'damage' ? net(sp.gross, you.pad) : null, gross: sp.gross, effect: sp.effect,
      every: sp.every, shape: sp.shape, range: sp.range }];
  }

  // Specials.threat(state, action) → null | {x, y, dmg, by}: does your action leave you on a
  // tile marked for damage by a special that will resolve before your next decision? The
  // interface asks before such an action ("Stay in the beam: 9 damage?", §7.1). The tile is
  // where the action leaves you, and your next decision comes when its ticks are done; a
  // pending damage mark on that tile resolves first if its owner's next action comes earlier
  // (ties go to you, §8.1). dmg is what the mark shows: its gross through your Padding now,
  // which is what resolves, since your stats change only when your action is done.
  // The action is applied to a copy of the state, which is then thrown away, and the marks
  // are read from the copy: so the tile and the cost are the action's own, and a mark the
  // action calls off (its owner fixed, quieted, or losing you to the Ticket) is no threat,
  // nor is any mark once the action ends the visit (leaving). Nothing you could not know
  // before the action is looked at, so the answer gives nothing away:
  //   - a mark whose owner the action destroys still counts, because whether a blow
  //     destroys is not known before it is made, so a destroying blow and a miss give the
  //     same answer;
  //   - an action with a consumable whose kind you have not identified (Consumables.known)
  //     is judged as if it left you where you are and called nothing off, so the answer
  //     does not tell you what the consumable is. Only its cost is the action's own.
  // A refused action, or one that takes no time, has no threat.
  function unforeseen(state, action) {
    if (typeof action.uid !== 'string' || !Array.isArray(state.items)) return false;
    const it = state.items.find(i => i.uid === action.uid);
    return !!it && it.kind === 'consumable' && !Consumables.known(state, it.ck);
  }
  function threat(state, action) {
    if (state.over || !action || typeof action.a !== 'string') return null;
    if (state.ui && state.ui.pendingChoice && action.a !== 'choose') return null;
    const h = Actions.get(action.a), you = state.actors[0];
    if (!h || Status.blocks(state, you, action)) return null;
    const copy = State.clone(state), r = h.apply(copy, action, []);
    if (typeof r === 'string' || !Number.isInteger(r) || r <= 0) return null;
    const seen = unforeseen(state, action) ? state : copy;
    if (seen.over && seen.over.k === 'left') return null;
    const after = seen.actors[0], x = after.x, y = after.y, decision = you.next + r;
    // Actors are never removed during a visit, so the copy's actor i is the state's actor i;
    // any the action created come after them, and have no mark.
    for (let i = 1; i < seen.actors.length; i++) {
      const b = seen.actors[i], was = i < state.actors.length ? state.actors[i] : null;
      const a = was && !was.gone && b.gone ? was : b;
      const t = a.telegraph;
      if (a.gone || !t || t.effect !== 'damage' || !Actors.scheduled(a) || a.next >= decision) continue;
      if (hasTile(t.tiles, x, y)) return { x, y, dmg: net(t.gross, you.pad), by: a.uid };
    }
    return null;
  }

  return { SHAPES: SHAPES.slice(), info, of, tiles, canMark, mark, net, resolve, cancel, marks, readout, threat };
})();
