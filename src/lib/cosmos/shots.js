/**
 * cosmos/shots.js — pre-planned camera moves, bound to clicks and actions
 * ---------------------------------------------------------------------------
 * A shot is choreography for the viewfinder: a list of steps, each a flight
 * to somewhere, an optional Ken Burns hold, and what the title card and
 * focus do on arrival. Shots are data (JSON, or the Keystatic "Shots"
 * collection), so they can be authored without code.
 *
 *   {
 *     id: 'projects-reveal',
 *     trigger: { on: 'click', route: 'projects' },   // click | load | idle | manual
 *     loop: false,
 *     steps: [
 *       { to: 'projects', fit: 'frame', speed: 0.8, hold: 2.5, push: 1.06 },
 *       { to: 'projects/cosmos', fit: 'fill', ease: 'expo', hold: 3, push: 1.1, pan: [0.04, 0] },
 *       { to: [6000, 3800, 2400] },                    // any view: [x, y, width]
 *     ],
 *   }
 *
 * Step fields
 *   to       route ('' or 'overview' = home), or a view [x, y, w] (Alt+Shift+V copies the current one)
 *   fit      'frame' | 'fill' (default: the Arrival setting)
 *   speed    multiplies the global flight speed        (0.1–5, default 1)
 *   ease     'sine' | 'cubic' | 'expo' | 'linear'       (default: the Easing setting)
 *   hold     seconds of Ken Burns drift after arriving  (0 = move straight on)
 *   push     how far the hold pushes in                 (1 = static, 1.1 = 10% closer)
 *   pan      sideways drift during the hold, as a fraction of the view [dx, dy]
 *   focus    'map' (rack to the title, then back) | 'near' (stay on the title)
 *   title    override the title card text; announce: false skips the card
 *
 * Triggers
 *   click   plays instead of the normal flight when that route is clicked.
 *           Any element with data-shot="id" (a nav link, a button in CMS text) also plays it.
 *   load    plays once when the page opens (no deep link).
 *   idle    plays after `seconds` without input (attract mode); any movement stops it.
 *   manual  only via cosmos.play('id').
 * Any input (drag, wheel, key, click) stops a shot; the camera glides to rest.
 */
import { EASINGS } from './math/spring.js';

/**
 * @typedef {object} ShotStep
 * @property {string | number[]} to
 * @property {'frame' | 'fill' | ''} [fit]
 * @property {number} [speed]
 * @property {'sine' | 'cubic' | 'expo' | 'linear' | ''} [ease]
 * @property {number} [hold]
 * @property {number} [push]
 * @property {number[]} [pan]
 * @property {number} [panX]    CMS form of pan
 * @property {number} [panY]
 * @property {'map' | 'near'} [focus]
 * @property {string} [title]
 * @property {boolean} [announce]
 *
 * @typedef {object} Shot
 * @property {string} id
 * @property {{ on: 'click' | 'load' | 'idle' | 'manual', route?: string, seconds?: number }} trigger
 * @property {boolean} [loop]
 * @property {ShotStep[]} steps
 */

const clampNum = (v, min, max, d) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : d);

/** Make author data safe: unknown values become defaults, numbers are clamped. */
export function normalizeShot(raw = {}) {
  const on = ['click', 'load', 'idle', 'manual'].includes(raw.trigger?.on) ? raw.trigger.on : 'manual';
  return {
    id: String(raw.id ?? '').slice(0, 60),
    trigger: { on, route: String(raw.trigger?.route ?? '').replace(/^#?\/?/, ''), seconds: clampNum(raw.trigger?.seconds, 3, 600, 30) },
    loop: raw.loop === true,
    steps: (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 40).map((s = {}) => ({
      to: Array.isArray(s.to) && s.to.length === 3 ? s.to.map(Number) : String(s.to ?? '').replace(/^#?\/?/, ''),
      fit: ['frame', 'fill'].includes(s.fit) ? s.fit : null,
      speed: clampNum(s.speed, 0.1, 5, 1),
      ease: s.ease in EASINGS ? s.ease : null,
      hold: clampNum(s.hold, 0, 60, 0),
      push: clampNum(s.push, 1, 2, 1),
      pan: Array.isArray(s.pan) ? [clampNum(s.pan[0], -1, 1, 0), clampNum(s.pan[1], -1, 1, 0)] : [0, 0],
      focus: s.focus === 'near' ? 'near' : 'map',
      title: s.title == null || s.title === '' ? null : String(s.title).slice(0, 80),
      announce: s.announce !== false,
    })),
  };
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./camera.js').createCamera>} deps.camera
 * @param {(step) => ({ view, focusPoint?, title, sub, route } | null)} deps.resolve   where a step goes
 * @param {(dest, step) => void} deps.arrive     title card, focus, URL on arrival
 * @param {(id: string|null) => void} [deps.onState]   which shot is playing (null = none)
 */
export function createDirector({ camera, resolve, arrive, onState }) {
  let run = 0; // increments to cancel the current shot
  let current = null;

  function end(id) {
    if (id !== run) return;
    run++;
    current = null;
    onState?.(null);
  }

  async function play(shot) {
    const id = ++run;
    current = shot.id;
    onState?.(shot.id);
    do {
      for (const step of shot.steps) {
        if (id !== run) return;
        const dest = resolve(step);
        if (!dest) continue;
        const arrived = await camera.flyTo(dest.view, { speed: step.speed, ease: step.ease ?? undefined });
        if (!arrived || id !== run) return end(id);
        if (step.announce) arrive(dest, step);
        if (step.hold > 0) {
          // Ken Burns: push toward the subject a third of the way, plus any pan.
          const [x, y, w] = dest.view;
          const [fx, fy] = dest.focusPoint ?? [x, y];
          const target = [x + (fx - x) / 3 + step.pan[0] * w, y + (fy - y) / 3 + step.pan[1] * w, w / step.push];
          const held = await camera.driftTo(target, step.hold);
          if (!held || id !== run) return end(id);
        }
      }
    } while (shot.loop && id === run);
    end(id);
  }

  return {
    play,
    stop: () => { if (current) end(run); },
    playing: () => current,
  };
}
