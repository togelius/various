// ACCESSION — the mp_ensemble archetype's hooks (A.4's Centrepiece, the Ordinance; BUILD.md §5.1,
// §5.3, §5.5), added with the hooks every Centrepiece shares (Centrepiece.hooks: its specials in
// turn, its phases, its fall). Its registry entry is in js/core/reg/cp-ensemble.js, its
// sentences in js/core/text/cp-ensemble.js and its record in content/A4-cp.js. ENSEMBLE-CORE
// built its pieces; ENSEMBLE-PHASES built inheritance, phase 3's shatter, its Clerk and its
// gallery hook here.
//
// The rule, as its line says it (M4 plan Q8, D3.3, D3.7, D3.13, decided without play; revisit
// once M4 is playable):
//   - Its pieces (its record's `pieces`: ENSEMBLE_PIECES one-tile pieces on its 2×2 footprint,
//     the original first, then the certified copies by letter) each hold their own health, a
//     share of the role's: an equal whole share each, the original also what is left over
//     (Centrepiece.place). Each is an exhibit of its own: it wakes, hunts, strikes and falls on
//     its own, and its label and odds readout are its own (its own name and number: Packs'
//     piece species; its own health).
//   - They never step (neverSteps, so mayStep is false: neither a rule nor the Window Pole
//     moves one), so none ever leaves the hall; each strikes from beside you with the role's
//     blow. Each hunts, and its changes of mode take place where it stands, as the log tells
//     them (Wake.stands, how: 'stands'; M4 TABLEAU-CORE).
//   - The copies are the original's spares, one copy group (init: CopiesWeaken.addGroup, once,
//     when its pieces are set up), whatever its pieces' flags: with copies_weaken on, the
//     original's fall weakens and slows each copy still standing (§5.4; the module's rule and
//     its part on this line), and with it off nothing comes of it.
//   - Its phases count all its pieces' health, and their full health, together
//     (Centrepiece.health: a fallen piece has none, and a copy that loses heart loses some of
//     each), at CP_PHASE_PCT, never going back; each phase's special goes to its first piece
//     still standing as the phase begins (Centrepiece.advance). Its phase events have a cause
//     of their own (`ensemble`): when a piece is hurt and still stands, or falls while another
//     still stands, or its gallery hook takes its health (below), it enters the phase its
//     health then gives here, before the core's onPieceDamaged and onPieceDied (which
//     Centrepiece.hooks runs after these) would, so they find it there. The cause says whether
//     you see the piece that gains (seen, judged as the view model and the log judge it: a
//     tile of it in your sight), and its sentence names that piece only then
//     (text/cp-ensemble.js). A fall that leaves none standing is the core's: its defeat.
//   - Inheritance (ENSEMBLE-PHASES): when a piece falls while another stands, each piece still
//     standing, in its pieces' order, takes on every special the fallen piece had (in the
//     order it had them) that it lacks, at the end of its own list (ax.specials, which take
//     turns, Specials.markNext); each told by a phase event {who, phase: the phase it is in,
//     gained} with the cause `inherited` {from: the fallen piece, seen: whether you see who}, so
//     its sentence names the piece that takes it on only when you see it (the decision M4
//     ENSEMBLE-CORE made for the phase's gainer, kept: the fallen piece is named, as its own
//     died sentence names it). A spent shatter (below) is not taken on. Then its phase, as
//     above. Inheritance enters no phase, so its event's phase is the one it is in.
//   - Phase 3 gives its first piece still standing the shatter (shatter_all, the record's
//     phases[2].specials): its shape is the tile of every case of its hall still intact (shut,
//     on its `v`, in the room dept.cp.room; never a mimic's disguise, and no mimic is placed in
//     a hall), marked while it hunts, whether or not it sees
//     you. At its owner's next action (onResolve) each case still intact on a marked tile
//     breaks, as a breaking bash breaks one (§8.3), but with no touch: it is broken (`k`), what
//     stood in it is released (Cases.release, case_broken by the piece), its shards fall on the
//     first floor or archway tile beside it in direction order (Cases.spreadShards from its own
//     tile, no longer floor), glass_broke {by: the piece, …} with the cause shatter; then, once
//     every case has broken, a crash from each case's tile, in the same order (every break
//     before any noise, as a special's hits come before any noise, §8.1).
//   - The shatter is spent once no case of its hall is intact: no piece holds it then. Each
//     piece standing that holds it drops it (from ax.specials), told by special {who, sp,
//     cancelled: true} with the cause `spent` {by: it, seen} (spend), at the first of: a turn
//     boundary (the hall's checks, Hall.addCheck), the phase that gives it (onPhase), a piece's
//     fall (before what it passes on), and its own action (act, after the core's: so a shatter
//     that cannot be marked never holds its other specials back for more than that action,
//     where it acts as it otherwise would).
//     Its mark, if one is pending, still goes off, and breaks what is still intact: nothing.
//   - Its attachment, the Senior Countersigning Clerk (its record's `attachments`, M4 plan
//     D3.13): made when its pieces are set up, with the group (attach), an exhibit of the hall
//     with its own species (Packs.speciesFor finds a Centrepiece's attachments), its own role's
//     numbers at the depth, its archetype (the healer) and modifiers (clockwork), asleep, uid
//     <acc>.<depth>.<hall>.<n> counting on from the pieces'. It stands on the hall's tile at its
//     `at` from the footprint's top-left tile, or, if that is not free, the free tile of the
//     hall nearest it (Chebyshev, ties in row-major order): free, a tile of the hall an exhibit
//     can walk on, no closed door, no fixture, no one on it, and more than RING_STILL + 1
//     walking tiles from the hall's reading tile (as no gallery exhibit stands nearer:
//     populate.js). It is no piece: its health counts in no phase, and it is not in dept.cp.
//     Then, as for every exhibit made asleep (Setup.settleActors), `without`, else its init.
//     It is made asleep: a trigger that replaces the wake is refused.
//   - Its gallery hook (ENSEMBLE_HOOK_PCT): at each turn boundary (the hall's checks), each
//     original destroyed in the galleries since the last, in the actors' order, while fewer
//     than ENSEMBLE_HOOK_PCT[1] ÷ ENSEMBLE_HOOK_PCT[0] have counted (dept.cp.hook, the uids of
//     those counted, absent until the first counts), costs it ENSEMBLE_HOOK_PCT[0]% of its full health (its pieces'
//     maximums together, rounded down: so at most ENSEMBLE_HOOK_PCT[1]% in all), taken from its
//     first piece standing, never its last point: damaged {who, amount, hp} with the cause
//     hook {of: the original} (no blow, so no one wakes or hears it; none told when it takes
//     nothing); then its phase (above). An original destroyed in the galleries: an exhibit
//     some spare copies (CopiesWeaken.originalOf), not a piece of its own, every body of whose
//     line is gone (CopiesWeaken.fallen), its first body not left out by options.without (so
//     destroyed) and fallen outside its hall. It counts with copies_weaken on or off: the module's rule
//     is the spares', the hook the Ordinance's. Nothing is taken once none of its pieces
//     stands (its fall, or the dust sheet), or once the visit is over.
// Nothing here draws on a stream.
'use strict';
(() => {
  const ID = 'mp_ensemble', SHATTER = 'shatter_all';
  const isPiece = (state, a) => { const cp = Hall.cp(state); return !!cp && Array.isArray(cp.uids) && cp.uids.includes(a.uid); };
  const byOf = cause => cause && typeof cause.by === 'string' && cause.by ? cause.by : null;
  // The Ordinance is this department's Centrepiece: its pieces are this archetype's.
  const ours = state => { const p = Centrepiece.pieces(state); return p.length > 0 && p[0].arch === ID; };
  const standing = state => Centrepiece.pieces(state).filter(p => !p.gone);

  // Is piece a in your sight: standing, shown as itself, a tile of it visible (Vision.visible),
  // as the view model lists an actor and the log tells one (main.js's inView).
  function seen(state, a) {
    if (!a || a.gone || Archetypes.present(state, a) !== null) return false;
    const m = state.dept, v = Vision.visible(state);
    return Actors.footprint(a).some(([x, y]) => Grid.inside(m, x, y) && v[y * m.w + x] === 1);
  }

  // ---- Its hall's cases, and the shatter ----

  // The cases of its hall still intact (shut, on their `v`), in the fixtures' (row-major) order.
  // A mimic's disguise is none: no mimic is placed in a hall (§5.5's placement rules).
  function hallCases(state) {
    const cp = Hall.cp(state), m = state.dept, out = [];
    if (!cp) return out;
    for (const f of m.fixtures || []) if (f.k === 'case' && f.st === 'shut' && !f.mimic && Grid.ch(m, f.x, f.y) === 'v' && Cases.roomKey(state, f.x, f.y) === cp.room) out.push(f);
    return out;
  }
  Specials.addShape(SHATTER, { tiles: state => hallCases(state).map(f => [f.x, f.y]) });

  // Its shatter goes off: each case still intact on a marked tile breaks (above), then the
  // crashes.
  function onResolve(state, a, tel, ev) {
    if (!tel || tel.sp !== SHATTER) return;
    const broke = [];
    for (const f of hallCases(state)) {
      if (!tel.tiles.some(t => t[0] === f.x && t[1] === f.y)) continue;
      f.st = 'broken';
      Grid.set(state.dept, f.x, f.y, 'k');
      const freed = Cases.release(state, f, ev, { k: 'case_broken', by: a.uid, x: f.x, y: f.y });
      const shards = Cases.spreadShards(state, f, [f.x, f.y]);
      Causes.emit(state, ev, 'glass_broke', { by: a.uid, x: f.x, y: f.y, glass: f.glass, shards, released: freed.length ? freed[0] : null }, { k: 'shatter', by: a.uid, sp: SHATTER });
      broke.push(f);
    }
    for (const f of broke) Noise.emit(state, f.x, f.y, 'crash', { k: 'glass_broke', by: a.uid }, ev);
  }

  // The shatter spent: with no case of its hall intact, each piece standing that holds it drops it.
  function spend(state, ev) {
    if (!ours(state) || state.over || hallCases(state).length) return;
    for (const p of standing(state)) {
      if (!p.ax || !Array.isArray(p.ax.specials) || !p.ax.specials.includes(SHATTER)) continue;
      p.ax.specials = p.ax.specials.filter(id => id !== SHATTER);
      Causes.emit(state, ev, 'special', { who: p.uid, sp: SHATTER, cancelled: true }, { k: 'spent', by: p.uid, seen: seen(state, p) });
    }
  }

  // ---- Its pieces ----

  // Its pieces become one copy group: the first (dept.cp.uids[0], the original) and the rest, its
  // spares; and its attachments are made. Once, at the first piece set up (Setup.settleActors
  // runs each piece's init; a piece left out by `without` is set up by none, so the group is
  // made by the first that is).
  function init(state, a) {
    const cp = Hall.cp(state);
    if (!isPiece(state, a)) return;
    if (cp.uids.length > 1) {
      const orig = cp.uids[0], spares = cp.uids.slice(1);
      if (spares.some(uid => CopiesWeaken.originalOf(state, Actors.byUid(state, uid)) !== null)) return;
      CopiesWeaken.addGroup(state, { orig, spares });
    }
    attach(state);
  }

  // Its record's attachments, each made on its tile of the hall (above), once.
  function attach(state) {
    const cp = Hall.cp(state), m = state.dept, pack = Packs.get(m.acc), rec = pack && pack.centrepiece;
    if (!rec || rec.archetype !== ID || !Array.isArray(rec.attachments) || !Array.isArray(cp.at)) return;
    const hall = (m.rooms || []).find(r => r.key === cp.room);
    if (!hall) return;
    const prefix = `${m.acc}.${m.depth}.${hall.key}.`;
    for (const q of rec.attachments) {
      if (state.actors.some(b => b.sp === q.id)) continue;
      const at = tileFor(state, hall, [cp.at[0] + q.at[0], cp.at[1] + q.at[1]]);
      if (!at) throw new Error(`mp_ensemble: ${q.id} finds no free tile in its hall ${hall.key}`);
      let n = 0;
      for (const b of state.actors) if (b.uid.startsWith(prefix) && /^\d+$/.test(b.uid.slice(prefix.length))) n = Math.max(n, Number(b.uid.slice(prefix.length)));
      if (q.trigger && Registry.TRIGGERS[q.trigger] && Registry.TRIGGERS[q.trigger].replacesWake) throw new Error(`mp_ensemble: ${q.id} is made asleep, so its trigger cannot replace the wake`);
      const stats = Roles.stats(q.role, m.depth);
      const b = Actors.spawn(state, Object.assign({}, stats, {
        uid: prefix + (n + 1), sp: q.id, size: 1, x: at[0], y: at[1], hp: stats.hp, maxHp: stats.hp, mode: 'dormant',
        arch: q.archetype, role: q.role, mods: (q.modifiers || []).slice(), modParams: q.modParams || {}, trigger: q.trigger || null, group: q.group || null,
      }));
      // As every exhibit made asleep meets them (Setup.settleActors): `without`, else its init.
      if (without(state).includes(b.uid)) b.gone = 1;
      else Archetypes.init(state, b);
    }
  }
  // The tile an attachment stands on: its own, if free, else the free tile of the hall nearest it.
  function tileFor(state, hall, want) {
    const m = state.dept, view = Array.isArray(m.viewTile) ? Grid.distances(m, [m.viewTile], N.RING_STILL + 1) : null;
    const free = (x, y) => Grid.inside(m, x, y) && m.roomOf[y][x] === hall.id && Grid.walkable(m, x, y, 'exhibit') && !Grid.closedDoor(m, x, y)
      && !Cases.at(state, x, y) && !Actors.at(state, x, y) && !(view && view[y * m.w + x] >= 0);
    let best = null, bd = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!free(x, y)) continue;
      const d = Grid.chebyshev(x, y, want[0], want[1]);
      if (bd < 0 || d < bd) { best = [x, y]; bd = d; }
    }
    return best;
  }

  // The phase its pieces' health together now gives, entered with its own cause (above).
  function phases(state, cause, ev) {
    const cp = Hall.cp(state);
    if (!cp || state.over) return;
    const h = Centrepiece.health(state), to = Centrepiece.phaseFor(h.hp, h.max);
    if (to <= Centrepiece.phase(state)) return;
    const first = standing(state)[0];
    if (!first) return;
    const c = { k: 'ensemble', seen: seen(state, first) }, by = byOf(cause);
    if (by !== null) c.by = by;
    Centrepiece.advance(state, to, c, ev);
  }

  // A fallen piece's specials, taken on by each piece still standing that lacks them (above).
  function inherit(state, a, ev) {
    const list = a.ax && Array.isArray(a.ax.specials) ? a.ax.specials.slice() : [], phase = Centrepiece.phase(state), spent = !hallCases(state).length;
    for (const sp of list) {
      if (sp === SHATTER && spent) continue;
      for (const p of standing(state)) {
        if (!Array.isArray(p.ax.specials)) p.ax.specials = [];
        if (p.ax.specials.includes(sp)) continue;
        p.ax.specials.push(sp);
        Causes.emit(state, ev, 'phase', { who: p.uid, phase, gained: sp }, { k: 'inherited', from: a.uid, seen: seen(state, p) });
      }
    }
  }

  function onDamaged(state, a, amount, cause, ev) {
    if (isPiece(state, a)) phases(state, cause, ev);
  }
  function onDied(state, a, cause, ev) {
    if (!isPiece(state, a) || state.over || !standing(state).length) return;
    spend(state, ev);
    inherit(state, a, ev);
    phases(state, cause, ev);
  }
  // Its phase entered: a shatter it gave with no case of its hall intact is spent at once.
  function onPhase(state, k, ev) { spend(state, ev); }
  // After the core's act (its specials in turn) gives nothing: a shatter that could not be
  // marked, its hall's cases gone, is spent; then it acts as it otherwise would.
  function act(state, a, ev) { spend(state, ev); return null; }
  const neverSteps = () => true;

  // ---- Its gallery hook ----

  const without = state => (state.options && state.options.without) || [];
  // The originals destroyed in the galleries (above), in the actors' order: each a first body
  // (made so, no split), gone and not left out, every body of its line gone, its own tile (where
  // it fell) outside its hall, which some other exhibit copies.
  function destroyed(state) {
    const cp = Hall.cp(state), out = [], off = without(state);
    for (let i = 1; i < state.actors.length; i++) {
      const g = state.actors[i];
      if (!g.gone || g.uid.includes('/') || cp.uids.includes(g.uid) || off.includes(g.uid)) continue;
      if (!CopiesWeaken.fallen(state, g.uid) || Cases.roomKey(state, g.x, g.y) === cp.room) continue;
      if (state.actors.some(b => b !== g && CopiesWeaken.originalOf(state, b) === g.uid)) out.push(g.uid);
    }
    return out;
  }
  function hook(state, ev) {
    const cp = Hall.cp(state), most = Int.idiv(N.ENSEMBLE_HOOK_PCT[1], N.ENSEMBLE_HOOK_PCT[0]), had = Array.isArray(cp.hook) ? cp.hook : [];
    if (had.length >= most || !standing(state).length) return;
    const fresh = destroyed(state).filter(o => !had.includes(o)).slice(0, most - had.length);
    if (!fresh.length) return;
    cp.hook = had.concat(fresh);
    for (const o of fresh) {
      const p = standing(state)[0], loss = Math.min(Int.pct(Centrepiece.health(state).max, N.ENSEMBLE_HOOK_PCT[0]), p.hp - 1);
      if (loss <= 0) continue;
      p.hp -= loss;
      Causes.emit(state, ev, 'damaged', { who: p.uid, amount: loss, hp: p.hp }, { k: 'hook', of: o });
    }
    phases(state, null, ev);
  }

  // At each turn boundary, after the seal (Hall.boundary): its gallery hook, then a shatter spent.
  Hall.addCheck(ID, (state, ev) => {
    if (!ours(state) || state.over) return;
    hook(state, ev);
    spend(state, ev);
  });

  Archetypes.add(ID, Centrepiece.hooks(ID, { init, neverSteps, onDamaged, onDied, onResolve, act, onPhase }));
})();
