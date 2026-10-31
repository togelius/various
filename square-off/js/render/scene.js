// SQUARE OFF — Render B: renderer, scene, camera object, quality tiers, dynamic resolution and the
// per-frame entry point SQ.render.frame(state, alpha, realDt). (DESIGN §11.6–11.7)
//
// SQ.render API (all guarded callers in main.js / ui):
//   init(viewEl, {onProgress(p, text), quality})   build renderer + world (SQ.env.build) + units + fx
//   setMatch(match|null)                           hand the match to units/fx
//   frame(state|null, alpha, realDt)               every animation frame
//   screenToGround(clientX, clientY) -> {x,z}|null world point under a screen point (y = ground height)
//   worldToScreen(x, y, z, out?) -> {x, y, behind, onScreen}   client pixels
//   invalidate()                                   request a redraw while paused (render on demand)
//   setQuality('low'|'med'|'high'|'auto')          rebuild the world at a tier (saved in localStorage)
//   setOptions({reducedMotion, colorblind})        juice / readability options
//   navDebug(bool)                                 nav grid overlay (?nav=1)
//   stats() -> {fps, ms, calls, tris, pr, quality}
//   renderer, scene, camera, env, quality, options, ready
(function (SQ) {
  'use strict';
  const R = SQ.render = SQ.render || {};
  const PREF_KEY = 'squareoff.gfx';
  const TIER = {
    low: { pr: 1.0, aa: false, civilians: 20, particles: 0.25, shadows: false },
    med: { pr: 1.25, aa: true, civilians: 40, particles: 0.5, shadows: true },
    high: { pr: 2.0, aa: true, civilians: 100, particles: 1.0, shadows: true },
  };

  function loadPref() { try { const v = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function savePref(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(Object.assign(loadPref(), p))); } catch (e) { /* private mode */ } }

  /** Software GL (SwiftShader, llvmpipe, Microsoft Basic Render) can only carry the low tier. */
  function softwareGL() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    } catch (e) { return false; }
  }
  function guessTier() {
    if (softwareGL()) return 'low';
    const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const cores = navigator.hardwareConcurrency || 4;
    if (touch || small) return cores <= 4 ? 'low' : 'med';
    return 'high';
  }

  function pickQuality(explicit) {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || params.get('quality') || explicit;
    if (q && TIER[q]) return { q, forced: true };
    const pref = loadPref();
    if (pref.quality && TIER[pref.quality]) return { q: pref.quality, forced: true };
    if (pref.recommended && TIER[pref.recommended]) return { q: pref.recommended, forced: false };
    return { q: guessTier(), forced: false };
  }

  const st = {
    view: null, w: 1, h: 1, onProgress: null,
    frameMs: 16, msAcc: 0, msN: 0, slowFor: 0, fastFor: 0, prMax: 1, pr: 1, floorFor: 0, lastStep: 0,
    probe: { t: 0, n: 0, sum: 0, done: false },
    fpsN: 0, fpsT: 0, fps: 0,
    lastRender: 0, dirty: true, match: null,
    navMesh: null, focus: { x: 0, z: 0 },
    tod: 0.12, phase: 'afternoon', idle: 0,
  };
  R.options = { reducedMotion: false, colorblind: false };
  R.ready = false;

  function setting(k) { try { if (SQ.settings && typeof SQ.settings.get === 'function') return SQ.settings.get(k); } catch (e) { /* */ } return undefined; }
  function readOptions() {
    const mq = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rm = setting('reducedMotion'), cb = setting('colorblind');
    R.options.reducedMotion = rm !== undefined ? !!rm : (R.options.reducedMotion || mq);
    R.options.colorblind = cb !== undefined ? !!cb : R.options.colorblind;
  }
  // Okabe–Ito colorblind-safe crew palette (same as the HUD), so 3D and DOM always agree.
  const CB = { hustle: '#0072B2', noise: '#F0E442', violets: '#CC79A7', pack: '#D55E00', squirrels: '#8B6A4E' };
  R.colorOf = function (state, f) {
    const fac = state && state.factions && state.factions[f];
    if (!fac) return '#d9d4c7';
    if (R.options.colorblind && CB[fac.key]) return CB[fac.key];
    return fac.color || '#999999';
  };

  R.init = function (viewEl, opts) {
    opts = opts || {};
    st.view = viewEl || document.getElementById('view') || document.body;
    st.onProgress = opts.onProgress || null;
    readOptions();
    const choice = pickQuality(opts.quality);
    R.quality = choice.q;
    R.qualityForced = choice.forced;
    const T = TIER[R.quality];
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: T.aa, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]shot/.test(location.search) });
    } catch (err) {
      console.error('[render] WebGL unavailable', err);
      const el = document.createElement('div');
      el.className = 'fatal';
      el.textContent = 'SQUARE OFF needs WebGL. Try another browser, or turn on hardware acceleration.';
      document.body.appendChild(el);
      return false;
    }
    R.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x8fb3cf, 1);
    st.view.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('tabindex', '0');
    renderer.domElement.style.touchAction = 'none';

    R.scene = new THREE.Scene();
    R.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2600);
    R.camera.position.set(0, 120, 110);
    R.camera.lookAt(0, 0, 0);
    R.scene.add(R.camera);

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

    buildWorld();
    st.fixedRes = /[?&](shot|nodynres)/.test(location.search);
    R.ready = true;
    if (/[?&]nav=1/.test(location.search)) R.navDebug(true);
    if (SQ.bus) SQ.bus.on('settings', () => {
      const cb = R.options.colorblind;
      readOptions();
      if (SQ.units && SQ.units.setOptions) SQ.units.setOptions(R.options);
      if (cb !== R.options.colorblind && st.match) R.setMatch(st.match); // rebuild colours
      R.invalidate();
    });
    if (SQ.units && SQ.units.setOptions) SQ.units.setOptions(R.options);
    return true;
  };

  function progress(p, text) { if (st.onProgress) try { st.onProgress(p, text); } catch (e) { /* ignore */ } }

  function buildWorld() {
    const T = TIER[R.quality];
    st.prMax = Math.min(window.devicePixelRatio || 1, T.pr);
    st.pr = st.prMax;
    R.renderer.setPixelRatio(st.pr);
    resize();
    progress(0.1, 'Laying 2,800 pavers…');
    R.env = null;
    if (SQ.env && typeof SQ.env.build === 'function') {
      try { R.env = SQ.env.build({ scene: R.scene, renderer: R.renderer, quality: R.quality }); }
      catch (err) { console.error('[render] env.build failed', err); }
    }
    if (!R.env) { // bare fallback so the game is still playable
      R.scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.2));
      const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-80, 160, 60); R.scene.add(sun);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshLambertMaterial({ color: 0x6f8f5a }));
      g.rotation.x = -Math.PI / 2; R.scene.add(g);
    }
    progress(0.75, 'Inviting the regulars…');
    const ctx = { scene: R.scene, renderer: R.renderer, camera: R.camera, quality: R.quality, tier: T, env: R.env };
    if (SQ.units && SQ.units.init) try { SQ.units.init(ctx); } catch (err) { console.error('[render] units.init', err); }
    if (SQ.fx && SQ.fx.init) try { SQ.fx.init(ctx); } catch (err) { console.error('[render] fx.init', err); }
    progress(1, 'Park is open.');
    R.tier = T;
  }

  R.setQuality = function (q) {
    if (q === 'auto') { savePref({ quality: null }); q = guessTier(); R.qualityForced = false; }
    else if (TIER[q]) { savePref({ quality: q }); R.qualityForced = true; }
    else return;
    rebuildAt(q);
  };
  function rebuildAt(q) {
    if (q === R.quality) return;
    R.quality = q;
    if (R.env && R.env.dispose) try { R.env.dispose(); } catch (e) { console.error(e); }
    if (SQ.units && SQ.units.dispose) SQ.units.dispose();
    if (SQ.fx && SQ.fx.dispose) SQ.fx.dispose();
    buildWorld();
    if (st.match) R.setMatch(st.match);
    R.invalidate();
  }

  R.setOptions = function (o) {
    const cb = R.options.colorblind;
    Object.assign(R.options, o || {});
    if (SQ.units && SQ.units.setOptions) SQ.units.setOptions(R.options);
    if (cb !== R.options.colorblind && st.match) R.setMatch(st.match); // crew colours are baked into meshes
    R.invalidate();
  };

  R.setMatch = function (m) {
    st.match = m || null;
    if (SQ.units && SQ.units.setMatch) try { SQ.units.setMatch(m); } catch (err) { console.error('[render] units.setMatch', err); }
    if (SQ.fx && SQ.fx.setMatch) try { SQ.fx.setMatch(m); } catch (err) { console.error('[render] fx.setMatch', err); }
    R.invalidate();
  };

  function resize() {
    if (!R.renderer || !st.view) return;
    const w = st.view.clientWidth || window.innerWidth, h = st.view.clientHeight || window.innerHeight;
    st.w = Math.max(1, w); st.h = Math.max(1, h);
    R.renderer.setSize(st.w, st.h, false);
    R.camera.aspect = st.w / st.h;
    R.camera.updateProjectionMatrix();
    R.invalidate();
  }
  R.resize = resize;
  R.size = function () { return { w: st.w, h: st.h }; };
  R.invalidate = function () { st.dirty = true; };

  // ------------------------------------------------------------------ picking helpers
  const _ray = new THREE.Raycaster();
  const _v2 = new THREE.Vector2();
  const _v3 = new THREE.Vector3();
  R.screenToRay = function (cx, cy) {
    const rect = R.renderer.domElement.getBoundingClientRect();
    _v2.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_v2, R.camera);
    return _ray.ray;
  };
  R.screenToGround = function (cx, cy, planeY) {
    if (!R.renderer) return null;
    const ray = R.screenToRay(cx, cy);
    const d = ray.direction, o = ray.origin;
    const y0 = planeY || 0;
    if (d.y > -1e-4) return null;
    let t = (y0 - o.y) / d.y;
    let x = o.x + d.x * t, z = o.z + d.z * t;
    // refine once against the fountain basin height
    if (R.env && R.env.groundHeightAt && planeY === undefined) {
      const gy = R.env.groundHeightAt(x, z);
      if (gy) { t = (gy - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; }
    }
    return { x, z };
  };
  R.worldToScreen = function (x, y, z, out) {
    out = out || {};
    if (!R.renderer) { out.x = out.y = -9999; out.behind = true; out.onScreen = false; return out; }
    _v3.set(x, y, z).project(R.camera);
    const rect = R.renderer.domElement.getBoundingClientRect();
    out.x = rect.left + (_v3.x + 1) * 0.5 * rect.width;
    out.y = rect.top + (1 - _v3.y) * 0.5 * rect.height;
    out.behind = _v3.z > 1;
    out.onScreen = !out.behind && _v3.x > -1 && _v3.x < 1 && _v3.y > -1 && _v3.y < 1;
    return out;
  };
  R.groundY = function (x, z) { return (R.env && R.env.groundHeightAt) ? R.env.groundHeightAt(x, z) : 0; };
  // Screen pixels per world meter at a world point (for hit radii and glyph sizing).
  R.pxPerMeter = function (x, y, z) {
    const d = R.camera.position.distanceTo(_v3.set(x, y, z));
    return st.h / (2 * Math.tan((R.camera.fov * Math.PI) / 360) * Math.max(1, d));
  };

  // ------------------------------------------------------------------ nav debug overlay (?nav=1)
  R.navDebug = function (on) {
    if (st.navMesh) { R.scene.remove(st.navMesh); st.navMesh.geometry.dispose(); st.navMesh.material.map.dispose(); st.navMesh.material.dispose(); st.navMesh = null; }
    if (!on) return;
    const nav = (SQ.nav && SQ.nav.get && window.GEO) ? SQ.nav.get(window.GEO) : null;
    if (!nav) return;
    const c = document.createElement('canvas');
    c.width = nav.w; c.height = nav.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(nav.w, nav.h);
    for (let i = 0; i < nav.w * nav.h; i++) {
      const v = nav.cost[i];
      let r = 0, g = 0, b = 0, a = 0;
      if (v >= 255) { r = 230; g = 30; b = 40; a = 200; }
      else if (v >= 30) { r = 200; g = 120; b = 220; a = 110; }
      else if (v >= 18) { r = 40; g = 120; b = 255; a = 120; }
      else if (v >= 13) { r = 60; g = 200; b = 60; a = 60; }
      else if (v >= 12) { r = 120; g = 120; b = 120; a = 70; }
      else { r = 250; g = 250; b = 220; a = 40; }
      const k = i * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    // gates
    ctx.fillStyle = '#00ffd0';
    for (const gt of nav.gates || []) ctx.fillRect(Math.floor(gt.x - nav.x0) - 2, Math.floor(gt.z - nav.z0) - 2, 5, 5);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(nav.w, nav.h);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    m.position.set(nav.x0 + nav.w / 2, 0.2, nav.z0 + nav.h / 2);
    m.renderOrder = 50;
    m.frustumCulled = false;
    R.scene.add(m);
    st.navMesh = m;
  };

  // ------------------------------------------------------------------ dynamic resolution
  function perf(realDt) {
    const ms = realDt * 1000;
    if (ms <= 0 || ms > 250) return;
    st.msAcc += ms; st.msN++;
    st.fpsN++; st.fpsT += realDt;
    if (st.fpsT >= 0.5) { st.fps = st.fpsN / st.fpsT; st.fpsN = 0; st.fpsT = 0; }
    if (st.msAcc >= 1000) {
      const avg = st.msAcc / st.msN;
      st.frameMs = avg;
      st.msAcc = 0; st.msN = 0;
      if (document.hidden || st.fixedRes) return;
      if (avg > 20) { st.slowFor++; st.fastFor = 0; } else if (avg < 13) { st.fastFor++; st.slowFor = 0; } else { st.slowFor = 0; st.fastFor = 0; }
      if (st.slowFor >= 2 && st.pr > 0.6) { st.pr = Math.max(0.6, +(st.pr - 0.1).toFixed(2)); R.renderer.setPixelRatio(st.pr); resize(); st.slowFor = 0; }
      else if (st.fastFor >= 5 && st.pr < st.prMax) { st.pr = Math.min(st.prMax, +(st.pr + 0.1).toFixed(2)); R.renderer.setPixelRatio(st.pr); resize(); st.fastFor = 0; }
      // resolution is at its floor and frames are still slow: drop a whole tier (high->med->low)
      if (st.pr <= 0.61 && avg > 40) st.floorFor++; else st.floorFor = 0;
      const now = performance.now();
      if (st.floorFor >= 3 && !R.qualityForced && R.quality !== 'low' && now - st.lastStep > 8000) {
        st.floorFor = 0; st.lastStep = now;
        const next = R.quality === 'high' ? 'med' : 'low';
        savePref({ recommended: next, probeMs: Math.round(avg) });
        rebuildAt(next);
      }
    }
    // 2 s quality probe after load: remember a lower tier for the next visit if this one struggles
    const pb = st.probe;
    if (!pb.done) {
      pb.t += realDt; pb.n++; pb.sum += ms;
      if (pb.t > 3) {
        pb.done = true;
        const avg = pb.sum / pb.n;
        if (!R.qualityForced) {
          let rec = R.quality;
          if (avg > 40) rec = R.quality === 'high' ? 'med' : 'low';
          else if (avg > 26 && R.quality === 'high') rec = 'med';
          savePref({ recommended: rec, probeMs: Math.round(avg) });
        }
      }
    }
  }

  R.stats = function () {
    const inf = R.renderer ? R.renderer.info.render : { calls: 0, triangles: 0 };
    return { fps: Math.round(st.fps), ms: +st.frameMs.toFixed(1), calls: inf.calls, tris: inf.triangles, pr: st.pr, quality: R.quality };
  };

  // ------------------------------------------------------------------ frame
  const PHASE_TOD = { afternoon: [0, 0.333], golden: [0.333, 0.667], night: [0.667, 1] };
  function timeOfDay(state) {
    if (!state) return { tod: 0.42, phase: 'golden' };
    let tod;
    if (isFinite(state.hour)) tod = (state.hour - 16) / 9;
    else tod = state.clock / (state.length || 600);
    tod = Math.max(0, Math.min(0.999, tod));
    const ph = state.phase || 'afternoon';
    const r = PHASE_TOD[ph];
    if (r) tod = Math.max(r[0], Math.min(r[1] - 0.001, tod));
    return { tod, phase: ph };
  }

  const focusPts = [];
  R.frame = function (state, alpha, realDt) {
    if (!R.renderer) return;
    realDt = Math.max(0, Math.min(0.25, realDt || 0));
    perf(realDt);
    const paused = SQ.game && SQ.game.paused;
    const now = performance.now();
    // Render on demand while paused (world animation still ticks at a low rate).
    if (paused && !st.dirty && now - st.lastRender < 125) return;
    st.dirty = false;
    const animDt = paused ? Math.min(realDt, 0.05) : realDt;

    const td = timeOfDay(state);
    st.tod = td.tod; st.phase = td.phase;
    const cam = R.camera;
    // canopy fade focus: screen centre ground point + up to 3 selected units
    focusPts.length = 0;
    const c = R.screenToGround(st.w / 2 + R.renderer.domElement.getBoundingClientRect().left, st.h / 2 + R.renderer.domElement.getBoundingClientRect().top, 0);
    if (c) focusPts.push({ x: c.x, z: c.z });
    if (state && SQ.units && SQ.units.selectedFocus) SQ.units.selectedFocus(state, alpha, focusPts, 3);
    if (R.env) {
      try {
        R.env.canopyFade(cam.position, focusPts);
        R.env.update(animDt, td.tod, td.phase, cam);
      } catch (err) { console.error('[render] env.update', err); R.env = null; }
    }
    if (SQ.units && SQ.units.update) try { SQ.units.update(state, alpha, animDt, cam); } catch (err) { console.error('[render] units.update', err); }
    if (SQ.fx && SQ.fx.update) try { SQ.fx.update(state, alpha, animDt, cam); } catch (err) { console.error('[render] fx.update', err); }
    R.renderer.render(R.scene, cam);
    st.lastRender = now;
  };

  R.timeOfDay = function () { return { tod: st.tod, phase: st.phase }; };
})(window.SQ = window.SQ || {});
