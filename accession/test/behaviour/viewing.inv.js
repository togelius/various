// Viewing the Centrepiece and its dust sheet (BUILD.md §4.1, §8.7; M4 plan A4, D4.8, D4.9, Q9),
// as invariants checked after every step. Each is written from the rule's sentences, not from
// rules/viewing.js:
//   viewing.view   a view is told only for your `view`, made on the reading tile while the
//                  Centrepiece stood, was not under its sheet, every piece of it still standing
//                  slept and the visit had no Certificate; one a step at most; its count is one
//                  more than the last view's when your last action that took time was that view
//                  and no piece of it has woken since, else 1 ("four views in a row: any other
//                  action that takes time starts the count again, and so does its waking"), and
//                  dept.view then holds that count and the turn; dept.view changes in no other
//                  step;
//   viewing.earn   where a Centrepiece was placed, a Certificate by view comes exactly in a
//                  step whose view completes a row
//                  (VIEW_TURNS), at once after that view is told, before anything else; in that
//                  step the Centrepiece goes under its dust sheet, which is no defeat: every piece
//                  standing before is gone, none of them died, no Signature piece dropped and no
//                  Certificate came by defeat; dept.cp.sheet names those pieces and the turn; each
//                  tile of its footprint (its pieces' home tiles) that was floor or shards with no
//                  one else on it is low furniture (f) with a sheet fixture naming its piece, and
//                  no other tile or fixture becomes a sheet;
//   viewing.sheet  once under its sheet it stays: the record, its fixtures and their tiles (f)
//                  never change, its pieces stay gone, no event names one of them as who or by,
//                  no view is told, and a hall still sealed opens at the first turn boundary after
//                  the sheet (unless the visit ends first).
'use strict';
module.exports = (C) => {
  const { N } = C;
  const json = JSON.stringify;
  // pre is a clone, whose keys are in canonical order, so what is compared across the step is
  // compared canonically.
  const same = (a, b) => C.State.canon(a === undefined ? null : a) === C.State.canon(b === undefined ? null : b);
  const cpOf = s => (s && s.dept && s.dept.cp) || null;
  const actor = (s, uid) => s.actors.find(a => a.uid === uid) || null;
  const piecesOf = s => { const c = cpOf(s); return c && Array.isArray(c.uids) ? c.uids.map(u => actor(s, u)).filter(Boolean) : []; };
  const sheets = s => ((s.dept && s.dept.fixtures) || []).filter(f => f.k === 'sheet');
  const views = ev => ev.filter(e => e.k === 'viewed');
  // A piece's home tiles: its footprint where it was placed.
  const homeTiles = a => { const h = a.home || [a.x, a.y], n = a.size || 1, out = []; for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push([h[0] + dx, h[1] + dy]); return out; };
  const covers = (a, x, y) => { const n = a.size || 1; return x >= a.x && y >= a.y && x < a.x + n && y < a.y + n; };

  return [
    {
      id: 'viewing.view',
      check(pre, events, post, ctx) {
        const told = views(events), before = pre.dept && pre.dept.view, after = post.dept && post.dept.view;
        if (!told.length) return !same(before, after) ? `dept.view went from ${json(before)} to ${json(after)} with no view` : null;
        if (told.length > 1) return `${told.length} views were told in one step`;
        const e = told[0], c = cpOf(pre), you = pre.actors[0], t = pre.dept.viewTile;
        if (!ctx || !ctx.action || ctx.action.a !== 'view') return `a view was told for ${json(ctx && ctx.action)}`;
        if (e.who !== 'you') return `a view by ${e.who}`;
        if (!c || c.sheet) return 'a view of a Centrepiece that is not there, or is under its sheet';
        if (pre.dept.cert) return 'a view with the Certificate already earned';
        if (!Array.isArray(t) || you.x !== t[0] || you.y !== t[1]) return `a view from ${you.x},${you.y}, not the reading tile ${json(t)}`;
        const up = piecesOf(pre).filter(a => !a.gone);
        if (!up.length || up.some(a => a.mode !== 'dormant')) return `a view while the Centrepiece is not all asleep: ${json(up.map(a => [a.uid, a.mode]))}`;
        if (e.of !== c.uids[0]) return `the view names ${e.of}, not the Centrepiece's first piece ${c.uids[0]}`;
        const woke = !!before && piecesOf(pre).some(a => a.woke && a.woke.turn >= before.turn);
        const want = before && you.lastAct === 'view' && before.n < N.VIEW_TURNS && !woke ? before.n + 1 : 1;
        if (e.n !== want) return `the view counts ${e.n}, not ${want} (the row was ${json(before)}, your last action that took time ${you.lastAct}${woke ? ', and it has woken since' : ''})`;
        if (!same(after, { n: want, turn: pre.turn })) return `dept.view is ${json(after)}, not ${json({ n: want, turn: pre.turn })}`;
        return null;
      },
    },
    {
      id: 'viewing.earn',
      check(pre, events, post) {
        const done = views(events).find(e => e.n >= N.VIEW_TURNS), certs = events.filter(e => e.k === 'certificate' && e.cause && e.cause.k === 'view');
        const c = cpOf(post), was = cpOf(pre);
        if (!done) {
          // (Where no Centrepiece was placed there is nothing to view, so a Certificate by view
          // there is a test's own, planted through Progress.award: PG-CORE's tests.)
          if (certs.length && was) return 'a Certificate by view came with no view completing a row';
          if (c && c.sheet && !(was && was.sheet)) return 'the Centrepiece went under its sheet with no view completing a row';
          if (sheets(post).length !== sheets(pre).length) return 'a sheet fixture came or went with no view completing a row';
          return null;
        }
        if (certs.length !== 1 || events.indexOf(certs[0]) !== events.indexOf(done) + 1) return `the completed view was not followed at once by its Certificate: ${json(events.map(e => e.k))}`;
        const up = piecesOf(pre).filter(a => !a.gone).map(a => a.uid);
        if (!c || !same(c.sheet, { turn: pre.turn, uids: up })) return `the sheet is recorded as ${json(c && c.sheet)}, not ${json({ turn: pre.turn, uids: up })}`;
        for (const uid of up) if (!actor(post, uid).gone) return `${uid} is not gone under the sheet`;
        if (events.some(e => e.k === 'died' && up.includes(e.who))) return 'a piece died under the sheet: the sheet is no defeat';
        if (events.some(e => (e.k === 'dropped' && e.cause && e.cause.k === 'defeated') || (e.k === 'certificate' && e.cause && e.cause.k === 'defeat'))) return 'the sheet dropped a Signature piece or gave a Certificate by defeat';
        // The footprint, from the state before: floor or shards, no one else on it.
        const want = [], seen = [];
        for (const a of piecesOf(pre)) for (const [x, y] of homeTiles(a)) {
          if (seen.includes(x + ',' + y)) continue;
          seen.push(x + ',' + y);
          const ch = pre.dept.tiles[y] && pre.dept.tiles[y][x];
          if ((ch === '.' || ch === 'x') && !pre.actors.some(b => !b.gone && !up.includes(b.uid) && covers(b, x, y))) want.push({ k: 'sheet', x, y, of: a.uid });
        }
        const got = sheets(post).slice(sheets(pre).length);
        if (!same(got, want)) return `the sheet fixtures are ${json(got)}, not ${json(want)}`;
        for (const f of want) if (post.dept.tiles[f.y][f.x] !== 'f') return `the sheet's tile ${f.x},${f.y} is ${post.dept.tiles[f.y][f.x]}, not low furniture`;
        return null;
      },
    },
    {
      id: 'viewing.sheet',
      check(pre, events, post) {
        const was = cpOf(pre);
        if (!was || !was.sheet) return null;
        const c = cpOf(post);
        if (!c || !same(c.sheet, was.sheet)) return `the sheet changed from ${json(was.sheet)} to ${json(c && c.sheet)}`;
        if (!same(sheets(post), sheets(pre))) return 'the sheet fixtures changed';
        for (const f of sheets(post)) if (post.dept.tiles[f.y][f.x] !== 'f') return `the sheet's tile ${f.x},${f.y} became ${post.dept.tiles[f.y][f.x]}`;
        const under = was.sheet.uids;
        for (const uid of under) if (!actor(post, uid).gone) return `${uid} came out from under the sheet`;
        for (const e of events) if (under.includes(e.who) || (e.cause && under.includes(e.cause.by))) return `a piece under the sheet is named in ${json(e)}`;
        if (views(events).length) return 'a view was told under the sheet';
        if (c.sealed && !post.over && post.turn > was.sheet.turn) return 'the hall is still sealed after a turn boundary with the Centrepiece under its sheet';
        return null;
      },
    },
  ];
};
