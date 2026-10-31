// SQUARE OFF — map variants (DESIGN §4). All maps share the real park; they pick landmarks and Home Spots.
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  const ALL11 = ['fountain', 'arch', 'chess', 'grove', 'holley', 'garibaldi', 'bigrun', 'playground', 'smallrun', 'bobst', 'judson'];
  const ALL13 = ALL11.concat(['toddler', 'playhills']);

  const maps = {
    whole: {
      id: 'whole', name: 'The Whole Square', blurb: 'All 11 landmarks. The classic.',
      landmarks: ALL11,
      // Home Spot order by player count: 1v1 NW vs SE; 3 and 4 players add SW, then NE.
      homes: ['home_nw', 'home_se', 'home_sw', 'home_ne'],
      turfTarget: 1500, length: 600,
    },
    north: {
      id: 'north', name: 'North Side', blurb: 'Arch, Grove, Holley, Garibaldi, Playground, Fountain and the Toddler Playground. Fast and tight.',
      landmarks: ['arch', 'grove', 'holley', 'garibaldi', 'playground', 'fountain', 'toddler'],
      homes: ['home_nw', 'home_ne', 'home_sw', 'home_se'],
      turfTarget: 900, length: 600,
    },
    south: {
      id: 'south', name: 'South Side', blurb: 'Chess, both dog runs, Bobst Gate, Judson, the Fountain and Play Hills.',
      landmarks: ['chess', 'bigrun', 'smallrun', 'bobst', 'judson', 'fountain', 'playhills'],
      homes: ['home_sw', 'home_se', 'home_nw', 'home_ne'],
      turfTarget: 900, length: 600,
    },
    random: {
      id: 'random', name: 'Random Spots', blurb: '7 landmarks picked by the seed. Always includes the Fountain.',
      landmarks: ALL13, pick: 7, always: ['fountain'],
      homes: ['home_nw', 'home_se', 'home_sw', 'home_ne'],
      turfTarget: 1200, length: 600,
    },
    // Campaign slices
    firstLight: {
      id: 'firstLight', name: 'First Light (SE quarter)', campaign: true,
      landmarks: ['smallrun', 'bobst', 'garibaldi', 'bigrun'],
      homes: ['home_se', 'home_sw'],
      turfTarget: 99999, length: 9999,
    },
    westHalf: {
      id: 'westHalf', name: 'West Half', campaign: true,
      landmarks: ['chess', 'grove', 'holley', 'bigrun', 'judson', 'fountain', 'arch'],
      homes: ['home_sw', 'home_nw'],
      turfTarget: 600, length: 600,
    },
  };

  // Phases (§3.3): match-clock seconds (0..600). Game clock 4 PM -> 1 AM.
  const phases = [
    { id: 'afternoon', name: 'Afternoon', start: 0, end: 200, clockStart: 16 },
    { id: 'golden', name: 'Golden Hour', start: 200, end: 400, clockStart: 19 },
    { id: 'night', name: 'Night', start: 400, end: 600, clockStart: 22 },
  ];

  // Daily Park modifiers (one per day, picked by date seed). `mods` are applied by the sim (state.mods);
  // other keys are read by the director / AI.
  const dailyModifiers = [
    { id: 'pianos', name: 'Pianos for everyone', text: 'The Piano Guy brought friends: piano events twice as often.', mods: {}, director: { only: ['piano'], rate: 2 } },
    { id: 'heatwave', name: 'Heatwave', text: 'Regen x0.5. Everyone is wilting.', mods: { regenMult: 0.5 } },
    { id: 'rushHour', name: 'Rush Hour', text: 'Everyone walks 15% faster. New Yorkers.', mods: { speedMult: 1.15 } },
    { id: 'payday', name: 'Payday', text: 'Income x1.25. Recruits cost the same.', mods: { incomeMult: 1.25 } },
    { id: 'openHouse', name: 'Open House', text: 'Captures are 30% faster.', mods: { captureMult: 1.3 } },
    { id: 'happyHour', name: 'Happy Hour', text: 'Recruits cost 15% less.', mods: { costMult: 0.85 } },
    { id: 'drumLine', name: 'Drum Line', text: 'Crew Calls charge 50% faster.', mods: { crewMult: 1.5 } },
    { id: 'squirrelSeason', name: 'Squirrel Season', text: 'Squirrel Heists all day long.', mods: {}, director: { only: ['squirrelHeist'], rate: 1.5 } },
  ];

  SQ.data.dailyModifiers = dailyModifiers;
  SQ.data.maps = maps;
  SQ.data.mapOrder = ['whole', 'north', 'south', 'random'];
  SQ.data.phases = phases;
  SQ.data.matchRules = {
    matchLength: 600, hoursPerMatch: 9, startHour: 16,
    phaseWarn: 20, startClout: 150, homeClout: 1.5,
    suddenDeath: 60, eliminationClout: 40,
    comeback: { behind: 250, costMult: 0.8, captureMult: 1.25 },
    popBase: 20, popPerLandmark: 2, popMax: 50,
    queueMax: 5, rallyRange: 90,
    historyEvery: 5,
  };
})(window.SQ = window.SQ || {});
