// ACCESSION — invariants of copies_weaken, the weakened spares (BUILD.md §5.3 check 1, §5.4;
// MOD-COPIES), checked after every step of every scenario, monkey, soak and bot run
// (tools/invariants.js). Each states a part of the module's clause, "When its group's original
// is destroyed, each spare and any body split from one loses {COPY_WEAKEN_PCT}% of its health
// and damage, never its last point (blows then {weak}), and {COPY_WEAKEN_ACC} Acc, and is
// slowed until you leave", written out again here from the clause and §5.4, not from the rule
// code:
//   copies.when      the module's events come only while it is on, and a spare loses heart
//                    only once the last body of its original's line has been destroyed, in
//                    this step, before it is told: no earlier (a splitting original falls with
//                    its last body), and only a spare of that original whose line says so;
//   copies.all       when an original falls, every body then present that copies it and whose
//                    line says so loses heart, at once: each spare and each body split from
//                    one, once each; and a body split from one later is slowed too;
//   copies.loss      a body that loses heart loses COPY_WEAKEN_PCT% of its maximum health and
//                    of each end of its damage (at least 1, never below 1) and COPY_WEAKEN_ACC
//                    Acc, and is slowed for the rest of the visit, its slowing's cause naming
//                    its original; a body split from it afterwards keeps its numbers, weakened
//                    once, not again, and is slowed for the rest of the visit too.
// Who copies whom is read from the state as §4.1 gives it: a body's line is its uid up to the
// first slash (a half's uid is <body uid>/<k>); a line's first body copies the exhibit its
// ax.copyOf names (a Centrepiece's group), or else, when its species copies another
// (copyOf), the first exhibit of its group instance (actor.group) of that species. Its line
// says so when the module is on and both species are flagged with it (a Centrepiece's group,
// always).
'use strict';
module.exports = (C) => {
  const { N, Int, Packs, Modules } = C;
  const ID = 'copies_weaken';
  const firstOf = uid => String(uid).split('/')[0];
  const find = (state, uid) => state.actors.find(b => b.uid === uid) || null;
  const lineOf = (state, uid) => state.actors.filter(b => b.uid === uid || b.uid.startsWith(uid + '/'));
  const flagged = (state, b) => { const sp = Packs.speciesFor(state, b); return !!sp && Array.isArray(sp.flags) && sp.flags.includes(ID); };
  // The original whose first body uid a body copies, or null (above).
  function copies(state, b) {
    if (!b || b.uid === 'you') return null;
    const first = find(state, firstOf(b.uid));
    if (!first) return null;
    if (first.ax && typeof first.ax.copyOf === 'string') return first.ax.copyOf;
    const sp = Packs.speciesFor(state, first);
    if (!sp || typeof sp.copyOf !== 'string' || typeof first.group !== 'string') return null;
    const o = state.actors.find(c => c.uid !== 'you' && c.group === first.group && c.sp === sp.copyOf && !c.uid.includes('/'));
    return o ? o.uid : null;
  }
  // Does b's line say it loses heart when the original o falls (above)?
  function says(state, b, o) {
    const first = find(state, firstOf(b.uid));
    if (first && first.ax && typeof first.ax.copyOf === 'string') return true;
    const orig = find(state, o);
    return !!orig && flagged(state, b) && flagged(state, orig);
  }
  const ours = e => (e.k === 'module' && e.id === ID) || (e.k === 'status' && !!e.cause && e.cause.k === ID);
  const lose = (v, pct) => v > 1 ? Math.max(1, v - Math.max(1, Int.pct(v, pct))) : v;
  // The step's last death of a body of each original line that is all gone after the step:
  // Map(first uid → that death's index).
  function falls(events, post) {
    const out = new Map();
    events.forEach((e, i) => {
      if (e.k !== 'died' || typeof e.who !== 'string' || e.who === 'you') return;
      const r = firstOf(e.who);
      if (lineOf(post, r).every(b => b.gone)) out.set(r, i);
    });
    return out;
  }
  // Was b present (made, and not yet destroyed) at the step's event i?
  function presentAt(pre, events, b, i) {
    const made = events.findIndex(e => e.k === 'woke' && e.who === b.uid && e.was === null && e.cause && e.cause.k === 'summoned');
    const before = !!find(pre, b.uid) && !find(pre, b.uid).gone;
    if (!before && (made < 0 || made > i)) return false;
    const died = events.findIndex(e => e.k === 'died' && e.who === b.uid);
    return died < 0 || died > i;
  }

  return [
    {
      id: 'copies.when',
      check(pre, events, post) {
        const mine = events.filter(ours);
        if (!mine.length) return null;
        if (!Modules.on(post, ID)) return `${ID} told ${mine[0].k} ${JSON.stringify(mine[0].rule || mine[0].id)} on turn ${mine[0].turn} while it is off`;
        const fell = falls(events, post);
        for (const e of mine) {
          if (e.k !== 'module') continue;
          const i = events.indexOf(e), by = e.cause && e.cause.by;
          if (e.rule !== 'weaken' && e.rule !== 'split') return `${ID} told a rule ${JSON.stringify(e.rule)}`;
          if (typeof e.who !== 'string') return `its ${e.rule} names no exhibit (who)`;
          if (typeof by !== 'string') return `${e.who}'s ${e.rule} names no original (cause.by)`;
          const b = find(post, e.who);
          if (!b || copies(post, b) !== by) return `${e.who} lost heart for ${by}, which it does not copy (it copies ${b ? copies(post, b) : 'nothing'})`;
          if (!says(post, b, by)) return `${e.who} lost heart, but its line or its original's does not carry ${ID}'s part`;
          if (!lineOf(post, by).every(c => c.gone)) return `${e.who} lost heart for ${by}, a body of whose line still stands`;
          if (e.rule === 'weaken' && !(fell.has(by) && fell.get(by) < i)) return `${e.who} lost heart on turn ${e.turn}, but no body of ${by}'s line was destroyed before it in the step`;
        }
        return null;
      },
    },
    {
      id: 'copies.all',
      check(pre, events, post) {
        const fell = falls(events, post);
        const splits = events.filter(e => e.k === 'woke' && e.was === null && e.cause && e.cause.k === 'summoned' && e.cause.how === 'split');
        if (!fell.size && !splits.length) return null;
        if (!Modules.on(post, ID)) return null;
        const told = (who, rule) => events.filter(e => e.k === 'module' && e.id === ID && e.rule === rule && e.who === who);
        for (const [r, i] of fell) {
          // Its fall is this death only if no body of its line stood before the step's start
          // and none was gone: it fell in this step (a line already gone before has fallen).
          if (lineOf(pre, r).length && lineOf(pre, r).every(b => b.gone)) continue;
          for (const b of post.actors) {
            if (b.uid === 'you' || copies(post, b) !== r || !says(post, b, r)) continue;
            const n = told(b.uid, 'weaken').filter(e => e.cause.by === r).length;
            const want = presentAt(pre, events, b, i) ? 1 : 0;
            if (n !== want) return `${r} fell on turn ${events[i].turn}, and ${b.uid}, which copies it, ${want ? 'present' : 'not present'} then, lost heart ${n} time(s)`;
          }
        }
        for (const e of splits) {
          const b = find(post, e.who), r = b ? copies(post, b) : null;
          if (!b || r === null || !says(post, b, r)) continue;
          // The fall came first: before the step, or at an earlier event of it.
          const at = events.indexOf(e), before = lineOf(pre, r).length > 0 && lineOf(pre, r).every(c => c.gone);
          const fellFirst = before || (fell.has(r) && fell.get(r) < at);
          const n = told(b.uid, 'split').length;
          if (n !== (fellFirst ? 1 : 0)) return `${b.uid} split from ${e.cause.from} ${fellFirst ? 'after' : 'before'} ${r} fell, and was told slowed ${n} time(s)`;
        }
        return null;
      },
    },
    {
      id: 'copies.loss',
      check(pre, events, post) {
        const mine = events.filter(e => e.k === 'module' && e.id === ID);
        if (!mine.length) return null;
        for (const e of mine) {
          const b = find(post, e.who), i = events.indexOf(e);
          // Its slowing comes straight after its event: slowed, for the rest of the visit, by its original.
          const s = events[i + 1];
          if (!s || s.k !== 'status' || s.who !== e.who || s.id !== 'slowed' || !s.on || s.turns !== null || !s.cause || s.cause.k !== ID || s.cause.by !== e.cause.by)
            return `${e.who}'s ${e.rule} is not followed by its slowing for the rest of the visit: ${JSON.stringify(s)}`;
          if (!b) return `${e.who} is not in the state`;
          if (!b.gone && !(b.statuses || []).some(x => x.id === 'slowed' && x.perm === true)) return `${e.who} lost heart but does not hold slowed for the rest of the visit`;
          if (e.rule === 'weaken') {
            const a = find(pre, e.who);
            // Its numbers, from before the step (one made in it has none to compare): damage,
            // Acc and maximum health change in a step only by this.
            if (a && !a.gone) {
              const pct = N.COPY_WEAKEN_PCT, dmax = lose(a.dmax, pct), want = { maxHp: lose(a.maxHp, pct), dmax, dmin: Math.min(dmax, lose(a.dmin, pct)), acc: a.acc - N.COPY_WEAKEN_ACC };
              for (const k of ['maxHp', 'dmin', 'dmax', 'acc']) if (b[k] !== want[k]) return `${e.who} lost heart: its ${k} went from ${a[k]} to ${b[k]}, not ${want[k]}`;
            }
            if (b.hp > b.maxHp || (!b.gone && b.hp < 1)) return `${e.who} lost heart with ${b.hp} of ${b.maxHp} health`;
          } else {
            // Split from a body that had lost heart: its numbers are that body's, not weakened again.
            const made = events.find(w => w.k === 'woke' && w.who === e.who && w.was === null && w.cause && w.cause.how === 'split');
            if (!made || events.indexOf(made) > i) return `${e.who} was told slowed for a split, but no split made it before that in the step`;
            const from = find(post, made.cause.from);
            if (from) for (const k of ['maxHp', 'dmin', 'dmax', 'acc']) if (b[k] !== from[k]) return `${e.who}, split from ${from.uid}, has its ${k} ${b[k]}, not ${from[k]}`;
          }
        }
        return null;
      },
    },
  ];
};
