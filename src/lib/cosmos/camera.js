// DESCRIPTION: Controls camera travel, zoom and unbounded panning over the portfolio plane.
// INPUTS: Viewport, plane, world dimensions, configuration and reduced-motion preference.
// OUTPUTS: Camera state, coordinate conversion and cancellable movement controls.
// DEPENDENCIES: van Wijk zoom paths and critically damped springs.
/**
 * cosmos/camera.js — a camera over a plane much larger than the screen
 * ---------------------------------------------------------------------------
 * State: { x, y } world point at the centre of the screen, w = world units
 * visible across the screen width. Screen scale s = viewportWidth / w.
 *
 * Motions, each with its own model:
 *   flyTo()   van Wijk–Nuij optimal path (math/vanwijk.js), eased, with a
 *             per-move speed. While the camera is high, the map tilts away
 *             and coloured fields rise.
 *   driftTo() Ken Burns hold: slow push-in, centre linear, width geometric
 *             (constant perceived zoom speed).
 *   wheel/pinch: critically damped spring on log(w) around the cursor.
 *   drag:     direct manipulation, then viscous inertia v(t) = v₀·e^(−t/τ).
 *
 * Smooth handling: the camera measures its own velocity every frame.
 *   • A move started mid-motion keeps that velocity and bends into the new
 *     path (impulse response v₀·t·e^(−t/τ) added to it): direction changes
 *     are curves, never corners.
 *   • Interrupting a move hands the velocity to inertia and the zoom spring,
 *     so the camera glides to rest instead of stopping dead.
 *   • Tilt and rise relax exponentially instead of snapping flat.
 */
import { zoomPath, peakWidth } from './math/vanwijk.js';
import { criticalSpring, EASINGS } from './math/spring.js';

const FRICTION_TAU = 0.32;   // s — inertia glide. OPTION: 0.2 (tight) | 0.6 (icy)
const ZOOM_OMEGA = 14;       // 1/s — wheel zoom settle
const BLEND_TAU = 0.2;       // s — how long a hand-off bends into the new path
const TILT_RELAX = 0.28;     // s — tilt settles after an interrupted flight
const MIN_W = 140;           // world units — deepest zoom

export function createCamera(viewport, plane, { world, getConfig, isReduced }) {
  const cam = { x: world.w / 2, y: world.h / 2, w: world.w, tilt: 0, rise: 0 };
  const vel = { x: 0, y: 0, lw: 0 };        // world units/s and log-width/s, lightly smoothed
  const prev = { x: cam.x, y: cam.y, lw: Math.log(cam.w) };
  let vw = viewport.clientWidth || 1;
  let vh = viewport.clientHeight || 1;
  const listeners = new Set();

  let flight = null;   // { path, t, dur, lift, ease, clock, v0, tilt0, resolve }
  let drift = null;    // { from, to, t, dur, resolve }
  let zoom = null;     // { logW, v, target, ax, ay, sx, sy }
  let inertia = null;  // { vx, vy }
  let dragging = false;

  /** The whole world, with a margin, fitted to the screen. */
  function overview() {
    const w = Math.max(world.w * 1.06, world.h * 1.06 * (vw / vh));
    return [world.w / 2, world.h / 2, w];
  }

  /**
   * A view of a rect.
   *   'frame'  whole rect visible with a margin (its black lines show)
   *   'fill'   rect covers the screen edge to edge (its colour is the screen)
   */
  function fit(rect, pad = 0.12, mode = 'frame') {
    const w = mode === 'fill'
      ? Math.min(rect.w, (rect.h * vw) / vh) * 0.985            // 1.5% bleed so no line peeks in
      : Math.max(rect.w * (1 + pad), rect.h * (1 + pad) * (vw / vh));
    return [rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(MIN_W, w)];
  }

  const maxW = () => overview()[2] * 1.001;
  const moving = () => !!(flight || drift || zoom || inertia || dragging);

  function apply() {
    const s = vw / cam.w;
    const tilted = cam.tilt > 0.05;
    plane.style.transform = tilted
      ? `translate3d(${vw / 2}px, ${vh / 2}px, 0) rotateX(${cam.tilt.toFixed(2)}deg) scale(${s}) translate3d(${-cam.x}px, ${-cam.y}px, 0)`
      : `translate(${vw / 2}px, ${vh / 2}px) scale(${s}) translate(${-cam.x}px, ${-cam.y}px)`;
    plane.style.setProperty('--cos-s', s.toFixed(5));
    plane.style.setProperty('--cos-rise', cam.rise.toFixed(3));
    // While moving: GPU layer + 3D. At rest: drop both so text re-rasterises crisp.
    viewport.classList.toggle('is-moving', moving() || tilted);
    viewport.classList.toggle('is-3d', tilted || cam.rise > 0.01);
    listeners.forEach((fn) => fn(cam));
  }

  function clampCentre() {
    // The repeating ground has no spatial edge; only zoom depth is constrained.
    cam.w = Math.min(maxW(), Math.max(MIN_W, cam.w));
  }

  /** Stop scripted motion. soft: keep the current velocity as a glide. */
  function stop({ soft = true } = {}) {
    flight?.resolve(false); flight = null;
    drift?.resolve(false); drift = null;
    if (soft && !isReduced()) {
      inertia = Math.hypot(vel.x, vel.y) > (cam.w / vw) * 20 ? { vx: vel.x, vy: vel.y } : null;
      if (Math.abs(vel.lw) > 0.05) {
        const lw = Math.log(cam.w);
        zoom = { logW: lw, v: vel.lw, target: lw + vel.lw * (1.2 / ZOOM_OMEGA), ax: cam.x, ay: cam.y, sx: vw / 2, sy: vh / 2 };
      } else zoom = null;
    } else {
      zoom = null; inertia = null;
    }
  }

  /**
   * Fly to a view on the optimal path.
   * @param {[number, number, number]} target
   * @param {{ immediate?: boolean, speed?: number, ease?: keyof EASINGS }} [opts]
   *        speed multiplies the global flight speed (per-move setting)
   * @returns {Promise<boolean>} true if it arrived, false if interrupted
   */
  function flyTo(target, { immediate = false, speed = 1, ease } = {}) {
    const v0 = { ...vel };
    const wasMoving = moving();
    stop({ soft: false });
    const cfg = getConfig();
    if (immediate || isReduced()) {
      [cam.x, cam.y, cam.w] = target;
      cam.tilt = 0; cam.rise = 0;
      vel.x = vel.y = vel.lw = 0;
      prev.x = cam.x; prev.y = cam.y; prev.lw = Math.log(cam.w);
      apply();
      return Promise.resolve(true);
    }
    const from = [cam.x, cam.y, cam.w];
    const path = zoomPath(from, target, cfg.flightArc);
    // van Wijk: duration ∝ path length (d3's calibration: 1000·ρ/√2 ms per unit).
    // Capped so crossing the whole world never takes more than a few seconds. OPTION: 8 for slower, grander crossings
    const dur = Math.min(5.5, Math.max(0.5, (path.length * cfg.flightArc) / Math.SQRT2 / (cfg.flightSpeed * speed)));
    const lift = Math.min(1, Math.max(0, (peakWidth(path) / Math.max(from[2], target[2]) - 1) * 1.6));
    return new Promise((resolve) => {
      flight = {
        path, t: 0, dur, lift, clock: 0,
        ease: EASINGS[ease ?? cfg.flightEase] ?? EASINGS.sine,
        v0: wasMoving ? v0 : null,
        tilt0: cam.tilt,
        resolve,
      };
    });
  }

  /** Ken Burns hold: drift from the current view to `target` over `seconds`. */
  function driftTo(target, seconds) {
    drift?.resolve(false);
    if (isReduced()) return new Promise((resolve) => setTimeout(() => resolve(true), seconds * 1000));
    const from = [cam.x, cam.y, cam.w];
    return new Promise((resolve) => { drift = { from, to: target, t: 0, dur: seconds, resolve }; });
  }

  function tick(dtMs) {
    const dt = dtMs / 1000;
    const cfg = getConfig();

    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.dur);
      flight.clock += dt;
      const e = flight.ease(flight.t);
      [cam.x, cam.y, cam.w] = flight.path.at(e);
      // Hand-off: bend the old velocity into the new path, fading as t·e^(−t/τ).
      if (flight.v0) {
        const k = flight.clock * Math.exp(-flight.clock / BLEND_TAU);
        cam.x += flight.v0.x * k;
        cam.y += flight.v0.y * k;
        cam.w *= Math.exp(flight.v0.lw * k);
      }
      const arc = Math.sin(Math.PI * e) * flight.lift;
      const carry = flight.tilt0 * Math.exp(-flight.clock / TILT_RELAX);
      cam.tilt = Math.max(cfg.flightTilt * arc, carry);
      cam.rise = cfg.riseHeight * arc;
      if (flight.t >= 1) { const done = flight; flight = null; done.resolve(true); }
    } else if (drift) {
      drift.t = Math.min(1, drift.t + dt / drift.dur);
      const e = EASINGS.sine(drift.t);
      cam.x = drift.from[0] + (drift.to[0] - drift.from[0]) * e;
      cam.y = drift.from[1] + (drift.to[1] - drift.from[1]) * e;
      cam.w = drift.from[2] * Math.pow(drift.to[2] / drift.from[2], e);
      if (drift.t >= 1) { const done = drift; drift = null; done.resolve(true); }
    } else {
      if (zoom) {
        [zoom.logW, zoom.v] = criticalSpring(zoom.logW, zoom.v, zoom.target, ZOOM_OMEGA, dt);
        cam.w = Math.exp(zoom.logW);
        // Keep the world point under the cursor fixed on screen.
        cam.x = zoom.ax - (zoom.sx - vw / 2) * (cam.w / vw);
        cam.y = zoom.ay - (zoom.sy - vh / 2) * (cam.w / vw);
        if (Math.abs(zoom.logW - zoom.target) < 1e-4 && Math.abs(zoom.v) < 1e-3) zoom = null;
      }
      if (inertia && !dragging) {
        cam.x += inertia.vx * dt;
        cam.y += inertia.vy * dt;
        if (zoom) { zoom.ax += inertia.vx * dt; zoom.ay += inertia.vy * dt; }
        const k = Math.exp(-dt / FRICTION_TAU);
        inertia.vx *= k; inertia.vy *= k;
        if (Math.hypot(inertia.vx, inertia.vy) < (cam.w / vw) * 4) inertia = null;
      }
      const relax = Math.exp(-dt / TILT_RELAX);
      cam.tilt = cam.tilt < 0.05 ? 0 : cam.tilt * relax;
      cam.rise = cam.rise < 0.005 ? 0 : cam.rise * relax;
      clampCentre();
    }

    if (dt > 0) {
      const lw = Math.log(cam.w);
      const a = Math.min(1, dt / 0.05);
      vel.x += ((cam.x - prev.x) / dt - vel.x) * a;
      vel.y += ((cam.y - prev.y) / dt - vel.y) * a;
      vel.lw += ((lw - prev.lw) / dt - vel.lw) * a;
      prev.x = cam.x; prev.y = cam.y; prev.lw = lw;
    }
    apply();
  }

  /** Screen px → world units at the current zoom. */
  const toWorld = (sx, sy) => [cam.x + (sx - vw / 2) * (cam.w / vw), cam.y + (sy - vh / 2) * (cam.w / vw)];

  function zoomAbout(sx, sy, factor) {
    const [ax, ay] = toWorld(sx, sy);
    const base = zoom ? zoom.target : Math.log(cam.w);
    const target = Math.min(Math.log(maxW()), Math.max(Math.log(MIN_W), base + Math.log(factor)));
    zoom = { logW: zoom?.logW ?? Math.log(cam.w), v: zoom?.v ?? 0, target, ax, ay, sx, sy };
  }

  return {
    state: cam,
    velocity: vel,
    overview,
    fit,
    toWorld,
    flyTo,
    driftTo,
    tick,
    stop,
    cancel: () => stop({ soft: false }),
    isBusy: moving,
    atOverview: () => cam.w >= maxW() * 0.97,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    resize() {
      vw = viewport.clientWidth || 1;
      vh = viewport.clientHeight || 1;
      clampCentre();
      apply();
    },
    // Input hooks (cosmos.js decides what a gesture means).
    wheel(sx, sy, deltaY) {
      if (flight || drift) stop();
      zoomAbout(sx, sy, Math.exp(deltaY * 0.0016));
    },
    pinch(sx, sy, factor) {
      if (flight || drift) stop();
      zoomAbout(sx, sy, factor);
    },
    dragStart() { stop({ soft: false }); dragging = true; },
    dragBy(dxPx, dyPx, dtMs) {
      const k = cam.w / vw;
      cam.x -= dxPx * k;
      cam.y -= dyPx * k;
      const dt = Math.max(dtMs, 8) / 1000;
      inertia = { vx: (-dxPx * k) / dt, vy: (-dyPx * k) / dt };
    },
    dragEnd() { dragging = false; },
    nudge(dxFrac, dyFrac) {
      stop({ soft: false });
      inertia = { vx: dxFrac * cam.w * 2.2, vy: dyFrac * cam.w * 2.2 };
    },
  };
}
