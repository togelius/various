'use strict';
// The percept-only bots' one window on the game (DESIGN §18.8 G3). A bot (tools/bots/<name>.cjs, linted by
// tools/bots/lint.cjs) is given only percepts: CS.display(), cut down here to what is visible on the screen (polygons,
// points and boxes in CSS px, colours, dashes, the words drawn), never the game's state or the rules' answers. It acts
// only by returning actions, which this harness turns into real input through the browser:
//   {move: [x, y], wait?} the pointer there (a finger: put down the first time, then moved), then `wait` s pass
//   {release: true, at?: [x, y], meta?}  let go (a click; the finger lifted, moved to `at` first)
//   {tap: [x, y]}         a click or a tap
//   {key: 'Enter'}        a key press
//   {wait: s}             time passes (the ?drive clock is stepped s seconds)
// After each action the bot gets the next frame's percept. The harness alone may read the game, and only to audit the
// bot afterwards (what each release really was), never to tell the bot anything.

const pick = (o, keys) => { if (!o) return null; const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };
// the display list as seen: what is drawn, not what it means to the game
function percept(d) {
  const g = d.ghost;
  return {
    w: d.w, h: d.h,
    car: d.car && { top: d.car.top, wheels: d.car.wheels },
    tiles: d.tiles.map(t => ({ poly: t.poly, color: t.color })),
    gaps: d.gaps || [],
    ghost: g && g.poly ? {
      poly: g.poly, color: g.color, dashed: !!g.dashed,
      column: g.column && pick(g.column, ['x0', 'x1', 'y0', 'y1']),
      shine: g.shine || [], chip: g.chip || null,
      label: g.reasonLabel ? g.reasonLabel.text : null,
      callout: g.callout ? g.callout.text : null,
      marks: g.marks ? { dots: g.marks.dots || [], part: g.marks.part || [], pivot: g.marks.pivot || null, plumb: g.marks.plumb || null } : null,
      gaps: g.ghostGaps ? g.ghostGaps.polys : [],
    } : null,
    markers: d.markers.map(m => ({ kind: m.kind, pts: m.pts })),
    ticks: d.ticks.map(t => ({ pts: t.pts })),
    falling: d.falling.map(f => ({ x: f.x, y: f.y, rot: f.rot, piece: f.piece, tinted: f.outcome === 'off' && f.stage !== 'fall' })),
    weight: d.weight && { x: d.weight.x, y: d.weight.y, zone: d.weight.zone, pinned: d.weight.pinned, strip: d.weight.strip, label: d.weight.label ? d.weight.label.text : null },
    ghostWeight: d.ghostWeight && { x: d.ghostWeight.x, color: d.ghostWeight.color },
    hand: d.hand && { x: d.hand.x, y: d.hand.y, poly: d.hand.poly, piece: d.hand.piece, way: d.hand.way || null, red: !!d.hand.red, ready: !!d.hand.ready, turning: !!d.hand.turning, color: d.hand.color },
    fuse: d.fuse && pick(d.fuse, ['u', 'x', 'y', 'r']),
    next: d.next && pick(d.next, ['piece', 'topper', 'color']),
    counter: d.counter && { text: d.counter.text },
    hint: d.hint && { text: d.hint.text, box: d.hint.box },
    swap: d.swap && pick(d.swap, ['text', 'x', 'y']),
    results: d.results && { lines: d.results.lines },
    buttons: (d.buttons || []).map(b => ({ text: b.text, disabled: !!b.disabled, box: b.box })),
  };
}
// a read: the frame the input brought (the ?drive clock draws a frame when input comes; it is drawn here at once
// rather than at the next animation frame), its display list, and, for the audit only, the game's last release
const NEXT_FRAME = () => { CS.render(); return [CS.display(), CS.lastRelease ? CS.lastRelease.id : 0]; };

// Run a bot on an open game (tools/g3lib.cjs open: page, input) until it says it is done or maxActions. Returns its
// report and the harness's audit of its releases.
async function run(g, botModule, opts) {
  opts = opts || {};
  const { page, input } = g;
  const bot = botModule.create(Object.assign({ w: g.size.w, h: g.size.h, touch: input.touch }, opts.bot || {}));
  const audit = { releases: [], fuse: 0, reads: 0, actions: 0 };
  const handCol = [];
  let lastAction = null;
  let [raw, rid] = await page.evaluate(() => [CS.display(), CS.lastRelease ? CS.lastRelease.id : 0]);
  let lastId = rid;
  const t0 = Date.now();
  for (let n = 0; n < (opts.maxActions || 1e7); n++) {
    if (opts.stopBefore && opts.stopBefore(raw, audit, lastAction)) break;
    handCol.push(raw.hand ? raw.hand.col : null);
    audit.reads++;
    const a = bot.act(percept(raw));
    if (!a || a.done) break;
    lastAction = a;
    audit.actions++;
    if (a.move) {
      await input.aim(a.move[0], a.move[1]);
      // (a move and a look: the pointer there, then time passes)
      if (a.wait !== undefined) [raw, rid] = await page.evaluate(t => { CS.wait(t); return [CS.display(), CS.lastRelease ? CS.lastRelease.id : 0]; }, a.wait);
      else [raw, rid] = await page.evaluate(NEXT_FRAME);
    }
    else if (a.release) {
      if (a.at) await input.release(a.at[0], a.at[1]); else await input.release();
      [raw, rid] = await page.evaluate(NEXT_FRAME);
      const rel = rid !== lastId ? await page.evaluate(() => CS.lastRelease) : null;
      if (rel && rel.id !== lastId) {
        const look = a.meta && typeof a.meta.read === 'number' ? handCol[a.meta.read] : undefined;
        audit.releases.push({ id: rel.id, key: rel.key, outcome: rel.outcome, piece: rel.piece, handCol: rel.handCol, src: rel.src, meta: a.meta || null, lookCol: look });
        lastId = rel.id;
      } else audit.releases.push({ id: 0, meta: a.meta || null, none: true });
    } else if (a.tap) { await input.tap(a.tap[0], a.tap[1]); [raw, rid] = await page.evaluate(NEXT_FRAME); }
    else if (a.key) { await input.key(a.key); [raw, rid] = await page.evaluate(NEXT_FRAME); }
    else if (a.wait !== undefined) [raw, rid] = await page.evaluate(t => { CS.wait(t); return [CS.display(), CS.lastRelease ? CS.lastRelease.id : 0]; }, a.wait);
    else [raw, rid] = await page.evaluate(NEXT_FRAME);
    // (a release the bot did not make: the fuse let go)
    if (!a.release && rid !== lastId) {
      const rel = await page.evaluate(() => CS.lastRelease);
      if (rel && rel.id !== lastId) { lastId = rel.id; audit.fuse++; audit.releases.push({ id: rel.id, key: rel.key, outcome: rel.outcome, piece: rel.piece, handCol: rel.handCol, src: rel.src, meta: null, byFuse: true }); }
    }
  }
  // what became of each release (the game's own log, for the audit)
  const ev = await page.evaluate(() => CS.events.filter(e => e.type === 'land' || e.type === 'off').map(e => [e.type, e.id, e.key]));
  const byId = new Map(ev.map(e => [e[1], e]));
  for (const r of audit.releases) { const e = byId.get(r.id); r.became = e ? e[0] : null; r.landKey = e ? e[2] : null; }
  audit.ms = Date.now() - t0;
  return { report: bot.report(), audit };
}

module.exports = { run, percept };
