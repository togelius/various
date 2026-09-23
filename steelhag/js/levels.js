'use strict';
// Five chapters. Each one is a palette, a ground line, the things you can
// stand on, where the little machine waits, what is said, and how the land
// behind it all is painted.

const Scene = {
  // spruce forest along a ridge line
  forest(ctx, x0, x1, fy, col, r, o = {}) {
    const step = o.step || 4;
    for (let x = x0; x < x1; x += step * (0.4 + r() * 1.2)) {
      const h = (o.h[0] + r() * (o.h[1] - o.h[0])) * (0.7 + fbm(o.n || Math.sin, x / 300) * 0.6);
      Art.pine(ctx, x, fy(x) + 3, h, jit(col, r, o.jit ?? 6), r, o);
    }
  },
  pylons(ctx, x0, x1, step, fy, h, col, lw, wire, sag, r) {
    let prev = null;
    for (let x = x0; x < x1; x += step) {
      const pts = Art.pylon(ctx, x, fy(x), h, col, lw);
      if (prev) for (let i = 0; i < pts.length; i++) Art.wire(ctx, prev[i][0], prev[i][1], pts[i][0], pts[i][1], sag, wire, lw * 0.5, 0.8);
      prev = pts;
    }
  },
  poles(ctx, x0, x1, step, fy, h, col, lw, wire, r) {
    let prev = null;
    for (let x = x0; x < x1; x += step * (0.9 + r() * 0.2)) {
      const pts = Art.pole(ctx, x, fy(x) + 2, h * (0.9 + r() * 0.2), col, lw);
      if (prev) for (let i = 0; i < 2; i++) Art.wire(ctx, prev[i][0], prev[i][1], pts[i][0], pts[i][1], h * 0.08, wire, 1, 0.7);
      prev = pts;
    }
  },
  birches(ctx, x0, x1, n, fy, hr, pal, r, o = {}) {
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(x0 + r() * (x1 - x0));
    xs.sort((a, b) => a - b);
    for (const x of xs) Art.birch(ctx, x, fy(x) + 3, hr[0] + r() * (hr[1] - hr[0]), pal, r, o);
  },
  // light shafts slanting away from the sun
  rays(ctx, W, sx, sy, col, r, n = 14, a = 0.05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ang = Math.PI / 2 + (r() - 0.5) * 1.8, len = 900, w = 20 + r() * 90;
      const ex = sx + Math.cos(ang) * len * (sx > W / 2 ? -1 : 1) * 0.6, ey = sy + Math.sin(ang) * len;
      const g = ctx.createLinearGradient(sx, sy, ex, ey);
      g.addColorStop(0, css(col, a)); g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex - w, ey); ctx.lineTo(ex + w, ey); ctx.fill();
    }
    ctx.restore();
  },
  // reflection-bright water strips in the distance
  waterBand(ctx, x0, x1, y, h, col, glint, r) {
    ctx.fillStyle = css(col); ctx.fillRect(x0, y, x1 - x0, h);
    for (let i = 0; i < (x1 - x0) / 4; i++) Art.stroke(ctx, x0 + r() * (x1 - x0), y + r() * h, 10 + r() * 50, 1, 0, glint, 0.3);
  },
  standingLamp(ctx, x, y, h, col, lampCol) {
    Art.line(ctx, x, y, x, y - h, 3, col);
    Art.line(ctx, x, y - h, x + 14, y - h + 2, 3, col);
    Art.dab(ctx, x + 14, y - h + 4, 5, 3, 0, lampCol, 1);
  },
};

const hz = (c, p, t) => mix(c, p.haze, t);

const LEVELS = [
// ======================================================================= I
{
  id: 1, seed: 11, title: 'Snöfältet', sub: 'The Snow Field', date: 'February, 1989',
  width: 6400, top: 200, bumps: 8,
  pal: {
    horizon: 450, light: -1, haze: '#d9d8d1', lowHaze: 0.3,
    skyStops: [[-200, '#7d8e9d'], [120, '#a3b0ba'], [360, '#d3d3cb'], [450, '#e8e3d6'], [720, '#e2dfd8']],
    sun: { x: 0.27, y: 330, color: '#fff0d4', glow: 460, glowA: 0.55, disk: 24, diskA: 0.85, rim: '#fbf2e2' },
    clouds: [
      { y: 40, h: 110, n: 1400, light: '#b7c0c5', dark: '#8795a0', a: 0.05, rx: [90, 280], flat: 0.14 },
      { y: 270, h: 45, n: 600, light: '#ece7dc', dark: '#b7bbbb', a: 0.06, rx: [60, 220], flat: 0.12 },
    ],
    ground: { kind: 'snow', fieldTop: '#e4e8ea', fieldBottom: '#b9c3cf', hi: '#fbfbf8', lo: '#9aa8ba', surfLight: '#f3f3ef', surfShadow: '#a7b3c2', surfTop: '#ffffff', bandLow: '#c3ccd6', band: 16, tuft: '#a08a5a', tuft2: '#6f6048', tuftDensity: 0.06, tuftH: 16, sparkle: true },
    snow: { c: '#f1f2ef', s: '#b3bdc9' },
    water: { top: '#9aa6ae', deep: '#46525c', glint: '#eef0ef', dark: '#56626c', ice: '#e8eef2' },
    metal: { c: '#5f6664', rust: '#8e4f2c', label: '#e7e2d4', grime: '#39383a' },
    stripes: ['#d9892f', '#2b2b2a'], bale: '#e2e6e1', glass: '#5f6d78',
    rock: '#7c7f80', log: '#5a4b3c',
    fg: { col: '#3b3326', col2: '#6e5c3e', kind: 'grass' },
    weather: { kind: 'snow', n: 220, wind: -18, fall: 38 },
    fog: [{ y: 470, h: 160, a: 0.35, speed: 6, after: 'far' }, { y: 540, h: 140, a: 0.22, speed: 10, after: 'mid' }],
    breath: true,
  },
  ground: [[0, 590], [300, 585], [700, 592], [1100, 578], [1500, 566], [1900, 572], [2250, 590], [2380, 606], [2500, 604], [2800, 586], [3200, 578], [3700, 582], [4100, 570], [4500, 585], [4900, 575], [5300, 560], [5700, 566], [6100, 575], [6400, 575]],
  gaps: [{ x0: 2390, x1: 2488, water: 632 }],
  objects: [
    { t: 'bale', x: 880, w: 58, h: 46 }, { t: 'bale', x: 942, w: 58, h: 46 }, { t: 'bale', x: 910, w: 58, h: 46, lift: 42 },
    { t: 'car', x: 1640, w: 156, c: '#6e2a24' },
    { t: 'metal', x: 3110, w: 64, h: 40, c: '#595f5e' },
    { t: 'metal', x: 3200, w: 210, h: 44, c: '#646b68', round: 18, panel: 70 },
    { t: 'metal', x: 3430, w: 86, h: 92, c: '#5b615f' },
    { t: 'metal', x: 3530, w: 290, h: 150, stripes: true, stripeY: 18, label: 'SV-14  RIKSVÄGSVERKET', labelSize: 15, labelY: 70, c: '#6a716d',
      draw(ctx, o, r) {
        // dead eye of the fallen walker
        const y = o._y;
        for (let i = 0; i < 4; i++) Art.dab(ctx, o.x + 40 + i * 58, y + 112, 12, 9, 0, '#2d3134', 0.9);
        Art.line(ctx, o.x + 20, y + 140, o.x + 270, y + 140, 3, '#3a3d3c', 0.8);
      } },
    { t: 'metal', x: 3834, w: 116, h: 88, c: '#727874', round: 10,
      draw(ctx, o, r) {
        const y = o._y;
        ctx.fillStyle = css('#1e2326'); ctx.fillRect(o.x + 18, y + 26, 80, 20);
        Art.line(ctx, o.x + 22, y + 36, o.x + 94, y + 36, 2, '#7d3d2a', 0.8);
        Art.line(ctx, o.x + 90, y, o.x + 104, y - 70, 3, '#3f4442');
        Art.line(ctx, o.x + 104, y - 70, o.x + 116, y - 76, 2, '#3f4442');
      } },
    { t: 'metal', x: 4640, w: 96, h: 70, c: '#4f6456', label: '⚡ 10 kV', labelSize: 13, labelY: 40 },
    { t: 'plank', x: 5186, w: 120, y: 494, piles: false, c: '#4b4f55' },
    { t: 'bale', x: 5640, w: 58, h: 46 }, { t: 'bale', x: 5702, w: 58, h: 46 }, { t: 'bale', x: 5764, w: 58, h: 46 },
    { t: 'bale', x: 5672, w: 58, h: 46, lift: 42 }, { t: 'bale', x: 5734, w: 58, h: 46, lift: 42 },
  ],
  robot: [420, 960, 1730, 2250, 2700, 3660, 4250, 4690, 5240, 5720, 6260],
  lines: [
    [140, 'February, 1989. The machines had been in the fields since before I was born.'],
    [1250, 'Nobody cleared them away. They were part of the land, like the stones the ice left behind.'],
    [2620, 'The little one showed up that winter. It would never let me touch it.'],
    [3930, 'From up there you could see the towers across the bay, breathing into the cold.'],
    [5000, 'It kept stopping to look back at me. As if it wanted me to come along.'],
  ],
  photos: [[1720, 'Uncle Lars’s Volvo, where the snowplough left it'], [3700, 'SV-14, from on top'], [5245, 'The bus shelter. No bus since ’86'], [5701, 'From the top of the bales, the whole field']],
  exit: 6300,
  train: { y: 448, speed: 55, gap: 2600 },
  paint: {
    far(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(5);
      Art.ridge(ctx, 0, W, x => 452, 720, '#d0d3d1', r);
      Scene.waterBand(ctx, 0, W, 452, 6, '#c4cbcd', '#f4f2ea', r);
      const fy = x => 446 - fbm(n, x / 160) * 22 - Math.max(0, Math.sin(x / 260)) * 8;
      Art.ridge(ctx, 0, W, fy, 720, hz('#566169', p, 0.55), r, { tex: 1, jit: 8, texA: 0.2 });
      Scene.forest(ctx, 0, W, fy, hz('#4f5a62', p, 0.52), r, { h: [5, 14], step: 3, n });
      // the towers across the bay
      const tx = W * 0.64;
      const steam = { drift: -1.1, light: '#f6f3ec', dark: '#b8bdc0', a: 0.05, n: 380, lightDir: -1 };
      for (const [dx, h] of [[0, 128], [86, 146], [168, 120]]) Art.coolingTower(ctx, tx + dx, 450, h, p, r, { col: hz('#9ea4a6', p, 0.25), light: -1, steam });
      const sx = tx + 290;
      for (const dx of [-30, 0, 30]) Art.line(ctx, sx + dx * 1.3, 450, sx + dx * 0.5, 400, 2, hz('#6c7479', p, 0.4));
      Art.sphere(ctx, sx, 372, 44, { col: hz('#b8bec2', p, 0.25), hi: '#f7f5ef', dark: hz('#788189', p, 0.3), seam: '#6f7880', light: -1 });
      Art.line(ctx, W * 0.33, 450, W * 0.33, 300, 1.6, hz('#5e676e', p, 0.5));
      Art.dab(ctx, W * 0.33, 300, 2, 2, 0, '#c9504a', 0.9);
    },
    mid(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(9);
      const fy = x => 488 - fbm(n, x / 220) * 38;
      Scene.forest(ctx, 0, W, fy, hz('#36433f', p, 0.36), r, { h: [22, 58], step: 5, n, light: -1, lightCol: '#dfe2de', lightA: 0.2, snow: '#e9ecea' });
      const sy = x => 500 + fbm(n, x / 300 + 40) * 10;
      Art.ridge(ctx, 0, W, sy, 720, '#dde0df', r, { tex: 1.2, topCol: '#f0f1ee', botCol: '#b9c2cb', jit: 6, texA: 0.25 });
      Art.house(ctx, W * 0.14, sy(W * 0.14) + 4, 46, 26, { wall: hz('#8e3a2c', p, 0.3), roof: hz('#3e3b3a', p, 0.3), trim: '#e8e4da', snow: '#eef0ee', window: '#e9b86a' }, r);
      Art.house(ctx, W * 0.14 + 64, sy(W * 0.14 + 64) + 4, 70, 34, { wall: hz('#853428', p, 0.3), roof: hz('#3e3b3a', p, 0.3), trim: '#e8e4da', snow: '#eef0ee' }, r);
      Scene.pylons(ctx, 180, W, 420, x => sy(x) + 2, 150, hz('#454d52', p, 0.45), 1.3, hz('#454d52', p, 0.35), 14, r);
    },
    near(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(21);
      const fy = x => 548 + fbm(n, x / 260) * 22;
      for (let i = 0; i < 9; i++) {
        const x = r() * W;
        for (let k = 0; k < 3 + r() * 5; k++) { const xx = x + gauss(r) * 60; Art.bareTree(ctx, xx, fy(xx) + 2, 50 + r() * 60, hz('#4a4540', p, 0.45), r, 0.9); }
      }
      Art.walker(ctx, W * 0.47, fy(W * 0.47) + 6, 440, hz('#3e4446', p, 0.45), r, { lit: '#f4efe4', lamp: '#e2873e', light: -1, stripes: hz('#d9892f', p, 0.4) });
      Art.walker(ctx, W * 0.8, fy(W * 0.8) + 6, 300, hz('#3e4446', p, 0.55), r, { lit: '#f4efe4', light: -1 });
      Art.ridge(ctx, 0, W, fy, 720, '#e6e8e6', r, { tex: 1.5, topCol: '#f6f6f3', botCol: '#b6c0cc', jit: 6, texA: 0.25 });
      for (let i = 0; i < 26; i++) { const x = r() * W; Art.pine(ctx, x, fy(x) + 4, 50 + r() * 90, hz('#2f3a37', p, 0.25), r, { light: -1, lightCol: '#e7e8e2', lightA: 0.25, snow: '#eef0ee' }); }
      Art.fence(ctx, 0, W, x => fy(x) + 8, hz('#4a4036', p, 0.3), r, { h: 22, gap: 40, snow: '#f0f1ee', wireCol: hz('#4a4036', p, 0.5) });
      for (let i = 0; i < 14; i++) { const x = r() * W; Art.bale(ctx, x, fy(x) - 12, 26, 20, { c: '#e0e4df' }, r); }
    },
    playBack(ctx, W, r, w) {
      const p = w.L.pal, g = x => w.drawGroundAt(x);
      Art.house(ctx, 110, g(200) + 8, 150, 88, { wall: '#8c3527', roof: '#393534', trim: '#ece8de', snow: '#f1f2ee', window: '#f0b865' }, r);
      Scene.poles(ctx, 40, W, 360, x => g(x) - 10, 150, '#3e3830', 4, '#2f2b27', r);
      Art.fence(ctx, 420, 1560, x => g(x) - 2, '#4d4135', r, { h: 30, gap: 50, snow: '#f2f2ef', wireCol: '#5a4c3e' });
      Art.fence(ctx, 4000, 5100, x => g(x) - 2, '#4d4135', r, { h: 30, gap: 50, snow: '#f2f2ef', wireCol: '#5a4c3e' });
      // the fallen walker's broken leg stands up out of the snow
      ctx.save();
      ctx.translate(3290, g(3290) + 6); ctx.rotate(-0.42);
      Art.metal(ctx, -26, -240, 52, 240, '#5b625f', r, { panel: 60, stripes: p.stripes, stripeY: 30, stripeH: 10, snow: p.snow });
      ctx.restore();
      Art.dab(ctx, 3290 - 96, g(3290) - 216, 30, 30, 0, '#4f5553', 1);
      Art.dab(ctx, 3290 - 96, g(3290) - 216, 12, 12, 0, '#343837', 1);
      // hip joint and cables where the leg met the body
      Art.dab(ctx, 3422, g(3422) - 58, 40, 40, 0, '#535957', 1);
      Art.dab(ctx, 3416, g(3422) - 64, 30, 30, 0, '#626866', 1);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; Art.dab(ctx, 3416 + Math.cos(a) * 22, g(3422) - 64 + Math.sin(a) * 22, 2.5, 2.5, 0, '#3a3e3d', 1); }
      for (const [x0, x1, sag] of [[3560, 3500, 50], [3620, 3700, 40], [3800, 3880, 30], [3700, 3990, 70]]) Art.wire(ctx, x0, g(x0) - 150, x1, g(x1) + 2, sag, '#2a2d2c', 3);
      // bus shelter
      const bx = 5186;
      for (const dx of [6, 114]) Art.line(ctx, bx + dx, g(bx + dx) + 4, bx + dx, 498, 5, '#3f4348');
      ctx.fillStyle = css('#7f8e98', 0.35); ctx.fillRect(bx + 8, 500, 104, g(bx + 60) - 510);
      Art.line(ctx, bx + 20, g(bx + 20) - 26, bx + 100, g(bx + 100) - 26, 5, '#5a4432');
      Art.line(ctx, bx + 150, g(bx + 150) + 4, bx + 150, 470, 3, '#3f4348');
      ctx.fillStyle = css('#e8c63a'); ctx.fillRect(bx + 138, 454, 24, 24);
      ctx.fillStyle = css('#2d4f86'); ctx.font = 'bold 15px Arial'; ctx.fillText('H', bx + 145, 472);
    },
  },
},
// ====================================================================== II
{
  id: 2, seed: 23, title: 'Björkhagen', sub: 'The Birch Pasture', date: 'August',
  width: 6800, top: 220, bumps: 10,
  pal: {
    horizon: 460, light: 1, haze: '#e7cf9e', lowHaze: 0.35,
    skyStops: [[-220, '#56778f'], [110, '#86a1ae'], [320, '#dccb9f'], [440, '#f7d89a'], [720, '#e9c88c']],
    sun: { x: 0.72, y: 372, color: '#ffd68a', glow: 560, glowA: 0.8, disk: 30, rim: '#ffe6b3' },
    clouds: [
      { y: 90, h: 60, n: 500, light: '#f0dcb2', dark: '#91a2a7', a: 0.05, rx: [90, 260], flat: 0.1 },
      { y: 300, h: 34, n: 380, light: '#ffe7b8', dark: '#c9a279', a: 0.08, rx: [60, 200], flat: 0.1 },
    ],
    ground: { kind: 'grass', fieldTop: '#8f8a48', fieldBottom: '#2f3320', hi: '#f0d88a', lo: '#3a4024', surfLight: '#e1c878', surfShadow: '#56603a', surfTop: '#f1dc93', bandLow: '#4c5332', band: 12, fieldTufts: 0.04, tuft: '#d4bd70', tuft2: '#7c8c46', tuftDensity: 0.3, tuftH: 22 },
    birch: { bark: '#ece2cc', barkDark: '#2b2a26', barkShade: '#9b8f7c', leaf: '#9aa451', leafLight: '#f3dd8a', leafDark: '#4f5d33' },
    moss: ['#7d8a3c', '#a9ac52'],
    metal: { c: '#6c6f5f', rust: '#9a5a2f', label: '#efe6cf', grime: '#3a3a28' },
    stripes: ['#d58a33', '#2c2a24'], rock: '#8a8577', lichen: '#c9c07a', log: '#b3a88f', logEnd: '#d7c49a', plank: '#6b5a45',
    fg: { col: '#2c2a1a', col2: '#5c5a2c', kind: 'tall' },
    weather: { kind: 'motes', n: 90 },
    fog: [{ y: 480, h: 150, a: 0.28, speed: 4, after: 'far' }],
  },
  ground: [[0, 590], [500, 580], [900, 572], [1300, 585], [1700, 576], [2100, 566], [2500, 574], [2660, 592], [2800, 594], [3100, 578], [3500, 582], [3900, 586], [4150, 588], [4172, 440], [4600, 444], [5000, 452], [5300, 540], [5600, 574], [6000, 570], [6400, 560], [6800, 566]],
  gaps: [{ x0: 2682, x1: 2790 }],
  objects: [
    { t: 'rock', x: 700, w: 70, h: 38 }, { t: 'rock', x: 780, w: 88, h: 66 },
    { t: 'log', x: 1180, w: 200, h: 26, sink: 2 },
    { t: 'rock', x: 1520, w: 50, h: 32 }, { t: 'rock', x: 1570, w: 56, h: 36 }, { t: 'rock', x: 1626, w: 48, h: 30 }, { t: 'rock', x: 1674, w: 60, h: 38 }, { t: 'rock', x: 1734, w: 52, h: 32 },
    { t: 'metal', x: 2120, w: 90, h: 58, c: '#666a58', moss: true },
    { t: 'metal', x: 2220, w: 360, h: 132, stripes: true, stripeY: 20, label: 'KV-3', labelSize: 30, labelY: 90, c: '#6e7162', moss: true,
      draw(ctx, o, r) {
        const y = o._y;
        for (let i = 0; i < 5; i++) Art.dab(ctx, o.x + 150 + i * 42, y + 104, 11, 8, 0, '#2d3027', 0.85);
        for (let i = 0; i < 40; i++) Art.stroke(ctx, o.x + r() * o.w, y + o.h, 8 + r() * 30, 2, -Math.PI / 2 + (r() - 0.5) * 0.6, '#9ea356', 0.6);
      } },
    { t: 'log', x: 3180, w: 170, h: 24, sink: 2 },
    { t: 'rock', x: 3440, w: 80, h: 50 },
    { t: 'rock', x: 3760, w: 110, h: 74 },
    { t: 'metal', x: 3786, w: 58, h: 40, y: 477, c: '#6e7162', moss: true, round: 8,
      draw(ctx, o) { ctx.fillStyle = css('#1d2226'); ctx.fillRect(o.x + 30, o._y + 12, 20, 10); Art.dab(ctx, o.x + 44, o._y + 17, 2, 2, 0, '#5b2a22', 1); } },
    { t: 'rock', x: 4420, w: 70, h: 40 },
    { t: 'log', x: 5700, w: 180, h: 26, sink: 2 },
    { t: 'rock', x: 6100, w: 90, h: 56 },
  ],
  movers: [{ x: 4040, y: 576, w: 100, h: 16, dy: -150, period: 7, art: 'lift', tail: 30, c: '#6a6d5c' }],
  robot: [320, 1260, 1700, 2420, 2920, 3500, 3990, 4520, 4880, 5760, 6620],
  lines: [
    [180, 'It came back in August, and this time I followed it further.'],
    [1850, 'In summer the grass grew up through them. Birds nested in the gearboxes.'],
    [3150, 'Dad said they were built to walk across the ice to Finland. He never said why they stopped.'],
    [4650, 'The light went long and gold, the way it only does at the end of summer.'],
    [5900, 'I told myself I would turn back at the next hill.'],
  ],
  photos: [[2440, 'KV-3, asleep in the birches'], [3815, 'A sensor head, left in the birches'], [4860, 'The long light'], [6150, 'Moss, lichen, steel']],
  exit: 6680,
  paint: {
    far(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(31);
      const fy = x => 455 - fbm(n, x / 200) * 30;
      Art.ridge(ctx, 0, W, fy, 720, hz('#6f7c78', p, 0.62), r, { tex: 1, jit: 8, texA: 0.2 });
      Scene.forest(ctx, 0, W, fy, hz('#5c6a60', p, 0.6), r, { h: [6, 16], step: 3, n });
      Scene.waterBand(ctx, 0, W, 470, 8, hz('#c9b789', p, 0.2), '#fff2c8', r);
      for (const [x, h] of [[0.2, 150], [0.55, 110], [0.88, 170]]) Art.walker(ctx, W * x, 470, h, hz('#5a6360', p, 0.6), r);
    },
    mid(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(37);
      const fy = x => 512 - fbm(n, x / 260) * 26;
      Scene.forest(ctx, 0, W, fy, hz('#34412f', p, 0.45), r, { h: [30, 70], step: 9, n });
      Scene.birches(ctx, 0, W, W / 7, fy, [70, 150], p.birch, r, { fade: p.haze, fadeT: 0.42, light: 1, leafy: 0.8 });
      Art.ridge(ctx, 0, W, x => fy(x) + 14 + fbm(n, x / 90) * 6, 720, hz('#7d7a42', p, 0.35), r, { tex: 1.2, topCol: hz('#d6be73', p, 0.2), jit: 16 });
      Art.walker(ctx, W * 0.52, fy(W * 0.52) + 20, 330, hz('#3c4038', p, 0.45), r, { lit: '#ffd690', lamp: '#f0a84e', stripes: hz('#d58a33', p, 0.4) });
    },
    near(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(41);
      const fy = x => 552 + fbm(n, x / 240) * 20;
      Scene.birches(ctx, 0, W, W / 22, fy, [160, 300], p.birch, r, { fade: p.haze, fadeT: 0.2, light: 1 });
      Art.ridge(ctx, 0, W, fy, 720, '#8f8744', r, { tex: 1.6, topCol: '#e3c878', botCol: '#4c5230', jit: 18, texA: 0.3 });
      for (let i = 0; i < 30; i++) { const x = r() * W; Art.rock(ctx, x, fy(x) - 10, 20 + r() * 40, 10 + r() * 16, { c: hz('#8a8577', p, 0.2), light: 1, moss: p.moss }, r); }
      for (let x = 0; x < W; x += 3) Art.grass(ctx, x, fy(x) + 2, 12 + r() * 10, r() < 0.5 ? '#e0c877' : '#8d9249', r, 2, 0.6);
      Scene.rays(ctx, W, W * 0.78, 200, '#ffe0a0', r, 16, 0.045);
    },
    playFront(ctx, W, r, w) {
      // the granite shelf the plateau stands on
      const p = w.L.pal, g = x => w.drawGroundAt(x), n = makeNoise(97);
      const x0 = 4146, x1 = 5330;
      const top = x => g(x) + 12, bot = x => 598 + fbm(n, x / 50) * 16;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x0, bot(x0));
      for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, Math.min(top(x), bot(x)));
      for (let x = x1; x >= x0; x -= 4) ctx.lineTo(x, bot(x));
      ctx.closePath(); ctx.clip();
      const gr = ctx.createLinearGradient(0, 440, 0, 610);
      gr.addColorStop(0, '#7a766a'); gr.addColorStop(1, '#3d3b33');
      ctx.fillStyle = gr; ctx.fillRect(x0 - 10, 420, x1 - x0 + 20, 200);
      for (let i = 0; i < 2600; i++) {
        const x = x0 + r() * (x1 - x0), y = 440 + r() * 170;
        const lit = fbm(n, x / 120 + y / 60) > 0.5;
        Art.stroke(ctx, x, y, 6 + r() * 26, 2 + r() * 6, (r() - 0.5) * 0.8, jit(lit ? '#a39b82' : '#4c4940', r, 18), 0.45);
      }
      for (let i = 0; i < 40; i++) { const x = x0 + r() * (x1 - x0), y = 450 + r() * 140; Art.line(ctx, x, y, x + (r() - 0.5) * 60, y + 10 + r() * 40, 1.5, '#2c2a24', 0.6); }
      for (let i = 0; i < 400; i++) { const x = x0 + r() * (x1 - x0); Art.dab(ctx, x, top(x) + Math.abs(gauss(r)) * 30, 2 + r() * 5, 1.5 + r() * 3, 0, jit(r() < 0.5 ? p.moss[0] : p.moss[1], r, 20), 0.8); }
      // birch roots gripping the edge
      for (let i = 0; i < 18; i++) { const x = x0 + r() * (x1 - x0); Art.wire(ctx, x, top(x), x + (r() - 0.5) * 40, top(x) + 20 + r() * 50, 6, '#2e2a22', 1.5); }
      ctx.restore();
      for (let x = x0; x < x1; x += 3) if (bot(x) > top(x) + 8) Art.grass(ctx, x, bot(x) + 2, 10 + r() * 14, r() < 0.5 ? '#d4bd70' : '#7c8c46', r, 2, 0.8);
    },
    playBack(ctx, W, r, w) {
      const p = w.L.pal, g = x => w.drawGroundAt(x);
      Scene.birches(ctx, 0, 4100, 34, x => g(x) - 4, [260, 460], p.birch, r, { light: 1 });
      Scene.birches(ctx, 4200, 5050, 8, x => g(x) - 4, [300, 480], p.birch, r, { light: 1 });
      Scene.birches(ctx, 5300, W, 14, x => g(x) - 4, [260, 440], p.birch, r, { light: 1 });
      // the machine's arm, reaching up from the plateau wall
      ctx.save(); ctx.translate(4230, 446); ctx.rotate(-0.25);
      Art.metal(ctx, -24, -210, 48, 210, '#6a6d5c', r, { panel: 50, moss: p.moss, stripes: p.stripes, stripeY: 20, stripeH: 10 });
      ctx.restore();
      // the plateau's rock face
      ctx.save(); ctx.beginPath(); ctx.moveTo(4150, 600); ctx.lineTo(4150, 588); ctx.lineTo(4172, 438); ctx.lineTo(4230, 450); ctx.lineTo(4230, 600); ctx.clip();
      for (let i = 0; i < 400; i++) Art.stroke(ctx, 4140 + r() * 100, 430 + r() * 170, 8 + r() * 20, 2 + r() * 4, Math.PI / 2 + (r() - 0.5), jit('#6d6a5c', r, 30), 0.6);
      ctx.restore();
    },
  },
},
// ===================================================================== III
{
  id: 3, seed: 37, title: 'Kärret', sub: 'The Marsh', date: 'October',
  width: 7000, top: 380, bumps: 6,
  pal: {
    horizon: 450, light: -1, haze: '#b6b3a9', lowHaze: 0.5,
    skyStops: [[-380, '#36434f'], [80, '#5b6a75'], [340, '#a3a49c'], [450, '#c8bfae'], [720, '#aeaaa0']],
    sun: { x: 0.2, y: 420, color: '#f1c39a', glow: 420, glowA: 0.4, disk: 0 },
    clouds: [
      { y: -160, h: 170, n: 1600, light: '#6c7882', dark: '#39424d', a: 0.06, rx: [120, 320], flat: 0.2 },
      { y: 260, h: 60, n: 600, light: '#d3c6b2', dark: '#8d8e8a', a: 0.06, rx: [60, 220], flat: 0.12 },
    ],
    ground: { kind: 'marsh', island: 40, fieldTop: '#57533d', fieldBottom: '#1f1f19', hi: '#b8b3a3', lo: '#2a2a20', puddle: '#8d9190', surfLight: '#98895b', surfShadow: '#3e3b2c', surfTop: '#a99a68', bandLow: '#33311f', band: 10, fieldTufts: 0.05, tuft: '#9a8a5c', tuft2: '#5f5a3c', tuftDensity: 0.25, tuftH: 30 },
    water: { top: '#8d908b', deep: '#262e33', glint: '#d8d0c0', dark: '#3a4246' },
    metal: { c: '#5d4d42', rust: '#9a4d2c', label: '#ddd3be', grime: '#27231f' },
    stripes: ['#c9772d', '#2a2622'], plank: '#6a5c4a', rock: '#6f6d66',
    fg: { col: '#23241c', col2: '#4e4a31', kind: 'reeds' },
    weather: { kind: 'drizzle', n: 60 },
    fog: [{ y: 450, h: 180, a: 0.5, speed: 5, after: 'far' }, { y: 520, h: 160, a: 0.42, speed: 8, after: 'mid' }, { y: 580, h: 140, a: 0.28, speed: 14, after: 'near' }],
    lampCol: '#ffcf8a',
  },
  waterLevel: 616,
  ground: [[0, 596], [7000, 598]],
  gaps: [
    { x0: 520, x1: 620, water: 616 }, { x0: 890, x1: 1520, water: 616 }, { x0: 1750, x1: 1860, water: 616 },
    { x0: 2100, x1: 2520, water: 616 }, { x0: 4560, x1: 4666, water: 616 }, { x0: 4980, x1: 5720, water: 616 }, { x0: 6100, x1: 6210, water: 616 },
  ],
  objects: [
    { t: 'plank', x: 880, w: 280, y: 584 }, { t: 'plank', x: 1244, w: 288, y: 584 },
    { t: 'metal', x: 2786, w: 74, h: 58, c: '#4c4a44' },
    { t: 'metal', x: 2860, w: 1650, h: 112, y: 486, c: '#5d4a3e', panel: 64, stripes: true, stripeY: 10, stripeH: 10,
      draw(ctx, o, r) {
        for (let x = o.x + 60; x < o.x + o.w - 40; x += 90) { Art.dab(ctx, x, o._y + 56, 7, 7, 0, '#2a2522', 1); Art.dab(ctx, x - 1, o._y + 55, 4, 4, 0, '#6c747a', 0.6); }
        ctx.font = 'bold 26px "Arial Narrow", Arial'; ctx.fillStyle = css('#dcd2bd', 0.55); ctx.fillText('NORRVÅG  II   ·   VÄSTERÅS', o.x + 520, o._y + 94);
      } },
    { t: 'metal', x: 2996, w: 64, h: 52, y: 436, c: '#4f4943' },
    { t: 'metal', x: 3060, w: 1180, h: 104, y: 382, c: '#6b5a4c', panel: 56 },
    { t: 'metal', x: 3806, w: 74, h: 72, y: 310, c: '#4f4943' },
    { t: 'metal', x: 3950, w: 80, h: 12, y: 158, c: '#4a413b', panel: 30, rivets: false,
      draw(ctx, o) { for (let x = o.x; x <= o.x + o.w; x += 8) Art.line(ctx, x, o._y, x, o._y - 14, 1.2, '#3a322c'); Art.line(ctx, o.x, o._y - 14, o.x + o.w, o._y - 14, 1.5, '#3a322c'); } },
    { t: 'metal', x: 3880, w: 270, h: 152, y: 230, c: '#7b6c5c', stripes: true, stripeY: 8, stripeH: 10,
      draw(ctx, o, r) {
        for (let i = 0; i < 5; i++) { ctx.fillStyle = css('#ffd89a', 0.75); ctx.fillRect(o.x + 22 + i * 48, o._y + 36, 30, 22); ctx.fillStyle = css('#3a3230', 0.6); ctx.fillRect(o.x + 36 + i * 48, o._y + 36, 2, 22); }
      } },
    { t: 'plank', x: 4990, w: 250, y: 584 }, { t: 'plank', x: 5470, w: 260, y: 584 },
  ],
  movers: [
    { x: 1776, y: 594, w: 56, h: 34, dy: 6, period: 2.6, kind: 'bob', art: 'drum' },
    { x: 2156, y: 594, w: 58, h: 34, dy: 7, period: 3.1, kind: 'bob', art: 'drum' },
    { x: 2270, y: 590, w: 58, h: 34, dy: 7, period: 2.7, kind: 'bob', art: 'drum', phase: 0.3 },
    { x: 2386, y: 594, w: 58, h: 34, dy: 7, period: 3.3, kind: 'bob', art: 'drum', phase: 0.6 },
    { x: 5320, y: 588, w: 90, h: 10, dx: 0, dy: 6, period: 2.8, kind: 'bob', art: 'plank' },
  ],
  lamps: [[3120, 330], [3480, 330], [3840, 330], [4190, 330], [4000, 180], [1000, 520], [1400, 520], [5100, 520], [5600, 520], [6600, 520]],
  robot: [260, 720, 1400, 1660, 1990, 2620, 3300, 3990, 4420, 4860, 5350, 5900, 6750],
  lines: [
    [150, 'In October it led me out past the marsh. Mom thought I was at Johan’s.'],
    [1340, 'The fog swallowed sound. Even its beeping came back to me soft.'],
    [2640, 'The ship had lain in the reeds since the seventies. Everyone just called it Båten.'],
    [3900, 'On deck the lamps were still lit. Nobody ever found out where the power came from.'],
    [5500, 'It was getting dark. I should have gone home.'],
  ],
  photos: [[1320, 'The boardwalk, in fog'], [3990, 'From the crow’s nest, at dusk'], [4110, 'On Båten’s roof'], [6450, 'The lamps, still on']],
  exit: 6860,
  paint: {
    far(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(51);
      Scene.waterBand(ctx, 0, W, 458, 40, '#b7b3a7', '#e6dfd0', r);
      for (let i = 0; i < 10; i++) {
        const x = r() * W, ww = 60 + r() * 200;
        const f = xx => 458 - Math.max(0, 1 - Math.abs(xx - x) / ww) * (10 + r() * 3) ;
        Art.ridge(ctx, x - ww, x + ww, f, 460, hz('#4e5550', p, 0.55), r);
        Scene.forest(ctx, x - ww * 0.8, x + ww * 0.8, f, hz('#474e4a', p, 0.55), r, { h: [8, 20], step: 4, n });
      }
      Scene.pylons(ctx, 60, W, 260, x => 460, 90, hz('#4d5456', p, 0.55), 1, hz('#4d5456', p, 0.5), 10, r);
    },
    mid(ctx, W, r, w) {
      const p = w.L.pal;
      Scene.waterBand(ctx, 0, W, 492, 60, hz('#8f918b', p, 0.2), '#d8d0bf', r);
      // another stranded hull, far out
      const hx = W * 0.62;
      ctx.fillStyle = css(hz('#4a3f38', p, 0.45));
      ctx.beginPath(); ctx.moveTo(hx - 260, 498); ctx.lineTo(hx - 230, 440); ctx.lineTo(hx + 240, 446); ctx.lineTo(hx + 280, 500); ctx.fill();
      ctx.fillRect(hx - 60, 380, 120, 64); ctx.fillRect(hx + 10, 330, 12, 60);
      for (let i = 0; i < 4; i++) Art.dab(ctx, hx - 40 + i * 26, 400, 3, 3, 0, '#ffcf8a', 0.9);
      for (let i = 0; i < 40; i++) { const x = r() * W; Art.reeds(ctx, x, 494, 20, hz('#6c6446', p, 0.45), r, 12); }
      for (let i = 0; i < 12; i++) { const x = r() * W; Art.bareTree(ctx, x, 496, 40 + r() * 50, hz('#3b3a33', p, 0.45), r); }
    },
    near(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(61);
      Scene.waterBand(ctx, 0, W, 540, 180, hz('#7f837f', p, 0.1), '#cdc5b5', r);
      for (let i = 0; i < 9; i++) {
        const x = r() * W, ww = 100 + r() * 240;
        Art.ridge(ctx, x - ww, x + ww, xx => 544 - Math.max(0, 1 - Math.abs(xx - x) / ww) * 16 + fbm(n, xx / 40) * 4, 560, '#5e583c', r, { tex: 1, jit: 16 });
        for (let k = 0; k < ww / 10; k++) Art.reeds(ctx, x + gauss(r) * ww * 0.6, 544, 40 + r() * 20, hz('#8b7f55', p, 0.2), r, 6);
        if (r() < 0.6) Art.bareTree(ctx, x, 540, 60 + r() * 60, hz('#2f2e28', p, 0.3), r);
      }
      Scene.poles(ctx, 200, W, 300, x => 548, 110, hz('#3a352c', p, 0.3), 3, hz('#3a352c', p, 0.3), r);
    },
    playBack(ctx, W, r, w) {
      const p = w.L.pal, g = x => w.drawGroundAt(x);
      for (let x = 0; x < W; x += 30 + r() * 60) if (!w.inGap(x)) Art.reeds(ctx, x, g(x) + 4, 60 + r() * 50, r() < 0.5 ? '#8f8158' : '#6c6545', r, 10, 0.9);
      for (const x of [300, 1650, 2640, 4760, 5900, 6400]) Art.bareTree(ctx, x, g(x) + 2, 140 + r() * 80, '#2f2d27', r);
      // ship: mast, rails, lamp posts
      Art.line(ctx, 3980, 230, 3990, -260, 6, '#3d3632');
      Art.line(ctx, 3930, -150, 4050, -150, 4, '#3d3632');
      Art.wire(ctx, 3990, -250, 3070, 380, 10, '#2e2926', 1.5);
      Art.wire(ctx, 3990, -250, 4230, 380, 10, '#2e2926', 1.5);
      Art.dab(ctx, 3990, -262, 3, 3, 0, '#e2574b', 1);
      for (const [lx, ly] of [[3120, 382], [3480, 382], [3840, 382], [4190, 382]]) Scene.standingLamp(ctx, lx - 14, ly, 52, '#2f2a27', '#ffe6b0');
      for (const [lx] of [[1000], [1400], [5100], [5600], [6600]]) Scene.standingLamp(ctx, lx - 14, 590, 70, '#2f2a27', '#ffe6b0');
      Scene.standingLamp(ctx, 3986, 230, 50, '#2f2a27', '#ffe6b0');
      // an anchor chain down into the water
      for (let i = 0; i < 26; i++) Art.dab(ctx, 2870 + i * 3, 500 + i * 5, 3, 2, 0.7, '#2f2825', 1);
    },
    playMid(ctx, W, r, w) {
      for (let x = 3066; x < 4236; x += 14) Art.line(ctx, x, 382, x, 364, 1.5, '#3a322c');
      Art.line(ctx, 3062, 364, 4238, 364, 2, '#3a322c');
    },
  },
},
// ====================================================================== IV
{
  id: 4, seed: 41, title: 'Anläggningen', sub: 'The Facility', date: 'November',
  width: 6600, top: 420, bumps: 2,
  pal: {
    horizon: 470, light: 1, haze: '#3a3c46', lowHaze: 0.35, night: true,
    skyStops: [[-420, '#060a12'], [60, '#0f1624'], [360, '#262d3e'], [470, '#403d44'], [720, '#1f2127']],
    sun: { x: 0.62, y: 480, color: '#c68550', glow: 620, glowA: 0.4, disk: 0 },
    clouds: [
      { y: 140, h: 130, n: 900, light: '#3e3c44', dark: '#131824', a: 0.08, rx: [120, 300], flat: 0.2 },
      { y: -200, h: 120, n: 400, light: '#1b2230', dark: '#0a0e16', a: 0.08, rx: [120, 300], flat: 0.2 },
    ],
    ground: { kind: 'asphalt', fieldTop: '#43464e', fieldBottom: '#15161a', hi: '#9aa0ab', lo: '#0e0f12', surfLight: '#b7bcc4', surfShadow: '#4f535c', surfTop: '#d6d9df', bandLow: '#3a3d44', band: 10, fieldTufts: 0.01 },
    snow: { c: '#c9cdd5', s: '#707683' },
    metal: { c: '#4b5256', rust: '#7a4a30', label: '#c8c6be', grime: '#15171a' },
    stripes: ['#d0892f', '#1f1f1f'], concrete: '#6a6c70', pipe: '#50585c', plank: '#474c52',
    fg: { col: '#0c0d10', col2: '#1d1f24', kind: 'fence' },
    weather: { kind: 'snow', n: 160, wind: 22, fall: 50 },
    fog: [{ y: 480, h: 180, a: 0.2, speed: 5, after: 'far', tint: '#8a6a58' }],
    lampCol: '#ffb65c', breath: true,
  },
  ground: [[0, 600], [800, 600], [1200, 592], [2000, 592], [2400, 600], [3600, 596], [4400, 592], [5000, 600], [6600, 600]],
  gaps: [],
  objects: [
    { t: 'concrete', x: 780, w: 130, h: 62 }, { t: 'concrete', x: 910, w: 150, h: 122 },
    { t: 'plank', x: 1060, w: 460, y: 478, c: '#4a5055', piles: false },
    { t: 'pipe', x: 1520, w: 120, h: 20, y: 540 },
    { t: 'metal', x: 2150, w: 420, h: 212, stripes: true, stripeY: 16, label: 'HALL 3  —  OBEHÖRIGA ÄGA EJ TILLTRÄDE', labelSize: 13, labelY: 60, c: '#4a5256',
      draw(ctx, o, r) {
        for (let i = 0; i < 6; i++) { ctx.fillStyle = css('#8fd7f2', 0.45); ctx.fillRect(o.x + 30 + i * 64, o._y + 110, 40, 26); }
      } },
    { t: 'pipe', x: 2780, w: 150, h: 20, y: 500 }, { t: 'pipe', x: 3040, w: 130, h: 20, y: 470 }, { t: 'pipe', x: 3280, w: 150, h: 20, y: 500 },
    { t: 'plank', x: 3700, w: 250, y: 360, c: '#4a5055', piles: false }, { t: 'plank', x: 4050, w: 300, y: 360, c: '#4a5055', piles: false },
    { t: 'concrete', x: 4350, w: 200, h: 150 }, { t: 'concrete', x: 4550, w: 120, h: 80 },
    { t: 'concrete', x: 5000, w: 140, h: 60 }, { t: 'metal', x: 5140, w: 110, h: 110, c: '#445057', label: 'T-7', labelSize: 20 },
    { t: 'plank', x: 3470, w: 100, y: 280, c: '#4a5055', piles: false },
    // cover from the searchlight
    { t: 'metal', x: 5560, w: 58, h: 72, c: '#4d4a44', stripes: true, stripeY: 8, stripeH: 8 },
    { t: 'metal', x: 5880, w: 62, h: 76, c: '#46505a' },
    { t: 'metal', x: 6170, w: 58, h: 72, c: '#4d4a44', stripes: true, stripeY: 8, stripeH: 8 },
  ],
  movers: [
    { x: 2040, y: 586, w: 96, h: 14, dy: -210, period: 7, art: 'lift', tail: 40 },
    { x: 3580, y: 586, w: 100, h: 14, dy: -232, period: 7.5, art: 'lift', tail: 40, phase: 0.5 },
  ],
  hazards: [
    { x: 1720, y0: 440, period: 3, on: 1.1, phase: 0 },
    { x: 2980, y0: 400, period: 2.6, on: 1.0, phase: 0.4 },
    { x: 3230, y0: 400, period: 2.6, on: 1.0, phase: 0.0 },
    { x: 4780, y0: 440, period: 2.8, on: 1.2, phase: 0.2 },
    { x: 5420, y0: 440, period: 2.2, on: 1.0, phase: 0.6 },
  ],
  lamps: [[700, 470], [1300, 400], [1900, 470], [2360, 330], [2750, 470], [3500, 470], [3830, 290], [4200, 290], [4900, 470], [5700, 470], [6300, 470]],
  robot: [300, 980, 1400, 1900, 2360, 2700, 3130, 3850, 4250, 4560, 5190, 5800, 6420],
  lines: [
    [150, 'November. The fence had a hole in it. Everyone knew about the hole.'],
    [1200, 'Inside, everything hummed. My teeth hummed.'],
    [2760, 'Blue light moved through the pipes, slow, like something breathing.'],
    [4300, 'The little machine walked faster now. It knew the way.'],
    [5600, 'Past the last hall there was only the dark, and the tower, and snow starting.'],
  ],
  photos: [[2380, 'The roof of Hall 3'], [3515, 'Above the halls, everything humming'], [4200, 'Blue light in the pipes'], [5860, 'The tower, close enough to touch']],
  exit: 6480,
  search: { sx: 5250, sy: 380, x0: 5470, x1: 6320, period: 11, r: 55 },
  paint: {
    far(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(71);
      const fy = x => 470 - fbm(n, x / 200) * 18;
      Art.ridge(ctx, 0, W, fy, 720, '#15181f', r);
      Scene.forest(ctx, 0, W, fy, '#14171e', r, { h: [8, 18], step: 3, n });
      for (let i = 0; i < 14; i++) {
        const x = r() * W, h = 20 + r() * 60, ww = 30 + r() * 80;
        ctx.fillStyle = css('#1c2029'); ctx.fillRect(x, 470 - h, ww, h);
        for (let k = 0; k < ww / 8; k++) if (r() < 0.4) Art.dab(ctx, x + 4 + k * 8, 470 - h + 6 + r() * (h - 10), 1.2, 1.2, 0, r() < 0.7 ? '#ffb65c' : '#9fd8ff', 0.8);
      }
      for (const [x, h] of [[0.3, 190], [0.75, 150]]) {
        Art.line(ctx, W * x, 470, W * x, 470 - h, 4, '#1e222b');
        Art.dab(ctx, W * x, 470 - h, 2.5, 2.5, 0, '#ff4a3a', 1);
        Art.plume(ctx, W * x, 470 - h, 6, 180, { drift: 1.2, light: '#6d5e5a', dark: '#2a2a33', a: 0.07, n: 120 }, r);
      }
    },
    mid(ctx, W, r, w) {
      const p = w.L.pal;
      for (const [x, h] of [[0.22, 300], [0.36, 330], [0.83, 290]]) {
        Art.coolingTower(ctx, W * x, 520, h, p, r, { col: '#3a3f4a', light: 1, lit: 0.3, dark: 0.45, steam: { drift: 0.9, light: '#8b7568', dark: '#2c2e38', a: 0.06, n: 300 } });
      }
      for (let i = 0; i < 10; i++) {
        const x = r() * W, h = 60 + r() * 100, ww = 120 + r() * 200;
        ctx.fillStyle = css('#252a33'); ctx.fillRect(x, 520 - h, ww, h + 10);
        for (let k = 0; k < ww / 14; k++) if (r() < 0.35) { ctx.fillStyle = css(r() < 0.6 ? '#ffc070' : '#8fd6ff', 0.7); ctx.fillRect(x + 6 + k * 14, 520 - h + 12 + ((r() * (h / 20)) | 0) * 20, 6, 8); }
      }
      Art.ridge(ctx, 0, W, x => 522, 720, '#2c2f37', r, { tex: 1, topCol: '#686d78', jit: 10 });
    },
    near(ctx, W, r, w) {
      const p = w.L.pal;
      const sx = W * 0.55;
      Art.sphere(ctx, sx, 150, 150, { col: '#3c4450', hi: '#a7b4c4', dark: '#141820', seam: '#0c1016', rim: '#20262f', light: 1, ground: '#5a4a44', rimLight: '#ffb86a' });
      for (const dx of [-120, 0, 120]) Art.line(ctx, sx + dx, 300, sx + dx * 1.7, 560, 10, '#1c2027');
      Scene.pylons(ctx, 100, W, 520, x => 566, 220, '#20242c', 2, '#20242c', 18, r);
      Art.ridge(ctx, 0, W, x => 564, 720, '#3a3e47', r, { tex: 1, topCol: '#8b919c', jit: 8 });
      Art.fence(ctx, 0, W, x => 566, '#1f232a', r, { h: 50, gap: 60, wireCol: '#2a2f38' });
    },
    playBack(ctx, W, r, w) {
      const g = x => w.drawGroundAt(x);
      // chain-link fence, with the hole
      for (let x = 0; x < 700; x += 70) {
        Art.line(ctx, x, g(x) + 4, x, g(x) - 110, 4, '#2a2e35');
        if (x < 630 && (x < 440 || x > 560)) {
          ctx.strokeStyle = css('#4a505a', 0.55); ctx.lineWidth = 1; ctx.beginPath();
          for (let k = 0; k < 70; k += 8) { ctx.moveTo(x + k, g(x) - 110); ctx.lineTo(x + k + 40, g(x)); ctx.moveTo(x + k + 40, g(x) - 110); ctx.lineTo(x + k, g(x)); }
          ctx.stroke();
        }
      }
      Art.wire(ctx, 0, 480, 700, 480, 2, '#2a2e35', 2);
      ctx.fillStyle = css('#d8c43a'); ctx.fillRect(220, 520, 50, 36);
      ctx.fillStyle = css('#1a1a1a'); ctx.font = 'bold 22px Arial'; ctx.fillText('⚠', 233, 548);
      // pipes along the back wall with blue light inside
      for (const [y, x0, x1] of [[430, 1100, 2100], [300, 2600, 4400], [420, 4300, 6000]]) {
        Art.pipe(ctx, x0, y, x1 - x0, 26, { c: '#3a4146', rust: '#5f3b28' }, r);
        for (let x = x0 + 20; x < x1; x += 130) Art.dab(ctx, x, y + 13, 30, 3, 0, '#7fe0ff', 0.35);
        for (let x = x0 + 60; x < x1; x += 200) Art.line(ctx, x, y + 26, x, g(x) + 4, 5, '#2b3036');
      }
      for (const [x, y] of w.L.lamps) Scene.standingLamp(ctx, x - 14, (y > 400 ? g(x) + 4 : y + 60), y > 400 ? g(x) - y + 10 : 60, '#1d2026', '#ffe2b0');
      // the exit door
      ctx.fillStyle = css('#2a2f36'); ctx.fillRect(6360, g(6400) - 140, 150, 144);
      ctx.fillStyle = css('#ffcf8a', 0.25); ctx.fillRect(6400, g(6400) - 100, 70, 104);
    },
  },
},
// ======================================================================= V
{
  id: 5, seed: 53, title: 'Klotet', sub: 'The Sphere', date: 'The first snow',
  width: 6300, top: 520, bumps: 7,
  pal: {
    horizon: 470, light: 1, haze: '#e6c3b3', lowHaze: 0.35,
    skyStops: [[-520, '#1c2744'], [-60, '#3a4a6c'], [240, '#8a7e92'], [400, '#e0a488'], [470, '#f6cb9e'], [720, '#dcc0b4']],
    sun: { x: 0.82, y: 468, color: '#ffd3a2', glow: 640, glowA: 0.75, disk: 24, rim: '#ffd8b8' },
    clouds: [
      { y: 120, h: 50, n: 600, light: '#f3b7a2', dark: '#6b6784', a: 0.06, rx: [100, 280], flat: 0.08 },
      { y: 330, h: 30, n: 400, light: '#ffd9b8', dark: '#b48a8c', a: 0.08, rx: [60, 220], flat: 0.08 },
      { y: -200, h: 120, n: 700, light: '#4c5677', dark: '#232c48', a: 0.05, rx: [120, 300], flat: 0.12 },
    ],
    ground: { kind: 'snow', fieldTop: '#f1e3de', fieldBottom: '#a9aac4', hi: '#fff6f0', lo: '#8f95b8', surfLight: '#fbe9df', surfShadow: '#8e94b4', surfTop: '#fff5ee', bandLow: '#aeb0c8', band: 16, tuft: '#7a6a5a', tuftDensity: 0.02, sparkle: true },
    snow: { c: '#f8eae2', s: '#9ea3c0' },
    metal: { c: '#5a5f6e', rust: '#8a4e36', label: '#eee2d6', grime: '#2c2e3c' },
    stripes: ['#e08c3a', '#2a2a2e'], rock: '#7d7a86',
    fg: { col: '#2a2838', col2: '#5c5566', kind: 'grass' },
    weather: { kind: 'snow', n: 200, wind: -6, fall: 30, rise: 3000 },
    fog: [{ y: 480, h: 150, a: 0.25, speed: 4, after: 'far' }],
    breath: true, lowGrav: 3000,
  },
  ground: [[0, 600], [600, 592], [1200, 566], [1800, 530], [2300, 508], [2640, 510], [2800, 510], [3200, 486], [3440, 478], [5600, 470], [6300, 470]],
  gaps: [{ x0: 2650, x1: 2760 }, { x0: 3460, x1: 5560, void: true }],
  objects: [
    { t: 'rock', x: 900, w: 80, h: 46 },
    { t: 'metal', x: 1380, w: 70, h: 60, c: '#5a5f6e' },
    { t: 'rock', x: 2100, w: 96, h: 60 },
    { t: 'metal', x: 3150, w: 110, h: 50, c: '#5a5f6e', stripes: true, stripeY: 6, stripeH: 10 },
  ],
  movers: [
    { x: 3560, y: 440, w: 90, h: 26, dy: 14, period: 4.2, kind: 'bob', art: 'debris' },
    { x: 3800, y: 390, w: 80, h: 26, dy: 18, period: 5, kind: 'bob', art: 'rock', phase: 0.3 },
    { x: 4040, y: 350, w: 100, h: 26, dy: 16, dx: 40, period: 6, kind: 'bob', art: 'debris', phase: 0.6 },
    { x: 4320, y: 400, w: 80, h: 26, dy: 20, period: 4.6, kind: 'bob', art: 'rock', phase: 0.1 },
    { x: 4560, y: 330, w: 110, h: 26, dy: 14, period: 5.4, kind: 'bob', art: 'debris', phase: 0.8 },
    { x: 4840, y: 380, w: 80, h: 26, dy: 18, period: 4.4, kind: 'bob', art: 'rock', phase: 0.4 },
    { x: 5100, y: 420, w: 100, h: 26, dy: 14, dx: -30, period: 5.8, kind: 'bob', art: 'debris', phase: 0.2 },
    { x: 5380, y: 440, w: 90, h: 26, dy: 12, period: 4.8, kind: 'bob', art: 'rock', phase: 0.7 },
  ],
  robot: [300, 1100, 1900, 2500, 2960, 3380, 5700, 5980],
  lines: [
    [150, 'The first snow came in the night. By dawn it had stopped.'],
    [1500, 'There were no tracks ahead of us. Only its small ones, and then mine.'],
    [3000, 'Near the top the snow started falling upward.'],
  ],
  photos: [[1420, 'The last of the machines'], [2520, 'First light on the snow'], [3200, 'The last hill, before the edge'], [5700, 'Klotet']],
  exit: 5760,
  sphere: { x: 5960, y: 150, R: 250 },
  ending: true,
  paint: {
    far(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(81);
      const fy = x => 468 - fbm(n, x / 180) * 24;
      Art.ridge(ctx, 0, W, fy, 720, hz('#5a5d7c', p, 0.5), r, { tex: 1, jit: 8, texA: 0.2 });
      Scene.forest(ctx, 0, W, fy, hz('#4d5070', p, 0.5), r, { h: [6, 14], step: 3, n });
      const tx = W * 0.2;
      const steam = { drift: -0.9, light: '#ffe2cc', dark: '#a79aae', a: 0.05, n: 300 };
      for (const [dx, h] of [[0, 110], [76, 126]]) Art.coolingTower(ctx, tx + dx, 470, h, p, r, { col: hz('#8b8aa0', p, 0.3), light: 1, steam });
    },
    mid(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(83);
      const fy = x => 508 - fbm(n, x / 240) * 40;
      Scene.forest(ctx, 0, W, fy, hz('#343a55', p, 0.35), r, { h: [20, 56], step: 6, n, light: 1, lightCol: '#ffcfa8', lightA: 0.35, snow: '#f4e4de' });
      Art.ridge(ctx, 0, W, x => fy(x) + 10, 720, '#e4d4d0', r, { tex: 1.2, topCol: '#fbe6da', botCol: '#9ea3c0', jit: 6 });
      Scene.pylons(ctx, 60, W * 0.7, 380, x => fy(x) + 14, 140, hz('#3e4260', p, 0.4), 1.3, hz('#3e4260', p, 0.35), 12, r);
    },
    near(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(89);
      const fy = x => 540 + fbm(n, x / 260) * 24 - x / W * 30;
      for (let i = 0; i < 22; i++) { const x = r() * W; Art.pine(ctx, x, fy(x) + 4, 50 + r() * 90, hz('#2c3048', p, 0.2), r, { light: 1, lightCol: '#ffc9a0', lightA: 0.35, snow: '#f7e8e0' }); }
      Art.ridge(ctx, 0, W, fy, 720, '#eadcd8', r, { tex: 1.5, topCol: '#fff0e6', botCol: '#9ea3c0', jit: 6, texA: 0.25 });
      Art.walker(ctx, W * 0.3, fy(W * 0.3) + 6, 360, hz('#3a3c52', p, 0.35), r, { lit: '#ffcfa8' });
      Scene.rays(ctx, W, W * 0.85, 440, '#ffd2a8', r, 10, 0.04);
    },
    playBack(ctx, W, r, w) {
      const p = w.L.pal, g = x => w.drawGroundAt(x);
      Scene.forest(ctx, 100, 3300, x => g(x) - 4, '#262a3e', r, { h: [80, 200], step: 90, light: 1, lightCol: '#ffcaa0', lightA: 0.4, snow: '#fbeae2' });
      Scene.poles(ctx, 60, 3300, 380, x => g(x) - 6, 140, '#322e36', 4, '#28242c', r);
      // the ground beyond the edge has lifted, in pieces, into the air
      for (let i = 0; i < 70; i++) {
        const x = 3500 + r() * 2100, y = 120 + r() * 520, s = 4 + r() * 16;
        Art.rock(ctx, x, y, s * 2, s, { c: hz('#6e6a7a', p, 0.3 + r() * 0.3), light: 1, snow: p.snow }, r);
      }
      // cliff faces at the edge of the void
      for (const [x0, dir] of [[3462, -1], [5558, 1]]) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(x0, 480); ctx.lineTo(x0 + dir * 60, 720); ctx.lineTo(x0 - dir * 40, 720); ctx.lineTo(x0 - dir * 40, 470); ctx.closePath(); ctx.clip();
        for (let i = 0; i < 300; i++) Art.stroke(ctx, x0 - 50 + r() * 120, 470 + r() * 260, 8 + r() * 30, 2 + r() * 5, Math.PI / 2 + (r() - 0.5) * 0.8, mono(mix('#6c6780', '#9a98ae', r()), r, 16), 0.7);
        ctx.restore();
      }
    },
  },
},
// ====================================================================== VI
{
  id: 6, seed: 67, title: 'Tövädret', sub: 'The Thaw', date: 'April, years later',
  width: 4500, top: 200, bumps: 8,
  pal: {
    horizon: 450, light: -1, haze: '#dcdcd0', lowHaze: 0.3,
    skyStops: [[-200, '#8ea2b2'], [120, '#b1bec5'], [360, '#dcdbd0'], [450, '#ece7d8'], [720, '#e3dfd2']],
    sun: { x: 0.3, y: 320, color: '#fff2da', glow: 440, glowA: 0.5, disk: 22, diskA: 0.7, rim: '#fbf4e6' },
    clouds: [
      { y: 60, h: 100, n: 1100, light: '#c3cbcf', dark: '#93a0a9', a: 0.05, rx: [90, 280], flat: 0.14 },
      { y: 280, h: 40, n: 500, light: '#f0ebe0', dark: '#bfc2bd', a: 0.06, rx: [60, 220], flat: 0.12 },
    ],
    ground: { kind: 'grass', fieldTop: '#868c58', fieldBottom: '#363b24', hi: '#c9cf8f', lo: '#3e4428', surfLight: '#b6bb78', surfShadow: '#5b663a', surfTop: '#cbd08c', bandLow: '#4c5431', band: 12, tuft: '#b8a96c', tuft2: '#7d8f45', tuftDensity: 0.18, tuftH: 16, fieldTufts: 0.03 },
    birch: { bark: '#ece6d6', barkDark: '#2b2a26', barkShade: '#9a917f', leaf: '#a9bb64', leafLight: '#e2eba0', leafDark: '#6c7d40' },
    metal: { c: '#6a6c66', rust: '#8e4f2c', label: '#e7e2d4', grime: '#39383a' },
    stripes: ['#d9892f', '#2b2b2a'], concrete: '#9a9a92', rock: '#7e8078',
    fg: { col: '#2e3320', col2: '#6a7040', kind: 'grass' },
    weather: { kind: 'motes', n: 45 },
    fog: [{ y: 470, h: 150, a: 0.28, speed: 5, after: 'far' }],
  },
  ground: [[0, 590], [300, 585], [700, 592], [1100, 578], [1500, 566], [1900, 572], [2300, 588], [2700, 586], [3100, 578], [3700, 582], [4100, 572], [4500, 572]],
  gaps: [],
  objects: [
    // where SV-14 lay: a slab, and the footing its leg stood on
    { t: 'concrete', x: 3140, w: 720, h: 14, sink: 8, c: '#9c9b92',
      draw(ctx, o, r) {
        for (let i = 0; i < 70; i++) Art.stroke(ctx, o.x + 20 + r() * (o.w - 40), o._y + 2, 6 + r() * 26, 2 + r() * 5, 0, '#8e4f2c', 0.18);
        for (let i = 0; i < 90; i++) Art.grass(ctx, o.x + r() * o.w, o._y + 2, 6 + r() * 8, r() < 0.5 ? '#9fb05a' : '#7d8f45', r, 3, 0.8);
      } },
    { t: 'concrete', x: 3250, w: 70, h: 26, c: '#a3a299' },
  ],
  robot: [],
  lines: [
    [140, 'April. Years later. I came back the spring they sold the farm.'],
    [1250, 'They cleared the machines away the summer after I moved. Nobody asked us.'],
    [2550, 'Where SV-14 used to lie there is only a square of paler grass.'],
    [3950, 'Sometimes, in the photographs, I think I can see a small red light.'],
  ],
  photos: [[900, 'The house, sold'], [3500, 'Where SV-14 used to lie'], [4200, 'The towers, gone quiet']],
  exit: 4380,
  train: { y: 448, speed: 55, gap: 1800 },
  last: true,
  paint: {
    far(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(5);
      Art.ridge(ctx, 0, W, x => 452, 720, '#cfd3cc', r);
      Scene.waterBand(ctx, 0, W, 452, 6, '#c3cbc9', '#f4f2ea', r);
      const fy = x => 446 - fbm(n, x / 160) * 22 - Math.max(0, Math.sin(x / 260)) * 8;
      Art.ridge(ctx, 0, W, fy, 720, hz('#5a6560', p, 0.55), r, { tex: 1, jit: 8, texA: 0.2 });
      Scene.forest(ctx, 0, W, fy, hz('#52605a', p, 0.52), r, { h: [5, 14], step: 3, n });
      // the towers are still there; they no longer breathe
      const tx = W * 0.64;
      for (const [dx, h] of [[0, 128], [86, 146], [168, 120]]) Art.coolingTower(ctx, tx + dx, 450, h, p, r, { col: hz('#9ea4a6', p, 0.3), light: -1 });
      Art.line(ctx, W * 0.33, 450, W * 0.33, 300, 1.6, hz('#5e676e', p, 0.5));
    },
    mid(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(9);
      const fy = x => 488 - fbm(n, x / 220) * 38;
      Scene.forest(ctx, 0, W, fy, hz('#34423a', p, 0.36), r, { h: [22, 58], step: 5, n, light: -1, lightCol: '#e8eadc', lightA: 0.2 });
      const sy = x => 500 + fbm(n, x / 300 + 40) * 10;
      Art.ridge(ctx, 0, W, sy, 720, '#9aa06a', r, { tex: 1.2, topCol: '#b9bf85', botCol: '#6f7748', jit: 10, texA: 0.25 });
      for (let i = 0; i < 40; i++) { const x = r() * W; Art.dab(ctx, x, sy(x) + 4 + r() * 20, 20 + r() * 60, 2 + r() * 3, 0, '#eef0ea', 0.7); }
      Art.house(ctx, W * 0.14, sy(W * 0.14) + 4, 46, 26, { wall: hz('#8e3a2c', p, 0.3), roof: hz('#3e3b3a', p, 0.3), trim: '#e8e4da', window: '#e9b86a' }, r);
      Scene.pylons(ctx, 180, W, 420, x => sy(x) + 2, 150, hz('#454d52', p, 0.45), 1.3, hz('#454d52', p, 0.35), 14, r);
    },
    near(ctx, W, r, w) {
      const p = w.L.pal, n = makeNoise(21);
      const fy = x => 548 + fbm(n, x / 260) * 22;
      for (let i = 0; i < 7; i++) { const x = r() * W; for (let k = 0; k < 2 + r() * 3; k++) { const xx = x + gauss(r) * 50; Art.birch(ctx, xx, fy(xx) + 3, 110 + r() * 110, p.birch, r, { fade: p.haze, fadeT: 0.3, light: -1, leafy: 0.4 }); } }
      for (let i = 0; i < 16; i++) { const x = r() * W; Art.pine(ctx, x, fy(x) + 4, 50 + r() * 80, hz('#2f3a33', p, 0.3), r, { light: -1, lightCol: '#e7e8e2', lightA: 0.2 }); }
      Art.ridge(ctx, 0, W, fy, 720, '#8e9460', r, { tex: 1.5, topCol: '#b8be80', botCol: '#4e5532', jit: 12, texA: 0.25 });
      for (let i = 0; i < 30; i++) { const x = r() * W; Art.dab(ctx, x, fy(x) + 6 + r() * 30, 30 + r() * 80, 3 + r() * 5, 0, '#f0f1ec', 0.75); }
      Art.fence(ctx, 0, W, x => fy(x) + 8, hz('#4a4036', p, 0.3), r, { h: 22, gap: 40, wireCol: hz('#4a4036', p, 0.5) });
    },
    playBack(ctx, W, r, w) {
      const g = x => w.drawGroundAt(x);
      Art.house(ctx, 110, g(200) + 8, 150, 88, { wall: '#8c3527', roof: '#393534', trim: '#ece8de', window: '#3a4450' }, r);
      // a sign by the road
      Art.line(ctx, 330, g(330) + 4, 330, g(330) - 46, 3, '#4d4135'); Art.line(ctx, 372, g(372) + 4, 372, g(372) - 46, 3, '#4d4135');
      ctx.fillStyle = css('#f2eee2'); ctx.fillRect(322, g(350) - 70, 58, 26);
      ctx.fillStyle = css('#a33a2a'); ctx.font = 'bold 12px Arial'; ctx.fillText('TILL SALU', 325, g(350) - 52);
      Scene.poles(ctx, 40, W, 360, x => g(x) - 10, 150, '#3e3830', 4, '#2f2b27', r);
      Art.fence(ctx, 420, 1560, x => g(x) - 2, '#4d4135', r, { h: 30, gap: 50, wireCol: '#5a4c3e' });
      Scene.birches(ctx, 1900, 2300, 3, x => g(x) - 4, [220, 360], w.L.pal.birch, r, { light: -1, leafy: 0.4 });
      Scene.birches(ctx, 4000, 4300, 2, x => g(x) - 4, [240, 360], w.L.pal.birch, r, { light: -1, leafy: 0.4 });
    },
    playFront(ctx, W, r, w) {
      // the last of the snow, lying in the field in soft grey-white islands
      const g = x => w.drawGroundAt(x);
      for (let i = 0; i < 34; i++) {
        const x = r() * W, d = r(), y = g(x) + 14 + d * d * 110, rx = 30 + d * 140 + r() * 40, ry = 2 + d * 9;
        for (let k = 0; k < 16; k++) Art.dab(ctx, x + gauss(r) * rx * 0.6, y + gauss(r) * ry * 0.5, rx * (0.2 + r() * 0.3), ry * (0.5 + r() * 0.5), 0, r() < 0.25 ? '#c8cfd8' : '#eef0eb', 0.55);
        for (let k = 0; k < 5; k++) Art.grass(ctx, x + gauss(r) * rx * 0.6, y, 6 + d * 18, '#b8a96c', r, 3, 0.8);
      }
    },
  },
},
];
