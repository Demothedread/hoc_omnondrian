/**
 * illusion/stage.js
 * ---------------------------------------------------------------------------
 * Orchestrates one stage:
 *   • renders from the store (remounts a module only when its id changes;
 *     otherwise calls update(cfg) so edits in the admin are live and cheap)
 *   • owns ONE requestAnimationFrame clock for every module on the stage
 *   • pauses that clock when the stage is off-screen or the tab is hidden
 *   • tracks the pointer and the reduced-motion preference for modules
 *   • writes numeric config to CSS custom properties (see VARS)
 *
 * Expected markup (IllusionStage.astro produces it):
 *   <section data-ill-stage>
 *     <div data-ill-bg></div>
 *     <h1 data-ill-headline></h1>
 *     <p data-ill-subline></p>
 *   </section>
 */

/** config key → [CSS custom property, unit]. CSS reads these; JS never styles directly. */
const VARS = {
  ouchiCell: ['--ill-brick', 'px'],
  ouchiAspect: ['--ill-aspect', ''],
  driftCell: ['--ill-drift-cell', 'px'],
  crawlPeriod: ['--ill-crawl-period', 'px'],
  crawlAngle: ['--ill-crawl-angle', 'deg'],
  lentStripe: ['--ill-stripe', 'px'],
  anaglyphDepth: ['--ill-depth', 'px'],
};

export function createStage(stageEl, store, registry) {
  const bgHost = stageEl.querySelector('[data-ill-bg]');
  const headline = stageEl.querySelector('[data-ill-headline]');
  const subline = stageEl.querySelector('[data-ill-subline]');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

  // x/y: normalised to the stage (0–1). clientX/clientY: viewport px (physics text).
  const pointer = { x: 0.5, y: 0.5, clientX: null, clientY: null };
  const ctx = {
    stage: stageEl,
    pointer,
    /** Set by gravitating backgrounds: { x, y, radius } in viewport px, or null. */
    attractor: null,
    /** True if the visitor asked for less motion, or the admin is previewing it. */
    reducedMotion: () => motionQuery.matches || store.get().previewReducedMotion,
  };

  let bg = null, bgId = null;
  let text = null, textId = null;

  function render(cfg, prev = {}) {
    // Attributes let CSS branch without JS (e.g. data-effect="chromo").
    stageEl.dataset.bg = cfg.bgMode;
    stageEl.dataset.frame = cfg.frameStyle;
    stageEl.dataset.effect = cfg.textEffect;
    stageEl.dataset.backing = cfg.copyBacking;
    stageEl.dataset.chromoGround = cfg.chromoGround;
    stageEl.classList.toggle('is-reduced-motion', ctx.reducedMotion());
    for (const [key, [prop, unit]] of Object.entries(VARS)) stageEl.style.setProperty(prop, cfg[key] + unit);

    if (subline) subline.textContent = cfg.subline;

    if (cfg.bgMode !== bgId) {
      bg?.destroy();
      bgHost.replaceChildren();
      bg = registry.backgrounds[cfg.bgMode]?.mount(bgHost, cfg, ctx) ?? null;
      bgId = cfg.bgMode;
    } else {
      bg?.update(cfg);
    }

    const textChanged = cfg.headline !== prev.headline;
    if (cfg.textEffect !== textId || textChanged) {
      text?.destroy();
      headline.dataset.text = cfg.headline;
      text = registry.texts[cfg.textEffect]?.mount(headline, cfg, ctx) ?? null;
      textId = cfg.textEffect;
    } else {
      text?.update(cfg);
    }
  }

  // --- shared clock -------------------------------------------------------
  let raf = 0, last = 0, clock = 0, visible = true;

  function frame(now) {
    const dt = Math.min(100, last ? now - last : 16); // clamp after tab switches
    last = now;
    clock += dt;
    const cfg = store.get();

    // "Tremor" for the Ouchi illusion: a tiny circle traced by the pattern.
    const amp = ctx.reducedMotion() ? 0 : cfg.ouchiJitter;
    stageEl.style.setProperty('--ill-ox', `${(Math.cos(clock / 420) * amp).toFixed(2)}px`);
    stageEl.style.setProperty('--ill-oy', `${(Math.sin(clock / 420) * amp).toFixed(2)}px`);

    bg?.tick?.(dt);
    text?.tick?.(dt);
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(stageEl);

  const onVisibility = () => (document.hidden ? stop() : start());
  const onPointer = (e) => {
    const r = stageEl.getBoundingClientRect();
    pointer.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    pointer.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
  };
  const onMotionPref = () => render(store.get(), store.get());

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointermove', onPointer, { passive: true });
  motionQuery.addEventListener('change', onMotionPref);

  const unsubscribe = store.subscribe(render);
  render(store.get());
  start();

  return {
    destroy() {
      stop();
      io.disconnect();
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      motionQuery.removeEventListener('change', onMotionPref);
      bg?.destroy();
      text?.destroy();
    },
  };
}
