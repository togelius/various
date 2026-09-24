// STÅLHAGEN II — painted materials. Every surface is a 256 px square painted with the first game's brushes,
// once at boot, into a texture array. The alpha channel of the steel materials is the seam mask the charge flows along.
'use strict';
const MAT = { SNOW: 0, ICE: 1, STEEL: 2, RED: 3, PLANK: 4, CONCRETE: 5, BIRCH: 6, ROOF: 7, BEIGE: 8, DARK: 9, GLASS: 10, ROAD: 11, FOIL: 12, REED: 13, FLAT: 14, LED: 15, CABLE: 16, SPRUCE: 17, WINDOW: 18, CLOTH: 19, BADGE: 20, TRACK: 21 };
const MATS = 22, TEX = 256;

const Paint = (() => {
  // per-material parameters: [roughness 0..1 (1 = matte), retroreflective 0/1, emissive strength, seam-glow 0/1]
  const params = new Float32Array(MATS * 4);
  const set = (m, rough, retro, emis, seam) => params.set([rough, retro, emis, seam], m * 4);

  function canvas() { const c = makeCanvas(TEX, TEX), g = c.getContext('2d'); return [c, g]; }
  // strokes wrap: anything painted near an edge is painted again beyond the opposite edge
  function wrapped(g, fn) { for (const dx of [-TEX, 0, TEX]) for (const dy of [-TEX, 0, TEX]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }
  function fill(g, c) { g.fillStyle = css(c); g.fillRect(0, 0, TEX, TEX); }
  function strokes(g, r, n, col, jitter, len, w, a, ang = 0, spread = 0.2) {
    wrapped(g, () => { for (let i = 0; i < n; i++) Art.stroke(g, r() * TEX, r() * TEX, len[0] + r() * (len[1] - len[0]), w[0] + r() * (w[1] - w[0]), ang + (r() - 0.5) * spread, jit(col, r, jitter), a); });
  }
  function dabs(g, r, n, col, jitter, rad, a) {
    wrapped(g, () => { for (let i = 0; i < n; i++) { const s = rad[0] + r() * (rad[1] - rad[0]); Art.dab(g, r() * TEX, r() * TEX, s, s * (0.5 + r() * 0.5), r() * 3, jit(col, r, jitter), a); } });
  }

  function paintAll() {
    const out = [];
    const put = (m, fn, rough = 0.9, retro = 0, emis = 0, seam = 0) => { const [c, g] = canvas(); const r = rng32(1000 + m); fn(g, r); out[m] = c; set(m, rough, retro, emis, seam); };

    put(MAT.SNOW, (g, r) => {
      fill(g, '#e9ecef');
      strokes(g, r, 900, '#f7f8f6', 10, [10, 40], [2, 7], 0.35);
      strokes(g, r, 400, '#c9d2dd', 10, [8, 30], [1.5, 5], 0.22);
      dabs(g, r, 200, '#ffffff', 4, [1, 2], 0.5);
    }, 1);
    put(MAT.ICE, (g, r) => {
      fill(g, '#9ea9b3');
      strokes(g, r, 500, '#b8c1c9', 8, [20, 90], [2, 9], 0.3, 0, 0.4);
      strokes(g, r, 300, '#7c8893', 8, [20, 70], [1, 4], 0.25, 0, 0.5);
      // cracks
      wrapped(g, () => { for (let i = 0; i < 5; i++) { let x = r() * TEX, y = r() * TEX; g.strokeStyle = css('#dfe6ea', 0.16); g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } });
      dabs(g, r, 120, '#f2f5f6', 4, [1, 3], 0.4);
    }, 0.25);
    put(MAT.STEEL, (g, r) => {
      fill(g, '#5c6360');
      strokes(g, r, 700, '#6a716d', 14, [6, 24], [1.5, 4], 0.25, Math.PI / 2, 0.1);
      strokes(g, r, 200, '#8a4f2c', 10, [8, 40], [1, 3], 0.18, Math.PI / 2, 0.05);
      // panels: lines are the seams; the alpha channel records them
      g.strokeStyle = css('#2d3230', 0.7); g.lineWidth = 2;
      g.beginPath(); for (let k = 0; k < 4; k++) { const p = k * 64 + 32; g.moveTo(p, 0); g.lineTo(p, TEX); g.moveTo(0, p); g.lineTo(TEX, p); } g.stroke();
      g.fillStyle = css('#3a403d', 0.6); for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) for (const [dx, dy] of [[6, 6], [58, 6], [6, 58], [58, 58]]) g.fillRect(k * 64 + dx, j * 64 + dy, 3, 3);
      // seam mask into alpha
      const id = g.getImageData(0, 0, TEX, TEX), d = id.data;
      for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) { const o = (y * TEX + x) * 4; const sx = Math.min(Math.abs((x % 64) - 32), 64), sy = Math.min(Math.abs((y % 64) - 32), 64); const m = Math.max(0, 1 - Math.min(sx, sy) / 3.5); d[o + 3] = 255 - Math.round(m * 200); }
      g.putImageData(id, 0, 0);
    }, 0.55, 0, 0, 1);
    put(MAT.RED, (g, r) => {
      fill(g, '#8c3527');
      for (let x = 0; x < TEX; x += 22) Art.line(g, x, 0, x, TEX, 1.5, '#5e2219', 0.5);
      strokes(g, r, 500, '#9a3f2e', 20, [6, 20], [2, 5], 0.2, Math.PI / 2, 0.05);
      strokes(g, r, 120, '#6b2a20', 10, [10, 40], [1, 2], 0.25, Math.PI / 2, 0.02);
    }, 0.95);
    put(MAT.PLANK, (g, r) => {
      fill(g, '#6f6658');
      for (let x = 0; x < TEX; x += 32) Art.line(g, x, 0, x, TEX, 1.5, '#3f3a32', 0.6);
      strokes(g, r, 700, '#7d7466', 16, [8, 40], [1, 3], 0.22, Math.PI / 2, 0.03);
      strokes(g, r, 150, '#4d463d', 10, [10, 40], [1, 2], 0.3, Math.PI / 2, 0.02);
    }, 0.95);
    put(MAT.CONCRETE, (g, r) => {
      fill(g, '#8d8d88');
      strokes(g, r, 900, '#979792', 12, [3, 14], [1, 3], 0.25, 0, 3);
      strokes(g, r, 120, '#6e6e69', 8, [10, 50], [2, 6], 0.15, Math.PI / 2, 0.1);
    }, 0.95);
    put(MAT.BIRCH, (g, r) => {
      fill(g, '#e8e2d2');
      strokes(g, r, 300, '#d7d0bf', 10, [6, 20], [1, 3], 0.25, Math.PI / 2, 0.05);

      wrapped(g, () => { for (let i = 0; i < 40; i++) { const x = r() * TEX, y = r() * TEX; Art.line(g, x, y, x + 10 + r() * 30, y + (r() - 0.5) * 3, 2 + r() * 4, '#2b2a26', 0.9); } });
    }, 0.9);
    put(MAT.ROOF, (g, r) => {
      fill(g, '#3a3736');
      for (let x = 0; x < TEX; x += 24) Art.line(g, x, 0, x, TEX, 2, '#2a2827', 0.7);
      strokes(g, r, 400, '#464341', 10, [6, 30], [1, 3], 0.2, Math.PI / 2, 0.05);
    }, 0.7);
    put(MAT.BEIGE, (g, r) => {
      fill(g, '#d9d2c0');
      strokes(g, r, 600, '#e2dccb', 8, [6, 20], [1.5, 4], 0.25, 0, 3);
      strokes(g, r, 200, '#b8b09c', 8, [6, 26], [1, 3], 0.2, Math.PI / 2, 0.1);
      dabs(g, r, 40, '#8a7f6a', 10, [1, 3], 0.4);
      // faint seams for the charge
      g.strokeStyle = css('#a69f8e', 0.7); g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 2; k++) { const p = k * 128 + 64; g.moveTo(p, 0); g.lineTo(p, TEX); g.moveTo(0, p); g.lineTo(TEX, p); } g.stroke();
      const id = g.getImageData(0, 0, TEX, TEX), d = id.data;
      for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) { const o = (y * TEX + x) * 4; const sx = Math.abs((x % 128) - 64), sy = Math.abs((y % 128) - 64); const m = Math.max(0, 1 - Math.min(sx, sy) / 4); d[o + 3] = 255 - Math.round(m * 200); }
      g.putImageData(id, 0, 0);
    }, 0.7, 0, 0, 1);
    put(MAT.DARK, (g, r) => { fill(g, '#2c2e30'); strokes(g, r, 500, '#3a3d40', 8, [4, 16], [1, 3], 0.2, 0, 3); }, 0.6);
    put(MAT.GLASS, (g, r) => { fill(g, '#f0c878'); strokes(g, r, 200, '#ffe0a0', 10, [10, 60], [3, 10], 0.25, 0.4, 0.2); }, 0.1, 0, 1.6);
    put(MAT.ROAD, (g, r) => { fill(g, '#3d3f43'); strokes(g, r, 900, '#474a4f', 8, [3, 10], [1, 3], 0.25, 0, 3); dabs(g, r, 300, '#2f3134', 6, [1, 2], 0.4); }, 0.85);
    put(MAT.FOIL, (g, r) => { fill(g, '#c9c9c4'); strokes(g, r, 900, '#f2f2ee', 6, [4, 20], [1, 3], 0.4, 0, 3); strokes(g, r, 500, '#8f8f8b', 6, [4, 20], [1, 3], 0.4, 0, 3); }, 0.15, 1);
    put(MAT.REED, (g, r) => { fill(g, '#8b7d55'); strokes(g, r, 900, '#a89a66', 14, [8, 30], [1, 2], 0.35, Math.PI / 2, 0.15); strokes(g, r, 300, '#5e5438', 10, [8, 30], [1, 2], 0.35, Math.PI / 2, 0.15); }, 1);
    put(MAT.FLAT, (g, r) => { fill(g, '#ffffff'); }, 0.9);
    put(MAT.LED, (g, r) => { fill(g, '#ff5a3c'); }, 0.3, 0, 3.0);
    // black cable: the alpha stripes are what the charge runs along
    put(MAT.CABLE, (g, r) => {
      fill(g, '#1e2124'); strokes(g, r, 300, '#2c3034', 6, [6, 30], [1, 3], 0.3, Math.PI / 2, 0.05);
      const id = g.getImageData(0, 0, TEX, TEX), d = id.data;
      for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) { const o = (y * TEX + x) * 4; const m = 0.5 + 0.5 * Math.sin(y / TEX * Math.PI * 6); d[o + 3] = 255 - Math.round(m * 220); }
      g.putImageData(id, 0, 0);
    }, 0.5, 0, 0, 1);
    put(MAT.SPRUCE, (g, r) => { fill(g, '#2f3d35'); strokes(g, r, 900, '#3c4c42', 10, [4, 14], [1, 3], 0.3, Math.PI / 2, 0.6); strokes(g, r, 400, '#1f2a24', 8, [4, 14], [1, 2], 0.3, Math.PI / 2, 0.6); }, 1);
    // Unlit glazing is separate from the emissive kitchen panes.
    put(MAT.WINDOW, (g,r) => { fill(g,'#354a54'); strokes(g,r,90,'#89979b',8,[80,220],[1,6],0.12,-0.3,0.1); },0.12);
    put(MAT.CLOTH, (g,r) => { fill(g,'#e5e0d5'); strokes(g,r,500,'#b9b4a8',6,[3,15],[0.6,1.4],0.1,Math.PI/2,0.15); for(let y=0;y<TEX;y+=3){g.fillStyle='rgba(40,35,28,.025)';g.fillRect(0,y,TEX,1);} },1);
    put(MAT.BADGE, (g,r) => { fill(g,'#c6c1ac'); g.fillStyle='#353c38'; g.font='bold 42px monospace';g.fillText('MDK',24,65);g.fillRect(24,80,205,4);g.font='26px monospace';g.fillText('KV — 03',24,123);g.font='13px monospace';g.fillText('MÄLARDALENS KRAFT',24,158);g.fillText('SERVICE  •  1984',24,183);for(let i=0;i<50;i++){g.fillStyle='rgba(70,50,30,.13)';g.fillRect(r()*TEX,r()*TEX,2+r()*12,1+r()*3);} },.8);
    put(MAT.TRACK,(g)=>fill(g,'#ffffff'),1);
    return out;
  }

  let tex = null;
  function build() { const canvases = paintAll(); tex = GL.textureArray(canvases, TEX); return tex; }
  return { build, params, get tex() { return tex; } };
})();
