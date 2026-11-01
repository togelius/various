#!/usr/bin/env node
// ACCESSION — the registry and ledger lint (BUILD.md §5.1, §9.3). Fails when:
//   there are more than ten universal systems;
//   a pack uses an archetype, trigger, modifier, module or item primitive not in the
//   registry; an id is duplicated within or across packs; a species has more than one
//   special trigger; a department owns more than two modules;
//   the registry's event kinds differ from BUILD.md §4.3's list;
//   an event kind or a (kind, cause) pair has no schema or no sentence, or a sentence has
//   no schema, or a log group (Text.defineGroup) no cause schema; a wake cause lacks its
//   woke and hunting causes; a trigger that wakes an exhibit into a mode (a wake cause waking it hunting or awake, not a creation cause)
//   lacks its pip cause, which Wake.addPips emits before it wakes; a damaged cause does not accept saved and side (Combat.hurt
//   marks saved on any cause, old_repair side on a blow, shot or beam); a refusal code has
//   no sentence, or a sentence no code;
//   a clause template names a parameter it does not define, or a special or status its
//   entry does not name; a module slot ({module:<id>|<fallback>}, §5.3) names no module or
//   does not parse (its fallback's words are linted as the clause's); a module's panel
//   sentence names a parameter its entry does not define; a parameter reference cannot be
//   read; a clause covers an unknown event kind; a pack species' Behaviour line cannot be
//   filled at some depth 1–7;
//   an entry at ready 'unit' or above names no tests, a test file that does not exist, or
//   no invariant file that exists (test/behaviour/<inv>.inv.js); an entry at ready true
//   names no scenario file under test/behaviour/ (true means its joined-up scenarios pass);
//   a built: 'M3' id, or a built: 'M4' id past ready false, is referenced by no pack,
//   scenario test or arena fixture (§5.1; refs, below): a pack uses it (a species'
//   archetype, trigger or modifiers, its archetype's special, inflicted statuses and wake
//   clause, its role's clause if it has one, and the modules it is flagged with; a module the
//   pack holds; an item's primitives, instrument and weapon or garment clause, and an
//   instrument's charges; a consumable kind the pack labels), or one of the scenario files
//   its entry names in `tests` names it in quotes, or an arena stamp (test/arena/*.txt)
//   names it as a word;
//   a refusal code at ready true (joined up, §5.1) is made to happen in no refusals file
//   (under --strict, every refusal code of the milestones it checks): none of the
//   test/behaviour/refusals*.test.js files its entry names in `tests` has a case with that
//   code (`code: 'sealed'`) (M4 plan A4: each owner's refusals-<owner>.test.js makes its
//   codes happen by a real action at depths 1–7, as behaviour/refusals.test.js does M3's);
//   the word rules (M4 plan W0a; §5.3's "no vague words"), over every template a player
//   reads: the clause of every entry past ready false, every module's panel sentence (on its
//   panels and in the log while the module is on, whatever its readiness), and every clause
//   on the line of a species population can place (its archetype M3's or past ready false),
//   whatever its own readiness (a placeholder no one reads waits for its owner):
//     - a built: 'M4' template has a digit outside {} (a number is a parameter, so it is
//       filled from its row and cannot drift from it), or a number in words no tied phrase
//       says ("twenty turns", "twice", "one limb");
//     - a template uses a phrase of PHRASES, which states a number in words ("two tiles a
//       turn", "half speed", "two halves", "double damage"), without tying it to the row it
//       states (the entry's own `phrases: {phrase: 'N:ROW'}`, or for an M3 entry, whose
//       fragment is frozen, M3_PHRASES below), or the row no longer holds what the phrase
//       says, or a tie names a phrase the template does not use or PHRASES lacks;
//   a species' flag (sp.flags, the modules it is flagged with) names a module its own
//   department does not hold, or any module for a shared species, which has no department;
//   a module's keywords (the words that name its rule) are not a list of words;
//   a pack's Intro teaches anything but its signature module (§5.1; WO6 of the M4 maps): its
//   signature is the module with role 'signature', else its first; its intro panel
//   (panels.intro) says another module's panel sentence or one of its keywords; its stamp
//   (intro: {map, legend}) puts there an exhibit flagged with another module and not with the
//   signature (the signature's teaching instance may carry another module's flag: it says how
//   that module acts on it where that module's means are, and the Intro holds none of them, as
//   this rule sees to: M.11's station, stopped by rain from a weather case), a weather case
//   (a legend case with `weather`) unless weather_cases is the signature, more than
//   INTRO_HOSTILES exhibits, or an exhibit neither of an orientation role (fodder,
//   skirmisher) nor flagged with the signature (its teaching instance), or names a species
//   its pack does not hold;
//   a file in art/, vendor/ or tools/vendor/ has no ledger entry, or an entry has no file;
//   anything under art/reference/ is referenced by the game.
// It reports how many M3 and how many M4 entries are at ready false, 'unit' and true. With
// --strict (the M3 and M4 acceptance, §11) it also fails on any built: 'M3' or 'M4' entry
// that is not at ready true with its tests and its invariant, and applies the word rules and
// the refusal rule to every entry of those milestones; --strict=M3 (M3's acceptance, as it
// was before M4) or --strict=M4 checks only the entries that milestone builds. With
// --strict --follow-ups (the joined-up scenarios' done condition) an entry below true passes
// while it has an open follow-up in test/behaviour/follow-ups.json ({"TABLE.id": "the
// follow-up and why"}; no file is no follow-ups), and a follow-up for an id that is at true,
// or is not an entry of a milestone --strict checks, fails, so the list never goes stale.
// With --report ACC it prints the department's report (§5.2: "a pack may override a number
// only through a named field the lint lists in the department's report"): every number the
// pack holds, its parts merged, and every value it gives a module or a modifier (a module's
// params, a species' modParams), each with where it is, as "REPORT ACC: where = value".
// Options for the lint tests: --ledger FILE lints another copy of the ledger; --build FILE
// another copy of BUILD.md; --load FILE loads one more core file after the core (a planted
// fault); --follow-file FILE reads another copy of the follow-ups.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { loadCore } = require('./core-context.js');
const root = path.join(__dirname, '..');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const followUps = process.argv.includes('--follow-ups');
const C = loadCore(arg('--load') ? [path.resolve(arg('--load'))] : []);
const { Registry: R, Packs, Text, Clauses, N } = C;
const problems = [];
const bad = s => problems.push(s);
const keys = o => Object.keys(o || {});
const own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// --strict checks every milestone's entries; --strict=M3 or --strict=M4 one milestone's.
const MILESTONES = ['M3', 'M4'];
const strictArg = process.argv.find(a => a === '--strict' || a.startsWith('--strict='));
const strictOf = strictArg === undefined ? [] : strictArg === '--strict' ? MILESTONES.slice() : strictArg.slice('--strict='.length).split(',');
for (const m of strictOf) if (!MILESTONES.includes(m)) bad(`--strict=${m}: no such milestone (${MILESTONES.join(', ')})`);
const strict = strictOf.length > 0;
const strictFor = e => strictOf.includes(e.built);
// The word and refusal rules apply to an entry past ready false, and under --strict to every
// entry of the milestones it checks.
const linted = e => e.ready !== false || strictFor(e);

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
for (const [k, c] of said.groups) if (!R.CAUSES[k] || !R.CAUSES[k][c]) bad(`there is a log group for ${k}.${c} (Text.defineGroup), which has no cause schema`);
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
for (const name of ['clock', 'stage', 'recap', 'confirm', 'rest']) if (!Text.provided(name)) bad(`no fragment provides Text.${name}`);

// Open follow-ups (--follow-ups): an entry below true that one names passes --strict.
const FOLLOW = arg('--follow-file') || path.join(root, 'test/behaviour/follow-ups.json');
const follow = followUps && fs.existsSync(FOLLOW) ? JSON.parse(fs.readFileSync(FOLLOW, 'utf8')) : {};
const held = [], followOf = strict ? strictOf : MILESTONES;
if (followUps) for (const [where, why] of Object.entries(follow)) {
  const [t, ...rest] = where.split('.'), id = rest.join('.'), e = R.TABLES.includes(t) && Object.prototype.hasOwnProperty.call(R[t], id) ? R[t][id] : null;
  if (!e || !followOf.includes(e.built)) bad(`follow-ups: ${where} is not an ${followOf.join(' or ')} entry`);
  else if (e.ready === true) bad(`follow-ups: ${where} is at ready true; its follow-up is closed, so take it off the list`);
  if (typeof why !== 'string' || !why.trim()) bad(`follow-ups: ${where} gives no follow-up`);
}

// Clause templates (§5.3).
const REF = /^(N:[A-Z][A-Z0-9_]*(\[\d+\])?|curve:[A-Z][A-Z0-9_]*|cp:[A-Z][A-Z0-9_]*|role:(HP|DMG)|mod:[a-z][a-z0-9_]*|lock:GLASS\[\d+\])$/;
// A clause as it reads with every module slot ({module:<id>|<fallback>}, Clauses.slots) at its
// fallback: the words a player reads with the module off, which the word rules read, and
// whose holes are its own. A slot naming no module, or one that does not parse, fails.
const UNSLOTTED = new Map();
function unslotted(where, template) {
  if (UNSLOTTED.has(where)) return UNSLOTTED.get(where);
  UNSLOTTED.set(where, template);
  try {
    for (const s of Clauses.slots(template)) if (!R.MODULES[s.id]) bad(`${where}: its slot names ${s.id}, which is no module`);
    UNSLOTTED.set(where, Clauses.unslot(template, () => false));
  } catch (err) { bad(`${where}: ${err.message}`); }
  return UNSLOTTED.get(where);
}
// The same clause with every slot holding its module's clause, as a line sets it where the
// module is on (null while a slot's module has no clause yet): the other form a player reads.
function slotted(template) {
  let out = '', from = 0;
  for (const s of Clauses.slots(template)) {
    const M = R.MODULES[s.id];
    if (!M || typeof M.clause !== 'string') return null;
    out += template.slice(from, s.at) + M.clause;
    from = s.end;
  }
  return out + template.slice(from);
}
const slotsOf = template => { try { return Clauses.slots(template); } catch (err) { return []; } };
// A Centrepiece's phase parts (§5.3, Q10), 'TABLE.id' → where they are named: each continues
// "From phase k: …" on its line (Clauses.join), so its clause is read as a continuation.
const PHASE_PARTS = new Map();
for (const [, sp] of allSpecies) if (Array.isArray(sp.phases)) sp.phases.forEach((ph, i) => {
  for (const ref of ph && Array.isArray(ph.parts) ? ph.parts : []) {
    if (typeof ref !== 'string') continue;
    if (!PHASE_PARTS.has(ref)) PHASE_PARTS.set(ref, []);
    PHASE_PARTS.get(ref).push(`${sp.id}'s phase ${i + 1}`);
  }
});
const sentence = { ARCHETYPES: true, MODIFIERS: true, CLAUSES: true, SPECIALS: false, STATUSES: false };
for (const t of R.TABLES) for (const id of R.order(t)) {
  const e = R[t][id], where = `${t}.${id}`;
  if (!Array.isArray(e.tests)) bad(`${where}: tests is not a list`);
  if (e.ready === 'unit' || e.ready === true) {
    if (!e.tests.length) bad(`${where} is at ready ${JSON.stringify(e.ready)} but names no tests`);
    for (const f of e.tests) if (!fs.existsSync(path.join(root, 'test', f))) bad(`${where} names the test test/${f}, which does not exist`);
    if (!e.inv || !fs.existsSync(path.join(root, 'test/behaviour', e.inv + '.inv.js'))) bad(`${where} is at ready ${JSON.stringify(e.ready)} but its invariant test/behaviour/${e.inv}.inv.js does not exist`);
  }
  if (e.ready === true && !e.tests.some(f => /^behaviour\/[^/]+\.test\.js$/.test(f))) bad(`${where} is at ready true but names no joined-up scenario file (test/behaviour/*.test.js)`);
  if (strictFor(e) && (e.ready !== true || !e.tests.length || !e.inv)) {
    const open = followUps && Object.prototype.hasOwnProperty.call(follow, where) ? follow[where] : null;
    if (open === null) bad(`--strict: ${where} is at ready ${JSON.stringify(e.ready)}, with ${e.tests.length} test(s) and invariant ${e.inv}`);
    else held.push(`${where} (${e.ready}): ${open}`);
  }
  // A module's panel sentence is a template over the same params as its clause (§5.4).
  const told = t === 'MODULES' && typeof e.sentence === 'string' ? e.sentence : '';
  if (e.clause === undefined) {
    for (const m of told.matchAll(/\{([^}]*)\}/g)) if (!own(e.params, m[1])) bad(`${where}: {${m[1]}} in its sentence has no parameter`);
    continue;
  }
  for (const [name, ref] of Object.entries(e.params)) if (typeof ref !== 'string' || !REF.test(ref)) bad(`${where}: the parameter ${name} has the reference ${JSON.stringify(ref)}`);
  for (const k of e.covers) if (!R.EVENTS[k]) bad(`${where} covers ${k}, which is not an event kind`);
  const clause = unslotted(where, e.clause);
  const holes = [...(clause + ' ' + told).matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
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
  // set inside its archetype's; a trigger's continues the wake clause unless it replaces it;
  // a Centrepiece's phase part continues "From phase k: …", whatever its table. A clause with
  // module slots is read in both its forms: at its fallbacks (module off), and with each
  // module's clause in its slot (module on), where the words must also join: no word run
  // into the next, no full stop inside a sentence, no space before a stop or a comma.
  const phase = PHASE_PARTS.get(where);
  const full = phase ? false : t === 'TRIGGERS' ? !!e.replacesWake : sentence[t];
  const slots = slotsOf(e.clause), forms = [['', clause]];
  if (slots.length && t === 'MODULES') bad(`${where}: a module's clause holds a module slot: "${e.clause}"`);
  else if (slots.length && slotted(e.clause) !== null) forms.push([' with its module on', slotted(e.clause)]);
  for (const [how, text] of forms) {
    if (full === true && !/^[A-Z].*\.$/.test(text)) bad(`${where}: its clause should be a sentence${how}: "${text}"`);
    if (full === false && (/\.$/.test(text) || /^[A-Z]/.test(text))) bad(`${where}: its clause should continue ${phase ? `"From phase k: …" (${phase.join(', ')})` : 'another'}${how}: "${text}"`);
    if (slots.length && /[a-z0-9}][A-Z]|\.\s*[a-z,;:]|\s[.,;:]|\s\s/.test(text)) bad(`${where}: its slot's words do not join the clause${how}: "${text}"`);
  }
}
// A module's clause on the line of a species flagged with it: set in a slot of one of the
// species' clauses (read with them, above), or else a sentence of its own (Clauses.of).
for (const [, sp] of allSpecies) for (const id of Array.isArray(sp.flags) ? sp.flags : []) {
  const M = R.MODULES[id], a = R.ARCHETYPES[sp.archetype];
  if (!M || typeof M.clause !== 'string' || !a) continue;
  const tr = sp.trigger ? R.TRIGGERS[sp.trigger] : null, entries = [a, R.CLAUSES['role_' + sp.role], tr, tr && tr.replacesWake ? null : R.CLAUSES[a.wake || 'wake']];
  for (const m of sp.modifiers || []) entries.push(R.MODIFIERS[m]);
  for (const ph of Array.isArray(sp.phases) ? sp.phases : []) for (const ref of ph && Array.isArray(ph.parts) ? ph.parts : []) {
    const r = typeof ref === 'string' ? /^([A-Z][A-Z_]*)\.(.+)$/.exec(ref) : null;
    if (r && R[r[1]] && own(R[r[1]], r[2])) entries.push(R[r[1]][r[2]]);
  }
  const inSlot = entries.some(e => e && typeof e.clause === 'string' && slotsOf(e.clause).some(s => s.id === id));
  if (!inSlot && !/^[A-Z].*\.$/.test(M.clause)) bad(`MODULES.${id}: its clause is a sentence of its own on ${sp.id}'s line (no clause of it has a slot for ${id}), so it should be a sentence: "${M.clause}"`);
}

// The word rules (M4 plan W0a), over a template: an entry's clause, and a module's panel
// sentence (§5.4: "the panel sentence, a template over params"), wherever a player reads it:
// an entry past ready false; every module's panel sentence, which a panel, its banner and a
// module event's default sentence show while the module is on, whatever its readiness; and
// every entry a species' Behaviour line shows once population can place the species (its
// archetype is M3's or past ready false, M4 plan A10), whatever that entry's own readiness
// (a clockwork modifier at false on an archetype at 'unit'). A placeholder no one reads
// waits for its owner; --strict reads them all.
const KIND_TABLE = { archetype: 'ARCHETYPES', special: 'SPECIALS', status: 'STATUSES', role: 'CLAUSES', modifier: 'MODIFIERS', wake: 'CLAUSES', trigger: 'TRIGGERS', module: 'MODULES', clause: 'CLAUSES' };
const shown = new Set();
for (const [, sp] of allSpecies) {
  const a = R.ARCHETYPES[sp.archetype];
  if (!a || (a.built !== 'M3' && a.ready === false)) continue;
  let parts = [];
  try { parts = Clauses.of(sp, { depth: 1 }); } catch (err) { continue; } // a line that cannot be filled fails above
  for (const p of parts) {
    const t = own(KIND_TABLE, p.kind) ? KIND_TABLE[p.kind] : R.TABLES.find(x => own(R[x], p.id));
    if (t) shown.add(`${t}.${p.id}`);
  }
}
const readable = (t, e, where) => linted(e) || t === 'MODULES' || shown.has(where);
// PHRASES states a number in words; each is tied, entry by entry, to the row whose value it
// states: a row whose name ends in _PCT must hold pct (a cost of 50% is two tiles a turn), any
// other n.
const PHRASES = {
  'two tiles a turn': { pct: 50, n: 2 },
  'half speed': { pct: 200 },
  'two halves': { pct: 50 },
  'double damage': { pct: 200, n: 2 },
};
// Any other number in words in an M4 template is a number as a digit is ("for twenty turns"
// is "for 20 turns"), so it is tied to its row as a phrase is, the phrase stating the number
// its number word names: a number word from two to a hundred ("twenty-five" too), "twice",
// "double", "thrice" or "triple", or "one" before a rule noun ("one turn", "one limb";
// "restoring one" names no number).
const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, twice: 2, double: 2, thrice: 3, triple: 3 };
const ONE_NOUNS = ['turn', 'tile', 'step', 'pace', 'pip', 'limb', 'gallery', 'charge', 'blow', 'hit', 'action', 'piece', 'special', 'view', 'body',
  'grade', 'rank', 'level', 'square', 'exhibit', 'time', 'room', 'phase', 'stage', 'summon', 'mark', 'line', 'chime', 'case', 'perk'];
const UNITS_ = [ 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine' ];
// The numbers a text says in words: [{at, end, word, n}], at their places in it.
function numberWords(s) {
  const out = [], low = s.toLowerCase(), re = /[a-z]+(?:-[a-z]+)?/g;
  let m;
  while ((m = re.exec(low)) !== null) {
    const w = m[0], parts = w.split('-');
    if (parts.length === 2 && own(NUMBER_WORDS, parts[0]) && NUMBER_WORDS[parts[0]] >= 20 && UNITS_.indexOf(parts[1]) >= 0) {
      out.push({ at: m.index, end: m.index + w.length, word: w, n: NUMBER_WORDS[parts[0]] + UNITS_.indexOf(parts[1]) + 1 });
      continue;
    }
    for (const [i, part] of parts.entries()) {
      const at = m.index + parts.slice(0, i).join('-').length + (i ? 1 : 0);
      if (own(NUMBER_WORDS, part)) out.push({ at, end: at + part.length, word: part, n: NUMBER_WORDS[part] });
      else if (part === 'one') {
        const next = /^[\s-]+([a-z]+)/.exec(low.slice(at + 3)), noun = next ? next[1] : '';
        const sing = noun.endsWith('ies') ? noun.slice(0, -3) + 'y' : noun.endsWith('s') ? noun.slice(0, -1) : noun;
        if (ONE_NOUNS.includes(noun) || ONE_NOUNS.includes(sing)) out.push({ at, end: at + 3 + next[0].length, word: `one ${noun}`, n: 1 });
      }
    }
  }
  return out;
}
// What a tied phrase says: PHRASES' entry, or the one number its words name.
const statesOf = phrase => {
  if (own(PHRASES, phrase)) return PHRASES[phrase];
  const nw = numberWords(phrase);
  return nw.length === 1 ? { n: nw[0].n } : null;
};
// The M3 entries' ties, kept here since their fragments are frozen; an M4 entry gives its
// own, as `phrases`, beside its clause.
const M3_PHRASES = {
  'ARCHETYPES.darter': { 'two tiles a turn': 'N:SPEED_FAST_PCT' },
  'ARCHETYPES.mote_swarm': { 'two tiles a turn': 'N:SPEED_FAST_PCT' },
  'ARCHETYPES.splitter': { 'two halves': 'N:SPLIT_HP_PCT' },
  'ARCHETYPES.mimic_vitrine': { 'half speed': 'N:SPEED_SLOW_PCT' },
  'MODIFIERS.marble': { 'half speed': 'N:SPEED_SLOW_PCT' },
  'MODIFIERS.old_repair': { 'double damage': 'N:OLD_REPAIR_PCT' },
};
const ROW = /^N:([A-Z][A-Z0-9_]*)(\[(\d+)\])?$/;
const said_ = (template, phrase) => template.toLowerCase().includes(phrase);
// Where a phrase stands in a text: [[at, end]] for each time it is said.
const spans = (s, phrase) => { const out = [], low = s.toLowerCase(); for (let i = low.indexOf(phrase); i >= 0; i = low.indexOf(phrase, i + 1)) out.push([i, i + phrase.length]); return out; };
for (const t of R.TABLES) for (const id of R.order(t)) {
  const e = R[t][id], where = `${t}.${id}`;
  if (t === 'MODULES' && e.keywords !== undefined && !(Array.isArray(e.keywords) && e.keywords.every(k => typeof k === 'string' && /^[a-z][a-z ’'-]*[a-z]$/.test(k))))
    bad(`${where}: its keywords ${JSON.stringify(e.keywords)} are not a list of lower-case words`);
  const templates = [typeof e.clause === 'string' ? unslotted(where, e.clause) : undefined, t === 'MODULES' ? e.sentence : undefined].filter(x => typeof x === 'string');
  if (!templates.length || !readable(t, e, where)) continue;
  const text = templates.join(' '), bare = text.replace(/\{[^}]*\}/g, '');
  if (e.built === 'M4' && /[0-9]/.test(bare)) bad(`${where}: a digit outside {} in "${text}" (a number is a parameter, filled from its row)`);
  const ties = Object.assign({}, own(M3_PHRASES, where) ? M3_PHRASES[where] : {}, e.phrases && typeof e.phrases === 'object' ? e.phrases : {});
  for (const phrase of keys(PHRASES)) if (said_(text, phrase) && !own(ties, phrase)) bad(`${where}: "${phrase}" states a number in words, but is tied to no row (\`phrases: {'${phrase}': 'N:ROW'}\`)`);
  if (e.built === 'M4') {
    const covered = [...keys(PHRASES), ...keys(ties)].flatMap(p => spans(bare, p));
    for (const w of numberWords(bare)) if (!covered.some(([a, b]) => w.at >= a && w.end <= b))
      bad(`${where}: "${w.word}" states a number in words, but is tied to no row (\`phrases: {'<the phrase that says it>': 'N:ROW'}\`)`);
  }
  for (const [phrase, ref] of Object.entries(ties)) {
    const says = statesOf(phrase);
    if (!says) { bad(`${where}: its phrase "${phrase}" is not one of PHRASES, and names no one number in words`); continue; }
    if (!said_(text, phrase)) { bad(`${where}: its phrase "${phrase}" is tied to ${ref}, but its template no longer says it`); continue; }
    const m = typeof ref === 'string' ? ROW.exec(ref) : null;
    const v = m && own(N, m[1]) ? (m[3] !== undefined ? (Array.isArray(N[m[1]]) ? N[m[1]][Number(m[3])] : undefined) : N[m[1]]) : undefined;
    if (!Number.isInteger(v)) { bad(`${where}: its phrase "${phrase}" is tied to ${JSON.stringify(ref)}, which is no whole number of record`); continue; }
    const want = m[1].endsWith('_PCT') ? says.pct : says.n;
    if (want === undefined) bad(`${where}: "${phrase}" cannot state ${m[1]}, ${m[1].endsWith('_PCT') ? 'a share' : 'a count'}`);
    else if (v !== want) bad(`${where}: "${phrase}" says ${want}${m[1].endsWith('_PCT') ? '%' : ''}, but ${ref} is ${v}`);
  }
}

// Every refusal at ready true, joined up, is made to happen in a refusals file it names (M4
// plan A4); one at 'unit' is proved by its unit tests alone, as §5.1 has it.
for (const code of R.order('REFUSALS')) {
  const e = R.REFUSALS[code];
  if (e.ready !== true && !strictFor(e)) continue;
  const files = (e.tests || []).filter(f => /^behaviour\/refusals[^/]*\.test\.js$/.test(f)).map(f => path.join(root, 'test', f));
  // A case of the file names its code (`code: 'sealed'`, as refusals.test.js's cases do); a
  // code named only in a comment or a list of codes no action gives is not made to happen.
  const q = new RegExp(`\\bcode:\\s*['"\`]${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
  if (!files.some(f => fs.existsSync(f) && q.test(fs.readFileSync(f, 'utf8')))) bad(`REFUSALS.${code} is at ready ${JSON.stringify(e.ready)}, but no test/behaviour/refusals*.test.js file it names makes it happen (has a case with code: '${code}')`);
}

// Flags: a species is flagged only with modules its own department holds.
for (const p of packs) for (const sp of [...p.species, ...(p.centrepiece ? [p.centrepiece] : [])]) {
  if (sp.flags === undefined) continue;
  if (!Array.isArray(sp.flags)) { bad(`${sp.id}: its flags are not a list of modules`); continue; }
  for (const f of sp.flags) if (!(p.modules || []).some(m => m.id === f)) bad(`${sp.id} is flagged with ${JSON.stringify(f)}, a module its department ${p.acc} does not hold`);
}
for (const sp of shared) if (sp.flags !== undefined && !(Array.isArray(sp.flags) && sp.flags.length === 0)) bad(`${sp.id} is a shared species, with no department, but is flagged with ${JSON.stringify(sp.flags)}`);

// The Intro teaches only its department's signature module (§5.1; WO6).
const INTRO_HOSTILES = 3, INTRO_ROLES = ['fodder', 'skirmisher'];
// Every string inside x (a panel may be a string, a list, or an object of them).
const strings = x => typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === 'object' ? keys(x).flatMap(k => strings(x[k])) : [];
const wordRe = w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?($|[^a-z])`, 'i');
for (const p of packs) {
  const intro = p.intro, panel = p.panels && p.panels.intro;
  if (intro === undefined && panel === undefined) continue;
  const mods = p.modules || [], sig = (mods.find(m => m.role === 'signature') || mods[0] || {}).id || null;
  const others = R.order('MODULES').filter(m => m !== sig);
  for (const s of strings(panel)) for (const m of others) {
    const M = R.MODULES[m];
    if (typeof M.sentence === 'string' && s.includes(M.sentence)) bad(`${p.acc}'s intro panel says ${m}'s sentence, but its Intro teaches only ${sig || 'no module'}`);
    for (const k of Array.isArray(M.keywords) ? M.keywords : []) if (wordRe(k).test(s)) bad(`${p.acc}'s intro panel says "${k}", a word of ${m}'s rule, but its Intro teaches only ${sig || 'no module'}`);
  }
  if (intro === undefined || intro === null) continue;
  const rows = Array.isArray(intro.map) ? intro.map : typeof intro.map === 'string' ? intro.map.split('\n') : [];
  const legend = intro.legend && typeof intro.legend === 'object' ? intro.legend : {};
  let hostiles = 0;
  for (const ch of keys(legend)) {
    const L = legend[ch], n = rows.reduce((k, r) => k + r.split(ch).length - 1, 0);
    if (!n || !L || typeof L !== 'object') continue;
    // Read whatever shape the entry takes, so that a shape this rule did not foresee cannot
    // slip a weather case or an exhibit past it: weather anywhere in it, and every species id
    // anywhere in it (its `sp`, or any other field that names one).
    const weather = x => !!x && typeof x === 'object' && (!!x.weather || keys(x).some(k => weather(x[k])));
    if (weather(L) && sig !== 'weather_cases') bad(`${p.acc}'s Intro holds a weather case ('${ch}'), but teaches only ${sig || 'no module'}`);
    const named = [...new Set([...(typeof L.sp === 'string' ? [L.sp] : []), ...strings(L).filter(x => ids.has(x))])];
    for (const spId of named) {
      const sp = p.species.find(x => x.id === spId);
      if (!sp) { bad(`${p.acc}'s Intro places ${spId} ('${ch}'), which is no species of its pack`); continue; }
      hostiles += n * (Number.isInteger(L.count) && L.count > 0 ? L.count : 1);
      const flags = Array.isArray(sp.flags) ? sp.flags : [];
      // The teaching instance (flagged with the signature) may carry another module's flag too:
      // the Intro holds no means of that module (no weather case, and no exhibit flagged with it
      // alone), so the flag never acts there.
      if (!(sig && flags.includes(sig))) for (const f of flags) if (f !== sig) bad(`${p.acc}'s Intro places ${sp.id} ('${ch}'), flagged with ${f}, but teaches only ${sig || 'no module'}`);
      if (!INTRO_ROLES.includes(sp.role) && !(sig && flags.includes(sig))) bad(`${p.acc}'s Intro places ${sp.id} ('${ch}'), a ${sp.role}: only ${INTRO_ROLES.join(' and ')} or the signature's teaching instance (flagged with ${sig || 'it'}) belong there`);
    }
  }
  if (hostiles > INTRO_HOSTILES) bad(`${p.acc}'s Intro places ${hostiles} exhibits; it holds at most ${INTRO_HOSTILES}`);
}

// Every M3 id, and every M4 id past ready false, is referenced by a pack, a scenario test or
// an arena fixture (§5.1). What a pack's data names, table by table:
const used = new Set(), use = (t, id) => { if (typeof id === 'string' && id) used.add(t + '.' + id); };
for (const [, sp] of allSpecies) {
  use('ARCHETYPES', sp.archetype); use('TRIGGERS', sp.trigger);
  for (const m of sp.modifiers || []) use('MODIFIERS', m);
  const a = R.ARCHETYPES[sp.archetype], tr = sp.trigger ? R.TRIGGERS[sp.trigger] : null;
  if (!a) continue;
  use('SPECIALS', a.special);
  for (const st of a.inflicts || []) use('STATUSES', st);
  if (!(tr && tr.replacesWake)) use('CLAUSES', a.wake || 'wake');
  if (typeof sp.role === 'string' && R.CLAUSES['role_' + sp.role]) use('CLAUSES', 'role_' + sp.role);
  for (const f of Array.isArray(sp.flags) ? sp.flags : []) use('MODULES', f);
}
for (const p of packs) {
  for (const m of p.modules || []) use('MODULES', m.id);
  for (const it of p.items || []) {
    for (const pr of it.prims || []) use('ITEM_PRIMS', pr.id);
    if (it.kind === 'instrument') { use('INSTRUMENTS', it.instrument); use('ITEM_PRIMS', 'charges'); }
    if (it.kind === 'weapon' || it.kind === 'garment') use('CLAUSES', `${it.kind}_${it.form}`);
  }
  for (const k of keys(p.consumables && p.consumables.labels)) use('CONSUMABLES', k);
}
// The scenario files an entry names, and the arena stamps.
const text = new Map(), read = f => { if (!text.has(f)) text.set(f, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''); return text.get(f); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const arenaDir = path.join(root, 'test/arena');
const stamps = fs.existsSync(arenaDir) ? fs.readdirSync(arenaDir).filter(f => f.endsWith('.txt')).sort().map(f => read(path.join(arenaDir, f))) : [];
let refs = 0;
for (const t of R.TABLES) for (const id of R.order(t)) {
  const e = R[t][id], where = `${t}.${id}`;
  if (e.built !== 'M3' && !(e.built === 'M4' && linted(e))) continue;
  refs++;
  if (used.has(where)) continue;
  const q = new RegExp(`['"\`](${esc(t)}\\.)?${esc(id)}['"\`]`), w = new RegExp(`(^|[^A-Za-z0-9_.])${esc(id)}($|[^A-Za-z0-9_])`, 'm');
  if ((e.tests || []).some(f => q.test(read(path.join(root, 'test', f))))) continue;
  if (stamps.some(st => w.test(st))) continue;
  bad(`${where} is referenced by no pack, by none of its scenario files (${(e.tests || []).join(', ') || 'none'}) and by no arena stamp`);
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

// The department's report (--report ACC, §5.2): every number the pack holds, and every value
// it gives a module or a modifier, with where it is: a species, item, module or Centrepiece
// by its id, anything else by its path.
const reportOf = arg('--report');
const report = [];
if (reportOf !== null) {
  const p = packs.find(q => q.acc === reportOf);
  if (!p) bad(`--report ${reportOf}: no department pack has that accession`);
  else {
    const at = (where, k) => /^[A-Za-z_$][\w$]*$/.test(k) ? `${where}.${k}` : `${where}[${JSON.stringify(k)}]`;
    const modules = p.modules || [];
    // given: inside a module's params or a species' modParams, where every value is one the
    // pack gives a rule, numbers or not.
    const walk = (x, where, given) => {
      if (x === null || x === undefined) return;
      if (typeof x !== 'object') { if (typeof x === 'number' || given) report.push(`${where} = ${JSON.stringify(x)}`); return; }
      if (Array.isArray(x)) { x.forEach((y, i) => walk(y, `${where}[${i}]`, given)); return; }
      for (const k of keys(x)) walk(x[k], at(where, k), given || k === 'modParams' || (k === 'params' && modules.includes(x)));
    };
    // A species, item, module or the Centrepiece is named by its id, not its place in a list.
    const LISTS = { species: 'species', items: 'item', modules: 'module' };
    for (const k of keys(p)) {
      if (own(LISTS, k) && Array.isArray(p[k])) for (const y of p[k]) walk(y, `${LISTS[k]} ${y && y.id}`, false);
      else if (k === 'centrepiece' && p[k] && typeof p[k] === 'object') walk(p[k], `centrepiece ${p[k].id}`, false);
      else walk(p[k], k, false);
    }
  }
}

// How far the entries have come (§5.1): ready false, 'unit' and true, over every table.
const count = { M3: { false: 0, unit: 0, true: 0 }, M4: { false: 0, unit: 0, true: 0 } };
for (const t of R.TABLES) for (const id of R.order(t)) { const e = R[t][id]; count[e.built][String(e.ready)]++; }
const tally = m => `${m} entries at ready false ${count[m].false}, 'unit' ${count[m].unit}, true ${count[m].true}`;
const pairs = keys(R.CAUSES).reduce((n, k) => n + keys(R.CAUSES[k]).length, 0);
for (const r of report) console.log(`REPORT ${reportOf}: ${r}`);
if (reportOf !== null && !problems.length) console.log(`REPORT ${reportOf}: ${report.length} value(s) the pack gives`);
for (const p of problems) console.log('PROBLEM ' + p);
for (const h of held) console.log('OPEN FOLLOW-UP ' + h);
console.log(problems.length ? `lint-registry: ${problems.length} problem(s)` :
  `lint-registry: ${packs.length} packs, ${ids.size} species, ${R.EVENT_KINDS.length} event kinds, ${pairs} cause pairs, ${ledger.entries.length} ledger entries clean; ${tally('M3')}; ${tally('M4')}; ${refs} ids referenced${strict ? `; strict (${strictOf.join(', ')})` : ''}${followUps ? `, ${held.length} open follow-up(s)` : ''}`);
process.exit(problems.length ? 1 : 0);
