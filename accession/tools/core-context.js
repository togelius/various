// ACCESSION — loads js/core and content/ (in index.html's order) into a hardened vm
// context: Math holds only the allowed functions, and the clock, locale, eval and the
// browser's globals throw if touched, on every path a test runs (BUILD.md §3.3).
// Used by test/run.js and the tools that run the core in Node.
//
// Speed. A name the scripts read from a vm context's global object (Math, Object, JSON…) is
// looked up through the context's interceptor each time, some 30 times slower than in a page
// or in Node: Math.imul in State.fnv1a's loop made hashing a state cost 30 times what it does
// in a browser, and the tests spent a quarter of their CPU time on such lookups. So, after the
// prelude, BIND declares each builtin the core and the tools run beside it name (BUILTINS) as
// a constant of the context's script scope, holding the same object, which every later script
// reads as fast as a page does (test/m3-infra.test.js holds BUILTINS to what they name). Math
// is the prelude's frozen one, so the hardening is the same. And each file of the tree is read
// and compiled once a process (again if it changes), not once a context.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');

const PRELUDE = `
'use strict';
(() => {
  const M = Math, keep = {};
  for (const k of ['imul', 'abs', 'min', 'max', 'floor', 'ceil', 'trunc', 'sign']) keep[k] = M[k];
  // Configurable only so that BIND can declare Math a constant holding this same frozen object.
  Object.defineProperty(globalThis, 'Math', { value: Object.freeze(keep), writable: false, configurable: true });
  for (const name of ['Date', 'Intl', 'eval', 'Function', 'performance', 'setTimeout', 'setInterval', 'queueMicrotask',
    'window', 'self', 'document', 'navigator', 'localStorage', 'indexedDB', 'fetch', 'parseFloat']) {
    Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' is not allowed in the deterministic core'); }, configurable: false });
  }
})();`;
// The builtins BIND declares. Not undefined, NaN and Infinity, which a context's global holds
// unconfigurably (an engine reads undefined at once anyway), nor the names the prelude bans.
const BUILTINS = ['Object', 'Array', 'Number', 'String', 'Boolean', 'Math', 'JSON', 'Error', 'TypeError', 'RangeError',
  'Map', 'Set', 'WeakMap', 'Symbol', 'RegExp', 'ArrayBuffer', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array',
  'Uint32Array', 'Int32Array', 'parseInt', 'isNaN', 'isFinite'];
const BIND = `'use strict';\nconst ${BUILTINS.map(n => `${n} = globalThis.${n}`).join(', ')};`;

function coreFiles() {
  const html = text(path.join(root, 'index.html'));
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

// A file's text: a file of this tree (the core, content, the tools) is read once a process and
// again whenever it changes (its size, inode or modification time differ); any other file (a
// test's planted copy) is read every time.
const texts = new Map(), inTree = abs => abs.startsWith(root + path.sep);
function text(abs) {
  if (!inTree(abs)) return fs.readFileSync(abs, 'utf8');
  const st = fs.statSync(abs, { bigint: true }), had = texts.get(abs);
  if (had && had.mtimeNs === st.mtimeNs && had.size === st.size && had.ino === st.ino) return had.src;
  const src = fs.readFileSync(abs, 'utf8');
  texts.set(abs, { mtimeNs: st.mtimeNs, size: st.size, ino: st.ino, src });
  return src;
}
// A file's compiled script and the namespaces it declares ({script, names}), made once a
// process for each text it has (a few at most: numbers.js with opts.numbers has others) and run
// in every context that loads it.
const scripts = new Map(), TEXTS_A_FILE = 8;
function script(src, filename) {
  let byText = scripts.get(filename);
  if (!byText) scripts.set(filename, byText = new Map());
  let made = byText.get(src);
  if (!made) {
    if (byText.size >= TEXTS_A_FILE) byText.clear();
    made = { script: new vm.Script(src, { filename }), names: [...src.matchAll(/^const ([A-Z][A-Za-z0-9]*) =/gm)].map(m => m[1]) };
    byText.set(src, made);
  }
  return made;
}

// A fresh hardened context with the core loaded, then any extra files (paths relative to
// accession/, or absolute); returns every top-level namespace by name. opts.numbers sets
// numbers of record to other values (tests only).
function loadCore(extraFiles, opts) {
  const ctx = vm.createContext({});
  script(PRELUDE, 'prelude.js').script.runInContext(ctx);
  script(BIND, 'bind.js').script.runInContext(ctx);
  const names = [];
  for (const f of [...coreFiles(), ...(extraFiles || [])]) {
    let src = text(path.resolve(root, f));
    if (f === 'js/core/numbers.js' && opts && opts.numbers) src = withNumbers(src, opts.numbers);
    const s = script(src, f);
    for (const n of s.names) names.push(n);
    s.script.runInContext(ctx);
  }
  return vm.runInContext('({' + names.join(',') + '})', ctx);
}

module.exports = { loadCore, coreFiles, root, BUILTINS };
