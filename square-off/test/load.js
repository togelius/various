'use strict';
// Loads the headless game modules (geo, core, data, sim) into a Node global, like index.html does.
// Usage: const SQ = require('./load.js')();   // returns window.SQ
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'js/geo.js',
  'js/core/ns.js',
  'js/core/contracts.js',
  'js/data/units.js',
  'js/data/factions.js',
  'js/data/landmarks.js',
  'js/data/maps.js',
  'js/data/missions.js',
  'js/data/events.js',
  'js/data/text.js',
  'js/data/navOverrides.js',
  'js/sim/nav.js',
  'js/sim/world.js',
  'js/sim/movement.js',
  'js/sim/combat.js',
  'js/sim/capture.js',
  'js/sim/economy.js',
  'js/sim/abilities.js',
  'js/sim/match.js',
];
// Other engineers' sim plug-ins, loaded when present (opt out with { plugins: false }).
const PLUGINS = ['js/sim/ai.js', 'js/sim/director.js', 'js/sim/campaign.js'];

let loaded = null;
module.exports = function load(opts) {
  opts = opts || {};
  if (loaded && !opts.fresh) return loaded;
  globalThis.window = globalThis;
  if (opts.fresh) delete globalThis.SQ;
  const list = FILES.concat(opts.plugins === false ? [] : PLUGINS.filter((f) => fs.existsSync(path.join(ROOT, f))));
  for (const f of list) {
    const full = path.join(ROOT, f);
    delete require.cache[require.resolve(full)];
    require(full);
  }
  loaded = globalThis.SQ;
  return loaded;
};
module.exports.FILES = FILES;
module.exports.PLUGINS = PLUGINS;
module.exports.ROOT = ROOT;
