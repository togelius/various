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

// A number of record set to another value in numbers.js's source, for a test that shows a
// rule reads its number (opts.numbers = {KEY: value}); a key numbers.js lacks throws.
function withNumbers(src, numbers) {
  for (const [key, value] of Object.entries(numbers || {})) {
    const re = new RegExp('^(\\s*' + key + ': )[^,\\n]+,', 'm');
    if (!re.test(src)) throw new Error(`loadCore: numbers.js has no ${key}`);
    src = src.replace(re, (m, head) => head + JSON.stringify(value) + ',');
  }
  return src;
}

// A fresh hardened context with the core loaded, then any extra files (paths relative to
// accession/, or absolute); returns every top-level namespace by name. opts.numbers sets
// numbers of record to other values (tests only).
function loadCore(extraFiles, opts) {
  const ctx = vm.createContext({});
  vm.runInContext(PRELUDE, ctx, { filename: 'prelude.js' });
  const names = [];
  for (const f of [...coreFiles(), ...(extraFiles || [])]) {
    let src = fs.readFileSync(path.resolve(root, f), 'utf8');
    if (f === 'js/core/numbers.js' && opts && opts.numbers) src = withNumbers(src, opts.numbers);
    for (const m of src.matchAll(/^const ([A-Z][A-Za-z0-9]*) =/gm)) names.push(m[1]);
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext('({' + names.join(',') + '})', ctx);
}

module.exports = { loadCore, coreFiles, root };
