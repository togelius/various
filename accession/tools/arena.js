// ACCESSION — archetype arenas (BUILD.md §10.3): an ASCII stamp in test/arena/<id>.txt,
// parsed into a spec, built into a state through Setup.room, and judged by its goal. A
// classic script like the core's files, loaded beside them into the hardened context
// (tools/core-context.js), so it is integer-only and draws only on its own streams.
//
//   Arena.parse(text) → spec
//   Arena.layout(spec, seed, {depth, sp, variant, kit}) → the room's parts, before Setup.room
//   Arena.build(spec, seed, {depth, sp, options, kit, variant}) → state
//   Arena.goal(spec, state, {variant}) → what the goal asks for, resolved to uids and tiles
//   Arena.won(goal, state) → bool
//   Arena.outcome(spec, state, events, {variant, goal}) → {done, won, died, hpLost, woken, turns, …}
//   Arena.depthFor(spec, seed), Arena.speciesFor(spec, seed), Arena.variant(spec, seed)
//   Arena.start(start, options) → state: a sim replay's start rebuilt on its own (below)
//   Arena.DUMMY: a one-room stamp with one sleeping plodder, for the tools' own tests
//
// THE STAMP. A header of `key: value` lines, each key with a value, a blank line, then the
// map. In the header, a line starting with // is a comment.
//   arena: <id>        required; the archetype it tests, or another name
//   goal: <goal>       required:
//                        kill [<ch>…]   destroy every exhibit drawn with these letters, and
//                                       everything split from them; no letters: every exhibit
//                                       the stamp places
//                        reach <ch>…    stand on a tile drawn with one of these letters
//                        leave          leave by an exit door (the visit ends `left`)
//                        take <ch>      the item drawn with this letter is in your tote or kit
//                        open <ch>      the case drawn with this letter is opened, broken or
//                                       dissolved
//   cap: <turns>       the turn cap (200)
//   species: <id>…     what a bare `sp` in the legend stands for: an archetype id (its pack
//                      species whose archetype M3 builds, in pack order, and shared species
//                      with it) or species ids, in turn by seed (below)
//   depths: <d>…       the depths, in turn by seed (2 5)
//   kit: <slot> [<form>] [key=value…]; …
//                      what you wear and carry; slots weapon and garment change the kit you
//                      start with (form, tier, level); curio0, curio1 and instrument put an
//                      item in that slot; `tote <kind> …` puts one in the tote. key=value sets
//                      any item field (ref, form, tier, level, charges, max, rechargeAt, ck,
//                      seal, n; prims=dmg:M,quiet:S). The line may repeat.
//   clock: none | ltour=<n> | B=<b> G=<g> count=<c>     (none)
//   seen: none | all   whether the whole map is remembered from the start (none)
//   metric: <name> <= <p>% | <name> >= <p>% | died lower
//                      the comparison §10.3 makes, counterplay against naive: a ratio of sums
//                      (hpLost, woken or turns) at most or at least p%, or Newcombe's "death
//                      rate lower"; optional
//   legend: <ch> <what> [args]; …     what the letters of the map are; the line may repeat:
//                        you [on=<tile>]                                 your starting tile
//                        exhibit [sp | sp=<id>] [role=<r>] [arch=<id>] [mode=<m>] [group=<g>]
//                                [size=<n>] [pips=<n>] [trigger=<id>] [mods=<a>,<b>]
//                                [guards=<ch>|<x>,<y>] [home=<ch>|<x>,<y>] [on=<tile>]
//                                                one exhibit on each such tile; a bare sp is the
//                                                species in turn, sp=<id> a fixed one, and with
//                                                neither, role=<r> makes an unnamed exhibit
//                                                with that role's numbers at the depth
//                        case [glass=<1-3>] [lock=<1-7>] [loan] [num=<s>] [ + item … | + exhibit …]
//                                                a case (on a vitrine), and what it holds: an
//                                                item, or an exhibit encased in it (the + has a
//                                                space on each side)
//                        item <kind> [<form>] [key=value…] [on=<tile>]  an item on the floor
//                        mark [on=<tile>]       a tile the goal names
//                      `@` is `you` unless the legend says otherwise.
//   variants: swap <ch> <ch>[, swap …] | …
//                      alternatives to the map as drawn: variant 0 is the map, variant k the
//                      k-th alternative, where `swap A B` exchanges every A and B tile. The
//                      variant is drawn per seed (Arena.variant), so paired runs share it.
// Map rows are all one width; any character in Grid.TILES is that tile (E is the entrance,
// X an exit door), and every other character must be in the legend, where it stands on the
// floor (`on` names another tile; a case stands on a vitrine).
//
// PER SEED. Seed s uses depths[(s − 1) mod D] and species[⌊(s − 1) / D⌋ mod S], so with the
// default depths every species meets both depths (the plan's D6.2: depth 2 for odd seeds,
// 5 for even ones). Exhibits are numbered <acc>.<depth>.room.<n> in row-major order, items
// <acc>.<depth>.room.i<n> (the kit's first, then the map's, row-major), and a case's
// accession number is <pack number>.1.<k>; acc is the pack of the species in turn, else of
// the first fixed species, else T0.
'use strict';
const Arena = (() => {
  const KEYS = ['arena', 'goal', 'cap', 'species', 'depths', 'kit', 'clock', 'seen', 'metric', 'legend', 'variants'];
  const REPEAT = ['kit', 'legend'];
  const GOALS = ['kill', 'reach', 'leave', 'take', 'open'];
  const WHATS = ['you', 'exhibit', 'case', 'item', 'mark'];
  const KINDS = ['weapon', 'garment', 'curio', 'instrument', 'kit', 'consumable'];
  const ITEM_FIELDS = ['ref', 'form', 'tier', 'level', 'charges', 'max', 'rechargeAt', 'ck', 'seal', 'n', 'prims'];
  const EXHIBIT_KEYS = ['sp', 'role', 'arch', 'mode', 'group', 'size', 'pips', 'trigger', 'mods', 'guards', 'home', 'on'];
  const SLOTS = ['weapon', 'garment', 'curio0', 'curio1', 'instrument', 'tote'];
  const METRICS = ['hpLost', 'woken', 'turns'];
  const MODES = ['dormant', 'awake', 'hunting', 'searching', 'returning', 'reinstalling'];
  const DEFAULT_DEPTHS = [2, 5], DEFAULT_CAP = 200;

  const fail = (line, msg) => { throw new Error(`Arena.parse: ${line ? 'line ' + line + ': ' : ''}${msg}`); };
  const isTile = ch => Object.prototype.hasOwnProperty.call(Grid.TILES, ch);
  const num = s => /^-?\d+$/.test(s) ? Number(s) : null;
  // A value as written: a whole number, true/false/null, or the text itself.
  function value(s) {
    const n = num(s);
    if (n !== null) return n;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    return s;
  }
  // Words to {words: [bare…], args: [[key, value]…]} in the order written; key= with no
  // value is refused.
  function words(text, line) {
    const out = { words: [], args: [] };
    for (const w of text.split(/\s+/).filter(Boolean)) {
      const i = w.indexOf('=');
      if (i > 0 && i === w.length - 1) fail(line, `${w.slice(0, i)} has no value after its =`);
      if (i > 0) out.args.push([w.slice(0, i), w.slice(i + 1)]);
      else out.words.push(w);
    }
    return out;
  }
  const arg = (args, k) => { for (const [key, v] of args) if (key === k) return v; return undefined; };

  // prims=dmg:M,quiet:S → [{id: 'dmg', cls: 'M'}, …]
  function prims(s, line) {
    return s.split(',').filter(Boolean).map(p => {
      const [id, cls] = p.split(':');
      if (!id || !['S', 'M', 'L'].includes(cls)) fail(line, `prims are written id:S, id:M or id:L, not ${p}`);
      return { id, cls };
    });
  }
  // The item fields of key=value args (kind and form already taken).
  function itemFields(args, line, allowOn) {
    const out = {};
    for (const [k, v] of args) {
      if (allowOn && k === 'on') continue;
      if (!ITEM_FIELDS.includes(k)) fail(line, `an item has no field ${k} (it takes ${ITEM_FIELDS.join(', ')})`);
      out[k] = k === 'prims' ? prims(v, line) : value(v);
    }
    return out;
  }

  // One kit entry: `<slot> [<form>] [key=value…]`, or `tote <kind> [<form>] [key=value…]`.
  function kitEntry(text, line) {
    const w = words(text, line);
    const slot = w.words[0];
    if (slot === undefined) fail(line, `a kit entry starts with its slot (${SLOTS.join(', ')}): ${text}`);
    if (!SLOTS.includes(slot)) fail(line, `a kit entry starts with a slot (${SLOTS.join(', ')}), not ${slot}`);
    let rest = w.words.slice(1), kind = slot === 'curio0' || slot === 'curio1' ? 'curio' : slot;
    if (slot === 'tote') {
      kind = rest[0]; rest = rest.slice(1);
      if (kind === undefined) fail(line, `a tote entry names the kind of item it puts in the tote (${KINDS.join(', ')})`);
      if (!KINDS.includes(kind)) fail(line, `a tote entry names its kind (${KINDS.join(', ')}), not ${kind}`);
    }
    if (rest.length > 1) fail(line, `a kit entry has one form at most, not ${rest.join(' ')}`);
    const fields = itemFields(w.args, line, false);
    if (rest.length) { if (fields.form !== undefined) fail(line, 'the form is given twice'); fields.form = rest[0]; }
    if ((slot === 'weapon' || slot === 'garment')) for (const k of Object.keys(fields)) if (!['form', 'tier', 'level'].includes(k)) fail(line, `the ${slot} you start with takes form, tier and level, not ${k}`);
    return { slot, kind, fields };
  }

  // One part of a legend entry: `you …`, `exhibit …`, `case …`, `item …` or `mark …`.
  function part(text, line) {
    const w = words(text, line), what = w.words[0];
    if (what === undefined) fail(line, `a legend entry says first what its letter is (${WHATS.join(', ')}): ${text}`);
    if (!WHATS.includes(what)) fail(line, `a legend entry is ${WHATS.join(', ')}, not ${what}`);
    const rest = w.words.slice(1), on = arg(w.args, 'on');
    if (on !== undefined && (on.length !== 1 || !isTile(on))) fail(line, `on= names one tile character, not ${on}`);
    if (what === 'you' || what === 'mark') {
      if (rest.length || w.args.some(([k]) => k !== 'on')) fail(line, `${what} takes only on=<tile>`);
      return { what, on: on || null };
    }
    if (what === 'exhibit') {
      const p = { what, on: on || null, sp: null, rotate: false };
      for (const word of rest) { if (word === 'sp') p.rotate = true; else fail(line, `an exhibit's bare word may only be sp, not ${word}`); }
      for (const [k, v] of w.args) {
        if (!EXHIBIT_KEYS.includes(k)) fail(line, `an exhibit takes ${EXHIBIT_KEYS.join(', ')}, not ${k}`);
        if (k === 'on') continue;
        if (k === 'sp') { if (p.rotate) fail(line, 'an exhibit is the species in turn (sp) or a fixed one (sp=<id>), not both'); p.sp = v; }
        else if (k === 'mods') p.mods = v.split(',').filter(Boolean);
        else if (k === 'mode') { if (!MODES.includes(v)) fail(line, `mode is one of ${MODES.join(', ')}, not ${v}`); p.mode = v; }
        else if (k === 'role') { if (!Roles.ROLES.includes(v)) fail(line, `role is one of ${Roles.ROLES.join(', ')}, not ${v}`); p.role = v; }
        else if (k === 'guards' || k === 'home') p[k] = v;
        else p[k] = value(v);
      }
      if (!p.rotate && p.sp === null && !p.role) fail(line, 'an exhibit needs sp (the species in turn), sp=<id> or role=<role>');
      for (const k of ['size', 'pips']) if (p[k] !== undefined && !(Number.isInteger(p[k]) && p[k] >= 0)) fail(line, `${k} is a whole number`);
      return p;
    }
    if (what === 'case') {
      const p = { what, on: on || null, glass: 1, lock: 1, loan: false, num: null };
      for (const word of rest) { if (word === 'loan') p.loan = true; else fail(line, `a case's bare word may only be loan, not ${word}`); }
      for (const [k, v] of w.args) {
        if (k === 'on') continue;
        if (k === 'glass') { p.glass = num(v); if (!(p.glass >= 1 && p.glass <= 3)) fail(line, `glass is 1, 2 or 3, not ${v}`); }
        else if (k === 'lock') { p.lock = num(v); if (!(p.lock >= 1 && p.lock <= 7)) fail(line, `lock is a grade from 1 to 7, not ${v}`); }
        else if (k === 'num') p.num = v;
        else fail(line, `a case takes glass, lock, loan and num, not ${k}`);
      }
      return p;
    }
    // item
    const kind = rest[0];
    if (kind === undefined) fail(line, `an item names its kind after the word item (${KINDS.join(', ')})`);
    if (!KINDS.includes(kind)) fail(line, `an item names its kind (${KINDS.join(', ')}), not ${kind}`);
    if (rest.length > 2) fail(line, `an item has one form at most, not ${rest.slice(1).join(' ')}`);
    const fields = itemFields(w.args, line, true);
    if (rest[1] !== undefined) { if (fields.form !== undefined) fail(line, 'the form is given twice'); fields.form = rest[1]; }
    return { what, on: on || null, kind, fields };
  }

  // One legend entry: `<ch> <part> [ + <part>]`; only a case may hold something, an item or
  // an exhibit (encased: it stands on the case's vitrine).
  function legendEntry(text, line) {
    const t = text.trim(), ch = t.charAt(0);
    if (!ch || t.length < 2 || !/\s/.test(t.charAt(1))) fail(line, `a legend entry is a character, a space, then what it is: ${text}`);
    if (isTile(ch)) fail(line, `${ch} is already a tile (${Grid.TILES[ch].name}), so it cannot be a legend letter`);
    if (ch === ' ' || ch === '/' || ch === ';') fail(line, `${ch} cannot be a legend letter`);
    const parts = t.slice(1).split(/\s\+\s/).map(s => part(s.trim(), line));
    if (parts.length > 2 || (parts.length === 2 && !(parts[0].what === 'case' && (parts[1].what === 'item' || parts[1].what === 'exhibit')))) fail(line, 'only a case may hold something: case … + item … or case … + exhibit …');
    if (parts.length === 2 && parts[1].on) fail(line, 'what a case holds stands on its vitrine, so it takes no on=');
    return { ch, parts };
  }

  function parseGoal(text, line) {
    const w = text.split(/\s+/).filter(Boolean), k = w[0], chars = w.slice(1);
    if (!GOALS.includes(k)) fail(line, `the goal is one of ${GOALS.join(', ')}, not ${k}`);
    if (k === 'leave' && chars.length) fail(line, 'leave takes no letters');
    if ((k === 'reach' || k === 'take' || k === 'open') && !chars.length) fail(line, `${k} names the letters it means`);
    if ((k === 'take' || k === 'open') && chars.length !== 1) fail(line, `${k} names one letter`);
    for (const c of chars) if (c.length !== 1) fail(line, `goal letters are single characters, not ${c}`);
    return { k, chars };
  }

  function parseClock(text, line) {
    const t = text.trim();
    if (t === 'none') return null;
    const w = words(t, line);
    if (w.words.length) fail(line, `the clock is none, ltour=<n>, or B=<b> G=<g> count=<c>, not ${t}`);
    const out = {};
    for (const [k, v] of w.args) {
      if (!['ltour', 'B', 'G', 'count'].includes(k)) fail(line, `the clock takes ltour, B, G and count, not ${k}`);
      if (num(v) === null || num(v) < 0) fail(line, `${k} is a whole number`);
      out[k] = num(v);
    }
    return out;
  }

  function parseMetric(text, line) {
    const t = text.trim().split(/\s+/);
    if (t.length === 2 && t[0] === 'died' && t[1] === 'lower') return { name: 'died', test: 'lower', at: null, pct: null };
    const m = t.length === 3 && /^(\d+)%$/.exec(t[2]);
    if (!m || !METRICS.includes(t[0]) || !['<=', '>='].includes(t[1])) fail(line, `the metric is <name> <= <p>%, <name> >= <p>% (names: ${METRICS.join(', ')}) or died lower, not ${text.trim()}`);
    return { name: t[0], test: 'ratio', at: t[1] === '<=' ? 'most' : 'least', pct: Number(m[1]) };
  }

  function parseVariants(text, line) {
    const t = text.trim();
    if (t === 'none') return [];
    return t.split('|').map(alt => alt.split(',').map(op => {
      if (!op.trim()) fail(line, 'a variant is swap <ch> <ch>, and one here is empty');
      const w = op.trim().split(/\s+/);
      if (w.length !== 3 || w[0] !== 'swap' || w[1].length !== 1 || w[2].length !== 1 || w[1] === w[2]) fail(line, `a variant is swap <ch> <ch>, not ${op.trim()}`);
      return ['swap', w[1], w[2]];
    }));
  }

  // The stamp as plain data (a sim run's replay keeps it whole in its start; see start).
  function parse(text) {
    if (typeof text !== 'string') fail(0, 'needs the stamp as text');
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const head = {};
    let i = 0;
    for (; i < lines.length; i++) {
      const raw = lines[i], t = raw.trim();
      if (t === '') { if (Object.keys(head).length) break; continue; }
      if (t.startsWith('//')) continue;
      const m = /^([a-z]+):\s*(.*)$/.exec(t);
      if (!m) fail(i + 1, `a header line is key: value, not ${t} (is the blank line before the map missing?)`);
      if (!KEYS.includes(m[1])) fail(i + 1, `the header has no key ${m[1]} (it takes ${KEYS.join(', ')})`);
      if (Object.prototype.hasOwnProperty.call(head, m[1]) && !REPEAT.includes(m[1])) fail(i + 1, `${m[1]} is given twice`);
      if (m[2].trim() === '') fail(i + 1, `the header's ${m[1]} has no value`);
      if (!head[m[1]]) head[m[1]] = [];
      head[m[1]].push({ text: m[2], line: i + 1 });
    }
    const one = k => head[k] ? head[k][0] : null;
    if (!one('arena') || !/^[a-z0-9_]+$/.test(one('arena').text.trim())) fail(0, 'the header needs arena: <id> (lower-case letters, digits and _)');
    if (!one('goal')) fail(0, 'the header needs goal: …');
    const spec = {
      arena: one('arena').text.trim(),
      goal: parseGoal(one('goal').text, one('goal').line),
      cap: DEFAULT_CAP, species: [], depths: DEFAULT_DEPTHS.slice(), kit: [], clock: null, seen: 'none', metric: null,
      legend: [{ ch: '@', parts: [{ what: 'you', on: null }] }], variants: [], map: [],
    };
    if (one('cap')) { spec.cap = num(one('cap').text.trim()); if (!(spec.cap >= 1)) fail(one('cap').line, 'the cap is a positive whole number of turns'); }
    if (one('species')) spec.species = one('species').text.split(/\s+/).filter(Boolean);
    if (one('depths')) {
      spec.depths = one('depths').text.split(/\s+/).filter(Boolean).map(num);
      if (!spec.depths.length || spec.depths.some(d => !(d >= 1 && d <= 7))) fail(one('depths').line, 'depths are whole numbers from 1 to 7');
    }
    for (const k of head.kit || []) for (const e of k.text.split(';')) if (e.trim()) spec.kit.push(kitEntry(e.trim(), k.line));
    const slotsUsed = spec.kit.filter(e => e.slot !== 'tote').map(e => e.slot);
    for (const s of slotsUsed) if (slotsUsed.indexOf(s) !== slotsUsed.lastIndexOf(s)) fail(head.kit[0].line, `the kit slot ${s} is given twice`);
    if (one('clock')) spec.clock = parseClock(one('clock').text, one('clock').line);
    if (one('seen')) { spec.seen = one('seen').text.trim(); if (!['none', 'all'].includes(spec.seen)) fail(one('seen').line, `seen is none or all, not ${spec.seen}`); }
    if (one('metric')) spec.metric = parseMetric(one('metric').text, one('metric').line);
    for (const l of head.legend || []) for (const e of l.text.split(';')) {
      if (!e.trim()) continue;
      const entry = legendEntry(e, l.line), at = spec.legend.findIndex(x => x.ch === entry.ch);
      if (at > 0) fail(l.line, `the legend gives ${entry.ch} twice`);
      if (at === 0) spec.legend[0] = entry; else spec.legend.push(entry);
    }
    if (one('variants')) spec.variants = parseVariants(one('variants').text, one('variants').line);
    // The map: every line after the blank line, up to the last non-blank one.
    const rows = lines.slice(i + 1);
    while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
    while (rows.length && rows[0].trim() === '') { rows.shift(); i++; }
    if (!rows.length) fail(0, 'the stamp has no map after its header');
    const w = rows[0].length;
    const legendOf = ch => spec.legend.find(e => e.ch === ch) || null;
    let yous = 0;
    rows.forEach((r, y) => {
      if (r.length !== w) fail(i + 2 + y, `every map row is ${w} characters wide; this one is ${r.length}`);
      for (const ch of r) {
        if (isTile(ch)) continue;
        const e = legendOf(ch);
        if (!e) fail(i + 2 + y, `${JSON.stringify(ch)} is neither a tile nor in the legend`);
        if (e.parts[0].what === 'you') yous++;
      }
    });
    if (yous !== 1) fail(0, `the map must show you exactly once, not ${yous} times`);
    for (const e of spec.legend) if (!rows.some(r => r.includes(e.ch)) && e.ch !== '@') fail(0, `the legend's ${e.ch} is not on the map`);
    for (const c of spec.goal.chars) if (!legendOf(c)) fail(one('goal').line, `the goal's ${c} is not in the legend`);
    for (const alt of spec.variants) for (const [, a, b] of alt) for (const c of [a, b]) if (!legendOf(c)) fail(one('variants').line, `the variant's ${c} is not in the legend`);
    for (const e of spec.legend) for (const p of e.parts) for (const k of ['guards', 'home']) {
      const v = p[k];
      if (v === undefined || /^\d+,\d+$/.test(v)) continue;
      if (v.length !== 1 || !legendOf(v)) fail(0, `${e.ch}'s ${k} is a legend letter or x,y, not ${v}`);
    }
    if (spec.goal.k === 'take' && !legendOf(spec.goal.chars[0]).parts.some(p => p.what === 'item')) fail(one('goal').line, `take ${spec.goal.chars[0]}: that letter holds no item`);
    if (spec.goal.k === 'open' && legendOf(spec.goal.chars[0]).parts[0].what !== 'case') fail(one('goal').line, `open ${spec.goal.chars[0]}: that letter is not a case`);
    if (spec.goal.k === 'kill') for (const c of spec.goal.chars) if (!legendOf(c).parts.some(p => p.what === 'exhibit')) fail(one('goal').line, `kill ${c}: that letter is not an exhibit`);
    spec.map = rows;
    return spec;
  }

  const legendOf = (spec, ch) => spec.legend.find(e => e.ch === ch) || null;
  const mod = (a, n) => ((a % n) + n) % n;

  // The species a bare `sp` stands for, as records, in order.
  function speciesList(spec) {
    const out = [];
    for (const id of spec.species) {
      const A = Object.prototype.hasOwnProperty.call(Registry.ARCHETYPES, id) ? Registry.ARCHETYPES[id] : null;
      if (A) {
        if (A.built !== 'M3') throw new Error(`Arena: the archetype ${id} is not built in M3`);
        const found = [];
        for (const p of Packs.list()) for (const sp of p.species) if (sp.archetype === id) found.push(sp);
        for (const sp of Packs.sharedList()) if (sp.archetype === id) found.push(sp);
        if (!found.length) throw new Error(`Arena: no pack or shared species has the archetype ${id}`);
        for (const sp of found) out.push(sp);
      } else {
        const sp = Packs.speciesFor(null, { sp: id });
        if (!sp) throw new Error(`Arena: ${id} is neither an archetype nor a species`);
        out.push(sp);
      }
    }
    return out;
  }
  const depthFor = (spec, seed) => spec.depths[mod(seed - 1, spec.depths.length)];
  function speciesFor(spec, seed) {
    const list = speciesList(spec);
    return list.length ? list[mod(Int.idiv(seed - 1, spec.depths.length), list.length)] : null;
  }
  // The variant for a seed: drawn on the arena's own stream, arena/<id>/variant, on a holder
  // of its own (never the state), so paired runs on one seed share it. 0 is the map as drawn.
  const variant = (spec, seed) => spec.variants.length ? Rng.stream({ seed, rng: {} }, `arena/${spec.arena}/variant`).int(0, spec.variants.length) : 0;

  // The map's legend cells after a variant: [{ch, x, y}] in row-major order.
  function cells(spec, v) {
    const map = spec.map.map(r => r.split(''));
    if (v) {
      const alt = spec.variants[v - 1];
      if (!alt) throw new Error(`Arena: ${spec.arena} has no variant ${v}`);
      for (const [, a, b] of alt) for (const row of map) for (let x = 0; x < row.length; x++) { if (row[x] === a) row[x] = b; else if (row[x] === b) row[x] = a; }
    }
    const out = [];
    map.forEach((row, y) => row.forEach((ch, x) => { if (!isTile(ch)) out.push({ ch, x, y }); }));
    return out;
  }
  const accNumber = acc => { const p = Packs.get(acc); return p && p.number ? p.number : acc.replace(/^([A-Z]+)(\d+)$/, '$1.$2'); };
  function packOf(sp) { for (const p of Packs.list()) if (p.species.includes(sp) || p.centrepiece === sp) return p.acc; return null; }
  function accFor(spec, sp) {
    if (sp && packOf(sp)) return packOf(sp);
    for (const e of spec.legend) for (const p of e.parts) if (p.what === 'exhibit' && p.sp) { const s = Packs.speciesFor(null, { sp: p.sp }); if (s && packOf(s)) return packOf(s); }
    return 'T0';
  }

  // The room's parts for a seed, before Setup.room: {acc, depth, sp, variant, room (Setup.room's
  // spec), exhibits: [{ch, uid}], items: [{ch, uid}], cases: [{ch, x, y}], marks: [{ch, x, y}]}.
  // opts: depth, sp (a species record or id), variant, kit (overrides for the weapon and
  // garment you start with: {weapon: {form, tier, level}, garment: {…}}).
  function layout(spec, seed, opts) {
    opts = opts || {};
    const depth = opts.depth !== undefined && opts.depth !== null ? opts.depth : depthFor(spec, seed);
    let sp = opts.sp !== undefined && opts.sp !== null ? opts.sp : speciesFor(spec, seed);
    if (typeof sp === 'string') { const s = Packs.speciesFor(null, { sp }); if (!s) throw new Error(`Arena: no species ${sp}`); sp = s; }
    const v = opts.variant !== undefined && opts.variant !== null ? opts.variant : variant(spec, seed);
    const acc = accFor(spec, sp);
    const rows = spec.map.map(r => r.split(''));
    const all = cells(spec, v);
    const first = ch => all.find(c => c.ch === ch) || null;
    const tileOf = ref => { if (/^\d+,\d+$/.test(ref)) return ref.split(',').map(Number); const c = first(ref); return [c.x, c.y]; };
    const room = { acc, depth, map: null, you: null, exhibits: [], fixtures: [], items: [], kit: {}, clock: spec.clock ? Object.assign({}, spec.clock) : undefined, entrance: undefined, exits: [] };
    const out = { acc, depth, sp: sp ? sp.id : null, variant: v, room, exhibits: [], items: [], cases: [], marks: [] };
    let items = 0, cases = 0;
    const itemUid = () => `${acc}.${depth}.room.i${++items}`;
    // The kit: the weapon and garment you start with, then the slots and the tote.
    const kit = {};
    for (const e of spec.kit) if (e.slot === 'weapon' || e.slot === 'garment') kit[e.slot] = Object.assign({}, e.fields);
    for (const s of ['weapon', 'garment']) if (opts.kit && opts.kit[s]) kit[s] = Object.assign({}, kit[s] || {}, opts.kit[s]);
    if (kit.weapon) room.kit.weapon = kit.weapon;
    if (kit.garment) room.kit.garment = kit.garment;
    for (const e of spec.kit) {
      if (e.slot === 'weapon' || e.slot === 'garment') continue;
      const where = e.slot === 'tote' ? { at: 'tote' } : { at: 'kit', slot: e.slot };
      room.items.push(Object.assign({ uid: itemUid(), kind: e.kind, where }, JSON.parse(JSON.stringify(e.fields))));
    }
    // The map, row-major: on each cell its legend part, then what a case holds.
    const exhibit = (p, c) => {
      const s = p.rotate ? sp : p.sp ? Packs.speciesFor(null, { sp: p.sp }) : null;
      if (p.rotate && !s) throw new Error(`Arena: ${spec.arena}'s ${c.ch} is the species in turn, and the header names no species`);
      if (p.sp && !s) throw new Error(`Arena: ${spec.arena}'s ${c.ch} names the species ${p.sp}, which no pack has`);
      const role = p.role || (s ? s.role : null);
      if (!role) throw new Error(`Arena: ${spec.arena}'s ${c.ch} has no role`);
      const rec = { sp: s ? s.id : 'training_dummy', at: [c.x, c.y], stats: Roles.stats(role, depth) };
      if (p.role && s) rec.role = p.role;
      const size = p.size !== undefined ? p.size : s && s.size ? s.size : undefined;
      if (size !== undefined) rec.size = size;
      for (const k of ['arch', 'mode', 'group', 'pips', 'trigger', 'mods']) if (p[k] !== undefined) rec[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
      if (p.guards !== undefined) rec.guards = tileOf(p.guards);
      if (p.home !== undefined) rec.home = tileOf(p.home);
      room.exhibits.push(rec);
      out.exhibits.push({ ch: c.ch, uid: `${acc}.${depth}.room.${room.exhibits.length}`, mode: p.mode || null });
    };
    const item = (p, c, where) => {
      const uid = itemUid();
      room.items.push(Object.assign({ uid, kind: p.kind, where }, JSON.parse(JSON.stringify(p.fields))));
      out.items.push({ ch: c.ch, uid });
      return uid;
    };
    for (const c of all) {
      const e = legendOf(spec, c.ch), p0 = e.parts[0], held = e.parts[1] || null;
      if (p0.what === 'you') room.you = [c.x, c.y];
      else if (p0.what === 'mark') out.marks.push({ ch: c.ch, x: c.x, y: c.y });
      else if (p0.what === 'exhibit') exhibit(p0, c);
      else if (p0.what === 'item') item(p0, c, { at: 'floor', x: c.x, y: c.y });
      else if (p0.what === 'case') {
        cases++;
        const f = Cases.make({ x: c.x, y: c.y, room: null, num: p0.num !== null ? p0.num : `${accNumber(acc)}.1.${cases}`, glass: p0.glass, lock: p0.lock, loan: p0.loan });
        out.cases.push({ ch: c.ch, x: c.x, y: c.y });
        if (held && held.what === 'item') f.holds = item(held, c, { at: 'case', x: c.x, y: c.y });
        if (held && held.what === 'exhibit') exhibit(held, c);
        room.fixtures.push(f);
      }
      rows[c.y][c.x] = p0.on || (p0.what === 'case' ? 'v' : '.');
    }
    room.map = rows.map(r => r.join(''));
    room.map.forEach((r, y) => { for (let x = 0; x < r.length; x++) { if (r[x] === 'E' && !room.entrance) room.entrance = [x, y]; if (r[x] === 'X') room.exits.push([x, y]); } });
    if (room.clock === undefined) delete room.clock;
    if (room.entrance === undefined) delete room.entrance;
    return out;
  }

  // The state for a seed: Setup.room with the layout, under options (rulesOff, without,
  // invulnerable); with seen: all, every tile is remembered from the start.
  function build(spec, seed, opts) {
    opts = opts || {};
    const L = layout(spec, seed, opts);
    const state = Setup.room(seed, L.room, opts.options || {});
    if (spec.seen === 'all') state.dept.seen = '1'.repeat(state.dept.w * state.dept.h);
    return state;
  }

  // A sim run's start, rebuilt on its own: {arena, seed, depth, sp, variant, kit, spec}, where
  // spec is the parsed stamp (plain data), so a replay keeps its room when the stamp's file
  // changes later. tools/sim.js records it (and the hash of this file, which coreHash does not
  // cover); with tools/replay.js loaded, it is Replay.starter('arena', Arena.start).
  function start(st, options) {
    if (!st || typeof st !== 'object' || !st.spec || !Array.isArray(st.spec.map)) throw new Error('Arena.start: the start holds no parsed stamp (spec), so its room cannot be rebuilt');
    if (!Number.isSafeInteger(st.seed)) throw new Error(`Arena.start: the start of ${st.spec.arena} has no whole-number seed`);
    return build(st.spec, st.seed, { depth: st.depth, sp: st.sp, variant: st.variant, kit: st.kit, options: options || {} });
  }

  // What the goal asks for in this state, resolved for the state's variant (drawn from its
  // seed unless opts.variant says): {k, uids (kill: the exhibits to destroy), tiles (reach),
  // items (take), cases (open), arena: every exhibit the stamp placed, with its legend mode}.
  function goal(spec, state, opts) {
    opts = opts || {};
    const v = opts.variant !== undefined && opts.variant !== null ? opts.variant : variant(spec, state.seed);
    const acc = state.dept.acc, depth = state.dept.depth, all = cells(spec, v);
    const g = { k: spec.goal.k, uids: [], tiles: [], items: [], cases: [], arena: [], variant: v };
    let n = 0, items = 0;
    for (const e of spec.kit) if (e.slot !== 'weapon' && e.slot !== 'garment') items++;
    const chosen = ch => spec.goal.chars.includes(ch);
    for (const c of all) {
      const e = legendOf(spec, c.ch);
      for (const p of e.parts) {
        if (p.what === 'exhibit') {
          const uid = `${acc}.${depth}.room.${++n}`;
          g.arena.push({ uid, mode: p.mode || null });
          if (g.k === 'kill' && (!spec.goal.chars.length || chosen(c.ch))) g.uids.push(uid);
        } else if (p.what === 'item') { items++; if (g.k === 'take' && chosen(c.ch)) g.items.push(`${acc}.${depth}.room.i${items}`); }
        else if (p.what === 'case' && g.k === 'open' && chosen(c.ch)) g.cases.push([c.x, c.y]);
      }
      if (g.k === 'reach' && chosen(c.ch)) g.tiles.push([c.x, c.y]);
    }
    return g;
  }

  // Is the goal met in this state?
  function won(g, state) {
    const you = state.actors[0];
    if (g.k === 'kill') {
      const alive = state.actors.some(a => !a.gone && g.uids.some(u => a.uid === u || a.uid.startsWith(u + '/')));
      return !alive;
    }
    if (g.k === 'reach') return g.tiles.some(([x, y]) => you.x === x && you.y === y);
    if (g.k === 'leave') return !!state.over && state.over.k === 'left';
    if (g.k === 'take') return g.items.every(uid => { const it = state.items.find(i => i.uid === uid); return !!it && (it.where.at === 'tote' || it.where.at === 'kit'); });
    if (g.k === 'open') return g.cases.every(([x, y]) => { const f = Cases.at(state, x, y); return !!f && ['open', 'broken', 'dissolved'].includes(f.st); });
    return false;
  }

  // Your health over a run, from its events in order (from the start, when you are at your
  // maximum): HP lost is what each blow, shot or special you took removed, summed, at most
  // your maximum HP, and your maximum HP if you die (§10.3). deaths counts your death, or in
  // an invulnerable run the blows that would have killed you (their cause says saved).
  function health(state, events) {
    const you = state.actors[0];
    let cur = you.maxHp, lost = 0, saved = 0;
    for (const e of events) {
      if (e.who !== 'you') continue;
      if (e.k === 'damaged') { if (cur > e.hp) lost += cur - e.hp; cur = e.hp; if (e.cause && e.cause.saved) saved++; }
      else if ((e.k === 'regenerated' || e.k === 'healed') && typeof e.hp === 'number') cur = e.hp;
    }
    const died = !!state.over && state.over.k === 'died';
    return { died, hpLost: died ? you.maxHp : Math.min(you.maxHp, lost), maxHp: you.maxHp, deaths: died ? 1 : saved };
  }

  // Exhibits woken from sleep during the run (a `woke` event from dormant), each once.
  function woken(events) {
    const seen = [];
    for (const e of events) if (e.k === 'woke' && e.was === 'dormant' && !seen.includes(e.who)) seen.push(e.who);
    return seen.length;
  }
  // The stamp's exhibits that started asleep: not given a waking mode, not of a species that
  // never sleeps (a trigger that stands for the wake clause, `awake`), and not removed.
  function sleepers(g, state) {
    const without = (state.options && state.options.without) || [];
    let n = 0;
    for (const { uid, mode } of g.arena) {
      const a = Actors.byUid(state, uid);
      if (!a || without.includes(uid) || (mode && mode !== 'dormant')) continue;
      const T = a.trigger && Object.prototype.hasOwnProperty.call(Registry.TRIGGERS, a.trigger) ? Registry.TRIGGERS[a.trigger] : null;
      if (!(T && T.replacesWake)) n++;
    }
    return n;
  }

  // The outcome so far, from the state and every event of the run in order: done (the goal
  // is met, or the visit is over), won, died, left, hpLost, maxHp, deaths, woken, sleepers,
  // turns. opts: variant (as built), goal (Arena.goal's, to skip resolving it again).
  function outcome(spec, state, events, opts) {
    opts = opts || {};
    const g = opts.goal || goal(spec, state, opts), h = health(state, events || []);
    const w = won(g, state), left = !!state.over && state.over.k === 'left';
    return { done: w || !!state.over, won: w, died: h.died, left, hpLost: h.hpLost, maxHp: h.maxHp, deaths: h.deaths,
      woken: woken(events || []), sleepers: sleepers(g, state), turns: state.turn };
  }

  // A small stamp for the tools' own tests and `node tools/sim.js --arena dummy`.
  const DUMMY = [
    '// One room and one sleeping plodder: the tools\' own test arena, not one of §10.3\'s.',
    'arena: dummy',
    'goal: kill',
    'cap: 200',
    'species: plodder',
    'depths: 2 5',
    'seen: all',
    'metric: hpLost <= 90%',
    'legend: P exhibit sp',
    '',
    '##########',
    '#........#',
    '#.@....P.#',
    '#........#',
    '##########',
  ].join('\n') + '\n';

  return { parse, layout, build, start, goal, won, outcome, health, woken, depthFor, speciesFor, speciesList, variant, cells, DUMMY, KEYS };
})();
