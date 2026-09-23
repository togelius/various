// GRIFT CITY — thin WebGL2 helpers: programs, interleaved buffers, texture arrays, framebuffers.
'use strict';
const GL = (() => {
  let gl = null;
  function init(canvas) {
    gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is required');
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    return gl;
  }
  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('Shader compile failed: ' + log);
    }
    return s;
  }
  function program(vs, fs, defines = '') {
    const p = gl.createProgram();
    const header = '#version 300 es\n' + defines + '\n';
    gl.attachShader(p, compile(gl.VERTEX_SHADER, header + vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, header + 'precision highp float;\nprecision highp sampler2DArray;\nprecision highp sampler2DShadow;\n' + fs));
    ['aPos', 'aNrm', 'aCol', 'aUV', 'aTile', 'aBone', 'aI0', 'aI1', 'aI2', 'aI3', 'aTint', 'aSkin', 'aBind'].forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    const a = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
    return { p, u, a };
  }

  // Interleaved layout used by every lit mesh: pos3 nrm3 col3 uv2 tile1 bone1 = 13 floats.
  const STRIDE = 13;
  const LAYOUT = [['aPos', 3, 0], ['aNrm', 3, 3], ['aCol', 3, 6], ['aUV', 2, 9], ['aTile', 1, 11], ['aBone', 1, 12]];

  // Static meshes are uploaded packed, 36 bytes a vertex instead of 52: the normal as three signed bytes, the colour
  // as half floats (vertex colours can exceed 1), the texture layer and bone as unsigned bytes. Position and UV stay
  // full floats: city UVs run to hundreds of repeats, which half floats cannot place precisely. Any mesh whose data
  // does not fit (a layer or bone id outside 0-255, or not a whole number) keeps the float layout.
  const PSTRIDE = 36, h32 = new Float32Array(1), h32u = new Uint32Array(h32.buffer);
  function half(v) { h32[0] = v; const x = h32u[0], sgn = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112; if (e <= 0) return sgn; if (e >= 31) return sgn | 0x7c00; return sgn | (e << 10) | ((x >>> 13) & 0x3ff); }
  function pack(data) { const n = data.length / STRIDE; if (n !== Math.floor(n)) return null; const buf = new ArrayBuffer(n * PSTRIDE), f = new Float32Array(buf), i8 = new Int8Array(buf), u16 = new Uint16Array(buf), u8 = new Uint8Array(buf);
    for (let v = 0; v < n; v++) { const o = v * STRIDE, fo = v * 9, bo = v * PSTRIDE, ho = bo >> 1, tile = data[o + 11], bone = data[o + 12];
      if (tile !== (tile | 0) || tile < 0 || tile > 255 || bone !== (bone | 0) || bone < 0 || bone > 255) return null;
      f[fo] = data[o]; f[fo + 1] = data[o + 1]; f[fo + 2] = data[o + 2];
      i8[bo + 12] = Math.round(Math.max(-1, Math.min(1, data[o + 3])) * 127); i8[bo + 13] = Math.round(Math.max(-1, Math.min(1, data[o + 4])) * 127); i8[bo + 14] = Math.round(Math.max(-1, Math.min(1, data[o + 5])) * 127);
      u16[ho + 8] = half(data[o + 6]); u16[ho + 9] = half(data[o + 7]); u16[ho + 10] = half(data[o + 8]);
      f[fo + 6] = data[o + 9]; f[fo + 7] = data[o + 10]; u8[bo + 32] = tile; u8[bo + 33] = bone; }
    return buf; }
  let packedBytes = 0, floatBytes = 0;
  function mesh(data, indices, dynamic = false, skin = null) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const packed = dynamic ? null : pack(data);
    if (packed) { gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW); packedBytes += packed.byteLength; floatBytes += data.byteLength;
      for (let loc = 0; loc < 6; loc++) gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, PSTRIDE, 0); gl.vertexAttribPointer(1, 3, gl.BYTE, true, PSTRIDE, 12); gl.vertexAttribPointer(2, 3, gl.HALF_FLOAT, false, PSTRIDE, 16);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, PSTRIDE, 24); gl.vertexAttribPointer(4, 1, gl.UNSIGNED_BYTE, false, PSTRIDE, 32); gl.vertexAttribPointer(5, 1, gl.UNSIGNED_BYTE, false, PSTRIDE, 33); }
    else { gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); floatBytes += data.byteLength; packedBytes += data.byteLength;
      LAYOUT.forEach(([name, size, off], loc) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off * 4); }); }
    // Only deforming characters pay for a second bone, weight and bind-space offset.
    let skinBuffer=null;
    if (skin) { skinBuffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,skinBuffer); gl.bufferData(gl.ARRAY_BUFFER,skin,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(11); gl.vertexAttribPointer(11,2,gl.FLOAT,false,20,0);
      gl.enableVertexAttribArray(12); gl.vertexAttribPointer(12,3,gl.FLOAT,false,20,8); }
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vbo, ibo, skinBuffer, count: indices.length, instanced: false };
  }
  // Instanced version: extra per-instance buffer of 4 vec4 (matrix) + 1 vec4 (tint) = 20 floats, at attribute slots 6..10.
  function instancedMesh(data, indices, maxInstances) {
    const m = mesh(data, indices);
    gl.bindVertexArray(m.vao);
    const inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, maxInstances * 20 * 4, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 5; i++) { const loc = 6 + i; gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 80, i * 16); gl.vertexAttribDivisor(loc, 1); }
    gl.bindVertexArray(null);
    m.instanced = true; m.instBuf = inst; m.instances = 0; m.instData = new Float32Array(maxInstances * 20);
    return m;
  }
  function updateInstances(m, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.instData, 0, count * 20);
    m.instances = count;
  }
  function updateMesh(m, data, indices) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
    m.count = indices.length;
  }
  function draw(m) {
    gl.bindVertexArray(m.vao);
    if (m.instanced) gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0, m.instances);
    else gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
  }
  function drawRange(m, first, count) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, first * 4); }

  // 2D texture array from a list of same-sized canvases.
  function textureArray(canvases) {
    const w = canvases[0].width, h = canvases[0].height, n = canvases.length;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const levels = 1 + Math.floor(Math.log2(Math.max(w, h)));
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, w, h, n);
    for (let i = 0; i < n; i++) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvases[i]);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return tex;
  }
  function texture2D(canvas, repeat = true) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return tex;
  }
  function shadowTarget(size, height) {
    const h = height || size;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, size, w: size, h };
  }
  return { get vertexBytes() { return { packed: packedBytes, float: floatBytes }; }, init, get gl() { return gl; }, program, mesh, instancedMesh, updateInstances, updateMesh, draw, drawRange, textureArray, texture2D, shadowTarget, STRIDE, LAYOUT };
})();
