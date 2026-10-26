// ACCESSION — the Bag with left clicks only (BUILD.md §7.1, §7.2, §8.5, §8.6). At phone and
// laptop size, in every board view, in M.11 (seed 3): open the Bag; equip a weapon; drink a
// Solution; throw one, aimed (the first click on a tile previews it and its square, the
// second throws); throw an unknown one too near (the preview and the refusal name no kind,
// its square is the largest any Solution covers, and the aim stays); strike a Tuning Fork
// from its quickslot; push and then pull an exhibit with the Window Pole, through its sheet,
// at a tile where both are legal; use a Restoration kit on what you wear (a first click
// shows what it gains, a second uses it); the quickslots (your instrument first, then your
// consumables in tote order); a Catalogue Card's choice, shown by the Bag; the floor plan,
// before and after a Floor Plan is read. The Bag goes inert under a confirmation. With each
// open: no sideways scroll, nothing past the window, no target under 44 px.
// No department places a fork or a pole, so each scene is staged on window.ACCESSION.state
// (as check-3d and check-play stage theirs): the items are made in your tote and you and an
// exhibit are put where the scene needs; everything the player then does is a left click on
// what is on screen.
import { open } from './lib.mjs';
import { layout, targets } from './measure.mjs';

const problems = [], lines = [];
const bad = s => problems.push(s);
const SIZES = [[390, 844], [1280, 800]];

// The centre of the first element matching sel that a player can see and click: displayed,
// inside every box that clips it, on screen, and the topmost thing there. Else null.
function seenAt(sel) {
  for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let ok = true;
    for (let p = e; p && p !== document.documentElement && ok; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) ok = false;
      else if (p !== e && cs.overflow !== 'visible') { const q = p.getBoundingClientRect(); if (r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right) ok = false; }
    }
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!ok || x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
    const top = document.elementFromPoint(x, y);
    if (top && (top === e || e.contains(top))) return { x, y, w: r.width, h: r.height, text: e.textContent.trim() };
  }
  return null;
}

// The staging helpers, put on the page after each load. spot(x, y): a point a player can
// click to tap tile (x, y): inside it, in the part of the board no sheet covers, the board
// the topmost thing there, and the view's pick giving that tile; else null.
function helpers() {
  const S = () => window.ACCESSION.state;
  const free = (x, y) => { const s = S(); return Grid.walkable(s.dept, x, y) && '.,'.includes(Grid.ch(s.dept, x, y)) && !Actors.at(s, x, y) && !(s.items || []).some(i => i.where.at === 'floor' && i.where.x === x && i.where.y === y); };
  const spot = (x, y) => {
    const R = window.ACCESSION.renderer, b = document.getElementById('board').getBoundingClientRect(), clear = b.bottom - UI.sheetCover();
    const tr = R.tileRect(x, y);
    if (!tr) return null;
    const rect = tr.rect, at = [0.5, 0.35, 0.65, 0.2, 0.8];
    for (const fy of at) for (const fx of at) {
      const px = rect.x + rect.w * fx, py = rect.y + rect.h * fy;
      if (px < b.left + 1 || py < b.top + 1 || px >= b.right - 1 || py >= clear - 1) continue;
      const e = document.elementFromPoint(px, py), p = R.pick(px, py);
      if (e && e.closest('#board') && p && p.x === x && p.y === y) return { x: px, y: py };
    }
    return null;
  };
  const cheb = (x, y) => { const me = S().actors[0]; return Math.max(Math.abs(x - me.x), Math.abs(y - me.y)); };
  window.__t = {
    free, spot, cheb,
    // Every exhibit asleep where it stands, with no mark pending.
    calm() { const s = S(); for (const a of s.actors) if (a.uid !== 'you' && !a.gone) { a.mode = 'dormant'; a.pips = 0; a.telegraph = null; a.notBefore = null; a.stim = s.turn; } },
    put(x, y) { const me = S().actors[0]; me.x = x; me.y = y; me.seated = false; },
    // A tile of `tiles` (from Consumables.targets or Kit.targets) between lo and hi tiles
    // from you, with no one on it, in view and clickable: the farthest first.
    tileIn(tiles, lo, hi) {
      const s = S(), vm = window.ACCESSION.vm(), ok = tiles.filter(([x, y]) => cheb(x, y) >= lo && cheb(x, y) <= hi && !Actors.at(s, x, y) && vm.vis[y * vm.w + x] === 2)
        .sort((p, q) => cheb(q[0], q[1]) - cheb(p[0], p[1]));
      for (const [x, y] of ok) if (spot(x, y)) return { x, y };
      return null;
    },
    // The marks of the aim: the aimed tile and the square's farthest reach from it.
    aimMarks() {
      const vm = window.ACCESSION.vm(), aim = vm.marks.find(k => k.kind === 'aim'), area = vm.marks.filter(k => k.kind === 'area');
      return { aim: aim ? { x: aim.x, y: aim.y } : null, area: area.length, reach: aim && area.length ? Math.max(...area.map(k => Math.max(Math.abs(k.x - aim.x), Math.abs(k.y - aim.y)))) : -1 };
    },
    // The kind names a sentence must not say before the kind is known.
    kinds: () => Registry.order('CONSUMABLES').map(ck => Registry.CONSUMABLES[ck].name.replace(/[“”"]/g, '')),
  };
}

async function run(W, H) {
  const { browser, page, errors } = await open('dist/accession.html', { viewport: { width: W, height: H }, dpr: 1, query: '?dept=M11&seed=3' });
  const ready = async () => { await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state); await page.evaluate(helpers); };
  await ready();
  const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
  const click = async (x, y) => { await page.mouse.click(x, y, { button: 'left' }); await settle(); };
  const press = async (sel, tag, what) => { const p = await page.evaluate(seenAt, sel); if (!p) { bad(`${tag}: ${what} is not on screen to click (${sel})`); return null; } await click(p.x, p.y); return p; };
  const tapTile = async (t, tag, what) => { const p = await page.evaluate(q => window.__t.spot(q.x, q.y), t); if (!p) { bad(`${tag}: ${what} at ${t.x},${t.y} has no point on the board to click`); return false; } await click(p.x, p.y); return true; };
  const sized = async tag => { for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag}: ${p}`); };
  const now = () => page.evaluate(() => { const A = window.ACCESSION, s = A.state, me = s.actors[0]; return { x: me.x, y: me.y, hp: me.hp, tick: s.tick, ev: A.events.map(e => e.k), last: A.history[A.history.length - 1] || '', aiming: Bag.aiming(), open: document.getElementById('bag').classList.contains('open') }; });
  const make = (fn, arg) => page.evaluate(fn, arg);
  // The aim strip's words, '' while it is shut; and where tile t lies on screen (a preview
  // must not move the board, so a second click lands where the first did).
  const aimText = () => page.evaluate(() => { const e = document.querySelector('#bagaim.open .aim-text'); return e ? e.textContent : ''; });
  const rectOf = t => page.evaluate(q => JSON.stringify(window.ACCESSION.renderer.tileRect(q.x, q.y).rect), t);
  const slotSel = W < 900 ? '#barslots' : '#slots';
  // A tile 1 or 2 away that a first throw of uid refuses for being too near, or null.
  const nearTile = uid => page.evaluate(u => {
    const s = window.ACCESSION.state, me = s.actors[0], out = [];
    for (let y = me.y - 2; y <= me.y + 2; y++) for (let x = me.x - 2; x <= me.x + 2; x++) if (Consumables.throwRefusal(s, u, x, y) === 'throw_unknown_near') out.push([x, y]);
    return window.__t.tileIn(out, 1, 2);
  }, uid);
  // Settings by clicks: reduced motion, so nothing waits on an animation.
  await press('#setbtn', `${W}×${H}`, 'Settings'); await press('[data-set="motion"][data-value="reduce"]', `${W}×${H}`, 'Reduced motion'); await press('#settings [data-close]', `${W}×${H}`, 'Close');
  const views = await page.evaluate(() => window.ACCESSION.views.list());
  for (const v of views) {
    const tag = `${W}×${H} ${v.label}`, did = [];
    if (v !== views[0]) { await page.reload(); await ready(); await settle(); }
    await press('#setbtn', tag, 'Settings');
    if (views.length > 1) await press(`[data-set="board"][data-value="${v.id}"]`, tag, `the ${v.label} board`);
    await press('#settings [data-close]', tag, 'Close');
    await page.evaluate(() => window.ACCESSION.renderer.ready.catch(() => {}));
    const active = await page.evaluate(() => window.ACCESSION.views.active());
    if (active.id !== v.id) { bad(`${tag}: fell back (${active.note})`); continue; }
    await page.evaluate(() => { window.__t.calm(); window.ACCESSION.redraw(); });

    // ---- Open the Bag: what you wear, then your tote. It lies inside #app, so it goes
    // inert while a confirmation asks (here, leaving by an exit you are put on).
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    const b0 = await page.evaluate(seenAt, '#bag.open #bag-title');
    if (!b0 || b0.text !== 'Bag') bad(`${tag}: the Bag button did not open the Bag`);
    else if (!await page.evaluate(seenAt, '#bag [data-item="you.w"]') || !await page.evaluate(seenAt, '#bag [data-item="you.g"]')) bad(`${tag}: the Bag does not list the weapon and garment you wear`);
    else did.push('Bag opened');
    await sized(`${tag} Bag open`);
    const inert = await page.evaluate(() => {
      const A = window.ACCESSION, s = A.state, [x, y] = s.dept.exits[0], was = [s.actors[0].x, s.actors[0].y];
      window.__t.put(x, y); A.redraw();
      A.bag.act({ a: 'leave', i: 0 });
      const out = { inApp: !!document.querySelector('#app > #bag'), asking: !!A.asking, inert: !!(document.getElementById('bag') || {}).inert };
      return Object.assign(out, { was });
    });
    if (!inert.inApp || !inert.asking || !inert.inert) bad(`${tag}: with the Bag open, a confirmation did not leave it inert (${JSON.stringify(inert)})`);
    else {
      if (await page.evaluate(seenAt, '#bag [data-close]')) bad(`${tag}: the Bag's Close can be clicked while a confirmation asks`);
      await press('#confirm.open [data-confirm="no"]', tag, 'Cancel');
      if (await page.evaluate(() => document.getElementById('bag').inert)) bad(`${tag}: the Bag stayed inert after the confirmation was cancelled`);
      else did.push('inert under a confirmation');
    }
    await page.evaluate(w => { window.__t.put(w[0], w[1]); window.ACCESSION.redraw(); }, inert.was);
    await press('#bag [data-close]', tag, 'the Bag\'s Close');
    if ((await now()).open) bad(`${tag}: Close did not close the Bag`);

    // ---- Equip: a Light weapon from the tote, through its label's Equip.
    const W1 = await make(() => { const s = window.ACCESSION.state, it = Kit.make(s, { kind: 'weapon', form: 'light', tier: 1 }, { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${W1}"]`, tag, 'the Light weapon in the tote');
    await sized(`${tag} an item's label in the Bag`);
    let t0 = await now();
    await press('#bag [data-action="equip"]', tag, 'Equip');
    let t1 = await now(), kit = await page.evaluate(() => JSON.parse(JSON.stringify(window.ACCESSION.state.you)));
    if (kit.kit.weapon !== W1 || !kit.tote.includes('you.w') || !t1.ev.includes('equipped') || t1.tick === t0.tick) bad(`${tag}: Equip did not put the Light weapon on (${JSON.stringify(kit.kit)}; ${t1.ev.join()})`);
    else if (t1.open) bad(`${tag}: the Bag stayed open after Equip`);
    else did.push('equipped');

    // ---- Drink: a Consolidant, with health to gain.
    const C1 = await make(() => { const s = window.ACCESSION.state, it = Consumables.make(s, 'consolidant', { at: 'tote' }); s.actors[0].hp = s.actors[0].maxHp - 8; window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${C1}"]`, tag, 'the Consolidant');
    t0 = await now();
    const drink = await press('#bag [data-action="use"]', tag, 'Drink');
    t1 = await now();
    if (!drink || drink.text !== 'Drink') bad(`${tag}: the Solution's button says "${drink && drink.text}", not Drink`);
    else if (!t1.ev.includes('used') || !t1.ev.includes('healed') || t1.hp <= t0.hp) bad(`${tag}: Drink did not heal (${t0.hp} → ${t1.hp}; ${t1.ev.join()})`);
    else did.push(`drank (${t0.hp} → ${t1.hp})`);

    // ---- An aimed throw: a known Consolidant (the drink identified it). Throw… aims; the
    // first click on a tile previews it and its 3×3 square, and takes no time; the board does
    // not move; the second click throws.
    const C2 = await make(() => { const s = window.ACCESSION.state, it = Consumables.make(s, 'consolidant', { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${C2}"]`, tag, 'the second Consolidant');
    await press('#bag [data-action="throw"]', tag, 'Throw…');
    const aimed = await now();
    if (!aimed.aiming || aimed.aiming.kind !== 'throw' || aimed.aiming.uid !== C2 || aimed.open || !await page.evaluate(seenAt, '#bagaim.open .aim-text')) bad(`${tag}: Throw… did not start aiming with the Bag shut (${JSON.stringify(aimed.aiming)})`);
    await sized(`${tag} aiming`);
    const th = await page.evaluate(uid => window.__t.tileIn(Consumables.targets(window.ACCESSION.state, uid), 3, 5), C2);
    if (!th) bad(`${tag}: no tile 3 to 5 away to throw at`);
    else {
      const r0 = await rectOf(th);
      t0 = await now();
      await tapTile(th, tag, 'the throw\'s tile');
      t1 = await now();
      const m = await page.evaluate(() => window.__t.aimMarks()), say = await aimText(), r1 = await rectOf(th);
      if (t1.tick !== t0.tick || !m.aim || m.aim.x !== th.x || m.aim.y !== th.y) bad(`${tag}: the first click on ${th.x},${th.y} did not preview it (${JSON.stringify(m)}, tick ${t0.tick} → ${t1.tick})`);
      else if (m.reach !== 1) bad(`${tag}: a known Consolidant's square reaches ${m.reach} from its tile, not 1 (3×3)`);
      else if (!/Tap it again to throw/.test(say) || !/3×3/.test(say)) bad(`${tag}: the preview says "${say}"`);
      else if (r0 !== r1) bad(`${tag}: the preview moved the board`);
      else did.push('a throw previewed with its 3×3');
      await tapTile(th, tag, 'the throw\'s tile again');
      const t2 = await now(), thrown = await page.evaluate(() => window.ACCESSION.events.some(e => e.k === 'used' && e.how === 'throw'));
      if (!thrown || t2.tick === t1.tick) bad(`${tag}: the second click did not throw (${t2.ev.join()})`);
      else if (t2.aiming || await page.evaluate(seenAt, '#bagaim.open')) bad(`${tag}: the aim stayed after the throw`);
      else did.push('thrown on the second click');
    }

    // ---- A refused unknown throw: a Fixative, not yet known, at a tile 1 or 2 away. Its
    // square is the largest any Solution covers (5×5), the preview gives the refusal, the
    // second click is refused by the game with nothing changed, and none of it names a
    // kind; the aim stays until Cancel. It is aimed from its quickslot.
    const U = await make(() => { const s = window.ACCESSION.state, it = Consumables.make(s, 'fixative', { at: 'tote' }); window.ACCESSION.redraw(); return { uid: it.uid, known: Consumables.known(s, 'fixative') }; });
    if (U.known) bad(`${tag}: the Fixative was already known, so its refusal is not a first throw`);
    const qU = await page.evaluate(([sel, uid]) => { const b = document.querySelector(`${sel} [data-uid="${uid}"]`); return b ? b.dataset.act : null; }, [slotSel, U.uid]);
    if (!qU) bad(`${tag}: the Fixative has no quickslot`);
    else {
      await press(`${slotSel} [data-act="${qU}"]`, tag, 'the Fixative\'s quickslot');
      const shownTitle = await page.evaluate(seenAt, '#bag.open .bag-card h2');
      const local = await page.evaluate(uid => Consumables.name(window.ACCESSION.state, window.ACCESSION.state.items.find(i => i.uid === uid)).local, U.uid);
      if (!shownTitle || !shownTitle.text.startsWith(local)) bad(`${tag}: the Fixative's quickslot did not show it in the Bag (${shownTitle && shownTitle.text})`);
      else did.push('a consumable\'s quickslot showed it in the Bag');
      await press('#bag [data-action="throw"]', tag, 'Throw…');
      const kinds = await page.evaluate(() => window.__t.kinds()), named = s => kinds.filter(k => s.toLowerCase().includes(k.toLowerCase()));
      // First a tile it may be thrown at: its preview, too, names no kind, and its square is
      // the largest.
      const far = await page.evaluate(uid => window.__t.tileIn(Consumables.targets(window.ACCESSION.state, uid), 3, 5), U.uid);
      if (!far) bad(`${tag}: no tile 3 to 5 away to aim the unknown Solution at`);
      else {
        await tapTile(far, tag, 'a tile it may be thrown at');
        const m = await page.evaluate(() => window.__t.aimMarks()), say = await aimText();
        if (m.reach !== 2) bad(`${tag}: an unknown Solution aimed at ${far.x},${far.y} shows a square reaching ${m.reach}, not 2 (5×5)`);
        if (!/Tap it again to throw/.test(say) || !/5×5/.test(say)) bad(`${tag}: aiming an unknown Solution at ${far.x},${far.y}, the strip says "${say}"`);
        if (named(say).length) bad(`${tag}: aiming an unknown Solution names a kind: ${named(say).join(', ')} ("${say}")`);
      }
      const near = await nearTile(U.uid);
      if (!near) bad(`${tag}: no tile 1 or 2 away that a first throw refuses for being near`);
      else {
        t0 = await now();
        const n0 = await page.evaluate(uid => window.ACCESSION.state.items.find(i => i.uid === uid).n, U.uid), r0 = await rectOf(near);
        await tapTile(near, tag, 'a tile too near');
        const m = await page.evaluate(() => window.__t.aimMarks()), say = await page.evaluate(() => document.getElementById('bagaim').textContent);
        const want = await page.evaluate(() => Text.refusal('throw_unknown_near'));
        if (m.reach !== 2) bad(`${tag}: an unknown Solution's square reaches ${m.reach} from its tile, not 2 (5×5)`);
        if (!say.includes(want)) bad(`${tag}: the preview of a tile too near does not give the refusal ("${say}")`);
        if (named(say).length) bad(`${tag}: aiming an unknown Solution names a kind: ${named(say).join(', ')} ("${say}")`);
        if (r0 !== await rectOf(near)) bad(`${tag}: the preview of the refusal moved the board`);
        await tapTile(near, tag, 'the tile too near again');
        t1 = await now();
        const last = await page.evaluate(() => window.ACCESSION.events.map(e => e.k + ':' + (e.reason || '')));
        const n1 = await page.evaluate(uid => window.ACCESSION.state.items.find(i => i.uid === uid).n, U.uid);
        const sentence = await page.evaluate(() => { const e = window.ACCESSION.events.find(q => q.k === 'refused'); return e ? Text.event(e, Labels.nameOf(window.ACCESSION.state)) : ''; });
        if (last.join() !== 'refused:throw_unknown_near' || t1.tick !== t0.tick || n1 !== n0) bad(`${tag}: the second click on a tile too near was not refused with nothing changed (${last.join()}; tick ${t0.tick} → ${t1.tick}; ${n0} → ${n1})`);
        else if (named(sentence).length || named(t1.last).length) bad(`${tag}: the refusal names a kind: "${sentence}"`);
        else if (!t1.aiming || t1.aiming.uid !== U.uid || !await page.evaluate(seenAt, '#bagaim.open')) bad(`${tag}: the aim ended at the refusal`);
        else did.push('an unknown throw too near refused, naming no kind, its square 5×5');
        // The aim strip's height is set by the text size alone: whatever it says, short or
        // long, the board does not move (its words are put in by hand here, as check-play
        // fills the log; Cancel then puts the Bag's back).
        const steady = await page.evaluate(async () => {
          const me = window.ACCESSION.state.actors[0], at = () => JSON.stringify(window.ACCESSION.renderer.tileRect(me.x, me.y).rect), t = document.querySelector('#bagaim .aim-text');
          const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (!t) return false;
          const r0 = at(); t.textContent = 'Short.'; await frame(); const r1 = at(); t.textContent = 'A long sentence. '.repeat(12); await frame(); const r2 = at();
          return r0 === r1 && r1 === r2;
        });
        if (!steady) bad(`${tag}: what the aim strip says moves the board`);
        await press('#bagaim [data-aim-cancel]', tag, 'Cancel');
        if ((await now()).aiming) bad(`${tag}: Cancel did not end the aim`);
      }
    }

    // ---- The fork: equipped from the Bag, then aimed from its quickslot (an instrument
    // comes first there) and struck at a tile 3 to 6 away.
    const F = await make(() => { const s = window.ACCESSION.state, it = Kit.make(s, { kind: 'instrument', instrument: 'fork', tier: 1 }, { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${F}"]`, tag, 'the Tuning Fork');
    await press('#bag [data-action="equip"]', tag, 'Equip');
    const q1 = await page.evaluate(sel => { const b = document.querySelector(`${sel} [data-act="q1"]`); return b ? b.dataset.uid : null; }, slotSel);
    if (q1 !== F) bad(`${tag}: quickslot 1 holds ${q1}, not the instrument you wear`);
    await press(`${slotSel} [data-act="q1"]`, tag, 'quickslot 1');
    if (!(await now()).aiming) bad(`${tag}: the fork's quickslot did not aim it`);
    const ft = await page.evaluate(uid => window.__t.tileIn(Kit.targets(window.ACCESSION.state, uid), 3, 6), F);
    if (!ft) bad(`${tag}: no tile 3 to 6 away to strike the fork at`);
    else {
      t0 = await now();
      const r0 = await rectOf(ft);
      await tapTile(ft, tag, 'the fork\'s tile');
      const m = await page.evaluate(() => window.__t.aimMarks());
      if ((await now()).tick !== t0.tick || !m.aim || m.aim.x !== ft.x || m.aim.y !== ft.y || m.area !== 0) bad(`${tag}: the first click did not preview the fork's tile alone (${JSON.stringify(m)})`);
      if (r0 !== await rectOf(ft)) bad(`${tag}: the fork's preview moved the board`);
      await tapTile(ft, tag, 'the fork\'s tile again');
      const f = await page.evaluate(([uid, t]) => {
        const A = window.ACCESSION, ev = A.events, it = A.state.items.find(i => i.uid === uid);
        return { used: ev.some(e => e.k === 'used' && e.how === 'fork'), noise: ev.some(e => e.k === 'noise' && e.x === t.x && e.y === t.y && e.cause.k === 'fork'), charges: it.charges, max: it.max };
      }, [F, ft]);
      if (!f.used || !f.noise || f.charges !== f.max - 1) bad(`${tag}: the second click did not strike the fork at ${ft.x},${ft.y} (${JSON.stringify(f)})`);
      else did.push('the fork struck from its quickslot');
    }

    // ---- The Window Pole: an exhibit put two tiles from you, in a straight line, where it
    // can be pushed one tile away and pulled one toward you. A second click opens the sheet,
    // with Push, then Pull; each is chosen in turn, and the exhibit sleeps on.
    const PL = await make(() => { const s = window.ACCESSION.state, it = Kit.make(s, { kind: 'instrument', instrument: 'pole', tier: 1 }, { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${PL}"]`, tag, 'the Window Pole');
    await press('#bag [data-action="equip"]', tag, 'Equip');
    const placePole = () => page.evaluate(uid => {
      const A = window.ACCESSION, s = A.state, m = s.dept, T = window.__t, me = s.actors[0];
      T.calm();
      const ex = s.actors.filter(a => a.uid !== 'you' && !a.gone && (a.size || 1) === 1 && Archetypes.present(s, a) === null && !Cases.encased(s, a));
      for (const a of ex) for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) for (const d of [0, 2, 4, 6]) {
        const at = k => [x + Grid.DX[d] * k, y + Grid.DY[d] * k];
        const [x1, y1] = at(1), [x2, y2] = at(2), [x3, y3] = at(3);
        if (!T.free(x, y) || !T.free(x1, y1) || !(T.free(x2, y2) || (a.x === x2 && a.y === y2)) || !T.free(x3, y3)) continue;
        const was = { me: [me.x, me.y], a: [a.x, a.y] };
        T.put(x, y); a.x = x2; a.y = y2;
        const use = how => ({ a: 'use', uid, x: x2, y: y2, how });
        A.redraw();
        if (Labels.allowed(s, use('push')) && Labels.allowed(s, use('pull')) && T.spot(x2, y2)) return { uid: a.uid, x: x2, y: y2, push: [x3, y3], pull: [x1, y1] };
        T.put(was.me[0], was.me[1]); a.x = was.a[0]; a.y = was.a[1];
      }
      A.redraw();
      return null;
    }, PL);
    for (const how of ['push', 'pull']) {
      const ex = await placePole();
      if (!ex) { bad(`${tag}: no place to stage the pole's ${how}`); break; }
      await press(`${slotSel} [data-act="q1"]`, tag, 'the pole\'s quickslot');
      const r0 = await rectOf(ex);
      await tapTile(ex, tag, 'the exhibit');
      const say = await aimText();
      if (!/choose what the pole does/.test(say)) bad(`${tag}: the pole's preview says "${say}"`);
      if (r0 !== await rectOf(ex)) bad(`${tag}: the pole's preview moved the board`);
      t0 = await now();
      await tapTile(ex, tag, 'the exhibit again');
      const sheet = await page.evaluate(() => [...document.querySelectorAll('#bagpick.open [data-how]')].map(b => b.dataset.how + ':' + b.textContent));
      const hows = sheet.map(q => q.split(':')[0]);
      if (hows.join() !== 'push,pull' || !sheet[0].endsWith('Push it one tile away') || !sheet[1].endsWith('Pull it one tile toward you')) bad(`${tag}: the pole's sheet offers ${sheet.join(' | ') || 'nothing'}`);
      else if ((await now()).tick !== t0.tick) bad(`${tag}: opening the pole's sheet took time`);
      await sized(`${tag} the pole's sheet`);
      await press(`#bagpick.open [data-how="${how}"]`, tag, `${how} on the sheet`);
      const moved = await page.evaluate(uid => { const A = window.ACCESSION, a = Actors.byUid(A.state, uid); return { x: a.x, y: a.y, mode: a.mode, used: A.events.filter(e => e.k === 'used').map(e => e.how).join() }; }, ex.uid);
      const to = ex[how];
      if (moved.used !== how || moved.x !== to[0] || moved.y !== to[1]) bad(`${tag}: ${how} moved the exhibit to ${moved.x},${moved.y}, not ${to.join()} (${moved.used})`);
      else if (moved.mode !== 'dormant') bad(`${tag}: the pole's ${how} woke the exhibit (${moved.mode})`);
      else if ((await now()).aiming || await page.evaluate(seenAt, '#bagpick.open')) bad(`${tag}: the aim or the sheet stayed after the ${how}`);
      else did.push(`pole: ${how}`);
    }

    // ---- A Restoration kit on what you wear: Use on an item… lists the items its legal uses
    // name, in Kit.useLegal's order; a first click on the garment shows what it gains and
    // takes no time; a second uses the kit.
    const K = await make(() => { const s = window.ACCESSION.state, it = Kit.make(s, { kind: 'kit' }, { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${K}"]`, tag, 'the Restoration kit');
    await press('#bag [data-action="restore"]', tag, 'Use on an item…');
    const order = await page.evaluate(uid => ({ shown: [...document.querySelectorAll('#bag [data-on]')].map(b => b.dataset.on), want: Kit.useLegal(window.ACCESSION.state).filter(a => a.uid === uid).map(a => a.on), aiming: Bag.aiming() }), K);
    if (!order.shown.length || order.shown.join() !== order.want.join()) bad(`${tag}: the kit's items are ${order.shown.join()}, not Kit.useLegal's ${order.want.join()}`);
    else if (!order.aiming || order.aiming.kind !== 'item' || order.aiming.uid !== K) bad(`${tag}: while the kit's item is chosen, Bag.aiming() is ${JSON.stringify(order.aiming)}`);
    await sized(`${tag} the kit's items`);
    t0 = await now();
    await press('#bag [data-on="you.g"]', tag, 'the garment you wear');
    const gain = await page.evaluate(() => { const g = document.querySelector('#bag [data-on="you.g"] .bag-gain'); return g ? g.textContent : ''; });
    if ((await now()).tick !== t0.tick || !/Padding \d+ → \d+/.test(gain)) bad(`${tag}: the first click on the garment did not show its gain ("${gain}")`);
    await press('#bag [data-on="you.g"]', tag, 'the garment again');
    const rs = await page.evaluate(k => { const s = window.ACCESSION.state; return { level: s.items.find(i => i.uid === 'you.g').level, kit: s.items.find(i => i.uid === k).where.at, used: window.ACCESSION.events.some(e => e.k === 'used' && e.how === 'restore') }; }, K);
    if (!rs.used || rs.level !== 1 || rs.kit !== 'gone') bad(`${tag}: the second click did not use the kit on the garment (${JSON.stringify(rs)})`);
    else did.push(`kit on the garment (${gain})`);

    // ---- The quickslots: your instrument first, then your consumables in tote order, as
    // many as the bar (3) or the column (6) holds.
    const qs = await page.evaluate(sel => {
      const vm = window.ACCESSION.vm(), want = [vm.you.charges ? vm.you.charges.uid : null].filter(Boolean).concat(vm.you.consumables.map(c => c.uid)).slice(0, sel === '#slots' ? 6 : 3);
      return { shown: [...document.querySelectorAll(`${sel} [data-act]`)].map(b => b.dataset.uid || '').filter(Boolean), want };
    }, slotSel);
    if (qs.shown.join() !== qs.want.join()) bad(`${tag}: the quickslots hold ${qs.shown.join()}, not ${qs.want.join()}`);
    else did.push(`quickslots ${qs.shown.length}`);

    // ---- A Catalogue Card: read from the Bag, its choice opens the Bag on itself; choosing
    // a seal identifies it.
    const D = await make(() => { const s = window.ACCESSION.state, it = Consumables.make(s, 'card', { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${D}"]`, tag, 'the Catalogue Card');
    await press('#bag [data-action="use"]', tag, 'Read');
    const ch = await page.evaluate(() => ({ pending: window.ACCESSION.vm().pending, buttons: document.querySelectorAll('#bag.open .bag-choice [data-choose]').length }));
    if (!ch.pending || ch.buttons !== ch.pending.options.length) bad(`${tag}: the Card's choice is not shown in the Bag (${JSON.stringify(ch)})`);
    else {
      await sized(`${tag} the Card's choice`);
      const seal = ch.pending.options[0];
      await press('#bag [data-choose="0"]', tag, 'the first seal');
      const after = await page.evaluate(sl => ({ pending: window.ACCESSION.vm().pending, known: window.ACCESSION.state.run.knownSeals.includes(sl), open: document.getElementById('bag').classList.contains('open') }), seal);
      if (after.pending || !after.known || after.open) bad(`${tag}: choosing a seal did not identify it (${JSON.stringify(after)})`);
      else did.push('the Card\'s choice answered');
    }

    // ---- The floor plan: before a Floor Plan is read, what you have seen; after, every
    // room still holding a Highlight, by its number.
    await press('#bar [data-act="map"]', tag, 'the Map button');
    const mp = await page.evaluate(() => {
      const c = document.querySelector('#bag.open canvas.bag-map'), say = document.querySelector('#bag .map-say');
      let lit = 0;
      if (c && c.width) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i]) lit++; }
      return { title: (document.querySelector('#bag.open #bag-title') || {}).textContent || '', w: c ? c.getBoundingClientRect().width : 0, lit, say: say ? say.textContent : '' };
    });
    if (mp.title !== 'Floor plan' || !mp.w || !mp.lit || !/A Floor Plan, read here/.test(mp.say)) bad(`${tag}: the map did not show what you have seen (${JSON.stringify(mp)})`);
    await sized(`${tag} the map`);
    await press('#bag [data-close]', tag, 'the map\'s Close');
    const PLN = await make(() => { const s = window.ACCESSION.state, it = Consumables.make(s, 'plan', { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await press(`#bag [data-item="${PLN}"]`, tag, 'the Floor Plan');
    await press('#bag [data-action="use"]', tag, 'Read');
    await press('#bar [data-act="map"]', tag, 'the Map button');
    const mp2 = await page.evaluate(() => ({ plan: window.ACCESSION.vm().plan, say: (document.querySelector('#bag .map-say') || {}).textContent || '' }));
    if (!mp2.plan || !mp2.plan.length || !mp2.plan.every(r => mp2.say.includes('Room ' + r.number))) bad(`${tag}: after a Floor Plan, the map does not name the rooms holding a Highlight (${JSON.stringify(mp2)})`);
    else did.push(`the map: before and after a Floor Plan (${mp2.plan.map(r => r.number).join(', ')})`);
    await press('#bag [data-close]', tag, 'the map\'s Close');

    // ---- At the largest text: the Bag, an item's label, and the aim strip with its longest
    // words (the pole's, and a refusal) still fit.
    await page.evaluate(() => { window.__t.calm(); window.ACCESSION.setting('text', '1.3'); });
    await press('#bar [data-act="bag"]', tag, 'the Bag button');
    await sized(`${tag} the Bag at text 1.3`);
    await press(`#bag [data-item="${PL}"]`, tag, 'the Window Pole');
    await sized(`${tag} an item's label at text 1.3`);
    await press('#bag [data-close]', tag, 'Close');
    const fits = async what => {
      await sized(`${tag} ${what} at text 1.3`);
      if (!await page.evaluate(() => { const e = document.querySelector('#bagaim.open .in'); return !!e && e.scrollHeight <= e.clientHeight + 1; })) bad(`${tag}: at text 1.3 the aim strip's words do not fit it (${what})`);
    };
    await press(`${slotSel} [data-act="q1"]`, tag, 'quickslot 1');
    await fits('aiming the pole');
    await press('#bagaim [data-aim-cancel]', tag, 'Cancel');
    const qU2 = await page.evaluate(([sel, uid]) => { const b = document.querySelector(`${sel} [data-uid="${uid}"]`); return b ? b.dataset.act : null; }, [slotSel, U.uid]);
    if (qU2) {
      await press(`${slotSel} [data-act="${qU2}"]`, tag, 'the Fixative\'s quickslot');
      await press('#bag [data-action="throw"]', tag, 'Throw…');
      const near = await nearTile(U.uid);
      if (near) { await tapTile(near, tag, 'a tile too near'); await fits('a refusal'); }
      await press('#bagaim [data-aim-cancel]', tag, 'Cancel');
    }
    await page.evaluate(() => window.ACCESSION.setting('text', '1'));
    lines.push(`${tag}: ${did.join('; ')}`);
  }
  // Nothing the player sees says "undefined", "NaN" or "[object".
  const words = await page.evaluate(() => (document.body.innerText.match(/[^\n]*(undefined|NaN|\[object)[^\n]*/g) || []).slice(0, 3));
  if (words.length) bad(`${W}×${H}: the page says ${words.join(' | ')}`);
  if (errors.length) bad(`${W}×${H}: console errors: ${errors.join('; ')}`);
  await browser.close();
}

for (const [W, H] of SIZES) await run(W, H);
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `bag: ${problems.length} problem(s)` : 'bag: left clicks only, phone and laptop, every view: the Bag opened and inert under a confirmation; equipped, drank, threw aimed (preview, then throw), an unknown throw too near refused naming no kind, the fork struck, the pole pushed and pulled through its sheet, a kit used on a worn item, the quickslots, the Card\'s choice, the floor plan before and after a Floor Plan; no problems');
process.exit(problems.length ? 1 : 0);
