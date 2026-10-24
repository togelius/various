'use strict';
// Grades the learner quiz (DESIGN §18.8 G4) against its key (tools/learn/quiz.cjs writes both):
// - a learner's answers: overall, per stratum, which way up, where can it go (F1 over the lettered columns), the clear
//   tip items, the ghost items and the perception probes;
// - the three baselines on the same items: always STAYS, always FALLS OFF, and "it stays if the thing under its middle
//   is flat" (the topmost thing under the middle of the tile's bottom, a ▼'s point, is the car, a square's top or a ▼'s
//   top); their counterparts for the other kinds are shown too;
// - the pass bars of §18.8: probes at least 90% (or the learner's run is void); fit items at least 85%, at least 15
//   points above the best baseline, every stratum at least 70%; which-way and tip items at least 85%, the tip items also
//   at least 15 points above the best baseline on them; where-can-it-go F1 at least 0.85; with the ghost shown at least
//   95%; the write-up at least 8 of 10 (tools/learn/checklist.json);
// - every wrong answer, for triage (perception: a rendering bug; belief: a teaching bug; intuition: a question for the
//   designer). A wrong answer on an item whose probe was also missed is marked "perception?".
//   node tools/learn/grade.cjs --key=<key.json> [--answers=<answers.json>] [--frozen=<answers-part1.json>]
//                              [--writeup=<points of 10>] [--json=<out.json>]
// Without --answers it grades the baselines alone. --frozen: the part 1 answers kept when the ghost items were handed
// out (quiz.cjs --hand-out, <root>/.audit/answers-part1.json): they stand for every item of part 1, whatever the answers
// file says now. Answers: the JSON of answers-template.json filled in ({"1": "STAYS",
// "1p": "3", "113": "B D", ...}), or text lines "1: STAYS".
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const A = L.args();
const KEY = path.resolve(A.key || path.join(L.SCRATCH, 'learn-quiz', 'key', 'key.json'));

// ---- reading answers ----
const word = s => String(s === undefined || s === null ? '' : s).trim().toUpperCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ');
function normFit(s) {
  const w = word(s);
  if (/^(STAYS?|FITS?|YES|Y|S|STAYS ON|IT STAYS)$/.test(w)) return 'STAYS';
  if (/^(FALLS? OFF|FALLS?|OFF|NO|N|F|IT FALLS( OFF)?|FALLS OFF:? .*)$/.test(w)) return 'FALLS OFF';
  return null;
}
function normWay(s) {
  const w = word(s);
  if (/^(UP|U|▲|POINT UP|POINT-UP)$/.test(w)) return 'UP';
  if (/^(DOWN|D|▼|POINT DOWN|POINT-DOWN)$/.test(w)) return 'DOWN';
  return null;
}
function normTip(s) {
  const w = word(s);
  if (/^(FALLS?( OVER)?|YES|Y|F|TIPS?( OVER)?|IT FALLS( OVER)?|CRASH(ES)?)$/.test(w)) return 'FALLS';
  if (/^(STANDS?( UP)?|NO|N|S|STAYS?( UP)?|IT STANDS)$/.test(w)) return 'STANDS';
  return null;
}
function normSet(s) {
  if (Array.isArray(s)) s = s.join(' ');
  const w = word(s);
  if (w === '' || /^(NONE|NOWHERE|-|—|NO)$/.test(w)) return [];
  const toks = w.split(/[^A-Z0-9]+/).filter(Boolean);
  return Array.from(new Set(toks.filter(t => /^[A-I]$/.test(t)))).sort();
}
const normProbe = s => word(s).replace(/[\s_-]+/g, '').replace(/^THE/, '');
function readAnswers(f) {
  const txt = fs.readFileSync(f, 'utf8');
  try { return JSON.parse(txt); } catch (e) {
    const o = {};
    for (const line of txt.split('\n')) { const m = /^\s*(\d+p?)\s*[:=)\t ]\s*(.*)$/i.exec(line); if (m) o[m[1].toLowerCase()] = m[2].trim(); }
    return o;
  }
}

// ---- scoring ----
const pct = (a, b) => b ? a / b : NaN;
const fmtP = x => isNaN(x) ? '  -  ' : (100 * x).toFixed(1).padStart(5) + '%';
function scoreFit(items, get) {
  let ok = 0;
  const by = {};
  for (const it of items) {
    const g = get(it), right = g === it.answer;
    if (right) ok++;
    const s = it.stratum || '-';
    by[s] = by[s] || { ok: 0, n: 0 }; by[s].n++; if (right) by[s].ok++;
  }
  return { ok, n: items.length, acc: pct(ok, items.length), by };
}
function scoreWhere(items, get) {
  let tp = 0, fp = 0, fn = 0, exact = 0;
  for (const it of items) {
    const g = new Set(get(it) || []), k = new Set(it.answer);
    let t = 0;
    for (const x of g) if (k.has(x)) t++;
    tp += t; fp += g.size - t; fn += k.size - t;
    if (t === k.size && g.size === k.size) exact++;
  }
  const P = tp + fp ? tp / (tp + fp) : (fn ? 0 : 1), Rc = tp + fn ? tp / (tp + fn) : 1;
  return { tp, fp, fn, precision: P, recall: Rc, f1: P + Rc ? 2 * P * Rc / (P + Rc) : 0, exact, n: items.length };
}
function baselines(key) {
  const fit = key.items.filter(i => i.kind === 'fit'), ghost = key.items.filter(i => i.kind === 'ghost'), way = key.items.filter(i => i.kind === 'way');
  const where = key.items.filter(i => i.kind === 'where'), tip = key.items.filter(i => i.kind === 'tip');
  const B = {
    'always STAYS': { fit: scoreFit(fit, () => 'STAYS'), ghost: scoreFit(ghost, () => 'STAYS'), way: scoreFit(way, () => 'UP'), where: scoreWhere(where, it => it.columns.map(c => c.label)), tip: scoreFit(tip, () => 'STANDS'),
      note: 'way: always UP; where: every column; tip: always STANDS' },
    'always FALLS OFF': { fit: scoreFit(fit, () => 'FALLS OFF'), ghost: scoreFit(ghost, () => 'FALLS OFF'), way: scoreFit(way, () => 'DOWN'), where: scoreWhere(where, () => []), tip: scoreFit(tip, () => 'FALLS'),
      note: 'way: always DOWN; where: no column; tip: always FALLS' },
    'flat under the middle': { fit: scoreFit(fit, it => it.flat ? 'STAYS' : 'FALLS OFF'), ghost: scoreFit(ghost, it => it.flat ? 'STAYS' : 'FALLS OFF'), way: scoreFit(way, it => it.flat ? 'UP' : 'DOWN'),
      where: scoreWhere(where, it => it.flatSet || []), tip: scoreFit(tip, it => it.weight && Math.abs(it.weight.x) > it.weight.wheel / 2 ? 'FALLS' : 'STANDS'),
      note: 'way: UP over a flat top, else DOWN; where: the columns over a flat top; tip: FALLS when the weight is past half way to a wheel' }
  };
  return B;
}

function grade(key, ans) {
  const get = (it, f) => f(ans[String(it.n)]);
  const kinds = k => key.items.filter(i => i.kind === k);
  const fit = scoreFit(kinds('fit'), it => get(it, normFit));
  const ghost = scoreFit(kinds('ghost'), it => get(it, normFit));
  const way = scoreFit(kinds('way'), it => get(it, normWay));
  const tip = scoreFit(kinds('tip'), it => get(it, normTip));
  const where = scoreWhere(kinds('where'), it => get(it, normSet));
  const pr = key.items.filter(i => i.probe);
  const probeOk = pr.filter(it => normProbe(ans[it.n + 'p']) === normProbe(it.probe.a));
  const probes = { ok: probeOk.length, n: pr.length, acc: pct(probeOk.length, pr.length) };
  const wrong = [];
  const missedProbe = new Set(pr.filter(it => !probeOk.includes(it)).map(it => it.n));
  for (const it of key.items) {
    const raw = ans[String(it.n)];
    let given, right;
    if (it.kind === 'fit' || it.kind === 'ghost') { given = normFit(raw); right = given === it.answer; }
    else if (it.kind === 'way') { given = normWay(raw); right = given === it.answer; }
    else if (it.kind === 'tip') { given = normTip(raw); right = given === it.answer; }
    else { given = normSet(raw); right = given.join(' ') === it.answer.slice().sort().join(' '); }
    if (!right) wrong.push({ n: it.n, kind: it.kind, stratum: it.stratum || null, given: raw === undefined ? '(none)' : raw, read: Array.isArray(given) ? given.join(' ') || 'NONE' : given, answer: Array.isArray(it.answer) ? it.answer.join(' ') || 'NONE' : it.answer,
      reason: it.reason || it.wrongReason || null, build: it.build.join(' '), hand: it.hand, sheet: it.sheet, perception: missedProbe.has(it.n) });
    if (it.probe && missedProbe.has(it.n)) wrong.push({ n: it.n + 'p', kind: 'probe', stratum: it.probe.kind, given: ans[it.n + 'p'] === undefined ? '(none)' : ans[it.n + 'p'], answer: it.probe.a, question: it.probe.q, build: it.build.join(' '), hand: it.hand, sheet: it.sheet });
  }
  return { fit, ghost, way, tip, where, probes, wrong };
}

function bars(key, g, B, writeup) {
  const pb = key.passBars, bestBase = Math.max(...Object.values(B).map(b => b.fit.acc)), bestTip = Math.max(...Object.values(B).map(b => b.tip.acc));
  const strata = Object.entries(g.fit.by).map(([s, v]) => [s, v.ok / v.n]);
  const lowest = strata.reduce((m, x) => x[1] < m[1] || m[0] === '-' ? x : m, ['-', 1]);
  const out = [
    { bar: 'perception probes ≥ ' + 100 * pb.probes + '% (else the run is void)', value: g.probes.acc, pass: g.probes.acc >= pb.probes },
    { bar: 'fit items ≥ ' + 100 * pb.fit + '%', value: g.fit.acc, pass: g.fit.acc >= pb.fit },
    { bar: 'fit items ≥ best baseline (' + fmtP(bestBase).trim() + ') + ' + 100 * pb.fitOverBaseline + ' points', value: g.fit.acc, pass: g.fit.acc >= bestBase + pb.fitOverBaseline - 1e-9 },
    { bar: 'every stratum ≥ ' + 100 * pb.stratum + '% (lowest: ' + lowest[0] + ')', value: lowest[1], pass: lowest[1] >= pb.stratum },
    { bar: 'which way up ≥ ' + 100 * pb.way + '%', value: g.way.acc, pass: g.way.acc >= pb.way },
    { bar: 'clear tip items ≥ ' + 100 * pb.tip + '%', value: g.tip.acc, pass: g.tip.acc >= pb.tip },
    { bar: 'tip items ≥ best baseline on them (' + fmtP(bestTip).trim() + ') + ' + 100 * (pb.tipOverBaseline || 0.15) + ' points', value: g.tip.acc, pass: g.tip.acc >= bestTip + (pb.tipOverBaseline || 0.15) - 1e-9 },
    { bar: 'where can it go F1 ≥ ' + pb.whereF1, value: g.where.f1, pass: g.where.f1 >= pb.whereF1, f1: true },
    { bar: 'with the ghost shown ≥ ' + 100 * pb.ghost + '%', value: g.ghost.acc, pass: g.ghost.acc >= pb.ghost }
  ];
  if (writeup !== undefined) out.push({ bar: 'write-up ≥ ' + pb.writeup + ' of 10', value: writeup, pass: writeup >= pb.writeup, points: true });
  return out;
}

function printBaselines(key, B) {
  console.log('Baselines on the same items:');
  console.log('  ' + 'baseline'.padEnd(24) + 'fit'.padStart(7) + 'ghost'.padStart(8) + 'way'.padStart(8) + '  where F1' + '   tip');
  for (const [name, b] of Object.entries(B)) console.log('  ' + name.padEnd(24) + fmtP(b.fit.acc).padStart(7) + fmtP(b.ghost.acc).padStart(8) + fmtP(b.way.acc).padStart(8) + ('   ' + b.where.f1.toFixed(3)).padStart(10) + (b.tip ? fmtP(b.tip.acc).padStart(8) : '     -') + '   (' + b.note + ')');
  const strata = key.strata.map(s => s.id);
  console.log('  per stratum (fit items):');
  console.log('    ' + 'stratum'.padEnd(11) + Object.keys(B).map(n => n.padStart(24)).join(''));
  for (const s of strata) console.log('    ' + s.padEnd(11) + Object.values(B).map(b => { const v = b.fit.by[s]; return (v ? v.ok + '/' + v.n + ' ' + fmtP(v.ok / v.n) : '-').padStart(24); }).join(''));
  const best = Math.max(...Object.values(B).map(b => b.fit.acc)), bestTip = Math.max(...Object.values(B).map(b => b.tip.acc));
  console.log(`  best baseline on the fit items: ${fmtP(best).trim()}, so the fit bar is ${fmtP(Math.max(key.passBars.fit, best + key.passBars.fitOverBaseline)).trim()}`);
  console.log(`  best baseline on the tip items: ${fmtP(bestTip).trim()}, so the tip bar is ${fmtP(Math.max(key.passBars.tip, bestTip + (key.passBars.tipOverBaseline || 0.15))).trim()}`);
}

const USAGE = `usage: node tools/learn/grade.cjs [--key=<key.json>] [--answers=<answers.json>] [--writeup=<0-10>] [--learner=name] [--json=<out.json>]
  scores a learner's answers against the quiz key (default ${KEY}): fit items overall and per stratum, which way
  up, where-can-it-go F1, tip items, ghost items and probes; the three baselines (always STAYS, always FALLS OFF,
  flat under the middle); the pass bars of DESIGN §18.8; and every wrong answer for triage.
  Without --answers: the baselines only. --writeup: the write-up's points on tools/learn/checklist.json.`;
function main() {
  if (A.help) { console.log(USAGE); return; }
  const key = JSON.parse(fs.readFileSync(KEY, 'utf8'));
  const B = baselines(key);
  console.log(`CLACK STACK learner quiz: ${key.items.length} items (${Object.entries(key.counts).map(([k, v]) => k + ' ' + v).join(', ')}, ${key.probes} probes), rules ${key.rules.sha}${key.rules.same ? '' : ' (the page had other rules: ' + key.rules.page + ')'}`);
  printBaselines(key, B);
  const result = { key: KEY, baselines: B };
  if (A.answers) {
    const ans = readAnswers(path.resolve(A.answers));
    if (A.frozen) {
      // the part 1 answers as handed in: they stand for part 1's items (and their probes), whatever the file says now
      const fz = JSON.parse(fs.readFileSync(path.resolve(A.frozen), 'utf8')), p1 = new Set(((key.parts || {})[1] || {}).items || []);
      let changed = 0;
      for (const k of Object.keys(ans)) { const n = parseInt(k, 10); if (p1.has(n) && !(k in fz.answers)) { delete ans[k]; changed++; } }
      for (const [k, v] of Object.entries(fz.answers)) { if (ans[k] !== v) changed++; ans[k] = v; }
      console.log(`part 1 answers taken as handed in (${A.frozen}, ${fz.at}): ${changed} fields differ in ${A.answers}`);
    }
    const g = grade(key, ans), writeup = A.writeup !== undefined ? +A.writeup : undefined, bs = bars(key, g, B, writeup);
    console.log('\nLearner: ' + (A.learner || path.basename(path.dirname(path.resolve(A.answers)))));
    // overall: every item but the probes (a where-can-it-go item counts when its set is exactly right)
    const allOk = g.fit.ok + g.way.ok + g.tip.ok + g.ghost.ok + g.where.exact, allN = g.fit.n + g.way.n + g.tip.n + g.ghost.n + g.where.n;
    g.overall = { ok: allOk, n: allN, acc: pct(allOk, allN) };
    console.log(`  overall       ${allOk}/${allN} ${fmtP(g.overall.acc)}  (every item but the probes; where-can-it-go counted when exactly right)`);
    console.log(`  fit items     ${g.fit.ok}/${g.fit.n} ${fmtP(g.fit.acc)}`);
    for (const s of key.strata) { const v = g.fit.by[s.id]; if (v) console.log(`    ${s.id.padEnd(10)} ${v.ok}/${v.n} ${fmtP(v.ok / v.n)}`); }
    console.log(`  which way up  ${g.way.ok}/${g.way.n} ${fmtP(g.way.acc)}`);
    console.log(`  where         F1 ${g.where.f1.toFixed(3)} (precision ${g.where.precision.toFixed(3)}, recall ${g.where.recall.toFixed(3)}, ${g.where.exact}/${g.where.n} exactly right)`);
    console.log(`  tip items     ${g.tip.ok}/${g.tip.n} ${fmtP(g.tip.acc)}`);
    console.log(`  ghost items   ${g.ghost.ok}/${g.ghost.n} ${fmtP(g.ghost.acc)}`);
    console.log(`  probes        ${g.probes.ok}/${g.probes.n} ${fmtP(g.probes.acc)}`);
    console.log('Pass bars (§18.8):');
    for (const b of bs) console.log(`  ${b.pass ? 'PASS' : 'FAIL'}  ${b.bar}: ${b.f1 ? b.value.toFixed(3) : b.points ? b.value + '/10' : fmtP(b.value).trim()}`);
    const voidRun = !bs[0].pass, all = bs.every(b => b.pass);
    console.log(voidRun ? 'VOID: the probes are under the bar, so this learner\'s run does not count' : all ? 'ALL BARS PASS' : 'SOME BARS FAIL');
    if (writeup === undefined) console.log('  (no --writeup given: grade the write-up against tools/learn/checklist.json)');
    console.log(`\nWrong answers (${g.wrong.length}), for triage as perception (a rendering bug), belief (a teaching bug) or intuition (a question for the designer):`);
    for (const w of g.wrong) {
      if (w.kind === 'probe') console.log(`  ${String(w.n).padStart(5)} probe ${w.stratum}: gave "${w.given}", is "${w.answer}" (${w.question}) [${w.sheet}] ${w.build}`);
      else console.log(`  ${String(w.n).padStart(5)} ${w.kind}${w.stratum ? ' ' + w.stratum : ''}: gave "${w.given}"${w.read && w.read !== w.given ? ' (read ' + w.read + ')' : ''}, is ${w.answer}${w.reason ? ' (' + w.reason + ')' : ''}${w.perception ? '  perception? (its probe was missed too)' : ''} [${w.sheet}] ${w.build} + ${w.hand}`);
    }
    Object.assign(result, { learner: A.learner || null, grade: g, bars: bs, void: voidRun, pass: all });
  }
  if (A.json) { L.writeJSON(path.resolve(A.json), result); console.log('wrote ' + path.resolve(A.json)); }
}
if (require.main === module) main();
module.exports = { normFit, normWay, normTip, normSet, normProbe, grade, baselines, bars, scoreWhere };
