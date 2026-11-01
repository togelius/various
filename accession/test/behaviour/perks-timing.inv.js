// ACCESSION — the invariants of Duck and Cover and Close the Distance (BUILD.md §8.1, §8.7; M4
// plan A6, D4.3, D4.4; PG-PERKS-TIMING), held after every step of every scenario, monkey, soak
// and bot run (tools/invariants.js). Each is what a perk's clause says, read back from the state
// before and after the step and the step's events, with the perks' numbers of record, never from
// their rule code (rules/perks/*.js). A perk counts when you hold it at rank 1 or 2 and it is not
// switched off for the visit (rulesOff). "Your action took time" means it is no free kind (read,
// choose, leave: Actions.free) and was not a step Close the Distance made free; the ticks it took
// are your next decision's tick after the step less before it.
//   perks_timing.duck_and_cover
//     - the discount: with it waiting (dept.perk.duck) before an action of yours that took
//       time, that action took PERK_DUCK_AND_COVER ticks less than it costs (its cost worked
//       out again on a copy of the state before it), and spent it; with none waiting, no
//       action of yours took less than a turn unless Close the Distance made it free;
//     - the misses: each damaging special that goes off with you on none of its tiles, after it
//       was marked while you stood on one (a mark held before the step, read from it; one marked
//       in the step, from its tiles and where you stood), while the visit goes on, is followed
//       at once by `perk` duck (who: its owner) if no discount waits then, and at the second rank
//       by `perk` sure if no surprise waits then; no other duck or sure event is made; what
//       waits after the step is what these leave; at the first rank no surprise waits;
//     - the surprise: with a surprise waiting at the second rank, your blow or shot at anything
//       but the Night Watchman is a surprise (a damaged event with cause surprise, unless a
//       reflector sent it back) and spends it; at the Night Watchman it is no surprise and
//       spends nothing; without one, no blow of yours surprises an exhibit that was hunting,
//       searching, returning or reinstalling, or awake having seen you.
//   perks_timing.close_the_distance
//     - a step of yours that took no time made one `perk` close event, and only then: a move
//       that changed your tile, toward (your walking distance to its nearest tile less from the
//       tile you stepped onto, Grid.distances and Grid.reachDist, §8.2) an exhibit not gone
//       whose pending damaging mark covered the tile you left, with fewer free steps toward it
//       so far this visit than PERK_CLOSE_STEPS[rank − 1] allows, and the first such exhibit in
//       spawn order; its count (dept.perk.closed) rose by one, and the event's n and of say so;
//     - a step of yours that took time is toward no such exhibit with steps left (it would have
//       been free), and no count changes but the paying one's.
'use strict';
module.exports = (C) => {
  const { N, Grid } = C;
  const json = x => JSON.stringify(x);
  const DUCK = 'duck_and_cover', CLOSE = 'close_the_distance';
  const rank = (s, id) => {
    if (s.options && Array.isArray(s.options.rulesOff) && s.options.rulesOff.includes(id)) return 0;
    for (const p of (s.run && s.run.perks) || []) if (p.id === id) return p.rank;
    return 0;
  };
  const part = s => (s.dept && s.dept.perk) || {};
  const refused = events => events.length === 1 && events[0].k === 'refused';
  const actorIn = (s, uid) => { for (const a of s.actors) if (a.uid === uid) return a; return null; };
  const perkEvents = (events, cause) => events.filter(e => e.k === 'perk' && e.cause && e.cause.k === cause);
  // The ticks your action took: your next decision's tick after the step less before it.
  const took = (pre, post) => post.actors[0].next - pre.actors[0].next;
  // What your action costs before any perk changes it: its handler's ticks, on a copy of the
  // state before it (the copy is thrown away).
  function costOf(pre, action) {
    const copy = C.State.clone(pre), h = C.Actions.get(action.a);
    return h.apply(copy, action, []);
  }
  const damaging = sp => Object.prototype.hasOwnProperty.call(C.Registry.SPECIALS, sp) && C.Registry.SPECIALS[sp].effect === 'damage';
  const covers = (tiles, x, y) => Array.isArray(tiles) && tiles.some(t => t[0] === x && t[1] === y);
  // Modes in which nothing is caught by surprise but by a perk (§8.1).
  const wary = a => a.mode === 'hunting' || a.mode === 'searching' || a.mode === 'returning' || a.mode === 'reinstalling' || (a.mode === 'awake' && a.sawYou);

  const duck = {
    id: 'perks_timing.duck_and_cover',
    check(pre, events, post, ctx) {
      const r = rank(pre, DUCK), act = ctx && ctx.action, ducks = perkEvents(events, 'duck'), sures = perkEvents(events, 'sure');
      if (!r) {
        if (ducks.length || sures.length) return `Duck and Cover does not count, but the step said ${json(ducks.concat(sures)[0])}`;
        return null;
      }
      if (!act || refused(events)) return null;
      const you1 = post.actors[0], free = C.Actions.free(act.a), closed = perkEvents(events, 'close').length > 0;
      const spent = took(pre, post), timed = !free && !closed;
      const w0 = part(pre).duck === true, s0 = part(pre).sure === true;
      // The discount: spent by your action if it took time.
      if (timed && w0) {
        const raw = costOf(pre, act);
        if (spent !== raw - N.PERK_DUCK_AND_COVER) return `with Duck and Cover's discount waiting, your ${act.a} took ${spent} ticks; it costs ${raw}, so it should take ${raw - N.PERK_DUCK_AND_COVER}`;
      } else if (timed && spent < N.TICKS_PER_TURN) return `your ${act.a} took ${spent} ticks with no discount waiting and no free step`;
      let wait = timed ? false : w0, sure = s0;
      // Your blow or shot, and the surprise: one waiting counts at the second rank; a blow or
      // shot at anything but the Night Watchman spends it.
      const hit = events.find(e => e.k === 'attacked' && e.by === 'you') || null;
      const target = hit ? actorIn(pre, hit.at) : null, watchman = !!target && target.arch === 'night_watchman';
      if (hit && target) {
        const counts = sure && r >= 2;
        const reflected = events.some(e => (e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.k === 'reflected' && e.cause.shooter === 'you');
        const surprised = events.some(e => e.k === 'damaged' && e.who === hit.at && e.cause && e.cause.by === 'you' && e.cause.surprise === 1);
        if (counts && !watchman && !reflected && !surprised) return `a surprise attack waited, but your blow at ${hit.at} was no surprise`;
        if (surprised && watchman) return 'your blow surprised the Night Watchman';
        if (surprised && !counts && wary(target)) return `your blow surprised ${hit.at}, ${target.mode}${target.sawYou ? ' having seen you' : ''}, with no surprise attack waiting`;
        if (!watchman) sure = false;
      }
      // The specials that go off, in order. A perk event follows its special, after any other
      // perk's events for it.
      let over = false;
      const marked = new Map();
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.k === 'died' && e.who === 'you') over = true;
        if (e.k === 'telegraphed') marked.set(e.who, covers(e.tiles, you1.x, you1.y));
        if (e.k === 'perk' && e.cause && (e.cause.k === 'duck' || e.cause.k === 'sure')) {
          let j = i - 1;
          while (j >= 0 && events[j].k === 'perk') j--;
          if (j < 0 || events[j].k !== 'special' || events[j].who !== e.cause.who) return `${json(e)} follows no special of ${e.cause.who}`;
          continue;
        }
        if (e.k !== 'special' || e.cancelled || !damaging(e.sp) || over) continue;
        const before = actorIn(pre, e.who), tel = before && before.telegraph && before.telegraph.sp === e.sp ? before.telegraph : null;
        const atYou = marked.has(e.who) ? marked.get(e.who) : !!tel && tel.effect === 'damage' && !tel.offYou;
        const missed = atYou && Array.isArray(e.hits) && !e.hits.includes('you');
        const after = [];
        for (let j = i + 1; j < events.length && events[j].k === 'perk'; j++) if (events[j].cause && events[j].cause.who === e.who) after.push(events[j].cause.k);
        const gotDuck = after.includes('duck'), gotSure = after.includes('sure');
        if (!missed) {
          if (gotDuck || gotSure) return `${e.who}'s ${e.sp} ${atYou ? 'struck you' : 'was not marked on your tile'}, but Duck and Cover answered it`;
          continue;
        }
        if (gotDuck === wait) return wait ? `${e.who}'s ${e.sp} missed you while a discount waited, and Duck and Cover said a new one` : `${e.who}'s ${e.sp} missed you after it was marked on your tile, but no discount was given`;
        if (r >= 2 && gotSure === sure) return sure ? `${e.who}'s ${e.sp} missed you while a surprise waited, and Duck and Cover said a new one` : `${e.who}'s ${e.sp} missed you at the second rank, but no surprise attack was given`;
        if (r < 2 && gotSure) return 'Duck and Cover gave a surprise attack at the first rank';
        wait = true;
        if (r >= 2) sure = true;
      }
      const w1 = part(post).duck === true, s1 = part(post).sure === true;
      if (w1 !== wait) return `after the step the discount ${w1 ? 'waits' : 'does not wait'}, but the misses and your action leave it ${wait ? 'waiting' : 'spent'}`;
      if (s1 !== sure) return `after the step a surprise attack ${s1 ? 'waits' : 'does not wait'}, but the misses and your action leave it ${sure ? 'waiting' : 'spent'}`;
      return null;
    },
  };

  const close = {
    id: 'perks_timing.close_the_distance',
    check(pre, events, post, ctx) {
      const r = rank(pre, CLOSE), act = ctx && ctx.action, said = perkEvents(events, 'close');
      if (!r) return said.length ? `Close the Distance does not count, but the step said ${json(said[0])}` : null;
      if (!act || refused(events)) return null;
      if (said.length > 1) return `one step made ${said.length} close events`;
      const free = C.Actions.free(act.a), spent = took(pre, post);
      const you0 = pre.actors[0], you1 = post.actors[0], moved = you0.x !== you1.x || you0.y !== you1.y;
      if (said.length && (act.a !== 'move' || spent !== 0 || !moved)) return `a close event for a ${act.a} that took ${spent} ticks${moved ? '' : ' and left you where you stood'}`;
      if (!free && spent === 0 && !said.length) return `your ${act.a} took no time with no close event`;
      if (act.a !== 'move' || !moved) return null;
      // Those targeting the tile you left, in spawn order, and whether the step closed on each.
      const of = N.PERK_CLOSE_STEPS[r - 1], m = pre.dept;
      const counts = s => { const out = new Map(); for (const c of part(s).closed || []) out.set(c.uid, c.n); return out; };
      const n0 = counts(pre), n1 = counts(post);
      const aims = pre.actors.filter((a, i) => i > 0 && !a.gone && a.telegraph && a.telegraph.effect === 'damage' && covers(a.telegraph.tiles, you0.x, you0.y));
      if (!aims.length) {
        if (said.length) return `a close event, but no exhibit's mark covered the tile you left (${you0.x}, ${you0.y})`;
        return json([...n0]) === json([...n1]) ? null : 'the free steps counted changed with no free step';
      }
      const d0 = Grid.distances(m, [[you0.x, you0.y]], m.w * m.h), d1 = Grid.distances(m, [[you1.x, you1.y]], m.w * m.h);
      const near = (d, a) => { let best = -1; for (const [x, y] of C.Actors.footprint(a)) { const k = Grid.reachDist(d, m, x, y); if (k >= 0 && (best < 0 || k < best)) best = k; } return best; };
      const payer = aims.find(a => (n0.get(a.uid) || 0) < of && near(d1, a) >= 0 && near(d1, a) < near(d0, a)) || null;
      if (!payer) {
        if (said.length) return `a close event for ${said[0].cause.who}, but the step closed on no exhibit targeting you with free steps left`;
        return json([...n0]) === json([...n1]) ? null : 'the free steps counted changed with no free step';
      }
      if (!said.length) return `your step toward ${payer.uid}, whose mark covered your tile, with ${of - (n0.get(payer.uid) || 0)} free steps left, took ${spent} ticks`;
      const c = said[0].cause, want = (n0.get(payer.uid) || 0) + 1;
      if (c.who !== payer.uid) return `the free step was counted to ${c.who}, not ${payer.uid}, the first in spawn order it closed on with steps left`;
      if (n1.get(payer.uid) !== want || c.n !== want || c.of !== of) return `the free step toward ${payer.uid} is counted ${n1.get(payer.uid)} (said ${c.n} of ${c.of}), not ${want} of ${of}`;
      for (const [uid, n] of n1) if (uid !== payer.uid && n !== n0.get(uid)) return `the free steps toward ${uid} changed from ${n0.get(uid)} to ${n}`;
      return null;
    },
  };

  return [duck, close];
};
