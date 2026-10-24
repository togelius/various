// ACCESSION — the department packs: content files register themselves here (BUILD.md §5.2).
// A shared species belongs to no department (the Night Watchman, content/watch.js): it is
// registered with Packs.addShared and found by its id wherever it appears.
'use strict';
const Packs = (() => {
  const all = [], shareds = [];
  function add(p) { all.push(p); }
  const get = acc => all.find(p => p.acc === acc) || null;
  const list = () => all.slice();
  function species(acc, id) { const p = get(acc); return p ? p.species.find(s => s.id === id) || null : null; }

  // Shared species, in the order they were added; an id may be added once.
  function addShared(sp) {
    if (!sp || typeof sp.id !== 'string') throw new Error('Packs.addShared: a shared species needs an id');
    if (shareds.some(s => s.id === sp.id)) throw new Error(`Packs.addShared: ${sp.id} is added twice`);
    shareds.push(sp);
  }
  const shared = id => shareds.find(s => s.id === id) || null;
  const sharedList = () => shareds.slice();

  // The species record an actor was made from (a.sp): the department's own species first,
  // then its Centrepiece, then a shared species, then any pack's species or Centrepiece with
  // that id (a room for tests or an arena may stand one pack's species in another place;
  // ids are unique across the packs, which lint-registry checks); null for an actor with
  // none (you, or the test room's dummies). Labels, the view model, policies and Setup.room
  // read species through this.
  function speciesFor(state, a) {
    if (!a || a.sp === null || a.sp === undefined) return null;
    const p = state && state.dept ? get(state.dept.acc) : null;
    if (p) {
      const own = p.species.find(s => s.id === a.sp);
      if (own) return own;
      if (p.centrepiece && p.centrepiece.id === a.sp) return p.centrepiece;
    }
    const sh = shared(a.sp);
    if (sh) return sh;
    for (const q of all) {
      const own = q.species.find(s => s.id === a.sp);
      if (own) return own;
      if (q.centrepiece && q.centrepiece.id === a.sp) return q.centrepiece;
    }
    return null;
  }

  return { add, get, list, species, addShared, shared, sharedList, speciesFor };
})();
