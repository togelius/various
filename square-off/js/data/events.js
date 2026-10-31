// SQUARE OFF — park events (DESIGN §6). Read by js/sim/director.js; effects are applied through
// state.zones / state.weather / landmark.bonusClout (see js/core/contracts.js).
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};

  SQ.data.eventPacing = {
    first: 90, warn: 8,
    normal: [70, 100], calm: [120, 160], chaos: [40, 60],
    skipBehind: 300,   // never target a faction more than 300 Turf behind
    leaderBias: 0.6,   // target the leader 60% of the time
  };

  SQ.data.events = {
    piano: {
      id: 'piano', name: 'The Piano Guy', icon: '🎹', duration: 45, weight: 1.2,
      spots: [{ x: 15, z: 46, lm: 'smallrun', name: 'Kempner' }, { x: 0, z: -40, lm: 'arch', name: 'Arch Plaza' }],
      zone: { r: 15, speed: 1.25, regen: 2, who: 'all' },
      toast: 'The Piano Guy is rolling a grand piano to {PLACE}.',
      start: 'Piano is out! +25% speed and regen within 15 m.',
      aiValue: 3,
    },
    pigeonLady: {
      id: 'pigeonLady', name: 'Pigeon Lady', icon: '🐦', duration: 30, weight: 1,
      targetLandmark: true, pigeons: 120,
      zone: { r: 20, sway: 0.8, speed: 0.7, who: 'all', animalScatter: 2 },
      toast: 'The Pigeon Lady is heading for {PLACE}. Bring bread. Or dogs.',
      start: '120 pigeons near {PLACE}: Sway x0.8, speed x0.7.',
      aiValue: -2,
    },
    squirrelHeist: {
      id: 'squirrelHeist', name: 'Squirrel Heist', icon: '🐿', duration: 40, weight: 1,
      squirrels: [3, 5], heist: 20, shoo: 5, needsCarts: true,
      toast: 'Squirrels are eyeing the Food Carts!',
      start: 'Squirrel Heist! Tap squirrels to shoo them (+5 each).',
      aiValue: 0,
    },
    pep: {
      id: 'pep', name: 'PEP Sweep', icon: '👮', duration: 25, weight: 1,
      officers: 2, targetLeader: true,
      zone: { r: 8, noAttack: true, who: 'all', follows: true },
      toast: 'Parks Enforcement is sweeping near {PLACE}.',
      start: 'PEP Sweep: nobody can start anything within 8 m of an officer.',
      aiValue: -3,
    },
    tourists: {
      id: 'tourists', name: 'Tourist Bus', icon: '🚌', duration: 40, weight: 0.8,
      count: 20, from: { x: 0, z: -95 }, to: { x: 0, z: -14 }, perTourist: 1, lm: 'arch',
      zone: { r: 3, speed: 0.75, who: 'all' },
      toast: 'A tour bus is pulling up on Washington Sq N.',
      start: '20 tourists head through the Arch. Arch holder: +1 Clout each.',
      aiValue: 2,
    },
    shower: {
      id: 'shower', name: 'Summer Shower', icon: '🌧', duration: 30, weight: 0.9,
      talkerRange: 0.7, shelterSway: 0.15, archShelter: { x0: -9, x1: 10, z0: -58, z1: -50 },
      toast: 'Clouds over the Village. Rain in 8 s.',
      start: 'Summer Shower: ▲ range -30%. Shelter under the Arch or the trees for +15% Sway.',
      aiValue: 0,
    },
    iceCream: {
      id: 'iceCream', name: 'Ice Cream Truck', icon: '🍦', duration: 30, weight: 0.8,
      street: { z: 76 }, bonusClout: 2,
      toast: 'An ice cream truck is parking near {PLACE}.',
      start: 'Ice cream! {PLACE} gives +2 Clout/s.',
      aiValue: 3,
    },
    bells: {
      id: 'bells', name: 'Judson Bells', icon: '🔔', duration: 2, weight: 0.5, warn: 3,
      pause: 1,
      toast: 'Judson bells about to ring.',
      start: 'Bong. Everybody stops and looks south.',
      aiValue: 0,
    },
    graduation: {
      id: 'graduation', name: 'NYU Graduation', icon: '🎓', duration: 50, weight: 0, campaignOnly: true,
      count: 80, from: { x: 0, z: -105 }, to: { x: 0, z: -12 },
      zone: { r: 4, speed: 0.75, who: 'all' }, violetsSpeed: 1.2,
      toast: 'Commencement! A river of purple gowns is coming down Fifth Avenue.',
      start: 'Graduation: Violets +20% speed. Everyone else, good luck crossing.',
      aiValue: 1,
    },
  };

  SQ.data.eventOrder = ['piano', 'pigeonLady', 'squirrelHeist', 'pep', 'tourists', 'shower', 'iceCream', 'bells'];
})(window.SQ = window.SQ || {});
