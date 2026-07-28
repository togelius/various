/* VANGUARD ZERO - on-screen controls for touch devices.
 * Feeds the same virtual action map the keyboard and gamepad paths use.
 */
(function (global) {
  'use strict';
  var VZ = global.VZ || (global.VZ = {});

  function bind() {
    var root = document.getElementById('touch');
    if (!root) return;
    var buttons = root.querySelectorAll('button');
    var active = {};   // pointerId -> action

    function set(act, on, btn) {
      VZ.input.virtual[act] = on;
      if (btn) btn.classList.toggle('pressed', !!on);
    }

    Array.prototype.forEach.call(buttons, function (btn) {
      var act = btn.getAttribute('data-act');
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        VZ.audio.resume();
        active[e.pointerId] = { act: act, btn: btn };
        set(act, true, btn);
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      var release = function (e) {
        var a = active[e.pointerId];
        if (a) { set(a.act, false, a.btn); delete active[e.pointerId]; }
        else set(act, false, btn);
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    // A tap anywhere on the canvas doubles as START on menus.
    var screen = document.getElementById('screen');
    if (screen) {
      screen.addEventListener('pointerdown', function (e) {
        VZ.audio.resume();
        var g = VZ.game;
        if (!g) return;
        if (g.state === 'title' || g.state === 'gameOver' || g.state === 'results' ||
            g.state === 'stageIntro') {
          VZ.input.virtual.jump = true;
          setTimeout(function () { VZ.input.virtual.jump = false; }, 90);
        }
        e.preventDefault();
      });
    }

    // Prevent rubber-band scrolling while playing.
    document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else bind();

})(typeof window !== 'undefined' ? window : globalThis);
