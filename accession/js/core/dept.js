// ACCESSION — a department visit's starting state (BUILD.md §4.1, §5.5; M4 plan A2, A3, A10):
// the generated plan from a pack's programme, populated and checked as one layout attempt;
// you at the entrance as the visitor the carry gives; then the cases, the exhibits, your kit
// and the department's items and consumables. The exhibits' placement is Populate.exhibits.
'use strict';
const Dept = (() => {
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const ITEM_SLOTS = () => Kit.SLOTS.concat(['tote']);

  // The visitor of a single visit (A2), from options.carry:
  //   absent or 'median'  Progress.median(depth): grade d (at most GRADE_MAX), the lower tier
  //                       on offer at d, no perks, no items;
  //   'start'             the visitor at a run's start, as in M3: grade GRADE_START, tier 1;
  //   {grade, perks, tier, items}, any of them left out taken from the median:
  //                       perks [{id, rank}], rank 1 or 2, an id once; items [{ref, slot}],
  //                       ref an item of this department's pack, slot a kit slot (Kit.SLOTS)
  //                       or 'tote', a slot once.
  // Anything else is refused with an error, so a carry is never half read.
  const CARRY = ['grade', 'perks', 'tier', 'items'];
  function visitor(carry, depth, pack) {
    const median = Progress.median(depth);
    if (carry === undefined || carry === null || carry === 'median') return median;
    if (carry === 'start') return { grade: N.GRADE_START, perks: [], tier: 1, items: [] };
    if (typeof carry !== 'object' || Array.isArray(carry)) throw new Error(`Dept.create: the carry ${JSON.stringify(carry)} is not 'median', 'start' or {grade, perks, tier, items}`);
    for (const k of Object.keys(carry)) if (!CARRY.includes(k)) throw new Error(`Dept.create: the carry has the unknown field ${k}`);
    const v = Object.assign(median, carry.grade !== undefined ? { grade: carry.grade } : {}, carry.tier !== undefined ? { tier: carry.tier } : {});
    const highest = N.TIER_LOW_BY_DEPTH[N.TIER_LOW_BY_DEPTH.length - 1];
    if (!Number.isInteger(v.grade) || v.grade < N.GRADE_START || v.grade > N.GRADE_MAX) throw new Error(`Dept.create: the carry's grade ${v.grade} is not ${N.GRADE_START}–${N.GRADE_MAX}`);
    if (!Number.isInteger(v.tier) || v.tier < 1 || v.tier > highest) throw new Error(`Dept.create: the carry's tier ${v.tier} is not 1–${highest}`);
    v.perks = (carry.perks || []).map(p => {
      if (!p || typeof p.id !== 'string' || (p.rank !== 1 && p.rank !== 2)) throw new Error(`Dept.create: the carry's perk ${JSON.stringify(p)} is not {id, rank 1 or 2}`);
      if (Registry.PERKS && !own(Registry.PERKS, p.id)) throw new Error(`Dept.create: the carry's perk ${p.id} is not in Registry.PERKS`);
      return { id: p.id, rank: p.rank };
    });
    for (let i = 0; i < v.perks.length; i++) if (v.perks.slice(0, i).some(q => q.id === v.perks[i].id)) throw new Error(`Dept.create: the carry gives the perk ${v.perks[i].id} twice`);
    v.items = (carry.items || []).map(it => {
      const rec = it && typeof it.ref === 'string' ? (pack.items || []).find(i => i.id === it.ref) : null;
      if (!rec) throw new Error(`Dept.create: the carry's item ${JSON.stringify(it)} is no item of ${pack.acc}`);
      if (!ITEM_SLOTS().includes(it.slot)) throw new Error(`Dept.create: the carry puts ${it.ref} in ${JSON.stringify(it.slot)}, not a slot (${ITEM_SLOTS().join(', ')})`);
      return { ref: it.ref, slot: it.slot };
    });
    return v;
  }

  // The items the carry puts on you or in your tote, as records Setup.carry takes: uids you.c1,
  // you.c2 … in the carry's order (§3.2), a weapon's, garment's or instrument's tier the
  // carry's (an item's tier is never the pack's, §8.1), level 0.
  function carried(pack, v) {
    return v.items.map((c, i) => {
      const rec = pack.items.find(it => it.id === c.ref), tiered = rec.kind === 'weapon' || rec.kind === 'garment' || rec.kind === 'instrument';
      return { uid: `you.c${i + 1}`, kind: rec.kind, ref: rec.id, where: c.slot === 'tote' ? { at: 'tote' } : { at: 'kit', slot: c.slot },
        form: rec.kind === 'instrument' ? rec.instrument || null : rec.form || null, tier: tiered ? v.tier : null, level: 0,
        prims: (rec.prims || []).map(p => ({ id: p.id, cls: p.cls })) };
    });
  }

  // A department visit (A10): the plan is made by Layout.generate, and each plan that passes
  // layout's checks is populated (build) and then checked by every registered validator
  // (Populate.validate); a rejection is a failed layout attempt, which reseeds up to 4 times
  // and then falls back to the certified plan, populated the same way. A plan its gallery
  // list cannot populate (Populate.exhibits) is rejected as `population`, before the
  // validators. options: Options.make's (rulesOff, without, invulnerable), and carry (above),
  // which is not kept in the state.
  const create = (seed, acc, depth, options) => generate(seed, acc, depth, options).state;

  // Dept.generate(seed, acc, depth, options): Dept.create's department with how it was made,
  // which the state does not keep: {state, attempt, fallback, tries, rejected, log, base}:
  // attempt, the layout attempt taken (k from 0; the certified fallback is attempt 5);
  // fallback, whether it was the fallback; tries, each failed attempt's failures in order
  // (layout's checks', or the one rejection, {id, why, tiles}, population's or a
  // validator's); rejected, the fallback's own rejection, which it is taken despite (null if
  // it had none, or was not reached); log, the attempt's layout log with population's and the
  // validators' lines after it; base, the attempt's stream key.
  function generate(seed, acc, depth, options) {
    const pack = Packs.get(acc);
    if (!pack) throw new Error(`Dept.create: there is no department ${acc}`);
    const v = visitor(options ? options.carry : undefined, depth, pack);
    let state = null;
    const accept = r => {
      const made = build(seed, pack, depth, options, v, r);
      state = made.state;
      return made.short ? { id: 'population', reason: made.short.reason, tiles: made.short.tiles } : Populate.validate(state, r.plan, r.log);
    };
    const out = Layout.generate(pack.programme, 0, seed, { acc, depth, accept });
    return { state, attempt: out.attempt, fallback: out.fallback, tries: out.tries, rejected: out.rejected || null, log: out.log, base: out.base };
  }

  // One layout attempt's department, in A10's order: the state, with the plan and the rooms
  // you have walked (your first, dept.walked: a department visit's only); the cases
  // (Cases.place); the exhibits (Populate.exhibits); options.without marks its actors gone,
  // then each archetype's init (Setup.settleActors); the Centrepiece (Centrepiece.place: only
  // for a pack with a gallery list, once its core is past ready false, plan A10) and its
  // lectern, a fixture on the plan's lectern tile (Viewing.place, M4's PG-VIEW); your
  // starting kit of the carry's tier (Kit.start) and the items the carry gives (Setup.carry);
  // the stand-in equipment and kits (Kit.standIn); the run's seals (Consumables.startRun);
  // the stand-in consumables (Consumables.standIn); the panels (Panels.place); the modules
  // (Modules.init); your stats (Kit.settle), so that the validators see them. Your grade, its
  // health and the grade you came in with are the carry's, and so are the run's perks. The
  // three placement calls share one local holder, pop, so a room's `${base}/room/<key>/populate`
  // stream runs on from cases to items to consumables instead of starting again for each (§3.2).
  // Returns {state, short}: short is null, or why the gallery list could not be placed here.
  function build(seed, pack, depth, options, v, r) {
    const plan = r.plan, nums = Layout.number(plan, depth), x = plan.entrance[0] + 1, y = plan.entrance[1];
    const tiles = plan.tiles.map(row => row.replace(/C/g, '.'));
    const first = plan.rooms.find(q => q.id === plan.roomOf[y][x]);
    const dept = Object.assign({ acc: pack.acc, depth, pin: plan.pin, programme: plan.programme, w: plan.w, h: plan.h, tiles, ltour: plan.ltour,
      rooms: plan.rooms.map(rm => ({ id: rm.id, key: rm.key, role: rm.role, number: nums[rm.id] || 0, x0: rm.x0, y0: rm.y0, x1: rm.x1, y1: rm.y1 })),
      roomOf: plan.roomOf, entrance: plan.entrance, exits: plan.exits, lectern: plan.lectern, viewTile: plan.viewTile, seen: '' }, Setup.deptParts(v.grade),
      { walked: first ? [first.id] : [] });
    dept.clock = Clock.init(plan.ltour);
    const state = Setup.base(seed, dept, x, y, options, v.grade);
    state.run.perks = v.perks.map(p => ({ id: p.id, rank: p.rank }));
    const pop = { seed, rng: {} };
    Cases.place(state, plan, r.base, pop);
    const short = Populate.exhibits(state, plan, pack, r.base, r.log);
    Setup.settleActors(state, 1);
    if (pack.galleries !== undefined && pack.centrepiece && Populate.ready(pack.centrepiece)) { Centrepiece.place(state, plan, pack); Viewing.place(state); }
    Kit.start(state, 'balanced', v.tier);
    Setup.carry(state, carried(pack, v));
    Kit.standIn(state, r.base, pop);
    Consumables.startRun(state);
    Consumables.standIn(state, r.base, pop);
    Panels.place(state, plan, pack);
    Modules.init(state, pack);
    Kit.settle(state);
    return { state, short };
  }

  // The rooms you have stood in this visit, by id, in the order first entered (A3: absent
  // outside a department visit, so a room for tests has none): [] there.
  const walked = state => state && state.dept && Array.isArray(state.dept.walked) ? state.dept.walked : [];
  // Record the room you stand in as walked, once: true if it is new. Only a department visit
  // keeps the list (dept.walked); anywhere else nothing changes.
  function walk(state) {
    const m = state.dept;
    if (!m || !Array.isArray(m.walked) || !m.roomOf || !m.rooms) return false;
    const you = state.actors[0], row = m.roomOf[you.y], id = row ? row[you.x] : undefined;
    if (!m.rooms.some(q => q.id === id) || m.walked.includes(id)) return false;
    m.walked.push(id);
    return true;
  }

  return { create, generate, visitor, walked, walk };
})();
