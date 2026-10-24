// ACCESSION — building a fresh state (BUILD.md §4.1): the parts every state has, and a state
// for one room, for tests, scenarios and arenas. Dept.create builds a department's.
'use strict';
const Setup = (() => {
  const SAVE_VERSION = 1;

  // The visitor at the start of a run, wearing a T1 Balanced weapon and a T1 Standard
  // garment at grade I (BUILD.md §8.1), with the stats Kit.stats derives from them. `form`
  // ('light', 'balanced', 'heavy' or 'reach'; Balanced if absent) swaps the T1 weapon, for
  // tests and scenarios (a T1 Heavy weapon needs grade II, so at grade I it costs 2 Acc).
  // You carry every actor field (Actors.make), and also: still (your ring's radius comes
  // from your last action that cost time, §8.2), lastAct, seated (on a bench, §8.1), regen
  // (the regeneration store), and your derived stats, which Kit.settle keeps equal to
  // Kit.derive of what you wear.
  function you(x, y, form) {
    form = form || 'balanced';
    if (!N['FORM_' + form.toUpperCase()]) throw new Error('Setup.you: no weapon form ' + form);
    const w = Kit.item({ uid: 'you.w', kind: 'weapon', where: { at: 'kit', slot: 'weapon' }, form, tier: 1 });
    const g = Kit.item({ uid: 'you.g', kind: 'garment', where: { at: 'kit', slot: 'garment' }, form: 'standard', tier: 1 });
    return Object.assign(Actors.make(null, { uid: 'you', sp: 'visitor', size: 1, x, y, hp: N.PLAYER_HP, maxHp: N.PLAYER_HP }),
      { still: false, lastAct: null, seated: false, regen: 0 }, Kit.stats(w, g, N.GRADE_START));
  }

  // The run (§4.1): your grade, the seals and what you know of them, the consumable deck
  // (every card, in DECK's order, until Consumables.startRun and the draws change it), the
  // counter for split stacks' uids, and the run structure M5 fills.
  const run = (depth, grade) => ({
    grade: grade || N.GRADE_START, seals: null, knownSeals: [], deck: N.DECK.slice(), items: 0,
    floor: null, slot: null, depth, sequence: null, offered: null, certificates: [], perks: [], collectionPicks: [],
  });
  // What you wear and carry; Kit.start fills it.
  const kit = () => ({ kit: { weapon: null, garment: null, curio: [null, null], instrument: null }, tote: [] });
  // The parts of a department every state has, beyond its map (§4.1).
  const deptParts = grade => ({ clock: null, fixtures: [], surfaces: [], highlights: [], planRead: null, entryGrade: grade, modules: [] });

  // A state with every top-level field, around the department `dept` and you at (x, y).
  function base(seed, dept, x, y, options, grade) {
    return {
      v: SAVE_VERSION, coreHash: null, runId: null, seed, rng: {}, tick: 0, turn: 0,
      options: Options.make(options),
      run: run(dept.depth, grade),
      dept,
      actors: [you(x, y)],
      items: [],
      you: kit(),
      causes: [], over: null,
      ui: { pendingChoice: null },
    };
  }

  // The actors removed for this visit (options.without, by uid) are marked gone: each has
  // already taken its uid and its place, so nothing else is renumbered or moved (§3.2). Then
  // each archetype's init runs, in spawn order, for actors not gone; then each exhibit made
  // awake gets its story from the starting state (Wake.created, with no event or beat).
  function settleActors(state, from) {
    const without = state.options.without || [];
    for (const a of state.actors) if (without.includes(a.uid)) a.gone = 1;
    const made = state.actors.slice(from);
    for (const a of made) if (!a.gone) Archetypes.init(state, a);
    for (const a of made) if (!a.gone && a.mode !== 'dormant') Wake.created(state, a, 'awake', {}, null);
  }

  // A state for one room, for tests, scenarios and arenas. spec:
  //   acc, depth (1 if absent), map (rows), you [x, y];
  //   exhibits: [{sp, at, mode?, stats, size?, arch?, role?, mods?, modParams?, trigger?,
  //     group?, home?, guards?, ax?, speed?, statuses?, target?, lastKnown?, sawYou?, pips?,
  //     stim?, next?, gen?, hp?, maxHp?, room?, uid?}], stats a role's (Roles.stats). An
  //     exhibit that names a pack or shared species (Packs.speciesFor) takes that species'
  //     archetype, role, modifiers, modParams, trigger and group unless it gives its own,
  //     and is made awake, unless it gives a mode, when its trigger stands for the wake
  //     clause (`awake`), as a department's is. Its statuses are records {id, until?,
  //     turns?, from?}, settled as the room is made. Each gets the uid
  //     <acc>.<depth>.<room>.<n>, room 'room' if absent and n counted per room, unless it
  //     gives one;
  //   fixtures (full records, such as Cases.make's); items (records for Kit.item): an item
  //   given at {at: 'tote'} is carried, and one given at {at: 'kit', slot} is worn in that
  //   slot (Kit.SLOTS), a weapon or garment there taking the place of the one you start with,
  //   which goes {at: 'gone'}; kit ({weapon: {form, tier, level}, garment: {form, tier,
  //   level}}: your starting kit, else the usual one); youStatuses (your statuses, as an
  //   exhibit's); clock ({ltour} or {B, G, count}: Clock.init's; none if absent); entrance
  //   [x, y], exits [[x, y]…], grade (your grade, I if absent).
  // A field it does not know, a slot given twice, an item of the wrong kind for its slot, a
  // tote past TOTE_SLOTS, an item uid given twice or a status not in the registry is refused
  // with an error, so nothing a test gives is silently left out.
  // options: Options.make's (rulesOff, without, invulnerable).
  const SPEC = ['acc', 'depth', 'map', 'you', 'exhibits', 'fixtures', 'items', 'kit', 'clock', 'entrance', 'exits', 'grade', 'youStatuses'];
  const EXHIBIT = ['sp', 'at', 'mode', 'stats', 'size', 'arch', 'role', 'mods', 'modParams', 'trigger', 'group', 'home', 'guards', 'ax', 'speed',
    'statuses', 'target', 'lastKnown', 'sawYou', 'pips', 'stim', 'next', 'gen', 'hp', 'maxHp', 'acc', 'eva', 'pad', 'dmin', 'dmax', 'room', 'uid'];
  const unknown = (rec, known, where) => { for (const k of Object.keys(rec)) if (!known.includes(k)) throw new Error(`Setup.room: ${where} has the unknown field ${k}`); };
  function statuses(list, where) {
    for (const s of list || []) if (!s || typeof s.id !== 'string' || !Registry.STATUSES[s.id]) throw new Error(`Setup.room: ${where} has no status ${s && s.id}`);
    return list;
  }
  // What the species gives, where the exhibit leaves it out (§4.1: copied at spawn).
  function fromSpecies(state, e, rec) {
    const sp = Packs.speciesFor(state, { sp: e.sp });
    if (!sp) return;
    const fill = (k, v) => { if (e[k] === undefined) rec[k] = v; };
    fill('arch', sp.archetype || 'plodder');
    if (e.role === undefined && !(e.stats && e.stats.role)) rec.role = sp.role || null;
    fill('mods', sp.modifiers || []);
    fill('modParams', sp.modParams || {});
    fill('trigger', sp.trigger || null);
    fill('group', sp.group || null);
    const T = sp.trigger ? Registry.TRIGGERS[sp.trigger] : null;
    if (e.mode === undefined && T && T.replacesWake) rec.mode = 'awake';
  }
  // The items you are given carry or wear (spec.items), checked as they go in.
  function carry(state, list, k) {
    const you = state.you, start = { weapon: 'you.w', garment: 'you.g' }, taken = {};
    for (const rec of list || []) {
      const it = Kit.item(rec);
      if (state.items.some(i => i.uid === it.uid)) throw new Error(`Setup.room: the item ${it.uid} is given twice`);
      state.items.push(it);
      if (it.where.at === 'tote') {
        if (you.tote.length >= N.TOTE_SLOTS) throw new Error(`Setup.room: the tote holds ${N.TOTE_SLOTS} items`);
        you.tote.push(it.uid);
      } else if (it.where.at === 'kit') {
        const slot = it.where.slot, kind = slot === 'curio0' || slot === 'curio1' ? 'curio' : slot;
        if (!Kit.SLOTS.includes(slot)) throw new Error(`Setup.room: there is no slot ${slot} (Kit.SLOTS)`);
        if (taken[slot] || (start[slot] && k[slot])) throw new Error(`Setup.room: the kit slot ${slot} is given twice`);
        const an = w => /^[aeiou]/.test(w) ? 'an ' + w : 'a ' + w;
        if (it.kind !== kind) throw new Error(`Setup.room: the ${slot} slot holds ${an(kind)}, and ${it.uid} is ${an(it.kind)}`);
        taken[slot] = 1;
        if (start[slot]) { state.items.find(i => i.uid === start[slot]).where = { at: 'gone' }; you.kit[slot] = it.uid; }
        else if (kind === 'curio') you.kit.curio[slot === 'curio0' ? 0 : 1] = it.uid;
        else you.kit.instrument = it.uid;
      }
    }
  }

  function room(seed, spec, options) {
    unknown(spec, SPEC, 'the spec');
    const depth = spec.depth || 1, grade = spec.grade || N.GRADE_START;
    const dept = Object.assign({ acc: spec.acc, depth, w: spec.map[0].length, h: spec.map.length, tiles: spec.map.slice(),
      entrance: spec.entrance ? spec.entrance.slice() : null, exits: (spec.exits || []).map(e => e.slice()), seen: '' }, deptParts(grade));
    if (spec.clock) dept.clock = Clock.init(spec.clock.ltour || 0, spec.clock);
    for (const f of spec.fixtures || []) dept.fixtures.push(JSON.parse(JSON.stringify(f)));
    const state = base(seed, dept, spec.you[0], spec.you[1], options, grade);
    const counts = {};
    for (const e of spec.exhibits || []) {
      unknown(e, EXHIBIT, `the exhibit ${e.uid || e.sp}`);
      const key = e.room || 'room';
      counts[key] = (counts[key] || 0) + 1;
      const rec = Object.assign({}, e.stats, e, {
        uid: e.uid || `${spec.acc}.${depth}.${key}.${counts[key]}`,
        x: e.at[0], y: e.at[1], mode: e.mode || 'dormant', maxHp: e.maxHp !== undefined ? e.maxHp : (e.hp !== undefined ? e.hp : e.stats.hp),
      });
      if (e.stats && e.stats.role && e.role === undefined) rec.role = e.stats.role;
      fromSpecies(state, e, rec);
      statuses(e.statuses, `the exhibit ${rec.uid}`);
      delete rec.stats; delete rec.at; delete rec.room;
      Actors.spawn(state, rec);
    }
    const orNull = v => v === undefined ? null : v;
    for (const s of statuses(spec.youStatuses, 'youStatuses') || []) state.actors[0].statuses.push({ id: s.id, until: orNull(s.until), turns: orNull(s.turns), from: orNull(s.from) });
    settleActors(state, 1);
    const k = spec.kit || {};
    Kit.start(state, k.weapon && k.weapon.form);
    for (const [uid, part] of [['you.w', k.weapon], ['you.g', k.garment]]) {
      if (!part) continue;
      const it = state.items.find(i => i.uid === uid);
      for (const f of ['form', 'tier', 'level']) if (part[f] !== undefined) it[f] = part[f];
    }
    carry(state, spec.items, k);
    Status.settle(state);
    Kit.settle(state);
    return state;
  }

  return { SAVE_VERSION, you, run, kit, deptParts, base, settleActors, room };
})();
