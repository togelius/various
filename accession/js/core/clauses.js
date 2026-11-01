// ACCESSION — Behaviour lines (BUILD.md §5.3). A label's line is assembled here from the
// registry's clause templates, one part per registry id the species uses, with every
// number filled in at the department's depth, so the line says what the rules do there.
// M4's W0e added the modules' parts and the {module:<id>|<fallback>} slot (a rule a module
// gives an exhibit is written once, in the module's part, so no line says it while the
// module is off: plan A11, Q3), `cp:` parameters, a Centrepiece's phases and its strip by
// phase (Q10), and a module's panel sentence (Clauses.sentence). M4's FU1 made a
// Centrepiece's strip short in every phase (the plan's amendment after ARCH-CP-CORE: its
// whole line takes up to 23 of the strip's 14 rows). Frozen until LABELS-M4.
'use strict';
const Clauses = (() => {
  // The event kinds any exhibit may cause or suffer. They need no clause of their own;
  // every other kind an exhibit causes must be covered by a clause of its line (§5.3).
  const UNIVERSAL = ['moved', 'opened', 'closed', 'noise', 'pip', 'woke', 'hunting', 'alerted', 'lost', 'returned', 'damaged', 'died'];

  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // The eight compass points in words: the one map every Behaviour line and sentence that
  // names a side (an old repair's) reads (Clauses.COMPASS), so they cannot drift apart.
  const COMPASS = Object.freeze({ N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' });
  const range = (lo, hi) => lo === hi ? String(lo) : lo + '–' + hi;

  // One parameter reference, read for a species at a depth. `mod` is the modifier (or
  // module) whose clause is being filled, if any.
  //   N:KEY       the number of record N.KEY (§8.10); N:KEY[i] the i-th of its values
  //   curve:KEY   the role curve N.KEY at the depth (Roles.at, §8.1)
  //   cp:KEY      a Centrepiece special's gross at the depth: KEY's curve as a share of the
  //               median visitor's health there, plus their Padding (Specials.cpGross, §8.1)
  //   role:HP     the species role's health at the depth; role:DMG its damage, as "min–max"
  //   mod:NAME    the species' modParams[mod].NAME (a module's panel sentence: the pack's
  //               params for the module); a compass side ('W') reads as its word
  //   lock:GLASS[i]  the locks a case of glass i + 1 can have at the depth (Cases.lockSpan,
  //               §8.3: its glass's range, never above the depth + 1), as on the badge:
  //               "Grade II", or "Grade II to Grade IV"
  // Anything missing throws, naming what is missing, so a line never shows a gap.
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const grade = n => 'Grade ' + (ROMAN[n] || String(n));
  function value(ref, sp, depth, mod) {
    const m = /^(N|curve|cp|role|mod|lock):([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(ref);
    const where = `${sp && sp.id ? sp.id : 'a species'}: ${ref}`;
    if (!m) throw new Error(`Clauses: cannot read the parameter reference ${where}`);
    const [, kind, key, index] = m;
    if (kind === 'N' || kind === 'curve' || kind === 'cp') {
      if (!own(N, key)) throw new Error(`Clauses: ${where} names no number of record`);
      if (kind === 'curve') return Roles.at(N[key], depth);
      if (kind === 'cp') return Specials.cpGross(key, depth);
      if (index === undefined) return N[key];
      if (!Array.isArray(N[key]) || +index >= N[key].length) throw new Error(`Clauses: ${where} has no value ${index}`);
      return N[key][+index];
    }
    if (kind === 'role') {
      if (!sp || !sp.role) throw new Error(`Clauses: ${where} needs a species with a role`);
      const s = Roles.stats(sp.role, depth);
      if (key === 'HP') return s.hp;
      if (key === 'DMG') return range(s.dmin, s.dmax);
      throw new Error(`Clauses: ${where}: a role gives only HP or DMG`);
    }
    if (kind === 'lock') {
      if (key !== 'GLASS' || index === undefined || +index >= N.GLASS_LOCK_MIN.length) throw new Error(`Clauses: ${where}: a lock is lock:GLASS[i], i a glass's index`);
      const [lo, hi] = Cases.lockSpan(+index + 1, depth);
      return lo === hi ? grade(lo) : `${grade(lo)} to ${grade(hi)}`;
    }
    const p = sp && sp.modParams && mod && own(sp.modParams, mod) ? sp.modParams[mod] : null;
    if (!p || p[key] === undefined || p[key] === null) throw new Error(`Clauses: ${where} needs modParams.${mod}.${key}`);
    return own(COMPASS, p[key]) ? COMPASS[p[key]] : p[key];
  }

  // Every parameter of an entry, as {name: value}.
  function params(refs, sp, ctx, mod) {
    const out = {}, depth = (ctx && ctx.depth) || 1;
    for (const name of Object.keys(refs || {})) out[name] = value(refs[name], sp, depth, mod || null);
    return out;
  }

  // Fill a template's {name} placeholders from values. A placeholder with no value throws.
  function fill(template, values) {
    return template.replace(/\{([A-Za-z0-9_:]+)\}/g, (all, name) => {
      const v = values ? values[name] : undefined;
      if (v === undefined || v === null) throw new Error(`Clauses: ${all} has no value in "${template}"`);
      return String(v);
    });
  }

  // ---- The module slot ----
  // {module:<id>|<fallback>} in a clause: where the species is flagged with module id and the
  // module is on, the module's part goes there, as a special's goes at {special}; otherwise
  // the fallback, what the exhibit does without it ("Walks a tile at a time"). The fallback
  // may hold placeholders of its own ({dmg}), never another slot, and may be empty.
  // Clauses.slots(template) → [{id, fallback, at, end}], in order; a slot left open, with no
  // fallback bar or a module id that is not one, or a slot inside a slot, throws.
  const SLOT = '{module:';
  function slots(template) {
    const out = [];
    for (let i = template.indexOf(SLOT); i >= 0; i = template.indexOf(SLOT, i + 1)) {
      const bar = template.indexOf('|', i), id = bar < 0 ? '' : template.slice(i + SLOT.length, bar);
      if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new Error(`Clauses: a module slot is {module:<id>|<fallback>}, in "${template}"`);
      let depth = 1, j = bar + 1;
      for (; j < template.length && depth; j++) if (template[j] === '{') depth++; else if (template[j] === '}') depth--;
      if (depth) throw new Error(`Clauses: the slot for ${id} is never closed, in "${template}"`);
      const fallback = template.slice(bar + 1, j - 1);
      if (fallback.includes(SLOT)) throw new Error(`Clauses: a slot inside the slot for ${id}, in "${template}"`);
      out.push({ id, fallback, at: i, end: j });
      i = j - 1;
    }
    return out;
  }
  // Clauses.unslot(template, pick) → the template with each slot replaced by {module:<id>},
  // filled with the module's part, where pick(id) is true, or else by its fallback.
  function unslot(template, pick) {
    let out = '', from = 0;
    for (const s of slots(template)) { out += template.slice(from, s.at) + (pick(s.id) ? `{module:${s.id}}` : s.fallback); from = s.end; }
    return out + template.slice(from);
  }

  function entry(table, id) {
    if (!own(Registry[table], id)) throw new Error(`Clauses: ${table} has no ${id}`);
    return Registry[table][id];
  }
  function part(kind, id, e, sp, ctx, mod, extra, template) {
    const values = params(e.params, sp, ctx, mod);
    const text = fill(template === undefined ? e.clause : template, Object.assign({}, values, extra || {}));
    if (/[{}]/.test(text)) throw new Error(`Clauses: ${id}'s clause leaves a brace in "${text}"`);
    return { id, kind, text, params: values, covers: e.covers.slice(), inv: e.inv, built: e.built, ready: e.ready, within: null };
  }

  // The context of a line: depth; rulesOff (the ids switched off); modules (the modules on
  // in the visit, Modules.active, where a label knows them: one not listed is off; with
  // none given, a module is on unless rulesOff names it); phase (a Centrepiece's, for its
  // strip).
  const ctxOf = ctx => ({ depth: (ctx && ctx.depth) || 1, rulesOff: (ctx && ctx.rulesOff) || [], modules: ctx && Array.isArray(ctx.modules) ? ctx.modules : null });

  // A Centrepiece's phases (sp.phases, one record a phase, in order): each may list `parts`,
  // 'TABLE.id' refs to registry entries whose clauses join its line from that phase on
  // (§5.5's "what changes"); a part of phase 1 holds from the start. A clause of a phase
  // part continues "From phase 2: …", as a special's continues its archetype's: lower case,
  // no full stop, in both of its slots' forms (lint-registry reads each phase part so, and
  // a CLAUSES entry written as one is not a sentence of its own).
  // (A module's words come into a phase through a slot in a phase part's clause, so they go
  // with the module.)
  const PHASE_KINDS = { ARCHETYPES: 'archetype', SPECIALS: 'special', STATUSES: 'status', MODIFIERS: 'modifier', TRIGGERS: 'trigger', CLAUSES: 'clause' };
  function phasesOf(sp) {
    if (sp.phases === undefined || sp.phases === null) return [];
    if (!Array.isArray(sp.phases)) throw new Error(`Clauses: ${sp.id}'s phases are not a list`);
    return sp.phases.map((ph, i) => {
      if (!ph || typeof ph !== 'object' || Array.isArray(ph)) throw new Error(`Clauses: ${sp.id}'s phase ${i + 1} is not a record`);
      const refs = ph.parts === undefined ? [] : ph.parts;
      if (!Array.isArray(refs)) throw new Error(`Clauses: ${sp.id}'s phase ${i + 1} parts are not a list`);
      return refs.map(ref => {
        const m = typeof ref === 'string' ? /^([A-Z][A-Z_]*)\.(.+)$/.exec(ref) : null;
        if (!m || !own(PHASE_KINDS, m[1])) throw new Error(`Clauses: ${sp.id}'s phase ${i + 1} part ${JSON.stringify(ref)} is not 'TABLE.id' (${Object.keys(PHASE_KINDS).join(', ')})`);
        const e = entry(m[1], m[2]);
        if (typeof e.clause !== 'string') throw new Error(`Clauses: ${sp.id}'s phase ${i + 1} part ${ref} has no clause`);
        return { table: m[1], id: m[2], e };
      });
    });
  }

  // Clauses.of(sp, {depth, rulesOff, modules}): one part per registry id the species uses
  // (§5.3), in the order the line reads: its archetype; the archetype's special, each status
  // it inflicts and each module it embeds at a slot, whose texts the archetype's clause sets
  // at {special}, {status:<id>} and {module:<id>} (their parts say so in `within`); its
  // role's own rule, when the role has one (the clause CLAUSES.role_<role>: the brute's);
  // a Centrepiece's form's rule (CLAUSES.cp_fight or cp_treasure, by its record's form);
  // each modifier not switched off by rulesOff; each module the species is flagged with
  // (sp.flags) that is on, as a sentence of its own unless a slot embeds it; for a
  // Centrepiece, each phase's parts (`phase`: the phase it holds from); the wake clause (the
  // pipless one if the archetype says so), unless the trigger stands instead of it; the
  // special trigger. A module is on for the line when its rules are defined
  // (Modules.defined: until then nothing acts, and the slot reads its fallback), rulesOff
  // does not name it, and ctx.modules, if given, does. Ids the registry does not know give
  // no part (lint-registry fails on them).
  function of(sp, ctx) {
    const c = ctxOf(ctx), R = Registry, parts = [];
    const flags = Array.isArray(sp.flags) ? sp.flags : [];
    const isOn = id => flags.includes(id) && Modules.defined(id) && !c.rulesOff.includes(id) && (c.modules === null || c.modules.includes(id));
    const placed = [];
    // An entry's special and statuses, set inside its clause: {extra, inner}.
    function embeds(e, owner) {
      const extra = {}, inner = [];
      if (e.special) { const p = part('special', e.special, entry('SPECIALS', e.special), sp, c, null); p.within = owner; extra.special = p.text; inner.push(p); }
      for (const id of e.inflicts || []) { const p = part('status', id, entry('STATUSES', id), sp, c, null); p.within = owner; extra['status:' + id] = p.text; inner.push(p); }
      return { extra, inner };
    }
    // A module's part for this species, set inside `within`'s clause, or a sentence of its
    // own (within null); with its own special and statuses inside it.
    function modulePart(id, within) {
      const M = entry('MODULES', id);
      if (typeof M.clause !== 'string') throw new Error(`Clauses: ${sp.id} is flagged with ${id}, whose registry entry has no clause to say its rule`);
      if (slots(M.clause).length) throw new Error(`Clauses: ${id}'s clause holds a module slot`);
      if (placed.includes(id)) throw new Error(`Clauses: ${sp.id}'s line sets ${id}'s part twice`);
      placed.push(id);
      const { extra, inner } = embeds(M, id), p = part('module', id, M, sp, c, id, extra);
      p.within = within;
      return [p].concat(inner);
    }
    // A clause's part, its module slots filled for this species: [part, …parts set inside it].
    function whole(kind, id, e, mod, withEmbeds) {
      const { extra, inner } = withEmbeds ? embeds(e, id) : { extra: {}, inner: [] }, mods = [];
      const template = unslot(e.clause, mid => {
        if (!own(R.MODULES, mid)) throw new Error(`Clauses: ${id}'s clause has a slot for ${mid}, which is no module`);
        if (!isOn(mid)) return false;
        const got = modulePart(mid, id);
        extra['module:' + mid] = got[0].text;
        mods.push(...got);
        return true;
      });
      return [part(kind, id, e, sp, c, mod, extra, template)].concat(inner, mods);
    }
    const arch = own(R.ARCHETYPES, sp.archetype) ? R.ARCHETYPES[sp.archetype] : null;
    if (arch) parts.push(...whole('archetype', sp.archetype, arch, null, true));
    const role = typeof sp.role === 'string' ? 'role_' + sp.role : null;
    if (role && own(R.CLAUSES, role)) parts.push(...whole('role', role, R.CLAUSES[role], null, false));
    // A Centrepiece's record names its form (M4, §5.5): its form's rule, CLAUSES.cp_<form>
    // (its phases, and what its fall gives), a part of kind clause.
    const form = typeof sp.form === 'string' ? 'cp_' + sp.form : null;
    if (form && own(R.CLAUSES, form)) parts.push(...whole('clause', form, R.CLAUSES[form], null, false));
    for (const m of sp.modifiers || []) if (own(R.MODIFIERS, m) && !c.rulesOff.includes(m)) parts.push(...whole('modifier', m, R.MODIFIERS[m], m, false));
    const tail = [];
    phasesOf(sp).forEach((list, i) => {
      for (const { table, id, e } of list) {
        const got = whole(PHASE_KINDS[table], id, e, null, true);
        // A phase part that says nothing (a slot with an empty fallback, its module off) adds
        // no rule: it is not on the line, so no "From phase k: ." and no rest for the label.
        if (!got[0].text) continue;
        for (const p of got) p.phase = i + 1;
        tail.push(...got);
      }
    });
    const trig = own(R.TRIGGERS, sp.trigger) ? R.TRIGGERS[sp.trigger] : null;
    if (!(trig && trig.replacesWake)) { const w = (arch && arch.wake) || 'wake'; tail.push(...whole('wake', w, entry('CLAUSES', w), null, false)); }
    if (trig) tail.push(...whole('trigger', sp.trigger, trig, null, false));
    // The modules no slot set inside a clause: each a sentence of its own, after the modifiers.
    const own_ = [];
    for (const id of flags) if (own(R.MODULES, id) && isOn(id) && !placed.includes(id)) own_.push(...modulePart(id, null));
    return parts.concat(own_, tail);
  }

  // The words a Centrepiece's phases add (Q10): a phase's parts read "From phase 2: …"; those
  // of phase 1 hold from the start, and read as a sentence of their own. A Centrepiece's strip
  // names its phase ("Phase 2 of 3.") and ends "Its label has the rest."
  const FROM_PHASE = k => `From phase ${k}: `;
  const PHASE_OF = (k, n) => `Phase ${k} of ${n}.`;
  const REST = 'Its label has the rest.';
  const sentenceOf = s => s.charAt(0).toUpperCase() + s.slice(1);
  // What one phase's parts say, joined: "marks …; calls …." (no "From phase k:").
  const said = (parts, k) => parts.filter(p => !p.within && p.phase === k).map(p => p.text.replace(/\.$/, '')).join('; ');
  // A Centrepiece is a record with a form (§5.5); it has a phase for its full health and one
  // past each threshold of CP_PHASE_PCT, whatever its record's phases list (Centrepiece's
  // LAST), and its record lists at most that many. Anything else has the phases it lists.
  const isCentrepiece = sp => typeof sp.form === 'string';
  function phaseCount(sp) {
    const listed = phasesOf(sp).length;
    if (!isCentrepiece(sp)) return listed;
    const n = 1 + N.CP_PHASE_PCT.length;
    if (listed > n) throw new Error(`Clauses: ${sp.id} lists ${listed} phases, and a Centrepiece has ${n}`);
    return n;
  }

  // The line from parts (those of Clauses.of, or a strip's): the archetype's and modifiers'
  // sentences and the modules' own, then each phase's, then the wake clause with the special
  // trigger's clause joined to it ("…near it; wakes at once when …").
  function join(all) {
    const parts = all.filter(p => !p.within);
    const wake = parts.find(p => p.kind === 'wake'), trig = parts.find(p => p.kind === 'trigger');
    const out = parts.filter(p => p.kind !== 'wake' && p.kind !== 'trigger' && p.phase === undefined).map(p => p.text);
    const phases = [];
    for (const p of parts) if (p.phase !== undefined && !phases.includes(p.phase)) phases.push(p.phase);
    for (const k of phases.sort((a, b) => a - b)) out.push(k === 1 ? sentenceOf(said(parts, k)) + '.' : FROM_PHASE(k) + said(parts, k) + '.');
    if (wake && trig) out.push(wake.text.replace(/\.$/, '') + '; ' + trig.text + '.');
    else if (wake || trig) out.push((wake || trig).text);
    return out.join(' ');
  }
  // The Behaviour line, whole (the label's).
  const line = (sp, ctx) => join(of(sp, ctx));

  function checkPhase(sp, phase) {
    const n = phaseCount(sp);
    if (!Number.isInteger(phase) || phase < 1 || phase > Math.max(1, n)) throw new Error(`Clauses: ${sp.id} has no phase ${phase} (${n} phases)`);
    return n;
  }
  // Clauses.phaseParts(sp, phase, ctx) → the parts of a Centrepiece's line that hold in that
  // phase: those of no phase, and those of the phases up to it (a rule a phase adds holds
  // from then on).
  function phaseParts(sp, phase, ctx) {
    checkPhase(sp, phase);
    return of(sp, ctx).filter(p => p.phase === undefined || p.phase <= phase);
  }
  // Clauses.strip(sp, ctx) → what the strip shows: a gallery line, whole; a Centrepiece's
  // (Q10, as the plan's amendment after ARCH-CP-CORE decided it, without play; revisit once
  // M4 is playable), in each phase k of its n (ctx.phase, which it must be given), four
  // things only, so it fits the strip in every phase however long its line:
  //   - "Phase k of n.";
  //   - its form's short sentence, the `strip` of its form's entry (CLAUSES.cp_fight: "Its
  //     fall earns the Certificate, unless you have it."), filled as its clause is;
  //   - the parts its line adds for phase k itself (its "From phase k: …", as a sentence of
  //     its own; phase 1's, what it has from the start), with its modules and modifiers on or
  //     off as for the line; none where phase k adds nothing. What earlier phases added still
  //     holds, and with its archetype's rule, its form's whole rule and its wake, is on its
  //     label;
  //   - "Its label has the rest.", which is always true: the label shows the whole line.
  function strip(sp, ctx) {
    if (!isCentrepiece(sp)) return line(sp, ctx);
    const k = ctx ? ctx.phase : undefined;
    if (k === undefined || k === null) throw new Error(`Clauses: ${sp.id} is a Centrepiece, so its strip needs its phase (ctx.phase)`);
    const n = checkPhase(sp, k), c = ctxOf(ctx), id = 'cp_' + sp.form, e = entry('CLAUSES', id);
    if (typeof e.strip !== 'string') throw new Error(`Clauses: CLAUSES.${id} has no short sentence for a Centrepiece's strip (strip)`);
    const short = part('clause', id, e, sp, c, null, null, e.strip).text, own_ = said(of(sp, ctx), k);
    return [PHASE_OF(k, n), short].concat(own_ ? [sentenceOf(own_) + '.'] : [], [REST]).join(' ');
  }

  // Clauses.sentence(id, {depth, params}) → module id's panel sentence (§5.4: "a template over
  // params"), its parameters filled at the depth; `mod:NAME` reads the pack's params for it.
  function sentence(id, ctx) {
    const M = entry('MODULES', id);
    if (typeof M.sentence !== 'string') throw new Error(`Clauses: the module ${id} has no panel sentence`);
    const values = params(M.params, { id: `the module ${id}`, modParams: { [id]: (ctx && ctx.params) || {} } }, ctxOf(ctx), id);
    return fill(M.sentence, values);
  }

  return { UNIVERSAL, COMPASS, of, line, strip, phaseParts, sentence, slots, unslot, fill, params, value };
})();
