// ACCESSION — golden runs: expected hashes for fixed seeds and action lists (BUILD.md §3.5).
// Regenerate only on purpose (node tools/golden.js), and log why in DEVELOPMENT.md.
// Each run is a monkey ({kind: 'monkey', seed, actions: count, make}) or a replay ({kind:
// 'replay', start, options, actions: list}), with its pin: the final hash, the checkpoints and,
// from a re-pin, steps (the hash after every action, 4 bytes each, base64); pending, while set,
// says why the run is not held to its pin.
'use strict';
const GOLDEN = {
 "m0Monkey": {
  "kind": "monkey",
  "seed": 20261023,
  "actions": 10000,
  "make": null,
  "hash": 2478084208,
  "checkpoints": [1823402178,772037959,1272910340,29837228,4262093995,3366555807,1747605312,1587150453,1337848051,2159065831],
  "visits": 37,
  "steps": null,
  "pending": "M3 Wave 1 in progress; re-pinned at the end of Wave 1"
 }
};
