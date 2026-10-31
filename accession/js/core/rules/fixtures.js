// ACCESSION — reading fixtures (BUILD.md §4.2, §8.8; plan A4): `read(x, y)` reads any fixture
// through Fixtures.read, and each kind's reader registers with Fixtures.addReader from its own
// file: the plaque (rules/consumables.js, which held M3's read), the lectern (rules/viewing.js)
// and the panel (js/core/panels.js). M4's skeleton made each function with its signature;
// W0d1 filled them and moved `read` here. Frozen after M4's Wave 0.
//
// A reader, fn(state, f) → {text, effects} or a refusal code, only reads: it changes nothing
// and emits nothing. text is what reading shows (a string, or null); effects(state, ev), or
// null, is what reading does, which the read action runs. Every read is free (Actions.free)
// and within reach: READ_RANGE (a disc, "within r", §8.2) and in your line of sight. A reader
// gives its own refusals first; a fixture it would let you read from out of reach is refused
// label_far here, so no reader can be read from farther.
'use strict';
const Fixtures = (() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const readers = {};

  // Fixtures.addReader(k, fn): kind k's reader, once a kind.
  function addReader(k, fn) {
    if (typeof k !== 'string' || !k) throw new Error('Fixtures.addReader: a reader needs a fixture kind');
    if (own(readers, k)) throw new Error(`Fixtures.addReader: the kind ${k} has a reader already`);
    if (typeof fn !== 'function') throw new Error(`Fixtures.addReader: the reader of ${k} is not a function`);
    readers[k] = fn;
  }
  // Is fixture f of a kind that is read?
  const readable = f => !!f && own(readers, f.k);
  // The readable fixtures of the department, in fixture order (§4.1).
  const all = state => ((state.dept && state.dept.fixtures) || []).filter(readable);

  // Fixtures.at(state, x, y): the readable fixture at (x, y), the first in fixture order, or null.
  function at(state, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    for (const f of all(state)) if (f.x === x && f.y === y) return f;
    return null;
  }

  // Is (x, y) within your reach to read (READ_RANGE, a disc, and in your line of sight)?
  function reach(state, x, y) {
    const you = state.actors[0];
    return Grid.disc(x - you.x, y - you.y, N.READ_RANGE) && Grid.los(state.dept, you.x, you.y, x, y) ? null : 'label_far';
  }

  // Fixtures.read(state, f): read fixture f with its kind's reader: {text, effects}, or a
  // refusal code (label_none for a kind with no reader; label_far out of reach).
  function read(state, f) {
    if (!readable(f)) return 'label_none';
    const r = readers[f.k](state, f);
    if (typeof r === 'string') return r;
    if (!r || typeof r !== 'object' || (r.effects !== null && r.effects !== undefined && typeof r.effects !== 'function')) {
      throw new Error(`Fixtures: the reader of ${f.k} gave ${JSON.stringify(r)}, not {text, effects} or a refusal code`);
    }
    return reach(state, f.x, f.y) || { text: typeof r.text === 'string' ? r.text : null, effects: r.effects || null };
  }

  // read(x, y) (§4.2): read the fixture at (x, y), at no cost in time. Refused label_none
  // where nothing readable is, and as its reader or its reach says. Candidates: your tile and
  // its 8 neighbours, every readable fixture, and a bare read.
  Actions.define('read', {
    legal: state => all(state).filter(f => typeof read(state, f) !== 'string').map(f => ({ a: 'read', x: f.x, y: f.y })),
    candidates(state) {
      const you = state.actors[0], out = [{ a: 'read', x: you.x, y: you.y }];
      for (let d = 0; d < 8; d++) out.push({ a: 'read', x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] });
      for (const f of all(state)) out.push({ a: 'read', x: f.x, y: f.y });
      return out.concat([{ a: 'read' }]);
    },
    apply(state, action, ev) {
      const f = at(state, action.x, action.y);
      if (!f) return 'label_none';
      const r = read(state, f);
      if (typeof r === 'string') return r;
      if (r.effects) r.effects(state, ev);
      return 0;
    },
  });

  return { addReader, read, at, reach };
})();
