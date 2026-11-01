// SQUARE OFF — Render: the "Hang Out" view (DESIGN-V2.md), drawn on the detailed park.
// Everything the new default mode shows in the 3D world, built so the state reads at a glance:
//   - groups: a cluster of 4-6 crew-styled people (the classic character meshes from js/render/units.js,
//     instanced), ONE crew-coloured ring (solid = yours, dashed = theirs), a big name tag that also says
//     what the group is doing in plain words ("walking to Fountain", "settling in…", "hanging out",
//     "arguing!", "standing around"), and a short patience bar right above the heads;
//   - spots: a big bounded area on the ground (neutral dashed chalk ring when empty, a soft crew-coloured
//     fill + solid ring when held, chevrons in a crew's colour when its group is on the way, a two-colour
//     barber pole while arguing), the name on a park sign hanging below the spot's near edge (always readable,
//     never fighting the name tags); with a group selected every sign also shows its walking time ("12 s walk");
//   - settling in IS its progress indicator: the crew's camp unfolds (Hustle: chairs, card table, board;
//     Noise: guitar case, buckets, amp; Violets: blanket, backpacks, pennant; Pack: dog bed, bowl, ball,
//     then the dogs come off the leash) while the group's own ring and the spot's outline fill clockwise;
//   - earning: a calm "+1" in crew colour rises beside the group that earns it every second, its ring glows
//     and the spot's fill pulses (an established holder visibly keeps earning while argued with);
//   - arguing: "!", "?!", "#@!" fly between the groups, patience bars drain, people gesture, then check
//     their watches, sweat, and pack the camp up as patience runs out;
//   - going for coffee: the group throws its hands up (punchline bubble), walks off toward its home
//     entrance and fades; a little cup with "back in 0:12" waits at the entrance; returning groups fade
//     in there with a "back!" pop;
//   - selection (white pulsing ring, bouncing arrow, walking times on every spot label), destination
//     path + marker, order ripples, tutorial highlights, hover.
// Classic overlays (capture rings, glyph billboards, Setup pads, landmark labels) are not drawn in this
// mode: scene.js hands units/fx a null match while a Hang Out match is attached.
//
// SQ.hangoutView API (render only; reads match.state, never changes it):
//   attach({scene, camera, match})   detach()   attached (bool)
//   update(state, alpha, dt, camera?)        called by SQ.render.frame while attached (safe to call yourself;
//                                            a second call in the same render frame is ignored)
//   select(groupId | -1)   selected        the UI's current selection (drives highlight + walking times)
//   hover(target | null)                    desktop pointer-over: {group: id} | {spot: idx} | null
//   highlight(target | [targets] | null)    tutorial pointer: spot id (string) | {spot: idx} | {group: id} | {entrance: side}
//   screenPos(target) -> {x, y, onScreen, behind, tagX, tagY[, tagTop, coffee]}   client px; target: group id
//                                            (number), spot id (string), {group}, {spot}, {entrance: side}.
//                                            Groups: x,y = the people, tagX/tagY = name tag centre. Spots: x,y = centre,
//                                            tagX/tagY = the spot sign's centre. A group on coffee -> its entrance.
//   pick(clientX, clientY, {side, touch})   -> {type:'group', id, side} | {type:'spot', idx, id} | {type:'ground', x, z} | null
//   worldPos(target) -> {x, y, z}
//   say(groupId, text, {life, priority})     show a speech bubble over a group (the UI may route lines here)
//   statusText(group, state) -> 'hanging out' | ...   the plain-English words used on the tags
//   timeOfDay(state) -> {tod, phase}         afternoon → golden hour over the 5:00 (the light is the timer)
//   focus(out, max)                          canopy fade points (selected group, wooded spots on screen)
//   options = { maxBubbles: 1, labels: true, tags: true, paths: true, floaters: true, uiScale: 1 }
//   stats() -> counts for tests
(function (SQ) {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const HV = SQ.hangoutView = SQ.hangoutView || {};
  const TAU = Math.PI * 2;
  const ANIM = { IDLE: 0, WALK: 1, ATTACK: 2, OVERIT: 3, SIT: 4, FLINCH: 5, CHEER: 6 };
  const CLS = ['heavy', 'talker', 'crowd'];      // group slot -> character model (Old Heads = the heavy, ...)
  const CB = { hustle: '#0072B2', noise: '#F0E442', violets: '#CC79A7', pack: '#D55E00' }; // Okabe-Ito (HUD)
  const F_DISP = '"Barlow Condensed", "Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
  const F_BODY = '"Barlow", "Avenir Next", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
  const MAX_SPOTS = 8;
  const PEOPLE = 1.5;          // = SQ.units.SCALE (diorama people)
  const SPACING = 1.25;        // formation offsets from the sim are tight; spread them for 1.5x people
  const CAMP = 2.0;            // camp props scale (diorama: bigger than life so it reads from the RTS camera)
  const SIGN = { bg: 'rgba(15,61,44,0.9)', line: 'rgba(244,238,223,0.75)', ink: '#f4eedf', chalk: '#ffe46b' };

  HV.options = Object.assign({ maxBubbles: 1, labels: true, tags: true, paths: true, floaters: true, uiScale: 1 }, HV.options || {});
  HV.attached = false;
  HV.selected = -1;

  // ================================================================== helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function backOut(t) { t = clamp(t, 0, 1); const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function hexRgb(hex) {
    let h = String(hex || '#888888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function luma(rgb) { return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; }
  function rgbCss(rgb, a) { return 'rgba(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ',' + (a === undefined ? 1 : a) + ')'; }
  function shadeRgb(rgb, k) { return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; }
  function linRgb(rgb) { return rgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); }
  function gy(x, z) { return SQ.render && SQ.render.groundY ? SQ.render.groundY(x, z) : 0; }
  function reduced() { return !!(SQ.render && SQ.render.options && SQ.render.options.reducedMotion); }
  function colorblind() { return !!(SQ.render && SQ.render.options && SQ.render.options.colorblind); }
  function lib() { return SQ.units && SQ.units.lib; }
  function hrand(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fitText(ctx, text, maxW, weight, size, family, minSize) {
    let s = size;
    ctx.font = weight + ' ' + s + 'px ' + family;
    while (ctx.measureText(text).width > maxW && s > (minSize || 10)) { s -= 1; ctx.font = weight + ' ' + s + 'px ' + family; }
    return s;
  }
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,!?]*$/, '') + '…'; }
    return lines;
  }

  // ================================================================== module state
  const V = {
    attached: false, scene: null, camera: null, match: null, state: null, root: null,
    sides: [], spots: [], groups: [], pools: {}, campPools: {}, dogPool: null,
    atlas: null, parts: null, bars: null, rings: null, spotFill: null, spotLine: null, spotU: null,
    time: 0, frameNo: -1, lastT: -1, earnSec: -1, over: false,
    sel: -1, hover: null, highlights: [], bubbles: [], coffeeTags: [],
    uPx: { value: 0.002 }, uTime: { value: 0 }, uW: { value: 1 },
    view: { w: 1, h: 1, left: 0, top: 0, camY: 120, zoomK: 1, spK: 1, uiK: 1, fwdX: 0, fwdZ: -1, upX: 0, upY: 1, upZ: 0 },
    treeGrid: null, fontsReady: false, etaT: -1, eta: [],
  };
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3();

  function compose(x, y, z, yaw, sx, sy, sz, pitch, roll) {
    _e.set(pitch || 0, yaw, roll || 0, 'YXZ'); _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(sx, sy, sz);
    return _m.compose(_p, _q, _s);
  }

  // ================================================================== icon atlas (one draw call for all icons)
  const ICON = { plus1: 0, bang: 1, what: 2, swear: 3, anger: 4, clock: 5, cup: 6, sweat: 7, dots: 8, note1: 9, note2: 10, knight: 11,
    woof: 12, lol: 13, heart: 14, spark: 15, back: 16, zzz: 17, yip: 18, check: 19, ugh: 20, arrow: 21, dot: 22, hmph: 23, phone: 24, ball: 25 };
  const ATLAS_COLS = 8, ATLAS_ROWS = 4;
  function buildAtlas() {
    const S = 128;
    const c = document.createElement('canvas'); c.width = S * ATLAS_COLS; c.height = S * ATLAS_ROWS;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const cell = (i) => [(i % ATLAS_COLS) * S + S / 2, Math.floor(i / ATLAS_COLS) * S + S / 2];
    function text(i, s, size, font) {
      const [cx, cy] = cell(i);
      ctx.font = '800 ' + size + 'px ' + (font || F_DISP);
      let w = ctx.measureText(s).width, sz = size;
      while (w > S - 22 && sz > 20) { sz -= 2; ctx.font = '800 ' + sz + 'px ' + (font || F_DISP); w = ctx.measureText(s).width; }
      ctx.lineWidth = Math.max(9, sz * 0.2); ctx.strokeStyle = '#000'; ctx.strokeText(s, cx, cy + 4);
      ctx.fillStyle = '#fff'; ctx.fillText(s, cx, cy + 4);
    }
    function stroked(fn, lw) { ctx.lineWidth = lw || 12; ctx.strokeStyle = '#000'; fn(); ctx.stroke(); ctx.fillStyle = '#fff'; fn(); ctx.fill(); }
    text(ICON.plus1, '+1', 84);
    text(ICON.bang, '!', 96);
    text(ICON.what, '?!', 88);
    text(ICON.swear, '#@!', 70);
    text(ICON.dots, '…', 90);
    text(ICON.note1, '♪', 90, 'serif');
    text(ICON.note2, '♫', 90, 'serif');
    text(ICON.knight, '♞', 92, 'serif');
    text(ICON.woof, 'woof', 54);
    text(ICON.lol, 'lol', 64);
    text(ICON.back, 'back!', 56);
    text(ICON.zzz, 'zzz', 60);
    text(ICON.yip, 'yip!', 58);
    text(ICON.check, 'check!', 46);
    text(ICON.ugh, 'ugh', 64);
    text(ICON.hmph, 'hmph', 54);
    // anger mark (the comic "vein" cross)
    (function () {
      const [cx, cy] = cell(ICON.anger);
      const arcs = () => {
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4;
          const ox = cx + Math.cos(a) * 26, oy = cy + Math.sin(a) * 26;
          ctx.moveTo(ox + Math.cos(a + 1.2) * 22, oy + Math.sin(a + 1.2) * 22);
          ctx.quadraticCurveTo(ox - Math.cos(a) * 14, oy - Math.sin(a) * 14, ox + Math.cos(a - 1.2) * 22, oy + Math.sin(a - 1.2) * 22);
        }
      };
      ctx.lineWidth = 24; ctx.strokeStyle = '#000'; arcs(); ctx.stroke();
      ctx.lineWidth = 11; ctx.strokeStyle = '#fff'; arcs(); ctx.stroke();
    })();
    // wrist watch: strap + face + hands
    (function () {
      const [cx, cy] = cell(ICON.clock);
      ctx.fillStyle = '#000'; roundRect(ctx, cx - 20, cy - 56, 40, 112, 12); ctx.fill();
      ctx.fillStyle = '#fff'; roundRect(ctx, cx - 13, cy - 50, 26, 100, 8); ctx.fill();
      stroked(() => { ctx.beginPath(); ctx.arc(cx, cy, 36, 0, TAU); }, 14);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 24); ctx.moveTo(cx, cy); ctx.lineTo(cx + 18, cy + 6); ctx.stroke();
    })();
    // coffee cup with steam
    (function () {
      const [cx, cy] = cell(ICON.cup);
      const cup = () => { ctx.beginPath(); ctx.moveTo(cx - 32, cy - 10); ctx.lineTo(cx + 26, cy - 10); ctx.lineTo(cx + 18, cy + 40); ctx.lineTo(cx - 24, cy + 40); ctx.closePath(); };
      ctx.lineWidth = 12; ctx.strokeStyle = '#000';
      ctx.beginPath(); ctx.arc(cx + 30, cy + 10, 14, -1.4, 1.4); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 30, cy + 10, 14, -1.4, 1.4); ctx.stroke();
      stroked(cup, 12);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 30, cy - 4, 54, 7);
      ctx.lineWidth = 12; ctx.strokeStyle = '#000';
      const steam = () => { ctx.beginPath(); for (const ox of [-14, 6]) { ctx.moveTo(cx + ox, cy - 20); ctx.bezierCurveTo(cx + ox - 12, cy - 34, cx + ox + 12, cy - 44, cx + ox, cy - 58); } };
      steam(); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; steam(); ctx.stroke();
    })();
    // sweat drop
    (function () {
      const [cx, cy] = cell(ICON.sweat);
      stroked(() => { ctx.beginPath(); ctx.moveTo(cx, cy - 44); ctx.bezierCurveTo(cx + 34, cy, cx + 30, cy + 40, cx, cy + 40); ctx.bezierCurveTo(cx - 30, cy + 40, cx - 34, cy, cx, cy - 44); }, 12);
    })();
    // heart
    (function () {
      const [cx, cy] = cell(ICON.heart);
      stroked(() => { ctx.beginPath(); ctx.moveTo(cx, cy + 38); ctx.bezierCurveTo(cx - 60, cy - 2, cx - 26, cy - 52, cx, cy - 20); ctx.bezierCurveTo(cx + 26, cy - 52, cx + 60, cy - 2, cx, cy + 38); }, 12);
    })();
    // sparkle (4-point star)
    (function () {
      const [cx, cy] = cell(ICON.spark);
      stroked(() => { ctx.beginPath(); ctx.moveTo(cx, cy - 46); ctx.quadraticCurveTo(cx + 6, cy - 6, cx + 46, cy); ctx.quadraticCurveTo(cx + 6, cy + 6, cx, cy + 46); ctx.quadraticCurveTo(cx - 6, cy + 6, cx - 46, cy); ctx.quadraticCurveTo(cx - 6, cy - 6, cx, cy - 46); }, 10);
    })();
    // down arrow (selection / tutorial pointer)
    (function () {
      const [cx, cy] = cell(ICON.arrow);
      stroked(() => { ctx.beginPath(); ctx.moveTo(cx - 40, cy - 30); ctx.lineTo(cx + 40, cy - 30); ctx.lineTo(cx, cy + 36); ctx.closePath(); }, 14);
    })();
    // soft dot (dust, glow)
    (function () {
      const [cx, cy] = cell(ICON.dot);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 56);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - 60, cy - 60, 120, 120);
    })();
    // phone (Violets)
    (function () {
      const [cx, cy] = cell(ICON.phone);
      stroked(() => { roundRect(ctx, cx - 22, cy - 40, 44, 80, 9); }, 12);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 14, cy - 30, 28, 52);
    })();
    // ball (Pack)
    (function () {
      const [cx, cy] = cell(ICON.ball);
      stroked(() => { ctx.beginPath(); ctx.arc(cx, cy, 32, 0, TAU); }, 12);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx - 34, cy, 26, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 34, cy, 26, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    })();
    const tex = new THREE.CanvasTexture(c);
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  // ================================================================== billboard icons (+1, !, ?!, watch, cup, notes, ...)
  function makeParticles(cap) {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const iP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const iC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const iT = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    for (const a of [iP, iC, iT]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', iP); g.setAttribute('iC', iC); g.setAttribute('iT', iT);
    g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: V.atlas }, uPx: V.uPx },
      vertexShader: `
attribute vec4 iP; attribute vec4 iC; attribute vec4 iT;
uniform float uPx;
varying vec2 vUv; varying vec4 vC; varying float vTint;
void main(){
  vC = iC; vTint = iT.z;
  float cols = ${ATLAS_COLS.toFixed(1)}, rows = ${ATLAS_ROWS.toFixed(1)};
  vec2 cr = vec2(mod(iT.x, cols), floor(iT.x / cols + 0.001));
  vUv = vec2((cr.x + uv.x) / cols, 1.0 - (cr.y + 1.0 - uv.y) / rows);
  vec4 c = modelViewMatrix * vec4(iP.xyz, 1.0);
  float sz = uPx * iP.w * max(0.5, -c.z);
  float ca = cos(iT.y), sa = sin(iT.y);
  vec2 p = vec2(position.x * ca - position.y * sa, position.x * sa + position.y * ca);
  c.xy += p * sz;
  gl_Position = projectionMatrix * c;
}`,
      fragmentShader: `
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec4 vC; varying float vTint;
void main(){
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vC.a;
  if (a < 0.02) discard;
  vec3 fillCol = mix(vec3(1.0), vC.rgb, vTint);
  vec3 col = mix(vec3(0.05, 0.06, 0.07), fillCol, clamp(t.r * 1.15, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
}`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 44;
    return { mesh, g, iP, iC, iT, cap, list: [] };
  }
  // o: {x,y,z, vx,vy,vz, grav, life, size, rgb, tint, cell, rot, spin, arc:{x0,y0,z0,x1,y1,z1,h}, pop, fadeIn, wob, follow}
  function emit(o) {
    const P = V.parts; if (!P) return null;
    if (P.list.length >= P.cap) P.list.shift();
    const p = Object.assign({ t: 0, vx: 0, vy: 0, vz: 0, grav: 0, life: 1, size: 20, rgb: [1, 1, 1], tint: 1, rot: 0, spin: 0, alpha: 1 }, o);
    P.list.push(p);
    return p;
  }
  function updateParticles(dt) {
    const P = V.parts; if (!P) return;
    let n = 0;
    const A = P.iP.array, C = P.iC.array, T = P.iT.array;
    const keep = [];
    for (const p of P.list) {
      let x, y, z, size = p.size, a = p.alpha;
      if (p.one) { // drawn this frame only (bouncing arrows are re-emitted every frame)
        x = p.x; y = p.y; z = p.z;
      } else {
        p.t += dt;
        if (p.t >= p.life) continue;
        const k = p.t / p.life;
        if (p.arc) {
          const q = p.arc, u = smooth(k);
          x = q.x0 + (q.x1 - q.x0) * u; z = q.z0 + (q.z1 - q.z0) * u;
          y = q.y0 + (q.y1 - q.y0) * u + Math.sin(u * Math.PI) * q.h;
        } else {
          p.vy -= p.grav * dt;
          p.x += p.vx * dt; p.z += p.vz * dt;
          p.dy = (p.dy || 0) + p.vy * dt;
          x = p.x; z = p.z; y = p.y + p.dy;
        }
        p.rot += p.spin * dt;
        if (p.pop) size *= k < 0.12 ? 0.45 + 0.75 * (k / 0.12) : k < 0.24 ? 1.2 - 0.2 * ((k - 0.12) / 0.12) : 1;
        if (p.wob) size *= 1 + 0.08 * Math.sin(p.t * 9);
        a *= k > 0.7 ? (1 - k) / 0.3 : 1;
        if (p.fadeIn) a *= Math.min(1, p.t / p.fadeIn);
        keep.push(p);
      }
      const i = n++;
      A[i * 4] = x; A[i * 4 + 1] = y; A[i * 4 + 2] = z; A[i * 4 + 3] = size * V.view.uiK;
      C[i * 4] = p.rgb[0]; C[i * 4 + 1] = p.rgb[1]; C[i * 4 + 2] = p.rgb[2]; C[i * 4 + 3] = a;
      T[i * 4] = p.cell; T[i * 4 + 1] = p.rot; T[i * 4 + 2] = p.tint; T[i * 4 + 3] = 0;
      if (n >= P.cap) break;
    }
    P.list = keep;
    P.g.instanceCount = n;
    if (n) { P.iP.needsUpdate = true; P.iC.needsUpdate = true; P.iT.needsUpdate = true; }
  }

  // ================================================================== screen-space bars (patience)
  function makeBars(cap) {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const iP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const iB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const iC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    for (const a of [iP, iB, iC]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', iP); g.setAttribute('iB', iB); g.setAttribute('iC', iC);
    g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: V.uPx, uTime: V.uTime },
      vertexShader: `
attribute vec4 iP; attribute vec4 iB; attribute vec4 iC;
uniform float uPx;
varying vec2 vUv; varying vec4 vB; varying vec4 vC; varying vec2 vSize;
void main(){
  vUv = uv; vB = iB; vC = iC; vSize = vec2(iP.w, iB.y);
  vec4 c = modelViewMatrix * vec4(iP.xyz, 1.0);
  float k = uPx * max(0.5, -c.z);
  c.xy += (position.xy * vSize + vec2(0.0, iB.z)) * k;
  gl_Position = projectionMatrix * c;
}`,
      fragmentShader: `
uniform float uTime;
varying vec2 vUv; varying vec4 vB; varying vec4 vC; varying vec2 vSize;
void main(){
  vec2 px = vUv * vSize;
  float r = vSize.y * 0.5;
  vec2 q = abs(px - vSize * 0.5) - (vSize * 0.5 - vec2(r));
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  if (d > 1.0) discard;
  float bw = 1.6;
  vec3 col = vec3(0.06, 0.07, 0.07);
  if (d < -bw) {
    float inner = vSize.x - 2.0 * bw;
    float f = (px.x - bw) / inner;
    float on = step(f, vB.x);
    vec3 fill = vC.rgb;
    // draining: the edge of the fill flickers white
    float edge = (1.0 - smoothstep(0.0, 0.06, abs(f - vB.x))) * vC.a * (0.5 + 0.5 * sin(uTime * 18.0));
    col = mix(vec3(0.22, 0.24, 0.24), fill, on);
    col += vec3(0.25) * (1.0 - smoothstep(0.0, 0.5, vUv.y)) * on * 0.0 + vec3(0.18) * smoothstep(0.55, 0.95, vUv.y) * on;
    col = mix(col, vec3(1.0), edge * 0.8);
  }
  float a = (1.0 - smoothstep(-0.5, 0.8, d)) * vB.w;
  gl_FragColor = vec4(col, a);
}`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 41;
    return { mesh, g, iP, iB, iC, cap, n: 0 };
  }
  function pushBar(x, y, z, wPx, hPx, offY, fill, rgb, alpha, drain) {
    const B = V.bars; if (!B || B.n >= B.cap) return;
    const i = B.n++;
    B.iP.array.set([x, y, z, wPx], i * 4);
    B.iB.array.set([fill, hPx, offY, alpha], i * 4);
    B.iC.array.set([rgb[0], rgb[1], rgb[2], drain], i * 4);
  }

  // ================================================================== ground rings (groups, selection, markers, ripples)
  // style: 0 your group (solid band), 1 rival group (dashed band), 2 destination marker, 3 ripple,
  //        4 tutorial highlight, 5 entrance
  function makeRings(cap) {
    const base = new THREE.PlaneGeometry(2, 2); base.rotateX(-Math.PI / 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    const iR = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const iCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const iX = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    for (const a of [iR, iCol, iX]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iR', iR); g.setAttribute('iCol', iCol); g.setAttribute('iX', iX);
    g.instanceCount = 0;
    // Two passes over the same instances: the contact shadow + glow sit ON the ground (depth tested, so
    // camp props and people cover them); the coloured bands and markers draw over everything (trees too).
    const mk = (pass) => new THREE.ShaderMaterial({
      uniforms: { uTime: V.uTime, uPass: { value: pass } },
      vertexShader: `
attribute vec4 iR; attribute vec4 iCol; attribute vec4 iX;
varying vec2 vP; varying vec4 vCol; varying vec4 vX; varying float vRad;
void main(){
  vP = position.xz; vCol = iCol; vX = iX; vRad = iR.w;
  vec3 wp = vec3(iR.x + position.x * iR.w * 1.3, iR.y + 0.06, iR.z + position.z * iR.w * 1.3);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`,
      fragmentShader: `
uniform float uTime; uniform float uPass;
varying vec2 vP; varying vec4 vCol; varying vec4 vX; varying float vRad;
vec4 acc;
void over(vec3 c, float a){ a = clamp(a, 0.0, 1.0); acc.rgb = c * a + acc.rgb * (1.0 - a); acc.a = a + acc.a * (1.0 - a); }
void main(){
  float r = length(vP) * 1.3;
  if (r > 1.3) discard;
  acc = vec4(0.0);
  float style = vX.x, sel = step(1.5, vX.y), hover = vX.y - 2.0 * sel, glow = vX.z, prog = vX.w;
  vec3 col = vCol.rgb; float A = vCol.a;
  if (uPass < 0.5) {
    if (style > 4.5) { // entrance: on the ground, behind whatever stands in front of it (the Arch)
      float ang5 = atan(vP.y, vP.x);
      float th5 = clamp(0.55 / max(vRad, 0.5), 0.07, 0.22);
      float band5 = smoothstep(1.0 - th5 - 0.025, 1.0 - th5, r) * (1.0 - smoothstep(1.0, 1.025, r));
      float d5 = smoothstep(-0.3, 0.3, sin(ang5 * 10.0 - uTime * 1.2));
      over(col, (1.0 - smoothstep(0.0, 1.0, r)) * 0.18 * A);
      over(col, band5 * mix(0.55, 1.0, d5) * A);
      if (acc.a < 0.004) discard;
      gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
      return;
    }
    if (style > 1.5) discard;
    float sh = (1.0 - smoothstep(0.05, 0.92, r)) * 0.3;
    over(vec3(0.0), sh * A);
    over(col, glow * (1.0 - smoothstep(0.15, 1.0, r)) * 0.5 * A);
    if (acc.a < 0.004) discard;
    gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
    return;
  }
  float ang = atan(vP.y, vP.x);
  float th = clamp(0.55 / max(vRad, 0.5), 0.07, 0.22);
  float aa = 0.025;
  float band = smoothstep(1.0 - th - aa, 1.0 - th, r) * (1.0 - smoothstep(1.0, 1.0 + aa, r));
  float rim = smoothstep(1.0 - th - 0.06, 1.0 - th - 0.02, r) * (1.0 - smoothstep(1.02, 1.06, r)); // dark rim for contrast
  if (style < 1.5) {
    float b = band;
    if (style > 0.5) b *= smoothstep(-0.15, 0.15, sin(ang * 9.0 + uTime * 0.6));
    if (prog >= 0.0) { // settling in: the ring fills clockwise from the top (the progress indicator)
      float f = fract(ang / 6.2831853 + 0.25);
      float on = 1.0 - smoothstep(prog - 0.004, prog + 0.004, f);
      float lead = (1.0 - smoothstep(0.0, 0.02, abs(f - prog))) * step(0.001, prog);
      b = band * mix(0.3, 1.0, on);
      b = max(b, band * lead * 1.0);
      col = mix(col, vec3(1.0), lead * 0.7);
    }
    over(vec3(0.03), rim * 0.45 * A * (style > 0.5 ? 0.6 : 1.0));
    over(col, b * A);
    if (sel > 0.5) {
      float pr = 1.13 + 0.025 * sin(uTime * 6.0);
      float sb = smoothstep(pr - 0.07, pr - 0.035, r) * (1.0 - smoothstep(pr + 0.02, pr + 0.055, r));
      over(vec3(0.0), smoothstep(pr - 0.1, pr - 0.06, r) * (1.0 - smoothstep(pr + 0.05, pr + 0.09, r)) * 0.35);
      over(vec3(1.0), sb);
    }
    if (hover > 0.001) over(vec3(1.0), band * hover * 0.45);
  } else if (style < 2.5) {
    float rot = uTime * 0.9;
    float d = smoothstep(-0.2, 0.2, sin(ang * 6.0 + rot));
    over(vec3(0.03), rim * 0.4 * A);
    over(col, band * d * A);
    float dot = 1.0 - smoothstep(0.16, 0.2, r);
    over(col, dot * A * (0.6 + 0.4 * sin(uTime * 5.0)));
  } else if (style < 3.5) {
    float k = clamp(prog, 0.0, 1.0);
    float rr = 0.25 + 0.8 * k;
    float b = smoothstep(rr - 0.12, rr - 0.04, r) * (1.0 - smoothstep(rr, rr + 0.04, r));
    over(col, b * (1.0 - k) * A);
  } else if (style < 4.5) {
    float p = 0.5 + 0.5 * sin(uTime * 5.0);
    float rr = 1.05 + 0.06 * p;
    float b = smoothstep(rr - 0.16, rr - 0.08, r) * (1.0 - smoothstep(rr, rr + 0.05, r));
    over(vec3(0.0), smoothstep(rr - 0.2, rr - 0.12, r) * (1.0 - smoothstep(rr + 0.03, rr + 0.1, r)) * 0.4 * A);
    over(col, b * A);
    over(col, (1.0 - smoothstep(0.0, rr, r)) * 0.12 * p * A);
  } else {
    discard;
  }
  if (acc.a < 0.004) discard;
  gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
}`,
      transparent: true, depthTest: pass < 0.5, depthWrite: false,
      polygonOffset: pass < 0.5, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    const under = new THREE.Mesh(g, mk(0));
    under.frustumCulled = false; under.renderOrder = 1;
    const mesh = new THREE.Mesh(g, mk(1));
    mesh.frustumCulled = false; mesh.renderOrder = 2;
    return { mesh, under, g, iR, iCol, iX, cap, n: 0 };
  }
  // k: ripple phase (style 3) or settling progress 0..1 (styles 0/1; -1 = none)
  function pushRing(x, z, radius, rgb, alpha, style, sel, glow, hover, k) {
    const R = V.rings; if (!R || R.n >= R.cap) return;
    const i = R.n++;
    R.iR.array.set([x, gy(x, z), z, radius], i * 4);
    R.iCol.array.set([rgb[0], rgb[1], rgb[2], alpha], i * 4);
    R.iX.array.set([style, (sel ? 2 : 0) + clamp(hover || 0, 0, 1), glow || 0, k === undefined ? -1 : k], i * 4);
  }

  // ================================================================== spots on the ground (fill + outline)
  function spotOutline(s) {
    let pts;
    if (s.poly && s.poly.length > 2) pts = s.poly.map((p) => [p[0], p[1]]);
    else { pts = []; const N = Math.max(48, Math.round(s.r * 5)); for (let k = 0; k < N; k++) { const a = k / N * TAU; pts.push([s.x + s.r * Math.sin(a), s.z - s.r * Math.cos(a)]); } }
    let area = 0;
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts.reverse();
    let top = 0; for (let k = 1; k < pts.length; k++) if (pts[k][1] < pts[top][1]) top = k;
    return pts.slice(top).concat(pts.slice(0, top));
  }
  function buildSpotMeshes(st) {
    const spots = st.spots.slice(0, MAX_SPOTS);
    const pos = [], aN = [], aS = [], aSpot = [], aU = [], aPer = [], idx = [];
    const fpos = [], fR = [], fSpot = [], fidx = [];
    for (const s of spots) {
      const pts = spotOutline(s);
      const n = pts.length;
      let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= n; cz /= n;
      const cum = [0]; let L = 0;
      for (let k = 1; k <= n; k++) { const a = pts[k - 1], b = pts[k % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
      const base = pos.length / 3;
      for (let k = 0; k <= n; k++) {
        const p = pts[k % n], pp = pts[(k - 1 + n) % n], pn = pts[(k + 1) % n];
        let nx = -(pn[1] - pp[1]), nz = (pn[0] - pp[0]);
        const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        if ((p[0] - cx) * nx + (p[1] - cz) * nz < 0) { nx = -nx; nz = -nz; }
        const y = 0.16 + Math.max(0, gy(p[0], p[1]));
        for (const side of [-1, 1]) { pos.push(p[0], y, p[1]); aN.push(nx, nz); aS.push(side); aSpot.push(s.idx); aU.push(cum[k] / L); aPer.push(L); }
        if (k < n) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      // fill: a fan, plus a ring of interior points so the rim gradient is smooth
      const fb = fpos.length / 3;
      fpos.push(cx, 0.09 + Math.max(0, gy(cx, cz)), cz); fR.push(0); fSpot.push(s.idx);
      for (let k = 0; k < n; k++) {
        const ix = cx + (pts[k][0] - cx) * 0.62, iz = cz + (pts[k][1] - cz) * 0.62;
        fpos.push(ix, 0.09 + Math.max(0, gy(ix, iz)), iz); fR.push(0.62); fSpot.push(s.idx);
      }
      for (let k = 0; k < n; k++) { fpos.push(pts[k][0], 0.09 + Math.max(0, gy(pts[k][0], pts[k][1])), pts[k][1]); fR.push(1); fSpot.push(s.idx); }
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n;
        fidx.push(fb, fb + 1 + k, fb + 1 + k1);
        const i0 = fb + 1 + k, i1 = fb + 1 + k1, o0 = fb + 1 + n + k, o1 = fb + 1 + n + k1;
        fidx.push(i0, o0, o1, i0, o1, i1);
      }
    }
    const uA = [], uB = [], uC = [], uD = [];
    for (let i = 0; i < MAX_SPOTS; i++) { uA.push(new THREE.Vector4()); uB.push(new THREE.Vector4(1, 1, 1, -1)); uC.push(new THREE.Vector4()); uD.push(new THREE.Vector4()); }
    const uni = { uTime: V.uTime, uW: V.uW, uA: { value: uA }, uB: { value: uB }, uC: { value: uC }, uD: { value: uD } };
    V.spotU = uni;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aN', new THREE.Float32BufferAttribute(aN, 2));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(aS, 1));
    g.setAttribute('aSpot', new THREE.Float32BufferAttribute(aSpot, 1));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
    g.setAttribute('aPerim', new THREE.Float32BufferAttribute(aPer, 1));
    g.setIndex(idx);
    const head = `uniform vec4 uA[${MAX_SPOTS}]; uniform vec4 uB[${MAX_SPOTS}]; uniform vec4 uC[${MAX_SPOTS}]; uniform vec4 uD[${MAX_SPOTS}];`;
    const line = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `
attribute vec2 aN; attribute float aSide; attribute float aSpot; attribute float aU; attribute float aPerim;
uniform float uW;
varying float vU; varying float vPer; varying float vSide; varying float vSpot;
void main(){
  vU = aU; vPer = aPerim; vSide = aSide; vSpot = aSpot;
  vec3 p = position + vec3(aN.x, 0.0, aN.y) * aSide * uW * 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: `
uniform float uTime; ${head}
varying float vU; varying float vPer; varying float vSide; varying float vSpot;
void main(){
  int i = int(vSpot + 0.5);
  vec4 A = uA[i]; vec4 B = uB[i]; vec4 C = uC[i]; vec4 D = uD[i];
  float s = vU * vPer;
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float dark = smoothstep(0.45, 0.9, abs(vSide));
  vec3 chalk = vec3(0.98, 0.96, 0.9);
  float dash = smoothstep(0.38, 0.46, fract(s / 2.4)) * (1.0 - smoothstep(0.92, 1.0, fract(s / 2.4)));
  vec3 col = chalk; float a = 0.82 * dash;
  if (A.w > 0.5) { col = A.rgb; a = 0.97; }
  if (B.w >= 0.0) {
    float on = step(vU, B.w);
    col = mix(col, B.rgb, on); a = max(a, on * 0.97);
    float lead = 1.0 - smoothstep(0.0, 0.015, abs(vU - B.w));
    col = mix(col, vec3(1.0), lead * 0.85); a = max(a, lead);
  }
  if (C.z > 0.5 && A.w < 0.5 && C.x < 0.5) { // a group is on its way here: chevrons march in its colour
    float m = smoothstep(0.3, 0.5, fract(s / 3.0 - uTime * 0.8)) * (1.0 - smoothstep(0.8, 0.95, fract(s / 3.0 - uTime * 0.8)));
    col = mix(col, D.rgb, m); a = max(a, m * 0.95);
  }
  if (C.x > 0.5) { // arguing: the holder's and the challenger's colours, barber-pole
    float stp = smoothstep(0.45, 0.55, fract(s / 2.0 - uTime * 0.9));
    vec3 c0 = A.w > 0.5 ? A.rgb : chalk;
    col = mix(c0, D.rgb, stp); a = 0.97;
  }
  if (C.y > 0.001) { col = mix(col, vec3(1.0), 0.3 * C.y); a = max(a, 0.9 * C.y); }
  if (C.w > 0.5) { float p = 0.5 + 0.5 * sin(uTime * 5.0); col = mix(col, vec3(1.0, 0.89, 0.42), 0.6 + 0.4 * p); a = max(a, 0.95); }
  col = mix(col, col * 0.25, dark * 0.55);
  a *= edge;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    V.spotLine = new THREE.Mesh(g, line);
    V.spotLine.renderOrder = 1; V.spotLine.frustumCulled = false;
    V.root.add(V.spotLine);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fg.setAttribute('aR', new THREE.Float32BufferAttribute(fR, 1));
    fg.setAttribute('aSpot', new THREE.Float32BufferAttribute(fSpot, 1));
    fg.setIndex(fidx);
    const fill = new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `
attribute float aR; attribute float aSpot;
varying float vR; varying float vSpot;
void main(){ vR = aR; vSpot = aSpot; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
uniform float uTime; ${head}
varying float vR; varying float vSpot;
void main(){
  int i = int(vSpot + 0.5);
  vec4 A = uA[i]; vec4 B = uB[i]; vec4 C = uC[i]; vec4 D = uD[i];
  float rim = smoothstep(0.45, 1.0, vR);
  vec3 col = vec3(1.0, 0.98, 0.9); float a = 0.04 + 0.05 * rim;
  if (A.w > 0.5) { col = A.rgb; a = 0.2 + 0.2 * rim + D.w * (0.08 + 0.1 * rim); }
  else if (B.w >= 0.0) { col = B.rgb; a = (0.05 + 0.12 * rim) * (0.35 + 0.65 * B.w); }
  if (C.x > 0.5) a += 0.05 * (0.5 + 0.5 * sin(uTime * 7.0));
  if (C.y > 0.001) a += 0.07 * C.y;
  if (C.w > 0.5) { col = mix(col, vec3(1.0, 0.89, 0.42), 0.6); a += 0.1 * (0.5 + 0.5 * sin(uTime * 5.0)); }
  gl_FragColor = vec4(col, a);
}`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
    });
    V.spotFill = new THREE.Mesh(fg, fill);
    V.spotFill.renderOrder = 1; V.spotFill.frustumCulled = false;
    V.root.add(V.spotFill);
  }

  // ================================================================== path ribbons (where a group is walking)
  const PATH_MAX = 96;
  function makePath(rgb, rival) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(PATH_MAX * 2 * 3), u = new Float32Array(PATH_MAX * 2), side = new Float32Array(PATH_MAX * 2);
    for (let i = 0; i < PATH_MAX; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
    const idx = [];
    for (let i = 0; i < PATH_MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aU', new THREE.BufferAttribute(u, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: V.uTime, uCol: { value: new THREE.Vector3(rgb[0], rgb[1], rgb[2]) }, uAlpha: { value: 1 }, uLen: { value: 1 }, uRival: { value: rival ? 1 : 0 } },
      vertexShader: `
attribute float aU; attribute float aSide;
varying float vU; varying float vSide;
void main(){ vU = aU; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
uniform float uTime; uniform vec3 uCol; uniform float uAlpha; uniform float uLen; uniform float uRival;
varying float vU; varying float vSide;
void main(){
  float per = uRival > 0.5 ? 1.6 : 2.2;
  float k = fract((vU - uTime * (uRival > 0.5 ? 2.0 : 3.2)) / per);
  float dash = uRival > 0.5 ? (1.0 - smoothstep(0.32, 0.4, k)) : (1.0 - smoothstep(0.58, 0.66, k));
  float edge = 1.0 - smoothstep(0.6, 1.0, abs(vSide));
  float core = 1.0 - smoothstep(0.25, 0.55, abs(vSide));
  vec3 col = mix(uCol * 0.3, mix(uCol, vec3(1.0), 0.12), core);
  float a = dash * edge * uAlpha * smoothstep(0.0, 2.5, vU) * (1.0 - 0.5 * smoothstep(uLen - 1.5, uLen, vU));
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
    return { mesh, g, pts: [], tx: NaN, tz: NaN, recalc: 0, len: 0 };
  }
  function setPath(P, x, z, widthPx) {
    const pts = P.pts;
    const n = Math.min(PATH_MAX, pts.length + 1);
    if (n < 2) { P.mesh.visible = false; return; }
    const pos = P.g.attributes.position.array, U = P.g.attributes.aU.array;
    // ground points: the group, then the remaining waypoints
    const L = [[x, z]];
    for (let i = 0; i < pts.length && L.length < n; i++) L.push(pts[i]);
    // densify long segments so the ribbon hugs the ground and width stays even
    const D = [L[0]];
    for (let i = 1; i < L.length && D.length < PATH_MAX; i++) {
      const a = L[i - 1], b = L[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.min(PATH_MAX - D.length, Math.ceil(d / 4)));
      for (let k = 1; k <= steps; k++) D.push([a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps]);
    }
    const m = D.length;
    let acc = 0;
    for (let i = 0; i < m; i++) {
      const p = D[i], pp = D[Math.max(0, i - 1)], pn = D[Math.min(m - 1, i + 1)];
      if (i > 0) acc += Math.hypot(p[0] - pp[0], p[1] - pp[1]);
      let dx = pn[0] - pp[0], dz = pn[1] - pp[1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const y = Math.max(0, gy(p[0], p[1])) + 0.2;
      const hw = widthPx * metersPerPx(p[0], y, p[1]) * 0.5;
      const nx = -dz * hw, nz = dx * hw;
      pos[i * 6] = p[0] - nx; pos[i * 6 + 1] = y; pos[i * 6 + 2] = p[1] - nz;
      pos[i * 6 + 3] = p[0] + nx; pos[i * 6 + 4] = y; pos[i * 6 + 5] = p[1] + nz;
      U[i * 2] = acc; U[i * 2 + 1] = acc;
    }
    P.len = acc;
    P.mesh.material.uniforms.uLen.value = acc;
    P.g.attributes.position.needsUpdate = true; P.g.attributes.aU.needsUpdate = true;
    P.g.setDrawRange(0, (m - 1) * 6);
    P.mesh.visible = true;
  }

  // ================================================================== canvas sprites (tags, labels, bubbles)
  const CS = 2; // canvas pixels per CSS pixel
  function canvasSprite(wCss, hCss, order) {
    const c = document.createElement('canvas'); c.width = wCss * CS; c.height = hCss * CS;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    const spr = new THREE.Sprite(mat);
    spr.renderOrder = order; spr.center.set(0.5, 0); spr.frustumCulled = false; spr.visible = false;
    V.root.add(spr);
    return { c, ctx: c.getContext('2d'), tex, mat, spr, key: '', w: wCss, h: hCss, pw: 0, ph: 0, off: 0, offT: 0, x: 0, y: 0, alpha: 0 };
  }
  function disposeSprite(S) { if (!S) return; V.root.remove(S.spr); S.tex.dispose(); S.mat.dispose(); }
  // Place a canvas sprite: anchored at world (x,y,z), bottom edge offPx above the anchor on screen.
  function placeSprite(S, x, y, z, offPx, scale, alpha) {
    const mpp = metersPerPx(x, y, z) * scale;
    S.spr.position.set(x, y, z);
    S.spr.scale.set(S.w * mpp, S.h * mpp, 1);
    S.spr.center.set(0.5, -offPx / (S.h * scale));
    S.spr.material.opacity = alpha;
    S.spr.visible = alpha > 0.01;
  }

  // Text in the park keeps a readable size whatever the camera distance: sprites are drawn at a fixed screen
  // size (placeSprite), and the smallest text is 13.5 canvas px x uiK (>= 0.88) = 12 CSS px or more.
  // Each status sits on a solid, high-contrast chip (dark ink on a light chip, or the reverse).
  function chipInk(rgb) { return luma(rgb) > 0.5 ? '#14181a' : '#ffffff'; }
  function drawChip(ctx, cx, y, text, size, fill, ink, align) {
    ctx.font = '700 ' + size + 'px ' + F_BODY;
    const w = ctx.measureText(text).width + 12, h = size + 6;
    const x0 = align === 'left' ? cx : cx - w / 2;
    roundRect(ctx, x0, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + w / 2, y + h / 2 + 0.5);
    ctx.textBaseline = 'alphabetic';
    return w;
  }

  function drawTag(T, G, g, side, st) {
    const player = side.idx === st.player;
    const sel = V.sel === g.id;
    const status = statusText(g, st);
    const key = g.name + '|' + status + '|' + side.cssColor + '|' + (sel ? 1 : 0) + '|' + (player ? 1 : 0) + '|' + V.fontsReady;
    if (key === T.key) return;
    T.key = key;
    const ctx = T.ctx, W = T.c.width, H = T.c.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.scale(CS, CS);
    const name = g.short || g.name;
    const light = luma(side.rgb) > 0.62;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const nameSize = fitText(ctx, name, T.w - 34, '700', 18, F_DISP, 14);
    const nameW = ctx.measureText(name).width;
    const stSize = fitText(ctx, status, T.w - 40, '700', 13.5, F_BODY, 13);
    const stW = ctx.measureText(status).width + 12;
    const chipH = stSize + 6;
    const pw = Math.ceil(Math.max(nameW, stW) + 20), ph = Math.round(nameSize + chipH + 11);
    const px = (T.w - pw) / 2, py = T.h - ph - 8;
    // pill: yours filled with the crew colour, theirs dark with a crew-coloured border
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    roundRect(ctx, px, py, pw, ph, 9);
    ctx.fillStyle = player ? rgbCss(side.rgb, 0.97) : 'rgba(18,22,22,0.9)';
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = sel ? 3 : 2;
    ctx.strokeStyle = sel ? '#ffffff' : player ? rgbCss(shadeRgb(side.rgb, 0.55), 0.95) : rgbCss(side.rgb, 1);
    roundRect(ctx, px, py, pw, ph, 9); ctx.stroke();
    // pointer
    ctx.fillStyle = sel ? '#ffffff' : player ? rgbCss(side.rgb, 0.97) : rgbCss(side.rgb, 1);
    ctx.beginPath(); ctx.moveTo(T.w / 2 - 6, py + ph - 1); ctx.lineTo(T.w / 2 + 6, py + ph - 1); ctx.lineTo(T.w / 2, py + ph + 7); ctx.closePath(); ctx.fill();
    const ink = player ? (light ? '#14181a' : '#ffffff') : rgbCss(side.rgb.map((c) => Math.min(1, c * 1.15 + 0.12)), 1);
    ctx.fillStyle = ink;
    ctx.font = '700 ' + nameSize + 'px ' + F_DISP;
    ctx.fillText(name, T.w / 2, py + nameSize + 2);
    // status chip: arguing in chalk yellow; otherwise light on dark pills, dark on light ones
    const arguing = g.status === 'arguing';
    const fill = arguing ? '#ffe46b' : player && light ? 'rgba(20,24,26,0.88)' : '#f4eedf';
    const sink = arguing ? '#3a1f0a' : player && light ? '#ffffff' : '#14181a';
    drawChip(ctx, T.w / 2, py + nameSize + 5, status, stSize, fill, sink);
    T.pw = pw; T.ph = ph + 8; T.tex.needsUpdate = true;
  }

  function drawSpotLabel(L, s, st) {
    const holder = s.holder >= 0 ? V.sides[s.holder] : null;
    let status, chip = '#f4eedf', ink = '#14181a';
    if (s.arguing) { status = 'arguing!'; chip = '#ffe46b'; ink = '#3a1f0a'; }
    else if (holder) {
      // "yours" / "theirs" (crew names only with 3-4 crews): no possessives to get wrong
      status = (s.holder === st.player ? 'yours' : V.sides.length > 2 ? holder.short : 'theirs') + ' · +1 a second';
      chip = holder.cssColor; ink = chipInk(holder.rgb);
    } else if (s.settleSide >= 0) { status = 'settling in…'; chip = V.sides[s.settleSide].cssColor; ink = chipInk(V.sides[s.settleSide].rgb); }
    else { status = 'empty'; chip = 'rgba(244,238,223,0.92)'; }
    let eta = '';
    if (V.sel >= 0 && V.eta[s.idx] !== undefined) {
      const e = V.eta[s.idx];
      eta = e === 0 ? 'here' : e >= 999 ? '' : Math.max(1, Math.round(e)) + ' s walk';
    }
    const name = s.name;
    const key = name + '|' + status + '|' + chip + '|' + eta + '|' + V.fontsReady;
    if (key === L.key) return;
    L.key = key;
    const ctx = L.ctx, W = L.c.width, H = L.c.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.scale(CS, CS);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let etaW = 0;
    if (eta) { ctx.font = '700 13.5px ' + F_DISP; etaW = ctx.measureText(eta).width + 14; }
    const nameSize = fitText(ctx, name.toUpperCase(), L.w - 40 - (eta ? etaW + 6 : 0), '800', 18, F_DISP, 14);
    const nameW = ctx.measureText(name.toUpperCase()).width;
    const stSize = 13.5;
    ctx.font = '700 ' + stSize + 'px ' + F_BODY;
    const stW = ctx.measureText(status).width + 12;
    const strip = holder ? 8 : 0;
    const innerW = Math.max(nameW, stW);
    const chipH = stSize + 6;
    const pw = Math.ceil(innerW + 20 + strip + (eta ? etaW + 6 : 0)), ph = Math.round(nameSize + chipH + 12);
    const px = (L.w - pw) / 2, py = L.h - ph - 4;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    roundRect(ctx, px, py, pw, ph, 7); ctx.fillStyle = SIGN.bg; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = SIGN.line; roundRect(ctx, px + 2.5, py + 2.5, pw - 5, ph - 5, 5); ctx.stroke();
    if (holder) {
      ctx.save(); roundRect(ctx, px, py, pw, ph, 7); ctx.clip();
      ctx.fillStyle = holder.cssColor; ctx.fillRect(px, py, strip + 2, ph);
      ctx.restore();
    }
    const tx = px + 10 + strip;
    ctx.fillStyle = SIGN.ink; ctx.font = '800 ' + nameSize + 'px ' + F_DISP; ctx.textAlign = 'left';
    ctx.fillText(name.toUpperCase(), tx, py + nameSize + 3);
    drawChip(ctx, tx - 2, py + nameSize + 6, status, stSize, chip, ink, 'left');
    if (eta) {
      const ex = px + pw - etaW - 7, ey = py + (ph - 22) / 2;
      roundRect(ctx, ex, ey, etaW, 22, 11); ctx.fillStyle = '#ffe46b'; ctx.fill();
      ctx.fillStyle = '#163a2b'; ctx.font = '700 13.5px ' + F_DISP; ctx.textAlign = 'center';
      ctx.fillText(eta, ex + etaW / 2, ey + 15.5);
    }
    L.pw = pw; L.ph = ph + 4; L.tex.needsUpdate = true;
  }

  function drawBubble(B, text, rgb) {
    const ctx = B.ctx, W = B.c.width, H = B.c.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.scale(CS, CS);
    ctx.font = '600 14px ' + F_BODY;
    const lines = wrap(ctx, text, B.w - 34, 2);
    const tw = Math.max.apply(null, lines.map((l) => ctx.measureText(l).width));
    const bw = Math.min(B.w - 6, tw + 26), bh = lines.length * 18 + 14;
    const bx = (B.w - bw) / 2, by = B.h - 10 - bh;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    roundRect(ctx, bx, by, bw, bh, 12); ctx.fillStyle = '#fffdf6'; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = rgbCss(shadeRgb(rgb, 0.85), 1);
    roundRect(ctx, bx, by, bw, bh, 12); ctx.stroke();
    // tail
    ctx.fillStyle = '#fffdf6';
    ctx.beginPath(); ctx.moveTo(B.w / 2 - 8, by + bh - 1.5); ctx.lineTo(B.w / 2 + 6, by + bh - 1.5); ctx.lineTo(B.w / 2 - 4, B.h - 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(B.w / 2 - 8, by + bh); ctx.lineTo(B.w / 2 - 4, B.h - 1); ctx.lineTo(B.w / 2 + 6, by + bh); ctx.stroke();
    ctx.fillStyle = '#1c1f1d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, B.w / 2, by + 7 + 9 + i * 18));
    B.pw = bw; B.ph = bh + 10; B.tex.needsUpdate = true;
  }

  function drawCoffeeTag(C, text, rgb) {
    const key = text + V.fontsReady;
    if (key === C.key) return;
    C.key = key;
    const ctx = C.ctx, W = C.c.width, H = C.c.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.scale(CS, CS);
    ctx.font = '700 12px ' + F_DISP;
    const tw = ctx.measureText(text).width;
    const pw = tw + 30, ph = 20, px = (C.w - pw) / 2, py = C.h - ph - 2;
    roundRect(ctx, px, py, pw, ph, 10); ctx.fillStyle = 'rgba(18,22,22,0.85)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgbCss(rgb, 1); ctx.stroke();
    // tiny cup
    const cx = px + 12, cy = py + 10;
    ctx.fillStyle = '#f4eedf';
    ctx.beginPath(); ctx.moveTo(cx - 5, cy - 3); ctx.lineTo(cx + 4, cy - 3); ctx.lineTo(cx + 3, cy + 5); ctx.lineTo(cx - 4, cy + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f4eedf'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx + 5, cy + 1, 2.5, -1.3, 1.3); ctx.stroke();
    ctx.fillStyle = '#f4eedf'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + 21, py + 10.5);
    C.pw = pw; C.ph = ph; C.tex.needsUpdate = true;
  }

  // ================================================================== people, camps, dogs
  function poolFor(crew, slot, hex, cap) {
    const L = lib(); if (!L) return null;
    const cls = CLS[slot % 3];
    const key = crew + '|' + cls + '|' + hex;
    let P = V.pools[key];
    if (P) { P.cap += cap; return P; }
    const built = L.buildType(crew, cls, hex);
    const xray = L.peopleMaterial(built.pose, { xray: hex });
    P = { key, cls, crew, built, cap, pool: null, xray };
    V.pools[key] = P;
    return P;
  }
  function finishPools() {
    const L = lib(); if (!L) return;
    for (const k in V.pools) {
      const P = V.pools[k];
      if (P.pool) continue;
      P.pool = new L.Pool(P.built.geo, L.peopleMaterial(P.built.pose), Math.max(8, P.cap), { xray: P.xray });
      P.pool.addTo(V.root);
    }
  }

  // Camp props (built with the same diorama builder as the people, so they share lighting and style).
  // Local frame: +z points at the spot centre (the audience / the board).
  function campKit(crew, hex) {
    const L = lib(); const out = { geos: {}, pieces: [], seats: [], face: 'in' };
    if (!L) return out;
    const fc = new THREE.Color(hex).getHex();
    const light = L.mixHex(fc, 0xffffff, 0.45);
    const B = () => new L.Builder();
    let b;
    if (crew === 'hustle') {
      // folding chair: aluminium tubes, webbing in crew colours (seat at y 0.45, back toward -z)
      b = B();
      const al = 0xd8dce0;
      for (const sx of [-0.21, 0.21]) {
        b.rod([sx, 0, 0.2], [sx, 0.45, -0.18], 0.035, { c: al });
        b.rod([sx, 0, -0.2], [sx, 0.45, 0.18], 0.035, { c: al });
        b.rod([sx, 0.45, -0.2], [sx, 0.95, -0.28], 0.035, { c: al });
      }
      for (let k = 0; k < 3; k++) b.box(0.44, 0.03, 0.12, { c: k % 2 ? 0xffffff : light, at: [0, 0.46, -0.13 + k * 0.13] });
      for (let k = 0; k < 3; k++) b.box(0.44, 0.12, 0.03, { c: k % 2 ? 0xffffff : light, at: [0, 0.58 + k * 0.13, -0.235 - k * 0.018], rot: [-0.15, 0, 0] });
      out.geos.chair = b.build();
      // card table
      b = B();
      b.box(0.95, 0.05, 0.95, { c: 0x2e3a33, at: [0, 0.72, 0] });
      b.box(0.99, 0.06, 0.99, { c: 0x1c2420, at: [0, 0.69, 0] });
      for (const lx of [-0.4, 0.4]) for (const lz of [-0.4, 0.4]) b.rod([lx, 0, lz], [lx * 0.95, 0.68, lz * 0.95], 0.04, { c: 0x222222 });
      out.geos.table = b.build();
      // board, pieces and the clock
      b = B();
      b.box(0.62, 0.03, 0.62, { c: 0x6b4a2b, at: [0, 0.76, 0] });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) b.box(0.135, 0.012, 0.135, { c: (i + j) % 2 ? 0x3b2a1c : 0xf1e6cc, at: [-0.2025 + i * 0.135, 0.78, -0.2025 + j * 0.135] });
      const pcs = [[-0.2, -0.2, 1], [0.07, -0.2, 1], [0.2, -0.07, 1], [-0.07, 0.07, 0], [0.2, 0.2, 0], [-0.2, 0.2, 0], [0.07, 0.07, 1]];
      for (const p of pcs) { const c = p[2] ? 0xf8f4ea : 0x1b1b1b; b.cyl(0.035, 0.045, 0.1, 6, { c, at: [p[0], 0.84, p[1]] }); b.ball(0.035, { c, at: [p[0], 0.91, p[1]] }, 6, 4); }
      b.box(0.2, 0.09, 0.08, { c: 0x7a4a24, at: [0.43, 0.8, 0] }); // chess clock
      b.box(0.05, 0.03, 0.05, { c: 0xd6d0c0, at: [0.38, 0.86, 0] }); b.box(0.05, 0.03, 0.05, { c: 0xd6d0c0, at: [0.48, 0.86, 0] });
      out.geos.board = b.build();
      out.pieces = [
        { type: 'chair', x: 0, z: -0.95, yaw: 0, a: 0, b: 0.45, mode: 'unfold' },
        { type: 'chair', x: 0, z: 0.95, yaw: Math.PI, a: 0.1, b: 0.55, mode: 'unfold' },
        { type: 'table', x: 0, z: 0, yaw: 0, a: 0.3, b: 0.75, mode: 'pop' },
        { type: 'board', x: 0, z: 0, yaw: 0, a: 0.62, b: 1.0, mode: 'drop' },
      ];
      out.seats = [{ x: 0, z: -1.08, yaw: 0, sit: true }, { x: 0, z: 1.08, yaw: Math.PI, sit: true },
        { x: -1.45, z: 0.35, yaw: 'c' }, { x: 1.5, z: -0.35, yaw: 'c' }, { x: -1.3, z: -1.25, yaw: 'c' }, { x: 1.35, z: 1.2, yaw: 'c' }];
    } else if (crew === 'noise') {
      // open guitar case with a tip hat
      b = B();
      b.box(1.05, 0.1, 0.4, { c: 0x1d1b1a, at: [0, 0.05, 0] });
      b.box(0.95, 0.04, 0.32, { c: fc, at: [0, 0.09, 0] });
      b.box(1.05, 0.38, 0.06, { c: 0x1d1b1a, at: [0, 0.22, -0.24], rot: [-0.35, 0, 0] });
      for (let k = 0; k < 6; k++) b.box(0.06, 0.012, 0.06, { c: k % 2 ? 0xffd34d : 0x9ed36a, at: [-0.32 + k * 0.12, 0.12, (k % 3 - 1) * 0.06] });
      b.cyl(0.13, 0.15, 0.1, 8, { c: 0x2a2a2a, at: [0.68, 0.05, 0.1] });
      b.cyl(0.21, 0.21, 0.015, 10, { c: 0x2a2a2a, at: [0.68, 0.005, 0.1] });
      out.geos.case = b.build();
      // upturned bucket with sticks
      b = B();
      b.add(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10, 1, false), { c: 0xff7a14, at: [0, 0.21, 0] });
      b.cyl(0.225, 0.225, 0.03, 10, { c: 0xffffff, at: [0, 0.05, 0] });
      b.rod([-0.12, 0.43, -0.02], [0.14, 0.44, 0.1], 0.025, { c: 0xd9c08f });
      b.rod([-0.1, 0.43, 0.08], [0.13, 0.44, -0.06], 0.025, { c: 0xd9c08f });
      out.geos.bucket = b.build();
      // amp + mic stand
      b = B();
      b.box(0.55, 0.5, 0.32, { c: 0x161616, at: [0, 0.25, 0] });
      b.box(0.47, 0.34, 0.02, { c: 0x3b3b3b, at: [0, 0.22, 0.165] });
      b.box(0.5, 0.04, 0.02, { c: 0xd7b56d, at: [0, 0.44, 0.165] });
      b.rod([0.55, 0, 0.3], [0.55, 1.35, 0.3], 0.03, { c: 0x222222 });
      b.cyl(0.18, 0.18, 0.02, 8, { c: 0x222222, at: [0.55, 0.01, 0.3] });
      b.ball(0.06, { c: 0x444444, at: [0.55, 1.4, 0.36] }, 6, 5);
      out.geos.amp = b.build();
      out.pieces = [
        { type: 'case', x: 0, z: 1.25, yaw: 0, a: 0, b: 0.45, mode: 'pop' },
        { type: 'bucket', x: -0.75, z: 0.15, yaw: 0.3, a: 0.28, b: 0.72, mode: 'drop' },
        { type: 'bucket', x: 0.75, z: 0.15, yaw: -0.2, a: 0.36, b: 0.8, mode: 'drop' },
        { type: 'amp', x: 0, z: -0.95, yaw: 0, a: 0.6, b: 1.0, mode: 'pop' },
      ];
      out.face = 'out';
      out.seats = [{ x: -0.75, z: -0.35, yaw: 0 }, { x: 0.75, z: -0.35, yaw: 0 }, { x: -1.7, z: 0.1, yaw: 0.25 }, { x: 1.7, z: 0.1, yaw: -0.25 },
        { x: -1.05, z: -1.35, yaw: 0.1 }, { x: 1.05, z: -1.35, yaw: -0.1 }];
    } else if (crew === 'violets') {
      // picnic blanket (unrolls along z)
      b = B();
      for (let k = 0; k < 8; k++) b.box(2.2, 0.025, 0.2, { c: k % 2 ? 0xf6f2ff : fc, at: [0, 0.015, -0.7 + k * 0.2] });
      for (let k = 0; k < 4; k++) b.box(0.08, 0.03, 1.6, { c: k % 2 ? 0xf6f2ff : light, at: [-0.75 + k * 0.5, 0.02, 0] });
      out.geos.blanket = b.build();
      // backpack + a laptop
      b = B();
      b.box(0.34, 0.42, 0.2, { c: 0x2b2f3a, at: [0, 0.21, 0] });
      b.box(0.26, 0.18, 0.06, { c: fc, at: [0, 0.16, 0.12] });
      b.box(0.36, 0.02, 0.26, { c: 0xb8bcc4, at: [0.42, 0.01, 0.1] });
      b.box(0.36, 0.24, 0.02, { c: 0xb8bcc4, at: [0.42, 0.12, -0.03], rot: [-0.25, 0, 0] });
      b.box(0.31, 0.19, 0.005, { c: 0x9fd4ff, at: [0.42, 0.125, -0.017], rot: [-0.25, 0, 0], raw: true });
      out.geos.bag = b.build();
      // pennant on a pole
      b = B();
      b.rod([0, 0, 0], [0, 2.1, 0], 0.045, { c: 0xd8d8d8 });
      b.add(new THREE.ConeGeometry(0.28, 0.95, 3), { c: fc, at: [0.47, 1.82, 0], rot: [0, 0, -Math.PI / 2], sc: [1, 1, 0.12] });
      b.box(0.5, 0.05, 0.02, { c: 0xffffff, at: [0.36, 1.83, 0] });
      out.geos.pennant = b.build();
      out.pieces = [
        { type: 'blanket', x: 0, z: 0, yaw: 0, a: 0, b: 0.5, mode: 'unroll' },
        { type: 'bag', x: 0.85, z: -0.55, yaw: 0.4, a: 0.32, b: 0.72, mode: 'drop' },
        { type: 'bag', x: -0.9, z: 0.6, yaw: 2.6, a: 0.4, b: 0.8, mode: 'drop' },
        { type: 'pennant', x: -1.25, z: -0.95, yaw: 0, a: 0.6, b: 1.0, mode: 'rise' },
      ];
      out.seats = [{ x: -0.45, z: 0.25, yaw: Math.PI / 2, sit: true }, { x: 0.5, z: -0.15, yaw: -Math.PI / 2, sit: true },
        { x: -1.55, z: -0.25, yaw: 'c' }, { x: 1.55, z: 0.35, yaw: 'c' }, { x: 0.25, z: 1.45, yaw: 'c' }, { x: -0.25, z: -1.55, yaw: 'c' }];
    } else {
      // dog bed
      b = B();
      b.cyl(0.5, 0.52, 0.1, 12, { c: L.shade(fc, 0.8), at: [0, 0.05, 0] });
      b.torus(0.48, 0.1, { c: fc, at: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
      b.cyl(0.4, 0.4, 0.04, 12, { c: 0xf0e8da, at: [0, 0.11, 0] });
      out.geos.bed = b.build();
      // water bowl
      b = B();
      b.cyl(0.2, 0.15, 0.1, 10, { c: 0x3a7bd5, at: [0, 0.05, 0] });
      b.cyl(0.17, 0.17, 0.02, 10, { c: 0x9fe0ff, at: [0, 0.09, 0], raw: true });
      out.geos.bowl = b.build();
      // ball + rope toy
      b = B();
      b.ball(0.09, { c: 0xd9f23a, at: [0, 0.09, 0] }, 8, 6);
      b.torus(0.12, 0.035, { c: 0xe0453a, at: [0.3, 0.035, 0.05], rot: [Math.PI / 2, 0, 0] });
      out.geos.ball = b.build();
      out.pieces = [
        { type: 'bed', x: -0.8, z: -0.15, yaw: 0, a: 0, b: 0.45, mode: 'pop' },
        { type: 'bowl', x: 0.8, z: 0.3, yaw: 0, a: 0.28, b: 0.7, mode: 'drop' },
        { type: 'ball', x: 0.1, z: 1.0, yaw: 0, a: 0.55, b: 0.9, mode: 'drop' },
      ];
      out.seats = [];
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.5; out.seats.push({ x: Math.sin(a) * 1.75, z: Math.cos(a) * 1.75, yaw: 'c' }); }
      out.dogs = true;
    }
    return out;
  }
  function campPoolsFor(crew, hex) {
    const key = crew + '|' + hex;
    let K = V.campPools[key];
    if (K) return K;
    const L = lib(); if (!L) return null;
    const kit = campKit(crew, hex);
    K = { key, kit, pools: {} };
    for (const t in kit.geos) {
      const p = new L.Pool(kit.geos[t], L.peopleMaterial([0, 0, 0, 0]), 18);
      p.mesh.castShadow = false; p.addTo(V.root);
      K.pools[t] = p;
    }
    V.campPools[key] = K;
    return K;
  }
  function dogPool() {
    if (V.dogPool) return V.dogPool;
    const L = lib(); if (!L) return null;
    const b = new L.Builder();
    L.dog(b, 0, 0, 1.0, 0xffffff, { collar: 0xff3b30, snout: 0xffffff, ear: 0xffffff });
    const geo = b.build();
    // coat = mask 1 (tinted per dog)
    const col = geo.attributes.color, mask = geo.attributes.aMask;
    for (let i = 0; i < col.count; i++) if (col.getX(i) > 0.98 && col.getY(i) > 0.98 && col.getZ(i) > 0.98) mask.setX(i, 1);
    mask.needsUpdate = true;
    const p = new L.Pool(geo, L.peopleMaterial([0, 0, 0, 5], { tint: true }), 36, { tint: true });
    p.addTo(V.root);
    V.dogPool = p;
    return p;
  }
  const DOG_COATS = [[0.55, 0.36, 0.2], [0.92, 0.88, 0.8], [0.12, 0.11, 0.1], [0.78, 0.6, 0.35], [0.6, 0.6, 0.62], [0.7, 0.33, 0.15]].map(linRgb);

  // ================================================================== trees (canopy fade candidates)
  function buildTreeGrid() {
    const G = window.GEO; const grid = new Map();
    if (!G || !G.trees) return grid;
    for (const t of G.trees) {
      const k = Math.floor(t[0] / 8) + ',' + Math.floor(t[1] / 8);
      let a = grid.get(k); if (!a) grid.set(k, a = []);
      a.push(t[0], t[1]);
    }
    return grid;
  }
  function treesNear(x, z, r) {
    const grid = V.treeGrid; if (!grid) return 0;
    let n = 0;
    const r2 = r * r;
    for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) {
      for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) {
        const a = grid.get(i + ',' + j); if (!a) continue;
        for (let k = 0; k < a.length; k += 2) if ((a[k] - x) * (a[k] - x) + (a[k + 1] - z) * (a[k + 1] - z) < r2) n++;
      }
    }
    return n;
  }

  // ================================================================== view math
  function updateView(camera) {
    const R = SQ.render, cam = camera || V.camera;
    const el = R && R.renderer ? R.renderer.domElement : null;
    const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    V.view.w = Math.max(1, rect.width); V.view.h = Math.max(1, rect.height); V.view.left = rect.left; V.view.top = rect.top;
    if (!cam) return;
    cam.updateMatrixWorld();
    V.uPx.value = 2 * Math.tan((cam.fov * Math.PI) / 360) / V.view.h;
    V.view.camY = cam.position.y;
    V.view.zoomK = 1 + 0.9 * smooth((cam.position.y - 45) / 140);
    V.view.spK = 1 + 0.55 * (V.view.zoomK - 1);
    V.view.uiK = clamp(Math.min(V.view.w, V.view.h) / 640, 0.88, 1) * (HV.options.uiScale || 1);
    V.view.upX = cam.matrixWorld.elements[4]; V.view.upY = cam.matrixWorld.elements[5]; V.view.upZ = cam.matrixWorld.elements[6];
    V.view.rtX = cam.matrixWorld.elements[0]; V.view.rtY = cam.matrixWorld.elements[1]; V.view.rtZ = cam.matrixWorld.elements[2];
    cam.getWorldDirection(_v);
    const fl = Math.hypot(_v.x, _v.z) || 1;
    V.view.fwdX = _v.x / fl; V.view.fwdZ = _v.z / fl;
    V.uW.value = clamp(cam.position.y * 0.0085, 0.75, 2.1);
  }
  function viewDepth(x, y, z) {
    const cam = V.camera; if (!cam) return 100;
    _v2.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    return Math.max(0.5, -_v2.z);
  }
  function metersPerPx(x, y, z) { return V.uPx.value * viewDepth(x, y, z); }
  function project(x, y, z, out) {
    const cam = V.camera;
    out = out || {};
    if (!cam) { out.x = out.y = -9999; out.onScreen = false; out.behind = true; return out; }
    _v2.set(x, y, z).project(cam);
    out.x = V.view.left + (_v2.x + 1) * 0.5 * V.view.w;
    out.y = V.view.top + (1 - _v2.y) * 0.5 * V.view.h;
    out.behind = _v2.z > 1;
    out.onScreen = !out.behind && _v2.x > -1 && _v2.x < 1 && _v2.y > -1 && _v2.y < 1;
    return out;
  }

  // ================================================================== words
  function statusText(g, st) {
    st = st || V.state;
    switch (!g.coffee && g.status === 'idle' && g.moving ? 'walking' : g.status) {
      case 'walking': return g.spot >= 0 && st ? 'walking to ' + st.spots[g.spot].short : 'walking';
      case 'settling': return 'settling in…';
      case 'hanging': return 'hanging out';
      case 'arguing': return 'arguing!';
      case 'coffee': return 'went for coffee';
      default: return 'standing around';
    }
  }
  HV.statusText = statusText;

  // ================================================================== attach / detach
  HV.attach = function (opts) {
    opts = opts || {};
    if (V.attached) HV.detach();
    const R = SQ.render;
    V.scene = opts.scene || (R && R.scene) || null;
    V.camera = opts.camera || (R && R.camera) || null;
    V.match = opts.match || null;
    V.state = V.match ? V.match.state : (opts.state || null);
    if (!V.scene || !V.state || !V.state.spots) return false;
    V.root = new THREE.Group(); V.root.name = 'hangoutView';
    V.scene.add(V.root);
    HV.options.maxBubbles = 1;   // a new match starts with speech bubbles on (the UI turns them off while it talks)
    V.time = 0; V.frameNo = -1; V.lastT = -1; V.earnSec = Math.floor(V.state.t); V.over = !!V.state.over;
    V.sel = HV.selected = -1; V.hover = null; V.highlights = []; V.eta = []; V.etaT = -1;
    V.atlas = buildAtlas();
    V.parts = makeParticles(260); V.root.add(V.parts.mesh);
    V.bars = makeBars(24); V.root.add(V.bars.mesh);
    V.rings = makeRings(48); V.root.add(V.rings.under, V.rings.mesh);
    V.looseCamps = [];
    V.treeGrid = V.treeGrid || buildTreeGrid();
    const st = V.state;
    // sides
    V.sides = st.sides.map((s) => {
      const hex = colorblind() && CB[s.crew] ? CB[s.crew] : s.color;
      const rgb = hexRgb(hex);
      return { idx: s.idx, crew: s.crew, short: s.short || s.crew, hex, rgb, cssColor: hex,
        labelInk: rgbCss(rgb.map((c) => Math.min(1, c * 1.1 + 0.15)), 1) };
    });
    // spots
    buildSpotMeshes(st);
    V.spots = st.spots.map((s) => ({
      idx: s.idx, id: s.id, label: canvasSprite(256, 60, 42), pulse: 0, trees: treesNear(s.x, s.z, s.r + 6) > 0,
      prevHolder: s.holder, incoming: -1, labelOff: 0, ax: s.x, ay: 0, az: s.z, hover: 0,
    }));
    // groups
    V.pools = {}; V.campPools = {}; V.dogPool = null;
    V.groups = st.groups.map((g) => {
      const side = V.sides[g.side];
      const P = poolFor(side.crew, g.slot, side.hex, g.members);
      const members = [];
      for (let k = 0; k < g.members; k++) {
        const o = g.offsets[k] || [0, 0];
        members.push({ x: g.x + o[0] * SPACING, z: g.z + o[1] * SPACING, face: g.facing, phase: hrand(g.id * 7 + k) * 6, walk: 0,
          seed: hrand(g.id * 13 + k * 3.7), sv: 0.95 + hrand(g.id * 3 + k) * 0.1, anim: 0, sit: 0, fade: 0 });
      }
      let maxR = 0; for (const o of g.offsets) maxR = Math.max(maxR, Math.hypot(o[0], o[1]));
      return {
        id: g.id, side: g.side, P, members, n: g.members, x: g.x, z: g.z, face: g.facing, heading: g.facing,
        maxR, ringR: maxR * SPACING + 1.05, coffee: !!g.coffee, ghost: null, arrive: 1,
        tag: canvasSprite(256, 64, 43), tagOff: 0, path: makePath(side.rgb, g.side !== st.player),
        camp: null, dogs: [], lastSay: -99, sayKey: g.say ? g.say.t : -1, glyphT: 0, iconT: 1 + hrand(g.id) * 3, actT: 2 + hrand(g.id + 9) * 4,
        prevSpot: g.spot, prevTx: g.tx, prevTz: g.tz, prevStatus: g.status, glow: 0, coffeeTag: null, sep: { x: 0, z: 0 },
      };
    });
    for (const G of V.groups) V.root.add(G.path.mesh);
    finishPools();
    for (const sd of V.sides) campPoolsFor(sd.crew, sd.hex);
    if (V.sides.some((s) => s.crew === 'pack')) dogPool();
    V.bubbles = [];
    V.attached = true; HV.attached = true;
    // fonts: redraw text once the HUD fonts are in
    V.fontsReady = false;
    try {
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load('700 18px "Barlow Condensed"'), document.fonts.load('600 14px "Barlow"')])
          .then(() => document.fonts.ready).then(() => { V.fontsReady = true; }).catch(() => {});
      }
    } catch (e) { /* offline: system fonts */ }
    return true;
  };

  HV.detach = function () {
    if (!V.root) { V.attached = false; HV.attached = false; return; }
    for (const S of V.spots) disposeSprite(S.label);
    for (const G of V.groups) { disposeSprite(G.tag); if (G.coffeeTag) disposeSprite(G.coffeeTag); G.path.g.dispose(); G.path.mesh.material.dispose(); }
    for (const B of V.bubbles) disposeSprite(B.S);
    for (const k in V.pools) if (V.pools[k].pool) V.pools[k].pool.dispose();
    for (const k in V.campPools) for (const t in V.campPools[k].pools) V.campPools[k].pools[t].dispose();
    if (V.dogPool) V.dogPool.dispose();
    for (const o of [V.parts, V.bars, V.rings]) if (o) { o.g.dispose(); o.mesh.material.dispose(); if (o.under) o.under.material.dispose(); }
    for (const m of [V.spotLine, V.spotFill]) if (m) { m.geometry.dispose(); m.material.dispose(); }
    if (V.atlas) V.atlas.dispose();
    if (V.scene) V.scene.remove(V.root);
    V.root = null; V.spots = []; V.groups = []; V.pools = {}; V.campPools = {}; V.dogPool = null; V.bubbles = [];
    V.parts = V.bars = V.rings = V.spotLine = V.spotFill = null; V.atlas = null;
    V.match = null; V.state = null;
    V.attached = false; HV.attached = false; HV.selected = -1;
  };

  // ================================================================== selection / hover / highlight
  HV.select = function (id) {
    const n = id === undefined || id === null ? -1 : (typeof id === 'object' ? id.group : id);
    V.sel = HV.selected = Number.isInteger(n) ? n : -1;
    V.etaT = -1;
  };
  HV.hover = function (t) { V.hover = t || null; };
  HV.highlight = function (t) {
    V.highlights = [];
    const list = t === null || t === undefined ? [] : Array.isArray(t) ? t : [t];
    for (const x of list) V.highlights.push(x);
  };
  function resolveSpot(t) {
    const st = V.state; if (!st) return null;
    if (typeof t === 'string') return st.spots.find((s) => s.id === t) || null;
    if (typeof t === 'object' && t && t.spot !== undefined) return typeof t.spot === 'string' ? st.spots.find((s) => s.id === t.spot) || null : st.spots[t.spot] || null;
    return null;
  }
  function resolveGroup(t) {
    const st = V.state; if (!st) return null;
    if (typeof t === 'number') return st.groups[t] || null;
    if (typeof t === 'object' && t && t.group !== undefined) return st.groups[t.group] || null;
    return null;
  }

  // ================================================================== bubbles
  const SAY_PRI = { coffee: 5, still: 4, back: 3, evict: 3, argue: 2, tired: 2, withdraw: 1, settled: 1, settle: 0, ui: 6 };
  function sayBubble(G, text, kind, opts) {
    opts = opts || {};
    if (!text || HV.options.maxBubbles <= 0) return;
    const st = V.state;
    const player = G.side === st.player;
    let pri = (SAY_PRI[kind] !== undefined ? SAY_PRI[kind] : 1) + (player ? 0.5 : 0);
    if (opts.priority !== undefined) pri = opts.priority;
    if ((kind === 'settle' || kind === 'settled') && !player) return;
    // replace the lowest-priority (then oldest) bubble when full; never bump a more important one
    let B = V.bubbles.find((b) => b.G === G);
    if (!B && V.bubbles.length >= HV.options.maxBubbles) {
      const worst = V.bubbles.slice().sort((a, b) => a.pri - b.pri || b.t - a.t)[0];
      if (worst.pri > pri || (worst.pri === pri && worst.t < 1.0)) return;
      B = worst;
    }
    if (!B) { B = { S: canvasSprite(256, 84, 48) }; V.bubbles.push(B); }
    B.G = G; B.t = 0; B.pri = pri; B.life = opts.life || clamp(1.9 + text.length * 0.045, 2.2, 4.2); B.kind = kind;
    drawBubble(B.S, text, V.sides[G.side].rgb);
  }
  HV.say = function (groupId, text, opts) {
    const G = V.groups[groupId]; if (!G) return;
    sayBubble(G, text, 'ui', opts);
  };
  /** Let the speech bubbles that are up now finish within `left` seconds (the UI's message line takes over). */
  HV.fadeBubbles = function (left) {
    const k = left === undefined ? 0.25 : Math.max(0, left);
    for (const B of V.bubbles) if (B && isFinite(B.life)) B.t = Math.max(B.t || 0, B.life - k);
  };

  // ================================================================== the frame
  HV.update = function (state, alpha, dt, camera) {
    if (!V.attached) return;
    const R = SQ.render;
    if (R && R.frameNo !== undefined) { if (R.frameNo === V.frameNo) return; V.frameNo = R.frameNo; }
    state = state || V.state;
    if (!state || !state.spots || !state.groups) return;
    if (state !== V.state) { // a new match object without attach: rebuild if the cast changed
      if (state.groups.length !== V.groups.length || state.spots.length !== V.spots.length) { const m = V.match; HV.attach({ scene: V.scene, camera: V.camera, match: m && m.state === state ? m : { state } }); }
      V.state = state;
    }
    if (camera) V.camera = camera;
    alpha = clamp(alpha === undefined ? 1 : alpha, 0, 1);
    dt = clamp(dt || 0, 0, 0.1);
    V.time += dt; V.uTime.value = V.time;
    updateView(camera);
    const st = state;
    const tAdvanced = st.t !== V.lastT;
    V.lastT = st.t;

    // walking times from the selected group to every spot (shown on the spot labels)
    if (V.sel >= 0 && V.match && typeof V.match.eta === 'function' && (V.etaT < 0 || V.time - V.etaT > 0.5)) {
      V.etaT = V.time;
      const g = st.groups[V.sel];
      V.eta = [];
      if (g) for (const s of st.spots) V.eta[s.idx] = g.at === s.idx && !g.coffee ? 0 : V.match.eta(g.id, s.idx);
    } else if (V.sel < 0) V.eta = [];

    // pools
    for (const k in V.pools) if (V.pools[k].pool) V.pools[k].pool.begin();
    for (const k in V.campPools) for (const t in V.campPools[k].pools) V.campPools[k].pools[t].begin();
    if (V.dogPool) V.dogPool.begin();
    V.rings.n = 0; V.bars.n = 0;

    updateGroups(st, alpha, dt);
    separateGroups(dt);
    updateSpots(st, dt);
    for (const G of V.groups) drawGroup(G, st, dt);
    for (const L of V.looseCamps) { L.C.k = Math.max(0, L.C.k - dt * 2.2); if (L.C.k > 0.001) drawCamp(null, L.C, L.side, st, dt); }
    V.looseCamps = V.looseCamps.filter((L) => L.C.k > 0.001);
    updateEntrances(st);
    updateHighlights(st);
    if (tAdvanced) earningTick(st);
    if (st.over && !V.over) celebrate(st);
    V.over = !!st.over;

    for (const k in V.pools) if (V.pools[k].pool) V.pools[k].pool.end();
    for (const k in V.campPools) for (const t in V.campPools[k].pools) V.campPools[k].pools[t].end();
    if (V.dogPool) V.dogPool.end();
    V.rings.g.instanceCount = V.rings.n;
    if (V.rings.n) { V.rings.iR.needsUpdate = true; V.rings.iCol.needsUpdate = true; V.rings.iX.needsUpdate = true; }
    layoutLabels(st, dt);
    updateParticles(dt);
    V.bars.g.instanceCount = V.bars.n;
    if (V.bars.n) { V.bars.iP.needsUpdate = true; V.bars.iB.needsUpdate = true; V.bars.iC.needsUpdate = true; }
  };

  // ------------------------------------------------------------------ groups: positions, transitions
  function updateGroups(st, alpha, dt) {
    for (const g of st.groups) {
      const G = V.groups[g.id]; if (!G) continue;
      const x = g.px + (g.x - g.px) * alpha, z = g.pz + (g.z - g.pz) * alpha;
      const jump = Math.hypot(x - G.x, z - G.z) > 12;
      const mv = Math.hypot(x - G.x, z - G.z);
      if (mv > 0.02 && !jump) G.heading = Math.atan2(x - G.x, z - G.z);
      G.speed = dt > 0 && !jump ? mv / dt : 0;
      G.x = x; G.z = z;
      // coffee: leave as a ghost, come back with a pop
      if (g.coffee && !G.coffee) startGhost(G, g, st);
      if (!g.coffee && G.coffee) {
        G.ghost = null; G.arrive = 0;
        for (const m of G.members) { m.x = x; m.z = z; m.fade = 1; }
        snapMembers(G, g);
        const sd = V.sides[g.side];
        // "back!" pops beside the group (the tag and the speech bubble sit above it)
        const R = (G.ringR || 3) * V.view.zoomK * 1.25;
        emit({ x: x - V.view.fwdZ * R, y: gy(x, z) + 1.4 * V.view.zoomK, z: z + V.view.fwdX * R, vy: 0.8, life: 1.8, size: 30, rgb: sd.rgb, tint: 1, cell: ICON.back, pop: true });
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; emit({ x: x + Math.sin(a), y: gy(x, z) + 1.2, z: z + Math.cos(a), vx: Math.sin(a) * 3, vz: Math.cos(a) * 3, vy: 2, grav: 4, life: 0.7, size: 12, rgb: sd.rgb, tint: 0.6, cell: ICON.spark }); }
      }
      G.coffee = !!g.coffee;
      if (G.arrive < 1) G.arrive = Math.min(1, G.arrive + dt / 0.7);
      // a new order: ripple at the destination (yours) and recompute the path
      if (g.spot !== G.prevSpot || Math.abs(g.tx - G.prevTx) > 0.5 || Math.abs(g.tz - G.prevTz) > 0.5) {
        G.prevSpot = g.spot; G.prevTx = g.tx; G.prevTz = g.tz;
        G.path.recalc = 0; G.path.tx = NaN;
        if (g.moving && !g.coffee) {
          const sd = V.sides[g.side];
          if (g.side === st.player) {
            G.ripples = (G.ripples || []); G.ripples.push({ x: g.tx, z: g.tz, t: 0 });
          }
          void sd;
        }
      }
      // speech: the sim's latest line (barks, coffee punchlines, back lines)
      if (g.say && g.say.t !== G.sayKey) {
        G.sayKey = g.say.t;
        if (st.t - g.say.t < 1.5) sayBubble(G, g.say.text, g.say.kind);
      }
      // status changes: small world beats
      if (g.status !== G.prevStatus) {
        if (g.status === 'hanging' && G.prevStatus === 'settling') {
          const sd = V.sides[g.side];
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; emit({ x: G.x + Math.sin(a) * 1.5, y: gy(G.x, G.z) + 1.5, z: G.z + Math.cos(a) * 1.5, vx: Math.sin(a) * 2.5, vz: Math.cos(a) * 2.5, vy: 3.2, grav: 6, life: 0.9, size: 13, rgb: sd.rgb, tint: 0.7, cell: ICON.spark, spin: 4 }); }
          G.glow = 1;
        }
        G.prevStatus = g.status;
      }
    }
  }

  // Groups that stand in the same place (two crews' fallback slots can coincide) are nudged apart on screen.
  function separateGroups(dt) {
    const st = V.state;
    for (const A of V.groups) { A.sepT = A.sepT || { x: 0, z: 0 }; A.sepT.x = 0; A.sepT.z = 0; }
    for (let i = 0; i < V.groups.length; i++) {
      const A = V.groups[i], ga = st.groups[A.id];
      if (ga.coffee || ga.moving) continue;
      for (let j = i + 1; j < V.groups.length; j++) {
        const B = V.groups[j], gb = st.groups[B.id];
        if (gb.coffee || gb.moving) continue;
        let dx = B.x - A.x, dz = B.z - A.z; let d = Math.hypot(dx, dz);
        const want = (A.ringR + B.ringR) * 0.8 * V.view.zoomK;
        if (d >= want) continue;
        if (d < 0.01) { dx = 1; dz = 0.3; d = Math.hypot(dx, dz); }
        const push = (want - d) * 0.5;
        A.sepT.x -= dx / d * push; A.sepT.z -= dz / d * push;
        B.sepT.x += dx / d * push; B.sepT.z += dz / d * push;
      }
    }
    const k = Math.min(1, dt * 4);
    for (const A of V.groups) { A.sep.x += (A.sepT.x - A.sep.x) * k; A.sep.z += (A.sepT.z - A.sep.z) * k; }
  }

  function startGhost(G, g, st) {
    const e = st.sides[g.side].entrance;
    const nav = st.nav;
    let pts = null;
    try { pts = nav && nav.astar ? nav.astar(G.x, G.z, e.x, e.z) : null; } catch (err) { pts = null; }
    if (!pts || !pts.length) pts = [[e.x, e.z]];
    G.ghost = { t: 0, pts, i: 0, x: G.x, z: G.z, heading: G.heading, done: false };
    G.camp && (G.camp.target = 0);
    const sd = V.sides[g.side];
    // the "I give up" beat: a cup and a puff
    emit({ x: G.x, y: gy(G.x, G.z) + 3.3 * V.view.zoomK, z: G.z, vy: 0.9, life: 2.4, size: 30, rgb: sd.rgb, tint: 0, cell: ICON.cup, pop: true });
    if (g.say && g.say.kind === 'coffee') { G.sayKey = g.say.t; sayBubble(G, g.say.text, 'coffee'); }
  }

  function snapMembers(G, g) {
    const c = Math.cos(G.heading), s = Math.sin(G.heading);
    G.members.forEach((m, k) => {
      const o = g.offsets[k] || [0, 0];
      const ox = o[0] * SPACING * V.view.spK, oz = o[1] * SPACING * V.view.spK;
      m.x = G.x + ox * c + oz * s; m.z = G.z - ox * s + oz * c;
    });
  }

  // ------------------------------------------------------------------ one group: members, camp, ring, path
  function rivalsCentroid(g, st, out) {
    let n = 0, x = 0, z = 0;
    for (const o of st.groups) {
      if (o.side === g.side || o.coffee || o.at !== g.at || g.at < 0) continue;
      const O = V.groups[o.id]; x += O.x + O.sep.x; z += O.z + O.sep.z; n++;
    }
    if (!n) return null;
    out.x = x / n; out.z = z / n; return out;
  }
  const _rc = { x: 0, z: 0 };

  function drawGroup(G, st, dt) {
    const g = st.groups[G.id];
    const side = V.sides[G.side];
    const zk = V.view.zoomK, spk = V.view.spK;
    G.ringR = (G.maxR * SPACING * spk + 1.05 * zk) / zk;
    const isPlayer = G.side === st.player;
    const red = reduced();
    let gx = G.x + G.sep.x, gz = G.z + G.sep.z;

    // ---- camp (settling progress / hanging out)
    let campTarget = 0, campFollow = false;
    const spot = g.at >= 0 ? st.spots[g.at] : null;
    if (spot && !g.coffee) {
      if (spot.holder === g.side && g.earning) campTarget = 1;
      else if (spot.settleSide === g.side && spot.settle > 0) { campTarget = spot.settle / ((V.match && V.match.rules && V.match.rules.settleTime) || 3); campFollow = true; }
      if (spot.holder === g.side && g.arguing && g.patience < 30) campTarget = Math.max(0.05, g.patience / 30); // packing up
    }
    if (campTarget > 0 && !g.moving) {
      if (!G.camp || G.camp.k <= 0.001 || Math.hypot(G.camp.x - gx, G.camp.z - gz) > 2.5) {
        if (G.camp && G.camp.k > 0.001) { G.camp.target = 0; V.looseCamps.push({ C: G.camp, side }); }
        const yaw = spot ? Math.atan2(spot.x - g.x, spot.z - g.z) : g.facing;
        G.camp = { x: gx, z: gz, yaw, k: 0, target: campTarget };
      }
    }
    if (G.camp) {
      const C = G.camp;
      C.target = (g.moving || g.coffee) ? 0 : campTarget;
      if (campFollow && C.target >= C.k) C.k = C.target; // settling: the camp IS the progress bar
      else C.k += clamp(C.target - C.k, -dt * 2.2, dt * 2.2);
      if (C.k <= 0.001 && C.target <= 0) G.camp = null;
      else {
        if (!g.moving && !g.coffee) { C.x += (gx - C.x) * Math.min(1, dt * 3); C.z += (gz - C.z) * Math.min(1, dt * 3); }
        drawCamp(G, C, side, st, dt);
      }
    }
    const camp = G.camp && G.camp.k > 0.02 ? G.camp : null;

    // ---- members
    const P = G.P && G.P.pool;
    const ghost = G.ghost;
    const mode = g.coffee ? (ghost && !ghost.done ? 'leave' : 'gone') : g.moving ? 'walk' : g.arguing ? 'argue' : camp ? 'camp' : 'idle';
    if (mode === 'leave') stepGhost(G, ghost, dt);
    const K0 = V.campPools[side.crew + '|' + side.hex];
    const kit = camp && K0 ? K0.kit : null;
    const rc = g.arguing ? rivalsCentroid(g, st, _rc) : null;
    const baseX = mode === 'leave' ? ghost.x : gx, baseZ = mode === 'leave' ? ghost.z : gz;
    const heading = mode === 'leave' ? ghost.heading : mode === 'walk' ? G.heading : g.facing;
    const ch = Math.cos(heading), sh = Math.sin(heading);
    const pat = g.patience / ((V.match && V.match.rules && V.match.rules.patienceMax) || 100);
    let fadeAll = 0;
    if (mode === 'leave') fadeAll = clamp((ghost.t - 1.4) / 3.0, 0, 1);
    if (G.arrive < 1) fadeAll = Math.max(fadeAll, 1 - G.arrive);
    if (mode !== 'gone') {
      for (let k = 0; k < G.members.length; k++) {
        const m = G.members[k];
        const o = g.offsets[k] || [0, 0];
        let tx, tz, face, anim = ANIM.IDLE, sit = false;
        const ox = o[0] * SPACING * spk, oz = o[1] * SPACING * spk;
        if (camp && kit && (mode === 'camp' || mode === 'argue') && kit.seats.length) {
          const seat = kit.seats[k % kit.seats.length];
          const ring = k >= kit.seats.length ? 1 + 0.45 * Math.floor(k / kit.seats.length) : 1;
          const c = Math.cos(camp.yaw), s = Math.sin(camp.yaw), sc = CAMP * zk;
          const lx = seat.x * ring, lz = seat.z * ring;
          tx = camp.x + (lx * c + lz * s) * sc; tz = camp.z + (-lx * s + lz * c) * sc;
          if (seat.yaw === 'c') face = Math.atan2(camp.x - tx, camp.z - tz);
          else face = camp.yaw + seat.yaw;
          sit = !!seat.sit && mode === 'camp' && camp.k > 0.5 && g.earning;
          if (mode === 'camp') {
            if (g.earning) anim = hangAnim(side.crew, k, G, sit);
            else anim = ANIM.IDLE; // settling in: watching the camp go up
          }
        } else {
          tx = baseX + ox * ch + oz * sh; tz = baseZ - ox * sh + oz * ch;
          face = mode === 'walk' || mode === 'leave' ? heading : heading + (hrand(G.id * 5 + k) - 0.5) * 0.9;
          anim = mode === 'walk' ? ANIM.WALK : mode === 'leave' ? ANIM.OVERIT : ANIM.IDLE;
        }
        if (mode === 'argue' && rc) {
          // lean in toward the rivals, gesture; then exasperation: wobble, and finally turn for home
          const dx = rc.x - tx, dz = rc.z - tz, d = Math.hypot(dx, dz) || 1;
          const lean = Math.min(1.2 * zk, d * 0.15);
          tx += dx / d * lean; tz += dz / d * lean;
          face = Math.atan2(dx, dz);
          anim = ANIM.ATTACK;
          if (pat < 0.35 && Math.sin(V.time * 3 + k * 1.7) > 0.3) anim = ANIM.FLINCH;
          if (pat < 0.18 && k % 2 === 1) { const e = st.sides[g.side].entrance; face = Math.atan2(e.x - tx, e.z - tz); anim = ANIM.IDLE; }
        }
        moveMember(m, tx, tz, face, dt, mode === 'leave' ? 6 : 7.5);
        if (mode === 'leave' && ghost.t < 0.9) { anim = ANIM.OVERIT; }
        const walking = m.spd > 0.5;
        if (walking && anim !== ANIM.OVERIT) anim = ANIM.WALK;
        if (anim === ANIM.WALK && !walking && mode !== 'walk') anim = ANIM.IDLE;
        m.sit += ((sit && !walking ? 1 : 0) - m.sit) * Math.min(1, dt * 6);
        if (m.sit > 0.5 && !walking) anim = ANIM.SIT;
        let fade = fadeAll;
        if (mode === 'leave') fade = clamp((ghost.t - 1.4 - k * 0.12) / 3.0, 0, 1);
        if (fade >= 0.98) continue;
        if (!P) continue;
        const s = PEOPLE * zk * m.sv * (G.P.cls === 'heavy' && side.crew === 'pack' ? 0.9 : 1);
        let y = gy(m.x, m.z);
        if (m.walk > 0.05) y += Math.abs(Math.sin(m.phase)) * 0.05 * m.walk;
        if (anim === ANIM.SIT) y -= 0.3 * s * 0.72;
        let roll = 0, pitch = 0;
        if (anim === ANIM.FLINCH) roll = Math.sin(V.time * 30 + m.seed * 10) * 0.1;
        if (anim === ANIM.CHEER) y += Math.abs(Math.sin(V.time * 9 + m.seed * 6)) * 0.1;
        if (anim === ANIM.ATTACK) pitch = 0.05 * Math.sin(V.time * 7 + m.seed * 5);
        const sy = G.arrive < 1 ? 0.7 + 0.3 * backOut(G.arrive) : 1;
        P.push(compose(m.x, y, m.z, m.face, s, s * sy, s, pitch, roll), m.phase, m.walk, anim, fade, m.seed, 0, 0, 0);
      }
    }
    if (mode === 'gone') { G.path.mesh.visible = false; drawCoffeeTag2(G, g, st, side); return; }
    if (G.coffeeTag) G.coffeeTag.spr.visible = false;

    // ---- ring, glow, selection, hover
    const sel = V.sel === G.id;
    const hov = V.hover && V.hover.group === G.id ? 1 : 0;
    G.glow = Math.max(g.earning ? 0.3 : 0, G.glow - dt * 1.4);
    const ringA = mode === 'leave' ? 1 - fadeAll : G.arrive < 1 ? G.arrive : 1;
    const R0 = G.ringR * zk;
    const cx = mode === 'leave' ? ghost.x : gx, cz = mode === 'leave' ? ghost.z : gz;
    let prog = -1;
    if (spot && spot.holder < 0 && spot.settleSide === g.side && !g.moving && !g.coffee) prog = clamp(spot.settle / ((V.match && V.match.rules && V.match.rules.settleTime) || 3), 0, 1);
    if (ringA > 0.02) pushRing(cx, cz, R0, side.rgb, ringA * (mode === 'leave' ? 0.6 : 1), isPlayer ? 0 : 1, sel && mode !== 'leave', G.glow, hov, prog);
    if (G.ripples) {
      for (const r of G.ripples) { r.t += dt; pushRing(r.x, r.z, 3.2 * zk, side.rgb, 1, 3, false, 0, 0, Math.min(1, r.t / 0.7)); }
      G.ripples = G.ripples.filter((r) => r.t < 0.7);
    }

    // ---- where it is going: path + marker (yours bold, theirs a thin dotted line toward spots)
    const P2 = G.path;
    const showPath = HV.options.paths && g.moving && !g.coffee && (isPlayer || g.spot >= 0);
    if (showPath) {
      P2.recalc -= dt;
      if (P2.recalc <= 0 || P2.tx !== g.tx || P2.tz !== g.tz) {
        P2.recalc = 0.45; P2.tx = g.tx; P2.tz = g.tz;
        let pts = null;
        try { pts = st.nav && st.nav.astar ? st.nav.astar(g.x, g.z, g.tx, g.tz) : null; } catch (err) { pts = null; }
        P2.pts = pts && pts.length ? pts : [[g.tx, g.tz]];
        if (P2.pts.length) { const l = P2.pts[P2.pts.length - 1]; if (Math.hypot(l[0] - g.tx, l[1] - g.tz) > 0.5) P2.pts.push([g.tx, g.tz]); }
      }
      // drop waypoints the group has passed
      while (P2.pts.length > 1 && Math.hypot(P2.pts[0][0] - gx, P2.pts[0][1] - gz) < 2.5) P2.pts.shift();
      P2.mesh.material.uniforms.uAlpha.value = isPlayer ? (sel ? 1 : 0.85) : 0.5;
      setPath(P2, gx, gz, isPlayer ? 5 : 3);
      pushRing(g.tx, g.tz, (isPlayer ? 2.2 : 1.6) * zk, side.rgb, isPlayer ? 0.95 : 0.5, 2, false, 0, 0);
    } else P2.mesh.visible = false;

    // ---- exasperation and good-time icons
    G.glyphT -= dt; G.iconT -= dt; G.actT -= dt;
    const headY = gy(cx, cz) + 3.1 * zk;
    if (mode === 'argue' && rc && !red) {
      if (G.glyphT <= 0) {
        G.glyphT = 0.55 + hrand(V.time * 7 + G.id) * 0.5;
        const cells = pat > 0.6 ? [ICON.bang, ICON.what, ICON.bang] : pat > 0.3 ? [ICON.what, ICON.swear, ICON.hmph] : [ICON.swear, ICON.ugh, ICON.swear];
        const cell = cells[Math.floor(hrand(V.time * 13 + G.id) * cells.length)];
        const dx = rc.x - cx, dz = rc.z - cz, d = Math.hypot(dx, dz) || 1;
        const reach = Math.min(d * 0.75, 9 * zk);
        emit({ arc: { x0: cx, y0: headY - 0.6, z0: cz, x1: cx + dx / d * reach, y1: headY - 0.2, z1: cz + dz / d * reach, h: 1.6 + reach * 0.12 }, life: 0.85, size: 22, rgb: side.rgb, tint: 0.85, cell, rot: (hrand(V.time + G.id) - 0.5) * 0.6, pop: true });
      }
      if (G.iconT <= 0) {
        G.iconT = 1.3 + hrand(V.time * 3 + G.id) * 0.8;
        const cell = pat < 0.2 ? ICON.sweat : pat < 0.4 ? ICON.clock : pat < 0.7 ? ICON.anger : -1;
        if (cell >= 0) {
          const k = Math.floor(hrand(V.time * 5 + G.id) * G.members.length), m = G.members[k];
          emit({ x: m.x + 0.5, y: gy(m.x, m.z) + 2.8 * zk, z: m.z, vy: 0.5, life: 1.2, size: cell === ICON.clock ? 24 : 22, rgb: cell === ICON.anger ? [1, 0.35, 0.3] : cell === ICON.sweat ? [0.55, 0.8, 1] : [1, 1, 1], tint: cell === ICON.clock ? 0 : 1, cell, pop: true, wob: cell === ICON.anger });
        }
      }
    } else if (mode === 'camp' && g.earning && !red && G.actT <= 0) {
      const crew = side.crew;
      G.actT = crew === 'noise' ? 0.9 + hrand(V.time + G.id) * 0.8 : 3.2 + hrand(V.time + G.id) * 3.5;
      const pick = (arr) => arr[Math.floor(hrand(V.time * 9 + G.id) * arr.length)];
      const cell = crew === 'hustle' ? pick([ICON.knight, ICON.check, ICON.knight]) : crew === 'noise' ? pick([ICON.note1, ICON.note2]) : crew === 'violets' ? pick([ICON.lol, ICON.heart, ICON.phone]) : pick([ICON.woof, ICON.yip, ICON.ball]);
      const k = Math.floor(hrand(V.time * 11 + G.id) * G.members.length), m = G.members[k];
      emit({ x: m.x, y: gy(m.x, m.z) + 2.6 * zk, z: m.z, vx: (hrand(V.time + k) - 0.5) * 0.6, vy: 0.9, life: 1.6, size: crew === 'noise' ? 20 : 18, rgb: side.rgb, tint: 0.55, cell, rot: (hrand(V.time * 2 + k) - 0.5) * 0.5, spin: crew === 'noise' ? 0.6 : 0, pop: true });
    }

    // ---- pigeons scatter when a group walks through them
    if (mode === 'walk' && SQ.units && SQ.units.pigeonsScatter && (G.pigT = (G.pigT || 0) - dt) <= 0) {
      G.pigT = 0.3;
      SQ.units.pigeonsScatter(gx, gz, (side.crew === 'pack' ? 9 : 5) * zk);
    }

    // ---- free dogs (the Pack, hanging out: off the leash)
    if (side.crew === 'pack' && V.dogPool) drawDogs(G, g, camp, dt, zk);
    G.headY = headY; G.cx = cx; G.cz = cz;
  }

  function hangAnim(crew, k, G, sit) {
    if (sit) return ANIM.SIT;
    const t = V.time + G.id * 1.3 + k * 2.1;
    if (crew === 'noise') return k < 4 ? ANIM.ATTACK : (Math.sin(t * 0.7) > 0.4 ? ANIM.CHEER : ANIM.IDLE);
    if (crew === 'hustle') return Math.sin(t * 0.45) > 0.85 ? ANIM.ATTACK : ANIM.IDLE;  // "check!" gestures
    if (crew === 'violets') return Math.sin(t * 0.5) > 0.8 ? ANIM.CHEER : ANIM.IDLE;    // group selfies
    return ANIM.IDLE;
  }

  function moveMember(m, tx, tz, face, dt, maxSpd) {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    let step = 0;
    if (d > 18) { m.x = tx; m.z = tz; }
    else if (d > 0.02) {
      step = Math.min(d, Math.max(d * Math.min(1, dt * 5), 0), maxSpd * dt);
      m.x += dx / d * step; m.z += dz / d * step;
    }
    m.spd = dt > 0 ? step / dt : 0;
    const want = m.spd > 0.6 ? Math.atan2(dx, dz) : face;
    m.face += angDiff(m.face, want) * Math.min(1, dt * 8);
    m.phase += Math.min(m.spd, 9) * dt * 3.4;
    const ww = m.spd > 0.5 ? Math.min(1, m.spd / 3 + 0.25) : 0;
    m.walk += (ww - m.walk) * Math.min(1, dt * 8);
  }

  function stepGhost(G, gh, dt) {
    gh.t += dt;
    if (gh.t < 0.9) return; // the beat: hands up, punchline
    let move = 4.5 * dt * V.view.zoomK;
    while (move > 0 && gh.i < gh.pts.length) {
      const p = gh.pts[gh.i];
      const dx = p[0] - gh.x, dz = p[1] - gh.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { gh.i++; continue; }
      const s = Math.min(d, move);
      gh.x += dx / d * s; gh.z += dz / d * s; move -= s;
      gh.heading += angDiff(gh.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    }
    if (gh.t > 4.8 || gh.i >= gh.pts.length) gh.done = gh.t > 4.6;
  }

  function drawCoffeeTag2(G, g, st, side) {
    // a little cup at the home entrance: "back in 0:12"
    const e = st.sides[g.side].entrance;
    if (!G.coffeeTag) G.coffeeTag = canvasSprite(128, 26, 45);
    drawCoffeeTag(G.coffeeTag, 'back in ' + fmtClock(g.backIn), side.rgb);
    G.coffeeTagPos = { x: e.x, z: e.z };
  }

  // ------------------------------------------------------------------ camps
  const _cm = new THREE.Matrix4();
  function drawCamp(G, C, side, st, dt) {
    const K = V.campPools[side.crew + '|' + side.hex]; if (!K) return;
    const zk = V.view.zoomK, sc = CAMP * zk;
    const c = Math.cos(C.yaw), s = Math.sin(C.yaw);
    for (const pc of K.kit.pieces) {
      const pool = K.pools[pc.type]; if (!pool) continue;
      const u = clamp((C.k - pc.a) / (pc.b - pc.a), 0, 1);
      if (u <= 0.001) continue;
      const x = C.x + (pc.x * c + pc.z * s) * sc, z = C.z + (-pc.x * s + pc.z * c) * sc;
      let y = gy(x, z), sx = sc, sy = sc, sz = sc, pitch = 0;
      const e = backOut(u);
      if (pc.mode === 'unfold') { sy = sc * Math.max(0.05, e); pitch = (1 - smooth(u)) * 0.9; }
      else if (pc.mode === 'unroll') { sz = sc * Math.max(0.03, smooth(u)); sx = sc * (0.6 + 0.4 * smooth(u)); }
      else if (pc.mode === 'drop') { y += (1 - smooth(u)) * 1.6 * sc; const k = Math.max(0.05, Math.min(1, u * 1.6)); sx = sy = sz = sc * k; }
      else if (pc.mode === 'rise') { sy = sc * Math.max(0.05, smooth(u)); }
      else { sx = sy = sz = sc * Math.max(0.05, e); }
      pool.push(compose(x, y, z, C.yaw + pc.yaw, sx, sy, sz, pitch, 0), 0, 0, 0, C.target <= 0 && C.k < 0.3 ? 1 - C.k / 0.3 : 0, 0, 0, 0, 0);
    }
  }

  function drawDogs(G, g, camp, dt, zk) {
    const want = camp && camp.k > 0.95 && g.earning ? (g.arguing ? 2 : 3) : 0;
    while (G.dogs.length < want) {
      const k = G.dogs.length;
      const m = G.members[k % G.members.length];
      G.dogs.push({ x: m.x, z: m.z, face: 0, phase: hrand(G.id + k) * 6, a: hrand(G.id * 3 + k) * TAU, r: 2.4 + k * 0.7, w: (k % 2 ? -1 : 1) * (1.3 + hrand(k + G.id) * 0.6), coat: DOG_COATS[(G.id * 3 + k) % DOG_COATS.length], fade: 1, out: 0 });
    }
    for (let k = G.dogs.length - 1; k >= 0; k--) {
      const D = G.dogs[k];
      const leaving = k >= want;
      D.fade += ((leaving ? 1 : 0) - D.fade) * Math.min(1, dt * (leaving ? 3 : 4));
      if (leaving && D.fade > 0.97) { G.dogs.splice(k, 1); continue; }
      D.out = Math.min(1, D.out + dt * 0.8);
      D.a += D.w * dt;
      const cxp = camp ? camp.x : G.x, czp = camp ? camp.z : G.z;
      const r = D.r * zk * (0.4 + 0.6 * smooth(D.out)) * (1 + 0.15 * Math.sin(V.time * 2 + k));
      const tx = cxp + Math.sin(D.a) * r, tz = czp + Math.cos(D.a) * r;
      const dx = tx - D.x, dz = tz - D.z, d = Math.hypot(dx, dz);
      const spd = dt > 0 ? Math.min(d / dt, 9) : 0;
      if (d > 0.001) { D.x = tx; D.z = tz; D.face += angDiff(D.face, Math.atan2(dx, dz)) * Math.min(1, dt * 10); }
      D.phase += spd * dt * 3.2;
      const s = 1.5 * zk;
      const kk = V.dogPool.push(compose(D.x, gy(D.x, D.z) + Math.abs(Math.sin(D.phase)) * 0.12, D.z, D.face, s, s, s, 0, 0), D.phase, 1, ANIM.WALK, D.fade, hrand(k + G.id), 0, 0, 0);
      V.dogPool.tint(kk, D.coat[0], D.coat[1], D.coat[2], 1);
    }
  }

  // ------------------------------------------------------------------ spots
  function updateSpots(st, dt) {
    const U = V.spotU; if (!U) return;
    for (const S of V.spots) {
      if (S.idx >= MAX_SPOTS) continue;
      const s = st.spots[S.idx];
      const A = U.uA.value[S.idx], B = U.uB.value[S.idx], C = U.uC.value[S.idx], D = U.uD.value[S.idx];
      S.pulse = Math.max(0, S.pulse - dt * 1.6);
      const holder = s.holder >= 0 ? V.sides[s.holder] : null;
      if (holder) A.set(holder.rgb[0], holder.rgb[1], holder.rgb[2], 1); else A.set(1, 1, 1, 0);
      if (!holder && s.settleSide >= 0) {
        const sd = V.sides[s.settleSide];
        const prog = s.settle / ((V.match && V.match.rules && V.match.rules.settleTime) || 3);
        B.set(sd.rgb[0], sd.rgb[1], sd.rgb[2], clamp(prog, 0, 1));
      } else B.set(1, 1, 1, -1);
      // the other colour: a challenger when arguing, else a group walking here (yours first)
      let other = -1;
      if (s.arguing) { for (let k = 0; k < s.present.length; k++) if (s.present[k] > 0 && k !== s.holder) { other = k; break; } }
      let incoming = -1;
      if (other < 0) {
        for (const g of st.groups) {
          if (g.spot !== s.idx || !g.moving || g.coffee || g.at === s.idx) continue;
          if (g.side === s.holder) continue;
          if (incoming < 0 || g.side === st.player) incoming = g.side;
        }
      }
      const oc = other >= 0 ? V.sides[other].rgb : incoming >= 0 ? V.sides[incoming].rgb : [1, 1, 1];
      S.hover += ((V.hover && (V.hover.spot === S.idx || V.hover.spot === S.id) ? 1 : 0) - S.hover) * Math.min(1, dt * 10);
      const hl = V.highlights.some((h) => { const r = resolveSpot(h); return r && r.idx === S.idx; }) ? 1 : 0;
      C.set(s.arguing ? 1 : 0, S.hover, incoming >= 0 ? 1 : 0, hl);
      D.set(oc[0], oc[1], oc[2], S.pulse);
      // hand-over flourish
      if (s.holder !== S.prevHolder) {
        if (s.holder >= 0) {
          const sd = V.sides[s.holder];
          for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; emit({ x: s.x + Math.sin(a) * s.r * 0.9, y: gy(s.x, s.z) + 0.6, z: s.z + Math.cos(a) * s.r * 0.9, vy: 2.4 + hrand(k) * 1.5, grav: 3, life: 1.0, size: 12, rgb: sd.rgb, tint: 0.8, cell: ICON.spark, spin: 3 }); }
          S.pulse = 1;
        }
        S.prevHolder = s.holder;
      }
    }
  }

  function earningTick(st) {
    const sec = Math.floor(st.t + 1e-6);
    if (sec === V.earnSec) return;
    const jumped = sec - V.earnSec > 2;
    V.earnSec = sec;
    if (jumped) return;
    const zk = V.view.zoomK;
    for (const S of V.spots) {
      const s = st.spots[S.idx];
      if (s.holder < 0) continue;
      S.pulse = 1;
      let src = null;
      for (const g of st.groups) if (g.at === s.idx && g.side === s.holder && g.earning) { const G = V.groups[g.id]; G.glow = 1; if (!src) src = G; }
      if (!HV.options.floaters) continue;
      const sd = V.sides[s.holder];
      // "+1" rises beside the group that is earning it (the cause), on its screen-right side
      let x = s.x, z = s.z;
      if (src && src.cx !== undefined) {
        const R = src.ringR * zk * 1.15;
        x = src.cx - V.view.fwdZ * R; z = src.cz + V.view.fwdX * R;
      }
      const p = project(x, gy(x, z) + 2, z, {});
      if (!p.onScreen) continue;
      emit({ x, y: gy(x, z) + 0.9 * zk, z, vy: 1.0 * zk, life: 1.6, size: 22, rgb: sd.rgb.map((c) => Math.min(1, c * 1.1 + 0.08)), tint: 1, cell: ICON.plus1, fadeIn: 0.12, pop: true });
    }
  }

  function celebrate(st) {
    if (st.winner < 0) return;
    const sd = V.sides[st.winner];
    if (SQ.fx && SQ.fx.confetti) for (const s of st.spots) if (s.holder === st.winner) try { SQ.fx.confetti(s.x, s.z, sd.hex, 50); } catch (e) { /* optional */ }
    if (SQ.fx && SQ.fx.fireworks && !reduced()) try { SQ.fx.fireworks(0, -62); } catch (e) { /* optional */ }
  }

  // ------------------------------------------------------------------ entrances + tutorial highlights
  function updateEntrances(st) {
    for (const sd of st.sides) {
      const e = sd.entrance; const side = V.sides[sd.idx];
      pushRing(e.x, e.z, 3.4 * V.view.zoomK, side.rgb, sd.idx === st.player ? 0.85 : 0.6, 5, false, 0, 0);
    }
  }
  function updateHighlights(st) {
    const zk = V.view.zoomK;
    for (const h of V.highlights) {
      const s = resolveSpot(h);
      if (s) continue; // drawn by the spot shader
      const g = resolveGroup(h);
      if (g && !g.coffee) { const G = V.groups[g.id]; pushRing(G.x + G.sep.x, G.z + G.sep.z, G.ringR * zk * 1.25, [1, 0.89, 0.42], 1, 4, false, 0, 0); }
      if (h && typeof h === 'object' && h.entrance !== undefined) { const e = st.sides[h.entrance] && st.sides[h.entrance].entrance; if (e) pushRing(e.x, e.z, 5 * zk, [1, 0.89, 0.42], 1, 4, false, 0, 0); }
    }
  }

  // ------------------------------------------------------------------ labels, tags, bars, bubbles (screen layout)
  const _pp = {};
  function layoutLabels(st, dt) {
    const uiK = V.view.uiK;
    const rects = [];
    const zk = V.view.zoomK;
    // spot labels: at the far edge of the spot (top of the circle on screen), always readable
    for (const S of V.spots) {
      const s = st.spots[S.idx];
      const L = S.label;
      if (!HV.options.labels) { L.spr.visible = false; continue; }
      drawSpotLabel(L, s, st);
      // the near edge of the spot (bottom of the area on screen): the sign hangs below it, so it never
      // competes with the name tags that stand above the groups inside the spot
      let r = s.r;
      if (s.poly) { r = 0; for (const p of s.poly) r = Math.max(r, -((p[0] - s.x) * V.view.fwdX + (p[1] - s.z) * V.view.fwdZ)); }
      const ax = s.x - V.view.fwdX * r, az = s.z - V.view.fwdZ * r;
      const ay = Math.max(0, gy(ax, az)) + 0.3;
      S.ax = ax; S.ay = ay; S.az = az;
      project(ax, ay, az, _pp);
      const hl = V.highlights.some((h) => { const q = resolveSpot(h); return q && q.idx === S.idx; });
      const scale = uiK * (hl ? 1.12 : 1);
      const gap = 4;
      // a sign by the edge of the screen slides along it instead of being cut off (one that would have to slide
      // further than its own width is for a spot well off screen: hidden, the mini map shows where that is)
      const shift = _pp.behind ? 0 : edgeShift(_pp.x, L.pw * scale / 2);
      const far = Math.abs(shift) > L.pw * scale;
      const k = shift * metersPerPx(ax, ay, az);
      placeSprite(L, ax + V.view.rtX * k, ay + V.view.rtY * k, az + V.view.rtZ * k, -(gap + L.ph * scale), scale, _pp.behind || far ? 0 : 1);
      const sx = _pp.x + shift;
      L.sx = sx; L.sy = _pp.y + gap + L.ph * scale / 2; L.rw = L.pw * scale; L.rh = L.ph * scale;
      rects.push({ x0: sx - L.pw * scale / 2, x1: sx + L.pw * scale / 2, y0: _pp.y + gap, y1: _pp.y + gap + L.ph * scale, fixed: true });
      if (far) { L.rw = 0; rects.pop(); }
      if (hl && !far) emitArrow(ax, ay, az, -gap + 2); // tutorial pointer: an arrow pointing at the spot's sign
    }
    // group tags: above the heads; pushed up when they would overlap a label, another tag, a patience bar or the
    // selection arrow (a group leaving for coffee fades fast, under the others, and nothing makes room for it)
    const tags = [];
    for (const G of V.groups) {
      const g = st.groups[G.id];
      const T = G.tag;
      const leaving = !!(g.coffee && G.ghost && !G.ghost.done);
      const vis = HV.options.tags && !(g.coffee && (!G.ghost || G.ghost.done)) && !(leaving && G.ghost.t > 1.8);
      if (!vis) { T.spr.visible = false; continue; }
      drawTag(T, G, g, V.sides[G.side], st);
      const ax = G.cx, az = G.cz, ay = G.headY;
      project(ax, ay, az, _pp);
      if (_pp.behind) { T.spr.visible = false; continue; }
      const isPlayer = G.side === st.player;
      const sel = V.sel === G.id;
      const scale = uiK * (isPlayer ? 1 : 0.92) * (sel ? 1.1 : 1);
      const showBar = (g.patience < 99.5 || g.arguing) && !g.coffee;
      const base = showBar ? 13 : 3;
      // a tag by the edge of the screen slides along it (the bar and the arrow stay over the heads)
      const shift = edgeShift(_pp.x, T.pw * scale / 2);
      if (Math.abs(shift) > T.pw * scale * 0.75) { T.spr.visible = false; continue; }
      tags.push({ G, g, T, ax, ay, az, sx: _pp.x + shift, bx: _pp.x, shift, sy: _pp.y, scale, base, showBar, w: T.pw * scale, h: T.ph * scale, isPlayer, sel, leaving });
    }
    // the patience bars sit right above the heads: tags keep clear of other groups' bars too
    for (const t of tags) if (t.showBar && !t.leaving) rects.push({ x0: t.bx - 28 * t.scale, x1: t.bx + 28 * t.scale, y0: t.sy - 15 * t.scale, y1: t.sy - 3 * t.scale, bar: t.G.id });
    tags.sort((a, b) => (a.leaving - b.leaving) || (b.sel - a.sel) || (b.isPlayer - a.isPlayer) || (b.sy - a.sy));
    for (const t of tags) {
      let off = t.base;
      const extra = t.sel ? 30 : 0;   // room for the bouncing selection arrow above the selected tag
      if (!t.leaving) {
        // climb above whatever is in the way (up to 110 px); if that is not enough, try a little to either side
        const climb = (cx) => {
          let o = t.base;
          for (let iter = 0; iter < 10; iter++) {
            const x0 = cx - t.w / 2, x1 = cx + t.w / 2, y1 = t.sy - o, y0 = y1 - t.h - extra;
            let hit = null;
            for (const r of rects) if (r.bar !== t.G.id && x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0) { hit = r; break; }
            if (!hit) return { o, ok: true };
            o = t.sy - hit.y0 + 2;
            if (o > t.base + 110) return { o: t.base + 110, ok: false };
          }
          return { o: Math.min(o, t.base + 110), ok: false };
        };
        let best = climb(t.sx), want = 0;
        if (!best.ok) {
          for (const f of [-0.7, 0.7]) {
            const c = climb(t.sx + f * t.w);
            if (c.ok) { best = c; want = f * t.w; break; }
          }
        }
        off = best.o;
        const G0 = t.G;
        G0.tagDx = (G0.tagDx || 0) + (want - (G0.tagDx || 0)) * Math.min(1, dt * 8);
        if (Math.abs(G0.tagDx) > 0.5) { t.shift += G0.tagDx; t.sx += G0.tagDx; }
      }
      const G = t.G;
      G.tagOff += (off - G.tagOff) * Math.min(1, dt * 10);
      if (Math.abs(off - G.tagOff) > 60) G.tagOff = off;
      if (!t.leaving) rects.push({ x0: t.sx - t.w / 2, x1: t.sx + t.w / 2, y0: t.sy - G.tagOff - t.h - extra, y1: t.sy - G.tagOff });
      t.T.spr.renderOrder = t.leaving ? 41 : 43;
      const fade = t.leaving ? 1 - clamp((G.ghost.t - 0.6) / 1.2, 0, 1) : G.arrive < 1 ? G.arrive : 1;
      const k = t.shift * metersPerPx(t.ax, t.ay, t.az);
      placeSprite(t.T, t.ax + V.view.rtX * k, t.ay + V.view.rtY * k, t.az + V.view.rtZ * k, G.tagOff, t.scale, (t.isPlayer ? 1 : 0.94) * fade);
      t.T.sx = t.sx; t.T.sy = t.sy - G.tagOff - t.h / 2; t.T.rw = t.w; t.T.rh = t.h;
      if (t.showBar) {
        const pat = clamp(t.g.patience / 100, 0, 1);
        const col = pat > 0.6 ? [0.36, 0.84, 0.42] : pat > 0.3 ? [1, 0.83, 0.3] : [1, 0.36, 0.29];
        pushBar(t.ax, t.ay, t.az, 54 * t.scale, 8 * t.scale, 5 * t.scale, pat, col, fade, t.g.arguing ? 1 : 0);
      }
      if (t.sel) emitArrow(t.ax, t.ay, t.az, G.tagOff + t.h + 4);
      G.tagTop = t.sy - G.tagOff - t.h;
    }
    // bubbles: above their group's tag
    for (const B of V.bubbles) {
      B.t += dt;
      const G = B.G;
      const alive = B.t < B.life && G;
      if (!alive) { B.S.spr.visible = false; continue; }
      const T = G.tag;
      if (!T.spr.visible) { B.S.spr.visible = false; continue; }
      const k = B.t / B.life;
      const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
      project(G.cx, G.headY, G.cz, _pp);
      const off = G.tagOff + T.ph * uiK + 2;
      placeSprite(B.S, G.cx, G.headY, G.cz, off, uiK, a);
    }
    V.bubbles = V.bubbles.filter((B) => { if (B.t >= B.life) { disposeSprite(B.S); return false; } return true; });
    // coffee tags at the entrances
    const perSide = {};
    for (const G of V.groups) {
      const C = G.coffeeTag; if (!C) continue;
      const g = st.groups[G.id];
      if (!g.coffee || (G.ghost && !G.ghost.done)) { C.spr.visible = false; continue; }
      const p = G.coffeeTagPos; if (!p) continue;
      const n = perSide[G.side] = (perSide[G.side] || 0) + 1;
      placeSprite(C, p.x, gy(p.x, p.z) + 1, p.z, 4 + (n - 1) * 24 * uiK, uiK, 0.95);
    }
    void zk;
  }
  /** Horizontal shift (px) that keeps something halfW wide, centred at x, fully on screen. */
  function edgeShift(x, halfW) {
    const M = 6, left = V.view.left + M, right = V.view.left + V.view.w - M;
    let d = 0;
    if (x - halfW < left) d = left - (x - halfW); else if (x + halfW > right) d = right - (x + halfW);
    return d;
  }
  function emitArrow(x, y, z, offPx) {
    // a bouncing arrow over the target (one-frame particle, re-emitted each frame)
    // offset along the camera's up axis = straight up on screen at the anchor's depth (exact pixels)
    const bob = reduced() ? 0 : Math.abs(Math.sin(V.time * 4)) * 6;
    const d = (offPx + 12 + bob) * metersPerPx(x, y, z);
    emit({ x: x + V.view.upX * d, y: y + V.view.upY * d, z: z + V.view.upZ * d, size: 22, rgb: [1, 0.89, 0.42], tint: 1, cell: ICON.arrow, one: true });
  }

  // ================================================================== queries for the UI
  HV.screenPos = function (target) {
    const st = V.state; if (!st) return null;
    const out = {};
    const s = resolveSpot(target);
    if (s) {
      project(s.x, gy(s.x, s.z) + 1, s.z, out);
      const S = V.spots[s.idx];
      if (S && S.label) { out.tagX = S.label.sx; out.tagY = S.label.sy; }
      return out;
    }
    const g = resolveGroup(target);
    if (g) {
      const G = V.groups[g.id];
      if (g.coffee) { const e = st.sides[g.side].entrance; project(e.x, gy(e.x, e.z) + 1, e.z, out); out.coffee = true; return out; }
      project(G.cx !== undefined ? G.cx : g.x, gy(g.x, g.z) + 1.5 * V.view.zoomK, G.cz !== undefined ? G.cz : g.z, out);
      // the name tag's centre (and its top edge) in client px
      out.tagX = out.x; out.tagY = G.tag.sy !== undefined && G.tag.spr.visible ? G.tag.sy : out.y - 50;
      out.tagTop = G.tagTop !== undefined ? G.tagTop : out.y - 70;
      return out;
    }
    if (target && typeof target === 'object' && target.entrance !== undefined) {
      const e = st.sides[target.entrance] && st.sides[target.entrance].entrance;
      if (e) return project(e.x, gy(e.x, e.z) + 1, e.z, out);
    }
    return null;
  };
  HV.worldPos = function (target) {
    const st = V.state; if (!st) return null;
    const s = resolveSpot(target); if (s) return { x: s.x, y: gy(s.x, s.z), z: s.z };
    const g = resolveGroup(target);
    if (g) { const G = V.groups[g.id]; return { x: G.cx !== undefined ? G.cx : g.x, y: gy(g.x, g.z), z: G.cz !== undefined ? G.cz : g.z }; }
    if (target && typeof target === 'object' && target.entrance !== undefined) { const e = st.sides[target.entrance].entrance; return { x: e.x, y: gy(e.x, e.z), z: e.z }; }
    return null;
  };
  // Tap/click → what is under it. Groups win (their tag or their cluster, with a generous touch radius),
  // then spots (their area or their label), then the ground.
  HV.pick = function (cx, cy, opts) {
    opts = opts || {};
    const st = V.state; if (!st || !V.attached) return null;
    const touch = opts.touch !== undefined ? opts.touch : (SQ.input && SQ.input.isTouch);
    let best = null, bd = Infinity;
    for (const G of V.groups) {
      const g = st.groups[G.id];
      if (g.coffee) continue;
      if (opts.side !== undefined && opts.side !== null && g.side !== opts.side) continue;
      const T = G.tag;
      if (T.spr.visible && T.rw && Math.abs(cx - T.sx) <= T.rw / 2 + 4 && Math.abs(cy - T.sy) <= T.rh / 2 + 4) { const d = Math.abs(cy - T.sy); if (d < bd) { bd = d; best = G; } continue; }
      const px = G.cx !== undefined ? G.cx : g.x, pz = G.cz !== undefined ? G.cz : g.z;
      project(px, gy(px, pz) + 1.3 * V.view.zoomK, pz, _pp);
      if (!_pp.onScreen) continue;
      const rPx = Math.max(touch ? 34 : 24, G.ringR * V.view.zoomK / metersPerPx(px, 1, pz));
      const d = Math.hypot(cx - _pp.x, cy - _pp.y);
      if (d <= rPx && d < bd) { bd = d; best = G; }
    }
    if (best) return { type: 'group', id: best.id, side: best.side };
    for (const S of V.spots) {
      const L = S.label;
      if (L.spr.visible && L.rw && Math.abs(cx - L.sx) <= L.rw / 2 && Math.abs(cy - L.sy) <= L.rh / 2) return { type: 'spot', idx: S.idx, id: S.id };
    }
    const R = SQ.render;
    const p = R && R.screenToGround ? R.screenToGround(cx, cy) : null;
    if (!p) return null;
    const si = SQ.Hangout && SQ.Hangout.spotAt ? SQ.Hangout.spotAt(st, p.x, p.z) : -1;
    if (si >= 0) return { type: 'spot', idx: si, id: st.spots[si].id, x: p.x, z: p.z };
    // a near miss on a small spot still counts on touch
    if (touch) for (const s of st.spots) if (Math.hypot(p.x - s.x, p.z - s.z) < s.r + 3) return { type: 'spot', idx: s.idx, id: s.id, x: p.x, z: p.z };
    return { type: 'ground', x: p.x, z: p.z };
  };

  HV.timeOfDay = function (state) {
    state = state || V.state;
    let tod = 0.12;
    // afternoon → the start of golden hour over the match: the light is the timer, and it stays bright enough to read
    if (state && state.length > 0) tod = 0.08 + 0.28 * clamp(state.t / state.length, 0, 1);
    return { tod, phase: tod < 0.333 ? 'afternoon' : 'golden' };
  };

  // Canopy fade: the selected group and the wooded spots nearest the middle of the screen.
  HV.focus = function (out, max) {
    const st = V.state; if (!st || !V.attached) return;
    max = max || 3;
    const cand = [];
    if (V.sel >= 0 && st.groups[V.sel] && !st.groups[V.sel].coffee && V.groups[V.sel] && V.groups[V.sel].cx !== undefined) { const G = V.groups[V.sel]; cand.push({ x: G.cx, z: G.cz, r: 12, s: 1e6 }); }
    const midX = V.view.left + V.view.w / 2, midY = V.view.top + V.view.h / 2;
    for (const S of V.spots) {
      if (!S.trees) continue;
      const s = st.spots[S.idx];
      project(s.x, 0, s.z, _pp);
      if (!_pp.onScreen) continue;
      const busy = s.holder >= 0 || s.present.some((n) => n > 0) ? 2e5 : 0;
      cand.push({ x: s.x, z: s.z, r: s.r + 7, s: busy - Math.hypot(_pp.x - midX, _pp.y - midY) });
    }
    for (const G of V.groups) {
      const g = st.groups[G.id];
      if (g.coffee || g.at >= 0 || G.cx === undefined || treesNear(G.cx, G.cz, 7) === 0) continue;
      project(G.cx, 0, G.cz, _pp);
      if (!_pp.onScreen) continue;
      cand.push({ x: G.cx, z: G.cz, r: 10, s: (g.side === st.player ? 1e5 : 5e4) - Math.hypot(_pp.x - midX, _pp.y - midY) });
    }
    cand.sort((a, b) => b.s - a.s);
    for (let i = 0; i < Math.min(max, cand.length); i++) out.push({ x: cand[i].x, z: cand[i].z, r: cand[i].r });
  };

  /**
   * See-through sightlines for the buildings (js/render/textures.js 'see' shader): the five spots and the selected
   * group. Building walls and roofs between the camera and any of them are dithered away, so a spot by the park's
   * edge (the Toddler Playground behind 2 Fifth Avenue from the north) never looks like a ring on a roof.
   */
  HV.seeThrough = function (out, max) {
    const st = V.state; if (!st || !V.attached) return out;
    max = max || 6;
    if (V.sel >= 0 && V.groups[V.sel] && st.groups[V.sel] && !st.groups[V.sel].coffee && V.groups[V.sel].cx !== undefined) {
      const G = V.groups[V.sel]; out.push({ x: G.cx, y: 1.5, z: G.cz, r: 10 });
    }
    for (const s of st.spots) {
      if (out.length >= max) break;
      let r = s.r;
      if (s.poly) { r = 0; for (const p of s.poly) r = Math.max(r, Math.hypot(p[0] - s.x, p[1] - s.z)); }
      out.push({ x: s.x, y: 1.5, z: s.z, r: r + 9 });
    }
    return out;
  };

  HV.stats = function () {
    if (!V.attached) return { attached: false };
    let people = 0; for (const k in V.pools) if (V.pools[k].pool) people += V.pools[k].pool.n;
    let props = 0; for (const k in V.campPools) for (const t in V.campPools[k].pools) props += V.campPools[k].pools[t].n;
    return { attached: true, people, props, dogs: V.dogPool ? V.dogPool.n : 0, particles: V.parts ? V.parts.list.length : 0, rings: V.rings ? V.rings.n : 0,
      bars: V.bars ? V.bars.n : 0, bubbles: V.bubbles.length, tagsVisible: V.groups.filter((G) => G.tag.spr.visible).length,
      labelsVisible: V.spots.filter((S) => S.label.spr.visible).length, paths: V.groups.filter((G) => G.path.mesh.visible).length };
  };
  HV._V = V; // debugging
})(window.SQ = window.SQ || {});
