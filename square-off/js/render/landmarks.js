// SQUARE OFF — Render A: hero models. Washington Square Arch (real proportions, Washington statues),
// the Fountain (stepped granite basin, water shader, GPU jets, mist), Judson Memorial Church campanile,
// Garibaldi & Holley statues, Kempner marker, Park House, chess & picnic tables, playgrounds,
// Hangman's Elm, fences (iron pickets, lawn hoop fences, walls, hedges), Midtown skyline cards + ESB.
(function (SQ) {
  'use strict';
  var env = SQ.env = SQ.env || {};
  var U = env.util = env.util || {};
  var L = env.landmarks = env.landmarks || {};
  env.layout = env.layout || {};

  // Arch dimensions (metres). GEO footprint x -8.8..10.3, z -57.5..-50.5.
  var ARCH = L.ARCH = { x: 0.75, z: -54.0, W: 19.1, D: 7.0, H: 23.5, span: 9.1, impost: 10.5, frieze0: 16.6, frieze1: 18.4, cornice: 19.6 };
  ARCH.crown = ARCH.impost + ARCH.span / 2;
  L.HERO_ELM = { x: -150, z: -54 };
  L.anchors = {
    arch: { x: ARCH.x, y: ARCH.H, z: ARCH.z },
    archTop: { x: ARCH.x, y: ARCH.H + 1, z: ARCH.z },
    fountain: { x: 0.5, y: 0, z: 0.2 },
    fountainJetTop: { x: 0.5, y: 8, z: 0.2 },
    judsonTower: { x: -23.5, y: 48, z: 110.5 },
    garibaldi: { x: 58.19, y: 5.2, z: -6.45 },
    holley: { x: -76.11, y: 3.6, z: -10.98 },
    kempner: { x: 14.78, y: 0.8, z: 47.71 },
    parkHouseDoor: { x: -57, y: 0, z: 38 },
    hangmansElm: { x: -150, y: 24, z: -54 },
    chessPlaza: { x: -134, y: 0, z: 49 },
    mutualAid: { x: -73.76, y: 0, z: 7.44 },
    empireState: null
  };

  // ------------------------------------------------------------ shared materials
  function stoneMaterial(quality, tex, opts) {
    opts = opts || {};
    var m = U.mat({ map: tex, color: opts.color || 0xffffff, vertexColors: !!opts.vc, roughness: 0.75 });
    var coff = opts.coffers;
    U.patch(m, {
      key: 'stone' + (coff ? 'c' : '') + (opts.flood ? 'f' : ''),
      see: !!opts.see,
      vertHead: 'varying vec3 vSqN;',
      vertEnd: 'vSqN = normalize(mat3(modelMatrix) * objectNormal);',
      fragHead: 'varying vec3 vSqN; uniform float uFlood;' + (coff ? 'uniform sampler2D uCoff;' : ''),
      uniforms: Object.assign({ uFlood: L.uFlood }, coff ? { uCoff: { value: coff } } : {}),
      frag: function (f) {
        f = f.replace('#include <map_fragment>', [
          '{ vec3 sqN = abs(normalize(vSqN)); vec3 p = vSqW / 4.0;',
          '  vec4 tx = sqN.x > sqN.y && sqN.x > sqN.z ? texture2D(map, p.zy) : sqN.y > sqN.z ? texture2D(map, p.xz) : texture2D(map, p.xy);',
          coff ? '  if (abs(vSqW.x - ' + ARCH.x.toFixed(2) + ') < ' + (ARCH.span / 2 + 0.05).toFixed(2) + ' && vSqW.y > 1.0 && vSqW.y < ' + (ARCH.crown + 0.1).toFixed(2) + ' && abs(vSqW.z - (' + ARCH.z.toFixed(2) + ')) < ' + (ARCH.D / 2 - 0.02).toFixed(2) + ') tx = sqN.y > 0.5 ? texture2D(uCoff, vSqW.xz / 1.15) : texture2D(uCoff, vec2(vSqW.z, vSqW.y) / 1.15);' : '',
          '  diffuseColor *= tx; }'
        ].join('\n'));
        if (opts.flood) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFlood * (0.22 + 0.4 * smoothstep(0.0, 22.0, vSqW.y)) * vec3(1.0, 0.93, 0.82);');
        return f;
      }
    });
    return m;
  }
  L.uFlood = { value: 0 };

  // ------------------------------------------------------------ Washington Square Arch
  function buildArch(q, group, mats) {
    var A = ARCH, hw = A.W / 2, hs = A.span / 2;
    var shape = new THREE.Shape();
    shape.moveTo(-hw, 0); shape.lineTo(-hs, 0); shape.lineTo(-hs, A.impost);
    shape.absarc(0, A.impost, hs, Math.PI, 0, true);
    shape.lineTo(hs, 0); shape.lineTo(hw, 0); shape.lineTo(hw, A.H); shape.lineTo(-hw, A.H); shape.lineTo(-hw, 0);
    var g = new THREE.ExtrudeGeometry(shape, { depth: A.D, bevelEnabled: false, curveSegments: q === 'low' ? 14 : 28 });
    var pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), nz = nor.getZ(i);
      if (nz < -0.9) uv.setXY(i, 0.5 * (hw - x) / A.W, y / A.H);           // north face (viewer's left→right = east→west)
      else if (nz > 0.9) uv.setXY(i, 0.5 + 0.5 * (x + hw) / A.W, y / A.H); // south face
    }
    g.translate(A.x, 0, A.z - A.D / 2);
    var face = U.canvas(2048, Math.round(1024 * A.H / A.W)), fctx = face.getContext('2d');
    fctx.drawImage(SQ.tex.archFace(A, 'north'), 0, 0); fctx.drawImage(SQ.tex.archFace(A, 'south'), 1024, 0);
    var faceTex = U.tex(face, { aniso: 8 });
    var faceMat = U.mat({ map: faceTex, color: 0xfffaf0, roughness: 0.7 });
    U.patch(faceMat, {
      key: 'archface', fragHead: 'uniform float uFlood;', uniforms: { uFlood: L.uFlood },
      frag: function (f) { return f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFlood * (0.22 + 0.4 * smoothstep(0.0, 22.0, vSqW.y)) * vec3(1.0, 0.93, 0.82);'); }
    });
    var body = new THREE.Mesh(g, [faceMat, mats.archStone]);
    body.castShadow = body.receiveShadow = q !== 'low'; body.name = 'arch';
    group.add(body);
    // mouldings, cornices, plinths, attic cap (stone, triplanar marble)
    var b = U.builder(), W = A.W, D = A.D, pw = (A.W - A.span) / 2;
    [-1, 1].forEach(function (s) {
      var px = A.x + s * (hs + pw / 2);
      b.box(pw + 0.5, 0.9, D + 0.5, 0xf4efe6, { x: px, y: 0, z: A.z });                     // plinth
      b.box(pw + 0.3, 0.12, D + 0.3, 0xe8e2d6, { x: px, y: 0.9, z: A.z });
      b.box(pw + 0.36, 0.42, D + 0.36, 0xf6f1e8, { x: px, y: A.impost - 0.42, z: A.z });    // impost cornice
      b.box(pw + 0.2, 0.18, D + 0.2, 0xe8e2d6, { x: px, y: A.impost - 0.6, z: A.z });
    });
    b.box(W + 0.3, 0.28, D + 0.3, 0xf2ede4, { x: A.x, y: A.frieze0 - 0.14, z: A.z });       // architrave moulding
    b.box(W + 0.5, 0.3, D + 0.5, 0xf2ede4, { x: A.x, y: A.frieze1 - 0.2, z: A.z });
    b.box(W + 1.0, 0.75, D + 1.0, 0xfaf6ee, { x: A.x, y: A.frieze1 + 0.1, z: A.z });        // main cornice
    b.box(W + 0.7, 0.25, D + 0.7, 0xece6da, { x: A.x, y: A.frieze1 + 0.85, z: A.z });
    b.box(W + 0.3, 0.38, D + 0.3, 0xf6f1e8, { x: A.x, y: A.H - 0.05, z: A.z });             // attic cap
    // keystones (both faces)
    [-1, 1].forEach(function (s) { b.box(1.1, 1.7, 0.35, 0xfbf8f2, { x: A.x, y: A.crown - 0.35, z: A.z + s * (D / 2 + 0.12) }); });
    // Washington statue groups on the north faces of the piers
    [-1, 1].forEach(function (s) {
      var px = A.x + s * (hs + pw / 2), pz = A.z - D / 2;
      b.box(3.5, 2.0, 2.3, 0xf0ebe2, { x: px, y: 0, z: pz - 1.15 });   // pedestal
      b.box(3.8, 0.25, 2.6, 0xe6e0d4, { x: px, y: 1.95, z: pz - 1.15 });
      b.box(3.0, 0.3, 1.9, 0xe9e4da, { x: px, y: 2.2, z: pz - 1.15 });
      // allegorical high-relief figures carved into the pier behind (Fame & Valor / Wisdom & Justice)
      [-1, 1].forEach(function (t) { figure(b, px + t * 1.35, 2.5, pz - 0.35, 3.7, 0xf1ece4, { relief: true, arm: t * s > 0 ? 'up' : 'down' }); });
      figure(b, px, 2.5, pz - 1.25, 4.4, 0xfaf6ef, { coat: true, hat: s > 0, arm: s > 0 ? 'sword' : 'book' });
    });
    var trim = new THREE.Mesh(b.build(), mats.archStoneVC);
    trim.castShadow = trim.receiveShadow = q !== 'low'; trim.name = 'archTrim';
    group.add(trim);
    return [body, trim, faceTex];
  }

  // Low-poly standing figure (statues). Facing −z (north) by default when flip false.
  function figure(b, x, y, z, H, col, o) {
    o = o || {};
    var k = H / 1.8, face = o.face === undefined ? Math.PI : o.face; // face direction (ry); π → faces −z
    var m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, face, 0)), new THREE.Vector3(k, k, o.relief ? k * 0.45 : k));
    function P(px, py, pz) { return [px, py, pz]; }
    b.cyl(0.075, 0.06, 0.82, 6, col, { x: -0.1, m: m });       // legs
    b.cyl(0.075, 0.06, 0.82, 6, col, { x: 0.1, m: m });
    if (o.coat) b.cyl(0.32, 0.2, 0.7, 8, col, { y: 0.45, m: m }); // coat skirt
    b.cyl(0.2, 0.17, 0.62, 8, col, { y: 0.8, m: m });          // torso
    b.sphere(0.2, 8, 6, col, { y: 1.42, sy: 0.6, m: m });       // shoulders
    b.cyl(0.06, 0.07, 0.1, 6, col, { y: 1.5, m: m });           // neck
    b.sphere(0.12, 8, 6, col, { y: 1.66, sy: 1.15, m: m });     // head
    if (o.hat) b.cyl(0.2, 0.2, 0.08, 3, col, { y: 1.76, m: m, ry: 0.5 }); // tricorn
    if (o.cape || o.coat) b.box(0.5, 0.95, 0.06, col, { y: 0.55, z: -0.16, m: m, rx: 0.12 });
    // arms
    b.rod(P(-0.24, 1.42, 0), P(-0.3, 0.92, 0.05), 0.055, 5, col, { m: m });
    if (o.arm === 'up') b.rod(P(0.24, 1.42, 0), P(0.38, 2.0, 0.1), 0.055, 5, col, { m: m });
    else if (o.arm === 'sword') { b.rod(P(0.24, 1.42, 0), P(0.28, 1.0, 0.2), 0.055, 5, col, { m: m }); b.rod(P(0.28, 1.0, 0.2), P(0.3, 0.1, 0.32), 0.025, 4, col, { m: m }); }
    else if (o.arm === 'book') { b.rod(P(0.24, 1.42, 0), P(0.22, 1.05, 0.22), 0.055, 5, col, { m: m }); b.box(0.22, 0.28, 0.06, col, { x: 0.2, y: 0.95, z: 0.26, m: m }); }
    else b.rod(P(0.24, 1.42, 0), P(0.3, 0.92, 0.05), 0.055, 5, col, { m: m });
  }
  L.figure = figure;

  function flipInward(g) {
    var n = g.attributes.normal; for (var i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    var ix = g.index.array; for (var j = 0; j < ix.length; j += 3) { var t = ix[j + 1]; ix[j + 1] = ix[j + 2]; ix[j + 2] = t; }
    return g;
  }
  // ------------------------------------------------------------ Fountain
  var FOUNT_UNI = null;
  function fountUni() {
    if (FOUNT_UNI) return FOUNT_UNI;
    return (FOUNT_UNI = L.fountainUniforms = {
    uTime: env.U.uTime, uNight: env.U.uNight,
    uSkyTop: { value: new THREE.Color(0x6f9fd8) }, uSkyHor: { value: new THREE.Color(0xc9d8e6) },
    uSunDir: { value: new THREE.Vector3(-0.6, 0.6, 0.3).normalize() }, uSunCol: { value: new THREE.Color(0xfff2d8) },
    uLightCol: { value: new THREE.Color(0xffffff) }, uJet: { value: 1 }, uScale: { value: 800 }
    });
  }
  function buildFountain(q, group, mats) {
    var F = env.ground.FOUNTAIN, b = U.builder(), seg = q === 'low' ? 40 : 72;
    fountUni();
    var granite = 0xb3aba2, graniteD = 0x9c958c;
    function ring(r0, r1, y, col) { var g = new THREE.RingGeometry(r0, r1, seg, 1); g.rotateX(-Math.PI / 2); g.translate(F.x, y, F.z); b.add(g, col); }
    function wall(r, y0, y1, col, inward) {
      var g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true);
      if (inward) flipInward(g);
      g.translate(F.x, (y0 + y1) / 2, F.z); b.add(g, col);
    }
    ring(0, F.floorR, F.floorY, 0x6b7378);
    wall(F.floorR, F.floorY, F.step1Y, graniteD, true);
    ring(F.floorR, F.step1R, F.step1Y, graniteD);
    wall(F.step1R, F.step1Y, F.step2Y, graniteD, true);
    ring(F.step1R, F.innerR, F.step2Y, granite);
    wall(F.innerR, F.step2Y, F.rimY, granite, true);
    ring(F.innerR, F.outerR - 0.12, F.rimY, 0xc4bcb2);
    // bevelled outer edge
    var bev = new THREE.CylinderGeometry(F.outerR - 0.12, F.outerR, 0.12, seg, 1, true); bev.translate(F.x, F.rimY - 0.06, F.z); b.add(bev, 0xbab2a8);
    wall(F.outerR, 0, F.rimY - 0.12, granite, false);
    // central nozzle pedestal and ring of jets
    var cg = new THREE.CylinderGeometry(0.55, 0.8, 0.45, 16); cg.translate(F.x, F.floorY + 0.22, F.z); b.add(cg, 0x7d8388);
    for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2, n = new THREE.CylinderGeometry(0.08, 0.12, 0.25, 6); n.translate(F.x + Math.cos(a) * 7, F.floorY + 0.12, F.z + Math.sin(a) * 7); b.add(n, 0x6a6f72); }
    var basin = new THREE.Mesh(b.build(), mats.vc);
    basin.receiveShadow = true; basin.castShadow = q !== 'low'; basin.name = 'fountainBasin';
    group.add(basin);

    // water surface
    var wg = new THREE.CircleGeometry(F.innerR + 0.02, seg); wg.rotateX(-Math.PI / 2); wg.translate(F.x, F.waterY, F.z);
    var wm = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      vertexShader: [
        '#include <common>', '#include <fog_pars_vertex>', 'varying vec3 vW;',
        'void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;', '#include <fog_vertex>', '}'
      ].join('\n'),
      fragmentShader: [
        '#include <common>', '#include <fog_pars_fragment>',
        'uniform float uTime; uniform float uNight; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uLightCol; uniform float uJet;',
        'varying vec3 vW;',
        'vec2 wave(vec2 p, vec2 d, float f, float s, float a){ float ph = dot(p, d) * f + uTime * s; return d * cos(ph) * a * f; }',
        'void main(){',
        '  vec2 p = vW.xz - vec2(' + F.x.toFixed(2) + ',' + F.z.toFixed(2) + '); float r = length(p);',
        '  vec2 g = wave(p, normalize(vec2(1.0,0.3)), 1.9, 1.7, 0.035) + wave(p, normalize(vec2(-0.4,1.0)), 2.7, -2.1, 0.025) + wave(p, normalize(vec2(0.7,-0.8)), 5.3, 3.3, 0.012) + wave(p, normalize(vec2(-0.9,-0.2)), 8.1, -4.0, 0.006);',
        '  float rip = sin(r * 7.0 - uTime * 7.0) * exp(-r * 0.35) * 0.12 * uJet + sin(abs(r - 7.0) * 9.0 - uTime * 8.0) * exp(-abs(r - 6.6) * 1.2) * 0.06;',
        '  g += (r > 0.01 ? p / r : vec2(0.0)) * rip;',
        '  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));',
        '  vec3 v = normalize(cameraPosition - vW);',
        '  float fr = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);',
        '  vec3 rf = reflect(-v, n);',
        '  vec3 sky = mix(uSkyHor, uSkyTop, clamp(rf.y * 1.4, 0.0, 1.0));',
        '  float sp = pow(max(dot(rf, normalize(uSunDir)), 0.0), 180.0) * 4.0;',
        '  vec3 deep = vec3(0.10, 0.17, 0.18) * uLightCol;',
        '  vec3 col = mix(deep, sky, fr) + uSunCol * sp * (1.0 - uNight);',
        '  float ang = atan(p.y, p.x) * 16.0 / 6.2832; float spot = 1.0 - smoothstep(0.0, 0.32, abs(fract(ang) - 0.5) * 2.0 - 0.0) ;',
        '  float foam = smoothstep(1.8, 0.0, r) * uJet * 0.9 + smoothstep(0.55, 0.0, length(vec2(r - 6.75, 0.0))) * 0.35 * smoothstep(0.35, 0.0, abs(fract(ang + 0.5) - 0.5));',
        '  col = mix(col, uLightCol * 0.95, clamp(foam, 0.0, 0.85));',
        '  col += uNight * vec3(0.10, 0.17, 0.24) * (0.25 + 0.75 * smoothstep(10.6, 1.0, r)) * (0.8 + 2.5 * abs(n.x + n.z));',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>', '  #include <colorspace_fragment>', '  #include <fog_fragment>',
        '}'
      ].join('\n'),
      fog: true
    });
    Object.keys(FOUNT_UNI).forEach(function (k) { wm.uniforms[k] = FOUNT_UNI[k]; });
    var water = new THREE.Mesh(wg, wm); water.name = 'fountainWater'; water.receiveShadow = false;
    group.add(water);

    // jets as GPU points: type 0 = central jet, 1 = ring jets, 2 = mist
    var N = q === 'high' ? 900 : q === 'med' ? 380 : 160, NM = q === 'low' ? 6 : 14, rnd = U.rng(55);
    var P = new Float32Array((N + NM) * 3), S = new Float32Array((N + NM) * 4);
    for (var j = 0; j < N + NM; j++) {
      var type = j >= N ? 2 : (j < N * 0.55 ? 0 : 1);
      var ang = type === 1 ? Math.floor(rnd() * 16) / 16 * Math.PI * 2 : rnd() * Math.PI * 2;
      P[j * 3] = F.x; P[j * 3 + 1] = 0; P[j * 3 + 2] = F.z;
      S[j * 4] = rnd(); S[j * 4 + 1] = ang; S[j * 4 + 2] = rnd(); S[j * 4 + 3] = type;
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(S, 4));
    pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(F.x, 4, F.z), 14);
    var pm = new THREE.ShaderMaterial({
      uniforms: FOUNT_UNI,
      vertexShader: [
        'attribute vec4 aSeed; uniform float uTime; uniform float uScale; uniform float uJet; varying float vA; varying float vT;',
        'void main(){',
        '  float type = aSeed.w; vec3 p = position; float sz = 0.22; vA = 1.0; vT = type;',
        '  if (type < 0.5) {',
        '    float life = 2.6; float age = fract(uTime / life + aSeed.x) * life; float lt = uTime - age;',
        '    float H = (3.2 + 3.6 * (0.5 + 0.5 * sin(lt * 0.42)) + 1.2 * sin(lt * 1.7)) * uJet;',
        '    float v0 = sqrt(max(2.0 * 9.8 * H, 0.01));',
        '    vec2 d = vec2(cos(aSeed.y), sin(aSeed.y)) * (0.15 + aSeed.z * 0.55);',
        '    p += vec3(d.x * age, ' + (F.floorY + 0.45).toFixed(2) + ' + v0 * age - 4.9 * age * age, d.y * age);',
        '    sz = 0.1 + aSeed.z * 0.16 + age * 0.1; vA = 0.8;',
        '    if (p.y < ' + F.waterY.toFixed(2) + ') vA = 0.0;',
        '  } else if (type < 1.5) {',
        '    float life = 1.25; float age = fract(uTime / life + aSeed.x) * life;',
        '    vec2 dir = vec2(cos(aSeed.y), sin(aSeed.y));',
        '    vec2 o = dir * 7.0; vec2 vel = -dir * (0.9 + aSeed.z * 0.3) * uJet;',
        '    p += vec3(o.x + vel.x * age, ' + (F.floorY + 0.25).toFixed(2) + ' + 5.6 * uJet * age - 4.9 * age * age, o.y + vel.y * age);',
        '    sz = 0.12 + aSeed.z * 0.1; vA = 0.65;',
        '    if (p.y < ' + F.waterY.toFixed(2) + ') vA = 0.0;',
        '  } else {',
        '    float t = uTime * 0.12 + aSeed.x * 6.28;',
        '    p += vec3(cos(t + aSeed.y) * 2.4 * aSeed.z, 1.6 + 3.5 * aSeed.z + sin(t * 1.3) * 0.6, sin(t * 0.8 + aSeed.y) * 2.4 * aSeed.z);',
        '    sz = 4.5 + aSeed.z * 4.0; vA = 0.11 * uJet;',
        '  }',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = clamp(sz * uScale / max(-mv.z, 1.0), 1.0, 256.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uLightCol; uniform float uNight; varying float vA; varying float vT;',
        'void main(){ if (vA <= 0.0) discard; vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;',
        '  float a = vT > 1.5 ? smoothstep(0.5, 0.0, d) : smoothstep(0.5, 0.15, d);',
        '  vec3 col = uLightCol * (vT > 1.5 ? 0.95 : 1.05) + uNight * vec3(0.25, 0.32, 0.4);',
        '  gl_FragColor = vec4(col, a * vA);',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false
    });
    var jets = new THREE.Points(pg, pm); jets.name = 'fountainJets'; jets.frustumCulled = true; jets.renderOrder = 2;
    jets.onBeforeRender = function (renderer, scene, camera) {
      var h = renderer.getDrawingBufferSize ? renderer.getDrawingBufferSize(L._v2 || (L._v2 = new THREE.Vector2())).y : 800;
      FOUNT_UNI.uScale.value = camera.isPerspectiveCamera ? h / (2 * Math.tan(camera.fov * Math.PI / 360)) : h * 0.01;
    };
    group.add(jets);
    // translucent water column for the central jet (scaled to the current jet height each frame)
    var colG = new THREE.CylinderGeometry(0.12, 0.32, 1, 10, 6, true); colG.translate(0, 0.5, 0);
    var colM = new THREE.ShaderMaterial({
      uniforms: FOUNT_UNI, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'uniform float uTime; varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; vec3 p = position; p.xz *= 1.0 + 0.25 * sin(uTime * 9.0 + position.y * 7.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uTime; uniform vec3 uLightCol; uniform float uNight; varying vec2 vUv; varying float vY; void main(){ float n = 0.6 + 0.4 * sin(vUv.x * 40.0 + uTime * 3.0) * sin(vUv.y * 30.0 - uTime * 14.0); float a = (0.55 - 0.4 * vY) * n * smoothstep(1.0, 0.75, vY); gl_FragColor = vec4(uLightCol * 1.1 + uNight * vec3(0.25, 0.32, 0.4), a);\n#include <colorspace_fragment>\n}'
    });
    var column = new THREE.Mesh(colG, colM); column.name = 'fountainColumn'; column.position.set(F.x, F.floorY + 0.45, F.z); column.renderOrder = 2;
    column.onBeforeRender = function () {
      var t = FOUNT_UNI.uTime.value, H = (3.2 + 3.6 * (0.5 + 0.5 * Math.sin(t * 0.42)) + 1.2 * Math.sin(t * 1.7)) * FOUNT_UNI.uJet.value;
      column.scale.set(1, Math.max(0.3, H * 0.92), 1); column.updateMatrixWorld();
    };
    if (q !== 'low') group.add(column);
    return [basin, water, jets, column];
  }

  // ------------------------------------------------------------ Judson Memorial Church campanile + gable
  function buildJudson(q, group, mats) {
    var b = U.builder(), brick = 0xd2b07a, trim = 0xd9c7a4, tc = 0xb06a44, dark = 0x2a2420;
    var tx = -23.5, tz = 110.5, w = 7.2;
    b.box(w, 32, w, brick, { x: tx, z: tz });
    // pilaster strips & string courses
    [10.5, 20.5, 31.5].forEach(function (y) { b.box(w + 0.3, 0.4, w + 0.3, trim, { x: tx, y: y, z: tz }); });
    // shaft slit windows
    [6, 14, 24].forEach(function (y) { [0, 1, 2, 3].forEach(function (s) { var a = s * Math.PI / 2; b.box(0.9, 2.2, 0.12, dark, { x: tx + Math.sin(a) * (w / 2 + 0.02), y: y, z: tz + Math.cos(a) * (w / 2 + 0.02), ry: a }); }); });
    // belfry tier with three arched openings per side
    b.box(w + 0.1, 7.5, w + 0.1, brick, { x: tx, y: 32, z: tz });
    for (var s = 0; s < 4; s++) {
      var a = s * Math.PI / 2;
      for (var k = -1; k <= 1; k++) {
        var ox = Math.sin(a) * (w / 2 + 0.06) + Math.cos(a) * k * 2.1, oz = Math.cos(a) * (w / 2 + 0.06) - Math.sin(a) * k * 2.1;
        b.box(1.3, 3.8, 0.12, dark, { x: tx + ox, y: 33.6, z: tz + oz, ry: a });
        var arc = new THREE.CylinderGeometry(0.65, 0.65, 0.12, 10, 1, false, 0, Math.PI); arc.rotateX(Math.PI / 2); arc.rotateZ(Math.PI / 2);
        b.add(arc, dark, { x: tx + ox, y: 37.4, z: tz + oz, ry: a });
        // colonnettes
        b.box(0.22, 4.4, 0.22, trim, { x: tx + ox + Math.cos(a) * 0.78, y: 33.4, z: tz + oz - Math.sin(a) * 0.78, ry: a });
      }
    }
    b.box(w + 0.8, 0.6, w + 0.8, trim, { x: tx, y: 39.5, z: tz });        // cornice
    b.box(w - 0.6, 3.2, w - 0.6, brick, { x: tx, y: 40.1, z: tz });       // loggia
    for (var s2 = 0; s2 < 4; s2++) { var a2 = s2 * Math.PI / 2; for (var k2 = -1; k2 <= 1; k2++) b.box(0.8, 2.1, 0.1, dark, { x: tx + Math.sin(a2) * (w / 2 - 0.25) + Math.cos(a2) * k2 * 1.6, y: 40.6, z: tz + Math.cos(a2) * (w / 2 - 0.25) - Math.sin(a2) * k2 * 1.6, ry: a2 }); }
    b.box(w + 0.2, 0.5, w + 0.2, trim, { x: tx, y: 43.3, z: tz });
    var roof = new THREE.ConeGeometry(w * 0.78, 5.2, 4, 1); roof.rotateY(Math.PI / 4); roof.translate(0, 2.6, 0);
    b.add(roof, tc, { x: tx, y: 43.8, z: tz });
    b.cyl(0.08, 0.08, 2.2, 4, 0x3a3a3a, { x: tx, y: 49, z: tz });       // cross
    b.box(1.0, 0.12, 0.12, 0x3a3a3a, { x: tx, y: 50.4, z: tz });
    // church gable roof (red tile) and front pediment toward Washington Sq S
    var x0 = -39.5, x1 = -19.8, z0 = 87.0, z1 = 106, hh = 20.5, rise = 5.5;
    var shape = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2((x0 + x1) / 2, rise)]);
    var gab = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }); gab.translate(0, hh, z0);
    b.add(gab, tc);
    var ped = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(x0 - 0.3, 0), new THREE.Vector2(x1 + 0.3, 0), new THREE.Vector2((x0 + x1) / 2, rise + 0.4)]), { depth: 0.8, bevelEnabled: false });
    ped.translate(0, hh, z0 - 0.4); b.add(ped, brick);
    // rose window on the pediment + entrance arches
    var rr = new THREE.CircleGeometry(1.9, 20); rr.rotateY(Math.PI); rr.translate((x0 + x1) / 2, hh + 1.9, z0 - 0.41); b.add(rr, trim);
    var rw = new THREE.CircleGeometry(1.5, 20); rw.rotateY(Math.PI); rw.translate((x0 + x1) / 2, hh + 1.9, z0 - 0.43); b.add(rw, 0x5a4a7a);
    b.box(4.2, 5.8, 0.4, trim, { x: (x0 + x1) / 2, y: 0, z: z0 - 0.2 });
    b.box(3.0, 4.6, 0.3, 0x3a2418, { x: (x0 + x1) / 2, y: 0, z: z0 - 0.38 });
    b.box(x1 - x0 + 0.4, 0.5, 0.6, trim, { x: (x0 + x1) / 2, y: hh - 0.3, z: z0 - 0.1 });
    var mesh = new THREE.Mesh(b.build(), mats.vcSee);
    mesh.castShadow = q !== 'low'; mesh.receiveShadow = q !== 'low'; mesh.name = 'judson';
    group.add(mesh);
    return [mesh];
  }

  // ------------------------------------------------------------ statues, markers, park house, tables
  function buildStatues(q, b, bronze) {
    var granite = 0x8f8a86, graniteL = 0xa29d97;
    // Garibaldi (Giovanni Turini, 1888): bronze standing figure drawing his sword, on a granite pedestal
    var gx = 58.19, gz = -6.45, face = Math.atan2(0 - gx, 0 - gz); // toward the fountain
    b.box(4.0, 0.5, 4.0, granite, { x: gx, z: gz, ry: face });
    b.box(3.2, 0.5, 3.2, graniteL, { x: gx, y: 0.5, z: gz, ry: face });
    b.box(2.1, 2.4, 2.1, graniteL, { x: gx, y: 1.0, z: gz, ry: face });
    b.box(2.5, 0.35, 2.5, granite, { x: gx, y: 3.4, z: gz, ry: face });
    figure(bronze, gx, 3.75, gz, 2.9, 0x4f5c4a, { coat: true, arm: 'sword', face: face });
    // Holley Monument (J.Q.A. Ward, 1890): bronze bust on a tall granite pedestal
    var hx = -76.11, hz = -10.98, hf = Math.atan2(0 - hx, 0 - hz);
    b.box(2.4, 0.4, 2.4, granite, { x: hx, z: hz, ry: hf });
    b.box(1.5, 2.3, 1.5, graniteL, { x: hx, y: 0.4, z: hz, ry: hf });
    b.box(1.8, 0.3, 1.8, granite, { x: hx, y: 2.7, z: hz, ry: hf });
    bronze.cyl(0.45, 0.3, 0.55, 10, 0x4b5a48, { x: hx, y: 3.0, z: hz });
    bronze.sphere(0.24, 10, 8, 0x4b5a48, { x: hx, y: 3.75, z: hz, sy: 1.15 });
    bronze.box(0.95, 0.35, 0.5, 0x4b5a48, { x: hx, y: 3.25, z: hz, ry: hf });
    // Kempner marker: a low granite stone
    b.box(1.0, 0.7, 0.55, 0x8d8780, { x: 14.78, z: 47.71, ry: 0.2 });
    b.box(0.9, 0.12, 0.5, 0x7d7770, { x: 14.78, y: 0.7, z: 47.71, ry: 0.2, rx: -0.25 });
  }
  function buildParkHouse(q, b) {
    var bld = (GEO.buildings || []).filter(function (x) { return x.kind === 'toilets'; })[0];
    if (!bld) return;
    var pts = bld.pts, h = 4.0;
    // walls: limestone with bands
    env.buildings.outwardEdges(pts).forEach(function (e) {
      var ang = Math.atan2(-e.dz, e.dx), mx = (e.A[0] + e.B[0]) / 2, mz = (e.A[1] + e.B[1]) / 2;
      b.box(e.L + 0.05, h, 0.35, 0xc9c1b2, { x: mx - e.nx * 0.17, z: mz - e.nz * 0.17, ry: ang });
      b.box(e.L * 0.6, 2.4, 0.06, 0x3b3b38, { x: mx + e.nx * 0.02, z: mz + e.nz * 0.02, ry: ang }); // doors/louvres
      // slatted canopy overhang
      for (var s = 0; s < 6; s++) b.box(e.L + 1.6, 0.08, 0.16, 0x8a6a48, { x: mx + e.nx * (0.3 + s * 0.3), y: h + 0.15, z: mz + e.nz * (0.3 + s * 0.3), ry: ang });
    });
    var c = U.polyCentroid(pts), bb = U.polyBBox(pts);
    var roof = new THREE.Shape(pts.map(function (p) { return new THREE.Vector2(p[0], -p[1]); }));
    var rg = new THREE.ExtrudeGeometry(roof, { depth: 0.35, bevelEnabled: false }); rg.rotateX(-Math.PI / 2); rg.translate(0, h, 0);
    b.add(rg, 0x5d7a3e); // green roof
    b.box(1.6, 0.5, 1.6, 0x9a9a96, { x: c[0], y: h + 0.35, z: c[1] });
  }
  // chess tables (instanced, chess-top texture) and picnic tables
  function buildTables(q, group) {
    var pts = (GEO.points || []).filter(function (p) { return p.kind === 'picnic_table'; });
    var chess = [], picnic = [];
    pts.forEach(function (p) { var x = p.pos[0], z = p.pos[1]; if (x > -150 && x < -120 && z > 36 && z < 62) chess.push(p.pos); else if (Math.abs(x) < 200 && Math.abs(z) < 150) picnic.push(p.pos); });
    var out = [];
    if (chess.length) {
      var top = new THREE.BoxGeometry(0.95, 0.08, 0.95), ped = new THREE.BoxGeometry(0.34, 0.72, 0.34);
      top.translate(0, 0.76, 0); ped.translate(0, 0.36, 0);
      var parts = [top, ped];
      [-1, 1].forEach(function (s) { var st = new THREE.CylinderGeometry(0.2, 0.24, 0.46, 10); st.translate(0, 0.23, s * 0.82); parts.push(st); });
      parts.forEach(function (g, gi) {
        var uv = g.attributes.uv;
        for (var i = 0; i < uv.count; i++) { if (gi === 0 && i >= 8 && i < 12) continue; uv.setXY(i, 0.04 + uv.getX(i) * 0.06, 0.04 + uv.getY(i) * 0.06); }
      });
      var geo = U.merge(parts);
      var tex = U.tex(SQ.tex.chessTop(), {});
      var m = U.mat({ map: tex, color: 0xffffff, roughness: 0.6 }); U.patch(m, { key: 'chess' });
      var im = new THREE.InstancedMesh(geo, m, chess.length), d = new THREE.Object3D();
      chess.forEach(function (p, i) { d.position.set(p[0], 0, p[1]); d.rotation.set(0, Math.atan2(p[0] + 134, p[1] - 49) + Math.PI / 2, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.castShadow = q === 'high'; im.receiveShadow = true; im.name = 'chessTables';
      group.add(im); out.push(im);
    }
    if (picnic.length) {
      var pb = U.builder(), wood = 0x7a5a3a;
      pb.box(1.9, 0.06, 0.8, wood, { y: 0.74 });
      [-1, 1].forEach(function (s) { pb.box(1.9, 0.05, 0.3, wood, { y: 0.44, z: s * 0.62 }); pb.box(0.08, 0.74, 1.5, 0x2a2a2a, { x: s * 0.75 }); });
      var pm = U.mat({ vertexColors: true, roughness: 0.8 }); U.patch(pm, { key: 'picnic' });
      var pi = new THREE.InstancedMesh(pb.build(), pm, picnic.length), d2 = new THREE.Object3D();
      picnic.forEach(function (p, i) { d2.position.set(p[0], 0, p[1]); d2.rotation.set(0, U.hash2(p[0], p[1]) * 3, 0); d2.updateMatrix(); pi.setMatrixAt(i, d2.matrix); });
      pi.castShadow = q === 'high'; pi.receiveShadow = true; pi.name = 'picnicTables';
      group.add(pi); out.push(pi);
    }
    return out;
  }

  // ------------------------------------------------------------ playgrounds
  env.layout.playground = function () {
    if (L._pg) return L._pg;
    L._pg = [
      // Main Playground (x 31..80, z -43..-21)
      { type: 'tower', x: 41, z: -35, ry: 0.0, pad: '#2f6db3', pr: 4.5, c: [0xd8402e, 0xf2c230, 0x2f74c0] },
      { type: 'tower', x: 64, z: -29, ry: 1.57, pad: '#c24a3a', pr: 4.5, c: [0x2f9a5a, 0xf2c230, 0xe2662a] },
      { type: 'swings', x: 74, z: -37, ry: 0, pad: '#3a8a5a', pr: 4.2 },
      { type: 'dome', x: 52, z: -24.5, ry: 0, pad: '#d9a33a', pr: 3.4 },
      { type: 'spring', x: 35, z: -24, ry: 0.3, pad: '#7d58b8', pr: 1.4, c: [0xe94b3c] },
      { type: 'spring', x: 38, z: -23.5, ry: -0.2, pad: '#7d58b8', pr: 1.4, c: [0x3c9be9] },
      { type: 'sprinkler', x: 56, z: -37, ry: 0, pad: '#4a9bc0', pr: 3.5 },
      // Toddler Playground (-62..-37, -65..-55)
      { type: 'tower', x: -55, z: -60, ry: 0, pad: '#e0743a', pr: 3.5, small: true, c: [0x2fa0d8, 0xf2d230, 0xe24a6a] },
      { type: 'swings', x: -43, z: -60.5, ry: 0, pad: '#3a8a5a', pr: 3.6, small: true },
      // Play Hills (-120..-91, 30..54): turf mounds with slides and a net
      { type: 'mound', x: -110, z: 38, ry: 0, r: 5.5 },
      { type: 'mound', x: -100, z: 46, ry: 0, r: 4.5 },
      { type: 'slide', x: -106, z: 42, ry: 0.8, c: [0xf2c230] },
      { type: 'slide', x: -97, z: 50, ry: 2.4, c: [0xe2662a] },
      { type: 'net', x: -112, z: 49, ry: 0.4 }
    ];
    return L._pg;
  };
  function buildPlaygrounds(q, b) {
    env.layout.playground().forEach(function (e) {
      var m = new THREE.Matrix4().compose(new THREE.Vector3(e.x, 0, e.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, e.ry, 0)), new THREE.Vector3(1, 1, 1));
      var c = e.c || [0xd8402e, 0xf2c230, 0x2f74c0], s = e.small ? 0.75 : 1;
      if (e.type === 'tower') {
        var hp = 1.5 * s, ht = 3.6 * s, w = 1.1 * s;
        [[-w, -w], [w, -w], [w, w], [-w, w]].forEach(function (p) { b.box(0.14, ht, 0.14, c[2], { x: p[0], z: p[1], m: m }); });
        b.box(2.4 * s, 0.14, 2.4 * s, c[1], { y: hp, m: m });
        b.box(2.3 * s, 0.6, 0.05, c[0], { y: hp + 0.15, z: -w, m: m });
        b.box(0.05, 0.6, 2.3 * s, c[0], { y: hp + 0.15, x: -w, m: m });
        var roof = new THREE.ConeGeometry(1.75 * s, 1.1 * s, 4); roof.rotateY(Math.PI / 4); roof.translate(0, ht + 0.55 * s, 0);
        b.add(roof, c[0], { m: m });
        // slide down +x
        var L2 = 3.4 * s, ang = Math.atan2(hp, L2);
        var SL = Math.hypot(hp, L2);
        b.box(SL, 0.06, 0.7, c[1], { x: w + L2 / 2, y: hp / 2 - 0.03, rz: -ang, m: m });
        b.box(SL, 0.25, 0.05, c[1], { x: w + L2 / 2, y: hp / 2, z: 0.36, rz: -ang, m: m });
        b.box(SL, 0.25, 0.05, c[1], { x: w + L2 / 2, y: hp / 2, z: -0.36, rz: -ang, m: m });
        // ladder on +z
        for (var r = 0; r < 5; r++) b.box(0.7, 0.05, 0.05, 0x9a9a9a, { y: 0.3 * (r + 1) * s, z: w + 0.25, m: m });
        [-0.35, 0.35].forEach(function (lx) { b.rod([lx, 0, w + 0.45], [lx, hp + 0.5, w + 0.1], 0.03, 4, 0x9a9a9a, { m: m }); });
        // climbing wall on −z
        b.box(1.8 * s, hp, 0.08, c[2], { y: 0, z: -w - 0.3, rx: -0.25, m: m });
      } else if (e.type === 'swings') {
        var Ls = 5.6 * s, Hs = 2.6 * s;
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { b.rod([sx * Ls / 2, 0, sz * 1.0], [sx * Ls / 2, Hs, 0], 0.06, 6, 0x3a5a8a, { m: m }); }); });
        b.rod([-Ls / 2, Hs, 0], [Ls / 2, Hs, 0], 0.07, 6, 0x3a5a8a, { m: m });
        for (var k = 0; k < 4; k++) {
          var sxp = -Ls / 2 + Ls * (k + 0.5) / 4;
          b.rod([sxp - 0.2, Hs, 0], [sxp - 0.2, 0.55, 0], 0.012, 3, 0x777777, { m: m });
          b.rod([sxp + 0.2, Hs, 0], [sxp + 0.2, 0.55, 0], 0.012, 3, 0x777777, { m: m });
          b.box(0.5, e.small ? 0.25 : 0.05, 0.22, e.small ? 0xe24a3a : 0x222222, { x: sxp, y: 0.5, m: m });
        }
      } else if (e.type === 'dome') {
        var ico = new THREE.IcosahedronGeometry(2.6, 1), p = ico.attributes.position, seen = {};
        for (var t = 0; t < p.count; t += 3) for (var k2 = 0; k2 < 3; k2++) {
          var i0 = t + k2, i1 = t + (k2 + 1) % 3;
          var a = [p.getX(i0), p.getY(i0), p.getZ(i0)], bb = [p.getX(i1), p.getY(i1), p.getZ(i1)];
          if (a[1] < -0.05 || bb[1] < -0.05) continue;
          var key = [a, bb].map(function (v) { return v.map(function (n) { return n.toFixed(2); }).join(','); }).sort().join('|');
          if (seen[key]) continue; seen[key] = 1;
          b.rod(a, bb, 0.045, 4, [0xe2662a, 0xf2c230, 0x2f9a5a][Object.keys(seen).length % 3], { m: m });
        }
        ico.dispose();
      } else if (e.type === 'spring') {
        b.cyl(0.08, 0.08, 0.45, 6, 0x333333, { m: m });
        b.sphere(0.4, 8, 6, c[0], { y: 0.7, sx: 1.4, sz: 0.7, m: m });
        b.sphere(0.18, 8, 6, c[0], { y: 1.0, x: 0.45, m: m });
      } else if (e.type === 'sprinkler') {
        for (var j = 0; j < 6; j++) { var aa = j / 6 * Math.PI * 2; b.cyl(0.12, 0.1, 0.9 + (j % 2) * 0.5, 8, j % 2 ? 0x2f74c0 : 0xf2c230, { x: Math.cos(aa) * 2.4, z: Math.sin(aa) * 2.4, m: m }); }
        b.cyl(0.25, 0.2, 2.2, 8, 0xd8402e, { m: m }); b.sphere(0.45, 8, 6, 0xd8402e, { y: 2.3, m: m });
      } else if (e.type === 'mound') {
        var sg = new THREE.SphereGeometry(e.r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); sg.scale(1, 0.32, 1);
        b.add(sg, 0x4f9a4a, { m: m });
      } else if (e.type === 'slide') {
        b.box(0.8, 0.08, 4.2, c[0], { y: 0.8, rx: 0.33, m: m });
        b.box(0.08, 0.35, 4.2, c[0], { y: 0.85, x: 0.42, rx: 0.33, m: m }); b.box(0.08, 0.35, 4.2, c[0], { y: 0.85, x: -0.42, rx: 0.33, m: m });
      } else if (e.type === 'net') {
        b.rod([0, 0, 0], [0, 3.6, 0], 0.08, 6, 0xb33a2a, { m: m });
        for (var n = 0; n < 8; n++) { var an = n / 8 * Math.PI * 2; b.rod([0, 3.5, 0], [Math.cos(an) * 2.8, 0.05, Math.sin(an) * 2.8], 0.025, 3, 0x2a2a2a, { m: m }); }
        for (var rr = 1; rr <= 2; rr++) for (var n2 = 0; n2 < 8; n2++) { var a1 = n2 / 8 * Math.PI * 2, a2 = (n2 + 1) / 8 * Math.PI * 2, R = rr * 0.95, y = 3.5 - rr * 1.2; b.rod([Math.cos(a1) * R, y, Math.sin(a1) * R], [Math.cos(a2) * R, y, Math.sin(a2) * R], 0.02, 3, 0x2a2a2a, { m: m }); }
      }
    });
  }

  // ------------------------------------------------------------ Hangman's Elm (hero tree)
  function buildHeroElm(q, group, leafTex) {
    var H = L.HERO_ELM, bark = U.builder(), rnd = U.rng(1821);
    var limbs = [
      [[0, 0, 0], [0.4, 3, 0.2], [1.6, 7, -0.6], [4.5, 11, -2], [7, 14, -2.5]],
      [[0, 0, 0], [-0.3, 3.5, 0.1], [-2, 8, 1.2], [-5, 12.5, 3], [-7.5, 15, 3.5]],
      [[0, 0, 0], [0.1, 4, -0.3], [0.5, 9, -1.5], [-0.5, 14, -4], [0, 18, -6]]
    ];
    limbs.forEach(function (pts, i) {
      var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
      var tg = new THREE.TubeGeometry(curve, 16, 1.0 - i * 0.12, 7, false);
      // taper: scale radius by height
      var pp = tg.attributes.position;
      for (var k = 0; k < pp.count; k++) {
        var t = Math.floor(k / 8) / 16, c = curve.getPoint(Math.min(1, t));
        var f = 1.15 - t * 0.75 + (t < 0.08 ? (0.08 - t) * 6 : 0);
        pp.setXYZ(k, c.x + (pp.getX(k) - c.x) * f, c.y + (pp.getY(k) - c.y) * f, c.z + (pp.getZ(k) - c.z) * f);
      }
      tg.computeVertexNormals();
      bark.add(tg, 0x5a5048, { x: H.x, z: H.z });
    });
    // root flare
    bark.cyl(2.2, 1.1, 1.4, 9, 0x4e463e, { x: H.x, z: H.z });
    var crown = U.builder(), tips = [[7, 15, -2.5], [-7.5, 16, 3.5], [0, 19, -6], [2, 18, 2], [-3, 17, -3], [4, 16.5, 4], [-5, 14, -1]];
    tips.forEach(function (t, i) {
      var g = new THREE.IcosahedronGeometry(4.6 + rnd() * 1.6, q === 'low' ? 1 : 2);
      var p = g.attributes.position;
      for (var k = 0; k < p.count; k++) { var x = p.getX(k), y = p.getY(k), z = p.getZ(k), n = 1 + (U.hash2(x * 1.7 + i, z * 1.3 + y) - 0.5) * 0.28; p.setXYZ(k, x * n, y * n * 0.72, z * n); }
      g.computeVertexNormals();
      crown.add(g, i % 2 ? 0x587a36 : 0x4c6c30, { x: H.x + t[0], y: t[1] + 1, z: H.z + t[2] });
    });
    var bm = U.mat({ map: U.tex(SQ.tex.bark(), { repeat: true }), vertexColors: true, roughness: 1 }); U.patch(bm, { key: 'heroBark' });
    var cm = U.mat({ map: leafTex, vertexColors: true, roughness: 0.9 }); U.patch(cm, { key: 'heroCrown', canopy: true, wind: 0.6 });
    var trunk = new THREE.Mesh(bark.build(), bm), crownM = new THREE.Mesh(crown.build(), cm);
    trunk.castShadow = crownM.castShadow = q !== 'low'; trunk.receiveShadow = crownM.receiveShadow = q !== 'low';
    trunk.name = 'hangmansElmTrunk'; crownM.name = 'hangmansElmCrown';
    crownM.position.set(0, 0, 0);
    // canopy fade keys on the object origin: move geometry so the origin sits at the tree
    crownM.geometry.translate(-H.x, 0, -H.z); crownM.position.set(H.x, 0, H.z);
    group.add(trunk, crownM);
    return [trunk, crownM];
  }

  // ------------------------------------------------------------ fences, walls, hedges, lawn hoops
  function fenceTexture() {
    var c = U.canvas(256, 256), ctx = c.getContext('2d');
    // top half: iron pickets with spear tips (1.1 m, 2.0 m wide repeat)
    ctx.fillStyle = '#121312';
    for (var i = 0; i < 16; i++) {
      var x = i * 16 + 6;
      ctx.fillRect(x, 14, 4, 114);
      ctx.beginPath(); ctx.moveTo(x - 2, 16); ctx.lineTo(x + 2, 4); ctx.lineTo(x + 6, 16); ctx.fill();
    }
    ctx.fillRect(0, 22, 256, 5); ctx.fillRect(0, 112, 256, 5);
    // bottom half: low hoop fence (overlapping arcs), 0.45 m tall, 2.0 m repeat
    ctx.strokeStyle = '#141614'; ctx.lineWidth = 4;
    for (var k = -1; k < 5; k++) { ctx.beginPath(); ctx.arc(k * 64 + 32, 252, 46, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(k * 64 + 64, 252, 46, Math.PI, 2 * Math.PI); ctx.stroke(); }
    return c;
  }
  function buildFences(q, group, b) {
    var pos = [], uv = [], nrm = [], idx = [];
    function strip(pts, h, v0, v1, closed) {
      var n = pts.length, run = 0;
      for (var i = 0; i < (closed ? n : n - 1); i++) {
        var a = pts[i], c = pts[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], Ls = Math.hypot(dx, dz);
        if (Ls < 0.05) continue;
        var base = pos.length / 3, nx = -dz / Ls, nz = dx / Ls;
        pos.push(a[0], 0, a[1], c[0], 0, c[1], c[0], h, c[1], a[0], h, a[1]);
        uv.push(run / 2, v0, (run + Ls) / 2, v0, (run + Ls) / 2, v1, run / 2, v1);
        for (var k = 0; k < 4; k++) nrm.push(nx, 0, nz);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        run += Ls;
      }
    }
    (GEO.barriers || []).forEach(function (br) {
      var pts = br.pts; if (pts.length < 2) return;
      var c = U.polyCentroid(pts); if (Math.abs(c[0]) > 260 || Math.abs(c[1]) > 180) return;
      var closed = pts.length >= 8 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 12;
      if (closed) pts = pts.concat([pts[0]]);
      if (br.kind === 'fence') {
        // skip the fountain retaining ring if ever tagged fence
        if (Math.hypot(c[0], c[1]) < 13) return;
        strip(pts, 1.1, 0.5, 1.0, false);
        // posts and rails
        var run = 0;
        for (var i = 0; i < pts.length - 1; i++) {
          var a = pts[i], d = pts[i + 1], Ls = Math.hypot(d[0] - a[0], d[1] - a[1]);
          for (var t = 0; t <= Ls; t += 2.4) { var x = a[0] + (d[0] - a[0]) * t / Ls, z = a[1] + (d[1] - a[1]) * t / Ls; b.box(0.09, 1.2, 0.09, 0x141514, { x: x, z: z }); }
          run += Ls;
        }
      } else if (br.kind === 'wall' || br.kind === 'retaining_wall') {
        if (Math.hypot(c[0], c[1]) < 13) return;
        for (var j = 0; j < pts.length - 1; j++) {
          var p0 = pts[j], p1 = pts[j + 1], dx = p1[0] - p0[0], dz = p1[1] - p0[1], Lw = Math.hypot(dx, dz);
          if (Lw < 0.1) continue;
          b.box(Lw + 0.3, br.kind === 'wall' ? 1.4 : 0.8, 0.4, 0x8e867c, { x: (p0[0] + p1[0]) / 2, z: (p0[1] + p1[1]) / 2, ry: Math.atan2(-dz, dx) });
        }
      } else if (br.kind === 'hedge') {
        for (var h2 = 0; h2 < pts.length - 1; h2++) {
          var q0 = pts[h2], q1 = pts[h2 + 1], hx = q1[0] - q0[0], hz = q1[1] - q0[1], Lh = Math.hypot(hx, hz);
          b.box(Lh + 0.6, 1.3, 0.9, 0x3d5e2e, { x: (q0[0] + q1[0]) / 2, z: (q0[1] + q1[1]) / 2, ry: Math.atan2(-hz, hx) });
        }
      }
    });
    // low hoop fences around every park lawn
    var park = (GEO.areas.filter(function (a) { return a.name === 'Washington Square Park'; })[0] || {}).pts;
    GEO.areas.forEach(function (a) {
      if (a.kind !== 'grass' && !(a.kind === 'garden' && Math.abs(U.polyArea(a.pts)) > 600 && !a.name)) return;
      var c = U.polyCentroid(a.pts); if (!park || !U.pointInPoly(c[0], c[1], park)) return;
      strip(a.pts, 0.45, 0.0, 0.2, true);
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    var tex = U.tex(fenceTexture(), { repeat: true });
    tex.wrapT = THREE.ClampToEdgeWrapping;
    var m = U.mat({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color: 0xffffff, roughness: 0.6 });
    U.patch(m, { key: 'fence' });
    var mesh = new THREE.Mesh(g, m); mesh.name = 'fencePickets'; mesh.receiveShadow = q !== 'low';
    if (q === 'high') { mesh.castShadow = true; mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 }); }
    group.add(mesh);
    return [mesh];
  }

  // ------------------------------------------------------------ skyline cards and the Empire State Building
  var SKY_UNI = null;
  function skylineMaterial(color, lights) {
    if (!SKY_UNI) SKY_UNI = L.skylineUniforms = { uHaze: { value: new THREE.Color(0xbfcad6) }, uNight: env.U.uNight, uShade: { value: new THREE.Color(0x8c97a6) } };
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: color }, uLights: { value: lights }, uHaze: SKY_UNI.uHaze, uNight: SKY_UNI.uNight, uShade: SKY_UNI.uShade, uFar: { value: 0.0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform sampler2D uMap; uniform sampler2D uLights; uniform vec3 uHaze; uniform vec3 uShade; uniform float uNight; uniform float uFar; varying vec2 vUv;',
        'void main(){ vec4 t = texture2D(uMap, vUv); if (t.a < 0.02) discard;',
        '  float lum = dot(t.rgb, vec3(0.333));',
        '  vec3 c = mix(uShade * (0.7 + lum * 0.6), uHaze, 0.35 + uFar * 0.35);',
        '  vec3 li = texture2D(uLights, vUv).rgb;',
        '  c = mix(c, uShade * 0.35, uNight * 0.6) + li * uNight * 1.25;',
        '  gl_FragColor = vec4(c, t.a);',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, fog: false
    });
  }
  function buildSkyline(q, group) {
    var meshes = [], A = ARCH;
    // ESB: real bearing up Fifth Ave from the Arch (~2.15 km), placed at 950 m with scaled size.
    var dist = 950, real = 2150, k = dist / real, dir = new THREE.Vector2(-0.032, -1).normalize();
    var ex = A.x + dir.x * dist, ez = A.z + dir.y * dist, eh = 443 * k * 1.08;
    var esb = SQ.tex.empireState(), esbT = U.tex(esb.color, {}), esbL = U.tex(esb.lights, {});
    var eg = new THREE.PlaneGeometry(eh * 256 / 1024, eh); eg.translate(0, eh / 2 - 6, 0);
    var em = new THREE.Mesh(eg, skylineMaterial(esbT, esbL)); em.position.set(ex, 0, ez); em.lookAt(A.x, 0, A.z); em.renderOrder = -5; em.name = 'empireState';
    em.material.uniforms.uFar.value = 0.25;
    group.add(em); meshes.push(em);
    L.anchors.empireState = { x: ex, y: eh, z: ez };
    // skyline strips: Midtown (north, tall), Downtown (south), and low rings east/west
    var cards = [
      { a0: -0.75, a1: 0.75, d: 1000, span: 1600, h: 230, seed: 3, far: 0.5, center: -Math.PI / 2 },
      { a0: -0.45, a1: 0.45, d: 900, span: 900, h: 160, seed: 5, far: 0.25, center: -Math.PI / 2 },
      { a0: -0.7, a1: 0.7, d: 1000, span: 1500, h: 170, seed: 7, far: 0.45, center: Math.PI / 2 },
      { a0: -0.8, a1: 0.8, d: 950, span: 1500, h: 90, seed: 9, far: 0.4, center: 0 },
      { a0: -0.8, a1: 0.8, d: 950, span: 1500, h: 90, seed: 11, far: 0.4, center: Math.PI }
    ];
    if (q === 'low') cards = cards.slice(0, 3);
    cards.forEach(function (cd) {
      var sk = SQ.tex.skyline(cd.seed, cd.span, cd.h), t = U.tex(sk.color, { nomip: false }), l = U.tex(sk.lights, {});
      // curved strip of segments on an arc
      var segs = 8, pos = [], uv = [], idx = [];
      for (var i = 0; i <= segs; i++) {
        var a = cd.center + cd.a0 + (cd.a1 - cd.a0) * i / segs, x = Math.cos(a) * cd.d, z = Math.sin(a) * cd.d;
        pos.push(x, -8, z, x, cd.h - 8, z); uv.push(i / segs, 0, i / segs, 1);
        if (i < segs) { var bse = i * 2; idx.push(bse, bse + 2, bse + 1, bse + 1, bse + 2, bse + 3); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      var mm = skylineMaterial(t, l); mm.side = THREE.DoubleSide; mm.uniforms.uFar.value = cd.far;
      var mesh = new THREE.Mesh(g, mm); mesh.renderOrder = -6; mesh.name = 'skyline'; mesh.frustumCulled = false;
      group.add(mesh); meshes.push(mesh);
    });
    return meshes;
  }

  // ------------------------------------------------------------ build
  L.build = function (ctx) {
    var q = ctx.quality, group = new THREE.Group(); group.name = 'landmarks';
    var marble = U.tex(SQ.tex.marble(512), { repeat: true }), coffers = U.tex(SQ.tex.coffers(), { repeat: true });
    var mats = {
      archStone: stoneMaterial(q, marble, { coffers: coffers, flood: true, color: 0xfffaf2 }),
      archStoneVC: stoneMaterial(q, marble, { vc: true, flood: true }),
      vc: U.patch(U.mat({ vertexColors: true, roughness: 0.85 }), { key: 'lmvc' }),
      vcSee: U.patch(U.mat({ vertexColors: true, roughness: 0.85 }), { key: 'lmvcs', see: true })
    };
    var bronzeMat = U.patch(U.mat({ vertexColors: true, roughness: 0.45, metalness: 0.55 }), { key: 'bronze' });
    var all = [];
    all = all.concat(buildArch(q, group, mats));
    all = all.concat(buildFountain(q, group, mats));
    all = all.concat(buildJudson(q, group, mats));
    var misc = U.builder(), bronze = U.builder();
    buildStatues(q, misc, bronze);
    buildParkHouse(q, misc);
    buildPlaygrounds(q, misc);
    all = all.concat(buildFences(q, group, misc));
    var mm = new THREE.Mesh(misc.build(), mats.vc); mm.castShadow = q !== 'low'; mm.receiveShadow = q !== 'low'; mm.name = 'landmarkProps';
    var bm = new THREE.Mesh(bronze.build(), bronzeMat); bm.castShadow = q !== 'low'; bm.name = 'bronzes';
    group.add(mm, bm); all.push(mm, bm);
    all = all.concat(buildTables(q, group));
    var leafTex = U.tex(SQ.tex.leaves(), { repeat: true });
    all = all.concat(buildHeroElm(q, group, leafTex));
    var sky = buildSkyline(q, group);
    all = all.concat(sky);
    return {
      group: group, anchors: L.anchors, skyline: sky,
      dispose: function () {
        group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
            ['map', 'uMap', 'uLights'].forEach(function (k) { var t = m[k] || (m.uniforms && m.uniforms[k] && m.uniforms[k].value); if (t && t.dispose) t.dispose(); });
            m.dispose();
          });
        });
        [marble, coffers, leafTex].forEach(function (t) { t.dispose(); });
      }
    };
  };
})(window.SQ = window.SQ || {});
