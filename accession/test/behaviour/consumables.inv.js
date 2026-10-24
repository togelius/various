// Invariants of the consumables' clauses (BUILD.md §8.6; reg/consumables.js), checked after
// every step of every scenario, monkey, soak and bot run (§5.3, check 1). Each is checked
// once a step, from the step's events and the state before and after it.
//   consumable_first_use: a first use (a used event whose cause says known: false) never
//     lowers your health or puts a harmful status on you; a gentle drink does nothing at
//     all; a first throw lands more than Consumables.GENTLE tiles from you; known says
//     truly whether the seal was known before the step.
//   consumable_deck: the deck has one count per kind, each between 0 and its DECK count.
//   consumable_seals: the seals are unshuffled or a bijection in each family; the known
//     seals are real seals, each once, never forgotten, and a seal becomes known exactly
//     when an identified event names it, with the kind under it.
//   consumable_stacks: a consumable not gone has at least one in its stack (or no count at
//     all, as a room for tests may give one), and each use or throw takes exactly one from
//     its stack.
module.exports = (C) => {
  const R = C.Registry, N = C.N;
  const KINDS = R.order('CONSUMABLES'), SEALS = R.order('SEALS');
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const json = x => JSON.stringify(x);
  const used = events => events.filter(e => e.k === 'used' && e.cause && e.cause.k === 'consume');
  const item = (state, uid) => (state.items || []).find(i => i.uid === uid) || null;
  const sorted = a => a.slice().sort((x, y) => x - y);

  const firstUse = {
    id: 'consumable_first_use',
    check(pre, events, post) {
      for (const e of used(events)) {
        const c = e.cause, by = f => f.cause && f.cause.k === 'item' && f.cause.item === e.item;
        const wasKnown = pre.run.knownSeals.includes(c.seal);
        if (c.known !== wasKnown) return `${e.item}'s use says known: ${c.known}, but its seal ${c.seal} was ${wasKnown ? '' : 'not '}known before the step`;
        if (c.known) continue;
        for (const f of events) {
          if (f.who !== 'you' || !by(f)) continue;
          if (f.k === 'damaged' || f.k === 'died') return `a first use of ${e.item} (${c.ck}) hurt you`;
          if (f.k === 'status' && f.on && C.Status.harmful(f.id)) return `a first use of ${e.item} (${c.ck}) made you ${f.id}`;
        }
        if (c.gentle && events.some(f => by(f) && f !== e)) return `a gentle first drink of ${e.item} (${c.ck}) did something: ${json(events.filter(f => by(f)).map(f => f.k))}`;
        if (e.how === 'throw') {
          const you = pre.actors[0], d = Math.max(Math.abs(c.x - you.x), Math.abs(c.y - you.y));
          if (d <= C.Consumables.GENTLE) return `a first throw of ${e.item} landed ${d} tiles from you, within ${C.Consumables.GENTLE}`;
        }
      }
      return null;
    },
  };

  const deck = {
    id: 'consumable_deck',
    check(pre, events, post) {
      const d = post.run.deck;
      if (!Array.isArray(d) || d.length !== KINDS.length) return `the deck is ${json(d)}, not ${KINDS.length} counts`;
      for (let i = 0; i < d.length; i++) if (!Number.isInteger(d[i]) || d[i] < 0 || d[i] > N.DECK[i]) return `the deck holds ${d[i]} ${KINDS[i]} cards (0 to ${N.DECK[i]})`;
      return null;
    },
  };

  const seals = {
    id: 'consumable_seals',
    check(pre, events, post) {
      const s = post.run.seals;
      if (s !== null) {
        const sol = KINDS.map((k, i) => R.CONSUMABLES[k].cls === 'solution' ? i : -1).filter(i => i >= 0), eph = KINDS.map((k, i) => R.CONSUMABLES[k].cls === 'ephemera' ? i : -1).filter(i => i >= 0);
        if (!s || json(sorted(s.sol || [])) !== json(sol) || json(sorted(s.eph || [])) !== json(eph)) return `the seals ${json(s)} are not a bijection in each family`;
      }
      const k = post.run.knownSeals, was = pre.run.knownSeals;
      if (new Set(k).size !== k.length || !k.every(x => own(R.SEALS, x))) return `the known seals ${json(k)} are not distinct seals`;
      if (!was.every(x => k.includes(x))) return `a known seal was forgotten: ${json(was)} → ${json(k)}`;
      const named = events.filter(e => e.k === 'identified');
      const fresh = k.filter(x => !was.includes(x));
      if (json(named.map(e => e.seal).slice().sort()) !== json(fresh.slice().sort())) return `the seals identified ${json(named.map(e => e.seal))} are not those newly known ${json(fresh)}`;
      for (const e of named) {
        const S = R.SEALS[e.seal], i = s ? (S.cls === 'solution' ? s.sol : s.eph)[S.n] : -1;
        if (KINDS[i] !== e.ck) return `${e.seal} was identified as ${e.ck}, but it is ${KINDS[i]}`;
      }
      return null;
    },
  };

  const stacks = {
    id: 'consumable_stacks',
    check(pre, events, post) {
      for (const it of post.items || []) {
        if (it.kind !== 'consumable') continue;
        if (it.where.at !== 'gone' && it.n !== null && !(Number.isInteger(it.n) && it.n >= 1)) return `${it.uid} is ${it.where.at} with ${it.n} in its stack`;
      }
      for (const e of used(events)) {
        const a = item(pre, e.item), b = item(post, e.item);
        if (!a || !b || a.n - b.n !== 1) return `using ${e.item} took ${a && b ? a.n - b.n : 'an unknown number'} from its stack, not 1`;
      }
      return null;
    },
  };

  return [firstUse, deck, seals, stacks];
};
