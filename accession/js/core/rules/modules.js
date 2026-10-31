// ACCESSION — the hooks M4's modules use (BUILD.md §5.4), named now and empty in M3, frozen
// after M3's Wave 0. Each is called from its one place, so M4 fills it without moving a call:
//   Modules.onEvent(state, e, ev)    by Causes.emit, after an event is pushed and recorded; an
//                                    event a module emits from it goes through Causes.emit
//                                    again and lands after e (M4 states the re-entry rule)
//   Modules.alarmDecay(state, ev)    turn boundary step 7 (§8.1)
//   Modules.turn(state, ev)          turn boundary step 8, the module turn rules
// M4's skeleton added the rest with their signatures and neutral bodies, so the core can ask
// them before W0e fills them (W0d1 routes the core's calls to them):
//   Modules.on(state, id) → bool             is module id present in the visit and not switched off
//   Modules.offFor(pack, met) → [id]         the pack's modules a first visit switches off, given
//                                            the modules met (M5's; shipped unwired)
//   Modules.init(state, pack)                each module's init, in pack order, as a department is made
//   Modules.pipsDecay(state) → bool          may pips decay now (not while an alarm runs)
//   Modules.mayReturn(state, a) → bool       may idle awake exhibit a go back (not while an alarm runs)
//   Modules.threat(state, untilTick) → [mark]   the module marks falling due before untilTick (the
//                                            chime's lines, and chimes not yet sounded), for
//                                            Specials.threat; a mark is plain data, read as a
//                                            telegraph is: {by, sp, tiles: [[x, y]…], gross,
//                                            due}, by the uid that marks it, sp its special, due
//                                            the tick it resolves
'use strict';
const Modules = (() => {
  function onEvent(state, e, ev) {}
  function alarmDecay(state, ev) {}
  function turn(state, ev) {}
  // W0e fills: is module id present in the visit and not in rulesOff?
  function on(state, id) { return false; }
  // W0e fills (M5 wires it): the ids of the pack's modules to switch off, given those met.
  function offFor(pack, met) { return []; }
  // W0e fills: each module's init, in pack order.
  function init(state, pack) {}
  // W0e fills: may pips decay now?
  function pipsDecay(state) { return true; }
  // W0e fills: may idle awake exhibit a go back?
  function mayReturn(state, a) { return true; }
  // W0e fills: the module marks falling due before untilTick.
  function threat(state, untilTick) { return []; }
  return { onEvent, alarmDecay, turn, on, offFor, init, pipsDecay, mayReturn, threat };
})();
