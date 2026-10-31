// SQUARE OFF — all the words: exit lines, barks, announcer, Field Guide, loading facts, tips.
// Tone: affectionate, grounded comedy. Archetypes only - no real named individuals.
// Templates: {CREW} crew name, {LM} landmark name, {UNIT} unit name, {N} number.
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  // ~80 "Over It" exit lines. Generic ones apply to everyone; faction lists add flavour.
  const exitLines = {
    any: [
      "I'm going to Think Coffee.",
      'I need a bathroom. The only bathroom.',
      'My MetroCard is calling me.',
      'This is not my scene anymore.',
      "I'll be at the Mamoun's line.",
      'I have a 7 PM. Somewhere.',
      'Okay, okay. I get it.',
      'I just remembered I left the oven on.',
      'My therapist will hear about this.',
      "I'm going to go stare at the Hudson.",
      'Fine. FINE.',
      "I'm getting a slice.",
      'Gonna go sit on a stoop on Bleecker.',
      'I was leaving anyway.',
      "This is why I don't come above 14th... wait.",
      'Taking the A train. Any train.',
      'I need to recharge. Literally, my phone is at 2%.',
      'Gonna go look at books I will not buy at the Strand.',
      'My knees are done.',
      "I'll tell my side on Reddit.",
      'Off to Washington Square... oh. I am here. Leaving.',
      'Somebody owes me a coffee.',
      'I came here to relax.',
      'Calling it a day. A whole day.',
      "I'm going to Joe's. Not Joe's Pizza. The other Joe's.",
      "Not today, Washington.",
      'I have to walk my... never mind.',
      'This bench was better in 2009.',
      'Rent is due. Emotionally.',
      'Going to Café Reggio to feel things.',
      "I'm gonna go find a pigeon who respects me.",
      'Uber says 9 minutes. I am walking.',
    ],
    hustle: [
      'Good game. Not really.',
      'I resign. Shake my hand.',
      "I'll be back tomorrow at noon. Same table.",
      'Clock flag. Unbelievable.',
      'Back in my day this was a real park.',
      'I lost on time, not on position!',
      'Five dollars? For that? Keep it.',
      'Going to go blitz online like a coward.',
      'Somebody took my chair.',
      'Draw? No? Okay.',
    ],
    noise: [
      "That's the set. Tip your musicians.",
      'My bucket has a crack in it now.',
      'Off to busk at Union Square.',
      'I need new reeds anyway.',
      "Nobody claps on the two and four here.",
      'My tambourine needs a lie-down.',
      'Going to the subway platform. Better acoustics.',
      'I was off-key and I know it.',
      'Encore? No? Okay.',
      'Gotta save my lips for the gig.',
    ],
    violets: [
      'I have a midterm.',
      'I need to go to Bobst and cry quietly.',
      'My group chat is blowing up.',
      'I have office hours. Not mine, but still.',
      'Gonna go to the dining hall. Any dining hall.',
      'This is giving... no.',
      "I'm emailing the dean.",
      'I have a paper due in four hours.',
      'Going back to Third North to nap.',
      "I'm literally so cooked.",
    ],
    pack: [
      'He needs to go potty.',
      'Okay buddy, we are going home.',
      'Biscuit has had enough.',
      'Treat time. At home.',
      "She's shaking, we're leaving.",
      'Somebody got into the trash. Bye.',
      "He found a chicken bone, we're going to the vet.",
      'Leash tangle. Leaving forever.',
      'Gonna try the Tompkins dog run.',
      'Walk is over. He decided.',
    ],
    squirrels: [
      'Chk chk chk.',
      '*runs up a tree*',
      '*drops a pretzel and flees*',
      '*chitters in a disrespectful tone*',
      '*vanishes into the canopy*',
    ],
  };

  // Comic reasons for the Park Report ("most common reason: ...").
  const exitReasons = ['needed a bathroom', 'went for coffee', 'had a midterm', 'the dog had to go', 'lost on time', 'went for a slice', 'phone died', 'emotionally done'];

  // AI barks, by situation. Shown as text bubbles and the 'aiBark' event.
  const barks = {
    attack: [
      'The {UNIT} crew is heading for {LM}!',
      '{CREW} are coming for {LM}.',
      'Everybody to {LM}. Now.',
      "{LM} looks lonely. Let's keep it company.",
      'We want {LM}. Nicely. Mostly.',
    ],
    defend: [
      'Hold {LM}! Hold it!',
      'Nobody touches {LM}.',
      'Back to {LM}, they are on it!',
    ],
    retreat: [
      'Fall back, fall back!',
      'Nope. Regroup.',
      "This isn't worth it. Back off.",
    ],
    crewCall: [
      '{CREW}: it is time.',
      'Oh, you are going to love this.',
      'Everybody - now!',
    ],
    win: ['Good game. The park is ours.', 'Same time tomorrow?'],
    lose: ["We'll be back tomorrow.", 'The park was rigged.'],
    bathroom: [
      'Somebody secure the Park House. For reasons.',
      'The only bathroom must be protected.',
      'Strategic bathroom break.',
      'We hold the bathroom, we hold the park.',
    ],
    night: ['The Arch is lit. Go, go, go.', 'Night time. Everybody to the Arch.'],
    taunt: [
      'Your bench game is weak.',
      'Nice landmark. Would be a shame if somebody stood on it.',
      'Is that your whole crew?',
    ],
  };

  const personalityBarks = {
    hustler: ['Every landmark is a bet. I like my odds.', 'Expand, expand, expand.', 'Cash first, fight later.'],
    mosh: ['CHAAAARGE!', 'More bodies! More!', 'We go now!'],
    turtle: ['We hold what we have.', 'Build every pad.', 'Night is coming. Patience.'],
    opportunist: ['They left it open. Rude not to.', 'Hit the carts.', 'Small squads, big trouble.'],
    passive: ['*chitter*', '*suspicious nut burying*'],
  };

  const announcer = {
    start: ['The park is open. Five minutes, five dollars, the whole park.', 'Washington Square, 4 PM. Let\'s go.'],
    phaseWarn: {
      golden: 'Golden Hour in 20 s - the Fountain pays more, the kids go home.',
      night: 'Night in 20 s - the Arch lights up. 2 Turf a second.',
    },
    phase: {
      afternoon: 'Afternoon: the after-work dog rush. Dog runs pay 1.5x.',
      golden: 'Golden Hour. Fountain Clout 1.5x. Playground 0.5x.',
      night: 'Night. The Arch is floodlit: 2 Turf/s. The old elm gets creepy.',
    },
    capture: '{CREW} take {LM}!',
    lost: 'You lost {LM}.',
    contested: '{LM} is under attack!',
    neutral: '{LM} is up for grabs.',
    crewCall: '{CREW}: {CALL}!',
    closingSoon: 'The park closes in 60 seconds.',
    close: 'Park closed.',
    suddenDeath: 'Dead heat! Sudden death at the Fountain - 60 seconds!',
    nearWin: '{CREW} are within 200 Turf of the park!',
    comeback: 'Word of Mouth: {CREW} are rallying - cheaper recruits, faster captures.',
    eliminated: '{CREW} have left the park.',
    victory: '{CREW} WIN THE SQUARE',
    defeat: 'You left the park.',
    regular: 'A regular shows up at {LM}.',
    built: '{SETUP} is up at {LM}.',
    recruitReady: '{UNIT} ready.',
  };

  // Field Guide: two lines of real park trivia each.
  const fieldGuide = {
    landmarks: {
      fountain: ['The fountain was completed in 1852 and redesigned in 2009 so that it lines up with the Arch and Fifth Avenue.', 'On hot days the basin turns into the most popular wading pool below 14th Street.'],
      arch: ['The marble Arch was designed by Stanford White and finished in 1892, replacing a wooden arch built for the 1889 centennial of Washington\'s inauguration.', 'Its two statues of George Washington - at war and at peace - stand on the north face of the piers.'],
      chess: ['The southwest corner has been the park\'s chess hub for decades; the stone tables are inlaid with boards.', 'Hustlers play speed chess for small stakes - and they will happily talk you through your mistakes.'],
      grove: ['The English elm in the northwest corner is often called the oldest tree in Manhattan, estimated at over 300 years old.', 'Legend calls it the "Hangman\'s Elm", though historians doubt anyone was ever hanged from it.'],
      holley: ['The bust of Alexander Lyman Holley, an engineer who helped bring the Bessemer steel process to America, was dedicated in 1890.', 'Nearby, a community Mutual Aid table has shared free food and supplies.'],
      garibaldi: ['The bronze statue of Giuseppe Garibaldi was dedicated in 1888 by Italian-American residents of the city.', 'It was moved during the 1970 renovation; a time capsule was found in its base.'],
      bigrun: ['The large dog run sits in the park\'s south side next to the Park House.', 'Afternoons after work it is the busiest social club in the Village.'],
      playground: ['The main playground sits in the northeast quadrant and was rebuilt in the park\'s 2009-2014 renovation.', 'By Golden Hour most of the kids have been collected for dinner.'],
      smallrun: ['The small dog run is named for a beloved local dog trainer and advocate.', 'Nearby stands a marker honoring Margaret Loeb Kempner, a dedicated local park volunteer.'],
      bobst: ['Elmer Holmes Bobst Library, NYU\'s main library, faces the park\'s southeast corner; it opened in 1973.', 'It is twelve stories of red sandstone designed by Philip Johnson and Richard Foster.'],
      judson: ['Judson Memorial Church, designed by McKim, Mead & White, was completed in 1893 on Washington Square South.', 'Its campanile is a Village landmark, and the church has long been a home for art and activism.'],
      toddler: ['The toddler playground in the north of the park has gentle mounds and a sandbox.', 'In the morning it is ruled by people under three feet tall.'],
      playhills: ['The "Play Hills" in the southwest are artificial-turf mounds built in the renovation.', 'Kids roll down them; adults pretend they are not tempted.'],
      parkHouse: ['The Park House holds the park\'s public restrooms and maintenance rooms.', 'It is, as everyone will tell you, the only bathroom.'],
      dosa: ['A vegan dosa cart has been a fixture on the park\'s south side for years.', 'The line moves fast. The dosas do not last long.'],
    },
    units: {
      'hustle.crowd': ['Kibitzers watch the games and comment on every move.', '"Kibitz" comes from Yiddish - to offer unwanted advice. They do.'],
      'hustle.talker': ['Speed hustlers play blitz with a chess clock, a few dollars a game.', 'Many will play anyone, any time, and talk the whole way.'],
      'hustle.heavy': ['The old heads have been coming to the tables for decades.', 'Some bring their own folding chair. Nobody else sits in it.'],
      'noise.crowd': ['Kids with tambourines join any jam that will have them.', 'They speed everyone up, rhythmically and otherwise.'],
      'noise.talker': ['Saxophonists play the fountain plaza on warm evenings.', 'The plaza\'s acoustics bounce sound off the Arch.'],
      'noise.heavy': ['Bucket drummers turn plastic paint buckets into full drum kits.', 'They are audible from Sixth Avenue.'],
      'violets.crowd': ['NYU\'s colors are violet and white, and its buildings ring the park.', 'Freshmen arrive in late August and immediately get lost.'],
      'violets.talker': ['University debate teams practice argument out loud, in public.', 'Well, actually...'],
      'violets.heavy': ['Club rugby teams train wherever they can find grass in Manhattan.', 'The scrum is a legal way to push people.'],
      'pack.crowd': ['Small dogs are a big part of Village life.', 'They are faster than they look and louder than they need to be.'],
      'pack.talker': ['The ball launcher is a dog park essential.', 'Every third throw is a fake. The dog knows.'],
      'pack.heavy': ['Professional dog walkers can handle eight leashes at once.', 'It looks chaotic. It is choreography.'],
      'squirrels.crowd': ['Eastern gray squirrels are everywhere in the park.', 'They are not afraid of you. They have never been afraid of you.'],
    },
    events: {
      piano: ['A traveling pianist has wheeled a grand piano into the park for years.', 'He plays under the trees and near the Arch on good days.'],
      pigeonLady: ['Pigeon feeders are a park tradition, much to the parks department\'s dismay.', 'A hundred pigeons can arrive in under a minute.'],
      squirrelHeist: ['Squirrels raid unattended snacks with professional precision.', 'Food carts are their favorite targets.'],
      pep: ['Parks Enforcement Patrol (PEP) officers keep the peace in city parks.', 'When they walk by, everybody suddenly behaves.'],
      tourists: ['Tour groups gather under the Arch for photos looking up Fifth Avenue.', 'The Empire State Building lines up perfectly through the Arch.'],
      shower: ['Summer storms roll in fast over the Village.', 'Everyone runs for the Arch.'],
      iceCream: ['Ice cream trucks park on the streets around the square every summer.', 'You will hear the jingle before you see it.'],
      bells: ['Judson\'s bell tower rises over Washington Square South.', 'When the bells ring, people look up.'],
      graduation: ['NYU holds commencement celebrations around the park, and the Arch turns violet.', 'Thousands of purple gowns fill the streets.'],
    },
  };

  const loadingFacts = [
    'Washington Square Park covers about 9.75 acres in Greenwich Village.',
    'The park was a potter\'s field until 1825. Do not think about that during the game.',
    'Fifth Avenue starts at the Arch.',
    'The fountain was aligned with the Arch in the 2009 renovation.',
    'The northwest elm may be the oldest tree in Manhattan.',
    'Buses once turned around beside the fountain. Neighborhood activists closed the park to traffic around 1960.',
    'The Row on Washington Square North dates from the 1830s.',
    'Every bench in this game is a real bench. Every lamp, too.',
    'The park has two dog runs: one big, one for small dogs.',
    'Five minutes, five dollars, the whole park.',
  ];

  // Park Report actionable tips, keyed by what went wrong.
  const tips = {
    lostToCounter: 'You lost a lot of {CLS} to {WEAK}. Bring {BEATS} - shapes beat shapes.',
    lowIncome: 'Your income stayed under 5/s. Build a Food Cart early - it pays for itself in 90 s.',
    noSetups: 'You never built a Setup. Pads at your landmarks are free money (and a stake).',
    noCrewCall: 'You finished with a full Crew Call meter. Use it - it recharges.',
    ignoredNight: 'At Night the Arch pays 2 Turf/s. Plan to hold it after 10 PM.',
    overextended: 'You owned a lot but held little. Defend fewer landmarks with more units.',
    turtled: 'You held 3 landmarks or fewer most of the match. Expand - every landmark is Turf.',
    neverRallied: 'Set a forward Rally point at a landmark near home to reinforce faster.',
    won: 'Try a harder AI, or the Daily Park.',
  };

  const wipeWords = { hustle: 'OUT-HUSTLED', noise: 'DROPPED THE BEAT', violets: 'SCHOOLED!', pack: 'BAD DOG DAY', squirrels: 'NUTS!' };

  const personalities = {
    hustler: { name: 'Hustler', style: 'greedy', quote: '"Every landmark is a bet. I like my odds."', weakness: 'Early rush' },
    mosh: { name: 'Mosh Pit', style: 'rush', quote: '"More bodies. More!"', weakness: '■ and Boomboxes' },
    turtle: { name: 'Turtle', style: 'turtle', quote: '"We hold what we have."', weakness: 'Being out-scored elsewhere; long ▲ sieges' },
    opportunist: { name: 'Opportunist', style: 'raider', quote: '"You left it open. Rude not to."', weakness: 'Grouped defense; Hangman\'s Grove at Night' },
    passive: { name: 'Squirrel', style: 'passive', quote: '"*chitter*"', weakness: 'Dogs' },
  };

  const difficulties = {
    chill: { name: 'Chill', text: 'Slow reactions, telegraphed attacks.' },
    regular: { name: 'Regular', text: 'A fair fight.' },
    hard: { name: 'Hard', text: 'Feints and two-prong raids.' },
    legend: { name: 'Park Legend', text: 'Sees further, earns more. Good luck.' },
  };

  /** Fill a template string. */
  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));
  }

  SQ.data.text = { exitLines, exitReasons, barks, personalityBarks, announcer, fieldGuide, loadingFacts, tips, wipeWords, personalities, difficulties, fill };
})(window.SQ = window.SQ || {});
