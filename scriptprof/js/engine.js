/* SCRIPTPROF — rewrite-rule engine (PuzzleJAX-shaped, JavaScript).
 *
 * A compiled game is a bag of objects, collision layers, and local pattern
 * rewrites. A tick is: stamp the player's input as a force, apply non-late
 * rules until they quiet down, resolve movement along collision layers, apply
 * late rules, then test win conditions. That is the PuzzleScript loop, cut
 * down to the subset the parser accepts.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScriptProf = Object.assign(root.ScriptProf || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DX = [0, -1, 1, 0, 0];
  var DY = [0, 0, 0, -1, 1];
  var DIRNAME = ['none', 'left', 'right', 'up', 'down'];
  var DIR_FROM = { left: 1, right: 2, up: 3, down: 4 };
  var OPPOSITE = [0, 2, 1, 4, 3];

  // Relative arrows given a pattern orientation (the direction we scan).
  function relToAbs(rel, orient) {
    var o = DIR_FROM[orient];
    if (!rel) return 0;
    if (rel === 'fwd') return o;
    if (rel === 'back') return OPPOSITE[o];
    if (rel === 'relup') {
      if (o === 2) return 3; // facing right, ^ is up
      if (o === 1) return 4;
      if (o === 3) return 1;
      if (o === 4) return 2;
    }
    if (rel === 'reldown') {
      if (o === 2) return 4;
      if (o === 1) return 3;
      if (o === 3) return 2;
      if (o === 4) return 1;
    }
    if (DIR_FROM[rel]) return DIR_FROM[rel];
    return 0;
  }

  function stepXY(x, y, orient, i) {
    var o = DIR_FROM[orient];
    return { x: x + DX[o] * i, y: y + DY[o] * i };
  }

  function idx(state, x, y) {
    return y * state.w + x;
  }

  function inb(state, x, y) {
    return x >= 0 && y >= 0 && x < state.w && y < state.h;
  }

  function hasId(state, x, y, id) {
    return (state.mask[idx(state, x, y)] & (1 << id)) !== 0;
  }

  function getDir(state, x, y, id) {
    return state.dir[idx(state, x, y) * state.n + id];
  }

  function setDir(state, x, y, id, d) {
    state.dir[idx(state, x, y) * state.n + id] = d;
  }

  function addObj(state, x, y, id) {
    state.mask[idx(state, x, y)] |= (1 << id);
  }

  function remObj(state, x, y, id) {
    var i = idx(state, x, y);
    state.mask[i] &= ~(1 << id);
    state.dir[i * state.n + id] = 0;
  }

  function cloneState(state) {
    return {
      w: state.w,
      h: state.h,
      n: state.n,
      mask: new Uint32Array(state.mask),
      dir: new Uint8Array(state.dir),
      won: state.won,
      cancelled: false
    };
  }

  function hashState(state) {
    var h = 2166136261, i;
    for (i = 0; i < state.mask.length; i++) {
      h ^= state.mask[i];
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function keyState(state) {
    return state.mask.join(',');
  }

  function resolveName(compiled, name) {
    name = String(name).toLowerCase();
    if (compiled.nameToId[name] !== undefined) return { ids: [compiled.nameToId[name]], or: false };
    var g = compiled.groups[name];
    if (g) return g;
    return { ids: [], or: false };
  }

  function compileAtoms(compiled, atoms) {
    return (atoms || []).map(function (a) {
      var r = resolveName(compiled, a.name);
      return { no: !!a.no, dir: a.dir || null, ids: r.ids, or: r.or || r.ids.length > 1 };
    });
  }

  function compile(game) {
    var objects = game.objects || [];
    if (objects.length > 31) throw new Error('too many objects (max 31)');
    var names = objects.map(function (o) { return o.name; });
    var nameToId = {};
    names.forEach(function (n, i) { nameToId[n] = i; });
    var groups = {};

    function ensureGroup(name, spec) {
      groups[name] = spec;
    }

    (game.legend || []).forEach(function (L) {
      var key = L.key;
      var members = L.members || [];
      if (key.length === 1) {
        // Character legend is handled separately; still register named aliases.
      }
      var ids = [];
      members.forEach(function (m) {
        if (nameToId[m] !== undefined) ids.push(nameToId[m]);
        else if (groups[m]) ids = ids.concat(groups[m].ids);
      });
      if (L.kind === 'or') ensureGroup(key.toLowerCase(), { ids: ids, or: true });
      else if (L.kind === 'and') ensureGroup(key.toLowerCase(), { ids: ids, or: false, and: true });
      else if (ids.length) {
        if (nameToId[key.toLowerCase()] === undefined) {
          ensureGroup(key.toLowerCase(), { ids: ids, or: ids.length > 1 });
        }
      }
    });

    var charMap = {};
    (game.legend || []).forEach(function (L) {
      if (L.key.length !== 1) return;
      var ids = [];
      var and = L.kind === 'and';
      (L.members || []).forEach(function (m) {
        if (nameToId[m] !== undefined) ids.push(nameToId[m]);
        else if (groups[m]) ids = ids.concat(groups[m].ids);
      });
      charMap[L.key] = { ids: ids, and: and };
    });
    objects.forEach(function (o) {
      if (o.legend && o.legend.length === 1 && !charMap[o.legend]) {
        charMap[o.legend] = { ids: [nameToId[o.name]], and: false };
      }
    });

    var layerOf = new Int8Array(objects.length).fill(0);
    (game.layers || []).forEach(function (layer, li) {
      layer.forEach(function (nm) {
        if (nameToId[nm] !== undefined) layerOf[nameToId[nm]] = li;
        else if (groups[nm]) {
          groups[nm].ids.forEach(function (id) { layerOf[id] = li; });
        }
      });
    });

    var playerIds = [];
    if (nameToId.player !== undefined) playerIds.push(nameToId.player);
    if (groups.player) playerIds = playerIds.concat(groups.player.ids);
    playerIds = playerIds.filter(function (v, i, a) { return a.indexOf(v) === i; });

    var backgroundId = nameToId.background !== undefined ? nameToId.background : -1;

    var stub = { nameToId: nameToId, groups: groups };
    var rules = (game.rules || []).filter(function (r) { return r.lhs; }).map(function (r) {
      var orients = r.orients;
      if (!orients || !orients.length) orients = ['right', 'up', 'left', 'down'];
      return {
        late: !!r.late,
        orients: orients,
        lhs: (r.lhs || []).map(function (cell) { return compileAtoms(stub, cell); }),
        rhs: (r.rhs || []).map(function (cell) { return compileAtoms(stub, cell); }),
        raw: r.raw
      };
    });

    var win = (game.win || []).map(function (w) {
      var a = resolveName({ nameToId: nameToId, groups: groups }, w.a);
      var b = w.b ? resolveName({ nameToId: nameToId, groups: groups }, w.b) : { ids: [] };
      return { kind: w.kind, a: a.ids, b: b.ids };
    });

    return {
      title: game.title,
      author: game.author,
      n: objects.length,
      names: names,
      objects: objects,
      nameToId: nameToId,
      groups: groups,
      charMap: charMap,
      layerOf: layerOf,
      playerIds: playerIds,
      backgroundId: backgroundId,
      rules: rules,
      win: win,
      levels: game.levels || [],
      source: game.source || ''
    };
  }

  function boot(compiled, levelIndex) {
    var lv = compiled.levels[levelIndex || 0];
    if (!lv) throw new Error('no such level');
    var grid = lv.grid;
    var h = grid.length;
    var w = grid[0].length;
    var state = {
      w: w,
      h: h,
      n: compiled.n,
      mask: new Uint32Array(w * h),
      dir: new Uint8Array(w * h * compiled.n),
      won: false,
      cancelled: false
    };
    var y, x, ch, spec, k;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        ch = (grid[y][x] || ' ');
        spec = compiled.charMap[ch];
        if (compiled.backgroundId >= 0) addObj(state, x, y, compiled.backgroundId);
        if (spec) {
          for (k = 0; k < spec.ids.length; k++) addObj(state, x, y, spec.ids[k]);
        }
      }
    }
    state.won = checkWin(compiled, state);
    return state;
  }

  function cellHasAny(state, x, y, ids) {
    var i;
    for (i = 0; i < ids.length; i++) if (hasId(state, x, y, ids[i])) return true;
    return false;
  }

  function cellHasAll(state, x, y, ids) {
    var i;
    for (i = 0; i < ids.length; i++) if (!hasId(state, x, y, ids[i])) return false;
    return ids.length > 0;
  }

  function firstPresent(state, x, y, ids) {
    var i;
    for (i = 0; i < ids.length; i++) if (hasId(state, x, y, ids[i])) return ids[i];
    return -1;
  }

  function atomMatches(state, x, y, atom, orient) {
    if (atom.no) {
      return !cellHasAny(state, x, y, atom.ids);
    }
    var id = firstPresent(state, x, y, atom.ids);
    if (id < 0) return false;
    if (!atom.dir) return true;
    var d = getDir(state, x, y, id);
    if (atom.dir === 'stationary') return d === 0;
    if (atom.dir === 'moving') return d !== 0;
    var want = relToAbs(atom.dir, orient);
    return d === want;
  }

  function matchAt(state, rule, x, y, orient) {
    var n = rule.lhs.length;
    var cells = [];
    var i, j, p;
    for (i = 0; i < n; i++) {
      p = stepXY(x, y, orient, i);
      if (!inb(state, p.x, p.y)) return null;
      var lhs = rule.lhs[i];
      for (j = 0; j < lhs.length; j++) {
        if (!atomMatches(state, p.x, p.y, lhs[j], orient)) return null;
      }
      cells.push({ x: p.x, y: p.y, lhs: lhs, rhs: rule.rhs[i] || [] });
    }
    return { cells: cells, orient: orient };
  }

  function boundId(state, x, y, atom) {
    return firstPresent(state, x, y, atom.ids);
  }

  function applyMatch(state, match) {
    var orient = match.orient;
    match.cells.forEach(function (c) {
      var referred = [];
      c.lhs.forEach(function (atom) {
        if (atom.no) return;
        var id = boundId(state, c.x, c.y, atom);
        if (id >= 0) referred.push({ id: id, dirReferred: !!atom.dir, atom: atom });
      });
      var rhsIds = [];
      c.rhs.forEach(function (atom) {
        if (atom.no) {
          atom.ids.forEach(function (id) { remObj(state, c.x, c.y, id); });
          return;
        }
        var id = -1;
        // Prefer the LHS binding of the same name/group.
        var i;
        for (i = 0; i < referred.length; i++) {
          if (atom.ids.indexOf(referred[i].id) >= 0) { id = referred[i].id; break; }
        }
        if (id < 0) id = atom.ids[0];
        if (id === undefined || id < 0) return;
        addObj(state, c.x, c.y, id);
        rhsIds.push(id);
        if (atom.dir === 'stationary') setDir(state, c.x, c.y, id, 0);
        else if (atom.dir === 'moving') {
          // keep existing, or copy from referred moving object
          if (getDir(state, c.x, c.y, id) === 0) {
            for (i = 0; i < referred.length; i++) {
              var d = getDir(state, c.x, c.y, referred[i].id);
              if (d) { setDir(state, c.x, c.y, id, d); break; }
            }
          }
        } else if (atom.dir) {
          setDir(state, c.x, c.y, id, relToAbs(atom.dir, orient));
        } else {
          // object mentioned without a dir: if LHS referred its movement, clear it
          for (i = 0; i < referred.length; i++) {
            if (referred[i].id === id && referred[i].dirReferred) {
              setDir(state, c.x, c.y, id, 0);
            }
          }
        }
      });
      referred.forEach(function (r) {
        if (rhsIds.indexOf(r.id) < 0) remObj(state, c.x, c.y, r.id);
      });
    });
  }

  function applyRule(state, rule) {
    var matches = [];
    var o, x, y, m;
    for (o = 0; o < rule.orients.length; o++) {
      for (y = 0; y < state.h; y++) {
        for (x = 0; x < state.w; x++) {
          m = matchAt(state, rule, x, y, rule.orients[o]);
          if (m) matches.push(m);
        }
      }
    }
    if (!matches.length) return false;
    var before = keyState(state) + ':' + state.dir.join(',');
    matches.forEach(function (match) { applyMatch(state, match); });
    var after = keyState(state) + ':' + state.dir.join(',');
    return before !== after;
  }

  function applyRuleSet(compiled, state, late) {
    var rules = compiled.rules.filter(function (r) { return !!r.late === late; });
    var guard = 0;
    var any = false;
    while (guard++ < 64) {
      var changed = false;
      var i;
      for (i = 0; i < rules.length; i++) {
        var g = 0;
        while (g++ < 32) {
          if (!applyRule(state, rules[i])) break;
          changed = true;
          any = true;
        }
      }
      if (!changed) break;
    }
    return any;
  }

  function sameLayerBlocker(compiled, state, x, y, id, movingDir) {
    var layer = compiled.layerOf[id];
    var mask = state.mask[idx(state, x, y)];
    var k, bit;
    for (k = 0; k < compiled.n; k++) {
      bit = 1 << k;
      if ((mask & bit) === 0) continue;
      if (k === id) continue;
      if (compiled.layerOf[k] !== layer) continue;
      var d = getDir(state, x, y, k);
      if (d !== movingDir) return true;
    }
    return false;
  }

  function resolveMovement(compiled, state) {
    var changed = true, guard = 0;
    var x, y, id, d, nx, ny;
    while (changed && guard++ < 64) {
      changed = false;
      for (y = 0; y < state.h; y++) {
        for (x = 0; x < state.w; x++) {
          for (id = 0; id < compiled.n; id++) {
            d = getDir(state, x, y, id);
            if (!d) continue;
            nx = x + DX[d];
            ny = y + DY[d];
            if (!inb(state, nx, ny) || sameLayerBlocker(compiled, state, nx, ny, id, d)) {
              setDir(state, x, y, id, 0);
              changed = true;
            }
          }
        }
      }
    }
    // Apply remaining movements simultaneously.
    var moves = [];
    for (y = 0; y < state.h; y++) {
      for (x = 0; x < state.w; x++) {
        for (id = 0; id < compiled.n; id++) {
          d = getDir(state, x, y, id);
          if (!d) continue;
          moves.push({ x: x, y: y, id: id, d: d, nx: x + DX[d], ny: y + DY[d] });
        }
      }
    }
    moves.forEach(function (m) {
      remObj(state, m.x, m.y, m.id);
    });
    moves.forEach(function (m) {
      addObj(state, m.nx, m.ny, m.id);
      // leftover force does not persist into the next turn
    });
  }

  function stampPlayer(compiled, state, action) {
    if (!action) return;
    var d = typeof action === 'number' ? action : DIR_FROM[action];
    if (!d) return;
    var x, y, i, id;
    for (y = 0; y < state.h; y++) {
      for (x = 0; x < state.w; x++) {
        for (i = 0; i < compiled.playerIds.length; i++) {
          id = compiled.playerIds[i];
          if (hasId(state, x, y, id)) setDir(state, x, y, id, d);
        }
      }
    }
  }

  function clearDirs(state) {
    state.dir.fill(0);
  }

  function checkWin(compiled, state) {
    if (!compiled.win.length) return false;
    var i, x, y, w, ok;
    for (i = 0; i < compiled.win.length; i++) {
      w = compiled.win[i];
      ok = false;
      if (w.kind === 'all_on') {
        ok = true;
        for (y = 0; y < state.h && ok; y++) {
          for (x = 0; x < state.w; x++) {
            if (cellHasAny(state, x, y, w.a) && !cellHasAny(state, x, y, w.b)) { ok = false; break; }
          }
        }
        // vacuously true if no A exists — PuzzleScript counts that as win.
      } else if (w.kind === 'some_on') {
        for (y = 0; y < state.h && !ok; y++) {
          for (x = 0; x < state.w; x++) {
            if (cellHasAny(state, x, y, w.a) && cellHasAny(state, x, y, w.b)) { ok = true; break; }
          }
        }
      } else if (w.kind === 'no') {
        ok = true;
        for (y = 0; y < state.h && ok; y++) {
          for (x = 0; x < state.w; x++) {
            if (cellHasAny(state, x, y, w.a)) { ok = false; break; }
          }
        }
      } else if (w.kind === 'some') {
        for (y = 0; y < state.h && !ok; y++) {
          for (x = 0; x < state.w; x++) {
            if (cellHasAny(state, x, y, w.a)) { ok = true; break; }
          }
        }
      } else if (w.kind === 'all') {
        ok = true;
        for (y = 0; y < state.h && ok; y++) {
          for (x = 0; x < state.w; x++) {
            if (!cellHasAny(state, x, y, w.a)) { ok = false; break; }
          }
        }
      }
      if (!ok) return false;
    }
    return true;
  }

  function tick(compiled, state, action) {
    var next = cloneState(state);
    next.won = false;
    stampPlayer(compiled, next, action);
    applyRuleSet(compiled, next, false);
    resolveMovement(compiled, next);
    applyRuleSet(compiled, next, true);
    clearDirs(next);
    next.won = checkWin(compiled, next);
    return next;
  }

  function ascii(compiled, state) {
    var lines = [], y, x, id, ch, best;
    var inverse = {};
    Object.keys(compiled.charMap).forEach(function (c) {
      var spec = compiled.charMap[c];
      if (spec.ids.length === 1) inverse[spec.ids[0]] = inverse[spec.ids[0]] || c;
    });
    for (y = 0; y < state.h; y++) {
      var row = '';
      for (x = 0; x < state.w; x++) {
        ch = compiled.backgroundId >= 0 ? '.' : ' ';
        best = -1;
        for (id = 0; id < compiled.n; id++) {
          if (id === compiled.backgroundId) continue;
          if (hasId(state, x, y, id)) {
            best = id;
            if (compiled.charMap) {
              // prefer a char that includes this object
            }
          }
        }
        if (best >= 0) {
          ch = inverse[best] || compiled.names[best].charAt(0).toUpperCase();
          // overlays: crate+target often '@'
          Object.keys(compiled.charMap).forEach(function (c) {
            var spec = compiled.charMap[c];
            if (spec.ids.length > 1 && cellHasAll(state, x, y, spec.ids)) ch = c;
          });
        }
        row += ch;
      }
      lines.push(row);
    }
    return lines.join('\n');
  }

  function objectsAt(compiled, state, x, y) {
    var out = [], id;
    for (id = 0; id < compiled.n; id++) {
      if (hasId(state, x, y, id)) out.push(id);
    }
    return out;
  }

  return {
    DX: DX,
    DY: DY,
    DIRNAME: DIRNAME,
    DIR_FROM: DIR_FROM,
    compile: compile,
    boot: boot,
    tick: tick,
    cloneState: cloneState,
    hashState: hashState,
    keyState: keyState,
    checkWin: checkWin,
    ascii: ascii,
    objectsAt: objectsAt,
    hasId: function (compiledOrState, xOrState, yOrX, idOrY, maybeId) {
      if (maybeId !== undefined) return hasId(xOrState, yOrX, idOrY, maybeId);
      return hasId(compiledOrState, xOrState, yOrX, idOrY);
    }
  };
});
