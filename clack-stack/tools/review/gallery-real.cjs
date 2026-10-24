'use strict';
// The plausibility gallery with the real art (DESIGN §18.8 G4: the final plausibility round, "with the real art"). It
// takes a gallery key written by tools/review/gallery.cjs (the same pictures, ids and sheets) and draws every picture
// with the game's own renderer through ?quiz= (index.html at 390x844): the tiles numbered, no HUD (no weight, no ghost,
// no fit marks, no hints, no rims on the held tile), and every tile that falls off falling as the game draws it (its
// real release, filmed from the game's own clock: it stops, turns red, tips about the point it touched or rocks the
// part that would tip, then falls out of the wall toward you onto the rug).
//   build pictures (extremes, random and bot builds, golden cases): the build standing, cut to the car and the tower
//   minimal pairs: A and B side by side; a side whose tile stays shows it in place, a side whose tile falls off shows
//     three frames of the fall (it touches, it tips or rocks, it lies on the rug)
//   filmstrips: six frames of the game's own fall (held, touching, tipping or rocking, leaving the wall, on its way out,
//     on the rug)
//   planted defects: the base build from the rules and the defect's tiles drawn where the gallery's pool puts them,
//     outside the rules (?quiz's raw tiles)
// The key's pictures keep their ids and sheets, packed as tools/review/gallery.cjs packs them (rows of three units, three
// rows a sheet); a legend for the reviewers goes next to the sheets.
//   node tools/review/gallery-real.cjs [--key=gallery key.json] [--out=dir] [--only=G01,G07]
const fs = require('fs');
const path = require('path');
const L = require('../learn/lib.cjs');
const lib = require('./lib.cjs');

const A = L.args();
const KEY = path.resolve(A.key || '/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/rev5c/gallery-key/key.json');
const OUT = path.resolve(A.out || path.join(L.SCRATCH, 'gallery-real'));
const ONLY = A.only ? new Set(String(A.only).split(',')) : null;
const OFF = ['ghost', 'column', 'shine', 'chip', 'reason', 'marks', 'callout', 'ghostGaps', 'markers', 'ticks', 'ghostWeight', 'weight', 'hint', 'handTint',
  'hud', 'next', 'counter', 'box', 'fuse', 'swap', 'knock'];
const UNIT = 330, GAP = 14;

// the planted defects: tools/review/gallery.cjs's pool (base build from the rules, the defect's tiles as polygons)
let PLANTS = null;
function plants() {
  if (!PLANTS) PLANTS = require('./gallery.cjs').PLANTS;
  return PLANTS;
}
// a polygon from lib.shape back to the quiz's raw tile: [type, left x, lowest y]
function rawOf(poly) {
  const x = Math.min(...poly.map(v => v.x)), y = Math.min(...poly.map(v => v.y));
  if (poly.length === 4) return ['sq', +x.toFixed(6), +y.toFixed(6)];
  const low = poly.filter(v => Math.abs(v.y - y) < 1e-9).length;
  return [low === 2 ? 'up' : 'dn', +x.toFixed(6), +y.toFixed(6)];
}
const parse = s => lib.parse(s);
function colorsFor(log, raw, seed) {
  let polys = [];
  try { polys = lib.rules().tiles(lib.canon.replay(lib.rules(), 2, log)).map(lib.polyOf); } catch (e) { polys = log.map(() => []); }
  for (const r of raw || []) polys.push(lib.shape(r[0], r[1] * 2, r[2]));
  return L.colours(polys, lib.rng(seed));
}

// ---- one scene of the game: load, release, frames ----
async function load(page, q) {
  await page.goto(L.gameUrl({ quiz: JSON.stringify(q), mute: 1 }), { waitUntil: 'load' });
  return page.evaluate(n => typeof CS === 'object' && CS.state().phase === 'play' && CS.tiles().length === n, q.build.length + (q.raw ? q.raw.length : 0));
}
// what a frame shows: its pixels and where the numbered things are (tiles by build order, the held, falling and lost tile)
async function frame(page) {
  await page.evaluate(() => CS.render());
  const info = await page.evaluate(() => {
    const d = CS.display(), cam = CS.cam(), lost = [];
    for (const g of DEBRIS) if (g.lost && !g.fading) { const o = {}; debrisScreen(g, o, true); lost.push([o.x, o.y]); }
    return { L: cam.L, tiles: d.tiles.map(t => ({ i: t.i, poly: t.poly })), hand: d.hand && d.hand.poly ? d.hand : null, falling: d.falling.map(f => [f.x, f.y]), lost, car: d.car && d.car.box };
  });
  info.png = await page.screenshot({ type: 'png' });
  return info;
}
// the box a set of frames needs (CSS px): every tile, the held, falling and lost tile, the car, and the rug just below it
function boxOf(frames, opts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y, r) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  for (const f of frames) {
    const Lp = f.L;
    for (const t of f.tiles) for (const p of t.poly) add(p[0], p[1], 0.25 * Lp);
    if (f.hand && opts.hand) { for (const p of f.hand.poly) add(p[0], p[1], 0.3 * Lp); add(f.hand.x, f.hand.y - 0.9 * Lp, 0.1 * Lp); }
    for (const p of f.falling) add(p[0], p[1], 0.8 * Lp);
    for (const p of f.lost) add(p[0], p[1], 0.8 * Lp);
    if (f.car) { add(f.car.x0, f.car.y0, 4); add(f.car.x1, f.car.y1 + (opts.rug ? 0.9 * Lp : 0.15 * Lp), 4); }
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(390, Math.ceil(x1)); y1 = Math.min(844, Math.ceil(y1));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
// a frame cut to the box, scaled to fit w x h, its tiles numbered
function frameHTML(f, box, w, h, nums, label) {
  const k = Math.min(w / box.w, h / box.h, 1.3), W = Math.round(box.w * k), H = Math.round(box.h * k), Lp = f.L * k;
  const fs_ = Math.max(10, Math.min(18, 0.34 * Lp));
  const num = (x, y, n) => `<text x="${((x - box.x0) * k).toFixed(1)}" y="${((y - box.y0) * k + fs_ * 0.36).toFixed(1)}" font-size="${fs_.toFixed(1)}" font-weight="800" text-anchor="middle" fill="#fff" stroke="#1E2541" stroke-width="${(fs_ / 4).toFixed(1)}" paint-order="stroke">${n}</text>`;
  let svg = '';
  for (const t of f.tiles) {
    const n = nums.tile(t.i);
    if (n === null) continue;
    const c = t.poly.reduce((a, p) => [a[0] + p[0] / t.poly.length, a[1] + p[1] / t.poly.length], [0, 0]);
    svg += num(c[0], c[1], n);
  }
  if (nums.hand !== null && f.hand && nums.showHand) { const c = f.hand.poly.reduce((a, p) => [a[0] + p[0] / f.hand.poly.length, a[1] + p[1] / f.hand.poly.length], [0, 0]); svg += num(c[0], c[1], nums.hand); }
  for (const p of f.falling) svg += num(p[0], p[1], nums.hand);
  for (const p of f.lost) svg += num(p[0], p[1], nums.hand);
  // the screenshot is the whole screen; it is shown through a window the size of the box
  return `<div class="fr" style="width:${W}px;height:${H}px">${label ? `<span class="lab">${label}</span>` : ''}<div style="position:absolute;left:${(-box.x0 * k).toFixed(1)}px;top:${(-box.y0 * k).toFixed(1)}px;width:${(390 * k).toFixed(1)}px;height:${(844 * k).toFixed(1)}px">` +
    `<img src="${L.dataUrl(f.png)}" style="width:100%;height:100%;display:block"></div><svg style="position:absolute;left:0;top:0" width="${W}" height="${H}">${svg}</svg></div>`;
}

// the drop of a key's hand string ('■-2', '▲-1.5', '▼0.5'): piece, col and the way it is shown and let go
function handOf(s) { const e = parse(s); return { piece: e.piece, col: e.col, way: e.piece === 'sq' ? undefined : e.way }; }
const buildQ = (log, colors) => log.map((e, i) => [e.piece, e.col, colors[i], e.piece === 'sq' ? undefined : e.way]);
// a fall filmed: frames at moments of the game's own fall (held before it is let go, then from the release)
async function filmFall(page, q, moments) {
  if (!(await load(page, q))) return null;
  const out = [];
  const T = await page.evaluate(() => CFG.OFF_TIP_T + CFG.OFF_HOLD);
  const RK = await page.evaluate(() => CFG.ROCK_T);
  if (moments.includes('held')) out.push(Object.assign(await frame(page), { m: 'held' }));
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true })));
  const rel = await page.evaluate(() => CS.lastRelease && { outcome: CS.lastRelease.outcome, reason: CS.lastRelease.reason });
  // (the hand takes the next tile from the box at once: it is not part of this fall, so the hand is not drawn after)
  await page.evaluate(() => CS.hide('hand'));
  if (!rel) return null;
  // step to each moment: touching (the 'off' event), the tip's or rock's peak, leaving the wall, out, on the rug
  const stepUntil = (fn, max) => page.evaluate(([src, max]) => { const f = new Function('return (' + src + ')()'); for (let i = 0; i < max && !f(); i++) CS.step(1); return f(); }, [fn.toString(), max]);
  await stepUntil(() => CS.events.some(e => e.type === 'off'), 240);
  const tips = rel.reason === 'TIPS OVER';
  if (moments.includes('touch')) { await page.evaluate(() => CS.step(2)); out.push(Object.assign(await frame(page), { m: 'touch' })); }
  if (moments.includes('tip')) { await page.evaluate(t => CS.wait(t), tips ? RK / 2 - 0.02 : T - 0.06); out.push(Object.assign(await frame(page), { m: tips ? 'rock' : 'tip' })); }
  // it leaves the wall: the lost tile is on its way
  await stepUntil(() => DEBRIS.some(d => d.lost), 240);
  if (moments.includes('leave')) { await page.evaluate(() => CS.step(3)); out.push(Object.assign(await frame(page), { m: 'leave' })); }
  if (moments.includes('out')) { await page.evaluate(() => CS.wait(0.18)); out.push(Object.assign(await frame(page), { m: 'out' })); }
  if (moments.includes('rug')) { await page.evaluate(() => CS.wait(1.2)); out.push(Object.assign(await frame(page), { m: 'rug' })); }
  out.rel = rel;
  return out;
}
const MOMENT = { held: 'held', touch: 'touches', tip: 'tips', rock: 'rocks', leave: 'leaves', out: 'falls out', rug: 'on the rug' };

async function picture(page, p, seed) {
  const units = p.kind === 'pair' ? 2 : p.kind === 'filmstrip' ? 3 : 1, W = units * UNIT + (units - 1) * GAP;
  if (p.kind === 'pair') {
    const logs = p.build.map(b => b.map(parse)), n = Math.max(...logs.map(l => l.length));
    const sides = [];
    for (const [si, log] of logs.entries()) {
      const colors = colorsFor(log, null, seed + si), h = handOf(p.hand[si]);
      const stays = /stays/.test(p.outcomes[si]);
      const nums = { tile: i => i < log.length ? i + 1 : n + 1, hand: n + 1, showHand: false };
      if (stays) {
        // the tile in place, standing (placed by the rules as the drop puts it)
        const q = { build: buildQ(log, colors).concat([[h.piece, h.col, 'orange', h.way]]), hand: { piece: 'sq', col: 0 }, off: OFF.concat(['hand']) };
        if (!(await load(page, q))) return { err: 'side ' + 'AB'[si] + ' does not build' };
        sides.push({ frames: [await frame(page)], nums, labels: ['AB'[si] + ': stays'] });
      } else {
        const q = { build: buildQ(log, colors), hand: { piece: h.piece, col: h.col }, way: h.way, off: OFF, color: 'orange' };
        const fr = await filmFall(page, q, ['touch', 'tip', 'rug']);
        if (!fr) return { err: 'side ' + 'AB'[si] + ' does not fall' };
        sides.push({ frames: fr, nums, labels: fr.map((f, k) => (k ? '' : 'AB'[si] + ': ') + MOMENT[f.m]) });
      }
    }
    const all = sides.flatMap(s => s.frames), box = boxOf(all, { rug: true });
    const nF = all.length, fw = Math.floor((W - (nF - 1) * 6 - 18) / nF);
    const html = sides.map((s, si) => `<div class="side">${s.frames.map((f, k) => frameHTML(f, box, fw, 330, s.nums, s.labels[k])).join('')}</div>`).join('<div class="div"></div>');
    return { units, html };
  }
  if (p.kind === 'filmstrip') {
    const log = p.build.map(parse), colors = colorsFor(log, null, seed), h = handOf(p.hand), n = log.length;
    const q = { build: buildQ(log, colors), hand: { piece: h.piece, col: h.col }, way: h.way, off: OFF, color: 'orange' };
    const fr = await filmFall(page, q, ['held', 'touch', 'tip', 'leave', 'out', 'rug']);
    if (!fr) return { err: 'does not fall' };
    const box = boxOf(fr, { rug: true, hand: true }), fw = Math.floor((W - 5 * (12 + 14)) / 6);
    const nums = { tile: i => i + 1, hand: n + 1, showHand: true };
    return { units, html: `<div class="side">${fr.map(f => frameHTML(f, box, fw, 300, nums, MOMENT[f.m])).join('<span class="arr">›</span>')}</div>` };
  }
  // a build standing (a planted defect's tiles drawn outside the rules)
  let log = p.build.filter(s => !/^\+/.test(s)).map(parse), raw = null;
  if (p.kind === 'plant') {
    const P = plants().find(x => x.id === p.plantId);
    if (!P) return { err: 'no plant ' + p.plantId };
    log = P.base.map(parse);
    raw = P.add().map(rawOf);
  }
  const colors = colorsFor(log, raw, seed);
  const q = { build: buildQ(log, colors), hand: { piece: 'sq', col: 0 }, off: OFF.concat(['hand']) };
  if (raw) q.raw = raw.map((r, i) => r.concat([colors[log.length + i]]));
  if (!(await load(page, q))) return { err: 'does not build' };
  const f = await frame(page), box = boxOf([f], { rug: false });
  return { units, html: `<div class="side">${frameHTML(f, box, W - 8, 380, { tile: i => i + 1, hand: null }, null)}</div>` };
}

const LEGEND = [
  'How to read the gallery pictures (drawn by the game itself). Each picture has a label (G01, G02, ...) at its top left.',
  '- The two coupled toy cars with wheels are seen from the side; the tiles stand on their flat top in one flat wall, and the',
  '  patterned rug is in front of the cars. Tiles are magnetic building tiles (squares and triangles with equal sides).',
  '  Each tile is numbered in the order it was put on.',
  '- A fine dotted outline under part of a tile marks a thin gap of air between that tile and the tile below it. It is not',
  '  a piece and not a joint.',
  '- A single scene shows a build as it stands.',
  '- A wide picture with scenes marked A and B shows two separate builds side by side. They are not before and after: they',
  '  differ in one thing (where the last tile was dropped, or one extra tile in one of them). A tile that is in both builds',
  '  has the same number in both; the highest number is the tile that was dropped last. In one build it stays where it is',
  '  shown. In the other, small frames show what happened to it: where it touched the wall (it turns red there), it tipping',
  '  over (or the tiles it would pull over rocking a little toward the corner they would tip over, and back), and it lying',
  '  on the rug in front of the cars, out of play. Tiles already in the wall never move.',
  '- A row of six frames is a filmstrip, left to right: the tile held by the hand above the build, the tile touching the',
  '  build (red), it tipping about where it touched (or the tiles it would pull over rocking toward their corner and back),',
  '  it leaving the wall, it falling out of the wall toward you, and it lying on the rug.',
  'Flag any picture where something does not look like what real magnetic tiles would do, and say which tile numbers.'
].join('\n');

const USAGE = `usage: node tools/review/gallery-real.cjs [--key=<gallery key.json>] [--out=dir] [--only=G01,G07]
  draws a plausibility gallery key (tools/review/gallery.cjs's format; default ${KEY}) with the game's own
  renderer through ?quiz=: tiles numbered, no HUD, falls as the game draws them (its own release, filmed). The same
  ids and sheets as the key, packed in rows of three units; sheet-NN.png, legend.txt and run.json in --out
  (default ${OUT}). The key's answers stay in the key.`;
async function main() {
  if (A.help) { console.log(USAGE); return 0; }
  const key = JSON.parse(fs.readFileSync(KEY, 'utf8'));
  const t0 = Date.now();
  L.mkdirp(OUT);
  for (const f of fs.readdirSync(OUT)) if (/^sheet-\d+\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await L.launch();
  // (the game drawn at twice the pixels: the pictures are cut small and shown larger)
  const { context, errors } = await L.phoneContext(browser, { dpr: 2 });
  const page = await context.newPage();
  const pics = key.pictures.filter(p => !ONLY || ONLY.has(p.id));
  const done = [], failed = [];
  for (const [k, p] of pics.entries()) {
    let r;
    try { r = await picture(page, p, 1000 + k); } catch (e) { r = { err: e.message }; }
    if (r.err) { failed.push(p.id + ' ' + p.kind + ': ' + r.err); continue; }
    done.push(Object.assign({}, p, r));
  }
  await context.close();
  // sheets: the key's sheets, each packed into rows of three units in the key's order
  const comp = await L.composer(browser, { dpr: 1.5 });
  const CSS = `.row{display:flex;gap:${GAP}px;margin-bottom:${GAP}px;align-items:stretch}.pic{position:relative;border:1px solid #dfe2e8;border-radius:8px;padding:24px 4px 4px;display:flex;justify-content:center;align-items:flex-end;background:#fff}
.u1{width:${UNIT}px}.u2{width:${2 * UNIT + GAP}px}.u3{width:${3 * UNIT + 2 * GAP}px}.id{position:absolute;left:8px;top:5px;font-size:13px;line-height:14px;font-weight:700;color:#5a6075}
.side{display:flex;gap:6px;align-items:flex-end}.div{width:3px;align-self:stretch;background:#c9ccd6;margin:0 6px}.fr{position:relative;overflow:hidden;border-radius:4px;flex:none}
.lab{position:absolute;left:3px;top:2px;z-index:2;font-size:11px;font-weight:700;background:rgba(255,255,255,0.85);border-radius:3px;padding:0 3px;line-height:14px}.arr{color:#7d8597;font-size:22px;align-self:center;width:14px;text-align:center;flex:none}
#root{padding:12px}`;
  const bySheet = new Map();
  for (const p of done) { const s = p.sheet || 1; if (!bySheet.has(s)) bySheet.set(s, []); bySheet.get(s).push(p); }
  const files = [];
  for (const [s, list] of [...bySheet.entries()].sort((a, b) => a[0] - b[0])) {
    const rows = [];
    for (const p of list) { const row = rows[rows.length - 1]; const used = row ? row.reduce((a, x) => a + x.units, 0) : 3; if (!row || used + p.units > 3) rows.push([p]); else row.push(p); }
    const html = rows.map(row => `<div class="row">${row.map(p => `<div class="pic u${p.units}"><span class="id">${p.id}</span>${p.html}</div>`).join('')}</div>`).join('');
    const f = path.join(OUT, 'sheet-' + String(s).padStart(2, '0') + '.png');
    fs.writeFileSync(f, await comp.shoot(html, CSS));
    files.push(f);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'legend.txt'), LEGEND + '\n');
  L.writeJSON(path.join(OUT, 'run.json'), { key: KEY, made: new Date().toISOString(), game: L.GAME, sheets: files.map(f => path.basename(f)), pictures: done.length, failed, consoleErrors: errors.slice(0, 20), hidden: OFF });
  console.log(`${done.length} pictures on ${files.length} sheets in ${OUT} (${((Date.now() - t0) / 1000).toFixed(0)} s)` + (failed.length ? `; ${failed.length} failed: ${failed.join('; ')}` : '') + (errors.length ? '; console errors: ' + errors.slice(0, 3).join(' | ') : ''));
  return failed.length ? 1 : 0;
}
if (require.main === module) main().then(c => process.exit(c), e => { console.error(e); process.exit(1); });
