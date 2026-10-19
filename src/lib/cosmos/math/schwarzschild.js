/**
 * cosmos/math/schwarzschild.js — light and orbits around a black hole
 * ---------------------------------------------------------------------------
 * Units: Schwarzschild radius r_s = 1 (so G = c = 1 and M = 1/2).
 * These are the same equations the GPU ray tracer in blackhole.js solves;
 * here they run on the CPU for the HUD, tests, and fallbacks.
 *
 * Key radii (all exact for a non-rotating hole):
 *   r = 1      event horizon
 *   r = 1.5    photon sphere: light can orbit, unstably
 *   r = 3      ISCO: innermost stable circular orbit, inner edge of the disk
 *   b = 3√3/2  critical impact parameter: rays aimed closer than this fall in,
 *              so the hole's shadow appears 2.6× larger than its horizon
 */

export const HORIZON = 1;
export const PHOTON_SPHERE = 1.5;
export const ISCO = 3;
export const B_CRIT = (3 * Math.sqrt(3)) / 2;

/**
 * Photon orbit equation (Binet form) with u = 1/r:
 *        d²u/dφ² = −u + (3/2) u²
 * The 3/2 u² term is general relativity; drop it and light goes straight.
 * Integrates an incoming ray with impact parameter b and returns the total
 * bending angle in radians (Infinity if captured).
 */
export function deflectionAngle(b, dphi = 5e-4) {
  if (b <= B_CRIT) return Infinity;
  const acc = (u) => -u + 1.5 * u * u;
  let u = 0;
  let du = 1 / b;
  let phi = 0;
  while (phi < 12 * Math.PI) {
    // RK4 on the system (u, u')
    const k1u = du, k1v = acc(u);
    const k2u = du + 0.5 * dphi * k1v, k2v = acc(u + 0.5 * dphi * k1u);
    const k3u = du + 0.5 * dphi * k2v, k3v = acc(u + 0.5 * dphi * k2u);
    const k4u = du + dphi * k3v, k4v = acc(u + dphi * k3u);
    u += (dphi / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    du += (dphi / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    phi += dphi;
    if (u > 1) return Infinity; // crossed the horizon
    if (u < 0) {
      // back out to infinity: refine the crossing linearly
      phi -= (u / (u - (u - dphi * du))) * dphi;
      return phi - Math.PI;
    }
  }
  return Infinity;
}

/** Weak-field (Einstein 1915) bending, for comparison: 2 r_s / b. */
export const einsteinDeflection = (b) => 2 / b;

/** Clock rate of a static observer at r relative to one far away. */
export const timeDilation = (r) => (r <= 1 ? 0 : Math.sqrt(1 - 1 / r));

/** Orbital speed of a circular orbit, measured locally (fraction of c). 0.5c at the ISCO. */
export const orbitalSpeed = (r) => Math.sqrt(0.5 / (r - 1));

/** Orbital angular velocity seen from far away (Kepler's law survives exactly). */
export const orbitalOmega = (r) => Math.sqrt(0.5 / (r * r * r));

/**
 * Radius of a body falling from rest at infinity, as a function of its own
 * proper time left before reaching r = 0:  r = (3/2 · τ)^(2/3)   (r_s = 1).
 * Used for the dive, so the approach accelerates the way a real fall does.
 */
export const infallRadius = (tauLeft) => Math.pow(1.5 * Math.max(0, tauLeft), 2 / 3);
export const infallTau = (r) => (2 / 3) * Math.pow(r, 1.5);

/**
 * Temperature profile of a thin accretion disk (Shakura–Sunyaev), relative
 * to its peak. Zero at the ISCO, peaking just outside it, falling as r^(−3/4).
 */
export function diskTemperature(r, rIn = ISCO) {
  if (r <= rIn) return 0;
  return Math.pow(Math.pow(r, -3) * (1 - Math.sqrt(rIn / r)), 0.25) / 0.21402; // normalised: peak = 1 (at r ≈ 4.1)
}
