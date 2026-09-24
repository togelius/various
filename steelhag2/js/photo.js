// STÅLHAGEN II — photography. The viewfinder is the only first-person view and the only place 04 exists. A shutter
// takes two pictures: the thumbnail the eye saw, and a negative with the hidden layer, which the darkroom develops.
'use strict';
const Photo = (() => {
  const W = 640, H = 360;
  const S = { negatives: [], polaroid: null, developing: null };

  function key(ch, x, z) { return `${ch}:${Math.round(x)}:${Math.round(z)}`; }
  function nearVantage(chapter, px, pz) {
    for (const v of World.S.vantages) { if (!v.key.startsWith(chapter + ':')) continue; if (Math.hypot(px - v.x, pz - v.z) < 5) return v; }
    return null;
  }
  // Take the picture: the scene as it is, and the scene with the hidden layer, graded as a print.
  function shoot(scene, chapter, px, pz, vantage) {
    const seen = RENDER.snapshot(scene, W, H, false, false);
    const print = RENDER.snapshot(scene, W, H, true, true);
    const k = vantage ? vantage.key : key(chapter, px, pz) + ':' + Date.now();
    const caption = vantage ? vantage.caption : '';
    const entry = Store.keepPhoto(k, chapter, px, caption, seen, print);
    S.polaroid = { canvas: seen, t: 0, count: Store.photos.length, saved: entry.saved };
    return entry;
  }
  return { S, nearVantage, shoot, W, H };
})();
