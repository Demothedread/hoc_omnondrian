/**
 * illusion/registry.js
 * ---------------------------------------------------------------------------
 * Maps config ids to modules. To add an illusion: write a module with
 * mount(host, cfg, ctx) → { update(cfg), tick?(dt), destroy() }, register it
 * here, and add its option (plus any knobs) to SCHEMA in config.js.
 */
import { drosteBackground } from './backgrounds/droste.js';
import { ouchiBackground, driftBackground, noneBackground } from './backgrounds/static-illusions.js';
import { motionText } from './text/motion-defined.js';
import { afterimageText } from './text/afterimage.js';
import { crawlText, lenticularText, chromoText, anaglyphText, ouchiText, plainText } from './text/css-effects.js';
import { blackholeBackground } from './backgrounds/blackhole-bg.js';
import { gridBackground, cafeWallBackground, steppingBackground, pinnaBackground } from './backgrounds/grid-illusions.js';
import { springText, waveText, tidalText } from './text/physics-text.js';

export const REGISTRY = {
  backgrounds: {
    droste: drosteBackground,
    blackhole: blackholeBackground,
    grid: gridBackground,
    cafewall: cafeWallBackground,
    stepping: steppingBackground,
    pinna: pinnaBackground,
    ouchi: ouchiBackground,
    drift: driftBackground,
    none: noneBackground,
  },
  texts: {
    motion: motionText,
    afterimage: afterimageText,
    crawl: crawlText,
    lenticular: lenticularText,
    chromo: chromoText,
    anaglyph: anaglyphText,
    ouchiText: ouchiText,
    spring: springText,
    wave: waveText,
    tidal: tidalText,
    plain: plainText,
  },
};
