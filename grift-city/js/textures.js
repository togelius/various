// GRIFT CITY — every texture is painted at runtime onto a 512² canvas. Alpha carries the emissive mask
// (lit windows, neon, signs) and is written straight into ImageData so the canvas never premultiplies it.
'use strict';
const TEX = (() => {
  const S = 512;
  const layers = []; const names = {};
  function add(name, painter) {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g._lit = [];
    painter(g, M.rng(layers.length * 7919 + 13));
    names[name] = layers.length; layers.push(g._out || finish(g, g._lit));
  }
  // Bake the emissive rectangles into alpha and hand back raw ImageData.
  function finish(g, rects, base = 0) {
    const id = g.getImageData(0, 0, S, S), d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = base;
    for (const [x, y, w, h] of rects) for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(S, y + h); yy++) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(S, x + w); xx++) d[(yy * S + xx) * 4 + 3] = 255;
    return id;
  }
  const grain = (g, r, count = 20000, alpha = 0.07, size = 2) => { for (let i = 0; i < count; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`; g.fillRect(r() * S, r() * S, size, size); } };
  const noise = (g, r, amount, count = 8000) => { for (let i = 0; i < count; i++) { const v = Math.floor(r() * amount); g.fillStyle = `rgba(${v},${v},${v},${0.2 + r() * 0.5})`; g.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 4); } };
  const cracks = (g, r, n = 6, col = 'rgba(0,0,0,0.5)') => { g.strokeStyle = col; g.lineWidth = 1.5; for (let i = 0; i < n; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8 + r() * 10; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } };
  const stains = (g, r, n = 8, col = 'rgba(0,0,0,0.18)') => { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 50, 6 + r() * 30, r() * 3, 0, 7); g.fill(); } };
  const streaks = (g, r, n, x0, x1, y0, len, col = 'rgba(0,0,0,0.12)') => { for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0); g.fillStyle = col; g.fillRect(x, y0, 1 + r() * 3, len * (0.3 + r() * 0.7)); } };
  // A window pane with frame, glass, mullions and (maybe) light behind it.
  function pane(g, r, x, y, w, h, o) {
    const lit = r() < o.litFrac;
    g.fillStyle = o.frame; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = r() < 0.5 ? o.glassA : o.glassB; g.fillRect(x, y, w, h);
    // reflection gradient
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (lit) { g.fillStyle = `rgb(${225 + r() * 30},${195 + r() * 40},${135 + r() * 60})`; g.fillRect(x, y, w, h); if (r() < 0.6) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + w * r() * 0.5, y + h * 0.35, w * 0.28, h * 0.65); } if (r() < 0.4) { g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(x, y, w, h * (0.2 + r() * 0.3)); } g._lit.push([x, y, w, h]); }
    else if (r() < 0.4) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, h * (0.2 + r() * 0.55)); }
    if (o.mullion) { g.fillStyle = o.frame; g.fillRect(x + w / 2 - 1.5, y, 3, h); if (o.mullion > 1) g.fillRect(x, y + h * 0.4 - 1.5, w, 3); }
    if (o.sill) { g.fillStyle = o.sillCol || 'rgba(255,255,255,0.35)'; g.fillRect(x - 6, y + h + 3, w + 12, 5); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x - 6, y + h + 8, w + 12, 3); streaks(g, r, 3, x - 4, x + w + 4, y + h + 11, 30, 'rgba(0,0,0,0.1)'); }
    if (o.lintel) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 6, y - 9, w + 12, 6); }
    if (o.arch) { g.fillStyle = o.frame; g.beginPath(); g.arc(x + w / 2, y + 2, w / 2 + 3, Math.PI, 0); g.fill(); g.fillStyle = r() < 0.5 ? o.glassA : o.glassB; g.beginPath(); g.arc(x + w / 2, y + 2, w / 2, Math.PI, 0); g.fill(); if (lit) { g.fillStyle = 'rgb(230,205,150)'; g.beginPath(); g.arc(x + w / 2, y + 2, w / 2, Math.PI, 0); g.fill(); g._lit.push([x, y - w / 2, w, w / 2 + 2]); } }
    if (o.ac && r() < 0.25) { g.fillStyle = '#9a9a96'; g.fillRect(x + w * 0.55, y + h * 0.55, w * 0.42, h * 0.42); g.fillStyle = '#6a6a66'; for (let k = 0; k < 4; k++) g.fillRect(x + w * 0.58, y + h * 0.6 + k * h * 0.09, w * 0.36, 2); }
  }
  // A wall of windows: cols x rows panes with wall texture painted by `wall(g, r)` first.
  function windows(g, r, o) {
    o.wall(g, r);
    const cw = S / o.cols, ch = S / o.rows;
    for (let j = 0; j < o.rows; j++) {
      if (o.band) { g.fillStyle = o.band; g.fillRect(0, j * ch, S, 6); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, j * ch + 6, S, 3); }
      for (let i = 0; i < o.cols; i++) { const x = i * cw + cw * o.wPad, y = j * ch + ch * o.hPad, w = cw * (1 - 2 * o.wPad), h = ch * (1 - 2 * o.hPad); pane(g, r, x, y, w, h, o); }
    }
    if (o.pilasters) for (let i = 0; i <= o.cols; i++) { const x = i * cw - 8; g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, 0, 10, S); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 10, 0, 6, S); }
  }
  const bricks = (g, r, base, mortar, h = 10, w = 22) => { g.fillStyle = base; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += h) { const off = (y / h) % 2 ? w / 2 : 0; for (let x = -w; x < S; x += w) { const v = r(); g.fillStyle = `rgba(${v < 0.5 ? 0 : 255},${v < 0.5 ? 0 : 255},${v < 0.5 ? 0 : 255},${0.04 + r() * 0.1})`; g.fillRect(x + off + 1, y + 1, w - 2, h - 2); } g.fillStyle = mortar; g.fillRect(0, y, S, 1.5); for (let x = -w; x < S; x += w) g.fillRect(x + off, y, 1.5, h); } grain(g, r, 8000, 0.05); };
  const stucco = (g, r, col) => { g.fillStyle = col; g.fillRect(0, 0, S, S); grain(g, r, 30000, 0.05, 2); stains(g, r, 5, 'rgba(0,0,0,0.08)'); };
  const concreteWall = (g, r, col) => { g.fillStyle = col; g.fillRect(0, 0, S, S); grain(g, r, 24000, 0.05, 2); for (let y = 0; y < S; y += 128) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, S, 2); } for (let x = 0; x < S; x += 128) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 0, 2, S); } streaks(g, r, 40, 0, S, 0, 160, 'rgba(0,0,0,0.06)'); };

  function build() {
    add('white', g => { g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); });
    add('asphalt', (g, r) => { g.fillStyle = '#39393d'; g.fillRect(0, 0, S, S); noise(g, r, 70, 14000); grain(g, r, 20000, 0.05); cracks(g, r, 5); stains(g, r, 6, 'rgba(0,0,0,0.15)'); for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(${20 + r() * 20},${20 + r() * 20},${22 + r() * 20},0.5)`; g.fillRect(r() * S, r() * S, 40 + r() * 120, 30 + r() * 90); } });
    // Road: u across the full 14 units, v along (one tile = 16 units). Gutters, lanes, centre line, wear.
    add('road', (g, r) => {
      g.fillStyle = '#37373b'; g.fillRect(0, 0, S, S); noise(g, r, 60, 12000); grain(g, r, 16000, 0.05);
      for (const lc of [0.125, 0.375, 0.625, 0.875]) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect((lc - 0.06) * S, 0, 0.12 * S, S); }
      cracks(g, r, 4, 'rgba(0,0,0,0.4)'); stains(g, r, 4, 'rgba(0,0,0,0.14)');
      for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(25,25,28,0.45)'; g.fillRect(r() * S, r() * S, 30 + r() * 60, 60 + r() * 120); }
      g.fillStyle = '#c9a227'; g.fillRect(S * 0.5 - 6, 0, 4, S); g.fillRect(S * 0.5 + 2, 0, 4, S); grain(g, r, 1500, 0.15, 2);
      g.fillStyle = '#d8d8d0'; for (let y = 0; y < S; y += 128) { g.fillRect(S * 0.25 - 2, y, 4, 56); g.fillRect(S * 0.75 - 2, y, 4, 56); }
      g.fillStyle = '#2a2a2d'; g.fillRect(0, 0, 10, S); g.fillRect(S - 10, 0, 10, S); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(10, 0, 3, S); g.fillRect(S - 13, 0, 3, S);
    });
    add('sidewalk', (g, r) => {
      g.fillStyle = '#8e8b85'; g.fillRect(0, 0, S, S); grain(g, r, 30000, 0.06, 2);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() * 0.06})`; g.fillRect(i * 128, j * 128, 128, 128); }
      g.strokeStyle = 'rgba(30,30,30,0.5)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, S); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(S, i * 128); g.stroke(); }
      cracks(g, r, 4, 'rgba(0,0,0,0.35)'); stains(g, r, 10, 'rgba(0,0,0,0.1)');
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(20,20,20,0.35)'; g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 3, 0, 7); g.fill(); } // gum
    });
    const glassA = '#7fa3bd', glassB = '#5f829c', dark = '#2a2f36';
    add('office', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.09, hPad: 0.2, wall: (g, r) => concreteWall(g, r, '#68727c'), frame: dark, glassA, glassB, litFrac: 0.55, mullion: 1, band: '#4a525a' }); });
    add('glass', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.05, hPad: 0.06, wall: (g, r) => { g.fillStyle = '#1c2a38'; g.fillRect(0, 0, S, S); }, frame: '#16202a', glassA: '#4a7ea3', glassB: '#3d6f95', litFrac: 0.6, mullion: 2 }); const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
    add('brick', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.26, hPad: 0.22, wall: (g, r) => bricks(g, r, '#8a4a3a', 'rgba(230,220,200,0.55)'), frame: '#e8e0d0', glassA: '#4d5d6b', glassB: '#3b4a57', litFrac: 0.4, sill: true, sillCol: '#d8d0c0', arch: true }); streaks(g, r, 30, 0, S, 0, 120, 'rgba(0,0,0,0.08)'); });
    add('concrete', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.2, hPad: 0.27, wall: (g, r) => concreteWall(g, r, '#b1aba0'), frame: '#3a3a3a', glassA: '#41505c', glassB: '#2f3c47', litFrac: 0.35, sill: true, ac: true }); });
    add('tenement', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.28, hPad: 0.22, wall: (g, r) => { bricks(g, r, '#6d675b', 'rgba(200,190,170,0.4)', 9, 20); stains(g, r, 8, 'rgba(0,0,0,0.12)'); }, frame: '#2c2620', glassA: '#3d4a52', glassB: '#2c3840', litFrac: 0.45, sill: true, sillCol: '#a89c88', ac: true }); streaks(g, r, 40, 0, S, 0, 200, 'rgba(0,0,0,0.1)'); });
    add('deco', (g, r) => { windows(g, r, { cols: 6, rows: 4, wPad: 0.28, hPad: 0.14, wall: (g, r) => stucco(g, r, '#c9b89a'), frame: '#4a3d2e', glassA: '#3c4c5a', glassB: '#2e3d4a', litFrac: 0.5, pilasters: true, lintel: true }); });
    add('stone', (g, r) => { windows(g, r, { cols: 4, rows: 3, wPad: 0.27, hPad: 0.2, wall: (g, r) => { bricks(g, r, '#9c948a', 'rgba(60,55,50,0.5)', 42, 128); }, frame: '#e2dccf', glassA: '#4a5866', glassB: '#3a4754', litFrac: 0.3, arch: true, sill: true, sillCol: '#e2dccf' }); });
    add('painted', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.27, hPad: 0.24, wall: (g, r) => stucco(g, r, ['#c98a6a', '#d8c07a', '#8fb5a0', '#b58fa8'][Math.floor(r() * 4)]), frame: '#f3efe6', glassA: '#4e5d6b', glassB: '#3d4c5a', litFrac: 0.45, sill: true, sillCol: '#f3efe6' }); // shutters
      const cw = S / 4, ch = S / 4; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { if (r() > 0.6) continue; const x = i * cw + cw * 0.27, y = j * ch + ch * 0.24, w = cw * 0.46, h = ch * 0.52; g.fillStyle = '#3d5a4a'; g.fillRect(x - 16, y, 12, h); g.fillRect(x + w + 4, y, 12, h); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 4; k < h; k += 6) { g.fillRect(x - 15, y + k, 10, 2); g.fillRect(x + w + 5, y + k, 10, 2); } } });
    // Shopfronts: one tile = 8 units (two shops), 4 tall. Names painted, awnings, lit windows at night.
    const SHOPNAMES = ["LARK'S", 'BODEGA', 'NOODLE HOUSE', 'PAWN & GOLD', '24H LIQUOR', 'LAUNDROMAT', 'GRIFT DINER', 'CAFE MARROW', 'BAIL BONDS', 'VINYL', 'TATTOO', 'BAKERY', 'BOOKS', 'BAR NONE', 'PHARMACY', 'FLOWERS', 'SHOE REPAIR', 'THE OYSTER', 'DRY CLEAN', 'KEBAB'];
    for (let v = 0; v < 3; v++) add('shops' + v, (g, r) => {
      g.fillStyle = '#4a4540'; g.fillRect(0, 0, S, S); grain(g, r, 8000, 0.05);
      for (let i = 0; i < 2; i++) {
        const x0 = i * 256; const hue = Math.floor(r() * 360); const name = SHOPNAMES[Math.floor(r() * SHOPNAMES.length)];
        g.fillStyle = `hsl(${hue},50%,32%)`; g.fillRect(x0 + 6, 14, 244, 76); g.fillStyle = `hsl(${hue},60%,22%)`; g.fillRect(x0 + 6, 84, 244, 8);
        g.fillStyle = `hsl(${(hue + 40) % 360},80%,82%)`; g.font = 'bold 40px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; let sz = 40; while (g.measureText(name).width > 228 && sz > 20) { sz -= 2; g.font = `bold ${sz}px "Helvetica Neue", Arial, sans-serif`; } g.fillText(name, x0 + 128, 52);
        g._lit.push([x0 + 6, 14, 244, 76]);
        // awning
        if (r() < 0.55) { const ac = `hsl(${(hue + 180) % 360},55%,45%)`; for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? ac : '#eee8dc'; g.fillRect(x0 + 6 + k * 20.3, 96, 20.3, 34); } g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 6, 128, 244, 6); }
        // window and door
        g.fillStyle = '#1c2228'; g.fillRect(x0 + 14, 140, 228, 350); g.fillStyle = '#556f84'; g.fillRect(x0 + 22, 148, 130, 334); g._lit.push([x0 + 22, 148, 130, 334]);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 + 30, 160, 40, 300); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 3; k++) g.fillRect(x0 + 30 + k * 40, 300 + r() * 120, 30, 20 + r() * 40); // shelves
        g.fillStyle = '#3a2a20'; g.fillRect(x0 + 164, 148, 70, 334); g.fillStyle = '#5b4a3a'; g.fillRect(x0 + 172, 156, 54, 200); g.fillStyle = '#c9b070'; g.fillRect(x0 + 216, 310, 6, 16);
        g.fillStyle = '#6a6560'; g.fillRect(x0 + 14, 486, 228, 12); // step
      }
    });
    add('roof', (g, r) => { g.fillStyle = '#56534f'; g.fillRect(0, 0, S, S); noise(g, r, 80, 20000); grain(g, r, 20000, 0.05); stains(g, r, 6, 'rgba(0,0,0,0.12)'); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, S, 14); g.fillRect(0, 0, 14, S); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(r() * S, r() * S, 60 + r() * 100, 40 + r() * 60); } });
    add('grass', (g, r) => { g.fillStyle = '#4c7738'; g.fillRect(0, 0, S, S); for (let i = 0; i < 30000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,60,10,0.35)' : 'rgba(150,200,80,0.28)'; g.fillRect(r() * S, r() * S, 1, 2 + r() * 4); } for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(90,70,40,0.25)'; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, 7); g.fill(); } });
    add('parking', (g, r) => { g.fillStyle = '#48484a'; g.fillRect(0, 0, S, S); noise(g, r, 60, 12000); cracks(g, r, 5); stains(g, r, 8, 'rgba(0,0,0,0.25)'); g.fillStyle = '#d0d0c8'; for (let x = 0; x < S; x += 128) { g.fillRect(x, 0, 5, S * 0.45); g.fillRect(x, S * 0.55, 5, S * 0.45); } });
    add('water', (g, r) => { g.fillStyle = '#1e4862'; g.fillRect(0, 0, S, S); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(170,215,240,${0.05 + r() * 0.16})`; g.fillRect(r() * S, r() * S, 16 + r() * 70, 1 + r() * 3); } for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(10,30,50,${0.1 + r() * 0.2})`; g.fillRect(r() * S, r() * S, 20 + r() * 60, 2 + r() * 3); } });
    add('metal', (g, r) => { g.fillStyle = '#7c8088'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 4) { g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.12})`; g.fillRect(0, y, S, 2); } streaks(g, r, 30, 0, S, 0, 300, 'rgba(120,70,30,0.12)'); grain(g, r, 6000, 0.05); });
    add('garage', (g, r) => { g.fillStyle = '#7d7a72'; g.fillRect(0, 0, S, S); grain(g, r, 12000, 0.06); g.fillStyle = '#4e5660'; g.fillRect(48, 80, 416, 432); for (let y = 96; y < S; y += 40) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(48, y, 416, 5); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(48, y + 5, 416, 3); } g.fillStyle = '#e0c060'; g.fillRect(48, 24, 416, 40); streaks(g, r, 20, 48, 464, 80, 200, 'rgba(0,0,0,0.12)'); });
    const BILL = [['GRIFT COLA', 'taste the hustle', '#1b7fd6', '#ffffff'], ['VOSS MOTORS', 'drive like you mean it', '#c62a4a', '#ffe9a0'], ['CRANE HOLDINGS', 'the city, managed', '#1f2a3a', '#dfe6f0'], ['NEON FM 98.1', 'all night, every night', '#7a1fb5', '#ff9ff3'], ['IRONMONGER', 'sporting goods & more', '#3a3a3a', '#f1c40f'], ['ST. MARROW', 'we patch anyone', '#f4f4f4', '#c0281e']];
    BILL.forEach((bd, i) => add('bill' + i, (g, r) => { g.fillStyle = '#101418'; g.fillRect(0, 0, S, S); g.fillStyle = bd[2]; g.fillRect(16, 16, 480, 480); g.fillStyle = bd[3]; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 70px "Helvetica Neue", Arial, sans-serif'; let sz = 70; while (g.measureText(bd[0]).width > 440 && sz > 30) { sz -= 4; g.font = `bold ${sz}px "Helvetica Neue", Arial, sans-serif`; } g.fillText(bd[0], 256, 200); g.font = 'italic 34px "Helvetica Neue", Arial, sans-serif'; g.fillText(bd[1], 256, 300); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(400, 400, 60, 0, 7); g.fill(); g._lit.push([16, 16, 480, 480]); }));
    for (const [n, col] of [['neon', '#ff40a0'], ['neonc', '#40e0ff'], ['neony', '#ffd040'], ['neong', '#60ff80']]) add(n, g => { g.fillStyle = col; g.fillRect(0, 0, S, S); g._lit.push([0, 0, S, S]); });
    add('sand', (g, r) => { g.fillStyle = '#cbb886'; g.fillRect(0, 0, S, S); grain(g, r, 40000, 0.06); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, r() * S, S, 2 + r() * 3); } });
    add('hospital', (g, r) => { windows(g, r, { cols: 4, rows: 4, wPad: 0.2, hPad: 0.22, wall: (g, r) => { concreteWall(g, r, '#e6e3dc'); }, frame: '#8a9aa6', glassA: '#2b3a44', glassB: '#354652', litFrac: 0.7, sill: true, sillCol: '#f5f5f2' }); });
    add('graffiti', (g, r) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); const cols = ['#ff3b8d', '#37d4ff', '#ffe23b', '#7dff5a', '#ff8c2b', '#ffffff']; for (let i = 0; i < 5; i++) { g.strokeStyle = cols[Math.floor(r() * cols.length)]; g.lineWidth = 10 + r() * 14; g.lineCap = 'round'; g.beginPath(); let x = 60 + r() * 380, y = 100 + r() * 300; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 200; y += (r() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); } g.font = 'bold 90px Impact, "Arial Black", sans-serif'; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.textAlign = 'center'; g.fillText(['GRIFT', 'CRANE OUT', 'PIER 9', 'NORTHGATE', 'VOSS', 'EAST SIDE'][Math.floor(r() * 6)], 256, 290); g._out = (() => { const id = g.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; d[i + 3] = l > 30 ? 255 : 0; } return id; })(); });
    // Street name signs: 16 rows, one name each; a quad maps to one row.
    const STREETS = ['MARROW AVE', 'CRANE ST', 'VOSS BLVD', 'PIER RD', 'LARK ST', 'HOLLOW WAY', 'GULL AVE', 'FERRY ST', 'IRON ST', 'OKAFOR DR', 'NORTHGATE', 'WESTFIELD', 'EASTSIDE AVE', 'SOUTHPORT', 'MIDTOWN', 'GRIFT PKWY'];
    add('signs', (g, r) => { STREETS.forEach((n, i) => { const y = i * 32; g.fillStyle = '#1f6b3a'; g.fillRect(0, y, S, 32); g.fillStyle = '#fff'; g.fillRect(0, y + 1, S, 1); g.fillRect(0, y + 30, S, 1); g.font = 'bold 22px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 256, y + 16); }); });
    add('police', (g, r) => { g.fillStyle = '#f2f2f4'; g.fillRect(0, 0, S, S); g.fillStyle = '#111318'; g.fillRect(0, 0, S, 160); g.fillRect(0, 352, S, 160); g.fillStyle = '#1b3a8a'; g.fillRect(0, 160, S, 24); g.fillRect(0, 328, S, 24); g.font = 'bold 84px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111318'; g.fillText('POLICE', 256, 256); g.fillStyle = '#c9a227'; g.beginPath(); g.arc(70, 256, 30, 0, 7); g.fill(); g.fillStyle = '#111318'; g.font = 'bold 22px sans-serif'; g.fillText('GCPD', 70, 256); });
    add('taxi', (g, r) => { g.fillStyle = '#f5c518'; g.fillRect(0, 0, S, S); for (let j = 0; j < 2; j++) for (let i = 0; i < 16; i++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 32, 224 + j * 32, 32, 32); } g.font = 'bold 60px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111'; g.fillText('CABCO', 256, 130); });
    add('planks', (g, r) => { g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() * 0.1})`; g.fillRect(0, y, S, 32); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y, S, 2); } grain(g, r, 20000, 0.05); streaks(g, r, 30, 0, S, 0, 100, 'rgba(0,0,0,0.1)'); });
    add('flowers', (g, r) => { g.fillStyle = '#3c6a2c'; g.fillRect(0, 0, S, S); for (let i = 0; i < 400; i++) { g.fillStyle = ['#ff5a7a', '#ffd23b', '#ffffff', '#c86bff', '#ff8c2b'][Math.floor(r() * 5)]; g.beginPath(); g.arc(r() * S, r() * S, 4 + r() * 6, 0, 7); g.fill(); } });
    // test card for the visual test suite: red top-left, green top-right, blue bottom-left, orange bottom-right
    add('testcard', (g, r) => { g.fillStyle = '#ff0000'; g.fillRect(0, 0, S / 2, S / 2); g.fillStyle = '#00ff00'; g.fillRect(S / 2, 0, S / 2, S / 2); g.fillStyle = '#0000ff'; g.fillRect(0, S / 2, S / 2, S / 2); g.fillStyle = '#ff7f00'; g.fillRect(S / 2, S / 2, S / 2, S / 2); });
    add('cone', (g, r) => { g.fillStyle = '#ff6a00'; g.fillRect(0, 0, S, S); g.fillStyle = '#fff'; g.fillRect(0, 160, S, 60); g.fillRect(0, 300, S, 60); });
    add('barrier', (g, r) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff6a00'; g.fillRect(i * 64, 0, 64, S); } });
    return layers;
  }
  return { build, names, S, get layers() { return layers; } };
})();
