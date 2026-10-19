/**
 * stijl/deck.js — keyboard and counter for a presentation deck
 * ---------------------------------------------------------------------------
 * Slides snap with CSS scroll-snap; this adds ←/→, PageUp/PageDown, Home/End
 * and a live "3 / 9" counter (an analog LCD if analog.css is loaded).
 *
 * updateHash: keep #slide-N in the URL (deep links). Only for a deck that is
 * the whole page: writing a fragment makes the browser scroll the page to it.
 */
export function mountDeck(deck, counter, { updateHash = true } = {}) {
  const slides = [...deck.querySelectorAll('.deck__slide')];
  let current = 0;
  const go = (i) => {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides[current].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio > 0.6) {
        current = slides.indexOf(e.target);
        if (counter) counter.textContent = `${current + 1} / ${slides.length}`;
        if (updateHash) history.replaceState(null, '', `#slide-${current + 1}`);
      }
    }
  }, { root: deck, threshold: [0.6] });
  slides.forEach((s) => io.observe(s));
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); go(current + 1); }
    if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); go(current - 1); }
    if (k === 'Home') { e.preventDefault(); go(0); }
    if (k === 'End') { e.preventDefault(); go(slides.length - 1); }
  };
  deck.addEventListener('keydown', onKey);
  const start = Number(location.hash.match(/slide-(\d+)/)?.[1] ?? 1) - 1;
  if (start > 0) slides[start]?.scrollIntoView();
  return { go, destroy() { io.disconnect(); deck.removeEventListener('keydown', onKey); } };
}
