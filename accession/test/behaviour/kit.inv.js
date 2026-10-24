// ACCESSION — the kit's invariants (BUILD.md §5.3 check 1; §8.1, §8.5): what the entries of
// reg/items.js promise, checked after every step of every scenario, monkey, soak and bot run.
// Each is checked once a step (no `applies`), over the whole state. The expected values are
// worked out here from §8.1 and §8.5, not read from the kit's own code, except where the
// clause is that the state agrees with Kit.derive.
'use strict';
module.exports = (C) => {
  const { Kit, N } = C;
  const json = JSON.stringify;
  const SLOT_KIND = [['weapon', 'weapon'], ['garment', 'garment'], ['curio0', 'curio'], ['curio1', 'curio'], ['instrument', 'instrument']];
  const slotUid = (s, slot) => slot === 'curio0' ? s.you.kit.curio[0] : slot === 'curio1' ? s.you.kit.curio[1] : s.you.kit[slot];
  const byUid = (s, uid) => s.items.find(i => i.uid === uid) || null;
  const isInt = Number.isInteger;
  const refused = events => events.length === 1 && events[0].k === 'refused';
  const STATS = ['acc', 'eva', 'pad', 'dmin', 'dmax', 'weaponForm', 'reach', 'quiet', 'breaker'];

  return [
    // Every item is in exactly one place: on the floor or in a case on the board, in your tote
    // (and listed there once), in the one slot that names it, or gone; a case that holds an
    // item holds it on its own tile.
    { id: 'kit.one_place', check(pre, events, post) {
      const seen = new Set(), m = post.dept;
      for (const it of post.items) {
        if (seen.has(it.uid)) return `two items share the uid ${it.uid}`;
        seen.add(it.uid);
        const w = it.where;
        if (!w || typeof w.at !== 'string') return `${it.uid} has no place`;
        if (w.at === 'floor' || w.at === 'case') {
          if (!isInt(w.x) || !isInt(w.y) || w.x < 0 || w.y < 0 || w.x >= m.w || w.y >= m.h) return `${it.uid} lies off the board: ${json(w)}`;
          if (w.at === 'case' && !(m.fixtures || []).some(f => f.k === 'case' && f.x === w.x && f.y === w.y)) return `${it.uid} is in a case at ${w.x},${w.y}, where there is none`;
        } else if (w.at === 'tote') {
          if (post.you.tote.filter(u => u === it.uid).length !== 1) return `${it.uid} is in the tote, which lists it ${post.you.tote.filter(u => u === it.uid).length} times`;
        } else if (w.at === 'kit') {
          if (slotUid(post, w.slot) !== it.uid) return `${it.uid} is in the ${w.slot} slot, which holds ${slotUid(post, w.slot)}`;
        } else if (w.at !== 'gone') return `${it.uid} is nowhere: ${json(w)}`;
      }
      for (const u of post.you.tote) { const it = byUid(post, u); if (!it || it.where.at !== 'tote') return `the tote lists ${u}, which is not in it`; }
      for (const [slot] of SLOT_KIND) {
        const u = slotUid(post, slot);
        if (u === null) continue;
        const it = byUid(post, u);
        if (!it || it.where.at !== 'kit' || it.where.slot !== slot) return `the ${slot} slot names ${u}, which is not in it`;
      }
      for (const f of m.fixtures || []) {
        if (f.k !== 'case' || f.holds === null) continue;
        const it = byUid(post, f.holds);
        if (it && !(it.where.at === 'case' && it.where.x === f.x && it.where.y === f.y)) return `the case at ${f.x},${f.y} holds ${f.holds}, which is ${json(it.where)}`;
      }
      return null;
    } },

    // The tote holds at most TOTE_SLOTS: one slot for each item, one for each kind of
    // consumable however many (so two stacks of one kind and seal never sit in it).
    { id: 'kit.tote', check(pre, events, post) {
      const tote = post.you.tote;
      if (tote.length > N.TOTE_SLOTS) return `the tote holds ${tote.length} things; it has ${N.TOTE_SLOTS} slots`;
      const stacks = new Set();
      for (const u of tote) {
        const it = byUid(post, u);
        if (!it || it.kind !== 'consumable') continue;
        const k = it.ck + '/' + it.seal;
        if (stacks.has(k)) return `two stacks of ${k} are in the tote`;
        stacks.add(k);
      }
      return null;
    } },

    // Each slot holds only its own kind, and the weapon slot is never empty.
    { id: 'kit.slots', check(pre, events, post) {
      if (post.you.kit.weapon === null) return 'the weapon slot is empty';
      for (const [slot, kind] of SLOT_KIND) {
        const u = slotUid(post, slot), it = u === null ? null : byUid(post, u);
        if (it && it.kind !== kind) return `the ${slot} slot holds ${it.uid}, a ${it.kind}`;
      }
      return null;
    } },

    // Your stats are those your kit gives (Kit.derive), after every step.
    { id: 'kit.derived', check(pre, events, post) {
      const d = Kit.derive(post), you = post.actors[0];
      for (const k of STATS) if (json(you[k]) !== json(d[k])) return `your ${k} is ${json(you[k])}, and your kit gives ${json(d[k])}`;
      return null;
    } },

    // An instrument's charges stay within 0 and its maximum.
    { id: 'kit.charges', check(pre, events, post) {
      for (const it of post.items) {
        if (it.kind !== 'instrument' || !isInt(it.charges) || !isInt(it.max)) continue;
        if (it.charges < 0 || it.charges > it.max) return `${it.uid} has ${it.charges} of ${it.max} charges`;
        if (it.rechargeAt !== null && !isInt(it.rechargeAt)) return `${it.uid} recharges at ${json(it.rechargeAt)}`;
      }
      return null;
    } },

    // What an item action costs you (§8.1): take or drop COST_TAKE; equip or unequip a garment
    // COST_EQUIP_GARMENT, anything else COST_EQUIP; use an instrument or a Restoration kit
    // COST_USE; doubled while you are slowed. A refused one costs nothing.
    { id: 'kit.costs', check(pre, events, post, ctx) {
      const a = ctx.action;
      if (!a || !['take', 'drop', 'equip', 'unequip', 'use'].includes(a.a) || refused(events)) return null;
      let base = null;
      if (a.a === 'take' || a.a === 'drop') base = N.COST_TAKE;
      else if (a.a === 'equip') { const it = byUid(pre, a.uid); base = it && it.kind === 'garment' ? N.COST_EQUIP_GARMENT : N.COST_EQUIP; }
      else if (a.a === 'unequip') { const it = byUid(pre, slotUid(pre, a.slot)); base = it && it.kind === 'garment' ? N.COST_EQUIP_GARMENT : N.COST_EQUIP; }
      else { const it = byUid(pre, a.uid); if (!it || (it.kind !== 'instrument' && it.kind !== 'kit')) return null; base = N.COST_USE; }
      const slowed = pre.actors[0].statuses.some(s => s.id === 'slowed'), want = slowed ? base * N.SPEED_SLOW_PCT / 100 : base;
      const paid = post.actors[0].next - pre.actors[0].next;
      return paid === want ? null : `${json(a)} cost ${paid} ticks, not ${want}`;
    } },

    // Each use of an instrument spends one charge (one may come back at a boundary of the
    // same step); the fork's noise is soft, yours, at the tile it was aimed at; the pole moves
    // an exhibit exactly one tile, to where the use says; a Restoration kit is used up and its
    // item is one level higher.
    { id: 'kit.uses', check(pre, events, post) {
      for (const e of events) {
        if (e.k !== 'used' || e.who !== 'you' || !e.cause || e.cause.k !== 'use') continue;
        const c = e.cause, before = byUid(pre, e.item), after = byUid(post, e.item);
        if (e.how === 'restore') {
          const t0 = byUid(pre, c.on), t1 = byUid(post, c.on);
          if (!t0 || !t1 || t1.level !== t0.level + 1) return `a Restoration kit on ${c.on} took it from level ${t0 && t0.level} to ${t1 && t1.level}`;
          if (!after || after.where.at !== 'gone') return `the Restoration kit ${e.item} was not used up`;
          continue;
        }
        if (!before || !after || before.charges < 1 || after.charges > before.charges || after.charges < before.charges - 1) return `${e.item} went from ${before && before.charges} to ${after && after.charges} charges in one use`;
        if (e.how === 'fork' && !events.some(n => n.k === 'noise' && n.cls === 'soft' && n.x === c.x && n.y === c.y && n.cause && n.cause.k === 'fork' && n.cause.by === 'you')) return `the fork at ${c.x},${c.y} made no soft noise of yours there`;
        if (e.how === 'push' || e.how === 'pull') {
          const mv = events.find(n => n.k === 'moved' && n.who === c.at && n.cause && n.cause.k === 'pole');
          if (!mv || Math.max(Math.abs(mv.to[0] - mv.from[0]), Math.abs(mv.to[1] - mv.from[1])) !== 1 || json(mv.to) !== json(c.to)) return `the pole moved ${c.at} ${json(mv)}, not one tile to ${json(c.to)}`;
        }
      }
      return null;
    } },

    // Quiet (§8.5): your ring is QUIET_RING smaller while your last action was a move and you
    // wear an item with the quiet primitive (once, however many), and the kit changes it in no
    // other way.
    { id: 'kit.quiet', check(pre, events, post) {
      const you = post.actors[0], worn = [post.you.kit.weapon, post.you.kit.garment, post.you.kit.curio[0], post.you.kit.curio[1], post.you.kit.instrument]
        .map(u => byUid(post, u)).filter(Boolean);
      const quiet = worn.some(it => (it.prims || []).some(p => p.id === 'quiet'));
      const want = quiet && you.lastAct === 'move' ? -N.QUIET_RING : 0, got = Kit.ringDelta(post);
      return got === want ? null : `the kit changes your ring by ${got}, not ${want}`;
    } },

    // The Highlights (§8.5): each names a Restoration kit.
    { id: 'kit.highlights', check(pre, events, post) {
      for (const h of post.dept.highlights || []) { const it = byUid(post, h.uid); if (!it || it.kind !== 'kit') return `the Highlight ${h.uid} is not a Restoration kit`; }
      return null;
    } },
  ];
};
