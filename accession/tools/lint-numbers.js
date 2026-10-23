#!/usr/bin/env node
// ACCESSION — compares the numbers-of-record table in BUILD.md (§8.10, between the
// numbers:begin and numbers:end markers) with js/core/numbers.js. Any difference fails.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const md = fs.readFileSync(process.argv[2] || path.join(root, 'BUILD.md'), 'utf8');
const a = md.indexOf('<!-- numbers:begin -->'), b = md.indexOf('<!-- numbers:end -->');
if (a < 0 || b < a) { console.log('lint-numbers: markers not found in BUILD.md'); process.exit(1); }

function parseValue(v) {
  const one = s => {
    s = s.trim();
    let m = s.match(/^(\d+)-(\d+)$/);
    if (m) return [+m[1], +m[2]];
    if (/^-?\d+$/.test(s)) return +s;
    throw new Error('cannot read value "' + s + '"');
  };
  return v.includes(' / ') ? v.split(' / ').map(one) : one(v);
}

const table = {};
for (const line of md.slice(a, b).split('\n')) {
  const cells = line.split('|').map(c => c.trim());
  if (cells.length < 4 || !/^[A-Z][A-Z0-9_]*$/.test(cells[1])) continue;
  if (cells[1] in table) { console.log(`lint-numbers: ${cells[1]} appears twice in BUILD.md`); process.exit(1); }
  table[cells[1]] = parseValue(cells[2]);
}

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/core/numbers.js'), 'utf8'), ctx);
const code = vm.runInContext('N', ctx);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
let bad = 0;
for (const k of Object.keys(table)) {
  if (!(k in code)) { bad++; console.log(`lint-numbers: ${k} is in BUILD.md but not in numbers.js`); }
  else if (!same(table[k], code[k])) { bad++; console.log(`lint-numbers: ${k} is ${JSON.stringify(table[k])} in BUILD.md but ${JSON.stringify(code[k])} in numbers.js`); }
}
for (const k of Object.keys(code)) if (!(k in table)) { bad++; console.log(`lint-numbers: ${k} is in numbers.js but not in BUILD.md`); }
if (bad) { console.log(`lint-numbers: ${bad} problem(s)`); process.exit(1); }
console.log(`lint-numbers: ${Object.keys(table).length} numbers match BUILD.md`);
