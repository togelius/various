// The display list (BUILD.md §6.2, §7.2), on made-up boards. Edge arrows: every hostile in
// sight either shows at least a quarter of itself each way, with its hostile bar inside the
// part that shows, or has an edge arrow; no arrow lies on another or on a visible actor. M3's
// marks: every mark of the view model is drawn as an item with its own id, in the order §6.2
// and §6.3 give (calls, noise rings and a Solution's area beneath the telegraph fills, all of
// them beneath the actors, the telegraph numbers last); case glyphs, staff-door grades,
// labels, items and surfaces under the actors; and an exhibit's glyph row never covers
// another actor.
module.exports = ({ test, assert, root, fs, path, loadCore }) => {
  const vm = require('node:vm');
  const ctx = vm.createContext({ ART: { palettes: { semantic: { hostile: '#d61e05', hazard: '#d59356', readable: '#f3f1e8', item: '#f0d50f', player: '#7092d8' } } }, Math });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/view/pictograms.js'), 'utf8') + '\nthis.Pictograms = Pictograms;', ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/view/marks.js'), 'utf8') + '\nthis.Marks = Marks;', ctx);
  const Marks = ctx.Marks, Pictograms = ctx.Pictograms, t = 32, W = 390, H = 600, json = JSON.stringify;
  const board = (you, others, clearBottom) => {
    const actors = [{ uid: 'you', x: you[0], y: you[1], size: 1, hostile: false, mode: 'you', pips: 0 }]
      .concat(others.map(([x, y, size], i) => ({ uid: 'h' + i, x, y, size: size || 1, hostile: true, mode: 'dormant', pips: 0 })));
    const v = { w: 80, h: 80, ring: new Uint8Array(6400), marks: [], path: null, selection: null, selectedTile: null, actors, dept: 'S9' };
    const ox = Math.floor(W / 2 - (you[0] + 0.5) * t), oy = Math.floor((clearBottom || H) / 2 - (you[1] + 0.5) * t);
    const rectOf = (x, y) => ({ x: ox + x * t, y: oy + y * t, w: t, h: t });
    const actorRect = a => ({ x: ox + a.x * t, y: oy + a.y * t, w: t * a.size, h: t * a.size });
    return { items: Marks.list(v, rectOf, actorRect, t, W, H, clearBottom == null ? H : clearBottom), actors, actorRect, bottom: clearBottom == null ? H : clearBottom };
  };
  const meets = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
  const check = (b, what) => {
    const edges = b.items.filter(d => d.id.startsWith('edge:'));
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) assert.ok(!meets(edges[i].rect, edges[j].rect), `${what}: ${edges[i].id} lies on ${edges[j].id}`);
    for (const a of b.actors) {
      const r = b.actorRect(a), vx = Math.min(W, r.x + r.w) - Math.max(0, r.x), vy = Math.min(b.bottom, r.y + r.h) - Math.max(0, r.y);
      const visible = { x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.max(0, vx), h: Math.max(0, vy) };
      if (vx > 0 && vy > 0) for (const e of edges) assert.ok(!meets(e.rect, visible), `${what}: ${e.id} lies on ${a.uid}`);
      const glyph = b.items.find(d => d.id === 'state:' + a.uid);
      if (glyph && vx > 0 && vy > 0) for (const e of edges) assert.ok(!meets(e.rect, glyph.rect), `${what}: ${e.id} lies on ${a.uid}'s state glyph`);
      if (!a.hostile) continue;
      if (vx >= r.w / 4 && vy >= r.h / 4) {
        const bar = b.items.find(d => d.id === 'hostile:' + a.uid).rect;
        assert.ok(bar.x >= visible.x - 0.01 && bar.y >= visible.y - 0.01 && bar.x + bar.w <= visible.x + visible.w + 0.01 && bar.y + bar.h <= visible.y + visible.h + 0.01, `${what}: ${a.uid}'s bar is outside the part that shows`);
      } else assert.ok(edges.some(d => d.id === 'edge:' + a.uid), `${what}: ${a.uid} is off the board with no arrow`);
    }
    return edges.length;
  };

  test('edge arrows past one corner never stack', () => {
    assert.ok(check(board([40, 40], [[60, 10], [62, 12], [65, 8], [70, 15]]), 'north-east corner') >= 4);
    assert.ok(check(board([40, 40], [[10, 70], [12, 72], [8, 75]], 400), 'south-west, sheet open') >= 3);
  });
  test('edge arrows along one edge, crowded, lie clear of each other and of actors that show', () => {
    assert.ok(check(board([40, 40], [[30, 60], [31, 61], [32, 62], [33, 63], [34, 64], [35, 65]], 300), 'south edge under a sheet') >= 6);
    // A hostile showing a sliver at the left edge, and others past that edge beside it.
    check(board([40, 40], [[33, 41], [20, 40], [20, 42], [20, 38]]), 'left edge with a sliver');
    // A hostile on the board at the left edge with another past the edge on its row: the arrow
    // must clear the first one's sprite and its glyph above it.
    for (let y = 36; y <= 44; y++) check(board([40, 40], [[34, y], [20, y], [20, y + 1]]), `left edge, row ${y}`);
  });
  test('a hostile cut by the sheet keeps its bar where it shows, or gets an arrow', () => {
    for (let y = 44; y <= 52; y++) check(board([40, 40], [[41, y]], 300), `hostile at row ${y}`);
  });

  // A recording 2D context: every call is accepted, and the colours and pictograms used are
  // kept, so a paint function can be run here.
  function recorder() {
    const log = { fills: [], strokes: [] };
    const c = new Proxy({}, {
      get: (o, k) => k in o ? o[k] : (typeof k === 'string' && /^(fill|stroke)Style$/.test(k) ? o[k] : () => {}),
      set: (o, k, v) => { o[k] = v; if (k === 'fillStyle') log.fills.push(v); if (k === 'strokeStyle') log.strokes.push(v); return true; },
    });
    return { c, log };
  }
  const flat = (v, extra) => Object.assign({ w: 20, h: 20, ring: new Uint8Array(400), marks: [], path: null, selection: null, selectedTile: null, actors: [], dept: 'S9',
    cases: [], staff: [], items: [], plaques: [], surfaces: [], cues: { movedFrom: [], hit: [], broke: [], special: [] } }, v, extra);
  const rects = { rectOf: (x, y) => ({ x: x * t, y: y * t, w: t, h: t }), actorRect: a => ({ x: a.x * t, y: a.y * t, w: t * (a.size || 1), h: t * (a.size || 1) }) };
  const draw = v => Marks.list(v, rects.rectOf, rects.actorRect, t, 640, 640, 640);
  const actor = (uid, x, y, more) => Object.assign({ uid, x, y, size: 1, hostile: uid !== 'you', mode: uid === 'you' ? 'you' : 'hunting', pips: 0, sprite: 'x', telegraphing: null, statuses: [], encased: false }, more);
  ctx.Sprites = { board: () => null };

  test('every mark of the view model is drawn, under its own id, in the order of §6.2: calls, noise and area beneath telegraph fills, all beneath the actors, numbers last', () => {
    const marks = [{ kind: 'telegraph', x: 3, y: 3, dmg: 7, by: 'a' }, { kind: 'call', x: 3, y: 3, by: 'h' }, { kind: 'call', x: 4, y: 3, by: 'h' },
      { kind: 'noise', x: 5, y: 5, cls: 'soft' }, { kind: 'noise', x: 6, y: 5, cls: 'crash' }, { kind: 'area', x: 8, y: 8 }, { kind: 'aim', x: 8, y: 8 }];
    const items = draw(flat({ marks, actors: [actor('you', 3, 3), actor('a', 4, 4)] }));
    const at = id => items.findIndex(d => d.id === id), last = id => items.length - 1 - items.slice().reverse().findIndex(d => d.id === id);
    for (const m of marks) assert.ok(at(m.kind + ':' + m.x + ',' + m.y) >= 0, `${m.kind} at ${m.x},${m.y} is not drawn`);
    const firstActor = items.findIndex(d => d.kind === 'actor');
    for (const id of ['call:3,3', 'noise:5,5', 'area:8,8', 'telegraph:3,3']) assert.ok(at(id) < firstActor, `${id} is drawn beneath the actors`);
    assert.ok(at('call:3,3') < at('telegraph:3,3') && at('noise:5,5') < at('telegraph:3,3'), 'calls and noise beneath the damage marks');
    assert.ok(last('telegraph:3,3') === items.length - 1, 'the number goes on last');
    assert.ok(at('aim:8,8') > firstActor, 'the aim is drawn over what it aims at');
    // Ids are unique, but for a telegraph's fill and its number, and the one selection.
    const ids = items.map(d => d.id).filter(id => !/^telegraph:/.test(id));
    assert.equal(new Set(ids).size, ids.length, ids.join(' '));
  });

  test('a case shows its lock (one bar per grade) while shut, its cracks, and what it holds or the empty frame of a loan; a closed staff door its grade; labels, items and surfaces each a glyph', () => {
    const v = flat({
      cases: [{ x: 2, y: 2, glass: 2, hits: 1, need: 2, lock: 3, st: 'shut', loan: false, holds: { uid: 'c', kind: 'curio', icon: 'curio' }, canOpen: false, num: '1.1.1' },
        { x: 4, y: 2, glass: 1, hits: 0, need: 1, lock: 1, st: 'shut', loan: true, holds: null, canOpen: true, num: '1.1.2' },
        { x: 6, y: 2, glass: 1, hits: 0, need: 1, lock: 1, st: 'open', loan: false, holds: null, canOpen: false, num: '1.1.3' }],
      staff: [{ x: 8, y: 2, grade: 5, open: false }, { x: 9, y: 2, grade: 2, open: true }],
      plaques: [{ x: 0, y: 5 }], items: [{ uid: 'c', x: 2, y: 2, icon: 'curio', kind: 'curio', inCase: true }, { uid: 'p', x: 5, y: 5, icon: 'seal', kind: 'consumable', inCase: false, shape: 'star' },
        { uid: 'q', x: 5, y: 5, icon: 'weapon', kind: 'weapon', inCase: false }],
      surfaces: [{ kind: 'dust', x: 7, y: 7 }, { kind: 'fumigant', x: 7, y: 7 }] });
    const items = draw(v), ids = items.map(d => d.id);
    for (const id of ['lock:2,2', 'cracks:2,2', 'holds:2,2', 'lock:4,2', 'loan:4,2', 'lock:8,2', 'plaque:0,5', 'item:5,5', 'surface:dust:7,7', 'surface:fumigant:7,7']) assert.ok(ids.includes(id), `${id} is not drawn`);
    for (const id of ['cracks:4,2', 'lock:6,2', 'lock:9,2', 'item:2,2', 'holds:4,2']) assert.ok(!ids.includes(id), `${id} is drawn`);
    // The bars: one per grade, wider for a higher lock, inside the tile.
    const w = id => items.find(d => d.id === id).rect.w;
    assert.ok(w('lock:2,2') > w('lock:4,2') && w('lock:8,2') > w('lock:2,2'));
    for (const id of ['lock:2,2', 'lock:8,2']) { const r = items.find(d => d.id === id).rect; assert.ok(r.x + r.w <= Math.floor(r.x / t) * t + t + 1, `${id} runs past its tile`); }
    // Each paints, with only reserved colours, black and white.
    const allowed = new Set(['#d61e05', '#d59356', '#f3f1e8', '#f0d50f', '#7092d8', '#000000', '#ffffff', 'rgba(0,0,0,0.45)']);
    for (const d of items) { const { c, log } = recorder(); d.paint(c); for (const k of log.fills.concat(log.strokes)) assert.ok(allowed.has(k), `${d.id} paints ${k}`); }
    // The consumable on the floor shows its seal's shape; the first item on a tile is drawn.
    const { c, log } = recorder(); let drawn = null;
    const orig = Pictograms.draw; Pictograms.draw = (cx, id) => { drawn = id; };
    try { items.find(d => d.id === 'item:5,5').paint(c); } finally { Pictograms.draw = orig; }
    assert.equal(drawn, 'star');
  });

  test('an exhibit\'s glyph row (glass, state or pips, the special it marks) sits above it, or beside its head where another actor stands above, and never covers another actor', () => {
    const column = [actor('a', 5, 3), actor('b', 5, 4, { encased: true, telegraphing: 'ring' }), actor('c', 5, 5, { mode: 'dormant', pips: 2 }), actor('you', 9, 9)];
    const items = draw(flat({ actors: column })), sq = a => rects.actorRect(a);
    const meets = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
    for (const a of column) for (const d of items.filter(x => /^(state|encased|telegraphing):/.test(x.id) && x.id.endsWith(':' + a.uid))) {
      for (const b of column) if (b !== a) assert.ok(!meets(d.rect, sq(b)), `${d.id} covers ${b.uid}`);
    }
    for (const id of ['state:a', 'state:b', 'encased:b', 'telegraphing:b', 'state:c']) assert.ok(items.some(d => d.id === id), id);
    // Alone, the top one's glyph sits above it; under another, beside its head, to the right.
    assert.ok(items.find(d => d.id === 'state:a').rect.y < sq(column[0]).y);
    assert.ok(items.find(d => d.id === 'encased:b').rect.x >= sq(column[1]).x + t, 'beside, to the right');
    // Hemmed in above and on both sides, it goes along the top of its own square.
    const hemmed = [actor('n', 5, 3), actor('w', 4, 4), actor('e', 6, 4), actor('m', 5, 4), actor('you', 9, 9)];
    const h = draw(flat({ actors: hemmed })), row = h.find(d => d.id === 'state:m').rect, own = sq(hemmed[3]);
    assert.ok(row.y >= own.y && row.x >= own.x && row.x + row.w <= own.x + own.w, json(row));
    for (const b of hemmed) if (b.uid !== 'm') assert.ok(!meets(row, sq(b)), `the row covers ${b.uid}`);
    // The modes fold as §8.2's table does: searching shows the hunting glyph, reinstalling the returning one.
    for (const [mode, glyph] of [['searching', 'hunting'], ['reinstalling', 'returning'], ['awake', 'alert'], ['dormant', 'asleep'], ['hunting', 'hunting'], ['returning', 'returning']])
      assert.equal(Marks.glyphOf(mode), glyph, mode);
  });

  test('the noise ring\'s edge tells its class by its shape: dotted for soft, dashed for loud, solid and double for a crash', () => {
    const dashes = cls => {
      const items = draw(flat({ marks: [{ kind: 'noise', x: 4, y: 4, cls }] })), d = items.find(x => x.id === 'noise:4,4'), seen = [];
      const c = new Proxy({}, { get: (o, k) => k === 'setLineDash' ? (a => seen.push(a.join())) : k === 'stroke' ? (() => seen.push('stroke')) : (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
      d.paint(c);
      return seen.join('|');
    };
    const soft = dashes('soft'), loud = dashes('loud'), crash = dashes('crash');
    assert.ok(soft !== loud && loud !== crash && soft !== crash, [soft, loud, crash].join(' / '));
    assert.equal((crash.match(/stroke/g) || []).length, 2, 'a crash is drawn twice over');
  });

  // The view model a real department gives, drawn: every mark has its item, so a view drawing
  // the list draws every mark the board must show (both views use this one list).
  test('a department\'s view model, drawn: every mark and every actor has its item', () => {
    const C = loadCore(), s = C.Dept.create(2, 'S9', 3);
    s.actors[0].hp = 999;
    let last = [];
    for (let i = 0; i < 30; i++) {
      const v = C.ViewModel.derive(s, { events: last }), items = Marks.list(v, rects.rectOf, rects.actorRect, t, 4000, 4000, 4000), ids = new Set(items.map(d => d.id));
      for (const m of v.marks) assert.ok(ids.has(m.kind + ':' + m.x + ',' + m.y), `${m.kind} at ${m.x},${m.y}`);
      for (const a of v.actors) assert.ok(ids.has(a.uid), a.uid);
      const moves = C.Step.legal(s).filter(a => a.a === 'move');
      last = C.Step.step(s, moves.length ? moves[i % moves.length] : { a: 'wait' });
    }
  });
};
