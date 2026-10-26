// ACCESSION — the death recap (BUILD.md §3.4, §8.1), owned by W2a-LABELS: what killed you,
// why it was awake, and when and how it woke, read from the killer's own story.
//
// Text.recap(state, nameOf) → null, unless you died; then {killer, wakeTurn, wakeTrigger,
// huntTurn, lines}:
//   killer       the killing cause's `by` (state.over.cause): the exhibit whose blow, shot or
//                special it was; for a bolt a reflector sent back, the reflector, which
//                `shooter` says who fired (§8.1, D2.16); null if the cause names no one;
//   wakeTurn, wakeTrigger   the turn and cause of the killer's most recent waking (its
//                `woke`: a waking out of sleep, or its making for an actor made awake);
//   huntTurn     the turn it last began hunting you (its `hunted`), or null;
//   lines        the recap in sentences, in order: who defeated you and when; the blow that
//                did it (its cause record, as the log told it); and the killer's story,
//                oldest first: for a body split from another, how that body woke first, then
//                how it split; how it woke; and when it began hunting you, if that came later.
// The story is the actor's own (woke, hunted), never the 64 cause records, so it says the
// same however much has happened since it woke (§3.4). The sentences of each waking, split
// and hunt are their causes' own (Text.event), so the recap and the log say the same thing.
'use strict';
(() => {
  const own = (o, k) => typeof k === 'string' && o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  // A sentence, its first letter made small, after "On turn N, ": every story sentence starts
  // with an actor's name, 'The …', 'A split of …' or 'You'.
  const on = (turn, s) => `On turn ${turn}, ` + (/^(The|A|You) /.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const creation = k => own(Registry.WAKE_CAUSES, k) && Registry.WAKE_CAUSES[k].creation === true;
  const same = (p, q) => JSON.stringify(p) === JSON.stringify(q);

  // The sentence for one waking of uid, as the log told it: a creation's woke (was null); a
  // waking straight into a hunt (woke, then hunting, which the log tells by the hunting
  // sentence); or a waking into awake.
  function waking(uid, woke, huntedThen, nameOf) {
    const c = woke.cause, k = c && c.k;
    if (creation(k)) return Text.event({ k: 'woke', turn: woke.turn, who: uid, was: null, mode: huntedThen ? 'hunting' : 'awake', cause: c }, nameOf);
    if (huntedThen) return Text.event({ k: 'hunting', turn: woke.turn, who: uid, was: 'dormant', cause: c }, nameOf);
    return Text.event({ k: 'woke', turn: woke.turn, who: uid, was: 'dormant', mode: 'awake', cause: c }, nameOf);
  }
  // Did a waking start a hunt? It did if the hunt began then, for the same cause; else its
  // cause says (Registry.WAKE_CAUSES[k].mode): a body split from another is made in that
  // body's mode, which is hunting, since the blow that split it made it hunt first (§8.1).
  function intoHunt(woke, hunted) {
    if (hunted && hunted.turn === woke.turn && same(hunted.cause, woke.cause)) return true;
    const k = woke.cause && woke.cause.k, W = own(Registry.WAKE_CAUSES, k) ? Registry.WAKE_CAUSES[k] : null;
    if (!W) return false;
    return W.mode === 'parent' ? woke.cause.how === 'split' : W.mode === 'hunting';
  }

  // The killer's story, oldest first: a split body's ancestors' wakings (cause.parent, the
  // copy of the body's own waking that a split keeps, §8.1), then its own waking, then its hunt.
  function story(a, nameOf) {
    const out = [];
    if (!a.woke) { out.push(`${cap(name(a.uid, nameOf))} had not woken.`); return out; }
    const chain = [];
    for (let c = a.woke.cause, k = 0; c && c.k === 'summoned' && c.parent && typeof c.from === 'string' && k < 8; k++) {
      chain.unshift({ uid: c.from, woke: c.parent });
      c = c.parent.cause;
    }
    for (const p of chain) {
      const s = waking(p.uid, p.woke, intoHunt(p.woke, null), nameOf);
      if (s) out.push(on(p.woke.turn, s));
    }
    const hunts = intoHunt(a.woke, a.hunted), s = waking(a.uid, a.woke, hunts, nameOf);
    if (s) out.push(on(a.woke.turn, s));
    const h = a.hunted;
    if (h && !(h.turn === a.woke.turn && hunts)) {
      const t = Text.event({ k: 'hunting', turn: h.turn, who: a.uid, was: 'awake', cause: h.cause }, nameOf);
      if (t) out.push(on(h.turn, t));
    }
    return out;
  }
  // The words for an actor, as Text.event's sentences use them.
  const name = (uid, nameOf) => uid === 'you' ? 'you' : (typeof nameOf === 'function' && nameOf(uid)) || 'the training dummy';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function recap(state, nameOf) {
    const over = state && state.over;
    if (!over || over.k !== 'died') return null;
    if (typeof nameOf !== 'function' && typeof Labels !== 'undefined') nameOf = Labels.nameOf(state);
    const cause = over.cause || {}, by = typeof cause.by === 'string' ? cause.by : typeof over.by === 'string' ? over.by : null;
    const a = by && by !== 'you' ? Actors.byUid(state, by) : null;
    const out = { killer: by, wakeTurn: a && a.woke ? a.woke.turn : null, wakeTrigger: a && a.woke && a.woke.cause ? a.woke.cause.k : null,
      huntTurn: a && a.hunted ? a.hunted.turn : null, lines: [] };
    out.lines.push(a ? `${cap(name(a.uid, nameOf))} defeated you on turn ${over.turn}.` : `You fell on turn ${over.turn}.`);
    // The blow that did it: the newest damage to you in the cause records (damaged is
    // recorded, and the visit ends at your death, so it is the killing one).
    for (let i = state.causes.length - 1; i >= 0; i--) {
      const r = state.causes[i];
      if (r.k === 'damaged' && r.who === 'you') { const s = Text.event(r, nameOf); if (s) out.lines.push(s); break; }
    }
    if (a) out.lines.push(...story(a, nameOf));
    return out;
  }
  Text.provide('recap', recap);
})();
