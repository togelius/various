// ACCESSION — the invariants of Certificates, the grade and the perk offer (BUILD.md §8.7), held
// after every step of every scenario, monkey, soak and bot run (tools/invariants.js). Each is
// what js/core/rules/progress.js promises, read back from the state before and after the step
// and the step's events, never from the rule code:
//   certificate_once     a Certificate is earned at most once a visit: one certificate event
//                        at most, never when the visit already has one; with it, dept.cert
//                        {how, turn} and one more run.certificates record {acc, depth, how,
//                        turn}, all agreeing with the event; without it, neither changes;
//   grade_and_health     your grade and maximum health change only with a Certificate: its
//                        grade event (after the certificate event) raises the grade by one and
//                        your maximum health by HP_PER_GRADE, never past GRADE_MAX, where the
//                        event says it stays (cause highest) and nothing changes; then its heal
//                        (healed, cause certificate, after the grade event) gives CERT_HEAL, or
//                        what takes you to your maximum; then, if no perk can be offered, the
//                        perk event with cause none, last;
//   offer_valid          a perk choice waiting, or an offer waiting behind another choice
//                        (dept.offer), holds one to three perks (PERK_OFFER's slots), each once, each a perk of
//                        Registry.PERKS at the rank above the one you hold; an offer waits in
//                        dept.offer only while another kind of choice is waiting; an offer made
//                        in the step holds min(3, the perks with a rank left), and a perk you do
//                        not hold is offered from a family only once every perk of that family
//                        you hold at rank 1 is offered; no perk is offered (cause none) only
//                        when every perk is held at its highest rank;
//   choice_answerable    a choice waiting always has an answer you may give (Step.legal is not
//                        empty), so no choice ever locks the visit;
//   perk_taken           the perks you hold change only by a perk you chose (perk, cause
//                        chosen, by a choose action): that perk one rank higher, or new at rank
//                        1 at the end, everything else as it was.
'use strict';
module.exports = (C) => {
  const { N, Registry: R, Perks, Step } = C;
  const json = x => JSON.stringify(x);
  const HOW = ['defeat', 'view', 'treasure'];
  // The slots of an offer (PERK_OFFER: the primary family's, then the secondary's).
  const SLOTS = N.PERK_OFFER[0] + N.PERK_OFFER[1];
  const at = (events, pred) => events.findIndex(pred);
  const isCert = e => e.k === 'certificate';
  const rankIn = (perks, id) => { for (const p of perks || []) if (p.id === id) return p.rank; return 0; };

  const certificateOnce = {
    id: 'certificate_once',
    check(pre, events, post) {
      const certs = events.filter(isCert), had = pre.dept.cert || null, has = post.dept.cert || null;
      const n0 = pre.run.certificates.length, n1 = post.run.certificates.length;
      if (certs.length > 1) return `${certs.length} Certificates were earned in one step`;
      if (had && json(had) !== json(has)) return `the visit's Certificate changed from ${json(had)} to ${json(has)}`;
      if (!certs.length) {
        if (!had && has) return `the visit has a Certificate ${json(has)} with no certificate event`;
        if (n1 !== n0) return `run.certificates went from ${n0} to ${n1} records with no certificate event`;
        return null;
      }
      const e = certs[0];
      if (had) return 'a second Certificate was earned in one visit';
      if (!HOW.includes(e.how) || !e.cause || e.cause.k !== e.how) return `a Certificate earned by ${json(e.how)} with the cause ${json(e.cause)}`;
      if (e.acc !== post.dept.acc) return `the Certificate names ${e.acc}, in ${post.dept.acc}`;
      if (!has || has.how !== e.how || has.turn !== e.turn) return `the visit's Certificate is ${json(has)}, after a certificate event of ${e.how} at turn ${e.turn}`;
      if (n1 !== n0 + 1) return `run.certificates went from ${n0} to ${n1} records with one Certificate`;
      const rec = post.run.certificates[n1 - 1];
      if (json(rec) !== json({ acc: post.dept.acc, depth: post.dept.depth, how: e.how, turn: e.turn })) return `the run's record of the Certificate is ${json(rec)}`;
      return null;
    },
  };

  const gradeAndHealth = {
    id: 'grade_and_health',
    check(pre, events, post) {
      const g0 = pre.run.grade, g1 = post.run.grade, you0 = pre.actors[0], you1 = post.actors[0];
      const ci = at(events, isCert), grades = events.filter(e => e.k === 'grade');
      const heals = events.filter(e => e.k === 'healed' && e.cause && e.cause.k === 'certificate');
      if (g1 > N.GRADE_MAX) return `your grade is ${g1}, past ${N.GRADE_MAX}`;
      if (ci < 0) {
        if (grades.length) return `a grade event with no Certificate: ${json(grades[0])}`;
        if (heals.length) return 'a Certificate\'s heal with no Certificate';
        if (g1 !== g0) return `your grade went from ${g0} to ${g1} with no Certificate`;
        if (you1.maxHp !== you0.maxHp) return `your maximum health went from ${you0.maxHp} to ${you1.maxHp} with no Certificate`;
        return null;
      }
      if (grades.length !== 1) return `a Certificate with ${grades.length} grade events`;
      const gi = at(events, e => e.k === 'grade'), g = events[gi];
      if (gi < ci) return 'the grade event came before the Certificate';
      if (g.cause.k === 'certificate') {
        if (g0 >= N.GRADE_MAX) return `a Certificate raised your grade past ${N.GRADE_MAX}`;
        if (g1 !== g0 + 1 || g.grade !== g1) return `a Certificate took your grade from ${g0} to ${g1}, its event saying ${g.grade}`;
        if (you1.maxHp !== you0.maxHp + N.HP_PER_GRADE) return `a Certificate took your maximum health from ${you0.maxHp} to ${you1.maxHp}, not ${N.HP_PER_GRADE} more`;
      } else if (g.cause.k === 'highest') {
        if (g0 !== N.GRADE_MAX || g1 !== g0 || g.grade !== g0) return `a grade that stays (cause highest) at ${g.grade}, from ${g0} to ${g1}`;
        if (you1.maxHp !== you0.maxHp) return `your maximum health changed at grade ${g0}, its highest`;
      } else return `a Certificate's grade event has the cause ${g.cause.k}`;
      if (heals.length > 1) return `${heals.length} Certificate heals in one step`;
      if (heals.length) {
        const h = heals[0], hi = events.indexOf(h);
        if (hi < gi) return 'the Certificate healed you before your maximum health rose';
        if (h.who !== 'you') return `the Certificate healed ${h.who}`;
        if (h.amount !== N.CERT_HEAL && h.hp !== you1.maxHp) return `the Certificate healed ${h.amount}, to ${h.hp} of ${you1.maxHp}`;
        if (h.amount > N.CERT_HEAL) return `the Certificate healed ${h.amount}, more than ${N.CERT_HEAL}`;
      }
      const ni = at(events, e => e.k === 'perk' && e.cause && e.cause.k === 'none');
      if (ni >= 0 && (ni < gi || (heals.length && ni < events.indexOf(heals[0])))) return 'no perk was offered before the Certificate\'s grade and heal';
      return null;
    },
  };

  // An offer's options, checked against the perks you hold in post: the problem, or null.
  function badOptions(post, options, where) {
    if (!Array.isArray(options) || options.length < 1 || options.length > SLOTS) return `${where} holds ${json(options)}, not one to ${SLOTS} perks`;
    const seen = [];
    for (const o of options) {
      if (!o || typeof o.id !== 'string' || !Object.prototype.hasOwnProperty.call(R.PERKS, o.id)) return `${where} holds ${json(o)}, not a perk`;
      if (seen.includes(o.id)) return `${where} holds ${o.id} twice`;
      seen.push(o.id);
      const held = Perks.rank(post, o.id);
      if (o.rank !== held + 1 || o.rank > Perks.MAX_RANK) return `${where} holds ${o.id} at rank ${o.rank}, which you hold at ${held}`;
    }
    return null;
  }
  const offerValid = {
    id: 'offer_valid',
    check(pre, events, post) {
      const p = post.ui && post.ui.pendingChoice, waits = post.dept.offer;
      if (p && p.k === 'perk') { const bad = badOptions(post, p.options, 'the perk choice'); if (bad) return bad; }
      if (waits !== undefined) {
        const bad = badOptions(post, waits, 'the offer waiting');
        if (bad) return bad;
        if (!p || p.k === 'perk') return `an offer waits in dept.offer behind ${p ? 'a perk choice' : 'no choice'}`;
      }
      if (at(events, isCert) < 0) return null;
      const ids = R.order('PERKS'), withRank = ids.filter(id => Perks.rank(post, id) < Perks.MAX_RANK);
      const none = events.filter(e => e.k === 'perk' && e.cause && e.cause.k === 'none');
      const made = waits !== undefined ? waits : p && p.k === 'perk' ? p.options : null;
      if (none.length) {
        if (made) return 'no perk was offered, and an offer waits';
        if (withRank.length) return `no perk was offered, though ${withRank.join(', ')} ${withRank.length === 1 ? 'has' : 'have'} a rank left`;
        return null;
      }
      if (!made) return 'a Certificate made no offer and did not say so';
      if (made.length !== Math.min(SLOTS, withRank.length)) return `an offer of ${made.length} perks, with ${withRank.length} perks with a rank left`;
      for (const o of made) {
        if (Perks.rank(post, o.id) > 0) continue;
        const fam = R.PERKS[o.id].family, missed = ids.filter(id => R.PERKS[id].family === fam && Perks.rank(post, id) === 1 && !made.some(m => m.id === id));
        if (missed.length) return `${o.id} is offered at rank 1 while ${missed.join(', ')}, of its family ${fam}, held at rank 1, is not offered`;
      }
      return null;
    },
  };

  const choiceAnswerable = {
    id: 'choice_answerable',
    check(pre, events, post) {
      if (post.over || !post.ui || !post.ui.pendingChoice) return null;
      return Step.legal(post).length ? null : `the ${post.ui.pendingChoice.k} choice waiting has no answer you may give`;
    },
  };

  const perkTaken = {
    id: 'perk_taken',
    check(pre, events, post, ctx) {
      const before = pre.run.perks || [], after = post.run.perks || [], chosen = events.filter(e => e.k === 'perk' && e.cause && e.cause.k === 'chosen');
      if (!chosen.length) return json(before) === json(after) ? null : `the perks you hold went from ${json(before)} to ${json(after)} with no perk chosen`;
      if (chosen.length > 1) return `${chosen.length} perks chosen in one step`;
      if (!ctx.action || ctx.action.a !== 'choose') return `a perk was chosen by ${json(ctx.action)}`;
      const e = chosen[0], was = rankIn(before, e.id);
      if (e.rank !== was + 1 || e.rank > Perks.MAX_RANK) return `${e.id} was chosen at rank ${e.rank}, held at ${was}`;
      const want = was ? before.map(q => q.id === e.id ? { id: q.id, rank: e.rank } : q) : before.concat([{ id: e.id, rank: e.rank }]);
      return json(want) === json(after) ? null : `choosing ${e.id} at rank ${e.rank} took the perks you hold from ${json(before)} to ${json(after)}`;
    },
  };

  return [certificateOnce, gradeAndHealth, offerValid, choiceAnswerable, perkTaken];
};
