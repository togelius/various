// GRIFT CITY — the renderer: one lit shader (shadowed sun + hemisphere + point lights + emissive windows + fog),
// a sky, a shadow pass, instanced props, point-sprite particles and a flat FX pass.
'use strict';
const RENDER = (() => {
  let gl, litProg, instProg, shadowProg, shadowInstProg, litStaticProg, shadowStaticProg, skyProg, partProg, flatProg, texArray, nrmArray, shadow;
  const MAX_LIGHTS = 32, MAX_BONES = 12;
  const proj = M.create(), view = M.create(), vp = M.create(), invVP = M.create(), invProj = M.create(), lightView = M.create(), lightProj = M.create();
  const identityBones = new Float32Array(16 * MAX_BONES); for (let i = 0; i < MAX_BONES; i++) identityBones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
  const zeroEmis = new Float32Array(MAX_BONES);
  const cam = { x: 0, y: 20, z: 0, tx: 0, ty: 0, tz: 1, fov: 60 * Math.PI / 180, near: 0.3, far: 900 };
  const env = { sunDir: [0.3, 0.8, 0.5], sunCol: [1, 1, 1], skyCol: [0.5, 0.6, 0.7], groundCol: [0.3, 0.3, 0.3], fogCol: [0.7, 0.8, 0.9], fogDensity: 0.0016, nightEmis: 0, zenith: [0.2, 0.4, 0.8], horizon: [0.7, 0.8, 0.9], daylight: 1, starAlpha: 0, sunDisc: 1 , normalMaps: true, normalStrength: 0.6 , fogHeight: 30, fogSun: 0.7 , reflect: 1.7 , wet: 0 };
  const lights = { pos: new Float32Array(MAX_LIGHTS * 4), col: new Float32Array(MAX_LIGHTS * 3), n: 0 };
  const stats = { draws: 0, tris: 0 };

  const VS = `
    in vec3 aPos; in vec3 aNrm; in vec3 aCol; in vec2 aUV; in float aTile; in float aBone;
    #ifdef INSTANCED
    in vec4 aI0; in vec4 aI1; in vec4 aI2; in vec4 aI3; in vec4 aTint;
    #endif
    uniform mat4 uVP; uniform mat4 uModel; uniform mat4 uBones[${MAX_BONES}]; uniform float uBoneEmis[${MAX_BONES}]; uniform vec2 uUVOff;
    out vec3 vWorld; out vec3 vNrm; out vec3 vCol; out vec2 vUV; flat out float vTile; out float vEmis;
    void main() {
      #ifdef INSTANCED
      mat4 model = mat4(aI0, aI1, aI2, aI3); vCol = aCol * aTint.rgb; vEmis = aTint.a;
      #elif defined(STATIC)
      mat4 model = uModel; vCol = aCol; vEmis = 0.0;
      #else
      mat4 model = uModel * uBones[int(aBone)]; vCol = aCol; vEmis = uBoneEmis[int(aBone)];
      #endif
      vec4 w = model * vec4(aPos, 1.0); vWorld = w.xyz; vNrm = normalize(mat3(model) * aNrm);
      vUV = aUV + uUVOff; vTile = aTile;
      gl_Position = uVP * w;
    }`;
  const FS = `
    in vec3 vWorld; in vec3 vNrm; in vec3 vCol; in vec2 vUV; flat in float vTile; in float vEmis;
    uniform sampler2DArray uTex; uniform sampler2DShadow uShadow; uniform sampler2DArray uNrm;
    uniform float uNrmOn; uniform float uNrmStr; uniform vec4 uPanes[128]; uniform float uInterior;
    uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGroundCol; uniform vec3 uFogCol; uniform vec3 uCamPos;
    uniform float uFogDensity; uniform float uFogHeight; uniform float uFogSun; uniform float uNightEmis;
    uniform mat4 uLightVP[2]; uniform float uCascadeFar; uniform float uWet;
    uniform vec3 uZenith; uniform vec3 uHorizon; uniform float uReflect; uniform float uShadowOn; uniform float uTexOn; uniform float uSpec; uniform float uHDR; uniform float uAlpha; uniform float uWater; uniform float uTime;
    uniform vec4 uLights[${MAX_LIGHTS}]; uniform vec3 uLightCols[${MAX_LIGHTS}]; uniform int uNumLights;
    out vec4 o;
    // Textures and palette colours are authored in sRGB; lighting has to happen in linear light or everything
    // washes out once the composite gamma-encodes the result. This is the usual cheap sRGB decode.
    vec3 s2l(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }
    float sampleCascade(int c, vec3 wp, float bias) {
      vec4 sp = uLightVP[c] * vec4(wp, 1.0);
      vec3 p = sp.xyz / sp.w * 0.5 + 0.5;
      if (p.x < 0.002 || p.x > 0.998 || p.y < 0.002 || p.y > 0.998 || p.z > 1.0) return -1.0; // outside this cascade
      p.z -= bias;
      p.x = p.x * 0.5 + (c == 0 ? 0.0 : 0.5); // the two cascades sit side by side in one atlas
      float s = textureOffset(uShadow, p, ivec2(-1, -1)) + textureOffset(uShadow, p, ivec2(0, -1)) + textureOffset(uShadow, p, ivec2(1, -1))
              + textureOffset(uShadow, p, ivec2(-1, 0)) + textureOffset(uShadow, p, ivec2(0, 0)) + textureOffset(uShadow, p, ivec2(1, 0))
              + textureOffset(uShadow, p, ivec2(-1, 1)) + textureOffset(uShadow, p, ivec2(0, 1)) + textureOffset(uShadow, p, ivec2(1, 1));
      return s / 9.0;
    }
    float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float roomDepth(float t, float tz) { return clamp(t / max(tz, 0.01), 0.0, 1.0) * 0.5; }
    float shadowAt(vec3 n) {
      vec3 wp = vWorld + n * 0.06;
      float d = length(vWorld - uCamPos);
      if (d < uCascadeFar) { // the near cascade is tight, so it can afford a small bias
        float s = sampleCascade(0, wp + n * 0.04, 0.0012);
        if (s >= 0.0) {
          float fade = smoothstep(uCascadeFar * 0.82, uCascadeFar, d);
          if (fade <= 0.0) return s;
          float f = sampleCascade(1, wp + n * 0.14, 0.0022);
          return mix(s, f < 0.0 ? 1.0 : f, fade);
        }
      }
      float f = sampleCascade(1, wp + n * 0.14, 0.0022);
      return f < 0.0 ? 1.0 : f;
    }
    void main() {
      vec4 t = uTexOn > 0.5 ? texture(uTex, vec3(vUV, vTile)) : vec4(1.0);
      vec3 albedo = s2l(t.rgb) * s2l(vCol);
      vec3 n = normalize(vNrm); vec3 nGeom = n;
      vec3 dp1 = dFdx(vWorld), dp2 = dFdy(vWorld); vec2 duv1 = dFdx(vUV), duv2 = dFdy(vUV);
      #ifdef STATIC
      // grime: the foot of every wall is darker, as it is on any street
      if (abs(n.y) < 0.5 && vWorld.y > -1.0) albedo *= 1.0 - 0.3 * (1.0 - smoothstep(0.1, 2.6, vWorld.y));
      #endif
      // Normal and roughness from the parallel map. The tangent frame comes from the screen-space derivatives of world
      // position and UV (Mikkelsen's cotangent frame), so no tangents need storing on the mesh.
      float rough = 0.72;
      if (uNrmOn > 0.5 && uTexOn > 0.5) {
        vec4 nm = texture(uNrm, vec3(vUV, vTile));
        rough = nm.a;
        vec3 dp2perp = cross(dp2, n), dp1perp = cross(n, dp1);
        vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
        vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
        float m = max(dot(T, T), dot(B, B));
        if (m > 1e-12) {
          vec3 tn = nm.xyz * 2.0 - 1.0; tn.y = -tn.y; // the canvas v axis runs down the texture
          tn.xy *= uNrmStr;
          float inv = inversesqrt(m);
          n = normalize(mat3(T * inv, B * inv, n) * normalize(tn));
        }
      }
      // Interior mapping: behind every window pane of a facade tile there is a virtual room, a box one pane wide and one
      // storey tall and about three metres deep, intersected along the view ray in the wall's tangent frame. Its walls,
      // floor and ceiling take a colour from a hash of the room's position, and a lit pane (the emissive mask) lights it.
      // No geometry: the window pane's albedo becomes what you would see through it, and the glass reflection sits on top.
      vec4 pg = uPanes[int(vTile + 0.5)];
      if (uInterior > 0.5 && uTexOn > 0.5 && pg.x > 0.5 && abs(nGeom.y) < 0.5) {
        vec2 cell = vec2(vUV.x * pg.x, vUV.y * pg.y); vec2 f = fract(cell);
        if (f.x > pg.z && f.x < 1.0 - pg.z && f.y > pg.w && f.y < 1.0 - pg.w) {
          vec3 dp2p = cross(dp2, nGeom), dp1p = cross(nGeom, dp1);
          vec3 Th = normalize(dp2p * duv1.x + dp1p * duv2.x), Bh = normalize(dp2p * duv1.y + dp1p * duv2.y);
          vec3 vd = normalize(vWorld - uCamPos); vec3 d = vec3(dot(vd, Th), dot(vd, Bh), min(dot(vd, nGeom), -0.05));
          float W = 14.0 / pg.x, H = 12.8 / pg.y, D = 3.0; vec3 o = vec3(f.x * W, f.y * H, 0.0);
          float tx = abs(d.x) < 1e-4 ? 1e9 : ((d.x > 0.0 ? W : 0.0) - o.x) / d.x, ty = abs(d.y) < 1e-4 ? 1e9 : ((d.y > 0.0 ? H : 0.0) - o.y) / d.y, tz = -D / d.z;
          float tt = min(min(tx, ty), tz);
          vec3 rid = vec3(floor(cell.x) + floor((vWorld.x + vWorld.z) / 14.0) * 53.0, floor(cell.y) + floor(vWorld.y / 12.8) * 17.0, vTile);
          float h1 = hash13(rid), h2 = hash13(rid + 7.1), h3 = hash13(rid + 3.3);
          vec3 wall = mix(vec3(0.82, 0.78, 0.7), vec3(0.62, 0.68, 0.74), h1); wall = mix(wall, vec3(0.78, 0.62, 0.5), h2 * 0.5);
          vec3 hit = tt == tz ? wall * 0.72 : tt == tx ? wall * 0.88 : (d.y > 0.0 ? wall * vec3(0.42, 0.38, 0.34) : vec3(0.92, 0.9, 0.86));
          if (tt == tz && h3 > 0.55) { vec3 hp = o + d * tt; float px = fract(hp.x / W * 2.0 + h1); if (px > 0.3 && px < 0.75 && hp.y > H * 0.45) hit *= 0.55; } // a cupboard or a picture on the back wall
          float lit = t.a > 0.02 ? 1.0 : 0.0; float amb = 0.16 + 0.6 * lit * (0.6 + 0.4 * (1.0 - roomDepth(tt, tz)));
          albedo = s2l(hit) * amb * s2l(vCol);
        }
      }
      if (uWater > 0.5) { n = normalize(n + vec3(sin(vWorld.x * 0.35 + uTime * 1.1) * 0.07 + sin(vWorld.z * 0.9 - uTime * 1.7) * 0.04, 0.0, cos(vWorld.z * 0.4 + uTime * 0.9) * 0.07 + cos(vWorld.x * 1.1 + uTime * 1.3) * 0.04)); }
      // Rain pools on anything facing the sky. The film darkens what is under it and reflects what is above.
      float wet = uWet > 0.0 ? smoothstep(0.45, 0.92, n.y) * uWet : 0.0;
      if (wet > 0.0) { rough = mix(rough, 0.1, wet); albedo *= mix(1.0, 0.45, wet); }
      float ndl = max(dot(n, uSunDir), 0.0);
      float sh = (uShadowOn > 0.5 && ndl > 0.0) ? shadowAt(n) : 1.0;
      vec3 hemi = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5);
      vec3 col = albedo * (hemi + uSunCol * ndl * sh);
      vec3 v = normalize(uCamPos - vWorld);
      float gloss = 1.0 - rough; float power = mix(6.0, 110.0, gloss * gloss);
      if (uSpec > 0.0) { vec3 hv = normalize(uSunDir + v);
        float sp = pow(max(dot(n, hv), 0.0), power) * (0.12 + 1.5 * gloss * gloss);
        col += uSunCol * sp * uSpec * sh;
        // A smooth surface mirrors the sky: the same gradient the sky shader draws, looked up along the reflected
        // view ray, with a Fresnel edge. This is what makes a glass tower read as glass rather than a painted grid.
        vec3 refl = reflect(-v, n);
        vec3 skyRefl = s2l(mix(uHorizon, uZenith, pow(clamp(refl.y, 0.0, 1.0), 0.55)));
        skyRefl += uSunCol * pow(max(dot(refl, uSunDir), 0.0), 64.0) * 0.6;
        float fres = 0.08 + 0.92 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
        float dn = clamp(refl.y * 2.0 + 0.55, 0.0, 1.0); // rays aimed at the ground see the street, not the sky
        col = mix(col, skyRefl, clamp(uReflect * uSpec * gloss * gloss * fres * dn, 0.0, 0.92));
        col += hemi * uSpec * (0.25 - 0.2 * gloss) * pow(1.0 - max(dot(n, v), 0.0), 3.0); }
      for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uNumLights) break;
        vec3 L = uLights[i].xyz - vWorld; float d = length(L); float att = clamp(1.0 - d / uLights[i].w, 0.0, 1.0); att *= att;
        if (att <= 0.0) continue;
        vec3 Ln = L / d;
        float nl = max(dot(n, Ln), 0.0) * 0.8 + 0.2;
        col += albedo * uLightCols[i] * att * nl;
        // a lamp reflected in a wet street, which is most of what a city looks like in the rain at night
        if (uSpec > 0.0 && gloss > 0.4) col += uLightCols[i] * att * pow(max(dot(n, normalize(Ln + v)), 0.0), power) * uSpec * gloss * gloss * 1.6;
      }
      col += mix(albedo, s2l(vec3(1.0, 0.87, 0.66)), 0.15) * t.a * uNightEmis * 1.8;
      col += s2l(vCol) * vEmis;
      // Height fog: haze pools in the streets and thins with altitude, so the skyline stays crisp and the city gains depth.
      // Analytic integral of an exponential density along the view ray, then tinted toward the sun for aerial perspective.
      vec3 dv = vWorld - uCamPos; float dist = length(dv);
      float invH = 1.0 / uFogHeight;
      float dy = dv.y;
      float integral = abs(dy) < 0.05 ? exp(-uCamPos.y * invH) : (exp(-uCamPos.y * invH) - exp(-vWorld.y * invH)) / (dy * invH);
      float f = 1.0 - exp(-dist * uFogDensity * max(integral, 0.0));
      vec3 vdir = dv / max(dist, 0.001);
      float sunAmt = pow(max(dot(vdir, uSunDir), 0.0), 6.0);
      vec3 fogL = s2l(uFogCol);
      vec3 fogC = mix(fogL, fogL * 0.6 + uSunCol * 0.7, sunAmt * uFogSun);
      col = mix(col, fogC, clamp(f, 0.0, 1.0));
      if (uHDR > 0.5) { o = vec4(col, uAlpha); return; }
      col = col / (1.0 + col * 0.35);
      o = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), uAlpha);
    }`;
  const SHADOW_FS = `out vec4 o; void main() { o = vec4(1.0); }`;
  const SKY_VS = `const vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)); out vec2 vNdc; void main() { vNdc = v[gl_VertexID]; gl_Position = vec4(v[gl_VertexID], 0.9999, 1.0); }`;
  const SKY_FS = `
    in vec2 vNdc; uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform float uStars; uniform float uSunDisc; uniform float uTime; uniform float uCloud; uniform float uHDR;
    out vec4 o;
    float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; } return v; }
    void main() {
      vec4 a = uInvVP * vec4(vNdc, 1.0, 1.0); vec3 dir = normalize(a.xyz / a.w - uCamPos);
      float h = clamp(dir.y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
      col = col * (col * (col * 0.305306011 + 0.682171111) + 0.012522878); // to linear, like everything else in the buffer
      float sd = max(dot(dir, uSunDir), 0.0);
      col += uSunCol * (pow(sd, 256.0) * 2.0 * uSunDisc + pow(sd, 8.0) * 0.25 * uSunDisc);
      // stars
      if (uStars > 0.0 && dir.y > 0.0) { vec3 g = floor(dir * 180.0); float s = hash(g); float twinkle = 0.7 + 0.3 * sin(uTime * 3.0 + s * 50.0); if (s > 0.985) col += vec3(0.8, 0.85, 1.0) * uStars * twinkle * (s - 0.985) * 60.0 * h; }
      // moon at night: opposite the sun
      float md = max(dot(dir, -uSunDir * vec3(1.0, -1.0, 1.0)), 0.0);
      col += vec3(0.7, 0.75, 0.85) * pow(md, 900.0) * uStars * 1.5;
      // clouds: a noise sheet at a fixed height, fading toward the horizon
      if (dir.y > 0.02) { vec2 cp = (uCamPos.xz + dir.xz / dir.y * 900.0) * 0.0009 + vec2(uTime * 0.004, 0.0); float c = fbm(cp); float cov = smoothstep(0.52 - uCloud * 0.4, 0.72 - uCloud * 0.3, c) * smoothstep(0.02, 0.2, dir.y);
        vec3 cloudCol = mix(uHorizon * 0.9, vec3(1.0), 0.6) * (0.55 + 0.45 * uSunDisc) * (uStars > 0.5 ? 0.25 : 1.0); col = mix(col, cloudCol, cov * 0.85); }
      // low haze band near horizon at night
      col = mix(col, uHorizon, (1.0 - h) * 0.15);
      if (uHDR > 0.5) { o = vec4(col, 1.0); return; }
      o = vec4(pow(col, vec3(1.0 / 1.25)), 1.0);
    }`;
  const PART_VS = `in vec3 aPos; in float aSize; in vec4 aCol; uniform mat4 uVP; uniform vec3 uCamPos; uniform float uScale; out vec4 vCol;
    void main() { gl_Position = uVP * vec4(aPos, 1.0); float d = max(gl_Position.w, 0.1); gl_PointSize = clamp(aSize * uScale / d, 1.0, 256.0); vCol = aCol; }`;
  const PART_FS = `in vec4 vCol; out vec4 o; void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard; float a = smoothstep(1.0, 0.2, r); vec3 k = vCol.rgb; o = vec4(k * (k * (k * 0.305306011 + 0.682171111) + 0.012522878), vCol.a * a); }`;
  const QUAD_VS = `const vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)); out vec2 vUV; void main() { vUV = v[gl_VertexID] * 0.5 + 0.5; gl_Position = vec4(v[gl_VertexID], 0.0, 1.0); }`;
  const BRIGHT_FS = `in vec2 vUV; uniform sampler2D uTex; uniform float uThreshold; out vec4 o; void main() { vec3 c = texture(uTex, vUV).rgb; float l = dot(c, vec3(0.3, 0.55, 0.15)); float k = max(l - uThreshold, 0.0) / max(l, 1e-3); o = vec4(c * k, 1.0); }`;
  const BLUR_FS = `in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
    void main() { const float w[5] = float[5](0.227, 0.194, 0.121, 0.054, 0.016); vec3 c = texture(uTex, vUV).rgb * w[0]; for (int i = 1; i < 5; i++) { vec2 off = uDir * float(i); c += texture(uTex, vUV + off).rgb * w[i]; c += texture(uTex, vUV - off).rgb * w[i]; } o = vec4(c, 1.0); }`;
  const AO_FS = `in vec2 vUV; uniform sampler2D uDepth; uniform mat4 uInvProj; uniform mat4 uProj; uniform vec2 uRes; uniform float uRadius; uniform float uTime; out vec4 o;
    vec3 viewPos(vec2 uv) { float d = texture(uDepth, uv).r; vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      float d0 = texture(uDepth, vUV).r; if (d0 >= 0.99999) { o = vec4(1.0); return; }
      vec3 P = viewPos(vUV); vec3 N = normalize(cross(dFdx(P), dFdy(P))); if (dot(N, -P) < 0.0) N = -N;
      float a = hash(vUV * uRes) * 6.2832; float ca = cos(a), sa = sin(a);
      const vec3 K[10] = vec3[10](vec3(0.27,0.1,0.35), vec3(-0.2,0.3,0.25), vec3(0.4,-0.15,0.2), vec3(-0.35,-0.3,0.3), vec3(0.1,0.45,0.4), vec3(-0.5,0.1,0.15), vec3(0.2,-0.5,0.3), vec3(0.6,0.3,0.45), vec3(-0.25,0.55,0.55), vec3(0.05,-0.2,0.75));
      float occ = 0.0; float scale = uRadius * clamp(1.0 / (-P.z * 0.08 + 1.0), 0.2, 1.0);
      vec3 T = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0))); vec3 B = cross(N, T);
      for (int i = 0; i < 10; i++) { vec3 k = K[i]; vec2 r = vec2(k.x * ca - k.y * sa, k.x * sa + k.y * ca); vec3 sp = P + (T * r.x + B * r.y + N * k.z) * uRadius * (0.3 + 0.7 * float(i) / 9.0);
        vec4 c = uProj * vec4(sp, 1.0); vec2 suv = c.xy / c.w * 0.5 + 0.5;
        if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
        vec3 sceneP = viewPos(suv); float rangeCheck = smoothstep(0.0, 1.0, uRadius / max(abs(P.z - sceneP.z), 1e-3));
        occ += (sceneP.z >= sp.z + 0.05 ? 1.0 : 0.0) * rangeCheck; }
      float ao = 1.0 - occ / 10.0; o = vec4(vec3(ao), 1.0);
    }`;
  const AOBLUR_FS = `in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o; void main() { float s = 0.0; for (int x = -2; x <= 1; x++) for (int y = -2; y <= 1; y++) s += texture(uTex, vUV + vec2(float(x) + 0.5, float(y) + 0.5) * uTexel).r; o = vec4(vec3(s / 16.0), 1.0); }`;
  const COMPOSITE_FS = `in vec2 vUV; uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uAO; uniform sampler2D uDepth; uniform float uAOAmt; uniform float uBloomAmt; uniform float uExposure; uniform float uHDR; uniform float uVignette; uniform float uSat; uniform vec3 uTint; uniform vec2 uTexel; uniform vec2 uNF; uniform float uEdge; out vec4 o;
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float lin(vec2 uv) { float z = texture(uDepth, uv).r * 2.0 - 1.0; return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x)); }
    // Ink lines: a depth step (silhouette) or a change of depth slope (crease) between neighbouring pixels draws a dark
    // line, thinner and fainter with distance, so every object reads as drawn rather than rendered.
    float edge() {
      float dc = lin(vUV); if (dc > 260.0) return 0.0;
      float dl = lin(vUV - vec2(uTexel.x, 0.0)), dr = lin(vUV + vec2(uTexel.x, 0.0)), du = lin(vUV + vec2(0.0, uTexel.y)), dd = lin(vUV - vec2(0.0, uTexel.y));
      // second difference of depth: zero across any flat surface however oblique, large at a silhouette step or a crease
      float lap = max(abs(dl + dr - 2.0 * dc), abs(du + dd - 2.0 * dc)) / dc;
      float e = smoothstep(0.004, 0.014, lap);
      return e * (1.0 - smoothstep(70.0, 240.0, dc));
    }
    void main() {
      float ao = mix(1.0, texture(uAO, vUV).r, uAOAmt); vec3 c = texture(uScene, vUV).rgb * ao + texture(uBloom, vUV).rgb * uBloomAmt;
      if (uHDR > 0.5) { c = aces(c * uExposure); c = pow(c, vec3(1.0 / 2.2)); }
      if (uEdge > 0.0) c *= 1.0 - uEdge * edge(); // on the display-referred colour, so a line is a line at any exposure
      float l = dot(c, vec3(0.3, 0.55, 0.15)); c = mix(vec3(l), c, uSat) * uTint;
      vec2 d = vUV - 0.5; c *= 1.0 - uVignette * dot(d, d) * 2.2;
      o = vec4(c, 1.0);
    }`;
  const FLAT_VS = `in vec3 aPos; in vec4 aCol; uniform mat4 uVP; out vec4 vCol; void main() { gl_Position = uVP * vec4(aPos, 1.0); vCol = aCol; }`;
  const FLAT_FS = `in vec4 vCol; out vec4 o; void main() { vec3 c = vCol.rgb; o = vec4(c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878), vCol.a); }`;

  let partVao, partBuf, flatVao, flatBuf, brightProg, blurProg, compProg, aoProg, aoBlurProg;
  const post = { enabled: true, hdr: false, w: 0, h: 0, msaa: null, scene: null, bloomA: null, bloomB: null, depth: null, aoA: null, aoB: null, ao: 0.75, edges: 0.55, samples: 4, bloom: 0.18, exposure: 1.08, vignette: 0.18, sat: 0.96, tint: [1, 1, 1] };
  function makeDepthTarget(w, h) { const t = { w, h }; t.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); t.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t.tex, 0); t.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return t; }
  function makeTarget(w, h, samples, fmtOverride) {
    const fmt = fmtOverride || (post.hdr ? gl.RGBA16F : gl.RGBA8); const t = { w, h };
    t.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    if (samples > 0) {
      t.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, t.rb);
      t.db = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.db); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, t.db);
    } else {
      t.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); t.ok = ok; return t;
  }
  function destroyTarget(t) { if (!t) return; gl.deleteFramebuffer(t.fbo); if (t.rb) gl.deleteRenderbuffer(t.rb); if (t.db) gl.deleteRenderbuffer(t.db); if (t.tex) gl.deleteTexture(t.tex); }
  function ensureTargets(w, h) {
    if (post.w === w && post.h === h && post.msaa) return;
    destroyTarget(post.msaa); destroyTarget(post.scene); destroyTarget(post.bloomA); destroyTarget(post.bloomB); destroyTarget(post.depth); destroyTarget(post.aoA); destroyTarget(post.aoB);
    post.w = w; post.h = h;
    post.msaa = makeTarget(w, h, post.samples); post.scene = makeTarget(w, h, 0);
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2); post.bloomA = makeTarget(bw, bh, 0); post.bloomB = makeTarget(bw, bh, 0);
    post.depth = makeDepthTarget(w, h); const aw = Math.max(1, w >> 1), ah = Math.max(1, h >> 1); post.aoA = makeTarget(aw, ah, 0, gl.RGBA8); post.aoB = makeTarget(aw, ah, 0, gl.RGBA8);
    if (!post.msaa.ok || !post.scene.ok || !post.bloomA.ok) { post.enabled = false; console.warn('post-processing unavailable'); }
  }
  function init(canvas, textures) {
    gl = GL.init(canvas);
    post.hdr = !!gl.getExtension('EXT_color_buffer_float'); const maxS = gl.getParameter(gl.MAX_SAMPLES); post.samples = Math.min(4, maxS);
    brightProg = GL.program(QUAD_VS, BRIGHT_FS); blurProg = GL.program(QUAD_VS, BLUR_FS); compProg = GL.program(QUAD_VS, COMPOSITE_FS); aoProg = GL.program(QUAD_VS, AO_FS); aoBlurProg = GL.program(QUAD_VS, AOBLUR_FS);
    litProg = GL.program(VS, FS); instProg = GL.program(VS, FS, '#define INSTANCED'); litStaticProg = GL.program(VS, FS, '#define STATIC'); shadowStaticProg = GL.program(VS, SHADOW_FS, '#define STATIC\n#define SHADOW');
    shadowProg = GL.program(VS, SHADOW_FS, '#define SHADOW'); shadowInstProg = GL.program(VS, SHADOW_FS, '#define INSTANCED\n#define SHADOW');
    skyProg = GL.program(SKY_VS, SKY_FS); partProg = GL.program(PART_VS, PART_FS); flatProg = GL.program(FLAT_VS, FLAT_FS);
    const colorLayers = textures.color || textures, normalLayers = textures.normal;
    texArray = GL.textureArray(colorLayers);
    if (normalLayers && normalLayers.length === colorLayers.length) nrmArray = GL.textureArray(normalLayers);
    const pg = new Float32Array(128 * 4); (textures.panes || []).forEach((p, i) => { if (p && i < 128) pg.set(p, i * 4); });
    for (const P of [litProg, instProg, litStaticProg]) { gl.useProgram(P.p); gl.uniform4fv(P.u.uPanes, pg); }
    const shadowSize = +(new URLSearchParams(location.search).get('shadow') || 0) || 2048; shadow = GL.shadowTarget(shadowSize * 2, shadowSize);
    // particle buffer: pos3 size1 col4 = 8 floats
    partVao = gl.createVertexArray(); gl.bindVertexArray(partVao); partBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 8 * 4 * 4096, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(partProg.a.aPos); gl.vertexAttribPointer(partProg.a.aPos, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(partProg.a.aSize); gl.vertexAttribPointer(partProg.a.aSize, 1, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(partProg.a.aCol); gl.vertexAttribPointer(partProg.a.aCol, 4, gl.FLOAT, false, 32, 16);
    // flat buffer: pos3 col4 = 7 floats
    flatVao = gl.createVertexArray(); gl.bindVertexArray(flatVao); flatBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, flatBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 7 * 4 * 16384, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(flatProg.a.aPos); gl.vertexAttribPointer(flatProg.a.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(flatProg.a.aCol); gl.vertexAttribPointer(flatProg.a.aCol, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    gl.clearColor(0, 0, 0, 1);
  }
  function resize(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, post.dprCap || 1.5);
    const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  // ---- Time of day → environment
  function setTimeOfDay(hours, rain = 0, fog = 0) {
    const t = hours / 24; const sunAng = (t - 0.25) * M.TAU; // 6:00 sunrise at angle 0, noon at 90°
    const elev = Math.sin(sunAng), az = Math.cos(sunAng);
    let sx = az * 0.7, sy = elev, sz = -0.45 + 0.2 * az; let l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
    const day = M.clamp(elev * 4 + 0.15, 0, 1);          // 1 in daytime, 0 at night
    const dusk = M.clamp(1 - Math.abs(elev) * 5, 0, 1);  // 1 near horizon
    const night = 1 - day;
    if (sy > 0.02) env.sunDir = [sx, sy, sz]; else env.sunDir = [-sx * 0.5, Math.max(0.35, -sy), -sz * 0.5]; // moon-ish from the other side
    const mix3 = (a, b, k) => [M.lerp(a[0], b[0], k), M.lerp(a[1], b[1], k), M.lerp(a[2], b[2], k)];
    const sunDay = mix3([1.72, 1.49, 1.17], [1.45, 0.62, 0.24], dusk); const sunNight = [0.02, 0.025, 0.045];
    env.sunCol = mix3(sunNight, sunDay.map(v => v * 1.0), day);
    env.skyCol = mix3([0.03, 0.037, 0.07], mix3([0.48, 0.50, 0.56], [0.42, 0.26, 0.2], dusk), day);
    env.groundCol = mix3([0.014, 0.016, 0.024], mix3([0.23, 0.205, 0.175], [0.2, 0.12, 0.09], dusk), day);
    env.zenith = mix3([0.004, 0.006, 0.02], mix3([0.20, 0.37, 0.53], [0.15, 0.15, 0.4], dusk), day);
    env.horizon = mix3([0.012, 0.014, 0.03], mix3([0.64, 0.66, 0.65], [0.9, 0.4, 0.2], dusk), day);
    env.fogCol = mix3([0.01, 0.012, 0.024], mix3([0.56, 0.59, 0.60], [0.78, 0.4, 0.26], dusk), day);
    env.fogDensity = M.lerp(0.0032, 0.0022, day); env.fogHeight = M.lerp(22, 34, day); env.fogSun = 0.7 * day;
    env.nightEmis = M.clamp(night * 1.3, 0, 1); env.daylight = day; env.starAlpha = M.clamp(night * 1.2 - 0.2, 0, 1) * (1 - rain); env.sunDisc = sy > 0.02 ? (1 - rain) : 0;
    if (rain > 0) { // overcast: grey it all down, thicken the fog
      const grey = c => { const l = c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2; return [M.lerp(c[0], l * 0.85, rain * 0.8), M.lerp(c[1], l * 0.88, rain * 0.8), M.lerp(c[2], l * 0.95, rain * 0.8)]; };
      env.sunCol = env.sunCol.map(v => v * (1 - 0.75 * rain)); env.skyCol = grey(env.skyCol); env.zenith = grey(env.zenith).map(v => v * (1 - 0.35 * rain)); env.horizon = grey(env.horizon); env.fogCol = grey(env.fogCol); env.groundCol = grey(env.groundCol);
      env.fogDensity = M.lerp(env.fogDensity, 0.0075, rain); env.fogHeight = M.lerp(env.fogHeight, 60, rain); env.fogSun *= (1 - rain);
    }
    if (fog > 0) { env.fogDensity = M.lerp(env.fogDensity, 0.016, fog); env.fogHeight = M.lerp(env.fogHeight, 90, fog); env.fogSun *= (1 - fog); env.fogCol = env.fogCol.map((v, i) => M.lerp(v, [0.62, 0.66, 0.72][i] * (0.15 + 0.85 * day), fog)); env.sunCol = env.sunCol.map(v => v * (1 - 0.6 * fog)); env.sunDisc *= (1 - fog); env.horizon = env.horizon.map((v, i) => M.lerp(v, env.fogCol[i], fog)); }
    env.wet = Math.max(rain, (env.wet || 0) - 0.004); env.rain = rain; env.fog = fog; env.shadowOn = day > 0.15 && rain < 0.5 && fog < 0.6;
  }

  function setCamera(x, y, z, tx, ty, tz, fov) { cam.x = x; cam.y = y; cam.z = z; cam.tx = tx; cam.ty = ty; cam.tz = tz; if (fov) cam.fov = fov; }
  const CASCADE = [{ r: 34, ahead: 20 }, { r: 105, ahead: 52 }];
  const viewPlanes = new Float32Array(24); const cascadePlanes = [new Float32Array(24), new Float32Array(24)];
  const lightVPs = [M.create(), M.create()]; const lightAll = new Float32Array(32);
  let shadowPass = 1; // which cascade the shadow pass is drawing, for culling
  const inView = (x, y, z, r) => M.sphereInFrustum(viewPlanes, x, y, z, r);
  const inLight = (x, y, z, r) => M.sphereInFrustum(cascadePlanes[0], x, y, z, r) || M.sphereInFrustum(cascadePlanes[1], x, y, z, r);
  function beginFrame(canvas) {
    resize(canvas);
    M.perspective(proj, cam.fov, canvas.width / canvas.height, cam.near, cam.far);
    M.lookAt(view, cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, 0, 1, 0);
    M.multiply(vp, proj, view); M.invert(invVP, vp); M.invert(invProj, proj);
    // Two shadow cascades: a tight box just in front of the camera for crisp contact shadows, and a wide one
    // for everything else. Each centre is snapped to a shadow texel so the shadows do not crawl as you move.
    const fx = cam.tx - cam.x, fz = cam.tz - cam.z, fl = Math.hypot(fx, fz) || 1;
    const s = env.sunDir;
    for (let c = 0; c < 2; c++) {
      const R = c === 0 ? CASCADE[0].r : CASCADE[1].r, ahead = c === 0 ? CASCADE[0].ahead : CASCADE[1].ahead;
      const texel = 2 * R / shadow.h;
      let cx = cam.x + fx / fl * ahead, cz = cam.z + fz / fl * ahead;
      cx = Math.round(cx / texel) * texel; cz = Math.round(cz / texel) * texel;
      M.lookAt(lightView, cx + s[0] * 300, s[1] * 300, cz + s[2] * 300, cx, 0, cz, 0, 1, 0);
      M.ortho(lightProj, -R, R, -R, R, 1, 700); M.multiply(lightVPs[c], lightProj, lightView);
      lightAll.set(lightVPs[c], c * 16);
      M.frustumPlanes(cascadePlanes[c], lightVPs[c]);
    }
    M.frustumPlanes(viewPlanes, vp);
    stats.draws = 0; stats.tris = 0;
  }
  function setLights(list) {
    // list: [{x,y,z,r,col:[r,g,b]}] — nearest MAX_LIGHTS to the camera target win
    list.sort((a, b) => M.dist2(a.x, a.z, cam.tx, cam.tz) - M.dist2(b.x, b.z, cam.tx, cam.tz));
    const n = Math.min(list.length, MAX_LIGHTS); lights.n = n;
    for (let i = 0; i < n; i++) { const L = list[i]; lights.pos.set([L.x, L.y, L.z, L.r], i * 4); lights.col.set(L.col, i * 3); }
  }
  function bindCommon(P, forShadow) {
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, forShadow ? lightVPs[shadowPass] : vp);
    if (!forShadow) {
      gl.uniformMatrix4fv(P.u.uLightVP, false, lightAll); gl.uniform1f(P.u.uCascadeFar, CASCADE[0].r * 1.25);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArray); gl.uniform1i(P.u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadow.tex); gl.uniform1i(P.u.uShadow, 1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, nrmArray || texArray); gl.uniform1i(P.u.uNrm, 3);
      gl.uniform1f(P.u.uNrmOn, nrmArray && env.normalMaps ? 1 : 0); gl.uniform1f(P.u.uNrmStr, env.normalStrength); gl.uniform1f(P.u.uInterior, env.interiors === false ? 0 : 1);
      gl.uniform3fv(P.u.uSunDir, env.sunDir); gl.uniform3fv(P.u.uSunCol, env.sunCol); gl.uniform3fv(P.u.uSkyCol, env.skyCol); gl.uniform3fv(P.u.uGroundCol, env.groundCol);
      gl.uniform3fv(P.u.uFogCol, env.fogCol); gl.uniform3f(P.u.uCamPos, cam.x, cam.y, cam.z); gl.uniform1f(P.u.uFogDensity, env.fogDensity);
      gl.uniform1f(P.u.uFogHeight, env.fogHeight); gl.uniform1f(P.u.uFogSun, env.fogSun);
      gl.uniform3fv(P.u.uZenith, env.zenith); gl.uniform3fv(P.u.uHorizon, env.horizon); gl.uniform1f(P.u.uReflect, env.reflect); gl.uniform1f(P.u.uWet, env.wet);
      gl.uniform1f(P.u.uNightEmis, env.nightEmis); gl.uniform1f(P.u.uShadowOn, env.shadowOn ? 1 : 0); gl.uniform1f(P.u.uTexOn, 1); gl.uniform1f(P.u.uSpec, 0); gl.uniform1f(P.u.uHDR, post.hdr ? 1 : 0); gl.uniform1f(P.u.uAlpha, 1); gl.uniform1f(P.u.uWater, 0); gl.uniform1f(P.u.uTime, env.time || 0);
      gl.uniform4fv(P.u.uLights, lights.pos); gl.uniform3fv(P.u.uLightCols, lights.col); gl.uniform1i(P.u.uNumLights, lights.n);
    }
    gl.uniform2f(P.u.uUVOff, 0, 0);
  }
  // scene = { statics: [mesh], props: [instancedMesh], entities: [{mesh, model, bones?, emis?, uvOff?}] }
  function drawScene(scene, forShadow) {
    const P = forShadow ? shadowProg : litProg, PI = forShadow ? shadowInstProg : instProg, PS = forShadow ? shadowStaticProg : litStaticProg;
    // statics: no bones in the vertex shader, and a chunked mesh draws only the cells inside the camera's (or the light's) frustum
    bindCommon(PS, forShadow); gl.uniformMatrix4fv(PS.u.uModel, false, identityBones.subarray(0, 16));
    const planes = forShadow ? cascadePlanes[shadowPass] : viewPlanes;
    for (const m of scene.statics) { if (m.uvOff) gl.uniform2fv(PS.u.uUVOff, m.uvOff); const sp = m.water ? m.spec : (m.spec || 0.3) + (env.rain || 0) * 0.5; if (!forShadow) { gl.uniform1f(PS.u.uSpec, sp); gl.uniform1f(PS.u.uWater, m.water ? 1 : 0); }
      if (m.chunks) { for (const ch of m.chunks) if (M.aabbInFrustum(planes, ch.min, ch.max)) { GL.drawRange(m, ch.first, ch.count); stats.draws++; stats.tris += ch.count / 3; } } else { GL.draw(m); stats.draws++; stats.tris += m.count / 3; }
      if (m.uvOff) gl.uniform2f(PS.u.uUVOff, 0, 0); if (!forShadow) { gl.uniform1f(PS.u.uSpec, 0); gl.uniform1f(PS.u.uWater, 0); } }
    bindCommon(P, forShadow);
    gl.uniformMatrix4fv(P.u.uBones, false, identityBones); gl.uniform1fv(P.u.uBoneEmis, zeroEmis);
    let lastBones = null, lastSpec = 0;
    for (const e of scene.entities) {
      if (forShadow && e.noShadow) continue;
      gl.uniformMatrix4fv(P.u.uModel, false, e.model);
      if (e.bones) { gl.uniformMatrix4fv(P.u.uBones, false, e.bones); lastBones = e.bones; } else if (lastBones) { gl.uniformMatrix4fv(P.u.uBones, false, identityBones); lastBones = null; }
      if (!forShadow) { gl.uniform1fv(P.u.uBoneEmis, e.emis || zeroEmis); if ((e.spec || 0) !== lastSpec) { lastSpec = e.spec || 0; gl.uniform1f(P.u.uSpec, lastSpec); } }
      GL.draw(e.mesh); stats.draws++; stats.tris += e.mesh.count / 3;
    }
    bindCommon(PI, forShadow);
    for (const m of scene.props) { if (m.instances > 0 && !(forShadow && m.noShadow)) { GL.draw(m); stats.draws++; stats.tris += m.count / 3 * m.instances; } }
  }
  // Translucent car glass, drawn after everything opaque (and after occupants), sorted far to near.
  function drawGlass(scene) {
    const P = litProg; const list = scene.entities.filter(e => e.glass);
    if (!list.length) return;
    list.sort((a, b) => M.dist2(b.model[12], b.model[14], cam.x, cam.z) - M.dist2(a.model[12], a.model[14], cam.x, cam.z));
    bindCommon(P, false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1f(P.u.uAlpha, 0.55); gl.uniform1f(P.u.uSpec, 1.2); gl.uniformMatrix4fv(P.u.uBones, false, identityBones); gl.uniform1fv(P.u.uBoneEmis, zeroEmis);
    for (const e of list) { gl.uniformMatrix4fv(P.u.uModel, false, e.model); GL.draw(e.glass); stats.draws++; }
    gl.uniform1f(P.u.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function render(canvas, scene, time) {
    env.time = time;
    // Shadow pass
    if (env.shadowOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.fbo);
      gl.viewport(0, 0, shadow.w, shadow.h); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.cullFace(gl.FRONT); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      for (let c = 0; c < 2; c++) { shadowPass = c; gl.viewport(c * shadow.h, 0, shadow.h, shadow.h); drawScene(scene, true); }
      shadowPass = 1;
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.cullFace(gl.BACK);
    }
    if (post.enabled) ensureTargets(canvas.width, canvas.height);
    const usePost = post.enabled && post.msaa;
    gl.bindFramebuffer(gl.FRAMEBUFFER, usePost ? post.msaa.fbo : null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Sky
    gl.useProgram(skyProg.p); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(skyProg.u.uInvVP, false, invVP); gl.uniform3f(skyProg.u.uCamPos, cam.x, cam.y, cam.z); gl.uniform3fv(skyProg.u.uSunDir, env.sunDir);
    gl.uniform3fv(skyProg.u.uZenith, env.zenith); gl.uniform3fv(skyProg.u.uHorizon, env.horizon); gl.uniform3fv(skyProg.u.uSunCol, env.sunCol); gl.uniform1f(skyProg.u.uStars, env.starAlpha); gl.uniform1f(skyProg.u.uSunDisc, env.sunDisc); gl.uniform1f(skyProg.u.uTime, time); gl.uniform1f(skyProg.u.uCloud, env.rain || 0); gl.uniform1f(skyProg.u.uHDR, post.hdr ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    drawScene(scene, false);
    drawGlass(scene);
    // Flat FX (alpha blended triangles + lines), then particles
    gl.enable(gl.BLEND); gl.depthMask(false);
    if (scene.flat && scene.flat.count > 0) {
      gl.useProgram(flatProg.p); gl.uniformMatrix4fv(flatProg.u.uVP, false, vp);
      gl.bindVertexArray(flatVao); gl.bindBuffer(gl.ARRAY_BUFFER, flatBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, scene.flat.data, 0, scene.flat.count * 7);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (scene.flat.triCount) gl.drawArrays(gl.TRIANGLES, 0, scene.flat.triCount);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      if (scene.flat.addCount) gl.drawArrays(gl.TRIANGLES, scene.flat.triCount, scene.flat.addCount);
      if (scene.flat.lineCount) gl.drawArrays(gl.LINES, scene.flat.triCount + scene.flat.addCount, scene.flat.lineCount);
    }
    if (scene.particles && scene.particles.count > 0) {
      gl.useProgram(partProg.p); gl.uniformMatrix4fv(partProg.u.uVP, false, vp); gl.uniform3f(partProg.u.uCamPos, cam.x, cam.y, cam.z);
      gl.uniform1f(partProg.u.uScale, canvas.height * 0.9);
      gl.bindVertexArray(partVao); gl.bindBuffer(gl.ARRAY_BUFFER, partBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, scene.particles.data, 0, scene.particles.count * 8);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); if (scene.particles.alphaCount) gl.drawArrays(gl.POINTS, 0, scene.particles.alphaCount);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); if (scene.particles.addCount) gl.drawArrays(gl.POINTS, scene.particles.alphaCount, scene.particles.addCount);
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
    if (usePost) postProcess(canvas);
  }
  function postProcess(canvas) {
    const w = canvas.width, h = canvas.height;
    // resolve MSAA into the scene texture
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, post.msaa.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, post.scene.fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    const aoOn = post.ao > 0 && post.depth && post.depth.ok; const edgeOn = post.edges > 0 && post.depth && post.depth.ok;
    if (aoOn || edgeOn) { gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, post.depth.fbo); gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST); }
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    if (aoOn) {
      const aw = post.aoA.w, ah = post.aoA.h; gl.bindFramebuffer(gl.FRAMEBUFFER, post.aoA.fbo); gl.viewport(0, 0, aw, ah);
      gl.useProgram(aoProg.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.depth.tex); gl.uniform1i(aoProg.u.uDepth, 0);
      gl.uniformMatrix4fv(aoProg.u.uInvProj, false, invProj); gl.uniformMatrix4fv(aoProg.u.uProj, false, proj); gl.uniform2f(aoProg.u.uRes, aw, ah); gl.uniform1f(aoProg.u.uRadius, 1.1); gl.uniform1f(aoProg.u.uTime, env.time || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.aoB.fbo); gl.useProgram(aoBlurProg.p); gl.bindTexture(gl.TEXTURE_2D, post.aoA.tex); gl.uniform1i(aoBlurProg.u.uTex, 0); gl.uniform2f(aoBlurProg.u.uTexel, 1 / aw, 1 / ah); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // bright pass at quarter resolution
    const bw = post.bloomA.w, bh = post.bloomA.h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, post.bloomA.fbo); gl.viewport(0, 0, bw, bh);
    gl.useProgram(brightProg.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.scene.tex); gl.uniform1i(brightProg.u.uTex, 0); gl.uniform1f(brightProg.u.uThreshold, post.hdr ? 1.15 : 0.8);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(blurProg.p); gl.uniform1i(blurProg.u.uTex, 0);
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.bloomB.fbo); gl.bindTexture(gl.TEXTURE_2D, post.bloomA.tex); gl.uniform2f(blurProg.u.uDir, 1.5 / bw, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.bloomA.fbo); gl.bindTexture(gl.TEXTURE_2D, post.bloomB.tex); gl.uniform2f(blurProg.u.uDir, 0, 1.5 / bh); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // composite to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    gl.useProgram(compProg.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.scene.tex); gl.uniform1i(compProg.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, post.bloomA.tex); gl.uniform1i(compProg.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, aoOn ? post.aoB.tex : post.bloomA.tex); gl.uniform1i(compProg.u.uAO, 2); gl.uniform1f(compProg.u.uAOAmt, aoOn ? post.ao : 0);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, edgeOn ? post.depth.tex : post.bloomA.tex); gl.uniform1i(compProg.u.uDepth, 3); const px = Math.max(1, Math.round((canvas.width / (canvas.clientWidth || canvas.width)) * 0.85)); gl.uniform2f(compProg.u.uTexel, px / w, px / h); gl.uniform2f(compProg.u.uNF, cam.near, cam.far); gl.uniform1f(compProg.u.uEdge, edgeOn ? post.edges : 0);
    gl.uniform1f(compProg.u.uBloomAmt, post.bloom); gl.uniform1f(compProg.u.uExposure, post.exposure); gl.uniform1f(compProg.u.uHDR, post.hdr ? 1 : 0); gl.uniform1f(compProg.u.uVignette, post.vignette); gl.uniform1f(compProg.u.uSat, post.sat); gl.uniform3fv(compProg.u.uTint, post.tint);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
  // World → screen (pixels) for HUD labels. Returns null if behind the camera.
  const tmp = [0, 0, 0];
  function project(x, y, z, canvas) { M.transformPoint(tmp, vp, x, y, z); const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; if (w <= 0) return null; return [(tmp[0] * 0.5 + 0.5) * canvas.clientWidth, (0.5 - tmp[1] * 0.5) * canvas.clientHeight, w]; }
  return { post, init, cam, env, setTimeOfDay, setCamera, beginFrame, setLights, render, project, stats, inView, inLight, get gl() { return gl; }, MAX_BONES };
})();
