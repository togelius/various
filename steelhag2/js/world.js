// STÅLHAGEN II — the slice's world: the shore road and the substation, the frozen bay, the island shore with
// Sjögården, the snow field and the birches; the towers on the horizon and the hulls standing up out of the ice.
// x runs east, z runs north across the bay, y is up; the ice is y = 0.
'use strict';
const World = (() => {
  const n1 = makeNoise(11), n2 = makeNoise(23), n3 = makeNoise(37);
  const noise2 = (x, z, s) => (fbm(n1, x / s, 3) + fbm(n2, z / s + x / (s * 3.1), 3)) * 0.5;
  const FARM = { x: 0, z: 162 }, SHORE_Z = 108, MAINLAND_Z = 0;
  const S = { items: [], colliders: [], seats: [], vantages: [], triggers: [], birches: [], hulls: [], lamps: [], thinIce: [] };

  // --- terrain --------------------------------------------------------
  function landEdgeMain(x) { return MAINLAND_Z + (noise2(x, 0, 60) - 0.5) * 24; }
  function landEdgeIsle(x) { return SHORE_Z + (noise2(x, 900, 70) - 0.5) * 30 + Math.max(0, 22 - Math.abs(x - 40) * 0.35); }
  function inBay(x, z) { return z > landEdgeMain(x) && z < landEdgeIsle(x); }
  function terrain(x, z) {
    const em = landEdgeMain(x), ei = landEdgeIsle(x);
    let h;
    if (z <= em) { const d = em - z; h = Math.min(d * 0.14, 7) + noise2(x, z, 18) * 1.4 - 0.7; if (Math.abs(x) < 4 && z < -14 && z > -60) h = Math.min(h, 3.2); }
    else if (z >= ei) { const d = z - ei; h = Math.min(d * 0.09, 5) + noise2(x, z, 22) * 1.6 - 0.8; const fx = x - FARM.x, fz = z - FARM.z; const near = Math.hypot(fx, fz); if (near < 28) h = lerp(3.0, h, smooth(14, 28, near)); const hole = Math.hypot(x - 46, z - (FARM.z + 30)); if (hole < 9) h -= (1 - hole / 9) * 2.2; }
    else h = -0.4;
    return h;
  }
  // Match the rendered grid's triangles exactly; an analytic height between coarse
  // vertices made shoes and contact shadows hover above the visible snow.
  function groundY(x,z){
    if(inBay(x,z))return 0;
    const gx=Math.floor((x+420)/5)*5-420,gz=Math.floor((z+120)/5)*5-120,fx=(x-gx)/5,fz=(z-gz)/5;
    const a=terrain(gx,gz),b=terrain(gx,gz+5),c=terrain(gx+5,gz+5),d=terrain(gx+5,gz);
    return fz>=fx?a+(b-a)*fz+(c-b)*fx:a+(d-a)*fx+(c-d)*fz;
  }
  function onIce(x, z) { return inBay(x, z); }
  function thinAt(x, z) { for (const t of S.thinIce) { const d = Math.hypot(x - t.x, z - t.z); if (d < t.r) return 1 - d / t.r; } return 0; }

  // --- helpers --------------------------------------------------------
  const mat = () => M.create();
  function place(mesh, x, y, z, yaw = 0, extra = {}) { const it = { mesh, model: M.trs(mat(), x, y, z, yaw), x, y, z, ...extra }; S.items.push(it); return it; }
  function collide(x0, y0, z0, w, h, d) { S.colliders.push({ x0, y0, z0, x1: x0 + w, y1: y0 + h, z1: z0 + d }); }
  function seat(x, z, yaw, line, camOff, name) { S.seats.push({ x, z, y: groundY(x, z), yaw, line, camOff: camOff || [-6, 2.5, -6], name }); }

  // --- build ----------------------------------------------------------
  function buildTerrain() {
    const b = new Builder(), r = rng32(5);
    const x0 = -420, z0 = -120, w = 900, d = 570, nx = 180, nz = 114;
    b.grid(x0, z0, w, d, nx, nz, terrain, (x, z, y, slope) => {
      if (inBay(x, z)) return [MAT.ICE, [0.8, 0.82, 0.84]];
      const k = 0.9 + noise2(x + 500, z, 9) * 0.2;
      const road = Math.abs(x) < 3.2 && z < -12 && z > -70;
      // The road is snow-covered; avoid a coarse grid's triangular asphalt edge.
      return [MAT.SNOW, [k, k, k * 1.02]];
    }, { uv: 0.2 });
    place(b.build(), 0, 0, 0, 0, { noShadow: true });
    // the ice sheet: a separate plane at y = 0 with the thin patches darker
    const ice = new Builder();
    ice.grid(-420, -60, 900, 250, 150, 50, (x, z) => inBay(x, z) ? 0 : -8, (x, z) => { const t = thinAt(x, z); const k = 1 - t * 0.55; return [MAT.ICE, [k * 0.9, k * 0.95, k * 1.0]]; }, { uv: 0.35 });
    place(ice.build(), 0, 0.0, 0, 0, { noShadow: true });
  }

  function buildVan() {
    const b = new Builder();
    // A work-worn panel van: rounded pressed steel, rubber seals and a roof rack.
    b.tile=MAT.FLAT;b.col=[0.66,0.60,0.37];
    b.roundedBox(-1,0.64,-2.5,2,1.60,5.0,.18);
    b.roundedBox(-.97,0.77,-2.65,1.94,.48,1.1,.12);
    b.col=[.46,.43,.30];b.roundedBox(-1.015,.65,-2.42,2.03,.18,4.84,.035);
    b.tile=MAT.DARK;b.col=[1,1,1];
    b.roundedBox(-.90,1.25,-2.51,1.8,.78,.05,.075);
    for(const side of [-1,1]) b.roundedBox(side*.99-.02,1.28,-2.12,.045,.69,1.02,.035);
    b.tile=MAT.WINDOW;b.col=[.75,.85,.91];
    b.roundedBox(-.85,1.30,-2.542,1.70,.68,.025,.06);
    for(const side of [-1,1]) b.roundedBox(side*1.017-.012,1.33,-2.07,.025,.59,.92,.03);
    b.tile=MAT.DARK;b.col=[.75,.76,.72];
    b.roundedBox(-1.08,.42,-2.70,2.16,.20,.18,.05);b.roundedBox(-1.08,.42,2.42,2.16,.20,.18,.05);
    b.box(-.57,.77,-2.668,1.14,.24,.02);
    b.tile=MAT.STEEL;b.col=[.65,.65,.59];
    for(let y=.80;y<.99;y+=.055)b.box(-.54,y,-2.686,1.08,.015,.02);
    b.tile=MAT.FLAT;b.col=[.68,.67,.52];
    for(const x of [-.89,.62])b.roundedBox(x,.85,-2.69,.27,.21,.03,.035);
    for(const side of [-1,1]) {
      b.tile=MAT.DARK;b.col=[.6,.64,.64];
      for(const z of [-1.5,1.65]) { b.cyl(side>0?.89:-1.14,.46,z,.43,.25,{axis:'x',segs:24});b.tile=MAT.STEEL;b.col=[.6,.62,.61];b.cyl(side>0?1.145:-1.155,.46,z,.23,.025,{axis:'x',segs:16});b.tile=MAT.DARK;b.col=[.6,.64,.64]; }
      b.roundedBox(side*1.02-.015,1.1,-.75,.03,.04,.21,.015);
      b.box(side*1.018-.008,.79,-.89,.016,1.36,.012);
      b.tube([[side*.96,1.39,-2.11],[side*1.24,1.38,-2.12],[side*1.26,1.55,-2.12]],.025,{segs:6});b.roundedBox(side*1.26-.045,1.47,-2.18,.09,.24,.18,.035);
    }
    b.tile=MAT.STEEL;b.col=[.55,.58,.57];for(const z of [-.8,1.5]){b.box(-.85,2.2,z,.07,.2,.08);b.box(.78,2.2,z,.07,.2,.08);b.box(-1.02,2.39,z,2.04,.06,.07);}
    b.tile=MAT.SNOW;b.col=[.9,.93,.94];b.roundedBox(-.83,2.225,-.48,1.66,.10,2.7,.045);
    const mesh=b.build(),hz=new Builder();hz.tile=MAT.LED;hz.col=[1,.65,.18];
    for(const [x,z] of [[-.96,-2.69],[.82,-2.69],[-.96,2.51],[.82,2.51]])hz.roundedBox(x,.80,z,.14,.12,.04,.015);
    return {mesh,hazards:hz.build()};
  }

  function buildSubstation(b) {
    b.col = [1, 1, 1];
    b.tile = MAT.CONCRETE; b.box(-3, 0, -2, 6, 0.3, 4);
    b.tile = MAT.STEEL; b.cyl(-1.6, 0.3, 0, 0.7, 2.2, { segs: 10 }); b.cyl(1.4, 0.3, 0, 0.7, 2.2, { segs: 10 });
    b.tile = MAT.DARK; for (const x of [-1.6, 1.4]) for (const dx of [-0.35, 0, 0.35]) b.cyl(x + dx, 2.5, 0, 0.08, 0.7, { segs: 6 });
    b.tile = MAT.STEEL; b.box(-2.9, 0.3, 1.2, 1.2, 1.5, 0.6); // the meter box
    b.tile = MAT.DARK; b.cyl(2.7, 0, -1.6, 0.14, 8, { segs: 6 }); b.cyl(2.7, 7.4, -1.6, 0.06, 1.6, { axis: 'x', segs: 5 });
    // chain-link posts
    for (const [x, z] of [[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.6], [3.6, 2.6]]) b.cyl(x, 0, z, 0.05, 2.2, { segs: 5 });
    for (const [a, c] of [[[-3.6, -2.6], [3.6, -2.6]], [[3.6, -2.6], [3.6, 2.6]], [[3.6, 2.6], [-3.6, 2.6]], [[-3.6, 2.6], [-3.6, -2.6]]]) for (const h of [0.7, 1.4, 2.1]) b.tube([[a[0], h, a[1]], [c[0], h, c[1]]], 0.015, { segs: 4 });
  }

  function buildHouse(b, w = 9, d = 7, h = 3.2) {
    // Falu-red house with white trim and a lit kitchen window; the door faces south (-z)
    b.col = [1, 1, 1]; b.tile = MAT.RED; b.box(-w / 2, 0, -d / 2, w, h, d, { uv: 0.6 });
    b.tile = MAT.FLAT; b.col = [0.93, 0.92, 0.88];
    for (const x of [-w / 2, w / 2 - 0.12]) for (const z of [-d / 2, d / 2 - 0.12]) b.box(x, 0, z, 0.12, h, 0.12);
    b.box(-w / 2 - 0.05, h - 0.2, -d / 2 - 0.05, w + 0.1, 0.2, d + 0.1);
    // roof
    b.tile = MAT.ROOF; b.col = [1, 1, 1];
    const rh = 2.4, ov = 0.5;
    b.begin();
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? -d / 2 - ov : 0, z1 = side < 0 ? 0 : d / 2 + ov;
      const ya = side < 0 ? h - 0.1 : h + rh, yb = side < 0 ? h + rh : h - 0.1;
      const a = b.vert(-w / 2 - ov, ya, z0, 0, 0.7, side * 0.7, 0, 0), bb = b.vert(w / 2 + ov, ya, z0, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.5, 0);
      const c = b.vert(w / 2 + ov, yb, z1, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.5, 2), dd = b.vert(-w / 2 - ov, yb, z1, 0, 0.7, side * 0.7, 0, 2);
      b.quad(a, dd, c, bb);
    }
    b.end(M.create());
    // snow on the roof: a soft white slab either side of the ridge, thicker at the eaves
    b.tile = MAT.SNOW; b.col = [1, 1, 1]; b.begin();
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? -d / 2 - ov : 0.05, z1 = side < 0 ? -0.05 : d / 2 + ov;
      const ya = side < 0 ? h - 0.1 + 0.32 : h + rh + 0.14, yb = side < 0 ? h + rh + 0.14 : h - 0.1 + 0.32;
      const a = b.vert(-w / 2 - ov, ya, z0, 0, 0.7, side * 0.7, 0, 0), bb = b.vert(w / 2 + ov, ya, z0, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.3, 0);
      const c = b.vert(w / 2 + ov, yb, z1, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.3, 1.2), dd = b.vert(-w / 2 - ov, yb, z1, 0, 0.7, side * 0.7, 0, 1.2);
      b.quad(a, dd, c, bb);
    }
    b.end(M.create());
    // gable ends
    b.tile = MAT.RED;
    for (const x of [-w / 2, w / 2]) { const n = x < 0 ? -1 : 1; const a = b.vert(x, h, -d / 2, n, 0, 0, 0, 0), bb = b.vert(x, h, d / 2, n, 0, 0, d * 0.6, 0), c = b.vert(x, h + rh, 0, n, 0, 0, d * 0.3, rh * 0.6); if (n > 0) b.i.push(a, c, bb); else b.i.push(a, bb, c); }
    // chimney
    b.tile = MAT.CONCRETE; b.box(w * 0.2, h + rh - 0.8, -0.4, 0.7, 1.6, 0.8);
    // windows: south wall two, west wall one (the kitchen, lit)
    b.tile = MAT.FLAT; b.col = [0.93, 0.92, 0.88];
    for (const x of [-w * 0.3, w * 0.22]) b.box(x - 0.65, 1.0, -d / 2 - 0.06, 1.3, 1.4, 0.08);
    b.box(-w / 2 - 0.06, 1.0, -0.7, 0.08, 1.4, 1.4);
    b.tile = MAT.WINDOW; b.col = [0.65, 0.75, 0.82]; for (const x of [-w * 0.3, w * 0.22]) b.box(x - 0.55, 1.1, -d / 2 - 0.09, 1.1, 1.2, 0.06);
    // Window joinery, deep sills and restrained warm interiors.
    b.tile=MAT.FLAT;b.col=[.77,.76,.68];
    for(const x of [-w*.3,w*.22]) { b.box(x-.025,1.06,-d/2-.14,.05,1.30,.07);b.box(x-.60,1.72,-d/2-.14,1.20,.045,.07);b.box(x-.72,.96,-d/2-.20,1.44,.09,.25); }
    b.tile=MAT.CONCRETE;b.col=[.52,.53,.50];b.box(-w/2-.06,-.18,-d/2-.07,w+.12,.28,d+.14);
    // Narrow battens catch light instead of asking a flat texture to supply all depth.
    b.tile=MAT.RED;b.col=[.88,.90,.87];for(let x=-w/2+.15;x<w/2;x+=.23){b.box(x,.30,-d/2-.025,.025,h-.52,.025);b.box(x,.30,d/2,.025,h-.52,.025);}
    b.tile=MAT.DARK;b.col=[.75,.77,.72];
    for(const x of [-w/2-.18,w/2+.12]) { b.cyl(x,.05,-d/2-.10,.055,h-.05,{segs:8}); }
    b.tile=MAT.PLANK;b.col=[.75,.72,.63];
    for(const x of [-.84,.77])b.box(x,0,-d/2-.68,.07,2.48,.07);
    b.tile=MAT.SNOW;b.col=[.92,.95,.96];b.roundedBox(-1.08,2.40,-d/2-.9,2.16,.14,1.1,.06);
    // door and steps
    b.tile = MAT.PLANK; b.col = [0.5, 0.42, 0.34]; b.box(-0.5, 0, -d / 2 - 0.06, 1.0, 2.05, 0.08);
    b.col = [0.7, 0.7, 0.7]; b.box(-1.0, -0.3, -d / 2 - 1.0, 2.0, 0.3, 1.0); b.box(-1.0, -0.6, -d / 2 - 1.5, 2.0, 0.3, 1.5);
    // the cellar hatch on the east side: a sloped plank lid on a concrete frame, and a red bulb over it (the darkroom)
    b.tile = MAT.CONCRETE; b.col = [0.8, 0.8, 0.8]; b.box(w / 2, -0.2, -0.9, 1.5, 0.5, 1.8);
    b.tile = MAT.PLANK; b.col = [0.42, 0.36, 0.3]; b.box(w / 2 + 0.1, 0.3, -0.8, 1.35, 0.12, 1.6); b.box(w / 2 + 0.1, 0.3, -0.05, 1.35, 0.5, 0.1);
    b.tile = MAT.DARK; b.col = [1, 1, 1]; b.box(w / 2 + 0.02, 0.45, -0.1, 0.06, 1.6, 0.06);
  }
  function buildSafelight() { const b = new Builder(); b.tile = MAT.LED; b.col = [1, 0.15, 0.1]; b.sphere(0, 0, 0, 0.09, { segs: 8, rings: 6 }); return b.build(); }
  function buildKitchenWindow() { const b = new Builder(); b.tile = MAT.GLASS; b.col = [1, 0.85, 0.55]; b.box(0, 0, 0, 0.06, 1.2, 1.2); return b.build(); }

  function buildBarn(b, w=12,d=8,h=4.5) {
    b.tile=MAT.RED;b.col=[.80,.83,.80];b.box(-w/2,0,-d/2,w,h,d,{uv:.6});
    b.tile=MAT.ROOF;b.col=[.7,.74,.76];
    const ridge=h+2.8;
    for(const side of [-1,1]) {
      const z0=side<0?-d/2-.4:0,z1=side<0?0:d/2+.4,y0=side<0?h:ridge,y1=side<0?ridge:h;
      for(const snow of [false,true]) { b.tile=snow?MAT.SNOW:MAT.ROOF;b.col=snow?[.93,.96,.97]:[.8,.82,.83];const lift=snow?.16:0;
        const a=b.vert(-w/2-.4,y0+lift,z0,0,.82,side*.57,0,0),c=b.vert(w/2+.4,y0+lift,z0,0,.82,side*.57,6,0),e=b.vert(w/2+.4,y1+lift,z1,0,.82,side*.57,6,2),f=b.vert(-w/2-.4,y1+lift,z1,0,.82,side*.57,0,2);b.quad(a,f,e,c); }
    }
    b.tile=MAT.RED;b.col=[.80,.83,.80];for(const x of [-w/2,w/2]) {const n=x<0?-1:1,a=b.vert(x,h,-d/2,n,0,0,0,0),c=b.vert(x,h,d/2,n,0,0,4,0),e=b.vert(x,ridge,0,n,0,0,2,2);if(n>0)b.i.push(a,e,c);else b.i.push(a,c,e);}
    b.tile=MAT.PLANK;b.col=[.37,.40,.36];b.box(-1.6,0,-d/2-.05,3.2,3.2,.10);
    b.col=[.60,.58,.48];for(const x of [-1.63,-.035,1.56])b.box(x,.05,-d/2-.17,.07,3.15,.09);for(const y of [.1,1.6,3.1])b.box(-1.6,y,-d/2-.16,3.2,.06,.08);
    b.tile=MAT.FLAT;b.col=[.68,.68,.62];for(const x of [-w/2,w/2-.12])b.box(x,0,-d/2-.02,.12,h,.08);
  }

  function buildBench() { const b = new Builder(); b.tile = MAT.PLANK; b.col = [0.8, 0.75, 0.68]; b.box(-0.8, 0.42, -0.2, 1.6, 0.06, 0.4); b.box(-0.8, 0.5, -0.22, 1.6, 0.5, 0.06); b.tile = MAT.DARK; b.col = [1, 1, 1]; for (const x of [-0.7, 0.7]) { b.box(x - 0.04, 0, -0.18, 0.08, 0.42, 0.36); b.box(x - 0.04, 0.42, -0.22, 0.08, 0.6, 0.06); } return b.build(); }

  function buildSled() { const b = new Builder(); b.tile = MAT.PLANK; b.col = [0.7, 0.62, 0.5]; for (const x of [-0.28, 0.24]) b.box(x, 0, -0.7, 0.04, 0.06, 1.4); b.box(-0.3, 0.14, -0.6, 0.6, 0.04, 1.2); for (const z of [-0.5, 0, 0.5]) for (const x of [-0.28, 0.24]) b.box(x, 0.06, z, 0.04, 0.08, 0.04); b.tile = MAT.FOIL; b.col = [1, 1, 1]; b.box(-0.22, 0.18, -0.4, 0.44, 0.22, 0.7); b.tile = MAT.DARK; b.box(-0.2, 0.18, 0.32, 0.4, 0.16, 0.24); return b.build(); }

  function buildHull(h) {
    // a walker hull standing in the bay: a chamfered slab on two legs, seventeen to thirty metres tall
    const b = new Builder(); b.tile = MAT.STEEL; b.col = [0.8, 0.82, 0.8];
    const bw = h * 0.42, bh = h * 0.2, by = h * 0.8;
    b.box(-bw / 2, by, -bw * 0.3, bw, bh, bw * 0.6, { uv: 0.12 });
    b.box(-bw * 0.15, by + bh, -bw * 0.1, bw * 0.3, bh * 0.4, bw * 0.25, { uv: 0.12 });
    for (const [x, s] of [[-bw * 0.2, 1], [bw * 0.18, -1]]) { b.cyl(x, by * 0.45, s * 0.6, h * 0.045, by * 0.55 + 1, { segs: 8 }); b.cyl(x + s * h * 0.06, 0, s * 0.6 + s * 0.4, h * 0.04, by * 0.45, { r1: h * 0.045, segs: 8 }); b.sphere(x + s * h * 0.03, by * 0.45, s * 0.6 + s * 0.2, h * 0.06, { segs: 8, rings: 6 }); b.box(x + s * h * 0.06 - h * 0.08, -0.5, s * 1.0 - h * 0.06, h * 0.16, 0.6, h * 0.12); }
    b.tile = MAT.DARK; b.cyl(-bw * 0.1, by + bh * 1.4, 0, h * 0.006, h * 0.18, { segs: 5 });
    b.tile = MAT.LED; b.col = [1, 1, 1]; b.box(bw * 0.5 - 0.3, by + bh * 0.4, 0.2, 0.3, 0.3, 0.3);
    return b.build();
  }

  function buildTowers(b) {
    b.tile = MAT.CONCRETE; b.col = [0.88, 0.9, 0.9];
    const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; const r = 46 * Math.sqrt(1 + ((t - 0.74) / 0.7) ** 2) / Math.sqrt(1 + (0.74 / 0.7) ** 2) * 0.72; prof.push([r, t * 120]); }
    for (const [x, z, h] of [[0, 0, 1], [95, 30, 1.12], [190, 10, 0.95]]) b.begin().lathe(0, 0, 0, prof.map(([r, y]) => [r * h, y * h]), { segs: 28, uv: 0.02 }).end(M.trs(M.create(), x, 0, z, 0));
  }

  function buildBirch() {
    const b=new Builder(),r=rng32(77);b.tile=MAT.BIRCH;b.col=[.82,.80,.74];
    b.tube([[0,0,0],[.05,2,0],[-.10,4,.08],[.03,6,.15],[.18,8,.2]],.105,{segs:8,uv:.8});
    b.tile=MAT.DARK;b.col=[.56,.54,.48];
    for(let i=0;i<18;i++) { const y=2.0+i*.30,a=i*2.399,len=(1-i/23)*(1.4+r()*1.1),dx=Math.cos(a),dz=Math.sin(a);
      const pts=[[0,y,0],[dx*len*.45,y+.35,dz*len*.45],[dx*len,y+.8,dz*len]];b.tube(pts,.018+(.025*(1-i/18)),{segs:5});
      for(let j=1;j<=4;j++){const t=j/5,x=dx*len*t,z=dz*len*t,sg=j%2?1:-1;b.tube([[x,y+t*.7,z],[x+dx*.3+dz*sg*.23,y+t*.7+.35,z+dz*.3-dx*sg*.23],[x+dx*.4+dz*sg*.38,y+t*.7+.65,z+dz*.4-dx*sg*.38]],.009,{segs:3});}
    }
    return b.build();
  }
  function buildSpruce() {
    // A detailed alpha cutout; the renderer turns each instance towards the eye.
    const b=new Builder();b.tile=MAT.FOLIAGE;b.col=[1,1,1];
    const a=b.vert(-4.35,0,0,0,1,0,0,1),c=b.vert(4.35,0,0,0,1,0,1,1),d=b.vert(4.35,13.05,0,0,1,0,1,0),e=b.vert(-4.35,13.05,0,0,1,0,0,0);
    b.quad(a,c,d,e);return b.build();
  }

  function buildFence(b, pts) {
    b.tile = MAT.PLANK; b.col = [0.55, 0.5, 0.42];
    let prev = null;
    for (const [x, z] of pts) { const y = groundY(x, z); b.cyl(x, y - 0.2, z, 0.05, 1.3, { segs: 5 }); if (prev) for (const h of [0.5, 0.95]) b.tube([[prev[0], prev[2] + h, prev[1]], [x, y + h, z]], 0.012, { segs: 3 }); prev = [x, z, y]; }
  }

  function buildCable(pts) { const b = new Builder(); b.tile = MAT.CABLE; b.col = [1, 1, 1]; b.tube(pts, 0.07, { segs: 6, uv: 0.4 }); return b.build(); }

  function buildMarker() { const b = new Builder(); b.tile = MAT.PLANK; b.col = [0.7, 0.6, 0.5]; b.cyl(0, 0, 0, 0.03, 1.4, { segs: 4 }); b.tile = MAT.FOIL; b.col = [1, 0.2, 0.2]; b.box(-0.06, 1.15, -0.02, 0.12, 0.12, 0.04); return b.build(); }

  function instancesAlong(mesh, list) { const mats = new Float32Array(list.length * 16); list.forEach((p, i) => M.trs(mats.subarray(i * 16, i * 16 + 16), p[0], p[1], p[2], p[3], p[4], p[4], p[4])); GL.instances(mesh, mats); }

  function build() {
    const r = rng32(3);
    S.thinIce.push({ x: -18, z: 48, r: 10 }, { x: 21, z: 68, r: 9 }, { x: -12, z: 91, r: 7 });
    buildTerrain();
    // the mainland: the van, the substation, the road
    const van = buildVan(); const vy = groundY(0, -30);
    place(van.mesh, 0, vy, -30, 0.05); S.van = place(van.hazards, 0, vy, -30, 0.05, { emis: 1 }); collide(-1.3, vy, -33, 2.6, 2.4, 6);
    const sub = new Builder(); buildSubstation(sub); place(sub.build(), -9, groundY(-9, -28), -28, 0.2); collide(-13, 0, -32, 8, 3, 8);
    seat(1.6, -27, Math.PI, 'The van. Roos said to be back before dark. I said I would.', [-4, 2, 5], 'the van');
    // the winter road: reflector sticks every twenty metres across the bay
    const markers = [], mk = buildMarker(); for (let z = 6; z < SHORE_Z - 4; z += 18) markers.push([Math.sin(z * 0.02) * 6 + 1.5, 0, z, 0, 1]); instancesAlong(mk, markers); S.items.push({ mesh: mk, model: M.create(), noShadow: true });
    // the island: Sjögården
    const fy = groundY(FARM.x, FARM.z);
    const house = new Builder(); buildHouse(house); place(house.build(), FARM.x, fy, FARM.z, 0); collide(FARM.x - 4.6, fy, FARM.z - 3.6, 9.2, 5.6, 7.2);
    S.window = place(buildKitchenWindow(), FARM.x - 4.58, fy + 1.0, FARM.z - 1.3, 0, { emis: 1 });
    S.safelight = place(buildSafelight(), FARM.x + 4.55, fy + 2.05, FARM.z - 0.07, 0, { emis: 1, noShadow: true });
    collide(FARM.x + 4.5, fy - 0.2, FARM.z - 0.9, 1.5, 0.6, 1.8);
    S.lamps.push({ x: FARM.x - 5.2, y: fy + 1.8, z: FARM.z - 0.7, r: 9, col: [1.0, 0.72, 0.4], k: 0.9, name: 'window' });
    const barn = new Builder(); buildBarn(barn); place(barn.build(), FARM.x + 22, groundY(FARM.x + 22, FARM.z + 6), FARM.z + 6, 0.3); collide(FARM.x + 15.5, 0, FARM.z + 1.5, 13, 6, 9);
    // the bench by the porch, facing the bay
    place(buildBench(), FARM.x + 5.5, fy, FARM.z - 4.2, Math.PI); seat(FARM.x + 5.5, FARM.z - 4.6, Math.PI, 'The bench by the porch. The window was lit. Nobody was home.', [-7, 3, -7], 'the porch bench');
    // the hole where the slab was, and the cable that runs into it
    const foot = new Builder(); foot.tile = MAT.CONCRETE; foot.col = [0.75, 0.75, 0.72]; foot.box(-1.2, 0, -1.2, 2.4, 0.5, 2.4); place(foot.build(), 46, groundY(46, (FARM.z + 30)) - 0.2, (FARM.z + 30), 0.4);
    const relayX=14,relayZ=FARM.z+14,relayY=groundY(relayX,relayZ);
    const rb=new Builder();rb.tile=MAT.CONCRETE;rb.col=[.57,.57,.52];rb.roundedBox(-.7,-.12,-.5,1.4,.35,1,.06);
    rb.tile=MAT.BEIGE;rb.col=[.67,.69,.59];rb.roundedBox(-.48,.2,-.25,.96,1.35,.48,.08);
    rb.tile=MAT.DARK;rb.col=[.9,.95,.95];rb.roundedBox(-.37,.9,-.28,.74,.42,.06,.025);
    rb.tile=MAT.BADGE;rb.col=[.82,.84,.74];rb.box(-.3,.47,-.288,.6,.22,.012);
    rb.tile=MAT.STEEL;rb.col=[1,1,1];for(const x of [-.24,.24])rb.cyl(x,1.04,-.32,.07,.06,{axis:'z',segs:12});
    rb.tile=MAT.DARK;rb.col=[1,1,1];rb.tube([[.4,.6,.16],[.75,.35,.3],[.7,.08,.6]],.06,{segs:7});
    place(rb.build(),relayX,relayY,relayZ);collide(relayX-.5,relayY,relayZ-.3,1,1.6,.6);
    const rl=new Builder();rl.tile=MAT.COLD_LIGHT;rl.col=[.3,.8,1];rl.box(-.2,1.35,-.292,.4,.045,.02);
    S.relay=place(rl.build(),relayX,relayY,relayZ,0,{emis:1,noShadow:true});
    const cablePts=[];for(let i=0;i<=32;i++){const t=i/32,x=relayX+(46-relayX)*t+Math.sin(t*8)*1.2,z=relayZ+16*t+Math.sin(t*5)*2;cablePts.push([x,groundY(x,z)+.09,z]);}
    S.cable=place(buildCable(cablePts),0,0,0,0,{noShadow:true,fx:new Float32Array(RENDER.MAX_BONES*4)});S.cable.fx[0]=.9;S.cablePath=cablePts;
    // fence along the field
    const fence = new Builder(); const fpts = []; for (let x = -30; x <= 60; x += 5) fpts.push([x, FARM.z + 24 + Math.sin(x * 0.1) * 2]); buildFence(fence, fpts); place(fence.build(), 0, 0, 0, 0);
    // birches and spruces along the shore and the field's edges
    const birch = buildBirch(), spruce = buildSpruce(), bl = [], sl = [];
    for (let i = 0; i < 160; i++) { const x = -160 + r() * 320, z = landEdgeIsle(x) + 4 + r() * 90; if (Math.hypot(x - FARM.x, z - FARM.z) < 26 || Math.hypot(x - 46, z - (FARM.z + 30)) < 10) continue; (r() < 0.32 ? bl : sl).push([x, groundY(x, z) - 0.3, z, r() * TAU, 0.85 + r() * 1.0]); }
    for (let i = 0; i < 80; i++) { const x = -200 + r() * 400, z = landEdgeMain(x) - 8 - r() * 70; if (Math.abs(x) < 16 && z > -60) continue; (r() < 0.4 ? bl : sl).push([x, groundY(x, z) - 0.3, z, r() * TAU, 0.85 + r() * 1.0]); }
    for(let i=0;i<90;i++){const x=-180+r()*360,z=205+r()*95;sl.push([x,groundY(x,z)-.2,z,r()*TAU,1+r()*1.3]);}
    instancesAlong(birch, bl); instancesAlong(spruce, sl); S.items.push({ mesh: birch, model: M.create(), noShadow: true }, { mesh: spruce, model: M.create(), noShadow: true, twoSided:true });
    S.birches = bl;for(const [x,y,z,,scale] of sl)collide(x-.17*scale,y,z-.17*scale,.34*scale,3,.34*scale);
    const dressing=new Builder(),rd=rng32(81);
    dressing.tile=MAT.SNOW;dressing.col=[.91,.94,.96];
    for(const [x,z,rx,rz] of [[-5,161,2,4],[5,166,2.4,2],[-17,170,3,1.5],[19,166,3,2],[28,165,2,4],[-11,-29,3,1.7]]){
      const y=groundY(x,z);dressing.loft(x,y-.15,z,[[0,rx,rz],[.22,rx*.92,rz*.93],[.48,rx*.66,rz*.64],[.58,.01,.01]],{segs:24});
    }
    for(let i=0;i<100;i++) {const x=-150+rd()*300,z=landEdgeIsle(x)+2+rd()*5,y=groundY(x,z);if(Math.abs(x)<9)continue;
      dressing.tile=MAT.REED;dressing.col=[.62,.59,.42];const h=.3+rd()*.7;dressing.tube([[x,y,z],[x+.1,y+h*.7,z+.04],[x+.25,y+h,z+.12]],.013,{segs:3});
    }
    dressing.tile=MAT.CONCRETE;dressing.col=[.5,.54,.53];for(const [x,z] of [[-18,140],[-24,145],[12,130],[31,174]]){const y=groundY(x,z);dressing.roundedBox(x,y-.3,z,1.3,.75,1,.3);dressing.tile=MAT.SNOW;dressing.col=[.94,.96,.98];dressing.roundedBox(x+.06,y+.36,z+.04,1.2,.12,.92,.05);dressing.tile=MAT.CONCRETE;dressing.col=[.5,.54,.53];}
    dressing.tile=MAT.PLANK;dressing.col=[.62,.49,.34];for(let row=0;row<3;row++)for(let k=0;k<7-row;k++)dressing.cyl(-3.8+k*.3+row*.15,fy+.16+row*.25,165.7,.145,.65,{axis:'z',segs:9});
    place(dressing.build(),0,0,0);
    // the towers across the bay, and the mast with its red light
    const tw = new Builder(); buildTowers(tw); place(tw.build(), 620, -2, 640, 0);
    const mast = new Builder(); mast.tile = MAT.DARK; mast.col = [1, 1, 1]; mast.cyl(0, 0, 0, 0.5, 70, { r1: 0.2, segs: 6 }); place(mast.build(), -260, groundY(-260, 420), 420, 0);
    const ml = new Builder(); ml.tile = MAT.LED; ml.col = [1, 0.3, 0.25]; ml.box(-0.4, 70, -0.4, 0.8, 0.8, 0.8); S.mastLight = place(ml.build(), -260, groundY(-260, 420), 420, 0, { emis: 1, noShadow: true });
    // the hulls in the bay: standing, or waiting under the ice until you are halfway across
    for (const [x, z, h, yaw] of [[19, 53, 26, 0.25], [-29, 83, 34, -0.35], [95, 100, 37, 0.9], [-80, 77, 20, 1.2]]) { const it = place(buildHull(h), x, -h * 1.05, z, yaw, { noShadow: true, radius: h * 1.2, hull: true }); it.h = h; it.rise = 0; S.hulls.push(it); }
    // the sled
    S.sled = place(buildSled(), 0.8, vy, -26, 0, { noShadow: false });
    // vantage points: places the game asks you to look from
    S.vantages.push({ x: 2, z: -8, key: '1:van', caption: 'The van, with its hazards on, and the whole bay in front of it' });
    S.vantages.push({ x: 4, z: 36, key: '1:bay', caption: 'Halfway across. The towers had stopped breathing.' });
    S.vantages.push({ x: 18, z: 78, key: '1:hulls', caption: 'They had not been cleared away. They had been put in the bay.' });
    S.vantages.push({ x: FARM.x - 12, z: FARM.z - 14, key: '2:house', caption: 'The house, sold, with a window lit' });
    S.vantages.push({ x: 40, z: (FARM.z + 24), key: '2:hole', caption: 'Where SV-14 used to lie. Something had been laid into the hole.' });
    // triggers along the way
    S.triggers.push({ x: 0, z: 14, r: 14, id: 'hulls' }, { x: FARM.x, z: SHORE_Z + 5, r: 12, id: 'island' });
    S.door = { x: FARM.x, z: FARM.z - 4.6 };
    S.cellar = { x: FARM.x + 6.4, z: FARM.z };
    return S;
  }

  // Colliders: push a circle out of the AABBs (in xz) if it overlaps them at height y.
  function pushOut(p, radius, y) {
    for (const c of S.colliders) {
      if (y + 1.5 < c.y0 || y > c.y1) continue;
      const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
      const dx = p.x - nx, dz = p.z - nz, d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d < 1e-4) { const l = c.x1 - p.x, rr = p.x - c.x0, f = c.z1 - p.z, bk = p.z - c.z0, m = Math.min(l, rr, f, bk); if (m === l) p.x = c.x1 + radius; else if (m === rr) p.x = c.x0 - radius; else if (m === f) p.z = c.z1 + radius; else p.z = c.z0 - radius; }
        else { p.x = nx + dx / d * radius; p.z = nz + dz / d * radius; }
      }
    }
  }
  return { build, S, groundY, terrain, onIce, thinAt, inBay, pushOut, FARM, SHORE_Z, landEdgeIsle, landEdgeMain };
})();
