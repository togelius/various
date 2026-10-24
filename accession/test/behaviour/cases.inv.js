// ACCESSION — invariants of cases, glass and staff doors (BUILD.md §8.3; the registry's
// TRIGGERS.touch_case, FIXTURES.case and .staff, GLASS, the case refusals and wake causes),
// checked after every step of every scenario, monkey, soak and bot run (§5.3, check 1).
// Each states one rule in words; a check returns null when it held, or what broke it.
'use strict';
module.exports = C => {
  const exhibit = a => a.uid !== 'you';
  const vAt = (s, x, y) => C.Grid.ch(s.dept, x, y) === 'v';
  const onV = (s, a) => C.Actors.footprint(a).filter(([x, y]) => vAt(s, x, y));
  const same = (p, q) => p[0] === q[0] && p[1] === q[1];
  const ORDER = ['shut', 'open', 'broken', 'dissolved', 'revealed'];
  return [
    {
      // Nothing walks into an intact case: an actor that stands on a vitrine after a step
      // stood on that same vitrine before it.
      id: 'cases_no_entry',
      applies: () => true,
      check(pre, events, post, ctx) {
        if (!ctx.before || ctx.actor.gone) return null;
        const was = C.Actors.footprint(ctx.before).map(t => t.join(','));
        for (const [x, y] of onV(post, ctx.actor)) if (!was.includes(x + ',' + y)) return `stepped into the intact case at ${x},${y}`;
        return null;
      },
    },
    {
      // An exhibit in an intact case stays in it: if the vitrine it stood on is still intact,
      // it stands where it stood (R4; §8.3).
      id: 'cases_encased_stay',
      applies: exhibit,
      check(pre, events, post, ctx) {
        if (!ctx.before || ctx.actor.gone || ctx.before.gone) return null;
        const held = onV(pre, ctx.before).filter(([x, y]) => vAt(post, x, y));
        if (held.length && (ctx.actor.x !== ctx.before.x || ctx.actor.y !== ctx.before.y))
          return `left its intact case at ${held[0].join(',')} for ${ctx.actor.x},${ctx.actor.y}`;
        return null;
      },
    },
    {
      // A case's glass only ever takes more bashes, never fewer, and never more than it takes
      // to break; a case once opened, broken, dissolved or revealed never shuts again; and
      // fixtures are only ever added, in place.
      id: 'cases_hits',
      check(pre, events, post) {
        const a = pre.dept.fixtures || [], b = post.dept.fixtures || [];
        if (b.length < a.length) return `${a.length - b.length} fixture(s) vanished`;
        for (let i = 0; i < a.length; i++) {
          const p = a[i], q = b[i];
          if (q.k !== p.k || q.x !== p.x || q.y !== p.y) return `fixture ${i} moved or changed kind`;
          if (p.k !== 'case') { if (q.grade !== p.grade) return `the staff door at ${p.x},${p.y} changed its grade`; continue; }
          if (q.hits < p.hits) return `the case at ${p.x},${p.y} went from ${p.hits} to ${q.hits} hits`;
          if (q.hits > C.N.GLASS_BASHES[q.glass - 1]) return `the case at ${p.x},${p.y} has ${q.hits} hits, more than its glass takes`;
          if (p.st !== 'shut' && q.st !== p.st) return `the case at ${p.x},${p.y} went from ${p.st} to ${q.st}`;
          if (!ORDER.includes(q.st)) return `the case at ${p.x},${p.y} is ${q.st}`;
          for (const k of ['glass', 'lock', 'num', 'loan', 'mimic', 'room']) if (q[k] !== p[k]) return `the case at ${p.x},${p.y} changed its ${k}`;
        }
        return null;
      },
    },
    {
      // Vitrines only ever go: no step makes a new one (a mimic's disguise is made with the
      // department, never during a visit).
      id: 'cases_v_count',
      check(pre, events, post) {
        const count = s => s.dept.tiles.reduce((n, row) => n + row.split('v').length - 1, 0);
        const a = count(pre), b = count(post);
        return b > a ? `the vitrines rose from ${a} to ${b}` : null;
      },
    },
    {
      // After an open or a bash of a case, every exhibit whose trigger is touch_case that
      // stood in that case or had its home there, and the mimic the case was, is awake.
      id: 'cases_touch_wakes',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const act = ctx.action;
        if (!act || (act.a !== 'open' && act.a !== 'bash') || !ctx.before || ctx.actor.gone || ctx.actor.hp <= 0) return null;
        if (events.length === 1 && events[0].k === 'refused') return null;
        const f = (pre.dept.fixtures || []).find(q => q.k === 'case' && q.x === act.x && q.y === act.y);
        if (!f) return null;
        const b = ctx.before, there = C.Actors.covers(b, f.x, f.y) || (!!b.home && same(b.home, [f.x, f.y]));
        const touched = (there && b.trigger === 'touch_case') || f.mimic === b.uid;
        return touched && ctx.actor.mode === 'dormant' ? `its case at ${f.x},${f.y} was touched (${act.a}) and it sleeps on` : null;
      },
    },
    {
      // Exhibits treat staff doors as walls (§8.2): none ever stands on one, open or shut.
      id: 'cases_staff_wall',
      applies: exhibit,
      check(pre, events, post, ctx) {
        if (ctx.actor.gone) return null;
        for (const [x, y] of C.Actors.footprint(ctx.actor)) { const c = C.Grid.ch(post.dept, x, y); if (c === 'S' || c === 's') return `stands on the staff door at ${x},${y}`; }
        return null;
      },
    },
  ];
};
