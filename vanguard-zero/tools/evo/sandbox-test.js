/* The sandbox has to hold against LLM-written code, so it is tested the way
 * that code could fail or cheat.
 *
 *   node tools/evo/sandbox-test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./headless');
const S = require('./sandbox');
const { Pool } = require('./pool');

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ok    ' : '  FAIL  ') + name + (detail ? '   (' + detail + ')' : ''));
  if (!ok) failed++;
}

const TASKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasks.json'), 'utf8'));
const SHORT = TASKS.train.slice(0, 2).map(t => Object.assign({}, t, { frames: 240 }));

async function main() {
  const world = H.boot();

  console.log('containment (static checks bypassed: this is the vm layer alone)');
  // Every classic route out of a vm context, reported back through the buttons.
  const escape = `
    function control(obs, mem) {
      var found = [];
      var tries = [
        function () { return obs['constr' + 'uctor']['constr' + 'uctor']('return typeof process')(); },
        function () { return obs.tile['constr' + 'uctor']('return typeof process')(); },
        function () { return ({})['constr' + 'uctor']['constr' + 'uctor']('return this')().process; },
        // Sloppy-mode \`this\` is the controller's own global: present, but empty.
        function () { return typeof this.process; },
        function () { return typeof this['V' + 'Z']; },
        function () { return typeof globalThis['V' + 'Z']; },
        function () { return typeof globalThis['req' + 'uire']; }
      ];
      for (var i = 0; i < tries.length; i++) {
        try { var r = tries[i](); if (r && r !== 'undefined') found.push(i + ':' + r); } catch (e) {}
      }
      mem.found = found.join(',');
      return found.length ? { dash: true } : { right: true };
    }`;
  const c = new S.Controller(escape);
  c.reset(1);
  S.setupTask(world, SHORT[0]);
  const bits = c.step(S.observe(world.VZ, world.game, 0));
  const found = c.ctx.mem.found;
  check('no route from a controller to process, require or the game', bits === 2 && !found, found || 'nothing reachable');

  // A controller cannot change the game: it only ever sees a JSON copy.
  const tamper = `function control(obs, mem) { obs.me.x = 99999; obs.me.hp = 99; obs.goalDx = 0; return { right: true }; }`;
  const r1 = S.evaluate(world, tamper, SHORT);
  check('writing to obs changes nothing in the game', r1.tasks.every(t => t.maxX < 9000), 'maxX ' + r1.tasks.map(t => t.maxX).join(', '));

  console.log('\nstatic rules');
  check('forbidden name is refused', !S.staticCheck('function control(){ return process; }').runnable);
  check('a name inside a comment is fine', S.staticCheck('// do not require anything\nfunction control(){ return {}; }').runnable);
  const big = '// intent: big\nfunction control(obs, mem) { return { right: true }; }\n' + '// pad\n'.repeat(700);
  const rb = S.evaluate(world, big, SHORT);
  check('over the size limit runs but is infeasible', !rb.feasible && rb.check.oversize > 0 && rb.tasks.length === SHORT.length,
    big.length + ' chars, violation ' + rb.violation.toFixed(2));
  check('within the size limit is feasible', S.evaluate(world, '// intent: x\nfunction control(){ return { right: true }; }', SHORT).feasible);

  console.log('\nfailure modes');
  const thrower = '// intent: x\nfunction control(obs) { if (obs.t % 3 === 0) throw new Error("boom"); return { right: true }; }';
  const rt = S.evaluate(world, thrower, SHORT);
  check('a controller that throws often is infeasible', !rt.feasible && rt.errorRate > 0.2, 'error rate ' + rt.errorRate.toFixed(2));
  const slow = '// intent: x\nfunction control(obs) { if (obs.t === 30) { var e = Date.now; var t = 0; for (var i = 0; i < 3e8; i++) t += i; } return { right: true }; }';
  // (Date is forbidden statically; bypass to test the frame clock itself.)
  const cs = new S.Controller(slow.replace('var e = Date.now; ', ''));
  let ended = null;
  S.setupTask(world, SHORT[0]); cs.reset(1);
  for (let f = 0; f < 60; f++) {
    try { cs.step(S.observe(world.VZ, world.game, f)); } catch (e) { ended = e.message; break; }
  }
  check('a frame over the time budget ends the run', ended === 'frame timed out', ended);

  const pool = new Pool(1, { deadlineMs: 4000 });
  const t0 = Date.now();
  const hung = await pool.evaluate('// intent: x\nfunction control(obs) { if (obs.t === 5) { for (;;) {} } return {}; }', SHORT);
  const fine = await pool.evaluate('// intent: x\nfunction control() { return { right: true }; }', SHORT);
  pool.close();
  check('an infinite loop is killed at the deadline and scored infeasible', hung.hung && !hung.feasible, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  check('the pool recovers and scores the next controller', fine.feasible && fine.quality > 0, 'quality ' + (fine.quality || 0).toFixed(3));

  console.log('\nreproducibility');
  const rnd = '// intent: x\nfunction control(obs) { return { right: Math.random() < 0.8, jump: Math.random() < 0.2, fire: Math.random() < 0.3 }; }';
  const a = S.evaluate(world, rnd, TASKS.train.slice(0, 4));
  const b = S.evaluate(H.boot(), rnd, TASKS.train.slice(0, 4));
  check('same controller, same tasks, fresh world: identical scores',
    JSON.stringify(a.tasks) === JSON.stringify(b.tasks) && a.entropy === b.entropy, 'quality ' + a.quality.toFixed(4) + ' vs ' + b.quality.toFixed(4));

  console.log(failed ? '\n' + failed + ' FAILED' : '\nall passed');
  process.exitCode = failed ? 1 : 0;
}

main();
