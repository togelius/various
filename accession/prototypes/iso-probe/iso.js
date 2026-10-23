// iso.js: isometric 3D view of a generated layout (three.js r180, orthographic camera),
// plus a render-based measurement (ID buffer) of what the camera can and cannot see.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = new URLSearchParams(location.search);
const NAME = Q.get('layout') || 'sculpture_court_6_1';
const SCALE = +(Q.get('scale') || 32);       // CSS px per world unit, measured across the view (1 unit = 1 tile edge)
const MODE = Q.get('mode') || 'full';         // full | cutaway | xray | low
const ELEV = +(Q.get('elev') || 35.264);      // camera elevation in degrees (35.264 = true isometric, 30 = 2:1 pixel "isometric")
const AZ = +(Q.get('az') || 45);              // camera azimuth: 45 = camera to the south-east of the player
const WALL_H = +(Q.get('wallh') || 3);        // 3 units = 4.5 m if a tile is 1.5 m
const RADIUS = +(Q.get('radius') || 7);       // cutaway / x-ray radius around the player, in tiles
const LABELS = Q.get('labels') === '1';
const SHADOWS = Q.get('shadows') !== '0';
const L = ACC.parse(LAYOUTS[NAME]);
const R = ACC.resolve(L, NAME);
const P = UI.PAL;
UI.build({ title: R.title.split(',')[0] });
const [PX, PY] = R.player;
const VW = UI.VW, VH = UI.VH;
const C = hex => new THREE.Color(hex);

// ---------------------------------------------------------------- parts
// Every piece of geometry is a "part" with a role and the tile it belongs to. The visible scene and
// the measurement (ID) scene are both built from the same parts, so the numbers describe the render.
// roles: floor (walkable floor top), under (floor under furniture), solid (furniture, opaque),
// wall (wall, lintel, door, partition), xwall (wall drawn translucent in x-ray mode), water,
// glass (vitrine glass, translucent), fig (figure), base (grout plane).
const parts = [];
const boxGeo = (w, h, d, cx, y0, cz) => new THREE.BoxGeometry(w, h, d).translate(cx, y0 + h / 2, cz);
const cylGeo = (rt, rb, h, cx, y0, cz, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(cx, y0 + h / 2, cz);
const sphGeo = (r, cx, cy, cz) => new THREE.SphereGeometry(r, 16, 12).translate(cx, cy, cz);
function add(geo, color, tile, role, extra = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  const dim = tile && role !== 'fig' && !R.vis[tile[1] * L.W + tile[0]] ? 0.42 : 1; // line of sight: dim what the player cannot see
  for (let i = 0; i < n; i++) {
    const c = typeof color === 'function' ? color(Math.floor(i / 6)) : color; // box faces: +x -x +y -y +z -z
    col[i * 3] = c.r * dim; col[i * 3 + 1] = c.g * dim; col[i * 3 + 2] = c.b * dim;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  parts.push({ geo: g, tile, role, ...extra });
}
// Cut region for the cutaway and x-ray modes: walls within RADIUS tiles of the player on the floor, plus walls
// between the camera and the player's surroundings (closer to the camera than the player and within SRADIUS
// world units of the player in screen space), the way XCOM-style cutouts follow the camera ray.
const SRADIUS = +(Q.get('sradius') || 5);
const el0 = ELEV * Math.PI / 180, az0 = AZ * Math.PI / 180;
const DIR = new THREE.Vector3(Math.sin(az0) * Math.cos(el0), Math.sin(el0), Math.cos(az0) * Math.cos(el0));
const T0 = new THREE.Vector3(PX + 0.5, 0.5, PY + 0.5);
const near = (x, y) => {
  if ((x - PX) ** 2 + (y - PY) ** 2 <= RADIUS * RADIUS) return true;
  const d = new THREE.Vector3(x + 0.5, 1.0, y + 0.5).sub(T0), along = d.dot(DIR);
  return along > 0 && d.addScaledVector(DIR, -along).length() <= SRADIUS;
};
const wallTop = (x, y) => MODE === 'low' ? 0.35 : (MODE === 'cutaway' && near(x, y)) ? 0.3 : WALL_H;
const wallRole = (x, y) => MODE === 'xray' && near(x, y) ? 'xwall' : 'wall';
const wallCol = f => f === 2 || f === 3 ? C(P.wallCap) : f <= 1 ? C(P.wallFaceE) : C(P.wallFace);
const isWallish = ch => '#,+SEX'.includes(ch);
const colTop = MODE === 'low' ? WALL_H : WALL_H; // columns keep full height in every mode (they block sight)

add(boxGeo(L.W + 2, 0.2, L.H + 2, L.W / 2, -0.3, L.H / 2), C('#3b342b'), null, 'base');
const exhibitAt = (x, y) => R.exhibits.find(e => e.x === x && e.y === y);

for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
  const ch = L.at(x, y), t = [x, y], cx = x + 0.5, cz = y + 0.5;
  if (ch === '#') { const h = wallTop(x, y); add(boxGeo(1, h + 0.06, 1, cx, -0.06, cz), wallCol, t, wallRole(x, y)); continue; }
  if (ch === '~') {
    add(boxGeo(1, 0.04, 1, cx, -0.12, cz), C(P.pool), t, 'water'); // surface at -0.08, above the grout plane
    const rim = (w, d, ox, oz) => add(boxGeo(w, 0.2, d, cx + ox, -0.08, cz + oz), C(P.rim), t, 'solid');
    if (L.at(x, y - 1) !== '~') rim(1, 0.12, 0, -0.44); if (L.at(x, y + 1) !== '~') rim(1, 0.12, 0, 0.44);
    if (L.at(x - 1, y) !== '~') rim(0.12, 1, -0.44, 0); if (L.at(x + 1, y) !== '~') rim(0.12, 1, 0.44, 0);
    continue;
  }
  const fc = C(((x + y) & 1) ? P.floorB : P.floorA);
  add(boxGeo(0.96, 0.06, 0.96, cx, -0.06, cz), fc, t, ACC.walkable(L, x, y) ? 'floor' : 'under');
  const horiz = isWallish(L.at(x - 1, y)) || isWallish(L.at(x + 1, y));
  if (',+SEX'.includes(ch)) { // openings in a wall line: lintel above, door leaf for closed doors
    const top = wallTop(x, y);
    if (top > 2.4) add(boxGeo(1, top - 2.4, 1, cx, 2.4, cz), wallCol, t, wallRole(x, y));
    if ('+SXE'.includes(ch)) {
      const h = Math.min(2.3, top), col = C(ch === '+' ? P.door : ch === 'S' ? P.staffDoor : ch === 'X' ? P.exit : P.mat);
      const leaf = ch === 'X' || ch === 'E' ? 0.12 : 0.18;
      add(horiz ? boxGeo(1, h, leaf, cx, 0, cz) : boxGeo(leaf, h, 1, cx, 0, cz), col, t, wallRole(x, y));
      if (ch === 'X' && h > 1.5) add(horiz ? boxGeo(0.5, 0.3, 0.2, cx, 1.7, cz) : boxGeo(0.2, 0.3, 0.5, cx, 1.7, cz), C(P.placard), t, 'solid');
    }
    continue;
  }
  switch (ch) {
    case 'v': {
      add(boxGeo(0.86, 0.55, 0.86, cx, 0, cz), C(P.vitrineBase), t, 'solid');
      add(boxGeo(0.84, 0.95, 0.84, cx, 0.55, cz), C(P.glass), t, 'glass');
      const e = 0.035, hh = 0.95, y0 = 0.55, s = 0.43; // thin metal frame on the glass edges
      for (const [ox, oz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) add(boxGeo(e, hh, e, cx + ox, y0, cz + oz), C('#d8dde0'), t, 'solid');
      for (const oz of [-s, s]) add(boxGeo(0.86, e, e, cx, y0 + hh - e, cz + oz), C('#d8dde0'), t, 'solid');
      for (const ox of [-s, s]) add(boxGeo(e, e, 0.86, cx + ox, y0 + hh - e, cz), C('#d8dde0'), t, 'solid');
      break;
    }
    case 'o': {
      if (ACC.oKind(L, x, y) === 'column') {
        add(boxGeo(0.78, 0.18, 0.78, cx, 0, cz), C(P.column), t, 'solid');
        add(cylGeo(0.27, 0.3, colTop - 0.36, cx, 0.18, cz, 18), C(P.column), t, 'solid');
        add(boxGeo(0.78, 0.18, 0.78, cx, colTop - 0.18, cz), C(P.column), t, 'solid');
      } else {
        add(boxGeo(0.8, 1.0, 0.8, cx, 0, cz), C(P.plinth), t, 'solid');
        if (!exhibitAt(x, y)) { add(cylGeo(0.15, 0.22, 0.7, cx, 1.0, cz, 12), C(P.statue), t, 'solid'); add(sphGeo(0.15, cx, 1.85, cz), C(P.statue), t, 'solid'); }
      }
      break;
    }
    case 'p': add(boxGeo(0.8, 0.5, 0.8, cx, 0, cz), C(P.lowPlinth), t, 'solid'); break;
    case 'b': add(boxGeo(0.45, 0.42, 0.9, cx, 0, cz), C(P.bench), t, 'solid'); break;
    case '|': { const h = Math.min(1.8, wallTop(x, y)); add(boxGeo(0.22, h, 1, cx, 0, cz), wallCol, t, wallRole(x, y)); break; }
    case 'l': add(boxGeo(0.5, 0.85, 0.4, cx, 0, cz), C(P.lectern), t, 'solid'); break;
    case 'C': {
      add(boxGeo(0.92, 0.9, 0.92, cx, 0, cz), C(P.goldDark), t, 'solid');
      add(new THREE.IcosahedronGeometry(0.42, 0).translate(cx, 1.35, cz), C(P.gold), t, 'solid');
      break;
    }
    case 'I': case 'K': case 's': add(boxGeo(0.5, 0.75, 0.08, cx, 0, cz), C(P.panel), t, 'solid'); break;
  }
}

// ---------------------------------------------------------------- figures
// Height about 1 unit (1.5 m); exhibits are squat, the player is slimmer, both coloured by role/state.
function figureParts(kind, state, x, y, figIndex, out) {
  const ch = L.at(x, y), cx = x + 0.5, cz = y + 0.5;
  let y0 = 0, s = 1;
  if (ch === 'v') { y0 = 0.55; s = 0.72; } else if (ch === 'p') y0 = 0.5; else if (ch === 'o') y0 = 1.0;
  const body = kind === 'player' ? C(P.player) : C(P[state]), head = kind === 'player' ? C(P.playerHead) : C(P[state + 'Head']);
  const g1 = kind === 'player' ? cylGeo(0.15 * s, 0.22 * s, 0.66 * s, cx, y0, cz, 14) : cylGeo(0.2 * s, 0.28 * s, 0.6 * s, cx, y0, cz, 14);
  const hy = y0 + (kind === 'player' ? 0.66 : 0.6) * s + 0.16 * s;
  const g2 = sphGeo((kind === 'player' ? 0.17 : 0.19) * s, cx, hy, cz);
  out.push({ geo: g1, color: body, tile: [x, y], role: 'fig', fig: figIndex });
  out.push({ geo: g2, color: head, tile: [x, y], role: 'fig', fig: figIndex });
  return hy + 0.19 * s; // top of head
}
const figs = []; // { kind, id, x, y, top }
{
  const out = [];
  R.exhibits.forEach((e, i) => { const top = figureParts('exhibit', e.state, e.x, e.y, i, out); figs.push({ kind: 'exhibit', id: e.id, state: e.state, x: e.x, y: e.y, top }); });
  const top = figureParts('player', null, PX, PY, R.exhibits.length, out); figs.push({ kind: 'player', id: 'you', x: PX, y: PY, top });
  for (const p of out) add(p.geo, p.color, p.tile, 'fig', { fig: p.fig });
}

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio || 1);
renderer.setSize(VW, VH);
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(P.void, 1);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();

const mergeRole = roles => { const ps = parts.filter(p => roles.includes(p.role)); return ps.length ? mergeGeometries(ps.map(p => p.geo)) : null; };
const opaque = new THREE.Mesh(mergeRole(['base', 'floor', 'under', 'solid', 'wall', 'water']), new THREE.MeshLambertMaterial({ vertexColors: true }));
opaque.castShadow = true; opaque.receiveShadow = true; scene.add(opaque);
const figGeo = mergeRole(['fig']);
const figMesh = new THREE.Mesh(figGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
figMesh.castShadow = true; figMesh.receiveShadow = true; scene.add(figMesh);
const glassGeo = mergeRole(['glass']);
if (glassGeo) {
  const gm = new THREE.Mesh(glassGeo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, emissive: C('#2a4a5a') }));
  gm.renderOrder = 2; scene.add(gm);
}
const xGeo = mergeRole(['xwall']);
if (xGeo) {
  const xm = new THREE.Mesh(xGeo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false }));
  xm.renderOrder = 3; scene.add(xm);
}
if (MODE === 'xray') { // figures behind anything opaque show as flat silhouettes
  const sil = new THREE.Mesh(figGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, depthFunc: THREE.GreaterDepth }));
  sil.renderOrder = 5; scene.add(sil);
}

// Floor decals: line of sight is in the vertex colours; telegraph, tap path, presence ring here.
const decal = (geo, color, opacity, y = 0.012) => {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 1; scene.add(m); return m;
};
for (const [x, y] of R.telegraphTiles) {
  decal(new THREE.PlaneGeometry(0.96, 0.96).translate(x + 0.5, -(y + 0.5), 0), P.telegraph, 0.6);
  const fr = new THREE.Shape(); fr.moveTo(-0.48, -0.48); fr.lineTo(0.48, -0.48); fr.lineTo(0.48, 0.48); fr.lineTo(-0.48, 0.48);
  const hole = new THREE.Path(); hole.moveTo(-0.42, -0.42); hole.lineTo(-0.42, 0.42); hole.lineTo(0.42, 0.42); hole.lineTo(0.42, -0.42); fr.holes.push(hole);
  decal(new THREE.ShapeGeometry(fr).translate(x + 0.5, -(y + 0.5), 0), '#ff7a7a', 1, 0.014);
}
{
  const [x, y] = R.tap;
  for (const [a, b] of [[0.46, 0.38], [0.3, 0.24]]) {
    const fr = new THREE.Shape(); fr.moveTo(-a, -a); fr.lineTo(a, -a); fr.lineTo(a, a); fr.lineTo(-a, a);
    const hole = new THREE.Path(); hole.moveTo(-b, -b); hole.lineTo(-b, b); hole.lineTo(b, b); hole.lineTo(b, -b); fr.holes.push(hole);
    decal(new THREE.ShapeGeometry(fr).translate(x + 0.5, -(y + 0.5), 0), P.tap, 1, 0.016);
  }
  for (const [px, py] of R.tapPath.slice(0, -1)) decal(new THREE.CircleGeometry(0.08, 12).translate(px + 0.5, -(py + 0.5), 0), P.tap, 1, 0.016);
}
for (let i = 0; i < 40; i += 2) decal(new THREE.RingGeometry(3.45, 3.55, 6, 1, i * Math.PI / 20, Math.PI / 20).translate(PX + 0.5, -(PY + 0.5), 0), '#ffffff', 0.7, 0.018);
decal(new THREE.RingGeometry(0.3, 0.4, 32).translate(PX + 0.5, -(PY + 0.5), 0), P.player, 0.9, 0.02);

// Sprites: state icons and the telegraph's damage number.
function spriteTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const ICON = {
  asleep: spriteTex(g => { g.fillStyle = '#2b3248'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 32, 30); }),
  stirring: spriteTex(g => { g.fillStyle = '#4a3208'; g.fillRect(4, 18, 56, 28); for (let i = 0; i < 3; i++) { g.fillStyle = i < 2 ? P.stirring : '#2a1d05'; g.beginPath(); g.arc(16 + i * 16, 32, 6, 0, 7); g.fill(); } }),
  awake: spriteTex(g => { g.fillStyle = '#e04848'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 33); }),
};
const onTop = MODE === 'xray';
for (const f of figs) if (f.kind === 'exhibit') {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON[f.state], depthTest: !onTop, transparent: true }));
  s.scale.set(0.42, 0.42, 1); s.position.set(f.x + 0.5, f.top + 0.3, f.y + 0.5); s.renderOrder = 6; scene.add(s);
}
{
  const tt = R.telegraphTiles[Math.floor((R.telegraphTiles.length - 1) / 2)];
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex(g => { g.font = '900 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#2a0808'; g.strokeText(String(R.telegraph.dmg), 32, 34); g.fillStyle = '#fff'; g.fillText(String(R.telegraph.dmg), 32, 34); }), depthTest: !onTop, transparent: true }));
  s.scale.set(0.5, 0.5, 1); s.position.set(tt[0] + 0.5, 0.25, tt[1] + 0.5); s.renderOrder = 6; scene.add(s);
}

// Lights: soft sky fill, one sun from the south-west (lights the south faces the camera sees),
// two spotlight pools on exhibits.
scene.add(new THREE.HemisphereLight(0xf2efff, 0x5a4a3a, 2.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.3);
const ctr = new THREE.Vector3(L.W / 2, 0, L.H / 2);
sun.position.copy(ctr).add(new THREE.Vector3(-0.35, 1, 0.45).multiplyScalar(40)); sun.target.position.copy(ctr);
sun.castShadow = SHADOWS; sun.shadow.mapSize.set(4096, 4096); sun.shadow.intensity = 0.55; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
const ext = Math.max(L.W, L.H) * 0.8; Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 100 });
scene.add(sun, sun.target);
for (const id of ['D', 'A']) {
  const e = R.exhibits.find(e => e.id === id);
  const sp = new THREE.SpotLight(0xfff4d6, 45, 0, 0.32, 0.65, 1.6);
  sp.position.set(e.x + 0.5, 6, e.y + 0.5); sp.target.position.set(e.x + 0.5, 0, e.y + 0.5); scene.add(sp, sp.target);
}

// ---------------------------------------------------------------- camera
const pr = UI.playRect();
const target = new THREE.Vector3(PX + 0.5, 0.5, PY + 0.5);
function makeCam(left, right, top, bottom, tgt) {
  const cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 400);
  cam.position.copy(tgt).addScaledVector(DIR, 150); cam.up.set(0, 1, 0); cam.lookAt(tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return cam;
}
const camera = makeCam(-VW / 2 / SCALE, VW / 2 / SCALE, pr.cy / SCALE, -(VH - pr.cy) / SCALE, target);
const t0 = performance.now();
renderer.render(scene, camera);
const renderMs = performance.now() - t0;
const toCss = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * VW, (1 - p.y) / 2 * VH]; };
if (LABELS) for (const f of figs) {
  const [sx, sy] = toCss(new THREE.Vector3(f.x + 0.5, f.top + 0.62, f.y + 0.5));
  const d = document.createElement('div'); d.className = 'lbl'; d.textContent = f.id; d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.appendChild(d);
}

// ---------------------------------------------------------------- measurement
// ID buffer: every part is drawn in a flat colour that encodes what it is. Floor tops of walkable tiles
// get 1 + tileIndex; furniture and walls get SOLID + 1 + tileIndex; figures get FIG + index.
// Glass and x-ray walls are left out (they are see-through). No antialiasing, no colour management.
const ID_SOLID = 0x400000, ID_FIG = 0x800000, ID_OCC = 0xfffffe;
const idMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: 'attribute vec3 idc; flat varying vec3 vId; void main(){ vId = idc; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'layout(location = 0) out highp vec4 idOut; flat varying vec3 vId; void main(){ idOut = vec4(vId, 1.0); }',
});
function idOf(p) {
  if (p.role === 'fig') return ID_FIG + p.fig;
  if (!p.tile) return ID_OCC;
  const ti = p.tile[1] * L.W + p.tile[0];
  return p.role === 'floor' ? 1 + ti : ID_SOLID + 1 + ti;
}
function idMesh(ps) {
  if (!ps.length) return null;
  const geos = ps.map(p => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', p.geo.attributes.position);
    const id = idOf(p), n = p.geo.attributes.position.count, a = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = (id >> 16) & 255; a[i * 3 + 1] = (id >> 8) & 255; a[i * 3 + 2] = id & 255; }
    g.setAttribute('idc', new THREE.BufferAttribute(a, 3, true)); return g;
  });
  return new THREE.Mesh(mergeGeometries(geos), idMat);
}
function renderIds(meshes, cam, w, h) {
  const sc = new THREE.Scene(); for (const m of meshes) if (m) sc.add(m);
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 0, depthBuffer: true });
  const prevPR = renderer.getPixelRatio();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(sc, cam);
  const buf = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  renderer.setRenderTarget(null); renderer.setClearColor(P.void, 1); rt.dispose();
  const ids = new Uint32Array(w * h); // row 0 = top
  for (let row = 0; row < h; row++) { const src = (h - 1 - row) * w * 4, dst = row * w; for (let i = 0; i < w; i++) { const o = src + i * 4; ids[dst + i] = (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2]; } }
  return ids;
}
const countIds = ids => { const m = new Map(); for (const v of ids) if (v) m.set(v, (m.get(v) || 0) + 1); return m; };
const occluderRoles = ['base', 'under', 'solid', 'wall', 'water'];
const floorParts = parts.filter(p => p.role === 'floor');
const occParts = parts.filter(p => occluderRoles.includes(p.role));
const figPartsAll = parts.filter(p => p.role === 'fig');
const walkTiles = []; for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) if (ACC.walkable(L, x, y)) walkTiles.push([x, y]);
const classify = f => f < 0.25 ? 'hidden' : f < 0.75 ? 'partly' : 'clear';
const summary = arr => { const s = { n: arr.length, hidden: 0, partly: 0, clear: 0 }; for (const f of arr) s[classify(f)]++; for (const k of ['hidden', 'partly', 'clear']) s[k + 'Pct'] = +(100 * s[k] / Math.max(1, s.n)).toFixed(1); return s; };
const quant = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * (b.length - 1)))] : null; };

function measureViewport(ss) {
  const w = VW * ss, h = VH * ss;
  const floorOnly = countIds(renderIds([idMesh(floorParts)], camera, w, h));
  const sceneIds = renderIds([idMesh(floorParts), idMesh(occParts), idMesh(figPartsAll)], camera, w, h);
  const vis = countIds(sceneIds);
  const figOnly = countIds(renderIds([idMesh(figPartsAll)], camera, w, h));
  const inPlay = (sx, sy) => sx >= 0 && sx < VW && sy >= pr.y && sy < pr.y + pr.h;
  // tiles on screen (centre of the tile's floor in the play area)
  let mapOnScreen = 0; const onWalk = [];
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
    const [sx, sy] = toCss(new THREE.Vector3(x + 0.5, 0, y + 0.5));
    if (!inPlay(sx, sy)) continue; mapOnScreen++; if (ACC.walkable(L, x, y)) onWalk.push([x, y, sx, sy]);
  }
  const floorVis = onWalk.map(([x, y]) => { const id = 1 + y * L.W + x, a = floorOnly.get(id) || 0; return a ? (vis.get(id) || 0) / a : 0; });
  const losVis = floorVis.filter((f, i) => R.vis[onWalk[i][1] * L.W + onWalk[i][0]]); // tiles the player can see in the game
  // tap: the region of tile i is its floor, its furniture and any figure standing on it
  const figTile = new Map(); figs.forEach((f, i) => figTile.set(ID_FIG + i, f.y * L.W + f.x));
  // grout between floor tiles (the base plane, ID_OCC) is neutral ground: a picker that casts onto the floor plane
  // would assign it to the nearest tile, so it does not shrink a tile's tap tolerance.
  const ownerOf = v => { if (!v) return -1; if (v === ID_OCC) return -2; if (v >= ID_FIG) return figTile.has(v) ? figTile.get(v) : -1; if (v >= ID_SOLID) return v - ID_SOLID - 1; return v - 1; };
  const maxR = 40 * ss, tol = [], areas = [];
  const areaByTile = new Map(); for (const v of sceneIds) { const o = ownerOf(v); if (o >= 0) areaByTile.set(o, (areaByTile.get(o) || 0) + 1); }
  for (const [x, y, sx, sy] of onWalk) {
    const ti = y * L.W + x, cxp = Math.round(sx * ss), cyp = Math.round(sy * ss);
    areas.push((areaByTile.get(ti) || 0) / (ss * ss));
    if (ownerOf(sceneIds[cyp * w + cxp]) !== ti) { tol.push(0); continue; }
    let best = maxR * maxR;
    for (let dy = -maxR; dy <= maxR; dy++) { const yy = cyp + dy; if (yy < 0 || yy >= h) continue;
      for (let dx = -maxR; dx <= maxR; dx++) { const d2 = dx * dx + dy * dy; if (d2 >= best) continue; const xx = cxp + dx; if (xx < 0 || xx >= w) continue;
        const o = ownerOf(sceneIds[yy * w + xx]); if (o !== ti && o !== -2) best = d2; } }
    tol.push(Math.sqrt(best) / ss);
  }
  const figVis = figs.map((f, i) => { const a = figOnly.get(ID_FIG + i) || 0; return { id: f.id, onScreen: inPlay(...toCss(new THREE.Vector3(f.x + 0.5, f.top - 0.3, f.y + 0.5))), visibleFrac: a ? +((vis.get(ID_FIG + i) || 0) / a).toFixed(2) : null, areaCssPx: +(a / (ss * ss)).toFixed(0) }; });
  // reach: furthest tile (by centre) still on screen from the player, along map axes and diagonals
  const reach = {};
  for (const [k, ux, uy] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0], ['NE', 1, -1], ['NW', -1, -1], ['SE', 1, 1], ['SW', -1, 1]]) {
    let d = 0; while (d < 80 && inPlay(...toCss(new THREE.Vector3(PX + 0.5 + (d + 1) * ux, 0, PY + 0.5 + (d + 1) * uy)))) d++; reach[k] = d;
  }
  const diamond = (() => { const a = toCss(new THREE.Vector3(0, 0, 0)), b = toCss(new THREE.Vector3(1, 0, 0)), c = toCss(new THREE.Vector3(0, 0, 1)), d = toCss(new THREE.Vector3(1, 0, 1));
    const xs = [a[0], b[0], c[0], d[0]], ys = [a[1], b[1], c[1], d[1]]; return { w: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), h: +(Math.max(...ys) - Math.min(...ys)).toFixed(1) }; })();
  return {
    mapTilesOnScreen: mapOnScreen, walkableOnScreen: onWalk.length, tileDiamondCss: diamond, reach,
    floorOnScreen: summary(floorVis), floorInLosOnScreen: summary(losVis),
    tap: { medianTolCss: +quant(tol, 0.5).toFixed(1), p10TolCss: +quant(tol, 0.1).toFixed(1), p90TolCss: +quant(tol, 0.9).toFixed(1),
      pctTolGe22: +(100 * tol.filter(r => r >= 22).length / tol.length).toFixed(1), pctTolGe12: +(100 * tol.filter(r => r >= 12).length / tol.length).toFixed(1),
      pctCentreCovered: +(100 * tol.filter(r => r === 0).length / tol.length).toFixed(1), medianAreaCss2: +quant(areas, 0.5).toFixed(0) },
    figures: figVis,
  };
}

function globalCam(S) {
  // Same direction as the play camera, framing the whole map.
  const cam0 = makeCam(-1, 1, 1, -1, new THREE.Vector3(L.W / 2, 0, L.H / 2));
  const inv = cam0.matrixWorldInverse; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const x of [0, L.W]) for (const z of [0, L.H]) for (const y of [-0.3, WALL_H + 0.5]) { const v = new THREE.Vector3(x, y, z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const cam = makeCam(x0 - 0.5, x1 + 0.5, y1 + 0.5, y0 - 0.5, new THREE.Vector3(L.W / 2, 0, L.H / 2));
  return { cam, w: Math.ceil((x1 - x0 + 1) * S), h: Math.ceil((y1 - y0 + 1) * S) };
}
function measureGlobal(S) {
  const { cam, w, h } = globalCam(S);
  const floorOnly = countIds(renderIds([idMesh(floorParts)], cam, w, h));
  const vis = countIds(renderIds([idMesh(floorParts), idMesh(occParts)], cam, w, h));
  const floorFrac = walkTiles.map(([x, y]) => { const id = 1 + y * L.W + x, a = floorOnly.get(id) || 0; return a ? (vis.get(id) || 0) / a : 0; });
  // A figure on every walkable tile, nine passes on a 3x3 lattice so that figures never overlap each other.
  const figFrac = new Array(walkTiles.length).fill(0);
  for (let c = 0; c < 9; c++) {
    const idx = [], fp = [];
    walkTiles.forEach(([x, y], i) => { if (x % 3 === c % 3 && y % 3 === ((c / 3) | 0)) { idx.push(i); figureParts('exhibit', 'asleep', x, y, i, fp); } });
    if (!idx.length) continue;
    const fparts = fp.map(p => ({ ...p, geo: p.geo.index ? p.geo.toNonIndexed() : p.geo }));
    const fo = countIds(renderIds([idMesh(fparts)], cam, w, h));
    const fv = countIds(renderIds([idMesh(floorParts), idMesh(occParts), idMesh(fparts)], cam, w, h));
    for (const i of idx) { const a = fo.get(ID_FIG + i) || 0; figFrac[i] = a ? (fv.get(ID_FIG + i) || 0) / a : 0; }
  }
  return { target: [w, h], floor: summary(floorFrac), figurePositions: summary(figFrac),
    perTile: walkTiles.map(([x, y], i) => [x, y, +floorFrac[i].toFixed(2), +figFrac[i].toFixed(2)]) };
}

window.measure = async function (o = {}) {
  const out = { layout: NAME, mode: MODE, scale: SCALE, elev: ELEV, az: AZ, wallH: WALL_H, radius: RADIUS, sradius: SRADIUS };
  if (o.viewport !== false) out.viewport = measureViewport(o.ss || 2);
  if (o.global) out.global = measureGlobal(o.globalScale || 40);
  if (!o.perTile && out.global) delete out.global.perTile;
  return out;
};
window.__metrics = { view: 'iso', layout: NAME, mode: MODE, scale: SCALE, elev: ELEV, az: AZ, wallH: WALL_H, viewport: [VW, VH], dpr: devicePixelRatio,
  renderMs: +renderMs.toFixed(0), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  gl: (() => { const gl = renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : ''; })() };
window.__ready = true;
