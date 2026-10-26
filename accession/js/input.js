// ACCESSION — input: one button and optional keys become intents (BUILD.md §7.1). A tap
// is resolved to a tile by the active renderer; main.js decides what the tap means. Keys:
// arrows, vi-keys or numpad move; . waits; x examines; r reads; Enter confirms; Escape
// cancels; i opens the Bag, m the floor plan, and 1–6 use the quickslots.
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { on.escape(); return; }
      // Enter on a focused button presses it; otherwise it confirms what waits for it (a
      // confirmation, a previewed walk, the selected thing's first action).
      if (e.key === 'Enter') { if (e.target && e.target.tagName === 'BUTTON') return; on.confirm(); e.preventDefault(); return; }
      // While an overlay or a confirmation covers the board, keys do nothing to the game.
      if (on.blocked()) return;
      // The numpad moves whether NumLock is on (key '1'–'9') or off (arrows).
      if (e.code && e.code.startsWith('Numpad') && e.code in KEYS) { on.key({ a: 'move', dir: KEYS[e.code] }); e.preventDefault(); return; }
      if (e.key === '.' || e.code === 'Numpad5' || e.code === 'NumpadDecimal') { on.key({ a: 'wait' }); e.preventDefault(); return; }
      if (e.key === 'x') { on.examine(); e.preventDefault(); return; }
      if (e.key === 'r') { on.read(); e.preventDefault(); return; }
      if (e.key === 'i') { on.bag(); e.preventDefault(); return; }
      if (e.key === 'm') { on.map(); e.preventDefault(); return; }
      if (/^[1-6]$/.test(e.key)) { on.quick(Number(e.key)); e.preventDefault(); return; }
      const d = e.key in KEYS ? KEYS[e.key] : -1;
      if (d >= 0) { on.key({ a: 'move', dir: d }); e.preventDefault(); }
    });
  }
  return { attach };
})();
