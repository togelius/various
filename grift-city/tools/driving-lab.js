#!/usr/bin/env node
// Driving lab: scripted manoeuvres on open, flat ground, one line of numbers per car class. Run it before and after a
// handling change and compare; pass a git revision to measure that revision's vehicles.js instead of the working tree.
//   node tools/driving-lab.js            this tree, dry and wet
//   node tools/driving-lab.js 149ca44    another revision (needs git)
//   node tools/driving-lab.js --json     machine-readable
// Columns
//   turnIn   s    full lock at 20 m/s: time until the yaw rate reaches 63% of where it settles (lower is sharper)
//   latG     g    steady cornering at full lock, 22 m/s (grip)
//   settle   s    one second at full lock then let go: time until the car stops sliding and turning
//   overshoot deg 90° corner at 14 m/s, let go at 90°: how far past the corner the nose carries on
//   slalom   deg  three lane changes at 22 m/s: peak sideslip (the tail stepping out)
//   stop     m    full brakes from 25 m/s
//   hbrake   deg  handbrake + full lock for 0.7 s at 18 m/s: rotation (how well a handbrake turn swings the car)
//   drift    s    0.45 s handbrake flick at 20 m/s, then a driver who counter-steers and feathers the throttle to hold 20–40°
//                 of slip: how long the drift is held (up to 4 s) before it spins or straightens
//   spin     1/0  whether that drift ended in a spin (slip past 80°)
//   wall     %    20 m/s glancing a wall at 12°: speed kept one second later (coasting alone keeps about 85%)
//   wall60   %    the same at 60°: a square hit should stop the car
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), cp = require('node:child_process'), noop = () => {};
const root = path.join(__dirname, '..');
const args = process.argv.slice(2), json = args.includes('--json'), rev = args.find(a => !a.startsWith('--'));
const source = n => rev ? cp.execSync(`git show ${rev}:grift-city/js/${n}.js`, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }) : fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8');

function lab(wet) {
  const ctx = vm.createContext({ console, URLSearchParams, location: { search: '?seed=42' }, TEX: { names: {} }, RENDER: { MAX_BONES: 14, cam: {}, env: { wet } },
    GAME: { options: {} }, AUDIO: { play: noop }, HUD: { notify: noop }, POLICE: { crime: noop }, MISSIONS: { rampageKill: noop }, PLAYER: { shake: noop, alive: false, exitCar: () => false } });
  for (const n of ['math', 'meshes', 'city', 'world', 'vehicles']) vm.runInContext(source(n), ctx, { filename: n + '.js' });
  return vm.runInContext(`(() => {
    MESH.Builder.prototype.build = () => ({}); CITY.groundY = () => 0; const open = (x, z) => ({ x, z }); W.pushOut = open; W.FX = new Proxy({}, { get: () => () => {} }); W.decal = () => {}; W.noise = () => {};
    const dt = 1 / 60, deg = 180 / Math.PI;
    const car = (type, v, angle = 0) => { W.cars.length = 0; const c = VEH.spawn(type, 300, 300, angle); c.driver = PLAYER; c.ai.mode = 'player'; c.vx = Math.sin(angle) * v; c.vz = Math.cos(angle) * v; return c; };
    const ctl = (c, o) => Object.assign(c.controls, { throttle: 0, brake: 0, steer: 0, handbrake: 0, reverse: false }, o);
    const slip = c => Math.atan2(Math.abs(c.lat), Math.max(1, Math.abs(c.speed))) * deg;
    const hold = (c, speed) => { const e = speed - c.speed; return e > 0 ? { throttle: Math.min(1, e * .5) } : { brake: Math.min(1, -e * .3) }; };
    const out = {};
    for (const type of ['sedan', 'sports', 'muscle', 'police', 'pickup', 'van', 'bike']) {
      const r = {};
      { const c = car(type, 20); const yaw = []; for (let i = 0; i < 150; i++) { ctl(c, { ...hold(c, 20), steer: 1 }); c.physics(dt); yaw.push(Math.abs(c.yawRate)); }
        const ss = yaw.slice(-30).reduce((a, b) => a + b) / 30; r.turnIn = yaw.findIndex(y => y >= ss * .63) * dt; }
      { const c = car(type, 22); let a = 0; for (let i = 0; i < 240; i++) { ctl(c, { ...hold(c, 22), steer: 1 }); c.physics(dt); if (i >= 180) a += Math.abs(c.yawRate * c.speed) / 60; } r.latG = a / 9.81; }
      { const c = car(type, 20); for (let i = 0; i < 60; i++) { ctl(c, { ...hold(c, 20), steer: 1 }); c.physics(dt); } let t = 0; for (let i = 0; i < 360; i++) { ctl(c, hold(c, 20)); c.physics(dt); if (Math.abs(c.lat) > .4 || Math.abs(c.yawRate) > .1) t = (i + 1) * dt; } r.settle = t; }
      { const c = car(type, 14); let i = 0; while (c.angle < Math.PI / 2 && i++ < 600) { ctl(c, { ...hold(c, 14), steer: 1 }); c.physics(dt); } let peak = 0; for (let k = 0; k < 180; k++) { ctl(c, hold(c, 14)); c.physics(dt); peak = Math.max(peak, c.angle - Math.PI / 2); } r.overshoot = peak * deg; }
      { const c = car(type, 22); let pk = 0; for (const s of [1, -1, 1, -1, 1, -1]) for (let i = 0; i < 27; i++) { ctl(c, { ...hold(c, 22), steer: s }); c.physics(dt); pk = Math.max(pk, slip(c)); } r.slalom = pk; }
      { const c = car(type, 25); let i = 0; while ((i === 0 || c.absSpeed > .2) && i++ < 900) { ctl(c, { brake: 1 }); c.physics(dt); } r.stop = c.z - 300; }
      { const c = car(type, 18); for (let i = 0; i < 42; i++) { ctl(c, { handbrake: 1, steer: 1 }); c.physics(dt); } for (let i = 0; i < 60; i++) { ctl(c, {}); c.physics(dt); } r.hbrake = Math.abs(c.angle) * deg; }
      { const c = car(type, 20); for (let i = 0; i < 27; i++) { ctl(c, { handbrake: 1, steer: 1, throttle: .3 }); c.physics(dt); }
        let held = 0, spun = 0, lit = false;
        for (let i = 0; i < 240; i++) { const s = slip(c), dir = Math.sign(c.lat) || 1; // lat < 0 is the tail out to the right with the nose turned left
          // a reasonable human: turn in while the slide is shallow, countersteer once it passes 30 degrees, throttle to keep it lit
          const steer = M.clamp(-dir * ((30 - s) / 15), -1, 1), throttle = s < 22 ? 1 : s > 40 ? .2 : .7;
          ctl(c, { steer, throttle }); c.physics(dt); const s2 = slip(c); if (s2 > 80) { spun = 1; break; } if (s2 > 15) lit = true; else if (lit || i > 90) break; if (lit) held += dt; }
        r.drift = held; r.spin = spun; }
      for (const [key, hitAngle] of [['wall', 12], ['wall60', 60]]) { const c = car(type, 20, hitAngle / deg); W.pushOut = (x, z, rad) => { if (x + rad <= 303) return { x, z }; const hit = [-1, 0]; return { x: 303 - rad, z, hit }; };
        for (let i = 0; i < 60; i++) { ctl(c, { throttle: 0 }); c.physics(dt); } r[key] = c.absSpeed / 20 * 100; W.pushOut = open; }
      out[type] = r;
    }
    return JSON.stringify(out);
  })()`, ctx);
}
const res = { dry: JSON.parse(lab(0)), wet: JSON.parse(lab(1)) };
if (json) { console.log(JSON.stringify(res)); process.exit(0); }
const cols = [['turnIn', 2], ['latG', 2], ['settle', 2], ['overshoot', 1], ['slalom', 1], ['stop', 1], ['hbrake', 0], ['drift', 2], ['spin', 0], ['wall', 0], ['wall60', 0]];
for (const k of ['dry', 'wet']) {
  console.log(`\n${rev ? rev : 'working tree'} — ${k}`);
  console.log('type    ' + cols.map(([c]) => c.padStart(9)).join(''));
  for (const [type, r] of Object.entries(res[k])) console.log(type.padEnd(8) + cols.map(([c, d]) => r[c].toFixed(d).padStart(9)).join(''));
}
