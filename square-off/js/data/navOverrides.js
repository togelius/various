// SQUARE OFF — navigation overrides on top of GEO (DESIGN §4.2, §7.4).
// Verify with the ?nav=1 debug overlay and test/nav.test.js.
(function (SQ) {
  'use strict';
  SQ.data = SQ.data || {};
  SQ.data.navOverrides = {
    // Barriers to ignore entirely (matched by kind + bbox center within `tol` m).
    ignoreBarriers: [
      { kind: 'retaining_wall', x: 0.5, z: 0.2, tol: 4, why: 'Fountain basin rim: wadeable (x0.6)' },
      { kind: 'kerb', why: 'Curbs are not walls' },
      { kind: 'gate', why: 'OSM gate ways are openings' },
    ],
    // Openings carved through fences (only fence/wall cells are cleared, never buildings).
    gates: [
      { x: -79.2, z: 52.9, r: 1.4, name: 'Big Dog Run west gate' },
      { x: -41.6, z: 54.4, r: 1.4, name: 'Big Dog Run east gate' },
      { x: 30.2, z: 58.2, r: 1.2, name: 'Small Dog Run gate' },
      { x: 54.8, z: -42.25, r: 1.2, name: 'Main Playground gate (south)' },
      { x: 32.3, z: -33.6, r: 1.3, name: 'Main Playground gate (west)' },
      { x: 75.2, z: -28.9, r: 1.3, name: 'Main Playground gate (east)' },
      { x: -48.7, z: -55.5, r: 1.2, name: 'Toddler Playground gate' },
    ],
    // Rectangles forced walkable (overrides buildings), e.g. the archway between the Arch piers.
    clearRects: [
      { x0: -3.4, x1: 4.4, z0: -58.6, z1: -49.4, terrain: 'path', name: 'Washington Square Arch passage' },
    ],
    // Extra blockers: statue plinths and the like.
    blockCircles: [
      { x: 58.2, z: -6.45, r: 2.2, name: 'Garibaldi plinth' },
      { x: -76.1, z: -10.98, r: 1.8, name: 'Holley Monument plinth' },
      { x: 14.8, z: 47.7, r: 0.8, name: 'Kempner marker' },
    ],
    // Hero tree treated as a trunk blocker.
    blockTrees: [{ x: -150, z: -54, r: 1.2, name: "Hangman's Elm" }],
    // Barrier gaps closed when narrower than this (m); wider gaps become gates.
    minGate: 1.2,
  };
})(window.SQ = window.SQ || {});
