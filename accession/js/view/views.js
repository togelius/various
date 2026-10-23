// ACCESSION — the renderer registry (BUILD.md §6.2). A renderer draws the view model and
// answers which tile is under a point; it never reads the state or decides anything.
// Top-down registers first and is the fallback for every other view.
'use strict';
const Views = (() => {
  const entries = [];
  let current = { id: 'topdown', note: '' };
  const register = (id, label, factory) => { entries.push({ id, label, factory }); };
  const list = () => entries.map(e => ({ id: e.id, label: e.label }));
  const find = id => entries.find(e => e.id === id);
  const active = () => ({ id: current.id, note: current.note });
  const make = (id, host) => find(id).factory(host);

  // Create the chosen renderer. If it is not in this build, cannot start, or its ready
  // promise rejects, the flat board is shown instead and the note says why in one sentence.
  // onFallback(renderer, note) hands the replacement to the caller.
  function create(id, host, onFallback) {
    const flat = why => {
      const e = find(id), name = e ? e.label : id;
      current = { id: 'topdown', note: `The ${name} board ${why}, so the flat board is shown.` };
      return make('topdown', host);
    };
    if (id === 'topdown' || !find(id)) {
      const r = id === 'topdown' ? make('topdown', host) : flat('is not part of this build');
      if (id === 'topdown') current = { id: 'topdown', note: '' };
      return r;
    }
    let r;
    try { r = make(id, host); } catch (e) { return flat(`could not start here (${e.message})`); }
    current = { id, note: '' };
    r.ready.catch(e => {
      if (current.id !== id) return;
      r.dispose();
      onFallback(flat(`could not start here (${e.message})`), current.note);
    });
    return r;
  }
  return { register, list, active, create, make };
})();
