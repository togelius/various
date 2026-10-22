'use strict';
// The comparison format of tools/oracle/SPEC.md §8, made canonical so two implementations can be compared by string,
// plus the mirror (x -> −x) and translation (x -> x + dX/2) of results, columns, drop logs and builds.
// A point is [X, p, q]: x = X/2, y = (p + q√3)/2.

const FIELDS = ['outcome', 'way', 'verts', 'reason', 'contacts', 'shine', 'strips', 'gap'];

function lex(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
function pt(p) { return [p[0] | 0, p[1] | 0, p[2] | 0]; }
function seg(s) { const a = pt(s[0]), b = pt(s[1]); return lex(a, b) <= 0 ? [a, b] : [b, a]; }
function segLex(s, r) { return lex(s[0], r[0]) || lex(s[1], r[1]); }
function sortPts(ps) { return ps.map(pt).sort(lex).filter((p, i, a) => i === 0 || lex(p, a[i - 1]) !== 0); }
function sortSegs(ss) { return ss.map(seg).sort(segLex); }

// the canonical comparison object (exactly SPEC §8's fields, sorted as §8 says; extra fields such as pose dropped)
function canon(r) {
  return {
    outcome: r.outcome,
    way: r.way === undefined ? null : r.way,
    verts: sortPts(r.verts || []),
    reason: r.reason === undefined ? null : r.reason,
    contacts: { segments: sortSegs((r.contacts && r.contacts.segments) || []), points: sortPts((r.contacts && r.contacts.points) || []) },
    shine: sortSegs(r.shine || []),
    strips: [!!(r.strips && r.strips[0]), !!(r.strips && r.strips[1])],
    gap: r.gap ? [r.gap[0] | 0, r.gap[1] | 0] : null
  };
}
function str(r) { return JSON.stringify(canon(r)); }
// the fields where two results differ, as {field: [a, b]}; null when they agree
function diff(a, b) {
  const A = canon(a), B = canon(b), d = {};
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
function mapPts(r, f) {
  const c = canon(r);
  return canon({
    outcome: c.outcome, way: c.way, reason: c.reason, gap: c.gap, strips: c.strips,
    verts: c.verts.map(f),
    contacts: { segments: c.contacts.segments.map(s => [f(s[0]), f(s[1])]), points: c.contacts.points.map(f) },
    shine: c.shine.map(s => [f(s[0]), f(s[1])])
  });
}
function mirrorResult(r) { const m = mapPts(r, p => [-p[0], p[1], p[2]]); m.strips = [m.strips[1], m.strips[0]]; return m; }
function translateResult(r, dX) { return mapPts(r, p => [p[0] + dX, p[1], p[2]]); }
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
// a result in a few words: '▼ off TOO FAR OUT', '■ fit'
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

module.exports = { FIELDS, canon, str, diff, lex, mirrorCol, mirrorResult, translateResult, mirrorLog, translateLog, replay, parseDrop, fmtDrop, fmtOutcome, yOf, fmtH };
