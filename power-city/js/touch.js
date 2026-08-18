/* POWER CITY - on-screen controls for phones and tablets.
 * The pad only exists on coarse pointers; on a desktop it never renders.
 */
(function (global) {
  'use strict';
  var PC = global.PC || (global.PC = {});

  var state = { held: {} };
  PC.input.touch = state;

  function bind() {
    var root = document.getElementById('touch');
    if (!root) return;
    var btns = root.querySelectorAll('button');
    var active = {};

    function set(act, on) { state.held[act] = on; }

    function pointFrom(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      return el && el.dataset && el.dataset.act ? el.dataset.act : null;
    }

    function refresh() {
      var k;
      for (k in state.held) state.held[k] = false;
      for (k in active) if (active[k]) state.held[active[k]] = true;
    }

    root.addEventListener('pointerdown', function (e) {
      var act = pointFrom(e);
      if (!act) return;
      e.preventDefault();
      active[e.pointerId] = act;
      refresh();
      if (PC.audio) PC.audio.resume();
    });
    root.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in active)) return;
      e.preventDefault();
      active[e.pointerId] = pointFrom(e);
      refresh();
    });
    function up(e) {
      if (!(e.pointerId in active)) return;
      delete active[e.pointerId];
      refresh();
    }
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Start / coin live on the pad too, so a phone can put a coin in.
    var start = document.getElementById('touch-start');
    if (start) {
      start.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        PC.input._edge.Enter = true;
        PC.input._down.Enter = true;
        PC.input._latch.Enter = true;
        setTimeout(function () { PC.input._down.Enter = false; }, 60);
      });
    }
    void btns;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

})(typeof window !== 'undefined' ? window : globalThis);
