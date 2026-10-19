/**
 * cosmos/math/spring.js — damped oscillators
 * ---------------------------------------------------------------------------
 * Motion that feels physical comes from second-order systems:
 *   x'' = −k (x − target) − c x'      with c = 2ζ√k   (unit mass)
 *   ζ < 1 under-damped (overshoots, rings)
 *   ζ = 1 critically damped (fastest settle, no overshoot)
 *   ζ > 1 over-damped (sluggish)
 */

/**
 * Exact one-step solution of a critically damped spring (ζ = 1).
 * Frame-rate independent and unconditionally stable: ideal for cameras,
 * focus pulls and anything that should glide to rest without wobble.
 * @param {number} x       current value
 * @param {number} v       current velocity (units/s)
 * @param {number} target
 * @param {number} omega   natural frequency (1/s). Settles in ≈ 4/omega seconds.
 * @param {number} dt      seconds
 * @returns {[number, number]} [x, v]
 */
export function criticalSpring(x, v, target, omega, dt) {
  const e = Math.exp(-omega * dt);
  const delta = x - target;
  const tmp = (v + omega * delta) * dt;
  return [target + (delta + tmp) * e, (v - omega * tmp) * e];
}

/**
 * Semi-implicit Euler step for a general damped spring with an external
 * force, sub-stepped for stability at stiff settings.
 * @param {{x:number, v:number}} s   mutated in place
 * @param {number} k      stiffness (1/s²)
 * @param {number} zeta   damping ratio
 * @param {number} force  external acceleration
 * @param {number} dt     seconds
 */
export function stepSpring(s, k, zeta, force, dt) {
  const c = 2 * zeta * Math.sqrt(k);
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.v += (-k * s.x - c * s.v + force) * h;
    s.x += s.v * h;
  }
}

/** Smooth 0→1 ramp with zero slope at both ends. */
export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Sine ease in-out: the classic Ken Burns drift profile. */
export const easeSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/**
 * Easing curves for camera moves (t in 0–1). All but linear start and end
 * at rest; the camera's hand-off blend covers the linear case.
 *   sine    gentle, the Ken Burns default
 *   cubic   firmer departure and landing
 *   expo    snaps away, glides in: title-sequence feel
 *   linear  constant speed along the optimal path (van Wijk's own proposal)
 */
export const EASINGS = {
  sine: easeSine,
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  expo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  linear: (t) => t,
};
