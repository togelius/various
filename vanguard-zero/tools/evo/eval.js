/* Score controller files on the train or held-out test starts.
 *
 *   node tools/evo/eval.js tools/evo/seeds/*.js [--set=train|test|both] [-v]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const S = require('./sandbox');

function arg(n, d) {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=').slice(1).join('=') : d;
}

function main() {
  const files = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const which = arg('set', 'both');
  const verbose = process.argv.includes('-v');
  const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasks.json'), 'utf8'));
  const world = H.boot();
  const sets = which === 'both' ? ['train', 'test'] : [which];

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const line = [path.basename(f).padEnd(22), String(src.length).padStart(5) + ' ch'];
    for (const set of sets) {
      const t0 = Date.now();
      const r = S.evaluate(world, src, tasks[set]);
      if (r.fatal) { line.push(set + ': ' + r.fatal); continue; }
      line.push(set + ' ' + r.quality.toFixed(3) + (r.feasible ? '' : ' (infeasible ' + r.violation.toFixed(2) + ')') +
        '  aggr ' + r.aggression.toFixed(2) + ' (' + r.shotsPerSec.toFixed(1) + '/s)  ent ' + r.entropy.toFixed(3) +
        '  ' + (r.frames / ((Date.now() - t0) / 1000) / 1000).toFixed(1) + 'k fps');
      if (verbose) {
        for (const x of r.tasks) {
          console.log('    ' + x.id.padEnd(12) + (x.progress * 100).toFixed(0).padStart(4) + '%  ' +
            x.end.padEnd(16) + ' from x ' + String(x.x0).padStart(5) + ' to ' + String(x.maxX).padStart(5) +
            '  ' + String(x.frames).padStart(5) + 'f  hp-' + x.hpLost + '  shots ' + x.shots + ' kills ' + x.kills);
        }
      }
    }
    console.log(line.join('   '));
  }
}

main();
