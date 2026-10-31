'use strict';
// Playtests must be silent: with ?mute, or in an automated browser (navigator.webdriver), the audio
// module never creates an AudioContext, even after clicks, so nothing can make a sound.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'audio', 'audio.js'), 'utf8');

/** Boots js/audio/audio.js in a fake window whose AudioContext only counts constructions. */
function boot(search, webdriver) {
  let created = 0;
  const handlers = [];
  const win = {
    location: { search },
    navigator: { webdriver },
    AudioContext: function () { created++; throw new Error('stub AudioContext'); },
    addEventListener(ev, fn) { handlers.push([ev, fn]); },
    removeEventListener() {},
    console: { warn() {}, log() {}, error() {} },
  };
  win.window = win;
  vm.runInNewContext(SRC, win);
  win.SQ.audio.init();
  return {
    audio: win.SQ.audio,
    created: () => created,
    click: () => handlers.filter(([ev]) => ev === 'pointerdown').forEach(([, fn]) => fn({ type: 'pointerdown' })),
  };
}

test('an ordinary browser session starts audio on the first click', () => {
  const b = boot('?quick', false);
  assert.equal(b.audio.silent, false);
  b.click();
  assert.equal(b.created(), 1, 'tried to create an AudioContext');
});

test('?mute and automated browsers never create an AudioContext', () => {
  for (const [search, webdriver] of [['?mute', false], ['?mute=1', false], ['?quick&mute&crew=pack', false], ['', true], ['?quick', true]]) {
    const label = `search=${JSON.stringify(search)} webdriver=${webdriver}`;
    const b = boot(search, webdriver);
    assert.equal(b.audio.silent, true, label);
    b.click(); b.click();
    assert.equal(b.audio.unlock(), false, label);
    assert.equal(b.audio.play('ui_click'), false, label);
    assert.equal(b.created(), 0, label);
  }
});

test('look-alike flags do not silence the game', () => {
  for (const search of ['?mute=0', '?muted=1', '?nomute']) assert.equal(boot(search, false).audio.silent, false, search);
});
