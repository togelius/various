'use strict';
// What the game remembers between visits: settings, how far you got, and the
// photographs. Storage can be missing or full; everything here fails quietly
// and the game plays the same without it.

const Store = (() => {
  const KEY = 'stalhagen.v1', ALBUM = 'stalhagen.album.v1';
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const phone = touch && typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 600;
  const DEFAULT_KEYS = { left: 'KeyA', right: 'KeyD', jump: 'Space', photo: 'KeyE' };

  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  const saved = read(KEY) || {};
  const data = {
    // on phones the defaults favour legibility and calm
    settings: { large: phone, reduce: phone, muted: false, keys: { ...DEFAULT_KEYS }, ...(saved.settings || {}) },
    progress: { reached: 0, finished: false, ...(saved.progress || {}) },
  };
  data.settings.keys = { ...DEFAULT_KEYS, ...(data.settings.keys || {}) };

  // photographs: {key, chapter, x, caption, src}, and an Image for drawing
  const photos = (read(ALBUM) || []).filter(p => p && p.src).map(p => ({ ...p, img: toImage(p.src) }));

  function toImage(src) {
    if (typeof Image === 'undefined') return null;
    const img = new Image(); img.src = src; return img;
  }
  const save = () => write(KEY, { settings: data.settings, progress: data.progress });
  const saveAlbum = () => {
    const plain = photos.map(({ img, ...p }) => p);
    // if storage is full, keep what fits rather than nothing
    while (plain.length && !write(ALBUM, plain)) plain.shift();
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

    get photos() { return photos; },
    hasPhoto(key) { return photos.some(p => p.key === key); },
    // a canvas snapshot becomes a small JPEG; retaking a view replaces it
    keepPhoto(key, chapter, x, caption, canvas) {
      let src = null;
      try { src = canvas.toDataURL('image/jpeg', 0.8); } catch (e) { /* tainted or unsupported */ }
      const entry = { key, chapter, x, caption, src, img: src ? toImage(src) : canvas };
      const at = photos.findIndex(p => p.key === key);
      if (at >= 0) photos[at] = entry; else photos.push(entry);
      order();
      if (src) saveAlbum();
      return entry;
    },
  };
})();
