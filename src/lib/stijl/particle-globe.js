/**
 * stijl/particle-globe.js — a photograph made of its own pixels
 * ---------------------------------------------------------------------------
 * The photo is sampled into a grid of particles (200 columns), each carrying
 * its pixel's colour. Two numbers move every particle in the vertex shader:
 *
 *   globe     0 = its place in the photograph, 1 = a point on a Fibonacci
 *             sphere (golden-angle spiral, even coverage), drifting on its
 *             own slow orbit
 *   collapse  0 = as above, 1 = fallen into the centre. Each particle starts
 *             falling a little later the further round the sphere it sits
 *             (a ragged implosion, not a uniform shrink), spirals as it
 *             goes, and shrinks to a point.
 *
 * Moving from one photo to the next (show(url)):
 *   1. disintegrate  the photo breaks into its particles and lifts into the globe
 *   2. collapse      the globe implodes on itself (accelerating, like a fall)
 *   3. swap          at the point, the next photo's particles take over
 *                    (it has been loading in parallel since step 1)
 *   4. burst         the new particles spring out of the point (overshooting
 *                    a touch) and settle into the new photograph, which then
 *                    sharpens to full resolution
 *
 * Holding the canvas (pointer, Enter or Space) gathers the photo into the
 * globe; releasing lets it settle. Motion springs drive both numbers.
 * Reduced motion: photos change instantly and nothing drifts.
 *
 * Needs: npm install three motion   (three ≥ r171 for three/webgpu and three/tsl)
 */
import { animate, cancelFrame, frame, motionValue, press } from 'motion';
import * as THREE from 'three/webgpu';
import { attribute, cos, float, mix, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';

const PAPER = 0xeeeeea;                 // OPTION: 0xffffff (the original white) | 0x000000 (night)

/** Photo opacity: fully visible below 0.5% globe, gone above 3.5% (smoothstep, inverted). */
function photoOpacity(globeAmount) {
  const t = Math.min(1, Math.max(0, (Math.max(globeAmount, 0) - 0.005) / 0.03));
  return 1 - t * t * (3 - 2 * t);
}

/** Pick a photo, never the same one twice in a row in this browser session. */
export function pickPhoto(urls, key = 'particle-globe-photo') {
  let previous = null;
  try { previous = sessionStorage.getItem(key); } catch {}
  const choices = urls.length > 1 ? urls.filter((u) => u !== previous) : urls;
  const url = choices[Math.floor(Math.random() * choices.length)];
  try { sessionStorage.setItem(key, url); } catch {}
  return url;
}

function loadPhoto(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';      // needed to read pixels from photos on a CDN
    image.decoding = 'async';
    image.onload = () => {
      const source = document.createElement('canvas');
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const context = source.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const map = new THREE.Texture(image);
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      resolve({ url, width: source.width, height: source.height, pixels: context.getImageData(0, 0, source.width, source.height).data, map });
    };
    image.onerror = () => reject(new Error(`Could not load the photograph: ${url}`));
    image.src = url;
  });
}

/**
 * Particles for one photo. The uniforms (globe, collapse, drift) are shared
 * by every photo's material, so swapping photos never interrupts the motion.
 */
function createParticles(photo, columns, U) {
  const imageAspect = photo.width / photo.height;
  const rows = Math.round(columns / imageAspect);
  const count = columns * rows;
  const colours = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const colour = new THREE.Color();

  for (let index = 0; index < count; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const sx = Math.min(photo.width - 1, Math.floor(((column + 0.5) / columns) * photo.width));
    const sy = Math.min(photo.height - 1, Math.floor(((row + 0.5) / rows) * photo.height));
    const pixel = (sy * photo.width + sx) * 4;
    colour.setRGB(photo.pixels[pixel] / 255, photo.pixels[pixel + 1] / 255, photo.pixels[pixel + 2] / 255, THREE.SRGBColorSpace);
    colours.set([colour.r, colour.g, colour.b], index * 3);
    phases[index] = Math.random() * Math.PI * 2;
    speeds[index] = 0.7 + Math.random() * 0.35;
  }

  const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  geometry.instanceCount = count;
  geometry.setAttribute('imagePosition', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('globePosition', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('colour', new THREE.InstancedBufferAttribute(colours, 3));
  geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('speed', new THREE.InstancedBufferAttribute(speeds, 1));

  const phase = attribute('phase');
  const speed = attribute('speed');
  const particleSize = uniform(new THREE.Vector2(0.01, 0.01));

  // Drift: each particle orbits slowly while in the globe (0 under reduced motion).
  const turbulence = vec3(
    sin(time.mul(speed.add(0.6)).add(phase)).mul(0.045),
    cos(time.mul(speed.add(0.37)).add(phase.mul(1.71))).mul(0.035),
    sin(time.mul(speed.add(0.22)).add(phase.mul(2.13))).mul(0.045),
  ).mul(U.drift);
  const centre = mix(attribute('imagePosition'), attribute('globePosition').add(turbulence), U.globe);

  // Collapse: a per-particle fall that starts later for particles further round
  // the sphere (phase), eased so the end accelerates, with a spiral twist.
  // Below 0 (the spring overshooting on the way out) the globe swells instead.
  const staggered = U.collapse.mul(1.4).sub(phase.div(Math.PI * 2).mul(0.4)).clamp(0, 1);
  const fall = staggered.mul(staggered);                   // accelerating, like free fall
  const swell = U.collapse.min(0).mul(-0.9);               // > 0 only while collapse < 0
  const shrink = float(1).sub(fall).add(swell);
  const twist = fall.mul(5.5);                             // radians of spiral by the time it reaches the centre
  const spun = vec3(
    centre.x.mul(cos(twist)).sub(centre.z.mul(sin(twist))),
    centre.y,
    centre.x.mul(sin(twist)).add(centre.z.mul(cos(twist))),
  ).mul(shrink);
  const size = particleSize.mul(mix(float(1), float(0.55), fall)); // particles thin as they fall

  const material = new THREE.MeshBasicNodeMaterial({ toneMapped: false });
  material.colorNode = attribute('colour');
  material.positionNode = spun.add(vec3(positionLocal.xy.mul(size), 0));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { imageAspect, columns, rows, particleSize, object: mesh };
}

/** Place every particle in the picture and on the sphere for the current aspect. */
function layout(particles, photoMesh, aspect, yaw) {
  const { columns, imageAspect, object, particleSize, rows } = particles;
  const imageHalfHeight = Math.min(0.72, (0.86 * aspect) / imageAspect);
  const imageHalfWidth = imageHalfHeight * imageAspect;
  const globeRadius = Math.min(0.58, aspect * 0.82);
  const position = object.geometry.getAttribute('imagePosition');
  const sphere = object.geometry.getAttribute('globePosition');
  const yc = Math.cos(yaw), ys = Math.sin(yaw);
  const tilt = -0.28;

  for (let index = 0; index < position.count; index++) {
    const x = ((index % columns) + 0.5) / columns;
    const y = (Math.floor(index / columns) + 0.5) / rows;
    const sy = 1 - (index / Math.max(position.count - 1, 1)) * 2;     // Fibonacci sphere: even heights…
    const ring = Math.sqrt(Math.max(0, 1 - sy * sy));
    const angle = index * 2.39996323;                                   // …golden-angle longitudes
    const px = Math.cos(angle) * ring, pz = Math.sin(angle) * ring;
    const rx = px * yc + pz * ys, rz = -px * ys + pz * yc;
    position.setXYZ(index, (x - 0.5) * imageHalfWidth * 2, (0.5 - y) * imageHalfHeight * 2, 0);
    sphere.setXYZ(index, rx * globeRadius, (sy * Math.cos(tilt) - rz * Math.sin(tilt)) * globeRadius, (sy * Math.sin(tilt) + rz * Math.cos(tilt)) * globeRadius);
  }
  position.needsUpdate = true;
  sphere.needsUpdate = true;
  particleSize.value.set(((imageHalfWidth * 2) / columns) * 1.01, ((imageHalfHeight * 2) / rows) * 1.01);
  photoMesh.scale.set(imageHalfWidth * 2, imageHalfHeight * 2, 1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const finished = (a) => a?.finished ?? a; // Motion controls are thenable; .finished on newer versions

/**
 * Mount on a canvas. The canvas's parent is the stage (it sets the size).
 * @param {HTMLCanvasElement} canvas  should carry role="button", tabindex="0" and an aria-label
 * @param {{ photo: string, columns?: number, background?: number, settleDelay?: number, onChange?: (url: string) => void }} o
 *   photo        URL of the first photograph
 *   columns      particle columns (rows follow each photo's aspect). OPTION: 140 for phones, 260 for big screens
 *   settleDelay  seconds as a globe before the first photo settles
 *   onChange     called at the moment a transition swaps photos (update captions here)
 * @returns {Promise<null | { show(url: string): Promise<void>, isBusy(): boolean, destroy(): void }>}
 *   null if no GPU backend: show the plain image instead
 */
export async function mountParticleGlobe(canvas, { photo: url, columns = 200, background = PAPER, settleDelay = 0.4, onChange } = {}) {
  const stage = canvas.parentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups = [];
  let renderer;
  try {
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true }); // falls back to WebGL2 where WebGPU is missing
    await renderer.init();
  } catch (error) {
    console.warn('[particle-globe] no GPU backend', error);
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const U = { globe: uniform(reduced ? 0 : 1), collapse: uniform(0), drift: uniform(reduced ? 0 : 1) };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  scene.background = new THREE.Color(background);
  camera.position.z = 4;
  const photoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }),
  );
  photoMesh.renderOrder = 1;
  scene.add(photoMesh);
  const yaw = Math.random() * Math.PI * 2;

  let photo = null;
  let particles = null;
  let aspect = 1;

  /** Put a photo's particles (and its sharp overlay) on stage, disposing the last one's. */
  function install(next) {
    if (particles) {
      scene.remove(particles.object);
      particles.object.geometry.dispose();
      particles.object.material.dispose();
    }
    photo?.map.dispose();
    photo = next;
    particles = createParticles(photo, columns, U);
    photoMesh.material.map = photo.map;
    photoMesh.material.needsUpdate = true;
    scene.add(particles.object);
    layout(particles, photoMesh, aspect, yaw);
  }

  const resize = () => {
    const w = Math.max(stage.clientWidth, 1);
    const h = Math.max(stage.clientHeight, 1);
    aspect = w / h;
    renderer.setSize(w, h, false);
    Object.assign(camera, { left: -aspect, right: aspect, top: 1, bottom: -1 });
    camera.updateProjectionMatrix();
    if (particles) layout(particles, photoMesh, aspect, yaw);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  cleanups.push(() => ro.disconnect());
  resize();
  install(await loadPhoto(url));

  // Motion values → uniforms (the same as threeEffect(globe, { value }) from "motion/three").
  const globeValue = motionValue(U.globe.value);
  const collapseValue = motionValue(0);
  cleanups.push(globeValue.on('change', (v) => { U.globe.value = v; photoMesh.material.opacity = photoOpacity(v); }));
  cleanups.push(collapseValue.on('change', (v) => { U.collapse.value = v; }));
  photoMesh.material.opacity = photoOpacity(U.globe.value);

  const spring = (value, to, opts) => animate(value, to, reduced ? { duration: 0 } : { type: 'spring', ...opts });
  if (!reduced) spring(globeValue, 0, { stiffness: 55, damping: 16, mass: 1, delay: settleDelay });

  // --- transitions ----------------------------------------------------------------
  let busy = false;
  let pending = null;   // latest requested photo while a transition runs (latest wins)

  async function transition(nextUrl) {
    busy = true;
    const loading = loadPhoto(nextUrl);
    if (reduced) {
      const next = await loading;
      install(next);
      onChange?.(next.url);
      busy = false;
      return;
    }
    // 1. Disintegrate: the photo breaks into particles and lifts into the globe.
    spring(globeValue, 1, { stiffness: 120, damping: 18, mass: 0.9 });
    await wait(260);
    // 2. Collapse: the globe falls in on itself, accelerating (ease-in), then holds at the point.
    await finished(animate(collapseValue, 1, { duration: 0.85, ease: [0.55, 0, 0.85, 0.36] }));
    // 3. Swap at the point (the next photo has been loading all along).
    let next;
    try { next = await loading; } catch (error) {
      console.warn('[particle-globe]', error);
      next = null;
    }
    if (next) { globeValue.set(1); install(next); onChange?.(next.url); }
    // 4. Burst: out of the point into the globe. The spring is under-damped (ζ ≈ 0.58),
    //    so it overshoots about 10% past 0 and the globe swells briefly before settling.
    spring(collapseValue, 0, { stiffness: 90, damping: 11, mass: 1 });
    await wait(420);
    await finished(spring(globeValue, 0, { stiffness: 55, damping: 16, mass: 1 }));
    busy = false;
  }

  /** Move to another photo through the collapse. Requests during a transition queue (latest wins). */
  async function show(nextUrl) {
    if (busy) { pending = nextUrl; return; }
    if (nextUrl === photo?.url) return;
    await transition(nextUrl);
    while (pending) {
      const p = pending;
      pending = null;
      if (p !== photo?.url) await transition(p);
    }
  }

  // Hold to gather into a globe; release to let it settle (not during a transition).
  const gather = () => { if (!busy) spring(globeValue, 1, { stiffness: 120, damping: 18, mass: 0.9 }); };
  const release = () => { if (!busy) spring(globeValue, 0, { stiffness: 70, damping: 16, mass: 1 }); };
  cleanups.push(press(canvas, () => { gather(); return () => release(); })); // press covers pointer and Enter
  const onKeyDown = (e) => { if (e.key === ' ' && !e.repeat) { e.preventDefault(); gather(); } };
  const onKeyUp = (e) => { if (e.key === ' ') release(); };
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('keyup', onKeyUp);
  cleanups.push(() => { canvas.removeEventListener('keydown', onKeyDown); canvas.removeEventListener('keyup', onKeyUp); });

  const draw = () => renderer.render(scene, camera);
  frame.render(draw, true);
  cleanups.push(() => cancelFrame(draw));
  canvas.dataset.ready = 'true';

  return {
    show,
    isBusy: () => busy,
    destroy() {
      cleanups.forEach((fn) => fn());
      globeValue.destroy?.();
      collapseValue.destroy?.();
      if (particles) { particles.object.geometry.dispose(); particles.object.material.dispose(); }
      photoMesh.geometry.dispose();
      photoMesh.material.dispose();
      photo?.map.dispose();
      renderer.dispose();
      delete canvas.dataset.ready;
    },
  };
}
