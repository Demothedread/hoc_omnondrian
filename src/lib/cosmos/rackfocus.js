/**
 * cosmos/rackfocus.js — a focus puller for DOM layers
 * ---------------------------------------------------------------------------
 * Each layer sits at a physical distance from a virtual lens. The focus
 * distance glides (critically damped, in log-distance, the way a focus
 * puller's hand moves through the witness marks) and every frame each layer
 * gets the blur its circle of confusion demands (math/optics.js).
 * Focus breathing scales the whole frame by the lens's changing magnification.
 *
 * Layers (defaults used by the cosmos):
 *   near  1.2 m   title card
 *   map   5 m     the world
 *   far   60 m    the sky behind the map
 */
import { circleOfConfusion, cocToCssBlur, breathing } from './math/optics.js';
import { criticalSpring } from './math/spring.js';

/**
 * @param {HTMLElement} viewport   receives --cos-breath
 * @param {Array<{ name: string, el: HTMLElement, distance: number }>} layers   distance in mm
 * @param {() => object} getConfig lensFocal, lensAperture, focusPull, breathing
 * @param {() => boolean} isReduced
 */
export function createRackFocus(viewport, layers, getConfig, isReduced) {
  const byName = Object.fromEntries(layers.map((l) => [l.name, l]));
  const reference = byName.map?.distance ?? layers[0].distance;
  let logFocus = Math.log(reference);
  let v = 0;
  let target = logFocus;
  let lastBlur = new Map();

  function focusOn(name) {
    const layer = byName[name];
    if (!layer) return;
    target = Math.log(layer.distance);
    if (isReduced()) logFocus = target; // a cut, not a pull
  }

  function tick(dtMs) {
    const cfg = getConfig();
    const omega = 4 / cfg.focusPull; // settles in ≈ focusPull seconds
    [logFocus, v] = criticalSpring(logFocus, v, target, omega, dtMs / 1000);
    const focus = Math.exp(logFocus);
    const width = viewport.clientWidth || 1;

    for (const layer of layers) {
      const coc = circleOfConfusion(cfg.lensFocal, cfg.lensAperture, focus, layer.distance);
      const blur = Math.min(40, cocToCssBlur(coc, width));
      const rounded = blur < 0.35 ? 0 : Math.round(blur * 4) / 4;
      if (lastBlur.get(layer) !== rounded) {
        layer.el.style.filter = rounded ? `blur(${rounded}px)` : '';
        lastBlur.set(layer, rounded);
      }
    }
    const b = breathing(cfg.lensFocal, focus) / breathing(cfg.lensFocal, reference);
    viewport.style.setProperty('--cos-breath', (1 + (b - 1) * cfg.breathing).toFixed(4));
  }

  return {
    focusOn,
    tick,
    focusDistance: () => Math.exp(logFocus),
    settled: () => Math.abs(logFocus - target) < 0.01,
  };
}
