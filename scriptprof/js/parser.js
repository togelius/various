/* SCRIPTPROF — PuzzleScript subset parser / emitter.
 *
 * Enough of the language for ScriptDoctor-style compile-and-repair and for
 * GAVEL-style constrained mutants: objects, legend, collision layers, rewrite
 * rules (with rotations, late, NO, relative arrows), win conditions, levels.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ScriptProf = Object.assign(root.ScriptProf || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLORS = {
    black: '#1a1814',
    white: '#f4efe4',
    grey: '#7a7368',
    gray: '#7a7368',
    darkgrey: '#4a453c',
    darkgray: '#4a453c',
    lightgrey: '#c4bba8',
    lightgray: '#c4bba8',
    red: '#d6453a',
    darkred: '#8a241c',
    lightred: '#ef8d7a',
    brown: '#8b5a2b',
    darkbrown: '#4a2c14',
    lightbrown: '#c49a6c',
    orange: '#e0892f',
    yellow: '#e6c15a',
    green: '#3d9a5f',
    darkgreen: '#1f5a34',
    lightgreen: '#8ed3a0',
    blue: '#3a6ea5',
    lightblue: '#8bb8e0',
    darkblue: '#1d3a66',
    purple: '#7a4ea3',
    pink: '#e07aa5',
    transparent: 'transparent'
  };

  function parseColor(tok) {
    if (!tok) return '#888888';
    var t = tok.trim();
    if (t.charAt(0) === '#') {
      if (t.length === 4) {
        return '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
      }
      return t;
    }
    var key = t.toLowerCase();
    if (COLORS[key]) return COLORS[key];
    return '#888888';
  }

  function stripComment(line) {
    var out = '', i, depth = 0;
    for (i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (c === '(') { depth++; continue; }
      if (c === ')') { if (depth > 0) depth--; continue; }
      if (depth === 0) out += c;
    }
    return out;
  }

  function isBanner(line) {
    return /^=+$/.test(line.trim());
  }

  function sectionName(line) {
    var t = line.trim().toLowerCase().replace(/\s+/g, '');
    var names = {
      objects: 'objects',
      legend: 'legend',
      sounds: 'sounds',
      collisionlayers: 'collisionlayers',
      rules: 'rules',
      winconditions: 'winconditions',
      levels: 'levels'
    };
    return names[t] || null;
  }

  function tokenize(s) {
    return s.trim().split(/\s+/).filter(Boolean);
  }

  var DIR_WORDS = {
    '>': 'fwd',
    '<': 'back',
    '^': 'relup',
    'v': 'reldown',
    'up': 'up',
    'down': 'down',
    'left': 'left',
    'right': 'right',
    'stationary': 'stationary',
    'moving': 'moving'
  };

  function parseAtomList(cellText) {
    var toks = tokenize(cellText.replace(/,/g, ' '));
    var atoms = [];
    var i = 0;
    while (i < toks.length) {
      var no = false;
      var dir = null;
      var t = toks[i].toLowerCase();
      if (t === 'no') { no = true; i++; if (i >= toks.length) break; t = toks[i].toLowerCase(); }
      if (DIR_WORDS[t]) { dir = DIR_WORDS[t]; i++; if (i >= toks.length) break; t = toks[i].toLowerCase(); }
      if (t === 'no') { no = true; i++; if (i >= toks.length) break; t = toks[i].toLowerCase(); }
      if (DIR_WORDS[t] && !dir) { dir = DIR_WORDS[t]; i++; if (i >= toks.length) break; t = toks[i].toLowerCase(); }
      atoms.push({ no: no, dir: dir, name: t });
      i++;
    }
    return atoms;
  }

  function splitPattern(inside) {
    // Cells are separated by | . Empty cells are real cells.
    return inside.split('|').map(function (c) { return parseAtomList(c); });
  }

  function parseRuleLine(raw) {
    var line = stripComment(raw).trim();
    if (!line) return { kind: 'blank' };
    var late = false;
    var orients = null; // null = all four; otherwise lock
    var noRot = false;
    var join = false;
    var prefix = true;
    while (prefix) {
      prefix = false;
      if (/^late\b/i.test(line)) { late = true; line = line.replace(/^late\s+/i, ''); prefix = true; }
      if (/^\+\s*/.test(line)) { join = true; line = line.replace(/^\+\s*/, ''); prefix = true; }
      if (/^horizontal\b/i.test(line)) { orients = ['right', 'left']; line = line.replace(/^horizontal\s+/i, ''); prefix = true; }
      if (/^vertical\b/i.test(line)) { orients = ['up', 'down']; line = line.replace(/^vertical\s+/i, ''); prefix = true; }
      if (/^up\b/i.test(line) && line.indexOf('[') !== -1 && !/^up\s*\[/.test(line.toLowerCase()) === false) {
        // "up [ ... ]" locks orientation
      }
      var lock = line.match(/^(up|down|left|right)\s+\[/i);
      if (lock) {
        orients = [lock[1].toLowerCase()];
        line = line.replace(/^(up|down|left|right)\s+/i, '');
        prefix = true;
      }
    }
    if (/^startloop$/i.test(line) || /^endloop$/i.test(line)) {
      return { kind: 'loop', which: line.toLowerCase() };
    }
    var arrow = line.split(/->/);
    if (arrow.length < 2) return { kind: 'unknown', raw: raw };
    var lhsAll = arrow[0];
    var rhsAll = arrow.slice(1).join('->');
    // One pattern for the subset we implement (no disconnected [A] [B] pairs).
    var lMatch = lhsAll.match(/\[([^\]]*)\]/);
    var rMatch = rhsAll.match(/\[([^\]]*)\]/);
    if (!lMatch || !rMatch) return { kind: 'unknown', raw: raw };
    return {
      kind: 'rule',
      late: late,
      orients: orients,
      noRot: noRot,
      join: join,
      lhs: splitPattern(lMatch[1]),
      rhs: splitPattern(rMatch[1]),
      raw: stripComment(raw).trim()
    };
  }

  function parseWin(line) {
    var t = stripComment(line).trim();
    if (!t) return null;
    var m;
    m = t.match(/^all\s+(\S+)\s+on\s+(\S+)$/i);
    if (m) return { kind: 'all_on', a: m[1].toLowerCase(), b: m[2].toLowerCase() };
    m = t.match(/^some\s+(\S+)\s+on\s+(\S+)$/i);
    if (m) return { kind: 'some_on', a: m[1].toLowerCase(), b: m[2].toLowerCase() };
    m = t.match(/^no\s+(\S+)$/i);
    if (m) return { kind: 'no', a: m[1].toLowerCase() };
    m = t.match(/^some\s+(\S+)$/i);
    if (m) return { kind: 'some', a: m[1].toLowerCase() };
    m = t.match(/^all\s+(\S+)$/i);
    if (m) return { kind: 'all', a: m[1].toLowerCase() };
    return null;
  }

  function parseLegendLine(line) {
    var t = stripComment(line).trim();
    if (!t || t.indexOf('=') < 0) return null;
    var parts = t.split('=');
    var left = parts[0].trim();
    var right = parts.slice(1).join('=').trim();
    var key = left;
    var andParts = right.split(/\s+and\s+/i).map(function (s) { return s.trim(); });
    if (andParts.length > 1) {
      return { key: key, kind: 'and', members: andParts.map(function (s) { return s.toLowerCase(); }) };
    }
    var orParts = right.split(/\s+or\s+/i).map(function (s) { return s.trim(); });
    if (orParts.length > 1) {
      return { key: key, kind: 'or', members: orParts.map(function (s) { return s.toLowerCase(); }) };
    }
    return { key: key, kind: 'alias', members: [right.toLowerCase()] };
  }

  function parse(text) {
    var rawLines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var game = {
      title: 'untitled',
      author: '',
      prelude: {},
      objects: [],
      legend: [],
      layers: [],
      rules: [],
      win: [],
      levels: [],
      source: text
    };
    var section = 'prelude';
    var i = 0;
    var objBuf = [];

    function flushObject() {
      if (!objBuf.length) return;
      var header = tokenize(objBuf[0]);
      if (!header.length) { objBuf = []; return; }
      var name = header[0];
      var legend = header.length > 1 && header[1].length === 1 ? header[1] : null;
      var colors = [];
      var sprite = null;
      var j = 1;
      if (j < objBuf.length && !/^[.\d]+$/.test(objBuf[j].trim().split(/\s+/)[0] || '')) {
        colors = tokenize(objBuf[j]).map(parseColor);
        j++;
      }
      var rows = [];
      while (j < objBuf.length) {
        var row = objBuf[j].trim();
        if (/^[.\d]+$/.test(row) && row.length >= 1) rows.push(row);
        j++;
      }
      if (rows.length) {
        sprite = rows.map(function (r) {
          var cells = [];
          var k;
          for (k = 0; k < r.length; k++) {
            var ch = r.charAt(k);
            cells.push(ch === '.' ? -1 : parseInt(ch, 10));
          }
          return cells;
        });
      }
      if (!colors.length) colors = ['#888888'];
      game.objects.push({
        name: name.toLowerCase(),
        displayName: name,
        legend: legend,
        colors: colors,
        sprite: sprite
      });
      objBuf = [];
    }

    while (i < rawLines.length) {
      var line = rawLines[i];
      var trimmed = line.trim();
      if (isBanner(trimmed)) { i++; continue; }
      var sec = sectionName(trimmed);
      if (sec) {
        if (section === 'objects') flushObject();
        section = sec;
        i++;
        continue;
      }
      if (section === 'prelude') {
        if (!trimmed) { i++; continue; }
        var kv = stripComment(trimmed).trim();
        if (!kv) { i++; continue; }
        var sp = kv.indexOf(' ');
        if (sp < 0) {
          game.prelude[kv.toLowerCase()] = true;
        } else {
          var k = kv.slice(0, sp).toLowerCase();
          var v = kv.slice(sp + 1).trim();
          game.prelude[k] = v;
          if (k === 'title') game.title = v;
          if (k === 'author') game.author = v;
        }
        i++;
        continue;
      }
      if (section === 'objects') {
        if (!trimmed) { flushObject(); i++; continue; }
        objBuf.push(stripComment(line).trim() || trimmed);
        i++;
        continue;
      }
      if (section === 'legend') {
        var L = parseLegendLine(trimmed);
        if (L) game.legend.push(L);
        i++;
        continue;
      }
      if (section === 'sounds') { i++; continue; }
      if (section === 'collisionlayers') {
        if (trimmed) {
          var names = stripComment(trimmed).split(',').map(function (s) {
            return s.trim().toLowerCase();
          }).filter(Boolean);
          if (names.length) game.layers.push(names);
        }
        i++;
        continue;
      }
      if (section === 'rules') {
        var r = parseRuleLine(trimmed);
        if (r.kind === 'rule') game.rules.push(r);
        else if (r.kind === 'blank' && game.rules.length && !game.rules[game.rules.length - 1]._gap) {
          game.rules.push({ kind: 'gap', _gap: true });
        }
        i++;
        continue;
      }
      if (section === 'winconditions') {
        var w = parseWin(trimmed);
        if (w) game.win.push(w);
        i++;
        continue;
      }
      if (section === 'levels') {
        i++;
        continue;
      }
      i++;
    }
    if (section === 'objects') flushObject();

    // Levels: scan original lines after LEVELS header.
    var inLevels = false;
    var block = [];
    var pendingMessage = null;
    function flushLevel() {
      if (!block.length) return;
      var width = Math.max.apply(null, block.map(function (r) { return r.length; }));
      var grid = block.map(function (r) {
        return r.length < width ? r + Array(width - r.length + 1).join(' ') : r;
      });
      game.levels.push({ grid: grid, message: pendingMessage });
      pendingMessage = null;
      block = [];
    }
    for (i = 0; i < rawLines.length; i++) {
      trimmed = rawLines[i].trim();
      if (isBanner(trimmed)) continue;
      if (sectionName(trimmed) === 'levels') { inLevels = true; continue; }
      if (!inLevels) continue;
      if (sectionName(trimmed) && sectionName(trimmed) !== 'levels') { inLevels = false; continue; }
      if (/^message\b/i.test(trimmed)) {
        flushLevel();
        pendingMessage = trimmed.replace(/^message\s+/i, '');
        continue;
      }
      if (!trimmed) { flushLevel(); continue; }
      block.push(rawLines[i].replace(/\s+$/, ''));
    }
    flushLevel();

    game.rules = game.rules.filter(function (r) { return r.kind === 'rule'; });
    return game;
  }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  function emitSprite(obj) {
    var lines = [];
    lines.push(obj.displayName || obj.name);
    lines.push(obj.colors.join(' '));
    if (obj.sprite) {
      obj.sprite.forEach(function (row) {
        lines.push(row.map(function (v) { return v < 0 ? '.' : String(v); }).join(''));
      });
    }
    return lines.join('\n');
  }

  function emitAtoms(atoms) {
    if (!atoms || !atoms.length) return '';
    return atoms.map(function (a) {
      var s = '';
      if (a.no) s += 'no ';
      if (a.dir === 'fwd') s += '> ';
      else if (a.dir === 'back') s += '< ';
      else if (a.dir === 'relup') s += '^ ';
      else if (a.dir === 'reldown') s += 'v ';
      else if (a.dir) s += a.dir + ' ';
      s += a.name;
      return s;
    }).join(' ');
  }

  function emit(game) {
    var out = [];
    out.push('title ' + (game.title || 'untitled'));
    if (game.author) out.push('author ' + game.author);
    out.push('');
    out.push('========');
    out.push('OBJECTS');
    out.push('========');
    out.push('');
    (game.objects || []).forEach(function (o) {
      out.push(emitSprite(o));
      out.push('');
    });
    out.push('=======');
    out.push('LEGEND');
    out.push('=======');
    out.push('');
    (game.legend || []).forEach(function (L) {
      var right;
      if (L.kind === 'and') right = L.members.join(' and ');
      else if (L.kind === 'or') right = L.members.join(' or ');
      else right = L.members[0];
      out.push(L.key + ' = ' + right);
    });
    out.push('');
    out.push('================');
    out.push('COLLISIONLAYERS');
    out.push('================');
    out.push('');
    (game.layers || []).forEach(function (layer) {
      out.push(layer.join(', '));
    });
    out.push('');
    out.push('======');
    out.push('RULES');
    out.push('======');
    out.push('');
    (game.rules || []).forEach(function (r) {
      if (r.raw) { out.push(r.raw); return; }
      var pre = r.late ? 'late ' : '';
      var lhs = r.lhs.map(emitAtoms).join(' | ');
      var rhs = r.rhs.map(emitAtoms).join(' | ');
      out.push(pre + '[ ' + lhs + ' ] -> [ ' + rhs + ' ]');
    });
    out.push('');
    out.push('==============');
    out.push('WINCONDITIONS');
    out.push('==============');
    out.push('');
    (game.win || []).forEach(function (w) {
      if (w.kind === 'all_on') out.push('All ' + w.a + ' on ' + w.b);
      else if (w.kind === 'some_on') out.push('Some ' + w.a + ' on ' + w.b);
      else if (w.kind === 'no') out.push('No ' + w.a);
      else if (w.kind === 'some') out.push('Some ' + w.a);
      else if (w.kind === 'all') out.push('All ' + w.a);
    });
    out.push('');
    out.push('=======');
    out.push('LEVELS');
    out.push('=======');
    out.push('');
    (game.levels || []).forEach(function (lv) {
      if (lv.message) out.push('message ' + lv.message);
      (lv.grid || []).forEach(function (row) { out.push(row); });
      out.push('');
    });
    return out.join('\n');
  }

  return {
    COLORS: COLORS,
    parse: parse,
    emit: emit,
    parseColor: parseColor
  };
});
