// ACCESSION — every M3 verb and screen, played through one input alone (BUILD.md §7.1). The
// scenes are written once; each check plays them through its own driver:
//   check-keys   keyDriver: page.keyboard and nothing else;
//   check-touch  pointerDriver with page.touchscreen.tap and nothing else;
//   check-play   pointerDriver with left mouse clicks (its mouse-only pass of these scenes).
// A driver turns an intent ("select this case", "press the label's Open", "answer yes") into
// that input alone. The page is read with page.evaluate, and a scene is set up there as
// check-play stages its own (you are put beside what it needs, exhibits put back to sleep,
// items made in your tote, a lock, a clock or a tile set); the action under test is never
// staged: it is always the driver's input. In M.11, seed 3, as check-play.

// The centre of the first element matching sel that a player can see and press: displayed,
// inside every box that clips it, on screen, and the topmost thing there. Else null.
export function seenAt(sel) {
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

// A point a player can tap to tap tile (x, y), or the actor uid: inside its square, in the
// part of the board no sheet covers, the board the topmost thing there, and the view's pick
// giving that tile (an actor's: its anchor tile). Else null.
export function spotOf(q) {
  const A = window.ACCESSION, R = A.renderer, b = document.getElementById('board').getBoundingClientRect(), clear = b.bottom - UI.sheetCover();
  let rect = null, x = q.x, y = q.y;
  if (q.uid) {
    const a = Actors.byUid(A.state, q.uid), d = R.inspect().find(k => k.kind === 'actor' && k.id === q.uid);
    if (!a || !d) return null;
    rect = d.rect; x = a.x; y = a.y;
  } else { const t = R.tileRect(x, y); if (!t) return null; rect = t.rect; }
  const at = [0.5, 0.35, 0.65, 0.2, 0.8, 0.12, 0.88];
  for (const fy of at) for (const fx of at) {
    const px = rect.x + rect.w * fx, py = rect.y + rect.h * fy;
    if (px < b.left + 1 || py < b.top + 1 || px >= b.right - 1 || py >= clear - 1) continue;
    const e = document.elementFromPoint(px, py), p = R.pick(px, py);
    if (e && e.closest('#board') && p && p.x === x && p.y === y) return { x: px, y: py };
  }
  return null;
}

// Puts the staging helpers on the page (after each load): window.__spot is spotOf, and
// window.__s the helpers below (as check-play's and check-bag's).
export const install = page => page.evaluate(`window.__spot = ${spotOf.toString()}; (${stagers.toString()})();`);
function stagers() {
  const S = () => window.ACCESSION.state, spot = q => window.__spot(q);
  const free = (x, y) => { const s = S(); return Grid.walkable(s.dept, x, y) && '.,'.includes(Grid.ch(s.dept, x, y)) && !Actors.at(s, x, y) && !(s.items || []).some(i => (i.where.at === 'floor' || i.where.at === 'case') && i.where.x === x && i.where.y === y); };
  const cheb = (x, y) => { const me = S().actors[0]; return Math.max(Math.abs(x - me.x), Math.abs(y - me.y)); };
  const T = window.__s = {
    free, cheb,
    // Every exhibit asleep where it stands, with no mark pending.
    calm() { const s = S(); for (const a of s.actors) if (a.uid !== 'you' && !a.gone) { a.mode = 'dormant'; a.pips = 0; a.telegraph = null; a.notBefore = null; a.stim = s.turn; } },
    put(x, y) { const me = S().actors[0]; me.x = x; me.y = y; me.seated = false; },
    // A free floor tile beside (x, y), a step in one of the four main directions away.
    beside(x, y) { for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (free(x + dx, y + dy)) return [x + dx, y + dy]; return null; },
    // A straight lane of n + 1 free tiles from none of which an exhibit is in sight; you are
    // put at its start, and it is returned as its tiles.
    lane(n) {
      const s = S(), m = s.dept, me = s.actors[0], alone = () => ViewModel.derive(s, {}).actors.length === 1;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) for (let d = 0; d < 8; d += 2) {
        const at = k => [x + Grid.DX[d] * k, y + Grid.DY[d] * k];
        let ok = true;
        for (let k = 0; k <= n && ok; k++) { const [p, q] = at(k); ok = free(p, q) && (me.x = p, me.y = q, alone()); }
        if (ok) { const [p, q] = at(0); me.x = p; me.y = q; me.seated = false; return { d, tiles: Array.from({ length: n + 1 }, (_, k) => at(k)) }; }
      }
      return null;
    },
    // A sleeping plodder of size 1, out of every case.
    plodder() { const s = S(); return s.actors.find(a => a.arch === 'plodder' && !a.gone && (a.size || 1) === 1 && Archetypes.present(s, a) === null && !Cases.encased(s, a)) || null; },
    // A tile lo to hi from you among tiles (legal targets), in view and on screen.
    target(tiles, lo, hi) {
      const s = S(), vm = window.ACCESSION.vm();
      const ok = tiles.filter(([x, y]) => cheb(x, y) >= lo && cheb(x, y) <= hi && !Actors.at(s, x, y) && vm.vis[y * vm.w + x] === 2).sort((p, q) => cheb(q[0], q[1]) - cheb(p[0], p[1]));
      for (const [x, y] of ok) if (spot({ x, y })) return { x, y };
      return null;
    },
    // A shut, numbered case that is no mimic, with a free tile beside it where you are put;
    // its lock set to your grade (open: true) or above it, and breakable by your weapon.
    shutCase(open) {
      const s = S(); T.calm();
      const cases = s.dept.fixtures.filter(f => f.k === 'case' && f.st === 'shut' && !f.mimic && f.num).sort((p, q) => open ? 0 : p.glass - q.glass);
      for (const f of cases) {
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const x = f.x + dx, y = f.y + dy;
          if (!free(x, y)) continue;
          T.put(x, y);
          if (open) f.lock = Math.min(f.lock, s.run.grade); else f.lock = Math.max(f.lock, s.run.grade + 1);
          window.ACCESSION.redraw();
          if (open ? !Labels.allowed(s, { a: 'open', x: f.x, y: f.y }) : !Labels.allowed(s, { a: 'bash', x: f.x, y: f.y })) continue;
          if (!spot({ x: f.x, y: f.y })) continue;
          // One to open holds something to take (a Consolidant is put in it if it is empty).
          if (open && f.holds === null) { Consumables.make(s, 'consolidant', { at: 'case', x: f.x, y: f.y }); window.ACCESSION.redraw(); }
          return { x: f.x, y: f.y, id: `case:${f.x},${f.y}` };
        }
      }
      return null;
    },
    // A consumable of kind ck made in your tote: the uid of the tote's stack of that kind (one
    // made joins a stack you carry).
    make(ck) { const s = S(); Consumables.make(s, ck, { at: 'tote' }); window.ACCESSION.redraw(); return s.items.find(i => i.ck === ck && i.where.at === 'tote').uid; },
    // An item inside the shut case f, or null.
    inside(f) { return (S().items || []).find(i => i.where.at === 'case' && i.where.x === f.x && i.where.y === f.y) || null; },
    // A sleeping plodder three tiles from you along a lane, where the Pin-Driver uid can be
    // fired at it: {x, y} or {why}.
    pinTarget(uid) {
      const s = S(); T.calm();
      const a = T.plodder();
      if (!a) return { why: 'no plodder' };
      for (let k = 0; k < 40; k++) {
        const l = T.lane(4);
        if (!l) return { why: 'no lane' };
        const [x, y] = l.tiles[3];
        Object.assign(a, { x, y, mode: 'dormant', pips: 0 }); a.hp = a.maxHp; window.ACCESSION.redraw();
        if (!Labels.allowed(s, { a: 'use', uid, x, y })) return { why: `the Pin-Driver may not be fired at ${x},${y}` };
        if (spot({ x, y })) return { x, y };
        return { why: `${x},${y} is not on screen` };
      }
      return { why: 'no place' };
    },
    // A sleeping exhibit two tiles from you in a straight line, which the Window Pole uid can
    // both push and pull: {uid, x, y, push, pull} or null (as check-bag stages it).
    poleSpot(uid) {
      const s = S(), m = s.dept, me = s.actors[0]; T.calm();
      const ex = s.actors.filter(a => a.uid !== 'you' && !a.gone && (a.size || 1) === 1 && Archetypes.present(s, a) === null && !Cases.encased(s, a));
      for (const a of ex) for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) for (const d of [0, 2, 4, 6]) {
        const at = k => [x + Grid.DX[d] * k, y + Grid.DY[d] * k], [x1, y1] = at(1), [x2, y2] = at(2), [x3, y3] = at(3);
        if (!free(x, y) || !free(x1, y1) || !(free(x2, y2) || (a.x === x2 && a.y === y2)) || !free(x3, y3)) continue;
        const was = { me: [me.x, me.y], a: [a.x, a.y] };
        T.put(x, y); a.x = x2; a.y = y2; window.ACCESSION.redraw();
        const use = h => ({ a: 'use', uid, x: x2, y: y2, how: h });
        if (Labels.allowed(s, use('push')) && Labels.allowed(s, use('pull')) && spot({ x: x2, y: y2 })) return { uid: a.uid, x: x2, y: y2, push: [x3, y3], pull: [x1, y1] };
        T.put(was.me[0], was.me[1]); a.x = was.a[0]; a.y = was.a[1];
      }
      window.ACCESSION.redraw();
      return null;
    },
    // A shut case holding an item (a Consolidant put in it if it is empty), your grade opening
    // its lock, with two free tiles in a line from it: you are put on the nearer. {x, y, id,
    // back} (back: the step to the farther).
    poleCase() {
      const s = S(); T.calm();
      for (const f of s.dept.fixtures) {
        if (f.k !== 'case' || f.st !== 'shut' || f.mimic) continue;
        for (const d of [0, 2, 4, 6]) {
          const x1 = f.x + Grid.DX[d], y1 = f.y + Grid.DY[d], x2 = f.x + 2 * Grid.DX[d], y2 = f.y + 2 * Grid.DY[d];
          if (!free(x1, y1) || !free(x2, y2)) continue;
          T.put(x1, y1); f.lock = Math.min(f.lock, s.run.grade); window.ACCESSION.redraw();
          if (!Labels.allowed(s, { a: 'open', x: f.x, y: f.y }) || !spot({ x: f.x, y: f.y })) continue;
          if (f.holds === null) { Consumables.make(s, 'consolidant', { at: 'case', x: f.x, y: f.y }); window.ACCESSION.redraw(); }
          return { x: f.x, y: f.y, id: `case:${f.x},${f.y}`, back: d };
        }
      }
      return null;
    },
  };
}

// ---- The scenes ----

export async function playScenes(c) {
  const { page, drv, tag, bad, did, W } = c;
  const ev = () => page.evaluate(() => window.ACCESSION.events.map(e => e.k));
  const now = () => page.evaluate(() => {
    const A = window.ACCESSION, s = A.state, me = s.actors[0], vm = A.vm();
    return { x: me.x, y: me.y, hp: me.hp, maxHp: me.maxHp, tick: s.tick, turn: s.turn, seated: !!me.seated, over: s.over ? s.over.k : null, asking: !!A.asking,
      seed: A.seed, sel: vm.selection, shown: UI.labelShown(), aim: Bag.aiming(), bag: Bag.shown(), top: UI.topLayer(), ev: A.events.map(e => e.k) };
  });
  const stage = (fn, arg) => page.evaluate(fn, arg);
  const sized = async what => { for (const p of [...await page.evaluate(c.layout), ...await page.evaluate(c.targets)]) bad(`${tag} ${what}: ${p}`); };
  const confirmOpen = () => page.evaluate(() => UI.confirmOpen());
  const ok = (cond, yes, no) => { if (cond) did.push(yes); else bad(`${tag}: ${no}`); return !!cond; };
  // The direction from your tile to (x, y) beside it, or −1.
  // A driver's own checks at a moment of a scene (the keyboard's: where the focus is, its ring,
  // no key acting behind a sheet, the aim's keys).
  const hook = async (name, ...args) => { if (drv.extra && drv.extra[name]) await drv.extra[name](c, ...args); };

  // ---- Settings: text size, zoom; "How the museum works"; the Zoom button or key ----
  await drv.settings('text', '1.3');
  ok(await page.evaluate(() => document.documentElement.dataset.text === '1.3'), 'text size set', 'Settings did not set the text size to Largest');
  await sized('Settings at text 1.3');
  await drv.settings('text', '1');
  await drv.settings('zoom', '1');
  ok(await page.evaluate(() => window.ACCESSION.renderer.zoom === 1), 'zoom set in Settings', 'Settings did not set the zoom to Closer');
  await drv.settings('zoom', '0');
  const z0 = await page.evaluate(() => window.ACCESSION.renderer.zoom);
  await drv.zoom();
  const z1 = await page.evaluate(() => window.ACCESSION.renderer.zoom);
  await drv.zoom();
  ok(z1 !== z0 && await page.evaluate(z => window.ACCESSION.renderer.zoom === z, z0), 'zoomed and back', `zoom did not step (${z0} → ${z1})`);
  const how = await drv.how();
  ok(how && how.systems === 9 && how.keys >= 10, 'How the museum works, with its keys', `"How the museum works" showed ${how ? `${how.systems} systems and ${how.keys} keys` : 'nothing'}`);

  // ---- Moving, and attacking by bumping and by the label ----
  const lane = await stage(() => { window.__s.calm(); const l = window.__s.lane(3); window.ACCESSION.redraw(); return l; });
  if (!lane) bad(`${tag}: no lane to walk`);
  else {
    const t0 = await now();
    for (let k = 0; k < 2; k++) await drv.step(lane.d);
    const t1 = await now();
    ok(t1.x === lane.tiles[2][0] && t1.y === lane.tiles[2][1], 'stepped twice', `two steps along the lane left you at ${t1.x},${t1.y}, not ${lane.tiles[2]}`);
    await drv.step((lane.d + 4) % 8);
    const t2 = await now();
    ok(t2.x === lane.tiles[1][0] && t2.y === lane.tiles[1][1] && t2.turn > t0.turn, 'stepped back', `a step back left you at ${t2.x},${t2.y}`);
  }
  const foe = await stage(() => {
    const A = window.ACCESSION, s = A.state, T = window.__s, me = s.actors[0]; T.calm();
    const a = T.plodder(), l = T.lane(2);
    if (!a || !l) return null;
    const [x, y] = l.tiles[1];
    Object.assign(a, { x, y, mode: 'dormant', pips: 0 }); a.hp = a.maxHp; me.hp = me.maxHp;
    A.redraw();
    return { uid: a.uid, x, y, d: l.d };
  });
  if (!foe) bad(`${tag}: no plodder to stage beside you`);
  else {
    const hit = () => page.evaluate(uid => window.ACCESSION.events.some(e => (e.k === 'damaged' || e.k === 'missed') && (e.who === uid || e.at === uid || e.target === uid)), foe.uid);
    // A step key into an exhibit strikes it (§7.1); a pointer's tap on it selects it instead.
    if (drv.bumps) {
      const t0 = await now();
      await drv.step(foe.d);
      const t1 = await now();
      ok(t1.tick !== t0.tick && t1.x === t0.x && t1.y === t0.y && await hit(), 'attacked by bumping', `a step into the plodder did not strike it (${t1.ev.join()})`);
    }
    const heal = () => stage(uid => { const A = window.ACCESSION, a = Actors.byUid(A.state, uid); window.__s.calm(); a.hp = a.maxHp; A.state.actors[0].hp = A.state.actors[0].maxHp; A.redraw(); }, foe.uid);
    await heal();
    if (await drv.select(foe.uid)) {
      await sized('an exhibit\'s label');
      const a0 = await now();
      await drv.first();
      const a1 = await now();
      ok(a1.tick !== a0.tick && await hit(), 'attacked with the first action', `the first action on the selected plodder did not strike it (${a1.ev.join()})`);
      await heal();
      if (await drv.select(foe.uid)) {
        await drv.label('attack');
        const a2 = await now();
        ok(a2.tick !== a1.tick && await hit(), 'attacked with the label\'s Attack', `the label's Attack did not strike the plodder (${a2.ev.join()})`);
      }
    }
    if (drv.extra && drv.extra.tabToLabel) {
      await heal();
      if (await drv.select(foe.uid)) {
        const a3 = await now();
        await drv.extra.tabToLabel('attack');
        const a4 = await now();
        ok(a4.tick !== a3.tick && await hit(), 'Tab to the label\'s Attack and Enter struck', `Tab to the label's Attack and Enter did not strike (${a4.ev.join()})`);
      }
    }
    await drv.escape();
  }
  if (drv.extra && drv.extra.cycle) await drv.extra.cycle(c);

  // ---- A case: open it, take what it held; walk into it ----
  const ca = await stage(() => window.__s.shutCase(true));
  if (!ca) bad(`${tag}: no shut case your grade opens`);
  else if (await drv.select(ca.id)) {
    await sized('a case\'s label');
    await drv.label('open');
    const t = await now();
    ok(t.ev.includes('case_opened'), 'a case opened', `the case's Open did not open it (${t.ev.join()})`);
    const holds = await page.evaluate(id => { const l = Labels.of(window.ACCESSION.state, id); return !!l && l.actions.some(a => a.id === 'take'); }, ca.id);
    if (holds) {
      await drv.label('take');
      const t2 = await now();
      ok(t2.ev.includes('took'), 'took what the case held', `the case's Take did not take it (${t2.ev.join()})`);
    }
    // Opened and empty, it has nothing to do: the first action walks you in, as a tap does.
    await drv.select(ca.id);
    for (let i = 0; i < 2; i++) { const me = await now(); if (me.x === ca.x && me.y === ca.y) break; await drv.first(); }
    const inCase = await now();
    ok(inCase.x === ca.x && inCase.y === ca.y, 'walked into the opened case', `the opened case's first action did not walk you in (you at ${inCase.x},${inCase.y})`);
  }

  // ---- Breaking glass, through its confirmation ----
  const cb = await stage(() => window.__s.shutCase(false));
  if (!cb) bad(`${tag}: no case to break`);
  else if (await drv.select(cb.id)) {
    const t0 = await now();
    await drv.label('bash');
    if (!await confirmOpen()) bad(`${tag}: Break the glass did not ask first`);
    else {
      await sized('the confirmation');
      await hook('focusIn', '#confirm', 'the confirmation');
      await drv.no();
      const t1 = await now();
      ok(!t1.asking && t1.tick === t0.tick && !await confirmOpen(), 'a confirmation cancelled', 'cancelling the break still did something');
      let broke = false;
      for (let i = 0; i < 4 && !broke; i++) {
        if (!await drv.select(cb.id)) break;
        await drv.label('bash');
        if (!await confirmOpen()) { bad(`${tag}: breaking at the glass did not ask first`); break; }
        await drv.yes();
        const t2 = await now();
        if (!t2.ev.includes('glass_cracked') && !t2.ev.includes('glass_broke')) { bad(`${tag}: yes to the break did nothing (${t2.ev.join()})`); break; }
        broke = t2.ev.includes('glass_broke');
      }
      ok(broke, 'broke a case through its confirmation', 'the glass never broke');
    }
  }
  await drv.escape();

  // ---- Shards: a step onto them asks; no, then yes ----
  const sh = await stage(() => {
    const A = window.ACCESSION, s = A.state, T = window.__s, m = s.dept; T.calm();
    const l = T.lane(2);
    if (!l) return null;
    const [x, y] = l.tiles[1];
    Grid.set(m, x, y, 'x'); A.redraw();
    return { x, y, d: l.d };
  });
  if (!sh) bad(`${tag}: no tile for shards`);
  else {
    const t0 = await now();
    await drv.step(sh.d);
    if (!await confirmOpen()) bad(`${tag}: a step onto shards did not ask first`);
    else {
      await drv.no();
      const t1 = await now();
      if (t1.x !== t0.x || t1.y !== t0.y || t1.tick !== t0.tick) bad(`${tag}: no to the shards still stepped`);
      await drv.step(sh.d);
      await drv.yes();
      const t2 = await now();
      ok(t2.x === sh.x && t2.y === sh.y, 'stepped onto shards through the confirmation', 'yes did not step onto the shards');
    }
  }

  // ---- A beam marked through your tile: a wait asks; a step off goes ----
  const bm = await stage(() => {
    const A = window.ACCESSION, s = A.state, T = window.__s, me = s.actors[0]; T.calm();
    const sn = s.actors.find(a => a.arch === 'axis_sniper' && !a.gone);
    if (!sn) return { why: 'no axis_sniper' };
    for (const d of [6, 2, 0, 4]) for (let r = 3; r <= 6; r++) {
      const x = sn.x + Grid.DX[d] * r, y = sn.y + Grid.DY[d] * r;
      if (!T.free(x, y)) continue;
      T.put(x, y);
      Object.assign(sn, { mode: 'hunting', sawYou: true, lastKnown: [x, y], stim: s.turn, telegraph: null });
      const tiles = Specials.tiles(s, sn, 'line'), on = (tx, ty) => tiles.some(([p, q]) => p === tx && q === ty);
      if (!on(x, y) || !Specials.canMark(s, sn, 'line', tiles)) continue;
      let off = -1;
      for (const k of [0, 2, 4, 6]) if (T.free(x + Grid.DX[k], y + Grid.DY[k]) && !on(x + Grid.DX[k], y + Grid.DY[k])) { off = k; break; }
      if (off < 0) continue;
      sn.next = me.next;
      Specials.mark(s, sn, 'line', tiles, []);
      A.redraw();
      return { x, y, off };
    }
    sn.mode = 'dormant';
    return { why: 'no tile in the sniper\'s line' };
  });
  if (bm.why) bad(`${tag}: could not stage a beam: ${bm.why}`);
  else {
    const t0 = await now();
    await drv.wait();
    if (!await confirmOpen()) bad(`${tag}: a wait on the beam's tile did not ask first`);
    else await drv.no();
    if ((await now()).tick !== t0.tick) bad(`${tag}: the cancelled wait on the beam took time`);
    await drv.step(bm.off);
    const t1 = await now();
    ok(!await confirmOpen() && (t1.x !== bm.x || t1.y !== bm.y) && t1.hp === t0.hp, 'stepped off a beam', `the step off the beam ${await confirmOpen() ? 'asked' : 'did not go'} (you at ${t1.x},${t1.y}, ${t0.hp} → ${t1.hp})`);
  }
  await stage(() => { window.__s.calm(); window.ACCESSION.redraw(); });

  // ---- An item on the floor: select it, take it ----
  const it = await page.evaluate(`(() => { const A = window.ACCESSION, s = A.state, T = window.__s, spot = window.__spot; T.calm();
    for (const i of s.items) { if (i.where.at !== 'floor') continue; const t = T.beside(i.where.x, i.where.y); if (!t) continue; T.put(t[0], t[1]); A.redraw();
      if (spot({ x: i.where.x, y: i.where.y })) return { uid: i.uid, id: 'item:' + i.uid }; } return null; })()`);
  if (!it) bad(`${tag}: no floor item to take`);
  else if (await drv.select(it.id)) {
    await drv.label('take');
    const where = await page.evaluate(uid => window.ACCESSION.state.items.find(i => i.uid === uid).where.at, it.uid);
    ok(where === 'tote', 'took an item from the floor', `Take left the item ${where}`);
  }

  // ---- An identifying label: select it, read it ----
  const pl = await page.evaluate(`(() => { const A = window.ACCESSION, s = A.state, T = window.__s, spot = window.__spot; T.calm();
    for (const f of s.dept.fixtures) { if (f.k !== 'plaque' || Consumables.known(s, f.ck)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (!T.free(f.x + dx, f.y + dy)) continue; T.put(f.x + dx, f.y + dy);
        if (!Labels.allowed(s, { a: 'read', x: f.x, y: f.y })) continue; A.redraw(); if (spot({ x: f.x, y: f.y })) return { id: 'plaque:' + f.x + ',' + f.y }; } } return null; })()`);
  if (!pl) bad(`${tag}: no identifying label to read`);
  else if (await drv.select(pl.id)) {
    await drv.label('read');
    ok((await ev()).includes('identified'), 'read an identifying label', 'Read did not identify the label\'s kind');
  }

  // ---- A staff door: open it (a step into it), then close it ----
  const sd = await page.evaluate(`(() => { const A = window.ACCESSION, s = A.state, T = window.__s, spot = window.__spot; T.calm();
    for (const f of s.dept.fixtures) { if (f.k !== 'staff' || Grid.ch(s.dept, f.x, f.y) !== 'S') continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = f.x + dx, y = f.y + dy; if (!T.free(x, y)) continue; T.put(x, y);
        f.grade = Math.min(f.grade, s.run.grade); A.redraw(); if (!spot({ x: f.x, y: f.y })) continue; return { id: 'staff:' + f.x + ',' + f.y, x: f.x, y: f.y }; } } return null; })()`);
  if (!sd) bad(`${tag}: no staff door to open`);
  else if (await drv.select(sd.id)) {
    await drv.label('open');
    const opened = await page.evaluate(d => Grid.ch(window.ACCESSION.state.dept, d.x, d.y) === 's', sd);
    if (ok(opened, 'opened a staff door', `Open did not open the staff door (${(await ev()).join()})`)) {
      await stage(() => { window.__s.calm(); window.ACCESSION.redraw(); });
      if (await drv.select(sd.id)) {
        await drv.label('close');
        const shut = await page.evaluate(d => Grid.ch(window.ACCESSION.state.dept, d.x, d.y) === 'S', sd);
        ok(shut, 'closed a staff door', `Close did not close the staff door (${(await ev()).join()})`);
      }
    }
  }
  await drv.escape();

  // ---- Sit on a bench; rest until healed; wait ----
  const bench = await stage(() => {
    const A = window.ACCESSION, s = A.state, T = window.__s, m = s.dept, me = s.actors[0]; T.calm();
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Grid.ch(m, x, y) === 'b' && !Actors.at(s, x, y)) { T.put(x, y); me.hp = me.maxHp - 1; A.redraw(); return { x, y }; }
    return null;
  });
  if (!bench) bad(`${tag}: no bench`);
  else {
    await drv.sit();
    const t1 = await now();
    ok(t1.seated, 'sat on a bench', 'Sit did not seat you');
    await drv.rest();
    const t2 = await now(), why = await page.evaluate(() => window.ACCESSION.stopWhy);
    ok(t2.hp === t2.maxHp && why === 'rested' && t2.turn - t1.turn >= 2, `rested ${t2.turn - t1.turn} turns to full health`, `Rest stopped at ${t2.hp}/${t2.maxHp} after ${t2.turn - t1.turn} turns (${why})`);
    await drv.wait();
    ok((await ev()).includes('waited') || (await now()).turn > t2.turn, 'waited', 'Wait did not wait');
  }
  await drv.escape();

  // ---- The Bag: equip, take off, drop; drink; throw (aimed); a Catalogue Card's choice; a
  // Floor Plan and the floor plan ----
  const made = await stage(() => {
    const s = window.ACCESSION.state; window.__s.calm();
    const w = Kit.make(s, { kind: 'weapon', form: 'light', tier: 1 }, { at: 'tote' });
    window.ACCESSION.redraw();
    return { w: w.uid };
  });
  await drv.bag();
  ok(await page.evaluate(() => Bag.shown() === 'bag'), 'the Bag opened', 'the Bag did not open');
  await sized('the Bag');
  await drv.bagItem(made.w);
  await sized('an item in the Bag');
  await drv.bagAct('equip');
  ok(await page.evaluate(w => window.ACCESSION.state.you.kit.weapon === w, made.w), 'equipped', 'Equip did not put the Light weapon on');
  // The weapon slot is never empty (§8.5): the first weapon goes back on, and the Light one
  // into the tote, then onto the floor; the garment is taken off and put on again.
  await drv.bag(); await drv.bagItem('you.w'); await drv.bagAct('equip');
  ok(await page.evaluate(w => window.ACCESSION.state.you.kit.weapon === 'you.w' && window.ACCESSION.state.you.tote.includes(w), made.w), 'equipped the first weapon again', 'the first weapon is not worn again');
  await drv.bag(); await drv.bagItem(made.w); await drv.bagAct('drop');
  ok(await page.evaluate(w => window.ACCESSION.state.items.find(i => i.uid === w).where.at === 'floor', made.w), 'dropped it', 'Drop did not put the Light weapon on the floor');
  await drv.bag(); await drv.bagItem('you.g'); await drv.bagAct('unequip');
  ok(await page.evaluate(() => !window.ACCESSION.state.you.kit.garment && window.ACCESSION.state.you.tote.includes('you.g')), 'took the garment off', 'Take off did not put the garment in your tote');
  await drv.bag(); await drv.bagItem('you.g'); await drv.bagAct('equip');
  ok(await page.evaluate(() => window.ACCESSION.state.you.kit.garment === 'you.g'), 'put the garment on again', 'Equip did not put the garment on again');

  const c1 = await stage(() => { const s = window.ACCESSION.state; s.actors[0].hp = s.actors[0].maxHp - 8; return window.__s.make('consolidant'); });
  const h0 = (await now()).hp;
  await drv.bag(); await drv.bagItem(c1); await drv.bagAct('use');
  const h1 = await now();
  ok(h1.ev.includes('healed') && h1.hp > h0, `drank (${h0} → ${h1.hp})`, `Drink did not heal (${h1.ev.join()})`);

  const c2 = await stage(() => { window.__s.calm(); return window.__s.make('consolidant'); });
  await drv.bag(); await drv.bagItem(c2); await drv.bagAct('throw');
  if (!ok(await page.evaluate(() => { const a = Bag.aiming(); return !!a && a.kind === 'throw'; }), 'Throw… aims', 'Throw… did not start aiming')) { /* nothing to aim */ }
  else {
    await sized('aiming');
    const th = await page.evaluate(`window.__s.target(Consumables.targets(window.ACCESSION.state, ${JSON.stringify(c2)}), 3, 5)`);
    if (!th) bad(`${tag}: no tile 3 to 5 away to throw at`);
    else {
      const t0 = await now();
      await drv.aimAt(th);
      const p = await now(), marked = await page.evaluate(t => window.ACCESSION.vm().marks.some(k => k.kind === 'aim' && k.x === t.x && k.y === t.y), th);
      ok(p.tick === t0.tick && p.aim && p.aim.x === th.x && p.aim.y === th.y && marked, 'previewed the throw', `aiming did not preview ${th.x},${th.y} (${JSON.stringify(p.aim)})`);
      await drv.commit(th);
      const t1 = await now();
      ok(await page.evaluate(() => window.ACCESSION.events.some(e => e.k === 'used' && e.how === 'throw')) && !t1.aim, 'threw it', `the throw did not go (${t1.ev.join()})`);
    }
  }
  await drv.cancelAim();

  const card = await stage(() => window.__s.make('card'));
  await drv.bag(); await drv.bagItem(card); await drv.bagAct('use');
  const ch = await page.evaluate(() => ({ pending: window.ACCESSION.vm().pending, shown: document.querySelectorAll('#bag.open [data-choose]').length }));
  if (!ch.pending || !ch.shown) bad(`${tag}: reading the Catalogue Card did not show its choice (${JSON.stringify(ch)})`);
  else {
    await sized('the Card\'s choice');
    await hook('focusIn', '#bag', 'the Card\'s choice');
    await drv.closeBag();
    const t0 = await now();
    await drv.wait();
    const back = await now();
    ok(back.bag === 'bag' && back.tick === t0.tick && await page.evaluate(() => document.querySelectorAll('#bag.open [data-choose]').length > 0), 'the Card\'s choice came back', 'with the choice closed, another action did not bring it back');
    const seal = ch.pending.options[0];
    await drv.choose(0);
    ok(await page.evaluate(sl => window.ACCESSION.state.run.knownSeals.includes(sl) && !window.ACCESSION.vm().pending, seal), 'answered the Card\'s choice', 'choosing a seal did not identify it');
  }
  await drv.closeBag();

  const plan = await stage(() => window.__s.make('plan'));
  await drv.bag(); await drv.bagItem(plan); await drv.bagAct('use');
  ok(await page.evaluate(() => !!window.ACCESSION.vm().plan), 'read a Floor Plan', 'reading the Floor Plan did nothing');
  await drv.map();
  const mp = await page.evaluate(() => ({ open: Bag.shown() === 'map', canvas: !!document.querySelector('#bag.open canvas.bag-map'), say: (document.querySelector('#bag .map-say') || {}).textContent || '' }));
  ok(mp.open && mp.canvas && /Room/.test(mp.say), 'the floor plan', `the floor plan did not show (${JSON.stringify(mp)})`);
  await sized('the floor plan');
  await drv.closeBag();

  // ---- The quickslots: a consumable's shows it in the Bag ----
  const c3 = await stage(() => window.__s.make('consolidant'));
  const slot = await page.evaluate(([uid, sel]) => { const b = document.querySelector(`${sel} [data-uid="${uid}"]`); return b ? Number(b.dataset.act.slice(1)) : 0; }, [c3, W < 900 ? '#barslots' : '#slots']);
  if (!slot) bad(`${tag}: the Consolidant has no quickslot`);
  else {
    await drv.quick(slot);
    ok(await page.evaluate(() => Bag.shown() === 'bag' && !!document.querySelector('#bag.open [data-do]')), `quickslot ${slot} showed its consumable in the Bag`, `quickslot ${slot} did not show the Consolidant in the Bag`);
    await drv.closeBag();
  }

  // ---- Instruments: the fork, the Pin-Driver and the Window Pole, each aimed at a tile ----
  const equip = async (spec, what) => {
    const uid = await stage(spec => { const s = window.ACCESSION.state, it = Kit.make(s, spec, { at: 'tote' }); window.__s.calm(); window.ACCESSION.redraw(); return it.uid; }, spec);
    await drv.bag(); await drv.bagItem(uid); await drv.bagAct('equip');
    if (!await page.evaluate(u => window.ACCESSION.state.you.kit.instrument === u, uid)) { bad(`${tag}: Equip did not put on the ${what}`); return null; }
    return uid;
  };
  const F = await equip({ kind: 'instrument', instrument: 'fork', tier: 1 }, 'Tuning Fork');
  if (F) {
    await hook('aimKeys', F);
    await drv.quick(1);
    const ft = await page.evaluate(`window.__s.target(Kit.targets(window.ACCESSION.state, ${JSON.stringify(F)}), 3, 6)`);
    if (!(await now()).aim || !ft) bad(`${tag}: quickslot 1 did not aim the fork at a tile in view`);
    else {
      await drv.aimAt(ft); await drv.commit(ft);
      ok(await page.evaluate(t => window.ACCESSION.events.some(e => e.k === 'noise' && e.x === t.x && e.y === t.y && e.cause.k === 'fork'), ft), 'struck the fork at a tile', `the fork did not strike at ${ft.x},${ft.y}`);
    }
    await drv.cancelAim();
  }
  const PD = await equip({ kind: 'instrument', instrument: 'pin_driver', tier: 1 }, 'Pin-Driver');
  if (PD) {
    const tg = await stage(uid => window.__s.pinTarget(uid), PD);
    if (tg.why) bad(`${tag}: no exhibit to stage in the Pin-Driver's reach: ${tg.why}`);
    else {
      await drv.quick(1);
      await drv.aimAt(tg); await drv.commit(tg);
      ok(await page.evaluate(() => window.ACCESSION.events.some(e => e.k === 'used' && e.how === 'pin_driver')), 'fired the Pin-Driver', `the Pin-Driver did not fire (${(await ev()).join()})`);
    }
    await drv.cancelAim();
  }
  const PL = await equip({ kind: 'instrument', instrument: 'pole', tier: 1 }, 'Window Pole');
  if (PL) {
    for (const how of ['push', 'pull']) {
      const ex = await stage(uid => window.__s.poleSpot(uid), PL);
      if (!ex) { bad(`${tag}: no place to stage the pole's ${how}`); break; }
      await drv.quick(1);
      await drv.aimAt(ex); await drv.commit(ex);
      const sheet = await page.evaluate(() => [...document.querySelectorAll('#bagpick.open [data-how]')].map(b => b.dataset.how).join());
      if (sheet !== 'push,pull') { bad(`${tag}: the pole's sheet offers ${sheet || 'nothing'}`); await drv.cancelAim(); continue; }
      if (how === 'push') {
        await sized('the pole\'s sheet');
        await hook('focusIn', '#bagpick', 'the pole\'s sheet');
        await hook('behind', 'the pole\'s sheet');
        // Cancelled, the sheet goes and the aim stays; a second commit asks again.
        await drv.cancelPick();
        const k = await now();
        ok(k.top !== 'bagpick' && k.aim && k.aim.x === ex.x, 'the pole\'s sheet cancelled, its aim kept', `cancelling the pole's sheet left ${k.top} open and the aim ${JSON.stringify(k.aim)}`);
        await drv.commit(ex);
      }
      await drv.pick(how);
      const moved = await page.evaluate(uid => { const a = Actors.byUid(window.ACCESSION.state, uid); return [a.x, a.y]; }, ex.uid);
      ok(moved[0] === ex[how][0] && moved[1] === ex[how][1], `the pole: ${how}`, `the pole's ${how} left the exhibit at ${moved}, not ${ex[how]}`);
      await drv.cancelAim();
    }
    // The pole's take: an opened case holding its object, two tiles away.
    const pt = await stage(() => window.__s.poleCase());
    if (!pt) bad(`${tag}: no case to open for the pole's take`);
    else if (await drv.select(pt.id)) {
      await drv.label('open');
      await drv.step(pt.back);
      await stage(() => { window.__s.calm(); window.ACCESSION.redraw(); });
      await drv.quick(1);
      await drv.aimAt(pt); await drv.commit(pt);
      if (await page.evaluate(() => UI.topLayer() === 'bagpick')) await drv.pick('take');
      ok(await page.evaluate(() => window.ACCESSION.events.some(e => e.k === 'used' && e.how === 'take')), 'the pole: take', `the pole did not take from the opened case (${(await ev()).join()})`);
      await drv.cancelAim();
    }
  }

  // ---- A Restoration kit on what you wear ----
  const K = await stage(() => { const s = window.ACCESSION.state, it = Kit.make(s, { kind: 'kit' }, { at: 'tote' }); window.ACCESSION.redraw(); return it.uid; });
  await drv.bag(); await drv.bagItem(K); await drv.bagAct('restore');
  if (!await page.evaluate(() => !!document.querySelector('#bag.open [data-on="you.g"]'))) bad(`${tag}: the kit's items do not list the garment you wear`);
  else {
    await sized('the kit\'s items');
    await hook('focusIn', '#bag', 'the kit\'s items');
    await drv.restoreOn('you.g');
    const gain = await page.evaluate(() => (document.querySelector('#bag [data-on="you.g"] .bag-gain') || {}).textContent || '');
    await drv.restoreOn('you.g');
    ok(/→/.test(gain) && await page.evaluate(() => window.ACCESSION.events.some(e => e.k === 'used' && e.how === 'restore')), 'used a kit on the garment', `the kit was not used on the garment (gain "${gain}")`);
  }
  await drv.closeBag();

  if (drv.extra && drv.extra.layers) await drv.extra.layers(c);

  // ---- Leaving: walk to an exit, Leave, yes; the end of the visit; "Another visit" ----
  const ex = await stage(() => {
    const A = window.ACCESSION, s = A.state, T = window.__s; T.calm();
    for (const [x, y] of s.dept.exits) for (let r = 2; r <= 3; r++) for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0]]) {
      if (!T.free(x + dx, y + dy)) continue;
      T.put(x + dx, y + dy); A.redraw();
      const vm = A.vm(), p = Path.to(s, x, y);
      if (vm.vis[y * vm.w + x] === 2 && p.length && p.length <= 4 && p.every(([px, py]) => !Grid.TILES[Grid.ch(s.dept, px, py)].loud)) return { x, y };
    }
    return null;
  });
  if (!ex) bad(`${tag}: no exit to walk to`);
  else {
    await drv.walkTo(ex);
    const t0 = await now();
    if (!ok(t0.x === ex.x && t0.y === ex.y, 'walked to an exit', `the walk to the exit stopped at ${t0.x},${t0.y}`)) { /* */ }
    else {
      await drv.leave();
      if (!await confirmOpen()) bad(`${tag}: Leave did not ask first`);
      else {
        await drv.yes();
        const t1 = await now(), end = await page.evaluate(() => ({ open: UI.endOpen(), lines: [...document.querySelectorAll('#end.open .recap p')].map(p => p.textContent).join(' ') }));
        if (ok(t1.over === 'left' && end.open && end.lines, 'left: the end of the visit shown', `leaving did not end the visit with its sentence (${t1.over}, ${JSON.stringify(end)})`)) {
          await sized('the end of a visit');
          await hook('focusIn', '#end', 'the end of the visit');
          await drv.another();
          const t2 = await now();
          ok(!t2.over && t2.seed === t1.seed + 1 && t2.turn === 0 && !await page.evaluate(() => UI.endOpen()), 'another visit', '"Another visit" did not start a new visit');
        }
      }
    }
  }

  // ---- A death: the recap, closed and shown again, then "Another visit" ----
  const dz = await stage(() => {
    const A = window.ACCESSION, s = A.state, T = window.__s, me = s.actors[0]; T.calm();
    const a = T.plodder(), l = T.lane(2);
    if (!a || !l) return null;
    const [x, y] = l.tiles[1];
    Object.assign(a, { x, y, mode: 'hunting', sawYou: true, lastKnown: [me.x, me.y], stim: s.turn, acc: 40, next: me.next });
    me.hp = 1; A.redraw();
    return a.uid;
  });
  if (!dz) bad(`${tag}: no plodder to stage a death with`);
  else {
    for (let i = 0; i < 12 && !(await now()).over; i++) await drv.wait();
    const t1 = await now();
    if (!ok(t1.over === 'died', 'died', 'twelve waits beside a hunter at 1 health did not end in a death')) { /* */ }
    else {
      const recap = await page.evaluate(() => { const A = window.ACCESSION, r = Text.recap(A.state, Labels.nameOf(A.state)); return { want: r ? r.lines : [], shown: [...document.querySelectorAll('#end.open .recap p')].map(p => p.textContent) }; });
      ok(recap.want.length && JSON.stringify(recap.want) === JSON.stringify(recap.shown), 'the recap shown', `the recap does not show Text.recap's lines (${recap.shown.join(' | ')})`);
      await sized('the recap');
      await hook('focusIn', '#end', 'the recap');
      await drv.closeEnd();
      const closed = !await page.evaluate(() => UI.endOpen());
      await drv.reopenEnd();
      ok(closed && await page.evaluate(() => UI.endOpen()), 'the recap closed and shown again', 'the recap could not be closed and shown again');
      await drv.another();
      const t2 = await now();
      ok(!t2.over && t2.seed === t1.seed + 1, 'another visit after a death', '"Another visit" after the death did not start a new visit');
    }
  }
}

// ---- The pointer's driver: taps on a touch screen (check-touch) or left clicks (check-play) ----
// hit(x, y) is the one input: page.touchscreen.tap or page.mouse.click. Everything is pressed
// where a player sees it (seenAt, spotOf); a control the phone's label sheet hides is reached
// by closing the sheet first, as a player would.
export function pointerDriver(page, tag, bad, hit, W) {
  const settle = () => page.waitForFunction(() => !window.ACCESSION.busy() && document.querySelectorAll('#board canvas').length > 0);
  // After a tap the browser may still send the click it makes of it: two frames go by, so
  // that anything it brings is handled before the page is read.
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const tapAt = async p => { await hit(p.x, p.y); await frames(); await settle(); };
  const tapSel = async (sel, what) => { const p = await page.evaluate(seenAt, sel); if (!p) { bad(`${tag}: ${what || sel} is not on screen to tap`); return false; } await tapAt(p); return true; };
  const tapTile = async (q, what) => { const p = await page.evaluate(spotOf, q); if (!p) { bad(`${tag}: ${what} has no point on the board to tap`); return false; } await tapAt(p); return true; };
  const read = () => page.evaluate(() => ({ sel: window.ACCESSION.vm().selection, shown: UI.labelShown() }));
  const uncover = async sel => { if (!await page.evaluate(seenAt, sel) && await page.evaluate(() => !!UI.labelShown())) await tapSel('#sheet [data-close]', 'the label\'s Close'); };
  // Where to tap to select a thing: an exhibit or you by its sprite, anything else by its tile.
  const where = id => page.evaluate(id => {
    const s = window.ACCESSION.state, f = /^(case|plaque|staff|exit):(-?\d+),(-?\d+)$/.exec(id);
    if (f) return { x: Number(f[2]), y: Number(f[3]) };
    if (id.startsWith('item:')) { const it = s.items.find(i => i.uid === id.slice(5)); return it && it.where.at === 'floor' ? { x: it.where.x, y: it.where.y } : null; }
    return { uid: id };
  }, id);
  const d = {
    async settings(key, value) { await tapSel('#setbtn', 'Settings'); await tapSel(`#settings [data-set="${key}"][data-value="${value}"]`, `the ${key} ${value}`); await tapSel('#settings [data-close]', 'Settings\' Close'); },
    async how() {
      await tapSel('#howbtn', '"How the museum works"');
      const info = await page.evaluate(() => ({ systems: document.querySelectorAll('#how.open .systems li').length, keys: document.querySelectorAll('#how.open .keytable tr').length }));
      await tapSel('#how [data-close]', 'its Close');
      return info;
    },
    async zoom() { await uncover('#zoombtn'); await tapSel('#zoombtn', 'Zoom'); },
    async step(dir) { const me = await page.evaluate(() => { const a = window.ACCESSION.state.actors[0]; return { x: a.x, y: a.y }; }); await tapTile({ x: me.x + [0, 1, 1, 1, 0, -1, -1, -1][dir], y: me.y + [-1, -1, 0, 1, 1, 1, 0, -1][dir] }, 'the tile beside you'); },
    // A tap selects a thing and shows its label; a tap on the thing selected acts, so one whose
    // label was closed is first let go of (a tap on yourself, or for you on the strip).
    async select(id) {
      let r = await read();
      if (r.sel === id && r.shown === id) return true;
      if (r.sel === id) { if (id === 'you') await tapSel('#strip', 'the strip'); else await tapTile({ uid: 'you' }, 'you'); r = await read(); }
      if (r.sel === id) { bad(`${tag}: could not let go of ${id} to select it again`); return false; }
      const q = await where(id);
      if (!q || !await tapTile(q, id)) return false;
      r = await read();
      if (r.sel !== id || r.shown !== id) { bad(`${tag}: a tap on ${id} selected ${r.sel} (label ${r.shown})`); return false; }
      return true;
    },
    async label(id) { await tapSel(`#sheet [data-label-act="${id}"]`, `the label's ${id}`); },
    async first() { const r = await read(), q = r.sel && await where(r.sel); if (q) await tapTile(q, `the selected ${r.sel}`); },
    async yes() { await tapSel('#confirm.open .yes', 'the confirmation\'s yes'); },
    async no() { await tapSel('#confirm.open [data-confirm="no"]', 'Cancel'); },
    async wait() { await uncover('#bar [data-act="wait"]'); await tapSel('#bar [data-act="wait"]', 'Wait'); },
    async rest() { if (await d.select('you')) await d.label('rest'); },
    async sit() { if (await d.select('you')) await d.label('sit'); },
    async leave() { if (await d.select('you')) await d.label('leave'); },
    async escape() { if (await page.evaluate(() => !!UI.labelShown() && !!document.querySelector('#sheet [data-close]'))) await tapSel('#sheet [data-close]', 'the label\'s Close'); },
    async bag() { await uncover('#bar [data-act="bag"]'); await tapSel('#bar [data-act="bag"]', 'Bag'); },
    async bagItem(uid) { await tapSel(`#bag.open [data-item="${uid}"]`, `${uid} in the Bag`); },
    async bagAct(id) { await tapSel(`#bag.open [data-action="${id}"]`, `the Bag's ${id}`); },
    async closeBag() { if (await page.evaluate(() => !!Bag.shown())) await tapSel('#bag.open [data-close]', 'the Bag\'s Close'); },
    async map() { await uncover('#bar [data-act="map"]'); await tapSel('#bar [data-act="map"]', 'Map'); },
    async quick(n) { const sel = `${W < 900 ? '#barslots' : '#slots'} [data-act="q${n}"]`; await uncover(sel); await tapSel(sel, `quickslot ${n}`); },
    async aimAt(t) { await tapTile(t, 'the tile to aim at'); },
    async commit(t) { await tapTile(t, 'the aimed tile'); },
    async cancelAim() { if (await page.evaluate(() => { const a = Bag.aiming(); return !!a && a.kind !== 'item'; })) await tapSel('#bagaim.open [data-aim-cancel]', 'the aim\'s Cancel'); },
    async cancelPick() { await tapSel('#bagpick.open [data-pick-cancel]', 'the pole\'s Cancel'); },
    async pick(how) { await tapSel(`#bagpick.open [data-how="${how}"]`, `the pole's ${how}`); },
    async choose(i) { await tapSel(`#bag.open [data-choose="${i}"]`, `seal ${i}`); },
    async restoreOn(uid) { await tapSel(`#bag.open [data-on="${uid}"]`, `${uid} in the kit's list`); },
    async walkTo(t) { await tapTile(t, 'the exit'); },
    async another() { await tapSel('#end.open [data-another]', '"Another visit"'); },
    async closeEnd() { await tapSel('#end.open [data-close]', 'the end\'s Close'); },
    async reopenEnd() { const me = await page.evaluate(() => { const a = window.ACCESSION.state.actors[0]; return { x: a.x, y: a.y }; }); await tapTile(me, 'the board'); },
  };
  return d;
}
