'use strict';
// The comparison format of tools/oracle/SPEC.md §8 (revisions 5c and 5d: eight fields, tips among them), made canonical so two
// implementations can be compared by string, plus the mirror (x -> −x) and translation (x -> x + dX/2) of results,
// columns, drop logs and builds. A point is [X, p, q]: x = X/2, y = (p + q√3)/2.
//
// tips. The game's rules (DESIGN §18.7) give tips as {base: an index in the build (the new tile's is the build's
// length), members: sorted indices, side, pivot: [X, p, q], com: a number}; SPEC §8 gives {base: the base tile's verts,
// members: their number, side, pivot}. spec(r, tiles) maps the first to the second; tiles is rules.tiles(build) of the
// build the drop was made on (the new tile's verts are r.verts). A result whose tips are already SPEC's is left as it is.

const FIELDS = ['outcome', 'way', 'verts', 'reason', 'contacts', 'shine', 'gap', 'tips'];

function lex(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
function pt(p) { return [p[0] | 0, p[1] | 0, p[2] | 0]; }
function seg(s) { const a = pt(s[0]), b = pt(s[1]); return lex(a, b) <= 0 ? [a, b] : [b, a]; }
function segLex(s, r) { return lex(s[0], r[0]) || lex(s[1], r[1]); }
function sortPts(ps) { return ps.map(pt).sort(lex).filter((p, i, a) => i === 0 || lex(p, a[i - 1]) !== 0); }
function sortSegs(ss) { return ss.map(seg).sort(segLex); }

// SPEC §8's tips from the game's (see above); null stays null
function specTips(r, tiles) {
  const t = r.tips;
  if (t === undefined || t === null) return null;
  if (Array.isArray(t.base)) return { base: sortPts(t.base), members: t.members, side: t.side, pivot: t.pivot ? pt(t.pivot) : t.pivot };
  if (typeof t.base !== 'number') return { base: t.base, members: t.members, side: t.side, pivot: t.pivot };
  if (!tiles) throw new Error('canon: a TIPS OVER result from the game needs the build\'s tiles to name its base');
  const verts = t.base === tiles.length ? r.verts : tiles[t.base] ? tiles[t.base].verts : null;
  return { base: verts ? sortPts(verts) : 'no tile ' + t.base, members: Array.isArray(t.members) ? t.members.length : t.members, side: t.side, pivot: Array.isArray(t.pivot) ? pt(t.pivot) : t.pivot };
}
// r with its tips in SPEC §8's form, nothing else touched (the strict I1 comparison takes the rest exactly as given)
function spec(r, tiles) {
  if (!r || r.tips === undefined || r.tips === null || Array.isArray(r.tips.base)) return r;
  return Object.assign({}, r, { tips: specTips(r, tiles) });
}
// the canonical comparison object (exactly SPEC §8's fields, sorted as §8 says; extra fields such as pose dropped).
// tiles: rules.tiles() of the build the drop was made on, needed only for a TIPS OVER result of the game's
function canon(r, tiles) {
  return {
    outcome: r.outcome,
    way: r.way === undefined ? null : r.way,
    verts: sortPts(r.verts || []),
    reason: r.reason === undefined ? null : r.reason,
    contacts: { segments: sortSegs((r.contacts && r.contacts.segments) || []), points: sortPts((r.contacts && r.contacts.points) || []) },
    shine: sortSegs(r.shine || []),
    gap: r.gap ? [r.gap[0] | 0, r.gap[1] | 0] : null,
    tips: specTips(r, tiles)
  };
}
function str(r, tiles) { return JSON.stringify(canon(r, tiles)); }
// the fields where two results differ, as {field: [a, b]}; null when they agree (ta, tb: each one's build's tiles)
function diff(a, b, ta, tb) {
  const A = canon(a, ta), B = canon(b, tb), d = {};
  let any = false;
  for (const f of FIELDS) {
    const x = JSON.stringify(A[f]), y = JSON.stringify(B[f]);
    if (x !== y) { d[f] = [A[f], B[f]]; any = true; }
  }
  return any ? d : null;
}

// ---- mirror and translate ----
// a tile at col c spans x from c/2 to c/2 + 1; mirrored, it spans −c/2 − 1 to −c/2, so its col is −c − 2
function mirrorCol(col) { return -col - 2; }
// the side a mirrored part tips to
const MIRROR_SIDE = { left: 'right', right: 'left' };
function mapPts(r, f, tiles, mirror) {
  const c = canon(r, tiles);
  return canon({
    outcome: c.outcome, way: c.way, reason: c.reason, gap: c.gap,
    verts: c.verts.map(f),
    contacts: { segments: c.contacts.segments.map(s => [f(s[0]), f(s[1])]), points: c.contacts.points.map(f) },
    shine: c.shine.map(s => [f(s[0]), f(s[1])]),
    tips: c.tips ? { base: c.tips.base.map(f), members: c.tips.members, side: mirror ? MIRROR_SIDE[c.tips.side] : c.tips.side, pivot: f(c.tips.pivot) } : null
  });
}
function mirrorResult(r, tiles) { return mapPts(r, p => [-p[0], p[1], p[2]], tiles, true); }
function translateResult(r, dX, tiles) { return mapPts(r, p => [p[0] + dX, p[1], p[2]], tiles, false); }
function mirrorLog(log) { return log.map(e => ({ piece: e.piece, col: mirrorCol(e.col), way: e.way })); }
function translateLog(log, dX) { return log.map(e => ({ piece: e.piece, col: e.col + dX, way: e.way })); }

// replay a drop log on a new build; each drop must fit (throws otherwise)
function replay(R, half, log) {
  let B = R.newBuild({ half });
  for (const e of log) {
    const r = R.drop(B, e.piece, e.col, e.piece === 'sq' ? undefined : (e.way || undefined));
    if (r.outcome !== 'fit') throw new Error('replay: ' + e.piece + '@' + e.col + (e.way ? ' ' + e.way : '') + ' does not fit (' + r.reason + ')');
    B = R.place(B, r);
  }
  return B;
}
// a drop log written the way the golden cases are: '■1', '▲-1.5', '▼0.5' (x = col/2)
function parseDrop(s) {
  const m = /^([■▲▼])\s*(-?\d+(?:\.5)?)$/.exec(s.replace('−', '-').trim());
  if (!m) throw new Error('parseDrop: ' + s);
  const col = Math.round(parseFloat(m[2]) * 2);
  return m[1] === '■' ? { piece: 'sq', col, way: null } : { piece: 'tri', col, way: m[1] === '▲' ? 'up' : 'down' };
}
// a result in a few words: '▼ off ONLY A POINT', '■ fit'
function fmtOutcome(r) { return (r.way === null ? '■' : r.way === 'up' ? '▲' : r.way === 'down' ? '▼' : '?') + ' ' + r.outcome + (r.reason ? ' ' + r.reason : ''); }
function fmtDrop(e) { return (e.piece === 'sq' ? '■' : e.way === 'down' ? '▼' : e.way === 'up' ? '▲' : '△') + (e.col / 2); }

// exact ℚ(√3) values (p + q√3)/2 for drawing and reports
const R3 = Math.sqrt(3);
function yOf(p, q) { return (p + q * R3) / 2; }
function fmtH(pq) {
  if (!pq) return 'null';
  const [p, q] = pq, a = p / 2;
  // (p + q√3)/2 = a + (q/2)√3
  const k = q / 2, root = k === 0 ? '' : Math.abs(q) === 1 ? '√3/2' : Math.abs(q) === 2 ? '√3' : Math.abs(q) % 2 ? Math.abs(q) + '√3/2' : Math.abs(k) + '√3';
  let txt;
  if (!a && !k) txt = '0';
  else if (!k) txt = String(a);
  else if (!a) txt = (k < 0 ? '−' : '') + root;
  else txt = (a < 0 ? '−' + -a : a) + (k < 0 ? ' − ' : ' + ') + root;
  return txt + ' (' + yOf(p, q).toFixed(3) + ')';
}

module.exports = { FIELDS, canon, spec, specTips, str, diff, lex, mirrorCol, mirrorResult, translateResult, mirrorLog, translateLog, replay, parseDrop, fmtDrop, fmtOutcome, yOf, fmtH };
