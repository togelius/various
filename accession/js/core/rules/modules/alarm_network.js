// ACCESSION — the module alarm_network (S.9; BUILD.md §5.4): "The waders raise the alarm when
// they see you; then the whole court is awake." Its rules register here with Modules.define
// (rules/modules.js) in the form of §5.4; its archetype: rules/arch/patrol_guard.js (the Wader);
// its entries in js/core/reg/mod-alarm.js and its sentences in js/core/text/mod-alarm.js. The
// alarm's lasting effects are bespoke (plan A7): pips do not decay and awake exhibits do not
// return while it runs (Modules.pipsDecay, Modules.mayReturn), and it moves the clock
// (ClockRules.advance). Owned by MOD-ALARM.
'use strict';
(() => {
  // MOD-ALARM fills: Modules.define('alarm_network', {…}).
})();
