// An evaluation worker: receives { id, code, start, opts }, replies { id, result }. One process per core; the pool
// recycles it every so often because a vm context per episode is not freed promptly.
'use strict';
const { runEpisode } = require('./episode');
process.on('message', msg => {
  if (msg.op === 'exit') process.exit(0);
  let result;
  try { result = runEpisode(msg.code, msg.start, msg.opts); }
  catch (e) { result = { start: msg.start && msg.start.id, points: 0, quality: 0, error: 'harness: ' + String(e && e.stack || e).slice(0, 300), ended: 'error' }; }
  process.send({ id: msg.id, result });
});
process.send && process.send({ ready: true });
