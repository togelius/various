// ACCESSION — the hooks M4's modules use (BUILD.md §5.4), named now and empty in M3, frozen
// after M3's Wave 0. Each is called from its one place, so M4 fills it without moving a call:
//   Modules.onEvent(state, e, ev)    by Causes.emit, after an event is pushed and recorded; an
//                                    event a module emits from it goes through Causes.emit
//                                    again and lands after e (M4 states the re-entry rule)
//   Modules.alarmDecay(state, ev)    turn boundary step 7 (§8.1)
//   Modules.turn(state, ev)          turn boundary step 8, the module turn rules
'use strict';
const Modules = (() => {
  function onEvent(state, e, ev) {}
  function alarmDecay(state, ev) {}
  function turn(state, ev) {}
  return { onEvent, alarmDecay, turn };
})();
