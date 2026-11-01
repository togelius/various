// ACCESSION — Certificates, the grade and the perk offer (BUILD.md §8.7), and the visitor of a
// single visit (§5.5). Dept.create reads median; a Centrepiece's fall, a completed view and the
// Lamp carried out of its hall call award (ARCH-CP-CORE, PG-VIEW, the S.9 treasure).
//
// The parts it owns are absent from a state until it first writes them (§4.1; M4 plan A3), and
// read through its accessors: dept.cert {how, turn}, this visit's Certificate (Progress.cert),
// and dept.offer [{id, rank}], a perk offer waiting behind another choice (Progress.waiting).
// The Certificates of the run are run.certificates [{acc, depth, how, turn}], and the perks you
// hold run.perks [{id, rank}], in the order you took them.
//
// In a single visit (M4; §5.5) what a Certificate gives lasts for the rest of that visit: the
// visit is made for its own visitor (the carry), and "Another visit" starts from that visitor
// again; carrying the grade and the perks from visit to visit is M5's run.
'use strict';
const Progress = (() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const HOW = ['defeat', 'view', 'treasure'];

  // The visitor of a single visit at depth d (BUILD.md §5.5; M4 plan A2), the visitor
  // MEDIAN_MAX_HP and the M3 arenas assume (Arena.gradeAt): grade GRADE_START + d − 1, at most
  // GRADE_MAX, with that grade's health; a Balanced weapon and a Standard garment of the lower
  // tier on offer at d (TIER_LOW_BY_DEPTH); no perks and no items. At depth 1 it is the
  // visitor at a run's start. A fresh record each call. {grade, perks, tier, items}.
  function median(depth) {
    if (!Number.isInteger(depth) || depth < 1 || depth > N.TIER_LOW_BY_DEPTH.length) throw new Error(`Progress.median: there is no depth ${depth} (1–${N.TIER_LOW_BY_DEPTH.length})`);
    return { grade: Math.min(N.GRADE_MAX, N.GRADE_START + depth - 1), perks: [], tier: N.TIER_LOW_BY_DEPTH[depth - 1], items: [] };
  }

  // ---- The offer (§8.7) ----

  // A perk's family (Registry.PERKS), which must be one of PerkFamilies.WITH_PERKS.
  function family(id) {
    const f = Registry.PERKS[id].family;
    if (!PerkFamilies.WITH_PERKS.includes(f)) throw new Error(`Progress.offer: the perk ${id} has the family ${JSON.stringify(f)}, which is not one of ${PerkFamilies.WITH_PERKS.join(', ')}`);
    return f;
  }
  // The department's challenge claim (its pack's card): {primary, secondary}, each a family or
  // null. A room that is no department (a test room, the Orientation) claims none.
  function claim(state) {
    const pack = state.dept && typeof state.dept.acc === 'string' ? Packs.get(state.dept.acc) : null, c = pack && pack.claim;
    return { primary: c && typeof c.primary === 'string' ? c.primary : null, secondary: c && typeof c.secondary === 'string' ? c.secondary : null };
  }
  // A slot's families in the order it tries them: its own family, or, when that has no slice
  // perks (or is none), attrition, then guarded; then the department's other family the same
  // way; then any family, in §8.7's table order; each once.
  function chain(mine, other) {
    const expand = f => PerkFamilies.WITH_PERKS.includes(f) ? [f] : PerkFamilies.STAND_IN.slice();
    const out = [];
    for (const f of expand(mine).concat(expand(other), PerkFamilies.WITH_PERKS)) if (!out.includes(f)) out.push(f);
    return out;
  }

  // Progress.offer(state) → [{id, rank}]: the perks a Certificate earned now would offer, from
  // the perks you hold now (§8.7). A perk may be offered while you do not hold it at
  // Perks.MAX_RANK, at the rank above yours, and once in an offer.
  //   1. The slots: PERK_OFFER[0] for the department's primary family, then PERK_OFFER[1] for
  //      its secondary. Each in turn goes to the first family of its chain (above) that still
  //      has a perk to offer once the slots before it have had theirs; a slot with nothing left
  //      anywhere stays empty, so the offer has min(3, the perks with a rank left) perks, and
  //      none when every perk is held at its highest rank.
  //   2. The perks: a family given k slots offers its perks you hold (at rank 1) first ("a
  //      perk you hold offered at rank 2 where possible"), then those you do not. Where a group
  //      has more perks than the slots left for it, those offered are drawn on
  //      perks/<acc>/d<depth>, a local stream (§3.2), one pick at a time; a family with no
  //      more perks than slots draws nothing (A.4's and M.11's primaries, every secondary in
  //      the slice). The family's perks fill its slots in §8.7's table order.
  // So the same seed, department, depth and perks held give the same offer. It reads the state
  // and changes nothing.
  function offer(state) {
    const ids = Registry.order('PERKS'), c = claim(state);
    for (const id of ids) family(id);
    const left = id => Perks.rank(state, id) < Perks.MAX_RANK;
    // 1. Each slot's family.
    const chains = [];
    for (let i = 0; i < N.PERK_OFFER[0]; i++) chains.push(chain(c.primary, c.secondary));
    for (let i = 0; i < N.PERK_OFFER[1]; i++) chains.push(chain(c.secondary, c.primary));
    const room = {}, slotFam = [];
    for (const f of PerkFamilies.WITH_PERKS) room[f] = ids.filter(id => family(id) === f && left(id)).length;
    for (const fams of chains) {
      const f = fams.find(g => room[g] > 0);
      if (f === undefined) continue;
      room[f]--;
      slotFam.push(f);
    }
    // 2. Each family's perks, in table order.
    let rng = null;
    const draw = (pool, k) => {
      if (k <= 0) return [];
      if (pool.length <= k) return pool.slice();
      if (!rng) rng = Rng.stream({ seed: state.seed, rng: {} }, `perks/${state.dept.acc}/d${state.dept.depth || 1}`);
      const rest = pool.slice(), got = [];
      while (got.length < k) got.push(rest.splice(rng.int(0, rest.length - 1), 1)[0]);
      return got;
    };
    const chosen = {};
    for (const f of PerkFamilies.WITH_PERKS) {
      const k = slotFam.filter(g => g === f).length;
      if (!k) continue;
      const can = ids.filter(id => family(id) === f && left(id)), held = can.filter(id => Perks.rank(state, id) > 0), not = can.filter(id => Perks.rank(state, id) === 0);
      const got = draw(held, k), more = draw(not, k - got.length);
      chosen[f] = ids.filter(id => got.includes(id) || more.includes(id));
    }
    return slotFam.map(f => { const id = chosen[f].shift(); return { id, rank: Perks.rank(state, id) + 1 }; });
  }

  // The perk offer waiting behind another choice (dept.offer), or [] with none waiting.
  const waiting = state => state && state.dept && Array.isArray(state.dept.offer) ? state.dept.offer.map(o => ({ id: o.id, rank: o.rank })) : [];

  // Make the offer (§8.7; M4 plan D4.12, D4.13). With no perk to offer, none is given and the
  // log says so (perk, cause none), and no choice waits. Otherwise the offer, of one, two or
  // three perks as it is, waits for your answer (ui.pendingChoice {k: 'perk', options}), or,
  // while another choice is waiting (a Catalogue Card's seal), waits behind it in dept.offer
  // until afterChoice raises it.
  function make(state, ev) {
    const options = offer(state);
    if (!options.length) { Causes.emit(state, ev, 'perk', {}, { k: 'none' }); return; }
    if (state.ui.pendingChoice) state.dept.offer = options;
    else state.ui.pendingChoice = { k: 'perk', options };
  }

  // ---- The Certificate (§8.7) ----

  // Progress.award(state, how, cause, ev) → bool: the department's Certificate, earned by `how`
  // ('defeat', 'view' or 'treasure'; cause is the certificate event's cause, whose k is how:
  // {k: 'defeat', by}, {k: 'view'}, {k: 'treasure'}). Once a visit: with this visit's
  // Certificate already earned, or the visit over, it gives nothing and returns false.
  // Otherwise, in this order, each with its event:
  //   1. the Certificate (certificate {acc, how}): dept.cert {how, turn}, and the run's record
  //      {acc, depth, how, turn} in run.certificates;
  //   2. your grade one higher (grade, cause certificate), and your maximum health HP_PER_GRADE
  //      higher; at GRADE_MAX neither changes (grade, cause highest);
  //   3. CERT_HEAL health back (healed, cause certificate), up to the maximum just raised, so
  //      "+5 max HP, and heals 5" gives 28 of 30 health 33 of 35; nothing at full health;
  //   4. the perk offer (make, above).
  // Your derived stats follow your grade once your action's ticks are done (Kit.settle, §8.1).
  function award(state, how, cause, ev) {
    if (!HOW.includes(how)) throw new Error(`Progress.award: a Certificate is earned by ${HOW.join(', ')}, not ${JSON.stringify(how)}`);
    if (!cause || cause.k !== how) throw new Error(`Progress.award: a Certificate earned by ${how} needs the cause {k: '${how}'}, not ${JSON.stringify(cause)}`);
    const m = state.dept, you = state.actors[0];
    if (state.over || !you || you.gone || cert(state)) return false;
    m.cert = { how, turn: state.turn };
    state.run.certificates.push({ acc: m.acc, depth: m.depth, how, turn: state.turn });
    Causes.emit(state, ev, 'certificate', { acc: m.acc, how }, cause);
    if (state.run.grade < N.GRADE_MAX) {
      state.run.grade++;
      you.maxHp += N.HP_PER_GRADE;
      Causes.emit(state, ev, 'grade', { grade: state.run.grade }, { k: 'certificate' });
    } else Causes.emit(state, ev, 'grade', { grade: state.run.grade }, { k: 'highest' });
    Health.heal(state, you, N.CERT_HEAL, { k: 'certificate' }, ev);
    make(state, ev);
    return true;
  }

  // The perk choice (§4.2): the perk at index is yours, at the rank offered (one above the rank
  // you hold it at, which goes up in place; a perk new to you joins the end of run.perks), with
  // the perk event (cause chosen). It costs no time. An option that is not a perk at the rank
  // above yours is refused choice_bad, and the choice still waits.
  Actions.defineChoice('perk', (state, index, ev) => {
    const o = state.ui.pendingChoice.options[index];
    if (!o || !own(Registry.PERKS, o.id) || !Number.isInteger(o.rank) || o.rank !== Perks.rank(state, o.id) + 1 || o.rank > Perks.MAX_RANK) return 'choice_bad';
    const held = state.run.perks.find(p => p.id === o.id);
    if (held) held.rank = o.rank;
    else state.run.perks.push({ id: o.id, rank: o.rank });
    Causes.emit(state, ev, 'perk', { id: o.id, rank: o.rank }, { k: 'chosen' });
    return 0;
  });

  // Progress.afterChoice(state, ev): once a choice is answered and none is left waiting
  // (Actions' choose), the perk offer that waited behind it (dept.offer) is raised as the
  // choice now waiting, and dept.offer is absent again. With none waiting, nothing happens.
  function afterChoice(state, ev) {
    const m = state.dept;
    if (!m || !Array.isArray(m.offer) || state.over || (state.ui && state.ui.pendingChoice)) return;
    const options = m.offer;
    delete m.offer;
    state.ui.pendingChoice = { k: 'perk', options };
  }

  // This visit's Certificate, {how, turn}, or null before one is earned (dept.cert, absent
  // until award writes it, M4 plan A3).
  function cert(state) { return state && state.dept && state.dept.cert ? state.dept.cert : null; }

  return { median, award, afterChoice, offer, cert, waiting };
})();
