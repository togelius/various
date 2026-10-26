#!/usr/bin/env node
// ACCESSION — fails if js/core or content/ uses anything that could break determinism
// (BUILD.md §3.3); check-all also runs it on the tools that run beside the core in the
// hardened context and on the hash page (arena, monkey, replay, the policies). It parses each file with acorn and checks real identifiers and member
// accesses, so strings, comments, regex literals and template text never confuse it.
// Usage: node tools/lint-core.js [files…]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const acorn = require('./vendor/acorn/acorn.js');
const root = path.join(__dirname, '..');

const BANNED = new Set(['Date', 'performance', 'crypto', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'window', 'document',
  'globalThis', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'fetch', 'XMLHttpRequest', 'Intl', 'parseFloat', 'eval',
  'Function', 'self', 'top', 'parent', 'frames', 'queueMicrotask', 'WeakRef', 'FinalizationRegistry']);
const MATH_OK = new Set(['imul', 'abs', 'min', 'max', 'floor', 'ceil', 'trunc', 'sign']);
// Members that depend on the locale or on floats, wherever they are reached from (parseFloat
// through Number too); a member read by destructuring counts as well.
const MEMBERS = new Set(['localeCompare', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toLocaleUpperCase', 'toLocaleLowerCase',
  'toFixed', 'toPrecision', 'parseFloat']);
// A sort needs a comparator: none, or one written as undefined or null, sorts by strings.
const SORTS = new Set(['sort', 'toSorted']);
const noComparator = args => args.length === 0 || (args.length === 1 && ((args[0].type === 'Identifier' && args[0].name === 'undefined') || (args[0].type === 'Literal' && args[0].value === null)));
// A comparator that returns a comparison (a > b: true or false) never returns a negative
// number, so engines sort with it differently (§3.3): an arrow or function whose body, or
// whose one statement, a return, is a <, >, <= or >= comparison.
const COMPARISONS = new Set(['<', '>', '<=', '>=']);
function boolComparator(args) {
  const f = args[0];
  if (args.length !== 1 || !f || (f.type !== 'ArrowFunctionExpression' && f.type !== 'FunctionExpression')) return false;
  let body = f.body;
  if (body.type === 'BlockStatement') { if (body.body.length !== 1 || body.body[0].type !== 'ReturnStatement') return false; body = body.body[0].argument; }
  return !!body && body.type === 'BinaryExpression' && COMPARISONS.has(body.operator);
}
// A policy file (one that calls Policies.add, other than lib.js, which holds the registry)
// keeps no state of its own (§10.2): the sim loads it once into a context it shares between
// runs, so a let or var outside a function, or in a function called where it is written at
// the top (an IIFE), lasts from one run into the next, and so does a const there holding an
// object, an array or a new one, which can be changed, unless it is frozen (Object.freeze).
// What a policy remembers goes in obs.memory.
const isPolicyFile = (file, src) => path.basename(file) !== 'lib.js' && /\bPolicies\.add\s*\(/.test(src);
const MUTABLE = new Set(['ObjectExpression', 'ArrayExpression', 'NewExpression']);
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function lint(file) {
  const src = fs.readFileSync(file, 'utf8'), out = [], policy = isPolicyFile(file, src);
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true }); }
  catch (e) { return [`${e.message}`]; }
  const say = (node, msg) => out.push(`${node.loc.start.line}: ${msg}`);
  // Walk every node, knowing its parent, so identifiers in key or property position are skipped,
  // and whether it is at the file's top (outside every function but an IIFE there).
  (function walk(node, parent, key, top) {
    if (!node || typeof node.type !== 'string') return;
    if (FUNCTIONS.has(node.type) && !(top && parent.type === 'CallExpression' && key === 'callee')) top = false;
    if (policy && top && node.type === 'VariableDeclaration') {
      if (node.kind !== 'const') say(node, `a policy file keeps state of its own here (${node.kind} outside a function lasts from one run into the next); keep what a policy remembers in obs.memory`);
      else for (const d of node.declarations) if (d.init && MUTABLE.has(d.init.type))
        say(d, `a policy file keeps state of its own here (a const ${d.init.type === 'NewExpression' ? 'new object' : d.init.type === 'ArrayExpression' ? 'array' : 'object'} outside a function can be changed, and lasts from one run into the next); freeze it, or keep what a policy remembers in obs.memory`);
    }
    switch (node.type) {
      case 'Identifier': {
        const isKey = (parent.type === 'MemberExpression' && key === 'property' && !parent.computed)
          || (parent.type === 'Property' && key === 'key' && !parent.computed)
          || (parent.type === 'MethodDefinition' && key === 'key') || parent.type === 'LabeledStatement';
        if (isKey) break;
        if (BANNED.has(node.name)) say(node, `${node.name} is not allowed in the deterministic core`);
        if (node.name === 'Math' && !(parent.type === 'MemberExpression' && key === 'object' && !parent.computed && MATH_OK.has(parent.property.name)))
          say(node, parent.type === 'MemberExpression' && !parent.computed ? `Math.${parent.property.name} is not allowed in the deterministic core` : 'Math may only be used as Math.imul, abs, min, max, floor, ceil, trunc or sign');
        break;
      }
      case 'MemberExpression':
        if (!node.computed && MEMBERS.has(node.property.name)) say(node, `.${node.property.name} depends on the locale or on floats`);
        break;
      case 'Property':
        if (parent.type === 'ObjectPattern' && !node.computed && node.key.type === 'Identifier' && MEMBERS.has(node.key.name)) say(node, `${node.key.name} depends on the locale or on floats`);
        break;
      case 'BinaryExpression': case 'AssignmentExpression':
        if (node.operator === '**' || node.operator === '**=') say(node, 'the ** operator is not allowed (floats)');
        break;
      case 'CallExpression':
        if (node.callee.type === 'MemberExpression' && !node.callee.computed && SORTS.has(node.callee.property.name) && noComparator(node.arguments)) say(node, `.${node.callee.property.name}() needs a comparator`);
        else if (node.callee.type === 'MemberExpression' && !node.callee.computed && SORTS.has(node.callee.property.name) && boolComparator(node.arguments)) say(node, `.${node.callee.property.name}() needs a comparator that returns a negative number, zero or a positive one, not true or false`);
        // A call through .constructor reaches the Function constructor from any function.
        if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'constructor') say(node, 'a call through .constructor (the Function constructor) is not allowed');
        break;
      case 'NewExpression':
        if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'constructor') say(node, 'a call through .constructor (the Function constructor) is not allowed');
        break;
      case 'ForInStatement':
        say(node, 'for … in iterates keys in an order the core may not rely on');
        break;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'type') continue;
      const v = node[k];
      if (Array.isArray(v)) for (const c of v) walk(c, node, k, top);
      else if (v && typeof v.type === 'string') walk(v, node, k, top);
    }
  })(ast, { type: 'Program' }, null, true);
  return out;
}

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : e.name.endsWith('.js') ? [p] : [];
  }).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : [...files(path.join(root, 'js/core')), ...files(path.join(root, 'content'))];
let bad = 0;
for (const f of targets) for (const m of lint(f)) { bad++; console.log(`${path.relative(root, f)}:${m}`); }
if (bad) { console.log(`lint-core: ${bad} problem(s)`); process.exit(1); }
console.log(`lint-core: ${targets.length} files clean`);
