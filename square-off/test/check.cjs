'use strict';
// `npm run check`: node --check every JS file in the project (no dependencies).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', 'dist', '.shots', 'vendor', '.git']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(c?js)$/.test(e.name) && e.name !== 'geo.js') files.push(p);
  }
})(root);
let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (err) { bad++; console.error('✗', path.relative(root, f) + '\n' + String(err.stderr || err.message)); }
}
console.log(`${files.length - bad}/${files.length} files pass node --check`);
process.exit(bad ? 1 : 0);
