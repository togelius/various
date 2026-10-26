// ACCESSION — sentences: combat, specials and health (BUILD.md §8.1), owned by W1-COMBAT.
// Blows and specials, waiting, resting, sitting, recovering and healing, waking by damage, and
// the refusals of sitting. Each sentence states the rule's numbers as the event carries them.
'use strict';
(() => {
  const isInt = v => Number.isInteger(v);
  // A special's name in a sentence, from its shape (the registry's SPECIALS): a ring of blows,
  // a beam or a call; any other is "its special".
  const SHAPE = { ring: 'ring of blows', line: 'beam', call: 'call' };
  const spName = sp => {
    const S = typeof sp === 'string' && Object.prototype.hasOwnProperty.call(Registry.SPECIALS, sp) ? Registry.SPECIALS[sp] : null;
    return S && SHAPE[S.shape] ? SHAPE[S.shape] : 'special';
  };
  // The arithmetic of the damage: raw less Padding, with the floor when it applied.
  const sum = (raw, pad, floor) => `${raw} − ${pad} Padding${isInt(floor) ? `, at least ${floor}` : ''}`;
  // What happened after the damage: an invulnerable run keeps you at 1 health (§10.2).
  const saved = c => c && c.saved ? ' You were kept at 1 health.' : '';
  // Whose: "Your" for you, else the name and an apostrophe.
  const whose = (w, uid) => uid === 'you' ? 'Your' : `${w.Name(uid)}’s`;
  // A blow from two tiles away is a Reach blow.
  const reach = c => c && c.how && c.how.kind === 'reach' ? ' with Reach' : '';
  // When the damage taken is not the sum (net), what made it so: the defender's archetype or a
  // modifier changed it (Archetypes.adjustDamage, before health falls). Through an old repair
  // (old_repair marks the side, cause.side) a blow, shot or beam is doubled; a body that falls
  // to any one blow (mote_swarm) loses all its health; any other change is the defender's
  // Behaviour line's.
  const sideName = v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(Clauses.COMPASS, v) ? Clauses.COMPASS[v] : String(v);
  const changed = (e, net) => {
    const c = e.cause;
    if (!isInt(net) || !isInt(e.amount) || e.amount === net) return '';
    if (c.side !== undefined && c.side !== null) {
      const side = `through its repaired ${sideName(c.side)} side`;
      return e.amount === 2 * net ? `, doubled ${side}` : `, made ${e.amount} ${side}`;
    }
    if (e.who === 'you') return `, made ${e.amount}`;
    if (e.hp === 0) return `; it falls to any one blow: all ${e.amount} of its health`;
    return `, which its Behaviour line makes ${e.amount}`;
  };

  // A blow: who struck whom, the roll against the chance (or the surprise), and the damage
  // less Padding, with what changed it.
  const blow = (e, w) => {
    const c = e.cause;
    const s = sum(c.raw, c.pad, c.floor) + changed(e, isInt(c.floor) ? c.floor : c.raw - c.pad);
    if (c.surprise) return `${w.Name(c.by)} caught ${w.name(e.who)} unawares${reach(c)}: ${e.amount} damage (${s}).${saved(c)}`;
    if (!isInt(c.roll)) return `${w.Name(c.by)} hit ${w.name(e.who)}${reach(c)} for ${e.amount} (a certain hit; ${s}).${saved(c)}`;
    return `${w.Name(c.by)} hit ${w.name(e.who)}${reach(c)} for ${e.amount} (rolled ${c.roll} against ${c.chance}%; ${s}).${saved(c)}`;
  };
  // Every blow is announced as `attacked` before it lands or misses; the log shows the result.
  Text.define('attacked', (e, w) => `${w.Name(e.by)} attacked ${w.name(e.at)}.`, { log: false });
  Text.defineCause('attacked', 'attack', (e, w) => e.cause.how && e.cause.how.kind === 'reach'
    ? `${w.Name(e.by)} struck at ${w.name(e.at)} with Reach, from ${e.cause.dist} tiles away.`
    : `${w.Name(e.by)} attacked ${w.name(e.at)}.`);
  Text.define('missed', (e, w) => `${w.Name(e.by)} missed ${w.name(e.at)}.`);
  Text.defineCause('missed', 'attack', (e, w) => `${w.Name(e.by)} missed ${w.name(e.at)}${reach(e.cause)} (rolled ${e.cause.roll} against ${e.cause.chance}%).`);
  Text.define('damaged', (e, w) => `${w.Name(e.who)} took ${e.amount} damage.`);
  Text.defineCause('damaged', 'attack', blow);
  // A special's damage has no roll: its gross number, less the Padding of whoever stood there,
  // with what changed it.
  const special = (e, w) => {
    const c = e.cause, floor = isInt(c.net) && c.net > c.gross - c.pad ? c.net : null;
    return `${whose(w, c.by)} ${spName(c.sp)} struck ${w.name(e.who)} for ${e.amount} (${sum(c.gross, c.pad, floor)}${changed(e, c.net)}).${saved(c)}`;
  };
  Text.defineCause('damaged', 'special', special);
  const died = (e, w) => e.who === 'you' ? 'You fell.' : `${w.Name(e.who)} broke apart.`;
  Text.define('died', died);
  Text.defineCause('died', 'attack', died);
  Text.defineCause('died', 'special', died);

  // A mark: the tiles it covers, and for a damage special its number before your Padding.
  const tiles = list => `${list.length} ${list.length === 1 ? 'tile' : 'tiles'}`;
  Text.define('telegraphed', (e, w) => `${w.Name(e.who)} marks ${tiles(e.tiles)} for its ${spName(e.sp)}.`);
  Text.defineCause('telegraphed', 'special', (e, w) => isInt(e.cause.gross) && e.cause.gross > 0
    ? `${w.Name(e.who)} marks ${tiles(e.tiles)} for its ${spName(e.sp)}: ${e.cause.gross} before your Padding, at its next action.`
    : `${w.Name(e.who)} marks ${tiles(e.tiles)} for its ${spName(e.sp)}, at its next action.`);
  const struck = hits => !Array.isArray(hits) ? '' : hits.length === 1 ? ': it struck 1' : hits.length ? `: it struck ${hits.length}` : ': it struck nothing';
  const used = (e, w) => e.cancelled ? `${whose(w, e.who)} ${spName(e.sp)} was called off.` : `${w.Name(e.who)} used its ${spName(e.sp)}${struck(e.hits)}.`;
  Text.define('special', used);
  Text.defineCause('special', 'special', used);
  // Why a mark was called off (§8.1): its owner was fixed or destroyed, or stopped hunting
  // (it lost you, was quieted, went back to sleep, or you left by the Ticket).
  const WHY = { fixed: 'it was fixed in place', died: 'it was destroyed' };
  Text.defineCause('special', 'cancel', (e, w) => `${whose(w, e.who)} ${spName(e.sp)} was called off: ${WHY[e.cause.why] || 'it stopped hunting you'}.`);

  // Waiting, resting and sitting are left out of the log, as waits were before M3.
  const HOW = { wait: 'waited', rest: 'rested', sit: 'sat down on the bench' };
  const how = k => Object.prototype.hasOwnProperty.call(HOW, k) ? HOW[k] : 'waited';
  Text.define('waited', (e, w) => `${w.Name(e.who)} ${how(e.how)}.`, { log: false });
  Text.defineCause('waited', 'action', (e, w) => `${w.Name(e.who)} ${how(e.cause.how)}.`);
  Text.define('regenerated', (e, w) => `${w.Name(e.who)} recovered 1 health: now ${e.hp}.`, { log: false });
  Text.defineCause('regenerated', 'regen', (e, w) => `${w.Name(e.who)} recovered 1 health${e.cause.bench ? ' on the bench' : ''}: now ${e.hp}.`);
  Text.define('healed', (e, w) => `${w.Name(e.who)} regained ${e.amount} health: now ${e.hp}.`);

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  const noise = what => e => `${CLS[e.cls] || 'A noise'}: ${what}, heard ${e.range} tiles away.`;
  Text.defineCause('noise', 'attack', noise('a blow'));
  Text.defineCause('noise', 'destroyed', noise('an exhibit destroyed'));
  Text.defineCause('noise', 'special', noise('a special'));

  // Damage always wakes, straight to hunting. The log tells a sleeper woken into a hunt by its
  // hunting sentence alone (Text.log), so that sentence says it hunts you, as every other
  // cause's does.
  Text.defineCause('woke', 'damage', (e, w) => `${w.Name(e.who)} woke: it was struck.`);
  Text.defineCause('hunting', 'damage', (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: it was struck.` : `${w.Name(e.who)} is hunting you: it was struck.`);

  // Sitting (§4.2).
  Text.defineRefusal('no_bench', () => 'There is no bench here to sit on.');
  Text.defineRefusal('seated', () => 'You are already sitting down.');
})();
