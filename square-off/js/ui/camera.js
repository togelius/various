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
// Hang Out matches (state.mode === 'hangout'): no opening flight and no nudge; the view starts behind your
// entrance looking across the park (your side at the bottom of the screen); edge pan is off unless the
// 'edgePan' setting is on (it is on by default). fit([[x, z], ...], {pad}) frames points ("show my groups");
// fitScreen([{x, z, w, up, down}], {heading, rect}) frames them inside a screen rect (the opening view shows all
// five spots and their signs). The view stays over the playing area, keys pan at 30-55 m/s, and the camera may
// zoom out to 320 m (360 m on portrait phones: hMax) to see the whole playing area.
//   stats -> {pan (m), zoom (log units), rot (rad)} of user camera movement since resetStats() (tutorial)
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
    edgePan: true,
    stats: { pan: 0, zoom: 0, rot: 0 },
  };
  function isHangout(m) { return !!(m && m.state && m.state.mode === 'hangout'); }

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
  // Hang Out keeps the view on the playing area (the five spots and both entrances) plus a margin, so panning
  // never carries it off into the city; on a narrow (portrait) screen it may zoom out further, far enough to
  // see all five spots at once.
  const HO_CL = { x0: -125, x1: 120, z0: -98, z1: 98 };
  function narrowView() { const sz = SQ.render && SQ.render.size ? SQ.render.size() : { w: 16, h: 10 }; return sz.w / Math.max(1, sz.h) < 0.9; }
  function hMax() { return isHangout(cam.match) ? (narrowView() ? 360 : 320) : H_MAX; }
  function clampGoal() {
    const B = isHangout(cam.match) ? HO_CL : CL;
    cam.gx = clamp(cam.gx, B.x0, B.x1);
    cam.gz = clamp(cam.gz, B.z0, B.z1);
    cam.gh = clamp(cam.gh, H_MIN, hMax());
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
  function panWorld(dx, dz) { cam.gx += dx; cam.gz += dz; clampGoal(); cam.x = cam.gx; cam.z = cam.gz; cam.stats.pan += Math.hypot(dx, dz); touch(); }
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
    cam.gh = clamp(cam.gh * f, H_MIN, hMax());
    if (cx !== undefined && SQ.render && SQ.render.screenToGround) {
      const g = SQ.render.screenToGround(cx, cy, 0);
      if (g) {
        const k = 1 - cam.gh / oldH;
        cam.gx += (g.x - cam.gx) * k * 0.9;
        cam.gz += (g.z - cam.gz) * k * 0.9;
      }
    }
    clampGoal();
    // the tutorial counts the zoom the player asked for (at the limit nothing moves, but they did it)
    cam.stats.zoom += Math.max(Math.abs(Math.log(cam.gh / oldH)), Math.abs(Math.log(f)));
    touch();
  }
  function rotateBy(r) { cam.gheading += r; cam.stats.rot += Math.abs(r); touch(); }
  function rotateNow(r) { cam.gheading += r; cam.heading += r; cam.stats.rot += Math.abs(r); touch(); }
  /** Frame a set of ground points [[x, z], ...] (eased). */
  function fit(pts, opts) {
    opts = opts || {};
    if (!pts || !pts.length) return;
    let x = 0, z = 0;
    for (const p of pts) { x += p[0]; z += p[1]; }
    x /= pts.length; z /= pts.length;
    let R = 0;
    for (const p of pts) R = Math.max(R, Math.hypot(p[0] - x, p[1] - z));
    R += opts.pad === undefined ? 15 : opts.pad;
    const sz = SQ.render && SQ.render.size ? SQ.render.size() : { w: 16, h: 10 };
    const aspect = sz.w / Math.max(1, sz.h);
    // a narrow (portrait) view needs more height to fit the same width
    const h = R * (aspect < 1 ? 2.6 / Math.max(0.45, aspect) : 2.3) + 10;
    cam.gx = x; cam.gz = z + (opts.dz || 0);
    cam.gh = clamp(h, opts.min || 55, opts.max || 190);
    if (opts.heading !== undefined) cam.gheading = cam.heading + angDiff(cam.heading, opts.heading);
    clampGoal();
    touch();
  }
  /**
   * Frame ground points so that every one lands inside a screen rect (client px) at a given heading: the lowest
   * camera (up to maxH) that fits them, centred in the rect. pts: [{x, z, y?, w? (px of room left/right of the
   * point, e.g. half a sign), up? / down? (px of room above / below)}]. Sets the goal; returns true when it fits.
   */
  const _fv = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
  function fitScreen(pts, opts) {
    opts = opts || {};
    const R = SQ.render;
    if (!R || !R.camera || !_fv || !pts || !pts.length) return false;
    const sz = R.size ? R.size() : { w: window.innerWidth, h: window.innerHeight };
    const W = Math.max(1, sz.w), Hh = Math.max(1, sz.h);
    const rect = opts.rect || { left: 12, top: 70, right: W - 12, bottom: Hh - 140 };
    const heading = opts.heading !== undefined ? opts.heading : cam.gheading;
    const tilt = opts.tilt || 0;
    const c = R.camera.clone();
    c.aspect = W / Hh; c.fov = 40; c.updateProjectionMatrix();
    const P = {};
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const pose = (h, tx, tz) => { poseFrom(tx, tz, h, heading, tilt, P); c.position.set(P.px, P.py, P.pz); c.lookAt(P.tx, 0, P.tz); c.updateMatrixWorld(); };
    const box = () => {
      const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, behind: false };
      for (const p of pts) {
        _fv.set(p.x, p.y || 0, p.z).project(c);
        if (_fv.z > 1) b.behind = true;
        const sx = (_fv.x + 1) / 2 * W, sy = (1 - _fv.y) / 2 * Hh;
        b.x0 = Math.min(b.x0, sx - (p.w || 0)); b.x1 = Math.max(b.x1, sx + (p.w || 0));
        b.y0 = Math.min(b.y0, sy - (p.up || 0)); b.y1 = Math.max(b.y1, sy + (p.down || 0));
      }
      return b;
    };
    const ground = (sx, sy) => { ndc.set(sx / W * 2 - 1, -(sy / Hh) * 2 + 1); ray.setFromCamera(ndc, c); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null; };
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p.x; cz += p.z; }
    cx /= pts.length; cz /= pts.length;
    const maxH = Math.min(opts.maxH || hMax(), hMax());
    let best = null;
    for (let h = opts.minH || 70; h <= maxH + 0.01; h += 5) {
      let tx = cx, tz = cz;
      for (let it = 0; it < 5; it++) {
        pose(h, tx, tz);
        const b = box();
        const g1 = ground((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2), g2 = ground((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
        if (!g1 || !g2) break;
        tx += g1.x - g2.x; tz += g1.z - g2.z;
      }
      pose(h, tx, tz);
      const b = box();
      best = { h, tx, tz, heading, fits: false };
      if (!b.behind && b.x0 >= rect.left && b.x1 <= rect.right && b.y0 >= rect.top && b.y1 <= rect.bottom) { best.fits = true; break; }
    }
    if (!best) return null;
    if (opts.dry) return best;
    applyFit(best);
    return best;
  }
  function applyFit(f) {
    cam.gx = f.tx; cam.gz = f.tz; cam.gh = f.h;
    cam.gheading = cam.heading + angDiff(cam.heading, f.heading);
    cam.gtilt = 0;
    clampGoal();
  }

  function tiltBy(t) { cam.gtilt += t; clampGoal(); touch(); }
  function snapHeading() { const step = Math.PI / 4; cam.gheading = Math.round(cam.gheading / step) * step; }

  // ---------------------------------------------------------------- Director nudge
  function nudge(dt) {
    const m = cam.match;
    if (!m || isHangout(m)) return;   // Hang Out: the camera only moves when the player moves it
    const want = cam.nudgeOverride !== null && cam.nudgeOverride !== undefined ? cam.nudgeOverride : !!(m && m.rules && m.rules.directorNudge);
    if (!want || cam.intro) return;
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
    if (cam.edgePan && ms.fine && ms.inside && !inputBusy && document.hasFocus && document.hasFocus() && !cam.intro && !(SQ.game && SQ.game.match == null)) {
      const W = window.innerWidth, H = window.innerHeight, E = 10;
      if (ms.x <= E) vx -= 1; else if (ms.x >= W - 1 - E) vx += 1;
      if (ms.y <= E) vz -= 1; else if (ms.y >= H - 1 - E) vz += 1;
    }
    if (!vx && !vz) return;
    // screen-relative: up = camera forward on the ground. Hang Out pans at a walkable 30-55 m/s (a quick tap of W
    // moves the view a few metres, holding it crosses the park in about 3 s); Classic keeps its fast scroll.
    const sp = (isHangout(cam.match) ? Math.min(55, cam.h * 0.32 + 14) : cam.h * 0.9 + 25) * dt;
    const f = { x: Math.sin(cam.heading), z: -Math.cos(cam.heading) };
    const r = { x: Math.cos(cam.heading), z: Math.sin(cam.heading) };
    cam.gx += (r.x * vx - f.x * vz) * sp;
    cam.gz += (r.z * vx - f.z * vz) * sp;
    cam.stats.pan += sp * Math.hypot(vx, vz);
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

  // ---------------------------------------------------------------- Hang Out start pose
  function setting(k) { try { return SQ.settings && SQ.settings.get ? SQ.settings.get(k) : undefined; } catch (e) { return undefined; } }
  /** The 45° heading (of a few candidates) that makes the spots' spread across the screen narrowest. */
  function narrowestHeading(spots, cands) {
    let best = cands[0], bw = Infinity;
    for (const h of cands) {
      const rx = Math.cos(h), rz = Math.sin(h);
      let a = Infinity, b = -Infinity;
      for (const sp of spots) { const v = sp.x * rx + sp.z * rz; a = Math.min(a, v); b = Math.max(b, v); }
      if (b - a < bw - 1) { bw = b - a; best = h; }
    }
    return best;
  }
  /**
   * The opening view of a Hang Out match: from your entrance across the park (your side at the bottom of the
   * screen), framed so that all five spots, their signs and your groups are on screen at once (the choice the
   * player has to make). Portrait phones turn 45° so the spots line up along the tall side of the screen.
   */
  function startHangout(m) {
    const s = m.state;
    const side = s.sides[s.player >= 0 ? s.player : 0];
    const e = side && side.entrance ? side.entrance : { x: 0, z: -73 };
    const dx = 0 - e.x, dz = 0 - e.z;
    const step = Math.PI / 4;
    let hd = Math.round(Math.atan2(dx, -dz) / step) * step;
    const sz = SQ.render && SQ.render.size ? SQ.render.size() : { w: 16, h: 10 };
    const W = Math.max(1, sz.w), Hh = Math.max(1, sz.h);
    const portrait = W / Hh < 0.9;
    const k = portrait ? 0.56 : 0.45;
    cam.gx = e.x + dx * k; cam.gz = e.z + dz * k;
    cam.gh = portrait ? 170 : sz.h < 500 ? 118 : 128;
    // keep the current heading's winding so the camera turns the short way
    cam.gheading = cam.heading + angDiff(cam.heading, hd);
    cam.gtilt = 0;
    clampGoal();
    try {
      // spots with room for their signs below (signs and tags slide along the screen edge, so a spot only needs its
      // own circle on screen sideways), and your entrance with room for your groups' name tags above it
      const pts = [];
      for (const sp of s.spots) {
        let r = sp.r || 10;
        if (sp.poly) { r = 0; for (const q of sp.poly) r = Math.max(r, Math.hypot(q[0] - sp.x, q[1] - sp.z)); }
        r *= 0.85;
        pts.push({ x: sp.x, z: sp.z, w: portrait ? 34 : 60, up: 20, down: 0 });
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push({ x: sp.x + ax * r, z: sp.z + az * r, w: 8, up: 10, down: portrait ? 52 : 56 });
      }
      // your three groups stand together at the entrance: room for their three name tags stacked above them
      pts.push({ x: e.x, z: e.z, w: portrait ? 30 : 50, up: 120, down: 12 });
      // the clear part of the screen: below the score, above the cards (and, on phones, the camera buttons), left
      // of the map and camera buttons on wider screens
      const landscapePhone = Hh < 500;
      const rect = portrait ? { left: 8, top: 66, right: W - 8, bottom: Hh - 182 }
        : landscapePhone ? { left: 10, top: 56, right: W - 112, bottom: Hh - 92 }
          : { left: 24, top: 86, right: W - (W >= 900 ? 220 : 170), bottom: Hh - 150 };
      // the straight-across view, unless turning 45° frames everything from much lower (narrow or very wide screens)
      const opts = { rect, minH: 90, dry: true };
      let best = fitScreen(pts, Object.assign({ heading: hd }, opts));
      for (const h2 of [hd - step, hd + step]) {
        const f = fitScreen(pts, Object.assign({ heading: h2 }, opts));
        if (f && (!best || (f.fits && !best.fits) || (f.fits === best.fits && f.h < best.h * 0.86))) best = f;
      }
      if (best) applyFit(best);
    } catch (err) { /* keep the simple pose */ }
    cam.intro = null; cam.inIntro = false;
    cam.edgePan = !!setting('edgePan');
    cam.lastTouch = cam.time;
    cam.stats = { pan: 0, zoom: 0, rot: 0 };
    if (/[?&](nointro|shot)/.test(location.search)) { cam.x = cam.gx; cam.z = cam.gz; cam.h = cam.gh; cam.heading = cam.gheading; cam.tilt = 0; }
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
      if (!m) { cam.intro = null; cam.inIntro = false; cam.edgePan = true; return; }
      if (isHangout(m)) { startHangout(m); return; }
      cam.edgePan = true;
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
    focus, panWorld, panScreen, zoomBy, rotateBy, rotateNow, tiltBy, snapHeading, startIntro, skipIntro, touch, fit, fitScreen,
    get hMax() { return hMax(); },
    setEdgePan(on) { cam.edgePan = !!on; },
    get stats() { return { pan: cam.stats.pan, zoom: cam.stats.zoom, rot: cam.stats.rot }; },
    resetStats() { cam.stats = { pan: 0, zoom: 0, rot: 0 }; },
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
