// ACCESSION — the phone strip's metrics (BUILD.md §5.3). test/m4-lines.test.js judges every
// gallery line and every Centrepiece's strip, in Node, against the rows the phone's strip
// gives a Behaviour line at 390×844 and text 1.3, by Chromium's own metrics for it, measured
// once and kept in the test (METRICS): the box's width and row, each character's advance and
// each pair's kerning in the strip's font, the rows of the lines it was measured on, and the
// most rows at which the board keeps 40% of the window. Those hold only while this Chromium
// lays the strip out in that font. This check measures them again here, at every check-all,
// and fails on any difference: another font standing in for system-ui (on a system without
// Inter, the longest lines take a row more and the board falls below 40%), a new version of
// it, or a change to the strip's layout. So the Node judgement never outlives what it was
// measured on. A change meant: node test/m4-lines.test.js --write, then read the diff.
import { createRequire } from 'node:module';
import path from 'node:path';
import { root } from './lib.mjs';

const require = createRequire(import.meta.url);
const lines = require(path.join(root, 'test/m4-lines.test.js'));
const m = await lines.measure(root), problems = lines.compare(m), M = lines.METRICS;
for (const p of problems.slice(0, 40)) console.log('PROBLEM ' + p);
if (problems.length > 40) console.log(`PROBLEM … and ${problems.length - 40} more`);
console.log(problems.length
  ? `lines: ${problems.length} difference(s) between the strip measured now (${m.font}, box ${m.width} px) and test/m4-lines.test.js's METRICS; if the change is meant, measure again (node test/m4-lines.test.js --write)`
  : `lines: the strip at 390×844, text 1.3, measures as test/m4-lines.test.js's METRICS: ${m.font}, box ${m.width} px, row ${m.lineHeight} px, ${M.chars.length} advances and every kerning pair, ${M.calibration.length} lines' rows, and the board keeps 40% at ${m.budget} rows, not ${m.budget + 1}; no problems`);
process.exit(problems.length ? 1 : 0);
