// ACCESSION — what a label says about a thing on the board (BUILD.md §8.8): the title,
// state, tombstone, pictograms, Behaviour line, odds readout, paragraph and action buttons,
// built from the pack, the registry and the rules' own numbers. Owned by W2a-LABELS.
//
// Every label has one shape, the panel's (§8.8), so the interface and the policies read them
// alike: {uid, kind, title, stateIcons, tomb, number, pictos: [{icon, text}], behaviour,
// odds: [sentences], paragraph, far, closeup, actions: [{id, text, act?, aim?}]}. An action
// with `act` is a step() action that step() takes now: a label offers it only when the
// action's own legal list has it and nothing forbids it (allowed(), as Step.legal checks),
// so no button a label shows is refused. An action with `aim` instead needs a target, a
// tile or an item, chosen in the Bag (W2b-UI-BAG). The labels:
//   Labels.of(state, uid)            an exhibit's (or, given a selection id such as
//                                    'case:x,y', that thing's); null for one shown as
//                                    something else (a mimic in its disguise is a case)
//   Labels.ofCase(state, f)          a case fixture's: its glass, lock and contents, and its
//                                    accession number, which a mimic's case lacks (§8.3)
//   Labels.ofStaffDoor(state, f), Labels.ofPlaque(state, f), Labels.ofItem(state, uid),
//   Labels.you(state)
//   Labels.strip(state)              the nearest readable thing within READ_RANGE (§8.8)
//   Labels.odds(state, a)            the odds readout (§8.1)
//   Labels.nameOf(state)             names for Text.event
//   Labels.allowed(state, act)       would step() take act now (the test every button passes)
// None of them changes the state or draws on a stream: a label is read, never acted on.
'use strict';
const Labels = (() => {
  const own = (o, k) => typeof k === 'string' && o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  // The species an actor was made from: its department's, its Centrepiece, or a shared one
  // (the Night Watchman); null for you and the test room's dummies.
  const speciesOf = (state, a) => Packs.speciesFor(state, a);

  // Words. Grades as on the badge (§8.7): Grade I … Grade VII.
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const grade = n => 'Grade ' + (Number.isInteger(n) && n >= 1 && n < ROMAN.length ? ROMAN[n] : String(n));
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const hits = n => count(n, 'hit', 'hits');
  const turns = n => count(n, 'turn', 'turns');
  const range = r => r.min === r.max ? String(r.min) : r.min + '–' + r.max;
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  const num = n => (n < 0 ? '−' : '') + Math.abs(n);
  const yourGrade = state => (state.run && state.run.grade) || N.GRADE_START;
  // Reading distance (§8.8). An exhibit (from its nearest tile, Actors.dist, as since M2), a
  // case and an item are read within READ_RANGE tiles counted as a king moves, a diagonal
  // step counting one, so in the square of side 2 × READ_RANGE + 1 round you. A plaque is
  // read with read(x, y), whose reach §8.6 sets as the disc of "within r" (§8.2); its label
  // follows that action (readable, below), so its Read button is offered exactly when step()
  // takes it.
  const steps = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y));
  const inReach = (you, x, y) => steps(you, x, y) <= N.READ_RANGE;

  // ---- What a label may offer ----

  // Two actions are the same when they have the same fields with the same values.
  function same(p, q) {
    const kp = Object.keys(p), kq = Object.keys(q);
    return kp.length === kq.length && kp.every(k => own(q, k) && p[k] === q[k]);
  }
  // Would step() take act now? Exactly when Step.legal would list it: the visit is not over,
  // no choice waits (unless act answers it), its handler's legal list has it, and no status
  // of yours forbids it (Status.blocks).
  function allowed(state, act) {
    if (state.over || (state.ui && state.ui.pendingChoice && act.a !== 'choose')) return false;
    const h = Actions.get(act.a);
    if (!h || Status.blocks(state, state.actors[0], act)) return false;
    return h.legal(state).some(l => same(l, act));
  }
  const offer = (state, id, text, act) => allowed(state, act) ? [{ id, text, act }] : [];

  // The pictograms of the statuses on an actor, each keyed by its registry icon (§8.8), with
  // the turns it still covers (Status.left).
  function statusPictos(state, a) {
    const out = [];
    for (const s of a.statuses || []) {
      const S = own(Registry.STATUSES, s.id) ? Registry.STATUSES[s.id] : null;
      if (!S) continue;
      out.push({ icon: S.icon, text: `${S.words}, ${turns(Status.left(state, a, s.id))}` });
    }
    return out;
  }

  // ---- Exhibits ----

  function stateIcons(a) {
    if (a.uid === 'you') return [];
    if (a.mode === 'dormant') return a.pips ? Array.from({ length: N.PIPS_TO_WAKE }, (_, i) => i < a.pips ? 'pip' : 'pip_empty') : ['asleep'];
    return [a.mode === 'hunting' ? 'hunting' : a.mode === 'returning' ? 'returning' : 'alert'];
  }

  // A body split from another (a splitter's half, §8.1): a splitter whose uid is its body's
  // and a count, <body uid>/<k> (§3.2). Neither ever changes, so a half keeps its name
  // however often it settles back and is woken again, though each waking writes over its
  // story (`woke`), which first said how it split.
  const split = a => !!a && a.arch === 'splitter' && typeof a.uid === 'string' && /\/\d+$/.test(a.uid);
  // The species name in mid-sentence ('the Dawn-Caller on a Perch'), a split body's as 'a
  // split of …'.
  const theName = sp => 'the ' + sp.name.replace(/^The /, '');
  const midName = (a, sp) => (split(a) ? 'a split of ' : '') + theName(sp);

  // The tile of a's footprint nearest (x, y), ties in row-major order: where its blow comes
  // from (Combat.attack's fromTile).
  function fromTile(a, x, y) {
    let best = null, bd = -1;
    for (const t of Actors.footprint(a)) { const d = Math.max(Math.abs(t[0] - x), Math.abs(t[1] - y)); if (bd < 0 || d < bd) { best = t; bd = d; } }
    return best;
  }
  // What a hit of att's would take from def for a damage of `amount` after Padding: what
  // def's archetype and modifiers make of it (Archetypes.adjustDamage), the blow coming from
  // the tile `from`. So a hit through an old repair's side reads doubled, and a body that any
  // hit destroys reads all its health (§8.1). The cause is a scratch copy, never kept.
  const adjusted = (state, att, def, amount, from) =>
    Archetypes.adjustDamage(state, def, amount, { k: 'attack', by: att.uid, at: def.uid, from: [from[0], from[1]] });
  // Every roll att could make against def, after Padding and adjustDamage, from `from`: how
  // many there are, their sum, and the least and most (Combat.netRolls, adjusted).
  function rolls(state, att, def, from) {
    let n = 0, sum = 0, min = 0, max = 0;
    for (let r = att.dmin; r <= att.dmax; r++) {
      const d = adjusted(state, att, def, Math.max(N.DMG_MIN_ON_HIT, r - def.pad), from);
      if (!n || d < min) min = d;
      if (d > max) max = d;
      n++; sum += d;
    }
    return { n, sum, min, max };
  }
  const MELEE = { kind: 'melee' }, REACH = { kind: 'reach' };
  // The blow you would make at a now, as attack(uid) makes it: a blow beside it if one is
  // allowed, else a Reach blow if your weapon has Reach and one is allowed, else none.
  function blowNow(state, you, a) {
    if (Combat.canStrike(state, you, a, MELEE) === null) return 'melee';
    if (you.reach && Combat.canStrike(state, you, a, REACH) === null) return 'reach';
    return null;
  }
  // A surprise blow's figure now, after Padding and adjustDamage (§8.1): the most a blow of
  // this kind deals (×1.5 for a Light weapon's blow beside it, never for Reach), or against a
  // Centrepiece the rolled range, since its surprise blow rolls damage.
  function surprise(state, you, a, kind, at) {
    if (Actors.centrepiece(a)) { const r = rolls(state, you, a, at); return { min: r.min, max: r.max }; }
    const d = adjusted(state, you, a, Math.max(N.DMG_MIN_ON_HIT, Combat.surpriseRaw(you, { kind }) - a.pad), at);
    return { min: d, max: d };
  }

  // What a special is called in its line, by its shape (Specials.SHAPES).
  const SPECIAL = { ring: 'ring of blows', line: 'beam', call: 'call' };
  // The odds readout's line for a special (§8.1; Specials.readout): what it would deal you now
  // through your Padding, its gross number, with no roll, its reach, and its cadence.
  function specialLine(r) {
    const name = own(SPECIAL, r.shape) ? SPECIAL[r.shape] : 'special';
    if (r.net === null) return `Its ${name} deals no damage: it wakes the sleeping exhibits within ${r.range} tiles of it that can hear.`;
    const where = r.shape === 'ring' ? ', on the tiles round it' : r.range !== null ? `, up to ${r.range} tiles along a row or column` : '';
    const cadence = r.every !== null ? `, at most one action in ${r.every}` : '';
    return `Its ${name} would deal you ${r.net} (${r.gross} before your Padding), with no roll${where}${cadence}.`;
  }

  // The odds readout (BUILD.md §8.1), by exact enumeration of the rolls, all integer.
  // "Typically" is the mean net hit as a share of your current health, rounded half up. Your
  // figures are those of a blow from your tile (cause.from), so an old repair's doubled side
  // and a swarm body's any-hit rule read truly (adjustDamage). What its archetype says of its
  // odds (Archetypes.readout) changes two lines: an exhibit with no blow (noBlow, the
  // axis_sniper) gets no line on its hitting you, and one that needs a set number of hits
  // (hits, a swarm body) says so. A ranged archetype that strikes (the kiter) shoots with its
  // blow's chance and damage, within ROLE_ARTILLERY_RANGE (Ranged.shoot); with Reach (a Reach
  // weapon, or any weapon with the reach primitive, whose blows reach as a Reach weapon's do,
  // Kit.derive's you.reach) you strike from REACH_RANGE away as from beside it (§8.1); and
  // each special has its line.
  // An exhibit in an intact case keeps its lines: they say what its blows would do once out.
  const halfUp = (p, q) => Int.idiv(2 * p + q, 2 * q);
  function odds(state, a) {
    const you = state.actors[0], hp = Math.max(1, you.hp), at = [you.x, you.y];
    const said = Archetypes.readout(state, a, you), noBlow = said.some(r => r.k === 'noBlow'), set = said.find(r => r.k === 'hits');
    const A = own(Registry.ARCHETYPES, a.arch) ? Registry.ARCHETYPES[a.arch] : null;
    const mine = rolls(state, you, a, at), need = set ? set.n : Int.ceilDiv(a.hp * mine.n, mine.sum);
    const lines = [];
    if (!noBlow) {
      const theirs = rolls(state, a, you, fromTile(a, you.x, you.y)), chance = Combat.hitChance(a, you);
      lines.push(`It has a ${chance}% chance to hit you, typically hits for ${halfUp(100 * theirs.sum, theirs.n * hp)}% of your current health, and at worst could defeat you in ${hits(Int.ceilDiv(hp, theirs.max))}.`);
      if (A && A.ranged) lines.push(`It also shoots at you within ${N.ROLE_ARTILLERY_RANGE} tiles, with the same ${chance}% chance and the same damage.`);
    }
    lines.push(`You have a ${Combat.hitChance(you, a)}% chance to hit it, and typically need ${hits(need)} to destroy it.`);
    if (you.reach) lines.push(`Your weapon also strikes it with Reach, from exactly ${N.REACH_RANGE} tiles away in a straight line, over a clear tile between.`);
    if (Combat.surprised(you, a)) {
      const m = surprise(state, you, a, 'melee', at), r = you.reach ? surprise(state, you, a, 'reach', at) : m;
      lines.push(r.min === m.min && r.max === m.max ? `A surprise attack now would hit for certain, for ${range(m)}.`
        : `A surprise attack now would hit for certain, for ${range(m)} from beside it, or ${range(r)} with Reach from ${N.REACH_RANGE} tiles away.`);
    }
    for (const r of Specials.readout(state, a, you)) lines.push(specialLine(r));
    return lines;
  }

  // The Behaviour line (§5.3), with its numbers at the department's depth, leaving out the
  // clauses of rules switched off for this visit.
  const behaviour = (state, sp) => Clauses.line(sp, { depth: state.dept.depth, rulesOff: (state.options && state.options.rulesOff) || [] });

  // The Attack button says what the blow you would make now does (§7.1): a surprise blow hits
  // for certain (§8.1), so it shows no chance; a Reach blow says so.
  function attackText(state, you, a, kind) {
    const at = [you.x, you.y], what = kind === 'reach' ? 'Attack with Reach' : 'Attack';
    if (Combat.surprised(you, a)) return `${what}: certain hit, ${range(surprise(state, you, a, kind, at))} damage`;
    return `${what}: ${Combat.hitChance(you, a)}%, ${range(rolls(state, you, a, at))} damage`;
  }

  // An exhibit's label, or null: for you, for one gone, and for one that shows as something
  // else (Archetypes.present: a mimic in its disguise is a case, whose label is its case's,
  // §8.3). A selection id names a thing that is not an exhibit ('case:x,y', 'plaque:x,y',
  // 'staff:x,y', 'item:<uid>'), and gives that thing's label. Its Attack button is offered
  // only for a blow step() would take now (allowed), beside it or with Reach.
  const SELECTED = /^(case|plaque|staff):(-?\d+),(-?\d+)$/;
  function of(state, uid) {
    if (typeof uid !== 'string') return null;
    const m = SELECTED.exec(uid);
    if (m) {
      const f = Cases.at(state, Number(m[2]), Number(m[3]));
      if (!f || f.k !== m[1]) return null;
      return m[1] === 'case' ? ofCase(state, f) : m[1] === 'plaque' ? ofPlaque(state, f) : ofStaffDoor(state, f);
    }
    if (uid.startsWith('item:')) return ofItem(state, uid.slice(5));
    const a = Actors.byUid(state, uid);
    if (!a || a.gone || a.uid === 'you' || Archetypes.present(state, a) !== null) return null;
    const sp = speciesOf(state, a), you = state.actors[0];
    const near = Actors.dist(a, you.x, you.y) <= N.READ_RANGE;
    // An exhibit with no blow (Archetypes.readout's noBlow, the axis_sniper) shows neither a
    // blow's Acc nor its damage, which it never uses (§8.1, the odds readout).
    const blow = !Archetypes.readout(state, a, you).some(r => r.k === 'noBlow');
    const pictos = [
      { icon: 'heart', text: `${a.hp}/${a.maxHp}` }, { icon: 'acc', text: String(a.acc) }, { icon: 'eva', text: String(a.eva) },
      { icon: 'padding', text: String(a.pad) }, { icon: 'damage', text: `${a.dmin}–${a.dmax}` },
    ].filter(p => blow || (p.icon !== 'acc' && p.icon !== 'damage'));
    if (sp && sp.trigger && own(Registry.TRIGGERS, sp.trigger)) pictos.unshift({ icon: Registry.TRIGGERS[sp.trigger].icon, text: 'wakes' });
    pictos.unshift({ icon: 'ring', text: 'ring' });
    pictos.push(...statusPictos(state, a));
    const kind = blowNow(state, you, a);
    const title = sp ? (split(a) ? 'A split of ' + theName(sp) : sp.name) : a.sp;
    return {
      uid, kind: 'exhibit', title, stateIcons: stateIcons(a), tomb: sp ? sp.tomb : null, number: sp ? sp.id.replace(/^([A-Z]+)(\d+)/, '$1.$2') : '',
      pictos, behaviour: sp ? behaviour(state, sp) : '', odds: odds(state, a),
      paragraph: near && sp ? sp.paragraph : '', far: near ? '' : 'Come closer to read the label.',
      closeup: sp ? { sprite: sp.sprite, dept: state.dept.acc } : null,
      actions: kind ? offer(state, 'attack', attackText(state, you, a, kind), { a: 'attack', uid: a.uid }) : [],
    };
  }

  // ---- Items ----

  const items = state => state.items || [];
  const itemByUid = (state, uid) => { for (const i of items(state)) if (i.uid === uid) return i; return null; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // An item's name: a consumable's local name (Consumables.name), a pack item's own, else
  // what it is ('A Balanced weapon, tier 1'; 'A Restoration kit').
  function itemName(state, it) {
    if (it.kind === 'consumable') return Consumables.name(state, it).local;
    if (it.kind === 'kit') return 'A Restoration kit';
    const d = Kit.describe(state, it.uid);
    if (d && d.title) return d.title;
    if (it.kind === 'instrument' && own(Registry.INSTRUMENTS, it.form)) return `A ${Registry.INSTRUMENTS[it.form].name}` + (Number.isInteger(it.tier) ? `, tier ${it.tier}` : '');
    if ((it.kind === 'weapon' || it.kind === 'garment') && typeof it.form === 'string') return `A ${cap(it.form)} ${it.kind}` + (Number.isInteger(it.tier) ? `, tier ${it.tier}` : '');
    return /^[aeiou]/.test(it.kind) ? 'An ' + it.kind : 'A ' + it.kind;
  }
  // A seal's pictogram is its shape's, seal_<shape> (D5.11: seals are told apart by shape;
  // Registry.SEALS[seal].shape), or the plain seal for one with no shape.
  const sealIcon = seal => own(Registry.SEALS, seal) && typeof Registry.SEALS[seal].shape === 'string' ? 'seal_' + Registry.SEALS[seal].shape : 'seal';
  // An item's pictogram is its kind's; a consumable's is its seal's (§8.8, D5.11).
  const itemIcon = (state, it) => it.kind === 'consumable' ? sealIcon(Consumables.name(state, it).seal) : it.kind;
  const BONUS = { dmg: 'damage', acc: 'Acc', eva: 'Eva', pad: 'Padding' };
  // What kind of thing it is, beside its pictogram: a weapon's or garment's form and tier, an
  // instrument's tier, a curio's rank; and its Restoration levels.
  function itemKind(it, d) {
    const level = d.level ? `, level ${d.level}` : '';
    if ((it.kind === 'weapon' || it.kind === 'garment') && typeof it.form === 'string') return `${cap(it.form)} ${it.kind}, tier ${it.tier}${level}`;
    if (it.kind === 'instrument') return `instrument, tier ${it.tier}${level}` + (d.instrument ? `, ${d.instrument.charges}/${d.instrument.max} charges` : '');
    if (it.kind === 'curio') return d.rank ? `curio, rank ${d.rank}` : 'curio';
    return it.kind === 'kit' ? 'Restoration kit' : it.kind;
  }
  const FEATURE = { reach: 'Reach', quiet: 'Quiet', breaker: 'Breaker', charges: 'Charges' };
  // What you can do with an item now: the step() actions that need nothing more (take, drop,
  // equip, take off, a consumable's drink or read), and those that need a target (an
  // instrument's tile, a throw's tile, a Restoration kit's item), as `aim`.
  const VERB = { take: 'Take', drop: 'Drop', equip: 'Equip', unequip: 'Take off' };
  function itemActions(state, it) {
    if (state.over || (state.ui && state.ui.pendingChoice)) return [];
    const out = [], legal = Step.legal(state);
    const mine = legal.filter(l => l.uid === it.uid);
    for (const id of ['take', 'equip', 'drop']) { const l = mine.find(q => q.a === id); if (l) out.push({ id, text: VERB[id], act: l }); }
    if (it.where.at === 'kit') { const l = legal.find(q => q.a === 'unequip' && q.slot === it.where.slot); if (l) out.push({ id: 'unequip', text: VERB.unequip, act: l }); }
    const use = mine.filter(q => q.a === 'use');
    const plain = use.find(q => q.x === undefined && q.on === undefined && q.how === undefined);
    if (plain) {
      const cls = it.kind === 'consumable' && own(Registry.CONSUMABLES, it.ck) ? Registry.CONSUMABLES[it.ck].cls : null;
      out.push({ id: 'use', text: cls === 'ephemera' ? 'Read' : cls === 'solution' ? 'Drink' : 'Use', act: plain });
    }
    if (use.some(q => q.x !== undefined)) out.push({ id: 'aim', text: 'Use at a tile…', aim: 'tile' });
    if (use.some(q => q.on !== undefined)) out.push({ id: 'restore', text: 'Use on an item…', aim: 'item' });
    if (mine.some(q => q.a === 'throw')) out.push({ id: 'throw', text: 'Throw…', aim: 'tile' });
    return out;
  }

  // An item's label (§8.8): a consumable's local name, seal and line (its kind's once
  // identified, Consumables.line); any other item's name, tombstone and the parts of its
  // Behaviour line (Kit.describe), with its own numbers at your grade, its bonuses and, for an
  // instrument, its charges. Carried or worn, it is read wherever you are; on the floor or in
  // a case, its paragraph needs you within READ_RANGE. null for an item that is gone.
  function ofItem(state, uid) {
    const it = itemByUid(state, uid);
    if (!it || !it.where || it.where.at === 'gone') return null;
    const you = state.actors[0], w = it.where, carried = w.at === 'tote' || w.at === 'kit';
    const close = carried || inReach(you, w.x, w.y);
    const base = { uid: 'item:' + uid, kind: 'item', title: itemName(state, it), stateIcons: [], tomb: null, number: '', pictos: [], behaviour: '',
      odds: [], paragraph: '', far: '', closeup: null, actions: itemActions(state, it) };
    if (it.kind === 'consumable') {
      const nm = Consumables.name(state, it), n = it.n === null || it.n === undefined ? 1 : it.n;
      if (n > 1) base.title += ` (${n})`;
      if (nm.seal && own(Registry.SEALS, nm.seal)) base.pictos.push({ icon: sealIcon(nm.seal), text: Registry.SEALS[nm.seal].name });
      base.behaviour = Consumables.line(state, it);
      base.odds.push(nm.kind && own(Registry.CONSUMABLES, nm.kind) ? `Identified: it is ${Registry.CONSUMABLES[nm.kind].name}.` : 'Not identified: which kind it is is not known yet.');
      return base;
    }
    const d = Kit.describe(state, uid);
    if (!d) return null;
    base.tomb = d.tomb;
    base.number = d.tomb && typeof d.ref === 'string' ? d.ref.replace(/^([A-Z]+)(\d+)/, '$1.$2') : '';
    base.behaviour = d.line;
    base.pictos.push({ icon: itemIcon(state, it), text: itemKind(it, d) });
    if (d.stats && it.kind === 'weapon') {
      base.pictos.push({ icon: 'damage', text: `${d.stats.dmin}–${d.stats.dmax}` }, { icon: 'acc', text: num(d.stats.acc) });
      base.odds.push(`At your grade, before any bonus: ${d.stats.dmin}–${d.stats.dmax} damage and Acc ${num(d.stats.acc)}; a blow takes ${d.stats.cost} ticks.`);
    } else if (d.stats) {
      base.pictos.push({ icon: 'padding', text: String(d.stats.pad) }, { icon: 'eva', text: signed(d.stats.eva) });
      base.odds.push(`At your grade, before any bonus: Padding ${d.stats.pad} and Eva ${signed(d.stats.eva)}.`);
    }
    if (d.needs !== null) base.odds.push(`It needs ${grade(d.needs)}; you are ${grade(yourGrade(state))}` + (d.short ? `, ${count(d.short, 'grade', 'grades')} short.` : '.'));
    const bonus = [];
    for (const b of d.bonuses) {
      if (own(BONUS, b.id) && Number.isInteger(b.n)) bonus.push(`${signed(b.n)} ${BONUS[b.id]}`);
      else if (own(FEATURE, b.id)) bonus.push(FEATURE[b.id]);
    }
    if (bonus.length) base.odds.push(`It gives ${bonus.join(', ')}.`);
    if (d.level) base.odds.push(it.kind === 'curio' ? `Restored ${count(d.level, 'level', 'levels')}: rank ${d.rank}.` : `Restored ${count(d.level, 'level', 'levels')}.`);
    const I = d.instrument;
    if (I) {
      const next = I.back === null ? 'it is full' : `the next comes back in ${turns(I.back)}`;
      base.odds.push(`${count(I.charges, 'charge', 'charges')} of ${I.max}; one comes back every ${turns(I.recharge)}, and ${next}. It reaches ${I.range} tiles.`);
      if (Number.isInteger(I.dmin)) base.odds.push(`Its bolt deals ${I.dmin === I.dmax ? I.dmin : I.dmin + '–' + I.dmax} damage, rolled with Acc ${num(I.acc)}.`);
    }
    if (d.paragraph) { if (close) base.paragraph = d.paragraph; else base.far = 'Come closer to read the label.'; }
    return base;
  }

  // ---- Cases, staff doors and plaques ----

  // A case's label (§8.3, §8.8): what it holds, or that its object is on loan, or that it is
  // empty; its glass and lock, and its cracks; its rules (Cases.rules: the case's and its
  // glass's clauses); what you can do to it now with your grade and weapon; its tombstone,
  // which carries its accession number. A mimic in its disguise gives exactly what a real
  // empty case with its glass, lock and loan gives, but no number: its one tell (§8.3, D3.10).
  // null for a fixture that is not a case, or a revealed mimic's.
  const ST = { open: 'An open case', broken: 'A broken case', dissolved: 'A case with its glass dissolved' };
  function ofCase(state, f) {
    const d = Cases.describe(state, f);
    if (!d || d.k !== 'case') return null;
    const you = state.actors[0], close = inReach(you, d.x, d.y), shut = d.st === 'shut';
    const held = d.holds ? itemByUid(state, d.holds.uid) : null, what = held ? itemName(state, held) : null;
    const rec = held && held.kind !== 'consumable' ? Kit.describe(state, held.uid) : null;
    // An exhibit standing in it, seen through the glass, is named; a mimic in its disguise is
    // the case itself, not something in it.
    const inside = shut ? state.actors.find(a => !a.gone && a.uid !== 'you' && Actors.covers(a, d.x, d.y) && Archetypes.present(state, a) === null) : null;
    const sp = inside ? speciesOf(state, inside) : null;
    let title;
    if (inside) title = `A case, with ${sp ? midName(inside, sp) : 'an exhibit'} inside`;
    else if (shut) title = what ? `A case: ${what}` : d.loan ? 'A case: its object is on loan elsewhere' : 'An empty case';
    else title = (own(ST, d.st) ? ST[d.st] : 'A case') + (what ? `: ${what}` : '');
    const pictos = [{ icon: 'glass', text: `${d.glassName || 'unknown'} glass` }, { icon: 'lock', text: grade(d.lock) }];
    if (shut && d.hits > 0) pictos.push({ icon: 'shards', text: `cracked, ${d.hits} of ${count(d.need, 'bash', 'bashes')}` });
    if (held) pictos.push({ icon: itemIcon(state, held), text: held.kind });
    const lines = [];
    if (shut) {
      lines.push(d.canOpen ? `Your grade (${grade(yourGrade(state))}) opens its lock (${grade(d.lock)}).` : `Its lock needs ${grade(d.lock)}; you are ${grade(yourGrade(state))}.`);
      lines.push(!d.canBreak ? `A Light weapon cannot break ${d.glassName} glass.` : d.blows === 1 ? `Your weapon breaks its ${d.glassName} glass in 1 blow, with a crash.`
        : `Your weapon breaks its ${d.glassName} glass in ${d.blows} blows: each before the last is loud, and the last makes a crash.`);
    } else if (held) lines.push('It is no longer shut: what it holds can be taken.');
    const actions = shut ? offer(state, 'open', `Open: ${grade(d.lock)}`, { a: 'open', x: d.x, y: d.y })
      .concat(offer(state, 'bash', d.blows === 1 ? 'Break the glass: 1 blow, a crash' : `Break the glass: ${d.blows} blows, loud, the last a crash`, { a: 'bash', x: d.x, y: d.y }))
      : held ? offer(state, 'take', `Take ${what}`, { a: 'take', uid: held.uid }) : [];
    return {
      uid: `case:${d.x},${d.y}`, kind: 'case', x: d.x, y: d.y, title, stateIcons: [],
      tomb: rec && rec.tomb ? rec.tomb : {}, number: d.num || '', pictos, behaviour: d.rules.join(' '), odds: lines,
      paragraph: close && rec && rec.paragraph ? rec.paragraph : '', far: !close && rec && rec.paragraph ? 'Come closer to read the label.' : '',
      closeup: null, actions,
    };
  }

  // The tile beside you in direction d toward (x, y), as a move: the direction, or -1.
  function dirTo(you, x, y) {
    for (let d = 0; d < 8; d++) if (you.x + Grid.DX[d] === x && you.y + Grid.DY[d] === y) return d;
    return -1;
  }
  // A staff door's label (§8.3): its grade, its rule, and whether your grade opens it; you
  // open it by stepping into it, and close it with close(x, y).
  function ofStaffDoor(state, f) {
    const d = Cases.describe(state, f);
    if (!d || d.k !== 'staff') return null;
    const you = state.actors[0], g = yourGrade(state), dir = dirTo(you, d.x, d.y);
    const actions = d.open ? offer(state, 'close', 'Close', { a: 'close', x: d.x, y: d.y })
      : d.canOpen && dir >= 0 ? offer(state, 'open', `Open: ${grade(d.grade)}`, { a: 'move', dir }) : [];
    return {
      uid: `staff:${d.x},${d.y}`, kind: 'staff', x: d.x, y: d.y, title: d.open ? 'An open staff door' : 'A staff door', stateIcons: [],
      tomb: null, number: '', pictos: [{ icon: 'lock', text: grade(d.grade) }], behaviour: d.rules.join(' '),
      odds: [d.canOpen ? `Your grade (${grade(g)}) opens it.` : `It needs ${grade(d.grade)}; you are ${grade(g)}, so to you it is a wall.`],
      paragraph: '', far: '', closeup: null, actions,
    };
  }

  // Is a plaque at (x, y) within reading distance (READ_RANGE, a disc) and in sight (§8.6)?
  const readable = (state, x, y) => { const you = state.actors[0]; return Grid.disc(x - you.x, y - you.y, N.READ_RANGE) && Grid.los(state.dept, you.x, you.y, x, y); };
  // An identifying label on a wall (§8.6): the seal of the kind it describes, its rule, and,
  // once that kind is identified, its text (the pack's consumables.labels). Reading it
  // (read(x, y), free) is what identifies the kind, so before that the label offers Read and
  // does not show the text, whose words name the kind.
  function ofPlaque(state, f) {
    if (!f || f.k !== 'plaque' || !own(Registry.CONSUMABLES, f.ck)) return null;
    const known = Consumables.known(state, f.ck), seal = Consumables.sealFor(state, f.ck), close = readable(state, f.x, f.y);
    const pack = Packs.get(state.dept.acc), text = pack && pack.consumables && own(pack.consumables.labels, f.ck) ? pack.consumables.labels[f.ck] : '';
    const P = Registry.FIXTURES.plaque, pictos = [{ icon: 'reads', text: 'label' }];
    if (seal && own(Registry.SEALS, seal)) pictos.push({ icon: sealIcon(seal), text: Registry.SEALS[seal].name });
    return {
      uid: `plaque:${f.x},${f.y}`, kind: 'plaque', x: f.x, y: f.y,
      title: known ? `An identifying label: ${Registry.CONSUMABLES[f.ck].name}` : 'An identifying label', stateIcons: [], tomb: null, number: '',
      pictos, behaviour: Clauses.fill(P.clause, Clauses.params(P.params, null, { depth: state.dept.depth })), odds: [],
      paragraph: known && close ? text : '', far: !close ? 'Come closer to read the label.' : known ? '' : 'Read it to learn which kind it describes.',
      closeup: null, actions: offer(state, 'read', 'Read the label', { a: 'read', x: f.x, y: f.y }),
    };
  }

  // ---- You ----

  // Your label: your grade, your numbers as Kit.derive makes them (with your weapon's blow
  // cost), your ring now (Vision.ringRadius), your statuses and the turns each still covers,
  // and what you can do on your own tile: wait, rest, sit on a bench, leave by an exit.
  function yours(state) {
    const you = state.actors[0], r = Vision.ringRadius(state);
    const pictos = [
      { icon: 'heart', text: `${you.hp}/${you.maxHp}` }, { icon: 'acc', text: String(you.acc) }, { icon: 'eva', text: String(you.eva) },
      { icon: 'padding', text: String(you.pad) }, { icon: 'damage', text: `${you.dmin}–${you.dmax}` }, { icon: 'ring', text: count(r, 'tile', 'tiles') },
    ].concat(statusPictos(state, you));
    if (you.seated) pictos.push({ icon: 'bench', text: 'seated' });
    const lines = [`Handling Clearance, ${grade(yourGrade(state))}.`,
      `Your blows deal ${you.dmin}–${you.dmax} damage with Acc ${you.acc}, ${Actors.attackCost(state, you)} ticks each` + (you.reach ? `, and reach ${N.REACH_RANGE} tiles away in a straight line.` : '.'),
      `You have Padding ${you.pad} and Eva ${you.eva}.`,
      `Your ring reaches ${count(r, 'tile', 'tiles')} now.`];
    for (const s of you.statuses || []) if (own(Registry.STATUSES, s.id)) lines.push(`You are ${Registry.STATUSES[s.id].words}: ${turns(Status.left(state, you, s.id))} left.`);
    const actions = offer(state, 'wait', 'Wait', { a: 'wait' }).concat(offer(state, 'rest', 'Rest', { a: 'rest' }), offer(state, 'sit', 'Sit on the bench', { a: 'sit' }));
    const exits = (state.dept && state.dept.exits) || [];
    for (let i = 0; i < exits.length; i++) actions.push(...offer(state, 'leave', 'Leave by this door', { a: 'leave', i }));
    return { uid: 'you', kind: 'you', title: 'You', stateIcons: [], tomb: null, number: '', pictos, behaviour: '', odds: lines, paragraph: '', far: '', closeup: null, actions };
  }

  // ---- The strip ----

  // The strip (§8.8): the nearest readable thing within READ_RANGE, in this priority: hunting
  // or awake exhibits (every mode but dormant), sleeping exhibits, case contents, plaques;
  // nearest first (in king moves) within each, then spawn order, then fixture order. An
  // exhibit counts from its nearest tile, with any tile in sight; a case from its tile, in
  // sight; a plaque where it can be read (its disc, in sight; readable). Case contents are a
  // shut case, by what it holds, its object on loan, or nothing, and a case no longer shut
  // that still holds its object: an opened, broken or dissolved case that holds nothing has
  // nothing left to read, and does not keep a plaque off the strip. An exhibit that shows as
  // something else (a mimic in its disguise, Archetypes.present) is not an exhibit here: it
  // reaches the strip only as its case, which is shut, as a real empty shut case would. The
  // strip shows the label's title, state, first two pictograms and Behaviour line (a case's:
  // what you can do to it).
  function strip(state) {
    const you = state.actors[0];
    let best = null, bestKey = -1;
    const consider = (key, make) => { if (best === null || key < bestKey) { best = make; bestKey = key; } };
    const TIER = 100;
    for (const a of state.actors) {
      if (a.gone || a.uid === 'you' || Archetypes.present(state, a) !== null) continue;
      const d = Actors.dist(a, you.x, you.y);
      if (d > N.READ_RANGE || !Actors.inSight(state, a, you.x, you.y)) continue;
      consider((a.mode === 'dormant' ? 1 : 0) * TIER + d, () => of(state, a.uid));
    }
    for (const f of (state.dept && state.dept.fixtures) || []) {
      if (f.k === 'case' && f.st !== 'revealed' && (f.st === 'shut' || !!f.holds)) {
        if (inReach(you, f.x, f.y) && Grid.los(state.dept, you.x, you.y, f.x, f.y)) consider(2 * TIER + steps(you, f.x, f.y), () => ofCase(state, f));
      } else if (f.k === 'plaque' && readable(state, f.x, f.y)) consider(3 * TIER + steps(you, f.x, f.y), () => ofPlaque(state, f));
    }
    if (!best) return null;
    const l = best();
    if (!l) return null;
    const short = l.kind === 'case' ? l.odds.join(' ') : l.behaviour;
    return { uid: l.uid, title: l.title, stateIcons: l.stateIcons, pictos: l.pictos.slice(0, 2).map(p => p.icon), behaviour: short };
  }

  // Names for Text.event: nameOf(state) → (uid → 'the' and the species name as written, a
  // split body's as 'a split of the …', or null for you and for anything with no species in a
  // pack or shared, such as the test room's dummies).
  function nameOf(state) {
    return uid => {
      if (uid === 'you') return null;
      const a = Actors.byUid(state, uid), sp = a ? speciesOf(state, a) : null;
      return sp ? midName(a, sp) : null;
    };
  }

  return { of, strip, odds, speciesOf, stateIcons, nameOf, ofCase, ofItem, ofPlaque, ofStaffDoor, you: yours, allowed };
})();
