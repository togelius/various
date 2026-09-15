// GRIFT CITY — every texture is painted at runtime onto a canvas. Alpha = emissive mask (lit windows at night).
'use strict';
const TEX = (() => {
  const S = 256;
  const layers = []; const names = {};
  function add(name, painter) {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    painter(g, M.rng(layers.length * 7919 + 13));
    // Alpha carries the emissive mask. It must bypass the canvas (which premultiplies), so the layer is raw ImageData.
    names[name] = layers.length; layers.push(g._out || g.getImageData(0, 0, S, S));
  }
  function noise(g, r, amount, count = 4000) {
    for (let i = 0; i < count; i++) {
      const v = Math.floor(r() * amount); g.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.5})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3);
    }
  }
  function grain(g, r, count = 6000, alpha = 0.08) {
    for (let i = 0; i < count; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`; g.fillRect(r() * S, r() * S, 2, 2); }
  }
  // Windows: a grid of panes. lit fraction controls how many glow at night (alpha channel).
  function windows(g, r, { cols, rows, wallA, wallB, frame, glassA, glassB, litFrac, ledge, wPad = 0.22, hPad = 0.22 }) {
    g.fillStyle = wallA; g.fillRect(0, 0, S, S);
    grain(g, r, 4000, 0.05);
    if (wallB) { for (let y = 0; y < S; y += 4) { g.fillStyle = wallB; g.globalAlpha = 0.25 + r() * 0.2; g.fillRect(0, y, S, 1); } g.globalAlpha = 1; }
    const cw = S / cols, ch = S / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * wPad, y = j * ch + ch * hPad, w = cw * (1 - 2 * wPad), h = ch * (1 - 2 * hPad);
      const lit = r() < litFrac;
      g.fillStyle = frame; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      const t = r();
      g.fillStyle = r() < 0.5 ? glassA : glassB;
      g.fillRect(x, y, w, h);
      // interior detail: a darker band (blind) on some
      if (!lit && r() < 0.35) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, h * (0.2 + r() * 0.5)); }
      if (lit && r() < 0.5) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w * r() * 0.5, y + h * 0.3, w * 0.3, h * 0.7); }
      if (ledge) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 3, y + h + 2, w + 6, 2); }
      // write emissive into alpha: composite trick — we paint alpha later via ImageData
      g._lit = g._lit || []; if (lit) g._lit.push([x, y, w, h]);
    }
  }
  function applyEmissive(g, rects, base = 0) {
    const id = g.getImageData(0, 0, S, S), d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = base;
    for (const [x, y, w, h] of rects) for (let yy = Math.floor(y); yy < y + h; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) { const k = (yy * S + xx) * 4 + 3; if (k < d.length) d[k] = 255; }
    g._out = id;
  }
  function opaque(g) { applyEmissive(g, []); }

  function build() {
    add('white', g => { g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); opaque(g); });
    add('asphalt', (g, r) => { g.fillStyle = '#3a3a3e'; g.fillRect(0, 0, S, S); noise(g, r, 60, 5000); grain(g, r, 8000, 0.06); opaque(g); });
    // Road: u across (0..1 = full 14 unit width), v along. Lane lines, centre double line, gutters.
    add('road', (g, r) => {
      g.fillStyle = '#36363a'; g.fillRect(0, 0, S, S); noise(g, r, 50, 5000); grain(g, r, 6000, 0.05);
      // tyre wear darker in lanes
      for (const lc of [0.125, 0.375, 0.625, 0.875]) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect((lc - 0.05) * S, 0, 0.1 * S, S); }
      // centre double yellow
      g.fillStyle = '#c9a227'; g.fillRect(S * 0.5 - 5, 0, 3, S); g.fillRect(S * 0.5 + 2, 0, 3, S);
      // dashed lane lines at 0.25 and 0.75
      g.fillStyle = '#d8d8d0'; for (let y = 0; y < S; y += 64) { g.fillRect(S * 0.25 - 1.5, y, 3, 28); g.fillRect(S * 0.75 - 1.5, y, 3, 28); }
      // gutters
      g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, 6, S); g.fillRect(S - 6, 0, 6, S);
      opaque(g);
    });
    add('sidewalk', (g, r) => {
      g.fillStyle = '#8f8c86'; g.fillRect(0, 0, S, S); grain(g, r, 9000, 0.07);
      g.strokeStyle = 'rgba(40,40,40,0.45)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, S); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(S, i * 64); g.stroke(); }
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(r() * S, r() * S, 2 + r() * 12, 1); }
      opaque(g);
    });
    add('office', (g, r) => { windows(g, r, { cols: 4, rows: 4, wallA: '#5c6670', wallB: '#404850', frame: '#2a2f36', glassA: '#8fb0c8', glassB: '#6a8ca8', litFrac: 0.55, ledge: false, wPad: 0.1, hPad: 0.18 }); applyEmissive(g, g._lit); });
    add('glass', (g, r) => { windows(g, r, { cols: 4, rows: 4, wallA: '#243545', wallB: null, frame: '#182430', glassA: '#4d7d9e', glassB: '#3b6a8c', litFrac: 0.6, ledge: false, wPad: 0.06, hPad: 0.08 }); applyEmissive(g, g._lit); });
    add('brick', (g, r) => {
      windows(g, r, { cols: 4, rows: 4, wallA: '#8a4a3a', wallB: '#6e3a2c', frame: '#e8e0d0', glassA: '#5a6a78', glassB: '#42525f', litFrac: 0.4, ledge: true, wPad: 0.26, hPad: 0.24 });
      // brick courses on top of wall areas
      const lit = g._lit; g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < S; y += 8) { g.fillRect(0, y, S, 1); for (let x = (y / 8) % 2 ? 8 : 0; x < S; x += 16) g.fillRect(x, y, 1, 8); }
      applyEmissive(g, lit);
    });
    add('concrete', (g, r) => { windows(g, r, { cols: 4, rows: 4, wallA: '#b3ada2', wallB: '#9a948a', frame: '#3a3a3a', glassA: '#41505c', glassB: '#2f3c47', litFrac: 0.35, ledge: true, wPad: 0.2, hPad: 0.28 }); applyEmissive(g, g._lit); });
    add('tenement', (g, r) => { windows(g, r, { cols: 4, rows: 4, wallA: '#6f6a5e', wallB: '#5a554b', frame: '#2c2620', glassA: '#3d4a52', glassB: '#2c3840', litFrac: 0.45, ledge: true, wPad: 0.28, hPad: 0.22 }); applyEmissive(g, g._lit); });
    // Ground floor shopfronts: one tile = 8 units wide (2 shops), 4 tall.
    add('shops', (g, r) => {
      g.fillStyle = '#4a4540'; g.fillRect(0, 0, S, S); grain(g, r, 3000, 0.05);
      const lit = [];
      for (let i = 0; i < 2; i++) {
        const x0 = i * 128; const hue = Math.floor(r() * 360);
        g.fillStyle = `hsl(${hue},55%,35%)`; g.fillRect(x0 + 4, 8, 120, 48); // sign band
        g.fillStyle = `hsl(${hue},70%,75%)`; for (let k = 0; k < 6; k++) g.fillRect(x0 + 14 + k * 18, 22, 10 + r() * 4, 18); // "letters"
        g.fillStyle = '#1c2228'; g.fillRect(x0 + 8, 64, 112, 176); // big window
        g.fillStyle = '#5d7d92'; g.fillRect(x0 + 12, 68, 60, 168); lit.push([x0 + 12, 68, 60, 168]);
        g.fillStyle = '#3a2a20'; g.fillRect(x0 + 80, 68, 36, 168); // door
        g.fillStyle = '#c9b070'; g.fillRect(x0 + 108, 150, 4, 10); // handle
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 + 16, 76, 20, 150);
      }
      applyEmissive(g, lit);
    });
    add('roof', (g, r) => { g.fillStyle = '#55524e'; g.fillRect(0, 0, S, S); noise(g, r, 70, 6000); grain(g, r, 6000, 0.05); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, S, 10); g.fillRect(0, 0, 10, S); opaque(g); });
    add('grass', (g, r) => { g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, S, S); for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,60,10,0.35)' : 'rgba(150,200,80,0.25)'; g.fillRect(r() * S, r() * S, 1, 2 + r() * 3); } opaque(g); });
    add('parking', (g, r) => { g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, S, S); noise(g, r, 60, 4000); g.fillStyle = '#d0d0c8'; for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 3, S * 0.45); for (let x = 0; x < S; x += 64) g.fillRect(x, S * 0.55, 3, S * 0.45); opaque(g); });
    add('water', (g, r) => { g.fillStyle = '#1f4a63'; g.fillRect(0, 0, S, S); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(180,220,240,${0.05 + r() * 0.15})`; const y = r() * S; g.fillRect(r() * S, y, 10 + r() * 40, 1 + r() * 2); } opaque(g); });
    add('metal', (g, r) => { g.fillStyle = '#7d8189'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(0, y, S, 1); } opaque(g); });
    add('garage', (g, r) => {
      g.fillStyle = '#7d7a72'; g.fillRect(0, 0, S, S); grain(g, r, 4000, 0.06);
      g.fillStyle = '#4e5660'; g.fillRect(24, 40, 208, 216); for (let y = 48; y < 256; y += 24) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(24, y, 208, 3); }
      g.fillStyle = '#e0c060'; g.fillRect(24, 12, 208, 20); opaque(g);
    });
    add('billboard', (g, r) => {
      g.fillStyle = '#101418'; g.fillRect(0, 0, S, S);
      const hue = 200; g.fillStyle = `hsl(${hue},80%,55%)`; g.fillRect(12, 12, 232, 232);
      g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('GRIFT', 128, 110); g.font = 'bold 30px sans-serif'; g.fillText('COLA', 128, 160);
      g.fillStyle = '#ffd700'; g.beginPath(); g.arc(200, 200, 26, 0, 7); g.fill();
      applyEmissive(g, [[12, 12, 232, 232]]);
    });
    add('billboard2', (g, r) => {
      g.fillStyle = '#101418'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#c62a4a'; g.fillRect(12, 12, 232, 232);
      g.fillStyle = '#ffe9a0'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.fillText('VOSS', 128, 90); g.fillText('MOTORS', 128, 135); g.font = '22px sans-serif'; g.fillText('drive like you mean it', 128, 200);
      applyEmissive(g, [[12, 12, 232, 232]]);
    });
    add('neon', (g, r) => { g.fillStyle = '#ff40a0'; g.fillRect(0, 0, S, S); applyEmissive(g, [[0, 0, S, S]]); });
    add('sand', (g, r) => { g.fillStyle = '#c8b585'; g.fillRect(0, 0, S, S); grain(g, r, 9000, 0.06); opaque(g); });
    add('hospital', (g, r) => {
      g.fillStyle = '#e8e6e0'; g.fillRect(0, 0, S, S); grain(g, r, 3000, 0.04);
      const lit = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 64 + 14, y = j * 64 + 12; g.fillStyle = '#2b3a44'; g.fillRect(x, y, 36, 40); lit.push([x, y, 36, 40]); }
      applyEmissive(g, lit);
    });
    return layers;
  }
  return { build, names, S, get layers() { return layers; } };
})();
