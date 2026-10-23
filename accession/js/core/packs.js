// ACCESSION — the department packs: content files register themselves here (BUILD.md §5.2).
'use strict';
const Packs = (() => {
  const all = [];
  function add(p) { all.push(p); }
  const get = acc => all.find(p => p.acc === acc) || null;
  const list = () => all.slice();
  function species(acc, id) { const p = get(acc); return p ? p.species.find(s => s.id === id) || null : null; }
  return { add, get, list, species };
})();
