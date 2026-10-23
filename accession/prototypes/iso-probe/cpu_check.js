// Independent CPU estimate of floor occlusion: 9 sample points per walkable tile, rays toward the
// camera, slab tests against box approximations of the same geometry iso.js builds.
const fs = require('fs'); const A = require('./common.js');
const [name, elevDeg = 35.264, azDeg = 45, H = 3] = process.argv.slice(2);
const L = A.parse(fs.readFileSync(`layouts/${name}.txt`, 'utf8'));
const el = elevDeg * Math.PI / 180, az = azDeg * Math.PI / 180;
const D = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
const boxes = [];
const B = (x0, y0, z0, x1, y1, z1) => boxes.push([x0, y0, z0, x1, y1, z1]);
const wallish = c => '#,+SEX'.includes(c);
for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
  const c = L.at(x, y), cx = x + 0.5, cz = y + 0.5;
  const C = (w, h0, h1, d = w) => B(cx - w / 2, h0, cz - d / 2, cx + w / 2, h1, cz + d / 2);
  if (c === '#') B(x, -0.06, y, x + 1, +H, y + 1);
  else if (',+SEX'.includes(c)) { if (H > 2.4) B(x, 2.4, y, x + 1, +H, y + 1); if ('+SEX'.includes(c)) { const hz = wallish(L.at(x - 1, y)) || wallish(L.at(x + 1, y)); const t = 0.15; hz ? B(x, 0, cz - t / 2, x + 1, Math.min(2.3, H), cz + t / 2) : B(cx - t / 2, 0, y, cx + t / 2, Math.min(2.3, H), y + 1); } }
  else if (c === 'v') C(0.86, 0, 0.55);
  else if (c === 'o') { if (A.oKind(L, x, y) === 'column') C(0.52, 0, +H); else { C(0.8, 0, 1.0); C(0.36, 1.0, 2.0); } }
  else if (c === 'p') C(0.8, 0, 0.5);
  else if (c === 'b') C(0.45, 0, 0.42, 0.9);
  else if (c === '|') C(0.22, 0, Math.min(1.8, H), 1);
  else if (c === 'l') C(0.5, 0, 0.85, 0.4);
  else if (c === 'C') C(0.92, 0, 1.77);
  else if ('IKs'.includes(c)) C(0.5, 0, 0.75, 0.08);
  else if (c === '~') { /* rims ignored */ }
}
function hit(o) { // ray o + t*D, t>0, any box?
  for (const b of boxes) {
    let t0 = 1e-6, t1 = 1e9, ok = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(D[k]) < 1e-12) { if (o[k] < b[k] || o[k] > b[k + 3]) { ok = false; break; } continue; }
      let a = (b[k] - o[k]) / D[k], c = (b[k + 3] - o[k]) / D[k]; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
let n = 0, hid = 0, part = 0, clr = 0;
for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
  if (!A.walkable(L, x, y)) continue; n++;
  let v = 0, m = 0;
  for (const fy of [0.15, 0.5, 0.85]) for (const fx of [0.15, 0.5, 0.85]) { m++; if (!hit([x + fx, 0.001, y + fy])) v++; }
  const f = v / m; if (f < 0.25) hid++; else if (f < 0.75) part++; else clr++;
}
console.log(name, `elev ${elevDeg} az ${azDeg} H ${H}`, 'walkable', n, 'hidden%', (100 * hid / n).toFixed(1), 'partly%', (100 * part / n).toFixed(1), 'clear%', (100 * clr / n).toFixed(1));
