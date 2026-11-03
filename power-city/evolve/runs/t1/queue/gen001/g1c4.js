Changed to a slower, move-varied style: it cycles kick, uppercut, jump kick and spin kick about once per 70 frames (roughly 0.85 attacks/sec), with an occasional jab, while still closing in on enemies and walking right when the street is clear.

```js
function think(o, mem) {
  var a = {};
  var me = o.me;
  var e = o.enemies[0];
  if (mem.n === undefined) { mem.n = 0; mem.next = 0; mem.start = -999; mem.type = 0; }
  if (me.grabbed) { a.punch = o.t % 4 < 2; return a; }
  if (me.grabbing) {
    // throw the held enemy, then release the key
    a.kick = o.t % 10 < 3;
    return a;
  }
  if (!e) { a.right = true; return a; }

  var inRange = Math.abs(e.dx) < 40 && Math.abs(e.dy) < 14;
  var age = o.t - mem.start;

  // continue an attack already in progress
  if (age >= 0 && age < 14) {
    var ty = mem.type;
    if (ty === 0) a.kick = age < 3;
    else if (ty === 1) { a.up = true; a.punch = age < 3; }
    else if (ty === 2) {
      a.jump = age < 2;
      if (age >= 6) a.kick = age < 9;
    } else if (ty === 3) { a.punch = age < 3; a.kick = age < 3; }
    else a.punch = age < 3;
    if (e.dx > 8) a.right = ty === 2 && age > 2;
    else if (e.dx < -8) a.left = ty === 2 && age > 2;
    return a;
  }

  // approach
  if (Math.abs(e.dy) > 6) { if (e.dy > 0) a.down = true; else a.up = true; }
  if (Math.abs(e.dx) > 30) { if (e.dx > 0) a.right = true; else a.left = true; }
  else if (Math.abs(e.dx) < 14 && inRange) {
    // too close: face the enemy by stepping slightly toward it
    if (e.dx > 0) a.right = true; else if (e.dx < 0) a.left = true;
  }

  if (inRange && me.free && o.t >= mem.next) {
    var k = mem.n % 8;
    mem.type = k === 7 ? 4 : (k % 4);
    // jab-free mix: kick, uppercut, jump kick, spin kick
    if (e.attacking && mem.type === 3) mem.type = 1;
    mem.n++;
    mem.start = o.t;
    mem.next = o.t + 68;
  }
  return a;
}
```
