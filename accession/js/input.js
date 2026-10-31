// ACCESSION — input: taps, clicks and keys become intents (BUILD.md §7.1). Each works alone:
// a tap or a left click is resolved to a tile by the active renderer, and main.js decides what
// it means; every control off the board is a button that a tap, a click or the keyboard
// presses. Keys: arrows, vi-keys or numpad move (or, while aiming, move the aim); Enter does
// the selected thing's first action, or confirms; Escape cancels; Tab moves the focus; every
// other key is main.js's (its table is in §7.1 and in "How the museum works"). While a layer
// is open (a confirmation, a sheet, an overlay) the keys go to it alone.
'use strict';
const Input = (() => {
  const KEYS = { ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6, k: 0, l: 2, j: 4, h: 6, y: 7, u: 1, b: 5, n: 3,
    Numpad8: 0, Numpad9: 1, Numpad6: 2, Numpad3: 3, Numpad2: 4, Numpad1: 5, Numpad4: 6, Numpad7: 7 };
  // The direction a key steps in, or −1. The numpad moves whether NumLock is on (key '1'–'9')
  // or off (arrows).
  function dirOf(e) {
    if (e.code && e.code.startsWith('Numpad') && e.code in KEYS) return KEYS[e.code];
    return Object.prototype.hasOwnProperty.call(KEYS, e.key) && !e.code.startsWith('Numpad') ? KEYS[e.key] : -1;
  }
  function attach(board, getRenderer, on) {
    board.addEventListener('pointerup', e => {
      if (e.button !== 0) return;
      const t = getRenderer().pick(e.clientX, e.clientY);
      if (t) on.tap(t);
    });
    // A finger's tap is done at pointerup. The browser would then send the same tap again as
    // mouse events and a click, aimed at whatever lies under the finger by then: a sheet the
    // tap has just opened (a confirmation, a label), whose button or backdrop would answer it
    // at once. So a touch that began on the board ends there.
    board.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    board.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Once a key is used, the buttons show their keys on a touch screen too (CSS).
      document.documentElement.classList.add('keys');
      if (e.key === 'Escape') { on.escape(); e.preventDefault(); return; }
      // A held Enter or Space answers nothing more: each confirmation asks for a press of its
      // own, so key repeat cannot ask and answer, then ask and answer again.
      if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; }
      // Enter or Space on a focused button presses it; Tab moves the focus, which stays inside
      // an open layer (ui.js makes the rest inert).
      const control = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
      if ((e.key === 'Enter' || e.key === ' ') && control) return;
      if (e.key === 'Tab') return;
      // Otherwise Enter confirms what waits for it (a confirmation, a previewed aim or walk, the
      // selected thing's first action).
      if (e.key === 'Enter') { on.confirm(); e.preventDefault(); return; }
      // While a layer covers the board, keys go to it alone and do nothing to the game.
      if (on.blocked()) { if (on.layerKey(e)) e.preventDefault(); return; }
      const d = dirOf(e);
      if (d >= 0) { on.move(d); e.preventDefault(); return; }
      const k = e.code === 'Numpad5' || e.code === 'NumpadDecimal' ? '.' : e.key;
      if (on.key(k)) e.preventDefault();
    });
  }
  return { attach };
})();
