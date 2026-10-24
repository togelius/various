// ACCESSION — sentences: combat, specials and health (BUILD.md §8.1), owned by W1-COMBAT.
// Blows and specials, waiting, recovering and healing, and waking by damage.
'use strict';
(() => {
  // A blow: who struck whom, the roll against the chance, and the damage less Padding.
  const blow = (e, w) => {
    const c = e.cause;
    const sum = `${c.raw} − ${c.pad} Padding${c.floor ? `, at least ${c.floor}` : ''}`;
    if (c.surprise) return `${w.Name(c.by)} caught ${w.name(e.who)} unawares: ${e.amount} damage (${sum}).`;
    if (c.roll == null) return `${w.Name(c.by)} hit ${w.name(e.who)} for ${e.amount} (a certain hit; ${sum}).`;
    return `${w.Name(c.by)} hit ${w.name(e.who)} for ${e.amount} (rolled ${c.roll} against ${c.chance}%; ${sum}).`;
  };
  // Every blow is announced as `attacked` before it lands or misses; the log shows the result.
  Text.define('attacked', (e, w) => `${w.Name(e.by)} attacked ${w.name(e.at)}.`, { log: false });
  Text.defineCause('attacked', 'attack', (e, w) => `${w.Name(e.by)} attacked ${w.name(e.at)}.`);
  Text.define('missed', (e, w) => `${w.Name(e.by)} missed ${w.name(e.at)}.`);
  Text.defineCause('missed', 'attack', (e, w) => `${w.Name(e.by)} missed ${w.name(e.at)} (rolled ${e.cause.roll} against ${e.cause.chance}%).`);
  Text.define('damaged', (e, w) => `${w.Name(e.who)} took ${e.amount} damage.`);
  Text.defineCause('damaged', 'attack', blow);
  const special = (e, w) => `${w.Name(e.cause.by)} struck ${w.name(e.who)} with its special for ${e.amount} (${e.cause.gross} − ${e.cause.pad} Padding).`;
  Text.defineCause('damaged', 'special', special);
  const died = (e, w) => e.who === 'you' ? 'You fell.' : `${w.Name(e.who)} broke apart.`;
  Text.define('died', died);
  Text.defineCause('died', 'attack', died);
  Text.defineCause('died', 'special', died);

  Text.define('telegraphed', (e, w) => `${w.Name(e.who)} marks ${e.tiles.length} tiles for its special.`);
  Text.defineCause('telegraphed', 'special', (e, w) => `${w.Name(e.who)} marks ${e.tiles.length} tiles for its special: ${e.cause.gross} before your Padding.`);
  const used = (e, w) => e.cancelled ? `${w.Name(e.who)}’s special was called off.` : `${w.Name(e.who)} used its special.`;
  Text.define('special', used);
  Text.defineCause('special', 'special', used);
  Text.defineCause('special', 'cancel', (e, w) => `${w.Name(e.who)}’s special was called off (${e.cause.why}).`);

  // Waiting and recovering are left out of the log, as they were before M3.
  const HOW = { wait: 'waited', rest: 'rested', sit: 'sat down' };
  Text.define('waited', (e, w) => `${w.Name(e.who)} ${HOW[e.how] || 'waited'}.`, { log: false });
  Text.defineCause('waited', 'action', (e, w) => `${w.Name(e.who)} ${HOW[e.cause.how] || 'waited'}.`);
  Text.define('regenerated', (e, w) => `${w.Name(e.who)} recovered: health ${e.hp}.`, { log: false });
  Text.defineCause('regenerated', 'regen', (e, w) => `${w.Name(e.who)} recovered${e.cause.bench ? ' on the bench' : ''}: health ${e.hp}.`);
  Text.define('healed', (e, w) => `${w.Name(e.who)} healed ${e.amount}: health ${e.hp}.`);

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  const noise = what => e => `${CLS[e.cls] || 'A noise'}: ${what}, heard ${e.range} tiles away.`;
  Text.defineCause('noise', 'attack', noise('a blow'));
  Text.defineCause('noise', 'destroyed', noise('an exhibit destroyed'));
  Text.defineCause('noise', 'special', noise('a special'));

  // Damage always wakes, straight to hunting.
  Text.defineCause('woke', 'damage', (e, w) => `${w.Name(e.who)} woke: it was struck.`);
  Text.defineCause('hunting', 'damage', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke: it was struck.` : `${w.Name(e.who)} is hunting you: it was struck.`);
})();
