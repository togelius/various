// ACCESSION — Board3DView: the optional 3D board (BUILD.md §6.2). It draws the same view
// model as TopDownView and decides nothing. An orthographic camera 60° above the floor,
// from the south so north stays up; walls, cases and furniture as solid blocks; your ring,
// the path, telegraphs, actors and their marks on a 2D layer above the scene, so a wall
// can hide floor but never an exhibit or a mark. Removing this file and the three.js
// placeholder in index.html removes the 3D view (tools/remove-3d.sh).
'use strict';
const Board3D = (() => {
  const ELEV = 60, AZ = 0, ZOOM = [40, 52];
  // Tiles drawn as plain floor on purpose (the tile-art test checks every other tile has a case).
  const PLAIN = ['.', ','];
  // Heights in tile edges. From due south at 60°, a block of height h hides h ÷ tan 60° of
  // the tile behind it, so walls are 1.2 (69% hidden), not the 1.5 the probe measured
  // from the south-east, which would hide 87% of every room's back row.
  const H = { wall: 1.2, column: 1.2, partition: 1.0, caseBase: 0.25, caseTop: 0.85, plinth: 0.5, furniture: 0.45,
    bench: 0.3, lectern: 0.7, rail: 0.5, rope: 0.4 };
  const COS = Math.cos(ELEV * Math.PI / 180), SIN = Math.sin(ELEV * Math.PI / 180);
  let loading = null;

  // three.js arrives as an inert <script type="text/x-three"> block, inlined in dist/ or
  // naming the vendored file in development, and is run on first use.
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (loading) return loading;
    const block = document.querySelector('script[type="text/x-three"]');
    if (!block) return Promise.reject(new Error('three.js is not part of this build'));
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      if (block.textContent.trim()) s.textContent = block.textContent;
      else { s.src = block.dataset.src; s.onload = () => res(); s.onerror = () => rej(new Error('three.js could not be loaded')); }
      document.head.appendChild(s);
      if (s.textContent) { if (window.THREE) res(); else rej(new Error('three.js did not start')); }
    });
    loading.catch(() => { loading = null; });
    return loading;
  }

  function factory(host) {
    const canvas = document.createElement('canvas'), over = document.createElement('canvas');
    canvas.className = 'board-canvas'; over.className = 'board-canvas board-over';
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2 is unavailable');
    host.appendChild(canvas); host.appendChild(over);
    const octx = over.getContext('2d');
    let T = null, renderer = null, scene = null, camera = null, meshes = null;
    let lastVm = null, zoom = 0, s = ZOOM[0], size = { width: 0, height: 0 }, items = [], tiles = [], flat = null, disposed = false;
    let centre = { x: 0, y: 0 }, inset = 0;

    const ready = loadThree().then(() => {
      if (disposed) return;
      T = window.THREE;
      renderer = new T.WebGLRenderer({ canvas, context: gl, antialias: false });
      renderer.outputColorSpace = T.SRGBColorSpace;
      scene = new T.Scene();
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
      meshes = {
        floor: mesh(new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })),
        solid: mesh(new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })),
        glass: mesh(new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false })),
      };
      // Listeners added after three.js's own, so it has restored its state before we redraw.
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', restored);
      if (lastVm) render(lastVm);
    });
    function mesh(material) { const m = new T.Mesh(new T.BufferGeometry(), material); m.frustumCulled = false; scene.add(m); return m; }

    // ------------------------------------------------------------ context loss
    // While the context is lost the flat board stands in, at the same zoom step.
    function lost(e) {
      e.preventDefault();
      if (flat || disposed) return;
      canvas.style.visibility = over.style.visibility = 'hidden';
      flat = Views.make('topdown', host);
      flat.setZoom(zoom); flat.setInset(inset);
      if (lastVm) flat.draw(lastVm);
    }
    function restored() {
      if (!flat) return;
      flat.dispose(); flat = null;
      canvas.style.visibility = over.style.visibility = '';
      if (lastVm) render(lastVm);
    }

    // ------------------------------------------------------------ geometry
    // Every frame's scene is three merged meshes (floor, solid, glass) with per-vertex
    // colours and per-vertex ids for idBuffer(). Faces are shaded by direction: tops in the
    // palette's top colour, south faces in its face colour, the sides darker.
    const lin = hex => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
    const scale = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
    function batch() { return { pos: [], col: [], ids: [] }; }
    function quad(b, p, c, id) {
      const r = (id >> 16) & 255, g = (id >> 8) & 255, bl = id & 255;
      for (const i of [0, 1, 2, 0, 2, 3]) { b.pos.push(p[i][0], p[i][1], p[i][2]); b.col.push(c[0], c[1], c[2]); b.ids.push(r / 255, g / 255, bl / 255); }
    }
    function block(b, x0, z0, x1, z1, y0, y1, top, side, id) {
      quad(b, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], top, id);
      quad(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], side, id);
      const d = scale(side, 0.78);
      quad(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], d, id);
      quad(b, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], d, id);
      quad(b, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], scale(side, 0.6), id);
    }
    function column(b, cx, cz, r, h, top, side, id) {
      const n = 8, pt = k => [cx + r * Math.cos((k + 0.5) * Math.PI * 2 / n), cz + r * Math.sin((k + 0.5) * Math.PI * 2 / n)];
      for (let k = 0; k < n; k++) {
        const [ax, az] = pt(k), [bx, bz] = pt(k + 1), f = 0.62 + 0.38 * Math.max(0, Math.sin((k + 1) * Math.PI * 2 / n));
        quad(b, [[ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az]], scale(side, f), id);
        quad(b, [[cx, h, cz], [ax, h, az], [bx, h, bz], [cx, h, cz]], top, id);
      }
    }
    function upload(m, b) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(b.col, 3));
      g.userData.ids = new T.Float32BufferAttribute(b.ids, 3);
      m.geometry.dispose(); m.geometry = g;
    }

    // The height of whatever stands on a tile, as build() draws it (glass counts as see-through).
    function top_(ch) {
      switch (ch) {
        case '#': case '+': case 'S': return H.wall;
        case 'o': return H.column;
        case 'H': case '|': return H.partition;
        case 'v': case 'k': return H.caseBase;
        case 'p': case 'C': return H.plinth;
        case 'f': case 'c': return H.furniture;
        case 'l': return H.lectern;
        case 'b': return H.bench;
        case '~': return H.rail;
        case '=': return H.rope;
        default: return 0;
      }
    }

    // Ids: 0 is nothing; floor tiles are 1 + index; anything standing on a tile is
    // 1 + w·h + index. Actors and marks follow from 1 + 2·w·h (idBuffer()).
    function build(vm) {
      const P = ART.palettes.dept[vm.dept] || ART.palettes.dept.T0, n = vm.w * vm.h;
      const fl = batch(), so = batch(), gl_ = batch();
      for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
        const v = vm.vis[y * vm.w + x];
        if (!v) continue;
        const k = v === 1 ? 0.45 : 1, ch = vm.tiles[y][x], i = y * vm.w + x, fid = 1 + i, oid = 1 + n + i;
        const C = hex => scale(lin(hex), k);
        const top = C(P.wallTop), face = C(P.wall);
        if (ch === '#') { block(so, x, y, x + 1, y + 1, 0, H.wall, top, face, oid); continue; }
        if (ch === '+' || ch === 'S') {
          block(so, x, y, x + 1, y + 1, 0, H.wall, top, top, oid);
          block(so, x + 0.12, y + 0.98, x + 0.88, y + 1.0, 0.0, H.wall - 0.1, C(ch === 'S' ? '#5c5560' : '#7a5232'), C(ch === 'S' ? '#5c5560' : '#7a5232'), oid);
          continue;
        }
        const floor = C(ch === '~' || ch === 'w' ? '#2b4f66' : ((x + y) & 1) ? P.floor2 : P.floor);
        quad(fl, [[x, 0, y], [x + 1, 0, y], [x + 1, 0, y + 1], [x, 0, y + 1]], floor, fid);
        const wood = C('#6b4a2e'), mark = (f, c) => quad(fl, [[x + f, 0.004, y + f], [x + 1 - f, 0.004, y + f], [x + 1 - f, 0.004, y + 1 - f], [x + f, 0.004, y + 1 - f]], c, fid);
        switch (ch) {
          // Entrance and exit: a readable-coloured mat, as the flat board marks them, laid in
          // the part of the tile the camera sees in front of whatever stands to the south.
          case 'E': case 'X': {
            const seen = 1 - top_(y + 1 < vm.h ? vm.tiles[y + 1][x] : '#') * COS / SIN, z1 = y + Math.max(0.2, Math.min(0.94, seen - 0.04));
            quad(fl, [[x + 0.15, 0.004, y + 0.06], [x + 0.85, 0.004, y + 0.06], [x + 0.85, 0.004, z1], [x + 0.15, 0.004, z1]], scale(lin(ART.palettes.semantic.readable), 0.55 * k), oid);
            break;
          }
          // An open door: the leaf swung back against the west jamb.
          case "'": block(so, x, y + 0.04, x + 0.12, y + 0.96, 0, H.wall - 0.1, C('#7a5232'), C('#7a5232'), oid); break;
          // Shards: glass specks on the floor.
          case 'x': for (let j = 0; j < 6; j++) { const u = ((x * 7 + j * 5) % 13 + 1) / 16, w = ((y * 5 + j * 7) % 13 + 1) / 16;
            quad(fl, [[x + u, 0.004, y + w], [x + u + 0.07, 0.004, y + w], [x + u + 0.07, 0.004, y + w + 0.07], [x + u, 0.004, y + w + 0.07]], C(P.glass), fid); } break;
          case 'C': block(so, x + 0.15, y + 0.15, x + 0.85, y + 0.85, 0, H.plinth, C(P['3'] || '#a89ead'), scale(C(P['3'] || '#a89ead'), 0.8), oid); break;
          case 'v': block(so, x + 0.06, y + 0.06, x + 0.94, y + 0.94, 0, H.caseBase, C(P.floor2), scale(C(P.floor), 0.6), oid);
            block(gl_, x + 0.08, y + 0.08, x + 0.92, y + 0.92, H.caseBase, H.caseTop, C(P.glass), C(P.glass), oid); break;
          case 'k': block(so, x + 0.06, y + 0.06, x + 0.94, y + 0.94, 0, H.caseBase, C(P.floor2), scale(C(P.floor), 0.6), oid); break;
          case 'p': block(so, x + 0.15, y + 0.15, x + 0.85, y + 0.85, 0, H.plinth, C(P['3'] || '#a89ead'), scale(C(P['3'] || '#a89ead'), 0.8), oid); break;
          case 'o': column(so, x + 0.5, y + 0.5, 0.32, H.column, top, face, oid); break;
          case 'b': block(so, x + 0.1, y + 0.3, x + 0.9, y + 0.7, 0, H.bench, C('#8a6440'), wood, oid); break;
          case 'l': block(so, x + 0.25, y + 0.25, x + 0.75, y + 0.75, 0, H.lectern, C('#8a6440'), C('#5a3e26'), oid); break;
          case 'f': case 'c': block(so, x + 0.08, y + 0.08, x + 0.92, y + 0.92, 0, H.furniture, C('#8a6440'), wood, oid); break;
          case 'H': block(so, x, y, x + 1, y + 1, 0, H.partition, C('#5e5048'), C('#4b4038'), oid); break;
          case '|': block(so, x + 0.3, y, x + 0.7, y + 1, 0, H.partition, top, face, oid); break;
          case '~': block(so, x, y + 0.45, x + 1, y + 0.55, 0, H.rail, C('#b9a57a'), C('#8c7a52'), oid); break;
          case '=': block(so, x + 0.45, y + 0.45, x + 0.55, y + 0.55, 0, H.rope, C('#c9b98a'), C('#8c7a52'), oid);
            block(so, x, y + 0.48, x + 1, y + 0.52, H.rope - 0.08, H.rope - 0.02, C('#9a2a3a'), C('#9a2a3a'), oid); break;
        }
      }
      upload(meshes.floor, fl); upload(meshes.solid, so); upload(meshes.glass, gl_);
    }

    // ------------------------------------------------------------ camera and frame
    // The target sits at the centre of the part of the board the bottom inset leaves clear.
    function place(vm, r) {
      const halfW = r.width / s / 2, cy = Math.max(s, r.height - inset) / 2;
      Object.assign(camera, { left: -halfW, right: halfW, top: cy / s, bottom: -(r.height - cy) / s });
      camera.updateProjectionMatrix();
      const tx = vm.camera.x + 0.5, tz = vm.camera.y + 0.5, dist = 60, az = AZ * Math.PI / 180;
      camera.position.set(tx + Math.sin(az) * COS * dist, SIN * dist, tz + Math.cos(az) * COS * dist);
      camera.up.set(0, 1, 0);
      camera.lookAt(tx, 0, tz);
      camera.updateMatrixWorld();
      // From due south a tile is an s × s·sin(60°) rectangle; its centre on the board:
      centre = { x: r.width / 2, y: cy, tx, tz };
    }
    // A floor point (wx, wz) in board CSS pixels.
    const screen = (wx, wz) => ({ x: centre.x + (wx - centre.tx) * s, y: centre.y + (wz - centre.tz) * s * SIN });
    function rectOf(x, y) { const a = screen(x, y); return { x: a.x, y: a.y, w: s, h: s * SIN }; }
    // An actor's billboard: s·n square, standing on the south edge of its footprint.
    function actorRect(a) { const n = a.size || 1, f = screen(a.x + n / 2, a.y + n); return { x: f.x - n * s / 2, y: f.y - n * s, w: n * s, h: n * s }; }

    function resize() {
      const r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(r.width, r.height, false);
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (over.width !== w || over.height !== h) { over.width = w; over.height = h; }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.imageSmoothingEnabled = false;
      size = { width: r.width, height: r.height };
      return r;
    }

    function render(vm) {
      if (flat) { flat.draw(vm); return; }
      const r = resize();
      scene.background = new T.Color('#0d0c10');
      build(vm); place(vm, r);
      renderer.render(scene, camera);
      overlay(vm);
    }

    // The 2D layer: the shared display list (marks.js), painted over the scene.
    function overlay(vm) {
      octx.clearRect(0, 0, size.width, size.height);
      tiles = [];
      for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
        if (!vm.vis[y * vm.w + x]) continue;
        const q = rectOf(x, y);
        if (q.x + q.w > 0 && q.y + q.h > 0 && q.x < size.width && q.y < size.height) tiles.push({ kind: 'tile', id: x + ',' + y, x, y, rect: q });
      }
      items = Marks.list(vm, rectOf, actorRect, s, size.width, size.height, size.height - inset);
      for (const it of items) { octx.save(); it.paint(octx); octx.restore(); }
    }

    // ------------------------------------------------------------ picking
    // The nearest actor with an opaque sprite pixel under the point, else the floor tile
    // under it (walls are ignored: they never take a tap).
    function pick(cx, cy) {
      const b = canvas.getBoundingClientRect(), px = cx - b.left, py = cy - b.top;
      for (const a of Marks.order(lastVm.actors).reverse()) {
        const q = actorRect(a);
        if (px < q.x || py < q.y || px >= q.x + q.w || py >= q.y + q.h) continue;
        const m = Sprites.mask(a.sprite, lastVm.dept);
        if (!m || m.on[Math.floor((py - q.y) / q.h * m.n) * m.n + Math.floor((px - q.x) / q.w * m.n)]) return { x: a.x, y: a.y };
      }
      const x = Math.floor(centre.tx + (px - centre.x) / s), y = Math.floor(centre.tz + (py - centre.y) / (s * SIN));
      if (x < 0 || y < 0 || x >= lastVm.w || y >= lastVm.h) return null;
      return { x, y };
    }
    function tileRect(x, y) {
      const b = canvas.getBoundingClientRect(), q = rectOf(x, y);
      return { centre: { x: b.left + q.x + q.w / 2, y: b.top + q.y + q.h / 2 }, rect: { x: b.left + q.x, y: b.top + q.y, w: q.w, h: q.h }, tapRadius: Math.min(q.w, q.h) / 2 };
    }
    function inspect() {
      const b = canvas.getBoundingClientRect();
      return tiles.map(d => ({ kind: d.kind, id: d.id, x: d.x, y: d.y, rect: { x: b.left + d.rect.x, y: b.top + d.rect.y, w: d.rect.w, h: d.rect.h } }))
        .concat(Marks.inspected(items, b.left, b.top, size.width, size.height));
    }

    // ------------------------------------------------------------ the id buffer
    // One id per CSS pixel of the board, for the occlusion check (BUILD.md §6.3). The scene
    // is drawn again with its ids as flat colours; glass is left out, being see-through.
    // With { floorOnly: true } only the floor is drawn, and with { scene: true } the floor
    // and what stands on it. Otherwise every actor and mark of the display list is also
    // repainted alone, in drawing order, and takes the pixels it covers; its legend entry
    // records how many pixels it covers alone and how many of those end up showing an actor
    // or a mark rather than the scene (§6.3: walls may hide floor, never an actor or a mark).
    function idBuffer(opts) {
      opts = opts || {};
      const vm = lastVm, n = vm.w * vm.h, w = Math.round(size.width), h = Math.round(size.height);
      const rt = new T.WebGLRenderTarget(w, h);
      const swap = [], basic = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
      for (const k of ['floor', 'solid', 'glass']) {
        const m = meshes[k], g = m.geometry;
        swap.push([m, m.material, g.getAttribute('color'), m.visible]);
        if (g.userData.ids) g.setAttribute('color', g.userData.ids);
        m.material = basic;
        m.visible = k === 'floor' || (k === 'solid' && !opts.floorOnly);
      }
      // The target has its own size, one texel per CSS pixel, whatever the pixel ratio.
      const bg = scene.background;
      scene.background = null; renderer.setClearColor(0x000000, 1);
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      const px = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
      renderer.setRenderTarget(null);
      scene.background = bg;
      for (const [m, mat, col, vis] of swap) { m.material = mat; if (col) m.geometry.setAttribute('color', col); m.visible = vis; }
      rt.dispose(); basic.dispose();
      const ids = new Uint32Array(w * h), legend = {};
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = ((h - 1 - y) * w + x) * 4;
        ids[y * w + x] = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
      }
      for (let i = 0; i < n; i++) {
        const x = i % vm.w, y = (i - x) / vm.w;
        legend[1 + i] = { kind: 'floor', x, y };
        legend[1 + n + i] = { kind: 'solid', x, y };
      }
      if (!opts.floorOnly && !opts.scene) {
        let next = 1 + 2 * n;
        const own = [];
        const scratch = document.createElement('canvas');
        scratch.width = w; scratch.height = h;
        const sx = scratch.getContext('2d');
        sx.imageSmoothingEnabled = false;
        for (const d of items) {
          if (d.kind !== 'actor' && d.kind !== 'mark') continue;
          const id = next++;
          legend[id] = { kind: d.kind, id: d.id, x: d.x, y: d.y };
          const x0 = Math.max(0, Math.floor(d.rect.x) - 2), y0 = Math.max(0, Math.floor(d.rect.y) - 2);
          const x1 = Math.min(w, Math.ceil(d.rect.x + d.rect.w) + 2), y1 = Math.min(h, Math.ceil(d.rect.y + d.rect.h) + 2);
          if (x1 <= x0 || y1 <= y0) continue;
          sx.clearRect(x0, y0, x1 - x0, y1 - y0);
          sx.save(); d.paint(sx); sx.restore();
          const a = sx.getImageData(x0, y0, x1 - x0, y1 - y0).data, mine = [];
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (a[((y - y0) * (x1 - x0) + x - x0) * 4 + 3] > 32) { ids[y * w + x] = id; mine.push(y * w + x); }
          legend[id].group = d.group;
          own.push([id, mine]);
        }
        // Shown: the pixels that end up showing the item, its own group or any mark; only the
        // scene or another actor's sprite counts as hiding it. Self: the pixels showing the
        // item itself (or a telegraph's number laid over it), however it is covered.
        for (const [id, mine] of own) {
          const g = legend[id].group, top = i => legend[ids[i]];
          legend[id].alone = mine.length;
          legend[id].onTop = mine.filter(i => top(i) && (top(i).group === g || top(i).kind === 'mark')).length;
          legend[id].self = mine.filter(i => ids[i] === id || (top(i) && /^telegraph:/.test(top(i).id))).length;
        }
      }
      return { w, h, ids, legend };
    }

    const api = {
      id: 'board3d', ready, zooms: ZOOM, PLAIN,
      get zoom() { return zoom; },
      draw(vm) { lastVm = vm; if (renderer) render(vm); },
      pick(cx, cy) { if (flat) return flat.pick(cx, cy); return renderer && lastVm ? pick(cx, cy) : null; },
      tileRect(x, y) { if (flat) return flat.tileRect(x, y); return renderer ? tileRect(x, y) : null; },
      inspect() { if (flat) return flat.inspect(); return renderer ? inspect() : []; },
      idBuffer() { return renderer && !flat && lastVm ? idBuffer(arguments[0]) : null; },
      setZoom(step) { zoom = Math.max(0, Math.min(ZOOM.length - 1, step)); s = ZOOM[zoom]; if (flat) flat.setZoom(zoom); },
      setInset(px) { inset = Math.max(0, px || 0); if (flat) flat.setInset(inset); },
      standIn: () => !!flat,
      // For the 3D checks: the last frame's display list and the 2D layer's canvas.
      displayList: () => items.slice(), overlayCanvas: () => over,
      stats: () => (renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } : null),
      // Gives the WebGL context back at once, so switching views back and forth never
      // runs into the browser's limit on live contexts.
      dispose() {
        disposed = true;
        canvas.removeEventListener('webglcontextlost', lost);
        canvas.removeEventListener('webglcontextrestored', restored);
        if (flat) flat.dispose();
        if (renderer) { for (const m of Object.values(meshes)) { m.geometry.dispose(); m.material.dispose(); } renderer.dispose(); }
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        canvas.remove(); over.remove();
      },
    };
    return api;
  }

  Views.register('board3d', '3D', factory);
  return { ELEV, AZ, ZOOM, H };
})();
