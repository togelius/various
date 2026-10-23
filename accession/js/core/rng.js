// ACCESSION — random streams. A stream is named by a path; its 32-bit state lives in
// state.rng[path], so a snapshot resumes every stream exactly (BUILD.md §3.2).
'use strict';
const Rng = (() => {
  // 32-bit string hash (the layout prototype's hashStr).
  function hash32(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  // One mulberry32 step: returns [value, nextState], both uint32.
  function advance(a) {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return [(t ^ (t >>> 14)) >>> 0, a >>> 0];
  }

  // A stream bound to one state object. Creating it is cheap; the state is the record.
  function stream(state, path) {
    const table = state.rng;
    if (!(path in table)) table[path] = hash32(state.seed + '/' + path);
    const u32 = () => { const r = advance(table[path]); table[path] = r[1]; return r[0]; };
    const int = (lo, hi) => lo + (u32() % (hi - lo + 1));
    return {
      path, u32, int,
      chance: permille => u32() % 1000 < permille,
      d100: () => 1 + (u32() % 100),
      pick: arr => arr[u32() % arr.length],
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) { const j = u32() % (i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        return arr;
      },
      // weights: non-negative integers; returns an index.
      weighted(weights) {
        let total = 0;
        for (const w of weights) total += w;
        let r = u32() % total;
        for (let i = 0; i < weights.length; i++) { if (r < weights[i]) return i; r -= weights[i]; }
        return weights.length - 1;
      },
    };
  }

  return { hash32, advance, stream };
})();
