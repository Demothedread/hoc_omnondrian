/**
 * cosmos/blackhole.js — a real (non-rotating) black hole, ray traced on the GPU
 * ---------------------------------------------------------------------------
 * For every pixel we trace a light ray backwards from the camera:
 *
 *   • Path: exact Schwarzschild null geodesics. In units where r_s = 1 the
 *     photon orbit equation u'' + u = (3/2)u² is reproduced exactly by the
 *     acceleration  a = −(3/2) h² · x / r⁵  where h = |x × v| is conserved.
 *     That lets a plain Runge–Kutta loop in 3D bend light correctly.
 *   • Shadow: rays with impact parameter below 3√3/2 cross the horizon.
 *     The shadow and the photon ring emerge on their own; nothing is drawn.
 *   • Disk: thin, from the ISCO (r = 3) to r = 14, Shakura–Sunyaev
 *     temperature profile, Keplerian rotation.
 *   • Colour shift: exact redshift for a circular orbit,
 *         g = √(1 − 3/(2r)) / (1 + Ω · L_y)
 *     (gravitational + transverse + Doppler in one factor). Observed
 *     temperature scales by g, brightness by g⁴ (relativistic beaming).
 *   • Sky: whatever canvas you give it. By default, a Mondrian composition,
 *     so the black hole bends the painting itself.
 *
 * Not modelled: spin (Kerr), disk thickness, light-travel-time effects.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uCamPos;
uniform mat3 uBasis;       // columns: right, up, forward
uniform float uTanHalfFov;
uniform sampler2D uSky;
uniform float uDisk;       // 0 | 1
uniform float uBeaming;    // 0 | 1
uniform float uPalette;    // 0 = De Stijl, 1 = blackbody
uniform float uTime;       // seconds, drives Keplerian rotation of disk texture
uniform float uEscape;     // radius where rays are considered free

const float R_IN = 3.0;    // ISCO
const float R_OUT = 14.0;
const int STEPS = 300;

vec3 accel(vec3 p, float h2) {
  float r2 = dot(p, p);
  return -1.5 * h2 * p / (r2 * r2 * sqrt(r2));
}

// Approximate blackbody colour; t = temperature in kelvin / 100.
vec3 blackbody(float t) {
  float r = t <= 66.0 ? 1.0 : clamp(1.2929 * pow(t - 60.0, -0.1332), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.3901 * log(t) - 0.6318, 0.0, 1.0) : clamp(1.1299 * pow(t - 60.0, -0.0755), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432 * log(t - 10.0) - 1.1963, 0.0, 1.0));
  return vec3(r, g, b);
}

// De Stijl heat map: cool blue → red → yellow → paper white, in flat bands.
vec3 stijl(float t) {
  vec3 blue = vec3(0.075, 0.337, 0.635);
  vec3 red = vec3(0.831, 0.035, 0.125);
  vec3 yellow = vec3(0.961, 0.827, 0.086);
  vec3 paper = vec3(0.933, 0.933, 0.918);
  vec3 c = mix(blue, red, smoothstep(0.42, 0.47, t));
  c = mix(c, yellow, smoothstep(0.78, 0.83, t));
  return mix(c, paper, smoothstep(1.12, 1.17, t));
}

vec2 equirect(vec3 d) {
  return vec2(atan(d.x, -d.z) / 6.2831853 + 0.5, acos(clamp(d.y, -1.0, 1.0)) / 3.1415927);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 pos = uCamPos;
  vec3 vel = normalize(uBasis * vec3(uv * 2.0 * uTanHalfFov, 1.0));
  vec3 L = cross(pos, vel);
  float h2 = dot(L, L);

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  bool captured = false;

  for (int i = 0; i < STEPS; i++) {
    float r = length(pos);
    if (r < 1.0) { captured = true; break; }
    if (r > uEscape && dot(pos, vel) > 0.0) break;

    // Adaptive step: small near the hole, large far away.
    float dt = clamp(0.05 * r * r, 0.02, 1.2);

    // RK4
    vec3 k1v = accel(pos, h2);                     vec3 k1x = vel;
    vec3 k2v = accel(pos + 0.5 * dt * k1x, h2);    vec3 k2x = vel + 0.5 * dt * k1v;
    vec3 k3v = accel(pos + 0.5 * dt * k2x, h2);    vec3 k3x = vel + 0.5 * dt * k2v;
    vec3 k4v = accel(pos + dt * k3x, h2);          vec3 k4x = vel + dt * k3v;
    vec3 prev = pos;
    pos += dt / 6.0 * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
    vel += dt / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);

    // Crossed the disk plane (y = 0)?
    if (uDisk > 0.5 && prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      float rr = length(hit.xz);
      if (rr > R_IN && rr < R_OUT) {
        float T = pow(pow(rr, -3.0) * (1.0 - sqrt(R_IN / rr)), 0.25) / 0.21402;
        float omega = sqrt(0.5 / (rr * rr * rr));
        float gFull = sqrt(max(1.0 - 1.5 / rr, 0.0)) / (1.0 + omega * L.y);
        float g = mix(1.0, gFull, uBeaming);
        float Tobs = T * g;
        float intensity = pow(g, 4.0) * pow(T, 4.0);

        // Comoving angle: each ring turns at its own Keplerian rate.
        float ang = atan(hit.z, hit.x) + omega * uTime * 8.0;
        float streaks = 0.82 + 0.18 * sin(ang * 7.0 + rr * 2.3);

        vec3 c;
        if (uPalette < 0.5) {
          c = stijl(Tobs) * mix(0.72, 1.0, clamp(intensity * 3.0, 0.0, 1.0));
          // Mondrian's ink lines, carried round by the flow.
          float ring = min(min(abs(rr - 4.6), abs(rr - 7.2)), abs(rr - 10.6));
          float spoke = abs(sin(ang * 2.0)) * rr;
          c *= smoothstep(0.05, 0.1, ring) * smoothstep(0.06, 0.14, spoke);
        } else {
          c = blackbody(max(Tobs, 0.1) * 80.0) * (1.0 - exp(-intensity * 6.0)) * 1.6 * streaks;
        }
        float a = 0.97 * smoothstep(R_IN, R_IN + 0.25, rr) * (1.0 - smoothstep(R_OUT - 3.0, R_OUT, rr));
        col += (1.0 - alpha) * a * c;
        alpha += (1.0 - alpha) * a;
        if (alpha > 0.99) break;
      }
    }
  }

  if (!captured) {
    vec3 sky = texture2D(uSky, equirect(normalize(vel))).rgb;
    col += (1.0 - alpha) * sky;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {null | {
 *   set(p: Partial<BlackHoleParams>): void, setSky(src: HTMLCanvasElement): void,
 *   resize(quality?: number): void, render(): void, screenShadowRadius(): number, destroy(): void }}
 *
 * BlackHoleParams: dist (r_s), incl (deg), yaw (deg), fov (deg), disk (bool),
 * beaming (bool), palette ('stijl'|'blackbody'), time (s)
 */
export function createBlackHole(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn('[blackhole] shader failed, using fallback', error);
    return null;
  }
  gl.useProgram(program);

  // One full-screen triangle pair.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = Object.fromEntries(
    ['uRes', 'uCamPos', 'uBasis', 'uTanHalfFov', 'uSky', 'uDisk', 'uBeaming', 'uPalette', 'uTime', 'uEscape']
      .map((n) => [n, gl.getUniformLocation(program, n)]),
  );

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([238, 238, 234, 255]));

  const p = { dist: 22, incl: 7, yaw: 0, fov: 55, disk: true, beaming: true, palette: 'stijl', time: 0 };

  function render() {
    const rad = Math.PI / 180;
    const i = p.incl * rad;
    const y = p.yaw * rad;
    const cam = [p.dist * Math.cos(i) * Math.sin(y), p.dist * Math.sin(i), p.dist * Math.cos(i) * Math.cos(y)];
    // Look at the hole; world up is +y.
    const f = cam.map((c) => -c / p.dist);
    let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; // f × up
    const rl = Math.hypot(...r) || 1;
    r = r.map((c) => c / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; // r × f

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform3fv(U.uCamPos, cam);
    gl.uniformMatrix3fv(U.uBasis, false, [...r, ...u, ...f]);
    gl.uniform1f(U.uTanHalfFov, Math.tan((p.fov * rad) / 2));
    gl.uniform1f(U.uDisk, p.disk ? 1 : 0);
    gl.uniform1f(U.uBeaming, p.beaming ? 1 : 0);
    gl.uniform1f(U.uPalette, p.palette === 'blackbody' ? 1 : 0);
    gl.uniform1f(U.uTime, p.time);
    gl.uniform1f(U.uEscape, Math.max(30, p.dist * 1.25));
    gl.uniform1i(U.uSky, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return {
    set(next) { Object.assign(p, next); },
    get: () => ({ ...p }),
    setSky(src) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },
    /** Match the drawing buffer to the element size × quality (capped at 2× DPR). */
    resize(quality = 0.6) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr * quality));
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr * quality));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    },
    render,
    /** Apparent radius of the shadow in CSS px (b_crit seen from dist). */
    screenShadowRadius() {
      const bCrit = (3 * Math.sqrt(3)) / 2;
      const angle = Math.asin(Math.min(1, bCrit / p.dist));
      return (Math.tan(angle) / Math.tan((p.fov * Math.PI) / 360)) * (canvas.clientHeight / 2);
    },
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
