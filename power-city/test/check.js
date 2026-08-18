/* POWER CITY - data regression harness.
 *
 * The game needs a canvas to draw, but almost everything that can be *wrong*
 * with it is in the tables: a stage that names an enemy nobody defined, a
 * move with no active frames, a song with a note that is not a note. Those
 * are checkable in plain node with no browser at all, which means they get
 * checked every time instead of never.
 *
 *   node power-city/test/check.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var JS = path.join(__dirname, '..', 'js');
var sandbox = { console: console, Math: Math, Date: Date, JSON: JSON, setInterval: function () { } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
// Nothing here draws; a stub is enough to let the modules load.
sandbox.document = {
  createElement: function () {
    return { width: 0, height: 0, getContext: function () { return new Proxy({}, { get: function () { return function () { }; } }); } };
  },
  getElementById: function () { return null; },
  addEventListener: function () { },
  readyState: 'complete'
};
sandbox.addEventListener = function () { };
sandbox.requestAnimationFrame = function () { return 0; };
sandbox.cancelAnimationFrame = function () { };
sandbox.localStorage = { getItem: function () { return null; }, setItem: function () { } };
sandbox.navigator = { getGamepads: function () { return []; } };
vm.createContext(sandbox);

function load(name) {
  vm.runInContext(fs.readFileSync(path.join(JS, name + '.js'), 'utf8'), sandbox, { filename: name + '.js' });
}

['core', 'art', 'rig', 'cast', 'city', 'audio', 'music'].forEach(load);
var PC = sandbox.PC;
// stages/player/enemies read these at load time; they are only used at runtime.
PC.world = { tokens: 0, tokenHolders: [], add: function () { }, addItem: function () { } };
PC.fx = { reset: function () { } };
PC.items = { spawn: function () { }, take: function () { } };
PC.Actor = function () { };
PC.Actor.prototype = {};
['player', 'enemies', 'stages'].forEach(load);

var fails = 0, checks = 0;
function ok(cond, label) {
  checks++;
  if (cond) return;
  fails++;
  console.log('  FAIL  ' + label);
}
function section(name) { console.log('\n' + name); }

// ------------------------------------------------------------------- font
section('font');
ok(PC.art.textWidth('AB', 1, 1) === 11, 'two characters measure 11px at 1x');
ok(PC.art.textWidth('A', 3, 1) === 15, 'one character measures 15px at 3x');
ok(PC.art.textWidth('', 1, 1) === 0, 'the empty string measures nothing');
// The glyph table is closed over inside art.js, so read it from the source:
// every letter has to be exactly seven rows of five bits or the baseline
// wanders and nobody notices until the HUD looks crooked.
var artSrc = fs.readFileSync(path.join(JS, 'art.js'), 'utf8');
var table = artSrc.slice(artSrc.indexOf('var GLYPHS = {'), artSrc.indexOf('Art.FONT_W'));
var re = /'((?:\\'|[^'])+)':\s*'([01,]+)'/g, m, glyphs = 0, seen = {};
while ((m = re.exec(table))) {
  glyphs++;
  seen[m[1]] = true;
  var rows = m[2].split(',');
  ok(rows.length === 7, 'glyph ' + m[1] + ' has 7 rows');
  ok(rows.every(function (r) { return r.length === 5; }), 'glyph ' + m[1] + ' is 5 wide throughout');
}
ok(glyphs >= 60, 'the font has at least 60 glyphs (' + glyphs + ')');
'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').forEach(function (c) {
  ok(seen[c], 'the font has ' + c);
});

// -------------------------------------------------------------------- rig
section('rig poses');
var JOINTS = ['hip', 'chest', 'head'];
var LIMBS = ['aF', 'aB', 'lF', 'lB'];
var poseNames = Object.keys(PC.rig.POSES);
ok(poseNames.length >= 30, 'the rig knows at least 30 poses (' + poseNames.length + ')');
poseNames.forEach(function (n) {
  var p = PC.rig.POSES[n];
  JOINTS.forEach(function (j) {
    ok(p[j] && p[j].length === 2 && isFinite(p[j][0]) && isFinite(p[j][1]), n + '.' + j + ' is a point');
  });
  LIMBS.forEach(function (l) {
    ok(p[l] && p[l].length === 2 && p[l][0].length === 2 && p[l][1].length === 2, n + '.' + l + ' is two points');
  });
  ok(p.head[1] > p.chest[1] - 2, n + ': the head is not below the chest');
  ok(p.hip[1] >= 0 && p.hip[1] <= 26, n + ': the hip is inside the body');
  var all = [p.hip, p.chest, p.head, p.aF[0], p.aF[1], p.aB[0], p.aB[1], p.lF[0], p.lF[1], p.lB[0], p.lB[1]];
  all.forEach(function (pt, i) {
    ok(Math.abs(pt[0]) <= 26 && pt[1] >= -2 && pt[1] <= 46, n + ': point ' + i + ' is on the canvas');
  });
});

// ------------------------------------------------------------------- cast
section('cast');
var PAL_KEYS = ['skin', 'skinD', 'hair', 'shirt', 'shirtD', 'pants', 'pantsD', 'trim', 'shoe', 'shoeD', 'out'];
Object.keys(PC.rig.CHARS).forEach(function (k) {
  var c = PC.rig.CHARS[k];
  PAL_KEYS.forEach(function (pk) {
    ok(typeof c.pal[pk] === 'string' && /^#[0-9a-f]{6}$/i.test(c.pal[pk]), k + ' palette has a valid ' + pk);
  });
  ok(c.scale > 0.5 && c.scale < 2, k + ' is a plausible size');
});
Object.keys(PC.weapons).forEach(function (k) {
  var w = PC.weapons[k];
  ok(typeof w.make === 'function', k + ' knows how to draw itself');
  ok(w.dmg > 0 && w.ammo > 0 && w.reach > 0, k + ' has damage, reach and durability');
});
Object.keys(PC.props).forEach(function (k) {
  ok(PC.props[k].hp > 0 && PC.props[k].dmg > 0, k + ' can be broken and can hurt');
});

// ------------------------------------------------------------------ moves
section('moves');
function checkMove(name, m, table) {
  ok(m.startup >= 0 && m.active > 0 && m.recovery >= 0, table + '.' + name + ' has real frame data');
  ok(m.reach && m.reach.length === 2 && m.reach[1] > m.reach[0], table + '.' + name + ' reaches forward');
  ok(m.dmg > 0, table + '.' + name + ' does damage');
  ok(m.pose || m.poses, table + '.' + name + ' has a pose');
  var poses = m.poses || [m.pose];
  poses.concat(m.wind ? [m.wind] : []).forEach(function (p) {
    ok(!!PC.rig.POSES[p], table + '.' + name + ' uses a pose the rig has (' + p + ')');
  });
  if (m.chain) ok(!!PC.MOVES[m.chain], table + '.' + name + ' chains into a move that exists');
}
Object.keys(PC.MOVES).forEach(function (n) { checkMove(n, PC.MOVES[n], 'MOVES'); });
Object.keys(PC.ENEMY_MOVES).forEach(function (n) { checkMove(n, PC.ENEMY_MOVES[n], 'ENEMY_MOVES'); });
ok(PC.MOVES.jab.chain === 'cross' && PC.MOVES.cross.chain === 'hook', 'the punch combo runs jab-cross-hook');
ok(PC.MOVES.hook.knock === true, 'the combo finisher knocks down');

// ---------------------------------------------------------------- enemies
section('enemy types');
function checkType(k, t, label) {
  ok(!!PC.rig.CHARS[t.char], label + ' ' + k + ' uses a character that exists');
  ok(t.hp > 0 && t.speed > 0 && t.score > 0, label + ' ' + k + ' has hp, speed and a bounty');
  ok(t.moves && t.moves.length > 0, label + ' ' + k + ' has moves');
  t.moves.forEach(function (m) { ok(!!PC.ENEMY_MOVES[m], label + ' ' + k + ' move ' + m + ' exists'); });
  if (t.weapon) ok(!!PC.weapons[t.weapon], label + ' ' + k + ' carries a real weapon');
}
Object.keys(PC.ENEMY_TYPES).forEach(function (k) { checkType(k, PC.ENEMY_TYPES[k], 'gang'); });
Object.keys(PC.BOSS_TYPES).forEach(function (k) { checkType(k, PC.BOSS_TYPES[k], 'boss'); });
ok(Object.keys(PC.BOSS_TYPES).length === 4, 'there are four bosses');

// ----------------------------------------------------------------- stages
section('stages');
ok(PC.STAGES.length === 4, 'there are four stages');
PC.STAGES.forEach(function (s, si) {
  var label = 'stage ' + (si + 1);
  ok(!!PC.city.THEMES[s.theme], label + ' has a theme that exists');
  ok(!!PC.songs[s.music], label + ' has a song that exists');
  ok(s.length > PC.W * 3, label + ' is longer than three screens');
  ok(s.time > 0 && s.time < 100, label + ' has a two-digit clock');
  ok(typeof s.intro === 'string' && s.intro.length > 0, label + ' has an intro line');
  var last = -1, sawBoss = false;
  s.encounters.forEach(function (e, ei) {
    var el = label + ' encounter ' + (ei + 1);
    ok(e.x > last, el + ' is further along than the one before');
    ok(e.x < s.length, el + ' happens before the stage ends');
    last = e.x;
    e.groups.forEach(function (g) {
      ok(!!PC.ENEMY_TYPES[g[0]], el + ' spawns a known enemy (' + g[0] + ')');
      ok(g[1] > 0 && g[1] <= 4, el + ' spawns a sane number of them');
      ok(g[2] === 1 || g[2] === -1, el + ' spawns them from a real side');
    });
    if (e.boss) {
      sawBoss = true;
      ok(!!PC.BOSS_TYPES[e.boss], el + ' names a boss that exists');
      ok(ei === s.encounters.length - 1, el + ' is the last fight of the stage');
    }
    (e.items || []).forEach(function (it) {
      var bank = it[0] === 'weapon' ? PC.weapons : it[0] === 'prop' ? PC.props : PC.pickups;
      ok(!!bank[it[1]], el + ' drops something real (' + it[0] + '/' + it[1] + ')');
    });
  });
  ok(sawBoss, label + ' ends with a boss');
});

// --------------------------------------------------------------- city art
section('city');
Object.keys(PC.city.THEMES).forEach(function (k) {
  var t = PC.city.THEMES[k];
  ok(t.modules.length >= 4, k + ' has enough facade variety');
  t.modules.forEach(function (m) { ok(!!PC.city.MOD[m], k + ' module ' + m + ' exists'); });
  (t.landmarks || []).forEach(function (l) { ok(!!PC.city.MOD[l[1]], k + ' landmark ' + l[1] + ' exists'); });
  ok(t.sky.length === 2, k + ' has a sky gradient');
});

// ------------------------------------------------------------------ music
section('music');
Object.keys(PC.songs).forEach(function (name) {
  var s = PC.songs[name];
  ok(s.bpm > 40 && s.bpm < 260, name + ' has a plausible tempo');
  ok(s.len > 0, name + ' has a length');
  ['p1', 'p2', 'bass'].forEach(function (ch) {
    if (!s[ch]) return;
    s[ch].forEach(function (n, i) {
      if (n === '.' || n === '-') return;
      ok(PC.noteFreq(n) > 20 && PC.noteFreq(n) < 5000, name + '.' + ch + '[' + i + '] is a note (' + n + ')');
    });
  });
  if (s.drum) s.drum.forEach(function (d, i) {
    ok('.ksh H'.indexOf(d) >= 0, name + '.drum[' + i + '] is a drum (' + d + ')');
  });
});

// ------------------------------------------------------------------ layout
section('layout');
ok(PC.FLOOR_TOP > PC.FIELD_Y && PC.FLOOR_BOT < PC.FIELD_BOT, 'the walkable floor is inside the field');
ok(PC.FLOOR_BOT - PC.FLOOR_TOP >= 40, 'there is room to move in depth');
ok(PC.H - PC.FIELD_BOT >= 24, 'the bottom bar fits the health bars');

console.log('\n' + (fails ? fails + ' FAILED of ' : 'all ') + checks + ' checks' + (fails ? '' : ' passed'));
process.exit(fails ? 1 : 0);
