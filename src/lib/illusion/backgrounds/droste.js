/**
 * backgrounds/droste.js — "Infinite descent"
 * ---------------------------------------------------------------------------
 * The illusion: a composition contains a smaller copy of itself, which
 * contains a smaller copy, and so on. Zooming by exactly one level makes
 * level 2 land precisely where level 1 was, so the loop has no seam and the
 * fall never ends. With a twist per level it becomes a vortex.
 *
 * Why it's cheap: only ONE element animates (the zoom wrapper, transform
 * only, compositor-friendly). The nested levels are static DOM built once.
 *
 * Two details that make it seamless:
 *   1. Every level is identical, including its frame, so level N+1 scaled up
 *      is pixel-identical to level N.
 *   2. Zoom is exponential, not linear: scale = (1/r)^p. Linear interpolation
 *      between 1 and 1/r would slow down across each level and "pulse".
 *
 * Mondrian discipline: each level is a 3×3 guillotine split around the
 * nested window, lines are the ink background showing through grid gaps
 * (same technique as the layout engine), and colored fields are capped at
 * 37.5% of the canvas.
 */
import { STIJL, seededRandom } from '../config.js';

/** Keys that change the DOM structure (everything else is a CSS var or timing). */
const STRUCTURAL = ['drosteLevels', 'drosteRatio', 'drosteFocusX', 'drosteFocusY', 'seed'];
const COLOR_CAP = 0.375;

/**
 * Decide which of the 8 fields around the window get color.
 * Returns an array of 9 colors (index 4, the window, is never painted).
 */
function composeFields(cfg) {
  const r = cfg.drosteRatio;
  const fx = cfg.drosteFocusX / 100;
  const fy = cfg.drosteFocusY / 100;
  const cols = [fx * (1 - r), r, (1 - fx) * (1 - r)];
  const rows = [fy * (1 - r), r, (1 - fy) * (1 - r)];

  const rand = seededRandom(cfg.seed);
  const around = [0, 1, 2, 3, 5, 6, 7, 8].sort(() => rand() - 0.5);
  const hues = [STIJL.red, STIJL.yellow, STIJL.blue];
  const fills = Array(9).fill(STIJL.paper);

  let covered = 0;
  for (const i of around) {
    if (!hues.length) break;
    const area = cols[i % 3] * rows[Math.floor(i / 3)];
    if (covered + area > COLOR_CAP) continue; // skip fields that would break the cap
    fills[i] = hues.shift();
    covered += area;
  }
  return { cols, rows, fills };
}

function buildLevels(zoom, cfg) {
  const { cols, rows, fills } = composeFields(cfg);
  const cells = fills
    .map((fill, i) => `<div class="ill-droste__cell${i === 4 ? ' ill-droste__cell--window' : ''}" style="background:${fill}"></div>`)
    .join('');
  const grid = `grid-template-columns:${cols.map((c) => `${c.toFixed(4)}fr`).join(' ')};grid-template-rows:${rows.map((c) => `${c.toFixed(4)}fr`).join(' ')}`;

  zoom.replaceChildren();
  let parent = zoom;
  for (let i = 0; i < cfg.drosteLevels; i++) {
    const level = document.createElement('div');
    level.className = 'ill-droste__level';
    level.setAttribute('style', grid);
    level.innerHTML = cells;
    parent.append(level);
    parent = level; // nest: each level is a child of the previous one
  }
}

export const drosteBackground = {
  id: 'droste',

  /**
   * @param {HTMLElement} host  background layer element
   * @param {object} cfg        merged config
   * @param {object} ctx        stage context ({ reducedMotion(), stage })
   */
  mount(host, cfg, ctx) {
    const root = document.createElement('div');
    root.className = 'ill-droste';
    root.innerHTML = '<div class="ill-droste__zoom"></div><div class="ill-droste__horizon"></div>';
    host.append(root);
    const zoom = root.firstElementChild;

    let current = null;
    let phase = 0; // 0 → 1 = one full level of descent

    function applyPhase(p) {
      const c = current;
      const q = c.drosteDirection === 'out' ? 1 - p : p;
      const scale = Math.pow(1 / c.drosteRatio, q);
      const turn = -c.drosteTwist * q;
      zoom.style.transform = `rotate(${turn.toFixed(3)}deg) scale(${scale.toFixed(5)})`;
    }

    function update(next) {
      const structural = !current || STRUCTURAL.some((k) => next[k] !== current[k]);
      current = next;
      root.style.setProperty('--ill-r', next.drosteRatio);
      root.style.setProperty('--ill-twist', `${next.drosteTwist}deg`);
      root.style.setProperty('--ill-line', `${next.drosteLine}px`);
      root.style.setProperty('--ill-fx', `${next.drosteFocusX}%`);
      root.style.setProperty('--ill-fy', `${next.drosteFocusY}%`);
      root.style.setProperty('--ill-horizon', next.drosteHorizon);
      if (structural) buildLevels(zoom, next);
      applyPhase(phase);
    }

    update(cfg);

    return {
      update,
      /** Called every frame by the stage's shared clock. */
      tick(dt) {
        if (ctx.reducedMotion()) {
          // Reduced motion: hold a still frame of the composition.
          if (phase !== 0) { phase = 0; applyPhase(0); }
          return;
        }
        phase = (phase + dt / (current.drosteSeconds * 1000)) % 1;
        applyPhase(phase);
      },
      destroy() {
        root.remove();
      },
    };
  },
};
