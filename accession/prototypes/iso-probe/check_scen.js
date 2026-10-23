const fs = require('fs'); const A = require('./common.js');
for (const name of Object.keys(A.SCEN)) {
  const L = A.parse(fs.readFileSync(`layouts/${name}.txt`, 'utf8'));
  const R = A.resolve(L, name);
  console.log('==', name, L.W + 'x' + L.H, 'player', R.player, 'player tile', L.at(...R.player));
  for (const e of R.exhibits) console.log(' ', e.id, e.where, [e.x, e.y], 'tile', JSON.stringify(e.tile), 'inLOS', e.visible);
  console.log('  telegraph', JSON.stringify(R.telegraphTiles), 'tap path', R.tapPath && R.tapPath.length);
  const mk = {}; for (const e of R.exhibits) mk[e.x + ',' + e.y] = e.id;
  const tg = new Set(R.telegraphTiles.map(t => t.join(','))), tp = new Set((R.tapPath || []).map(t => t.join(',')));
  for (let y = 0; y < L.H; y++) { let s = ''; for (let x = 0; x < L.W; x++) {
    const k = x + ',' + y; let c = L.at(x, y);
    if (x === R.player[0] && y === R.player[1]) c = '@'; else if (mk[k]) c = mk[k]; else if (tg.has(k)) c = '*'; else if (tp.has(k)) c = ':';
    s += R.vis[y * L.W + x] ? c : (c === '#' ? ' ' : c === '.' ? ' ' : c.toLowerCase());
  } console.log(String(y).padStart(2) + ' ' + s); }
}
