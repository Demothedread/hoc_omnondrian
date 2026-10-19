/* test/three-shim.js — TEST ONLY. A tiny stand-in for the slice of the three.js
   API that src/lib/cosmos/warp.js uses, so the warp can run headless without
   network access. Not shipped; the site uses the real three.js. */
(function () {
  class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
  class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  class Color {
    constructor(hex = 0) { this.setHex(hex); }
    setHex(h) { this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; return this; }
    copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
  }
  class Object3D { constructor() { this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.renderOrder = 0; this.frustumCulled = true; } }
  class Scene { constructor() { this.children = []; } add(...o) { this.children.push(...o); } remove(o) { this.children = this.children.filter((c) => c !== o); } }
  class PerspectiveCamera extends Object3D { constructor(fov, aspect, near, far) { super(); Object.assign(this, { fov, aspect, near, far }); } updateProjectionMatrix() {} }
  class PlaneGeometry {
    constructor(w = 1, h = 1, ws = 1, hs = 1) {
      const pos = [], uv = [], idx = [];
      for (let iy = 0; iy <= hs; iy++) for (let ix = 0; ix <= ws; ix++) {
        pos.push(ix / ws * w - w / 2, h / 2 - iy / hs * h, 0);
        uv.push(ix / ws, 1 - iy / hs);
      }
      for (let iy = 0; iy < hs; iy++) for (let ix = 0; ix < ws; ix++) {
        const a = ix + (ws + 1) * iy, b = ix + (ws + 1) * (iy + 1), c = ix + 1 + (ws + 1) * (iy + 1), d = ix + 1 + (ws + 1) * iy;
        idx.push(a, b, d, b, c, d);
      }
      this.position = new Float32Array(pos); this.uv = new Float32Array(uv); this.index = new Uint32Array(idx);
    }
    dispose() {}
  }
  class ShaderMaterial { constructor(p) { Object.assign(this, { transparent: false, depthTest: true, depthWrite: true, side: 0, blending: 1 }, p); } dispose() {} }
  class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
  class CanvasTexture {
    constructor(img) { this.image = img; this.version = 1; }
    set needsUpdate(v) { if (v) this.version++; }
    get needsUpdate() { return false; }
    dispose() {}
  }
  class WebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      const gl = (this.gl = this.domElement.getContext('webgl2', { antialias: true }));
      if (!gl) throw new Error('no webgl2');
      this.pr = 1; this.progs = new Map(); this.geo = new Map(); this.tex = new Map();
    }
    setPixelRatio(p) { this.pr = p; }
    setSize(w, h) { this.domElement.width = Math.round(w * this.pr); this.domElement.height = Math.round(h * this.pr); }
    program(m) {
      if (this.progs.has(m)) return this.progs.get(m);
      const gl = this.gl;
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + src); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, 'precision highp float;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nattribute vec3 position;\nattribute vec2 uv;\n' + m.vertexShader));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision highp float;\n' + m.fragmentShader));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.progs.set(m, p);
      return p;
    }
    buffers(g) {
      if (this.geo.has(g)) return this.geo.get(g);
      const gl = this.gl;
      const mk = (type, data) => { const b = gl.createBuffer(); gl.bindBuffer(type, b); gl.bufferData(type, data, gl.STATIC_DRAW); return b; };
      const b = { pos: mk(gl.ARRAY_BUFFER, g.position), uv: mk(gl.ARRAY_BUFFER, g.uv), idx: mk(gl.ELEMENT_ARRAY_BUFFER, g.index), n: g.index.length };
      this.geo.set(g, b);
      return b;
    }
    texture(t, unit) {
      const gl = this.gl;
      let rec = this.tex.get(t);
      if (!rec) { rec = { id: gl.createTexture(), v: 0 }; this.tex.set(t, rec); }
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, rec.id);
      if (rec.v !== t.version) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        rec.v = t.version;
      }
    }
    render(scene, cam) {
      const gl = this.gl;
      gl.viewport(0, 0, this.domElement.width, this.domElement.height);
      gl.clearColor(0, 0, 0, 1);
      gl.depthMask(true); // like three.js: a depth clear only works with depth writes on
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const f = 1 / Math.tan((cam.fov * Math.PI) / 360), n = cam.near, fa = cam.far;
      const proj = new Float32Array([f / cam.aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]);
      for (const m of scene.children.slice().sort((a, b) => a.renderOrder - b.renderOrder)) {
        const mat = m.material, p = this.program(mat), b = this.buffers(m.geometry);
        gl.useProgram(p);
        const attr = (name, buf, size) => { const loc = gl.getAttribLocation(p, name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
        attr('position', b.pos, 3); attr('uv', b.uv, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
        const mv = new Float32Array([m.scale.x, 0, 0, 0, 0, m.scale.y, 0, 0, 0, 0, m.scale.z, 0,
          m.position.x - cam.position.x, m.position.y - cam.position.y, m.position.z - cam.position.z, 1]);
        gl.uniformMatrix4fv(gl.getUniformLocation(p, 'projectionMatrix'), false, proj);
        gl.uniformMatrix4fv(gl.getUniformLocation(p, 'modelViewMatrix'), false, mv);
        let unit = 0;
        for (const [name, { value }] of Object.entries(mat.uniforms || {})) {
          const loc = gl.getUniformLocation(p, name);
          if (!loc) continue;
          if (typeof value === 'number') gl.uniform1f(loc, value);
          else if (value instanceof Vector2) gl.uniform2f(loc, value.x, value.y);
          else if (value instanceof Vector3) gl.uniform3f(loc, value.x, value.y, value.z);
          else if (value instanceof Color) gl.uniform3f(loc, value.r, value.g, value.b);
          else if (value instanceof CanvasTexture) { this.texture(value, unit); gl.uniform1i(loc, unit++); }
        }
        if (mat.depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
        gl.depthMask(!!mat.depthWrite);
        if (mat.transparent) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
        gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_INT, 0);
      }
    }
    dispose() {}
  }
  window.THREE = { Vector2, Vector3, Color, Scene, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Mesh, CanvasTexture, WebGLRenderer, DoubleSide: 2, LinearFilter: 1006, __shim: true };
})();
