// SQUARE OFF — landmarks and Home Spots (DESIGN §4). GEO meters: +x east, +z south.
// Pads are glowing paver squares beside real GEO benches (computed against the nav grid; see test/nav.test.js).
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  // Real fence polygons for the fenced capture areas (GEO.barriers big/small dog run).
  const BIG_RUN = [[-46.65, 52.09], [-43.78, 53.42], [-39.87, 55.76], [-37.04, 57.52], [-34.95, 59.64], [-33.93, 61.37], [-33.8, 63.58], [-35, 65.06], [-37.32, 66.1], [-72.47, 66.05], [-72.43, 67.98], [-74.7, 68.02], [-82.36, 66.88], [-84.84, 65.24], [-85.56, 63.21], [-85.39, 61.47], [-83.96, 57.5], [-80.89, 54.12], [-77.32, 51.29], [-76.76, 51.01], [-75.96, 50.6], [-74.79, 50.02], [-72.57, 49.17], [-70.03, 48.52]];
  const SMALL_RUN = [[29.3, 58.36], [29.4, 59.85], [24.39, 60.32], [22.78, 61.07], [21.71, 62.46], [21.74, 64.15], [22.62, 65.67], [24.16, 66.59], [26.7, 66.67], [37.57, 66.34], [39.83, 65.84], [41.03, 65.02], [41.78, 63.59], [41.39, 62.09], [40.47, 60.87], [38.76, 59.41], [36.7, 58.35], [33.93, 58.04], [31.1, 58.11]];

  const landmarks = [
    { id: 'fountain', name: 'The Fountain', nick: 'Center Stage', x: 0, z: 0, r: 16, clout: 3, turf: 2,
      perk: { id: 'fountain', text: 'Vision 60 m. Wade the basin (slow) - units in the water regen 3/s.', vision: 60, waterRegen: 3 },
      phase: { golden: { clout: 1.5 } }, pads: [[9.2, 2.8], [-8.7, 4.1]],
      title: 'THE FOUNTAIN IS {CREW}\'S STAGE', aiBonus: 4 },
    { id: 'arch', name: 'Arch Plaza', nick: 'Photo Op', x: 0, z: -42, r: 13, clout: 2, turf: 1,
      perk: { id: 'arch', text: 'Reveals the north half of the park. Your units in the ring get +10% Sway.', sway: 0.10, revealNorth: true },
      phase: { night: { turf: 2 } }, pads: [[7.5, -39.7], [-7.1, -38.7]],
      title: 'PHOTO OP: {CREW} TAKE THE ARCH' },
    { id: 'chess', name: 'Chess Plaza', nick: 'The Tables', x: -134, z: 49, r: 14, clout: 2.5, turf: 1,
      perk: { id: 'chess', text: '4 build pads. Talkers (▲) recruited while you hold it cost 15% less.', talkerDiscount: 0.15 },
      phase: {}, pads: [[-141.8, 41.2], [-128.1, 41.1], [-122.1, 54.1], [-127.3, 51.1]],
      title: 'CHECKMATE AT THE CHESS PLAZA' },
    { id: 'grove', name: "Hangman's Grove", nick: 'The Old Elm', x: -136, z: -48, r: 13, clout: 1.5, turf: 1,
      perk: { id: 'grove', text: 'At Night, enemies within 15 m get -20% Sway ("creepy old tree").', nightSway: -0.20, radius: 15 },
      phase: { night: { aura: 1 } }, pads: [[-127.9, -56.4], [-129.3, -40.7]],
      title: "{CREW} CLAIM HANGMAN'S GROVE" },
    { id: 'holley', name: 'Holley Monument', nick: 'Mutual Aid', x: -76, z: -3, r: 12, clout: 1.5, turf: 1,
      perk: { id: 'holley', text: 'All your units heal +1/s everywhere (the Mutual Aid table shares snacks).', heal: 1 },
      phase: {}, pads: [[-84, -8], [-72.9, -10]],
      title: 'MUTUAL AID FOR {CREW}' },
    { id: 'garibaldi', name: 'Garibaldi', nick: 'The General', x: 58, z: -6, r: 12, clout: 1.5, turf: 1,
      perk: { id: 'garibaldi', text: 'Your defenders in the ring get +20% Composure.', defend: 0.20 },
      phase: {}, pads: [[47.9, -6.6], [60, -11.2]],
      title: 'GARIBALDI SALUTES {CREW}' },
    { id: 'bigrun', name: 'Big Dog Run', nick: 'The Run', x: -60, z: 58, r: 14, poly: BIG_RUN, clout: 2, turf: 1,
      perk: { id: 'bigrun', text: 'Crowds (●) recruited while you hold it cost 10% less. The fence makes it a fortress.', crowdDiscount: 0.10 },
      phase: { afternoon: { clout: 1.5 } }, pads: [[-53.1, 60.1], [-66.5, 61.1]],
      title: 'WHO LET {CREW} OUT? BIG RUN TAKEN' },
    { id: 'playground', name: 'Main Playground', nick: 'Juice Boxes', x: 55, z: -32, r: 15, clout: 1.5, turf: 1,
      perk: { id: 'playground', text: 'Your units inside regen 4/s, even in combat ("juice boxes").', regen: 4 },
      phase: { golden: { clout: 0.5 } }, pads: [[63.6, -29.3], [46.9, -28.2]],
      title: 'RECESS BELONGS TO {CREW}' },
    { id: 'smallrun', name: 'Small Dog Run', nick: 'Kempner Corner', x: 31, z: 62.5, r: 10, poly: SMALL_RUN, clout: 1.5, turf: 1,
      perk: { id: 'smallrun', text: '+6 pop cap.', pop: 6 },
      phase: { afternoon: { clout: 1.5 } }, pads: [[23.5, 62.2], [30.1, 61.6]],
      title: 'SMALL RUN, BIG WIN FOR {CREW}' },
    { id: 'bobst', name: 'Bobst Gate', nick: 'The Library Steps', x: 104, z: 60, r: 13, clout: 2, turf: 1,
      perk: { id: 'bobst', text: 'Recruit time -25% while you hold it.', recruitTime: 0.25 },
      phase: {}, pads: [[97.6, 59.5], [111.6, 56.1]],
      title: '{CREW} CHECKED OUT BOBST GATE' },
    { id: 'judson', name: 'Judson Steps', nick: 'The Bells', x: -32, z: 86, r: 11, clout: 1.5, turf: 1,
      perk: { id: 'judson', text: 'Crew Call charges 25% faster.', crew: 0.25 },
      phase: {}, pads: [[-29.5, 79.9], [-37.9, 83]],
      title: 'THE BELLS RING FOR {CREW}' },
    // Extra landmarks for North Side / South Side / Random Spots.
    { id: 'toddler', name: 'Toddler Playground', nick: 'Sandbox Diplomacy', x: -50, z: -60, r: 10, clout: 1.5, turf: 1,
      perk: { id: 'toddler', text: 'Your units inside regen 2/s. Nobody fights near the sandbox.', regen: 2 },
      phase: { golden: { clout: 0.5 } }, pads: [[-49.7, -51.1], [-44.3, -58.2]],
      title: 'NAP TIME IS OVER: {CREW} HOLD THE SANDBOX', extra: true },
    { id: 'playhills', name: 'Play Hills', nick: 'High Ground', x: -105, z: 42, r: 12, clout: 1.5, turf: 1,
      perk: { id: 'playhills', text: 'High ground: your Talkers (▲) in the ring get +2 m range.', range: 2 },
      phase: {}, pads: [[-114.9, 37.5], [-98.1, 44.1]],
      title: '{CREW} TAKE THE HIGH GROUND', extra: true },
  ];

  // Home Spots: corner entrances, not capturable, 3 pads each.
  const homes = [
    { id: 'home_nw', name: 'Home: MacDougal & Waverly', corner: 'NW', x: -150, z: -66, r: 10, pads: [[-144.3, -64.2], [-154.5, -63.9], [-147.7, -71.6]] },
    { id: 'home_se', name: 'Home: LaGuardia & W 4th', corner: 'SE', x: 126, z: 66, r: 10, pads: [[131.7, 67.8], [128.3, 60.4], [128.1, 71.6]] },
    { id: 'home_sw', name: 'Home: MacDougal & W 4th', corner: 'SW', x: -152, z: 66, r: 10, pads: [[-157.4, 68.6], [-149.7, 60.4], [-149.9, 71.6]] },
    { id: 'home_ne', name: 'Home: University Pl', corner: 'NE', x: 126, z: -64, r: 10, pads: [[131.7, -62.2], [120.6, -61.4], [128.3, -69.6]] },
  ];

  // Setups (§3.4). Specials are one per landmark, buildable only by their faction (they flip like any Setup).
  const setups = {
    cart: { id: 'cart', name: 'Food Cart', cost: 90, buildTime: 6, clout: 1.0, heal: 2, healRadius: 8, text: '+1 Clout/s; allies within 8 m heal 2/s. Squirrel bait.' },
    boombox: { id: 'boombox', name: 'Boombox', cost: 80, buildTime: 6, sway: 0.15, radius: 14, text: 'Allies within 14 m: +15% Sway.' },
    bench: { id: 'bench', name: 'Bench Cluster', cost: 60, buildTime: 6, pop: 4, heavyHp: 0.20, radius: 10, text: '+4 pop cap; your ■ within 10 m get +20% Composure.' },
    chessTable: { id: 'chessTable', name: 'Chess Table', faction: 'hustle', special: true, cost: 110, buildTime: 6, clout: 1.2, enemyCapture: 0.6, text: '+1.2 Clout/s. Enemies capture this landmark at x0.6 speed.' },
    tipJar: { id: 'tipJar', name: 'Tip Jar', faction: 'noise', special: true, cost: 110, buildTime: 6, perUnit: 0.15, radius: 15, cap: 3, text: '+0.15 Clout/s for every unit of any crew within 15 m (max 3/s).' },
    clubFair: { id: 'clubFair', name: 'Club Fair Table', faction: 'violets', special: true, cost: 110, buildTime: 6, crowdDiscount: 0.25, text: 'This landmark becomes a recruit point; ● cost 25% less here.' },
    waterBowl: { id: 'waterBowl', name: 'Water Bowl', faction: 'pack', special: true, cost: 110, buildTime: 6, heal: 5, sway: 0.10, radius: 10, text: 'Units within 10 m heal 5/s and get +10% Sway.' },
  };

  // Static neutral sites (§2.3).
  const sites = {
    dosa: { id: 'dosa', name: 'NY Dosas cart', x: -100, z: 57, cost: 50, radius: 20, sway: 0.20, time: 20, cooldown: 30 },
    parkHouse: { id: 'parkHouse', name: 'Park House "The Only Bathroom"', x: -57, z: 38, radius: 10, heal: 4 },
  };

  const capture = {
    base: 12.5, exp: 0.6, maxWeight: 4, regen: 5, flipBonus: 25,
    regularsEvery: 40, regularsMax: 2, contestedPing: 4,
  };

  const byId = {};
  landmarks.forEach((l) => { byId[l.id] = l; });
  homes.forEach((h) => { byId[h.id] = h; });

  SQ.data.landmarks = landmarks;
  SQ.data.homes = homes;
  SQ.data.landmarkById = byId;
  SQ.data.setups = setups;
  SQ.data.sites = sites;
  SQ.data.capture = capture;
})(window.SQ = window.SQ || {});
