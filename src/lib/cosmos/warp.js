/**
 * cosmos/warp.js — being sucked into the singularity (three.js)
 * ---------------------------------------------------------------------------
 * The screen is snapshotted onto a finely divided three.js plane, and the
 * plane itself is deformed on the GPU. Four acts:
 *
 *  1. SUCK   Every ring of the page falls toward the centre on its own
 *            free-fall clock (t_ff ∝ r^1.5, so the middle goes first), along
 *            r(t) = r₀(1 − (t/t_ff)²)^(2/3). Angular momentum is conserved, so
 *            the page spirals: θ advances as √(r₀/r). The surface sinks into
 *            Flamm's paraboloid (the exact spatial shape of a Schwarzschild
 *            well, z = 2√(r_s(r − r_s))). Light from near the horizon is
 *            gravitationally redshifted (dimmer, redder, × √(1 − r_s/r)), and
 *            radial motion blur plus chromatic smear gives the warp-speed
 *            streak. Hyperspace streaks rush past outside the page.
 *  2. CURL   What fell in re-forms as a ball: the page wraps onto a sphere
 *            (u → longitude, v → latitude), the horizon closes over it, the
 *            backdrop goes to pure black or white, and the ball shrinks to a
 *            few pixels, spinning faster as it shrinks (ω ∝ 1/R², a
 *            figure-skater spin).
 *  3. DROP   The tiny sphere drops under gravity and bounces to rest
 *            (coefficient of restitution 0.45). OPTION: 'fall' (no bounce) | 'none'.
 *  4. ZOOM   We rush into the point: the sphere grows exponentially (constant
 *            perceived zoom speed, accelerating), unspins to face forward and
 *            unwraps into the flat home page. Its last frame is pixel-for-pixel
 *            the home page, so the DOM takes over without a seam.
 *
 * Why three.js and not Framer Motion: Motion animates DOM properties
 * (transform, opacity, layout). Warping pixels around a point needs a mesh
 * and shaders. three.js gives geometry, materials and textures without a
 * hand-written WebGL pipeline.
 */
import * as THREE from 'three';

const FOV = 40;

const PAGE_VERT = /* glsl */ `
uniform float uFall;     // 0–1, progress of the fall (1 = everything has crossed)
uniform float uSwirl;    // spiral strength
uniform float uFunnel;   // depth of the gravity well
uniform float uMorph;    // 0 = page / well, 1 = sphere
uniform float uRadius;   // sphere radius (screen half-heights)
uniform float uSpin;     // sphere spin (rad)
uniform float uTilt;     // sphere axial tilt (rad)
uniform float uHorizon;  // horizon radius (screen half-heights)
uniform vec2 uHalf;      // half-size of the page (aspect, 1)
uniform vec3 uOffset;    // sphere position (for the drop)
varying vec2 vUv;
varying float vR;
varying vec3 vN;
const float PI = 3.14159265;

void main() {
  vUv = uv;
  vec2 p = position.xy;
  float r0 = length(p);
  float rmax = length(uHalf);

  // 1. Free fall, each ring on its own clock: inner rings arrive first.
  float tff = 0.22 + 0.78 * pow(r0 / rmax, 1.5);
  float x = clamp(uFall / tff, 0.0, 1.0);
  float r = r0 * pow(max(1.0 - x * x, 0.0), 0.6667);

  // Angular momentum: dθ/dt = L/r², which integrates to θ ∝ √(r₀/r).
  float th = atan(p.y, p.x) + min(uSwirl * 1.1 * (sqrt(r0 / max(r, 1e-3)) - 1.0), 9.0);
  vec3 well = vec3(cos(th) * r, sin(th) * r, 0.0);

  // Flamm's paraboloid: the surface sinks toward the throat.
  float rs = max(uHorizon, 1e-3);
  float zr = 2.0 * sqrt(rs * max(r - rs, 0.0));
  float zfar = 2.0 * sqrt(rs * max(rmax - rs, 0.0));
  well.z = -uFunnel * (zfar - zr);

  // 2. The page wrapped onto a sphere.
  float lon = (uv.x - 0.5) * 2.0 * PI + uSpin;
  float lat = (uv.y - 0.5) * PI;
  vec3 n = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  float ct = cos(uTilt), st = sin(uTilt);
  n = vec3(n.x, n.y * ct - n.z * st, n.y * st + n.z * ct);
  vN = n;

  vec3 pos = mix(well, n * uRadius, uMorph) + uOffset;
  vR = length(pos.xy - uOffset.xy * uMorph);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const PAGE_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uStreak;   // radial motion blur amount
uniform float uHorizon;
uniform float uRed;      // 0–1 redshift strength
uniform float uMorph;
varying vec2 vUv;
varying float vR;
varying vec3 vN;

void main() {
  // Motion blur toward the centre with a chromatic split: warp-speed smear.
  vec2 toC = vec2(0.5) - vUv;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float k = float(i) / 9.0 * uStreak;
    c.r += texture2D(uTex, vUv + toC * k * 1.08).r;
    c.g += texture2D(uTex, vUv + toC * k).g;
    c.b += texture2D(uTex, vUv + toC * k * 0.92).b;
  }
  c /= 10.0;

  // Gravitational redshift: light climbing out of the well arrives dimmer and redder.
  float g = sqrt(clamp(1.0 - uHorizon / max(vR, 1e-4), 0.0, 1.0));
  vec3 shifted = c * vec3(1.0, 0.4 + 0.6 * g, 0.25 + 0.75 * g) * g;
  c = mix(c, shifted, uRed);

  // Sphere shading: a soft key light and a rim, faded in with the curl.
  float key = 0.62 + 0.38 * max(dot(normalize(vN), normalize(vec3(-0.5, 0.6, 0.65))), 0.0);
  float rim = pow(1.0 - max(vN.z, 0.0), 3.0) * 0.18;
  c = mix(c, c * key + rim, uMorph);
  gl_FragColor = vec4(c, 1.0);
}
`;

const QUAD_VERT = /* glsl */ `
uniform vec2 uQuad;   // the quad's on-screen scale (aspect, 1), so circles stay circles
varying vec2 vP;
void main() {
  vP = position.xy * uQuad;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Backdrop with hyperspace streaks rushing outward.
const BACK_FRAG = /* glsl */ `
uniform vec3 uBg;
uniform vec3 uInk;
uniform float uStars;
uniform float uTime;
varying vec2 vP;
const float PI = 3.14159265;
float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }

float layer(vec2 p, float bins, float seed) {
  float a = (atan(p.y, p.x) + PI) / (2.0 * PI) * bins;
  float id = floor(a);
  float h = hash(id + seed);
  float t = fract(h * 17.0 + uTime * (0.35 + 0.9 * h));
  float head = t * t * 2.2;               // accelerating outward: perspective of flying in
  float len = 0.04 + 0.6 * t * t;
  float r = length(p);
  float across = abs(fract(a) - 0.5);
  float thin = 1.0 - smoothstep(0.02, 0.08, across);
  float along = smoothstep(head - len, head, r) * (1.0 - smoothstep(head, head + 0.01, r));
  return thin * along * t * step(0.45, h);
}

void main() {
  float s = layer(vP, 220.0, 1.0) + layer(vP, 140.0, 7.0) * 0.7;
  gl_FragColor = vec4(mix(uBg, uInk, clamp(s * uStars, 0.0, 1.0)), 1.0);
}
`;

// Event horizon (black) with the photon ring burning at its edge.
const HOLE_FRAG = /* glsl */ `
uniform float uHorizon;
uniform float uRing;
varying vec2 vP;
void main() {
  float d = length(vP);
  float disc = 1.0 - smoothstep(uHorizon * 0.985, uHorizon, d);
  float w = uHorizon * 0.06 + 0.002;
  float ring = exp(-pow((d - uHorizon * 1.02) / w, 2.0)) * uRing;
  vec3 ringCol = mix(vec3(0.831, 0.035, 0.125), vec3(0.961, 0.827, 0.086), ring);
  float a = max(disc, ring);
  gl_FragColor = vec4(mix(ringCol, vec3(0.0), disc), a);
}
`;

const COLORS = { black: 0x000000, white: 0xeeeeea, ink: 0x000000, paper: 0xeeeeea };

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

/**
 * @param {HTMLElement} host   positioned element the canvas fills
 * @returns {null | { play(from: HTMLCanvasElement, opts): Promise<void>, resize(): void, destroy(): void }}
 */
export function createWarp(host) {
  if (typeof THREE === 'undefined' || !THREE?.WebGLRenderer) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.warn('[warp] WebGL unavailable', error);
    return null;
  }
  renderer.domElement.className = 'cos-warp__canvas';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
  camera.position.z = 1 / Math.tan((FOV * Math.PI) / 360); // a 2-unit-tall plane at z=0 exactly fills the view

  const texture = new THREE.CanvasTexture(document.createElement('canvas'));
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const U = {
    uTex: { value: texture }, uFall: { value: 0 }, uSwirl: { value: 1 }, uFunnel: { value: 0 },
    uMorph: { value: 0 }, uRadius: { value: 0.9 }, uSpin: { value: 0 }, uTilt: { value: 0 },
    uHorizon: { value: 0 }, uHalf: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector3() },
    uStreak: { value: 0 }, uRed: { value: 0 },
  };
  let page = null; // rebuilt on resize (segment count follows aspect)

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uBg: { value: new THREE.Color(COLORS.ink) }, uInk: { value: new THREE.Color(COLORS.paper) }, uStars: { value: 0 }, uTime: { value: 0 }, uQuad: { value: new THREE.Vector2(1, 1) } },
      vertexShader: QUAD_VERT, fragmentShader: BACK_FRAG, depthTest: false, depthWrite: false,
    }),
  );
  back.renderOrder = -1;
  const hole = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uHorizon: { value: 0 }, uRing: { value: 0 }, uQuad: { value: new THREE.Vector2(1, 1) } },
      vertexShader: QUAD_VERT, fragmentShader: HOLE_FRAG, transparent: true, depthTest: false, depthWrite: false,
    }),
  );
  hole.renderOrder = 2;
  scene.add(back, hole);
  [back, hole].forEach((m) => { m.frustumCulled = false; });

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const aspect = w / h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    U.uHalf.value.set(aspect, 1);
    back.scale.set(aspect, 1, 1);
    hole.scale.set(aspect, 1, 1);
    back.material.uniforms.uQuad.value.set(aspect, 1);
    hole.material.uniforms.uQuad.value.set(aspect, 1);
    if (page) { scene.remove(page); page.geometry.dispose(); }
    page = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * aspect, 2, Math.round(140 * Math.max(1, aspect)), Math.round(140 / Math.min(1, aspect))),
      page?.material ?? new THREE.ShaderMaterial({
        uniforms: U, vertexShader: PAGE_VERT, fragmentShader: PAGE_FRAG, side: THREE.DoubleSide,
      }),
    );
    page.frustumCulled = false;
    page.renderOrder = 0;
    scene.add(page);
  }
  resize();

  function setTexture(canvas) {
    texture.image = canvas;
    texture.needsUpdate = true;
  }

  // Frame source: the display (requestAnimationFrame), or manual stepping for
  // deterministic capture (recording a video, tests): play(..., { manual: true })
  // then call step(n) to advance n frames of 1/30 s.
  let manual = false;
  let pending = null;   // resolver of the frame the sequence is waiting for
  let waiting = null;   // resolver for step() waiting on the sequence
  let manualDt = 1 / 30;
  const frame = () => (manual
    ? new Promise((r) => { pending = r; waiting?.(); waiting = null; })
    : new Promise((r) => requestAnimationFrame(r)));
  async function step(n = 1, dt = 1 / 30) {
    for (let i = 0; i < n; i++) {
      if (!pending) await new Promise((r) => { waiting = r; });
      const r = pending;
      pending = null;
      manualDt = dt;
      r();
      await Promise.resolve();
    }
  }

  /**
   * Run the whole sequence.
   * @param {HTMLCanvasElement} from   snapshot of the screen as it is now
   * @param {object} o
   * @param {number} [o.speed=1]                 whole-sequence speed multiplier
   * @param {'black'|'white'} [o.backdrop]       what the sphere floats in
   * @param {number} [o.swirl=1]                 spiral strength
   * @param {boolean} [o.streaks=true]           hyperspace streaks
   * @param {number} [o.sphereSize=8]            sphere diameter at its smallest, in CSS px
   * @param {'bounce'|'fall'|'none'} [o.drop]
   * @param {number} [o.horizon0=0]              starting horizon radius (half-heights), e.g. the ray-traced shadow
   * @param {() => Promise<HTMLCanvasElement>} o.home   called while the sphere is tiny: move the site home and return its snapshot
   * @param {(phase: string) => void} [o.onPhase]
   * @param {boolean} [o.manual]                 advance only via step() (deterministic capture)
   * @param {(speed: number) => void} [o.onBounce]  each time the dropped sphere hits the floor
   */
  async function play(from, o) {
    manual = !!o.manual;
    const speed = o.speed ?? 1;
    const bg = new THREE.Color(o.backdrop === 'white' ? COLORS.white : COLORS.black);
    const ink = new THREE.Color(COLORS.ink);
    const streakCol = new THREE.Color(o.backdrop === 'white' ? COLORS.ink : COLORS.paper);
    resize();
    setTexture(from);
    const BM = back.material.uniforms;
    const HM = hole.material.uniforms;
    BM.uInk.value.copy(streakCol);
    U.uFall.value = 0; U.uMorph.value = 0; U.uRadius.value = 0.9; U.uSpin.value = 0; U.uTilt.value = 0.35;
    U.uOffset.value.set(0, 0, 0); U.uStreak.value = 0; U.uRed.value = 0; U.uSwirl.value = o.swirl ?? 1;
    const vh = host.clientHeight || 1;
    const tiny = Math.max(1, o.sphereSize ?? 8) / vh;  // diameter px → radius in half-heights
    let clock = 0;

    const render = () => { BM.uTime.value = clock; renderer.render(scene, camera); };

    /** Animate one act. fn(t, dt) with t in 0–1. */
    async function act(seconds, fn) {
      const dur = seconds / speed;
      let t = 0;
      let last = performance.now();
      while (t < 1) {
        await frame();
        const now = performance.now();
        const dt = manual ? manualDt : Math.min(0.05, (now - last) / 1000);
        last = now;
        clock += dt;
        t = Math.min(1, t + dt / dur);
        fn(t, dt);
        render();
      }
    }

    // --- 1. SUCK --------------------------------------------------------------
    o.onPhase?.('suck');
    const h0 = o.horizon0 ?? 0;
    await act(1.5, (t) => {
      const e = t * t;                                   // free fall: starts slow, accelerates
      U.uFall.value = 0.78 * e;
      U.uFunnel.value = 0.35 * smooth(0, 0.6, t);
      U.uHorizon.value = h0 + (0.16 - h0 * 0.3) * e;
      U.uStreak.value = 0.38 * smooth(0.15, 1, t);
      U.uRed.value = smooth(0.1, 0.8, t);
      HM.uHorizon.value = U.uHorizon.value;
      HM.uRing.value = smooth(0.05, 0.4, t);
      BM.uStars.value = (o.streaks ?? true) ? smooth(0.25, 0.9, t) : 0;
      BM.uBg.value.copy(ink).lerp(bg, smooth(0.5, 1, t));
    });

    // --- 2. CURL into a sphere, shrink to a point -------------------------------
    o.onPhase?.('curl');
    let spin = 0;
    const R0 = 0.9;
    await act(1.2, (t, dt) => {
      U.uFall.value = 0.78 + 0.22 * smooth(0, 0.5, t);
      U.uMorph.value = smooth(0.05, 0.55, t);
      const shrink = smooth(0.4, 1, t);
      U.uRadius.value = R0 * Math.pow(tiny / R0, shrink); // geometric: constant perceived shrink rate
      // Conservation of angular momentum: ω ∝ 1/R² (capped so it stays readable).
      spin += dt * Math.min(40, 1.6 * Math.pow(R0 / U.uRadius.value, 2) * 0.04 + 1.6);
      U.uSpin.value = spin;
      // The horizon closes as the ball forms, so the ball emerges in front of nothing.
      U.uHorizon.value = 0.16 * (1 - smooth(0, 0.3, t));
      HM.uHorizon.value = U.uHorizon.value;
      HM.uRing.value = 1 - smooth(0, 0.25, t);
      U.uStreak.value = 0.38 * (1 - smooth(0, 0.5, t));
      U.uRed.value = 1 - smooth(0.2, 0.7, t);
      U.uFunnel.value = 0.35 * (1 - smooth(0, 0.6, t));
      BM.uStars.value = (o.streaks ?? true) ? 1 - smooth(0.3, 0.9, t) : 0;
      BM.uBg.value.copy(bg);
      if (o.drop !== 'none') U.uOffset.value.y = 0.22 * smooth(0.4, 1, t); // drifts up as it shrinks
    });

    // While it is a few pixels across: move the site home and swap the texture.
    const homeCanvas = await o.home();
    setTexture(homeCanvas);
    U.uFall.value = 0;
    U.uFunnel.value = 0;

    // --- 3. DROP ----------------------------------------------------------------
    o.onPhase?.('drop');
    if (o.drop !== 'none') {
      const g = 9.0;            // half-heights / s²
      const e = o.drop === 'fall' ? 0 : 0.45;
      let y = U.uOffset.value.y;
      let v = 0;
      await act(1.1, (t, dt) => {
        v -= g * dt;
        y += v * dt;
        if (y <= 0) {
          if (v < -0.15) o.onBounce?.(-v);      // impact speed, for sound
          y = 0; v = -v * e; if (Math.abs(v) < 0.15) v = 0;
        }
        spin += dt * 9;
        U.uSpin.value = spin;
        U.uOffset.value.y = y;
      });
    }
    await act(0.25, (t, dt) => { spin += dt * 9; U.uSpin.value = spin; });

    // --- 4. ZOOM into the point --------------------------------------------------
    o.onPhase?.('zoom');
    const spinStart = spin;
    const spinEnd = Math.ceil(spin / (2 * Math.PI)) * 2 * Math.PI; // land facing forward
    await act(1.15, (t) => {
      const e = Math.pow(t, 2.2);                    // rush: slow, then explosive
      U.uRadius.value = tiny * Math.pow(1 / tiny, e);
      U.uMorph.value = 1 - smooth(0.6, 1, t);
      U.uSpin.value = spinStart + (spinEnd - spinStart) * (1 - Math.pow(1 - t, 3));
      U.uTilt.value = 0.35 * (1 - smooth(0.3, 0.9, t));
      U.uOffset.value.y = 0;
      BM.uStars.value = (o.streaks ?? true) ? Math.sin(Math.PI * t) * 0.8 : 0;
    });
    U.uMorph.value = 0; U.uSpin.value = 0; U.uTilt.value = 0;
    render();
    o.onPhase?.('done');
  }

  return {
    play,
    step,
    resize,
    /** Draw a single still of the current state (used in tests). */
    render: () => renderer.render(scene, camera),
    uniforms: U,
    destroy() {
      page?.geometry.dispose();
      page?.material.dispose();
      back.geometry.dispose(); back.material.dispose();
      hole.geometry.dispose(); hole.material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
