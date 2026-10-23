#!/usr/bin/env node
'use strict';
// Inlines the rules into the game (DESIGN §18.7). index.html stays one standalone file: the rules module sits in it
// between the two markers, exactly as the file has it:
//   /* ==== RULES:BEGIN ==== */<newline><the rules file, byte for byte>/* ==== RULES:END ==== */
// The rules file must be pure: it is loaded first in an empty vm context with only the language's own globals
// (tools/lib/rules-vm.cjs), and the build fails otherwise.
//   node clack-stack/tools/build.cjs [--rules=path] [--html=path] [--check]
//     --rules  the rules file to inline (default clack-stack/rules.js)
//     --html   the page to write (default clack-stack/index.html)
//     --check  write nothing; exit 1 if the page's rules block differs from the rules file (or is missing, or the file
//              is not pure)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rulesVm = require('./lib/rules-vm.cjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const RULES = path.resolve(opt('rules', rulesVm.RULES_JS));
const HTML = path.resolve(opt('html', rulesVm.INDEX));
const CHECK = argv.includes('--check');
const { BEGIN, END } = rulesVm;
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

function fail(msg) { console.log('FAIL ' + msg); process.exitCode = 1; }

(function main() {
  if (!fs.existsSync(RULES)) return fail('no rules file at ' + RULES);
  if (!fs.existsSync(HTML)) return fail('no page at ' + HTML);
  const src = fs.readFileSync(RULES, 'utf8');
  // the rules must load pure (no DOM, time, randomness or Node) and export the API of §18.7
  let R;
  try { R = rulesVm.load({ from: { source: src, file: RULES } }); } catch (e) { return fail('the rules do not load pure: ' + e.message); }
  if (src.indexOf(BEGIN) >= 0 || src.indexOf(END) >= 0) return fail('the rules file contains a RULES marker');
  if (/<\/script/i.test(src)) return fail('the rules file contains </script, which would end the page\'s script');
  const html = fs.readFileSync(HTML, 'utf8');
  const i = html.indexOf(BEGIN), j = html.indexOf(END);
  if (i < 0 || j < i || html.indexOf(BEGIN, i + 1) >= 0 || html.indexOf(END, j + 1) >= 0) return fail(path.basename(HTML) + ' must hold exactly one ' + BEGIN + ' … ' + END + ' block');
  const block = html.slice(i + BEGIN.length, j), want = '\n' + src;
  const reasons = R.REASONS.join(', ');
  if (CHECK) {
    if (block !== want) {
      // where they part, for the report
      let k = 0; while (k < block.length && k < want.length && block[k] === want[k]) k++;
      const line = want.slice(0, k).split('\n').length - 1;
      return fail(`the rules block in ${path.basename(HTML)} (sha ${sha(block.slice(1))}) differs from ${RULES} (sha ${sha(src)}) from line ${line} of the file`);
    }
    // and the page's copy loads pure too (it is the same text, so this is the same check made on what ships)
    try { rulesVm.load({ from: { source: block, file: HTML + '#RULES' } }); } catch (e) { return fail('the page\'s rules block does not load pure: ' + e.message); }
    console.log(`PASS the rules block in ${path.basename(HTML)} is ${RULES} (sha ${sha(src)}, ${src.split('\n').length - 1} lines, reasons: ${reasons})`);
    return;
  }
  if (block === want) { console.log(`unchanged: ${path.basename(HTML)} already holds ${RULES} (sha ${sha(src)})`); return; }
  const out = html.slice(0, i + BEGIN.length) + want + html.slice(j);
  fs.writeFileSync(HTML, out);
  console.log(`inlined ${RULES} (sha ${sha(src)}, reasons: ${reasons}) into ${HTML}`);
})();
