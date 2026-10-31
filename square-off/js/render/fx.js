// SQUARE OFF — Render B: juice and world feedback (DESIGN §10, §3.2, §2.2).
// Capture rings with chalk-dash progress and a CONTESTED flash (depth test off, one draw call for all
// rings), owner tint discs, landmark labels, build pads and Setups (food carts, boomboxes, benches,
// chess tables, tip jars, club fair tables, water bowls), chalk tags stamped on flips, Sway glyph
// particles (♪ ♫ $ ! ? ♞ woof) with CRIT pops on counter hits, Over-It speech bubbles, comic squad-wipe
// words, floating capture titles and Clout pops, Crew Call effects (Tournament chess clock + boards,
// Drum Circle drummers, Group Chat phones, Zoomies dogs + dust), confetti, fireworks over the Arch,
// rain, order pings, ghost path lines, Crew Call target previews and the rally flag.
//
// SQ.fx API:
//   init(ctx)  setMatch(m)  update(state, alpha, dt, camera)  dispose()
//   showPath(points [[x,z]...], kind?, life?)   clearPath()      ghost path (kind: 'move'|'take'|'attack')
//   setTarget(null | {kind:'circle', x, z, r, color} | {kind:'line', x, z, x2, z2, color})   Crew Call preview
//   ping(x, z, kind)        order feedback ring ('move'|'take'|'attack'|'rally'|'deny')
//   pop(text, x, y, z, {color, size, life, rise, font})   floating world text
//   bubble(text, unitId | {x, z}, opts)   speech bubble (max 4)
//   wash(color)   confetti(x, z, color, n)   fireworks(x, z)   hoverLandmark(idx|-1)   selectLandmark(idx|-1)
//   bubbles: true  (fx draws Over-It bubbles; HUD can skip them)
(function (SQ) {
  'use strict';
  const MAX_LM = 20;
  const FX = {
    ctx: null, root: null, match: null, offs: [], quality: 'med', pmul: 1,
    lmRing: null, lmFill: null, lmU: null, labels: [], tags: [], contestedSpr: [],
    pads: null, setupPools: {}, scaffold: null,
    parts: null, confetti: null, rain: null, pings: null, path: null, target: null, flag: null,
    pops: [], bubbles: [], effects: new Map(), clock: null, boards: null, drummers: null, dogs: null,
    hoverLm: -1, selLm: -1, setupBorn: new Map(), time: 0, washEl: null, lastHitFx: 0, hitBudget: 0,
  };
  const SQfx = SQ.fx = SQ.fx || {};
  SQfx.bubbles = true;

  function lib() { return SQ.units && SQ.units.lib; }
  function colOf(state, f) { return SQ.render && SQ.render.colorOf ? SQ.render.colorOf(state, f) : ((state && state.factions[f] && state.factions[f].color) || '#ffffff'); }
  function reduced() { return SQ.render && SQ.render.options && SQ.render.options.reducedMotion; }
  function gy(x, z) { return SQ.render && SQ.render.groundY ? SQ.render.groundY(x, z) : 0; }
  function pxScale(x, y, z) { return SQ.render && SQ.render.pxPerMeter ? 1 / SQ.render.pxPerMeter(x, y, z) : 0.1; }

  // =============================================================== landmark rings
  function ringShader() {
    const st = [], own = [], cap = [];
    for (let i = 0; i < MAX_LM; i++) { st.push(new THREE.Vector4()); own.push(new THREE.Vector4(0.9, 0.9, 0.9, 0)); cap.push(new THREE.Vector4(1, 1, 1, 0)); }
    const uni = { uTime: { value: 0 }, uSt: { value: st }, uOwn: { value: own }, uCap: { value: cap }, uHover: { value: -1 }, uSel: { value: -1 } };
    const vs = `
attribute float aLm; attribute float aU; attribute float aV; attribute float aPerim;
uniform vec4 uSt[${MAX_LM}]; uniform vec4 uOwn[${MAX_LM}]; uniform vec4 uCap[${MAX_LM}];
uniform float uHover; uniform float uSel;
varying float vU; varying float vV; varying float vPerim; varying vec4 vSt; varying vec4 vOwn; varying vec4 vCap; varying float vHover;
void main(){
  int i = int(aLm + 0.5);
  vU = aU; vV = aV; vPerim = aPerim; vSt = uSt[i];
  vOwn = vec4(pow(uOwn[i].rgb, vec3(0.4545)), uOwn[i].a); vCap = vec4(pow(uCap[i].rgb, vec3(0.4545)), uCap[i].a);
  vHover = (abs(aLm - uHover) < 0.5 ? 1.0 : 0.0) + (abs(aLm - uSel) < 0.5 ? 2.0 : 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
    return { uni, vs };
  }

  function buildLandmarkMeshes(state) {
    disposeLandmarkMeshes();
    const lms = state.landmarks.slice(0, MAX_LM);
    const pos = [], aLm = [], aU = [], aV = [], aPer = [], idx = [];
    const fpos = [], faLm = [], fidx = [];
    for (const lm of lms) {
      let pts;
      if (lm.poly && lm.poly.length > 2) pts = lm.poly.map((p) => [p[0], p[1]]);
      else { pts = []; const N = 72; for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; pts.push([lm.x + lm.r * Math.sin(a), lm.z - lm.r * Math.cos(a)]); } }
      // start the perimeter at the northern-most point and go clockwise (as seen from above, north up)
      let area = 0;
      for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
      if (area < 0) pts.reverse(); // ensure clockwise on screen (x right, z down) => positive shoelace in x/z
      let top = 0; for (let k = 1; k < pts.length; k++) if (pts[k][1] < pts[top][1]) top = k;
      pts = pts.slice(top).concat(pts.slice(0, top));
      const n = pts.length;
      const cum = [0]; let L = 0;
      for (let k = 1; k <= n; k++) { const a = pts[k - 1], b = pts[k % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
      const W = lm.isHome ? 0.7 : 1.0;
      const base = pos.length / 3;
      for (let k = 0; k <= n; k++) {
        const p = pts[k % n], pp = pts[(k - 1 + n) % n], pn = pts[(k + 1) % n];
        let nx = -(pn[1] - pp[1]), nz = (pn[0] - pp[0]);
        const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        // outward = away from the centroid
        if ((p[0] - lm.x) * nx + (p[1] - lm.z) * nz < 0) { nx = -nx; nz = -nz; }
        const y = 0.14 + Math.max(0, gy(p[0], p[1]));
        pos.push(p[0] - nx * W * 0.5, y, p[1] - nz * W * 0.5, p[0] + nx * W * 0.5, y, p[1] + nz * W * 0.5);
        aLm.push(lm.idx, lm.idx); aU.push(cum[k] / L, cum[k] / L); aV.push(0, 1); aPer.push(L, L);
        if (k < n) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      // fill
      const fb = fpos.length / 3;
      const cx = lm.x, cz = lm.z;
      fpos.push(cx, 0.08, cz); faLm.push(lm.idx);
      for (let k = 0; k < n; k++) { fpos.push(pts[k][0], 0.08 + Math.max(0, gy(pts[k][0], pts[k][1])), pts[k][1]); faLm.push(lm.idx); }
      for (let k = 0; k < n; k++) fidx.push(fb, fb + 1 + k, fb + 1 + ((k + 1) % n));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aLm', new THREE.Float32BufferAttribute(aLm, 1));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
    g.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
    g.setAttribute('aPerim', new THREE.Float32BufferAttribute(aPer, 1));
    g.setIndex(idx);
    const sh = ringShader();
    FX.lmU = sh.uni;
    const ringMat = new THREE.ShaderMaterial({
      uniforms: sh.uni, vertexShader: sh.vs,
      fragmentShader: `
uniform float uTime;
varying float vU; varying float vV; varying float vPerim; varying vec4 vSt; varying vec4 vOwn; varying vec4 vCap; varying float vHover;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float meter = vSt.x, contested = vSt.y, attacked = vSt.z, home = vSt.w;
  float s = vU * vPerim;
  float edge = smoothstep(0.0, 0.18, vV) * smoothstep(1.0, 0.82, vV);
  // chalk grain
  float grain = 0.72 + 0.28 * h1(floor(s * 6.0) + floor(vV * 5.0) * 17.0);
  float dash = step(0.42, fract(s / 1.7));
  bool owned = vOwn.w > 0.5;
  vec3 prog = owned ? vOwn.rgb : vCap.rgb;
  float filled = (owned || vCap.w > 0.5) ? step(vU, meter) : 0.0;
  vec3 chalk = vec3(0.95, 0.93, 0.88);
  vec3 col = mix(chalk, prog, filled);
  float a = mix(0.5 * dash, 0.95, filled) * edge * grain;
  // leading edge of an active capture glows
  if (vCap.w > 0.5 && !owned) { float lead = 1.0 - smoothstep(0.0, 0.03, abs(vU - meter)); col = mix(col, vec3(1.0), lead * 0.8); a = max(a, lead * edge); }
  if (home > 0.5) { col = vOwn.rgb; a = 0.75 * edge * step(0.5, fract(s / 1.2)); }
  if (attacked > 0.5) { float p = 0.5 + 0.5 * sin(uTime * 10.0); col = mix(col, vec3(1.0, 0.95, 0.6), p * 0.35); a = max(a, edge * 0.8); }
  if (contested > 0.5) {
    float fl = step(0.5, fract(uTime * 2.6));
    col = mix(vec3(1.0, 0.22, 0.18), vec3(1.0), fl);
    a = edge * (0.75 + 0.25 * dash);
  }
  if (vHover > 0.5) { a = max(a, edge * 0.55); col = mix(col, vec3(1.0), 0.25); }
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    FX.lmRing = new THREE.Mesh(g, ringMat);
    FX.lmRing.renderOrder = 6; FX.lmRing.frustumCulled = false;
    FX.root.add(FX.lmRing);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fg.setAttribute('aLm', new THREE.Float32BufferAttribute(faLm, 1));
    fg.setIndex(fidx);
    const fillMat = new THREE.ShaderMaterial({
      uniforms: sh.uni,
      vertexShader: `
attribute float aLm;
uniform vec4 uSt[${MAX_LM}]; uniform vec4 uOwn[${MAX_LM}]; uniform vec4 uCap[${MAX_LM}]; uniform float uHover; uniform float uSel;
varying vec4 vOwn; varying vec4 vSt; varying vec4 vCap; varying float vHover;
void main(){ int i = int(aLm + 0.5); vSt = uSt[i];
  vOwn = vec4(pow(uOwn[i].rgb, vec3(0.4545)), uOwn[i].a); vCap = vec4(pow(uCap[i].rgb, vec3(0.4545)), uCap[i].a);
  vHover = (abs(aLm - uHover) < 0.5 ? 1.0 : 0.0) + (abs(aLm - uSel) < 0.5 ? 1.0 : 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
uniform float uTime;
varying vec4 vOwn; varying vec4 vSt; varying vec4 vCap; varying float vHover;
void main(){
  float a = vOwn.w > 0.5 ? 0.13 : 0.0;
  vec3 c = vOwn.rgb;
  if (vCap.w > 0.5 && vOwn.w < 0.5) { c = vCap.rgb; a = 0.06 + 0.05 * vSt.x; }
  if (vSt.y > 0.5) { c = vec3(1.0, 0.3, 0.2); a = 0.1 + 0.06 * sin(uTime * 16.0); }
  if (vHover > 0.5) { a += 0.08; c = mix(c, vec3(1.0), 0.3); }
  if (vSt.w > 0.5) a *= 0.6;
  if (a < 0.005) discard;
  gl_FragColor = vec4(c, a);
}`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    FX.lmFill = new THREE.Mesh(fg, fillMat);
    FX.lmFill.renderOrder = 1; FX.lmFill.frustumCulled = false;
    FX.root.add(FX.lmFill);
    // labels
    FX.labels = lms.map((lm) => makeLabel(lm));
    FX.contestedSpr = lms.map(() => null);
    FX.tags = lms.map(() => null);
  }
  function disposeLandmarkMeshes() {
    for (const m of [FX.lmRing, FX.lmFill]) if (m) { FX.root.remove(m); m.geometry.dispose(); m.material.dispose(); }
    FX.lmRing = FX.lmFill = null;
    for (const l of FX.labels) if (l) { FX.root.remove(l.spr); l.tex.dispose(); l.spr.material.dispose(); }
    for (const t of FX.tags) if (t) { FX.root.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); }
    for (const c of FX.contestedSpr) if (c) { FX.root.remove(c.spr); c.spr.material.dispose(); }
    FX.labels = []; FX.tags = []; FX.contestedSpr = [];
  }

  // ---------------------------------------------------------------- canvas text helpers
  const DISPLAY = '"Futura", "Trebuchet MS", "Avenir Next Condensed", "Arial Black", sans-serif';
  const CHALK = '"Chalkboard SE", "Marker Felt", "Comic Sans MS", "Bradley Hand", cursive';
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function makeLabel(lm) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
    spr.renderOrder = 18;
    spr.center.set(0.5, 0);
    FX.root.add(spr);
    const L = { lm, c, tex, spr, key: '' };
    return L;
  }
  function drawLabel(L, state) {
    const lm = L.lm;
    const fac = lm.owner >= 0 ? state.factions[lm.owner] : null;
    const me = state.player;
    const rally = me >= 0 && state.factions[me] && state.factions[me].rally === lm.id && !lm.isHome;
    const key = (fac ? fac.color : '-') + (rally ? 'R' : '') + lm.name;
    if (key === L.key) return;
    L.key = key;
    const ctx = L.c.getContext('2d');
    ctx.clearRect(0, 0, 512, 96);
    const name = lm.isHome ? (lm.owner === me ? 'HOME' : (fac ? fac.short.toUpperCase() + ' HOME' : 'HOME')) : lm.name.toUpperCase();
    ctx.font = '700 34px ' + DISPLAY;
    const tw = Math.min(440, ctx.measureText(name).width);
    const w = tw + 44 + (rally ? 34 : 0), h = 50, x = (512 - w) / 2, y = 30;
    ctx.fillStyle = 'rgba(16,20,18,0.72)';
    roundRect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.fillStyle = fac ? fac.color : '#d9d4c7';
    roundRect(ctx, x, y, 14, h, 7); ctx.fill();
    ctx.fillRect(x + 7, y, 7, h);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 26, y + h / 2 + 1, 440);
    if (rally) { ctx.fillStyle = '#ffd34d'; ctx.font = '700 30px ' + DISPLAY; ctx.fillText('⚑', x + w - 34, y + h / 2); }
    // tail
    ctx.fillStyle = 'rgba(16,20,18,0.72)';
    ctx.beginPath(); ctx.moveTo(256 - 9, y + h); ctx.lineTo(256 + 9, y + h); ctx.lineTo(256, y + h + 12); ctx.fill();
    L.tex.needsUpdate = true;
  }

  // Generic text sprite (pops, titles, bubbles). Pooled per kind.
  function textSprite(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
    spr.renderOrder = 30; spr.visible = false; spr.center.set(0.5, 0);
    FX.root.add(spr);
    return { c, tex, spr, life: 0, t: 0 };
  }

  function drawPopText(P, text, opts) {
    const ctx = P.c.getContext('2d');
    const W = P.c.width, H = P.c.height;
    ctx.clearRect(0, 0, W, H);
    const big = opts.big;
    let size = big ? 92 : 56;
    ctx.font = (big ? '900 ' : '800 ') + size + 'px ' + (opts.font || DISPLAY);
    while (ctx.measureText(text).width > W - 40 && size > 20) { size -= 4; ctx.font = (big ? '900 ' : '800 ') + size + 'px ' + (opts.font || DISPLAY); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = big ? 16 : 10;
    ctx.strokeStyle = 'rgba(12,14,16,0.85)';
    ctx.strokeText(text, W / 2, H / 2);
    ctx.fillStyle = opts.color || '#fff';
    ctx.fillText(text, W / 2, H / 2);
    if (big) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeText(text, W / 2, H / 2); }
    P.tex.needsUpdate = true;
  }

  SQfx.pop = function (text, x, y, z, opts) {
    if (!FX.root) return;
    opts = opts || {};
    const big = !!opts.big;
    let P = FX.pops.find((p) => !p.spr.visible && p.big === big);
    if (!P) {
      if (FX.pops.length >= 18) { P = FX.pops.filter((p) => p.big === big).sort((a, b) => b.t - a.t)[0]; if (!P) return; }
      else { P = textSprite(big ? 1024 : 512, big ? 160 : 96); P.big = big; FX.pops.push(P); }
    }
    drawPopText(P, String(text), opts);
    P.x = x; P.y = y; P.z = z; P.t = 0; P.life = opts.life || (big ? 2.4 : 1.3);
    P.rise = opts.rise !== undefined ? opts.rise : (big ? 1.2 : 2.2);
    P.px = opts.size || (big ? 54 : 26);
    P.spr.visible = true;
  };

  SQfx.bubble = function (text, who, opts) {
    if (!FX.root || !text) return;
    opts = opts || {};
    let B = FX.bubbles.find((b) => !b.spr.visible);
    if (!B) {
      if (FX.bubbles.length < 4) { B = textSprite(512, 160); FX.bubbles.push(B); }
      else {
        // replace the oldest, but never an important (player) one for an unimportant one
        B = FX.bubbles.slice().sort((a, b) => (a.important - b.important) || (b.t - a.t))[0];
        if (B.important && !opts.important) return;
      }
    }
    const ctx = B.c.getContext('2d');
    ctx.clearRect(0, 0, 512, 160);
    ctx.font = '600 30px ' + DISPLAY;
    const words = String(text).split(' '); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > 420 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    lines.length = Math.min(lines.length, 3);
    const tw = Math.max.apply(null, lines.map((l) => ctx.measureText(l).width));
    const bw = Math.min(500, tw + 40), bh = lines.length * 36 + 24;
    const bx = (512 - bw) / 2, by = 160 - 22 - bh;
    ctx.fillStyle = 'rgba(255,255,252,0.96)';
    ctx.strokeStyle = opts.color || '#333';
    ctx.lineWidth = 4;
    roundRect(ctx, bx, by, bw, bh, 18); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(240, by + bh - 2); ctx.lineTo(262, by + bh - 2); ctx.lineTo(244, 158); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(240, by + bh); ctx.lineTo(244, 158); ctx.lineTo(262, by + bh); ctx.stroke();
    ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 256, by + 12 + 18 + i * 36));
    B.tex.needsUpdate = true;
    B.who = who; B.t = 0; B.life = opts.life || 3.2; B.important = !!opts.important;
    if (typeof who === 'object') { B.x = who.x; B.z = who.z; }
    B.spr.visible = true;
  };

  // =============================================================== particles (glyphs, dust, sparkles)
  const GLYPHS = ['♪', '♫', '$', '!', '?', '♞', 'woof', '!?', '★', '●', '▲', '■', 'CRIT!', '✦', '💬', '·'];
  function particleAtlas() {
    const S = 96, cols = 8, rows = 2;
    const c = document.createElement('canvas'); c.width = S * cols; c.height = S * rows;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    GLYPHS.forEach((g, i) => {
      const cx = (i % cols) * S + S / 2, cy = Math.floor(i / cols) * S + S / 2;
      if (g === '●' || g === '▲' || g === '■') {
        const r = S * 0.3; ctx.beginPath();
        if (g === '●') ctx.arc(cx, cy, r, 0, 7); else if (g === '▲') { ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r * 1.1, cy + r * 0.8); ctx.lineTo(cx - r * 1.1, cy + r * 0.8); ctx.closePath(); } else ctx.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
        ctx.lineWidth = 12; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
        return;
      }
      if (g === '·') { const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.45); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(cx - S / 2, cy - S / 2, S, S); return; }
      const len = g.length;
      const fs = len >= 4 ? (g === 'CRIT!' ? 30 : 34) : len === 2 ? 52 : 66;
      ctx.font = '900 ' + fs + 'px ' + DISPLAY;
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(g, cx, cy + 2);
      ctx.fillStyle = '#fff'; ctx.fillText(g, cx, cy + 2);
    });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, cols, rows };
  }
  function makeParticles(cap) {
    const g = new THREE.PlaneGeometry(1, 1);
    const at = particleAtlas();
    const P = { cap, n: 0, list: [], atlas: at,
      iP: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
      iC: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
      iU: new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2) };
    for (const a of [P.iP, P.iC, P.iU]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', P.iP); g.setAttribute('iC', P.iC); g.setAttribute('iU', P.iU);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: at.tex }, uGrid: { value: new THREE.Vector2(at.cols, at.rows) } },
      vertexShader: `
attribute vec4 iP; attribute vec4 iC; attribute vec2 iU;
uniform vec2 uGrid;
varying vec2 vUv; varying vec4 vC;
void main(){
  vec4 c = modelViewMatrix * vec4(iP.xyz, 1.0);
  float r = iU.y; float cs = cos(r), sn = sin(r);
  vec2 q = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs);
  c.xy += q * iP.w;
  gl_Position = projectionMatrix * c;
  float cell = iU.x;
  vec2 cr = vec2(mod(cell, uGrid.x), floor(cell / uGrid.x));
  vUv = (cr + vec2(uv.x, 1.0 - uv.y)) / uGrid; vUv.y = 1.0 - vUv.y;
  vC = vec4(pow(iC.rgb, vec3(0.4545)), iC.a);
}`,
      fragmentShader: `
uniform sampler2D uTex; varying vec2 vUv; varying vec4 vC;
void main(){ vec4 t = texture2D(uTex, vUv);
  vec3 col = mix(vec3(0.0), vC.rgb, t.r);
  float a = t.a * vC.a; if (a < 0.02) discard; gl_FragColor = vec4(col, a); }`,
      transparent: true, depthWrite: false, depthTest: false,
    });
    P.mesh = new THREE.InstancedMesh(g, mat, cap);
    P.mesh.frustumCulled = false; P.mesh.renderOrder = 25; P.mesh.count = 0;
    FX.root.add(P.mesh);
    return P;
  }
  // p: {x,y,z, vx,vy,vz, g (gravity), size (px), color THREE.Color(sRGB), life, glyph idx, spin, arc:{x0..}}
  function emit(p) {
    const P = FX.parts; if (!P) return;
    if (P.list.length >= P.cap) P.list.shift();
    p.t = 0; p.rot = p.rot || 0; p.spin = p.spin || 0; p.g = p.g || 0;
    P.list.push(p);
  }
  function glyphIdx(g) { const i = GLYPHS.indexOf(g); return i < 0 ? 3 : i; }

  function updateParticles(dt) {
    const P = FX.parts; if (!P) return;
    let n = 0;
    const out = [];
    for (const p of P.list) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = p.t / p.life;
      if (p.arc) { // flying Sway glyph: quadratic arc from source to target
        const a = p.arc, s = Math.min(1, p.t / a.dur);
        p.x = a.x0 + (a.x1 - a.x0) * s; p.z = a.z0 + (a.z1 - a.z0) * s;
        p.y = a.y0 + (a.y1 - a.y0) * s + Math.sin(s * Math.PI) * a.h;
      } else {
        p.vy -= p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vz *= d; p.vy *= p.g ? 1 : d; }
        if (p.floor && p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      }
      p.rot += p.spin * dt;
      const pxm = pxScale(p.x, p.y, p.z);
      let size = p.size * pxm;
      if (p.pop) size *= k < 0.15 ? 0.5 + k / 0.15 * 0.8 : 1.3 - (k - 0.15) * 0.4;
      if (p.minW) size = Math.max(size, p.minW);
      const alpha = p.fadeIn && k < 0.1 ? k / 0.1 : k > 0.7 ? (1 - k) / 0.3 : 1;
      P.iP.array[n * 4] = p.x; P.iP.array[n * 4 + 1] = p.y; P.iP.array[n * 4 + 2] = p.z; P.iP.array[n * 4 + 3] = size;
      P.iC.array[n * 4] = p.color.r; P.iC.array[n * 4 + 1] = p.color.g; P.iC.array[n * 4 + 2] = p.color.b; P.iC.array[n * 4 + 3] = alpha * (p.alpha || 1);
      P.iU.array[n * 2] = p.cell; P.iU.array[n * 2 + 1] = p.rot;
      n++;
      out.push(p);
    }
    P.list = out;
    P.mesh.count = n;
    if (n) { P.iP.needsUpdate = true; P.iC.needsUpdate = true; P.iU.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- confetti (tumbling quads, 3D)
  function makeConfetti(cap) {
    const g = new THREE.PlaneGeometry(0.28, 0.18);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.frustumCulled = false; mesh.count = 0;
    FX.root.add(mesh);
    return { mesh, cap, list: [] };
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  SQfx.confetti = function (x, z, color, n, y0) {
    if (!FX.confetti || reduced()) return;
    const C = FX.confetti;
    n = Math.round((n || 70) * FX.pmul);
    const base = new THREE.Color(color || '#ffd34d');
    const palette = [base, base.clone().lerp(new THREE.Color('#ffffff'), 0.5), new THREE.Color('#ffd34d'), base.clone().multiplyScalar(0.7)];
    for (let i = 0; i < n; i++) {
      if (C.list.length >= C.cap) C.list.shift();
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
      C.list.push({ x: x + Math.cos(a) * 1.5, y: (y0 || 2) + Math.random() * 2, z: z + Math.sin(a) * 1.5, vx: Math.cos(a) * sp, vy: 7 + Math.random() * 8, vz: Math.sin(a) * sp,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14, t: 0, life: 2.6 + Math.random() * 1.5, c: palette[i % palette.length] });
    }
  };
  function updateConfetti(dt) {
    const C = FX.confetti; if (!C) return;
    let n = 0; const out = [];
    for (const p of C.list) {
      p.t += dt; if (p.t > p.life) continue;
      p.vy -= 9.8 * dt; p.vx *= Math.exp(-1.8 * dt); p.vz *= Math.exp(-1.8 * dt);
      if (p.vy < -2.2) p.vy = -2.2 + Math.sin(p.t * 5 + p.rx) * 0.3; // flutter
      p.x += p.vx * dt + Math.sin(p.t * 4 + p.ry) * 0.6 * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const fl = gy(p.x, p.z) + 0.02;
      if (p.y < fl) { p.y = fl; p.vx = p.vz = 0; p.sx = p.sy = 0; }
      p.rx += p.sx * dt; p.ry += p.sy * dt;
      _e.set(p.rx, p.ry, 0); _q.setFromEuler(_e);
      const k = p.t > p.life - 0.5 ? (p.life - p.t) / 0.5 : 1;
      _s.set(k, k, k);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
      C.mesh.setMatrixAt(n, _m); C.mesh.setColorAt(n, p.c);
      n++; out.push(p);
    }
    C.list = out; C.mesh.count = n;
    if (n) { C.mesh.instanceMatrix.needsUpdate = true; C.mesh.instanceColor.needsUpdate = true; }
  }

  SQfx.fireworks = function (x, z) {
    if (reduced()) return;
    const cols = ['#ffd34d', '#ff5a5a', '#5ad1ff', '#b07dff', '#7dff9a', '#ffffff'];
    let delay = 0;
    for (let b = 0; b < 9; b++) {
      delay += 0.25 + Math.random() * 0.35;
      setTimeout(() => {
        const bx = x + (Math.random() - 0.5) * 30, bz = z + (Math.random() - 0.5) * 16, by = 32 + Math.random() * 18;
        const col = new THREE.Color(cols[b % cols.length]);
        const n = Math.round(46 * FX.pmul + 10);
        for (let i = 0; i < n; i++) {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 9 + Math.random() * 4;
          emit({ x: bx, y: by, z: bz, vx: r * Math.cos(th) * sp, vy: u * sp, vz: r * Math.sin(th) * sp, g: 4, drag: 1.2, size: 22, color: col, life: 1.6 + Math.random() * 0.6, cell: glyphIdx('·'), alpha: 1 });
        }
        if (SQ.audio && SQ.audio.play) try { SQ.audio.play('gained', { x: bx, z: bz, volume: 0.5 }); } catch (e) { /* optional */ }
      }, delay * 1000);
    }
  };

  // =============================================================== pads & setups
  function setupGeos() {
    const L = lib(); const B = L.Builder;
    const G = {};
    let b;
    // Food cart: steel cart with umbrella (umbrella tinted in team colour)
    b = new B();
    b.box(1.6, 1.0, 0.9, { c: 0xd8dde2, at: [0, 0.75, 0] });
    b.box(1.62, 0.18, 0.92, { c: 0xffffff, m: 1, at: [0, 1.15, 0] });
    b.box(1.5, 0.05, 0.8, { c: 0x9aa3ad, at: [0, 1.27, 0] });
    for (const w of [[-0.55, 0.47], [0.55, 0.47], [-0.55, -0.47], [0.55, -0.47]]) b.cyl(0.18, 0.18, 0.08, 8, { c: 0x222222, at: [w[0], 0.18, w[1]], rot: [Math.PI / 2, 0, 0] });
    b.cyl(0.03, 0.03, 1.4, 4, { c: 0x888888, at: [0, 1.9, 0] });
    b.cone(1.25, 0.45, 8, { c: 0xffffff, m: 1, at: [0, 2.7, 0] });
    b.box(0.7, 0.35, 0.05, { c: 0xffe08a, at: [0, 1.5, 0.46] });
    G.cart = b.build();
    // Boombox on a milk crate
    b = new B();
    b.box(0.6, 0.45, 0.6, { c: 0xffffff, m: 1, at: [0, 0.23, 0] });
    b.box(0.9, 0.42, 0.28, { c: 0x2a2a2e, at: [0, 0.68, 0] });
    for (const sx of [-0.27, 0.27]) { b.cyl(0.14, 0.14, 0.04, 10, { c: 0x111111, at: [sx, 0.68, 0.15], rot: [Math.PI / 2, 0, 0] }); b.cyl(0.06, 0.06, 0.05, 8, { c: 0x888888, at: [sx, 0.68, 0.17], rot: [Math.PI / 2, 0, 0] }); }
    b.box(0.22, 0.1, 0.02, { c: 0x9fd4ff, at: [0, 0.78, 0.15], raw: true });
    b.rod([-0.35, 0.89, 0], [0.35, 0.89, 0], 0.04, { c: 0xbbbbbb });
    G.boombox = b.build();
    // Bench cluster: 3 extra benches in a U
    b = new B();
    for (const bp of [[0, -0.9, 0], [-1.0, 0.1, Math.PI / 2], [1.0, 0.1, -Math.PI / 2]]) {
      const c = Math.cos(bp[2]), s = Math.sin(bp[2]);
      const P = (x, z) => [bp[0] + x * c + z * s, bp[1] - x * s + z * c];
      const q1 = P(0, 0), q2 = P(0, -0.22);
      b.box(1.6, 0.06, 0.45, { c: 0x3f6b3a, at: [q1[0], 0.45, q1[1]], rot: [0, bp[2], 0] });
      b.box(1.6, 0.4, 0.05, { c: 0x3f6b3a, at: [q2[0], 0.72, q2[1]], rot: [-0.15, bp[2], 0] });
      for (const lx of [-0.7, 0.7]) { const q = P(lx, 0); b.box(0.06, 0.45, 0.45, { c: 0x1f1f1f, at: [q[0], 0.22, q[1]], rot: [0, bp[2], 0] }); }
    }
    b.box(0.5, 0.06, 0.5, { c: 0xffffff, m: 1, at: [0, 0.03, 0.2] });
    G.bench = b.build();
    // Chess table: stone table with checkerboard top + 2 stools
    b = new B();
    b.cyl(0.18, 0.25, 0.7, 6, { c: 0x9c9890, at: [0, 0.35, 0] });
    b.box(0.85, 0.06, 0.85, { c: 0xb8b2a6, at: [0, 0.73, 0] });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) b.box(0.15, 0.012, 0.15, { c: (i + j) % 2 ? 0x2b2b2b : 0xf0ece0, at: [-0.225 + i * 0.15, 0.765, -0.225 + j * 0.15] });
    for (const sz of [-0.75, 0.75]) b.cyl(0.18, 0.2, 0.45, 6, { c: 0x9c9890, at: [0, 0.22, sz] });
    b.box(0.2, 0.12, 0.08, { c: 0x6b4423, at: [0.3, 0.83, 0.3] });
    b.box(0.85, 0.02, 0.06, { c: 0xffffff, m: 1, at: [0, 0.76, 0.44] });
    G.chessTable = b.build();
    // Tip jar: open guitar case + jar
    b = new B();
    b.box(0.5, 0.1, 1.1, { c: 0x2b1d14, at: [0, 0.05, 0] });
    b.box(0.42, 0.04, 1.0, { c: 0xffffff, m: 1, at: [0, 0.1, 0] });
    b.cyl(0.11, 0.11, 0.26, 8, { c: 0xcfeaf5, at: [0.45, 0.13, 0.2] });
    b.box(0.14, 0.04, 0.2, { c: 0x7fbf6a, at: [0, 0.13, -0.1] });
    b.box(0.25, 0.4, 0.02, { c: 0xffffff, at: [0.45, 0.45, 0.2] });
    G.tipJar = b.build();
    // Club fair table: folding table with violet cloth, banner, balloons
    b = new B();
    b.box(1.8, 0.05, 0.75, { c: 0xffffff, m: 1, at: [0, 0.75, 0] });
    b.box(1.8, 0.55, 0.02, { c: 0xffffff, m: 1, at: [0, 0.5, 0.375] });
    for (const sx of [-0.8, 0.8]) b.rod([sx, 0.75, 0], [sx, 1.9, 0], 0.04, { c: 0xdddddd });
    b.box(1.6, 0.4, 0.02, { c: 0xffffff, at: [0, 1.7, 0] });
    b.box(1.5, 0.3, 0.025, { c: 0xffffff, m: 1, at: [0, 1.7, 0.01] });
    b.ball(0.18, { c: 0xffffff, m: 1, at: [-0.95, 2.2, 0] }); b.ball(0.18, { c: 0xffd34d, at: [-0.75, 2.35, 0.1] });
    b.box(0.25, 0.3, 0.02, { c: 0xffffff, at: [0.4, 0.92, 0], rot: [-0.3, 0, 0] });
    G.clubFair = b.build();
    // Water bowl: steel bowls + dog bone sign
    b = new B();
    b.cyl(0.3, 0.22, 0.12, 10, { c: 0xc9cdd2, at: [0, 0.06, 0] });
    b.cyl(0.26, 0.26, 0.02, 10, { c: 0x6ab7e8, at: [0, 0.11, 0], raw: true });
    b.cyl(0.22, 0.17, 0.1, 10, { c: 0xc9cdd2, at: [0.55, 0.05, 0.1] });
    b.rod([0.0, 0, -0.45], [0.0, 1.0, -0.45], 0.05, { c: 0x6b4423 });
    b.box(0.6, 0.35, 0.04, { c: 0xffffff, m: 1, at: [0, 1.0, -0.43] });
    b.box(0.3, 0.1, 0.05, { c: 0xffffff, at: [0, 1.0, -0.4] });
    G.waterBowl = b.build();
    // scaffold (under construction): 4 posts + tape
    b = new B();
    for (const p of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) b.box(0.06, 1.3, 0.06, { c: 0xffd34d, at: [p[0], 0.65, p[1]] });
    b.box(1.66, 0.08, 0.02, { c: 0xffd34d, at: [0, 1.1, 0.6] }); b.box(1.66, 0.08, 0.02, { c: 0xffd34d, at: [0, 1.1, -0.6] });
    b.box(0.02, 0.08, 1.26, { c: 0xffd34d, at: [0.8, 1.1, 0] }); b.box(0.02, 0.08, 1.26, { c: 0xffd34d, at: [-0.8, 1.1, 0] });
    b.box(0.5, 0.35, 0.5, { c: 0xa47a4a, at: [0.3, 0.18, 0.1] });
    G.scaffold = b.build();
    return G;
  }

  function padMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec4 iPad; varying vec2 vUv; varying vec4 vPad;
void main(){ vUv = uv; vPad = vec4(pow(iPad.rgb, vec3(0.4545)), iPad.a); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vPad;
void main(){ vec2 p = abs(vUv * 2.0 - 1.0); float m = max(p.x, p.y);
  float edge = smoothstep(0.72, 0.8, m) * (1.0 - smoothstep(0.92, 1.0, m));
  float grid = step(0.9, fract(vUv.x * 3.0)) + step(0.9, fract(vUv.y * 3.0));
  float glow = vPad.a;
  float pulse = 0.65 + 0.35 * sin(uTime * 3.0 + vPad.x * 7.0);
  float a = (edge * 0.9 + grid * 0.18 + 0.12) * glow * pulse;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vPad.rgb, a); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }

  function buildPads() {
    const L = lib();
    const g = new THREE.PlaneGeometry(2.2, 2.2); g.rotateX(-Math.PI / 2);
    const cap = 64;
    const iPad = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    g.setAttribute('iPad', iPad);
    const mesh = new THREE.InstancedMesh(g, padMaterial(), cap);
    mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.count = 0;
    FX.root.add(mesh);
    FX.pads = { mesh, iPad, cap };
    const G = setupGeos();
    FX.setupPools = {};
    for (const k of Object.keys(G)) {
      const pool = new L.Pool(G[k], L.peopleMaterial([0, 0, 0, 0], { tint: true }), 40, { tint: true });
      pool.addTo(FX.root);
      FX.setupPools[k] = pool;
    }
  }

  const _tc = new THREE.Color();
  function updatePadsAndSetups(state) {
    if (!FX.pads) return;
    const P = FX.pads; let n = 0;
    const me = state.player;
    const Lm = FX.tmpM || (FX.tmpM = new THREE.Matrix4());
    for (const lm of state.landmarks) {
      const mine = lm.owner === me && me >= 0;
      for (let k = 0; k < lm.pads.length; k++) {
        const pad = lm.pads[k];
        if (pad.setup >= 0) continue;
        if (n >= P.cap) break;
        Lm.makeTranslation(pad.x, gy(pad.x, pad.z) + 0.06, pad.z);
        P.mesh.setMatrixAt(n, Lm);
        _tc.set(mine ? '#ffe27a' : lm.owner >= 0 ? state.factions[lm.owner].color : '#e8e4da');
        P.iPad.array[n * 4] = _tc.r; P.iPad.array[n * 4 + 1] = _tc.g; P.iPad.array[n * 4 + 2] = _tc.b; P.iPad.array[n * 4 + 3] = mine ? 1 : 0.45;
        n++;
      }
    }
    P.mesh.count = n;
    if (n) { P.mesh.instanceMatrix.needsUpdate = true; P.iPad.needsUpdate = true; }
    P.mesh.material.uniforms.uTime.value = FX.time;
    // setups
    for (const k in FX.setupPools) FX.setupPools[k].begin();
    for (const s of state.setups) {
      const done = s.done !== false;
      const pool = FX.setupPools[done ? s.kind : 'scaffold'] || FX.setupPools.cart;
      const lm = state.landmarks[s.lm];
      // face toward the landmark centre
      const yaw = lm ? Math.atan2(lm.x - s.x, lm.z - s.z) : 0;
      let sc = 1;
      let born = FX.setupBorn.get(s.id);
      if (done && born === undefined) { born = FX.time; FX.setupBorn.set(s.id, born); }
      const age = done ? FX.time - born : 99;
      if (done && age < 0.4) sc = 0.6 + 0.4 * Math.sin(age / 0.4 * Math.PI / 2) + Math.sin(age / 0.4 * Math.PI) * 0.15;
      _e.set(0, yaw, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(s.x, gy(s.x, s.z), s.z), _q, _s.set(sc, sc, sc));
      const kk = pool.push(_m, 0, 0, 0, 0, 0, 0, 0, 0);
      _tc.set(s.owner >= 0 && state.factions[s.owner] ? state.factions[s.owner].color : '#cccccc').convertSRGBToLinear();
      pool.tint(kk, _tc.r, _tc.g, _tc.b, 1);
    }
    for (const k in FX.setupPools) FX.setupPools[k].end();
  }

  // =============================================================== chalk tags
  const tagTexCache = {};
  function tagTexture(fkey, name, color) {
    const key = fkey + color;
    if (tagTexCache[key]) return tagTexCache[key];
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.translate(256, 128); ctx.rotate(-0.12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const word = { hustle: 'HUSTLE', noise: 'NOISE!', violets: 'VIOLETS', pack: 'PACK', squirrels: 'NUTS' }[fkey] || name.toUpperCase();
    const doodle = { hustle: '♞', noise: '♫', violets: '★', pack: '🐾', squirrels: '🌰' }[fkey] || '★';
    ctx.font = '900 110px ' + CHALK;
    // chalky: many jittered low-alpha strokes
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = i % 4 === 0 ? '#ffffff' : color;
      ctx.fillText(word, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    }
    ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff';
    ctx.strokeText(word, 0, 0);
    ctx.globalAlpha = 0.8; ctx.font = '700 70px ' + CHALK; ctx.fillStyle = color;
    ctx.fillText(doodle, 200, -70);
    // underline swoosh
    ctx.globalAlpha = 0.7; ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-200, 72); ctx.quadraticCurveTo(0, 100, 210, 60); ctx.stroke();
    // erase speckles for chalk grain
    ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1;
    for (let i = 0; i < 1800; i++) { ctx.fillRect((Math.random() - 0.5) * 512, (Math.random() - 0.5) * 256, 2, 2); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tagTexCache[key] = tex;
    return tex;
  }
  function stampTag(state, lmIdx, f) {
    if (lmIdx < 0 || lmIdx >= FX.tags.length) return;
    const lm = state.landmarks[lmIdx];
    const fac = state.factions[f]; if (!fac) return;
    const old = FX.tags[lmIdx];
    if (old) { FX.root.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
    const w = Math.min(14, lm.r * 0.9);
    const g = new THREE.PlaneGeometry(w, w / 2); g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tagTexture(fac.key, fac.short, fac.color), transparent: true, depthWrite: false, opacity: 0, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mesh = new THREE.Mesh(g, mat);
    // the Fountain centre is water: tag the plaza south of the basin
    let tx = lm.x, tz = lm.z;
    if (lm.id === 'fountain') tz = 13.5;
    else if (!lm.poly) tz = lm.z + lm.r * 0.45;
    mesh.position.set(tx, gy(tx, tz) + 0.1, tz);
    mesh.rotation.y = ((lmIdx * 37) % 10 - 5) * 0.03;
    mesh.renderOrder = 1;
    FX.root.add(mesh);
    FX.tags[lmIdx] = { mesh, t: 0 };
  }
  function updateTags(dt) {
    for (const t of FX.tags) {
      if (!t) continue;
      t.t += dt;
      const k = Math.min(1, t.t / 0.6);
      const e = 1 - Math.pow(1 - k, 3);
      const sc = 1.6 - 0.6 * e;
      t.mesh.scale.set(sc, 1, sc);
      t.mesh.material.opacity = 0.85 * e;
    }
  }

  // =============================================================== crew call effects
  function clockGeo() {
    const B = lib().Builder; const b = new B();
    b.box(6, 2.6, 2.6, { c: 0x6b4423, at: [0, 1.3, 0] });
    b.box(6.1, 0.2, 2.7, { c: 0x4a2e17, at: [0, 2.62, 0] });
    for (const sx of [-1.5, 1.5]) {
      b.cyl(1.0, 1.0, 0.1, 16, { c: 0xf4f0e6, at: [sx, 1.35, 1.31], rot: [Math.PI / 2, 0, 0] });
      b.box(0.08, 0.75, 0.05, { c: 0x111111, at: [sx, 1.62, 1.38] });
      b.box(0.06, 0.5, 0.05, { c: 0xd23b2b, at: [sx + 0.18, 1.5, 1.38], rot: [0, 0, -0.8] });
      b.cyl(0.25, 0.25, 0.4, 8, { c: 0xffffff, m: 1, at: [sx, 2.9, 0] });
    }
    return b.build();
  }
  function boardGeo() {
    const B = lib().Builder; const b = new B();
    b.box(0.8, 0.5, 0.6, { c: 0x5b5b55, at: [0, 0.25, 0.6] });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.box(0.18, 0.015, 0.18, { c: (i + j) % 2 ? 0x222222 : 0xf0ece0, at: [-0.27 + i * 0.18, 0.51, 0.42 + j * 0.18] });
    b.box(0.1, 0.18, 0.1, { c: 0xffffff, m: 1, at: [0.2, 0.6, 0.55] });
    return b.build();
  }

  function buildCrewFx() {
    const L = lib();
    FX.clock = new L.Pool(clockGeo(), L.peopleMaterial([0, 0, 0, 0], { tint: true }), 4, { tint: true });
    FX.boards = new L.Pool(boardGeo(), L.peopleMaterial([0, 0, 0, 0], { tint: true }), 40, { tint: true });
    FX.clock.addTo(FX.root); FX.boards.addTo(FX.root);
    // drummer & dog meshes are built per match (faction colours)
    // area discs (drum circle / tournament): ShaderMaterial instanced disc
    const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(8 * 4), 4);
    const iB = new THREE.InstancedBufferAttribute(new Float32Array(8 * 4), 4);
    g.setAttribute('iA', iA); g.setAttribute('iB', iB);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec4 iA; attribute vec4 iB; varying vec2 vUv; varying vec4 vA; varying vec4 vB;
void main(){ vUv = uv; vA = vec4(pow(iA.rgb, vec3(0.4545)), iA.a); vB = iB; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vA; varying vec4 vB;
void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); if (r > 1.0) discard;
  float kind = vB.x; float life = vB.y; float beat = vB.z;
  float rim = smoothstep(0.9, 0.96, r) * (1.0 - smoothstep(0.98, 1.0, r));
  float a = rim * 0.9;
  if (kind < 0.5) { // drum circle: pulsing beat rings
    float w = fract(r * 3.0 - uTime * 1.6); a += smoothstep(0.85, 1.0, w) * 0.25 * (1.0 - r * 0.6) + 0.08 + beat * 0.15;
  } else if (kind < 1.5) { // tournament: checker floor
    vec2 q = floor((p + 1.0) * 4.0); float ch = mod(q.x + q.y, 2.0);
    a += 0.14 * ch + 0.04;
  } else { // zoomies lane / generic
    a += 0.1;
  }
  a *= life;
  gl_FragColor = vec4(vA.rgb, a); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.InstancedMesh(g, mat, 8);
    mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 3;
    FX.root.add(mesh);
    FX.areas = { mesh, iA, iB };
  }

  function buildMatchFx(state) {
    const L = lib();
    for (const p of [FX.drummers, FX.dogs]) if (p) { FX.root.remove(p.mesh); p.dispose(); }
    FX.drummers = FX.dogs = null;
    const noise = state.factions.find((f) => f.key === 'noise');
    const pack = state.factions.find((f) => f.key === 'pack');
    if (noise) {
      const t = L.buildType('noise', 'heavy', noise.color);
      FX.drummers = new L.Pool(t.geo, L.peopleMaterial(t.pose), 24);
      FX.drummers.addTo(FX.root);
    }
    if (pack) {
      const b = new L.Builder();
      L.dog(b, 0, 0, 1.5, 0xd9b26a, { collar: new THREE.Color(pack.color).getHex(), snout: 0xcaa25c });
      FX.dogs = new L.Pool(b.build(), L.peopleMaterial([0, 0, 0, 0]), 24);
      FX.dogs.addTo(FX.root);
    }
  }

  function updateCrewFx(state, alpha, dt) {
    const A = FX.areas; if (!A) return;
    let na = 0;
    FX.clock.begin(); FX.boards.begin();
    if (FX.drummers) FX.drummers.begin();
    if (FX.dogs) FX.dogs.begin();
    const t = state ? state.t : 0;
    const effs = state ? state.effects || [] : [];
    const live = new Set();
    for (const e of effs) {
      live.add(e.id);
      let rec = FX.effects.get(e.id);
      if (!rec) { rec = { t: 0, dust: 0 }; FX.effects.set(e.id, rec); }
      rec.t += dt;
      const dur = Math.max(0.1, e.t1 - e.t0);
      const left = e.t1 - t;
      const life = Math.max(0, Math.min(1, rec.t / 0.3, left / 0.5));
      _tc.set(colOf(state, e.faction));
      const add = (x, z, r, kind) => {
        if (na >= 8) return;
        _m.makeScale(r, 1, r); _m.setPosition(x, gy(x, z) + 0.07, z);
        A.mesh.setMatrixAt(na, _m);
        A.iA.array[na * 4] = _tc.r; A.iA.array[na * 4 + 1] = _tc.g; A.iA.array[na * 4 + 2] = _tc.b; A.iA.array[na * 4 + 3] = 1;
        A.iB.array[na * 4] = kind; A.iB.array[na * 4 + 1] = life; A.iB.array[na * 4 + 2] = Math.pow(Math.max(0, Math.sin(FX.time * Math.PI * 3.2)), 8); A.iB.array[na * 4 + 3] = 0;
        na++;
      };
      if (e.kind === 'tournament') {
        add(e.x, e.z, e.r, 1);
        // the clock slams down
        const fall = Math.min(1, rec.t / 0.35);
        const y = (1 - fall * fall) * 26;
        if (fall >= 1 && !rec.slam) { rec.slam = true; if (SQ.camera) SQ.camera.shake(0.6); dust(e.x, e.z, 22, 3.5); }
        const sq = rec.slam ? 1 + Math.sin(Math.min(1, (rec.t - 0.35) / 0.3) * Math.PI) * 0.15 : 1;
        _e.set(0, 0.3, 0); _q.setFromEuler(_e);
        _m.compose(_p.set(e.x, gy(e.x, e.z) + y, e.z), _q, _s.set(sq, 1 / sq, sq));
        const kk = FX.clock.push(_m, 0, 0, 0, left < 0.4 ? 1 - left / 0.4 : 0, 0, 0, 0, 0);
        const lc = new THREE.Color(colOf(state, e.faction)).convertSRGBToLinear(); FX.clock.tint(kk, lc.r, lc.g, lc.b, 1);
        // boards under the sitters
        if (e.ids && state) {
          for (const id of e.ids) {
            const i = SQ.World.unitIndex(state, id); if (i < 0) continue;
            const u = state.units;
            const x = u.px[i] + (u.x[i] - u.px[i]) * alpha, z = u.pz[i] + (u.z[i] - u.pz[i]) * alpha;
            _e.set(0, u.facing[i], 0); _q.setFromEuler(_e);
            _m.compose(_p.set(x, gy(x, z), z), _q, _s.set(1.3, 1.3, 1.3));
            const bk = FX.boards.push(_m, 0, 0, 0, left < 0.4 ? 1 - left / 0.4 : 0, 0, 0, 0, 0);
            FX.boards.tint(bk, lc.r, lc.g, lc.b, 1);
          }
        }
      } else if (e.kind === 'drumCircle') {
        add(e.x, e.z, e.r, 0);
        if (FX.drummers) {
          const N = 10;
          for (let k = 0; k < N; k++) {
            const appear = Math.min(1, Math.max(0, (rec.t - k * 0.08) / 0.4));
            if (appear <= 0) continue;
            const a = k / N * Math.PI * 2 + 0.2;
            const x = e.x + Math.sin(a) * (e.r + 1.2), z = e.z - Math.cos(a) * (e.r + 1.2);
            const yaw = Math.atan2(e.x - x, e.z - z);
            _e.set(0, yaw, 0); _q.setFromEuler(_e);
            const bounce = 1 + Math.pow(Math.max(0, Math.sin(FX.time * Math.PI * 3.2 + k)), 6) * 0.06;
            _m.compose(_p.set(x, gy(x, z), z), _q, _s.set(1.5, 1.5 * bounce, 1.5));
            FX.drummers.push(_m, 0, 0, 2, Math.max(1 - appear, left < 0.6 ? 1 - left / 0.6 : 0), k * 0.37, 0, 0, 0);
          }
        }
        if (Math.random() < dt * 6) emit({ x: e.x + (Math.random() - 0.5) * e.r * 1.6, y: 1.5, z: e.z + (Math.random() - 0.5) * e.r * 1.6, vx: 0, vy: 2, vz: 0, size: 26, color: new THREE.Color(colOf(state, e.faction)), life: 1.1, cell: glyphIdx(Math.random() < 0.5 ? '♪' : '♫'), spin: (Math.random() - 0.5) * 2 });
      } else if (e.kind === 'groupChat') {
        if (rec.t < 2.2 && Math.random() < dt * 30) {
          const a = Math.random() * 6.283, r = Math.random() * (e.r || 10);
          emit({ x: e.x + Math.cos(a) * r, y: 1.6, z: e.z + Math.sin(a) * r, vx: 0, vy: 2.5, vz: 0, size: 24, color: new THREE.Color(Math.random() < 0.5 ? '#9fd4ff' : colOf(state, e.faction)), life: 1.2, cell: glyphIdx(Math.random() < 0.4 ? '💬' : '✦'), pop: true });
        }
      } else if (e.kind === 'zoomies') {
        if (FX.dogs && e.dogs) {
          for (const d of e.dogs) {
            if (d.s >= 1 || d.s < 0) continue;
            const yaw = Math.atan2(e.x2 - e.x, e.z2 - e.z);
            _e.set(0, yaw, 0); _q.setFromEuler(_e);
            _m.compose(_p.set(d.x, gy(d.x, d.z) + Math.abs(Math.sin(FX.time * 18 + d.lane)) * 0.25, d.z), _q, _s.set(1, 1, 1));
            FX.dogs.push(_m, FX.time * 22 + d.lane, 1, 1, 0, d.lane * 0.3, 0, 0, 0);
            if (Math.random() < dt * 14) dust(d.x, d.z, 1, 0.8);
          }
        }
      }
    }
    FX.effects.forEach((v, id) => { if (!live.has(id)) FX.effects.delete(id); });
    A.mesh.count = na;
    if (na) { A.mesh.instanceMatrix.needsUpdate = true; A.iA.needsUpdate = true; A.iB.needsUpdate = true; }
    A.mesh.material.uniforms.uTime.value = FX.time;
    FX.clock.end(); FX.boards.end();
    if (FX.drummers) FX.drummers.end();
    if (FX.dogs) FX.dogs.end();
  }

  const DUST = new THREE.Color('#d8ccb4');
  function dust(x, z, n, spd) {
    n = Math.max(1, Math.round(n * FX.pmul));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = (spd || 2) * (0.5 + Math.random());
      emit({ x, y: 0.4, z, vx: Math.cos(a) * s, vy: 0.6 + Math.random(), vz: Math.sin(a) * s, drag: 2.5, size: 30 + Math.random() * 20, color: DUST, life: 0.8 + Math.random() * 0.5, cell: glyphIdx('·'), alpha: 0.55 });
    }
  }

  // =============================================================== order pings, ghost path, target preview, rally flag
  function buildMarkers() {
    // pings
    const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(16 * 4), 4);
    g.setAttribute('iA', iA);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `attribute vec4 iA; varying vec2 vUv; varying vec4 vA; void main(){ vUv=uv; vA=vec4(pow(iA.rgb, vec3(0.4545)), iA.a); gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vA; void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); float k=vA.a;
  float ring = smoothstep(0.7,0.8,r)*(1.0-smoothstep(0.9,1.0,r)); float dot = 1.0-smoothstep(0.1,0.18,r);
  float a = (ring + dot*0.8) * (1.0-k); if (a<0.01) discard; gl_FragColor = vec4(vA.rgb, a); }`,
      transparent: true, depthWrite: false, depthTest: false,
    });
    const mesh = new THREE.InstancedMesh(g, mat, 16); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 7; mesh.name = 'fx-pings';
    FX.root.add(mesh);
    FX.pings = { mesh, iA, list: [] };
    // ghost path: dynamic ribbon
    const pg = new THREE.BufferGeometry();
    const MAXP = 256;
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(MAXP * 2), 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < MAXP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    pg.setIndex(idx); pg.setDrawRange(0, 0);
    const pmat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color('#ffffff') }, uA: { value: 1 }, uDash: { value: 1.4 } },
      vertexShader: `attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uCol; uniform float uA; varying float vS;
uniform float uDash;
void main(){ float d = step(0.42, fract(vS / uDash - uTime * 1.8)); gl_FragColor = vec4(pow(uCol, vec3(0.4545)), (0.45 + 0.55 * d) * uA); }`,
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    });
    FX.path = { mesh: new THREE.Mesh(pg, pmat), MAXP, life: 0, t: 0 };
    FX.path.mesh.frustumCulled = false; FX.path.mesh.renderOrder = 8; FX.path.mesh.visible = false; FX.path.mesh.name = 'fx-path';
    FX.root.add(FX.path.mesh);
    // target preview: ring (circle) or arrow strip (line)
    const tg = new THREE.PlaneGeometry(2, 2); tg.rotateX(-Math.PI / 2);
    const tmat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color('#ffffff') } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
void main(){ vec2 p=vUv*2.0-1.0; float r=length(p); if (r>1.0) discard; float a=atan(p.y,p.x);
  float rim = smoothstep(0.9,0.95,r)*step(0.0, sin(a*16.0 + uTime*4.0));
  float fill = 0.12 + 0.06*sin(uTime*5.0);
  gl_FragColor = vec4(pow(uCol, vec3(0.4545)), rim*0.95 + fill); }`,
      transparent: true, depthWrite: false, depthTest: false,
    });
    FX.target = { circle: new THREE.Mesh(tg, tmat), spec: null };
    FX.target.circle.frustumCulled = false; FX.target.circle.renderOrder = 9; FX.target.circle.visible = false;
    FX.root.add(FX.target.circle);
    // rally flag
    const B = lib().Builder; const b = new B();
    b.cyl(0.05, 0.05, 3.2, 5, { c: 0xdddddd, at: [0, 1.6, 0] });
    b.box(0.02, 0.8, 1.2, { c: 0xffffff, m: 1, at: [0, 2.75, 0.6] });
    b.cyl(0.25, 0.3, 0.12, 8, { c: 0x444444, at: [0, 0.06, 0] });
    FX.flag = new (lib().Pool)(b.build(), lib().peopleMaterial([0, 0, 0, 0], { tint: true }), 4, { tint: true });
    FX.flag.addTo(FX.root);
  }

  const PING_COL = { move: '#ffffff', attackMove: '#ffffff', take: '#ffd34d', attack: '#ff5a4a', rally: '#7dff9a', deny: '#ff3b30', build: '#ffd34d' };
  SQfx.ping = function (x, z, kind) {
    if (!FX.pings) return;
    const camH = SQ.render && SQ.render.camera ? SQ.render.camera.position.y : 100;
    const k = Math.max(1, camH / 60);
    FX.pings.list.push({ x, z, t: 0, life: 0.9, col: new THREE.Color(PING_COL[kind] || '#ffffff'), r: (kind === 'take' ? 4 : 2.2) * k });
    if (FX.pings.list.length > 16) FX.pings.list.shift();
  };
  function updatePings(dt) {
    const P = FX.pings; if (!P) return;
    let n = 0; P.list = P.list.filter((p) => (p.t += dt) < p.life);
    for (const p of P.list) {
      const k = p.t / p.life, s = p.r * (0.5 + k);
      _m.makeScale(s, 1, s); _m.setPosition(p.x, gy(p.x, p.z) + 0.15, p.z);
      P.mesh.setMatrixAt(n, _m);
      P.iA.array[n * 4] = p.col.r; P.iA.array[n * 4 + 1] = p.col.g; P.iA.array[n * 4 + 2] = p.col.b; P.iA.array[n * 4 + 3] = k;
      n++;
    }
    P.mesh.count = n;
    if (n) { P.mesh.instanceMatrix.needsUpdate = true; P.iA.needsUpdate = true; }
  }

  SQfx.showPath = function (points, kind, life) {
    const P = FX.path; if (!P || !points || points.length < 2) { SQfx.clearPath(); return; }
    const pos = P.mesh.geometry.attributes.position, aS = P.mesh.geometry.attributes.aS;
    // resample to <= MAXP points
    let pts = points;
    if (pts.length > P.MAXP) { const step = pts.length / P.MAXP; const o = []; for (let i = 0; i < P.MAXP - 1; i++) o.push(pts[Math.floor(i * step)]); o.push(pts[pts.length - 1]); pts = o; }
    const camH = SQ.render && SQ.render.camera ? SQ.render.camera.position.y : 100;
    const W = Math.max(0.7, camH * 0.0095); let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const y = gy(p[0], p[1]) + 0.25;
      pos.setXYZ(i * 2, p[0] - dz * W, y, p[1] + dx * W); pos.setXYZ(i * 2 + 1, p[0] + dz * W, y, p[1] - dx * W);
      aS.setX(i * 2, s); aS.setX(i * 2 + 1, s);
    }
    pos.needsUpdate = true; aS.needsUpdate = true;
    P.mesh.geometry.setDrawRange(0, (pts.length - 1) * 6);
    P.mesh.material.uniforms.uDash.value = W * 3;
    P.mesh.material.uniforms.uCol.value.set(PING_COL[kind] || '#ffffff');
    P.mesh.visible = true; P.t = 0; P.life = life === undefined ? 1.1 : life;
  };
  SQfx.clearPath = function () { if (FX.path) FX.path.mesh.visible = false; };

  SQfx.setTarget = function (spec) {
    if (!FX.target) return;
    FX.target.spec = spec || null;
    const c = FX.target.circle;
    if (!spec) { c.visible = false; if (FX.target.line) { SQfx.clearPath(); FX.target.line = false; } return; }
    c.material.uniforms.uCol.value.set(spec.color || '#ffd34d');
    if (spec.kind === 'line') {
      c.visible = false;
      const n = 24, pts = [];
      for (let i = 0; i <= n; i++) pts.push([spec.x + (spec.x2 - spec.x) * i / n, spec.z + (spec.z2 - spec.z) * i / n]);
      SQfx.showPath(pts, 'take', -1);
      FX.path.mesh.material.uniforms.uCol.value.set(spec.color || '#ffd34d');
      FX.target.line = true;
    } else {
      c.visible = true;
      c.position.set(spec.x, gy(spec.x, spec.z) + 0.2, spec.z);
      c.scale.set(spec.r || 10, 1, spec.r || 10);
    }
  };

  SQfx.wash = function (color) {
    if (reduced()) return;
    let el = FX.washEl;
    if (!el) {
      el = FX.washEl = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity 0.6s ease-out;mix-blend-mode:screen';
      const app = document.getElementById('app') || document.body; app.appendChild(el);
    }
    el.style.transition = 'none';
    el.style.background = 'radial-gradient(ellipse at 50% 55%, transparent 20%, ' + (color || '#ffd34d') + ' 140%)';
    el.style.opacity = '0.75';
    void el.offsetWidth;
    el.style.transition = 'opacity 0.8s ease-out';
    el.style.opacity = '0';
  };

  SQfx.hoverLandmark = function (i) { FX.hoverLm = i === undefined ? -1 : i; };
  SQfx.selectLandmark = function (i) { FX.selLm = i === undefined ? -1 : i; };

  // =============================================================== rain
  function buildRain() {
    const n = Math.round(900 * FX.pmul) + 100;
    const g = new THREE.PlaneGeometry(0.04, 1.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xbfd2e6, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(g, mat, n);
    mesh.frustumCulled = false; mesh.visible = false;
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ x: (Math.random() - 0.5) * 160, y: Math.random() * 40, z: (Math.random() - 0.5) * 160 });
    FX.root.add(mesh);
    FX.rain = { mesh, drops, k: 0 };
  }
  function updateRain(state, dt, camera) {
    const R = FX.rain; if (!R) return;
    const on = !!(state && state.weather && state.weather.rain);
    R.k += ((on ? 1 : 0) - R.k) * Math.min(1, dt * 1.5);
    R.mesh.visible = R.k > 0.02;
    if (!R.mesh.visible) return;
    R.mesh.material.opacity = 0.35 * R.k;
    const cs = SQ.camera ? SQ.camera.state : { x: 0, z: 0 };
    const yaw = camera ? Math.atan2(camera.position.x - cs.x, camera.position.z - cs.z) : 0;
    _e.set(0, yaw, 0.12); _q.setFromEuler(_e);
    for (let i = 0; i < R.drops.length; i++) {
      const d = R.drops[i];
      d.y -= dt * 24;
      if (d.y < 0) { d.y = 30 + Math.random() * 10; d.x = (Math.random() - 0.5) * 160; d.z = (Math.random() - 0.5) * 160; }
      _m.compose(_p.set(cs.x + d.x, d.y, cs.z + d.z), _q, _s.set(1, 1, 1));
      R.mesh.setMatrixAt(i, _m);
    }
    R.mesh.instanceMatrix.needsUpdate = true;
  }

  // =============================================================== bus wiring
  function on(name, fn) { const m = FX.match; if (!m) return; m.bus.on(name, fn); FX.offs.push(() => m.bus.off(name, fn)); }

  function wire(m) {
    const S = () => m.state;
    const isMe = (f) => f === m.state.player;
    on('capture', (e) => {
      const st = S(); const lm = st.landmarks[e.lmIdx]; if (!lm) return;
      const col = colOf(st, e.to);
      stampTag(st, e.lmIdx, e.to);
      SQfx.confetti(lm.x, lm.z, col, isMe(e.to) ? 90 : 50);
      dust(lm.x, lm.z, 14, 4);
      if (SQ.units && SQ.units.squashAt) SQ.units.squashAt(lm.x, lm.z, (lm.r || 12) + 2);
      if (e.title) SQfx.pop(e.title, lm.x, 6, lm.z, { big: true, color: col, life: 2.6 });
      if (SQ.camera && isVisible(lm.x, lm.z)) { SQ.camera.punch(0.04); SQ.camera.shake(0.25); }
      if (isMe(e.to) && navigator.vibrate && !reduced()) try { navigator.vibrate(15); } catch (er) { /* */ }
    });
    on('neutral', (e) => { const lm = S().landmarks[e.lmIdx]; if (lm) { dust(lm.x, lm.z, 8, 3); SQfx.pop('NEUTRAL', lm.x, 4, lm.z, { color: '#e8e4da' }); } });
    on('overIt', (e) => {
      const st = S();
      // the HUD draws DOM bubbles when it exists (and honours the bubbles setting); otherwise we do
      if (!(SQ.hud && typeof SQ.hud.bubble === 'function')) SQfx.bubble(e.line, e.unit, { important: isMe(e.faction), color: colOf(st, e.faction), life: 3.2 });
      if (e.x !== undefined) emit({ x: e.x, y: 2.6, z: e.z, vx: 0, vy: 1.8, vz: 0, size: 26, color: new THREE.Color('#ffffff'), life: 0.9, cell: glyphIdx('!?'), pop: true });
    });
    const hudBanners = () => !!(SQ.hud && typeof SQ.hud.banner === 'function');
    on('squadWiped', (e) => {
      if (!e.word || e.x === undefined) return;
      // the HUD banners wipes involving the player; the world word marks the spot (smaller then)
      const mine = isMe(e.faction) || isMe(e.by);
      SQfx.pop(e.word, e.x, 5, e.z, { big: !(mine && hudBanners()), color: colOf(S(), e.by !== undefined && e.by >= 0 ? e.by : e.faction), life: 2.2 });
      if (SQ.camera && mine) SQ.camera.shake(0.35);
    });
    on('hit', (e) => onHit(S(), e));
    on('knock', (e) => dust(e.x, e.z, 6, 3));
    on('crewCall', (e) => {
      const col = colOf(S(), e.faction);
      SQfx.wash(col);
      if (SQ.game && SQ.game.slowmo && !reduced()) SQ.game.slowmo(0.3, 0.3);
      if (SQ.camera) SQ.camera.shake(0.4);
      // the HUD banners the player's own Crew Call; enemy calls get a world label at the spot
      if (!(isMe(e.faction) && hudBanners())) SQfx.pop({ tournament: 'TOURNAMENT!', drumCircle: 'DRUM CIRCLE!', groupChat: 'GROUP CHAT!', zoomies: 'ZOOMIES!' }[e.kind] || 'CREW CALL!', e.x, 7, e.z, { big: true, color: col, life: 1.8 });
      if (navigator.vibrate && isMe(e.faction) && !reduced()) try { navigator.vibrate(15); } catch (er) { /* */ }
    });
    on('crewEnd', (e) => { if (isMe(e.faction) && e.hits >= 4 && e.x !== undefined) SQfx.pop(e.hits + ' HIT!', e.x, 5, e.z, { color: '#ffd34d' }); });
    on('clout', (e) => {
      if (!isMe(e.faction) || e.x === undefined || !e.amount) return;
      if (e.reason === 'income') return;
      const pos = e.amount > 0;
      SQfx.pop((pos ? '+' : '') + Math.round(e.amount), e.x, 3.5, e.z, { color: pos ? '#ffd34d' : '#ff6a5a', life: 1.4 });
    });
    on('recruited', (e) => { if (e.x !== undefined) { dust(e.x, e.z, 6, 2); for (let k = 0; k < 4; k++) emit({ x: e.x + (Math.random() - 0.5) * 3, y: 1, z: e.z + (Math.random() - 0.5) * 3, vx: 0, vy: 3, vz: 0, size: 18, color: new THREE.Color(colOf(S(), e.faction)), life: 0.8, cell: glyphIdx('✦'), pop: true }); } });
    on('built', (e) => { dust(e.x, e.z, 10, 2.5); SQfx.pop(((SQ.data.setups[e.setup] || {}).name || 'Built') + '!', e.x, 3, e.z, { color: colOf(S(), e.faction), life: 1.4 }); });
    on('buildStart', (e) => { if (isMe(e.faction)) SQfx.ping(e.x, e.z, 'build'); });
    on('shoo', (e) => { dust(e.x, e.z, 8, 4); SQfx.pop('SHOO! +' + (e.amount || 5), e.x, 2.5, e.z, { color: '#ffd34d' }); });
    on('dosa', (e) => { SQfx.pop('DOSA TIME!', e.x, 4, e.z, { color: '#ffb347', big: false, life: 1.8 }); for (let k = 0; k < 10; k++) emit({ x: e.x + (Math.random() - 0.5) * 8, y: 1.5, z: e.z + (Math.random() - 0.5) * 8, vx: 0, vy: 2.5, vz: 0, size: 22, color: new THREE.Color('#ffb347'), life: 1.0, cell: glyphIdx('★'), pop: true }); });
    on('ordered', (e) => {
      if (!isMe(e.faction)) return;
      const st = S();
      if (e.lm !== undefined) { const lm = st.lmById[e.lm]; if (lm) SQfx.ping(lm.x, lm.z, 'take'); }
      else if (e.type === 'attack' && e.targetId !== undefined) { const i = SQ.World.unitIndex(st, e.targetId); if (i >= 0) SQfx.ping(st.units.x[i], st.units.z[i], 'attack'); }
      else if (e.x !== undefined) SQfx.ping(e.x, e.z, e.type);
    });
    on('rally', (e) => { if (isMe(e.faction)) { SQfx.ping(e.x, e.z, 'rally'); SQfx.pop('RALLY HERE', e.x, 4, e.z, { color: '#7dff9a', life: 1.2 }); } });
    on('victory', (e) => {
      const arch = S().lmById.arch || { x: 0.5, z: -54 };
      SQfx.fireworks(arch.x, arch.id ? arch.z - 10 : arch.z);
      if (e.playerWon) SQfx.confetti(0, 0, '#ffd34d', 160, 6);
      if (SQ.game && SQ.game.slowmo && !reduced()) SQ.game.slowmo(0.4, 0.25);
    });
    on('eventStart', (e) => { if (e.x !== undefined && /bell/i.test(e.kind || '') && SQ.camera) SQ.camera.shake(0.15); });
    on('regular', (e) => { if (e.x !== undefined) dust(e.x, e.z, 3, 1.5); });
  }

  function isVisible(x, z) {
    if (!SQ.render || !SQ.render.worldToScreen) return true;
    const s = SQ.render.worldToScreen(x, 0, z);
    return s.onScreen;
  }

  const _hitCol = new THREE.Color();
  function onHit(state, e) {
    if (FX.hitBudget <= 0) return;
    if (e.x === undefined || e.tx === undefined) return;
    if (!isVisible((e.x + e.tx) / 2, (e.z + e.tz) / 2)) return;
    FX.hitBudget -= 1;
    const col = new THREE.Color(colOf(state, e.faction));
    const g = e.glyph || '!';
    const d = Math.hypot(e.tx - e.x, e.tz - e.z);
    if (d > 2.2) {
      emit({ arc: { x0: e.x, z0: e.z, y0: 2.2, x1: e.tx, z1: e.tz, y1: 1.8, h: Math.min(4, 0.6 + d * 0.25), dur: Math.min(0.55, 0.18 + d * 0.03) },
        x: e.x, y: 2, z: e.z, size: e.counter ? 30 : 22, color: col, life: Math.min(0.55, 0.18 + d * 0.03) + 0.12, cell: glyphIdx(g), spin: (Math.random() - 0.5) * 6, minW: 0 });
    } else {
      emit({ x: e.tx + (Math.random() - 0.5) * 0.6, y: 2.2, z: e.tz + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 1.5, vy: 2.6, vz: (Math.random() - 0.5) * 1.5, size: e.counter ? 30 : 22, color: col, life: 0.7, cell: glyphIdx(g), pop: true, spin: (Math.random() - 0.5) * 3 });
    }
    if (e.counter && e.from !== -1) {
      const clsIdx = typeof e.cls === 'string' ? ({ crowd: 0, talker: 1, heavy: 2 }[e.cls]) : e.cls;
      const shape = ['●', '▲', '■'][clsIdx !== undefined ? clsIdx : 0];
      _hitCol.set('#ffffff');
      emit({ x: e.tx, y: 3.4, z: e.tz, vx: 0, vy: 1.2, vz: 0, size: 26, color: col, life: 0.75, cell: glyphIdx(shape), pop: true });
      emit({ x: e.tx + 0.8, y: 4.2, z: e.tz, vx: 0, vy: 1.4, vz: 0, size: 34, color: new THREE.Color('#ffd34d'), life: 0.75, cell: glyphIdx('CRIT!'), pop: true });
    }
    if (e.kind === 'zoomies') { dust(e.tx, e.tz, 5, 4); if (SQ.camera) SQ.camera.shake(0.25); }
  }

  // =============================================================== lifecycle
  SQfx.init = function (ctx) {
    FX.ctx = ctx;
    FX.quality = ctx.quality || 'med';
    FX.pmul = (ctx.tier && ctx.tier.particles) || 0.5;
    FX.root = new THREE.Group(); FX.root.name = 'fx';
    ctx.scene.add(FX.root);
    FX.parts = makeParticles(Math.round(500 * Math.max(0.5, FX.pmul)));
    FX.confetti = makeConfetti(Math.round(400 * Math.max(0.35, FX.pmul)));
    buildPads();
    buildCrewFx();
    buildMarkers();
    buildRain();
  };

  SQfx.setMatch = function (m) {
    for (const off of FX.offs) off();
    FX.offs = [];
    FX.match = m || null;
    for (const P of FX.pops) P.spr.visible = false;
    for (const B of FX.bubbles) B.spr.visible = false;
    if (FX.parts) FX.parts.list = [];
    if (FX.confetti) FX.confetti.list = [];
    FX.effects.clear(); FX.setupBorn.clear();
    SQfx.setTarget(null); SQfx.clearPath();
    if (!FX.root) return;
    if (!m) { disposeLandmarkMeshes(); return; }
    buildLandmarkMeshes(m.state);
    buildMatchFx(m.state);
    wire(m);
  };

  SQfx.dispose = function () {
    if (!FX.root) return;
    SQfx.setMatch(null);
    FX.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    FX.ctx.scene.remove(FX.root);
    FX.root = null; FX.pops = []; FX.bubbles = []; FX.setupPools = {};
  };

  const _w = new THREE.Vector3();
  SQfx.update = function (state, alpha, dt, camera) {
    if (!FX.root) return;
    FX.time += dt;
    FX.hitBudget = Math.min(6, FX.hitBudget + dt * 24 * Math.max(0.5, FX.pmul));
    if (state && FX.lmU) {
      const U = FX.lmU;
      U.uTime.value = FX.time; U.uHover.value = FX.hoverLm; U.uSel.value = FX.selLm;
      for (let i = 0; i < Math.min(MAX_LM, state.landmarks.length); i++) {
        const lm = state.landmarks[i];
        const st = U.uSt.value[i], own = U.uOwn.value[i], cap = U.uCap.value[i];
        st.set(lm.meter / 100, lm.contested ? 1 : 0, (lm.draining || (state.t - lm.attackedT < 1.5 && lm.owner >= 0)) && !lm.contested ? 1 : 0, lm.isHome ? 1 : 0);
        if (lm.owner >= 0) { _tc.set(colOf(state, lm.owner)); own.set(_tc.r, _tc.g, _tc.b, 1); } else own.set(0.9, 0.9, 0.9, 0);
        if (lm.capBy >= 0) { _tc.set(colOf(state, lm.capBy)); cap.set(_tc.r, _tc.g, _tc.b, 1); } else cap.set(1, 1, 1, 0);
      }
      // labels, contested tags
      const camH = camera ? camera.position.y : 120;
      for (let i = 0; i < FX.labels.length; i++) {
        const L = FX.labels[i]; if (!L) continue;
        drawLabel(L, state);
        const lm = L.lm;
        const y = (lm.id === 'arch' ? 3 : 2.5) + Math.max(0, gy(lm.x, lm.z));
        const lz = lm.id === 'fountain' ? lm.z : lm.z;
        L.spr.position.set(lm.x, y, lz);
        const ppm = pxScale(lm.x, y, lz);
        const px = lm.isHome ? 150 : 190;
        L.spr.scale.set(px * ppm, px * ppm * (96 / 512), 1);
        L.spr.material.opacity = camH > 210 ? 0.75 : 1;
        // CONTESTED sticker
        let C = FX.contestedSpr[i];
        if (lm.contested) {
          if (!C) { C = FX.contestedSpr[i] = textSprite(512, 96); drawPopText(C, 'CONTESTED', { color: '#ff4a3a' }); }
          C.spr.visible = Math.floor(FX.time * 2.6) % 2 === 0 || reduced();
          C.spr.position.set(lm.x, y + 2.5 * ppm * 40, lz);
          C.spr.scale.set(170 * ppm, 170 * ppm * (96 / 512), 1);
        } else if (C) C.spr.visible = false;
      }
      updatePadsAndSetups(state);
      // rally flag
      FX.flag.begin();
      const me = state.player >= 0 ? state.factions[state.player] : null;
      if (me) {
        const r = state.lmById[me.rally];
        if (r) {
          const fx = r.x + (r.isHome ? 0 : r.r * 0.55), fz = r.z - (r.isHome ? r.r * 0.6 : 0);
          _e.set(0, Math.sin(FX.time * 1.7) * 0.15, 0); _q.setFromEuler(_e);
          _m.compose(_p.set(fx, gy(fx, fz), fz), _q, _s.set(1.4, 1.4, 1.4));
          const k = FX.flag.push(_m, 0, 0, 0, 0, 0, 0, 0, 0);
          _tc.set(me.color).convertSRGBToLinear(); FX.flag.tint(k, _tc.r, _tc.g, _tc.b, 1);
        }
      }
      FX.flag.end();
    }
    updateTags(dt);
    updateCrewFx(state, alpha, dt);
    updateParticles(dt);
    updateConfetti(dt);
    updatePings(dt);
    updateRain(state, dt, camera);
    // ghost path fade
    if (FX.path && FX.path.mesh.visible) {
      FX.path.mesh.material.uniforms.uTime.value = FX.time;
      if (FX.path.life > 0) { FX.path.t += dt; FX.path.mesh.material.uniforms.uA.value = Math.max(0, 1 - FX.path.t / FX.path.life); if (FX.path.t >= FX.path.life) FX.path.mesh.visible = false; }
      else FX.path.mesh.material.uniforms.uA.value = 1;
    }
    if (FX.target && FX.target.circle.visible) FX.target.circle.material.uniforms.uTime.value = FX.time;
    // pops
    for (const P of FX.pops) {
      if (!P.spr.visible) continue;
      P.t += dt;
      const k = P.t / P.life;
      if (k >= 1) { P.spr.visible = false; continue; }
      const y = P.y + P.rise * Math.min(1, k * 1.5);
      P.spr.position.set(P.x, y, P.z);
      const ppm = pxScale(P.x, y, P.z);
      const pop = k < 0.12 ? 0.4 + k / 0.12 * 0.75 : k < 0.22 ? 1.15 - (k - 0.12) / 0.1 * 0.15 : 1;
      const wpx = P.px * (P.c.width / P.c.height) * pop;
      P.spr.scale.set(wpx * ppm, P.px * pop * ppm, 1);
      P.spr.material.opacity = k > 0.75 ? (1 - k) / 0.25 : 1;
    }
    // bubbles follow their unit
    for (const B of FX.bubbles) {
      if (!B.spr.visible) continue;
      B.t += dt;
      if (B.t >= B.life) { B.spr.visible = false; continue; }
      if (typeof B.who === 'number' && SQ.units && SQ.units.renderPos) {
        const p = SQ.units.renderPos(B.who);
        if (p) { B.x = p.x; B.z = p.z; }
      }
      const y = gy(B.x, B.z) + 3.4;
      B.spr.position.set(B.x, y, B.z);
      const ppm = pxScale(B.x, y, B.z);
      const h = 64;
      B.spr.scale.set(h * (512 / 160) * ppm, h * ppm, 1);
      const k = B.t / B.life;
      B.spr.material.opacity = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1;
    }
    void _w;
  };
})(window.SQ = window.SQ || {});
