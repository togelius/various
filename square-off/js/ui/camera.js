// SQUARE OFF — RTS orbit camera (DESIGN §5.4). Drives SQ.render.camera (a THREE.PerspectiveCamera).
// Height 30–230 m, pitch eases 38° → 55° → 68° with zoom, target clamped to the park + 50 m,
// heading free (snaps to 8 headings after a touch twist), edge pan on desktop, opening flight
// (Fountain → Arch → Empire State, then a crane up into a north-up view of your side), Director nudge,
// subtle shake and a 4 % punch-in.
//
// SQ.camera API:
//   init(viewEl)  update(realDt)  setMatch(match|null)
//   focus(x, z, {height, instant, heading})   jump/ease to a ground point
//   panScreen(x0, y0, x1, y1)   keep the ground point under (x0,y0) under (x1,y1) (drag pan)
//   panWorld(dx, dz)   zoomBy(factor, clientX?, clientY?)   rotateBy(rad)   tiltBy(rad)   snapHeading()
//   startIntro(onDone?)  skipIntro()  inIntro   touch()  (marks user camera input; Director nudge waits 4 s)
//   shake(amount 0..1)  punch(fraction e.g. 0.04)
//   state -> {x, z, height, heading, pitch}  (heading 0 = looking north, + turns toward east)
(function (SQ) {
  'use strict';
  const H_MIN = 30, H_MAX = 230;
  const PB = (SQ.C && SQ.C.PARK_BOUNDS) || { x0: -162, x1: 135, z0: -72, z1: 73 };
  const CL = { x0: PB.x0 - 50, x1: PB.x1 + 50, z0: PB.z0 - 50, z1: PB.z1 + 50 };
  const DEG = Math.PI / 180;

  const cam = {
    // current
    x: 0, z: 10, h: 140, heading: 0, tilt: 0,
    // goal
    gx: 0, gz: 10, gh: 140, gheading: 0, gtilt: 0,
    pitch: 55 * DEG,
    view: null, match: null,
    lastTouch: -99, time: 0,
    intro: null, inIntro: false,
    shakeAmt: 0, punchT: 0, punchAmt: 0,
    mouse: { x: -1, y: -1, inside: false, fine: false },
    keys: Object.create(null),
    attract: 0,
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function damp(cur, goal, rate, dt) { return goal + (cur - goal) * Math.exp(-rate * dt); }
  function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  // Pitch from height: 38° at 30 m, 55° at ~110 m, 68° at 230 m.
  function pitchFor(h) {
    const t = clamp((h - H_MIN) / (H_MAX - H_MIN), 0, 1);
    const p = t < 0.4 ? 38 + (55 - 38) * smooth(t / 0.4) : 55 + (68 - 55) * smooth((t - 0.4) / 0.6);
    return p * DEG;
  }

  function poseFrom(x, z, h, heading, tilt, out) {
    const pitch = clamp(pitchFor(h) + tilt, 20 * DEG, 85 * DEG);
    const back = h / Math.tan(pitch);
    out.px = x - Math.sin(heading) * back;
    out.pz = z + Math.cos(heading) * back;
    out.py = h;
    out.tx = x; out.ty = 0; out.tz = z;
    out.pitch = pitch;
    return out;
  }

  const pose = {};
  const _look = { x: 0, y: 0, z: 0 };
  function apply(dt) {
    const c3 = SQ.render && SQ.render.camera;
    if (!c3) return;
    let px, py, pz, tx, ty, tz;
    if (cam.intro) {
      const p = introPose(cam.intro.t);
      px = p.px; py = p.py; pz = p.pz; tx = p.tx; ty = p.ty; tz = p.tz;
    } else {
      poseFrom(cam.x, cam.z, cam.h, cam.heading, cam.tilt, pose);
      px = pose.px; py = pose.py; pz = pose.pz; tx = pose.tx; ty = pose.ty; tz = pose.tz;
      cam.pitch = pose.pitch;
    }
    // shake (subtle, decays fast)
    if (cam.shakeAmt > 0.001 && !reduced()) {
      const a = cam.shakeAmt * 0.6, t = cam.time * 60;
      px += Math.sin(t * 1.3) * a; py += Math.sin(t * 1.7 + 1) * a * 0.6; pz += Math.cos(t * 1.1) * a;
    }
    cam.shakeAmt = Math.max(0, cam.shakeAmt - dt * 2.2);
    c3.position.set(px, py, pz);
    _look.x = tx; _look.y = ty; _look.z = tz;
    c3.lookAt(tx, ty, tz);
    // punch-in (fov)
    let fov = 40;
    if (cam.punchT > 0) {
      const k = cam.punchT / 0.35;
      fov = 40 * (1 - cam.punchAmt * Math.sin(Math.PI * (1 - k)));
      cam.punchT = Math.max(0, cam.punchT - dt);
    }
    if (Math.abs(c3.fov - fov) > 1e-4) { c3.fov = fov; c3.updateProjectionMatrix(); }
    c3.updateMatrixWorld();
  }
  function reduced() { return SQ.render && SQ.render.options && SQ.render.options.reducedMotion; }

  // ---------------------------------------------------------------- opening flight
  // 0–1.8 s: low at the Fountain, looking north through the Arch up Fifth Avenue (Empire State framed).
  // 1.8–5.2 s: crane up and over into the north-up gameplay pose.
  const INTRO_LEN = 5.2;
  function introPose(t) {
    // the Empire State Building sits inside the Arch opening from this line of sight
    const a = { px: 0.75, py: 11, pz: 40, tx: 0.75, ty: 13, tz: -60 };
    const b = { px: 0.75, py: 17.5, pz: 12, tx: 0.75, ty: 14, tz: -60 };
    const end = poseFrom(cam.gx, cam.gz, cam.gh, cam.gheading, cam.gtilt, {});
    const o = {};
    if (t < 1.8) {
      const k = smooth(t / 1.8) * 0.85 + (t / 1.8) * 0.15;
      for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k;
      return o;
    }
    const k = smooth((t - 1.8) / (INTRO_LEN - 1.8));
    // arc up: go via a high midpoint above the Fountain
    const mid = { px: (b.px + end.px) / 2, py: Math.max(70, end.py * 0.9), pz: (b.pz + end.pz) / 2 + 20 };
    const k1 = 1 - k;
    o.px = k1 * k1 * b.px + 2 * k1 * k * mid.px + k * k * end.px;
    o.py = k1 * k1 * b.py + 2 * k1 * k * mid.py + k * k * end.py;
    o.pz = k1 * k1 * b.pz + 2 * k1 * k * mid.pz + k * k * end.pz;
    const kl = smooth(Math.min(1, (t - 1.8) / (INTRO_LEN - 2.4)));
    o.tx = b.tx + (end.tx - b.tx) * kl; o.ty = b.ty + (end.ty - b.ty) * kl; o.tz = b.tz + (end.tz - b.tz) * kl;
    return o;
  }

  function startIntro(onDone) {
    if (reduced()) { cam.x = cam.gx; cam.z = cam.gz; cam.h = cam.gh; cam.heading = cam.gheading; if (onDone) onDone(); return; }
    cam.intro = { t: 0, t0: performance.now(), done: onDone || null };
    cam.inIntro = true;
  }
  function skipIntro() {
    if (!cam.intro) return;
    const done = cam.intro.done;
    cam.intro = null; cam.inIntro = false;
    cam.x = cam.gx; cam.z = cam.gz; cam.h = cam.gh; cam.heading = cam.gheading; cam.tilt = cam.gtilt;
    if (SQ.bus) SQ.bus.emit('introDone', {});
    if (done) done();
  }

  // ---------------------------------------------------------------- controls
  function clampGoal() {
    cam.gx = clamp(cam.gx, CL.x0, CL.x1);
    cam.gz = clamp(cam.gz, CL.z0, CL.z1);
    cam.gh = clamp(cam.gh, H_MIN, H_MAX);
    cam.gtilt = clamp(cam.gtilt, -0.3, 0.25);
  }
  function touch() { cam.lastTouch = cam.time; if (cam.intro) skipIntro(); if (SQ.render) SQ.render.invalidate(); }

  function focus(x, z, opts) {
    opts = opts || {};
    cam.gx = x; cam.gz = z;
    if (opts.height) cam.gh = opts.height;
    if (opts.heading !== undefined) cam.gheading = opts.heading;
    clampGoal();
    if (opts.instant) { cam.x = cam.gx; cam.z = cam.gz; cam.h = cam.gh; cam.heading = cam.gheading; }
    if (!opts.auto) touch();
  }
  function panWorld(dx, dz) { cam.gx += dx; cam.gz += dz; clampGoal(); cam.x = cam.gx; cam.z = cam.gz; touch(); }
  function panScreen(x0, y0, x1, y1) {
    const R = SQ.render;
    if (!R || !R.screenToGround) return;
    apply(0);
    const a = R.screenToGround(x0, y0, 0), b = R.screenToGround(x1, y1, 0);
    if (!a || !b) return;
    let dx = a.x - b.x, dz = a.z - b.z;
    const lim = cam.h * 0.8; // avoid huge jumps near the horizon
    const L = Math.hypot(dx, dz); if (L > lim) { dx *= lim / L; dz *= lim / L; }
    panWorld(dx, dz);
  }
  function zoomBy(f, cx, cy) {
    const oldH = cam.gh;
    cam.gh = clamp(cam.gh * f, H_MIN, H_MAX);
    if (cx !== undefined && SQ.render && SQ.render.screenToGround) {
      const g = SQ.render.screenToGround(cx, cy, 0);
      if (g) {
        const k = 1 - cam.gh / oldH;
        cam.gx += (g.x - cam.gx) * k * 0.9;
        cam.gz += (g.z - cam.gz) * k * 0.9;
      }
    }
    clampGoal();
    touch();
  }
  function rotateBy(r) { cam.gheading += r; touch(); }
  function rotateNow(r) { cam.gheading += r; cam.heading += r; touch(); }
  function tiltBy(t) { cam.gtilt += t; clampGoal(); touch(); }
  function snapHeading() { const step = Math.PI / 4; cam.gheading = Math.round(cam.gheading / step) * step; }

  // ---------------------------------------------------------------- Director nudge
  function nudge(dt) {
    const m = cam.match;
    const want = cam.nudgeOverride !== null && cam.nudgeOverride !== undefined ? cam.nudgeOverride : !!(m && m.rules && m.rules.directorNudge);
    if (!m || !want || cam.intro) return;
    if (cam.time - cam.lastTouch < 4) return;
    const s = m.state, u = s.units, UF = SQ.C.UF;
    // biggest fight: 30 m buckets of units in combat
    const buckets = new Map();
    for (let i = 0; i < u.n; i++) {
      if (!(u.flags[i] & UF.COMBAT) || (u.flags[i] & UF.OVERIT)) continue;
      const k = Math.floor(u.x[i] / 30) * 1000 + Math.floor(u.z[i] / 30);
      let b = buckets.get(k);
      if (!b) { b = { n: 0, x: 0, z: 0, mine: 0 }; buckets.set(k, b); }
      b.n++; b.x += u.x[i]; b.z += u.z[i];
      if (u.faction[i] === s.player) b.mine++;
    }
    let best = null;
    buckets.forEach((b) => { const sc = b.n + b.mine * 2; if (b.n >= 3 && (!best || sc > best.sc)) best = { sc, x: b.x / b.n, z: b.z / b.n }; });
    if (!best) return;
    const d = Math.hypot(best.x - cam.gx, best.z - cam.gz);
    if (d < 25) return;
    const k = 1 - Math.exp(-dt * 0.6);
    cam.gx += (best.x - cam.gx) * k; cam.gz += (best.z - cam.gz) * k;
    clampGoal();
  }

  // ---------------------------------------------------------------- edge + key pan
  function edgeAndKeys(dt) {
    let vx = 0, vz = 0;
    const k = cam.keys;
    const inputBusy = SQ.input && SQ.input.dragging;
    if (k.ArrowUp || k.KeyW) vz -= 1;
    if (k.ArrowDown || (k.KeyS && !(SQ.input && SQ.input.hasSelection && SQ.input.hasSelection()))) vz += 1;
    if (k.ArrowLeft || k.KeyA) vx -= 1;
    if (k.ArrowRight || k.KeyD) vx += 1;
    const ms = cam.mouse;
    if (ms.fine && ms.inside && !inputBusy && document.hasFocus && document.hasFocus() && !cam.intro && !(SQ.game && SQ.game.match == null)) {
      const W = window.innerWidth, H = window.innerHeight, E = 10;
      if (ms.x <= E) vx -= 1; else if (ms.x >= W - 1 - E) vx += 1;
      if (ms.y <= E) vz -= 1; else if (ms.y >= H - 1 - E) vz += 1;
    }
    if (!vx && !vz) return;
    // screen-relative: up = camera forward on the ground
    const sp = (cam.h * 0.9 + 25) * dt;
    const f = { x: Math.sin(cam.heading), z: -Math.cos(cam.heading) };
    const r = { x: Math.cos(cam.heading), z: Math.sin(cam.heading) };
    cam.gx += (r.x * vx - f.x * vz) * sp;
    cam.gz += (r.z * vx - f.z * vz) * sp;
    clampGoal();
    cam.lastTouch = cam.time;
    if (cam.intro) skipIntro();
    if (SQ.render) SQ.render.invalidate();
  }

  function onKey(e, down) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) { if (!down) cam.keys[e.code] = false; return; }
    cam.keys[e.code] = down;
  }

  // ---------------------------------------------------------------- lifecycle
  const camera = {
    init(viewEl) {
      cam.view = viewEl;
      window.addEventListener('keydown', (e) => onKey(e, true));
      window.addEventListener('keyup', (e) => onKey(e, false));
      window.addEventListener('blur', () => { cam.keys = Object.create(null); cam.mouse.inside = false; });
      window.addEventListener('pointermove', (e) => {
        cam.mouse.x = e.clientX; cam.mouse.y = e.clientY; cam.mouse.inside = true;
        cam.mouse.fine = e.pointerType === 'mouse';
      }, { passive: true });
      document.addEventListener('mouseleave', () => { cam.mouse.inside = false; });
      // attract pose behind menus
      cam.gx = cam.x = -10; cam.gz = cam.z = -5; cam.gh = cam.h = 170; cam.heading = cam.gheading = 0;
      apply(0);
    },
    setMatch(m) {
      cam.match = m || null;
      cam.keys = Object.create(null);
      if (!m) { cam.intro = null; cam.inIntro = false; return; }
      const s = m.state;
      const me = s.factions[s.player >= 0 ? s.player : 0];
      const home = me && s.lmById[me.home];
      const hx = home ? home.x : 0, hz = home ? home.z : 0;
      // north-up over your side, the Fountain in view
      const sz = SQ.render && SQ.render.size ? SQ.render.size() : { w: 16, h: 10 };
      const k = sz.w / sz.h < 0.9 ? 0.93 : 0.78; // portrait phones: keep home well inside the narrow view
      cam.gx = hx * k; cam.gz = hz * k + (hz < 0 ? 4 : -2);
      cam.gh = (SQ.render && SQ.render.size && SQ.render.size().w < 700) ? 135 : 115;
      cam.gheading = 0; cam.gtilt = 0;
      // south homes: a north-looking camera would sit over the tall blocks on W 4th St (Bobst,
      // Kimmel) and their roofs would fill the bottom of the screen - look down more steeply so
      // the camera stays over the park's south edge
      if (hz > 20) { cam.gtilt = 0.25; cam.gz -= 4; if (k < 0.9) cam.gx = hx * 0.64; }
      clampGoal();
      const params = new URLSearchParams(location.search);
      if (params.has('nointro') || params.has('shot')) { cam.x = cam.gx; cam.z = cam.gz; cam.h = cam.gh; cam.heading = 0; cam.tilt = cam.gtilt; cam.intro = null; cam.inIntro = false; }
      else startIntro();
      cam.lastTouch = cam.time;
    },
    update(dt) {
      const rawDt = Math.min(0.25, Math.max(0, dt || 0));
      dt = Math.min(0.1, rawDt);
      cam.time += dt;
      if (cam.intro) {
        // wall-clock: a slow device must not get a longer (or stalled) flight
        cam.intro.t = Math.max(cam.intro.t + Math.min(rawDt, 0.05), (performance.now() - cam.intro.t0) / 1000);
        if (cam.intro.t >= INTRO_LEN) skipIntro();
        if (SQ.render) SQ.render.invalidate();
      } else {
        if (!cam.match) { // menu attract: slow drift around the park
          cam.attract += dt;
          cam.gheading = Math.sin(cam.attract * 0.05) * 0.5;
          cam.gx = Math.sin(cam.attract * 0.03) * 40 - 10;
        }
        edgeAndKeys(dt);
        nudge(dt);
        const r = 10;
        cam.x = damp(cam.x, cam.gx, r, dt);
        cam.z = damp(cam.z, cam.gz, r, dt);
        cam.h = damp(cam.h, cam.gh, 9, dt);
        cam.tilt = damp(cam.tilt, cam.gtilt, 10, dt);
        cam.heading = cam.heading + angDiff(cam.heading, cam.gheading) * (1 - Math.exp(-9 * dt));
        if (Math.abs(cam.x - cam.gx) + Math.abs(cam.z - cam.gz) + Math.abs(cam.h - cam.gh) > 0.01 && SQ.render) SQ.render.invalidate();
      }
      apply(dt);
      if (SQ.audio && SQ.audio.setListener) {
        try { SQ.audio.setListener(cam.intro ? 0.75 : cam.x, cam.intro ? 0 : cam.z, cam.heading, cam.h); } catch (e) { /* audio optional */ }
      }
    },
    setNudge(on) { cam.nudgeOverride = on === undefined || on === null ? null : !!on; },
    attract() { if (cam.match) return false; cam.gh = 170; cam.attract = 0; return true; },
    focus, panWorld, panScreen, zoomBy, rotateBy, rotateNow, tiltBy, snapHeading, startIntro, skipIntro, touch,
    shake(a) { if (!reduced()) cam.shakeAmt = Math.min(1.2, Math.max(cam.shakeAmt, a || 0.3)); },
    punch(p) { if (!reduced()) { cam.punchAmt = p || 0.04; cam.punchT = 0.35; } },
    get inIntro() { return !!cam.intro; },
    get state() { return { x: cam.x, z: cam.z, height: cam.h, heading: cam.heading, pitch: cam.pitch, goalX: cam.gx, goalZ: cam.gz }; },
    get height() { return cam.h; },
    get heading() { return cam.heading; },
    pitchFor,
    limits: { H_MIN, H_MAX, bounds: CL },
  };
  SQ.camera = camera;
})(window.SQ = window.SQ || {});
