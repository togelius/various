// ACCESSION — the Orientation's teacher (BUILD.md §7.2, §8.9): its seven steps, each one
// sentence in three forms (taps, clicks and keys), what each step waits for, and what it
// points at. It is pure: it reads the view model and the events of a step, keeps what it has
// seen in a memory of its own, and never touches the state, the page or the clock, so the
// Node tests run it as the page does (js/ui/coach.js draws it; main.js feeds it).
//
// What it has seen (SEEN) is a list of things that, once true, stay true: you moved; you read
// the sleeper's label (it is the selection); a pip filled on it; it woke; it fell; you took
// what the case held; you left by the exit. A step is done when its goal has been met, now or
// earlier, or can no longer be met (a fallen exhibit's label cannot be read), so the steps
// hold in any order: a step whose goal is already met is passed at once.
//
// Every sentence is true of the rules: "Three pips", "10 turns" and "a hit wakes a sleeper"
// are §8.2's (PIPS_TO_WAKE, PIP_DECAY_TURNS, damage waking straight to hunting), and the room
// has no clock, so pips fade at every turn of it; test/orientation.test.js holds each to the
// numbers of record and to play. The keys are §7.1's.
'use strict';
const Teacher = (() => {
  const FORMS = ['touch', 'mouse', 'keys'];
  // The words each input uses for the same thing: a tap, a click, a key.
  const STEPS = [
    { id: 'move', point: null, done: s => s.moved, say: {
      touch: 'Tap a tile to walk there.',
      mouse: 'Click a tile to walk there.',
      keys: 'Press an arrow key, or h j k l y u b n, to take a step.' } },
    { id: 'examine', point: 'sleeper', done: s => s.examined || s.beaten, say: {
      touch: 'Tap the sleeping exhibit to read its label, which says exactly what the exhibit does.',
      mouse: 'Click the sleeping exhibit to read its label, which says exactly what the exhibit does.',
      keys: 'Press x until the sleeping exhibit is selected, and read its label, which says exactly what the exhibit does.' } },
    { id: 'ring', point: 'sleeper', done: s => s.pip || s.woke || s.beaten, say: {
      touch: 'The ring round you shows what counts as close: tap tiles nearer the sleeper until it is inside, and watch a pip fill.',
      mouse: 'The ring round you shows what counts as close: click tiles nearer the sleeper until it is inside, and watch a pip fill.',
      keys: 'The ring round you shows what counts as close: step nearer the sleeper with the arrows until it is inside, and watch a pip fill.' } },
    { id: 'pips', point: 'sleeper', done: s => s.woke || s.beaten, say: {
      touch: 'Three pips wake it: it gains one each turn it is inside your ring and loses one for every 10 turns it gains none, so tap nearer until it wakes.',
      mouse: 'Three pips wake it: it gains one each turn it is inside your ring and loses one for every 10 turns it gains none, so click nearer until it wakes.',
      keys: 'Three pips wake it: it gains one each turn it is inside your ring and loses one for every 10 turns it gains none, so step nearer until it wakes.' } },
    { id: 'bump', point: 'sleeper', done: s => s.beaten, say: {
      touch: 'Beside it, tap it, then tap it again to strike: a hit wakes a sleeper at once, hunting, so strike until it falls.',
      mouse: 'Beside it, click it, then click it again to strike: a hit wakes a sleeper at once, hunting, so strike until it falls.',
      keys: 'Walk into it with a step key to strike: a hit wakes a sleeper at once, hunting, so strike until it falls.' } },
    { id: 'case', point: 'case', done: s => s.took, say: {
      touch: 'Beside the case, tap it, then Open, then Take: what you take goes into your Bag.',
      mouse: 'Beside the case, click it, then Open, then Take: what you take goes into your Bag.',
      keys: 'Beside the case, press x until it is selected, o to open it and t to take what it holds: it goes into your Bag (i).' } },
    { id: 'leave', point: 'exit', done: s => s.left, say: {
      touch: 'Tap the exit door to walk there, then tap yourself and Leave.',
      mouse: 'Click the exit door to walk there, then click yourself and Leave.',
      keys: 'Press x until the exit is chosen and Enter to walk there, then > and Enter to leave.' } },
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

  // A new memory: the facts, and nothing seen yet.
  function start(facts) {
    const seen = {};
    for (const k of Object.keys(SEEN)) seen[k] = false;
    return { facts: JSON.parse(JSON.stringify(facts)), seen };
  }
  // observe(memory, vm, events) → a new memory, with what this look shows added; the memory
  // given, the view model and the events are only read.
  function observe(mem, vm, events) {
    const ev = events || [], seen = Object.assign({}, mem.seen);
    for (const k of Object.keys(SEEN)) if (!seen[k] && SEEN[k](vm, ev, mem.facts)) seen[k] = true;
    return { facts: mem.facts, seen };
  }
  // The step now: the first whose goal is not met (0 to 6), or STEPS.length once all are.
  function step(mem) {
    for (let i = 0; i < STEPS.length; i++) if (!STEPS[i].done(mem.seen)) return i;
    return STEPS.length;
  }
  // Step i's sentence in the words of an input ('touch', 'mouse' or 'keys').
  function sentence(i, form) {
    const s = STEPS[i];
    return s ? s.say[FORMS.includes(form) ? form : 'mouse'] : '';
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

  return { FORMS, STEPS, SEEN, start, observe, step, sentence, target };
})();
