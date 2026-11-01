// ACCESSION — a treasure's hall (BUILD.md §5.5, §8.4, §8.7; M4 plan A8, D3.6, D3.14, decided
// without play; revisit once M4 is playable): the treasure seal, the carry-out that is the
// treasure's defeat and earns its Certificate, and the dust sheet closing its case. In M4 the
// one treasure is S.9's Lamp, which the Composite guards (rules/arch/completing_guardian.js).
// Its rules register from here, so it edits no shared file: the seal as the treasure form's
// seal rule (Hall.defineSeal: a pure rule, so the hall's confirmation can foresee it), the
// carry-out as a hall check (Hall.addCheck), and the sheet's refusal of its case
// (Actions.addRefuser). M4's skeleton made the file; COMPOSITE-PHASES filled it.
//
// The rules:
//   - The treasure seal. A treasure's hall does not seal on the hunt alone. Its seal is called
//     while one of its Centrepiece's pieces hunts you from inside the hall and either
//     TREASURE_SEAL_TURNS turns have passed since its treasure's case was first touched (opened
//     or bashed: dept.cp.touched {turn}, which its guardian records; Solvent's dissolving it is
//     no touch, §8.3) (why touched), or its health together is TREASURE_SEAL_HP_PCT% of its full
//     health or less (why hurt). As every seal, it closes at a turn boundary only while you
//     stand inside the hall and no one stands in an opening, and waits, saying so once, while
//     someone does (Hall.boundary). The rule names no piece as `by` (no line of a treasure's
//     need then cover the stage): the sealed sentence says why in words (text/hall.js).
//   - The carry-out (D3.14). At each turn boundary, after the seal's own step, if you hold the
//     treasure (in your kit or your tote) standing outside the hall (in an opening, or beyond)
//     while it is not sealed, you have carried it out: dept.cp.treasure {turn} records it, once
//     a visit, and the Certificate follows (Progress.award, by treasure), unless this visit has
//     one already. Reading a Re-admission Ticket while you carry it puts you at the entrance,
//     outside the hall, and opens a sealed hall (Hall.onTicket), so the boundary that ends that
//     read counts it carried out the same way. Killing its guardian earns nothing
//     (Centrepiece.onPieceDied): only the carry-out is the treasure's defeat, before or after
//     its guardian falls.
//   - The treasure is the item of the Centrepiece's Signature piece (dept.cp.signature) that the
//     department placed, in its case (Kit.place, LTreasure): one you came with, worn or carried
//     from the start (the carry's, uids you.c1, you.c2 …, §3.2), is not it, so a Lamp the bots
//     start wearing is never carried out.
//   - The dust sheet (D3.6). Once a view has put the Centrepiece under its dust sheet
//     (dept.cp.sheet, rules/viewing.js), its treasure's case (the case its guardian guards) is
//     closed with it: opening or bashing that case, taking an item from it, aiming an
//     instrument at it, and throwing a Solution whose square (THROW_AREA, centred where it
//     lands) holds it, whatever the Solution is (so no refusal gives an unknown one away), are
//     refused `sheeted`, as the sheet itself is (rules/viewing.js), so no view earns a
//     Certificate and then the treasure too.
// Treasure, for the core and the tests:
//   Treasure.item(state) → the treasure's item, or null (no treasure, or none placed)
//   Treasure.held(state) → bool         you hold it: in your kit or your tote
//   Treasure.touched(state) → null | turn   the turn its case was first touched
//   Treasure.caseOf(state) → null | case     the case its guardian guards (the treasure case)
// Nothing here draws on a stream, and nothing acts where no treasure's Centrepiece is placed.
'use strict';
const Treasure = (() => {
  const isInt = Number.isInteger;
  const own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // The Centrepiece and its hall, if it is a treasure's; else null.
  const cpOf = state => { const c = Hall.cp(state); return c && c.form === 'treasure' ? c : null; };
  // An item you came with: your starting kit and the carry's (§3.2's uids you.w, you.g, you.c1 …).
  const brought = it => typeof it.uid === 'string' && it.uid.indexOf('you.') === 0;

  // Treasure.item(state) → the treasure's item (its Signature piece, placed by the department),
  // or null.
  function item(state) {
    const c = cpOf(state);
    if (!c || typeof c.signature !== 'string') return null;
    for (const it of state.items || []) if (it.ref === c.signature && !brought(it)) return it;
    return null;
  }
  // Treasure.held(state) → bool: the treasure is in your kit or your tote.
  function held(state) {
    const it = item(state);
    return !!it && !!it.where && (it.where.at === 'kit' || it.where.at === 'tote');
  }
  // Treasure.touched(state) → the turn its case was first opened or bashed, or null.
  function touched(state) {
    const c = cpOf(state), t = c && c.touched;
    return t && isInt(t.turn) ? t.turn : null;
  }
  // Treasure.caseOf(state) → the case its guardian guards (a piece's `guards`, the first in
  // cp.uids's order that has one, fallen or not), whatever has become of it; or null.
  function caseOf(state) {
    if (!cpOf(state)) return null;
    for (const a of Centrepiece.pieces(state)) {
      if (!Array.isArray(a.guards)) continue;
      const f = Cases.at(state, a.guards[0], a.guards[1]);
      if (f && f.k === 'case') return f;
    }
    return null;
  }

  // ---- The treasure seal (Hall.defineSeal; it only reads) ----
  Hall.defineSeal('treasure', (state, c) => {
    let hunts = false;
    for (const a of Centrepiece.pieces(state)) if (!a.gone && a.mode === 'hunting' && Actors.footprint(a).some(([x, y]) => Hall.inside(state, x, y))) hunts = true;
    if (!hunts) return null;
    const t = touched(state);
    if (t !== null && state.turn - t >= N.TREASURE_SEAL_TURNS) return { why: 'touched' };
    const h = Centrepiece.health(state);
    if (h && h.hp <= Int.pct(h.max, N.TREASURE_SEAL_HP_PCT)) return { why: 'hurt' };
    return null;
  });

  // ---- The carry-out (a hall check, after the seal's own step) ----
  Hall.addCheck('treasure_out', (state, ev) => {
    const c = cpOf(state), you = state.actors[0];
    if (!c || c.treasure || c.sealed || state.over || you.gone || Hall.inside(state, you.x, you.y) || !held(state)) return;
    c.treasure = { turn: state.turn };
    Progress.award(state, 'treasure', { k: 'treasure' }, ev);
  });

  // ---- The dust sheet over its case (§4.2; the refusal `sheeted`) ----
  const at = (f, x, y) => isInt(x) && isInt(y) && x === f.x && y === f.y;
  const byUid = (state, uid) => { for (const it of state.items || []) if (it.uid === uid) return it; return null; };
  const isSolution = it => !!it && it.kind === 'consumable' && own(Registry.CONSUMABLES, it.ck) && Registry.CONSUMABLES[it.ck].cls === 'solution';
  Actions.addRefuser((state, action) => {
    const c = cpOf(state);
    if (!c || !c.sheet || !action) return null;
    const f = caseOf(state);
    if (!f) return null;
    if (action.a === 'open' || action.a === 'bash') return at(f, action.x, action.y) ? 'sheeted' : null;
    if (action.a === 'take') {
      const it = byUid(state, action.uid);
      return it && it.where && it.where.at === 'case' && at(f, it.where.x, it.where.y) ? 'sheeted' : null;
    }
    if (action.a === 'use') {
      const it = byUid(state, action.uid);
      return it && it.kind === 'instrument' && at(f, action.x, action.y) ? 'sheeted' : null;
    }
    if (action.a === 'throw') {
      const it = byUid(state, action.uid);
      return isSolution(it) && isInt(action.x) && isInt(action.y) && Grid.covers({ x: action.x, y: action.y, size: N.THROW_AREA }, f.x, f.y) ? 'sheeted' : null;
    }
    return null;
  });

  return { item, held, touched, caseOf };
})();
