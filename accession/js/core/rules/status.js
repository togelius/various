// ACCESSION — status effects on actors, as { id, until } with until a turn number.
'use strict';
const Status = (() => {
  const has = (a, id) => !!(a.statuses && a.statuses.some(s => s.id === id));
  function add(a, id, turns, now) {
    if (!a.statuses) a.statuses = [];
    const s = a.statuses.find(s => s.id === id);
    if (s) s.until = Math.max(s.until, now + turns); else a.statuses.push({ id, until: now + turns });
  }
  // Called on each turn boundary: expire what has run out.
  function tick(state, ev) {
    for (const a of state.actors) {
      if (!a.statuses || !a.statuses.length) continue;
      const keep = [];
      for (const s of a.statuses) {
        if (s.until <= state.turn) ev.push({ k: 'status_ended', turn: state.turn, who: a.uid, status: s.id });
        else keep.push(s);
      }
      a.statuses = keep;
    }
  }
  return { has, add, tick };
})();
