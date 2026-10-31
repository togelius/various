// ACCESSION — specials and their telegraphs (BUILD.md §8.1). W0d built the core: which special
// an exhibit has, the tiles it marks, marking, resolving and cancelling, and the marks the
// view model draws. W1-COMBAT added the readout (the label's line for a special) and the
// threat (the mark an action of yours would leave you standing on). M4's W0d2 owns the file
// now, frozen after M4's Wave 0, and adds: several specials an exhibit, taking turns
// (ax.specials); shapes registered by the rules that use them (Specials.addShape), the
// burst among them; a Centrepiece's gross (a `cp:` curve); a mark while awake (marksAwake);
// lines that fall due at a turn boundary (telegraph.due); whether a mark covered you when it
// was made (atYou); and a threat that counts due lines, module marks not yet made
// (Modules.threat) and the perks' change to your action's cost (Perks.adjust).
//
// The rules (§8.1):
//   - One action marks the tiles; the exhibit's next action resolves the special, with no
//     roll; the resolve costs an attack plus SPECIAL_RECOVERY, so its next action comes
//     after that gap (mark at 400, resolve at 500, next action at 700).
//   - No unseen special: after a mark, the exhibit's next action comes no earlier than your
//     next decision (notBefore), and ties go to you, so you always see a mark before it resolves.
//   - A due line (a mark made with a due tick, a turn boundary) goes off at that boundary
//     (Specials.resolveDue, boundary step 8), not at its owner's action; its owner only
//     waits until then. It may go off before your next decision, so the threat warns of it
//     before any action that lets it, and of a line a module will mark and make due before
//     then (the chime's, before the chime sounds: Modules.threat).
//   - No overlaps: no two pending damage marks share a tile. A call mark never blocks one
//     and is never blocked.
//   - Each actor standing on a marked tile is hit once, with its own Padding. Only a beam
//     passes glass: a ring never marks the tile of an intact case, nor strikes into one. On a
//     tile a beam reaches only after a reflector sent it back, the damage is the reflector's
//     (cause reflected, naming the beam's owner as its shooter), as a bolt sent back is.
//   - A special that hits several actors applies every hit, with its wakes, before any
//     noise, the noise of an exhibit it destroys included (Noise.hold; §8.2).
//   - A pending mark is cancelled when its owner is fixed (at once, Status.apply), leaves
//     hunting, goes dormant or is destroyed. Only a hunting exhibit marks, or an awake one
//     whose archetype marks while awake (Archetypes.marksAwake: a station).
'use strict';
const Specials = (() => {
  // The shapes written here; others are added by the rules that use them (addShape).
  const SHAPES = ['ring', 'call', 'line'];
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  // Specials.cpGross(key, depth) → int: a Centrepiece special's gross at a depth (a registry
  // curve written `cp:KEY`): KEY's role curve, as a percentage of the median visitor's
  // maximum health there (MEDIAN_MAX_HP, by depth 1–7), plus the median visitor's Padding
  // there (MEDIAN_PADDING's curve), so it takes the same share of that visitor's health
  // through their Padding at every depth. With ROLE_CENTREPIECE_SPECIAL_PCT: 6, 12 and 18
  // at depths 1, 4 and 7.
  function cpGross(key, depth) {
    if (!own(N, key)) throw new Error(`Specials: cp:${key} names no number of record`);
    const d = Math.max(1, depth || 1), hp = N.MEDIAN_MAX_HP[Math.min(d, N.MEDIAN_MAX_HP.length) - 1];
    return Int.pct(hp, Roles.at(N[key], d)) + Roles.at(N.MEDIAN_PADDING, d);
  }

  // What a special does at this depth: {id, shape, effect, gross, every, range}, from its
  // registry entry; gross is its curve at the department's depth (a role curve, or `cp:KEY`
  // for a Centrepiece's, cpGross; 0 for a special with none, such as a call, which deals no
  // damage), every and range its §8.10 rows (null where it has none).
  function info(state, id) {
    const S = Registry.SPECIALS[id];
    if (!S) throw new Error('Specials: no special ' + id);
    const num = key => { if (!(key in N)) throw new Error(`Specials: ${id} names no number ${key}`); return N[key]; };
    const depth = state.dept.depth || 1;
    const gross = !S.curve ? 0 : String(S.curve).startsWith('cp:') ? cpGross(S.curve.slice(3), depth) : Roles.at(num(S.curve), depth);
    return { id, shape: S.shape, effect: S.effect, gross, every: S.every ? num(S.every) : null, range: S.range ? num(S.range) : null };
  }
  // Specials.of(state, a) → null | {id, shape, effect, gross, every, range}: a's archetype's special.
  function of(state, a) {
    const A = a.arch ? Registry.ARCHETYPES[a.arch] : null;
    return A && A.special ? info(state, A.special) : null;
  }

  // ---- Several specials an exhibit, taking turns ----
  // An exhibit with a list of specials (a.ax.specials, ids in the order it gained them; a
  // Centrepiece, or one of its pieces) marks them in turn, one every `cadence` of its
  // actions: its first at its cadence-th action since it woke, then each no sooner than
  // cadence actions after the last was marked (counted in acts, its actions since it last
  // woke). The one due is the one after the one it marked last, in its list, back to the
  // first after the last, and the first if it no longer has the one it marked last. One
  // that cannot be marked when it is due (no tiles, or the overlap rule) is tried again at
  // its next action, which it otherwise spends as it would. What it last marked is kept in
  // a.ax.rot: {last (the id), at (its acts then), woke (the turn of the waking it was in)}.
  const rotates = a => !!(a.ax && Array.isArray(a.ax.specials));
  // Specials.list(state, a) → [id…]: a's specials, its list if it has one, else its archetype's.
  function list(state, a) {
    if (rotates(a)) return a.ax.specials.slice();
    const A = a.arch ? Registry.ARCHETYPES[a.arch] : null;
    return A && A.special ? [A.special] : [];
  }
  // Specials.cadence(state, a) → int: one special every this many actions: CP_SPECIAL_EVERY,
  // its first value in phases 1 and 2 (a.ax.phase, 1 if it has none), its second from phase 3.
  function cadence(state, a) {
    const phase = a.ax && Number.isInteger(a.ax.phase) ? a.ax.phase : 1;
    return N.CP_SPECIAL_EVERY[phase >= 3 ? 1 : 0];
  }
  const wokeTurn = a => a.woke && Number.isInteger(a.woke.turn) ? a.woke.turn : null;
  // Specials.nextUp(state, a) → null | id: the special a's turns give it at this action, or
  // null (none due, or a has no list).
  function nextUp(state, a) {
    if (!rotates(a) || !a.ax.specials.length) return null;
    const rot = a.ax.rot || null, since = rot && rot.woke === wokeTurn(a) ? rot.at : 0;
    if (a.acts < since + cadence(state, a)) return null;
    const L = a.ax.specials, i = rot ? L.indexOf(rot.last) : -1;
    return L[(i + 1) % L.length];
  }
  // Specials.markNext(state, a, ev) → ticks | null: a marks the special nextUp gives, on the
  // tiles its shape gives now, if canMark allows (Specials.mark's ticks); otherwise null, and
  // a acts as it otherwise would.
  function markNext(state, a, ev) {
    const id = nextUp(state, a);
    if (id === null) return null;
    const S = Registry.SPECIALS[id];
    if (!S) throw new Error(`Specials.markNext: ${a.uid} has no special ${id}`);
    const t = tiles(state, a, S.shape);
    if (!canMark(state, a, id, t)) return null;
    a.ax.rot = { last: id, at: a.acts, woke: wokeTurn(a) };
    return mark(state, a, id, t, ev);
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

  // ---- Shapes added by the rules that use them ----
  // Specials.addShape(id, {tiles, from?, via?, glass?}): a shape a registry special may name.
  //   tiles(state, a) → [[x, y]…]   the tiles a would mark now, inside the map (any order;
  //                                 made row-major, each once); [] when it has none to mark;
  //   from(state, a, tiles) → [[x, y]…]   for each tile, the tile its damage comes from
  //                                 (cause.from); else the tile of a's footprint nearest it;
  //   via(state, a, tiles) → [uid | null…]   for each tile, the reflector that sent it back
  //                                 before it reached that tile; else none;
  //   glass: true if it passes glass, as only a beam does: it may then be marked by an
  //          exhibit in an intact case, and strikes one in a case.
  // Once each, never one of the shapes written here, and every key one of these.
  const ADDED = {}, ADDED_ORDER = [];
  const SHAPE_KEYS = ['tiles', 'from', 'via', 'glass'];
  function addShape(id, def) {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) throw new Error(`Specials.addShape: ${JSON.stringify(id)} is not a shape's name`);
    if (SHAPES.includes(id) || own(ADDED, id)) throw new Error(`Specials.addShape: the shape ${id} is added twice`);
    if (!def || typeof def.tiles !== 'function') throw new Error(`Specials.addShape: ${id} needs tiles(state, a)`);
    for (const k of Object.keys(def)) if (!SHAPE_KEYS.includes(k)) throw new Error(`Specials.addShape: ${id} has no part called ${k}`);
    for (const k of ['from', 'via']) if (def[k] !== undefined && typeof def[k] !== 'function') throw new Error(`Specials.addShape: ${id}.${k} is not a function`);
    if (def.glass !== undefined && typeof def.glass !== 'boolean') throw new Error(`Specials.addShape: ${id}.glass is not true or false`);
    ADDED[id] = { tiles: def.tiles, from: def.from || null, via: def.via || null, glass: def.glass === true };
    ADDED_ORDER.push(id);
  }
  // Specials.shapes() → [id…]: every shape, those written here first, then those added in order.
  const shapes = () => SHAPES.concat(ADDED_ORDER);
  // Specials.passesGlass(shape) → bool: does a special of this shape pass glass? Only a beam:
  // the line, or an added shape that says so (glass).
  const passesGlass = shape => shape === 'line' || (own(ADDED, shape) && ADDED[shape].glass);
  // A list of tiles an added shape gave, checked: each [x, y] of integers inside the map.
  function checked(state, id, got, what) {
    if (!Array.isArray(got)) throw new Error(`Specials: the shape ${id}'s ${what} gave ${JSON.stringify(got)}, not a list`);
    for (const t of got) if (!Array.isArray(t) || t.length !== 2 || !Number.isInteger(t[0]) || !Number.isInteger(t[1]) || !Grid.inside(state.dept, t[0], t[1]))
      throw new Error(`Specials: the shape ${id}'s ${what} gave ${JSON.stringify(t)}, not a tile in the map`);
    return got;
  }

  // Specials.tiles(state, a, shape) → [[x, y]…], in row-major order, each tile once:
  //   'ring': the tiles round a's footprint an exhibit could stand on (Grid.hold), except an
  //           intact case's (a vitrine, a mimic's disguise included): a ring is blows, and
  //           nothing strikes into a case (§8.3);
  //   'call': the tiles an exhibit could stand on within HERALD_RANGE of a (Grid.disc);
  //   'line': the tiles of a beam of AXIS_BEAM_RANGE along the row or column a shares with
  //           you (Ranged.beam: through glass, and back along its line from a reflector);
  //           none if it shares neither;
  //   an added shape: its tiles (addShape), the burst's among them (below).
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
    } else if (own(ADDED, shape)) return unique(checked(state, shape, ADDED[shape].tiles(state, a), 'tiles'));
    else throw new Error('Specials.tiles: no shape ' + shape);
    return unique(out);
  }

  // The tile of a's footprint nearest (x, y) (ties in row-major order).
  function near(a, x, y) {
    let best = null, bd = -1;
    for (const t of Actors.footprint(a)) { const d = Math.max(Math.abs(t[0] - x), Math.abs(t[1] - y)); if (bd < 0 || d < bd) { best = t; bd = d; } }
    return best;
  }
  // For each tile, the tile its damage comes from (cause.from, §8.1): for a line, the tile the
  // beam entered it from; for an added shape with a `from`, what it says; otherwise the tile
  // of a's footprint nearest it (ties in row-major order).
  function fromFor(state, a, shape, list) {
    if (own(ADDED, shape) && ADDED[shape].from) {
      const got = checked(state, shape, ADDED[shape].from(state, a, list.map(t => t.slice())), 'from');
      if (got.length !== list.length) throw new Error(`Specials: the shape ${shape}'s from gave ${got.length} tiles for ${list.length}`);
      return got.map(t => [t[0], t[1]]);
    }
    let beam = null, came = null;
    if (shape === 'line') { const d = axisTo(a, state.actors[0]); if (d >= 0) { beam = Ranged.beam(state, a, d, N.AXIS_BEAM_RANGE); came = Ranged.beamFrom(state, a, d, N.AXIS_BEAM_RANGE); } }
    return list.map(t => {
      if (beam) for (let i = 0; i < beam.length; i++) if (beam[i][0] === t[0] && beam[i][1] === t[1]) return came[i].slice();
      return near(a, t[0], t[1]);
    });
  }

  // For each tile, the reflector that sent a's beam back before it reached that tile (a tile
  // a line reaches only on its way back: its owner's own tile, and those behind it), or null
  // (every tile of a ring or a call, and a line's way out). Ranged.beamVia, §8.1. An added
  // shape says its own (via), or has none.
  function viaFor(state, a, shape, list) {
    if (own(ADDED, shape)) {
      if (!ADDED[shape].via) return list.map(() => null);
      const got = ADDED[shape].via(state, a, list.map(t => t.slice()));
      if (!Array.isArray(got) || got.length !== list.length || !got.every(v => v === null || (typeof v === 'string' && v.length > 0)))
        throw new Error(`Specials: the shape ${shape}'s via gave ${JSON.stringify(got)}, not a uid or null for each of ${list.length} tiles`);
      return got.slice();
    }
    const d = shape === 'line' ? axisTo(a, state.actors[0]) : -1;
    if (d < 0) return list.map(() => null);
    const beam = Ranged.beam(state, a, d, N.AXIS_BEAM_RANGE), via = Ranged.beamVia(state, a, d, N.AXIS_BEAM_RANGE);
    return list.map(t => { for (let i = 0; i < beam.length; i++) if (beam[i][0] === t[0] && beam[i][1] === t[1]) return via[i]; return null; });
  }

  const hasTile = (list, x, y) => list.some(t => t[0] === x && t[1] === y);

  // The burst (cp_burst's shape): the 3×3 square on your tile, which its owner aims at you,
  // so only while it sees you (AI.sees). Its tiles are yours and those round it that an
  // exhibit could stand on (Grid.hold), except an intact case's (it is blows, and nothing
  // strikes into a case, §8.3) and its owner's own.
  addShape('burst', {
    tiles(state, a) {
      const m = state.dept, you = state.actors[0], out = [];
      if (!AI.sees(state, a)) return out;
      for (let y = you.y - 1; y <= you.y + 1; y++) for (let x = you.x - 1; x <= you.x + 1; x++)
        if (Grid.inside(m, x, y) && Grid.hold(m, x, y) && Grid.ch(m, x, y) !== 'v' && !Actors.covers(a, x, y)) out.push([x, y]);
      return out;
    },
  });

  // Specials.marking(state, a) → bool: is a in a mode to mark: hunting, or awake with an
  // archetype that marks while awake (Archetypes.marksAwake: a station).
  const marking = (state, a) => a.mode === 'hunting' || (a.mode === 'awake' && Archetypes.marksAwake(state, a));

  // Specials.canMark(state, a, id, tiles) → bool: may a mark special id on these tiles now?
  // Only an exhibit that is not gone, is in a mode to mark (marking) and has no mark pending,
  // on at least one tile. An encased exhibit (in an intact case) may mark only a shape that
  // passes glass (a line), or a call. A damage special may not mark a tile another pending
  // damage mark holds.
  function canMark(state, a, id, list) {
    const S = Registry.SPECIALS[id];
    if (!S || a.gone || !marking(state, a) || a.telegraph || !list || !list.length) return false;
    if (Cases.encased(state, a) && !passesGlass(S.shape) && S.shape !== 'call') return false;
    if (S.effect === 'damage') for (const b of state.actors) {
      if (b === a || b.gone || !b.telegraph || b.telegraph.effect !== 'damage') continue;
      if (list.some(([x, y]) => hasTile(b.telegraph.tiles, x, y))) return false;
    }
    return true;
  }

  const isDue = t => !!t && Number.isInteger(t.due);
  // Specials.atYou(tel) → bool: was your tile among a damage mark's tiles when it was made? A
  // mark keeps offYou: true when it was not (so a part absent reads as its default, §4.1),
  // and a call is never at you.
  const atYou = tel => !!tel && tel.effect === 'damage' && !tel.offYou;

  // Specials.mark(state, a, id, tiles, ev, opts?) → ticks: a marks special id on the tiles,
  // which canMark must allow. a.telegraph becomes {sp, tiles (row-major, each once, fixed now),
  // from (for each tile, where its damage comes from), via (for each tile, the reflector
  // that sent a beam back before it reached it, or null), gross, effect, turn, tick}, with
  // offYou: true for a damage mark not on your tile (atYou), and due when opts.due is given;
  // it emits telegraphed {who, sp, tiles}, its cause special {by, sp, gross, every?, due?}.
  // Marking costs an action (COST_ATTACK); a module that marks at a boundary spends nothing.
  //   - Without opts.due, a's next action resolves it, and comes no earlier than your next
  //     decision (a.notBefore).
  //   - With opts.due, a turn boundary's tick after now, it is a due line: it goes off at that
  //     boundary (resolveDue), and a waits until then (resolve).
  function mark(state, a, id, list, ev, opts) {
    if (!canMark(state, a, id, list)) throw new Error(`Specials.mark: ${a.uid} may not mark ${id} here`);
    const due = opts && opts.due !== undefined && opts.due !== null ? opts.due : null;
    if (due !== null && !(Number.isInteger(due) && due > state.tick && due % N.TICKS_PER_TURN === 0))
      throw new Error(`Specials.mark: ${a.uid}'s ${id} is due at ${due}, which is not a turn boundary after ${state.tick}`);
    const sp = info(state, id), t = unique(list), you = state.actors[0];
    a.telegraph = { sp: id, tiles: t, from: fromFor(state, a, sp.shape, t), via: viaFor(state, a, sp.shape, t), gross: sp.gross, effect: sp.effect, turn: state.turn, tick: state.tick };
    if (sp.effect === 'damage' && !hasTile(t, you.x, you.y)) a.telegraph.offYou = true;
    if (due !== null) a.telegraph.due = due;
    else {
      const yours = you.next;
      a.notBefore = a.notBefore === null || a.notBefore < yours ? yours : a.notBefore;
    }
    const cause = { k: 'special', by: a.uid, sp: id, gross: sp.gross };
    if (sp.every !== null) cause.every = sp.every;
    if (due !== null) cause.due = due;
    Causes.emit(state, ev, 'telegraphed', { who: a.uid, sp: id, tiles: t }, cause);
    return Actors.cost(state, a, N.COST_ATTACK, 'act');
  }

  // Specials.net(gross, pad): what a special deals through Padding, at least DMG_MIN_ON_HIT.
  const net = (gross, pad) => Math.max(N.DMG_MIN_ON_HIT, gross - pad);

  // A pending special goes off (resolve at its owner's action, resolveDue at its boundary).
  // A damage special hurts each actor standing on a marked tile, once (its first marked tile
  // in row-major order), in spawn order, each through its own Padding, with cause special
  // {by, sp, gross, pad, net, x, y, from}, or, on a tile a beam reaches only after a
  // reflector sent it back (telegraph.via), the reflector's: reflected {by: the reflector,
  // shooter: a, sp, gross, pad, net, x, y, from} (§8.1); an actor in an intact case is struck
  // only by a shape that passes glass (a line). Every hit, and the wakes it causes, comes
  // before any noise: the noise of an exhibit destroyed is held until the last hit
  // (Noise.hold), then comes the soft noise at a's tile that any attack makes. A call (a
  // hook) goes to its archetype's onResolve. Then special {who, sp, hits}; then the perks
  // you hold hear of it (Perks.onResolve, with the mark and atYou, and whether it struck you).
  // The mark is no longer pending once it goes off.
  function fire(state, a, ev) {
    const tel = a.telegraph;
    a.telegraph = null;
    const fields = { who: a.uid, sp: tel.sp };
    let struckYou = false;
    if (tel.effect === 'damage') {
      const hits = [], S = Registry.SPECIALS[tel.sp], glass = !!S && passesGlass(S.shape);
      Noise.hold(() => {
        for (const b of state.actors.slice()) {
          if (b.gone || (!glass && Cases.encased(state, b))) continue;
          let k = -1;
          for (const [x, y] of Actors.footprint(b)) for (let i = 0; i < tel.tiles.length; i++) if (tel.tiles[i][0] === x && tel.tiles[i][1] === y && (k < 0 || i < k)) k = i;
          if (k < 0) continue;
          const d = net(tel.gross, b.pad), via = tel.via ? tel.via[k] : null;
          const cause = via ? { k: 'reflected', by: via, shooter: a.uid } : { k: 'special', by: a.uid };
          Combat.hurt(state, b, d, Object.assign(cause, { sp: tel.sp, gross: tel.gross, pad: b.pad, net: d, x: tel.tiles[k][0], y: tel.tiles[k][1], from: tel.from[k].slice() }), ev);
          hits.push(b.uid);
        }
      });
      Noise.emit(state, a.x, a.y, 'soft', { k: 'special', by: a.uid }, ev);
      fields.hits = hits;
      struckYou = hits.includes(state.actors[0].uid);
    } else Archetypes.onResolve(state, a, tel, ev);
    Causes.emit(state, ev, 'special', fields, { k: 'special', by: a.uid, sp: tel.sp });
    Perks.onResolve(state, a, Object.assign({}, tel, { atYou: atYou(tel) }), struckYou, ev);
  }

  // Specials.resolve(state, a, ev) → ticks: at a's action (AI.act), its pending special goes
  // off (fire), and the action costs an attack plus SPECIAL_RECOVERY. A due line not yet due
  // does not: a waits (a wait's cost), and it goes off at its boundary (resolveDue); one
  // whose boundary has passed with nothing to set it off goes off now.
  function resolve(state, a, ev) {
    const tel = a.telegraph;
    if (!tel) throw new Error(`Specials.resolve: ${a.uid} has no mark pending`);
    if (isDue(tel) && tel.due > state.tick) return AI.wait(state, a, ev);
    fire(state, a, ev);
    return Actors.cost(state, a, N.COST_ATTACK, 'act') + N.SPECIAL_RECOVERY;
  }

  // Specials.resolveDue(state, ev) → [uid…]: at a turn boundary (step 8, before the module
  // turn rules: Modules.turn calls it), every due line whose tick has come goes off (fire),
  // in its owners' spawn order; the uids of those owners. It costs its owner nothing: the
  // line is the boundary's, not an action of its owner's. Nothing more goes off once the
  // visit is over (a line that defeats you ends it, as an exhibit's action that does ends
  // the world's turn, Step.advance).
  function resolveDue(state, ev) {
    const out = [];
    for (const a of state.actors.slice()) {
      if (state.over) break;
      if (a.gone || !isDue(a.telegraph) || a.telegraph.due > state.tick) continue;
      fire(state, a, ev);
      out.push(a.uid);
    }
    return out;
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

  // Specials.marks(state) → [{x, y, dmg, by, kind, due?}]: every pending mark's tiles, in
  // spawn order: kind 'telegraph' with dmg what you would take there (net of your Padding
  // now), or kind 'call' (dmg null); a due line's also give the tick it goes off (due). The
  // view model keeps those on visible tiles.
  function marks(state) {
    const you = state.actors[0], out = [];
    for (const a of state.actors) {
      if (a.gone || !a.telegraph) continue;
      const t = a.telegraph, dmg = t.effect === 'damage' ? net(t.gross, you.pad) : null;
      for (const [x, y] of t.tiles) {
        const row = { x, y, dmg, by: a.uid, kind: t.effect === 'damage' ? 'telegraph' : 'call' };
        if (isDue(t)) row.due = t.due;
        out.push(row);
      }
    }
    return out;
  }

  // Specials.readout(state, a, you) → [{sp, net, gross, effect, every, shape, range}]: the odds
  // readout's lines for a's specials (§8.1: "one line per special, with its exact net damage
  // and cadence"), one for each of Specials.list, none if it has none. net is what it would
  // deal you now through your Padding (Specials.net, as its marks show), or null for a
  // special that deals no damage (a call); every its cadence in actions and range its reach
  // in tiles (null where it has none). For an exhibit whose specials take turns, every is
  // how often each comes at most: one action in cadence × the number of its specials.
  function readout(state, a, you) {
    const ids = list(state, a), every = rotates(a) ? cadence(state, a) * ids.length : null;
    return ids.map(id => {
      const sp = info(state, id);
      return { sp: sp.id, net: sp.effect === 'damage' ? net(sp.gross, you.pad) : null, gross: sp.gross, effect: sp.effect,
        every: rotates(a) ? every : sp.every, shape: sp.shape, range: sp.range };
    });
  }

  // Specials.threat(state, action) → null | {x, y, dmg, by, sp?, due?, more?}: does your action
  // leave you on a tile marked for damage by a special that will go off before your next
  // decision? The interface asks before such an action ("Stay in the beam: 9 damage?", §7.1).
  // The tile is where the action leaves you, and your next decision comes when its ticks are
  // done, as the perks you hold make them (Perks.adjust, asked as step() asks it: on the state
  // the action left, with the events the action made, so a perk that reads its step reads
  // the same one; a step made free leaves no time for anything to go off). What goes off first:
  //   - a pending mark, if its owner's next action comes earlier (ties go to you, §8.1);
  //   - a due line, if its boundary comes at or before your next decision (a boundary runs
  //     before anyone who acts at its tick), whether it is marked already or will be marked
  //     before then by a module (Modules.threat: the chime's lines before the chime sounds,
  //     §8.1, D7.3), so a long action is never begun without warning of one.
  // dmg is what the mark shows: its gross through your Padding now, which is what goes off,
  // since your stats change only when your action is done. A due line's answer also gives
  // its special (sp) and the tick it goes off (due), since a module's line has no mark yet.
  // When more than one would strike that tile first, the answer is the first to go off, and
  // more lists the others in the order they go off (boundaries first, then by owner's spawn).
  // The action is applied to a copy of the state, which is then thrown away, and the marks
  // are read from the copy: so the tile and the cost are the action's own, and a mark the
  // action calls off (its owner fixed, quieted, or losing you to the Ticket) is no threat,
  // nor is any mark once the action ends the visit (leaving). Nothing you could not know
  // before the action is looked at, so the answer gives nothing away:
  //   - a mark whose owner the action destroys still counts, because whether a blow
  //     destroys is not known before it is made, so a destroying blow and a miss give the
  //     same answer; so does a line a module would mark for that owner;
  //   - an action with a consumable whose kind you have not identified (Consumables.known)
  //     is judged as if it left you where you are and called nothing off, so the answer
  //     does not tell you what the consumable is. Only its cost is the action's own.
  // A refused action (by a status or a rule's refuser, as step() refuses it), or one that
  // takes no time, has no threat.
  function unforeseen(state, action) {
    if (typeof action.uid !== 'string' || !Array.isArray(state.items)) return false;
    const it = state.items.find(i => i.uid === action.uid);
    return !!it && it.kind === 'consumable' && !Consumables.known(state, it.ck);
  }
  // A module's mark (Modules.threat), checked: plain data read as a telegraph is.
  function moduleMark(m) {
    if (!m || typeof m.by !== 'string' || typeof m.sp !== 'string' || !Array.isArray(m.tiles) || !Number.isInteger(m.gross) || !Number.isInteger(m.due))
      throw new Error(`Specials.threat: Modules.threat gave ${JSON.stringify(m)}, not {by, sp, tiles, gross, due}`);
    return m;
  }
  function threat(state, action) {
    if (state.over || !action || typeof action.a !== 'string') return null;
    if (state.ui && state.ui.pendingChoice && action.a !== 'choose') return null;
    const h = Actions.get(action.a), you = state.actors[0];
    if (!h || Status.blocks(state, you, action) || Actions.refusal(state, action)) return null;
    const copy = State.clone(state), made = [], raw = h.apply(copy, action, made);
    if (typeof raw === 'string' || !Number.isInteger(raw) || raw <= 0) return null;
    const r = Perks.adjust(copy, action, raw, made).r;
    if (r <= 0) return null;
    const seen = unforeseen(state, action) ? state : copy;
    if (seen.over && seen.over.k === 'left') return null;
    const after = seen.actors[0], x = after.x, y = after.y, decision = you.next + r;
    // Actors are never removed during a visit, so the copy's actor i is the state's actor i;
    // any the action created come after them, and have no mark. One the action destroyed is
    // read as it was before (was).
    const found = [], pending = new Set();
    const hit = (by, gross, sp, due) => {
      const o = { x, y, dmg: net(gross, you.pad), by };
      if (due !== null) { o.sp = sp; o.due = due; }
      return o;
    };
    for (let i = 1; i < seen.actors.length; i++) {
      const b = seen.actors[i], was = i < state.actors.length ? state.actors[i] : null;
      const a = was && !was.gone && b.gone ? was : b;
      const t = a.telegraph;
      if (a.gone || !t || t.effect !== 'damage') continue;
      if (isDue(t)) {
        pending.add(`${a.uid} ${t.sp} ${t.due}`);
        if (t.due <= decision && hasTile(t.tiles, x, y)) found.push({ at: t.due, late: 0, i, hit: hit(a.uid, t.gross, t.sp, t.due) });
      } else if (Actors.scheduled(a) && a.next < decision && hasTile(t.tiles, x, y)) found.push({ at: a.next, late: 1, i, hit: hit(a.uid, t.gross, t.sp, null) });
    }
    // The module marks due by your next decision (Modules.threat gives those due before the
    // tick it is given, so it is given the tick after your decision): from the copy, and, for
    // an owner the action destroyed, from the state as it was.
    const index = uid => { for (let i = 1; i < state.actors.length; i++) if (state.actors[i].uid === uid) return i; return state.actors.length; };
    const lost = uid => { const i = index(uid); return i < state.actors.length && i < seen.actors.length && !state.actors[i].gone && seen.actors[i].gone; };
    const forecast = Modules.threat(seen, decision + 1).map(moduleMark);
    if (seen !== state) for (const m of Modules.threat(state, decision + 1).map(moduleMark)) if (lost(m.by)) forecast.push(m);
    for (const m of forecast) {
      if (m.due > decision || pending.has(`${m.by} ${m.sp} ${m.due}`) || !hasTile(m.tiles, x, y)) continue;
      pending.add(`${m.by} ${m.sp} ${m.due}`);
      found.push({ at: m.due, late: 0, i: index(m.by), hit: hit(m.by, m.gross, m.sp, m.due) });
    }
    if (!found.length) return null;
    const order = found.map((f, k) => Object.assign({ k }, f)).sort((p, q) => p.at - q.at || p.late - q.late || p.i - q.i || p.k - q.k);
    const first = order[0].hit;
    if (order.length > 1) first.more = order.slice(1).map(f => f.hit);
    return first;
  }

  return { SHAPES: SHAPES.slice(), info, of, cpGross, list, cadence, nextUp, markNext, addShape, shapes, passesGlass, tiles, marking, canMark, mark, atYou,
    net, resolve, resolveDue, cancel, marks, readout, threat };
})();
