// ACCESSION — every sentence about the rules is made here, from events and data
// (BUILD.md §3.4). M0 covers moving, fighting and doors.
'use strict';
const Text = (() => {
  const name = uid => uid === 'you' ? 'You' : 'The training dummy';
  const lower = uid => uid === 'you' ? 'you' : 'the training dummy';
  function event(e) {
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
