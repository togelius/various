// ACCESSION — the Centrepiece hall and its seal (BUILD.md §8.4; plan A8, A13). M4's skeleton
// made each function with its signature: the registry of the hall's checks and the accessor
// are working code, the rest neutral until ARCH-HALL fills them (frozen once it lands).
//
// dept.cp, the Centrepiece and its hall, is absent from a state until the Centrepiece is
// placed (§4.1), and every rule reads it through Hall.cp:
//   { uids, room, openings: [{x, y, ch}], form, sealed: null | {turn, by, why}, touched,
//     sheet, treasure }
// Hall.addCheck(id, fn) lets a Centrepiece's own rules add a check that Hall.boundary runs
// (the treasure's seal and carry-out, rules/treasure.js), so none of them edits this file;
// fn(state, ev), in the order added.
'use strict';
const Hall = (() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const ids = [], checks = {};

  // Hall.addCheck(id, fn): once per id.
  function addCheck(id, fn) {
    if (typeof id !== 'string' || !id) throw new Error('Hall.addCheck: a check needs a string id');
    if (own(checks, id)) throw new Error(`Hall.addCheck: ${id} is added twice`);
    if (typeof fn !== 'function') throw new Error(`Hall.addCheck: ${id} needs a function`);
    checks[id] = fn;
    ids.push(id);
  }
  // The checks added, as [id, fn], in the order added.
  const added = () => ids.map(id => [id, checks[id]]);

  // The Centrepiece and its hall, or null where none is placed.
  const cp = state => (state && state.dept && state.dept.cp) || null;

  // ARCH-HALL fills: turn boundary step 6's first part: the seal, the wait, the lift, then each check.
  function boundary(state, ev) {}
  // ARCH-HALL fills: a Re-admission Ticket read while the hall is sealed unseals it.
  function onTicket(state, ev) {}
  // ARCH-HALL fills: the Centrepiece's defeat lifts the seal.
  function onDefeat(state, ev) {}
  // ARCH-HALL fills: is (x, y) inside the Centrepiece's hall?
  function inside(state, x, y) { return false; }
  // ARCH-HALL fills: the hall's openings, staff doors included, as [{x, y, ch}].
  function openings(state) { return []; }

  return { addCheck, added, cp, boundary, onTicket, onDefeat, inside, openings };
})();
