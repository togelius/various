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
  function dirOf(key, code) {
    if (code && code.startsWith('Numpad') && code in KEYS) return KEYS[code];
    return Object.prototype.hasOwnProperty.call(KEYS, key) && !(code || '').startsWith('Numpad') ? KEYS[key] : -1;
  }
  // A press on the board is a tap only where it lifts within SLOP CSS pixels of where it went
  // down: a swipe or a drag across the board is no tap, so it never walks you, or strikes, at
  // the tile where the finger or the button happens to lift.
  const SLOP = 16;
  // The keys that scroll a box that scrolls by the keys (the laptop's log, data-scrolls) while
  // it has the focus: they scroll it, as in any box, and never step.
  const SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
  // The input in use, the last one used: 'keys' or 'pointer' (a tap or a click, one input,
  // §7.1), as <html data-input>, so words that say what to do can say it for that input.
  const using = () => document.documentElement.dataset.input || 'pointer';
  function attach(board, getRenderer, on) {
    window.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; }, true);
    let press = null;
    board.addEventListener('pointerdown', e => { press = e.button === 0 && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null; });
    board.addEventListener('pointercancel', () => { press = null; });
    board.addEventListener('pointerup', e => {
      const p = press;
      press = null;
      if (e.button !== 0 || !p || p.id !== e.pointerId || Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) return;
      const t = getRenderer().pick(e.clientX, e.clientY);
      if (t) on.tap(t);
    });
    // A finger's tap is done at pointerup. The browser would then send the same tap again as
    // mouse events and a click, aimed at whatever lies under the finger by then: a sheet the
    // tap has just opened (a confirmation, a label), whose button or backdrop would answer it
    // at once. So a touch that began on the board ends there.
    board.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    board.addEventListener('contextmenu', e => e.preventDefault());
    // A held key acts in the layer it went down in. Once another layer opens (the confirmation
    // its step asked for, the end of a visit), its repeats are dropped: a held arrow cannot
    // move the focus off the confirmation's yes, so the Enter that follows still answers yes,
    // and a held Escape closes one layer, not each in turn.
    const downIn = new Map();
    window.addEventListener('keyup', e => downIn.delete(e.code || e.key));
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Once a key is used, the buttons show their keys on a touch screen too (CSS).
      document.documentElement.classList.add('keys');
      if (!['Shift', 'CapsLock'].includes(e.key)) document.documentElement.dataset.input = 'keys';
      const id = e.code || e.key, layer = on.layer();
      if (!e.repeat) downIn.set(id, layer);
      else if (downIn.has(id) && downIn.get(id) !== layer) { e.preventDefault(); return; }
      // Caps Lock changes nothing: a letter is read as it would be with it off (so x is still
      // x, and Shift+X still X).
      const caps = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock') && /^[A-Za-z]$/.test(e.key);
      const key = caps ? (e.key === e.key.toLowerCase() ? e.key.toUpperCase() : e.key.toLowerCase()) : e.key;
      const ev = key === e.key ? e : { key, code: e.code, repeat: e.repeat, shiftKey: e.shiftKey, target: e.target, preventDefault: () => e.preventDefault() };
      if (key === 'Escape') { on.escape(); e.preventDefault(); return; }
      // A held Enter or Space answers nothing more: each confirmation asks for a press of its
      // own, so key repeat cannot ask and answer, then ask and answer again.
      if (e.repeat && (key === 'Enter' || key === ' ')) { e.preventDefault(); return; }
      // A box that scrolls by the keys, focused, scrolls by them (the browser's own scrolling).
      if (e.target && e.target.matches && e.target.matches('[data-scrolls]') && SCROLL.has(key)) return;
      // Enter or Space on a focused button presses it; Tab moves the focus, which stays inside
      // an open layer (ui.js makes the rest inert).
      const control = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
      if ((key === 'Enter' || key === ' ') && control) return;
      if (key === 'Tab') return;
      // Otherwise Enter confirms what waits for it (a confirmation, a previewed aim or walk, the
      // selected thing's first action).
      if (key === 'Enter') { on.confirm(); e.preventDefault(); return; }
      // While a layer covers the board, keys go to it alone and do nothing to the game.
      if (on.blocked()) { if (on.layerKey(ev)) e.preventDefault(); return; }
      const d = dirOf(key, e.code);
      if (d >= 0) { on.move(d); e.preventDefault(); return; }
      const k = e.code === 'Numpad5' || e.code === 'NumpadDecimal' ? '.' : key;
      if (on.key(k)) e.preventDefault();
    });
  }
  return { attach, using };
})();
