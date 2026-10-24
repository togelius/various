// ACCESSION — sentences: the kiter, the axis_sniper and the reflector, and the glass and
// old_repair modifiers (BUILD.md §5.5), owned by W1-ARCH-B. Shots, and lines sent back.
'use strict';
(() => {
  Text.defineCause('missed', 'shot', (e, w) => `${w.Name(e.by)} shot at ${w.name(e.at)} and missed (rolled ${e.cause.roll} against ${e.cause.chance}%).`);
  Text.defineCause('damaged', 'shot', (e, w) => {
    const c = e.cause, sum = `${c.raw} − ${c.pad} Padding${c.floor ? `, at least ${c.floor}` : ''}`;
    return `${w.Name(c.by)} shot ${w.name(e.who)} for ${e.amount} (${c.roll == null ? 'a certain hit' : `rolled ${c.roll} against ${c.chance}%`}; ${sum}).`;
  });
  Text.defineCause('damaged', 'reflected', (e, w) => `${w.Name(e.cause.by)} sent ${w.name(e.cause.shooter)}’s line back into ${w.name(e.who)}: ${e.amount} damage.`);
  const died = (e, w) => e.who === 'you' ? 'You fell.' : `${w.Name(e.who)} broke apart.`;
  Text.defineCause('died', 'shot', died);
  Text.defineCause('died', 'reflected', died);
})();
