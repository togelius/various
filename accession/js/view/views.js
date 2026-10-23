// ACCESSION — the renderer registry (BUILD.md §6.2). A renderer draws the view model and
// answers which tile is under a point; it never reads the state or decides anything.
'use strict';
const Views = (() => {
  const factories = {};
  const register = (id, factory) => { factories[id] = factory; };
  const has = id => id in factories;
  // Create the chosen renderer, falling back to top-down. Returns { renderer, id, note }.
  function create(id, host) {
    if (id !== 'topdown' && has(id)) {
      try { return { renderer: factories[id](host), id, note: null }; }
      catch (e) { return { renderer: factories.topdown(host), id: 'topdown', note: 'The 3D board could not start here (' + e.message + '), so the flat board is shown.' }; }
    }
    return { renderer: factories.topdown(host), id: 'topdown', note: id !== 'topdown' ? 'The 3D board is not part of this build, so the flat board is shown.' : null };
  }
  return { register, has, create };
})();
