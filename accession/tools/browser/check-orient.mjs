// ACCESSION — the Orientation (BUILD.md §7.1, §7.2, §8.9), played whole through each input
// alone: the keyboard (page.keyboard), a mouse's left clicks (page.mouse) and a finger's taps
// (page.touchscreen, in a touch screen's browser), at 390×844 and 1280×800, the finger on a
// tablet (820×1180) too, in every board view, with Chromium muted. Nothing is staged but the
// motion and text settings and, for the death, the blow that brings it; every step is the
// player's input.
// At each step, when it shows: the coach's sentence is the teacher's in that input's words,
// with its count, and it reaches the page's one live region (the label panel's); on a phone
// the board keeps 40% of the window's height with the coach showing at every text size; at
// every size nothing scrolls sideways and no target is under 44 px; the coach lies off the
// board; the frame round what the step needs is drawn where the board shows it, uncovered;
// the board's own checks hold (measure.mjs); and the coach only reads (the state's hash is
// the same after it looks, and after every action the game equals the same actions replayed
// on a fresh room with no coach). Leaving starts the first visit (M.11, seed 3, as main.js
// picks).
// Once per input: a first load with no flag starts the Orientation; Skip starts the visit
// and sets the flag; a second load starts the visit; ?orient=0 never shows it; Practice room
// plays it again; a death there shows the recap with Practice again and Start the visit.
import { playwright, fileUrl } from './lib.mjs';
import { layout, targets, board } from './measure.mjs';
import { seenAt, spotOf, pointerDriver } from './scenes.mjs';

const problems = [], lines = [];
const bad = s => problems.push(s);
const INPUTS = [
  { form: 'keys', sizes: [[390, 844], [1280, 800]] },
  { form: 'mouse', sizes: [[390, 844], [1280, 800]] },
  { form: 'touch', sizes: [[390, 844], [1280, 800], [820, 1180]] },
];
const URL = q => fileUrl('dist/accession.html') + q;
const WORDS = {
  touch: t => /\btap/i.test(t) && !/\bclick|\bpress\b/i.test(t),
  mouse: t => /\bclick/i.test(t) && !/\btap|\bpress\b/i.test(t),
  keys: t => !/\btap|\bclick/i.test(t),
};

// ---- The keyboard's driver: page.keyboard and nothing else ----
function keyDriver(page, tag) {
  const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
  const press = async k => { await page.keyboard.press(k); await settle(); };
  const is = sel => page.evaluate(sel => !!document.activeElement && document.activeElement.matches(sel), sel);
  const focusOn = async (sel, key) => { for (let i = 0; i < 40; i++) { if (await is(sel)) return true; await page.keyboard.press(key); } return is(sel); };
  const chosen = () => page.evaluate(() => {
    const A = window.ACCESSION, vm = A.vm(), t = vm.selectedTile;
    if (vm.selection) return vm.selection;
    return t && A.state.dept.exits.some(([x, y]) => x === t.x && y === t.y) ? `exit:${t.x},${t.y}` : null;
  });
  const ARROW = { 0: 'ArrowUp', 2: 'ArrowRight', 4: 'ArrowDown', 6: 'ArrowLeft' }, VI = ['k', 'u', 'l', 'n', 'j', 'b', 'h', 'y'];
  const d = {
    harmless: () => press('Escape'),
    step: dir => press(ARROW[dir] || VI[dir]),
    strike: (id, dir) => press(ARROW[dir] || VI[dir]),
    async select(id) { for (let i = 0; i < 30; i++) { if (await chosen() === id) return true; await press('x'); } bad(`${tag}: x never selected ${id}`); return false; },
    async label(id) {
      const k = await page.evaluate(id => { const b = document.querySelector(`#sheet [data-label-act="${id}"]`); return b ? b.dataset.key || null : null; }, id);
      if (!k) bad(`${tag}: the label has no ${id} with a key`); else await press(k);
    },
    walk: t => press(ARROW[t.dir] || VI[t.dir]),
    async walkExit(t) { if (await d.select(`exit:${t.x},${t.y}`)) await press('Enter'); },
    async leave() { await press('>'); },
    yes: () => press('Enter'),
    wait: () => press('.'),
    // Skip: Shift+Tab from the board reaches the coach's line, at the end of the top bar.
    async skip() { if (!await focusOn('[data-coach-skip]', 'Shift+Tab')) bad(`${tag}: Shift+Tab never reached Skip`); else await press('Enter'); },
    async practice() {
      await press('?');
      if (!await focusOn('#how [data-practice]', 'Shift+Tab')) bad(`${tag}: Shift+Tab never reached Practice room`); else await press('Enter');
    },
    // On the recap: the arrows move through its buttons, Enter presses the one with the focus.
    async endButton(sel) { if (!await focusOn(`#end.open ${sel}`, 'ArrowRight')) bad(`${tag}: the arrows never reached ${sel}`); else await press('Enter'); },
  };
  return d;
}

// ---- The pointer's driver: scenes.mjs's, with what the Orientation adds ----
function pointer(page, tag, hit, W) {
  const base = pointerDriver(page, tag, bad, hit, W);
  const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const tapSel = async (sel, what) => { const p = await page.evaluate(seenAt, sel); if (!p) { bad(`${tag}: ${what} is not on screen to tap`); return false; } await hit(p.x, p.y); await frames(); await settle(); return true; };
  // A tile beside you, or a tile to walk to: the label's Close first if the sheet hides it.
  const tapTile = async (q, what) => {
    let p = await page.evaluate(spotOf, q);
    if (!p && await page.evaluate(() => !!UI.labelShown())) { await tapSel('#sheet [data-close]', 'the label\'s Close'); p = await page.evaluate(spotOf, q); }
    if (!p) { bad(`${tag}: ${what} at ${q.x},${q.y} has no point on the board to tap`); return; }
    await hit(p.x, p.y); await frames(); await settle();
  };
  return Object.assign({}, base, {
    harmless: () => tapSel('#coach .coach-say', 'the coach\'s sentence'),
    step: dir => page.evaluate(() => { const a = window.ACCESSION.state.actors[0]; return { x: a.x, y: a.y }; })
      .then(me => tapTile({ x: me.x + [0, 1, 1, 1, 0, -1, -1, -1][dir], y: me.y + [-1, -1, 0, 1, 1, 1, 0, -1][dir] }, 'the tile beside you')),
    async strike(id) { if (await base.select(id)) await base.first(); },
    walk: t => tapTile(t, 'the tile to walk to'),
    walkExit: t => tapTile(t, 'the exit'),
    skip: () => tapSel('#coach [data-coach-skip]', 'Skip'),
    async practice() { await tapSel('#howbtn', '"How the museum works"'); await tapSel('#how.open [data-practice]', 'Practice room'); },
    endButton: sel => tapSel(`#end.open ${sel}`, sel),
  });
}

// What the player does now, from the coach's step and the room: the check reads the state to
// choose, as a player reads the board; the action itself is always the input's.
function plan(id) {
  const A = window.ACCESSION, s = A.state, me = s.actors[0], F = Orientation.facts(), a = Actors.byUid(s, F.sleeper);
  const path = (x, y) => Path.to(s, x, y);
  const first = p => p.length ? Path.dirTo([me.x, me.y], p[0]) : -1;
  // The farthest tile of a path a pointer can tap, no actor on it; else its first.
  const far = p => { for (let i = p.length - 1; i >= 0; i--) { const [x, y] = p[i]; if (!Actors.at(s, x, y) && window.__spot({ x, y })) return { x, y, dir: first(p) }; } return p.length ? { x: p[0][0], y: p[0][1], dir: first(p) } : null; };
  if (id === 'move') return { k: 'step', dir: 2 };
  if (id === 'examine') return { k: 'select', id: F.sleeper };
  if (id === 'ring' || id === 'pips' || id === 'bump') {
    if (!a || a.gone) return { k: 'wait' };
    const p = path(a.x, a.y);
    return Step.adjacent(s, me, a) ? { k: 'strike', id: a.uid, dir: first(p) } : { k: 'step', dir: first(p) };
  }
  if (id === 'case') {
    const [cx, cy] = F.case, f = s.dept.fixtures.find(q => q.k === 'case' && q.x === cx && q.y === cy);
    if (Math.max(Math.abs(me.x - cx), Math.abs(me.y - cy)) <= 1) return { k: 'case', id: `case:${cx},${cy}`, act: f.st === 'shut' ? 'open' : 'take' };
    const best = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => path(cx + dx, cy + dy)).filter(p => p.length).sort((p, q) => p.length - q.length)[0];
    return { k: 'walk', to: far(best) };
  }
  if (id === 'leave') {
    const [x, y] = F.exit;
    if (me.x === x && me.y === y) return { k: 'leave' };
    const vm = A.vm();
    return { k: 'exit', x, y, seen: vm.vis[y * vm.w + x] === 2, to: far(path(x, y)) };
  }
  return { k: 'none' };
}

// The checks when a step shows (above). txt: the text sizes to measure at (a phone's all three).
async function stepChecks(c, st) {
  const { page, tag, form, W, H } = c;
  const r = await page.evaluate(form => {
    const s = Coach.status(), want = Teacher.sentence(s.step, form), b = document.getElementById('board').getBoundingClientRect(), k = document.getElementById('coach').getBoundingClientRect();
    return { s, want, n: document.querySelector('#coach .coach-n').textContent, said: (document.querySelector('#sheet .coach-said') || {}).textContent || '',
      live: [...document.querySelectorAll('[aria-live]')].map(e => e.id || e.className), off: k.bottom <= b.top + 0.5 || k.top >= b.bottom - 0.5, steps: Teacher.STEPS.length };
  }, form);
  const id = r.s.id, at = `${tag} step ${r.s.step + 1} (${id})`;
  if (r.s.form !== form) bad(`${at}: the coach uses ${r.s.form}'s words, not ${form}'s`);
  if (r.s.text !== r.want) bad(`${at}: the coach says "${r.s.text}", not the teacher's "${r.want}"`);
  if (!WORDS[form](r.s.text)) bad(`${at}: "${r.s.text}" is not in ${form}'s words`);
  if (r.n !== `${r.s.step + 1} of ${r.steps}`) bad(`${at}: the count reads "${r.n}"`);
  if (!r.said.includes(r.s.text)) bad(`${at}: the live region says "${r.said}", not the sentence`);
  if (r.live.join() !== 'sheet,aim-text') bad(`${at}: the live regions are ${r.live.join(', ')}, not the label panel's and the aim's`);
  if (!r.off) bad(`${at}: the coach lies over the board`);
  // The fit, at each text size on a phone.
  for (const t of W < 900 ? ['1', '1.15', '1.3'] : ['1']) {
    await page.evaluate(t => window.ACCESSION.setting('text', t), t);
    const h = await page.evaluate(() => document.getElementById('board').getBoundingClientRect().height);
    if (W < 900 && h < 0.4 * H) bad(`${at}: at text ${t} the board is left ${Math.round(h)} px of ${H}`);
    for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${at} at text ${t}: ${p}`);
  }
  await page.evaluate(() => window.ACCESSION.setting('text', '1'));
  // The frame round what the step needs: drawn and uncovered where the board shows it.
  const tg = await page.evaluate(() => {
    const A = window.ACCESSION, vm = A.vm(), pt = Coach.point(), m = vm.marks.find(k => k.kind === 'coach');
    if (!pt) return { none: true, m: !!m };
    if (!m) return { unseen: true, listed: pt.uid ? vm.actors.some(a => a.uid === pt.uid) : vm.vis[pt.y * vm.w + pt.x] === 2 };
    const R = A.renderer, b = document.getElementById('board').getBoundingClientRect(), clear = b.bottom - UI.sheetCover(), c = R.tileRect(m.x, m.y).centre;
    const on = c.x >= b.left && c.y >= b.top && c.x < b.right && c.y < clear, top = on ? document.elementFromPoint(c.x, c.y) : null;
    return { on, drawn: R.inspect().some(d => d.id === `coach:${m.x},${m.y}`), uncovered: !!top && !!top.closest('#board') };
  });
  if (tg.none && tg.m) bad(`${at}: a frame with nothing to point at`);
  if (tg.unseen && tg.listed) bad(`${at}: what the step needs is in view but not framed`);
  if (tg.on && !(tg.drawn && tg.uncovered)) bad(`${at}: the frame is ${tg.drawn ? 'covered' : 'not drawn'}`);
  for (const p of (await page.evaluate(board)).problems) bad(`${at}: ${p}`);
  // The coach only reads: a look leaves the state's hash as it was.
  const same = await page.evaluate(() => { const A = window.ACCESSION, h = State.hash(A.state); Coach.see(A.vm(), A.events); return State.hash(A.state) === h; });
  if (!same) bad(`${at}: the coach changed the state`);
  c.did.add(id);
}

// The coach only reads, over the whole play: the game as it stands equals the same actions
// played on a fresh room with no coach at all (the actions main.js passed to Step.step,
// recorded by record() below), so nothing but those actions changed it.
const replayed = page => page.evaluate(() => {
  const A = window.ACCESSION, acts = window.__acts.filter(x => x.s === A.state).map(x => x.a), t = Orientation.create();
  for (const a of acts) Step.step(t, a);
  return { n: acts.length, same: State.hash(t) === State.hash(A.state) };
});
// Keeps every action main.js gives Step.step for the state it plays (nothing else changes).
const record = page => page.evaluate(() => {
  if (Step.__recorded) return;
  const step = Step.step;
  window.__acts = [];
  Step.step = (s, a) => { if (window.ACCESSION && s === window.ACCESSION.state) window.__acts.push({ s, a: JSON.parse(JSON.stringify(a)) }); return step(s, a); };
  Step.__recorded = true;
});

// Plays the Orientation from wherever it is to its end: the first visit. True if it got there.
async function playThrough(c) {
  const { page, drv, tag } = c;
  const start = await page.evaluate(() => ({ on: Coach.status().on, acc: window.ACCESSION.state.dept.acc, step: Coach.status().step }));
  if (!start.on || start.acc !== 'O') { bad(`${tag}: the Orientation is not running (${JSON.stringify(start)})`); return false; }
  let shown = -1;
  for (let i = 0; i < 150; i++) {
    const st = await page.evaluate(() => Coach.status());
    if (!st.on) break;
    if (st.step !== shown) {
      if (st.step < shown) bad(`${tag}: the coach went back from step ${shown + 1} to ${st.step + 1}`);
      await stepChecks(c, st); shown = st.step;
    }
    const p = await page.evaluate(plan, st.id);
    if (p.k === 'step') await drv.step(p.dir);
    else if (p.k === 'select') await drv.select(p.id);
    else if (p.k === 'strike') await drv.strike(p.id, p.dir);
    else if (p.k === 'wait') await drv.wait();
    else if (p.k === 'case') { if (await drv.select(p.id)) await drv.label(p.act); }
    else if (p.k === 'walk') await drv.walk(p.to);
    else if (p.k === 'exit') { if (c.form === 'keys') { if (p.seen) await drv.walkExit(p); else await drv.walk(p.to); } else await drv.walk(p.to); }
    else if (p.k === 'leave') { await drv.leave(); if (await page.evaluate(() => UI.confirmOpen())) await drv.yes(); else bad(`${tag}: Leave did not ask first`); }
    const over = await page.evaluate(() => window.ACCESSION.state.over);
    if (over && over.k === 'died') { bad(`${tag}: you died in the Orientation playing it as asked`); return false; }
    if (!over && await page.evaluate(() => Coach.status().on)) {
      const r = await replayed(page);
      if (!r.same) { bad(`${tag}: after ${r.n} actions the game differs from the same actions played without the coach`); return false; }
    }
  }
  const v = await page.evaluate(() => ({ s: Coach.status(), acc: window.ACCESSION.state.dept.acc, seed: window.ACCESSION.seed, turn: window.ACCESSION.state.turn, end: UI.endOpen(), hidden: document.getElementById('coach').hidden, said: !!document.querySelector('#sheet .coach-said') }));
  if (v.s.on || !v.s.seen || v.acc !== 'M11' || v.seed !== 3 || v.turn !== 0 || v.end || !v.hidden || v.said) { bad(`${tag}: leaving did not start the first visit (${JSON.stringify(v)})`); return false; }
  return true;
}

// A death in the Orientation: the trolley set beside you, hunting, with a sure blow, and you at
// 1 health (staged, as scenes.mjs stages its death); then waits by the input until it comes.
async function dieThere(c) {
  const { page, drv, tag } = c;
  const st = await status(page);
  if (!st.on || st.acc !== 'O') { bad(`${tag}: Practice room did not start the Orientation (${JSON.stringify(st)})`); return false; }
  await page.evaluate(() => {
    const A = window.ACCESSION, s = A.state, me = s.actors[0], a = Actors.byUid(s, Orientation.facts().sleeper);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = me.x + dx, y = me.y + dy; if (Grid.walkable(s.dept, x, y) && !Actors.at(s, x, y)) { a.x = x; a.y = y; break; } }
    Object.assign(a, { mode: 'hunting', sawYou: true, lastKnown: [me.x, me.y], stim: s.turn, acc: 40, next: me.next });
    me.hp = 1; A.redraw();
  });
  for (let i = 0; i < 12 && !await page.evaluate(() => !!window.ACCESSION.state.over); i++) await drv.wait();
  const r = await page.evaluate(() => {
    const A = window.ACCESSION, want = A.state.over && A.state.over.k === 'died' ? Text.recap(A.state, Labels.nameOf(A.state)).lines : [];
    return { over: A.state.over && A.state.over.k, open: UI.endOpen(), want, shown: [...document.querySelectorAll('#end.open .recap p')].map(p => p.textContent),
      yes: (document.querySelector('#end.open [data-another]') || {}).textContent, more: (document.querySelector('#end.open [data-end-more="practice"]') || {}).textContent };
  });
  if (r.over !== 'died' || !r.open || !r.want.length || JSON.stringify(r.want) !== JSON.stringify(r.shown) || r.yes !== 'Start the visit' || r.more !== 'Practice again') {
    bad(`${tag}: a death in the Orientation did not show its recap with Start the visit and Practice again (${JSON.stringify(r)})`);
    return false;
  }
  for (const p of [...await page.evaluate(layout), ...await page.evaluate(targets)]) bad(`${tag} the recap: ${p}`);
  return true;
}

const status = page => page.evaluate(() => ({ on: Coach.status().on, step: Coach.status().step, seen: Coach.status().seen, acc: window.ACCESSION.state.dept.acc, seed: window.ACCESSION.seed, turn: window.ACCESSION.state.turn, over: !!window.ACCESSION.state.over, end: UI.endOpen() }));

// Every play of one input, in its own browser contexts.
async function runInput(browser, input) {
  for (const [W, H] of input.sizes) {
    const touch = input.form === 'touch';
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && W < 500 });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // Only this input: any other the page sees is a problem.
    await page.addInitScript(form => {
      window.__other = [];
      for (const t of ['keydown', 'mousedown', 'pointerdown', 'touchstart']) window.addEventListener(t, e => {
        if (!e.isTrusted) return;
        const pt = e.pointerType || '', fromTouch = t === 'mousedown' && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents;
        const ok = form === 'keys' ? t === 'keydown' : form === 'mouse' ? (t === 'mousedown' || (t === 'pointerdown' && pt === 'mouse')) : (t === 'touchstart' || (t === 'pointerdown' && pt === 'touch') || fromTouch);
        if (!ok) window.__other.push(t + (pt ? ':' + pt : ''));
      }, true);
    }, input.form);
    const hit = touch ? (x, y) => page.touchscreen.tap(x, y) : (x, y) => page.mouse.click(x, y);
    const load = async q => {
      await page.goto(URL(q));
      await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
      await page.evaluate(`window.__spot = ${spotOf.toString()};`);
      await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
      await record(page);
    };
    await load('?orient=0&dept=M11&seed=3');
    const views = (await page.evaluate(() => window.ACCESSION.views.list())).map(v => ({ id: v.id, label: v.label }));
    for (const v of views) {
      const tag = `${W}×${H} ${v.label} ${input.form}`, t0 = Date.now(), did = new Set();
      const drv = input.form === 'keys' ? keyDriver(page, tag) : pointer(page, tag, hit, W);
      const c = { page, drv, tag, form: input.form, W, H, did };
      const first = W === input.sizes[0][0] && H === input.sizes[0][1] && v === views[0];
      const notes = [];
      if (first) {
        // A first visit: no flag, so the Orientation starts; Skip starts the visit and sets it;
        // a second load starts the visit; ?orient=0 never shows the Orientation.
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
        await load(`?dept=M11&seed=3&board=${v.id}`);
        const a = await status(page);
        if (!a.on || a.acc !== 'O' || a.seen) bad(`${tag}: a first load did not start the Orientation (${JSON.stringify(a)})`);
        await drv.harmless();
        await drv.skip();
        const b = await status(page);
        if (b.on || !b.seen || b.acc !== 'M11' || b.seed !== 3 || b.turn !== 0) bad(`${tag}: Skip did not start the visit and set the flag (${JSON.stringify(b)})`);
        await load(`?dept=M11&seed=3&board=${v.id}`);
        const d = await status(page);
        if (d.on || d.acc !== 'M11') bad(`${tag}: a second load did not start the visit (${JSON.stringify(d)})`);
        await load(`?orient=0&dept=M11&seed=3&board=${v.id}`);
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
        await load(`?orient=0&dept=M11&seed=3&board=${v.id}`);
        const o = await status(page);
        if (o.on || o.acc !== 'M11') bad(`${tag}: ?orient=0 showed the Orientation (${JSON.stringify(o)})`);
        // Practice room, from "How the museum works", plays it again; this play goes on from it.
        await drv.practice();
        const p = await status(page);
        if (!p.on || p.step !== 0 || p.acc !== 'O' || p.over) bad(`${tag}: Practice room did not start the Orientation (${JSON.stringify(p)})`);
        notes.push('a first load started it, Skip set the flag, a second load and ?orient=0 started the visit, Practice room replayed it');
      } else {
        await load(`?orient=1&dept=M11&seed=3&board=${v.id}`);
        await drv.harmless();
      }
      const active = await page.evaluate(() => window.ACCESSION.views.active().id);
      if (active !== v.id) { bad(`${tag}: the ${v.label} board is not the one shown`); continue; }
      if (await playThrough(c)) notes.push(`seven steps (${[...did].join(', ')}), then the first visit`);
      if (first) {
        // A death there: the recap, with Practice again (keys and touch) or Start the visit.
        await drv.practice();
        if (await dieThere(c)) {
          if (input.form === 'mouse') {
            await drv.endButton('[data-another]');
            const e = await status(page);
            if (e.on || e.acc !== 'M11' || e.seed !== 3 || e.turn !== 0 || e.end || !e.seen) bad(`${tag}: Start the visit after a death did not start the visit (${JSON.stringify(e)})`);
            else notes.push('a death showed the recap, and Start the visit started the visit');
          } else {
            await drv.endButton('[data-end-more="practice"]');
            const e = await status(page);
            if (!e.on || e.step !== 0 || e.acc !== 'O' || e.over || e.end) bad(`${tag}: Practice again after a death did not start the Orientation again (${JSON.stringify(e)})`);
            else notes.push('a death showed the recap, and Practice again played it again');
            await drv.skip();
          }
        }
      }
      const other = await page.evaluate(() => window.__other);
      if (other.length) bad(`${tag}: the page saw input other than ${input.form}'s (${[...new Set(other)].join(', ')})`);
      lines.push(`${tag} (${Math.round((Date.now() - t0) / 1000)} s): ${notes.join('; ')}`);
    }
    const words = await page.evaluate(() => (document.body.innerText.match(/[^\n]*(undefined|NaN|\[object)[^\n]*/g) || []).slice(0, 3));
    if (words.length) bad(`${W}×${H} ${input.form}: the page says ${words.join(' | ')}`);
    if (errors.length) bad(`${W}×${H} ${input.form}: console errors: ${errors.join('; ')}`);
    await ctx.close();
  }
}

const pw = playwright();
if (!pw) { console.log('SKIPPED: Playwright not found'); process.exit(77); }
const t0 = Date.now();
// No sound while it plays: Chromium is muted (--mute-audio).
const browser = await pw.chromium.launch({ args: ['--mute-audio'] });
await Promise.all(INPUTS.map(i => runInput(browser, i).catch(e => bad(`${i.form}: the check stopped: ${String(e.message || e).split('\n')[0]}`))));
await browser.close();
for (const l of lines) console.log(l);
for (const p of problems) console.log('PROBLEM ' + p);
console.log(problems.length ? `orient: ${problems.length} problem(s)` : `orient: the Orientation played whole with the keys alone, left clicks alone and a finger alone, phone and laptop (and a tablet for the finger), every view (${Math.round((Date.now() - t0) / 1000)} s): each step's sentence the teacher's in that input's words, in the live region, the board's height, fit and 44-px targets with the coach showing at every text size, its frame drawn and uncovered, the coach only reading; leaving started the first visit; a first load started it, Skip set the flag, a second load started the visit, Practice room replayed it, a death offered it again; no problems`);
process.exit(problems.length ? 1 : 0);
