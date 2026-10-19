/**
 * illusion/config.js
 * ---------------------------------------------------------------------------
 * Single source of truth for the illusion kit.
 *
 * SCHEMA drives three things at once, so a new knob is one entry here:
 *   1. the admin panel UI            (admin.js builds inputs from it)
 *   2. the no-code CMS fields        (keystatic.illusion.ts maps it)
 *   3. value validation / clamping   (coerce + mergeConfig below)
 *
 * Field shape:
 *   key      unique config key (flat object keeps CMS storage simple)
 *   type     'select' | 'range' | 'text' | 'toggle'
 *   when     optional (cfg) => boolean — only show the field when relevant
 *   help     one plain sentence shown under the control in the admin panel
 */

/**
 * De Stijl palette.
 * Mondrian's black / blue / white / yellow is, by coincidence, the exact
 * luminance ladder Akiyoshi Kitaoka used for "Rotating Snakes" — which is why
 * the peripheral-drift illusion works in this palette without compromise.
 */
export const STIJL = {
  red: '#d40920',
  blue: '#1356a2',
  yellow: '#f5d316',
  ink: '#000000',
  paper: '#eeeeea',
  gray: '#9a9a96',
};

const is = (key, ...values) => (cfg) => values.includes(cfg[key]);

/**
 * Black hole knobs, shared by the illusion stage and the cosmos world.
 * Units are Schwarzschild radii (r_s), the size of the event horizon.
 * @param {(cfg) => boolean} when  visibility rule for the admin panel
 */
export const BLACK_HOLE_FIELDS = (when) => [
  { key: 'bhDistance', label: 'Camera distance', type: 'range', min: 6, max: 60, step: 0.5, default: 22, unit: ' rₛ', when,
    help: 'Distance from the hole in event-horizon radii. Closer means stronger bending of the painting behind it.' },
  { key: 'bhInclination', label: 'View angle', type: 'range', min: -30, max: 60, step: 1, default: 7, unit: '°', when,
    help: 'Height above the disk. Near 0° the far side of the disk is lensed up over the hole.' },
  { key: 'bhOrbit', label: 'Orbit speed', type: 'range', min: 0, max: 20, step: 0.5, default: 3, unit: '°/s', when },
  { key: 'bhDisk', label: 'Accretion disk', type: 'toggle', default: true, when },
  { key: 'bhPalette', label: 'Disk palette', type: 'select', default: 'stijl', when,
    options: [['stijl', 'De Stijl'], ['blackbody', 'Blackbody']],
    help: 'De Stijl maps disk temperature to blue, red, yellow, white. Blackbody shows the physical color.' },
  { key: 'bhBeaming', label: 'Relativistic beaming', type: 'toggle', default: true, when,
    help: 'The side moving toward you is brighter and bluer. Turn off to compare with a stationary disk.' },
  { key: 'bhQuality', label: 'Render quality', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.6, when,
    help: 'Fraction of screen resolution traced. Lower is faster on phones.' },
];

/** Knobs for the physics-driven headline effects (spring, wave, tidal). */
export const PHYSICS_TEXT_FIELDS = (effect) => [
  { key: 'springStiffness', label: 'Stiffness', type: 'range', min: 20, max: 400, step: 5, default: 140, when: (c) => effect(c) === 'spring',
    help: 'Letters are masses on springs. Move the pointer through them.' },
  { key: 'springDamping', label: 'Damping ratio', type: 'range', min: 0.05, max: 1.2, step: 0.05, default: 0.28, when: (c) => effect(c) === 'spring',
    help: 'Below 1 the letters overshoot and ring. 1 is critical damping: no wobble.' },
  { key: 'waveSpeed', label: 'Wave speed', type: 'range', min: 4, max: 60, step: 1, default: 22, unit: ' letters/s', when: (c) => effect(c) === 'wave',
    help: 'Letters are beads on a string, solved with the wave equation. Sweep the pointer across them.' },
  { key: 'waveDamping', label: 'Wave damping', type: 'range', min: 0.2, max: 6, step: 0.1, default: 1.4, when: (c) => effect(c) === 'wave' },
  { key: 'tidalMass', label: 'Mass', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1, when: (c) => effect(c) === 'tidal',
    help: 'Letters are stretched by tidal force, which grows with the inverse cube of distance. The pointer (or the black hole) is the mass.' },
];

export const SCHEMA = [
  {
    id: 'background',
    label: 'Background illusion',
    fields: [
      { key: 'bgMode', label: 'Illusion', type: 'select', default: 'droste',
        options: [['droste', 'Infinite descent'], ['blackhole', 'Black hole'], ['ouchi', 'Floating island'], ['drift', 'Peripheral drift'],
          ['grid', 'Scintillating grid'], ['cafewall', 'Café wall'], ['stepping', 'Stepping feet'], ['pinna', 'Turning rings'], ['none', 'None']],
        help: 'Descent loops a self-similar composition. Black hole bends it with real light paths. The rest are patterns the eye turns into depth, flicker, tilt or motion.' },

      // --- Scintillating grid ----------------------------------------------
      { key: 'gridCell', label: 'Square size', type: 'range', min: 24, max: 140, step: 2, default: 64, unit: 'px', when: is('bgMode', 'grid'),
        help: 'Black dots flash in the discs you are not looking at. Nothing is drawn there.' },
      { key: 'gridStreet', label: 'Street width', type: 'range', min: 4, max: 28, step: 1, default: 11, unit: 'px', when: is('bgMode', 'grid') },
      { key: 'gridDisc', label: 'Disc size', type: 'range', min: 0, max: 32, step: 1, default: 15, unit: 'px', when: is('bgMode', 'grid'),
        help: 'Slightly wider than the street gives the strongest flicker. 0 shows the older Hermann grid (grey smudges).' },

      // --- Café wall --------------------------------------------------------
      { key: 'cafeTile', label: 'Tile size', type: 'range', min: 16, max: 120, step: 2, default: 54, unit: 'px', when: is('bgMode', 'cafewall'),
        help: 'Every mortar line is perfectly horizontal.' },
      { key: 'cafeShift', label: 'Row shift', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0.26, when: is('bgMode', 'cafewall'),
        help: 'Fraction of a tile each row shifts. At 0 or 0.5 the tilt disappears.' },
      { key: 'cafeMortar', label: 'Mortar', type: 'range', min: 1, max: 8, step: 1, default: 3, unit: 'px', when: is('bgMode', 'cafewall'),
        help: 'Thin grey mortar is essential. Thick mortar or black mortar kills the illusion.' },
      { key: 'cafePalette', label: 'Tiles', type: 'select', default: 'classic', when: is('bgMode', 'cafewall'),
        options: [['classic', 'Ink and paper'], ['stijl', 'Blue and yellow']] },

      // --- Stepping feet ----------------------------------------------------
      { key: 'stepSpeed', label: 'Speed', type: 'range', min: 20, max: 300, step: 5, default: 90, unit: 'px/s', when: is('bgMode', 'stepping'),
        help: 'The bars move at exactly this constant speed. They appear to walk.' },
      { key: 'stepStripe', label: 'Stripe width', type: 'range', min: 6, max: 40, step: 1, default: 16, unit: 'px', when: is('bgMode', 'stepping') },
      { key: 'stepReveal', label: 'Show "see the truth" button', type: 'toggle', default: true, when: is('bgMode', 'stepping'),
        help: 'Holding it lifts the stripes, and the bars are seen to glide steadily.' },

      // --- Pinna–Brelstaff ----------------------------------------------------
      { key: 'pinnaBreath', label: 'Approach period', type: 'range', min: 1, max: 8, step: 0.25, default: 3, unit: 's', when: is('bgMode', 'pinna'),
        help: 'The rings only grow and shrink. They seem to turn in opposite directions.' },
      { key: 'pinnaRings', label: 'Ring pairs', type: 'range', min: 1, max: 3, step: 1, default: 2, when: is('bgMode', 'pinna') },

      // --- Black hole (Schwarzschild ray tracer) --------------------------
      ...BLACK_HOLE_FIELDS((c) => c.bgMode === 'blackhole'),

      // --- Infinite descent (Droste loop) ---------------------------------
      { key: 'drosteSeconds', label: 'Seconds per level', type: 'range', min: 1, max: 16, step: 0.5, default: 5, unit: 's', when: is('bgMode', 'droste'),
        help: 'Time to fall through one frame. The loop is seamless, so this is the only speed.' },
      { key: 'drosteDirection', label: 'Direction', type: 'select', default: 'in', when: is('bgMode', 'droste'),
        options: [['in', 'Descend'], ['out', 'Ascend']] },
      { key: 'drosteRatio', label: 'Nesting ratio', type: 'range', min: 0.35, max: 0.85, step: 0.01, default: 0.6, when: is('bgMode', 'droste'),
        help: 'Size of each nested frame. Lower feels deeper and faster.' },
      { key: 'drosteTwist', label: 'Twist per level', type: 'range', min: -60, max: 60, step: 1, default: 14, unit: '°', when: is('bgMode', 'droste'),
        help: 'Any value other than zero turns the descent into a vortex.' },
      { key: 'drosteHorizon', label: 'Event horizon', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35, when: is('bgMode', 'droste'),
        help: 'Darkens the vanishing point so the fall reads as a black hole.' },
      { key: 'drosteFocusX', label: 'Vanishing point x', type: 'range', min: 5, max: 95, step: 1, default: 64, unit: '%', when: is('bgMode', 'droste') },
      { key: 'drosteFocusY', label: 'Vanishing point y', type: 'range', min: 5, max: 95, step: 1, default: 36, unit: '%', when: is('bgMode', 'droste') },
      { key: 'drosteLevels', label: 'Visible levels', type: 'range', min: 4, max: 12, step: 1, default: 9, when: is('bgMode', 'droste'),
        help: 'More levels look deeper but cost more to draw.' },
      { key: 'drosteLine', label: 'Line weight', type: 'range', min: 2, max: 24, step: 1, default: 10, unit: 'px', when: is('bgMode', 'droste') },
      { key: 'seed', label: 'Composition', type: 'range', min: 1, max: 9999, step: 1, default: 1917, when: is('bgMode', 'droste', 'blackhole'),
        help: 'Seed for which fields get color. Coverage never exceeds 37.5%.' },

      // --- Floating island (Ouchi illusion) -------------------------------
      { key: 'ouchiShape', label: 'Island shape', type: 'select', default: 'circle', when: is('bgMode', 'ouchi'),
        options: [['circle', 'Circle'], ['panel', 'Rectangle']] },
      { key: 'ouchiCell', label: 'Brick height', type: 'range', min: 4, max: 32, step: 1, default: 10, unit: 'px', when: (c) => c.bgMode === 'ouchi' || c.textEffect === 'ouchiText' },
      { key: 'ouchiAspect', label: 'Brick length', type: 'range', min: 2, max: 8, step: 0.5, default: 4, unit: '×', when: (c) => c.bgMode === 'ouchi' || c.textEffect === 'ouchiText' },
      { key: 'ouchiJitter', label: 'Tremor', type: 'range', min: 0, max: 10, step: 0.5, default: 3, unit: 'px', when: (c) => c.bgMode === 'ouchi' || c.textEffect === 'ouchiText',
        help: 'A tiny circular drift of the pattern. The island appears to slide on its own plane.' },

      // --- Peripheral drift (Kitaoka) -------------------------------------
      { key: 'driftCell', label: 'Disc size', type: 'range', min: 48, max: 260, step: 2, default: 132, unit: 'px', when: is('bgMode', 'drift'),
        help: 'Nothing here moves. Discs appear to turn in the corner of your eye, then stop when you look at them.' },
      { key: 'driftGround', label: 'Ground', type: 'select', default: 'gray', when: is('bgMode', 'drift'),
        options: [['gray', 'Gray'], ['paper', 'Paper'], ['red', 'Red']] },

      // --- Frame (any mode) -----------------------------------------------
      { key: 'frameStyle', label: 'Page frame', type: 'select', default: 'none',
        options: [['none', 'None'], ['solid', 'Black line'], ['crawl', 'Crawling line']],
        help: 'Crawling line is a static drift pattern: the border seems to travel.' },
    ],
  },
  {
    id: 'text',
    label: 'Headline',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', default: 'Hoc omnia nihil est' },
      { key: 'subline', label: 'Supporting line', type: 'text', default: 'Studio of Jonathan Mark Reback' },
      { key: 'textEffect', label: 'Effect', type: 'select', default: 'motion',
        options: [
          ['motion', 'Visible only in motion'],
          ['afterimage', 'Afterimage'],
          ['crawl', 'Crawling letters'],
          ['lenticular', 'Lenticular flip'],
          ['chromo', 'Floating red'],
          ['anaglyph', 'Anaglyph'],
          ['ouchiText', 'Floating letters'],
          ['spring', 'Spring letters'],
          ['wave', 'Wave letters'],
          ['tidal', 'Tidal letters'],
          ['plain', 'Plain'],
        ] },

      ...PHYSICS_TEXT_FIELDS((c) => c.textEffect),
      { key: 'copyBacking', label: 'Backing', type: 'select', default: 'paper',
        options: [['paper', 'Paper field'], ['none', 'None']],
        when: is('textEffect', 'crawl', 'lenticular', 'anaglyph', 'plain', 'spring', 'wave', 'tidal'),
        help: 'Puts the headline on its own framed field so busy backgrounds stay behind it.' },

      // --- Motion-defined text --------------------------------------------
      { key: 'motionSpeed', label: 'Noise speed', type: 'range', min: 10, max: 240, step: 5, default: 70, unit: 'px/s', when: is('textEffect', 'motion'),
        help: 'Letters are the same noise as their surroundings, moving the other way. Only motion reveals them.' },
      { key: 'motionGrain', label: 'Grain', type: 'range', min: 1, max: 6, step: 1, default: 2, unit: 'px', when: is('textEffect', 'motion') },
      { key: 'motionDensity', label: 'Density', type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.5, when: is('textEffect', 'motion') },
      { key: 'motionFreeze', label: 'Freeze to hide the word', type: 'toggle', default: false, when: is('textEffect', 'motion') },

      // --- Afterimage -----------------------------------------------------
      { key: 'afterTarget', label: 'Ghost color', type: 'select', default: 'red', when: is('textEffect', 'afterimage'),
        options: [['red', 'Red'], ['blue', 'Blue'], ['yellow', 'Yellow']],
        help: 'The word is shown in the opposite color. When it disappears, the eye paints it back in this one.' },
      { key: 'afterHold', label: 'Stare time', type: 'range', min: 4, max: 30, step: 1, default: 14, unit: 's', when: is('textEffect', 'afterimage') },
      { key: 'afterGhost', label: 'Ghost time', type: 'range', min: 2, max: 12, step: 1, default: 6, unit: 's', when: is('textEffect', 'afterimage') },

      // --- Crawling letters -----------------------------------------------
      { key: 'crawlPeriod', label: 'Stripe period', type: 'range', min: 8, max: 80, step: 1, default: 26, unit: 'px', when: is('textEffect', 'crawl'),
        help: 'Letters filled with a luminance ramp seem to creep sideways. Nothing is animated.' },
      { key: 'crawlAngle', label: 'Stripe angle', type: 'range', min: 0, max: 180, step: 5, default: 90, unit: '°', when: is('textEffect', 'crawl') },

      // --- Lenticular -----------------------------------------------------
      { key: 'lentAlt', label: 'Hidden headline', type: 'text', default: 'All this is nothing', when: is('textEffect', 'lenticular') },
      { key: 'lentSource', label: 'Flip with', type: 'select', default: 'pointer', when: is('textEffect', 'lenticular'),
        options: [['pointer', 'Pointer or tilt'], ['scroll', 'Scroll'], ['auto', 'Slow automatic sway']] },
      { key: 'lentStripe', label: 'Slat width', type: 'range', min: 2, max: 16, step: 1, default: 5, unit: 'px', when: is('textEffect', 'lenticular') },

      // --- Chromostereopsis / anaglyph ------------------------------------
      { key: 'chromoGround', label: 'Field', type: 'select', default: 'blue', when: is('textEffect', 'chromo'),
        options: [['blue', 'Blue'], ['ink', 'Black']],
        help: 'Saturated red on blue focuses at a different depth in the eye, so the letters appear to float. No glasses needed.' },
      { key: 'anaglyphDepth', label: 'Depth', type: 'range', min: 1, max: 16, step: 1, default: 5, unit: 'px', when: is('textEffect', 'anaglyph'),
        help: 'Red and cyan offsets. With red-cyan glasses the headline pops forward; without, it reads as a print misregistration.' },
    ],
  },
  {
    id: 'access',
    label: 'Accessibility',
    fields: [
      { key: 'previewReducedMotion', label: 'Preview reduced motion', type: 'toggle', default: false,
        help: 'Shows what visitors who ask for less motion will see. Their setting always applies.' },
    ],
  },
];

/**
 * Build a config toolkit (fields, defaults, merge, diff) from any schema.
 * The illusion stage uses SCHEMA; the cosmos world uses its own schema with
 * the same machinery, so both get the admin panel and CMS form for free.
 */
export function defineConfig(schema) {
  const fields = Object.fromEntries(schema.flatMap((s) => s.fields).map((f) => [f.key, f]));
  const defaults = Object.freeze(Object.fromEntries(Object.values(fields).map((f) => [f.key, f.default])));
  return {
    schema,
    fields,
    defaults,
    /** Defaults + a partial config, with unknown keys dropped and values coerced. */
    merge(partial = {}) {
      const out = { ...defaults };
      for (const [key, value] of Object.entries(partial || {})) {
        if (fields[key] && value !== undefined && value !== null) out[key] = coerce(fields[key], value);
      }
      return out;
    },
    /** Only the values that differ from defaults — what "Copy settings" exports. */
    diff(cfg) {
      return Object.fromEntries(Object.entries(cfg).filter(([k, v]) => k in defaults && defaults[k] !== v));
    },
  };
}

/** Make any incoming value (CMS, localStorage, URL, admin) safe for its field. */
export function coerce(field, value) {
  switch (field.type) {
    case 'range': {
      const n = Number(value);
      if (!Number.isFinite(n)) return field.default;
      return Math.min(field.max, Math.max(field.min, n));
    }
    case 'select':
      return field.options.some(([v]) => v === value) ? value : field.default;
    case 'toggle':
      return value === true || value === 'true' || value === 1;
    case 'text':
      return typeof value === 'string' ? value.slice(0, 120) : field.default;
    default:
      return field.default;
  }
}

/** The illusion stage's toolkit, plus the original named exports (unchanged API). */
export const ILLUSION_CONFIG = defineConfig(SCHEMA);
export const FIELDS = ILLUSION_CONFIG.fields;
export const DEFAULTS = ILLUSION_CONFIG.defaults;
export const mergeConfig = (partial) => ILLUSION_CONFIG.merge(partial);
export const diffFromDefaults = (cfg) => ILLUSION_CONFIG.diff(cfg);

/** Small seeded PRNG (mulberry32), same idea as the layout engine's seeding. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escape text before it goes into innerHTML. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
