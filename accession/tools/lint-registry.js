#!/usr/bin/env node
// ACCESSION — the registry and ledger lint (BUILD.md §5.1, §9.3). Fails when:
//   there are more than ten universal systems;
//   a pack uses an archetype, trigger, modifier, module or item primitive not in the
//   registry; an id is duplicated within or across packs; a species has more than one
//   special trigger; a department owns more than two modules;
//   the registry's event kinds differ from BUILD.md §4.3's list;
//   an event kind or a (kind, cause) pair has no schema or no sentence, or a sentence has
//   no schema; a wake cause lacks its woke and hunting causes; a trigger that wakes an
//   exhibit into a mode (a wake cause waking it hunting or awake, not a creation cause)
//   lacks its pip cause, which Wake.addPips emits before it wakes; a damaged cause does not accept saved and side (Combat.hurt
//   marks saved on any cause, old_repair side on a blow, shot or beam); a refusal code has
//   no sentence, or a sentence no code;
//   a clause template names a parameter it does not define, or a special or status its
//   entry does not name; a parameter reference cannot be read; a clause covers an unknown
//   event kind; a pack species' Behaviour line cannot be filled at some depth 1–7;
//   an entry at ready 'unit' or above names no tests, a test file that does not exist, or
//   no invariant file that exists (test/behaviour/<inv>.inv.js);
//   a file in art/, vendor/ or tools/vendor/ has no ledger entry, or an entry has no file;
//   anything under art/reference/ is referenced by the game.
// It reports how many entries are at ready false, 'unit' and true. With --strict (the M3
// acceptance, §11) it also fails on any built: 'M3' entry that is not at ready true with
// its tests and its invariant.
// Options for the lint tests: --ledger FILE lints another copy of the ledger; --build FILE
// another copy of BUILD.md; --load FILE loads one more core file after the core (a planted
// fault).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { loadCore } = require('./core-context.js');
const root = path.join(__dirname, '..');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const strict = process.argv.includes('--strict');
const C = loadCore(arg('--load') ? [path.resolve(arg('--load'))] : []);
const { Registry: R, Packs, Text, Clauses } = C;
const problems = [];
const bad = s => problems.push(s);
const keys = o => Object.keys(o || {});

if (R.SYSTEMS.length > R.MAX_SYSTEMS) bad(`${R.SYSTEMS.length} universal systems; the cap is ${R.MAX_SYSTEMS}`);

// The packs. Shared species (the Night Watchman, content/watch.js) are linted with them.
const packs = Packs.list();
const shared = Packs.sharedList();
const ids = new Map(), allSpecies = [];
for (const p of packs) {
  if ((p.modules || []).length > 2) bad(`${p.acc} owns ${p.modules.length} modules; the cap is 2`);
  for (const m of p.modules || []) if (!R.MODULES[m.id]) bad(`${p.acc} uses the unknown module ${m.id}`);
  for (const sp of [...p.species, ...(p.centrepiece ? [p.centrepiece] : [])]) allSpecies.push([p.acc, sp]);
  for (const it of p.items || []) for (const pr of it.prims || []) {
    if (!R.ITEM_PRIMS[pr.id]) bad(`${p.acc} item ${it.id} uses the primitive ${pr.id}, which the slice does not implement (§8.5)`);
    if (!['S', 'M', 'L'].includes(pr.cls)) bad(`${p.acc} item ${it.id}: primitive ${pr.id} has the class ${JSON.stringify(pr.cls)}, not S, M or L`);
  }
}
for (const sp of shared) allSpecies.push(['shared', sp]);
for (const [acc, sp] of allSpecies) {
  if (ids.has(sp.id)) bad(`${sp.id} is used twice (${ids.get(sp.id)} and ${acc})`); else ids.set(sp.id, acc);
  if (!R.ARCHETYPES[sp.archetype]) bad(`${sp.id} uses the unknown archetype ${sp.archetype}`);
  if (sp.trigger != null && (typeof sp.trigger !== 'string' || !R.TRIGGERS[sp.trigger])) bad(`${sp.id} has the trigger ${JSON.stringify(sp.trigger)}: one known trigger or none`);
  for (const m of sp.modifiers || []) if (!R.MODIFIERS[m]) bad(`${sp.id} uses the unknown modifier ${m}`);
  // Its Behaviour line fills at every depth, with no gap or stray value.
  for (let d = 1; d <= 7; d++) {
    try {
      const l = Clauses.line(sp, { depth: d });
      if (/undefined|NaN|\[object|[{}]/.test(l)) bad(`${sp.id} at depth ${d}: the Behaviour line "${l}" has a gap`);
    } catch (e) { bad(`${sp.id} at depth ${d}: ${e.message}`); }
  }
}

// The event kinds: the registry's closed list against BUILD.md §4.3's bullets.
const md = fs.readFileSync(arg('--build') || path.join(root, 'BUILD.md'), 'utf8');
const a43 = md.indexOf('### 4.3 Events'), b43 = md.indexOf('\n### ', a43 + 1);
const listed = a43 < 0 ? [] : md.slice(a43, b43).split('\n').filter(l => /^- \*\*/.test(l)).flatMap(l => [...l.matchAll(/`([a-z_]+)`/g)].map(m => m[1]));
if (!listed.length) bad('BUILD.md §4.3 lists no event kinds');
for (const k of listed) if (!R.EVENTS[k]) bad(`the event kind ${k} is in BUILD.md §4.3 but not in the registry`);
for (const k of R.EVENT_KINDS) if (!listed.includes(k)) bad(`the event kind ${k} is in the registry but not in BUILD.md §4.3`);
if (new Set(listed).size !== listed.length) bad('BUILD.md §4.3 lists an event kind twice');

// Every kind and every (kind, cause) pair has a schema and a sentence, and every sentence a schema.
for (const k of R.EVENT_KINDS) if (!Text.defined(k)) bad(`the event kind ${k} has no sentence (Text.define)`);
for (const k of keys(R.CAUSES)) {
  if (!R.EVENTS[k] && keys(R.CAUSES[k]).length) bad(`causes are defined for ${k}, which is not an event kind`);
  else if (R.EVENTS[k] && R.EVENTS[k].exempt && keys(R.CAUSES[k]).length) bad(`${k} is exempt from the cause check but has causes`);
  for (const c of keys(R.CAUSES[k])) if (!Text.defined(k, c)) bad(`${k}.${c} has no sentence (Text.defineCause)`);
}
const said = Text.list();
for (const k of said.kinds) if (!R.EVENTS[k]) bad(`there is a sentence for ${k}, which is not an event kind`);
for (const [k, c] of said.causes) if (!R.CAUSES[k] || !R.CAUSES[k][c]) bad(`there is a sentence for ${k}.${c}, which has no cause schema`);
for (const k of R.order('WAKE_CAUSES')) {
  const w = R.WAKE_CAUSES[k];
  if (!['hunting', 'awake', 'parent', 'perform'].includes(w.mode)) bad(`the wake cause ${k} has the mode ${JSON.stringify(w.mode)}`);
  for (const kind of ['woke', 'hunting']) if (!R.CAUSES[kind] || !R.CAUSES[kind][k]) bad(`the wake cause ${k} has no ${kind}.${k} cause schema`);
}
for (const k of R.order('TRIGGERS')) {
  const w = R.WAKE_CAUSES[k];
  if (w && !w.creation && (w.mode === 'hunting' || w.mode === 'awake') && !(R.CAUSES.pip && R.CAUSES.pip[k])) bad(`the trigger ${k} wakes through pips but has no pip.${k} cause schema`);
}
for (const c of keys(R.CAUSES.damaged)) for (const f of ['saved', 'side']) {
  if (!R.CAUSES.damaged[c].list.some(x => x.name === f && x.optional)) bad(`damaged.${c} does not accept ${f}? (every damage cause may carry it)`);
}
for (const code of R.order('REFUSALS')) if (!Text.refusalDefined(code)) bad(`the refusal ${code} has no sentence (Text.defineRefusal)`);
for (const code of said.refusals) if (!R.REFUSALS[code]) bad(`there is a sentence for the refusal ${code}, which is not in REFUSALS`);
for (const name of ['clock', 'recap']) if (!Text.provided(name)) bad(`no fragment provides Text.${name}`);

// Clause templates (§5.3).
const REF = /^(N:[A-Z][A-Z0-9_]*(\[\d+\])?|curve:[A-Z][A-Z0-9_]*|role:(HP|DMG)|mod:[a-z][a-z0-9_]*)$/;
const sentence = { ARCHETYPES: true, MODIFIERS: true, CLAUSES: true, SPECIALS: false, STATUSES: false };
for (const t of R.TABLES) for (const id of R.order(t)) {
  const e = R[t][id], where = `${t}.${id}`;
  if (!Array.isArray(e.tests)) bad(`${where}: tests is not a list`);
  if (e.ready === 'unit' || e.ready === true) {
    if (!e.tests.length) bad(`${where} is at ready ${JSON.stringify(e.ready)} but names no tests`);
    for (const f of e.tests) if (!fs.existsSync(path.join(root, 'test', f))) bad(`${where} names the test test/${f}, which does not exist`);
    if (!e.inv || !fs.existsSync(path.join(root, 'test/behaviour', e.inv + '.inv.js'))) bad(`${where} is at ready ${JSON.stringify(e.ready)} but its invariant test/behaviour/${e.inv}.inv.js does not exist`);
  }
  if (strict && e.built === 'M3' && (e.ready !== true || !e.tests.length || !e.inv)) bad(`--strict: ${where} is at ready ${JSON.stringify(e.ready)}, with ${e.tests.length} test(s) and invariant ${e.inv}`);
  if (e.clause === undefined) continue;
  for (const [name, ref] of Object.entries(e.params)) if (typeof ref !== 'string' || !REF.test(ref)) bad(`${where}: the parameter ${name} has the reference ${JSON.stringify(ref)}`);
  for (const k of e.covers) if (!R.EVENTS[k]) bad(`${where} covers ${k}, which is not an event kind`);
  const holes = [...e.clause.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
  for (const h of holes) {
    if (h === 'special') { if (!e.special) bad(`${where}: {special} in a clause whose entry names no special`); continue; }
    const st = /^status:(.+)$/.exec(h);
    if (st) { if (!(e.inflicts || []).includes(st[1])) bad(`${where}: {${h}} in a clause whose entry does not inflict ${st[1]}`); continue; }
    if (!Object.prototype.hasOwnProperty.call(e.params, h)) bad(`${where}: {${h}} has no parameter`);
  }
  for (const name of keys(e.params)) if (!holes.includes(name)) bad(`${where}: the parameter ${name} is not in its clause`);
  if (e.special && !R.SPECIALS[e.special]) bad(`${where} has the unknown special ${e.special}`);
  if (e.special && !holes.includes('special')) bad(`${where} has a special but no {special} in its clause`);
  for (const s of e.inflicts || []) { if (!R.STATUSES[s]) bad(`${where} inflicts the unknown status ${s}`); else if (!holes.includes('status:' + s)) bad(`${where} inflicts ${s} but has no {status:${s}} in its clause`); }
  if (e.wake && !R.CLAUSES[e.wake]) bad(`${where} has the unknown wake clause ${e.wake}`);
  // Archetype, modifier and wake clauses are sentences; a special's or status's clause is
  // set inside its archetype's; a trigger's continues the wake clause unless it replaces it.
  const full = t === 'TRIGGERS' ? !!e.replacesWake : sentence[t];
  if (full === true && !/^[A-Z].*\.$/.test(e.clause)) bad(`${where}: its clause should be a sentence: "${e.clause}"`);
  if (full === false && (/\.$/.test(e.clause) || /^[A-Z]/.test(e.clause))) bad(`${where}: its clause should continue another: "${e.clause}"`);
}

// The asset ledger.
const ledger = JSON.parse(fs.readFileSync(arg('--ledger') || path.join(root, 'art/ledger.json'), 'utf8'));
const SOURCES = new Set(['hand', 'code', 'cc0', 'vendored', 'reference']);
const inLedger = new Map();
for (const e of ledger.entries) {
  if (inLedger.has(e.file)) bad(`ledger: ${e.file} has two entries`);
  inLedger.set(e.file, e);
  if (!SOURCES.has(e.source)) bad(`ledger: ${e.file} has source ${e.source}`);
  if (!e.licence) bad(`ledger: ${e.file} has no licence`);
  if (!e.author && !e.model) bad(`ledger: ${e.file} names no author or model`);
  if (e.source === 'reference' && (!e.model || !e.prompt)) bad(`ledger: ${e.file} is reference art but does not name its model and prompt`);
  if (!fs.existsSync(path.join(root, e.file))) bad(`ledger: ${e.file} is listed but not on disk`);
}
const walk = rel => { const abs = path.join(root, rel); if (!fs.existsSync(abs)) return []; return fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).flatMap(n => walk(rel + '/' + n)) : [rel]; };
for (const f of [...walk('art'), ...walk('vendor'), ...walk('tools/vendor')]) if (f !== 'art/ledger.json' && !inLedger.has(f)) bad(`ledger: ${f} has no entry`);
// Reference art never reaches the game.
const game = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + walk('js').concat(walk('css')).map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
if (/art\/reference\//.test(game)) bad('the game references art/reference/');

// How far the entries have come (§5.1): ready false, 'unit' and true, over every table.
const count = { false: 0, unit: 0, true: 0 }, m4 = [];
for (const t of R.TABLES) for (const id of R.order(t)) { const e = R[t][id]; if (e.built === 'M4') m4.push(id); else count[String(e.ready)]++; }
const pairs = keys(R.CAUSES).reduce((n, k) => n + keys(R.CAUSES[k]).length, 0);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `lint-registry: ${problems.length} problem(s)` :
  `lint-registry: ${packs.length} packs, ${ids.size} species, ${R.EVENT_KINDS.length} event kinds, ${pairs} cause pairs, ${ledger.entries.length} ledger entries clean; M3 entries at ready false ${count.false}, 'unit' ${count.unit}, true ${count.true}; ${m4.length} M4 entries${strict ? '; strict' : ''}`);
process.exit(problems.length ? 1 : 0);
