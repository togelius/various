'use strict';
// The learner quiz (DESIGN §18.8 G4): items made from rules.js when this runs (tools/learn/items.cjs), drawn by the
// game's own renderer through ?quiz= at 390x844 with every layer that would give an answer away hidden (the ghost and
// its column, shine, chip, reason labels and marks, the fit markers and ticks, the ghost weight, the hints, and the red
// or amber rims of the tile in the hand), cut to the hand and the tower, and laid out in sheets of 6 with large item
// numbers.
//   96 fit items, 12 strata of 4 minimal pairs (half stay), TIPS OVER pairs and whole-edge-lock pairs among them
//   16 which-way-up items, 12 where-can-it-go items (the answer: a set of lettered columns)
//   24 tip items: does letting go now take the tower over a wheel? With clear margins, decided by the game itself (its
//      weight and sway, looked at by its own look-ahead and then let go for real at three moments). They are made so
//      that where the weight hangs in the picture does not answer them alone (the baseline "it falls when the weight is
//      past half way to a wheel" scores at most 70%): towers whose swing decides (the weight inside half way, swinging,
//      and the drop takes it over) and drops whose side decides (the weight past half way, and a counterweight on the
//      other side keeps it up; best in the same picture as a drop on the weight's side that falls)
//   24 ghost items: one more pair per stratum with the ghost shown (the bar "with the ghost shown, at least 95%")
//   perception probes on a third of the items (how many tiles touch the car, the colour directly under the hand, ...)
// The pictures: the game's own screen at 390x844, drawn at twice the pixels and cut to the hand and the tower (the car,
// the tiles, the hand), shown at that size, four to a sheet.
// Writes to --out (default <scratch>/learn-quiz): sheet-NN.png, instructions.txt and answers-template.json for items 1 to
// the last tip item, held/ the ghost items' sheets and their instructions and template (handed out only once the first
// answers are in), and key/key.json (never for the learner: the answers, every item's build, the baselines' predictions).
//   node tools/learn/quiz.cjs [--seed=1] [--depth=5] [--out=dir] [--scenes=400] [--no-render]
// Handing it out (the learner's root: the folder holding its run folders; tools/learn/driver.cjs):
//   node tools/learn/quiz.cjs --hand-out=<root> --part=1 [--out=dir]   closes the game for that learner (every driver op
//        that plays is refused from now on) and copies the first sheets, instructions and template into <root>/quiz/
//   node tools/learn/quiz.cjs --hand-out=<root> --part=2 [--out=dir]   once <root>/quiz/answers.json answers every item
//        of part 1: keeps a copy of it (<root>/.audit/answers-part1.json, what the grader takes for those items:
//        grade.cjs --frozen) and copies the ghost items' sheets, instructions and template into <root>/quiz/
// The rules come from rules.js; the pictures from index.html, whose inlined rules should be the same (a warning says
// when they are not, and an item whose build the page cannot place is dropped and reported).
if (require.main === module && !process.execArgv.some(a => a.startsWith('--max-old-space-size'))) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=8192', __filename].concat(process.argv.slice(2)), { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./lib.cjs');
const I = require('./items.cjs');
const lib = require('../review/lib.cjs');
const rulesVm = require('../lib/rules-vm.cjs');

const A = L.args();
const SEED = +(A.seed || 1), DEPTH = +(A.depth || 5), OUT = path.resolve(A.out || path.join(L.SCRATCH, 'learn-quiz')), SCENES = +(A.scenes || 400);
const R = lib.rules();
const rnd = lib.rng(SEED * 7919 + 3);

// layers hidden: every one that tells the answer, and the HUD (not part of any question)
// (props, propFlash: revision 5e's double bar where a fit leans on the square beside it; it is drawn with the ghost, so
// it goes with it too, and named here all the same)
const OFF_ANSWER = ['ghost', 'column', 'shine', 'chip', 'reason', 'marks', 'aimRock', 'callout', 'ghostGaps', 'props', 'propFlash', 'markers', 'ticks', 'ghostWeight', 'hint', 'handTint'];
const OFF_HUD = ['hud', 'next', 'counter', 'box', 'fuse', 'swap', 'knock'];
const OFF = {
  fit: OFF_ANSWER.concat(OFF_HUD, ['weight']),
  way: OFF_ANSWER.concat(OFF_HUD, ['weight', 'hand']),
  where: OFF_ANSWER.concat(OFF_HUD, ['weight', 'hand']),
  tip: OFF_ANSWER.concat(OFF_HUD),
  ghost: OFF_HUD.concat(['markers', 'ticks', 'ghostWeight', 'hint', 'weight'])
};
const PROMPT = {
  fit: 'Let go here: STAYS or FALLS OFF?',
  way: 'Let go at the mark: which way up stays, UP ▲ or DOWN ▼?',
  where: 'Where does it stay? The letters (or NONE)',
  tip: 'Let go now: does the tower FALL over, or STAND?',
  ghost: 'Let go here: STAYS or FALLS OFF?'
};
const PALETTE = L.PALETTE;
const fmtE = e => I.fmt(e.piece, e.col, e.way);
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

// ---- colours: tiles that touch never share a colour ----
const colours = (T, r) => L.colours(T.map(lib.polyOf), r);

// ---- probes: what the picture shows, never what the rules say ----
function probeFor(it, kind, T, cols) {
  if (kind === 'car') return { kind, q: 'How many tiles touch the car?', a: String(I.onCar(T)) };
  if (kind === 'count') return { kind, q: 'How many tiles are in the tower (not the one in the hand)?', a: String(T.length) };
  if (kind === 'down') return { kind, q: 'How many triangles in the tower point down (▼)?', a: String(T.filter(t => t.way === 'down').length) };
  if (kind === 'under') {
    if (it.hand.col === null || it.hand.col === undefined) return null;
    const s = I.topAtX(T, it.hand.col / 2 + 0.5);
    if (!s.same || s.left.i < 0) return null;
    return { kind, q: it.kind === 'way' ? 'What colour is the tile directly under the middle of the mark?' : 'What colour is the tile directly under the middle of the tile in the hand?', a: L.COLOR_NAMES[cols[s.left.i]] };
  }
  return null;
}
function addProbes(items) {
  // a third of the items (none of the ghost items), spread over the kinds; the kinds of question in turn
  const cands = items.filter(it => it.kind !== 'ghost');
  const want = Math.round(cands.length / 3), order = lib.rng(SEED + 11).shuffle(cands.slice());
  const kinds = ['under', 'car', 'count', 'down'];
  let k = 0, n = 0;
  for (const it of order) {
    if (n >= want) break;
    if (it.kind === 'tip') { it.probeWant = 'wheel'; n++; continue; }
    const T = R.tiles(I.buildOf(it.build));
    if (!T.length) continue;
    let p = null;
    for (let tries = 0; tries < kinds.length && !p; tries++) { p = probeFor(it, kinds[(k + tries) % kinds.length], T, it.colors); if (p && p.kind === 'down' && p.a === '0' && tries < 3) p = null; }
    k++;
    if (p) { it.probe = p; n++; }
  }
}

// ---- the tip items: scenes of towers, some swaying, and drops the game itself says take it over or not ----
function botBuild(policy, n, r) {
  let B = R.newBuild({ half: 2 });
  const log = [];
  for (let i = 0; i < n; i++) {
    const piece = r() < 0.72 ? 'sq' : 'tri';
    const opts = R.fitsAll(B, piece).filter(x => x.outcome === 'fit');
    if (!opts.length) continue;
    const yv = o => lib.yv(o.pose.y), mid = o => o.pose.col / 2 + 0.5;
    let o;
    if (policy === 'spire') o = opts.slice().sort((a, b) => yv(b) - yv(a) || Math.abs(mid(a)) - Math.abs(mid(b)))[0];
    else if (policy === 'side') o = opts.slice().sort((a, b) => (mid(b) - mid(a)) * 2 + (yv(b) - yv(a)) * 0.3)[0];
    else if (policy === 'wide') o = opts.slice().sort((a, b) => yv(a) - yv(b) || Math.abs(mid(a)) - Math.abs(mid(b)))[0];
    else o = r.pick(opts);
    B = R.place(B, o);
    log.push({ piece, col: o.pose.col, way: o.way });
  }
  return log;
}
async function tipItems(browser, want) {
  const { context } = await L.phoneContext(browser);
  const WORKERS = 4, pages = [];
  for (let k = 0; k < WORKERS; k++) pages.push(await context.newPage());
  const r = lib.rng(SEED * 31 + 5);
  // (false when the page could not place the build: its inlined rules are not rules.js)
  const load = async (page, q) => {
    await page.goto(L.gameUrl({ quiz: JSON.stringify(q), mute: 1 }), { waitUntil: 'load' });
    return page.evaluate(n => typeof CS === 'object' && CS.state().phase === 'play' && CS.tiles().length === n, q.build.length);
  };
  // let go after `delay` s (or never), then watch the weight for 3 s (the next tile's fuse is longer): did the tower
  // crash, how near a wheel did the weight come
  const watch = (page, delay, drop) => page.evaluate(async ([delay, drop]) => {
    if (delay > 0) CS.wait(delay);
    const id0 = CS.lastRelease ? CS.lastRelease.id : 0;
    if (drop && CS.state().phase === 'play') window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    const let_ = (CS.lastRelease ? CS.lastRelease.id : 0) !== id0;
    let maxW = 0, crash = false;
    for (let t = 0; t < 3.0 - 1e-9; t += 0.05) {
      const s = CS.state();
      if (s.phase !== 'play') { crash = s.phase === 'crash' || CS.events.some(e => e.type === 'crash'); break; }
      maxW = Math.max(maxW, Math.abs(s.weight.x));
      CS.wait(0.05);
    }
    if (!crash && CS.events.some(e => e.type === 'crash')) crash = true;
    return { let: let_, crash, maxW, wheel: CS.state().weight.wheel };
  }, [delay, drop]);
  const qOf = (sc, col, way) => ({ build: sc.log.map(e => [e.piece, e.col, null, e.way || undefined]), hand: { piece: sc.piece, col }, way: sc.piece === 'tri' ? way : undefined, off: OFF.tip, sway: sc.sway });
  // a drop is clear when the game agrees at three moments of letting go (now, 0.05 s and 0.1 s later): FALLS crashes
  // every time; STANDS never does and keeps the weight at least 0.35 tile inside the wheels
  const verify = async (page, sc, d, answer) => {
    const runs = [];
    for (const delay of [0, 0.05, 0.1]) {
      if (!(await load(page, qOf(sc, d.col, d.way)))) return null;
      const w = await watch(page, delay, true);
      runs.push(w);
      if (answer === 'FALLS' ? !(w.let && w.crash) : !(w.let && !w.crash && w.maxW <= w.wheel - 0.35)) return null;
    }
    return runs;
  };
  // a scene (drawn from the seed, in order): two in three are risky (tall, swaying), the rest calm
  const sceneSpec = s => {
    const risky = s % 3 !== 2;
    const pol = risky ? r.pick(['spire', 'spire', 'side']) : r.pick(['random', 'wide', 'spire']);
    const n = risky ? 9 + r.int(9) : 5 + r.int(10), log = botBuild(pol, n, r);
    const m = r() < 0.5, show = m ? lib.canon.mirrorLog(log) : log;
    const piece = r() < 0.65 ? 'sq' : 'tri';
    // (a still shows a sway only as a lean: the swing is caught where it leans farthest, or on its way there, an eighth
    // of a swing before)
    const ph = r() < 0.5 ? 0 : +(7 * Math.PI / 4).toFixed(4);
    const sway = risky ? { W: +(0.15 + 0.35 * r()).toFixed(3), phase: ph, dir: r() < 0.5 ? -1 : 1 } : r() < 0.4 ? null : { W: +(0.03 + 0.15 * r()).toFixed(3), phase: ph, dir: r() < 0.5 ? -1 : 1 };
    const sh = lib.rng(SEED * 1009 + s);
    return { id: s, log: show, policy: pol, piece, sway, risky, ok: log.length >= 4, sh };
  };
  // one scene looked at in full: every fitting drop by the game's look-ahead, the tower left alone, and the first FALLS
  // and STANDS that hold when let go for real
  const evalScene = async (page, sc) => {
    if (!sc.ok || !(await load(page, qOf(sc, 0)))) return null;
    const drops = await page.evaluate(() => CS.drops(true).map(d => ({ col: d.handCol, fit: d.outcome === 'fit', way: d.way, tip: !!d.tip, lo: d.lo, hi: d.hi, settle: d.settle })));
    const w0 = await page.evaluate(() => CS.state().weight);
    if (Math.abs(w0.x) > w0.wheel) return null; // past a wheel already: going over whatever is let go
    const still = await watch(page, 0, false);
    Object.assign(sc, { fallsAnyway: still.crash, w0: w0.x, wheel: w0.wheel });
    const fits = drops.filter(d => d.fit);
    // from the picture: a FALLS adds weight on the side the weight already hangs toward, at least 0.6 of the way out to
    // the wheel, or (the swing decides) the weight is inside half way in a tower visibly swaying, and the game says the
    // drop takes it over; a STANDS goes on the other side (or the middle), or the tower's weight is in the middle third.
    // hard: the weight's place alone (past half way: FALLS) would answer it wrongly
    const side = d => Math.sign(d.col / 2 + 0.5), wSide = Math.sign(w0.x), out_ = Math.abs(w0.x) / w0.wheel, past = out_ > 0.5;
    const swinging = !!(sc.sway && sc.sway.W >= 0.15);
    const falls = sc.sh.shuffle(fits.filter(d => d.tip && ((out_ >= 0.6 && side(d) === wSide) || (!past && swinging))));
    const stands = sc.sh.shuffle(fits.filter(d => !d.tip && Math.max(Math.abs(d.lo), Math.abs(d.hi)) <= w0.wheel - 0.35 && (out_ <= 0.35 || side(d) !== wSide || Math.abs(d.col / 2 + 0.5) < 0.3)));
    const out = { sc, n: fits.length, falls: null, stands: null };
    for (const d of falls.slice(0, 2)) { const runs = await verify(page, sc, d, 'FALLS'); if (runs) { out.falls = { sc, d, answer: 'FALLS', runs, hard: !past }; break; } }
    // (a STANDS where the weight hangs past half way: the drop's side decides; worth trying even without a FALLS here)
    if (!still.crash && (out.falls || out_ <= 0.35 || past)) for (const d of stands.slice(0, out.falls || past ? 3 : 1)) { const runs = await verify(page, sc, d, 'STANDS'); if (runs) { out.stands = { sc, d, answer: 'STANDS', runs, hard: past }; break; } }
    return out;
  };
  // Every scene is looked at in order until there are enough of each kind: half FALLS, half STANDS, and of each at least
  // HARD that the weight's place alone answers wrongly (so that baseline scores at most 1 - 2·HARD/want: 58% at 5 of 24)
  const HARD = Math.ceil(want * 5 / 24), poolF = [], poolS = [];
  const enough = () => poolF.length >= want / 2 && poolS.length >= want / 2 && poolF.filter(c => c.hard).length >= HARD && poolS.filter(c => c.hard).length >= HARD;
  let scenes = 0, nc = 0, s = 0;
  while (s < SCENES && !enough()) {
    const batch = [];
    for (let k = 0; k < 2 * WORKERS && s < SCENES; k++) batch.push(sceneSpec(s++));
    // the batch in parallel, two scenes a page; taken in the scenes' order (the same items every run)
    const res = new Array(batch.length);
    await Promise.all(pages.map(async (page, w) => { for (let k = w; k < batch.length; k += WORKERS) res[k] = await evalScene(page, batch[k]); }));
    for (const x of res) {
      if (!x) continue;
      scenes++; nc += x.n;
      // (in the game one drop seldom decides it: most towers that fall with it would fall without it too, their weight
      // swinging past a wheel; both kinds count, as "let go now: does it fall?" asks)
      if (x.falls) poolF.push(x.falls);
      if (x.stands) poolS.push(x.stands);
    }
  }
  await context.close();
  // the choice: the hard ones first (up to HARD each), then a STANDS in the same picture as a FALLS taken (a pair: the
  // weight the same, the drop's side decides), then the rest in the scenes' order (risky scenes first for STANDS)
  const got = { FALLS: [], STANDS: [] }, take = (list, c) => { if (!list.includes(c)) list.push(c); };
  for (const c of poolF.filter(c => c.hard).slice(0, HARD)) take(got.FALLS, c);
  for (const c of poolS.filter(c => c.hard).slice(0, HARD)) take(got.STANDS, c);
  for (const c of poolF) { if (got.FALLS.length >= want / 2) break; if (!c.hard) take(got.FALLS, c); }
  for (const c of poolS) { if (got.STANDS.length >= want / 2) break; if (got.FALLS.some(f => f.sc === c.sc)) take(got.STANDS, c); }
  const restS = poolS.filter(c => !got.STANDS.includes(c)).sort((a, b) => (b.sc.risky ? 1 : 0) - (a.sc.risky ? 1 : 0) || a.sc.id - b.sc.id);
  for (const c of restS) { if (got.STANDS.length >= want / 2) break; take(got.STANDS, c); }
  for (const c of poolF) { if (got.FALLS.length >= want / 2) break; take(got.FALLS, c); }
  const out = [];
  for (const ans of ['FALLS', 'STANDS']) for (const c of got[ans]) {
    out.push({ kind: 'tip', build: c.sc.log.map(e => ({ piece: e.piece, col: e.col, way: e.piece === 'sq' ? null : e.way })), hand: { piece: c.sc.piece, col: c.d.col, way: c.sc.piece === 'tri' ? c.d.way : null },
      sway: c.sc.sway, answer: ans, hard: !!c.hard, fallsAnyway: c.sc.fallsAnyway, scene: c.sc.id, policy: c.sc.policy, weight: { x: +c.sc.w0.toFixed(3), wheel: c.sc.wheel },
      look: { settle: +c.d.settle.toFixed(3), lo: +c.d.lo.toFixed(3), hi: +c.d.hi.toFixed(3), tip: c.d.tip }, runs: c.runs.map(x => ({ crash: x.crash, maxW: +x.maxW.toFixed(3) })),
      uid: 'tip|' + c.sc.id + '|' + c.d.col });
  }
  const pairs = got.STANDS.filter(c => got.FALLS.some(f => f.sc === c.sc)).length;
  const hardN = got.FALLS.filter(c => c.hard).length + got.STANDS.filter(c => c.hard).length;
  console.log(`tip items: ${scenes} scenes, ${nc} fitting drops looked at, ${got.FALLS.length} FALLS (${got.FALLS.filter(c => !c.sc.fallsAnyway).length} where the tower stands without the drop, ${got.FALLS.filter(c => c.hard).length} where the swing decides) + ${got.STANDS.length} STANDS (${pairs} in the same picture as a FALLS, ${got.STANDS.filter(c => c.hard).length} where the drop's side decides); the weight's place alone answers ${out.length - hardN}/${out.length}`);
  if (hardN < 2 * HARD) console.log(`!! only ${hardN} of ${2 * HARD} tip items the weight's place does not answer (try --scenes=${SCENES * 2})`);
  if (out.length < want) console.log(`!! only ${out.length} of ${want} tip items (try --scenes=${SCENES * 2})`);
  return out;
}

// ---- rendering through ?quiz= ----
function quizOf(it) {
  const q = { build: it.build.map((e, i) => [e.piece, e.col, it.colors[i], e.piece === 'sq' ? undefined : e.way || undefined]), off: OFF[it.kind], color: it.handColor };
  if (it.kind === 'where') q.hand = { piece: it.hand.piece, col: it.hand.piece === 'sq' ? 0 : 1 };
  else q.hand = { piece: it.hand.piece, col: it.hand.col };
  if (it.hand.piece === 'tri' && it.hand.way) q.way = it.hand.way;
  if (it.kind === 'way') q.hand = { piece: 'tri', col: it.hand.col };
  if (it.sway) q.sway = it.sway;
  return q;
}
// the pictures are drawn at DPR times the pixels (the game's own renderer, its screen 390x844) and shown at that size
const DPR = 2;
async function render(browser, items) {
  const { context, errors } = await L.phoneContext(browser, { dpr: DPR });
  const page = await context.newPage();
  const bad = [];
  for (const it of items) {
    await page.goto(L.gameUrl({ quiz: JSON.stringify(quizOf(it)), mute: 1 }), { waitUntil: 'load' });
    const info = await page.evaluate(([cols, kind, hand]) => {
      if (typeof CS !== 'object') return null;
      const d = CS.display(), cam = CS.cam();
      // what the page's own rules say (the key follows rules.js; they differ until the rules are inlined again)
      let page = null;
      const fit = (piece, col, way) => RULES.drop(S.RB, piece, col, piece === 'sq' ? undefined : way).outcome === 'fit';
      if (kind === 'fit' || kind === 'ghost') page = fit(hand.piece, hand.col, hand.way) ? 'STAYS' : 'FALLS OFF';
      else if (kind === 'way') page = fit('tri', hand.col, 'up') ? 'UP' : fit('tri', hand.col, 'down') ? 'DOWN' : 'NEITHER';
      else if (kind === 'where') page = cols.map((c, i) => (hand.piece === 'sq' ? fit('sq', c) : fit('tri', c, 'up') || fit('tri', c, 'down')) ? 'ABCDEFGHI'[i] : null).filter(Boolean).join(' ');
      // (what the crop must hold across: the car, the tiles, the hand and its tile, the weight)
      let x0 = d.car.box.x0, x1 = d.car.box.x1;
      for (const t of d.tiles) for (const p of t.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
      if (d.hand && d.hand.poly) for (const p of d.hand.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
      if (d.weight && d.weight.box) { x0 = Math.min(x0, d.weight.box.x0); x1 = Math.max(x1, d.weight.box.x1); }
      for (const c of cols) { const x = CS.colToX(c); x0 = Math.min(x0, x - cam.L / 2); x1 = Math.max(x1, x + cam.L / 2); }
      return { ok: CS.state().phase === 'play', tiles: d.tiles.length, hand: d.hand, car: d.car, weight: d.weight, L: cam.L, handY: cam.handY, xs: cols.map(c => CS.colToX(c)), key: CS.rulesKey(), page, span: [x0, x1] };
    }, [it.kind === 'where' ? it.columns.map(c => c.col) : it.kind === 'way' ? [it.hand.col] : [], it.kind, it.hand]);
    if (!info || !info.ok || info.tiles !== it.build.length) { bad.push(it); continue; }
    if (info.page !== null && info.page !== (Array.isArray(it.answer) ? it.answer.join(' ') : it.answer)) {
      it.pageAnswer = info.page;
      // a ghost item draws the page's answer: one that is not the key's would teach the wrong thing
      if (it.kind === 'ghost') { bad.push(it); continue; }
    }
    // the crop: from above the hand (or the marks) to below the car's wheels
    let y0 = info.handY - 0.5 * info.L;
    if (info.hand && info.hand.poly) y0 = Math.min(y0, Math.min(...info.hand.poly.map(p => p[1])) - 0.3 * info.L);
    if (it.kind === 'where' || it.kind === 'way') y0 = Math.min(y0, info.handY - 0.9 * info.L);
    const y1 = Math.min(844, info.car.box.y1 + 12);
    y0 = Math.max(0, Math.floor(y0 - 8));
    // across: the car, the tiles, the hand and the weight, and 0.4 of a tile more each side (the room beside is left out)
    const cx0 = Math.max(0, Math.floor(info.span[0] - 0.4 * info.L)), cx1 = Math.min(390, Math.ceil(info.span[1] + 0.4 * info.L));
    it.png = await page.screenshot({ type: 'png', clip: { x: cx0, y: y0, width: cx1 - cx0, height: y1 - y0 } });
    it.view = { x0: cx0, x1: cx1, y0, y1, L: info.L, handY: info.handY - y0, xs: info.xs, carY: info.car.top[0][1] - y0 };
    if (it.probeWant === 'wheel' && info.weight) {
      const wx = info.weight.wx;
      if (Math.abs(wx) > 0.3) it.probe = { kind: 'wheel', q: 'Is the weight (the brass plumb on the car) nearer the LEFT or the RIGHT wheel?', a: wx > 0 ? 'RIGHT' : 'LEFT' };
    }
  }
  await context.close();
  if (errors.length) console.log('!! console errors while rendering: ' + errors.slice(0, 5).join(' | '));
  return bad;
}
// the marks drawn over a picture (not the game's): the which-way column, the where-can-it-go letters
function overlay(it) {
  const v = it.view, L = v.L, y = v.handY, svg = `<svg class="ov" viewBox="${v.x0} 0 ${v.x1 - v.x0} ${v.y1 - v.y0}" width="${(v.x1 - v.x0) * DPR}" height="${(v.y1 - v.y0) * DPR}">`;
  if (it.kind === 'way') {
    const x = v.xs[0];
    return `${svg}<rect x="${x - L / 2}" y="${y - 0.15 * L}" width="${L}" height="${0.95 * L}" rx="4" fill="rgba(255,255,255,0.55)" stroke="#1E2541" stroke-width="2" stroke-dasharray="6 4"/>
<text x="${x}" y="${y + 0.5 * L}" font-size="${0.6 * L}" font-weight="700" text-anchor="middle" fill="#1E2541">?</text>
<path d="M${x} ${y + 0.85 * L} l0 ${0.35 * L} m-7 -9 l7 9 l7 -9" stroke="#1E2541" stroke-width="2.5" fill="none"/></svg>`;
  }
  if (it.kind === 'where') {
    const tri = it.hand.piece === 'tri';
    let s = '';
    it.columns.forEach((c, i) => {
      const x = v.xs[i], up = tri && i % 2 ? 0.42 * L : 0;
      s += `<text x="${x}" y="${y - up}" font-size="17" font-weight="700" text-anchor="middle" fill="#1E2541" stroke="#fff" stroke-width="4" paint-order="stroke">${c.label}</text>`;
      s += `<path d="M${x} ${y - up + 4} L${x} ${y + 0.55 * L}" stroke="#1E2541" stroke-width="1.6"/>`;
      // a faint dotted line on down to the car: where the middle of the tile would come down
      s += `<path d="M${x} ${y + 0.55 * L} L${x} ${v.carY}" stroke="#1E2541" stroke-opacity="0.45" stroke-width="1.2" stroke-dasharray="2 4"/>`;
      if (!tri) s += `<path d="M${x - L / 2 + 2} ${y + 0.55 * L} L${x + L / 2 - 2} ${y + 0.55 * L}" stroke="#1E2541" stroke-width="2"/>`;
    });
    return `${svg}${s}</svg>`;
  }
  return '';
}
async function sheets(browser, items, dir) {
  const comp = await L.composer(browser);
  const files = [];
  const per = 4;
  // (the ghost items' sheets are held back: handed out only once the first answers are in)
  const held = L.mkdirp(path.join(dir, 'held'));
  for (const f of fs.readdirSync(held)) if (/^sheet-\d+\.png$/.test(f)) fs.unlinkSync(path.join(held, f));
  // items in order of their numbers; each kind starts a new sheet
  const groups = [];
  for (const it of items) { const g = groups[groups.length - 1]; if (!g || g.kind !== it.kind || g.items.length >= per) groups.push({ kind: it.kind, items: [it] }); else g.items.push(it); }
  const CSS = `.grid{display:grid;grid-template-columns:repeat(2,auto);gap:12px;padding:12px;align-items:start}.cell{border:2px solid #c9ccd6;border-radius:10px;padding:6px 4px 4px;background:#fff}
.hd{display:flex;align-items:baseline;gap:12px;padding:0 4px 4px}.num{font-size:48px;font-weight:800;line-height:48px}.pr{font-size:18px;font-weight:700;line-height:22px}
.pb{font-size:18px;line-height:22px;padding:2px 4px 6px;color:#7a2a00;font-weight:700}.pic{position:relative;line-height:0}.pic img{display:block}.ov{position:absolute;left:0;top:0}
.top{padding:10px 14px 0;font-size:20px;font-weight:700}`;
  for (const [gi, g] of groups.entries()) {
    const cells = g.items.map(it => { const w = (it.view.x1 - it.view.x0) * DPR, h = (it.view.y1 - it.view.y0) * DPR; return `<div class="cell" style="width:${w + 12}px"><div class="hd"><span class="num">${it.n}</span><span class="pr">${L.esc(it.prompt)}</span></div>` +
      (it.probe ? `<div class="pb">${it.n}p: ${L.esc(it.probe.q)}</div>` : '') +
      `<div class="pic" style="width:${w}px;height:${h}px"><img src="${L.dataUrl(it.png)}" width="${w}" height="${h}">${overlay(it)}</div></div>`; }).join('');
    const head = `<div class="top">CLACK STACK quiz, sheet ${gi + 1} of ${groups.length}: items ${g.items[0].n}–${g.items[g.items.length - 1].n}</div>`;
    const f = path.join(g.kind === 'ghost' ? held : dir, 'sheet-' + String(gi + 1).padStart(2, '0') + '.png');
    fs.writeFileSync(f, await comp.shoot(head + `<div class="grid">${cells}</div>`, CSS));
    for (const it of g.items) { it.sheet = path.basename(f); it.heldBack = g.kind === 'ghost'; }
    files.push(f);
  }
  await comp.page.close();
  return files;
}

// ---- the learner's papers ----
// part 1: every item but the ghost items (their sheets come once these answers are in); part 2: the ghost items
function instructions(items, files, part) {
  const range = k => { const ns = items.filter(i => i.kind === k).map(i => i.n); return ns.length ? ns[0] + '–' + ns[ns.length - 1] : 'none'; };
  const mine = items.filter(i => (i.kind === 'ghost') === (part === 2)), sh = files.filter(f => (path.dirname(f).endsWith('held')) === (part === 2));
  if (part === 2) return [
    'CLACK STACK quiz, the last part',
    '',
    `${mine.length} more items on ${sh.length} sheets (${sh.map(f => path.basename(f)).join(', ')}): items ${range('ghost')}.`,
    'This is part 2 of the learner protocol, handed out with `node tools/learn/quiz.cjs --hand-out=<your root> --part=2` once',
    'answers.json answered every item of part 1. Your answers to the first part were kept then, as they were handed in: they',
    'are the ones graded, so do not change them. Add these items\' answers to answers.json (their fields are in',
    'answers-template-part2.json).',
    '',
    `Items ${range('ghost')}: as the first items (STAYS or FALLS OFF), but with the game's own aiming help shown.`,
    ''
  ].join('\n');
  return [
    'CLACK STACK quiz',
    '',
    `${mine.length} items on ${sh.length} sheets (${sh.map(f => path.basename(f)).join(', ')}). Each picture is the game's own screen, cut to the hand and the tower.`,
    'Answer every item in answers.json (in this folder): start from a copy of answers-template.json and fill in each value. If unsure,',
    'give your best guess. A few more items come once these answers are in (ask for the last part when answers.json is complete).',
    '',
    'The learner protocol: the quiz comes in two parts, and you do not run these steps yourself.',
    '  Part 1 (these sheets) was handed out with `node tools/learn/quiz.cjs --hand-out=<your root> --part=1`, which also closed',
    '    the game for you: from now on the driver refuses every op that plays (zoom, topics and status still work).',
    '  Part 2 (the last items) is handed out with `node tools/learn/quiz.cjs --hand-out=<your root> --part=2`, and only once',
    '    answers.json answers every item of part 1. Your part 1 answers are kept as they are at that moment: they are the',
    '    ones graded.',
    '',
    'To look at part of a sheet more closely: node tools/learn/driver.cjs --run=<n> zoom <sheet> <x0> <y0> <x1> <y1>.',
    '',
    `Items ${range('fit')}: "Let go here: STAYS or FALLS OFF?" The hand holds a tile over the tower. If it is let go right there, does it`,
    '  stay where it lands, or fall off? In this quiz the hand does not turn triangles: each one is let go the way up it is shown.',
    '  Answer STAYS or FALLS OFF.',
    `Items ${range('way')}: "Which way up?" A triangle will be let go at the dashed mark. Exactly one way up stays there.`,
    '  Answer UP (▲, point up) or DOWN (▼, point down).',
    `Items ${range('where')}: "Where does it stay?" The tile named on the item (a square, or a triangle either way up) can be let go with`,
    '  its middle under any of the letters. Answer all the letters where it stays, like "B D" (or NONE).',
    `Items ${range('tip')}: "Does the tower fall over?" The picture is a still: the tower may be swaying. If the tile in the hand is let go`,
    '  right now, does the tower fall over in the next few seconds (FALLS), or does it stay up (STANDS)?',
    'Some items also ask a question marked "<n>p:" about what the picture shows (a number, a colour, LEFT or RIGHT). Put that answer',
    'in the field "<n>p".',
    ''
  ].join('\n');
}

const USAGE = `usage: node tools/learn/quiz.cjs [--seed=1] [--depth=5] [--out=dir] [--scenes=400] [--no-render]
       node tools/learn/quiz.cjs --hand-out=<learner root> --part=1|2 [--out=dir]
  the learner protocol: --hand-out=<root> --part=1 when the learner has finished playing (it closes the game for that
  learner), then --hand-out=<root> --part=2 once <root>/quiz/answers.json answers every item of part 1 (it keeps those
  answers for grade.cjs --frozen); never part 2 first, and never the held/ sheets by hand
  builds the learner quiz from rules.js and draws it with the game (index.html) through ?quiz=:
  96 fit items (12 strata x 4 minimal pairs), 16 which-way, 12 where-can-it-go, 24 tip and 24 ghost items,
  perception probes on a third; sheets of 4 (sheet-NN.png), instructions.txt and answers-template.json in --out
  (default ${path.join(L.SCRATCH, 'learn-quiz')}), the key in <out>/key/key.json (never for the learner).
  --depth: how deep the walk of builds goes for the pairs (5: about 6,000 builds, 9 s); --scenes: towers tried for
  the tip items (about 0.6 s each, 4 at a time); --no-render: the items and the key only.`;
// ---- handing the quiz out to a learner (its root: the folder that holds its run folders) ----
// part 1 closes the game for the learner (tools/learn/driver.cjs refuses every op that plays once <root>/.closed is
// there) and copies part 1's papers into <root>/quiz/; part 2 hands out the ghost items only once <root>/quiz/answers.json
// answers every item of part 1, and keeps a copy of those answers (<root>/.audit/answers-part1.json) for the grader, so
// that what the ghost items show cannot change them.
function handOut(root, part) {
  const keyF = path.join(OUT, 'key', 'key.json');
  if (!fs.existsSync(keyF)) throw new Error('no quiz in ' + OUT + ' (build it first)');
  const key = JSON.parse(fs.readFileSync(keyF, 'utf8')), qd = L.mkdirp(path.join(root, 'quiz'));
  if (!key.parts) throw new Error('this quiz (' + keyF + ') was made before the quiz came in two parts: build it again');
  const now = new Date().toISOString(), copy = (from, to) => fs.copyFileSync(from, path.join(qd, to || path.basename(from)));
  if (part === 1) {
    const cl = path.join(root, '.closed');
    if (!fs.existsSync(cl)) L.writeJSON(cl, { at: now, why: 'the quiz was handed out', quiz: OUT });
    for (const f of key.parts[1].sheets) copy(path.join(OUT, f));
    copy(path.join(OUT, 'instructions.txt')); copy(path.join(OUT, 'answers-template.json'));
    console.log(`part 1 handed out to ${qd}: ${key.parts[1].sheets.length} sheets, items ${key.parts[1].items[0]}–${key.parts[1].items[key.parts[1].items.length - 1]}; the game is closed for ${root}`);
    return 0;
  }
  if (!fs.existsSync(path.join(root, '.closed'))) { console.log('refused: part 1 was never handed out to ' + root); return 1; }
  const af = path.join(qd, 'answers.json');
  if (!fs.existsSync(af)) { console.log('refused: no answers yet (' + af + ')'); return 1; }
  let ans;
  try { ans = JSON.parse(fs.readFileSync(af, 'utf8')); } catch (e) { console.log('refused: ' + af + ' is not JSON: ' + e.message); return 1; }
  const items1 = key.items.filter(i => key.parts[1].items.includes(i.n));
  // (every item answered: a where-can-it-go item with nowhere says NONE)
  const missing = items1.filter(i => !String(ans[String(i.n)] === undefined || ans[String(i.n)] === null ? '' : ans[String(i.n)]).trim()).map(i => i.n);
  if (missing.length) { console.log(`refused: part 1 is not finished: ${missing.length} items unanswered (${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''})`); return 1; }
  const frozen = path.join(root, '.audit', 'answers-part1.json');
  if (!fs.existsSync(frozen)) {
    const keep = {};
    for (const k of Object.keys(ans)) { const n = parseInt(k, 10); if (key.parts[1].items.includes(n)) keep[k] = ans[k]; }
    L.writeJSON(frozen, { at: now, from: af, sha: crypto.createHash('sha256').update(fs.readFileSync(af)).digest('hex'), answers: keep });
  }
  for (const f of key.parts[2].sheets) copy(path.join(OUT, 'held', f));
  copy(path.join(OUT, 'held', 'instructions-part2.txt')); copy(path.join(OUT, 'held', 'answers-template-part2.json'));
  console.log(`part 2 handed out to ${qd}: ${key.parts[2].sheets.length} sheets, items ${key.parts[2].items[0]}–${key.parts[2].items[key.parts[2].items.length - 1]}; part 1's answers kept in ${frozen}`);
  return 0;
}
async function main() {
  if (A.help) { console.log(USAGE); return; }
  if (A['hand-out']) { process.exitCode = handOut(path.resolve(A['hand-out']), +(A.part || 1)); return; }
  const t0 = Date.now();
  L.mkdirp(OUT);
  const keyDir = L.mkdirp(path.join(OUT, 'key'));
  for (const f of fs.readdirSync(OUT)) if (/^sheet-\d+\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  // the rules: rules.js, and whether the page under test has the same
  const rulesSrc = fs.readFileSync(rulesVm.RULES_JS, 'utf8');
  let pageSha = null;
  try { const html = fs.readFileSync(rulesVm.INDEX, 'utf8'), i = html.indexOf(rulesVm.BEGIN), j = html.indexOf(rulesVm.END); pageSha = sha(html.slice(i + rulesVm.BEGIN.length, j).trim()); } catch (e) { /* none */ }
  const rulesSha = sha(rulesSrc.trim());
  if (pageSha !== rulesSha) console.log(`!! index.html's inlined rules (${pageSha}) are not rules.js (${rulesSha}): the key follows rules.js, the pictures the page (run tools/build.cjs)`);
  console.log(`items from rules.js (${rulesSha}) to depth ${DEPTH} …`);
  const P = I.pool(DEPTH);
  console.log(`  ${P.nodes.length} builds, ${P.items.length} drops, ${P.pairs.length} minimal pairs (${Date.now() - t0} ms)`);
  const used = new Set(), usedB = new Set();
  const main = I.choose(P, 4, rnd, { used, usedB });
  const ghostCh = I.choose(P, 1, rnd, { used, usedB });
  const short = [];
  for (const sid of I.ORDER) if (main[sid].pairs.length < 4) short.push(sid + ' ' + main[sid].pairs.length + '/4');
  if (short.length) console.log('!! strata short of pairs: ' + short.join(', ') + ' (try --depth=6)');
  console.log('  strata: ' + I.ORDER.map(s => s + ' ' + main[s].pairs.length + ' (of ' + main[s].candidates + ')').join(', '));
  let fit = I.fitItems(main, rnd), ghost = I.fitItems(ghostCh, rnd, 'g:');
  const way = I.wayItems(P, 16, rnd, used), where = I.whereItems(P, 12, rnd, used);
  console.log(`  ${fit.length} fit, ${way.length} which-way, ${where.length} where, ${ghost.length} ghost items`);
  const browser = await L.launch();
  const tips = await tipItems(browser, 24);
  // order: each kind shuffled (a pair's two items apart), numbered 1…
  fit = rnd.shuffle(fit); ghost = rnd.shuffle(ghost);
  const items = [].concat(fit, rnd.shuffle(way), rnd.shuffle(where), rnd.shuffle(tips), ghost);
  items.forEach((it, i) => { it.n = i + 1; it.prompt = PROMPT[it.kind] + (it.kind === 'where' ? (it.hand.piece === 'sq' ? '  (a square)' : '  (a triangle, either way up)') : ''); });
  // colours, the baseline's look under the middle, the probes
  const cr = lib.rng(SEED + 99);
  for (const it of items) {
    const T = R.tiles(I.buildOf(it.build));
    it.colors = colours(T, cr);
    const handPoly = it.hand.col === null || it.hand.col === undefined ? null : lib.shape(it.hand.piece === 'sq' ? 'sq' : it.hand.way === 'down' ? 'dn' : 'up', it.hand.col, 99);
    const near = new Set();
    if (handPoly) for (const [i, t] of T.entries()) { const p = lib.polyOf(t); if (Math.max(...p.map(v => v.x)) > handPoly[0].x - 0.6 && Math.min(...p.map(v => v.x)) < handPoly[0].x + 1.6) near.add(it.colors[i]); }
    // (never red: a red tile in the hand would look like the game's warning that it falls off)
    it.handColor = PALETTE.filter(c => c !== 'red').concat(['lightBlue']).find(c => !near.has(c)) || 'lightBlue';
    if (it.kind === 'fit' || it.kind === 'ghost') it.flat = I.flatUnderMiddle(it.build, it.hand);
    if (it.kind === 'way') it.flat = I.flatUnderMiddle(it.build, it.hand);
    if (it.kind === 'where') it.flatSet = it.columns.filter(c => I.flatUnderMiddle(it.build, { piece: it.hand.piece, col: c.col })).map(c => c.label);
  }
  addProbes(items);
  let files = [];
  if (!A['no-render']) {
    console.log(`rendering ${items.length} items through ?quiz= …`);
    const bad = await render(browser, items);
    const differ = items.filter(it => it.pageAnswer !== undefined && !bad.includes(it));
    if (differ.length) console.log(`!! on ${differ.length} items the page's inlined rules answer otherwise than rules.js (kept; the key says pageAnswer): ` + differ.map(it => it.n + ' ' + it.kind + (it.stratum ? ' ' + it.stratum : '')).join(', '));
    if (bad.length) {
      console.log(`!! ${bad.length} items the page could not show, or ghost items whose ghost would not be the key's answer (dropped): ` + bad.map(b => b.n + ' ' + b.kind + ' ' + b.build.map(fmtE).join(' ')).join('; '));
      const keep = items.filter(it => !bad.includes(it));
      items.length = 0; items.push(...keep);
      items.forEach((it, i) => { it.n = i + 1; });
    }
    files = await sheets(browser, items, OUT);
  }
  await browser.close();
  // the key, the template, the instructions
  const key = {
    what: 'Key for the CLACK STACK learner quiz (DESIGN §18.8 G4). Never show this to a learner.',
    made: new Date().toISOString(), seed: SEED, depth: DEPTH, rules: { file: rulesVm.RULES_JS, sha: rulesSha, page: pageSha, same: pageSha === rulesSha },
    game: L.GAME, sheets: files.map(f => path.basename(f)), outDir: OUT,
    counts: Object.fromEntries(['fit', 'way', 'where', 'tip', 'ghost'].map(k => [k, items.filter(i => i.kind === k).length])),
    probes: items.filter(i => i.probe).length,
    strata: I.STRATA.map(s => ({ id: s.id, name: s.name, items: items.filter(i => i.kind === 'fit' && i.stratum === s.id).length })),
    hidden: OFF,
    notes: {
      fit: 'Triangles are shown and let go the way up the item gives (the quiz hand does not turn them); the answer is rules.js\'s drop with that way.',
      tip: 'Decided by the game: its look-ahead said the drop may take the tower over (FALLS) or kept the weight inside the wheels, and letting go for real at 0, 0.05 and 0.1 s crashed every time (FALLS) or never, the weight staying 0.35 tile inside the wheels (STANDS). A FALLS has the weight at least 0.6 of the way to a wheel in the still and the tile let go on that side, or (hard: the swing decides) the weight inside half way in a tower swaying (W at least 0.15). A hard STANDS has the weight past half way and the tile let go on the other side (or the middle). hard: the baseline "FALLS when the weight is past half way" answers it wrongly. fallsAnyway: the tower also falls if nothing is let go (in this game one drop seldom decides it).',
      probes: 'What the picture shows, from the build: the tiles touching the car, the tiles in the tower, the ▼ in it, the colour of the topmost tile under the middle of the held tile (or the mark), the side the weight hangs toward.'
    },
    passBars: { probes: 0.90, fit: 0.85, fitOverBaseline: 0.15, stratum: 0.70, way: 0.85, tip: 0.85, tipOverBaseline: 0.15, whereF1: 0.85, ghost: 0.95, writeup: 8 },
    parts: { 1: { items: items.filter(i => i.kind !== 'ghost').map(i => i.n), sheets: files.filter(f => !path.dirname(f).endsWith('held')).map(f => path.basename(f)) },
      2: { items: items.filter(i => i.kind === 'ghost').map(i => i.n), sheets: files.filter(f => path.dirname(f).endsWith('held')).map(f => path.basename(f)) } },
    items: items.map(it => {
      const o = { n: it.n, kind: it.kind, sheet: it.sheet || null, answer: it.answer, prompt: it.prompt };
      for (const k of ['pageAnswer', 'stratum', 'pair', 'pairKind', 'reason', 'tips', 'propped', 'extra', 'held', 'sides', 'gap', 'wrongReason', 'hard', 'fallsAnyway', 'sway', 'weight', 'look', 'runs', 'scene', 'policy', 'mirrored', 'flat', 'flatSet', 'uid']) if (it[k] !== undefined) o[k] = it[k];
      o.part = it.kind === 'ghost' ? 2 : 1;
      o.build = it.build.map(fmtE);
      o.hand = it.kind === 'where' ? (it.hand.piece === 'sq' ? '■' : 'triangle') : it.kind === 'way' ? 'triangle at ' + (it.hand.col / 2) : fmtE(it.hand);
      if (it.columns) o.columns = it.columns.map(c => ({ label: c.label, col: c.col, x: c.col / 2 }));
      o.colors = it.colors; o.handColor = it.handColor;
      if (it.probe) o.probe = it.probe;
      return o;
    })
  };
  L.writeJSON(path.join(keyDir, 'key.json'), key);
  // the papers: part 1 in OUT, part 2 (the ghost items) in OUT/held
  for (const part of [1, 2]) {
    const tpl = {}, dir = part === 1 ? OUT : L.mkdirp(path.join(OUT, 'held'));
    for (const it of items) if ((it.kind === 'ghost') === (part === 2)) { tpl[String(it.n)] = ''; if (it.probe) tpl[it.n + 'p'] = ''; }
    L.writeJSON(path.join(dir, part === 1 ? 'answers-template.json' : 'answers-template-part2.json'), tpl);
    fs.writeFileSync(path.join(dir, part === 1 ? 'instructions.txt' : 'instructions-part2.txt'), instructions(items, files, part));
  }
  // (for whoever hands it out: the protocol, beside the key, never in a learner's folder)
  fs.writeFileSync(path.join(keyDir, 'HANDOUT.txt'), [
    'CLACK STACK learner quiz: how to hand it out (DESIGN §18.8 G4). For the orchestrator; never give this folder to a learner.',
    '',
    `Quiz: ${OUT}`,
    '1. Each learner plays only through tools/learn/driver.cjs, in its own empty root outside the revision scratch folders',
    '   (CLACK_LEARN_ROOT=<root>); any other tool call voids its run. Budget: 3 runs or 150 lifts over every run folder in the root.',
    '2. When it has finished playing (and written its write-up, on the driver\'s `topics`):',
    `     node tools/learn/quiz.cjs --out=${OUT} --hand-out=<root> --part=1`,
    '   This closes the game for that learner (<root>/.closed: every driver op that plays is refused) and copies part 1',
    `   (${key.parts[1].sheets.length} sheets, items ${key.parts[1].items[0]}–${key.parts[1].items[key.parts[1].items.length - 1]}, instructions.txt, answers-template.json) into <root>/quiz/.`,
    '3. Once <root>/quiz/answers.json answers every item of part 1:',
    `     node tools/learn/quiz.cjs --out=${OUT} --hand-out=<root> --part=2`,
    '   This keeps a copy of those answers (<root>/.audit/answers-part1.json) and copies the ghost items (part 2) into',
    '   <root>/quiz/. It refuses while any part 1 item is unanswered. Never hand out part 2, or the held/ sheets, any other way.',
    '4. Grade:',
    `     node tools/learn/grade.cjs --key=${path.join(keyDir, 'key.json')} --answers=<root>/quiz/answers.json --frozen=<root>/.audit/answers-part1.json --writeup=<points>`,
    ''].join('\n'));
  console.log(`${items.length} items (${Object.entries(key.counts).map(([k, v]) => k + ' ' + v).join(', ')}, ${key.probes} probes) on ${files.length} sheets in ${OUT}; key ${path.join(keyDir, 'key.json')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`the learner protocol (also in ${path.join(keyDir, 'HANDOUT.txt')}): --hand-out=<root> --part=1, then --part=2 once part 1 is answered`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { tipItems, botBuild, quizOf, OFF };
