// ACCESSION — loads js/core and content/ (in index.html's order) into a hardened vm
// context: Math holds only the allowed functions, and the clock, locale, eval and the
// browser's globals throw if touched, on every path a test runs (BUILD.md §3.3).
// Used by test/run.js and the tools that run the core in Node.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');

const PRELUDE = `
'use strict';
(() => {
  const M = Math, keep = {};
  for (const k of ['imul', 'abs', 'min', 'max', 'floor', 'ceil', 'trunc', 'sign']) keep[k] = M[k];
  Object.defineProperty(globalThis, 'Math', { value: Object.freeze(keep), writable: false, configurable: false });
  for (const name of ['Date', 'Intl', 'eval', 'Function', 'performance', 'setTimeout', 'setInterval', 'queueMicrotask',
    'window', 'self', 'document', 'navigator', 'localStorage', 'indexedDB', 'fetch', 'parseFloat']) {
    Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' is not allowed in the deterministic core'); }, configurable: false });
  }
})();`;

function coreFiles() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f.startsWith('js/core/') || f.startsWith('content/'));
}

// A fresh hardened context with the core loaded; returns every top-level namespace by name.
function loadCore(extraFiles) {
  const ctx = vm.createContext({});
  vm.runInContext(PRELUDE, ctx, { filename: 'prelude.js' });
  const names = [];
  for (const f of [...coreFiles(), ...(extraFiles || [])]) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/^const ([A-Z][A-Za-z0-9]*) =/gm)) names.push(m[1]);
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext('({' + names.join(',') + '})', ctx);
}

module.exports = { loadCore, coreFiles, root };
