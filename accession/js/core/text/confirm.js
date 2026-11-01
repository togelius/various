// ACCESSION — sentences: the confirmations (BUILD.md §7.1), owned by the interface, and in M4 by
// ARCH-HALL (the hall's, and the threat's for a line not yet marked): js/main.js decides when
// one is asked; the words are here, as every sentence about the rules is, §3.4.
//
// Text.confirm(k, data, nameOf) → {title, yes, line} | null: the sheet's question, its button
// and the sentence that says what the action would do, for
//   'shards'  stepping onto shards from a tile without them;
//   'bash'    a blow at a case's glass: data {glassName, blows}, Cases.describe's (the blows
//             left to break it, this one included);
//   'leave'   leaving by an exit (a minimal confirmation, D4.9): data {place}, the room's
//             dept.place where it is no department (the Orientation's practice room, whose
//             door starts a visit rather than ending one);
//   'threat'  an action that would leave you on a tile marked for damage by a special that
//             goes off before your next decision (Specials.threat): data {by, shape, dmg,
//             stay, marked?, due?, more?}: its owner, its special's shape and the number it
//             deals you; whether you stay where you are; marked (false only for a due line
//             not yet marked, such as one a chime still to come will mark: D7.3, said as a
//             line that can strike there, since its tiles are fixed only when marked), due (it
//             goes off at a turn boundary); and more, the others that strike that tile before
//             your next decision, each {by, shape, dmg, marked?, due?}, in the order they go
//             off;
//   'hall'    a step into a Centrepiece's hall (Hall.entering): data {by, form, seals}: seals
//             when it would seal behind you at the next boundary (R11), by the piece hunting
//             you, form its Centrepiece's (fight or treasure);
//   'practice' going to the practice room (the Orientation) from "How the museum works"
//             while a visit is under way, which ends it (js/main.js).
'use strict';
(() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // A special's name by its shape, as its label's line says it ("Its beam", "Its ring of blows");
  // a due line of another shape (a chime's) is a line.
  const SPECIAL = { line: 'beam', ring: 'ring of blows' };
  const what = h => own(SPECIAL, h.shape) ? SPECIAL[h.shape] : h.due ? 'line' : 'special';
  const an = w => (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const whose = (h, nameOf) => (typeof nameOf === 'function' && nameOf(h.by)) || 'an exhibit';
  // The others that strike the tile before your next decision, after the first.
  function others(list, nameOf) {
    if (!Array.isArray(list) || !list.length) return '';
    const one = h => `${whose(h, nameOf)}’s ${what(h)}, dealing ${h.dmg}${h.marked === false ? ' (not yet marked: it can reach there)' : ''}`;
    return ` ${list.length === 1 ? 'Another goes' : 'More go'} off there before your next turn: ${list.map(one).join('; ')}.`;
  }
  // How a sealed hall's shutters open (rules/hall.js; text/hall.js says the same).
  const opens = () => `they open once the Centrepiece has gone ${Text.count(N.SEAL_LIFT_TURNS, 'turn')} without hurting you or ending a turn beside you, once it falls or none of it is left in the hall, or when you read a Re-admission Ticket`;
  const shut = 'shutters close over its openings, the clock stops, and you do not recover health';
  const more = n => n === 1 ? '1 more breaks it' : `${n} more break it`;
  const SAY = {
    shards: () => ({ title: 'Step onto the shards?', yes: 'Step onto the shards',
      line: `Broken glass is loud underfoot: while you stand on it, your ring reaches ${N.RING_LOUD_FLOOR} tiles farther.` }),
    bash: d => ({ title: 'Break the glass?', yes: 'Strike the glass',
      line: d.blows === 1 ? `This blow breaks its ${d.glassName} glass, with a crash.` : `This blow is loud and cracks its ${d.glassName} glass; ${more(d.blows - 1)}, the last with a crash.` }),
    leave: d => (d.place ? { title: `Leave the ${d.place}?`, yes: 'Leave', line: 'A visit starts when you go through this door.' }
      : { title: 'Leave the department?', yes: 'Leave', line: 'Your visit ends when you go through this door.' }),
    practice: () => ({ title: 'Go to the practice room?', yes: 'Practice room', line: 'This visit ends here; a new one starts after the practice room.' }),
    // A special already marked is on the board; a due line not yet marked (a chime still to
    // come) is named as its owner will mark it, so the sheet never calls an unmarked tile marked.
    threat: (d, nameOf) => {
      const who = whose(d, nameOf), sp = what(d), more = others(d.more, nameOf);
      // A line not yet marked has no tiles yet: they are fixed when it is marked, and the
      // threat warns of every tile it could take then (§8.1, D7.3), so it says it can strike.
      if (d.marked === false) {
        return { title: d.stay ? `Stay where ${an(sp)} can strike?` : `Step where ${an(sp)} can strike?`, yes: d.stay ? 'Stay' : 'Step there',
          line: `${cap(who)} is to mark its ${sp} before your next turn; it can reach that tile, and it goes off before then: it would deal you ${d.dmg}, with no roll.${more}` };
      }
      return { title: d.stay ? 'Stay on the marked tile?' : 'Step onto the marked tile?', yes: d.stay ? 'Stay' : 'Step onto it',
        line: `${cap(who)}’s ${sp} goes off on that tile before your next turn: it would deal you ${d.dmg}, with no roll.${more}` };
    },
    // The hall seals at a turn boundary while you stand inside it, no one stands in an
    // opening, and its Centrepiece calls for it (a fight's: it hunts you from inside the hall;
    // a treasure's: as its guardian's label says).
    hall: (d, nameOf) => {
      const who = (typeof nameOf === 'function' && d.by && nameOf(d.by)) || 'the Centrepiece';
      // A treasure's hall seals by its own rule, never on the hunt: its words never say hunting.
      const line = d.seals && d.form === 'treasure' ? `The hall will seal behind you as this turn ends, as its guardian’s label says, unless someone then stands in one of its openings: ${shut}; ${opens()}.`
        : d.seals ? `${cap(who)} is hunting you, so the hall will seal behind you as this turn ends, unless someone then stands in one of its openings: ${shut}; ${opens()}.`
        : d.form === 'treasure' ? `This hall can seal while you are inside it, as its guardian’s label says: ${shut}; ${opens()}.`
        : `If the Centrepiece hunts you while you and it are inside, the hall seals at the end of a turn when no one stands in its openings: ${shut}; ${opens()}.`;
      return { title: 'Step into the Centrepiece’s hall?', yes: 'Step in', line };
    },
  };
  Text.provide('confirm', (k, data, nameOf) => own(SAY, k) ? SAY[k](data || {}, nameOf) : null);
})();
