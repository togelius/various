// ACCESSION — Behaviour lines (BUILD.md §5.3). A label's line is assembled here from the
// registry's clause templates, one part per registry id the species uses, with every
// number filled in at the department's depth, so the line says what the rules do there.
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

  // One parameter reference, read for a species at a depth. `mod` is the modifier whose
  // clause is being filled, if any.
  //   N:KEY       the number of record N.KEY (§8.10); N:KEY[i] the i-th of its values
  //   curve:KEY   the role curve N.KEY at the depth (Roles.at, §8.1)
  //   role:HP     the species role's health at the depth; role:DMG its damage, as "min–max"
  //   mod:NAME    the species' modParams[mod].NAME; a compass side ('W') reads as its word
  //   lock:GLASS[i]  the locks a case of glass i + 1 can have at the depth (Cases.lockSpan,
  //               §8.3: its glass's range, never above the depth + 1), as on the badge:
  //               "Grade II", or "Grade II to Grade IV"
  // Anything missing throws, naming what is missing, so a line never shows a gap.
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const grade = n => 'Grade ' + (ROMAN[n] || String(n));
  function value(ref, sp, depth, mod) {
    const m = /^(N|curve|role|mod|lock):([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(ref);
    const where = `${sp && sp.id ? sp.id : 'a species'}: ${ref}`;
    if (!m) throw new Error(`Clauses: cannot read the parameter reference ${where}`);
    const [, kind, key, index] = m;
    if (kind === 'N' || kind === 'curve') {
      if (!own(N, key)) throw new Error(`Clauses: ${where} names no number of record`);
      if (kind === 'curve') return Roles.at(N[key], depth);
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

  function entry(table, id) {
    if (!own(Registry[table], id)) throw new Error(`Clauses: ${table} has no ${id}`);
    return Registry[table][id];
  }
  function part(kind, id, e, sp, ctx, mod, extra) {
    const values = params(e.params, sp, ctx, mod);
    const text = fill(e.clause, Object.assign({}, values, extra || {}));
    return { id, kind, text, params: values, covers: e.covers.slice(), inv: e.inv, built: e.built, ready: e.ready, within: null };
  }

  // Clauses.of(sp, {depth, rulesOff}): one part per registry id the species uses (§5.3), in
  // the order the line reads: its archetype; the archetype's special and each status it
  // inflicts, whose texts the archetype's clause embeds at {special} and {status:<id>}
  // (their parts say so in `within`); its role's own rule, when the role has one (the
  // clause CLAUSES.role_<role>: the brute's); each modifier not switched off by rulesOff; the wake
  // clause (the pipless one if the archetype says so), unless the trigger stands instead
  // of it; the special trigger. Ids the registry does not know give no part (lint-registry
  // fails on them).
  function of(sp, ctx) {
    const c = { depth: (ctx && ctx.depth) || 1, rulesOff: (ctx && ctx.rulesOff) || [] }, R = Registry, parts = [];
    const arch = own(R.ARCHETYPES, sp.archetype) ? R.ARCHETYPES[sp.archetype] : null;
    if (arch) {
      const inner = [], extra = {};
      if (arch.special) { const p = part('special', arch.special, entry('SPECIALS', arch.special), sp, c, null); p.within = sp.archetype; extra.special = p.text; inner.push(p); }
      for (const id of arch.inflicts || []) { const p = part('status', id, entry('STATUSES', id), sp, c, null); p.within = sp.archetype; extra['status:' + id] = p.text; inner.push(p); }
      parts.push(part('archetype', sp.archetype, arch, sp, c, null, extra), ...inner);
    }
    const role = typeof sp.role === 'string' ? 'role_' + sp.role : null;
    if (role && own(R.CLAUSES, role)) parts.push(part('role', role, R.CLAUSES[role], sp, c, null));
    for (const m of sp.modifiers || []) if (own(R.MODIFIERS, m) && !c.rulesOff.includes(m)) parts.push(part('modifier', m, R.MODIFIERS[m], sp, c, m));
    const trig = own(R.TRIGGERS, sp.trigger) ? R.TRIGGERS[sp.trigger] : null;
    if (!(trig && trig.replacesWake)) { const w = (arch && arch.wake) || 'wake'; parts.push(part('wake', w, entry('CLAUSES', w), sp, c, null)); }
    if (trig) parts.push(part('trigger', sp.trigger, trig, sp, c, null));
    return parts;
  }

  // The Behaviour line: the archetype's and modifiers' sentences, then the wake clause with
  // the special trigger's clause joined to it ("…near it; wakes at once when …").
  function line(sp, ctx) {
    const parts = of(sp, ctx).filter(p => !p.within);
    const wake = parts.find(p => p.kind === 'wake'), trig = parts.find(p => p.kind === 'trigger');
    const out = parts.filter(p => p.kind !== 'wake' && p.kind !== 'trigger').map(p => p.text);
    if (wake && trig) out.push(wake.text.replace(/\.$/, '') + '; ' + trig.text + '.');
    else if (wake || trig) out.push((wake || trig).text);
    return out.join(' ');
  }

  return { UNIVERSAL, COMPASS, of, line, fill, params, value };
})();
