/**
 * backgrounds/grid-illusions.js — four classic illusions in the De Stijl palette
 * ---------------------------------------------------------------------------
 *   grid      Scintillating grid (Schrauf, Lingelbach & Wist, 1997). Paper
 *             discs where grey streets cross a field of ink squares. Black dots
 *             flash inside the discs you are not looking at. Pure CSS.
 *   cafewall  Café wall (Gregory & Heard, 1979). Rows of alternating tiles,
 *             each row shifted, separated by thin grey mortar. The perfectly
 *             parallel mortar lines look like wedges. Painted once to a canvas
 *             tile and repeated as a CSS background.
 *   stepping  Stepping feet (Anstis, 2001). A yellow and a blue bar slide at a
 *             constant speed over black and white stripes, yet appear to take
 *             alternating steps, because their edge contrast keeps flipping.
 *             Hold the "see the truth" button to lift the stripes: they glide.
 *   pinna     Pinna–Brelstaff rings (2000). Two rings of small squares with
 *             light and dark edges. As the rings grow and shrink, they appear
 *             to rotate in opposite directions. Nothing rotates.
 *
 * drawPinna() and pinnaTile() are exported for the cosmos sky, where zooming
 * the map supplies the size change.
 */
import { STIJL } from '../config.js';

const GREY = '#8c8c88'; // luminance halfway between ink and paper: the illusions need it

// --- Scintillating grid ---------------------------------------------------
export const gridBackground = {
  id: 'grid',
  mount(host, cfg) {
    const root = document.createElement('div');
    root.className = 'ill-grid';
    host.append(root);
    const update = (c) => {
      root.style.setProperty('--grid-cell', `${c.gridCell}px`);
      root.style.setProperty('--grid-street', `${c.gridStreet}px`);
      root.style.setProperty('--grid-disc', `${c.gridDisc}px`);
    };
    update(cfg);
    return { update, destroy: () => root.remove() };
  },
};

// --- Café wall --------------------------------------------------------------
/** Paint one repeat of the wall: 4 rows, offsets 0, +s, +2s, +s (a zig-zag). */
function cafeTile(c) {
  const t = c.cafeTile;
  const m = c.cafeMortar;
  const shift = c.cafeShift * t;
  const [dark, light] = c.cafePalette === 'stijl' ? [STIJL.blue, STIJL.yellow] : [STIJL.ink, STIJL.paper];
  const rowH = t + m;
  const canvas = document.createElement('canvas');
  canvas.width = t * 2;
  canvas.height = rowH * 4;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = GREY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  [0, 1, 2, 1].forEach((k, row) => {
    const off = (k * shift) % (2 * t);
    for (let x = -2 * t; x < 4 * t; x += 2 * t) {
      ctx.fillStyle = dark;
      ctx.fillRect(x + off, row * rowH + m, t, t);
      ctx.fillStyle = light;
      ctx.fillRect(x + off + t, row * rowH + m, t, t);
    }
  });
  return canvas.toDataURL();
}

export const cafeWallBackground = {
  id: 'cafewall',
  mount(host, cfg) {
    const root = document.createElement('div');
    root.className = 'ill-cafe';
    host.append(root);
    const update = (c) => { root.style.backgroundImage = `url(${cafeTile(c)})`; };
    update(cfg);
    return { update, destroy: () => root.remove() };
  },
};

// --- Stepping feet ------------------------------------------------------------
export const steppingBackground = {
  id: 'stepping',
  mount(host, cfg, ctx) {
    const root = document.createElement('div');
    root.className = 'ill-stepping';
    // Four lanes: the yellow and blue "feet" alternate lanes.
    root.innerHTML = [0, 1, 2, 3].map((i) =>
      `<div class="ill-stepping__lane" style="--lane:${i}"><span class="ill-stepping__foot" data-hue="${i % 2 ? 'blue' : 'yellow'}"></span></div>`,
    ).join('') + '<button type="button" class="ill-stepping__hint">Hold to see the truth</button>';
    host.append(root);
    // Lift the stripes only while the button is held, so the illusion is the default state.
    const hint = root.querySelector('.ill-stepping__hint');
    const lift = (on) => root.classList.toggle('is-revealed', on);
    hint.addEventListener('pointerdown', () => lift(true));
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => hint.addEventListener(ev, () => lift(false)));
    hint.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') lift(true); });
    hint.addEventListener('keyup', () => lift(false));
    const feet = [...root.querySelectorAll('.ill-stepping__foot')];
    let c = cfg;
    let x = 0;
    const update = (next) => {
      c = next;
      root.style.setProperty('--stripe', `${c.stepStripe}px`);
      root.dataset.reveal = c.stepReveal ? 'hold' : 'never';
    };
    update(cfg);
    return {
      update,
      tick(dt) {
        if (ctx.reducedMotion()) return;
        // Constant speed, wrapping across the lane. The stepping is in your eyes.
        const w = root.clientWidth + 160;
        x = (x + (c.stepSpeed * dt) / 1000) % w;
        feet.forEach((f, i) => { f.style.transform = `translateX(${((x + i * 37) % w) - 160}px)`; });
      },
      destroy: () => root.remove(),
    };
  },
};

// --- Pinna–Brelstaff ------------------------------------------------------------
/**
 * Draw the two rings onto a 2D context, centred.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ size: number, rings?: number, element?: number }} o
 *   size     canvas square size in px
 *   rings    ring pairs (1–3)
 *   element  square side as a fraction of ring spacing
 */
export function drawPinna(ctx, { size, rings = 2, element = 0.42 }) {
  ctx.fillStyle = GREY;
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const maxR = size * 0.47;
  const count = rings * 2;
  for (let k = 0; k < count; k++) {
    const R = maxR * (0.35 + (0.65 * (k + 1)) / count);
    const spacing = (maxR * 0.65) / count;
    const s = spacing * element;
    const n = Math.max(12, Math.round((2 * Math.PI * R) / (s * 1.6)));
    // Inner and outer rings of each pair carry opposite edge polarity: that is the illusion.
    const polarity = k % 2 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * R, cx + Math.sin(a) * R);
      ctx.rotate(a + Math.PI / 4);
      const h = s / 2;
      const lw = Math.max(1, s * 0.16);
      ctx.fillStyle = GREY;
      ctx.fillRect(-h, -h, s, s);
      ctx.lineWidth = lw;
      // Two adjacent sides light, the other two dark.
      const [first, second] = polarity > 0 ? [STIJL.paper, STIJL.ink] : [STIJL.ink, STIJL.paper];
      ctx.strokeStyle = first;
      ctx.beginPath(); ctx.moveTo(-h, h); ctx.lineTo(-h, -h); ctx.lineTo(h, -h); ctx.stroke();
      ctx.strokeStyle = second;
      ctx.beginPath(); ctx.moveTo(h, -h); ctx.lineTo(h, h); ctx.lineTo(-h, h); ctx.stroke();
      ctx.restore();
    }
  }
}

/** A Pinna tile as a data URL (for CSS backgrounds such as the cosmos sky). */
export function pinnaTile(size = 900, rings = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawPinna(c.getContext('2d'), { size, rings });
  return c.toDataURL();
}

export const pinnaBackground = {
  id: 'pinna',
  mount(host, cfg, ctx) {
    const root = document.createElement('div');
    root.className = 'ill-pinna';
    const canvas = document.createElement('canvas');
    root.append(canvas);
    host.append(root);
    let c = cfg;
    let clock = 0;
    const draw = () => {
      const size = Math.round(Math.min(root.clientWidth, root.clientHeight) * Math.min(devicePixelRatio || 1, 2)) || 600;
      canvas.width = canvas.height = size;
      drawPinna(canvas.getContext('2d'), { size, rings: c.pinnaRings });
    };
    const ro = new ResizeObserver(draw);
    ro.observe(root);
    const update = (next) => { const redraw = next.pinnaRings !== c.pinnaRings; c = next; if (redraw) draw(); };
    draw();
    return {
      update,
      tick(dt) {
        if (ctx.reducedMotion()) { canvas.style.transform = ''; return; }
        // Approach and retreat: the size change is what makes the rings "turn".
        clock += dt / 1000;
        const s = 1 + 0.16 * Math.sin((2 * Math.PI * clock) / c.pinnaBreath);
        canvas.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
      },
      destroy() { ro.disconnect(); root.remove(); },
    };
  },
};
