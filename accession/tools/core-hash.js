#!/usr/bin/env node
// ACCESSION — coreHash and vmHash (BUILD.md §3.6, §6.1). coreHash names the rules a replay
// was made with: a 32-bit FNV-1a, as 8 hex digits, over every .js file of js/core and
// content/ except js/core/viewmodel.js, each as its path from accession/, a line break, its
// text with line endings made \n, and a line break, in path order. A change to the
// interface, the views or the tools leaves it alone. vmHash is the same over viewmodel.js
// alone, which the bots read (§10.2). build-single.py stamps both into each build.
// Usage: node tools/core-hash.js [--json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..');
const DIRS = ['js/core', 'content'], VIEW_MODEL = 'js/core/viewmodel.js';

// 32-bit FNV-1a over UTF-16 code units, as State.fnv1a (js/core/state.js).
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const hex = h => h.toString(16).padStart(8, '0');

// Every .js file under js/core and content/, as paths from root with '/', in path order.
function sources(root) {
  root = root || ROOT;
  const out = [];
  const walk = rel => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel + '/' + e.name;
      if (e.isDirectory()) walk(r);
      else if (e.isFile() && e.name.endsWith('.js')) out.push(r);
    }
  };
  for (const d of DIRS) walk(d);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const text = (root, f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const over = (root, files) => hex(fnv1a(files.map(f => f + '\n' + text(root, f) + '\n').join('')));

// The files coreHash covers.
const coreFiles = root => sources(root).filter(f => f !== VIEW_MODEL);
const coreHash = root => over(root || ROOT, coreFiles(root));
const vmHash = root => over(root || ROOT, [VIEW_MODEL]);

module.exports = { coreHash, vmHash, coreFiles, sources, fnv1a, VIEW_MODEL };

if (require.main === module) {
  const h = { coreHash: coreHash(), vmHash: vmHash() };
  if (process.argv.includes('--json')) console.log(JSON.stringify(h));
  else console.log(`coreHash ${h.coreHash} (${coreFiles().length} files of js/core and content/, viewmodel.js left out)\nvmHash ${h.vmHash} (${VIEW_MODEL})`);
}
