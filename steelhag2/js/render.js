// STÅLHAGEN II — the renderer. One lit shader (a faint shadowed sun, a large hemisphere, up to twelve lamps and
// torches, charge glowing along seams, retroreflectors, height fog pulled toward the haze), a painted sky, snow as
// point sprites, and a composite pass with grain and a vignette. Overcast light is a lighting choice, not a polygon count.
'use strict';
const RENDER = (() => {
  let foliageTex,skyTexture,iceTexture,woodTexture,woodReady=false,foliageReady=false,skyReady=false,iceReady=false;
  let gl, litProg, instProg, shadowProg, shadowInstProg, skyProg, partProg, compProg, shadow, scene = null, partMesh = null;
  const MAX_BONES = 32, MAX_LIGHTS = 12;
  const proj = M.create(), view = M.create(), vp = M.create(), invVP = M.create(), lightVP = M.create(), lightView = M.create(), lightProj = M.create();
  const identityBones = new Float32Array(16 * MAX_BONES); for (let i = 0; i < MAX_BONES; i++) identityBones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
  const zeroFx = new Float32Array(4 * MAX_BONES);
  const cam = { x: 0, y: 2, z: 0, tx: 0, ty: 2, tz: 1, fov: 55 * Math.PI / 180, near: 0.15, far: 1400 };
  const env = {
    sunDir: [0.3, 0.5, 0.6], sunCol: [0.35, 0.34, 0.32], skyCol: [0.62, 0.66, 0.7], groundCol: [0.5, 0.52, 0.55],
    fogCol: [0.8, 0.81, 0.8], fogDensity: 0.0035, fogHeight: 40, zenith: [0.45, 0.52, 0.6], horizon: [0.84, 0.84, 0.82],
    sunGlow: 0.5, sunDisc: 0.3, cloud: 0.7, cloudCol: [0.6, 0.64, 0.68], stars: 0, shadowOn: true, time: 0, iceGlow: 0, exposure: 1.0, grain: 0.012, vignette: 0.16, sat: 1.0, darkAdapt: 1.0, reduce: 0,
  };
  const lights = { data: new Float32Array(MAX_LIGHTS * 12), n: 0 };
  const stats = { draws: 0, triangles:0 };
  const contacts = new Float32Array(8 * 4); let contactCount = 0;
  function contact(x,y,z,r) { if(contactCount < 8) contacts.set([x,y,z,r], contactCount++ * 4); }
  const planes = new Float32Array(24);

  const VS = `
    in vec3 aPos; in vec3 aNrm; in vec3 aCol; in vec2 aUV; in float aTile; in float aBone;
    #ifdef INSTANCED
    in vec4 aI0; in vec4 aI1; in vec4 aI2; in vec4 aI3;
    #endif
    uniform vec3 uCamPos; uniform mat4 uVP; uniform mat4 uModel; uniform mat4 uBones[${MAX_BONES}]; uniform vec4 uFx[${MAX_BONES}];
    out vec3 vWorld; out vec3 vNrm; out vec3 vCol; out vec2 vUV; out float vTile; out float vCharge;
    void main() {
      #ifdef INSTANCED
      mat4 model = mat4(aI0, aI1, aI2, aI3); vCharge = 0.0; float hidden = 0.0;
      #else
      int b = int(aBone); mat4 model = uModel * uBones[b]; vCharge = uFx[b].x; float hidden = uFx[b].y;
      #endif
      vec4 w = model * vec4(aPos, 1.0);
      if(int(aTile+.5)==${MAT.FOLIAGE}){vec3 center=model[3].xyz;vec3 facing=uCamPos-center;vec3 right=normalize(vec3(facing.z,0.0,-facing.x));float scale=length(model[0].xyz);w.xyz=center+right*aPos.x*scale+vec3(0.0,aPos.y*scale,0.0);}
      vWorld = w.xyz; vNrm = normalize(mat3(model) * aNrm);
      vCol = aCol; vUV = aUV; vTile = aTile;
      gl_Position = hidden > 0.5 ? vec4(0.0, 0.0, 3.0, 1.0) : uVP * w;
    }`;
  const FS = `
    in vec3 vWorld; in vec3 vNrm; in vec3 vCol; in vec2 vUV; in float vTile; in float vCharge;
    uniform sampler2D uWoodTexture; uniform float uWoodReady; uniform sampler2D uIceTexture; uniform float uIceReady; uniform sampler2D uFoliage; uniform sampler2DArray uTex; uniform sampler2DShadow uShadow; uniform mat4 uLightVP; uniform vec4 uMat[${MATS}];
    uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGroundCol; uniform vec3 uFogCol; uniform vec3 uCamPos;
    uniform float uFogDensity; uniform float uFogHeight; uniform float uShadowOn; uniform float uTime; uniform float uIceGlow; uniform float uAlpha; uniform float uEmisMul;
    uniform vec4 uLights[${MAX_LIGHTS * 3}]; uniform int uNL;
    uniform vec4 uContacts[8]; uniform int uNC;
    out vec4 o;
    float shadowAt(vec3 n) {
      vec4 lp = uLightVP * vec4(vWorld + n * 0.06, 1.0); vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      float s = 0.0; float t = 2.5 / 1024.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uShadow, vec3(p.xy + vec2(float(x), float(y)) * t, p.z - 0.0015));
      return s / 9.0;
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      int tile = int(vTile + 0.5); vec4 m = uMat[tile];
      if(tile==${MAT.PATH}){float edge=1.0-smoothstep(.42,1.0,abs(vUV.x)+vnoise(vWorld.xz*4.0)*.18);float mottling=.65+.35*vnoise(vWorld.xz*2.2);o=vec4(.16,.19,.22,edge*mottling*.13*uAlpha);return;}
      if(tile == ${MAT.TRACK}) { float edge=1.0-smoothstep(0.30,1.0,dot(vUV,vUV)); o=vec4(0.045,0.065,0.09,edge*0.22); return; }
      vec4 tx = tile==${MAT.FOLIAGE}?texture(uFoliage,vUV):texture(uTex, vec3(vUV, vTile));
      if(tile==${MAT.FOLIAGE}&&tx.a<.48)discard;
      if(vTile<1.001){float mixIce=clamp(vTile,0.0,1.0);tx=mix(texture(uTex,vec3(vUV,0.0)),texture(uTex,vec3(vUV,1.0)),mixIce);m=mix(uMat[0],uMat[1],mixIce);}
      if(vTile<1.001&&uIceReady>.5){
        vec2 uv=vWorld.xz*.065;vec3 frost=texture(uIceTexture,uv).rgb;
        // Two world scales hide obvious repetition, with the fine layer kept quiet.
        frost=mix(frost,texture(uIceTexture,uv*.371+vec2(.31,.71)).rgb,.32);
        tx.rgb=mix(tx.rgb,mix(vec3(.64,.70,.74),frost,.64),clamp(vTile,0.0,1.0));
      }
      if(tile==${MAT.RED}&&uWoodReady>.5){vec2 woodUV=vec2(abs(vNrm.x)>.5?vWorld.z:vWorld.x,vWorld.y)*vec2(.43,.34);tx.rgb=texture(uWoodTexture,woodUV).rgb;}
      // Canvas colours and vertex tints are authored in sRGB. Light in linear space.
      vec3 albedo = pow(max(tx.rgb * vCol, vec3(0.0)), vec3(2.2));
      vec3 n = normalize(vNrm); vec3 v = normalize(uCamPos - vWorld);
      if (!gl_FrontFacing) n = -n;
      float ndl = max(dot(n, uSunDir), 0.0);
      float sh = (uShadowOn > 0.5 && ndl > 0.0) ? shadowAt(n) : 1.0;
      vec3 hemi = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5);
      // Broad weathering and wind-scoured snow, independent of the small repeating tile.
      if (tile == ${MAT.SNOW} || tile == ${MAT.ICE}) {
        float banks = vnoise(vWorld.xz * 0.035 + vec2(17.0, 8.0));
        float wind = vnoise(vWorld.xz * vec2(0.045, 0.38));
        albedo *= 0.88 + 0.12 * banks + 0.04 * wind;
        if (tile == ${MAT.ICE}) {
          float cover = smoothstep(0.43, 0.72, banks * 0.7 + wind * 0.3);
          albedo = mix(albedo * vec3(0.80, 0.88, 0.92), vec3(0.43, 0.49, 0.51), cover * 0.25);
        }
      }
      hemi *= 0.65 + 0.35 * smoothstep(-0.5, 0.9, n.y);
      float contactAO = 1.0;
      if (n.y > 0.45) for(int i=0;i<8;i++) {
        if(i>=uNC) break;
        vec4 c=uContacts[i]; float dy=abs(vWorld.y-c.y);
        float radial=length(vWorld.xz-c.xz)/c.w;
        contactAO *= 1.0-0.68*exp(-radial*radial*2.4)*(1.0-smoothstep(0.03,0.50,dy));
      }
      vec3 col = albedo * (hemi * contactAO + uSunCol * ndl * sh);
      if(tile==${MAT.FOLIAGE})col=albedo*(uSkyCol*.9+uGroundCol*.25+uSunCol*.2);
      float gloss = 1.0 - m.x;
      // a little sky reflection on smooth things (ice, glass, foil)
      col += hemi * gloss * 0.35 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
      for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uNL) break;
        vec4 P = uLights[i * 3]; vec4 C = uLights[i * 3 + 1]; vec4 D = uLights[i * 3 + 2];
        vec3 L = P.xyz - vWorld; float d = length(L); L /= max(d, 1e-3);
        float att = pow(clamp(1.0 - d / P.w, 0.0, 1.0), 2.0);
        if (D.w > -0.99) { float cs = dot(-L, D.xyz); att *= smoothstep(D.w, D.w + 0.12, cs); }
        float nl = max(dot(n, L), 0.0);
        vec3 h = normalize(L + v);
        float spec = pow(max(dot(n, h), 0.0), 8.0 + gloss * 80.0) * (0.15 + gloss * 0.7);
        col += C.rgb * att * (albedo * nl + spec * nl);
        // retroreflectors light only where the beam comes from the eye
        if (m.y > 0.5) { float eye = clamp(1.0 - distance(P.xyz, uCamPos) / 1.6, 0.0, 1.0); col += C.rgb * att * eye * 2.5 * pow(max(dot(L, v), 0.0), 6.0); }
      }
      // emission: lit windows, lamps, LEDs
      col += albedo * m.z * uEmisMul;
      // the charge: blue light breathing along the seams
      if (m.w > 0.5 && vCharge > 0.0) { float seam = 1.0 - tx.a; float pulse = 0.55 + 0.45 * sin(uTime * 1.6 - (vUV.x + vUV.y) * 3.0); col += vec3(0.25, 0.65, 1.0) * seam * vCharge * pulse * 2.2; }
      // under-ice light on the bay
      if (tile == ${MAT.ICE} && uIceGlow > 0.0) { float g = vnoise(vWorld.xz * 0.15 + uTime * 0.03) * vnoise(vWorld.xz * 0.6 - uTime * 0.02); col += vec3(0.2, 0.5, 1.0) * uIceGlow * smoothstep(0.35, 0.7, g) * 0.6; }
      // height fog toward the haze
      vec3 toCam = uCamPos - vWorld; float dist = length(toCam);
      float h0 = vWorld.y, h1 = uCamPos.y, invH = 1.0 / uFogHeight;
      float integral = abs(h1 - h0) < 0.5 ? exp(-max(h0, 0.0) * invH) : (exp(-max(h0, 0.0) * invH) - exp(-max(h1, 0.0) * invH)) / ((max(h1, 0.0) - max(h0, 0.0)) * invH + 1e-4);
      float f = 1.0 - exp(-dist * uFogDensity * clamp(integral, 0.0, 1.5));
      col = mix(col, uFogCol, clamp(f, 0.0, 1.0));
      o = vec4(col, uAlpha);
    }`;
  const SHADOW_FS = `out vec4 o; void main() { o = vec4(1.0); }`;
  const SKY_VS = `const vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)); out vec2 vNdc; void main() { vNdc = v[gl_VertexID]; gl_Position = vec4(v[gl_VertexID], 0.9999, 1.0); }`;
  const SKY_FS = `
    uniform sampler2D uSkyTexture; uniform float uSkyReady; in vec2 vNdc; uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uFogCol; uniform vec3 uCloudCol;
    uniform float uSunGlow; uniform float uSunDisc; uniform float uCloud; uniform float uStars; uniform float uTime; out vec4 o;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
    void main() {
      vec4 w = uInvVP * vec4(vNdc, 1.0, 1.0); vec3 dir = normalize(w.xyz / w.w - uCamPos);
      float h = clamp(dir.y, -0.05, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.55));
      // long brush drags across the sky
      vec2 sp = vec2(atan(dir.x, dir.z) * 2.0, h * 6.0);
      col *= 0.97 + 0.06 * vnoise(sp * vec2(3.0, 20.0));
      // a layer of stratus, thin toward the horizon
      float cl = fbm(vec2(dir.x, dir.z) / max(dir.y, 0.08) * 0.9 + uTime * 0.004);
      float cov = smoothstep(0.42, 0.72, cl) * uCloud * smoothstep(0.0, 0.25, h);
      col = mix(col, uCloudCol, cov * 0.85);
      // the sun as a glow behind the cloud, and a soft disc
      float sd = max(dot(dir, uSunDir), 0.0);
      col += vec3(1.0, 0.95, 0.85) * uSunGlow * pow(sd, 12.0) * 0.6;
      col += vec3(1.0, 0.97, 0.9) * uSunDisc * smoothstep(0.9985, 0.9995, sd) * 1.5;
      col += vec3(1.0, 0.9, 0.7) * uSunGlow * pow(sd, 3.0) * 0.12;
      if (uStars > 0.0 && dir.y > 0.0) { vec3 g = floor(dir * 220.0); float s = hash(g.xz * 0.37 + g.y); float tw = 0.7 + 0.3 * sin(uTime * 2.0 + s * 40.0); if (s > 0.992) col += vec3(0.8, 0.85, 1.0) * uStars * tw * (s - 0.992) * 90.0 * h; }
      if(uSkyReady>.5){vec2 uv=vec2(fract(atan(dir.x,dir.z)/6.2831853+.5+uTime*.00006),.5-asin(clamp(dir.y,-1.0,1.0))/3.14159265);vec3 painted=pow(texture(uSkyTexture,uv).rgb,vec3(2.2));col=mix(col,painted*(.85-uStars*.70),.84);}
      // the sky meets the fog at the horizon
      col = mix(col, uFogCol, smoothstep(0.12, -0.05, dir.y));
      o = vec4(col, 1.0);
    }`;
  const PART_VS = `in vec3 aPos; in float aSize; in float aAlpha; uniform mat4 uVP; uniform float uScale; out float vA;
    void main() { gl_Position = uVP * vec4(aPos, 1.0); float d = max(gl_Position.w, 0.1); gl_PointSize = clamp(aSize * uScale / d, 1.0, 7.0); vA = aAlpha * clamp(1.0 - d / 90.0, 0.0, 1.0); }`;
  const PART_FS = `in float vA; uniform vec3 uCol; out vec4 o; void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard; o = vec4(uCol, vA * smoothstep(1.0, 0.3, r)); }`;
  const QUAD_VS = `const vec2 v[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)); out vec2 vUV; void main() { vUV = v[gl_VertexID] * 0.5 + 0.5; gl_Position = vec4(v[gl_VertexID], 0.0, 1.0); }`;
  const COMP_FS = `
    in vec2 vUV; uniform sampler2D uTex; uniform float uExposure; uniform float uGrain; uniform float uVignette; uniform float uSat; uniform float uTime; uniform vec2 uRes; uniform float uPrint; out vec4 o;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      // Small contrast-aware resolve: soften stair steps without blurring the whole image.
      vec2 px=1.0/uRes;
      vec3 center=texture(uTex,vUV).rgb;
      vec3 north=texture(uTex,vUV+vec2(0,px.y)).rgb, south=texture(uTex,vUV-vec2(0,px.y)).rgb;
      vec3 east=texture(uTex,vUV+vec2(px.x,0)).rgb, west=texture(uTex,vUV-vec2(px.x,0)).rgb;
      vec3 lum=vec3(.2126,.7152,.0722);
      float ln=dot(north,lum),ls=dot(south,lum),le=dot(east,lum),lw=dot(west,lum),lc=dot(center,lum);
      float contrast=max(max(ln,ls),max(le,lw))-min(min(ln,ls),min(le,lw));
      vec3 resolve=abs(ln-ls)>abs(le-lw)?(east+west)*.5:(north+south)*.5;
      vec3 c=mix(center,resolve,smoothstep(.035,.18,contrast)*.32)*uExposure;
      // a gentle shoulder so lamps and the sun do not clip
      c = max(c - 0.006, 0.0);
      c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
      float l = dot(c, vec3(0.3, 0.55, 0.15)); c = mix(vec3(l), c, uSat);
      vec2 d = vUV - 0.5; c *= 1.0 - uVignette * dot(d, d) * 2.2;
      float g = hash(floor(vUV * uRes * 0.5) + fract(uTime * 7.3) * 100.0) - 0.5;
      // Grain is added in display space below; linear-space noise crushes dark cloth.
      if (uPrint > 0.5) { c = mix(c, c * vec3(1.05, 0.98, 0.9), 0.5); c = mix(vec3(l), c, 0.85); float edge = smoothstep(0.0, 0.03, min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y))); c = mix(vec3(0.95, 0.93, 0.88), c, edge); /* Print grain stays in display space, preserving shadow detail. */ }
      o = vec4(clamp(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)) + g * (uGrain + uPrint * 0.009), 0.0, 1.0), 1.0);
    }`;

  function init(canvas) {
    gl = GL.init(canvas);
    litProg = GL.program(VS, FS); instProg = GL.program(VS, FS, '#define INSTANCED');
    shadowProg = GL.program(VS, SHADOW_FS); shadowInstProg = GL.program(VS, SHADOW_FS, '#define INSTANCED');
    skyProg = GL.program(SKY_VS, SKY_FS); compProg = GL.program(QUAD_VS, COMP_FS);
    // particle program has its own attribute names on locations 0..2
    partProg = (() => { const p = gl.createProgram(); const h = '#version 300 es\n';
      const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, h + PART_VS); gl.compileShader(vs);
      const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, h + 'precision highp float;\n' + PART_FS); gl.compileShader(fs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs)); if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(fs));
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aSize'); gl.bindAttribLocation(p, 2, 'aAlpha'); gl.linkProgram(p);
      const u = {}; ['uVP', 'uScale', 'uCol'].forEach(n => u[n] = gl.getUniformLocation(p, n)); return { p, u }; })();
    shadow = GL.shadowTarget(1024);
    Paint.build();
    foliageTex=GL.texture2D(makeCanvas(1,1));
    const foliageImage=new Image();foliageImage.onload=()=>{gl.deleteTexture(foliageTex);foliageTex=GL.texture2D(foliageImage);gl.bindTexture(gl.TEXTURE_2D,foliageTex);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);foliageReady=true;};foliageImage.src=FOLIAGE_IMAGE;
    woodTexture=GL.texture2D(makeCanvas(1,1));const woodImage=new Image();woodImage.onload=()=>{gl.deleteTexture(woodTexture);woodTexture=GL.texture2D(woodImage);gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.MIRRORED_REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);woodReady=true;};woodImage.src=WOOD_IMAGE;
    iceTexture=GL.texture2D(makeCanvas(1,1));const iceImage=new Image();iceImage.onload=()=>{gl.deleteTexture(iceTexture);iceTexture=GL.texture2D(iceImage);gl.bindTexture(gl.TEXTURE_2D,iceTexture);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.MIRRORED_REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.MIRRORED_REPEAT);const aniso=gl.getExtension('EXT_texture_filter_anisotropic');if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));iceReady=true;};iceImage.src=ICE_IMAGE;
    skyTexture=GL.texture2D(makeCanvas(1,1));const skyImage=new Image();skyImage.onload=()=>{gl.deleteTexture(skyTexture);skyTexture=GL.texture2D(skyImage);gl.bindTexture(gl.TEXTURE_2D,skyTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);skyReady=true;};skyImage.src=SKY_IMAGE;
    // snow particles
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 12); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
    gl.bindVertexArray(null); partMesh = { vao, vbo, n: 0 };
    return gl;
  }

  let target = null, tw = 0, th = 0;
  function ensureTarget(w, h) { if (target && tw === w && th === h) return; if (target) GL.freeTarget(target); target = GL.target(w, h, true); tw = w; th = h; }

  function light(x, y, z, radius, r, g, b, dx = 0, dy = 0, dz = 0, cosCone = -1) {
    if (lights.n >= MAX_LIGHTS) return;
    const o = lights.n * 12; lights.data.set([x, y, z, radius, r, g, b, 0, dx, dy, dz, cosCone], o); lights.n++;
  }
  function clearLights() { lights.n = 0; contactCount = 0; }

  function setCamera() {
    M.perspective(proj, cam.fov, tw / th, cam.near, cam.far);
    M.lookAt(view, cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, 0, 1, 0);
    M.multiply(vp, proj, view); M.invert(invVP, vp); M.frustumPlanes(planes, vp);
  }
  function setLight() {
    // one shadow box 90 m across, centred a little ahead of the camera, snapped to a texel
    const s = env.sunDir, R = 45, texel = 2 * R / 1024;
    const fx = cam.tx - cam.x, fz = cam.tz - cam.z, fl = Math.hypot(fx, fz) || 1;
    let cx = cam.x + fx / fl * 20, cz = cam.z + fz / fl * 20, cy = cam.y;
    cx = Math.round(cx / texel) * texel; cz = Math.round(cz / texel) * texel;
    M.lookAt(lightView, cx + s[0] * 200, cy + s[1] * 200, cz + s[2] * 200, cx, cy, cz, 0, 1, 0);
    M.ortho(lightProj, -R, R, -R, R, 1, 400); M.multiply(lightVP, lightProj, lightView);
  }

  function bindCommon(P, forShadow) {
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, forShadow ? lightVP : vp);
    if (!forShadow) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, Paint.tex); gl.uniform1i(P.u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadow.tex); gl.uniform1i(P.u.uShadow, 1);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,foliageTex);gl.uniform1i(P.u.uFoliage,2);
      gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,iceTexture);gl.uniform1i(P.u.uIceTexture,4);gl.uniform1f(P.u.uIceReady,iceReady?1:0);
      gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,woodTexture);gl.uniform1i(P.u.uWoodTexture,5);gl.uniform1f(P.u.uWoodReady,woodReady?1:0);
      gl.uniformMatrix4fv(P.u.uLightVP, false, lightVP);
      gl.uniform4fv(P.u.uMat, Paint.params);
      gl.uniform3fv(P.u.uSunDir, env.sunDir); gl.uniform3fv(P.u.uSunCol, env.sunCol); gl.uniform3fv(P.u.uSkyCol, env.skyCol); gl.uniform3fv(P.u.uGroundCol, env.groundCol);
      gl.uniform3fv(P.u.uFogCol, env.fogCol); gl.uniform3f(P.u.uCamPos, cam.x, cam.y, cam.z); gl.uniform1f(P.u.uFogDensity, env.fogDensity); gl.uniform1f(P.u.uFogHeight, env.fogHeight);
      gl.uniform1f(P.u.uShadowOn, env.shadowOn ? 1 : 0); gl.uniform1f(P.u.uTime, env.time); gl.uniform1f(P.u.uIceGlow, env.iceGlow); gl.uniform1f(P.u.uAlpha, 1); gl.uniform1f(P.u.uEmisMul, 1);
      gl.uniform4fv(P.u.uContacts, contacts); gl.uniform1i(P.u.uNC, contactCount);
      gl.uniform4fv(P.u.uLights, lights.data); gl.uniform1i(P.u.uNL, lights.n);
    }
  }

  // scene.items: { mesh, model, bones?, fx?, alpha?, emis?, hidden?, noShadow?, radius?, x?, y?, z? }
  function drawScene(forShadow, withHidden) {
    const P = forShadow ? shadowProg : litProg, PI = forShadow ? shadowInstProg : instProg;
    let cur = null;
    for (const it of scene.items) {
      if (it.hidden && !withHidden) continue;
      if (forShadow && it.noShadow) continue;
      if (it.radius !== undefined && !M.sphereInFrustum(planes, it.x, it.y, it.z, it.radius) && !forShadow) continue;
      const prog = it.mesh.instCount ? PI : P;
      if (prog !== cur) { bindCommon(prog, forShadow); cur = prog; }
      if (!it.mesh.instCount) {
        gl.uniformMatrix4fv(prog.u.uModel, false, it.model);
        gl.uniformMatrix4fv(prog.u.uBones, false, it.bones || identityBones);
        gl.uniform4fv(prog.u.uFx, it.fx || zeroFx);
      }
      if (!forShadow) {
        if (it.alpha !== undefined) { gl.uniform1f(prog.u.uAlpha, it.alpha); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
        gl.uniform1f(prog.u.uEmisMul, it.emis !== undefined ? it.emis : 1);
        if (it.twoSided) gl.disable(gl.CULL_FACE);
      }
      GL.draw(it.mesh); stats.draws++; stats.triangles+=it.mesh.count/3*Math.max(1,it.mesh.instCount);
      if (!forShadow) {
        if (it.alpha !== undefined) { gl.uniform1f(prog.u.uAlpha, 1); gl.disable(gl.BLEND); gl.depthMask(true); }
        if (it.twoSided) gl.enable(gl.CULL_FACE);
      }
    }
  }

  function drawSky() {
    gl.useProgram(skyProg.p); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,skyTexture);gl.uniform1i(skyProg.u.uSkyTexture,3);gl.uniform1f(skyProg.u.uSkyReady,skyReady?1:0);
    gl.uniformMatrix4fv(skyProg.u.uInvVP, false, invVP); gl.uniform3f(skyProg.u.uCamPos, cam.x, cam.y, cam.z); gl.uniform3fv(skyProg.u.uSunDir, env.sunDir);
    gl.uniform3fv(skyProg.u.uZenith, env.zenith); gl.uniform3fv(skyProg.u.uHorizon, env.horizon); gl.uniform3fv(skyProg.u.uFogCol, env.fogCol); gl.uniform3fv(skyProg.u.uCloudCol, env.cloudCol);
    gl.uniform1f(skyProg.u.uSunGlow, env.sunGlow); gl.uniform1f(skyProg.u.uSunDisc, env.sunDisc); gl.uniform1f(skyProg.u.uCloud, env.cloud); gl.uniform1f(skyProg.u.uStars, env.stars); gl.uniform1f(skyProg.u.uTime, env.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }

  function drawParticles(parts) {
    if (!parts || !parts.n) return;
    gl.useProgram(partProg.p); gl.bindVertexArray(partMesh.vao); gl.bindBuffer(gl.ARRAY_BUFFER, partMesh.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, parts.data.subarray(0, parts.n * 5), gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(partProg.u.uVP, false, vp); gl.uniform1f(partProg.u.uScale, th * 0.9); gl.uniform3fv(partProg.u.uCol, parts.col);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, parts.n);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
  }

  function composite(dst, w, h, print) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(compProg.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, target.tex); gl.uniform1i(compProg.u.uTex, 0);
    gl.uniform1f(compProg.u.uExposure, env.exposure * env.darkAdapt); gl.uniform1f(compProg.u.uGrain, env.reduce ? 0 : env.grain); gl.uniform1f(compProg.u.uVignette, env.vignette);
    gl.uniform1f(compProg.u.uSat, env.sat); gl.uniform1f(compProg.u.uTime, env.reduce ? 0 : env.time); gl.uniform2f(compProg.u.uRes, w, h); gl.uniform1f(compProg.u.uPrint, print ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST);
  }

  // Draw the scene into the internal target: shadow pass, sky, items, particles.
  function renderScene(withHidden, parts) {
    setCamera(); setLight();
    stats.draws = 0; stats.triangles=0;
    if (env.shadowOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.fbo); gl.viewport(0, 0, shadow.size, shadow.size); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); drawScene(true, withHidden); gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, tw, th);
    gl.clearColor(env.fogCol[0], env.fogCol[1], env.fogCol[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawSky(); drawScene(false, withHidden); drawParticles(parts);if(scene.effects)drawParticles(scene.effects);
  }

  function frame(sc, w, h, parts) {
    scene = sc; ensureTarget(w, h);
    renderScene(false, parts);
    composite(null, w, h, false);
  }
  // A photograph: the same scene at a small size, with the hidden layer if asked, returned as a 2D canvas.
  function snapshot(sc, w, h, withHidden, print) {
    const keepT = target, keepW = tw, keepH = th; target = null; ensureTarget(w, h);
    scene = sc; renderScene(withHidden, null);
    const out = GL.target(w, h, false);
    composite(out.fbo, w, h, print);
    const px = new Uint8Array(w * h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    GL.freeTarget(out); GL.freeTarget(target); target = keepT; tw = keepW; th = keepH;
    const c = makeCanvas(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) id.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(id, 0, 0);
    return c;
  }
  return { init, cam, env, light, contact, clearLights, frame, snapshot, stats, MAX_BONES, get foliageReady(){return foliageReady&&skyReady&&iceReady&&woodReady;}, get vp() { return vp; }, get planes() { return planes; } };
})();
