/**
 * text/afterimage.js — "Afterimage"
 * ---------------------------------------------------------------------------
 * The illusion (negative afterimage): stare at a color and the cones tuned
 * to it tire. When the stimulus disappears, the neutral field is read as
 * lacking that color, so you see its complement. Show the headline in
 * CYAN and, after the stare, your eye paints it back in Mondrian RED on a
 * blank gray field. The page never renders the red word at all.
 *
 * Cycle: stare (word shown, meter fills) → ghost (word removed) → repeat.
 * The instruction line is real, visible copy: this illusion only works if
 * the visitor knows to hold their gaze on the dot.
 */
import { escapeHtml } from '../config.js';

/** Complements of the De Stijl hues (what we show to get each ghost). */
const COMPLEMENT = {
  red: '#2bf6df',    // → red ghost
  blue: '#eca95d',   // → blue ghost
  yellow: '#0a2ce9', // → yellow ghost
};

export const afterimageText = {
  id: 'afterimage',

  mount(headline, cfg, ctx) {
    const text = headline.dataset.text || '';
    headline.innerHTML =
      `<span class="ill-sr">${escapeHtml(text)}</span>` +
      '<span class="ill-after" aria-hidden="true">' +
        `<span class="ill-after__word">${escapeHtml(text)}</span>` +
        '<span class="ill-after__dot"></span>' +
        '<span class="ill-after__meter"><span></span></span>' +
      '</span>' +
      '<span class="ill-after__hint">Keep your eyes on the dot until the word disappears.</span>';

    const field = headline.querySelector('.ill-after');
    const meter = headline.querySelector('.ill-after__meter > span');
    let current = cfg;
    let elapsed = 0;

    function update(next) {
      current = next;
      field.style.setProperty('--ill-after-ink', COMPLEMENT[next.afterTarget]);
    }
    update(cfg);

    return {
      update,
      tick(dt) {
        const hold = current.afterHold * 1000;
        const ghost = current.afterGhost * 1000;
        elapsed = (elapsed + dt) % (hold + ghost);
        const staring = elapsed < hold;
        field.dataset.phase = staring ? 'stare' : 'ghost';
        meter.style.transform = `scaleX(${staring ? (elapsed / hold).toFixed(3) : 0})`;
        field.classList.toggle('is-instant', ctx.reducedMotion());
      },
      destroy() {
        headline.textContent = text;
      },
    };
  },
};
