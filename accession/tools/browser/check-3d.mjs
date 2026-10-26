// ACCESSION — the 3D checks (BUILD.md §6.3, milestone M2b), Chromium with software WebGL.
// Fixed scenes in all three slice programmes (the enfilade of M.11, the case labyrinth of
// A.4, the sculpture court of S.9), at both zoom steps, at phone and laptop size. Each scene first
// asserts that the 3D view is the active one, so a silent fallback cannot pass.
//   Occlusion: of the visible tiles on screen with no actor or mark, at most 2% may show
//     less than 25% of their floor pixels (id buffer, scene against floor alone); a tile's
//     own case, plinth or bench counts as showing it. The faint rings of a noise, a call and
//     a thrown Solution's area are drawn over the floor, which shows through them, so their
//     tiles are measured too.
//   M3's board: a frame with an opened case (u), a broken one (k), shards (x), an open staff
//     door (s), a cracked case, a noise ring and a herald's call, and a frame with two awake
//     exhibits in a column (the farther in a case, the nearer marking a special), each
//     measured as every frame is; the scene first checks it holds what it is meant to.
//   On top: every actor and mark shows at least 90% of its own pixels over the scene.
//   Consistency: every actor and mark in the view model is in inspect(), on the board.
//   Context loss: WEBGL_lose_context loses and restores the context; the board keeps
//     drawing (the flat board stands in) and the 3D board returns.
//   Cost: frame and load times are recorded, not gated (no GPU here).
// The tap-tolerance and screen checks for both views are in check-screens.mjs.
import { open } from './lib.mjs';
import { board, nextStep } from './measure.mjs';

// The sculpture court runs at a device pixel ratio of 2, as on a phone.
const SCENES = [{ dept: 'M11', seed: 3, prog: 'enfilade', dpr: 1 }, { dept: 'A4', seed: 7, prog: 'case labyrinth', dpr: 1 }, { dept: 'S9', seed: 5, prog: 'sculpture court', dpr: 2 }];
const lines = [], problems = [];
const bad = s => problems.push(s);

// With `tele`, telegraphs are added to the frame on your tile, on each tile of every exhibit
// next to you and on a free tile beside you, as a special aimed at you would mark them.
const measure = (page, tele) => page.evaluate(tele => {
  const A = window.ACCESSION, R = A.renderer, vm = A.vm();
  if (tele) {
    const me = A.state.actors[0], at = [[me.x, me.y]];
    for (const a of vm.actors) if (a.uid !== 'you' && Step.adjacent(A.state, me, Actors.byUid(A.state, a.uid)))
      for (let dy = 0; dy < a.size; dy++) for (let dx = 0; dx < a.size; dx++) at.push([a.x + dx, a.y + dy]);
    const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [me.x + dx, me.y + dy]).find(([x, y]) => Grid.walkable(A.state.dept, x, y) && !Actors.at(A.state, x, y));
    if (free) at.push(free);
    vm.marks = vm.marks.concat(at.map(([x, y], i) => ({ kind: 'telegraph', x, y, dmg: 4 + i })));
  }
  const t = performance.now(); R.draw(vm); const frame = performance.now() - t;
  const floor = R.idBuffer({ floorOnly: true }), scene = R.idBuffer({ scene: true }), full = R.idBuffer();
  const count = buf => { const c = new Map(); for (const id of buf.ids) if (id) c.set(id, (c.get(id) || 0) + 1); return c; };
  const fc = count(floor), sc = count(scene), n = vm.w * vm.h;
  // Tiles with an actor or a mark on them are left out: what stands there covers them.
  const marked = new Set();
  for (const a of vm.actors) for (let dy = 0; dy < a.size; dy++) for (let dx = 0; dx < a.size; dx++) marked.add((a.y + dy) * vm.w + a.x + dx);
  const FAINT = new Set(['noise', 'call', 'area']);
  for (const k of vm.marks) if (!FAINT.has(k.kind)) marked.add(k.y * vm.w + k.x);
  for (const [x, y] of vm.path || []) marked.add(y * vm.w + x);
  let tiles = 0, hidden = 0, worst = 1;
  for (const [id, total] of fc) {
    const i = id - 1;
    if (i < 0 || i >= n || marked.has(i) || vm.vis[i] !== 2 || total < 20) continue;
    tiles++;
    // A tile is shown by its floor or by what stands on it (a case covers its own floor).
    const f = ((sc.get(id) || 0) + (sc.get(id + n) || 0)) / total;
    worst = Math.min(worst, f);
    if (f < 0.25) hidden++;
  }
  // Entrances and exits: each one whose tile lies wholly in the clear part of the board shows
  // its mat (drawn with the tile's object id); a door cut by the board's edge may show only
  // the floor round its mat.
  const bb = document.getElementById('board').getBoundingClientRect(), clearBottom = bb.bottom - UI.sheetCover();
  const doors = [];
  for (const [id, total] of fc) {
    const i = id - 1;
    if (i < 0 || i >= n || vm.vis[i] !== 2) continue;
    const x = i % vm.w, y = (i - x) / vm.w, ch = vm.tiles[y][x], r = R.tileRect(x, y).rect;
    const inside = r.x >= bb.left && r.y >= bb.top && r.x + r.w <= bb.right && r.y + r.h <= clearBottom;
    if ((ch === 'E' || ch === 'X') && inside && !(sc.get(id + n) > 0)) doors.push(`${ch} at ${x},${y}`);
  }
  // The 75% rule applies to actors wholly on the board; one cut by an edge shows its bar or
  // arrow over the little that is left.
  const whole = new Set(R.inspect().filter(d => d.kind === 'actor' && d.rect.x >= bb.left && d.rect.y >= bb.top && d.rect.x + d.rect.w <= bb.right && d.rect.y + d.rect.h <= clearBottom).map(d => d.id));
  const overlays = Object.values(full.legend).filter(l => l.alone);
  const low = overlays.filter(l => l.kind === 'mark' && l.onTop / l.alone < 0.9).map(l => `mark ${l.id} shows only ${Math.round(100 * l.onTop / l.alone)}% of its pixels`)
    .concat(overlays.filter(l => l.kind === 'actor' && whole.has(l.id) && l.self / l.alone < 0.75).map(l => `actor ${l.id} shows only ${Math.round(100 * l.self / l.alone)}% of itself`));
  // What the 2D layer really painted: the overlay canvas, at its own pixel ratio, against a
  // reference painted here from the same display list, item by item in list order, each in
  // isolation. Wherever the id buffer has an actor or a mark, the two must match.
  const over = R.overlayCanvas(), k = over.width / full.w, ref = document.createElement('canvas');
  ref.width = over.width; ref.height = over.height;
  const rx = ref.getContext('2d');
  rx.setTransform(k, 0, 0, k, 0, 0); rx.imageSmoothingEnabled = false;
  for (const it of R.displayList()) { rx.save(); it.paint(rx); rx.restore(); }
  const od = over.getContext('2d').getImageData(0, 0, over.width, over.height).data, rd = rx.getImageData(0, 0, ref.width, ref.height).data;
  let want = 0, same = 0;
  for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) {
    const l = full.legend[full.ids[y * full.w + x]];
    if (!l || (l.kind !== 'actor' && l.kind !== 'mark')) continue;
    want++;
    let diff = 0;
    for (let j = Math.floor(y * k); j < Math.floor((y + 1) * k); j++) for (let i = Math.floor(x * k); i < Math.floor((x + 1) * k); i++) {
      const o = (j * over.width + i) * 4;
      for (let c = 0; c < 4; c++) diff = Math.max(diff, Math.abs(od[o + c] - rd[o + c]));
    }
    if (diff <= 48) same++;
  }
  const painted = want ? same / want : 0;
  // The page as composited: the 2D layer is the topmost element over every actor and mark.
  const top = R.inspect().filter(d => d.kind !== 'tile').filter(d => {
    const b = document.getElementById('board').getBoundingClientRect(), cx = d.rect.x + d.rect.w / 2, cy = d.rect.y + d.rect.h / 2;
    if (cx < b.left || cy < b.top || cx >= b.right || cy >= b.bottom) return false;
    const e = document.elementFromPoint(cx, cy);
    return !(e && e.classList.contains('board-over'));
  }).map(d => d.id);
  // What the frame holds, for the scenes that must hold something: the marks by kind, the
  // tiles in view by character, and the display list's ids.
  const kinds = {}, chars = {};
  for (const k of vm.marks) kinds[k.kind] = (kinds[k.kind] || 0) + 1;
  for (let i = 0; i < n; i++) if (vm.vis[i] === 2) { const ch = vm.tiles[(i - i % vm.w) / vm.w][i % vm.w]; chars[ch] = (chars[ch] || 0) + 1; }
  const ids = R.displayList().map(d => d.id);
  return { frame, tiles, hidden, worst, overlays: overlays.length, low, doors, top, painted, teles: vm.marks.filter(k => k.kind === 'telegraph').length, kinds, chars, ids };
}, tele);

// The page as composited: a screenshot, at every fully opaque pixel the 2D layer painted over
// an actor or a mark in the clear part of the board, shows that pixel's own colour. A 2D layer
// hidden by opacity, a filter, a blend mode or a misplaced box fails, though hit-testing still
// finds it on top.
const composited = async page => {
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async png => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const shot = cx.getImageData(0, 0, c.width, c.height).data, dpr = c.width / window.innerWidth;
    const R = window.ACCESSION.renderer, over = R.overlayCanvas(), ob = over.getBoundingClientRect();
    const od = over.getContext('2d').getImageData(0, 0, over.width, over.height).data, full = R.idBuffer(), k = over.width / full.w;
    const bb = document.getElementById('board').getBoundingClientRect(), clearBottom = bb.bottom - UI.sheetCover();
    let want = 0, same = 0;
    for (let y = 0; y < over.height; y++) for (let x = 0; x < over.width; x++) {
      const o = (y * over.width + x) * 4;
      if (od[o + 3] !== 255) continue;
      const l = full.legend[full.ids[Math.floor(y / k) * full.w + Math.floor(x / k)]];
      if (!l || (l.kind !== 'actor' && l.kind !== 'mark')) continue;
      // Where this pixel should be on the page, if the 2D layer sat on the board as built.
      const px = bb.left + (x + 0.5) / k, py = bb.top + (y + 0.5) / k;
      if (px < bb.left || py < bb.top || px >= bb.right || py >= clearBottom) continue;
      want++;
      const sx = Math.floor(px * dpr), sy = Math.floor(py * dpr), q = (sy * c.width + sx) * 4;
      if (Math.abs(shot[q] - od[o]) <= 24 && Math.abs(shot[q + 1] - od[o + 1]) <= 24 && Math.abs(shot[q + 2] - od[o + 2]) <= 24) same++;
    }
    return { want, same, box: [ob.left - bb.left, ob.top - bb.top, ob.width - bb.width, ob.height - bb.height].every(v => Math.abs(v) < 1) };
  }, png);
};

function report(tag, m, b, shot) {
  const pct = m.tiles ? 100 * m.hidden / m.tiles : 100;
  lines.push(`${tag}: ${m.tiles} unmarked visible tiles, ${m.hidden} under 25% visible (${pct.toFixed(1)}%), least visible ${Math.round(100 * m.worst)}%; ${m.overlays} actors and marks on top; frame ${m.frame.toFixed(1)} ms`);
  if (m.tiles < 20) bad(`${tag}: only ${m.tiles} tiles measured`);
  if (pct > 2) bad(`${tag}: ${pct.toFixed(1)}% of unmarked visible tiles show under 25% of their floor`);
  if (!m.overlays) bad(`${tag}: no actors or marks in the id buffer`);
  m.low.forEach(l => bad(`${tag}: ${l}`));
  m.doors.forEach(d => bad(`${tag}: the ${d} has no visible mat`));
  m.top.forEach(d => bad(`${tag}: ${d} is not on the topmost layer of the board`));
  if (m.painted < 0.98) bad(`${tag}: the 2D layer matches the display list at only ${(100 * m.painted).toFixed(1)}% of the actors' and marks' pixels`);
  b.problems.forEach(p => bad(`${tag}: ${p}`));
  const seen = shot.want ? shot.same / shot.want : 0;
  lines.push(`${tag}: on the page, ${(100 * seen).toFixed(1)}% of ${shot.want} opaque actor and mark pixels show as painted${m.teles ? `; ${m.teles} telegraphs` : ''}`);
  if (!shot.want) bad(`${tag}: no opaque actor or mark pixels to find on the page`);
  else if (seen < 0.95) bad(`${tag}: on the page, only ${(100 * seen).toFixed(1)}% of the 2D layer's opaque actor and mark pixels show as painted`);
  if (!shot.box) bad(`${tag}: the 2D layer does not sit exactly over the board`);
}
const check = async (page, tag, tele) => { const m = await measure(page, tele); report(tag, m, await page.evaluate(board), await composited(page)); return m; };

// M3's board, staged round you: an opened case, a broken one, shards and an open staff door
// on free floor in view; a Security case beside you, bashed once, so it is cracked and the
// bash's loud noise rings the floor; and a herald's call from the nearest exhibit.
const stageTiles = page => page.evaluate(() => {
  const A = window.ACCESSION, s = A.state, me = s.actors[0], vm = A.vm(), m = s.dept;
  const free = [];
  for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = me.x + dx, y = me.y + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !Grid.inside(m, x, y) || Grid.ch(m, x, y) !== '.' || vm.vis[y * m.w + x] !== 2) continue;
    if (Actors.at(s, x, y) || Cases.at(s, x, y) || free.some(([fx, fy]) => fx === x && fy === y)) continue;
    free.push([x, y]);
  }
  const beside = free.find(([x, y]) => Math.max(Math.abs(x - me.x), Math.abs(y - me.y)) === 1 && (x === me.x || y === me.y));
  if (!beside || free.length < 6) return { error: `only ${free.length} free tiles round you` };
  const rest = free.filter(f => f !== beside);
  ['u', 'k', 'x', 's'].forEach((ch, i) => Grid.set(m, rest[i][0], rest[i][1], ch));
  m.fixtures.push(Cases.make({ x: beside[0], y: beside[1], room: null, num: 'staged', glass: 3, lock: 7 }));
  Grid.set(m, beside[0], beside[1], 'v');
  const ev = A.act({ a: 'bash', x: beside[0], y: beside[1] });
  const refused = ev.find(e => e.k === 'refused');
  if (refused) return { error: 'the bash was refused: ' + refused.reason };
  const near = s.actors.filter(a => a.uid !== 'you' && !a.gone).sort((p, q) => Actors.dist(p, me.x, me.y) - Actors.dist(q, me.x, me.y))[0];
  if (near) { near.telegraph = null; Specials.mark(s, near, 'call', Specials.tiles(s, near, 'call'), []); }
  return { error: null };
});
// Two awake exhibits in a column beside you: the farther stands in a case, the nearer is
// marking a special, so the glyph rows of both are as full as they get.
const stageCrowd = page => page.evaluate(() => {
  const A = window.ACCESSION, s = A.state, me = s.actors[0], m = s.dept, vm = A.vm();
  const open = (x, y) => Grid.inside(m, x, y) && Grid.ch(m, x, y) === '.' && vm.vis[y * m.w + x] === 2 && !Actors.at(s, x, y) && !Cases.at(s, x, y);
  const others = s.actors.filter(a => a.uid !== 'you' && !a.gone && (a.size || 1) === 1);
  if (others.length < 2) return { error: 'fewer than two one-tile exhibits' };
  for (const dx of [2, -2, 3, -3]) for (const dy of [-1, 0, 1]) {
    const x = me.x + dx, y = me.y + dy;
    if (!open(x, y) || !open(x, y + 1)) continue;
    const [far, nearer] = others.slice(0, 2);
    for (const a of [far, nearer]) { a.mode = 'awake'; a.pips = 0; a.telegraph = null; a.next = Math.max(a.next, me.next); }
    far.x = x; far.y = y; nearer.x = x; nearer.y = y + 1;
    Grid.set(m, x, y, 'v');
    nearer.telegraph = { sp: 'ring', tiles: [], from: [], via: [], gross: 1, effect: 'damage', turn: s.turn, tick: s.tick };
    return { error: null, far: far.uid, nearer: nearer.uid };
  }
  return { error: 'no two free tiles in a column beside you' };
});

for (const [W, Hh] of [[390, 844], [1280, 800]]) for (const sc of SCENES) {
  const t0 = Date.now();
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: W, height: Hh }, dpr: sc.dpr, query: `?dept=${sc.dept}&seed=${sc.seed}&board=board3d` });
  await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
  const load = await page.evaluate(async () => { const t = performance.now(); await window.ACCESSION.renderer.ready.catch(() => {}); return performance.now() - t; });
  const tag = `${sc.dept} (${sc.prog}) ${W}×${Hh}`;
  const active = await page.evaluate(() => window.ACCESSION.views.active());
  if (active.id !== 'board3d') { bad(`${tag}: the 3D view is not active (${active.note})`); await browser.close(); continue; }
  await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
  // At the entrance first, where the entrance mat must show.
  await check(page, `${tag} at the entrance`);
  // A fixed scene: walk towards the nearest exhibit until it is within 4 tiles.
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(nextStep, 4);
    if (st.done || st.stuck) break;
    await page.evaluate(t => window.ACCESSION.tap(t), st.tile);
    await page.waitForFunction(() => !window.ACCESSION.busy());
  }
  for (const z of [0, 1]) {
    await page.evaluate(i => window.ACCESSION.setZoom(i), z);
    await check(page, `${tag} zoom ${z}`);
  }
  // A melee frame: you directly north of an exhibit that has just been struck awake, so its
  // state glyph and sprite lie as close over you as they can; the largest exhibit first, so a
  // 2×2 Centrepiece is tried where one can be reached. Marks over another actor do not count
  // as hiding it. You are placed on that tile (one you could walk to) rather than walked
  // there: since M3 a walk wakes the sleepers it passes (§8.2, the ring), and this frame
  // measures the renderer, so it should not depend on which exhibits the rules bring along.
  // M3 departments leave the Centrepiece out until M4 places it (§5.5), so it is first stood
  // on its plinth, asleep, as M2 placed it.
  await page.evaluate(() => {
    const s = window.ACCESSION.state, p = Packs.get(s.dept.acc), cp = p.centrepiece, stats = Roles.stats('centrepiece', s.dept.depth);
    const [x, y] = Layout.generate(p.programme, 0, s.seed, { acc: p.acc, depth: s.dept.depth }).plan.cpl;
    Actors.spawn(s, Object.assign({}, stats, { uid: `${p.acc}.${s.dept.depth}.centre.1`, sp: cp.id, arch: cp.archetype, size: cp.size || 1, x, y, mode: 'dormant', maxHp: stats.hp }));
  });
  const melee = await page.evaluate(() => {
    const A = window.ACCESSION, s = A.state;
    const cands = s.actors.filter(q => q.uid !== 'you' && !q.gone).map(a => ({ a, path: Grid.walkable(s.dept, a.x, a.y - 1) && !Actors.at(s, a.x, a.y - 1) ? Path.to(s, a.x, a.y - 1) : [] }))
      .filter(c => c.path.length && c.path.length <= 60).sort((p, q) => (q.a.size || 1) - (p.a.size || 1) || p.path.length - q.path.length);
    for (const { a } of cands) {
      const me = s.actors[0];
      me.x = a.x; me.y = a.y - 1;
      if (A.act({ a: 'attack', uid: a.uid }).some(e => e.k === 'refused')) continue;
      return a.uid + (a.size > 1 ? ' (2×2)' : '');
    }
    return null;
  });
  if (melee) {
    await page.evaluate(() => window.ACCESSION.setZoom(0));
    await check(page, `${tag} melee beside ${melee}`);
    // The same frame with telegraphs under you and the exhibit: their fills lie beneath the
    // actors (§6.2), their numbers on top of everything.
    await check(page, `${tag} melee beside ${melee}, telegraphed`, true);
  } else lines.push(`${tag}: no exhibit with a free tile to its north within reach; melee frame skipped`);
  // M3's board: the staged tiles, a cracked case, a noise ring and a call, at both zooms.
  const staged = await stageTiles(page);
  if (staged.error) bad(`${tag}: the M3 frame could not be staged: ${staged.error}`);
  else for (const z of [0, 1]) {
    await page.evaluate(i => window.ACCESSION.setZoom(i), z);
    const m = await check(page, `${tag} M3 tiles and marks, zoom ${z}`);
    const want = [['u', m.chars.u], ['k', m.chars.k], ['x', m.chars.x], ['s', m.chars.s], ['a noise ring', m.kinds.noise], ['a call', m.kinds.call], ['a cracked case', m.ids.some(i => i.startsWith('cracks:'))]];
    for (const [what, n] of want) if (!n) bad(`${tag} M3 zoom ${z}: the frame shows no ${what}`);
    lines.push(`${tag} M3 zoom ${z}: ${m.kinds.noise || 0} noise marks, ${m.kinds.call || 0} call marks, tiles ${['u', 'k', 'x', 's'].map(c => c + '×' + (m.chars[c] || 0)).join(' ')}`);
  }
  await page.evaluate(() => window.ACCESSION.setZoom(0));
  // Two awake exhibits in a column: each shows at least 75% of itself (the glyph row of the
  // nearer one never lies over the farther one).
  const crowd = await stageCrowd(page);
  if (crowd.error) bad(`${tag}: the crowd frame could not be staged: ${crowd.error}`);
  else for (const z of [0, 1]) {
    await page.evaluate(i => window.ACCESSION.setZoom(i), z);
    const m = await check(page, `${tag} two exhibits in a column, zoom ${z}`);
    for (const id of ['encased:' + crowd.far, 'telegraphing:' + crowd.nearer, 'state:' + crowd.far, 'state:' + crowd.nearer]) if (!m.ids.includes(id)) bad(`${tag} crowd zoom ${z}: ${id} is not drawn`);
  }
  await page.evaluate(() => window.ACCESSION.setZoom(0));
  // Context loss and restore.
  const loss = await page.evaluate(async () => {
    const A = window.ACCESSION, c = document.querySelector('#board canvas'), gl = c.getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context');
    if (!ext) return { error: 'WEBGL_lose_context is unavailable' };
    const tick = () => new Promise(r => setTimeout(r, 120));
    ext.loseContext(); await tick();
    const during = { standIn: A.renderer.standIn(), tiles: A.renderer.inspect().filter(d => d.kind === 'tile').length };
    A.act({ a: 'wait' });
    during.tilesAfterAct = A.renderer.inspect().filter(d => d.kind === 'tile').length;
    ext.restoreContext(); await tick();
    A.act({ a: 'wait' });
    const after = { standIn: A.renderer.standIn(), tiles: A.renderer.inspect().filter(d => d.kind === 'tile').length, ids: !!A.renderer.idBuffer() };
    return { during, after, active: A.views.active().id };
  });
  if (loss.error) bad(`${tag}: ${loss.error}`);
  else {
    lines.push(`${tag} context loss: flat stand-in ${loss.during.standIn}, ${loss.during.tilesAfterAct} tiles drawn while lost; restored: stand-in ${loss.after.standIn}, ${loss.after.tiles} tiles, id buffer ${loss.after.ids}`);
    if (!loss.during.standIn || !loss.during.tiles || !loss.during.tilesAfterAct) bad(`${tag}: while the context was lost the board stopped drawing`);
    if (loss.after.standIn || !loss.after.tiles || !loss.after.ids || loss.active !== 'board3d') bad(`${tag}: after restore the 3D board did not come back`);
  }
  lines.push(`${tag}: three.js ready in ${load.toFixed(0)} ms, page ${Date.now() - t0} ms in all`);
  if (errors.length) bad(`${tag}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `3d: ${problems.length} problem(s)` : `3d: occlusion, marks on top, consistency and context loss pass in all three programmes at both zooms`);
process.exit(problems.length ? 1 : 0);
