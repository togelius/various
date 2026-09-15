// GRIFT CITY — the renderer: one lit shader (shadowed sun + hemisphere + point lights + emissive windows + fog),
// a sky, a shadow pass, instanced props, point-sprite particles and a flat FX pass.
'use strict';
const RENDER = (() => {
  let gl, litProg, instProg, shadowProg, shadowInstProg, skyProg, partProg, flatProg, texArray, shadow;
  const MAX_LIGHTS = 32, MAX_BONES = 10;
  const proj = M.create(), view = M.create(), vp = M.create(), invVP = M.create(), lightVP = M.create(), lightView = M.create(), lightProj = M.create();
  const identityBones = new Float32Array(16 * MAX_BONES); for (let i = 0; i < MAX_BONES; i++) identityBones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
  const zeroEmis = new Float32Array(MAX_BONES);
  const cam = { x: 0, y: 20, z: 0, tx: 0, ty: 0, tz: 1, fov: 60 * Math.PI / 180, near: 0.3, far: 900 };
  const env = { sunDir: [0.3, 0.8, 0.5], sunCol: [1, 1, 1], skyCol: [0.5, 0.6, 0.7], groundCol: [0.3, 0.3, 0.3], fogCol: [0.7, 0.8, 0.9], fogDensity: 0.0016, nightEmis: 0, zenith: [0.2, 0.4, 0.8], horizon: [0.7, 0.8, 0.9], daylight: 1, starAlpha: 0, sunDisc: 1 };
  const lights = { pos: new Float32Array(MAX_LIGHTS * 4), col: new Float32Array(MAX_LIGHTS * 3), n: 0 };
  const stats = { draws: 0 };

  const VS = `
    in vec3 aPos; in vec3 aNrm; in vec3 aCol; in vec2 aUV; in float aTile; in float aBone;
    #ifdef INSTANCED
    in vec4 aI0; in vec4 aI1; in vec4 aI2; in vec4 aI3; in vec4 aTint;
    #endif
    uniform mat4 uVP; uniform mat4 uModel; uniform mat4 uLightVP; uniform mat4 uBones[${MAX_BONES}]; uniform float uBoneEmis[${MAX_BONES}]; uniform vec2 uUVOff;
    out vec3 vWorld; out vec3 vNrm; out vec3 vCol; out vec2 vUV; flat out float vTile; out vec4 vShadow; out float vEmis;
    void main() {
      #ifdef INSTANCED
      mat4 model = mat4(aI0, aI1, aI2, aI3); vCol = aCol * aTint.rgb; vEmis = aTint.a;
      #else
      mat4 model = uModel * uBones[int(aBone)]; vCol = aCol; vEmis = uBoneEmis[int(aBone)];
      #endif
      vec4 w = model * vec4(aPos, 1.0); vWorld = w.xyz; vNrm = normalize(mat3(model) * aNrm);
      vUV = aUV + uUVOff; vTile = aTile;
      vShadow = uLightVP * vec4(w.xyz + vNrm * 0.15, 1.0);
      gl_Position = uVP * w;
    }`;
  const FS = `
    in vec3 vWorld; in vec3 vNrm; in vec3 vCol; in vec2 vUV; flat in float vTile; in vec4 vShadow; in float vEmis;
    uniform sampler2DArray uTex; uniform sampler2DShadow uShadow;
    uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGroundCol; uniform vec3 uFogCol; uniform vec3 uCamPos;
    uniform float uFogDensity; uniform float uNightEmis; uniform float uShadowOn; uniform float uTexOn; uniform float uSpec;
    uniform vec4 uLights[${MAX_LIGHTS}]; uniform vec3 uLightCols[${MAX_LIGHTS}]; uniform int uNumLights;
    out vec4 o;
    float shadowAt() {
      vec3 p = vShadow.xyz / vShadow.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      p.z -= 0.0015;
      float s = textureOffset(uShadow, p, ivec2(-1, -1)) + textureOffset(uShadow, p, ivec2(0, -1)) + textureOffset(uShadow, p, ivec2(1, -1))
              + textureOffset(uShadow, p, ivec2(-1, 0)) + textureOffset(uShadow, p, ivec2(0, 0)) + textureOffset(uShadow, p, ivec2(1, 0))
              + textureOffset(uShadow, p, ivec2(-1, 1)) + textureOffset(uShadow, p, ivec2(0, 1)) + textureOffset(uShadow, p, ivec2(1, 1));
      return s / 9.0;
    }
    void main() {
      vec4 t = uTexOn > 0.5 ? texture(uTex, vec3(vUV, vTile)) : vec4(1.0);
      vec3 albedo = t.rgb * vCol;
      vec3 n = normalize(vNrm);
      float ndl = max(dot(n, uSunDir), 0.0);
      float sh = (uShadowOn > 0.5 && ndl > 0.0) ? shadowAt() : 1.0;
      vec3 hemi = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5);
      vec3 col = albedo * (hemi + uSunCol * ndl * sh);
      if (uSpec > 0.0) { vec3 v = normalize(uCamPos - vWorld); vec3 hv = normalize(uSunDir + v); float sp = pow(max(dot(n, hv), 0.0), 48.0); col += uSunCol * sp * uSpec * sh; col += hemi * uSpec * 0.6 * pow(1.0 - max(dot(n, v), 0.0), 3.0); }
      for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uNumLights) break;
        vec3 L = uLights[i].xyz - vWorld; float d = length(L); float att = clamp(1.0 - d / uLights[i].w, 0.0, 1.0); att *= att;
        if (att <= 0.0) continue;
        float nl = max(dot(n, L / d), 0.0) * 0.8 + 0.2;
        col += albedo * uLightCols[i] * att * nl;
      }
      col += mix(albedo, vec3(1.0, 0.85, 0.6), 0.6) * t.a * uNightEmis * 0.8;
      col += vCol * vEmis;
      float dist = length(vWorld - uCamPos);
      float f = 1.0 - exp(-dist * uFogDensity);
      col = mix(col, uFogCol, f);
      col = col / (1.0 + col * 0.15);
      o = vec4(pow(col, vec3(1.0 / 1.25)), 1.0);
    }`;
  const SHADOW_FS = `out vec4 o; void main() { o = vec4(1.0); }`;
  const SKY_VS = `const vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)); out vec2 vNdc; void main() { vNdc = v[gl_VertexID]; gl_Position = vec4(v[gl_VertexID], 0.9999, 1.0); }`;
  const SKY_FS = `
    in vec2 vNdc; uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform float uStars; uniform float uSunDisc; uniform float uTime;
    out vec4 o;
    float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; } return v; }
    void main() {
      vec4 a = uInvVP * vec4(vNdc, 1.0, 1.0); vec3 dir = normalize(a.xyz / a.w - uCamPos);
      float h = clamp(dir.y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
      float sd = max(dot(dir, uSunDir), 0.0);
      col += uSunCol * (pow(sd, 256.0) * 2.0 * uSunDisc + pow(sd, 8.0) * 0.25 * uSunDisc);
      // stars
      if (uStars > 0.0 && dir.y > 0.0) { vec3 g = floor(dir * 180.0); float s = hash(g); float twinkle = 0.7 + 0.3 * sin(uTime * 3.0 + s * 50.0); if (s > 0.985) col += vec3(0.8, 0.85, 1.0) * uStars * twinkle * (s - 0.985) * 60.0 * h; }
      // moon at night: opposite the sun
      float md = max(dot(dir, -uSunDir * vec3(1.0, -1.0, 1.0)), 0.0);
      col += vec3(0.7, 0.75, 0.85) * pow(md, 900.0) * uStars * 1.5;
      // clouds: a noise sheet at a fixed height, fading toward the horizon
      if (dir.y > 0.02) { vec2 cp = (uCamPos.xz + dir.xz / dir.y * 900.0) * 0.0009 + vec2(uTime * 0.004, 0.0); float c = fbm(cp); float cov = smoothstep(0.52, 0.72, c) * smoothstep(0.02, 0.2, dir.y);
        vec3 cloudCol = mix(uHorizon * 0.9, vec3(1.0), 0.6) * (0.55 + 0.45 * uSunDisc) * (uStars > 0.5 ? 0.25 : 1.0); col = mix(col, cloudCol, cov * 0.85); }
      // low haze band near horizon at night
      col = mix(col, uHorizon, (1.0 - h) * 0.15);
      o = vec4(pow(col, vec3(1.0 / 1.25)), 1.0);
    }`;
  const PART_VS = `in vec3 aPos; in float aSize; in vec4 aCol; uniform mat4 uVP; uniform vec3 uCamPos; uniform float uScale; out vec4 vCol;
    void main() { gl_Position = uVP * vec4(aPos, 1.0); float d = max(gl_Position.w, 0.1); gl_PointSize = clamp(aSize * uScale / d, 1.0, 256.0); vCol = aCol; }`;
  const PART_FS = `in vec4 vCol; out vec4 o; void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard; float a = smoothstep(1.0, 0.2, r); o = vec4(vCol.rgb, vCol.a * a); }`;
  const FLAT_VS = `in vec3 aPos; in vec4 aCol; uniform mat4 uVP; out vec4 vCol; void main() { gl_Position = uVP * vec4(aPos, 1.0); vCol = aCol; }`;
  const FLAT_FS = `in vec4 vCol; out vec4 o; void main() { o = vCol; }`;

  let partVao, partBuf, flatVao, flatBuf;
  function init(canvas, textures) {
    gl = GL.init(canvas);
    litProg = GL.program(VS, FS); instProg = GL.program(VS, FS, '#define INSTANCED');
    shadowProg = GL.program(VS, SHADOW_FS, '#define SHADOW'); shadowInstProg = GL.program(VS, SHADOW_FS, '#define INSTANCED\n#define SHADOW');
    skyProg = GL.program(SKY_VS, SKY_FS); partProg = GL.program(PART_VS, PART_FS); flatProg = GL.program(FLAT_VS, FLAT_FS);
    texArray = GL.textureArray(textures);
    shadow = GL.shadowTarget(2048);
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
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  // ---- Time of day → environment
  function setTimeOfDay(hours) {
    const t = hours / 24; const sunAng = (t - 0.25) * M.TAU; // 6:00 sunrise at angle 0, noon at 90°
    const elev = Math.sin(sunAng), az = Math.cos(sunAng);
    let sx = az * 0.7, sy = elev, sz = -0.45 + 0.2 * az; let l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
    const day = M.clamp(elev * 4 + 0.15, 0, 1);          // 1 in daytime, 0 at night
    const dusk = M.clamp(1 - Math.abs(elev) * 5, 0, 1);  // 1 near horizon
    const night = 1 - day;
    if (sy > 0.02) env.sunDir = [sx, sy, sz]; else env.sunDir = [-sx * 0.5, Math.max(0.35, -sy), -sz * 0.5]; // moon-ish from the other side
    const mix3 = (a, b, k) => [M.lerp(a[0], b[0], k), M.lerp(a[1], b[1], k), M.lerp(a[2], b[2], k)];
    const sunDay = mix3([1.0, 0.96, 0.88], [1.0, 0.55, 0.25], dusk); const sunNight = [0.10, 0.12, 0.2];
    env.sunCol = mix3(sunNight, sunDay.map(v => v * 1.15), day);
    env.skyCol = mix3([0.11, 0.13, 0.21], mix3([0.42, 0.52, 0.68], [0.5, 0.35, 0.3], dusk), day);
    env.groundCol = mix3([0.06, 0.065, 0.085], mix3([0.28, 0.26, 0.24], [0.3, 0.2, 0.15], dusk), day);
    env.zenith = mix3([0.02, 0.03, 0.08], mix3([0.2, 0.42, 0.85], [0.25, 0.25, 0.5], dusk), day);
    env.horizon = mix3([0.08, 0.09, 0.16], mix3([0.72, 0.8, 0.9], [0.95, 0.5, 0.3], dusk), day);
    env.fogCol = mix3([0.06, 0.07, 0.12], mix3([0.7, 0.78, 0.88], [0.85, 0.5, 0.35], dusk), day);
    env.fogDensity = M.lerp(0.0028, 0.0016, day);
    env.nightEmis = M.clamp(night * 1.3, 0, 1); env.daylight = day; env.starAlpha = M.clamp(night * 1.2 - 0.2, 0, 1); env.sunDisc = sy > 0.02 ? 1 : 0;
    env.shadowOn = day > 0.15;
  }

  function setCamera(x, y, z, tx, ty, tz, fov) { cam.x = x; cam.y = y; cam.z = z; cam.tx = tx; cam.ty = ty; cam.tz = tz; if (fov) cam.fov = fov; }
  function beginFrame(canvas) {
    resize(canvas);
    M.perspective(proj, cam.fov, canvas.width / canvas.height, cam.near, cam.far);
    M.lookAt(view, cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, 0, 1, 0);
    M.multiply(vp, proj, view); M.invert(invVP, vp);
    // Shadow frustum: ortho box around the area in front of the camera.
    const fx = cam.tx - cam.x, fz = cam.tz - cam.z, fl = Math.hypot(fx, fz) || 1;
    const cx = cam.x + fx / fl * 45, cz = cam.z + fz / fl * 45, R = 95;
    const s = env.sunDir;
    M.lookAt(lightView, cx + s[0] * 300, s[1] * 300, cz + s[2] * 300, cx, 0, cz, 0, 1, 0);
    M.ortho(lightProj, -R, R, -R, R, 1, 700); M.multiply(lightVP, lightProj, lightView);
    stats.draws = 0;
  }
  function setLights(list) {
    // list: [{x,y,z,r,col:[r,g,b]}] — nearest MAX_LIGHTS to the camera target win
    list.sort((a, b) => M.dist2(a.x, a.z, cam.tx, cam.tz) - M.dist2(b.x, b.z, cam.tx, cam.tz));
    const n = Math.min(list.length, MAX_LIGHTS); lights.n = n;
    for (let i = 0; i < n; i++) { const L = list[i]; lights.pos.set([L.x, L.y, L.z, L.r], i * 4); lights.col.set(L.col, i * 3); }
  }
  function bindCommon(P, forShadow) {
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, forShadow ? lightVP : vp);
    if (!forShadow) {
      gl.uniformMatrix4fv(P.u.uLightVP, false, lightVP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texArray); gl.uniform1i(P.u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadow.tex); gl.uniform1i(P.u.uShadow, 1);
      gl.uniform3fv(P.u.uSunDir, env.sunDir); gl.uniform3fv(P.u.uSunCol, env.sunCol); gl.uniform3fv(P.u.uSkyCol, env.skyCol); gl.uniform3fv(P.u.uGroundCol, env.groundCol);
      gl.uniform3fv(P.u.uFogCol, env.fogCol); gl.uniform3f(P.u.uCamPos, cam.x, cam.y, cam.z); gl.uniform1f(P.u.uFogDensity, env.fogDensity);
      gl.uniform1f(P.u.uNightEmis, env.nightEmis); gl.uniform1f(P.u.uShadowOn, env.shadowOn ? 1 : 0); gl.uniform1f(P.u.uTexOn, 1); gl.uniform1f(P.u.uSpec, 0);
      gl.uniform4fv(P.u.uLights, lights.pos); gl.uniform3fv(P.u.uLightCols, lights.col); gl.uniform1i(P.u.uNumLights, lights.n);
    }
    gl.uniform2f(P.u.uUVOff, 0, 0);
  }
  // scene = { statics: [mesh], props: [instancedMesh], entities: [{mesh, model, bones?, emis?, uvOff?}] }
  function drawScene(scene, forShadow) {
    const P = forShadow ? shadowProg : litProg, PI = forShadow ? shadowInstProg : instProg;
    bindCommon(P, forShadow);
    gl.uniformMatrix4fv(P.u.uBones, false, identityBones); gl.uniform1fv(P.u.uBoneEmis, zeroEmis);
    gl.uniformMatrix4fv(P.u.uModel, false, identityBones.subarray(0, 16));
    for (const m of scene.statics) { if (m.uvOff) gl.uniform2fv(P.u.uUVOff, m.uvOff); GL.draw(m); stats.draws++; if (m.uvOff) gl.uniform2f(P.u.uUVOff, 0, 0); }
    let lastBones = null, lastSpec = 0;
    for (const e of scene.entities) {
      if (forShadow && e.noShadow) continue;
      gl.uniformMatrix4fv(P.u.uModel, false, e.model);
      if (e.bones) { gl.uniformMatrix4fv(P.u.uBones, false, e.bones); lastBones = e.bones; } else if (lastBones) { gl.uniformMatrix4fv(P.u.uBones, false, identityBones); lastBones = null; }
      if (!forShadow) { gl.uniform1fv(P.u.uBoneEmis, e.emis || zeroEmis); if ((e.spec || 0) !== lastSpec) { lastSpec = e.spec || 0; gl.uniform1f(P.u.uSpec, lastSpec); } }
      GL.draw(e.mesh); stats.draws++;
    }
    bindCommon(PI, forShadow);
    for (const m of scene.props) { if (m.instances > 0) { GL.draw(m); stats.draws++; } }
  }
  function render(canvas, scene, time) {
    // Shadow pass
    if (env.shadowOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.fbo); gl.viewport(0, 0, shadow.size, shadow.size);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.cullFace(gl.FRONT); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      drawScene(scene, true);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.cullFace(gl.BACK);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Sky
    gl.useProgram(skyProg.p); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(skyProg.u.uInvVP, false, invVP); gl.uniform3f(skyProg.u.uCamPos, cam.x, cam.y, cam.z); gl.uniform3fv(skyProg.u.uSunDir, env.sunDir);
    gl.uniform3fv(skyProg.u.uZenith, env.zenith); gl.uniform3fv(skyProg.u.uHorizon, env.horizon); gl.uniform3fv(skyProg.u.uSunCol, env.sunCol); gl.uniform1f(skyProg.u.uStars, env.starAlpha); gl.uniform1f(skyProg.u.uSunDisc, env.sunDisc); gl.uniform1f(skyProg.u.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    drawScene(scene, false);
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
  }
  // World → screen (pixels) for HUD labels. Returns null if behind the camera.
  const tmp = [0, 0, 0];
  function project(x, y, z, canvas) { M.transformPoint(tmp, vp, x, y, z); const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; if (w <= 0) return null; return [(tmp[0] * 0.5 + 0.5) * canvas.clientWidth, (0.5 - tmp[1] * 0.5) * canvas.clientHeight, w]; }
  return { init, cam, env, setTimeOfDay, setCamera, beginFrame, setLights, render, project, stats, get gl() { return gl; }, MAX_BONES };
})();
