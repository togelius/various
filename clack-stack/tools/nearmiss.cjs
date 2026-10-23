#!/usr/bin/env node
'use strict';
// G3 near misses (DESIGN §18.2, 18.8): every near miss rendered at the zoom floor with its gap visibly marked.
// A near miss is a tile that stays with a thin gap (under 0.3 L) under half of it, such as 0.134 L between a square's
// top and a triangle row's top. The classes are found in the page's own rules (its RULES block): the piece, the gap's
// exact size, the half it is under and what lies under each half; every class met by an exhaustive enumeration to depth
// --depth and by --playouts random deep playouts (cached by the rules' sha). Each class is drawn from its shortest
// build, raised on rows of four squares until the camera is at the zoom floor (ZOOM_MIN px per L, its smallest scale:
// a 0.134 L gap is 4 px), at each size, twice: aimed (the ghost's gap) and placed (the build's). Checks:
//  - the camera is at the zoom floor and the near miss stays, its gap the rules' gap;
//  - the gap is drawn open where the rules put it: its outline's corners within 1 px of the gap's;
//  - it is visibly marked: hiding the gap layer changes the pixels along at least 80% of its outline, by a visible
//    amount, and nothing inside it (no fill);
//  - no console errors.
// Writes a sheet of every near miss, enlarged, to outDir/nearmiss-<size>.png.
//   node clack-stack/tools/nearmiss.cjs [outDir] [--sizes=...] [--depth=7] [--playouts=4500] [--fresh]
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const G = require('./g3lib.cjs');

const argv = process.argv.slice(2);
const OUT = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(os.tmpdir(), 'clack-nearmiss'));
const DEPTH = +G.argOf('depth', 7), PLAYOUTS = +G.argOf('playouts', 4500), FRESH = argv.includes('--fresh');
const T = G.reporter('nearmiss');
const R = G.pageRules();
const R3 = Math.sqrt(3), H = R3 / 2, ZOOM_MIN = 30, THIN = 0.3;
const gapOf = g => (g[0] + g[1] * R3) / 2;

/* ---- the near misses in the rules ---- */
// what lies under each half of the tile's bottom: the topmost tile spanning that half whose top there is not above the
// bottom (its type and its top's drop below the bottom at the half's two ends), or the car, or air
const TOPS = { sq: [[1, 1], [1, 1]], up: [[0, H], [H, 0]], dn: [[H, H], [H, H]] };
function under(B, r) {
  const col = r.pose.col, y0 = (r.pose.y[0] + r.pose.y[1] * R3) / 2, out = [];
  for (let j = 0; j < 2; j++) {
    const s = col + j;
    let best = null, bt = 'air';
    for (const t of B.tiles) {
      if (!(t.c <= s && s <= t.c + 1)) continue;
      const tp = TOPS[t.t][s - t.c], ty = t.a + t.b * H, a = ty + tp[0], b = ty + tp[1];
      if ((a + b) / 2 > y0 + 1e-9) continue;
      if (!best || a + b > best[0] + best[1]) { best = [a, b]; bt = t.t; }
    }
    if (!best && s >= -4 && s + 1 <= 4) { best = [0, 0]; bt = 'car'; }
    out.push(best ? { type: bt, d0: y0 - best[0], d1: y0 - best[1] } : { type: 'air' });
  }
  return out;
}
function classOf(B, r) {
  const u = under(B, r), side = u.findIndex(h => h.type !== 'air' && h.d0 > 1e-6 && h.d0 < THIN);
  return `${r.pose.type === 'sq' ? '■' : '▲'} gap ${gapOf(r.gap).toFixed(3)} [${r.gap}] under its ${side ? 'right' : 'left'} half, over a ${u[side].type === 'dn' ? '▼' : u[side].type === 'sq' ? '■' : u[side].type}; held on a ${u[1 - side].type === 'dn' ? '▼' : u[1 - side].type === 'sq' ? '■' : u[1 - side].type}`;
}
function visit(B, classes) {
  let n = 0;
  for (const piece of ['sq', 'tri']) for (const col of R.cols(B, piece)) {
    const r = R.drop(B, piece, col);
    if (r.outcome !== 'fit' || !r.gap || gapOf(r.gap) >= THIN) continue;
    n++;
    const k = classOf(B, r), c = classes.get(k);
    if (!c || c.log.length > B.log.length) classes.set(k, { k, log: B.log.map(l => ({ piece: l.piece, col: l.col, way: l.way })), piece, col, way: r.way, gap: r.gap, n: c ? c.n : 0 });
    classes.get(k).n++;
  }
  return n;
}
function findClasses() {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(G.GAMEFILE, 'utf8').split(require('./lib/rules-vm.cjs').BEGIN)[1].split(require('./lib/rules-vm.cjs').END)[0]).digest('hex').slice(0, 16);
  const cache = path.join(os.tmpdir(), `clack-nearmiss-v2-${sha}-d${DEPTH}-p${PLAYOUTS}.json`);
  if (!FRESH && fs.existsSync(cache)) return Object.assign(JSON.parse(fs.readFileSync(cache, 'utf8')), { cached: cache });
  const classes = new Map(), t0 = Date.now();
  let level = [R.newBuild({ half: 2 })], seen = new Set([R.key(level[0])]), builds = 1, found = 0;
  for (let d = 0; d < DEPTH; d++) {
    const next = [];
    for (const B of level) {
      found += visit(B, classes);
      if (d + 1 >= DEPTH) continue;
      for (const piece of ['sq', 'tri']) for (const col of R.cols(B, piece)) {
        const r = R.drop(B, piece, col);
        if (r.outcome !== 'fit') continue;
        const B2 = R.place(B, r), key = R.key(B2);
        if (!seen.has(key)) { seen.add(key); next.push(B2); builds++; }
      }
    }
    level = next;
  }
  const enumerated = classes.size;
  // random deep playouts: two in three take any fit, the rest a triangle three times in five (deeper and rarer gaps
  // come from long stacks of mixed rows: 6·h − 5 = 0.196 L needs six rows of triangles beside five squares)
  const rnd = G.rng(5150);
  for (let n = 0; n < PLAYOUTS; n++) {
    let B = R.newBuild({ half: 2 });
    const triHeavy = n % 3 === 2, maxD = triHeavy ? 60 : 45;
    for (let d = 0; d < maxD; d++) {
      found += visit(B, classes);
      const want = triHeavy ? (rnd() < 0.6 ? 'tri' : 'sq') : null, fits = [];
      for (const piece of ['sq', 'tri']) for (const col of R.cols(B, piece)) { if (want && piece !== want) continue; const r = R.drop(B, piece, col); if (r.outcome === 'fit') fits.push(r); }
      if (!fits.length) { if (want) continue; break; }
      B = R.place(B, fits[Math.floor(rnd() * fits.length)]);
    }
  }
  // and every class's mirror image (the rules are mirror-symmetric; a rare class may have been met one way round only)
  let mirrored = 0;
  for (const c of [...classes.values()]) {
    const mc = l => -l.col - 2;
    try {
      let B = R.newBuild({ half: 2 });
      for (const l of c.log) B = R.place(B, R.drop(B, l.piece, mc(l), l.piece === 'sq' ? undefined : l.way));
      const r = R.drop(B, c.piece, mc(c));
      if (r.outcome !== 'fit' || !r.gap || gapOf(r.gap) >= THIN) continue;
      const k = classOf(B, r);
      if (!classes.has(k)) { classes.set(k, { k, log: B.log.map(l => ({ piece: l.piece, col: l.col, way: l.way })), piece: c.piece, col: mc(c), way: r.way, gap: r.gap, n: 0, mirror: true }); mirrored++; }
    } catch (e) { /* (not a build mirrored: cannot happen if the rules are symmetric) */ }
  }
  const res = { sha, depth: DEPTH, playouts: PLAYOUTS, builds, found, enumerated, mirrored, ms: Date.now() - t0, classes: [...classes.values()].sort((a, b) => a.k < b.k ? -1 : 1) };
  fs.writeFileSync(cache, JSON.stringify(res));
  return res;
}

/* ---- drawing them ---- */
const S1 = c => (c / 2).toString();
const entry = l => (l.piece === 'sq' ? '■' : l.way === 'down' ? '▼' : '▲') + S1(l.col);
function worldPoly(type, col, y) {
  const x = col / 2, yb = gapOf(y);
  if (type === 'sq') return [[x, yb], [x + 1, yb], [x + 1, yb + 1], [x, yb + 1]];
  if (type === 'up') return [[x, yb], [x + 1, yb], [x + 0.5, yb + H]];
  return [[x + 0.5, yb], [x + 1, yb + H], [x, yb + H]];
}
// the outline of a polygon, a point every `step` px
function outline(poly, step) {
  const pts = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  }
  return pts;
}

async function renderClass(page, size, c, k, mode) {
  // the build: k rows of four squares, then the class's build; aimed: the tile in the hand at its column; placed: in it
  const rows = [];
  for (let i = 0; i < k; i++) rows.push('■-2', '■-1', '■0', '■1');
  const tile = { piece: c.piece, col: c.col, way: c.way };
  const build = rows.concat(c.log.map(entry)).concat(mode === 'placed' ? [entry(tile)] : []);
  const hand = mode === 'placed' ? { piece: 'sq', col: 2 } : { piece: c.piece, col: c.col };
  const q = { build, hand, off: mode === 'placed' ? ['ghost', 'column', 'shine', 'chip', 'reason', 'marks', 'markers', 'ticks', 'ghostGaps'] : ['markers', 'ticks'] };
  await page.goto(require('./lib.cjs').gameUrl({ quiz: JSON.stringify(q), mute: 1 }), { waitUntil: 'load' });
  await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
  await page.evaluate(() => CS.render());
  return page.evaluate(() => ({ d: CS.display(), cam: CS.cam(), tiles: CS.tiles(true), g: CS.ghost() }));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now(), NM = findClasses();
  console.log(`near misses in these rules (${R.REASONS.join(', ')}): ${NM.classes.length} classes (${NM.enumerated} by the enumeration to depth ${NM.depth} over ${NM.builds} builds, ${NM.mirrored || 0} as the mirror image of one met, the rest by ${NM.playouts} random deep playouts; ${NM.found} near misses met) ${NM.cached ? 'from ' + NM.cached : 'in ' + (NM.ms / 1000).toFixed(1) + ' s'}`);
  for (const c of NM.classes) console.log(`       ${c.k} (${c.mirror ? 'mirrored' : c.n + '×'}; shortest: ${c.log.length} tiles)`);
  T.check(NM.classes.some(c => /gap 0\.134/.test(c.k)) && NM.classes.some(c => /gap 0\.268/.test(c.k)), 'the classes include both 0.134 and 0.268 L gaps');
  const browser = await G.launch();
  try {
    for (const size of G.sizesFrom()) {
      const ts = Date.now();
      const { context, page, errors } = await G.open(browser, size, { quiz: JSON.stringify({ build: [], hand: '■0' }) });
      await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
      const cam0 = await page.evaluate(() => CS.cam());
      // rows of squares enough for the camera to reach its floor (zoomAt: the build top 3.4 L under the hand's line)
      const need = (cam0.groundY - cam0.handTop) / ZOOM_MIN - 3.9 + 0.05;
      const crops = [];
      let n = 0, okAll = 0, minCov = 1, minPx = Infinity, worst = 0;
      for (const c of NM.classes) {
        let top = 0;
        { let B = R.newBuild({ half: 2 }); for (const l of c.log) B = R.place(B, R.drop(B, l.piece, l.col, l.piece === 'sq' ? undefined : l.way)); for (const t of B.tiles) top = Math.max(top, t.a + t.b * H + (t.t === 'up' ? H : t.t === 'dn' ? H : 1)); }
        const k = Math.max(0, Math.ceil(need - top));
        for (const mode of ['aimed', 'placed']) {
          n++;
          const tag = `${size.name} ${mode} ${c.k}`;
          const sc = await renderClass(page, size, c, k, mode);
          const bad = [];
          if (Math.abs(sc.cam.L - ZOOM_MIN) > 1e-6) bad.push(`the camera is at ${sc.cam.L.toFixed(2)} px per L, not its floor ${ZOOM_MIN}`);
          // the near miss: the ghost (aimed) or the last tile (placed), raised k rows
          let B = R.newBuild({ half: 2 }), r = null;
          try {
            for (let i = 0; i < k; i++) for (const col of [-4, -2, 0, 2]) B = R.place(B, R.drop(B, 'sq', col));
            for (const l of c.log) B = R.place(B, R.drop(B, l.piece, l.col, l.piece === 'sq' ? undefined : l.way));
            r = R.drop(B, c.piece, c.col);
          } catch (e) { T.check(false, `${tag}: its build does not stand raised ${k} rows: ${e.message}`); continue; }
          if (r.outcome !== 'fit' || !r.gap || r.gap[0] !== c.gap[0] || r.gap[1] !== c.gap[1]) bad.push(`raised ${k} rows it is ${r.outcome} with gap ${r.gap}`);
          if (mode === 'aimed' && (!sc.g || sc.g.outcome !== 'fit' || !sc.g.gap || sc.g.gap[0] !== c.gap[0] || sc.g.gap[1] !== c.gap[1])) bad.push(`the ghost is ${sc.g && sc.g.outcome} with gap ${sc.g && sc.g.gap}`);
          // the tower's screen mapping, from the tiles drawn
          const W = [], S = [];
          for (const it of sc.d.tiles) { const t = sc.tiles[it.i]; const wp = worldPoly(t.piece === 'sq' ? 'sq' : t.way === 'down' ? 'dn' : 'up', t.col, t.y); for (let j = 0; j < wp.length; j++) { W.push(wp[j]); S.push(it.poly[j]); } }
          const M = G.fitAffine(W, S);
          // the rules' gap: under the half that is not held, from the bottom down to the top there
          const u = under(B, r), side = u.findIndex(h => h.type !== 'air' && h.d0 > 1e-6 && h.d0 < THIN), x0 = r.pose.col / 2 + side / 2, y0 = gapOf(r.pose.y);
          const want = [[x0, y0], [x0 + 0.5, y0], [x0 + 0.5, y0 - u[side].d1], [x0, y0 - u[side].d0]].map(p => M.map(p));
          const drawn = mode === 'aimed' ? (sc.d.ghost && sc.d.ghost.ghostGaps ? sc.d.ghost.ghostGaps.polys : []) : sc.d.gaps;
          let best = null, bd = Infinity;
          for (const p of drawn || []) { const dd = G.polyDist(p, want); if (dd < bd) { bd = dd; best = p; } }
          if (!best || bd > 1) bad.push(`its gap is not drawn where the rules put it (${drawn ? drawn.length : 0} drawn, nearest ${bd.toFixed(1)} px off)`);
          const hpx = Math.abs(want[0][1] - want[3][1]);
          minPx = Math.min(minPx, hpx);
          if (best) {
            // visibly marked: hiding the gap layer changes the pixels along its outline, and nothing inside it
            const layer = mode === 'aimed' ? 'ghostGaps' : 'gaps';
            await G.keepPixels(page, 'nm');
            await page.evaluate(l => CS.hide(l), layer);
            const pts = outline(best, 1.5), hits = await G.changedNear(page, 'nm', pts, 1.6, 24);
            const cx = best.reduce((s, p) => s + p[0], 0) / best.length, cy = best.reduce((s, p) => s + p[1], 0) / best.length;
            const inner = hpx > 6 ? await G.changedNear(page, 'nm', [[cx, cy]], Math.max(0, hpx / 2 - 2.6), 24) : [0];
            const dfull = await G.diffPixels(page, 'nm', null, 24);
            await page.evaluate(l => CS.show(l), layer);
            const cov = hits.reduce((s, v) => s + v, 0) / hits.length;
            minCov = Math.min(minCov, cov);
            if (cov < 0.8) bad.push(`hiding ${layer} changes only ${(cov * 100).toFixed(0)}% of its outline`);
            if (inner[0]) bad.push('it is filled (hiding it changes its inside)');
            if (!dfull.n) bad.push(`hiding ${layer} changes nothing`);
            // a crop of it, enlarged, for the sheet
            const L = sc.cam.L, gx = (best[0][0] + best[1][0]) / 2, gy = best[0][1];
            const clip = { x: Math.max(0, Math.round(gx - 1.6 * L)), y: Math.max(0, Math.round(gy - 1.6 * L)), width: Math.round(3.2 * L), height: Math.round(3.2 * L) };
            clip.width = Math.min(clip.width, size.w - clip.x); clip.height = Math.min(clip.height, size.h - clip.y);
            const f = path.join(OUT, `nm-${size.name}-${String(n).padStart(3, '0')}.png`);
            await page.screenshot({ path: f, clip });
            crops.push({ f, label: `${mode}: ${c.k.replace(/ \[.*?\]/, '')}`, ok: !bad.length });
          }
          worst = Math.max(worst, bd === Infinity ? 0 : bd);
          if (bad.length) T.check(false, `${tag}: ${bad.join('; ')}`); else okAll++;
        }
      }
      T.check(okAll === n, `${size.name}: ${okAll}/${n} near misses (${NM.classes.length} classes, aimed and placed) at the zoom floor (${ZOOM_MIN} px per L) with their gaps drawn open where the rules put them (within ${worst.toFixed(2)} px) and visibly marked (at least ${(minCov * 100).toFixed(0)}% of each outline; the thinnest ${minPx.toFixed(1)} px tall)`);
      T.check(errors.length === 0, `${size.name}: no console errors` + (errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''));
      // the sheet
      const tw = 192, html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(4,${tw}px);gap:4px;font:11px sans-serif;color:#fff">` +
        crops.map(cp => `<div style="background:${cp.ok ? '#333' : '#900'}"><img src="file://${cp.f}" style="width:${tw}px;height:${tw}px;display:block;image-rendering:pixelated"><div style="padding:2px;height:42px;overflow:hidden">${cp.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div></div>`).join('') + '</body></html>';
      const hp = path.join(OUT, `nearmiss-${size.name}.html`);
      fs.writeFileSync(hp, html);
      const sp = await browser.newPage({ viewport: { width: 4 * (tw + 4), height: Math.ceil(crops.length / 4) * (tw + 50) } });
      await sp.goto('file://' + hp); await sp.waitForTimeout(200);
      await sp.screenshot({ path: path.join(OUT, `nearmiss-${size.name}.png`), fullPage: true });
      await sp.close();
      await context.close();
      T.info(`${size.name}: ${((Date.now() - ts) / 1000).toFixed(1)} s; sheet ${path.join(OUT, 'nearmiss-' + size.name + '.png')}`);
    }
  } finally { await browser.close(); }
  T.info(`total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  T.done();
})().catch(e => { console.error(e); process.exitCode = 1; });
