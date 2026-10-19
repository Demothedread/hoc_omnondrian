/**
 * cosmos/math/vanwijk.js — optimal pan-and-zoom paths
 * ---------------------------------------------------------------------------
 * J. J. van Wijk & W. A. A. Nuij, "Smooth and efficient zooming and panning"
 * (IEEE InfoVis 2003). The same model d3.interpolateZoom uses.
 *
 * Idea: to travel between two views, a camera should rise (zoom out) enough
 * that start and destination share the frame, cross, then descend. The
 * resulting path is a hyperbolic curve in (position, log-width) space and
 * minimises perceived travel: the "Game of Thrones map" move, derived.
 *
 * A view is [x, y, w]: centre in world units and visible width in world units.
 *
 * rho controls how high the camera climbs. √2 is the value the authors found
 * most comfortable in user studies. OPTION: 1.0 (flatter, faster) |
 * 2.0 (dramatic, map-like climbs).
 */

export const RHO = Math.SQRT2;
const EPS2 = 1e-12;

/**
 * @param {[number, number, number]} p0  start view
 * @param {[number, number, number]} p1  end view
 * @param {number} [rho]
 * @returns {{ at: (t: number) => [number, number, number], length: number }}
 *   at(t) for t in [0,1]; length is the path length S in the paper's
 *   perceptual metric (dimensionless). Duration should scale with it.
 */
export function zoomPath(p0, p1, rho = RHO) {
  const [x0, y0, w0] = p0;
  const [x1, y1, w1] = p1;
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d2 = dx * dx + dy * dy;

  // Pure zoom (no pan): exponential in width.
  if (d2 < EPS2) {
    const S = Math.log(w1 / w0) / rho;
    return {
      at: (t) => [x0 + t * dx, y0 + t * dy, w0 * Math.exp(rho * t * S)],
      length: Math.abs(S),
    };
  }

  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  const coshr0 = Math.cosh(r0);
  const sinhr0 = Math.sinh(r0);

  return {
    at(t) {
      const s = t * S;
      const u = (w0 / (rho2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - sinhr0);
      return [x0 + u * dx, y0 + u * dy, (w0 * coshr0) / Math.cosh(rho * s + r0)];
    },
    length: Math.abs(S),
  };
}

/** Widest view reached along a path (used to scale the cinematic tilt). */
export function peakWidth(path, samples = 24) {
  let max = 0;
  for (let i = 0; i <= samples; i++) max = Math.max(max, path.at(i / samples)[2]);
  return max;
}
