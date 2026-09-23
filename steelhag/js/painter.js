'use strict';
// Chapters are painted in a worker when the page carries its own script text
// (the single-file builds), so the next chapter is ready before you reach it.
// Anywhere a worker can't paint, the same code runs on the main thread.

const Painter = (() => {
  const NEEDS = ['util.js', 'art.js', 'world.js', 'levels.js'];
  const BOOT = `
self.onmessage = e => {
  const { id, i, Q } = e.data;
  try {
    const layers = new World(LEVELS[i]).buildLayers(Q);
    const out = layers.map(l => ({ key: l.key, f: l.f, blur: l.blur, w: l.w, h: l.h, canvas: l.canvas.transferToImageBitmap() }));
    self.postMessage({ id, layers: out }, out.map(l => l.canvas));
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
try { const c = new OffscreenCanvas(2, 2).getContext('2d'); if (!c) throw 0; self.postMessage({ ready: true }); }
catch (e) { self.postMessage({ ready: false }); }
`;
  let worker = null, ready = null;            // ready: Promise<boolean>
  const jobs = new Map();                     // chapter -> Promise<layers>
  const waiting = new Map();                  // request id -> resolve/reject
  let nextId = 1, taking = -1;

  function source() {
    const scripts = [...document.querySelectorAll('script')];
    const parts = [];
    for (const name of NEEDS) {
      const el = scripts.find(s => (s.dataset.src || '') === name);
      if (!el || !el.textContent.trim()) return null;
      parts.push(el.textContent);
    }
    return parts.join('\n;\n') + BOOT;
  }

  function start() {
    if (ready) return ready;
    ready = new Promise(resolve => {
      try {
        const src = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && source();
        if (!src) return resolve(false);
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        const timer = setTimeout(() => resolve(false), 5000);
        worker.onmessage = e => {
          const d = e.data;
          if ('ready' in d) { clearTimeout(timer); resolve(d.ready); return; }
          const w = waiting.get(d.id);
          if (!w) return;
          waiting.delete(d.id);
          d.error ? w.reject(new Error(d.error)) : w.resolve(d.layers);
        };
        worker.onerror = () => { clearTimeout(timer); resolve(false); };
      } catch (e) { resolve(false); }
    });
    return ready;
  }

  function onMain(i, Q) { return new World(LEVELS[i]).buildLayers(Q); }
  // known without waiting: can a worker even be tried here?
  let possible = null;
  const mayWork = () => possible ?? (possible = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && !!source());

  function paint(i, Q) {
    if (jobs.has(i)) return jobs.get(i);
    const job = start().then(ok => {
      if (!ok) return onMain(i, Q);
      return new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        worker.postMessage({ id, i, Q });
      }).catch(() => onMain(i, Q));
    });
    jobs.set(i, job);
    return job;
  }

  function release(layers) {
    for (const l of layers || []) { if (l.canvas.close) l.canvas.close(); else l.canvas.width = 0; }
  }

  return {
    // Layers for chapter i: {sync: layers} when painted right here, else a promise.
    take(i, Q) {
      if (!jobs.has(i) && !mayWork()) return { sync: onMain(i, Q) };
      taking = i;
      const p = paint(i, Q); jobs.delete(i);
      p.then(() => { if (taking === i) taking = -1; }, () => { if (taking === i) taking = -1; });
      return p;
    },
    // only worth it off the main thread; there it would stall play instead
    prefetch(i, Q) { if (i >= 0 && i < LEVELS.length && i !== taking) start().then(ok => { if (ok && i !== taking) paint(i, Q); }); },
    // Forget prepared chapters that are no longer next (e.g. after a chapter select).
    drop(keep) { for (const [i, p] of jobs) if (i !== keep) { jobs.delete(i); p.then(release, () => {}); } },
    release,
    get usesWorker() { return ready; },
  };
})();
