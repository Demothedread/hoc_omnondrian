/**
 * cosmos/schema.js — settings for the cosmos world
 * ---------------------------------------------------------------------------
 * Same format as illusion/config.js SCHEMA, so the same admin panel and the
 * same Keystatic generator work unchanged (see keystatic.illusion.ts).
 */
import { defineConfig, BLACK_HOLE_FIELDS, PHYSICS_TEXT_FIELDS } from '../illusion/config.js';

const always = () => true;

export const COSMOS_SCHEMA = [
  {
    id: 'flight',
    label: 'Point and go',
    fields: [
      { key: 'flightSpeed', label: 'Flight speed', type: 'range', min: 0.3, max: 3, step: 0.05, default: 0.9, unit: '×',
        help: 'Duration follows the length of the optimal path, so long trips take longer, as they should.' },
      { key: 'flightArc', label: 'Climb', type: 'range', min: 0.6, max: 2.6, step: 0.05, default: 1.6,
        help: 'How high the camera rises between places. 1.41 is the researched optimum; higher is more cinematic.' },
      { key: 'flightEase', label: 'Easing', type: 'select', default: 'sine',
        options: [['sine', 'Gentle (sine)'], ['cubic', 'Firm (cubic)'], ['expo', 'Snap and glide'], ['linear', 'Constant speed']],
        help: 'How flights leave and arrive. Shots can override this per step.' },
      { key: 'arrivalFit', label: 'Arrival', type: 'select', default: 'fill',
        options: [['fill', 'Field fills the screen'], ['frame', 'Field framed by its lines']],
        help: 'Clicking a colour field tracks and zooms until it fills the screen, or stops with its black lines in view.' },
      { key: 'flightTilt', label: 'Tilt in flight', type: 'range', min: 0, max: 55, step: 1, default: 34, unit: '°',
        help: 'The map tips away from the camera while travelling, then lies flat on arrival.' },
      { key: 'riseHeight', label: 'Rising fields', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6,
        help: 'Coloured fields lift off the map in flight, like the towers in a title sequence.' },
    ],
  },
  {
    id: 'return',
    label: 'Return home',
    fields: [
      { key: 'returnHome', label: 'Going back', type: 'select', default: 'hole',
        options: [['hole', 'Sucked into the singularity'], ['zoom', 'Zoom out']],
        help: 'Sucked in: pinching in, scrolling back or choosing Overview pulls the screen into a black hole, curls the site into a sphere, and zooms into it to land on the main page.' },
      { key: 'backGesture', label: 'Scroll back direction', type: 'select', default: 'up',
        options: [['up', 'Scroll up'], ['down', 'Scroll down']],
        help: 'Which wheel direction means back. The other zooms in. Pinching fingers together always means back.' },
      { key: 'warpSpeed', label: 'Warp speed', type: 'range', min: 0.4, max: 2.5, step: 0.05, default: 1, unit: '×',
        help: 'Speed of the whole sequence: sucked in, curled into a sphere, dropped, zoomed into.' },
      { key: 'warpSwirl', label: 'Spiral', type: 'range', min: 0, max: 2, step: 0.05, default: 1,
        help: 'How hard the page spirals as it falls (angular momentum). 0 falls straight in.' },
      { key: 'warpStreaks', label: 'Hyperspace streaks', type: 'toggle', default: true },
      { key: 'warpBackdrop', label: 'Backdrop', type: 'select', default: 'black',
        options: [['black', 'All black'], ['white', 'All white']],
        help: 'What the shrunken sphere floats in.' },
      { key: 'sphereSize', label: 'Smallest sphere', type: 'range', min: 2, max: 40, step: 1, default: 8, unit: 'px' },
      { key: 'sphereDrop', label: 'Sphere drop', type: 'select', default: 'bounce',
        options: [['bounce', 'Drop and bounce'], ['fall', 'Drop'], ['none', 'Hang still']] },
    ],
  },
  {
    id: 'kenburns',
    label: 'Ken Burns tour',
    fields: [
      { key: 'tourHold', label: 'Time at each stop', type: 'range', min: 2, max: 14, step: 0.5, default: 6, unit: 's' },
      { key: 'tourDrift', label: 'Push-in', type: 'range', min: 1, max: 1.4, step: 0.01, default: 1.12, unit: '×',
        help: 'How far the camera slowly pushes toward the subject while holding.' },
      { key: 'tourLoop', label: 'Loop the tour', type: 'toggle', default: true },
      { key: 'tourAutoplay', label: 'Start tour on load', type: 'toggle', default: false },
    ],
  },
  {
    id: 'focus',
    label: 'Rack focus',
    fields: [
      { key: 'lensFocal', label: 'Focal length', type: 'range', min: 24, max: 200, step: 1, default: 50, unit: 'mm',
        help: 'Longer lenses have shallower depth of field.' },
      { key: 'lensAperture', label: 'Aperture', type: 'range', min: 1.2, max: 16, step: 0.1, default: 2, unit: '',
        help: 'f-number. Lower is wider open and blurrier outside the focus plane.' },
      { key: 'focusPull', label: 'Focus pull time', type: 'range', min: 0.2, max: 3, step: 0.1, default: 0.9, unit: 's' },
      { key: 'breathing', label: 'Focus breathing', type: 'range', min: 0, max: 2, step: 0.1, default: 1,
        help: 'Real lenses change magnification slightly as they focus. 1 is physically accurate.' },
      { key: 'rackOnArrival', label: 'Rack to the title on arrival', type: 'toggle', default: true },
    ],
  },
  {
    id: 'title',
    label: 'Title card',
    fields: [
      { key: 'titleText', label: 'Site title', type: 'text', default: 'Hoc omnia nihil est' },
      { key: 'titleEffect', label: 'Title effect', type: 'select', default: 'wave',
        options: [['wave', 'Wave letters'], ['spring', 'Spring letters'], ['tidal', 'Tidal letters'], ['plain', 'Plain']] },
      ...PHYSICS_TEXT_FIELDS((c) => c.titleEffect),
    ],
  },
  {
    id: 'hole',
    label: 'Black hole',
    fields: [
      { key: 'boundless', label: 'Fall in from the main page', type: 'toggle', default: true,
        help: 'At the main page, pushing back further approaches the ray-traced black hole, orbits it, then falls in through the warp sequence.' },
      { key: 'holeLinger', label: 'Orbit before falling', type: 'range', min: 0, max: 20, step: 0.5, default: 4, unit: 's',
        help: 'Time spent orbiting the ray-traced hole. Any click or scroll starts the fall (the warp sequence).' },
      ...BLACK_HOLE_FIELDS(always),
    ],
  },
  {
    id: 'finish',
    label: 'Finish',
    fields: [
      { key: 'finish', label: 'Look', type: 'select', default: 'analog',
        options: [['analog', 'Analog: bezel, film, relief'], ['flat', 'Flat De Stijl']],
        help: 'Analog frames the world in a viewfinder with embossed paint, keycap buttons and a lens data strip.' },
      { key: 'typeface', label: 'Type', type: 'select', default: 'workshop', when: (c) => c.finish === 'analog',
        options: [['workshop', 'Workshop (geometric, engraved, typewritten)'], ['poster', 'Poster (condensed)'], ['typewriter', 'Typewriter']] },
      { key: 'grain', label: 'Paper grain', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0, when: (c) => c.finish === 'analog',
        help: 'A still texture over the frame. It never animates.' },
      { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5, when: (c) => c.finish === 'analog' },
      { key: 'bezel', label: 'Bezel', type: 'range', min: 0, max: 40, step: 1, default: 14, unit: 'px', when: (c) => c.finish === 'analog' },
      { key: 'emboss', label: 'Painted relief', type: 'toggle', default: true, when: (c) => c.finish === 'analog' },
      { key: 'weave', label: 'Gate weave', type: 'toggle', default: false, when: (c) => c.finish === 'analog',
        help: 'The picture shivers a fraction of a pixel, like film in a projector gate, more while moving.' },
    ],
  },
  {
    id: 'sound',
    label: 'Sound',
    fields: [
      { key: 'soundVolume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6,
        help: 'Sound starts off; visitors switch it on with the Sound key. Everything is synthesized live.' },
      { key: 'soundAmbient', label: 'Room tone and crackle', type: 'toggle', default: true },
      { key: 'soundFall', label: 'Endless falling tone', type: 'toggle', default: true,
        help: 'A Shepard–Risset glissando during the trip home: it keeps falling without ever getting lower.' },
    ],
  },
  {
    id: 'world',
    label: 'World',
    fields: [
      { key: 'skyStyle', label: 'Sky', type: 'select', default: 'rings',
        options: [['rings', 'Turning rings (Pinna)'], ['grid', 'Scintillating grid'], ['stars', 'Stars']],
        help: 'What shows around the map and under it in flight. The rings appear to turn as you zoom.' },
      { key: 'seed', label: 'Composition', type: 'range', min: 1, max: 9999, step: 1, default: 1917,
        help: 'Seed for the map. Content keeps its place in the same-sized regions.' },
      { key: 'previewReducedMotion', label: 'Preview reduced motion', type: 'toggle', default: false,
        help: 'Flights become cuts and the fall becomes a fade.' },
    ],
  },
];

export const COSMOS_CONFIG = defineConfig(COSMOS_SCHEMA);
