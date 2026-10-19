/**
 * backgrounds/static-illusions.js
 * ---------------------------------------------------------------------------
 * Backgrounds whose effect is produced by the viewer's visual system from a
 * STATIC pattern. The JavaScript here only creates the element; all drawing
 * is CSS (see illusion.css → "Floating island" and "Peripheral drift").
 */

/**
 * "Floating island" — the Ouchi illusion (Hajime Ouchi, 1977).
 * A disc of vertical bricks set into a field of horizontal bricks. When the
 * image moves even slightly, the eye estimates motion differently for the
 * two orientations, so the disc seems to slide on its own layer in front of
 * the page. The stage supplies that slight motion (the "tremor"), and page
 * scrolling supplies more for free.
 */
export const ouchiBackground = {
  id: 'ouchi',
  mount(host, cfg) {
    const root = document.createElement('div');
    root.className = 'ill-ouchi';
    root.innerHTML = '<div class="ill-ouchi__island"></div>';
    host.append(root);
    const island = root.firstElementChild;
    const update = (c) => { island.dataset.shape = c.ouchiShape; };
    update(cfg);
    return { update, destroy: () => root.remove() };
  },
};

/**
 * "Peripheral drift" — after Akiyoshi Kitaoka's "Rotating Snakes" (2003).
 * Repeating steps of black → dark → white → light make the visual system
 * register motion in the direction of that sequence, strongest in peripheral
 * vision and after each eye movement. Adjacent rings run the sequence in
 * opposite directions, so the discs seem to counter-rotate. Nothing moves.
 */
export const driftBackground = {
  id: 'drift',
  mount(host, cfg) {
    const root = document.createElement('div');
    root.className = 'ill-drift';
    host.append(root);
    const update = (c) => { root.dataset.ground = c.driftGround; };
    update(cfg);
    return { update, destroy: () => root.remove() };
  },
};

/** Plain ground, for when the headline effect should carry the page alone. */
export const noneBackground = {
  id: 'none',
  mount(host) {
    const root = document.createElement('div');
    root.className = 'ill-plain-ground';
    host.append(root);
    return { update() {}, destroy: () => root.remove() };
  },
};
