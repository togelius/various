function think(o, mem) {
  var a = {};
  var e = o.enemies[0];
  if (o.me.grabbed) { a.punch = o.t % 4 < 2; return a; }
  if (!e) { a.right = true; return a; }
  if (Math.abs(e.dy) > 5) { if (e.dy > 0) a.down = true; else a.up = true; }
  if (Math.abs(e.dx) > 20) { if (e.dx > 0) a.right = true; else a.left = true; }
  if (Math.abs(e.dx) < 28 && Math.abs(e.dy) < 12) {
    a.punch = o.t % 9 < 4;
    if (o.t % 47 < 3) a.kick = true;
  }
  return a;
}
