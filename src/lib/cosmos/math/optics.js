/**
 * cosmos/math/optics.js — thin-lens depth of field
 * ---------------------------------------------------------------------------
 * The rack focus is computed, not faked. For a thin lens of focal length f,
 * f-number N, focused at distance S1, a point at distance S2 images as a
 * blur disc (circle of confusion) on the sensor of diameter
 *
 *        c = A · f · |S2 − S1| / ( S2 · (S1 − f) ),     A = f / N
 *
 * All distances in millimetres. The disc is converted to screen pixels by
 * mapping a 36 mm full-frame sensor width onto the viewport width.
 *
 * Focus breathing: focusing closer moves the lens away from the sensor
 * (image distance v = 1 / (1/f − 1/S1)), magnifying the image by v/f.
 * Real cine lenses "breathe" slightly when racking; so does this camera.
 */

export const SENSOR_WIDTH_MM = 36;

/** Circle-of-confusion diameter on the sensor, in mm. */
export function circleOfConfusion(f, N, focusMm, subjectMm) {
  if (focusMm <= f || subjectMm <= 0) return 0;
  const A = f / N;
  return (A * f * Math.abs(subjectMm - focusMm)) / (subjectMm * (focusMm - f));
}

/** Image distance behind the lens, in mm. */
export function imageDistance(f, focusMm) {
  return 1 / (1 / f - 1 / Math.max(focusMm, f * 1.001));
}

/** Magnification change from focus breathing, relative to focus at infinity. */
export function breathing(f, focusMm) {
  return imageDistance(f, focusMm) / f;
}

/**
 * Convert a CoC diameter to a CSS blur() radius in px.
 * CSS blur takes a Gaussian standard deviation; a uniform disc of diameter
 * d has σ ≈ d / 4, and d / 2.5 matches the look of real bokeh edges better.
 */
export function cocToCssBlur(cocMm, viewportPx) {
  return (cocMm / SENSOR_WIDTH_MM) * viewportPx / 2.5;
}

/** Hyperfocal distance (mm): focus here and everything to infinity is acceptably sharp. */
export function hyperfocal(f, N, acceptableCocMm = 0.03) {
  return (f * f) / (N * acceptableCocMm) + f;
}
