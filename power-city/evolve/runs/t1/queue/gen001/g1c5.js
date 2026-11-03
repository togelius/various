I kept Parent 1's proven chase-and-jab loop (Parent 2 only contributed the "walk right when clear" idea) and added heart pickup, a spin kick when swarmed, uppercut/kick variety and grab-throw handling to cut damage taken.

```js
function think(o, mem) {
  var a = {};
  var me = o.me;
  var e = o.enemies[0];
  if (me.grabbed) { a.punch = o.t % 4 < 2; return a; }
  if (me.grabbing) {
    // throw the held enemy periodically, knee otherwise
    if (o.t % 30 < 12) { a.kick = true; } else { a.punch = o.t % 6 < 3; }
    return a;
  }
  if (!e) {
    var it = null, i;
    for (i = 0; i < o.items.length; i++) {
      var k = o.items[i];
      if (k.kind === 'pickup' && Math.abs(k.dx) < 150 && (!it || Math.abs(k.dx) < Math.abs(it.dx))) it = k;
    }
    if (it && me.hp < me.maxHp * 0.9) {
      if (Math.abs(it.dy) > 4) { if (it.dy > 0) a.down = true; else a.up = true; }
      if (Math.abs(it.dx) > 4) { if (it.dx > 0) a.right = true; else a.left = true; }
      return a;
    }
    a.right = true;
    return a;
  }
  var close = 0, j;
  for (j = 0; j < o.enemies.length; j++) {
    var q = o.enemies[j];
    if (Math.abs(q.dx) < 40 && Math.abs(q.dy) < 16) close++;
  }
  if (Math.abs(e.dy) > 5) { if (e.dy > 0) a.down = true; else a.up = true; }
  if (Math.abs(e.dx) > 20) { if (e.dx > 0) a.right = true; else a.left = true; }
  if (Math.abs(e.dx) < 28 && Math.abs(e.dy) < 12) {
    if (close >= 3 && o.t % 40 < 6) {
      a.punch = true; a.kick = true;
    } else if (e.attacking && e.facingMe && me.hp < me.maxHp * 0.4 && Math.abs(e.dx) > 14) {
      // back off from an incoming swing when hurt
      if (e.dx > 0) { a.left = true; a.right = false; } else { a.right = true; a.left = false; }
    } else if (o.t % 31 < 3) {
      a.up = true; a.punch = true;
    } else {
      a.punch = o.t % 9 < 4;
      if (o.t % 47 < 3) a.kick = true;
    }
  }
  return a;
}
```
