// ACCESSION — the keyboard alone (BUILD.md §7.1). A real visit played with page.keyboard and
// nothing else (no mouse, no click, no element.click(), no action staged), at 390×844 and
// 1280×800, in both board views, in M.11 (seed 3), as check-play: Settings (the board view,
// reduced motion, text size, zoom) and "How the museum works" with its keys; zoom; steps by
// arrows, vi-keys and the numpad; a blow by bumping, by Enter, by the label's key and by Tab;
// x and Shift+X through everything in sight, nearest first; a case opened, what it held
// taken, walked into, another broken through its confirmation (Escape, then Enter); shards and
// a beam's confirmations; an item taken, a label read, a staff door opened and closed; sit,
// rest and wait; the Bag (equip, take off, drop, drink, throw aimed with the keys, a
// Catalogue Card's choice, a Floor Plan), the floor plan, a quickslot; the fork, the
// Pin-Driver and the Window Pole aimed with the keys (its sheet cancelled and answered, and
// its take); a Restoration kit; every layer with a visible focus ring of enough contrast on
// each control, the focus kept inside it, and no game key acting behind it; leaving, the end
// of the visit and "Another visit"; a death, its recap closed and shown again, and "Another
// visit". The scenes are tools/browser/scenes.mjs's; this file is their keyboard driver.
import { open } from './lib.mjs';
import { layout, targets } from './measure.mjs';
import { playScenes, install } from './scenes.mjs';

const problems = [], lines = [];
const bad = s => problems.push(s);
const SIZES = [[390, 844], [1280, 800]];

// ---- The keyboard's driver ----
function keyDriver(page, tag) {
  const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
  const press = async k => { await page.keyboard.press(k); await settle(); };
  const is = sel => page.evaluate(sel => !!document.activeElement && document.activeElement.matches(sel), sel);
  // The arrows (or Tab) until the focus is on sel; true once it is.
  const focusOn = async (sel, key = 'ArrowDown', max = 40) => {
    for (let i = 0; i < max; i++) { if (await is(sel)) return true; await page.keyboard.press(key); }
    return is(sel);
  };
  // What x has chosen: the selection, or the exit whose walk is previewed.
  const chosen = () => page.evaluate(() => {
    const A = window.ACCESSION, vm = A.vm(), t = vm.selectedTile;
    if (vm.selection) return vm.selection;
    return t && A.state.dept.exits.some(([x, y]) => x === t.x && y === t.y) ? `exit:${t.x},${t.y}` : null;
  });
  // A button pressed by the key it shows (data-key, drawn from data-hint), or else reached by
  // Tab and pressed with Enter.
  const pressButton = async (sel, what) => {
    const b = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { key: e.dataset.key || null, hint: e.dataset.hint || null } : null; }, sel);
    if (!b) { bad(`${tag}: no ${what} to press (${sel})`); return false; }
    if (b.key) { if (!b.hint) bad(`${tag}: ${what} does not show its key`); await press(b.key); return true; }
    if (!await focusOn(sel, 'Tab')) { bad(`${tag}: Tab never reached ${what}`); return false; }
    await press('Enter');
    return true;
  };
  const VI = ['k', 'u', 'l', 'n', 'j', 'b', 'h', 'y'], PAD = ['Numpad8', 'Numpad9', 'Numpad6', 'Numpad3', 'Numpad2', 'Numpad1', 'Numpad4', 'Numpad7'];
  const ARROW = { 0: 'ArrowUp', 2: 'ArrowRight', 4: 'ArrowDown', 6: 'ArrowLeft' };
  let n = 0;
  const stepKey = dir => { const k = n++ % 3; return k === 0 && ARROW[dir] ? ARROW[dir] : k === 1 ? VI[dir] : PAD[dir]; };
  const d = {
    press, chosen, focusOn, bumps: true,
    async settings(key, value) {
      await press(',');
      if (!await focusOn(`#settings.open [data-set="${key}"][data-value="${value}"]`)) bad(`${tag}: the arrows never reached Settings' ${key} ${value}`);
      else await press('Enter');
      await press('Escape');
    },
    async how() {
      await press('?');
      const info = await page.evaluate(() => ({ systems: document.querySelectorAll('#how.open .systems li').length, keys: document.querySelectorAll('#how.open .keytable tr').length }));
      // It scrolls by the keys: End brings its last key into view.
      await page.keyboard.press('End');
      await page.waitForFunction(() => { const r = document.querySelector('#how .keytable tr:last-child').getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.top >= 0; }, null, { timeout: 3000 }).catch(() => bad(`${tag}: End did not scroll "How the museum works" to its last key`));
      await press('Escape');
      return info;
    },
    async zoom() { await press('+'); },
    async step(dir) { await press(stepKey(dir)); },
    async select(id) {
      for (let i = 0; i < 40; i++) { if (await chosen() === id) return true; await press('x'); }
      bad(`${tag}: x never selected ${id}`);
      return false;
    },
    async label(id) { await pressButton(`#sheet [data-label-act="${id}"]`, `the label's ${id}`); },
    async first() { await press('Enter'); },
    async yes() { await press('Enter'); },
    async no() { await press('Escape'); },
    async wait() { await press('.'); },
    async rest() { await press('z'); },
    async sit() { await press('s'); },
    async leave() { await press('>'); },
    async escape() { await press('Escape'); },
    async bag() { await press('i'); },
    async bagItem(uid) { if (!await focusOn(`#bag.open [data-item="${uid}"]`)) bad(`${tag}: the arrows never reached ${uid} in the Bag`); else await press('Enter'); },
    async bagAct(id) { await pressButton(`#bag.open [data-action="${id}"]`, `the Bag's ${id}`); },
    async closeBag() { if (await page.evaluate(() => !!Bag.shown())) await press('Escape'); },
    async map() { await press('m'); },
    async quick(k) { await press(String(k)); },
    // The aim's tile moved with the keys, a step at a time, to t.
    async aimAt(t) {
      for (let i = 0; i < 24; i++) {
        const at = await page.evaluate(() => { const a = Bag.aiming(), me = window.ACCESSION.state.actors[0]; return a && Number.isInteger(a.x) ? { x: a.x, y: a.y } : { x: me.x, y: me.y, none: true, gone: !a }; });
        if (!at.none && at.x === t.x && at.y === t.y) return;
        if (at.gone) { bad(`${tag}: the aim ended while its keys moved it toward ${t.x},${t.y}`); return; }
        const dx = Math.sign(t.x - at.x), dy = Math.sign(t.y - at.y);
        if (!dx && !dy) { bad(`${tag}: the aim's keys did not preview ${t.x},${t.y}`); return; }
        let dir = 0;
        while ([0, 1, 1, 1, 0, -1, -1, -1][dir] !== dx || [-1, -1, 0, 1, 1, 1, 0, -1][dir] !== dy) dir++;
        await press(dir % 2 ? VI[dir] : stepKey(dir));
      }
      bad(`${tag}: the keys never brought the aim to ${t.x},${t.y}`);
    },
    async commit() { await press('Enter'); },
    async cancelAim() { if (await page.evaluate(() => { const a = Bag.aiming(); return !!a && a.kind !== 'item'; })) await press('Escape'); },
    async cancelPick() { await press('Escape'); },
    async pick(how) { await pressButton(`#bagpick.open [data-how="${how}"]`, `the pole's ${how}`); },
    async choose(i) { if (!await focusOn(`#bag.open [data-choose="${i}"]`)) bad(`${tag}: the arrows never reached seal ${i}`); else await press('Enter'); },
    async restoreOn(uid) { if (!await focusOn(`#bag.open [data-on="${uid}"]`)) bad(`${tag}: the arrows never reached ${uid} in the kit's list`); else await press('Enter'); },
    async walkTo(t) { if (await d.select(`exit:${t.x},${t.y}`)) await press('Enter'); },
    async another() { await press('Enter'); },
    async closeEnd() { await press('Escape'); },
    async reopenEnd() { await press('Enter'); },
  };
  const ring = () => page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return { ok: false, why: 'nothing has the focus' };
    const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const contrast = (p, q) => { const a = lum(p), b = lum(q); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    // The colour behind the element: its ancestors' backgrounds laid over the page's.
    const behind = el => {
      const stack = [];
      for (let p = el.parentElement; p; p = p.parentElement) { const c = rgb(getComputedStyle(p).backgroundColor); if (c && c.a > 0) stack.push(c); if (c && c.a >= 1) break; }
      let out = rgb(getComputedStyle(document.body).backgroundColor) || { r: 21, g: 19, b: 26, a: 1 };
      for (const c of stack.reverse()) out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a), a: 1 };
      return out;
    };
    const ids = window.__ids = window.__ids || new WeakMap();
    if (!ids.has(e)) ids.set(e, (window.__idn = (window.__idn || 0) + 1));
    const name = `${e.id || e.textContent.trim().slice(0, 16) || e.getAttribute('aria-label')} #${ids.get(e)}`;
    let bands;
    if (e.id === 'board') { const a = getComputedStyle(e, '::after'); bands = [{ c: rgb(a.borderTopColor), w: parseFloat(a.borderTopWidth) || 0, on: rgb(getComputedStyle(e).backgroundColor) || behind(e) }]; if (a.content === 'none' || a.display === 'none') bands = []; }
    else {
      const cs = getComputedStyle(e), bg = behind(e);
      bands = [];
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) bands.push({ c: rgb(cs.outlineColor), w: parseFloat(cs.outlineWidth), on: bg });
      const sh = /rgba?\([^)]+\)\s+0px\s+0px\s+0px\s+(\d+(?:\.\d+)?)px/.exec(cs.boxShadow || '');
      if (sh) bands.push({ c: rgb(cs.boxShadow), w: Number(sh[1]), on: bg });
    }
    const good = bands.filter(b => b.c && b.c.a > 0.9 && b.w >= 2 && contrast(b.c, b.on) >= 3);
    const r = e.getBoundingClientRect();
    return { ok: good.length > 0 && r.width > 0, name, why: bands.map(b => `${JSON.stringify(b.c)} ${b.w}px on ${JSON.stringify(b.on)}`).join('; ') || 'no ring' };
  });
  const state = () => page.evaluate(() => { const A = window.ACCESSION, me = A.state.actors[0]; return { x: me.x, y: me.y, tick: A.state.tick, sel: A.vm().selection, top: UI.topLayer(), act: document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim().slice(0, 20)) }; });
  const inside = sel => page.evaluate(sel => { const e = document.activeElement; return !!e && !!e.closest(sel); }, sel);
  // Keys that act on the game, pressed while what is open: none may act behind it (keys is
  // left without the digits on the pole's sheet, whose own keys they are).
  const idle = async (what, keys = ['.', 'x', 'h', 'Numpad6', 'z', '1']) => {
    const s0 = await state();
    for (const k of keys) await page.keyboard.press(k);
    const s1 = await state();
    if (s1.tick !== s0.tick || s1.x !== s0.x || s1.y !== s0.y || s1.sel !== s0.sel) bad(`${tag}: keys acted behind ${what} (tick ${s0.tick} → ${s1.tick}, you ${s0.x},${s0.y} → ${s1.x},${s1.y}, selection ${s0.sel} → ${s1.sel})`);
  };
  d.extra = {
    // The layer sel has the focus, with a ring of enough contrast.
    async focusIn(c, sel, what) {
      if (!await inside(sel)) { bad(`${tag}: ${what} did not take the focus (${(await state()).act})`); return; }
      const r = await ring();
      if (!r.ok) bad(`${tag}: in ${what}, ${r.name} has no visible focus ring of enough contrast (${r.why})`);
      else c.did.push(`${what} took the focus, with its ring`);
    },
    async behind(c, what) { await idle(what, ['.', 'x', 'h', 'Numpad6', 'z', 'i']); if (!await page.evaluate(() => UI.topLayer() === 'bagpick')) bad(`${tag}: keys closed ${what}`); else c.did.push(`no key acted behind ${what}`); },
    // While the fork aims: Enter with no tile previewed previews the first it can be used at,
    // x the next, Shift+X back; Escape ends the aim.
    async aimKeys(c) {
      await press('1');
      const aimed = () => page.evaluate(() => Bag.aiming());
      const a0 = await aimed();
      await press('Enter'); const a1 = await aimed();
      await press('x'); const a2 = await aimed();
      await press('X'); const a3 = await aimed();
      await press('Escape'); const a4 = await aimed();
      if (!a0 || Number.isInteger(a0.x) || !a1 || !Number.isInteger(a1.x) || !a2 || (a2.x === a1.x && a2.y === a1.y) || !a3 || a3.x !== a1.x || a3.y !== a1.y || a4) bad(`${tag}: the aim's keys went ${JSON.stringify([a0, a1, a2, a3, a4])}`);
      else c.did.push('aiming: Enter previewed, x and Shift+X moved the aim, Escape ended it');
    },
    // Tab to a label's button, then Enter.
    async tabToLabel(id) { if (!await focusOn(`#sheet [data-label-act="${id}"]`, 'Tab')) bad(`${tag}: Tab never reached the label's ${id}`); else await press('Enter'); },
    // x steps through everything in sight, nearest first, and Shift+X back: from a tile with
    // several kinds of thing in sight, the order x gives is the rule's (counted here apart from
    // main.js), and each Shift+X undoes an x.
    async cycle(c) {
      const want = await page.evaluate(() => {
        const A = window.ACCESSION, s = A.state, T = window.__s, me = s.actors[0], m = s.dept; T.calm();
        const list = () => {
          const vm = ViewModel.derive(s, {}), out = [], cheb = (x, y) => Math.max(Math.abs(x - me.x), Math.abs(y - me.y));
          for (const a of vm.actors) if (a.uid !== 'you') out.push({ k: 0, id: a.uid, x: a.x, y: a.y, d: Actors.dist(Actors.byUid(s, a.uid), me.x, me.y) });
          for (const q of vm.cases) if (Labels.of(s, `case:${q.x},${q.y}`)) out.push({ k: 1, id: `case:${q.x},${q.y}`, x: q.x, y: q.y, d: cheb(q.x, q.y) });
          for (const i of vm.items) if (!i.inCase) out.push({ k: 2, id: 'item:' + i.uid, x: i.x, y: i.y, d: cheb(i.x, i.y) });
          for (const p of vm.plaques) out.push({ k: 3, id: `plaque:${p.x},${p.y}`, x: p.x, y: p.y, d: cheb(p.x, p.y) });
          for (const f of vm.staff) out.push({ k: 4, id: `staff:${f.x},${f.y}`, x: f.x, y: f.y, d: cheb(f.x, f.y) });
          for (const [x, y] of m.exits) if (vm.vis[y * vm.w + x] === 2 && (x !== me.x || y !== me.y)) out.push({ k: 5, id: `exit:${x},${y}`, x, y, d: cheb(x, y) });
          out.sort((p, q) => p.d - q.d || p.k - q.k || p.y - q.y || p.x - q.x);
          return out.map(q => q.id).concat('you');
        };
        let best = null;
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
          if (!T.free(x, y)) continue;
          T.put(x, y);
          const l = list(), kinds = new Set(l.map(id => id.split(':')[0].replace(/^[A-Z].*/, 'exhibit'))).size;
          if (!best || kinds > best.kinds || (kinds === best.kinds && l.length < best.l.length)) best = { x, y, kinds, l };
        }
        T.put(best.x, best.y); A.redraw();
        return best;
      });
      await d.escape();
      const got = [];
      for (let i = 0; i < want.l.length; i++) { await press('x'); got.push(await chosen()); }
      if (want.kinds < 4 || got.join() !== want.l.join()) bad(`${tag}: x went ${got.join(' ')}, not nearest first ${want.l.join(' ')} (${want.kinds} kinds in sight)`);
      else c.did.push(`x through ${want.l.length} things of ${want.kinds} kinds, nearest first`);
      await press('x'); await press('x'); await press('X');
      const back = await chosen();
      if (back !== want.l[0]) bad(`${tag}: Shift+X after x x did not go back to ${want.l[0]} (${back})`);
      else c.did.push('Shift+X went back');
      await press('X');
      if (await chosen() !== 'you') bad(`${tag}: Shift+X from the first thing did not go round to you`);
      await d.escape();
    },
    // Every layer: open it with its key, Tab through it (the focus stays inside, each control
    // showing a ring of enough contrast), press keys that act on the game (none does behind
    // it), and close it with Escape (the focus goes back).
    async layers(c) {
      const tabAll = async (sel, what) => {
        const seen = new Set();
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          // Past the last control the browser's own bar may take the focus (the page then has
          // none); never a control outside the layer.
          if (await page.evaluate(() => !document.activeElement || document.activeElement === document.body)) continue;
          if (!await inside(sel)) { bad(`${tag}: in ${what}, Tab took the focus out to ${(await state()).act}`); return; }
          const r = await ring();
          if (!r.ok) bad(`${tag}: in ${what}, ${r.name} has no visible focus ring of enough contrast (${r.why})`);
          if (seen.has(r.name)) break;
          seen.add(r.name);
        }
        c.did.push(`${what}: ${seen.size} controls, each with its ring, the focus kept inside`);
      };
      // The game: the board, the top bar, the bar, the quickslots and an open label.
      await page.evaluate(() => { window.__s.calm(); window.ACCESSION.redraw(); });
      await d.select('you');
      await press('x');
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await tabAll('#app', 'the game, a label open');
      await d.escape();
      await tabAll('#app', 'the game');
      // The Bag: its list, then an item's label. (x and Escape first put the focus on the board,
      // where closing a layer gives it back.)
      await press('x'); await press('Escape');
      await d.bag();
      if (!await inside('#bag')) bad(`${tag}: the Bag did not take the focus`);
      await tabAll('#bag', 'the Bag'); await idle('the Bag');
      await d.bagItem('you.g');
      await tabAll('#bag', 'an item in the Bag'); await idle('an item in the Bag');
      // "How the museum works" over the Bag: Escape closes it alone, and the focus goes back.
      await press('?');
      if (!await inside('#how')) bad(`${tag}: "How the museum works" over the Bag did not take the focus`);
      await press('Escape');
      if ((await state()).top !== 'bag' || !await inside('#bag')) bad(`${tag}: Escape on "How the museum works" over the Bag did not go back into the Bag`);
      await press('Escape');
      const back = await state();
      if (back.top || !await inside('#board')) bad(`${tag}: closing the Bag did not give the focus back to the board (${back.top}, ${back.act})`);
      else c.did.push('the focus into and out of the Bag');
      // Settings, "How the museum works", the floor plan.
      for (const [key, sel, what] of [[',', '#settings', 'Settings'], ['?', '#how', '"How the museum works"'], ['m', '#bag', 'the floor plan']]) {
        await press(key);
        if (!await inside(sel)) bad(`${tag}: ${what} did not take the focus`);
        await tabAll(sel, what); await idle(what);
        await press('Escape');
        if (!await inside('#board')) bad(`${tag}: closing ${what} did not give the focus back to the board`);
      }
      // A confirmation: on an exit, Leave asks.
      await page.evaluate(() => { const A = window.ACCESSION, s = A.state, [x, y] = s.dept.exits[0]; window.__s.calm(); window.__s.put(x, y); A.redraw(); });
      await press('>');
      if (!await page.evaluate(() => UI.confirmOpen())) bad(`${tag}: > on an exit did not ask to leave`);
      else {
        if (!await inside('#confirm')) bad(`${tag}: the confirmation did not take the focus`);
        await tabAll('#confirm', 'the confirmation');
        const s0 = await state();
        for (const k of ['x', 'h', 'z', '1']) await page.keyboard.press(k);
        const s1 = await state();
        if (s1.tick !== s0.tick || s1.x !== s0.x || !await page.evaluate(() => UI.confirmOpen())) bad(`${tag}: keys acted behind the confirmation`);
        await press('Escape');
        if (!await inside('#board') || await page.evaluate(() => UI.confirmOpen())) bad(`${tag}: Escape did not cancel the confirmation and give the focus back to the board`);
        else c.did.push('the focus into and out of a confirmation');
      }
      await press('x');
    },
  };
  return d;
}

const t0 = Date.now();
for (const [W, H] of SIZES) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: W, height: H }, dpr: 1, query: '?dept=M11&seed=3' });
  const ready = async () => { await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state); await install(page); };
  await ready();
  const views = await page.evaluate(() => window.ACCESSION.views.list());
  for (const v of views) {
    const tag = `${W}×${H} ${v.label} keys`, did = [], tv = Date.now();
    if (v !== views[0]) { await page.reload(); await ready(); }
    const drv = keyDriver(page, tag);
    // Settings by the keys: reduced motion (so walks and rests finish at once), this board.
    await drv.settings('motion', 'reduce');
    await drv.settings('board', v.id);
    await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
    const active = await page.evaluate(() => window.ACCESSION.views.active());
    if (active.id !== v.id) { bad(`${tag}: the ${v.label} board was not chosen, or fell back (${active.note})`); continue; }
    did.push(`${v.label} board chosen in Settings`);
    // No pointer at all: every mouse and touch event the page sees is a problem.
    await page.evaluate(() => { window.__pointer = []; for (const t of ['pointerdown', 'mousedown', 'touchstart', 'click']) window.addEventListener(t, e => { if (e.isTrusted && (t !== 'click' || e.detail > 0 || e.pointerType)) window.__pointer.push(t); }, true); });
    await playScenes({ page, drv, tag, bad, did, W, H, layout, targets });
    const pointer = await page.evaluate(() => window.__pointer);
    if (pointer.length) bad(`${tag}: the page saw pointer input (${[...new Set(pointer)].join(', ')})`);
    lines.push(`${tag} (${Math.round((Date.now() - tv) / 1000)} s): ${did.join('; ')}`);
  }
  const words = await page.evaluate(() => (document.body.innerText.match(/[^\n]*(undefined|NaN|\[object)[^\n]*/g) || []).slice(0, 3));
  if (words.length) bad(`${W}×${H}: the page says ${words.join(' | ')}`);
  if (errors.length) bad(`${W}×${H}: console errors: ${errors.join('; ')}`);
  await browser.close();
}
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `keys: ${problems.length} problem(s)` : `keys: the keyboard alone, phone and laptop, both views (${Math.round((Date.now() - t0) / 1000)} s): Settings and "How the museum works", zoom, steps, blows, x and Shift+X nearest first, every label's keys, cases opened and broken, shards and a beam, an item taken, a label read, a staff door opened and closed, sit, rest and wait, the Bag (equip, take off, drop, drink, throw aimed, a Card's choice, a Floor Plan), the floor plan, a quickslot, the fork, Pin-Driver and pole aimed with the keys, a kit, every layer's focus rings and focus, leaving and a death each followed by another visit; no problems`);
process.exit(problems.length ? 1 : 0);
