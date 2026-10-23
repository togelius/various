#!/usr/bin/env node
// ACCESSION — the registry and ledger lint (BUILD.md §5.1, §9.3). Fails when:
//   there are more than ten universal systems;
//   a pack uses an archetype, trigger, modifier or module not in the registry;
//   an id is duplicated within or across packs;
//   a species has more than one special trigger;
//   a department owns more than two modules;
//   a file in art/, vendor/ or tools/vendor/ has no ledger entry, or an entry has no file;
//   anything under art/reference/ is referenced by the game.
// Two checks need the scenario tests of M3 and M4 and are reported as pending until a
// registry entry names its tests: a Behaviour-line clause with no test, and an id that no
// pack, scenario test or arena fixture uses.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { loadCore } = require('./core-context.js');
const root = path.join(__dirname, '..');
const C = loadCore();
const { Registry, Packs } = C;
const problems = [];
const bad = s => problems.push(s);

if (Registry.SYSTEMS.length > Registry.MAX_SYSTEMS) bad(`${Registry.SYSTEMS.length} universal systems; the cap is ${Registry.MAX_SYSTEMS}`);
const packs = Packs.list();
const ids = new Map();
for (const p of packs) {
  if ((p.modules || []).length > 2) bad(`${p.acc} owns ${p.modules.length} modules; the cap is 2`);
  for (const m of p.modules || []) if (!Registry.MODULES[m.id]) bad(`${p.acc} uses the unknown module ${m.id}`);
  for (const sp of [...p.species, ...(p.centrepiece ? [p.centrepiece] : [])]) {
    if (ids.has(sp.id)) bad(`${sp.id} is used twice (${ids.get(sp.id)} and ${p.acc})`); else ids.set(sp.id, p.acc);
    if (!Registry.ARCHETYPES[sp.archetype]) bad(`${sp.id} uses the unknown archetype ${sp.archetype}`);
    if (sp.trigger != null && (typeof sp.trigger !== 'string' || !Registry.TRIGGERS[sp.trigger])) bad(`${sp.id} has the trigger ${JSON.stringify(sp.trigger)}: one known trigger or none`);
    for (const m of sp.modifiers || []) if (!Registry.MODIFIERS[m]) bad(`${sp.id} uses the unknown modifier ${m}`);
  }
}

// The asset ledger.
// --ledger FILE lints another copy of the ledger (the lint tests plant faults in one).
const li = process.argv.indexOf('--ledger');
const ledger = JSON.parse(fs.readFileSync(li > 0 ? process.argv[li + 1] : path.join(root, 'art/ledger.json'), 'utf8'));
const SOURCES = new Set(['hand', 'code', 'cc0', 'vendored', 'reference']);
const listed = new Map();
for (const e of ledger.entries) {
  if (listed.has(e.file)) bad(`ledger: ${e.file} has two entries`);
  listed.set(e.file, e);
  if (!SOURCES.has(e.source)) bad(`ledger: ${e.file} has source ${e.source}`);
  if (!e.licence) bad(`ledger: ${e.file} has no licence`);
  if (!e.author && !e.model) bad(`ledger: ${e.file} names no author or model`);
  if (e.source === 'reference' && (!e.model || !e.prompt)) bad(`ledger: ${e.file} is reference art but does not name its model and prompt`);
  if (!fs.existsSync(path.join(root, e.file))) bad(`ledger: ${e.file} is listed but not on disk`);
}
const walk = rel => { const abs = path.join(root, rel); if (!fs.existsSync(abs)) return []; return fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).flatMap(n => walk(rel + '/' + n)) : [rel]; };
for (const f of [...walk('art'), ...walk('vendor'), ...walk('tools/vendor')]) if (f !== 'art/ledger.json' && !listed.has(f)) bad(`ledger: ${f} has no entry`);
// Reference art never reaches the game.
const game = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + walk('js').concat(walk('css')).map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
if (/art\/reference\//.test(game)) bad('the game references art/reference/');

const pending = Object.values(Registry.ARCHETYPES).concat(Object.values(Registry.TRIGGERS), Object.values(Registry.MODIFIERS)).filter(e => !e.tests).length;
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `lint-registry: ${problems.length} problem(s)` :
  `lint-registry: ${packs.length} packs, ${ids.size} species, ${ledger.entries.length} ledger entries clean; clause tests pending for ${pending} ids (M3, M4)`);
process.exit(problems.length ? 1 : 0);
