// SQUARE OFF — the four crews (DESIGN §2.2) plus the campaign Squirrel Gang.
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  const factions = {
    hustle: {
      key: 'hustle', name: 'The Hustle', short: 'Hustle', color: '#3D7BE0', colorDark: '#21477f',
      tagline: 'Chess hustlers and old heads.', home: 'Chess Plaza',
      passive: { id: 'sideBets', name: 'Side Bets', text: '+5 Clout every time an enemy goes Over It within 20 m of a Hustle unit.', clout: 5, radius: 20 },
      // Balance (sim-batch, Sim C): duration 5->6
      crewCall: { id: 'tournament', name: 'Tournament', target: 'point', radius: 14, duration: 6,
        text: 'Every enemy within 14 m sits down at a board for 6 s.' },
      special: 'chessTable',
      aiPersonality: 'turtle',
      wipeWord: 'OUT-HUSTLED',
      captureSting: 'clock',
      voice: { pitch: 0.8, wave: 'square' },
      animal: false, captureMult: 1, hpMult: 1, lawnPenalty: true,
    },
    noise: {
      key: 'noise', name: 'The Noise', short: 'Noise', color: '#FF8A1F', colorDark: '#9c4f0a',
      tagline: 'Buskers. Loud on purpose.', home: 'the Fountain rim',
      // Balance (sim-batch, Sim C): Pass the Hat 0.3/unit cap 3 -> 0.2/unit cap 2; Drum Circle radius 16 -> 11
      passive: { id: 'passTheHat', name: 'Pass the Hat', text: '+0.2 Clout/s for each Noise unit inside one of your landmark rings (max +2/s).', perUnit: 0.2, cap: 2 },
      crewCall: { id: 'drumCircle', name: 'Drum Circle', target: 'point', radius: 11, duration: 12, heal: 6, dps: 5, slow: 0.7,
        text: 'A drum circle (11 m around the beat) for 12 s: your units heal 6/s, enemies take 5/s and slow to 70%.' },
      special: 'tipJar',
      aiPersonality: 'turtle',
      wipeWord: 'DROPPED THE BEAT',
      captureSting: 'sax',
      voice: { pitch: 1.1, wave: 'sawtooth' },
      animal: false, captureMult: 1, hpMult: 1, lawnPenalty: true,
    },
    violets: {
      key: 'violets', name: 'The Violets', short: 'Violets', color: '#9B5CFF', colorDark: '#5a2fa3',
      tagline: 'NYU students. There are so many of them.', home: 'the Arch steps',
      passive: { id: 'groupProject', name: 'Group Project', text: '+25% capture speed, but every unit has 10% less Composure.', capture: 1.25, hp: 0.9 },
      // Balance (sim-batch, Sim C): count 6 -> 5
      crewCall: { id: 'groupChat', name: 'Group Chat', target: 'landmark', count: 5,
        text: '5 Freshmen appear at a landmark you hold, ignoring the pop cap.' },
      special: 'clubFair',
      aiPersonality: 'mosh',
      wipeWord: 'SCHOOLED!',
      captureSting: 'cheer',
      voice: { pitch: 1.3, wave: 'triangle' },
      animal: false, captureMult: 1.25, hpMult: 0.9, lawnPenalty: true,
    },
    pack: {
      key: 'pack', name: 'The Pack', short: 'Pack', color: '#E0453A', colorDark: '#8a2620',
      tagline: 'Dog people. Mostly the dogs.', home: 'the Big Dog Run',
      passive: { id: 'offLeash', name: 'Off Leash', text: 'No lawn penalty. Every Pack unit is an Animal and scatters pigeons and squirrels.' },
      crewCall: { id: 'zoomies', name: 'Zoomies', target: 'line', maxLen: 40, dogs: 8, damage: 30, knock: 4, hitRadius: 2.5,
        buffRadius: 15, buffSpeed: 0.6, buffTime: 6, dogSpeed: 26,
        text: '8 dogs sprint along a line: 30 Sway and a 4 m knockback to every enemy they touch. Your units nearby get +60% speed for 6 s.' },
      special: 'waterBowl',
      aiPersonality: 'opportunist',
      wipeWord: 'BAD DOG DAY',
      captureSting: 'bark',
      voice: { pitch: 1.0, wave: 'square' },
      animal: true, captureMult: 1, hpMult: 1, lawnPenalty: false,
    },
    squirrels: {
      key: 'squirrels', name: 'The Squirrel Gang', short: 'Squirrels', color: '#8B6A4E', colorDark: '#4d3826',
      tagline: 'They were here first.', home: 'the trees', playable: false,
      passive: { id: 'none', name: 'Nuts', text: 'Flee at half Composure.' },
      crewCall: { id: 'none', name: 'Chitter', target: 'none', text: 'Squirrels do not have a Crew Call. Probably.' },
      special: null,
      aiPersonality: 'passive',
      wipeWord: 'NUTS!',
      captureSting: 'chitter',
      voice: { pitch: 1.8, wave: 'sine' },
      animal: true, captureMult: 1, hpMult: 1, lawnPenalty: false,
    },
  };

  SQ.data.factions = factions;
  SQ.data.factionOrder = ['hustle', 'noise', 'violets', 'pack'];
  SQ.data.crew = {
    max: 100, start: 30, base: 0.4, perLandmark: 0.15, perOverIt: 5,
  };
})(window.SQ = window.SQ || {});
