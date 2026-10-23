// ACCESSION — every sentence about the rules is made here, from events and data
// (BUILD.md §3.4). M0 covers moving, fighting and doors.
'use strict';
const Text = (() => {
  // event(e, nameOf): nameOf(uid) gives an actor's name in mid-sentence ('the Lantern-Crop
  // Wader'; Labels.nameOf(state) makes one). Without it, or where it gives null, an exhibit
  // is the test room's 'the training dummy'. Called as a map callback, the index is ignored.
  function event(e, nameOf) {
    const lower = uid => uid === 'you' ? 'you' : (typeof nameOf === 'function' && nameOf(uid)) || 'the training dummy';
    const name = uid => { const s = lower(uid); return s.charAt(0).toUpperCase() + s.slice(1); };
    switch (e.k) {
      case 'damaged': {
        const c = e.cause;
        const sum = `${c.raw} − ${c.pad} Padding${c.floor ? `, at least ${c.floor}` : ''}`;
        if (c.surprise) return `${name(c.by)} caught ${lower(e.who)} unawares: ${e.amount} damage (${sum}).`;
        return `${name(c.by)} hit ${lower(e.who)} for ${e.amount} (rolled ${c.roll} against ${c.chance}%; ${sum}).`;
      }
      case 'missed': return `${name(e.by)} missed ${lower(e.at)} (rolled ${e.cause.roll} against ${e.cause.chance}%).`;
      case 'died': return e.who === 'you' ? 'You fell.' : `${name(e.who)} broke apart.`;
      case 'hunting': return e.cause.k === 'damage' ? `${name(e.who)} woke: it was struck.` : `${name(e.who)} is hunting you.`;
      case 'opened': return e.who === 'you' ? 'You opened the door.' : null;
      case 'refused': return e.reason;
      default: return null;
    }
  }
  return { event };
})();
