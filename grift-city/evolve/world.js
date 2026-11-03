// A headless Grift City: the real simulation modules in a fresh vm context, no rendering, no audio, no DOM.
// One world per episode (about a second to build, and nothing leaks between episodes). The gameplay half of the
// game's per-frame step() is replayed here in the same order; test/evolve.js checks that it has not drifted from game.js.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SIM_MODULES = ['math', 'assets', 'meshes', 'streets', 'city', 'world', 'tactics', 'peds', 'vehicles', 'player', 'police', 'missions', 'grift', 'style', 'economy', 'ambient', 'streetlife'];
const DT = 1 / 30;           // sim step (the game itself steps at 1/30 on a slow device; its code is written for it)
const THINK_EVERY = 3;       // a controller decides every 3rd step: 10 times a second

// every sim call game.js's step() makes that this file replays, as `Module.method`; the rest are rendering and audio
const STEP_CALLS = ['W.frameBegin', 'W.updateClock', 'W.updateWeather', 'MISSIONS.update', 'GRIFT.update', 'STYLE.update', 'ECON.update', 'PLAYER.update',
  'PLAYER.updateProjectiles', 'VEH.updateAll', 'PEDS.updateAll', 'POLICE.update', 'PICKUPS.update', 'W.updateLights', 'W.updateKnocked', 'W.updateExplosions',
  'W.updateParticles', 'AMBIENT.update', 'STREETLIFE.update', 'PEDS.updateMotion', 'PLAYER.updateCamera', 'W.isNight', 'W.bustle', 'VEH.spawnTraffic', 'PEDS.populate', 'PEDS.trim', 'VEH.trim', 'VEH.despawn', 'PEDS.despawn', 'VEH.streamKerb'];

let compiled = null;
function scripts() {
  if (!compiled) compiled = {
    modules: SIM_MODULES.map(n => new vm.Script(fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8'), { filename: n + '.js' })),
    bridge: new vm.Script(fs.readFileSync(path.join(__dirname, 'bridge.js'), 'utf8'), { filename: 'bridge.js' }),
  };
  return compiled;
}

// density scales the traffic and pedestrian populations the game's step() asks for (1 = the shipped game). Vehicles and
// pedestrians are most of the cost of a step, so evolution runs at a reduced density and reports re-check at 1.
function createWorld(seed, opts = {}) {
  const density = opts.density === undefined ? 1 : opts.density;
  const noop = () => { };
  const log = [];
  const input = { touch: true, locked: true, held: Object.create(null), edge: Object.create(null),
    pad: { active: true, buttons: [], pressed: [], lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 }, mouse: { buttons: 0, dx: 0, dy: 0, clicked: false, wheel: 0 },
    down(k) { return !!this.held[k]; }, hit(k) { return !!this.edge[k]; }, tapKey(k) { this.edge[k] = true; }, init: noop, requestLock: noop, releaseLock: noop, releaseAll: noop, consumeEdges: noop,
    endFrame() { this.edge = Object.create(null); this.mouse.dx = this.mouse.dy = 0; this.mouse.clicked = false; this.mouse.wheel = 0; this.pad.pressed.length = 0; } };
  const quiet = new Proxy({}, { get: () => noop });
  const hud = new Proxy({ notify: t => log.push(['notify', String(t)]), big: t => log.push(['big', String(t)]) }, { get: (o, k) => (k in o ? o[k] : noop) });
  const cam = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, fov: 1 };
  const ctx = vm.createContext({
    console: { log: noop, warn: noop, error: noop }, URLSearchParams, location: { search: '?seed=' + (seed >>> 0) }, setTimeout: noop, performance: { now: () => 0 },
    TEX: { shopKinds: [], names: new Proxy({}, { get: () => 0 }) },
    RENDER: { MAX_BONES: 14, env: { wet: 0, nightEmis: 0 }, cam, setCamera(x, y, z, tx, ty, tz, fov) { Object.assign(cam, { x, y, z, tx, ty, tz, fov }); }, setTimeOfDay: noop, inView: () => true, inLight: () => true, project: () => null },
    AUDIO: quiet, HUD: hud, INPUT: input,
    // the defaults the shipped game starts with (settings.js)
    GAME: { save: noop, onPackage: noop, options: { sensitivity: 1, aimSensitivity: 0.75, steeringAssist: 0.35, gripAssist: 0.6, controllerAssist: true, mouseAssist: false, invertY: false, cameraShake: 0, speedFov: 0, hudScale: 1 } },
  });
  const S = scripts();
  for (const sc of S.modules) sc.runInContext(ctx);
  // Math.random only reaches cosmetics, but keep it deterministic anyway
  vm.runInContext('(() => { let s = ' + ((seed >>> 0) ^ 0x9e3779b9) + ' >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();', ctx);
  // what game.js build() does after the city exists
  vm.runInContext('MESH.Builder.prototype.build = MESH.Builder.prototype.buildInstanced = function () { return {}; }; CITY.generate(); W.initProps(); PICKUPS.placeWorld(); MISSIONS.placeRampages(); VEH.spawnParked(); VEH.spawnMarina(); AMBIENT.launchFerry(); { const sh = CITY.place("safehouse"); PLAYER.init(sh.x + 6, sh.z + 1, Math.PI); }', ctx);
  S.bridge.runInContext(ctx);
  const B = ctx.__bridge;
  // route what the player is told into the diagnostics
  const flush = () => { for (const [k, t] of log) B.note(k === 'big' ? '[' + t + ']' : t); log.length = 0; };
  const run = src => vm.runInContext(src, ctx);

  // one fixed step of the gameplay half of game.js step()
  const stepSrc = new vm.Script(`(() => {
    const dt = ${DT};
    W.frameBegin(); W.updateClock(dt); W.updateWeather(dt); RENDER.env.wet = W.weather.rain || 0; const night = W.isNight();
    const dlg = !!MISSIONS.dialogue;
    MISSIONS.update(dt); GRIFT.update(dt); STYLE.update(dt); ECON.update(dt);
    if (!dlg) PLAYER.update(dt); else { PLAYER.P.aim = 0; PLAYER.P.vx = PLAYER.P.vz = PLAYER.P.speed = 0; PLAYER.P.turnStep = PLAYER.P.accelLean = 0; PEDS.updateMotion(PLAYER.P, dt); if (PLAYER.car) { PLAYER.car.controls.throttle = 0; PLAYER.car.controls.brake = 1; } PLAYER.updateCamera(dt); }
    PLAYER.updateProjectiles(dt);
    VEH.updateAll(dt, night); PEDS.updateAll(dt); POLICE.update(dt); PICKUPS.update(dt);
    W.updateLights(dt); W.updateKnocked(dt); W.updateExplosions(dt); W.updateParticles(dt); AMBIENT.update(dt, PLAYER.x, PLAYER.z); STREETLIFE.update(dt);
    const px = PLAYER.x, pz = PLAYER.z, yaw = W.state.camYaw, busy = W.bustle(W.state.time), nT = Math.round((18 + 34 * busy) * ${density}), nP = Math.round((18 + 62 * busy) * ${density});
    if (W.state.frame % 4 === 0) VEH.spawnTraffic(px, pz, yaw, nT);
    if (W.state.frame % 3 === 0) PEDS.populate(px, pz, yaw, nP);
    if (W.state.frame % 20 === 10) { PEDS.trim(px, pz, yaw, nP); VEH.trim(px, pz, yaw, nT); }
    if (W.state.frame % 30 === 0) { VEH.despawn(px, pz); PEDS.despawn(px, pz); } if (W.state.frame % 30 === 15) VEH.streamKerb(PLAYER.x, PLAYER.z);
  })()`, { filename: 'step.js' });
  const world = {
    ctx, run, bridge: B, seed, density, dt: DT, steps: 0,
    setup(start) { B.setup(start, density); },
    // advance one decision tick (THINK_EVERY steps) with the given action already applied through bridge.act
    tick(firing) { for (let i = 0; i < THINK_EVERY; i++) { B.applyInput(i === 0, DT); stepSrc.runInContext(ctx); input.endFrame(); B.track(DT, firing); world.steps++; } flush(); },
    obs() { return B.obs(); },
    act(a) { B.act(a); },
    alive() { return B.alive(); },
    summary() { return B.summary(); },
  };
  return world;
}

module.exports = { createWorld, DT, THINK_EVERY, STEP_CALLS, SIM_MODULES };
