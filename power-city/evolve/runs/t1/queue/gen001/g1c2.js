I replaced the walk-right-only parent with a fight-the-nearest-enemy controller that also escapes grabs, grabs and throws or knees, and uses uppercut and spin kick when surrounded.

```js
function think(o, mem) {
  var a = {};
  var me = o.me;
  var e = o.enemies[0];
  if (me.grabbed) { a.punch = o.t % 4 < 2; return a; }
  if (me.grabbing) {
    if (o.t % 30 < 20) a.punch = o.t % 6 < 3; else a.kick = true;
    return a;
  }
  if (!e) {
    a.right = true;
    for (var i = 0; i < o.items.length; i++) {
      var it = o.items[i];
      if (it.kind === 'pickup' && Math.abs(it.dx) < 80 && Math.abs(it.dy) < 40) {
        a.right = it.dx > 6; a.left = it.dx < -6;
        a.down = it.dy > 4; a.up = it.dy < -4;
        break;
      }
    }
    return a;
  }
  var near = 0;
  for (var j = 0; j < o.enemies.length; j++) {
    if (o.enemies[j].dist < 45) near++;
  }
  if (Math.abs(e.dy) > 5) { if (e.dy > 0) a.down = true; else a.up = true; }
  if (Math.abs(e.dx) > 20) { if (e.dx > 0) a.right = true; else a.left = true; }
  else if (Math.abs(e.dx) < 8 && Math.abs(e.dy) < 12) {
    if (e.dx > 0) a.left = true; else a.right = true;
  }
  if (Math.abs(e.dx) < 30 && Math.abs(e.dy) < 12) {
    if (near >= 3 && o.t % 40 < 3) {
      a.punch = true; a.kick = true;
    } else if (e.attacking || e.state === 'attack') {
      a.kick = o.t % 6 < 3;
    } else {
      a.punch = o.t % 9 < 4;
      if (o.t % 47 < 3) a.kick = true;
    }
    if (e.boss && o.t % 11 < 2) a.up = true;
  }
  return a;
}
```
