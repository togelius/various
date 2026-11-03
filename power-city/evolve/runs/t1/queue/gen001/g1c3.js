I kept Parent 1's chase-and-punch core, and took Parent 2's "keep moving right" for when the street is clear. I added heart pickups when hurt, an uppercut on attacking or adjacent enemies, and a retreat from swinging enemies to cut damage.

```js
function think(o, mem) {
  var a = {};
  var m = o.me;
  var e = o.enemies[0];
  if (m.grabbed) { a.punch = o.t % 4 < 2; return a; }
  if (m.grabbing) {
    a.kick = o.t % 20 < 10;
    return a;
  }
  // Heal when hurt: walk to nearby hearts
  if (m.hp < m.maxHp * 0.5 && o.items) {
    for (var i = 0; i < o.items.length; i++) {
      var it = o.items[i];
      if (it.kind === 'pickup' && Math.abs(it.dx) + Math.abs(it.dy) < 150 && (!e || e.dist > 40)) {
        if (Math.abs(it.dy) > 4) { if (it.dy > 0) a.down = true; else a.up = true; }
        if (Math.abs(it.dx) > 4) { if (it.dx > 0) a.right = true; else a.left = true; }
        return a;
      }
    }
  }
  if (!e) { a.right = true; return a; }
  if (Math.abs(e.dy) > 5) { if (e.dy > 0) a.down = true; else a.up = true; }
  var close = Math.abs(e.dx) < 28 && Math.abs(e.dy) < 12;
  // Back off briefly from a swing that is about to land at range
  if (e.attacking && !close && Math.abs(e.dx) < 50 && Math.abs(e.dy) < 14) {
    if (e.dx > 0) a.left = true; else a.right = true;
    return a;
  }
  if (Math.abs(e.dx) > 20) { if (e.dx > 0) a.right = true; else a.left = true; }
  if (close) {
    if (e.dx * m.facing < 0) {
      // facing away: turn by pressing toward enemy, then punch
      a.punch = o.t % 6 < 3;
    } else if (e.attacking) {
      a.up = true;
      a.punch = o.t % 6 < 3;
    } else {
      a.punch = o.t % 9 < 4;
      if (o.t % 37 < 3) { a.punch = false; a.kick = true; }
    }
    if (o.enemyCount > 2 && o.t % 61 < 2) { a.punch = true; a.kick = true; }
  }
  return a;
}
```
