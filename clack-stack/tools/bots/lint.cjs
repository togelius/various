#!/usr/bin/env node
'use strict';
// The percept-only lint (DESIGN §18.8 G3): fails any bot that reads the game's internals. A bot is every file in
// tools/bots/ but this one and harness.cjs (the harness alone touches the page). A bot may only use what its act()
// is given (the percept) and plain JavaScript; it may require nothing but ./percept.cjs (itself linted). Flagged:
//  - names that reach out of the bot: CS, window, document, globalThis, global, self, page, process, require (but
//    require('./percept.cjs')), module.parent, require.cache, eval, Function, import(), fetch, localStorage,
//    performance, the rules (RULES), and the game's own objects (S, HAND, GHOST, WOB, TW, DL, CAM, PREFS, EVENTS);
//  - a way round them: .constructor, __proto__, Reflect, Proxy, a computed member read with a string naming any of
//    the above, a with statement;
//  - fields of the game's state or the rules' answers that the percept does not carry (key, col, handCol, outcome,
//    reason, members, base, stage, phase, lastRelease, events, state()).
// Checks itself first: every planted violation in its own list must be caught.
//   node clack-stack/tools/bots/lint.cjs [file ...]
const fs = require('fs');
const path = require('path');
let acorn, walk;
try { acorn = require('acorn'); walk = require('acorn-walk'); } catch (e) { acorn = require('/opt/node-tools/node_modules/acorn'); walk = require('/opt/node-tools/node_modules/acorn-walk'); }

const NAMES = new Set(['CS', 'window', 'document', 'globalThis', 'global', 'self', 'page', 'process', 'eval', 'Function', 'fetch', 'localStorage',
  'sessionStorage', 'performance', 'RULES', 'S', 'HAND', 'GHOST', 'WOB', 'TW', 'DL', 'CAM', 'PREFS', 'EVENTS', 'Reflect', 'Proxy', 'XMLHttpRequest',
  'WebSocket', 'Buffer', '__dirname', '__filename']);
const PROPS = new Set(['constructor', '__proto__', 'prototype', 'key', 'col', 'handCol', 'outcome', 'reason', 'members', 'base', 'stage', 'phase',
  'lastRelease', 'events', 'state', 'evaluate', 'parent', 'cache', 'mainModule', 'reasonLabel', 'ghostGaps', 'rulesKey']);
const ALLOWED_REQUIRE = new Set(['./percept.cjs']);
const EXEMPT = new Set(['lint.cjs', 'harness.cjs']);

function lintSource(src, file) {
  const errs = [];
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true }); }
  catch (e) { return [`${file}: does not parse: ${e.message}`]; }
  const at = n => `${file}:${n.loc.start.line}`;
  // names the bot declares itself (its own variables may shadow nothing above: we flag the global names anyway)
  walk.fullAncestor(ast, (node, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    switch (node.type) {
      case 'Identifier': {
        // a property name (a.b) or an object key ({b: 1}) is not a reference
        if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) break;
        if (parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) break;
        if (parent && parent.type === 'MethodDefinition' && parent.key === node) break;
        if (node.name === 'require') {
          const call = parent && parent.type === 'CallExpression' && parent.callee === node ? parent : null;
          if (!call || call.arguments.length !== 1 || call.arguments[0].type !== 'Literal' || !ALLOWED_REQUIRE.has(call.arguments[0].value)) errs.push(`${at(node)}: require of anything but ./percept.cjs`);
          break;
        }
        if (node.name === 'module') {
          // module.exports = … is how a bot exports itself; nothing else of module
          if (!(parent && parent.type === 'MemberExpression' && parent.object === node && !parent.computed && parent.property.name === 'exports')) errs.push(`${at(node)}: module.${parent && parent.property ? parent.property.name : '?'}`);
          break;
        }
        if (NAMES.has(node.name)) errs.push(`${at(node)}: reads ${node.name}`);
        break;
      }
      case 'MemberExpression': {
        const name = !node.computed ? node.property.name : node.property.type === 'Literal' ? String(node.property.value) : null;
        if (name !== null && (PROPS.has(name) || NAMES.has(name))) errs.push(`${at(node)}: reads .${name}`);
        if (node.computed && node.property.type === 'TemplateLiteral') errs.push(`${at(node)}: a computed member read by a template string`);
        break;
      }
      case 'ImportExpression': errs.push(`${at(node)}: import()`); break;
      case 'WithStatement': errs.push(`${at(node)}: with`); break;
      case 'NewExpression': if (node.callee.type === 'Identifier' && node.callee.name === 'Function') errs.push(`${at(node)}: new Function`); break;
    }
  });
  return errs;
}

// planted violations: each must be caught
const PLANTS = [
  'const s = CS.state();', 'page.evaluate(() => 1);', "const fs = require('fs');", "require('../g3lib.cjs');", 'const k = d.ghost.key;',
  'const c = p.hand.col;', 'globalThis.x = 1;', "const w = p['CS'];", 'eval("1");', 'const f = ({}).constructor.constructor("return this")();',
  'const r = module.parent;', 'import("x");', 'with (p) {}', 'const e = window.CS;', "const x = p.ghost.reason;", 'const q = process.env;',
  "const g = require(name);", 'const t = WOB.W;', 'const o = p.outcome;', 'const ph = p.phase;',
];

function lintFiles(files) {
  const out = [];
  for (const f of files) out.push(...lintSource(fs.readFileSync(f, 'utf8'), path.relative(process.cwd(), f)));
  return out;
}
function botFiles(dir) { return fs.readdirSync(dir).filter(f => f.endsWith('.cjs') && !EXEMPT.has(f)).map(f => path.join(dir, f)); }

function main() {
  let bad = 0;
  const missed = PLANTS.filter(src => !lintSource(src, 'plant').length);
  console.log(`${missed.length ? 'FAIL' : 'ok  '} the lint catches every planted violation (${PLANTS.length - missed.length}/${PLANTS.length})` + (missed.length ? ': missed ' + missed.join(' | ') : ''));
  if (missed.length) bad++;
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const list = files.length ? files.map(f => path.resolve(f)) : botFiles(__dirname);
  const errs = lintFiles(list);
  console.log(`${errs.length ? 'FAIL' : 'ok  '} ${list.length} bot files read nothing of the game's (${list.map(f => path.basename(f)).join(', ')})` + (errs.length ? ':\n  ' + errs.join('\n  ') : ''));
  if (errs.length) bad++;
  return bad;
}

module.exports = { lintSource, lintFiles, botFiles, PLANTS };
if (require.main === module) process.exitCode = main() ? 1 : 0;
