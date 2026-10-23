// ACCESSION — the state object: canonical serialisation, hashing, cloning and the
// plain-data check (BUILD.md §3.1, §3.5).
'use strict';
const State = (() => {
  const isPlainObject = v => Object.prototype.toString.call(v) === '[object Object]';

  // Returns the path of the first value that is not plain data, or null: null, booleans,
  // strings, safe integers, arrays without holes, and plain objects without undefined.
  function plainData(v, path) {
    path = path || 'state';
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return null;
    if (typeof v === 'number') return Number.isSafeInteger(v) && !Object.is(v, -0) ? null : path;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) { if (!(i in v)) return path + '[' + i + ']'; const p = plainData(v[i], path + '[' + i + ']'); if (p) return p; }
      return null;
    }
    if (isPlainObject(v)) {
      for (const k of Object.keys(v)) { if (v[k] === undefined) return path + '.' + k; const p = plainData(v[k], path + '.' + k); if (p) return p; }
      return null;
    }
    return path;
  }

  // Canonical JSON: sorted keys, no whitespace. Anything that is not plain data throws.
  function canon(v) {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'boolean' || t === 'string') return JSON.stringify(v);
    if (t === 'number') { if (!Number.isSafeInteger(v) || Object.is(v, -0)) throw new Error('State.canon: not a safe integer: ' + v); return String(v); }
    if (Array.isArray(v)) {
      let s = '[';
      for (let i = 0; i < v.length; i++) { if (!(i in v)) throw new Error('State.canon: array hole'); s += (i ? ',' : '') + canon(v[i]); }
      return s + ']';
    }
    if (isPlainObject(v)) {
      const keys = Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      let s = '{';
      for (let i = 0; i < keys.length; i++) {
        if (v[keys[i]] === undefined) throw new Error('State.canon: undefined at ' + keys[i]);
        s += (i ? ',' : '') + JSON.stringify(keys[i]) + ':' + canon(v[keys[i]]);
      }
      return s + '}';
    }
    throw new Error('State.canon: not plain data (' + Object.prototype.toString.call(v) + ')');
  }

  // 32-bit FNV-1a over UTF-16 code units.
  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const hash = state => fnv1a(canon(state));
  const clone = state => JSON.parse(canon(state));

  return { canon, fnv1a, hash, clone, plainData };
})();
