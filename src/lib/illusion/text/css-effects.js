/**
 * text/css-effects.js
 * ---------------------------------------------------------------------------
 * Headline effects where CSS does the drawing. Each module only writes
 * markup and (for lenticular) a single custom property per frame.
 *
 * Every effect keeps the real text in a visually hidden span for screen
 * readers; the decorated copy is aria-hidden.
 */
import { escapeHtml } from '../config.js';

/** Helper: build a module that swaps in markup and cleans up after itself. */
function markupEffect(id, render) {
  return {
    id,
    mount(headline, cfg) {
      const text = headline.dataset.text || '';
      headline.innerHTML = render(escapeHtml(text), cfg);
      return {
        update() {},
        destroy() { headline.textContent = text; },
      };
    },
  };
}

const sr = (t) => `<span class="ill-sr">${t}</span>`;

/**
 * "Crawling letters" — the peripheral-drift ramp (black → blue → paper →
 * yellow) clipped into the glyphs. Letters seem to creep along the ramp's
 * direction, most strongly just outside where you're looking.
 */
export const crawlText = markupEffect('crawl', (t) =>
  `${sr(t)}<span class="ill-crawl" aria-hidden="true">${t}</span>`);

/**
 * "Floating red" — chromostereopsis. The eye's lens focuses red and blue at
 * slightly different depths, so saturated red on blue appears to sit in
 * front of the field. Works without glasses; strongest on large, bold type.
 */
export const chromoText = markupEffect('chromo', (t) =>
  `${sr(t)}<span class="ill-chromo" aria-hidden="true">${t}</span>`);

/** "Anaglyph" — red/cyan offset copies, multiplied. Stereo depth with glasses. */
export const anaglyphText = markupEffect('anaglyph', (t) =>
  `${sr(t)}<span class="ill-anaglyph" data-text="${t}" aria-hidden="true">${t}</span>`);

/**
 * "Floating letters" — the Ouchi illusion applied to type: vertical bricks
 * inside the letters, horizontal bricks around them, sharing the stage's
 * tremor. The letters appear to hover and slide independently.
 */
export const ouchiText = markupEffect('ouchiText', (t) =>
  `${sr(t)}<span class="ill-ouchi-field" aria-hidden="true"><span class="ill-ouchi-text">${t}</span></span>`);

export const plainText = markupEffect('plain', (t) => t);

/**
 * "Lenticular flip" — two headlines interleaved as slats, like a ridged
 * postcard. The slat duty cycle follows the pointer (or device tilt,
 * scroll, or a slow sway), so one headline "turns" into the other.
 */
export const lenticularText = {
  id: 'lenticular',

  mount(headline, cfg, ctx) {
    const text = headline.dataset.text || '';
    let current = cfg;
    let shown = 1;   // smoothed 0 → 1 (1 = primary headline)
    let clock = 0;
    let tilt = null;

    function render(c) {
      headline.innerHTML =
        `${sr(escapeHtml(text))}` +
        '<span class="ill-lent" aria-hidden="true">' +
          `<span class="ill-lent__a">${escapeHtml(text)}</span>` +
          `<span class="ill-lent__b">${escapeHtml(c.lentAlt)}</span>` +
        '</span>';
    }
    render(cfg);

    // Phones: device tilt stands in for the pointer (where the browser allows it).
    const onTilt = (e) => { if (e.gamma != null) tilt = Math.min(1, Math.max(0, (e.gamma + 30) / 60)); };
    window.addEventListener('deviceorientation', onTilt);

    function target() {
      switch (current.lentSource) {
        case 'scroll': {
          const r = headline.getBoundingClientRect();
          const mid = (r.top + r.height / 2) / window.innerHeight; // 0 top → 1 bottom
          return Math.min(1, Math.max(0, (mid - 0.2) / 0.6));
        }
        case 'auto':
          return ctx.reducedMotion() ? 1 : 0.5 + 0.5 * Math.sin(clock / 1600);
        default:
          return tilt ?? 1 - ctx.pointer.x;
      }
    }

    return {
      update(next) {
        const rerender = next.lentAlt !== current.lentAlt;
        current = next;
        if (rerender) render(next);
      },
      tick(dt) {
        clock += dt;
        // Ease toward the target so the flip feels like turning a card.
        shown += (target() - shown) * Math.min(1, dt / 120);
        headline.style.setProperty('--ill-p', shown.toFixed(3));
      },
      destroy() {
        window.removeEventListener('deviceorientation', onTilt);
        headline.style.removeProperty('--ill-p');
        headline.textContent = text;
      },
    };
  },
};
