// STÅLHAGEN II — the words. First person, past tense, two short sentences, the second undercutting the first.
// No fear adjectives. Adults quoted, never shown.
'use strict';
const TEXT = {
  title: 'STÅLHAGEN II', subtitle: 'the ice road',
  cards: {
    1: { n: 'I', title: 'Isen', sub: 'The Ice', date: 'December 16th, 1997. Noon.' },
    2: { n: 'II', title: 'Sjögården', sub: 'The Farm', date: 'Dusk.' },
  },
  pause: 'Progress is saved at the island, at benches, and after encounters. The roadkeeper commits to the amber charge lane. Cut its supports or run past it.',
  quietPause: 'Machines will watch. They will not attack or carry you.',
  // narration, fired once each by a condition the game checks
  lines: [
    { id: 'i1', ch: 1, when: 'start', text: 'December 16th, 1997. The bay had frozen for the first time in my life.' },
    { id: 'i2', ch: 1, when: 'ice', text: 'Roos said to be back before dark. I said I would.' },
    { id: 'i3', ch: 1, when: 'mid', text: 'The towers had stopped breathing the summer they cleared the machines away. Nobody had said the two things were connected.' },
    { id: 'i4', ch: 1, when: 'hulls', text: 'They had not been cleared away. They had been put in the bay.' },
    { id: 'i5', ch: 1, when: 'far', text: 'Something on the island was drawing current. Some nights the meter at the substation ran backwards.' },
    { id: 'i6', ch: 1, when: 'thin', text: 'The dark ice was the thin ice. Dad had told me that when I was six, and I had not believed him.' },
    { id: 'recovery', ch:1, when:'recovery', text:'The recovery crew had cut the tow cable. They had left the warning light on.' },
    { id: 'relay', ch:2, when:'relay', text:'The relay clicked. In the field, something answered before the current came back.' },
    { id: 'ii1', ch: 2, when: 'start', text: 'The house had been sold twice since us. The kitchen window was lit.' },
    { id: 'ii2', ch: 2, when: 'hole', text: 'Where SV-14 used to lie there was a hole. In the hole there was a cable, and the cable was warm.' },
    { id: 'ii3', ch: 2, when: 'scout', text: 'It was not the little one. It was one of its family, and it looked back at me the same way.' },
    { id: 'ii4', ch: 2, when: 'bearer', text: 'The bigger one stopped to look at me the way 04 had. Then it came on.' },
    { id: 'ii5', ch: 2, when: 'standoff', text: 'It lowered its head to my hand. I had spent eight years wanting to reach out.' },
    { id: 'ii6', ch: 2, when: 'off', text: 'Its light went out under my hand. I had been looking for that light in photographs since I was thirteen.' },
    { id: 'ii7', ch: 2, when: 'carried', text: 'FOUND ONE ON THE ICE. BROUGHT IN. That was all the logbook said, in a hand that was not Johan’s.' },
    { id: 'ii8', ch: 2, when: 'cut', text: 'Where I cut it, the blue went out of it and the leg came away in the snow. It turned its head to see what I had done.' },
    { id: 'ii9', ch: 2, when: 'bench', text: 'I sat down on the bench by the porch. From there you could see the whole bay, and the towers, and nothing moving on either.' },
    { id: 'ii10', ch: 2, when: 'sleep', text: 'That was the first day. I slept in my old room, in my parka, with the torch on the chair.' },
  ],
  prompts: {
    reach: 'reach out', hold: 'hold…', sit: 'sit down', stand: 'stand up', sleep: 'sleep', photo: 'take the photograph', cellar: 'the cellar door', cellarEmpty: 'nothing to develop yet', doorLocked: 'the field relay is holding the door circuit open',
    develop: 'develop the prints', cut: 'cut', standoff: 'it is close enough. hold still, and reach out.',
  },
  seatLines: {},
  ending: 'In the morning there were two sets of tracks. Mine went to the house. The others came out.',
  darkroom: 'Dad’s darkroom. The safelight still worked. Everything on the islands still worked.',
};
