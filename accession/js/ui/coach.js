// ACCESSION — the Orientation's coach (BUILD.md §7.2, §8.9): a line of its own at the foot of
// the top bar, so it never lies over the board, holding the step count ("2 of 7"), the step's
// one sentence and Skip. The sentence stays there until its step is done, in the words of
// the input you used last: a touch or a pen's taps, a mouse's clicks (pointerType), or the
// keys (any key but a modifier). Before any input, a screen whose main pointer is coarse (a
// phone, a tablet) gets taps, and any other (a laptop, whose player may click or press keys)
// gets the first step's sentence for both, the teacher's `either`; until then it follows the
// screen if that changes. The view model frames what the step points at (ui.coach, from point()). A
// screen reader hears each new sentence through the label panel's live region (#sheet), the
// page's one, where it is put out of sight. "How the museum works" gains Practice room,
// which plays the Orientation again.
//
// The coach only reads: main.js gives it each view model it draws and the events of the
// last step; the teacher (js/ui/teacher.js) decides the step. Whether the Orientation starts
// when the page loads: ?orient=1 or ?orient=0 decide (the checks say which they want); else
// it starts until it has been finished or skipped once, which localStorage remembers
// ('accession.orientation' = 'seen'; every access in try/catch, so a browser that keeps
// nothing simply offers it each time).
'use strict';
const Coach = (() => {
  const KEY = 'accession.orientation';
  const flag = {
    get() { try { return localStorage.getItem(KEY) === 'seen'; } catch (e) { return false; } },
    set() { try { localStorage.setItem(KEY, 'seen'); } catch (e) { /* nothing to remember it in */ } },
  };
  let el = null, hooks = {}, on = false, mem = null, form = null, used = false, shown = null, flashed = null;

  // Does the Orientation start when the page loads? params: the page's URLSearchParams.
  function first(params) {
    const p = params.get('orient');
    return p === '1' ? true : p === '0' ? false : !flag.get();
  }

  // The coach's line goes at the end of the top bar (top); Practice room into "How the museum
  // works"'s heading (how), beside its Close. h: {skip(), practice()}, main.js's.
  function attach(top, how, h) {
    hooks = h;
    el = document.createElement('div');
    el.id = 'coach';
    el.hidden = true;
    el.innerHTML = '<span class="coach-n"></span><p class="coach-say"></p><button class="btn coach-skip" data-coach-skip>Skip</button>';
    top.appendChild(el);
    el.querySelector('[data-coach-skip]').addEventListener('click', () => hooks.skip());
    const btns = how.querySelector('.ohead-btns');
    if (btns) {
      btns.insertAdjacentHTML('afterbegin', '<button class="btn" data-practice>Practice room</button>');
      btns.querySelector('[data-practice]').addEventListener('click', () => hooks.practice());
    }
    // The input used last chooses the sentence's words; before any, the screen's pointer.
    const coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
    const guess = () => (coarse && coarse.matches ? 'touch' : 'either');
    form = guess();
    if (coarse && typeof coarse.addEventListener === 'function') coarse.addEventListener('change', () => { if (!used) use(guess()); });
    window.addEventListener('pointerdown', e => { used = true; use(e.pointerType === 'mouse' ? 'mouse' : 'touch'); }, true);
    window.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey || MODIFIERS.includes(e.key)) return;
      used = true; use('keys');
    }, true);
  }
  const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
  // A new input's words are the sentence shown now, so the live region says them too, once
  // the event that brought them has been handled (main.js may draw the label panel for it,
  // and with it the live region, first).
  function use(f) { if (f !== form) { form = f; render(); setTimeout(() => render(true), 0); } }

  // The Orientation starts (from its first step) or ends; ended after it was finished or
  // skipped (seen), it is not offered again when the page loads.
  function begin() { on = true; mem = Teacher.start(Orientation.facts()); shown = null; flashed = null; render(); }
  function end(seen) { if (on && seen) flag.set(); on = false; mem = null; shown = null; flashed = null; render(); }
  const active = () => on;
  // What the step points at, for the view model (ui.coach), or null.
  const point = () => (on ? Teacher.target(mem) : null);
  // A look at what main.js draws: the view model and the last step's events. True when the step
  // changed, so main.js draws its pointer at once.
  function see(vm, events) {
    if (!on) return false;
    const was = Teacher.step(mem);
    mem = Teacher.observe(mem, vm, events);
    render(true);
    return Teacher.step(mem) !== was;
  }

  // The line: the step count, the sentence, Skip; hidden when the Orientation is not running.
  // A new step's sentence flashes once (not with reduced motion: css/coach.css). With say, a
  // sentence not yet said goes to the live region (#sheet) too, out of sight; see() says it,
  // after main.js has drawn the label panel for the action, so a label opened or closed then
  // never takes it away unheard.
  function render(say) {
    if (!el) return;
    el.hidden = !on;
    if (!on) {
      el.querySelector('.coach-say').textContent = '';
      const said = document.querySelector('#sheet .coach-said');
      if (said) said.remove();
      return;
    }
    const i = Teacher.step(mem), n = Teacher.STEPS.length, text = Teacher.sentence(i, form, mem), line = el.querySelector('.coach-say');
    el.querySelector('.coach-n').textContent = `${Math.min(i + 1, n)} of ${n}`;
    if (line.textContent !== text) line.textContent = text;
    if (i !== flashed) { flashed = i; el.classList.remove('new'); void el.offsetWidth; el.classList.add('new'); }
    const sheet = document.getElementById('sheet'), now = `Practice room, step ${Math.min(i + 1, n)} of ${n}: ${text}`;
    if (!say || !sheet || now === shown) return;
    shown = now;
    const old = sheet.querySelector('.coach-said');
    if (old) old.remove();
    const p = document.createElement('p');
    p.className = 'sr coach-said';
    p.textContent = now;
    sheet.appendChild(p);
  }

  // For the checks: whether it runs, the step (0–6, 7 once all are done), its id, the input
  // whose words are shown ('either' before any input on a laptop), the sentence shown, and
  // what the teacher holds to be so now (whether the case is shut).
  function status() {
    const i = on ? Teacher.step(mem) : null;
    return { on, step: i, id: on && Teacher.STEPS[i] ? Teacher.STEPS[i].id : null, form, text: el ? el.querySelector('.coach-say').textContent : '', seen: flag.get(),
      now: on ? Object.assign({}, mem.now) : null };
  }

  return { first, attach, begin, end, active, point, see, status };
})();
