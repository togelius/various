// SQUARE OFF — campaign "One Day in the Square" (DESIGN §8). Declarative; run by js/sim/campaign.js.
//
// Mission schema
//   id, n, title, clock (label), teaches, blurb, intro: [comic card lines], outro
//   player: faction key | 'pick' (any unlocked crew)
//   opponents: [{ faction, personality, difficulty }]   (faction 'pick' = any other crew)
//   map: SQ.data.maps id;  startClock: match-clock seconds (0 = 4 PM, 200 = 7 PM, 333 = 9 PM, 400 = 10 PM; 66.7 s per game hour)
//   turfTarget, length (match-clock end, default 600)
//   rules: { cannotLose, events: 'off'|'scripted'|'calm'|'normal'|'chaos', assist, directorNudge,
//            noAttacksBefore, playerClout, playerCrew, enemyClout, enemyStart: [{cls, lm, n}], playerStart: [{cls, n}] }
//   scripted: [{ at: seconds since match start, event: SQ.data.events id, lm? }]
//   win: { type: 'turf' } | { type: 'hold', count } | { type: 'holdTime', lm, seconds } | { type: 'survive' }
//        optional requires: beatId (the win can't trigger before that beat fired)
//   stars: [{ id: 'win'|'time'|'bonus', text, under?: seconds, check?: {type, ...} }]
//     bonus check types: shoo{count} | neverLose{lm} | captureWithSetup{setup, enemy:true}
//                        | crewHits{kind, count} | holdAtEnd{lm, seconds}
//   beats: [{ id, when, hint, target, action?, requires?, once?, repeat?, tip? }]
//     requires: beatId that must have fired first.  once/tip: a context tip (auto-dismisses after 4 s).
//     repeat: n = may fire up to n times (context tips show at most twice).
//     hint text may use {LOST} {WEAK} {BEATS} (glyphs of the class you keep losing, what beats it, what beats that).
//     when: { start } | { after: beatId, delay? } | { captured: lmId } | { owns: n } | { recruited: cls|'any' }
//           | { crewReady: true } | { crewUsed: true } | { time: s } | { eventStart: id } | { selected: true }
//           | { lostFight: true } | { idle: s }
//     target: { lm } | { ui: 'recruit.crowd'|'recruit.counter'|'crew'|'squad'|'army'|'chip' } | { unitCls } | { neutral: kind } | { x, z }
//     action: { grantCrew: n } | { spawn: { faction: 'enemy'|'player', cls, n, lm, from?: {x, z} } } | { camera: 'swoop'|'lm' }
//             | { comic: 'triangle' } | { event: SQ.data.events id, lm? } | { unlock: lmId }
//   rules.locked: [lmId]  landmarks nobody can capture until a beat's { unlock } (keeps lessons in order)
//   unlock: { factions: [...], skirmish: bool, cosmetics: [...] }
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  const missions = [
    {
      id: 'm1', n: 1, title: 'FIRST LIGHT', clock: '7 AM', teaches: 'Tap to send, capture, and the Crew Call.',
      blurb: 'Dawn. The park is empty except for the squirrels, and the squirrels think it is theirs.',
      intro: ['7 AM. Dew on the lawns.', 'Your dogs have opinions about the squirrels.', 'Take the dog runs back.'],
      outro: 'The squirrels retreat to the trees. They will remember this.',
      player: 'pack',
      opponents: [{ faction: 'squirrels', personality: 'passive', difficulty: 'chill' }],
      map: 'firstLight', startClock: 0, turfTarget: 99999, length: 9999,
      rules: { cannotLose: true, events: 'scripted', assist: true, directorNudge: true, playerClout: 120, playerCrew: 0, locked: ['bobst'],
        playerStart: [{ cls: 'crowd', n: 2 }, { cls: 'talker', n: 1 }],
        enemyStart: [{ cls: 'crowd', lm: 'bigrun', n: 4 }, { cls: 'crowd', lm: 'garibaldi', n: 2 }] },
      scripted: [{ at: 50, event: 'squirrelHeist' }, { at: 150, event: 'squirrelHeist' }],
      win: { type: 'hold', count: 3, requires: 'bobst' },   // not before the ZOOMIES lesson
      stars: [
        { id: 'win', text: 'Hold 3 landmarks' },
        { id: 'time', text: 'Finish in under 4:00', under: 240 },
        { id: 'bonus', text: 'Shoo 3 squirrels', check: { type: 'shoo', count: 3 } },
      ],
      beats: [
        { id: 'swoop', when: { start: true }, hint: 'Washington Square Park. 7 AM.', action: { camera: 'swoop' } },
        { id: 'tapRun', when: { after: 'swoop', delay: 3 }, hint: 'Tap your dogs, then tap the Small Dog Run.', target: { lm: 'smallrun' } },
        { id: 'capturing', when: { selected: true }, requires: 'tapRun', hint: 'Stand in the ring to capture it. More units = faster.', target: { lm: 'smallrun' }, once: true },
        { id: 'gotRun', when: { captured: 'smallrun' }, requires: 'tapRun', hint: 'Yours! Landmarks pay Clout and Turf every second.', action: { camera: 'lm' } },
        { id: 'recruit', when: { after: 'gotRun', delay: 2 }, hint: 'Recruit a pair of Small-Dog Walkers: tap ●.', target: { ui: 'recruit.crowd' } },
        { id: 'bigRun', when: { recruited: 'crowd' }, requires: 'recruit', hint: 'Squirrels took the Big Dog Run. Select your dogs and tap it.', target: { lm: 'bigrun' } },
        { id: 'crew', when: { captured: 'bigrun' }, requires: 'bigRun', hint: 'More squirrels at the Small Run! ZOOMIES is charged: tap it, then swipe a line through them.', target: { lm: 'smallrun' },
          action: { grantCrew: 100, spawn: { faction: 'enemy', cls: 'crowd', n: 5, lm: 'smallrun', from: { x: 12, z: 40 } } } },
        { id: 'bobst', when: { crewUsed: true }, requires: 'crew', hint: 'Now take Bobst Gate. Three landmarks and the park is yours.', target: { lm: 'bobst' }, action: { unlock: 'bobst', event: 'squirrelHeist', warn: 3 } },
        { id: 'shoo', when: { eventStart: 'squirrelHeist' }, hint: 'Squirrels are raiding your snacks! Tap one to shoo it (+5 Clout).', target: { neutral: 'squirrel' }, once: true },
        { id: 'idle', when: { idle: 25 }, requires: 'tapRun', hint: 'Tip: tap a unit to select its squad, then tap where it should go.', tip: true },
      ],
      unlock: { factions: ['pack'] },
    },
    {
      id: 'm2', n: 2, title: 'OPENING GAMBIT', clock: '10 AM', teaches: 'The counter triangle: ● beats ▲, ▲ beats ■, ■ beats ●.',
      blurb: 'The chess tables open. A wave of Freshmen wants to "learn the game".',
      intro: ['● beats ▲: you can\'t monologue at a mob.', '▲ beats ■: argue the big guy down from range.', '■ beats ●: splash scatters crowds.'],
      outro: 'The Freshmen go back to orientation. The Old Heads go back to their tables.',
      player: 'hustle',
      opponents: [{ faction: 'violets', personality: 'mosh', difficulty: 'chill' }],
      map: 'westHalf', startClock: 0, turfTarget: 600,
      rules: { cannotLose: false, events: 'calm', assist: true, directorNudge: true, noAttacksBefore: 60 },
      scripted: [],
      win: { type: 'turf' },
      stars: [
        { id: 'win', text: 'Reach 600 Turf first' },
        { id: 'time', text: 'Win in under 6:00', under: 360 },
        { id: 'bonus', text: 'Never lose the Chess Plaza', check: { type: 'neverLose', lm: 'chess' } },
      ],
      beats: [
        { id: 'comic', when: { start: true }, hint: 'Shapes are everything: ● beats ▲, ▲ beats ■, ■ beats ●.', action: { comic: 'triangle' } },
        { id: 'chess', when: { after: 'comic', delay: 4 }, hint: 'Send your Kibitzers to take the Chess Plaza.', target: { lm: 'chess' } },
        { id: 'freshmen', when: { time: 50 }, hint: 'Freshmen incoming. They are ● - and ■ beats ●.', target: { ui: 'recruit.heavy' } },
        { id: 'chevrons', when: { selected: true }, hint: 'Green ▲ over an enemy = good matchup. Red ▼ = walk away.', once: true },
        { id: 'oldheads', when: { recruited: 'heavy' }, hint: 'An Old Head! Park him where the Freshmen will run into him.', target: { lm: 'chess' } },
        { id: 'lost', when: { lostFight: true }, hint: 'Your {LOST} keep losing to {WEAK}. Bring {BEATS} - shapes beat shapes.', target: { ui: 'recruit.counter' }, repeat: 2 },
        { id: 'expand', when: { owns: 2 }, hint: 'Each landmark adds Turf. First to 600 wins.', target: { lm: 'grove' } },
      ],
      unlock: { factions: ['hustle'], skirmish: true },
    },
    {
      id: 'm3', n: 3, title: 'COMMENCEMENT', clock: 'NOON', teaches: 'Clout, Setups, and why Setups are a stake.',
      blurb: 'Graduation day. Your crew builds the party; the Hustle wants the party.',
      intro: ['Setups sit on glowing pads at landmarks.', 'They pay off every second...', '...and they flip to whoever takes the landmark.'],
      outro: 'Caps in the air. Somebody kept the Chess Table.',
      player: 'violets',
      opponents: [{ faction: 'hustle', personality: 'hustler', difficulty: 'regular' }],
      map: 'whole', startClock: 0, turfTarget: 1200,
      rules: { cannotLose: false, events: 'scripted', assist: true, playerClout: 220 },
      scripted: [{ at: 120, event: 'graduation', lm: 'arch' }, { at: 260, event: 'iceCream' }],
      win: { type: 'turf' },
      stars: [
        { id: 'win', text: 'Reach 1200 Turf first' },
        { id: 'time', text: 'Win in under 7:30', under: 450 },
        { id: 'bonus', text: 'Capture a landmark with an enemy Chess Table', check: { type: 'captureWithSetup', setup: 'chessTable', enemy: true } },
      ],
      beats: [
        { id: 'take', when: { start: true }, hint: 'Take Arch Plaza - then tap it to open its card.', target: { lm: 'arch' } },
        { id: 'build', when: { captured: 'arch' }, hint: 'Build a Food Cart on a glowing pad: +1 Clout/s.', target: { lm: 'arch' } },
        { id: 'club', when: { after: 'build', delay: 20 }, hint: 'A Club Fair Table turns a landmark into a recruit point. Try one.', target: { lm: 'fountain' } },
        { id: 'grads', when: { eventStart: 'graduation' }, hint: 'Graduation! Violets move 20% faster - go raid.', target: { lm: 'chess' } },
        { id: 'stake', when: { owns: 4 }, hint: 'The Hustle builds Chess Tables. Take a landmark that has one and it is yours.', target: { lm: 'chess' } },
      ],
      unlock: { factions: ['violets'] },
    },
    {
      id: 'm4', n: 4, title: 'THE PIANO COMES OUT', clock: '3 PM', teaches: 'Park events and Crew Call timing.',
      blurb: 'The Piano Guy, a squirrel heist and a PEP sweep, all in one afternoon.',
      intro: ['Events are announced 8 s ahead.', 'A good Crew Call lands when they bunch up.', 'Hold the Fountain.'],
      outro: 'The piano rolls home. The drums keep going.',
      player: 'noise',
      opponents: [{ faction: 'pack', personality: 'opportunist', difficulty: 'regular' }],
      map: 'whole', startClock: 0, turfTarget: 1500,
      rules: { cannotLose: false, events: 'scripted', assist: false },
      scripted: [{ at: 60, event: 'piano', lm: 'fountain' }, { at: 150, event: 'squirrelHeist' }, { at: 240, event: 'pep' }, { at: 330, event: 'pigeonLady' }],
      win: { type: 'holdTime', lm: 'fountain', seconds: 150 },
      stars: [
        { id: 'win', text: 'Hold the Fountain for 150 s in total' },
        { id: 'time', text: 'Do it in under 6:00', under: 360 },
        { id: 'bonus', text: 'A Drum Circle that hits 6+ enemies', check: { type: 'crewHits', kind: 'drumCircle', count: 6 } },
      ],
      beats: [
        { id: 'fountain', when: { start: true }, hint: 'Take the Fountain and keep it: 150 s in total.', target: { lm: 'fountain' } },
        { id: 'piano', when: { eventStart: 'piano' }, hint: 'Piano! Units near it move faster and heal.', once: true },
        { id: 'crew', when: { crewReady: true }, hint: 'Drum Circle is ready. Wait until they bunch up, then drop it.', target: { ui: 'crew' } },
        { id: 'pep', when: { eventStart: 'pep' }, hint: 'PEP officers: nobody can attack near them. Use it to retreat.', once: true },
        { id: 'heist', when: { eventStart: 'squirrelHeist' }, hint: 'Squirrels! Tap them to shoo them before they rob your carts.', target: { neutral: 'squirrel' }, once: true },
        { id: 'lost', when: { lostFight: true }, hint: 'Your {LOST} keep losing to {WEAK}. Bring {BEATS}.', target: { ui: 'recruit.counter' }, repeat: 2 },
      ],
      unlock: { factions: ['noise'] },
    },
    {
      id: 'm5', n: 5, title: 'GOLDEN HOUR', clock: '7 PM', teaches: 'Phases: the light is the timer.',
      blurb: 'The sun drops down the cross streets. At 10 PM the Arch lights up and is worth double.',
      intro: ['Golden Hour: the Fountain pays 1.5x.', 'Night: the Arch is floodlit - 2 Turf/s.', 'Plan for the dark.'],
      outro: 'The Arch glows. Somebody is taking a photo of you.',
      player: 'pick',
      opponents: [{ faction: 'pick', personality: 'turtle', difficulty: 'regular' }],
      map: 'whole', startClock: 200, turfTarget: 1200,
      rules: { cannotLose: false, events: 'normal', assist: false },
      scripted: [],
      win: { type: 'turf' },
      stars: [
        { id: 'win', text: 'Win the evening' },
        { id: 'time', text: 'Win before 1 AM is close (under 6:00)', under: 360 },
        { id: 'bonus', text: 'Hold the Arch for the last 60 s', check: { type: 'holdAtEnd', lm: 'arch', seconds: 60 } },
      ],
      beats: [
        { id: 'golden', when: { start: true }, hint: 'Golden Hour: the Fountain pays 1.5x. The Playground kids went home.', target: { lm: 'fountain' } },
        { id: 'nightSoon', when: { time: 175 }, hint: 'Night in 25 s. The Arch will be worth 2 Turf/s.', target: { lm: 'arch' } },
        { id: 'night', when: { time: 200 }, hint: 'Night. The Arch is floodlit - take it and hold it to the end.', target: { lm: 'arch' } },
        { id: 'lost', when: { lostFight: true }, hint: 'Your {LOST} keep losing to {WEAK}. Bring {BEATS}.', target: { ui: 'recruit.counter' }, repeat: 2 },
      ],
      unlock: { cosmetics: ['golden'] },
    },
    {
      id: 'm6', n: 6, title: 'SQUARE OFF AT MIDNIGHT', clock: '9 PM', teaches: 'Everything, all at once.',
      blurb: 'Three crews, one fountain, and the park closes at 1 AM.',
      intro: ['Three crews.', 'One fountain.', 'Park closes at 1 AM.'],
      outro: 'Everyone ends up on the fountain rim, all the colors mixed. Same time tomorrow?',
      player: 'pick',
      opponents: [{ faction: 'pick', personality: 'hustler', difficulty: 'regular' }, { faction: 'pick', personality: 'mosh', difficulty: 'regular' }],
      map: 'whole', startClock: 333, turfTarget: 900,
      rules: { cannotLose: false, events: 'normal', assist: false, playerClout: 250, enemyClout: 250 },
      scripted: [],
      win: { type: 'turf' },
      stars: [
        { id: 'win', text: 'Last crew standing at 1 AM' },
        { id: 'time', text: 'Reach 900 Turf before closing', under: 300 },
        { id: 'bonus', text: 'Hold the Fountain at the end', check: { type: 'holdAtEnd', lm: 'fountain', seconds: 1 } },
      ],
      beats: [
        { id: 'go', when: { start: true }, hint: 'Two AIs. They will fight each other too - let them.', target: { lm: 'fountain' } },
        { id: 'night', when: { time: 67 }, hint: 'Night: the Arch pays 2 Turf/s now. Everyone knows it.', target: { lm: 'arch' } },
        { id: 'crew', when: { crewReady: true }, hint: 'Crew Call ready. Save it for the big fountain brawl.', target: { ui: 'crew' }, once: true },
      ],
      unlock: { cosmetics: ['midnight'] },
      finale: true,
    },
  ];

  SQ.data.missions = missions;
  SQ.data.missionById = {};
  missions.forEach((m) => { SQ.data.missionById[m.id] = m; });
  SQ.data.campaignRules = { chillOfferAfterLosses: 2, saveKey: 'squareoff.v1' };
})(window.SQ = window.SQ || {});
