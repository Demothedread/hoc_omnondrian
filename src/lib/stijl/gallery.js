/**
 * stijl/gallery.js — photos in Mondrian rooms, opened in a native <dialog>
 * ---------------------------------------------------------------------------
 * Photos are split into rooms of up to `perRoom`. Each room is a composition
 * (composeSection) with the photos as its fields. The first room sits inside
 * the disintegration track: the painting over it falls away as you scroll.
 * Photo shape: { id, src, alt, caption?, weight?, full? }  (full = large version)
 */
import { renderSection } from './compose.js';
import { escapeHtml } from '../illusion/config.js';

function photoHTML(p) {
  return `<button type="button" class="ph" data-full="${escapeHtml(p.full ?? p.src)}" data-caption="${escapeHtml(p.caption ?? '')}" aria-label="Open photo: ${escapeHtml(p.alt)}">
    <img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt)}" loading="lazy" decoding="async">
  </button>`;
}

export function renderGallery({ photos, seed = 1917, perRoom = 7 }) {
  const rooms = [];
  for (let i = 0; i < photos.length; i += perRoom) rooms.push(photos.slice(i, i + perRoom));
  const section = (room, r) => renderSection({
    items: room.map((p) => ({ id: p.id, weight: p.weight ?? 1, tone: 'paper', html: photoHTML(p) })),
    seed: seed + r * 13, wide: 1.6, tall: 0.45, label: `Gallery room ${r + 1}`, compose: { accents: 0.35, autoColour: 0 },
  });
  const [first, ...rest] = rooms;
  return `
    <div class="dis" data-dis>
      <div class="dis__sticky">
        <div class="dis__photos">${first ? section(first, 0) : ''}</div>
        <div class="dis__painting" aria-hidden="true"></div>
        <p class="dis__cue" aria-hidden="true">Scroll</p>
      </div>
    </div>
    ${rest.map((room, r) => `<div class="gallery__room">${section(room, r + 1)}</div>`).join('')}
    <dialog class="lightbox" aria-label="Photo">
      <form method="dialog"><button class="lightbox__close an-key">Close</button></form>
      <div class="lightbox__stage"><img class="lightbox__img" alt="" draggable="false"></div>
      <div class="lightbox__bar">
        <p class="lightbox__caption" aria-live="polite"></p>
        <div class="lightbox__nav">
          <button type="button" class="an-key" data-step="-1">Previous</button>
          <span class="an-lcd lightbox__count" aria-hidden="true"></span>
          <button type="button" class="an-key" data-step="1">Next</button>
        </div>
      </div>
      <p class="lightbox__hint" hidden>Hold the photo (or press Space) to gather it into a globe. ← → move to the next photo through the collapse.</p>
    </dialog>`;
}

/**
 * Open photos in the dialog, and move between them.
 *   Previous / Next keys, ← and →, or a horizontal swipe on the photo.
 *   With particles, each move runs the collapse: the photo disintegrates,
 *   falls in on itself, and the next one bursts out of the point.
 *   Without, the photo simply changes.
 * Esc, the Close key and a backdrop click close it.
 * @param {HTMLElement} root
 * @param {{ particles?: () => Promise<{ mountParticleGlobe: Function }>, photos?: Array<{ src, alt, caption }> }} [o]
 *   particles  loader for stijl/particle-globe.js, called when a photo first
 *              opens, so three.js and Motion never weigh on the rest of the site
 *   photos     the photos to step through. Without it, the .ph thumbnails in
 *              root are used, and clicking one opens it.
 * @returns {{ open(index: number): void, destroy(): void }}
 */
export function mountLightbox(root, { particles = null, photos: given = null } = {}) {
  const dialog = root.querySelector('.lightbox');
  if (!dialog) return { open() {}, destroy() {} };
  const stage = dialog.querySelector('.lightbox__stage');
  const img = dialog.querySelector('.lightbox__img');
  const cap = dialog.querySelector('.lightbox__caption');
  const count = dialog.querySelector('.lightbox__count');
  const hint = dialog.querySelector('.lightbox__hint');
  const list = () => [...root.querySelectorAll('.ph')].map((b) => ({
    src: b.dataset.full, alt: b.querySelector('img').alt, caption: b.dataset.caption || b.querySelector('img').alt,
  }));
  let photos = given ?? [];
  let index = 0;
  let globe = null;
  let opening = 0; // guards against closing before the module has loaded

  /** Caption, alt text and counter for the photo now on screen. */
  function label(i) {
    const p = photos[i];
    img.src = p.src;
    img.alt = p.alt;
    cap.textContent = p.caption;
    count.textContent = `${i + 1} / ${photos.length}`;
  }

  async function startParticles(src, token) {
    try {
      const mod = await particles();
      if (token !== opening || !dialog.open) return;
      // A fresh canvas every time: a canvas can't be reused after its GPU context is torn down.
      const canvas = document.createElement('canvas');
      canvas.className = 'lightbox__canvas';
      canvas.setAttribute('role', 'button');
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-label', 'Hold to form a particle globe');
      stage.append(canvas);
      const g = await mod.mountParticleGlobe(canvas, {
        photo: src,
        // The caption changes at the moment of the swap, at the point of collapse.
        onChange: (url) => { const i = photos.findIndex((p) => p.src === url); if (i >= 0) label(i); },
      });
      if (!g || token !== opening || !dialog.open) { g?.destroy(); canvas.remove(); return; }
      globe = { ...g, canvas };
      dialog.classList.add('is-particles');
      hint.hidden = false;
      canvas.focus({ preventScroll: true });
      if (photos[index].src !== src) globe.show(photos[index].src); // moved on while loading
    } catch (error) {
      console.warn('[lightbox] particles unavailable; showing the photo', error);
    }
  }

  function stopParticles() {
    opening++;
    globe?.destroy();
    globe?.canvas.remove();
    globe = null;
    dialog.classList.remove('is-particles');
    hint.hidden = true;
  }

  /** Step through the photos (wrapping round). */
  function step(delta) {
    if (!photos.length) return;
    index = (index + delta + photos.length) % photos.length;
    if (globe) {
      count.textContent = `${index + 1} / ${photos.length}`;
      globe.show(photos[index].src);       // caption follows at the swap
    } else {
      label(index);
    }
  }

  /** Open the viewer at a photo. */
  function open(i) {
    if (!photos.length || i < 0) return;
    index = i;
    stopParticles();
    label(index);
    dialog.showModal();
    if (particles) startParticles(photos[index].src, opening);
  }
  const onClick = (e) => {
    if (given) return;
    const btn = e.target.closest('.ph');
    if (!btn) return;
    photos = list();
    open([...root.querySelectorAll('.ph')].indexOf(btn));
  };
  const onDialogClick = (e) => {
    if (e.target === dialog) { dialog.close(); return; }
    const by = e.target.closest('[data-step]');
    if (by) step(Number(by.dataset.step));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };
  // Swipe: a mostly horizontal drag of 60 px or more.
  let swipe = null;
  const onDown = (e) => { swipe = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };
  root.addEventListener('click', onClick);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('keydown', onKey);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointerup', onUp);
  dialog.addEventListener('close', stopParticles);
  const destroy = () => {
    stopParticles();
    root.removeEventListener('click', onClick);
    dialog.removeEventListener('click', onDialogClick);
    dialog.removeEventListener('keydown', onKey);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointerup', onUp);
    dialog.removeEventListener('close', stopParticles);
  };
  return { open, destroy };
}
