// Visual regression suite: renders controlled scenes headless and inspects the screenshots pixel by pixel.
// Catches the class of bug a numeric test cannot: mirrored cameras, mirrored or upside-down textures,
// radar blips that rotate the wrong way, a black screen at night, a missing HUD, models that are just boxes.
// usage: node visual.js [--keep]   (screenshots of every check land in ../pt/visual/)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'pt', 'visual'); fs.mkdirSync(OUT, { recursive: true });
const results = []; let shotN = 0;
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('--')); const want = key => !ONLY.length || ONLY.some(o => key.startsWith(o));
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : '')); }

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('GL_INVALID')) errors.push(m.text().slice(0, 200)); });
  await page.goto('file://' + path.resolve(__dirname, '..', '..', '..', 'index.html') + '?shadow=512');
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => { GAME.startPlay(); MISSIONS.S.dialogue = null; MISSIONS.S.progress = 1; MISSIONS.S.cooldown = 1e9; window.__manual = true; window.__pt = { paused: true }; // the frame loop is parked; every render is explicit
    window.sim = (sec, keys) => { GAME.state = 'playing'; /* a screenshot can drop pointer lock, which auto-pauses */ return window.__sim(sec, keys); }; window.tp = (x, z, yaw) => { const P = PLAYER.P; P.x = x; P.z = z; P.vx = P.vz = 0; if (yaw !== undefined) { P.camYaw = yaw; P.angle = yaw; } };
    window.clearArea = (x, z, r) => { for (const c of W.cars) if (!c.removed && c !== PLAYER.car && M.dist(c.x, c.z, x, z) < r) c.removed = true; for (const p of W.peds) if (!p.inCar && M.dist(p.x, p.z, x, z) < r) p.removed = true; };
    // pixel helpers over the last decoded screenshot (window.__shot = ImageData)
    window.px = { load(b64) { return new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); window.__shot = g.getImageData(0, 0, c.width, c.height); res([c.width, c.height]); }; img.src = 'data:image/png;base64,' + b64; }); },
      // centroid and count of pixels matching a colour predicate inside an optional rect
      find(pred, rect) { const s = window.__shot; const [x0, y0, x1, y1] = rect || [0, 0, s.width, s.height]; let n = 0, sx = 0, sy = 0, bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1; const d = s.data; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * s.width + x) * 4; if (pred(d[i], d[i + 1], d[i + 2])) { n++; sx += x; sy += y; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); } } return n ? { n, x: sx / n, y: sy / n, box: [bx0, by0, bx1, by1] } : { n: 0, x: -1, y: -1 }; },
      mean(rect) { const s = window.__shot; const [x0, y0, x1, y1] = rect; let sum = 0, n = 0; const d = s.data; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * s.width + x) * 4; sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; } return sum / n; } };
    window.COL = { magenta: (r, g, b) => r > 140 && b > 140 && g < 100, cyan: (r, g, b) => g > 140 && b > 140 && r < 100, red: (r, g, b) => r > 90 && r > g + 60 && r > b + 60, green: (r, g, b) => g > 90 && g > r + 60 && g > b + 60, blue: (r, g, b) => b > 90 && b > r + 60 && b > g + 40, yellow: (r, g, b) => r > 70 && g > r * 0.45 && g < r * 0.88 && b < g - 25, /* the card's orange quadrant, which may be in shade */ blip: (r, g, b) => Math.abs(r - 245) < 12 && Math.abs(g - 197) < 12 && Math.abs(b - 66) < 14 };
  });
  async function shot(label) { await page.evaluate(() => { MISSIONS.S.dialogue = null; GAME.state = 'playing'; window.__renderOnce(); }); const buf = await page.screenshot({ timeout: 240000 }); fs.writeFileSync(path.join(OUT, `${String(shotN++).padStart(2, '0')}-${label}.png`), buf); return page.evaluate(b64 => window.px.load(b64), buf.toString('base64')); }
  const ev = (fn, ...args) => page.evaluate(fn, ...args);
  const W = 960, H = 540; const clearBoxes = () => ev(() => { window.__debugBoxes.length = 0; });
  const radarC = await ev(() => { const R = Math.min(110, innerWidth * 0.14); return { R, cx: R + 24, cy: innerHeight - R - 24 }; });
  const dpr = await ev(() => devicePixelRatio);

  if (want('camera')) {
  // ---- 1. handedness: a magenta box to the player's right must land on the right half of the screen
  await ev(() => { W.state.time = 12; tp(300, 336, Math.PI); clearArea(300, 336, 80); sim(0.3); tp(300, 336, Math.PI);
    __debugBox(300 + 6 - 0.6, 0.2, 336 - 10 - 0.6, 1.2, 2.2, 1.2, [1, 0, 1]); __debugBox(300 - 6 - 0.6, 0.2, 336 - 10 - 0.6, 1.2, 2.2, 1.2, [0, 1, 1]); });
  await shot('handedness');
  { const m = await ev(() => px.find(COL.magenta)), c = await ev(() => px.find(COL.cyan));
    check('camera: world-right appears on screen-right', m.n > 50 && c.n > 50 && m.x > W * 0.55 && c.x < W * 0.45, { magenta: Math.round(m.x), cyan: Math.round(c.x), nM: m.n, nC: c.n }); }
  await clearBoxes(); }

  if (want('steering')) {
  // ---- 2. steering: holding D turns the car toward world-right (the direction the camera shows on the right)
  { const r = await ev(() => { tp(300, 336, Math.PI); clearArea(300, 336, 80); const c = VEH.spawn('sedan', 285, 332.5, Math.PI / 2, { mode: 'parked' }); /* heading +x along the road */ PLAYER.P.x = c.x - c.right[0] * 2; PLAYER.P.z = c.z - c.right[1] * 2; PLAYER.P.state = 'foot'; sim(0.1, ['KeyF']); sim(2); if (PLAYER.car !== c) return { entered: false };
      const rx = c.right[0], rz = c.right[1]; sim(1.2, ['KeyW']); const spdW = c.speed; sim(0.5, ['KeyW', 'KeyD']); const f = c.fwd; const dotR = f[0] * rx + f[1] * rz; const spdD = c.speed, steer = c.controls.steer; const r2x = c.right[0], r2z = c.right[1]; /* right after the first turn */ sim(0.8, ['KeyW', 'KeyA']); const f2 = c.fwd; const dotL = f2[0] * r2x + f2[1] * r2z; PLAYER.exitCar(); c.removed = true; return { entered: true, dotR: +dotR.toFixed(3), dotL: +dotL.toFixed(3), spdW: +spdW.toFixed(1), spdD: +spdD.toFixed(1), steer, wrecked: c.wrecked, hp: Math.round(c.health) }; });
    check('steering: D turns right, A turns left', r.entered && r.dotR > 0.15 && r.dotL < -0.08, r); } }

  if (want('radar')) {
  // ---- 3. radar: a mission blip ahead sits above the radar centre, one to the right sits right of it, and an off-radar target hugs the top edge
  const blipAt = async (dx, dz, label) => { await ev(([dx, dz]) => { tp(300, 336, Math.PI); MISSIONS.S.blip = { x: 300 + dx, z: 336 + dz, col: '#ff00ff', obj: null, label: '' }; /* magenta: no map icon uses it */ }, [dx, dz]); await shot('radar-' + label); const rect = [Math.round((radarC.cx - radarC.R - 14) * dpr), Math.round((radarC.cy - radarC.R - 14) * dpr), Math.round((radarC.cx + radarC.R + 14) * dpr), Math.round((radarC.cy + radarC.R + 14) * dpr)]; return ev(rect => px.find(COL.magenta, rect), rect); };
  { const ahead = await blipAt(0, -30, 'ahead'); check('radar: target ahead draws above the centre', ahead.n > 10 && ahead.y < (radarC.cy - 12) * dpr && Math.abs(ahead.x - radarC.cx * dpr) < 14 * dpr, { x: Math.round(ahead.x - radarC.cx * dpr), y: Math.round(ahead.y - radarC.cy * dpr), n: ahead.n });
    const right = await blipAt(30, 0, 'right'); check('radar: target to the right draws right of the centre', right.n > 10 && right.x > (radarC.cx + 12) * dpr && Math.abs(right.y - radarC.cy * dpr) < 14 * dpr, { x: Math.round(right.x - radarC.cx * dpr), y: Math.round(right.y - radarC.cy * dpr), n: right.n });
    const far = await blipAt(0, -400, 'edge'); check('radar: off-radar target ahead sits at the top edge', far.n > 10 && far.y < (radarC.cy - radarC.R + 20) * dpr && Math.abs(far.x - radarC.cx * dpr) < 14 * dpr, { x: Math.round(far.x - radarC.cx * dpr), y: Math.round(far.y - radarC.cy * dpr), n: far.n });
    // turn 90 degrees right: the same off-radar target must swing to the LEFT edge (it is now on our left)
    await ev(() => { tp(300, 336, Math.PI / 2); MISSIONS.S.blip = { x: 300, z: 336 - 400, col: '#ff00ff', obj: null, label: '' }; }); await shot('radar-turned');
    const rect = [Math.round((radarC.cx - radarC.R - 14) * dpr), Math.round((radarC.cy - radarC.R - 14) * dpr), Math.round((radarC.cx + radarC.R + 14) * dpr), Math.round((radarC.cy + radarC.R + 14) * dpr)];
    const turned = await ev(rect => px.find(COL.magenta, rect), rect); check('radar: after turning right the target swings to the left edge', turned.n > 10 && turned.x < (radarC.cx - radarC.R + 20) * dpr && Math.abs(turned.y - radarC.cy * dpr) < 14 * dpr, { x: Math.round(turned.x - radarC.cx * dpr), y: Math.round(turned.y - radarC.cy * dpr), n: turned.n });
    await ev(() => { MISSIONS.S.blip = null; }); } }

  if (want('texture')) {
  // ---- 4. texture orientation on all four box faces: the test card's red quadrant must be top-left as seen from outside
  for (const [face, yaw, px_, pz_] of [['+z', Math.PI, 0, 8], ['-z', 0, 0, -8], ['+x', -Math.PI / 2, 8, 0], ['-x', Math.PI / 2, -8, 0]]) {
    await ev(([yaw, dx, dz]) => { window.__debugBoxes.length = 0; W.state.time = 12; sim(0.2); tp(300 + dx, 336 + dz, yaw); clearArea(300, 336, 60); const rx = -Math.cos(yaw), rz = Math.sin(yaw); /* screen-right for this yaw */ const bx = 300 + rx * 3.2, bz = 336 + rz * 3.2; window.__tbox = [bx, bz]; __debugBox(bx - 1.5, 0.3, bz - 1.5, 3, 3, 3, [1, 1, 1], TEX.names.testcard, 0); /* lit, not emissive: emissive adds the vertex colour and would wash the card white */ }, [yaw, px_, pz_]);
    await shot('face' + face);
    /* search only around the box itself: the shopfronts behind it carry every colour on the card */
    const mid = await ev(([W, H, dpr]) => { const c = document.getElementById('gl'); const pr = RENDER.project(window.__tbox[0], 1.8, window.__tbox[1], c) || [W * 0.6, H * 0.45]; const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)); return [Math.round(cl(pr[0] - W * 0.22, 0, W) * dpr), Math.round(cl(pr[1] - H * 0.3, 0, H) * dpr), Math.round(cl(pr[0] + W * 0.22, 0, W) * dpr), Math.round(cl(pr[1] + H * 0.3, 0, H) * dpr)]; }, [W, H, dpr]);
    const q = await ev(m => ({ r: px.find(COL.red, m), g: px.find(COL.green, m), b: px.find(COL.blue, m), y: px.find(COL.yellow, m) }), mid);
    const ok = q.r.n > 200 && q.g.n > 200 && q.b.n > 200 && q.y.n > 200 && q.r.x < q.g.x - 20 && q.b.x < q.y.x - 20 && q.r.y < q.b.y - 20 && q.g.y < q.y.y - 20;
    check(`texture: ${face} face reads upright and unmirrored`, ok, { red: [Math.round(q.r.x), Math.round(q.r.y), q.r.n], green: [Math.round(q.g.x), Math.round(q.g.y), q.g.n], blue: [Math.round(q.b.x), Math.round(q.b.y), q.b.n], yellow: [Math.round(q.y.x), Math.round(q.y.y), q.y.n] });
  }
  await clearBoxes(); }

  if (want('exposure')) {
  // ---- 5. exposure: day is bright, night is dark but not black, and the sky is at the top
  const centre = [Math.round(W * 0.7 * dpr), Math.round(H * 0.6 * dpr), Math.round(W * 0.95 * dpr), Math.round(H * 0.9 * dpr)]; /* road surface, clear of the HUD and the player */
  await ev(() => { if (!PLAYER.P.alive) PLAYER.respawn(); PLAYER.P.health = 100; W.state.time = 12.5; tp(300, 336, Math.PI); clearArea(300, 336, 40); sim(0.3); tp(300, 336, Math.PI); }); await shot('day');
  const day = await ev(r => px.mean(r), centre); await ev(() => { PLAYER.P.camPitch = 0.28; });
  // the sky: stand on the beach at the south edge and look out to sea, where nothing tall is in the way
  await ev(() => { if (!PLAYER.P.alive) PLAYER.respawn(); PLAYER.P.health = 100; tp(420, 846, 0); clearArea(420, 846, 40); sim(0.3); tp(420, 846, 0); PLAYER.P.camPitch = 0.08; }); await shot('sky');
  const skyTop = await ev(r => px.mean(r), [Math.round(W * 0.3 * dpr), 0, Math.round(W * 0.7 * dpr), Math.round(20 * dpr)]);
  await ev(() => { W.state.time = 22.5; tp(300, 336, Math.PI); sim(0.3); tp(300, 336, Math.PI); }); await shot('night');
  const night = await ev(r => px.mean(r), centre);
  check('exposure: the road at midday is mid-bright', day > 40 && day < 220, { day: Math.round(day) });
  check('exposure: the road at night is darker than by day but not black', night > 6 && night < day - 15, { night: Math.round(night), day: Math.round(day) });
  check('exposure: the sky is bright when you look up by day', skyTop > 90, { skyTop: Math.round(skyTop) }); }

  if (want('hud')) {
  // ---- 6. HUD: health bar, radar disc and money are drawn where they belong
  await ev(() => { W.state.time = 12; sim(0.3); tp(300, 336, Math.PI); }); await shot('hud');
  { const bar = await ev(r => px.find((R, G, B) => R > 170 && G < 90 && B < 90, r), [Math.round(250 * dpr), Math.round((H - 60) * dpr), Math.round(440 * dpr), Math.round((H - 30) * dpr)]);
    check('hud: health bar is drawn beside the radar', bar.n > 200, { n: bar.n });
    const money = await ev(r => px.find((R, G, B) => G > 180 && R < 140 && B < 140, r), [Math.round((W - 260) * dpr), 0, Math.round(W * dpr), Math.round(60 * dpr)]);
    check('hud: money counter is drawn top-right', money.n > 80, { n: money.n });
    const arrow = await ev(r => px.find((R, G, B) => R > 235 && G > 235 && B > 235, r), [Math.round((radarC.cx - 12) * dpr), Math.round((radarC.cy - 12) * dpr), Math.round((radarC.cx + 12) * dpr), Math.round((radarC.cy + 12) * dpr)]);
    check('hud: player arrow sits at the radar centre', arrow.n > 10, { n: arrow.n }); } }

  if (want('models')) {
  // ---- 7. models are not boxes: triangle budgets
  { const m = await ev(() => { const o = {}; for (const t of Object.keys(MESH.VEHICLES)) { const c = MESH.carMesh(t, [1, 0, 0]); o[t] = c.body.i.length / 3 + c.glass.i.length / 3; } o.ped = MESH.pedMesh(PEDS.MARLA).i.length / 3; return o; });
    const low = Object.entries(m).filter(([k, v]) => v < (k === 'ped' ? 700 : 1000)); check('models: every car has over 1000 triangles and a ped over 700', low.length === 0, m); } }

  // ---- 8. nothing threw
  check('no page errors during the visual suite', errors.length === 0, errors.slice(0, 5));
  await b.close();
  const failed = results.filter(r => !r.ok).length; console.log(`\n${results.length - failed}/${results.length} checks passed; screenshots in ${OUT}`);
  process.exit(failed ? 1 : 0);
})();
