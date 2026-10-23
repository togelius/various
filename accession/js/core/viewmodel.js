// ACCESSION — the view model: a plain description of what to draw, derived from the state
// (BUILD.md §6.1). Both board views read this and nothing else, and bots see only this.
'use strict';
const ViewModel = (() => {
  function derive(state, ui) {
    ui = ui || {};
    const m = state.dept, you = state.actors[0], n = m.w * m.h;
    const now = Vision.visible(state), vis = new Uint8Array(n);
    for (let i = 0; i < n; i++) vis[i] = now[i] ? 2 : (m.seen && m.seen.charCodeAt(i) === 49 ? 1 : 0);
    const ring = Vision.ring(state);
    const actors = [];
    for (const a of state.actors) {
      if (a.gone) continue;
      const size = a.size || 1;
      let seen = false;
      for (let dy = 0; dy < size && !seen; dy++) for (let dx = 0; dx < size; dx++) if (now[(a.y + dy) * m.w + a.x + dx]) { seen = true; break; }
      if (!seen && a.uid !== 'you') continue;
      const sp = a.uid === 'you' ? null : Labels.speciesOf(state, a);
      actors.push({ uid: a.uid, sprite: a.uid === 'you' ? 'visitor' : (sp ? sp.sprite : 'seated_clerk'), x: a.x, y: a.y, size,
        mode: a.uid === 'you' ? 'you' : a.mode, pips: a.pips || 0, hostile: a.uid !== 'you', hp: a.hp, maxHp: a.maxHp });
    }
    const pack = typeof Packs !== 'undefined' ? Packs.get(m.acc) : null;
    const clock = m.ltour ? Object.assign({ turn: state.turn }, Clock.budget(m.ltour)) : null;
    return {
      dept: pack ? pack.palette : 'T0', w: m.w, h: m.h, tiles: m.tiles, vis, ring, actors, marks: [],
      you: { x: you.x, y: you.y, hp: you.hp, maxHp: you.maxHp, grade: you.grade || 1 }, turn: state.turn, over: state.over,
      camera: { x: you.x, y: you.y }, clock, path: ui.path || null, selection: ui.selection || null, selectedTile: ui.selectedTile || null,
    };
  }
  return { derive };
})();
