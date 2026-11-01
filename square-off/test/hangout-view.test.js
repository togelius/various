'use strict';
// The "Hang Out" 3D view (js/render/hangout-view.js) without WebGL: a canvas stub stands in for the DOM, THREE runs
// headless. Drives whole AI matches through attach/update/detach and checks that every state the rules can produce
// (walking, settling, hanging out, arguing, coffee, coming back) is drawn without throwing, and the UI-facing API.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
globalThis.window = globalThis;
globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
// --- a tiny 2D canvas stub (text is measured at 0.55 em per character)
function ctx2d() {
  const noop = () => {};
  const c = { font: '12px x', measureText: (t) => ({ width: String(t).length * (parseFloat(/(\d+(\.\d+)?)px/.exec(c.font || '12px')[1]) * 0.55) }),
    createRadialGradient: () => ({ addColorStop: noop }), createLinearGradient: () => ({ addColorStop: noop }) };
  return new Proxy(c, { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, v) => { o[k] = v; return true; } });
}
globalThis.document = globalThis.document || {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d(), style: {} }),
  addEventListener: () => {},
};
const T = require(path.join(root, 'js/vendor/three.min.js'));
globalThis.THREE = globalThis.THREE || T;
require(path.join(root, 'js/geo.js'));
for (const f of ['core/ns', 'core/contracts', 'data/units', 'data/factions', 'data/text', 'data/navOverrides', 'data/hangout',
  'sim/nav', 'sim/hangout', 'sim/hangout-ai', 'render/units', 'render/hangout-view']) require(path.join(root, 'js', f + '.js'));
const SQ = globalThis.SQ, HV = SQ.hangoutView;

function rig(cfg) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1280 / 800, 0.5, 2600);
  camera.position.set(0, 125, 90); camera.lookAt(0, 0, -5); camera.updateMatrixWorld();
  const m = SQ.Hangout.create(Object.assign({ seed: 5, quiet: true }, cfg));
  assert.equal(HV.attach({ scene, camera, match: m }), true);
  return { scene, camera, m };
}

test('a whole Hard-v-Hard match draws every state without throwing, then detaches cleanly', () => {
  const { scene, camera, m } = rig({ players: [{ crew: 'hustle', ai: { difficulty: 'hard' } }, { crew: 'pack', ai: { difficulty: 'hard' } }] });
  m.state.player = 0;
  const seen = new Set(), coffeeSeen = { ghost: 0, tag: 0 };
  let maxPeople = 0, maxProps = 0, maxDogs = 0, maxBars = 0;
  for (let i = 0; i < 20 * 300 && !m.state.over; i++) {
    m.tick();
    if (i % 2) continue; // 10 render frames per sim second
    HV.update(m.state, 1, 0.1, camera);
    for (const g of m.state.groups) seen.add(g.status);
    const s = HV.stats();
    maxPeople = Math.max(maxPeople, s.people); maxProps = Math.max(maxProps, s.props); maxDogs = Math.max(maxDogs, s.dogs); maxBars = Math.max(maxBars, s.bars);
    for (const G of HV._V.groups) { if (G.ghost && !G.ghost.done) coffeeSeen.ghost++; if (G.coffeeTag && G.coffeeTag.spr.visible) coffeeSeen.tag++; }
  }
  for (const k of ['walking', 'settling', 'hanging', 'arguing', 'coffee']) assert.ok(seen.has(k), 'saw ' + k);
  assert.equal(maxPeople, 4 + 5 + 6 + 4 + 5 + 6, 'every member of all six groups is drawn');
  assert.ok(maxProps > 0, 'camps go up while settling / hanging out');
  assert.ok(maxDogs > 0, 'the Pack lets dogs off the leash');
  assert.ok(maxBars > 0, 'patience bars show while arguing');
  assert.ok(coffeeSeen.ghost > 0 && coffeeSeen.tag > 0, 'coffee: walk-off ghost, then "back in" at the entrance');
  assert.ok(scene.getObjectByName('hangoutView'));
  HV.detach();
  assert.equal(HV.attached, false);
  assert.equal(scene.getObjectByName('hangoutView'), undefined, 'detach removes everything it added');
});

test('API: select, highlight, screenPos, pick and statusText use plain words', () => {
  const { camera, m } = rig({ scenario: 'argue', crew: 'violets', rival: 'noise' });
  const st = m.state;
  HV.select(st.sides[0].groups[0]);
  assert.equal(HV.selected, st.sides[0].groups[0]);
  HV.highlight(['fountain', { group: st.sides[1].groups[0] }]);
  m.order(0, st.sides[0].groups[0], 'fountain');
  m.order(0, st.sides[0].groups[1], 'fountain');
  const words = new Set();
  for (let i = 0; i < 20 * 20; i++) {
    m.tick();
    HV.update(st, 1, 0.05, camera);
    for (const g of st.groups) words.add(HV.statusText(g, st));
  }
  for (const w of ['walking to Fountain', 'arguing!', 'hanging out']) assert.ok(words.has(w), 'tag says "' + w + '"');
  for (const w of words) assert.ok(!/clout|turf|sway|composure|over it/i.test(w), 'no classic jargon: ' + w);
  const p = HV.screenPos('fountain');
  assert.ok(isFinite(p.x) && isFinite(p.y) && isFinite(p.tagX) && isFinite(p.tagY), 'spot screen position + its sign');
  const gp = HV.screenPos({ group: st.sides[0].groups[0] });
  assert.ok(isFinite(gp.x) && isFinite(gp.tagY) && gp.tagY < gp.y, 'the name tag is above the group');
  const hit = HV.pick(gp.x, gp.y, { touch: true });
  assert.ok(hit && hit.type === 'group', 'tapping the people picks the group');
  const pts = []; HV.focus(pts, 3);
  assert.ok(pts.every((q) => isFinite(q.x) && isFinite(q.z) && q.r > 0), 'canopy fade points are finite');
  const td = HV.timeOfDay({ t: 150, length: 300 });
  assert.ok(td.tod > 0 && td.tod < 0.4, 'the light moves toward golden hour but stays bright');
  HV.detach();
});
