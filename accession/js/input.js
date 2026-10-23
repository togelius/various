// ACCESSION — input: one button and optional keys become intents (BUILD.md §7.1). A tap
// is resolved to a tile by the active renderer; main.js decides what the tap means.
'use strict';
const Input = (() => {
  const KEYS = { ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6, k: 0, l: 2, j: 4, h: 6, y: 7, u: 1, b: 5, n: 3,
    Numpad8: 0, Numpad9: 1, Numpad6: 2, Numpad3: 3, Numpad2: 4, Numpad1: 5, Numpad4: 6, Numpad7: 7 };
  function attach(board, getRenderer, on) {
    board.addEventListener('pointerup', e => {
      if (e.button !== 0) return;
      const t = getRenderer().pick(e.clientX, e.clientY);
      if (t) on.tap(t);
    });
    board.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === '.' || e.code === 'Numpad5') { on.key({ a: 'wait' }); e.preventDefault(); return; }
      if (e.key === 'x') { on.examine(); e.preventDefault(); return; }
      if (e.key === 'Escape') { on.escape(); return; }
      const d = e.key in KEYS ? KEYS[e.key] : e.code in KEYS ? KEYS[e.code] : -1;
      if (d >= 0) { on.key({ a: 'move', dir: d }); e.preventDefault(); }
    });
  }
  return { attach };
})();
