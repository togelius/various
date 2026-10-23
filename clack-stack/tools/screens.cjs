#!/usr/bin/env node
'use strict';
// Screenshots of every screen to LOOK at (DESIGN 18.4, 18.8 G3), at 390x844 and 844x390 (a phone, touch) and 1366x1024
// (a tablet-sized window, mouse): the title; the first drop with its hint; paused (RESUME, MENU); the title with BIG
// MAGNETS turned on; aiming a square (its place shining, the ×2
// chip, every square fit outlined, the whole-tile ticks); a triangle (▲ carets, ▼ chevrons, turned point-down to hang);
// ONLY A POINT; TIPS OVER (with rules that have it) and its rock when let go (the marks kept through it); a drop that
// may take the tower over (the amber ghost, PAST THE WHEEL!); an open thin gap; a tile falling off and leaving the wall;
// the box's counter near its end with THE TOPPER next; THE TOPPER aimed where it tops out (gold, TOPS OUT!), TOPPED OUT!
// and its card; THE BOX IS EMPTY! and its card; the dead-tile swap; a sway; the weight amber; a tall tower (the weight
// pinned); a crash and its card; BIG MAGNETS (the pull, KNOCK IT DOWN, the shove). Static scenes are ?quiz pictures, moving ones run on the ?drive clock with real input.
// Each scene checks what it shows through CS.display(); the display-list audit hides each layer a scene drew and checks
// that the pixels in the box it claims change. Fails on page or console errors.
//   node clack-stack/tools/screens.cjs [outDir] [--sizes=390x844,844x390,1366x1024] [--only=name,...]
// Writes outDir/<size>/NN-name.png and outDir/sheet-<size>.png.
const path = require('path');
const fs = require('fs');
const { launch, gamePage, touch, sleep } = require('./lib.cjs');

const argv = process.argv.slice(2);
const out = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'clack-screens'));
const SIZES = ((argv.find(a => a.startsWith('--sizes=')) || '--sizes=390x844,844x390,1366x1024').slice(8)).split(',').map(s => s.split('x').map(Number));
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const PLAYED = { 'clackstack.prefs5': JSON.stringify({ played: true }) };
let bad = 0;
const fail = m => { bad++; console.log('  FAIL ' + m); };

(async () => {
  const browser = await launch();
  try {
    for (const [W, H] of SIZES) {
      const dir = path.join(out, `${W}x${H}`), phone = Math.min(W, H) < 700;
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      let n = 0;
      const tag = `${W}x${H}`;
      const shot = async (page, name) => { const f = path.join(dir, String(++n).padStart(2, '0') + '-' + name + '.png'); await page.screenshot({ path: f }); files.push(f); return f; };
      const want = name => !ONLY.length || ONLY.includes(name);
      const open = (params, opts) => gamePage(browser, { width: W, height: H }, Object.assign({ mute: 1, seed: 7 }, params), Object.assign({ touch: phone, storage: PLAYED }, opts || {}));
      const display = page => page.evaluate(() => CS.display());
      const check = async (page, name, fn) => { const why = await page.evaluate(fn); if (why) fail(`${tag} ${name}: ${why}`); };
      // the display-list audit: hiding each layer the scene drew changes the pixels in the box it claims
      const audit = async (page, name) => {
        const d = await display(page), seen = new Set(), missed = [];
        for (const l of d.layers) {
          if (seen.has(l.layer) || !l.box) continue;
          seen.add(l.layer);
          const b = l.box, clip = { x: Math.max(0, Math.floor(b.x0)), y: Math.max(0, Math.floor(b.y0)) };
          clip.width = Math.min(W, Math.ceil(b.x1)) - clip.x; clip.height = Math.min(H, Math.ceil(b.y1)) - clip.y;
          if (clip.width < 2 || clip.height < 2) continue;
          const a = await page.screenshot({ clip });
          await page.evaluate(l => CS.hide(l), l.layer);
          const c = await page.screenshot({ clip });
          await page.evaluate(l => CS.show(l), l.layer);
          if (a.equals(c)) missed.push(l.layer);
        }
        if (missed.length) fail(`${tag} ${name}: hiding ${missed.join(', ')} changed nothing in the box it claims`);
        return seen.size;
      };
      // a still picture: ?quiz (a build, the hand at a column, the clock stopped)
      const quiz = async (name, q, fn, doAudit) => {
        if (!want(name)) return null;
        const { context, page, errors } = await open({ quiz: JSON.stringify(q), nohint: 1 });
        await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
        await page.evaluate(() => CS.render());
        await shot(page, name);
        if (fn) await check(page, name, fn);
        if (doAudit) { const k = await audit(page, name); if (!k) fail(`${tag} ${name}: no layers to audit`); }
        if (errors.length) fail(`${tag} ${name}: ` + errors.join(' / '));
        await context.close();
        return true;
      };
      // a moving scene on the ?drive clock: a parked base, tiles placed with CS.build, the box set, real input
      const drive = async (name, params, run) => {
        if (!want(name)) return;
        const { context, page, errors } = await open(Object.assign({ drive: 1, autostart: 1, nohint: 1 }, params || {}));
        await page.waitForFunction(() => window.CS && CS.state().phase === 'play');
        await page.evaluate(() => CS.wait(0.5));
        const T = phone ? await touch(page) : null;
        const ptr = {
          async aim(col) { const x = await page.evaluate(c => CS.colToX(c), col); if (T) { await T.down(x, H * 0.5); await T.move(x, H * 0.5); } else await page.mouse.move(x, H * 0.5); await page.evaluate(() => CS.step(1)); },
          async drop(col) { if (col !== undefined) await ptr.aim(col); if (T) await T.up(); else { await page.mouse.down(); await page.mouse.up(); } await page.evaluate(() => CS.step(1)); },
        };
        try { await run(page, ptr, name); } catch (e) { fail(`${tag} ${name}: ` + e.message); }
        if (errors.length) fail(`${tag} ${name}: ` + errors.join(' / '));
        await context.close();
      };
      const wait = (page, t) => page.evaluate(t => CS.wait(t), t);

      // 1. the title (a real clock)
      if (want('title')) {
        const { context, page, errors } = await open({}, { storage: {} });
        await sleep(700);
        await shot(page, 'title');
        // 2. the first drop: a tap starts the run; the first-time hint, the ghost on the bare base
        if (T0(phone)) { const T = await touch(page); await T.tap(W / 2, H * 0.45); } else await page.mouse.click(W / 2, H * 0.45);
        await page.waitForFunction(() => CS.state().phase === 'play' && CS.state().handReady && !CS.state().locked, null, { timeout: 15000 });
        await sleep(400);
        await shot(page, 'first-drop-hint');
        const tip = await page.evaluate(() => CS.tipBox());
        if (!tip || tip.id !== 'drop' || tip.text !== 'Let go: it falls straight down.') fail(`${tag} first drop: no "Let go: it falls straight down." hint`);
        // paused: the pause button (a real tap or click on it), RESUME and MENU over the dimmed game
        {
          const ui = await page.evaluate(() => CS.ui());
          if (T0(phone)) { const T = await touch(page); await T.tap(ui.pause.x + ui.pause.w / 2, ui.pause.y + ui.pause.h / 2); } else await page.mouse.click(ui.pause.x + ui.pause.w / 2, ui.pause.y + ui.pause.h / 2);
          await sleep(300);
          await shot(page, 'paused');
          const d = await page.evaluate(() => ({ phase: CS.state().phase, buttons: CS.display().buttons.map(b => b.text) }));
          if (d.phase !== 'paused' || !d.buttons.includes('RESUME') || !d.buttons.includes('MENU')) fail(`${tag} paused: ${JSON.stringify(d)}`);
          // MENU: back to the title, BIG MAGNETS turned on with its button
          const menu = await page.evaluate(() => CS.display().buttons.find(b => b.text === 'MENU').box);
          if (T0(phone)) { const T = await touch(page); await T.tap((menu.x0 + menu.x1) / 2, (menu.y0 + menu.y1) / 2); } else await page.mouse.click((menu.x0 + menu.x1) / 2, (menu.y0 + menu.y1) / 2);
          await sleep(300);
          const big = await page.evaluate(() => (CS.display().buttons.find(b => b.name === 'big') || {}).box);
          if (big) { if (T0(phone)) { const T = await touch(page); await T.tap((big.x0 + big.x1) / 2, (big.y0 + big.y1) / 2); } else await page.mouse.click((big.x0 + big.x1) / 2, (big.y0 + big.y1) / 2); }
          await sleep(400);
          await shot(page, 'title-big-magnets');
          const st = await page.evaluate(() => ({ phase: CS.state().phase, big: CS.state().big }));
          if (st.phase !== 'title' || !st.big) fail(`${tag} title, BIG MAGNETS: ${JSON.stringify(st)}`);
        }
        if (errors.length) fail(`${tag} title: ` + errors.join(' / '));
        await context.close();
      }
      // 3. aiming a square: its place shines, ×2 (the car and the square beside it), every square fit outlined, the ticks
      await quiz('aim-square', { build: ['■-2', '■-2', '▲-1', '■1'], hand: '■0' }, () => {
        const d = CS.display(), g = d.ghost;
        if (!g || g.style !== 'fit' || g.chip !== '×2' || g.shine.length !== 2) return 'ghost ' + JSON.stringify(g && { style: g.style, chip: g.chip, shine: g.shine.length });
        if (!d.markers.length || d.markers.some(m => m.kind !== 'outline')) return 'no square outlines';
        if (!d.ticks.length) return 'no whole-tile ticks';
        if (!g.column) return 'no fall column';
        if (!d.counter || !d.next) return 'no counter or NEXT';
        return '';
      }, true);
      // 4. a triangle: it turns point-down to hang on a ▲'s side; ▲ carets and ▼ chevrons mark every fit
      await quiz('aim-triangle', { build: ['■-2', '■1', '▲-1', '▲0'], hand: '▼-0.5' }, () => {
        const d = CS.display(), g = d.ghost;
        if (!g || g.style !== 'fit' || g.way !== 'down') return 'the ghost is not a ▼ that fits: ' + JSON.stringify(g && { style: g.style, way: g.way });
        if (!d.hand || d.hand.way !== 'down') return 'the held triangle is not turned point-down';
        if (!d.markers.some(m => m.kind === 'caret') || !d.markers.some(m => m.kind === 'chevron')) return 'markers ' + d.markers.map(m => m.kind).join(',');
        return '';
      }, true);
      // 5. ONLY A POINT: revision 4's triangle on a triangle's point
      await quiz('only-a-point', { build: ['▲0', '■-2', '■1'], hand: '▲0' }, () => {
        const g = CS.display().ghost;
        if (!g || g.style !== 'off' || g.reason !== 'ONLY A POINT' || !g.marks || !g.marks.dots.length) return 'ghost ' + JSON.stringify(g && { style: g.style, reason: g.reason, dots: g.marks && g.marks.dots.length });
        return CS.display().hand.red ? '' : 'the held tile is not red';
      }, true);
      // 6. TIPS OVER (with rules that have it): golden case 16, a square on a hung ▼'s top
      if (want('tips-over')) {
        const has = await (async () => { const { context, page } = await open({ autostart: 1, nohint: 1 }); await page.waitForFunction(() => window.CS); const r = await page.evaluate(() => CS.state().reasons); await context.close(); return r.includes('TIPS OVER'); })();
        if (has) await quiz('tips-over', { build: ['▲-1', '▼-0.5', '■-2'], hand: '■0' }, () => {
          const g = CS.display().ghost;
          if (!g || g.reason !== 'TIPS OVER' || !g.marks || !g.marks.part.length || !g.marks.pivot || !g.marks.plumb) return 'ghost ' + JSON.stringify(g && { reason: g.reason, marks: g.marks && Object.keys(g.marks) });
          return '';
        }, true);
        else console.log(`  (${tag} tips-over: these rules have no TIPS OVER; skipped)`);
        // and let go: the part rocks toward its corner and back, its marks kept on it, then the tile leaves the wall
        if (has) await drive('tips-over-rock', {}, async (page, ptr) => {
          await page.evaluate(() => { CS.build(['▲-1', '▼-0.5', '■-2']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'sq', 'top']); });
          await wait(page, 0.4);
          await ptr.drop(0);
          let a = 0;
          for (let i = 0; i < 120 && Math.abs(a) < 0.15; i++) { await page.evaluate(() => CS.step(2)); a = await page.evaluate(() => { const r = CS.display().rockMarks; return r ? r.a : 0; }); }
          await shot(page, 'tips-over-rock');
          const d = await display(page);
          const rocked = d.tiles.filter(t => d.rockMarks && d.rockMarks.members.includes(t.i)).length;
          if (!d.rockMarks || !d.rockMarks.part.length || !d.rockMarks.pivot || !d.rockMarks.plumb || Math.abs(a) < 0.15 || rocked < 2) fail(`${tag} tips-over rock: ${JSON.stringify({ a, rocked, rm: d.rockMarks && { part: d.rockMarks.part.length, members: d.rockMarks.members } })}`);
          await wait(page, 0.6);
          await shot(page, 'tips-over-leaves-wall');
        });
      }
      // 6b. a drop that may take the tower over: the ghost amber and solid, PAST THE WHEEL! by it, the held tile's rims amber
      await drive('topple-warning', {}, async (page, ptr) => {
        // (a tall tower leaning right and swaying: one more square on its right may take it over, as the sway swings)
        await page.evaluate(() => { CS.build(['■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'sq', 'top']); });
        await ptr.aim(2); await wait(page, 1.5);
        await page.evaluate(() => { WOB.W = 0.25; WOB.dir = 1; });
        let amber = false;
        for (let i = 0; i < 120 && !amber; i++) { await page.evaluate(() => CS.step(1)); amber = await page.evaluate(() => { const g = CS.display().ghost; return !!(g && g.color === 'amber'); }); }
        await shot(page, 'topple-warning');
        const d = await display(page), g = d.ghost;
        if (!g || g.color !== 'amber' || !g.warn || !g.callout || g.callout.text !== 'PAST THE WHEEL!' || !d.ghostWeight || !d.ghostWeight.tip || !d.hand.warn) fail(`${tag} topple warning: ${JSON.stringify({ g: g && { color: g.color, warn: g.warn, callout: g.callout }, gw: d.ghostWeight, hand: d.hand && d.hand.warn })}`);
      });
      // 7. an open gap: golden case 7, a ▲ half on a square, 0.134 L over a ▼'s top: left open, a dotted outline only
      await quiz('open-gap', { build: ['■-2', '▲-0.5', '▼-1', '▲-1.5', '■1'], hand: '■1' }, () => {
        const d = CS.display();
        return d.gaps.length ? '' : 'no gap drawn';
      }, true);
      // 8. a tile falling off: it touches at a point, tips a little, then leaves the wall toward you onto the rug
      await drive('fall-off', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['▲0', '■-2', '■1']); CS.setPiece('tri'); CS.setBox(['sq', 'sq', 'sq', 'sq', 'top']); });
        await wait(page, 0.6);
        await ptr.drop(-1 + 1);
        await page.waitForFunction(() => CS.state().falling > 0);
        let st = '';
        for (let i = 0; i < 80 && st !== 'tip' && st !== 'rock'; i++) { await page.evaluate(() => CS.step(2)); st = await page.evaluate(() => { const f = CS.display().falling.find(x => x.outcome === 'off'); return f ? f.stage : ''; }); }
        await page.evaluate(() => CS.step(6));
        await shot(page, 'fall-off-tips');
        await wait(page, 0.18);
        await shot(page, 'fall-off-leaves-wall');
        await wait(page, 1.2);
        await shot(page, 'fall-off-on-rug');
        const s = await page.evaluate(() => ({ lost: CS.state().lost, tiles: CS.state().tiles, deb: CS.state().debris }));
        if (s.lost !== 1 || s.tiles !== 3 || s.deb < 1) fail(`${tag} fall-off: ${JSON.stringify(s)}`);
      });
      // 9. the box near its end: its counter, THE TOPPER next
      await drive('box-topper-next', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['■-2', '■0', '■-2', '■0', '■-1']); CS.setBox(['top']); });
        await wait(page, 0.4); await ptr.aim(0); await wait(page, 0.1);
        await shot(page, 'box-topper-next');
        const d = await display(page);
        if (!d.counter || d.counter.sq !== 0 || d.counter.tri !== 0 || !d.counter.topper || !d.next || !d.next.topper) fail(`${tag} box: ${JSON.stringify({ counter: d.counter, next: d.next })}`);
      });
      // 10. THE TOPPER on the very top: TOPPED OUT!, and its card
      await drive('topped-out', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['■-2', '■0', '■-2', '■0', '■-1']); CS.setPiece('tri', true); CS.setBox([]); });
        await wait(page, 0.4); await ptr.aim(-1); await wait(page, 0.1);
        await shot(page, 'topper-aim');
        { const g = (await display(page)).ghost; if (!g || g.color !== 'gold' || !g.tops || !g.callout || g.callout.text !== 'TOPS OUT!') fail(`${tag} topper aim: ${JSON.stringify(g && { color: g.color, tops: g.tops, callout: g.callout })}`); }
        await ptr.drop();
        await page.waitForFunction(() => CS.state().phase !== 'play' || CS.events.some(e => e.type === 'topped'), null, { timeout: 2000 }).catch(() => {});
        for (let i = 0; i < 60 && !(await page.evaluate(() => CS.events.some(e => e.type === 'topped'))); i++) await page.evaluate(() => CS.step(4));
        await wait(page, 0.3);
        await shot(page, 'topped-out');
        await wait(page, 3);
        await shot(page, 'topped-out-card');
        const s = await page.evaluate(() => CS.state());
        if (!s.over || s.over.final.end !== 'topped' || s.over.final.why !== 'TOPPED OUT!') fail(`${tag} topped out: ${JSON.stringify(s.over)}`);
      });
      // 10b. THE TOPPER turned point-down into a notch, its top level with the apexes beside it: that is the very top
      await drive('topper-level', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['▲-1', '▲0']); CS.setPiece('tri', true); CS.setBox([]); });
        await wait(page, 0.4); await ptr.aim(-1); await wait(page, 0.1);
        await shot(page, 'topper-level-aim');
        const g = (await display(page)).ghost;
        if (!g || g.way !== 'down' || g.color !== 'gold' || !g.callout || g.callout.text !== 'TOPS OUT!') fail(`${tag} topper level: ${JSON.stringify(g && { way: g.way, color: g.color, callout: g.callout })}`);
        await ptr.drop();
        for (let i = 0; i < 60 && !(await page.evaluate(() => CS.events.some(e => e.type === 'topped'))); i++) await page.evaluate(() => CS.step(4));
        await wait(page, 4);
        const s = await page.evaluate(() => CS.state());
        if (!s.over || s.over.final.end !== 'topped') fail(`${tag} topper level: the run ended ${JSON.stringify(s.over && s.over.final)}`);
      });
      // 11. THE BOX IS EMPTY!: the last tile lands below the top
      await drive('box-empty', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['■-2', '■-2', '■-2', '■0']); CS.setPiece('tri', true); CS.setBox([]); });
        await wait(page, 0.4); await ptr.drop(1);
        await wait(page, 1.6);
        await shot(page, 'box-empty');
        await wait(page, 3);
        await shot(page, 'box-empty-card');
        const s = await page.evaluate(() => CS.state());
        if (!s.over || s.over.final.end !== 'empty' || s.over.final.why !== 'THE BOX IS EMPTY!' || s.over.final.why2 !== "THE TOPPER WASN'T ON TOP") fail(`${tag} box empty: ${JSON.stringify(s.over)}`);
      });
      // 12. no dead tiles: a square fits nowhere over four ▲ points; it goes back to the box for the next triangle
      await drive('dead-swap', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['▲-2', '▲-1', '▲0', '▲1']); CS.setPiece('sq'); CS.setBox(['sq', 'sq', 'tri', 'sq', 'top']); });
        await ptr.drop(2);
        let sw = false;
        for (let i = 0; i < 60 && !sw; i++) { await page.evaluate(() => CS.step(2)); sw = await page.evaluate(() => CS.state().swapping); }
        await page.evaluate(() => CS.step(24));
        await shot(page, 'dead-tile-swap');
        await wait(page, 0.6);
        const s = await page.evaluate(() => CS.state());
        if (!sw || s.piece !== 'tri' || s.swaps !== 1) fail(`${tag} swap: ${JSON.stringify({ sw, piece: s.piece, swaps: s.swaps })}`);
      });
      // 13. a tall thin tower swaying: the sway carries the weight toward a wheel
      await drive('sway', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['■0', '■0', '■0', '■0', '■0', '■0', '■0']); WOB.W = 0.32; WOB.dir = 1; });
        await ptr.aim(0); await wait(page, 0.45);
        await shot(page, 'sway');
        if ((await page.evaluate(() => CS.state().swayAmp)) < 0.3) fail(`${tag} sway: not swaying`);
      });
      // 14. the weight amber: a tower leaning right; the ghost weight shows where the next tile takes it
      await drive('weight-amber', {}, async (page, ptr) => {
        await page.evaluate(() => CS.build(['■1', '■1', '■1', '■1', '■1', '■1', '▲1.5']));
        await ptr.aim(2); await wait(page, 0.3);
        await shot(page, 'weight-amber');
        const z = await page.evaluate(() => CS.state().weight.zone);
        if (z === 'green') fail(`${tag} weight: still green`);
      });
      // 15. a tall tower: the camera has scrolled and the weight is pinned to the bottom of the screen
      await drive('tall', {}, async (page, ptr) => {
        const b = []; for (let r = 0; r < 28; r++) b.push('■-1', '■0');
        await page.evaluate(b => CS.build(b), b);
        await ptr.aim(-2); await wait(page, 1.5);
        await shot(page, 'tall-pinned-weight');
        const w = await page.evaluate(() => CS.weightBox());
        if (!w || !w.pinned) fail(`${tag} tall: the weight is not pinned`);
      });
      // 16. the crash and its card: one more out over the edge of a leaning tower
      await drive('crash', {}, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1', '■1']); CS.setPiece('sq'); WOB.W = 0.6; WOB.dir = 1; });
        await ptr.drop(2);
        for (let i = 0; i < 200 && (await page.evaluate(() => CS.state().phase)) === 'play'; i++) await page.evaluate(() => CS.step(3));
        await page.evaluate(() => CS.step(6));
        await shot(page, 'crash');
        for (let i = 0; i < 400 && !(await page.evaluate(() => CS.state().over && CS.state().over.open)); i++) await page.evaluate(() => CS.step(6));
        await wait(page, 1.2);
        await shot(page, 'crash-card');
        const ev = await page.evaluate(() => CS.events.filter(e => e.type === 'crash'));
        if (!ev.length || !ev.every(e => e.past)) fail(`${tag} crash: none, or not past a wheel`);
        const lines = (await display(page)).results.lines;
        if (!lines.includes('THE WEIGHT WENT PAST') || !lines.some(l => /^THE (LEFT|RIGHT) WHEEL$/.test(l))) fail(`${tag} crash card: ${lines.join(' / ')}`);
      });
      // 17. BIG MAGNETS: the magnets pull the tile to the nearest fit; KNOCK IT DOWN shoves the tower over; a new car
      await drive('big-magnets', { big: 1 }, async (page, ptr) => {
        await page.evaluate(() => { CS.build(['▲0', '■-2', '■1', '■-2']); CS.setPiece('tri'); });
        await ptr.aim(0); await wait(page, 0.2);
        await shot(page, 'big-pull');
        const g = await page.evaluate(() => CS.ghost());
        if (!g || g.outcome !== 'fit' || g.col === g.handCol) fail(`${tag} big: the ghost is not pulled (${g && g.col} vs ${g && g.handCol})`);
        // let go (it is pulled into its place), then the big button
        await ptr.drop(); await wait(page, 0.8);
        const k = await page.evaluate(() => CS.ui().knock);
        if (T0(phone)) { const T = await touch(page); await T.tap(k.x + k.w / 2, k.y + k.h / 2); } else await page.mouse.click(k.x + k.w / 2, k.y + k.h / 2);
        await page.evaluate(() => CS.step(30));
        await shot(page, 'big-knock-shove');
        for (let i = 0; i < 100 && (await page.evaluate(() => CS.state().crashes)) === 0; i++) await page.evaluate(() => CS.step(2));
        await wait(page, 0.25);
        await shot(page, 'big-knock-crash');
        await wait(page, 2.5);
        await shot(page, 'big-new-car');
        const s = await page.evaluate(() => CS.state());
        const kn = await page.evaluate(() => CS.events.filter(e => e.type === 'knock').length);
        if (s.crashes !== 1 || kn !== 1 || s.phase !== 'play' || s.tiles !== 0) fail(`${tag} knock: ${JSON.stringify({ crashes: s.crashes, phase: s.phase, tiles: s.tiles })}`);
      });
      // contact sheet
      const cols = W > H ? 4 : 6, tw = Math.round(W > H ? 300 : 180), th = Math.round(tw * H / W);
      const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:3px">` +
        files.map(f => `<div style="position:relative"><img src="file://${f}" style="width:${tw}px;height:${th}px;display:block"><div style="position:absolute;left:2px;top:2px;font:11px sans-serif;color:#fff;background:#000a">${path.basename(f, '.png')}</div></div>`).join('') + '</body></html>';
      const hp = path.join(out, `sheet-${tag}.html`);
      fs.writeFileSync(hp, html);
      const sp = await browser.newPage({ viewport: { width: cols * (tw + 3), height: Math.ceil(files.length / cols) * (th + 3) } });
      await sp.goto('file://' + hp); await sp.waitForTimeout(300);
      await sp.screenshot({ path: path.join(out, `sheet-${tag}.png`) });
      await sp.close();
      console.log(`screens ${tag}: ${files.length}`);
    }
  } finally {
    await browser.close();
  }
  console.log('wrote', out);
  console.log(bad ? `screens: ${bad} FAILED` : 'screens: all passed');
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
function T0(phone) { return phone; }
