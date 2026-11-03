I kept Parent 1's chase-and-punch core (the only one that fights) and kept Parent 2's push-right when idle, then added grab-escape, throws, a spin kick when surrounded, and heart pickups.

```js
function think(o, mem) {
  var a = {};
  var me = o.me;
  var es = o.enemies || [];
  var e = es[0];
  if (me.grabbed) { a.punch = o.t % 4 < 2; return a; }
  if (me.grabbing) {
    // throw the held enemy, with a few knees first
    if (o.t % 30 < 10) a.punch = o.t % 4 < 2; else a.kick = o.t % 6 < 3;
    return a;
  }
  // count close enemies
  var close = 0;
  for (var i = 0; i < es.length; i++) {
    if (Math.abs(es[i].dx) < 40 && Math.abs(es[i].dy) < 16) close++;
  }
  // head for a nearby heart when hurt and nothing is adjacent
  if (me.hp < me.maxHp * 0.6 && close === 0 && o.items) {
    for (var k = 0; k < o.items.length; k++) {
      var it = o.items[k];
      if (it.kind === 'pickup' && Math.abs(it.dx) < 140 && Math.abs(it.dy) < 80) {
        if (Math.abs(it.dy) > 4) { if (it.dy > 0) a.down = true; else a.up = true; }
        if (Math.abs(it.dx) > 4) { if (it.dx > 0) a.right = true; else a.left = true; }
        return a;
      }
    }
  }
  if (!e) { a.right = true; return a; }
  if (Math.abs(e.dy) > 5) { if (e.dy > 0) a.down = true; else a.up = true; }
  if (Math.abs(e.dx) > 20) { if (e.dx > 0) a.right = true; else a.left = true; }
  if (close >= 3 && me.free && o.t % 40 < 2) {
    a.punch = true; a.kick = true;
    return a;
  }
  if (Math.abs(e.dx) < 28 && Math.abs(e.dy) < 12) {
    // face the enemy first so attacks land
    if (e.dx > 4 && me.facing < 0) a.right = true;
    if (e.dx < -4 && me.facing > 0) a.left = true;
    a.punch = o.t % 9 < 4;
    if (o.t % 47 < 3) { a.punch = false; a.kick = true; }
  }
  return a;
}
```
