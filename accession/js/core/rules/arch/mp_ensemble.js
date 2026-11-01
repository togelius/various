// ACCESSION — the mp_ensemble archetype's hooks (A.4's Centrepiece, the Ordinance; BUILD.md §5.1,
// §5.3, §5.5; rules/archetypes.js), added with the hooks every Centrepiece shares
// (Centrepiece.hooks: its specials in turn, its phases, its fall). Its registry entry is in
// js/core/reg/cp-ensemble.js, its sentences in js/core/text/cp-ensemble.js and its record in
// content/A4-cp.js. Owned by ENSEMBLE-CORE; ENSEMBLE-PHASES adds inheritance and the hooks here.
//
// The rule, as its line says it (M4 plan Q8, decided without play; revisit once M4 is playable):
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
//     still stands, it enters the phase its health then gives here, before the core's
//     onPieceDamaged and onPieceDied (which Centrepiece.hooks runs after these) would, so they
//     find it there. The cause says whether you see the piece that gains (seen, judged as the
//     view model and the log judge it: a tile of it in your sight), and its sentence names
//     that piece only then (text/cp-ensemble.js). A fall that leaves none standing is the
//     core's: its defeat.
// Nothing here draws on a stream.
'use strict';
(() => {
  const ID = 'mp_ensemble';
  const isPiece = (state, a) => { const cp = Hall.cp(state); return !!cp && Array.isArray(cp.uids) && cp.uids.includes(a.uid); };
  const byOf = cause => cause && typeof cause.by === 'string' && cause.by ? cause.by : null;

  // Is piece a in your sight: standing, shown as itself, a tile of it visible (Vision.visible),
  // as the view model lists an actor and the log tells one (main.js's inView).
  function seen(state, a) {
    if (!a || a.gone || Archetypes.present(state, a) !== null) return false;
    const m = state.dept, v = Vision.visible(state);
    return Actors.footprint(a).some(([x, y]) => Grid.inside(m, x, y) && v[y * m.w + x] === 1);
  }

  // Its pieces become one copy group: the first (dept.cp.uids[0], the original) and the rest, its
  // spares. Once, at the first piece set up (Setup.settleActors runs each piece's init; a piece
  // left out by `without` is set up by none, so the group is made by the first that is).
  function init(state, a) {
    const cp = Hall.cp(state);
    if (!isPiece(state, a) || cp.uids.length < 2) return;
    const orig = cp.uids[0], spares = cp.uids.slice(1);
    if (spares.some(uid => CopiesWeaken.originalOf(state, Actors.byUid(state, uid)) !== null)) return;
    CopiesWeaken.addGroup(state, { orig, spares });
  }

  // The phase its pieces' health together now gives, entered with its own cause (above).
  function phases(state, cause, ev) {
    const cp = Hall.cp(state);
    if (!cp || state.over) return;
    const h = Centrepiece.health(state), to = Centrepiece.phaseFor(h.hp, h.max);
    if (to <= Centrepiece.phase(state)) return;
    const first = Centrepiece.pieces(state).find(p => !p.gone);
    if (!first) return;
    const c = { k: 'ensemble', seen: seen(state, first) }, by = byOf(cause);
    if (by !== null) c.by = by;
    Centrepiece.advance(state, to, c, ev);
  }
  function onDamaged(state, a, amount, cause, ev) {
    if (isPiece(state, a)) phases(state, cause, ev);
  }
  function onDied(state, a, cause, ev) {
    if (isPiece(state, a) && Centrepiece.pieces(state).some(p => !p.gone)) phases(state, cause, ev);
  }
  const neverSteps = () => true;

  Archetypes.add(ID, Centrepiece.hooks(ID, { init, neverSteps, onDamaged, onDied }));
})();
