// SQUARE OFF — Render A: lights, sky dome, fog, time-of-day keyframes (4 PM → 1 AM), shadow fitting,
// and the world entry point SQ.env.build({scene, renderer, quality}).
(function (SQ) {
  'use strict';
  var env = SQ.env = SQ.env || {};
  var U = env.util = env.util || {};
  var S = env.sky = env.sky || {};

  // Keyframes in "lighting time" (0 = 4 PM, 1 = 1 AM). Azimuth: degrees clockwise from true north.
  var K = S.KEYS = [
    { t: 0.00, az: 238, el: 44, sun: 0xfff0dc, si: 2.9, top: 0x4f86cf, hor: 0xc4d6e6, gnd: 0x9a9890, hs: 0xbfd3ea, hg: 0x6e6856, hi: 1.25, fog: 0xc6d4e0, fd: 0.0004, n: 0, haze: 0xc2cfdc, shade: 0x8e9aab, sat: 0.88 },
    { t: 0.18, az: 258, el: 32, sun: 0xffe9c9, si: 2.8, top: 0x5487cb, hor: 0xcfd8de, gnd: 0x9a9488, hs: 0xc4d0e2, hg: 0x6e6450, hi: 1.15, fog: 0xccd3d8, fd: 0.0004, n: 0, haze: 0xc8cfd6, shade: 0x8f98a6, sat: 0.88 },
    { t: 0.333, az: 276, el: 16, sun: 0xffd296, si: 2.9, top: 0x5b84c0, hor: 0xf3d6ac, gnd: 0x8f806c, hs: 0xd8d0c8, hg: 0x76624c, hi: 1.25, fog: 0xe2cdb0, fd: 0.0004, n: 0, haze: 0xe8cdaa, shade: 0x9a8f90, sat: 0.9 },
    { t: 0.47, az: 286, el: 7, sun: 0xffad62, si: 2.7, top: 0x5a78b0, hor: 0xffc286, gnd: 0x7a6250, hs: 0xd2bcb2, hg: 0x664e3c, hi: 1.1, fog: 0xdcae8a, fd: 0.0004, n: 0.04, haze: 0xf3c49a, shade: 0x9a8486, sat: 0.92 },
    { t: 0.56, az: 293, el: 2.0, sun: 0xff8048, si: 1.7, top: 0x3a4e84, hor: 0xeb9670, gnd: 0x4a3c3c, hs: 0x9a90b0, hg: 0x443848, hi: 0.85, fog: 0x9a8090, fd: 0.0004, n: 0.3, haze: 0xb07a7e, shade: 0x5e5670, sat: 0.92 },
    { t: 0.62, az: 296, el: -3, sun: 0x8090c8, si: 0.6, top: 0x1a2550, hor: 0x5a5478, gnd: 0x2a2632, hs: 0x52609a, hg: 0x26222e, hi: 0.6, fog: 0x3c3e58, fd: 0.0004, n: 0.75, haze: 0x4a4a66, shade: 0x2e3048, sat: 0.9 },
    { t: 0.70, az: 150, el: 38, sun: 0xa4bcff, si: 0.9, top: 0x0b1430, hor: 0x2c3a5a, gnd: 0x141620, hs: 0x4a5e92, hg: 0x22222c, hi: 0.62, fog: 0x1d2538, fd: 0.0004, n: 1, haze: 0x2a3550, shade: 0x1a2236, sat: 0.9 },
    { t: 1.00, az: 175, el: 46, sun: 0x9ab4ff, si: 0.85, top: 0x080f26, hor: 0x26304c, gnd: 0x101218, hs: 0x44578a, hg: 0x1e1e28, hi: 0.58, fog: 0x182032, fd: 0.0004, n: 1, haze: 0x222c44, shade: 0x161c2e, sat: 0.9 }
  ];
  var PHASES = { afternoon: [0, 0.333], golden: [0.333, 0.667], night: [0.667, 1] };
  function phaseKey(p) {
    if (p === undefined || p === null) return null;
    if (typeof p === 'number') return ['afternoon', 'golden', 'night'][p] || null;
    var s = String(p).toLowerCase();
    if (s.indexOf('night') >= 0) return 'night';
    if (s.indexOf('gold') >= 0) return 'golden';
    if (s.indexOf('after') >= 0 || s.indexOf('day') >= 0) return 'afternoon';
    return null;
  }
  // true north → local frame (GEO rotation −32.67°)
  function azElToLocal(az, el, out) {
    var rot = (GEO.rotationDeg || -32.67) * Math.PI / 180, C = Math.cos(rot), Sn = Math.sin(rot);
    var a = az * Math.PI / 180, e = el * Math.PI / 180;
    var east = Math.sin(a) * Math.cos(e), north = Math.cos(a) * Math.cos(e);
    var rx = east, ry = -north; // raw frame (x east, z south)
    return out.set(rx * C - ry * Sn, Math.sin(e), rx * Sn + ry * C).normalize();
  }
  S.azElToLocal = azElToLocal;

  var tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function lerpKey(t) {
    t = U.clamp(t, 0, 1);
    var i = 1; while (i < K.length - 1 && K[i].t < t) i++;
    var a = K[i - 1], b = K[i], f = U.clamp((t - a.t) / (b.t - a.t), 0, 1);
    f = f * f * (3 - 2 * f);
    var o = { f: f, a: a, b: b };
    ['si', 'hi', 'fd', 'n', 'el', 'sat'].forEach(function (k) { o[k] = U.lerp(a[k], b[k], f); });
    ['sun', 'top', 'hor', 'gnd', 'hs', 'hg', 'fog', 'haze', 'shade'].forEach(function (k) { o[k] = tmpA.set(a[k]).lerp(tmpB.set(b[k]), f).getHex(); });
    return o;
  }
  S.lerpKey = lerpKey;

  // ------------------------------------------------------------ sky dome
  function skyDome(q) {
    var uni = {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: env.U.uNight, uSunVis: { value: 1 }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uni, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: [
        'uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uGnd; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uMoonDir; uniform float uNight; uniform float uSunVis; varying vec3 vDir;',
        'float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
        'void main(){ vec3 d = normalize(vDir); float h = d.y;',
        '  vec3 c = h > 0.0 ? mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHor, uGnd, clamp(-h * 6.0, 0.0, 1.0));',
        '  float s = max(dot(d, normalize(uSunDir)), 0.0);',
        '  c += uSunCol * (pow(s, 6.0) * 0.28 + pow(s, 64.0) * 0.5) * uSunVis;',
        '  c += uSunCol * smoothstep(0.9993, 0.9997, s) * 6.0 * uSunVis * step(-0.02, uSunDir.y);',
        '  // horizon glow band',
        '  c += uHor * 0.18 * exp(-abs(h) * 18.0);',
        '  if (uNight > 0.01 && h > 0.0) {',
        '    vec3 g = floor(d * 380.0); float st = h3(g); float tw = 0.6 + 0.4 * sin(st * 90.0);',
        '    c += vec3(0.9, 0.92, 1.0) * step(0.9985, st) * tw * uNight * smoothstep(0.05, 0.3, h) * 1.4;',
        '    float m = max(dot(d, normalize(uMoonDir)), 0.0);',
        '    c += vec3(0.95, 0.96, 1.0) * smoothstep(0.99955, 0.99975, m) * 2.2 * uNight + vec3(0.25, 0.3, 0.45) * pow(m, 40.0) * 0.4 * uNight;',
        '  }',
        '  gl_FragColor = vec4(c, 1.0);',
        '  #include <tonemapping_fragment>', '  #include <colorspace_fragment>',
        '}'
      ].join('\n')
    });
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    mesh.name = 'skyDome'; mesh.renderOrder = -10; mesh.frustumCulled = false;
    mesh.onBeforeRender = function (renderer, scene, camera) {
      mesh.position.copy(camera.position);
      var r = (camera.far || 2000) * 0.9; mesh.scale.setScalar(r); mesh.updateMatrixWorld();
      S._lastCamera = camera;
    };
    return { mesh: mesh, uni: uni };
  }

  // ------------------------------------------------------------ the world entry point
  env.build = function (opts) {
    opts = opts || {};
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var q = opts.quality === 'phone' ? 'med' : (opts.quality === 'low' || opts.quality === 'med' || opts.quality === 'high') ? opts.quality : 'med';
    var scene = opts.scene, renderer = opts.renderer;
    env.quality = q;
    env.maxAniso = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 4;
    U.initUniforms();
    env.U.uTime.value = 0; env.U.uNight.value = 0; env.U.uLampWave.value = 0;
    if (renderer && renderer.shadowMap && q !== 'low') { renderer.shadowMap.enabled = true; renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; }

    var root = new THREE.Group(); root.name = 'environment';
    var timings = {}, mark = function (k, s) { timings[k] = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - s); };
    var s1 = performance.now(); var props = env.props.build({ quality: q }); mark('props', s1); // props first: bench layout feeds the ground AO
    s1 = performance.now(); var landmarks = env.landmarks.build({ quality: q }); mark('landmarks', s1);
    s1 = performance.now(); var ground = env.ground.build({ quality: q }); mark('ground', s1);
    s1 = performance.now(); var buildings = env.buildings.build({ quality: q }); mark('buildings', s1);
    root.add(ground.group, buildings.group, landmarks.group, props.group);

    // lights
    var hemi = new THREE.HemisphereLight(0xbfd3ea, 0x6e6856, 1.2); hemi.name = 'hemi';
    var sun = new THREE.DirectionalLight(0xffffff, 2.8); sun.name = 'sun';
    sun.castShadow = q !== 'low';
    if (sun.castShadow) {
      var ms = q === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(ms, ms);
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = q === 'high' ? 0.04 : 0.06;
      var sc = sun.shadow.camera; sc.near = 1; sc.far = 700; sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.updateProjectionMatrix();
      if (q === 'med') sun.shadow.autoUpdate = false;
    }
    root.add(hemi, sun, sun.target);
    var dome = skyDome(q); root.add(dome.mesh);
    var prevFog = scene ? scene.fog : null, prevBg = scene ? scene.background : null;
    var fog = new THREE.FogExp2(0xc6d4e0, 0.0004);
    if (scene) { scene.fog = fog; scene.background = new THREE.Color(0xc6d4e0); scene.add(root); }
    env.landmarkAnchors = landmarks.anchors;
    env.sunLight = sun; env.hemiLight = hemi; env.root = root;
    timings.total = Math.round(performance.now() - t0);
    env.buildTimings = timings;

    // state
    var st = { lt: 0, target: 0, forceNight: null, frame: 0, focus: new THREE.Vector3(0, 0, 0), camPos: new THREE.Vector3(0, 150, 150), wave: 0, sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), initialized: false };
    var FU = env.landmarks.fountainUniforms, SKU = env.landmarks.skylineUniforms;
    var col = new THREE.Color();

    function applyLighting(dt) {
      var k = lerpKey(st.lt);
      var nightMix = U.smooth(0.58, 0.68, st.lt); // 0 = sun, 1 = moon
      azElToLocal(U.lerp(k.a.az, k.b.az, k.f), Math.max(k.el, 1.5), st.sunDir);
      azElToLocal(160, 40, st.moonDir);
      var dir = st.sunDir.clone().lerp(st.moonDir, nightMix).normalize();
      sun.color.setHex(k.sun); sun.intensity = k.si;
      hemi.color.setHex(k.hs); hemi.groundColor.setHex(k.hg); hemi.intensity = k.hi;
      fog.color.setHex(k.fog); fog.density = k.fd;
      if (scene && scene.background && scene.background.isColor) scene.background.setHex(k.fog);
      dome.uni.uTop.value.setHex(k.top); dome.uni.uHor.value.setHex(k.hor); dome.uni.uGnd.value.setHex(k.gnd);
      dome.uni.uSunDir.value.copy(azElToLocal(U.lerp(k.a.az, k.b.az, k.f), k.el, new THREE.Vector3()));
      dome.uni.uSunCol.value.setHex(k.sun); dome.uni.uSunVis.value = 1 - nightMix;
      dome.uni.uMoonDir.value.copy(st.moonDir);
      // night value (forced or keyed)
      var n = st.forceNight === true ? Math.max(k.n, 1) : st.forceNight === false ? 0 : k.n;
      var U2 = env.U;
      U2.uNight.value += (n - U2.uNight.value) * Math.min(1, dt / 1.2);
      U2.uSat.value = k.sat;
      env.landmarks.uFlood.value = U.smooth(0.3, 0.9, U2.uNight.value);
      // lamps: a wave outward from the Arch once it gets dark (≈6 s to reach the whole park)
      if (U2.uNight.value > 0.22) st.wave = Math.min(420, st.wave + dt * 60);
      else st.wave = Math.max(0, st.wave - dt * 120);
      U2.uLampWave.value = st.wave;
      // fountain & skyline tints
      if (FU) {
        FU.uSkyTop.value.setHex(k.top); FU.uSkyHor.value.setHex(k.hor); FU.uSunDir.value.copy(dome.uni.uSunDir.value); FU.uSunCol.value.setHex(k.sun);
        col.setHex(k.hs).multiplyScalar(0.55).add(tmpA.setHex(k.sun).multiplyScalar(0.45 * (1 - nightMix)));
        FU.uLightCol.value.copy(col);
      }
      if (SKU) { SKU.uHaze.value.setHex(k.haze); SKU.uShade.value.setHex(k.shade); }
      // sun light placement & shadow fitting around the focus point
      var center = st.focus, camH = Math.max(20, st.camPos.y);
      var half = U.clamp(camH * 0.85 + 20, 50, 130);
      if (sun.castShadow) {
        var sc = sun.shadow.camera;
        if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
        // texel snapping to avoid shimmering
        var texel = (2 * half) / sun.shadow.mapSize.x;
        var cx = Math.round(center.x / texel) * texel, cz = Math.round(center.z / texel) * texel;
        sun.target.position.set(cx, 0, cz);
        sun.position.set(cx + dir.x * 300, dir.y * 300, cz + dir.z * 300);
        if (q === 'med') { st.frame++; if (st.frame % 2 === 0) sun.shadow.needsUpdate = true; }
      } else {
        sun.target.position.set(center.x, 0, center.z);
        sun.position.set(center.x + dir.x * 300, dir.y * 300, center.z + dir.z * 300);
      }
      sun.target.updateMatrixWorld();
    }

    var api = {
      group: root, quality: q, timings: timings,
      bounds: { minX: -162, maxX: 135, minZ: -72, maxZ: 73, park: { x0: -162, x1: 135, z0: -72, z1: 73 }, world: { x0: -260, x1: 260, z0: -180, z1: 180 } },
      anchors: landmarks.anchors,
      uniforms: env.U,
      sun: sun, hemi: hemi,
      groundHeightAt: function (x, z) { return env.ground.heightAt(x, z); },
      // dt seconds; timeOfDay 0..1 over 4 PM→1 AM; phase 'afternoon'|'golden'|'night' (or 0/1/2); camera optional
      update: function (dt, timeOfDay, phase, camera) {
        dt = Math.min(Math.max(dt || 0, 0), 0.25);
        env.U.uTime.value += dt;
        var t = typeof timeOfDay === 'number' ? U.clamp(timeOfDay, 0, 1) : st.target;
        var pk = phaseKey(phase);
        if (pk) { var r = PHASES[pk]; t = U.clamp(t, r[0], r[1] - 0.0001); }
        if (st.forceNight === true) t = Math.max(t, 0.7);
        if (st.forceNight === false) t = Math.min(t, 0.5);
        st.target = t;
        if (!st.initialized) { st.lt = t; env.U.uNight.value = lerpKey(t).n; st.initialized = true; }
        // phase jumps ease over ~6 s; normal clock motion is followed directly
        var gap = st.target - st.lt;
        if (Math.abs(gap) > 0.01) st.lt += gap * Math.min(1, dt / 1.6); else st.lt = st.target;
        if (camera && camera.position) {
          st.camPos.copy(camera.position);
          if (!st.focusSet) { // estimate the ground point at screen centre
            var dv = new THREE.Vector3(); camera.getWorldDirection(dv);
            if (dv.y < -0.05) { var k2 = -camera.position.y / dv.y; st.focus.set(camera.position.x + dv.x * k2, 0, camera.position.z + dv.z * k2); }
          }
        } else if (S._lastCamera) st.camPos.copy(S._lastCamera.position);
        st.focusSet = false;
        applyLighting(dt);
        props.update(dt);
      },
      setNight: function (on) { st.forceNight = on === true ? true : on === false ? false : null; },
      // cameraPos: Vector3/{x,y,z}; focusPoints: [{x,z,(r)}...] — first = screen-centre ground point, rest = selected units
      canopyFade: function (cameraPos, focusPoints) {
        var u = env.U, pts = u.uCanopyPts.value, fp = focusPoints || [];
        if (cameraPos) { u.uFadeCam.value.set(cameraPos.x, cameraPos.y, cameraPos.z); st.camPos.set(cameraPos.x, cameraPos.y, cameraPos.z); }
        var camH = cameraPos ? cameraPos.y : 200;
        for (var i = 0; i < 4; i++) {
          var p = fp[i];
          if (!p) { pts[i].set(0, 0, 0, 0); continue; }
          var r = p.r || (i === 0 ? 25 * (1 - U.smooth(105, 130, camH)) : 9);
          pts[i].set(p.x, 0, p.z, r);
        }
        u.uCanopyAmt.value = 0.7;
        if (fp[0]) {
          st.focus.set(fp[0].x, 0, fp[0].z); st.focusSet = true;
          u.uFadeFocus.value.set(fp[0].x, (fp[0].y || 0) + 1.5, fp[0].z);
          u.uFadeAmt.value = 1; u.uFadeR.value = 9 + Math.min(14, camH * 0.06);
        } else u.uFadeAmt.value = 0;
      },
      setWind: function (w) { env.U.uWind.value = w; },
      dispose: function () {
        if (scene) { scene.remove(root); scene.fog = prevFog; scene.background = prevBg; }
        [ground, buildings, landmarks, props].forEach(function (m) { if (m && m.dispose) m.dispose(); });
        dome.mesh.geometry.dispose(); dome.mesh.material.dispose();
        if (sun.shadow && sun.shadow.map) sun.shadow.map.dispose();
      },
      parts: { ground: ground, buildings: buildings, landmarks: landmarks, props: props, dome: dome }
    };
    api.update(0, 0, 'afternoon');
    st.initialized = false;
    env.api = api;
    return api;
  };
})(window.SQ = window.SQ || {});
