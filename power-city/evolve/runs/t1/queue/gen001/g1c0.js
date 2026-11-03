I replaced the walk-right-only controller with an enemy-chasing brawler that aligns depth, faces the target, jabs in bursts, mixes in kicks and uppercuts, and mashes punch to escape grabs.

```js
function think(o, mem) {
  var a = {};
  var me = o.me;
  if (me.grabbed) { a.punch = o.t % 4 < 2; return a; }
  var e = o.enemies[0];
  if (!e) {
    // nothing near: grab a nearby pickup if any, else advance
    var it = o.items && o.items[0];
    if (it && it.kind === 'pickup' && Math.abs(it.dx) < 60 && Math.abs(it.dy) < 40) {
      if (Math.abs(it.dy) > 4) { if (it.dy > 0) a.down = true; else a.up = true; }
      if (Math.abs(it.dx) > 4) { if (it.dx > 0) a.right = true; else a.left = true; }
      return a;
    }
    a.right = true;
    return a;
  }
  var adx = Math.abs(e.dx), ady = Math.abs(e.dy);
  if (ady > 5) { if (e.dy > 0) a.down = true; else a.up = true; }
  if (adx > 20) { if (e.dx > 0) a.right = true; else a.left = true; }
  if (adx < 30 && ady < 12) {
    var toward = e.dx > 0 ? 1 : -1;
    var phase = o.t % 9;
    if (me.facing !== toward && adx > 4) {
      // turn to face the enemy during the release part of the cycle
      if (phase >= 4) { if (toward > 0) a.right = true; else a.left = true; }
    } else if (e.attacking && o.t % 3 === 0) {
      a.kick = true;
    } else if (o.t % 31 < 3 && o.enemyCount < 3) {
      a.up = true; a.punch = true;
    } else if (o.t % 47 < 3) {
      a.kick = true;
    } else {
      a.punch = phase < 4;
    }
  }
  return a;
}
```
