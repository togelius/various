#!/usr/bin/env node
// ACCESSION — fails if js/core or content/ uses anything that could break determinism
// (BUILD.md §3.3). It parses each file with acorn and checks real identifiers and member
// accesses, so strings, comments, regex literals and template text never confuse it.
// Usage: node tools/lint-core.js [files…]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const acorn = require('./vendor/acorn/acorn.js');
const root = path.join(__dirname, '..');

const BANNED = new Set(['Date', 'performance', 'crypto', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'window', 'document',
  'globalThis', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'fetch', 'XMLHttpRequest', 'Intl', 'parseFloat', 'eval',
  'Function', 'self', 'top', 'parent', 'frames', 'queueMicrotask', 'WeakRef']);
const MATH_OK = new Set(['imul', 'abs', 'min', 'max', 'floor', 'ceil', 'trunc', 'sign']);
const MEMBERS = new Set(['localeCompare', 'toLocaleString', 'toLocaleDateString', 'toFixed', 'toPrecision']);

function lint(file) {
  const src = fs.readFileSync(file, 'utf8'), out = [];
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true }); }
  catch (e) { return [`${e.message}`]; }
  const say = (node, msg) => out.push(`${node.loc.start.line}: ${msg}`);
  // Walk every node, knowing its parent, so identifiers in key or property position are skipped.
  (function walk(node, parent, key) {
    if (!node || typeof node.type !== 'string') return;
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
      case 'BinaryExpression': case 'AssignmentExpression':
        if (node.operator === '**' || node.operator === '**=') say(node, 'the ** operator is not allowed (floats)');
        break;
      case 'CallExpression':
        if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'sort' && node.arguments.length === 0) say(node, '.sort() needs a comparator');
        break;
      case 'ForInStatement':
        say(node, 'for … in iterates keys in an order the core may not rely on');
        break;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'type') continue;
      const v = node[k];
      if (Array.isArray(v)) for (const c of v) walk(c, node, k);
      else if (v && typeof v.type === 'string') walk(v, node, k);
    }
  })(ast, { type: 'Program' }, null);
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
