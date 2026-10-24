// The display list's edge arrows (BUILD.md §6.2, §7.2), on made-up boards: every hostile in
// sight either shows at least a quarter of itself each way, with its hostile bar inside the
// part that shows, or has an edge arrow; no arrow lies on another or on a visible actor.
module.exports = ({ test, assert, root, fs, path }) => {
  const vm = require('node:vm');
  const ctx = vm.createContext({ ART: { palettes: { semantic: { hostile: '#d61e05', hazard: '#d59356', readable: '#f3f1e8', item: '#f0d50f', player: '#7092d8' } } }, Math });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/view/marks.js'), 'utf8') + '\nthis.Marks = Marks;', ctx);
  const Marks = ctx.Marks, t = 32, W = 390, H = 600;
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
};
