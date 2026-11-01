// ACCESSION — the department packs: content files register themselves here (BUILD.md §5.2).
// A shared species belongs to no department (the Night Watchman, content/watch.js): it is
// registered with Packs.addShared and found by its id wherever it appears.
//
// A pack comes in parts, one part a file (M4 plan A9): content/<acc>.js gives the pack with
// Packs.add, and content/<acc>-intro.js, -cp.js and -panels.js each give one part with
// Packs.part(acc, name, data), after it in index.html. Packs.get and Packs.list give each
// pack with its parts merged in, as the field of that name.
'use strict';
const Packs = (() => {
  const all = [], shareds = [];
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // The parts a pack may be given apart from its card (A9): the Intro stamp, the Centrepiece
  // and the panels.
  const PARTS = ['intro', 'centrepiece', 'panels'];

  // A pack, checked as it is added: an accession given once; each species' flags name
  // modules its own pack lists (a flag says the species takes part in that module's rule,
  // so a flag for a module the department does not have would promise a rule that never
  // runs); each copyOf names another species of the same pack (the original a spare copies).
  function add(p) {
    if (!p || typeof p.acc !== 'string') throw new Error('Packs.add: a pack needs its accession, acc');
    if (get(p.acc)) throw new Error(`Packs.add: ${p.acc} is added twice`);
    const mods = (p.modules || []).map(m => m.id), ids = (p.species || []).map(sp => sp.id);
    for (const sp of p.species || []) {
      if (sp.flags !== undefined && !Array.isArray(sp.flags)) throw new Error(`Packs.add: ${sp.id}'s flags are not a list`);
      for (const f of sp.flags || []) if (!mods.includes(f)) throw new Error(`Packs.add: ${sp.id} is flagged for ${f}, which is not one of ${p.acc}'s modules (${mods.join(', ') || 'none'})`);
      if (sp.copyOf !== undefined && (sp.copyOf === sp.id || !ids.includes(sp.copyOf))) throw new Error(`Packs.add: ${sp.id} is a copy of ${sp.copyOf}, which is not another species of ${p.acc}`);
    }
    all.push(p);
  }
  const get = acc => all.find(p => p.acc === acc) || null;
  const list = () => all.slice();

  // Packs.part(acc, name, data): the part `name` of the pack acc, given by its own file. The
  // pack must already be added, and each part is given once: a second, or one the pack
  // already holds in its card, is an error, so no part is silently replaced.
  function part(acc, name, data) {
    if (!PARTS.includes(name)) throw new Error(`Packs.part: ${JSON.stringify(name)} is not a part of a pack (${PARTS.join(', ')})`);
    const p = get(acc);
    if (!p) throw new Error(`Packs.part: there is no pack ${acc} to give the ${name} to (content/${acc}.js loads first)`);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Packs.part: ${acc}'s ${name} is not a record`);
    if (hasOwn(p, name) && p[name] !== undefined && p[name] !== null) throw new Error(`Packs.part: ${acc}'s ${name} is given twice`);
    p[name] = data;
  }

  // Every record drawn with a sprite, for the art test (BUILD.md §9.1): each pack's species,
  // its Centrepiece, and the Centrepiece's pieces and attachments, then the shared species;
  // as {id, sprite, archetype, size}. A piece or attachment that names no archetype is drawn
  // for its Centrepiece's, and one that names no size is 1 tile. A Centrepiece of pieces (an
  // ensemble, M4 ENSEMBLE-CORE) is drawn only as its pieces, which fill its footprint, so its
  // record is not listed: each piece is, by its id (its record's, for a piece that names
  // none) and its sprite (its record's, for a piece that names none).
  function sprites() {
    const out = [], rec = (r, arch) => ({ id: r.id, sprite: r.sprite, archetype: r.archetype || arch || null, size: r.size || 1 });
    for (const p of all) {
      for (const sp of p.species || []) out.push(rec(sp));
      const cp = p.centrepiece;
      if (!cp) continue;
      const pieces = Array.isArray(cp.pieces) ? cp.pieces : [];
      if (!pieces.length) out.push(rec(cp));
      for (const q of pieces) out.push(rec(Object.assign({}, q, { id: q.id || cp.id, sprite: q.sprite || cp.sprite }), cp.archetype));
      for (const q of cp.attachments || []) out.push(rec(q, cp.archetype));
    }
    for (const sp of shareds) out.push(rec(sp));
    return out;
  }
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
  // then its Centrepiece (or a piece or attachment of it), then a shared species, then any pack's
  // species or Centrepiece (or piece or attachment) with that id (a room for tests or an arena may stand one pack's
  // species in another place; ids are unique across the packs, which lint-registry checks);
  // null for an actor with none (you, or the test room's dummies). Labels, the view model,
  // policies and Setup.room read species through this.
  function speciesFor(state, a) {
    if (!a || a.sp === null || a.sp === undefined) return null;
    const p = state && state.dept ? get(state.dept.acc) : null;
    if (p) {
      const own = p.species.find(s => s.id === a.sp);
      if (own) return own;
      const cp = pieceOf(p.centrepiece, a.sp);
      if (cp) return cp;
    }
    const sh = shared(a.sp);
    if (sh) return sh;
    for (const q of all) {
      const own = q.species.find(s => s.id === a.sp);
      if (own) return own;
      const cp = pieceOf(q.centrepiece, a.sp);
      if (cp) return cp;
    }
    return null;
  }
  // A Centrepiece's species for the id sp, or null: its record, or, for a Centrepiece of pieces
  // (an ensemble, M4 ENSEMBLE-CORE), a piece's, as Centrepiece.place names it (its own id, or
  // its record's for a piece that names none): the record with the piece's own words where
  // the piece gives them (PIECE_WORDS: its name, sprite, tombstone and paragraph) and the
  // piece's id, so each piece's label names it, while its rules and its Behaviour line are its
  // Centrepiece's. A piece that gives no words of its own and names no id is the record itself.
  // An attachment (`attachments`: an exhibit its Centrepiece's rules set out in its hall, no
  // piece of it: A.4's Senior Countersigning Clerk, M4 ENSEMBLE-PHASES; M.11's Repeater Arm
  // and Board Dish, M4 TABLEAU-PHASES) is a species of its own, its record as it is, by its id.
  const PIECE_WORDS = ['name', 'sprite', 'tomb', 'paragraph'];
  function pieceOf(cp, sp) {
    if (!cp) return null;
    const att = Array.isArray(cp.attachments) ? cp.attachments.find(x => x && x.id === sp) : undefined;
    if (att) return att;
    const q = Array.isArray(cp.pieces) ? cp.pieces.find(x => x && (x.id || cp.id) === sp) : undefined;
    if (!q) return cp.id === sp ? cp : null;
    if (sp === cp.id && !PIECE_WORDS.some(k => q[k] !== undefined)) return cp;
    const out = Object.assign({}, cp, { id: sp });
    for (const k of PIECE_WORDS) if (q[k] !== undefined) out[k] = q[k];
    return out;
  }

  return { PARTS, add, part, get, list, sprites, species, addShared, shared, sharedList, speciesFor };
})();
