'use strict';
// Loads clack-stack/rules.js the way §18.7 demands: in an empty vm context (the language's own globals, Math among
// them, and nothing of Node's), so a rules module that reaches for the DOM, time, randomness, require or process fails
// to load. load({from: 'index'}) takes the copy inlined into index.html between the RULES markers instead.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const RULES_JS = path.join(ROOT, 'rules.js');
const INDEX = path.join(ROOT, 'index.html');
const BEGIN = '/* ==== RULES:BEGIN ==== */', END = '/* ==== RULES:END ==== */';

// what pure rules may not use (Math.random is in Math, so it is checked by name)
const FORBIDDEN = /\b(Date|performance|Math\.random|crypto|window|document|globalThis|require|process|setTimeout|setInterval|console|localStorage|fetch)\b/;

function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1'); }

function sourceFrom(from) {
  if (!from || from === 'file') return { src: fs.readFileSync(RULES_JS, 'utf8'), file: RULES_JS };
  if (from === 'index') {
    const html = fs.readFileSync(INDEX, 'utf8');
    const i = html.indexOf(BEGIN), j = html.indexOf(END);
    if (i < 0 || j < i) throw new Error('index.html has no RULES:BEGIN/RULES:END section yet');
    return { src: html.slice(i + BEGIN.length, j), file: INDEX + '#RULES' };
  }
  if (typeof from === 'object' && typeof from.source === 'string') return { src: from.source, file: from.file || 'rules (text)' };
  throw new Error('rules-vm: unknown source ' + from);
}

// load(opts?) -> the RULES API. opts.from: 'file' (default) | 'index' | {source, file}
function load(opts) {
  const { src, file } = sourceFrom(opts && opts.from);
  const bad = stripComments(src).match(FORBIDDEN);
  if (bad) throw new Error('rules-vm: ' + file + ' uses ' + bad[0] + ' (the rules must be pure)');
  const ctx = vm.createContext(Object.create(null));
  vm.runInContext(src + '\n;this.__RULES__ = RULES;', ctx, { filename: file });
  const R = ctx.__RULES__;
  for (const k of ['newBuild', 'drop', 'place', 'fitsAll', 'key', 'pull', 'REASONS']) {
    if (!(k in R)) throw new Error('rules-vm: ' + file + ' does not export ' + k);
  }
  return R;
}

module.exports = { load, RULES_JS, INDEX, BEGIN, END };
