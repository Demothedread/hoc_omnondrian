/**
 * stijl/assemble.js — start each composition's assembly when it scrolls into view
 * ---------------------------------------------------------------------------
 * Adds [data-assemble] (hidden start state) only when JavaScript runs and
 * motion is allowed, then .is-in once the section is 15% visible. Without JS
 * the finished compositions simply show.
 */
export function assembleAll(root = document) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...root.querySelectorAll('.stijl:not([data-assemble])')];
  if (still || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { threshold: 0.15 });
  sections.forEach((s) => {
    // Already on screen at load: assemble anyway, a beat later, so the growth is seen.
    s.setAttribute('data-assemble', '');
    io.observe(s);
  });
  return () => io.disconnect();
}
