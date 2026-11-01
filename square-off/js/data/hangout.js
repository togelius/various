// SQUARE OFF — "Hang Out": the default game since the 2026-10-31 rework (see DESIGN-V2.md).
// Every tunable, the five spots, the entrances, the named groups and their lines, the Park Report
// observation lines, the AI difficulties and the tutorial scenario configs. Headless data only.
//
// Plain-English vocabulary (the only words the player needs):
//   spot         one of five places you can hang out at
//   hanging out  your group is at a spot your crew holds: +1 point a second
//   settling in  3 quiet seconds at an empty spot before it starts earning
//   arguing      rival groups at the same spot argue; each rival drains your patience
//   patience     a bar per group; it refills when nobody is arguing with you
//   went for coffee  patience ran out: the group leaves, then comes back through your entrance
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  // ------------------------------------------------------------------ rules (tuned: DESIGN-V2.md §4)
  const rules = {
    length: 300,            // s; a 5:00 countdown. 0 / Infinity = untimed (tutorials)
    groupsPerSide: 3,
    speed: 4.5,             // m/s on paths. Lawn x0.77, fountain basin x0.56, beds x0.33 (= 10/nav cost,
                            // so flow-field distance / speed is the exact walking time)
    settleTime: 3,          // s: an arrived group, at an empty spot, with no rivals there
    pointsPerSecond: 1,     // per spot your crew holds (any number of your groups there: still 1)
    patienceMax: 100,
    drainPerRival: 9,       // patience/s you lose for EACH rival group at your spot (1v1: 11 s, 2v1: 5.6 s)
    recoverRate: 4,         // patience/s you regain whenever nobody is arguing with you
    breakTime: 15,          // s on coffee; then back at your entrance with full patience
    returnTo: 'last',       // after coffee, walk back to the last spot you were sent to ('last'|'entrance')
    // Optional rule variants measured by tools/hangout-lab.js (all off in the baseline):
    ties: 'holder',         // everyone at a spot runs out at once: the crew hanging out there stays ('first' | 'both')
    firstBy: 1,             // s: arriving less than this apart is a dead heat (nobody was first; everyone leaves)
    settleDrains: false,    // true: groups still settling in lose patience x2 in arguments
    evictBonus: 0,          // points for making a rival group go for coffee
    tiredAt: 35,            // a 'tired' bark below this patience while arguing (presentation only)
    earnEvery: 1,           // s between 'earning' / 'score' events
    historyEvery: 5,        // s between score history samples (Park Report graph)
    barkGap: 6,             // s: a group says at most one line this often
  };

  // ------------------------------------------------------------------ spots
  // Real fence polygons (GEO.barriers) for the fenced spots: inside the fence is "at the spot".
  const TODDLER = [[-49.46, -55.47], [-50.89, -55.49], [-51.19, -55.51], [-54.93, -55.77], [-58.89, -56.3], [-60.82, -57.26],
    [-61.79, -58.91], [-62.15, -60.57], [-61.64, -62.38], [-60.53, -63.55], [-58.61, -64.56], [-56.34, -64.86], [-42.35, -64.62],
    [-40.15, -64.08], [-38.1, -63], [-37.2, -61.63], [-37.03, -60.16], [-37.46, -58.51], [-38.43, -57.38], [-40.14, -56.51],
    [-43.99, -55.67], [-48, -55.46]];
  const SMALL_RUN = [[29.3, 58.36], [29.4, 59.85], [24.39, 60.32], [22.78, 61.07], [21.71, 62.46], [21.74, 64.15], [22.62, 65.67],
    [24.16, 66.59], [26.7, 66.67], [37.57, 66.34], [39.83, 65.84], [41.03, 65.02], [41.78, 63.59], [41.39, 62.09], [40.47, 60.87],
    [38.76, 59.41], [36.7, 58.35], [33.93, 58.04], [31.1, 58.11]];

  // x, z: centre (GEO m, +x east, +z south). r: radius of the spot circle (ignored inside a fence: poly).
  // name: the sign; short: the same name without "The" (tags, cards, messages); the: in a sentence ("at the Fountain").
  // One name per spot everywhere (signs, tags, cards, messages, Park Report): no nicknames.
  // slotR: how far from the centre groups stand. rot: slot ring rotation (radians). Holley and Garibaldi sit a few
  // metres off their statues, on the plazas, so that both are as far from the Fountain (tools/hangout-lab.js travel).
  const spots = {
    fountain: { id: 'fountain', name: 'The Fountain', short: 'Fountain', the: 'the Fountain', x: 0, z: 0, r: 17, slotR: 13, rot: 0,
      blurb: 'The rim of the fountain. Everyone\'s favourite bench.' },
    holley: { id: 'holley', name: 'Holley Plaza', short: 'Holley Plaza', the: 'Holley Plaza', x: -64, z: 0, r: 11, slotR: 4.5, rot: 0,
      blurb: 'A bust of a steel engineer, a mutual aid table, plenty of pavement.' },
    garibaldi: { id: 'garibaldi', name: 'Garibaldi', short: 'Garibaldi', the: 'Garibaldi', x: 61, z: -6, r: 11, slotR: 4.5, rot: 0,
      blurb: 'The General, mid-draw, on a plinth. Shade in the afternoon.' },
    // The playground gate (a circle on the path just outside the fence, not the fenced interior): from
    // Fifth Avenue it is as far as the Dog Run is from Thompson Street. TODDLER is kept for render.
    toddler: { id: 'toddler', name: 'Toddler Playground', short: 'Toddler Playground', the: 'the Toddler Playground', x: -46, z: -52, r: 7, slotR: 3.5, rot: 0, fence: TODDLER,
      blurb: 'The benches by the playground gate. Strollers, snacks, opinions about naps.' },
    smallrun: { id: 'smallrun', name: 'Small Dog Run', short: 'Small Dog Run', the: 'the Small Dog Run', x: 31.5, z: 62.5, r: 11, poly: SMALL_RUN, slotR: 4, rot: 0,
      blurb: 'A fenced run for small dogs, with one gate on the Kempner side.' },
    // Measured alternatives (tools/hangout-lab.js --layout): not used by the default layout.
    arch: { id: 'arch', name: 'Arch Plaza', short: 'Arch', x: 0, z: -42, r: 11, slotR: 4.5, rot: 0, blurb: 'Under the Arch. Photo op.' },
    chess: { id: 'chess', name: 'Chess Plaza', short: 'Chess', x: -134, z: 49, r: 11, slotR: 4.5, rot: 0, blurb: 'The tables.' },
    grove: { id: 'grove', name: "Hangman's Grove", short: 'Grove', x: -136, z: -48, r: 11, slotR: 4.5, rot: 0, blurb: 'The old elm.' },
    bobst: { id: 'bobst', name: 'Bobst Gate', short: 'Bobst', x: 104, z: 60, r: 11, slotR: 4.5, rot: 0, blurb: 'The library steps.' },
    kempner: { id: 'kempner', name: 'Kempner Corner', short: 'Kempner', x: 14.8, z: 47.7, r: 10, slotR: 4.5, rot: 0, blurb: 'By the small run.' },
    playhills: { id: 'playhills', name: 'Play Hills', short: 'Hills', x: -105, z: 42, r: 11, slotR: 4.5, rot: 0, blurb: 'Turf mounds.' },
  };

  // Home entrances: groups start here and come back here from coffee. Real park entrances.
  const entrances = {
    north: { id: 'north', name: 'Fifth Avenue', nick: 'under the Arch', x: 0, z: -73 },   // z -73: the Fountain is exactly as far as from Thompson St
    south: { id: 'south', name: 'Thompson Street', nick: 'from Thompson St', x: -12, z: 70 },
    west: { id: 'west', name: 'West Washington Place', nick: 'from the west', x: -159, z: 1 },
    east: { id: 'east', name: 'Washington Place', nick: 'from the east', x: 131, z: 2 },
    // alternatives measured by the lab
    nw: { id: 'nw', name: 'MacDougal & Waverly', x: -158, z: -69 },
    se: { id: 'se', name: 'LaGuardia & W 4th', x: 131, z: 70 },
  };

  // Layouts: spots + entrances in player-count order (1v1 uses the first two). Chosen by measuring
  // walking times (DESIGN-V2.md §3): the Fountain, Holley and Garibaldi are ~equally far from both
  // entrances; the Toddler Playground is north's near spot and the Small Dog Run is south's.
  const layouts = {
    park: { id: 'park', name: 'Washington Square Park', spots: ['toddler', 'holley', 'fountain', 'garibaldi', 'smallrun'],
      entrances: ['north', 'south', 'west', 'east'] },
    // Rejected candidates kept for the lab.
    corners: { id: 'corners', name: 'Corners', spots: ['grove', 'holley', 'fountain', 'smallrun', 'bobst'], entrances: ['nw', 'se', 'west', 'east'] },
    archline: { id: 'archline', name: 'Arch line', spots: ['arch', 'holley', 'fountain', 'garibaldi', 'kempner'], entrances: ['north', 'south', 'west', 'east'] },
  };

  // ------------------------------------------------------------------ crews: named groups and lines
  // Presentation only: every group plays by identical rules. members is how many people render draws.
  const crews = {
    hustle: {
      groups: [
        { key: 'oldHeads', name: 'The Old Heads', short: 'Old Heads', members: 4, blurb: 'At these tables since 1987. Brought their own chairs.' },
        { key: 'speedPlayers', name: 'The Speed Players', short: 'Speed Players', members: 5, blurb: 'Blitz only. They talk faster than they move.' },
        { key: 'kibitzers', name: 'The Kibitzers', short: 'Kibitzers', members: 6, blurb: 'Not playing. Advising.' },
      ],
      lines: {
        settle: ['Unfolding the chairs.', 'Setting up the board.', 'Who has the clock?', 'Pieces out. White to move.'],
        settled: ['Board\'s set. Five dollars a game.', 'Tables are open.', 'Sit down, sit down.'],
        argue: ['That is my chair.', 'We play here. Every day.', 'You are standing on my rook.', 'Excuse me, there is a game on.'],
        tired: ['My back is not built for this.', 'I am checking my watch.', 'Fine. One more minute.'],
        coffee: ['I resign. Coffee.', 'Clock flag. I need an espresso.', 'Good game. Not really.', 'Back in fifteen. Same table.'],
        back: ['Okay. Where was I?', 'Coffee. Better.', 'Back. Who moved my chair?'],
        still: ['Still?', 'You are STILL here?', 'This again.'],
        evict: ['And stay out.', 'Good game. Not really.', 'More room for the board.'],
        withdraw: ['Not worth the blunder.', 'We will adjourn.', 'Strategic retreat.'],
      },
    },
    noise: {
      groups: [
        { key: 'drummers', name: 'The Bucket Drummers', short: 'Drummers', members: 4, blurb: 'Audible from Sixth Avenue.' },
        { key: 'horns', name: 'The Horn Section', short: 'Horns', members: 5, blurb: 'Two saxes, a trombone, one opinion.' },
        { key: 'tambourines', name: 'The Tambourine Kids', short: 'Tambourines', members: 6, blurb: 'Join any jam. Uninvited.' },
      ],
      lines: {
        settle: ['Mic check. Bucket check.', 'Tuning up.', 'Hat goes down here.', 'From the top.'],
        settled: ['And a one, and a two...', 'This is our stage now.', 'Requests? No requests.'],
        argue: ['We are mid-set!', 'You are blocking the tip jar.', 'This is a public venue.', 'Can you not stand in our sound?'],
        tired: ['My lips are tired.', 'Last song. Probably.', 'The bucket is cracking.'],
        coffee: ['That\'s the set. Coffee.', 'Off to the subway platform. Better acoustics.', 'Encore? No? Okay.', 'Gotta save my lips.'],
        back: ['Back for the second set.', 'Okay, where were we?', 'Rested lips.'],
        still: ['Still?', 'Same crowd as before.', 'You again.'],
        evict: ['Thank you, goodnight!', 'Tip your musicians.', 'More room to dance.'],
        withdraw: ['Moving the gig.', 'Wrong room anyway.', 'We will play elsewhere.'],
      },
    },
    violets: {
      groups: [
        { key: 'rugby', name: 'The Rugby Club', short: 'Rugby Club', members: 4, blurb: 'Practice is wherever there is grass.' },
        { key: 'debate', name: 'The Debate Team', short: 'Debate Team', members: 5, blurb: 'Well, actually.' },
        { key: 'freshmen', name: 'The Freshmen', short: 'Freshmen', members: 6, blurb: 'Orientation was last week. Still lost.' },
      ],
      lines: {
        settle: ['Is this spot taken? It is now.', 'Picnic blanket deployed.', 'Group selfie first.', 'Setting up a study group.'],
        settled: ['We are holding a study group here.', 'This is a campus now.', 'Pinned the location.'],
        argue: ['Actually, it\'s a public space.', 'We booked this. Sort of.', 'Can we circle back to us being here first?', 'Point of order!'],
        tired: ['I have a class in ten.', 'My group chat is blowing up.', 'This is giving... no.'],
        coffee: ['I need a cold brew.', 'Going to Bobst to cry quietly.', 'I have a midterm. Bye.', 'Gonna go to the dining hall.'],
        back: ['Okay, I am back.', 'Iced coffee acquired.', 'Did we win yet?'],
        still: ['Still?', 'Wait, you are still here?', 'Literally still?'],
        evict: ['Rebuttal accepted.', 'Motion carried.', 'Bye! Bye!'],
        withdraw: ['Tabling this.', 'We will circle back.', 'Not our hill.'],
      },
    },
    pack: {
      groups: [
        { key: 'proWalkers', name: 'The Pro Walkers', short: 'Pro Walkers', members: 4, blurb: 'Eight leashes each. It is choreography.' },
        { key: 'fetchDads', name: 'The Fetch Dads', short: 'Fetch Dads', members: 5, blurb: 'Ball launchers, cargo shorts, opinions.' },
        { key: 'smallDogs', name: 'The Small Dogs', short: 'Small Dogs', members: 6, blurb: 'Small dogs. Big feelings.' },
      ],
      lines: {
        settle: ['Sniffing everything first.', 'Water bowl down.', 'Off leash! Kidding.', 'Finding the right patch.'],
        settled: ['Good spot. Good dogs.', 'This is the dog run now.', 'Sit. Stay. Hang out.'],
        argue: ['He\'s friendly! He\'s just loud.', 'Do you mind? He\'s sniffing.', 'Leash your attitude.', 'She was here first.'],
        tired: ['He\'s getting restless.', 'Somebody needs a walk.', 'The leashes are tangling.'],
        coffee: ['Okay buddy, coffee and home.', 'He needs to go potty.', 'Treat time. Elsewhere.', 'Walk is over. He decided.'],
        back: ['Okay, buddy, back we go.', 'Refreshed. Mostly the dogs.', 'Round two.'],
        still: ['Still?', 'Oh. You.', 'They are still here, buddy.'],
        evict: ['Good boy.', 'Who\'s a good crew?', 'And stay out.'],
        withdraw: ['Come on, buddy. Not worth it.', 'Different spot.', 'Leash up, we\'re moving.'],
      },
    },
  };

  // Lines anyone can say (fallbacks). The Park Report and UI may use these too.
  const lines = {
    mutual: ['Both crews went for coffee. Together. Awkward.', 'Everyone left. The pigeons won.'],
    settleStart: '{GROUP} are settling in at {SPOT}.',
    settled: '{GROUP} are hanging out at {SPOT}: +1 a second.',
    arguing: '{GROUP} are arguing at {SPOT}.',
    coffee: '{GROUP} went for coffee. Back in {T}.',
    returned: '{GROUP} are back at {ENTRANCE}.',
  };

  const vocab = {
    spot: 'spot', spots: 'spots', hanging: 'hanging out', settling: 'settling in', arguing: 'arguing',
    patience: 'patience', coffee: 'went for coffee', backIn: 'back in {T}', points: 'points',
    goal: 'Your crew earns by hanging out somewhere. The other crew has to make it leave.',
    rulesShort: [
      'Send a group to a spot. After 3 quiet seconds it hangs out: +1 point a second.',
      'Rivals at the same spot argue. Each rival drains your patience.',
      'At zero patience a group goes for coffee and comes back in 15 s.',
      'Most points when the clock hits 0:00 wins.',
    ],
  };

  // ------------------------------------------------------------------ Park Report
  // Observation lines, filled from what actually happened ({SIDE} crew name, {GROUP} group name,
  // {SPOT} spot name, {N} number, {T} duration like "eleven seconds" / "2:05").
  // Each entry: when (a stat check done by SQ.Hangout.report) + text. The report picks the 4 most
  // interesting ones that fired, player first.
  const report = {
    lines: [
      { id: 'heldVsArgued', text: 'Held {SPOT} for {T}. Argued about it for {T2}.' },
      { id: 'longest', text: '{GROUP} hung out at {SPOT} for {T} straight.' },
      { id: 'coffeeKing', text: '{GROUP} went for coffee {N} times. They know the barista now.' },
      { id: 'neverCoffee', text: '{GROUP} never went for coffee. Not once.' },
      { id: 'mutual', text: 'Both crews gave up at {SPOT} at the same moment, {N}. Nobody held it, so nobody stayed.' },
      { id: 'mutualSpots', text: 'Both crews gave up at the same moment {N}, {K} at {SPOT}. Nobody held it, so nobody stayed.' },
      { id: 'mutualOne', text: 'At {SPOT}, both crews gave up at the same moment and went for coffee together.' },
      { id: 'evictions', text: 'Made {N} rival groups give up and go for coffee.' },
      { id: 'twoOnOne', text: 'Won {N} arguments two against one. Numbers help.' },
      { id: 'withdrawals', text: 'Walked away from {N} arguments before running out of patience.' },
      { id: 'walked', text: '{GROUP} walked {N} meters. That is about {B} city blocks.' },
      { id: 'neverVisited', text: 'Nobody ever hung out at {SPOT}. It misses you.' },
      { id: 'changedHands', text: '{SPOT} changed hands {N} times.' },
      { id: 'comeback', text: 'Came back from {N} points down.' },
      { id: 'blownLead', text: 'Led by {N} points. Then did not.' },
      { id: 'photoFinish', text: 'Decided by {N}. Photo finish.' },
      { id: 'draw', text: 'A draw. Same time tomorrow?' },
      { id: 'idle', text: '{GROUP} spent {T} standing around not hanging out anywhere.' },
    ],
  };

  // ------------------------------------------------------------------ AI difficulties (js/sim/hangout-ai.js)
  //   think: s between decisions;  react: s before it notices what the rival crew did (where they were sent,
  //   their patience);  lazyStart: s it dawdles at the start;  help: send help to a losing argument
  //   (false | 'spares' | 'holders': may also pull a group off another spot);  walkAway: leave an argument it
  //   would lose (holders when walkAwayAt s of patience are left);  smartReturn: after coffee, don't walk
  //   back into a lost cause;  attack: start arguments;  pairs: two against one;  pull: take a group off a
  //   spot to attack ('never' | 'behind' | 'always');  attackEvery: s between attacks it starts;  noticeFree: s a spot
  //   that comes free must stay free before it sends a group there (spots free at its first look count at once);
  //   horizon/tail/margin/noise: the forward model that scores attacks (s looked ahead, s of holding counted after
  //   it, points it must beat carrying on by, jitter)
  const ai = {
    // Easy: slow to react, slow to notice a spot that came free, and an argument of its own only every 2.5 minutes.
    easy: { think: 5, react: 4, lazyStart: 10, help: false, walkAway: false, smartReturn: false, attack: true, pairs: true, pull: 'always',
      attackEvery: 150, noticeFree: 15, horizon: 45, tail: 10, margin: 0, noise: 6, responders: ['static'] },
    normal: { think: 2, react: 1.5, lazyStart: 0, help: 'spares', walkAway: true, walkAwayAt: 3, smartReturn: true, attack: true, pairs: true,
      pull: 'always', attackEvery: 20, horizon: 60, tail: 15, margin: 4, noise: 3, responders: ['static'] },
    hard: { think: 1, react: 0.5, lazyStart: 0, help: 'spares', walkAway: 'swap', walkAwayAt: 6, smartReturn: true, attack: true, pairs: true,
      pull: 'always', attackEvery: 0, horizon: 60, tail: 15, margin: 2, noise: 1, responders: ['static', 'reactive'] },
  };

  // ------------------------------------------------------------------ tutorial / mission scenarios
  // Config for SQ.Hangout.create({ scenario: id, crew, rival }) (or merge the object into cfg yourself).
  //   spots:    subset of the layout's spots that are in play (others are not drawn as spots)
  //   length:   0 = untimed;  groups: per side, the group slots that exist and where they start
  //             at: 'entrance' | spotId (already there, arrived) | {x, z};  patience;  coffee: s left on a break
  //   holders:  { spotId: side } spots already settled at the start
  //   ai:       the rival's brain: { difficulty, flags }. flags: passive (never moves), holdOnly (takes empty spots,
  //             never argues for a held one), singleGroup (only its first group acts), noReturn (stays at the
  //             entrance after coffee), noReinforce, script: [{ at: s, group: slot, to: spotId }]
  //   rules:    rule overrides for this lesson only (e.g. slower arguments so there is time to react)
  //   goal:     what the tutorial checks with SQ.Hangout.checkGoal(match, goal) -> { done, progress, text }
  //   coach:    suggested coach lines for the UI (one at a time)
  const scenarios = {
    lookAround: {
      id: 'lookAround', title: 'Look around', teaches: 'Moving the camera',
      spots: ['fountain', 'holley', 'garibaldi', 'toddler', 'smallrun'], length: 0,
      groups: [[{ slot: 0, at: 'entrance' }, { slot: 1, at: 'entrance' }, { slot: 2, at: 'entrance' }], []],
      ai: { difficulty: 'easy', flags: { passive: true } },
      goal: { type: 'camera', text: 'Drag to look around. Find the five spots.' },
      coach: ['Drag to look around the park.', 'Pinch or use + and - to zoom.', 'Tap the minimap to jump.', 'The house button brings you back to your crew.'],
    },
    firstSpot: {
      id: 'firstSpot', title: 'Hang out', teaches: 'Sending a group; settling in; points',
      spots: ['fountain'], length: 0,
      groups: [[{ slot: 0, at: { x: 0, z: -40 } }], []],
      ai: { difficulty: 'easy', flags: { passive: true } },
      goal: { type: 'points', n: 10, text: 'Send the group to the Fountain and earn 10 points.' },
      coach: ['Tap your group, then tap the Fountain.', 'Settling in: 3 quiet seconds.', 'Hanging out: +1 point every second.'],
    },
    spread: {
      id: 'spread', title: 'Three groups, five spots', teaches: 'Covering spots with all three groups',
      spots: ['fountain', 'holley', 'garibaldi', 'toddler', 'smallrun'], length: 0,
      groups: [[{ slot: 0, at: 'entrance' }, { slot: 1, at: 'entrance' }, { slot: 2, at: 'entrance' }], [{ slot: 0, at: 'smallrun' }]],
      holders: { smallrun: 1 },
      ai: { difficulty: 'easy', flags: { passive: true } },
      goal: { type: 'holdCount', count: 3, text: 'Get all three groups hanging out at three different spots.' },
      coach: ['Each group can hang out at one spot.', 'Two groups at one spot still earn just +1.', 'Spread out.'],
    },
    argue: {
      id: 'argue', title: 'Make them leave', teaches: 'Arguing, patience, two against one',
      spots: ['fountain', 'garibaldi'], length: 0,
      groups: [[{ slot: 0, at: { x: -20, z: -30 } }, { slot: 1, at: { x: -24, z: -32 } }], [{ slot: 0, at: 'fountain' }]],
      holders: { fountain: 1 },
      ai: { difficulty: 'easy', flags: { passive: true } },
      goal: { type: 'take', spot: 'fountain', text: 'Send BOTH groups to the Fountain and make them leave.' },
      coach: ['They are hanging out at the Fountain. They keep earning while you argue.',
        'Each rival drains your patience. Two of you drain them twice as fast.', 'Send both groups.'],
    },
    walkAway: {
      id: 'walkAway', title: 'Know when to leave', teaches: 'Withdrawing to recover patience; going for coffee',
      spots: ['fountain', 'holley', 'garibaldi'], length: 0,
      groups: [[{ slot: 0, at: 'fountain', patience: 60 }], [{ slot: 0, at: 'fountain' }, { slot: 1, at: { x: 30, z: -10 } }]],
      holders: { fountain: 0 }, rules: { drainPerRival: 3 },
      ai: { difficulty: 'easy', flags: { singleGroup: false, script: [{ at: 2, group: 1, to: 'fountain' }], holdOnly: true } },
      goal: { type: 'recover', text: 'Two against one: walk away to Holley before your patience runs out.' },
      coach: ['Two rivals: your patience drains twice as fast.', 'Tap your group, then tap Holley. Walking away is allowed.',
        'Patience refills when nobody argues with you.', 'Or stay, and go for coffee: back in 15 s at your entrance.'],
    },
    firstMatch: {
      id: 'firstMatch', title: 'First afternoon', teaches: 'A whole 5-minute match',
      spots: ['toddler', 'holley', 'fountain', 'garibaldi', 'smallrun'], length: 300,
      ai: { difficulty: 'easy', flags: {} },
      goal: { type: 'win', text: 'Have more points than them when the clock hits 0:00.' },
      coach: ['Most points at 0:00 wins.', 'Five spots, three groups each: someone is always short.'],
    },
  };

  SQ.data.hangout = {
    modeName: 'Hang Out', classicName: 'Classic',
    rules, spots, entrances, layouts, crews, lines, vocab, report, ai, scenarios,
    difficulties: ['easy', 'normal', 'hard'],
    difficultyNames: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
  };
})(window.SQ = window.SQ || {});
