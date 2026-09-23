// Dependency-free logic checks. Canvas is a drawing-call stub, not visual QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const timers = [], sounds = [], listeners = {}, buttons = {};
let frame;
const MIN_ARGS = { ellipse: 7, arc: 5, arcTo: 5, rect: 4, fillRect: 4, strokeRect: 4, clearRect: 4, roundRect: 4, moveTo: 2, lineTo: 2,
  quadraticCurveTo: 4, bezierCurveTo: 6, drawImage: 3, fillText: 3, strokeText: 3, translate: 2, scale: 2, rotate: 1, setTransform: 6, transform: 6 };
const drawing = new Proxy({
  filter: 'none',
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => ({}),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  measureText: text => ({ width: text.length * 9 }),
}, { get(target, key) {
  if (key in target) return target[key];
  // real canvases throw when required arguments are missing; so does this stub
  const need = MIN_ARGS[key];
  return (...args) => {
    if (need) assert.ok(args.length >= need, `${String(key)} needs ${need} arguments, got ${args.length}`);
    for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n), `non-finite ${String(key)} argument`);
  };
} });
const element = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, getContext: () => drawing });
const canvas = element(), loading = element();
for (const act of ['photo', 'jump', 'pause']) {
  buttons[act] = { ...element(), dataset: { act }, addEventListener(type, fn) { this[type] = fn; } };
}
const sandbox = {
  console, assert, Math, Float32Array, Uint8ClampedArray,
  document: { createElement: element, getElementById: id => id === 'screen' ? canvas : id === 'loading' ? loading : null,
    querySelectorAll: () => Object.values(buttons), body: element() },
  innerWidth: 1280, innerHeight: 720, navigator: { getGamepads: () => [] },
  performance: { now: () => 0 }, setTimeout: fn => timers.push(fn),
  requestAnimationFrame: fn => { frame = fn; },
  addEventListener: (key, fn) => { listeners[key] = fn; },
  Sound: new Proxy({ muted: false, quiet: e => sounds.push(e) }, { get: (s, k) => k in s ? s[k] : () => {} }),
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const run = text => vm.runInContext(text, sandbox);
for (const file of ['util', 'store', 'art', 'world', 'levels', 'actors', 'life', 'painter'])
  run(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'));

// Use real level geometry, but omit the expensive static paintings for logic tests.
run('World.prototype.buildLayers = function () { return LAYER_DEFS.map(d => ({ ...d, canvas: makeCanvas(1280, 1240), w: 1280, h: 1240 })); };');
run(fs.readFileSync(path.join(root, 'js/game.js'), 'utf8'));
const flush = () => { while (timers.length) timers.shift()(); };
const LEVELS_COUNT = () => vm.runInContext('LEVELS.length', sandbox);
flush();
const game = sandbox.__game;
function jump(ch, x) { game.jump(ch, x); flush(); }
function act() { game.pressed.photo = true; game.step(1); }
function wait(seconds) { game.step(Math.ceil(seconds * 120)); }
function key(code) { listeners.keydown({ code, preventDefault() {} }); game.step(1); listeners.keyup({ code }); }

// Every optional place has a stable standing surface, clear of lethal arcs,
// with an approach from the left and no changes to collision geometry.
for (let ch = 0; ch < LEVELS_COUNT(); ch++) {
  jump(ch);
  for (const p of game.life.places) {
    assert.ok(Number.isFinite(p.y));
    assert.ok(p.x < game.L.exit - 100);
    assert.equal(game.world.surfaceAt(p.x), p.y);
    for (const h of game.L.hazards || []) assert.ok(Math.abs(p.x - h.x) > 100);
    for (const dx of [-28, 0, 28]) {
      game.set(p.x + dx, p.y); game.step(8);
      assert.equal(game.life.near(game.player), p, `${ch}: ${p.kind} not reachable at ${dx}`);
    }
    game.set(p.x, p.y); act();
    assert.equal(p.count, 1);
    act(); assert.equal(p.count, 1, 'cooldown prevents input spam');
    game.set(p.x + 300, game.world.surfaceAt(p.x + 300));
    assert.equal(game.life.interact(game.player), false, 'cannot activate remotely');
    // Exercise every animated drawing branch over its whole lifetime.
    for (const age of [0, 0.3, 0.8, 1.3, 1.8, 3.7, 5, 8, 11, 20]) {
      p.age = age;
      game.life.draw(drawing, { x: p.x - 500, y: 0 });
      game.life.drawDistant(drawing, { x: p.x - 500, y: -200 });
      game.life.drawForeground(drawing, { x: p.x - 500, y: 0 });
    }
  }
}

// Tuning has three distinct channels. The third answers once, after a delay.
jump(0, 1370); sounds.length = 0;
game.player.onGround = false; assert.equal(game.life.interact(game.player), false, 'cannot interact in midair');
game.player.onGround = true;
act(); wait(2.1); act(); wait(2.1); act();
assert.deepEqual(sounds.filter(e => e.kind === 'radio').map(e => e.channel), [0, 1, 2]);
wait(4.6); assert.equal(sounds.filter(e => e.kind === 'answer').length, 0);
wait(0.3); assert.equal(sounds.filter(e => e.kind === 'answer').length, 1);
wait(5); assert.equal(sounds.filter(e => e.kind === 'answer').length, 1);

// Leaving earshot prevents a delayed reply sounding beside the listener.
jump(2, 3500); sounds.length = 0; act(); game.set(6000, game.world.surfaceAt(6000)); wait(4);
assert.equal(sounds.filter(e => e.kind === 'answer').length, 0);

// Retuning cancels a pending reply; changing chapter drops all old events.
jump(0, 1370); act(); wait(2.1); act(); wait(2.1); act(); wait(2.1); act();
sounds.length = 0; wait(6); assert.equal(sounds.filter(e => e.kind === 'answer').length, 0);
jump(2, 3500); act(); jump(0, 1370); sounds.length = 0; wait(6);
assert.equal(sounds.filter(e => e.kind === 'answer').length, 0);
assert.equal(game.life.places[0].count, 0);

// Waiting, whistling, and rushing past elicit different bird behavior.
jump(1, 2310); sounds.length = 0; wait(3.7);
assert.equal(game.life.places[0].settled, true);
assert.equal(game.life.places[0].count, 0, 'waiting needs no button');
assert.ok(sounds.some(e => e.kind === 'birds' && e.gentle));
jump(1, 2310); act(); assert.equal(game.life.places[0].settled, true);
jump(1, 2310); game.player.vx = 180; game.keys.right = true; game.step(1); game.keys.right = false;
assert.equal(game.life.places[0].startled, true);

// Skipping produces three timed impacts; the bell gives one quiet reply.
jump(2, 810); sounds.length = 0; act(); wait(2);
assert.equal(sounds.filter(e => e.kind === 'drop').length, 3);
jump(2, 3500); sounds.length = 0; act(); wait(3.4);
assert.equal(sounds.filter(e => e.kind === 'answer').length, 0);
wait(0.3); assert.equal(sounds.filter(e => e.kind === 'answer').length, 1);

// The switch is reversible, including across a death/respawn in this chapter.
jump(3, 1290); act(); assert.equal(game.life.places[0].on, true);
wait(2.1); act(); assert.equal(game.life.places[0].on, false);
wait(2.1); act(); game.set(1400, 900); wait(1.3);
assert.equal(game.life.places[0].on, true);

// Pause freezes encounter animations and pending replies; inputs do not leak.
jump(2, 3500); sounds.length = 0; act();
game.pressed.pause = true; game.step(1);
const age = game.life.places[1].age, count = game.life.places[1].count;
game.pressed.photo = true; wait(5);
assert.equal(game.life.places[1].age, age); assert.equal(game.life.places[1].count, count);
assert.equal(sounds.filter(e => e.kind === 'answer').length, 0);
game.pressed.pause = true; game.step(1); wait(3.7);
assert.equal(sounds.filter(e => e.kind === 'answer').length, 1);

// Keyboard aliases, touch, and gamepad use the same contextual action.
for (const code of ['KeyE', 'KeyX', 'ArrowDown']) {
  jump(0, 1370); key(code); assert.equal(game.life.places[0].count, 1);
}
jump(0, 1370); buttons.photo.pointerdown({ preventDefault() {} }); game.step(1);
buttons.photo.pointerup({ preventDefault() {} }); assert.equal(game.life.places[0].count, 1);
jump(0, 1370);
const pad = { axes: [0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
sandbox.navigator.getGamepads = () => [pad]; game.step(1);
pad.buttons[2].pressed = true; game.step(1); assert.equal(game.life.places[0].count, 1);
pad.buttons[2].pressed = false; game.step(1); sandbox.navigator.getGamepads = () => [];

// A photo still wins when a future encounter is placed at the same location.
jump(0, 1720);
const radio = game.life.places[0]; radio.x = 1720; radio.y = game.world.surfaceAt(1720);
act(); assert.equal(radio.count, 0);
assert.equal(game.album.length, 0);
frame(16); // captures the pending photo after world rendering
assert.equal(game.album.length, 1);
assert.ok(game.album[0].caption.includes('Volvo'));

// No interaction is required to leave any of the four preceding chapters.
for (let ch = 0; ch < 4; ch++) {
  jump(ch); game.set(game.L.exit, game.world.surfaceAt(game.L.exit)); game.step(1);
  assert.equal(game.state, 'exit');
  assert.ok(game.life.places.every(p => p.count === 0));
}
// The finale can still start with every new interaction skipped.
jump(4); game.set(game.L.exit, game.world.surfaceAt(game.L.exit)); game.step(1);
assert.equal(game.state, 'ending');

// Validate the new synthesis paths with an AudioContext stub, including mute.
const audioCalls = [];
const param = () => ({ value: 0, ...Object.fromEntries(['setValueAtTime', 'setTargetAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime'].map(k => [k, (...args) => {
  assert.ok(args.every(Number.isFinite), `invalid audio ${k}`); audioCalls.push([k, ...args]);
}])) });
const audioNode = () => ({ connect() {}, start() {}, stop() {},
  gain: param(), frequency: param(), detune: param(), Q: param(), threshold: param(), ratio: param(), playbackRate: param() });
class AudioContext {
  constructor() { this.sampleRate = 1000; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createBuffer(ch, len) { return { length: len, getChannelData: () => new Float32Array(len) }; }
}
for (const name of ['Gain', 'DynamicsCompressor', 'Convolver', 'BufferSource', 'BiquadFilter', 'Oscillator'])
  AudioContext.prototype['create' + name] = audioNode;
const audioVM = vm.createContext({ window: { AudioContext }, Math });
vm.runInContext(fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8'), audioVM);
vm.runInContext(`Sound.init();
  for (const channel of [0, 1, 2]) Sound.quiet({ kind: 'radio', channel });
  for (const kind of ['birds', 'flutter', 'water', 'drop', 'bell', 'answer', 'signal', 'stones']) Sound.quiet({ kind, on: true });
  Sound.quiet({ kind: 'answer', bell: true }); Sound.toggleMute();`, audioVM);
assert.ok(audioCalls.length > 100);
assert.equal(vm.runInContext('Sound.muted', audioVM), true);
console.log('Quiet-life checks passed: all six chapters, optional progression, timing, reset, pause, input, and photo priority.');
