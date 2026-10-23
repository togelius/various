#!/usr/bin/env node
// ACCESSION — writes a first 64×64 close-up (art/closeups/NAME.txt) for every exhibit
// sprite that has none (BUILD.md §9.1): the board sprite enlarged by Scale2x until 64 wide,
// lit from the upper left, with a cast shadow. It never overwrites a close-up, so one
// redrawn by hand stays; --force NAME rewrites that one. The file has two layers: colour
// (palette keys, '.' clear, ':' cast shadow) and shade ('+' lit, '-' shadow, '=' deep, '.' as is).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const force = process.argv.includes('--force') ? process.argv[process.argv.indexOf('--force') + 1] : null;

function scale2x(rows) {
  const h = rows.length, w = rows[0].length, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : rows[y][x], out = [];
  for (let y = 0; y < h; y++) {
    let a = '', b = '';
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1) ?? P, B = at(x + 1, y) ?? P, C = at(x - 1, y) ?? P, D = at(x, y + 1) ?? P;
      a += (C === A && C !== D && A !== B ? A : P) + (A === B && A !== C && B !== D ? B : P);
      b += (D === C && D !== B && C !== A ? C : P) + (B === D && B !== A && D !== C ? D : P);
    }
    out.push(a, b);
  }
  return out;
}

function make(spriteRows) {
  let rows = spriteRows;
  while (rows.length < 64) rows = scale2x(rows);
  const n = rows.length, clear = (x, y) => x < 0 || y < 0 || x >= n || y >= n || rows[y][x] === '.';
  const col = rows.map(r => r.split('')), shade = rows.map(r => r.split('').map(() => '.'));
  let x0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!clear(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let top = n; for (let y = 0; y < n && top === n; y++) for (let x = 0; x < n; x++) if (!clear(x, y)) { top = y; break; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (clear(x, y) || rows[y][x] === 'o' || rows[y][x] === 'k') continue;
    if (clear(x - 1, y - 1) || clear(x - 2, y - 2) || clear(x, y - 2)) shade[y][x] = '+';
    else if (clear(x + 1, y + 1) || clear(x + 2, y + 1)) shade[y][x] = '=';
    else if (clear(x + 3, y + 3) || clear(x + 3, y)) shade[y][x] = '-';
    else if (y > top + (y1 - top) * 0.8 && (x + y) % 2 === 0) shade[y][x] = '-';
  }
  // The cast shadow: a flat ellipse under the figure, falling to the lower right.
  const cx = (x0 + x1) / 2 + 3, cy = Math.min(n - 3, y1 + 1), rx = Math.max(6, (x1 - x0) * 0.42), ry = 2.6;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!clear(x, y)) continue;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) col[y][x] = ':';
  }
  return { col: col.map(r => r.join('')), shade: shade.map(r => r.join('')) };
}

const dir = path.join(root, 'art/closeups');
fs.mkdirSync(dir, { recursive: true });
let made = 0;
for (const f of fs.readdirSync(path.join(root, 'art/sprites')).filter(f => f.endsWith('.txt')).sort()) {
  const name = f.slice(0, -4), src = fs.readFileSync(path.join(root, 'art/sprites', f), 'utf8');
  if (!/^# kind: exhibit/m.test(src)) continue;
  const out = path.join(dir, f);
  if (fs.existsSync(out) && force !== name) continue;
  const rows = src.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.replace(/\s+$/, ''));
  const c = make(rows);
  fs.writeFileSync(out, `# closeup of: ${name} (art/sprites/${f})\n# source: code, tools/make-closeups.js (Scale2x to 64, lit from the upper left, cast shadow); redraw freely, the tool never overwrites\n# colour\n${c.col.join('\n')}\n# shade\n${c.shade.join('\n')}\n`);
  made++;
}
console.log(`close-ups: ${made} written`);
