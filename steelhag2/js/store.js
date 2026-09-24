'use strict';
// What the game remembers between visits: settings, how far you got, and the
// photographs. Storage can be missing or full; everything here fails quietly
// and the game plays the same without it.

const Store = (() => {
  const KEY = 'stalhagen2.v1', ALBUM = 'stalhagen2.album.v1';
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const phone = touch && typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600;
  const DEFAULT_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', use: 'KeyE', torch: 'KeyF', camera: 'KeyC', cut: 'Space' };

  const review = typeof location !== 'undefined' && new URLSearchParams(location.search).has('review');
  const read = k => { if (review) return null; try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { if (review) return true; try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  const saved = read(KEY) || {};
  const data = {
    // on phones the defaults favour legibility and calm
    settings: { large: phone, reduce: phone, muted: review, keys: { ...DEFAULT_KEYS }, ...(saved.settings || {}) },
    progress: { reached: 0, finished: false, save: null, ...(saved.progress || {}) },
  };
  data.settings.keys = { ...DEFAULT_KEYS, ...(data.settings.keys || {}) };

  // photographs: {key, chapter, x, caption, src}, and an Image for drawing
  const photos = (read(ALBUM) || []).filter(p => p && p.src).map(p => ({ ...p, img: toImage(p.src), print: p.neg ? toImage(p.neg) : null }));

  function toImage(src) {
    if (typeof Image === 'undefined') return null;
    const img = new Image(); img.src = src; return img;
  }
  const save = () => write(KEY, { settings: data.settings, progress: data.progress });
  const saveAlbum = () => {
    const plain = photos.map(({ img, print, ...p }) => p);
    // Preserve the existing album if persistence fails. Never silently evict older photographs.
    return write(ALBUM, plain);
  };
  const order = () => photos.sort((a, b) => a.chapter - b.chapter || a.x - b.x);
  order();

  return {
    DEFAULT_KEYS, phone,
    get settings() { return data.settings; },
    setting(name, value) { data.settings[name] = value; save(); },
    bind(action, code) { data.settings.keys[action] = code; save(); },
    resetKeys() { data.settings.keys = { ...DEFAULT_KEYS }; save(); },

    get reached() { return data.progress.reached; },
    get finished() { return data.progress.finished; },
    reach(i) { if (i > data.progress.reached) { data.progress.reached = i; save(); } },
    finish() { data.progress.finished = true; save(); },
    startJourney() { data.progress.finished=false;data.progress.save=null;save(); },
    get save() { return data.progress.save; },
    setSave(v) { data.progress.save = v; save(); },

    get photos() { return photos; },
    hasPhoto(key) { return photos.some(p => p.key === key || p.vantage === key); },
    // two canvases become small JPEGs: what the eye saw, and the negative with the hidden layer, developed later
    keepPhoto(key, chapter, x, caption, seenCanvas, printCanvas, vantage=null) {
      let src = null, neg = null;
      try { src = seenCanvas.toDataURL('image/jpeg', 0.8); neg = printCanvas.toDataURL('image/jpeg', 0.85); } catch (e) { /* tainted or unsupported */ }
      const entry = { key, vantage, chapter, x, caption, src, neg, developed: false, img: src ? toImage(src) : seenCanvas, print: neg ? toImage(neg) : printCanvas };
      const at = photos.findIndex(p => p.key === key);
      if (at >= 0) photos[at] = entry; else photos.push(entry);
      order();
      entry.saved = !!src && saveAlbum();
      return entry;
    },
    develop(entry) { entry.developed = true; saveAlbum(); },
    developBatch(entries) { for(const entry of entries)entry.developed=true;return saveAlbum(); },
    get undeveloped() { return photos.filter(p => !p.developed); },
  };
})();
