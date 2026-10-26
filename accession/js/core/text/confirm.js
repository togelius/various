// ACCESSION — sentences: the confirmations (BUILD.md §7.1), owned by the interface (js/main.js
// decides when one is asked; the words are here, as every sentence about the rules is, §3.4).
//
// Text.confirm(k, data, nameOf) → {title, yes, line} | null: the sheet's question, its button
// and the sentence that says what the action would do, for
//   'shards'  stepping onto shards from a tile without them;
//   'bash'    a blow at a case's glass: data {glassName, blows}, Cases.describe's (the blows
//             left to break it, this one included);
//   'leave'   leaving by an exit (a minimal confirmation, D4.9);
//   'threat'  an action that would leave you on a tile marked for damage by a special that
//             goes off before your next decision: data {by, shape, dmg, stay}, Specials.threat's
//             owner and number, the special's shape, and whether you stay where you are.
'use strict';
(() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // A special's name by its shape, as its label's line says it ("Its beam", "Its ring of blows").
  const SPECIAL = { line: 'beam', ring: 'ring of blows' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const more = n => n === 1 ? '1 more breaks it' : `${n} more break it`;
  const SAY = {
    shards: () => ({ title: 'Step onto the shards?', yes: 'Step onto the shards',
      line: `Broken glass is loud underfoot: while you stand on it, your ring reaches ${N.RING_LOUD_FLOOR} tiles farther.` }),
    bash: d => ({ title: 'Break the glass?', yes: 'Strike the glass',
      line: d.blows === 1 ? `This blow breaks its ${d.glassName} glass, with a crash.` : `This blow is loud and cracks its ${d.glassName} glass; ${more(d.blows - 1)}, the last with a crash.` }),
    leave: () => ({ title: 'Leave the department?', yes: 'Leave', line: 'Your visit ends when you go through this door.' }),
    threat: (d, nameOf) => {
      const who = (typeof nameOf === 'function' && nameOf(d.by)) || 'an exhibit', what = own(SPECIAL, d.shape) ? SPECIAL[d.shape] : 'special';
      return { title: d.stay ? 'Stay on the marked tile?' : 'Step onto the marked tile?', yes: d.stay ? 'Stay' : 'Step onto it',
        line: `${cap(who)}’s ${what} goes off on that tile before your next turn: it would deal you ${d.dmg}, with no roll.` };
    },
  };
  Text.provide('confirm', (k, data, nameOf) => own(SAY, k) ? SAY[k](data || {}, nameOf) : null);
})();
