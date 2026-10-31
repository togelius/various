// ACCESSION — the Orientation's teacher (BUILD.md §7.2, §8.9): its seven steps, each one
// sentence in three forms (taps, clicks and keys), what each step waits for, and what it
// points at. It is pure: it reads the view model and the events of a step, keeps what it has
// seen in a memory of its own, and never touches the state, the page or the clock, so the
// Node tests run it as the page does (js/ui/coach.js draws it; main.js feeds it).
//
// What it has seen (SEEN) is a list of things that, once true, stay true: you moved; you read
// the exhibit's label (it is the selection); a pip filled on it; it woke; it fell; you took
// what the case held; you left by the exit. A step is done when its goal has been met, now or
// earlier, or can no longer be met (a fallen exhibit's label cannot be read), so the steps
// hold in any order: a step whose goal is already met is passed at once. It also keeps one
// thing as it is now (NOW): whether the case is still shut, since the case's sentence names
// Open only while there is something to open.
//
// Every sentence is true in every order of play: the exhibit's own sentences call it "the
// sleeper" only in the steps that show while it sleeps (the ring's and the pips'), and
// "Three pips", "10 turns" and "a hit wakes a sleeper" are §8.2's (PIPS_TO_WAKE,
// PIP_DECAY_TURNS, damage waking straight to hunting); the room has no clock, so pips fade at
// every turn of it. test/orientation.test.js holds each to the numbers of record and to play.
// The keys are §7.1's. Before any input on a screen whose pointer is fine (a laptop), the
// coach does not know whether you will click or press keys, so the first step, the only one
// that can show before any input, has a fourth form, `either`, that says both.
'use strict';
const Teacher = (() => {
  const FORMS = ['touch', 'mouse', 'keys'];
  // The words each input uses for the same thing: a tap, a click, a key.
  const STEPS = [
    { id: 'move', point: null, done: s => s.moved, say: {
      touch: 'Tap a tile to walk there.',
      mouse: 'Click a tile to walk there.',
      keys: 'Press an arrow key, or h j k l y u b n, to take a step.',
      either: 'Click a tile to walk there, or press an arrow key to take a step.' } },
    { id: 'examine', point: 'sleeper', done: s => s.examined || s.beaten, say: {
      touch: 'Tap the exhibit to read its label, which says exactly what it does.',
      mouse: 'Click the exhibit to read its label, which says exactly what it does.',
      keys: 'Press x until the exhibit\'s label opens: it says exactly what the exhibit does.' } },
    { id: 'ring', point: 'sleeper', done: s => s.pip || s.woke || s.beaten, say: {
      touch: 'The ring round you shows what counts as close: tap tiles nearer the sleeper until it is inside, and watch a pip fill.',
      mouse: 'The ring round you shows what counts as close: click tiles nearer the sleeper until it is inside, and watch a pip fill.',
      keys: 'The ring round you shows what counts as close: step nearer the sleeper until it is inside, and watch a pip fill.' } },
    { id: 'pips', point: 'sleeper', done: s => s.woke || s.beaten, say: {
      touch: 'Tap nearer: it gains a pip each turn inside your ring, three pips wake it, and one fades every 10 turns it gains none.',
      mouse: 'Click nearer: it gains a pip each turn inside your ring, three pips wake it, and one fades every 10 turns it gains none.',
      keys: 'Step nearer: it gains a pip each turn inside your ring, three pips wake it, and one fades every 10 turns it gains none.' } },
    { id: 'bump', point: 'sleeper', done: s => s.beaten, say: {
      touch: 'Beside it, tap it twice to strike, until it falls: a hit wakes a sleeper at once, hunting.',
      mouse: 'Beside it, click it twice to strike, until it falls: a hit wakes a sleeper at once, hunting.',
      keys: 'Walk into it with a step key to strike, until it falls: a hit wakes a sleeper at once, hunting.' } },
    // While the case is shut, Open, then Take; once it is open or broken, Take alone.
    { id: 'case', point: 'case', done: s => s.took, say: {
      touch: 'Beside the case, tap it, then Open, then Take: what you take goes into your Bag.',
      mouse: 'Beside the case, click it, then Open, then Take: what you take goes into your Bag.',
      keys: 'Beside the case, press x until it is selected, o to open it and t to take what it holds: it goes into your Bag (i).' },
    opened: {
      touch: 'Beside the case, tap it, then Take: what you take goes into your Bag.',
      mouse: 'Beside the case, click it, then Take: what you take goes into your Bag.',
      keys: 'Beside the case, press x until it is selected and t to take what it holds: it goes into your Bag (i).' } },
    { id: 'leave', point: 'exit', done: s => s.left, say: {
      touch: 'Tap the exit door to walk there, then tap yourself and Leave.',
      mouse: 'Click the exit door to walk there, then click yourself and Leave.',
      keys: 'Press x until the exit is selected, Enter to walk there, then > and Enter to leave.' } },
  ];

  // What can be seen, each from the view model and the events of one step (f: the room's
  // facts, Orientation.facts()). Each is checked on every look, and kept once true.
  const mine = (ev, k, f) => ev.some(e => e.k === k && e.who === f.sleeper);
  const sleeper = (vm, f) => vm.actors.find(a => a.uid === f.sleeper) || null;
  const SEEN = {
    moved: (vm, ev, f) => ev.some(e => e.k === 'moved' && e.who === 'you') || vm.you.x !== f.start[0] || vm.you.y !== f.start[1],
    examined: (vm, ev, f) => vm.selection === f.sleeper,
    pip: (vm, ev, f) => mine(ev, 'pip', f) || (() => { const a = sleeper(vm, f); return !!a && a.mode === 'dormant' && a.pips > 0; })(),
    woke: (vm, ev, f) => mine(ev, 'woke', f) || (() => { const a = sleeper(vm, f); return !!a && a.mode !== 'dormant'; })(),
    beaten: (vm, ev, f) => mine(ev, 'died', f),
    took: (vm, ev, f) => ev.some(e => e.k === 'took' && e.item === f.item) || vm.you.tote.includes(f.item) ||
      [vm.you.kit.weapon, vm.you.kit.garment, vm.you.kit.instrument].concat(vm.you.kit.curio).includes(f.item),
    left: (vm, ev) => (!!vm.over && vm.over.k === 'left') || ev.some(e => e.k === 'left' && e.who === 'you'),
  };

  // What is so now, from the view model of one look, or the value kept from the last look
  // where this one does not show it: the case still shut (shown as Cases.view shows it).
  const NOW = {
    shut: (vm, f, was) => { const c = vm.cases.find(q => q.x === f.case[0] && q.y === f.case[1]); return c ? c.st === 'shut' : was; },
  };

  // A new memory: the facts, nothing seen yet, and the case shut, as the room is made.
  function start(facts) {
    const seen = {};
    for (const k of Object.keys(SEEN)) seen[k] = false;
    return { facts: JSON.parse(JSON.stringify(facts)), seen, now: { shut: true } };
  }
  // observe(memory, vm, events) → a new memory, with what this look shows added; the memory
  // given, the view model and the events are only read.
  function observe(mem, vm, events) {
    const ev = events || [], seen = Object.assign({}, mem.seen), now = {};
    for (const k of Object.keys(SEEN)) if (!seen[k] && SEEN[k](vm, ev, mem.facts)) seen[k] = true;
    for (const k of Object.keys(NOW)) now[k] = NOW[k](vm, mem.facts, mem.now[k]);
    return { facts: mem.facts, seen, now };
  }
  // The step now: the first whose goal is not met (0 to 6), or STEPS.length once all are.
  function step(mem) {
    for (let i = 0; i < STEPS.length; i++) if (!STEPS[i].done(mem.seen)) return i;
    return STEPS.length;
  }
  // Step i's sentence in the words of an input ('touch', 'mouse' or 'keys'; 'either' before
  // any input on a laptop, which only the first step has, the others giving the mouse's), as
  // it is true now (mem: the case's step names Open only while the case is shut; without a
  // memory, the room as it is made).
  function sentence(i, form, mem) {
    const s = STEPS[i];
    if (!s) return '';
    const say = s.opened && mem && mem.now && !mem.now.shut ? s.opened : s.say;
    if (form === 'either') return say.either || say.mouse;
    return say[FORMS.includes(form) ? form : 'mouse'];
  }
  // What the step now points at, for the view model's ui.coach: the sleeper (by its uid), the
  // case's tile or the exit's tile; null for none.
  function target(mem) {
    const s = STEPS[step(mem)], f = mem.facts;
    if (!s || !s.point) return null;
    if (s.point === 'sleeper') return { uid: f.sleeper };
    const t = s.point === 'case' ? f.case : f.exit;
    return { x: t[0], y: t[1] };
  }

  return { FORMS, STEPS, SEEN, NOW, start, observe, step, sentence, target };
})();
