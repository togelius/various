/* POWER CITY - pointer controls.
 *
 * Any element in the page carrying data-act ("punch", "left", ...) becomes a
 * button you can press with a finger or a mouse: the phone pad, and equally
 * the control panel an embedding page might draw around the cabinet. That
 * matters more than it sounds - an embedded frame does not always get the
 * keyboard, and a game you cannot reach is not a game.
 *
 * data-key elements ("Digit5", "Enter") synthesise a key edge instead, for
 * the coin slot and the start button.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});

  var state = { held: {} };
  PC.input.touch = state;

  function bind() {
    var active = {};          // pointerId -> action

    function actAt(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !el.closest) return null;
      var hit = el.closest('[data-act]');
      return hit ? hit.getAttribute('data-act') : null;
    }

    function refresh() {
      var k;
      for (k in state.held) state.held[k] = false;
      for (k in active) if (active[k]) state.held[active[k]] = true;
    }

    document.addEventListener('pointerdown', function (e) {
      if (PC.audio) PC.audio.resume();
      var keyEl = e.target && e.target.closest && e.target.closest('[data-key]');
      if (keyEl) {
        e.preventDefault();
        tapKey(keyEl.getAttribute('data-key'));
        return;
      }
      var act = actAt(e);
      if (!act) return;
      e.preventDefault();
      active[e.pointerId] = act;
      refresh();
    });

    // Sliding off one button and onto another keeps working, which is how
    // anyone actually plays with a thumb.
    document.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in active)) return;
      e.preventDefault();
      active[e.pointerId] = actAt(e);
      refresh();
    });

    function release(e) {
      if (!(e.pointerId in active)) return;
      delete active[e.pointerId];
      refresh();
    }
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    document.addEventListener('lostpointercapture', release);
    global.addEventListener('blur', function () { active = {}; refresh(); });

    var touchRoot = document.getElementById('touch');
    if (touchRoot) touchRoot.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* Hold a synthetic key down long enough for one poll to see the edge. */
  function tapKey(code) {
    if (!code) return;
    PC.input._edge[code] = true;
    PC.input._down[code] = true;
    PC.input._latch[code] = true;
    global.setTimeout(function () { PC.input._down[code] = false; }, 90);
  }
  PC.tapKey = tapKey;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

})(typeof window !== 'undefined' ? window : globalThis);
