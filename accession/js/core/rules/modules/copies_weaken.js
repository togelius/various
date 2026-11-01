// ACCESSION — the module copies_weaken (A.4; BUILD.md §5.4): "When an original is destroyed, its
// spares lose heart." Its rules register here with Modules.define (rules/modules.js) in the
// form of §5.4. It has no archetype of its own: its groups are copy groups of exhibits (§4.1),
// and CopiesWeaken.addGroup lets a Centrepiece make its pieces one, so this module needs no
// Centrepiece package. Its entries are in js/core/reg/mod-copies.js and its sentences in
// js/core/text/mod-copies.js. Owned by MOD-COPIES.
//
// The rule (§5.4; M4 plan MO5, D1.4–D1.5), as the line of each exhibit it acts on says it:
// "When its group's original is destroyed, each spare loses {COPY_WEAKEN_PCT}% of its health
// and damage, never its last point (blows then {weak}), and {COPY_WEAKEN_ACC} Acc, and is
// slowed until you leave." A spare's split bodies are the spare (below), so "each spare" is
// each of its bodies; the panel sentence says so in full.
//   - A copy group is an original and its spares. Population makes them (§4.1, plan DE5): a
//     spare is an exhibit whose species copies another of its pack (copyOf), and its original
//     is the exhibit of its group instance (actor.group, `<group>@<roomKey>`: one a room, the
//     stamp's `clerks@intro` among them) whose species is the one it copies, the first of
//     them made. A Centrepiece names its own with CopiesWeaken.addGroup (below).
//   - A body split from another (a splitter's half, §8.1) is the same exhibit: its uid is
//     `<body uid>/<k>`, so every body of a line shares its first body's uid up to the first
//     slash, and a body is a spare, or an original, as that first body is.
//   - The rule acts on a group of species only while both the spare's species and its
//     original's are flagged with the module (§5.2: flags, the modules whose rules a species
//     takes part in), so that every exhibit it acts on, and the one whose fall moves it, has
//     a line that says so (the module's part, §5.3); a group a Centrepiece names takes part
//     whatever its flags, since the Centrepiece's own line says it (its package's words).
//   - `weaken` (on `died`): an original falls when the last body of its line is destroyed (a
//     splitting original falls with its last body). Then each body present that copies it and
//     takes part (each spare and any body split from one, in spawn order) loses heart: its
//     module event {rule: 'weaken', who}, its cause naming the original (by: the uid of its
//     first body), so the log tells an original's spares in one line; then the `tier` effect
//     (its maximum and current health and its damage each lose COPY_WEAKEN_PCT% of
//     themselves, at least 1 and never below 1, and COPY_WEAKEN_ACC Acc) and the `status`
//     effect (slowed for the rest of the visit, Status.apply with 'perm'; its cause the
//     module's, by the original). A weakening never destroys a body.
//   - `split` (on `woke`, a body made by a split): a body split, after its original fell,
//     from a body that lost heart was made with that body's weakened numbers (the splitter
//     copies them) but with no statuses (§8.1), so it is slowed for the rest of the visit too:
//     its module event {rule: 'split', who}, then the `status` effect. Its numbers are not
//     weakened again. The body it split from tells whether it lost heart: one that did holds
//     slowed for the rest of the visit, which nothing else gives an exhibit (a half starts
//     with no statuses, and no rule takes a status off an exhibit). An original gone without
//     being destroyed (options.without, a dust sheet) never fell, so its spares never lost
//     heart, and a body split from one is not slowed (its line's "destroyed" never happened).
// With the module off (rulesOff, or a visit without it) none of this happens: an original's
// fall changes nothing (and no line carries the module's part).
//
// Bespoke (plan A7, MO18; Modules.bespoke): nothing. Both rules are the form's (two effects of
// its closed table), which is the evidence MO18 expected: copies fit the form.
//
// CopiesWeaken, for a Centrepiece, the labels, the view model and the tests:
//   CopiesWeaken.addGroup(state, {orig, spares}) the exhibit orig (a uid) is the original of the
//                                         exhibits spares ([uid…]): each spare's ax.copyOf
//                                         names it (M4 plan A3: absent until written). Each is
//                                         an exhibit of the state, a first body (no split), no
//                                         spare already, and an original is no spare; anything
//                                         else throws. It can be called at any time, before
//                                         the module's state is made too (a Centrepiece is
//                                         placed before Modules.init, plan A10), and with the
//                                         module off it is only data.
//   CopiesWeaken.originalOf(state, a) → uid | null   the original body a copies (the uid of
//                                         its line's first body), or null for no spare
//   CopiesWeaken.fallen(state, uid) → bool       every body of uid's line is gone
//   CopiesWeaken.spares(state, uid) → [actor]    the bodies present (not gone) that copy uid
//                                         and that the rule acts on, in spawn order
//   CopiesWeaken.of(state) → the module's state while it is on, or null
'use strict';
const CopiesWeaken = (() => {
  const ID = 'copies_weaken';

  // The module's state while it is on, or null (absent from the visit, or switched off).
  const of = state => Modules.on(state, ID) ? Modules.of(state, ID) : null;
  const find = (state, uid) => { for (const b of state.actors) if (b.uid === uid) return b; return null; };
  // A line of bodies (§3.2): a body split from another has the uid <its body's uid>/<k>, so a
  // line's first body is the uid up to the first slash, and its bodies are those whose uid is
  // that or begins with it and a slash.
  const firstOf = uid => uid.split('/')[0];
  const ofLine = (b, uid) => b.uid === uid || b.uid.startsWith(uid + '/');
  const isExhibit = b => !!b && typeof b.uid === 'string' && b.uid !== 'you';

  // Has the original whose first body is uid fallen: is every body of its line gone?
  function fallen(state, uid) {
    let any = false;
    for (const b of state.actors) {
      if (!ofLine(b, uid)) continue;
      if (!b.gone) return false;
      any = true;
    }
    return any;
  }

  // The original a body copies, as its first body's uid, or null: the copy a Centrepiece named
  // (ax.copyOf of its line's first body), or else, when that body's species copies another
  // (copyOf), the first exhibit of its group instance whose species is that one.
  function originalOf(state, a) {
    if (!isExhibit(a)) return null;
    const first = find(state, firstOf(a.uid));
    if (!first) return null;
    if (first.ax && typeof first.ax.copyOf === 'string') return first.ax.copyOf;
    const sp = Packs.speciesFor(state, first);
    if (!sp || typeof sp.copyOf !== 'string' || typeof first.group !== 'string') return null;
    for (const b of state.actors) if (isExhibit(b) && b.group === first.group && b.sp === sp.copyOf && firstOf(b.uid) === b.uid) return b.uid;
    return null;
  }

  // Does the rule act on body b, which copies the original uid: the module on, and the group a
  // Centrepiece's, or both b's species and the original's flagged with the module.
  function takesPart(state, b, uid) {
    if (!Modules.on(state, ID)) return false;
    const first = find(state, firstOf(b.uid)), o = find(state, uid);
    if (first && first.ax && typeof first.ax.copyOf === 'string') return true;
    return !!o && Modules.flagged(state, b, ID) && Modules.flagged(state, o, ID);
  }

  // The bodies present that copy the original uid and that the rule acts on, in spawn order.
  const spares = (state, uid) => state.actors.filter(b => isExhibit(b) && !b.gone && originalOf(state, b) === uid && takesPart(state, b, uid));

  // addGroup(state, {orig, spares}): a Centrepiece's copy group (above).
  function addGroup(state, group) {
    const bad = why => { throw new Error(`CopiesWeaken.addGroup: ${why}`); };
    if (!state || !Array.isArray(state.actors)) bad('it needs a state');
    if (!group || typeof group !== 'object' || Array.isArray(group)) bad(`a group is {orig, spares}, not ${JSON.stringify(group)}`);
    for (const k of Object.keys(group)) if (k !== 'orig' && k !== 'spares') bad(`a group is {orig, spares}: it has no ${k}`);
    const exhibit = uid => {
      const b = typeof uid === 'string' && uid !== 'you' ? find(state, uid) : null;
      if (!b) bad(`${JSON.stringify(uid)} is no exhibit of the state`);
      if (firstOf(uid) !== uid) bad(`${uid} is a body split from another, not an exhibit as it was made`);
      return b;
    };
    const o = exhibit(group.orig);
    if (originalOf(state, o) !== null) bad(`the original ${o.uid} is itself a spare of ${originalOf(state, o)}`);
    if (!Array.isArray(group.spares) || !group.spares.length) bad('a group needs one spare or more (spares)');
    const list = [];
    for (const uid of group.spares) {
      const b = exhibit(uid);
      if (uid === o.uid || list.includes(uid)) bad(`${uid} is named twice in the group`);
      const was = originalOf(state, b);
      if (was !== null) bad(`${uid} is already a spare of ${was}`);
      if (state.actors.some(c => isExhibit(c) && originalOf(state, c) === uid)) bad(`${uid} is an original, with spares of its own`);
      list.push(uid);
    }
    for (const uid of list) {
      const b = find(state, uid);
      if (!b.ax || typeof b.ax !== 'object' || Array.isArray(b.ax)) b.ax = {};
      b.ax.copyOf = o.uid;
    }
  }

  // The original a weakening is for: the first body of the line one of whose bodies died.
  const byDeath = (state, e) => ({ by: firstOf(e.who) });
  const slowed = { k: 'status', id: 'slowed', turns: 'perm' };

  Modules.define(ID, {
    rules: [
      // An original fell: the last body of its line was destroyed. Each body that copies it,
      // and that the rule acts on, loses heart.
      { rule: 'weaken', on: 'died',
        who: (state, e) => typeof e.who === 'string' && e.who !== 'you' && fallen(state, firstOf(e.who)) ? spares(state, firstOf(e.who)) : [],
        cause: byDeath,
        do: [{ k: 'tier', pct: N.COPY_WEAKEN_PCT, acc: N.COPY_WEAKEN_ACC }, Object.assign({ cause: (state, e) => Object.assign({ k: ID }, byDeath(state, e)) }, slowed)] },
      // A body split from one that had lost heart (it holds slowed for the rest of the visit,
      // above): made with its weakened numbers, it is slowed too.
      { rule: 'split', on: 'woke',
        who(state, e) {
          if (!e.cause || e.cause.k !== 'summoned' || e.cause.how !== 'split' || typeof e.who !== 'string' || typeof e.cause.from !== 'string') return [];
          const a = find(state, e.who), from = find(state, e.cause.from), uid = a && !a.gone ? originalOf(state, a) : null;
          return uid !== null && fallen(state, uid) && !!from && Status.perm(from, 'slowed') && takesPart(state, a, uid) ? [a] : [];
        },
        cause: (state, e, m, a) => ({ by: originalOf(state, a) }),
        do: [Object.assign({ cause: (state, e, m, a) => ({ k: ID, by: originalOf(state, a) }) }, slowed)] },
    ],
    bespoke: [],
  });

  return { addGroup, originalOf, fallen, spares, of };
})();
