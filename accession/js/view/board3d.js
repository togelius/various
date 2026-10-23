// ACCESSION — Board3DView: the optional 3D board (BUILD.md §6). It draws the same view
// model as TopDownView and decides nothing. A steep camera, half-height walls, a cutaway
// for walls in front of anything visible, x-ray silhouettes, billboarded 16×16 sprites and
// ground-plane picking (research/isometric.md §6). Removing this file and the three.js
// placeholder in index.html removes the 3D view (tools/remove-3d.sh).
'use strict';
const Board3D = (() => {
  const ELEV = 60, AZ = 45, WALL_H = 1.5, ZOOM = [48, 64];
  let loading = null;

  // three.js arrives as an inert <script type="text/x-three"> block (inlined in dist/, or
  // naming the vendored file in development) and is run on first use.
  function ensureThree(onReady) {
    if (window.THREE) return true;
    const block = document.querySelector('script[type="text/x-three"]');
    if (!block) throw new Error('three.js is not part of this build');
    if (block.textContent.trim()) {
      const s = document.createElement('script');
      s.textContent = block.textContent;
      document.head.appendChild(s);
      if (!window.THREE) throw new Error('three.js did not start');
      return true;
    }
    if (!loading) {
      loading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = block.dataset.src; s.onload = res; s.onerror = () => rej(new Error('three.js could not be loaded')); document.head.appendChild(s); });
    }
    loading.then(onReady, () => {});
    return false;
  }

  function factory(host) {
    const canvas = document.createElement('canvas');
    canvas.className = 'board-canvas';
    host.appendChild(canvas);
    const probe = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!probe) { canvas.remove(); throw new Error('WebGL is unavailable'); }
    let ready = false, three = null, lastVm = null, zoom = 0, tile = ZOOM[0];
    let T, renderer, scene, camera, layers, texCache;
    const api = {
      id: 'board3d', zooms: ZOOM,
      draw(vm) { lastVm = vm; if (ready) render(vm); },
      pick(cx, cy) { return ready && lastVm ? pick(cx, cy) : null; },
      tileRect(x, y) { return ready ? tileRect(x, y) : { x: 0, y: 0, w: 0, h: 0 }; },
      setZoom(step) { zoom = Math.max(0, Math.min(ZOOM.length - 1, step)); tile = ZOOM[zoom]; if (lastVm) api.draw(lastVm); },
      zoomStep: () => zoom,
      dispose() { if (three) three.renderer.dispose(); canvas.remove(); },
      stats: () => (three ? { calls: three.renderer.info.render.calls, triangles: three.renderer.info.render.triangles } : null),
    };
    const start = () => { three = setup(canvas); ready = true; if (lastVm) render(lastVm); };
    if (ensureThree(start)) start();

    // ---------------------------------------------------------------- scene
    function setup(cv) {
      T = window.THREE;
      renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
      renderer.outputColorSpace = T.SRGBColorSpace;
      scene = new T.Scene();
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
      scene.add(new T.AmbientLight(0xffffff, 1.6));
      const sun = new T.DirectionalLight(0xffffff, 1.4);
      sun.position.set(-3, 10, -5);
      scene.add(sun);
      layers = new T.Group();
      scene.add(layers);
      texCache = new Map();
      return { renderer };
    }

    const col = h => new T.Color(h);
    function texture(key, make) {
      if (!texCache.has(key)) {
        const c = make();
        const t = new T.CanvasTexture(c);
        t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.colorSpace = T.SRGBColorSpace;
        texCache.set(key, t);
      }
      return texCache.get(key);
    }
    function glyphCanvas(id) { const c = document.createElement('canvas'); c.width = c.height = 32; Pictograms.draw(c.getContext('2d'), id, 0, 0, 32); return c; }
    function numberCanvas(n) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.font = 'bold 40px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 6; x.strokeStyle = '#000000'; x.strokeText(String(n), 32, 34); x.fillText(String(n), 32, 34);
      return c;
    }

    // Disposes of everything built for the last frame. Geometry and materials are shared
    // and cached; only meshes are rebuilt.
    const geo = {}, mat = {};
    function g(key, make) { return geo[key] || (geo[key] = make()); }
    function m(key, make) { return mat[key] || (mat[key] = make()); }

    function box(w, h, d) { return g(`box${w},${h},${d}`, () => new T.BoxGeometry(w, h, d)); }
    function lambert(hex, opts) { return m(`l${hex}${opts ? JSON.stringify(opts) : ''}`, () => new T.MeshLambertMaterial(Object.assign({ color: col(hex) }, opts || {}))); }
    function basic(hex, opts) { return m(`b${hex}${opts ? JSON.stringify(opts) : ''}`, () => new T.MeshBasicMaterial(Object.assign({ color: col(hex) }, opts || {}))); }

    function addBox(x, y, w, h, d, material, lift) {
      const mesh = new T.Mesh(box(w, h, d), material);
      mesh.position.set(x + 0.5, (lift || 0) + h / 2, y + 0.5);
      layers.add(mesh);
      return mesh;
    }
    function addFlat(x, y, size, material, lift) {
      const mesh = new T.Mesh(g(`plane${size}`, () => { const p = new T.PlaneGeometry(size, size); p.rotateX(-Math.PI / 2); return p; }), material);
      mesh.position.set(x + 0.5, lift || 0.002, y + 0.5);
      layers.add(mesh);
      return mesh;
    }
    function addSprite(texKey, make, x, y, size, opts) {
      const sm = m(`s${texKey}${opts && opts.xray ? 'x' : ''}`, () => new T.SpriteMaterial({ map: texture(texKey, make), transparent: true,
        depthTest: !(opts && opts.xray), depthWrite: !(opts && opts.xray), opacity: opts && opts.xray ? 0.35 : 1 }));
      const s = new T.Sprite(sm);
      s.center.set(0.5, 0);
      s.scale.set(size, size, 1);
      s.position.set(x + size / 2, (opts && opts.lift) || 0.02, y + size / 2);
      if (opts && opts.xray) s.renderOrder = 10;
      layers.add(s);
      return s;
    }

    // ---------------------------------------------------------------- frame
    function render(vm) {
      const P = ART.palettes.dept[vm.dept] || ART.palettes.dept.T0;
      while (layers.children.length) layers.remove(layers.children[0]);
      const r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(r.width, r.height, false);
      scene.background = col('#0d0c10');
      // Camera: orthographic, ELEV above the floor, from the south-east, centred on the target.
      const halfW = r.width / tile / 2, halfH = r.height / tile / 2;
      Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
      camera.updateProjectionMatrix();
      const el = ELEV * Math.PI / 180, az = AZ * Math.PI / 180, dist = 60;
      const tx = vm.camera.x + 0.5, tz = vm.camera.y + 0.5;
      camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(tx, 0, tz);
      camera.updateMatrixWorld();

      // Cutaway: a wall just in front of a visible actor or of you (camera side) is a stub.
      const cut = new Set();
      for (const a of vm.actors) { const n = a.size || 1; for (let dx = 0; dx <= n; dx++) for (let dy = 0; dy <= n; dy++) cut.add((a.y + dy) * vm.w + a.x + dx); }
      const dim = (hex, f) => { const c = col(hex); c.multiplyScalar(f); return '#' + c.getHexString(); };
      for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
        const v = vm.vis[y * vm.w + x];
        if (!v) continue;
        const k = v === 1 ? 0.45 : 1, ch = vm.tiles[y][x];
        const floor = dim(((x + y) & 1) ? P.floor2 : P.floor, k);
        if (ch === '#' || ch === '+' || ch === 'S') {
          const stub = cut.has(y * vm.w + x);
          const h = stub ? 0.18 : WALL_H;
          const body = ch === '#' ? dim(P.wall, k) : dim(ch === 'S' ? '#5c5560' : '#7a5232', k);
          addBox(x, y, 1, h, 1, lambert(body));
          addBox(x, y, 1, 0.04, 1, lambert(dim(P.wallTop, k)), h);
          continue;
        }
        addFlat(x, y, 1, lambert(ch === '~' || ch === 'w' ? dim('#2b4f66', k) : floor));
        switch (ch) {
          case 'v': addBox(x + 0.06, y + 0.06, 0.88, 0.25, 0.88, lambert(dim(P.floor, 0.6 * k)));
            addBox(x + 0.06, y + 0.06, 0.88, 0.6, 0.88, lambert(P.glass, { transparent: true, opacity: 0.4 }), 0.25); break;
          case 'k': addBox(x + 0.06, y + 0.06, 0.88, 0.25, 0.88, lambert(dim(P.floor, 0.6 * k))); break;
          case 'p': addBox(x + 0.15, y + 0.15, 0.7, 0.5, 0.7, lambert(dim(P['3'], k))); break;
          case 'o': { const c = new T.Mesh(g('col', () => new T.CylinderGeometry(0.3, 0.32, WALL_H, 12)), lambert(dim(P.wall, k)));
            c.position.set(x + 0.5, WALL_H / 2, y + 0.5); layers.add(c); break; }
          case 'b': addBox(x + 0.1, y + 0.3, 0.8, 0.3, 0.4, lambert(dim('#6b4a2e', k))); break;
          case 'l': addBox(x + 0.25, y + 0.25, 0.5, 0.7, 0.5, lambert(dim('#8a6440', k))); break;
          case 'f': case 'c': addBox(x + 0.08, y + 0.08, 0.84, 0.45, 0.84, lambert(dim('#6b4a2e', k))); break;
          case 'H': case '|': addBox(x, y, 1, 1.1, 1, lambert(dim(ch === 'H' ? '#4b4038' : P.wall, k))); break;
          case '=': addBox(x, y + 0.45, 1, 0.08, 0.1, lambert('#9a2a3a'), 0.4); break;
        }
      }
      // Your ring and the path preview, flat on the floor.
      for (let i = 0; i < vm.w * vm.h; i++) if (vm.ring[i]) { const x = i % vm.w; addFlat(x, (i - x) / vm.w, 0.94, basic(ART.palettes.semantic.player, { transparent: true, opacity: 0.16, depthWrite: false }), 0.006); }
      if (vm.path) for (const [x, y] of vm.path) addFlat(x, y, 0.18, basic(ART.palettes.semantic.player), 0.01);
      // Telegraphs: the exact damage you would take, in the hazard colour.
      for (const mk of vm.marks) {
        if (mk.kind !== 'telegraph') continue;
        addFlat(mk.x, mk.y, 0.96, basic(ART.palettes.semantic.hazard, { transparent: true, opacity: 0.55, depthWrite: false }), 0.012);
        addSprite('n' + mk.dmg, () => numberCanvas(mk.dmg), mk.x + 0.2, mk.y + 0.2, 0.6, { lift: 0.05 });
      }
      // Actors: billboards, with an x-ray copy that shows through anything in front.
      for (const a of vm.actors) {
        const n = a.size || 1, key = 'a' + a.sprite + '/' + vm.dept;
        const make = () => Sprites.board(a.sprite, vm.dept) || glyphCanvas('special');
        addSprite(key, make, a.x, a.y, n);
        addSprite(key, make, a.x, a.y, n, { xray: true });
        addFlat(a.x + (n - 1) / 2, a.y + (n - 1) / 2, 0.6, basic(a.hostile ? ART.palettes.semantic.hostile : ART.palettes.semantic.player), 0.015);
        if (a.hostile) {
          const id = a.mode === 'dormant' ? (a.pips ? 'pip' : 'asleep') : a.mode === 'hunting' ? 'hunting' : a.mode === 'returning' ? 'returning' : 'alert';
          const s = addSprite('g' + id, () => glyphCanvas(id), a.x + n / 2 - 0.2, a.y + n / 2 - 0.2, 0.4, { lift: n + 0.15 });
          if (a.mode === 'dormant' && a.pips) s.scale.set(0.25 * a.pips + 0.15, 0.25, 1);
        }
        if (vm.selection === a.uid) addFlat(a.x + (n - 1) / 2, a.y + (n - 1) / 2, n * 1.05, basic(ART.palettes.semantic.readable, { transparent: true, opacity: 0.35, depthWrite: false }), 0.008);
      }
      if (vm.selectedTile) addFlat(vm.selectedTile.x, vm.selectedTile.y, 1, basic(ART.palettes.semantic.readable, { transparent: true, opacity: 0.35, depthWrite: false }), 0.008);
      renderer.render(scene, camera);
    }

    // ---------------------------------------------------------------- picking
    function ndc(cx, cy) { const r = canvas.getBoundingClientRect(); return new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
    function pick(cx, cy) {
      const ray = new T.Raycaster();
      ray.setFromCamera(ndc(cx, cy), camera);
      // An actor's billboard first, so tapping its head picks its tile, not the floor behind.
      const sprites = layers.children.filter(o => o.isSprite && o.material.depthTest && o.scale.x >= 1);
      const hit = ray.intersectObjects(sprites, false)[0];
      if (hit) { const o = hit.object; return { x: Math.floor(o.position.x - o.scale.x / 2 + 0.001), y: Math.floor(o.position.z - o.scale.x / 2 + 0.001) }; }
      const p = new T.Vector3();
      if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), p)) return null;
      const x = Math.floor(p.x), y = Math.floor(p.z);
      if (x < 0 || y < 0 || x >= lastVm.w || y >= lastVm.h) return null;
      return { x, y };
    }
    function tileRect(x, y) {
      const r = canvas.getBoundingClientRect(), v = new T.Vector3(x + 0.5, 0, y + 0.5).project(camera);
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
      return { x: sx - tile / 2, y: sy - tile / 2, w: tile, h: tile };
    }

    return api;
  }

  Views.register('board3d', factory);
  return { ELEV, AZ, WALL_H, ZOOM };
})();
