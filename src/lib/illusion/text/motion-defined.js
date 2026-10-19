/**
 * text/motion-defined.js — "Visible only in motion"
 * ---------------------------------------------------------------------------
 * The illusion (structure-from-motion): every pixel is random noise. Pixels
 * inside the letters scroll down; pixels outside scroll up. Any single frame
 * is pure static — screenshot it and the word is gone — but while it moves,
 * the brain groups pixels by common motion and the word appears.
 * Toggle "Freeze" in the admin panel to watch it vanish.
 *
 * Rendering: a small canvas at (size / grain) resolution, scaled up with
 * pixelated rendering. One pass over a Uint32 buffer per frame; at a 2px
 * grain a full-width headline is roughly 60k cells — trivial.
 *
 * Accessibility: the real text sits in a visually hidden span for screen
 * readers, and reduced-motion visitors get the plain headline instead.
 */
import { STIJL, escapeHtml } from '../config.js';

/** '#rrggbb' → 0xAABBGGRR (little-endian ImageData word). */
function hexToABGR(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

export const motionText = {
  id: 'motion',

  mount(headline, cfg, ctx) {
    const text = headline.dataset.text || '';
    headline.innerHTML =
      `<span class="ill-sr">${escapeHtml(text)}</span>` +
      '<canvas class="ill-motion" aria-hidden="true"></canvas>' +
      `<span class="ill-motion__fallback" aria-hidden="true">${escapeHtml(text)}</span>`;
    const canvas = headline.querySelector('canvas');
    const g = canvas.getContext('2d');

    const INK = hexToABGR(STIJL.ink);
    const PAPER = hexToABGR(STIJL.paper);

    let current = cfg;
    let W = 0, H = 0;           // canvas size in cells
    let mask = null;            // 1 = inside a letter
    let noiseIn = null, noiseOut = null;
    let image = null, words = null;
    let offIn = 0, offOut = 0;  // scroll offsets in cells

    function seedNoise() {
      const d = current.motionDensity;
      noiseIn = new Uint8Array(W * H);
      noiseOut = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        noiseIn[i] = Math.random() < d ? 1 : 0;
        noiseOut[i] = Math.random() < d ? 1 : 0;
      }
    }

    /** Rasterise the headline into a mask at cell resolution. */
    function layout() {
      const style = getComputedStyle(headline);
      const cssW = Math.max(1, headline.clientWidth);
      const grain = current.motionGrain;
      const family = style.fontFamily;
      const weight = style.fontWeight;

      // Poster-style fitting: wrap onto up to three lines at the CSS size,
      // then shrink only if a single word is still wider than the column.
      const probe = document.createElement('canvas').getContext('2d');
      const avail = cssW * 0.96;
      let size = parseFloat(style.fontSize);
      const wrap = () => {
        probe.font = `${weight} ${size}px ${family}`;
        const out = [];
        let line = '';
        for (const word of text.split(/\s+/).filter(Boolean)) {
          const test = line ? `${line} ${word}` : word;
          if (!line || probe.measureText(test).width <= avail) line = test;
          else { out.push(line); line = word; }
        }
        if (line) out.push(line);
        return out.length ? out : [''];
      };
      let lines = wrap();
      if (lines.length > 3) lines = [lines.slice(0, -2).join(' '), ...lines.slice(-2)];
      const widest = Math.max(...lines.map((l) => probe.measureText(l).width));
      if (widest > avail) { size *= avail / widest; probe.font = `${weight} ${size}px ${family}`; }
      const leading = 0.92;
      const cssH = Math.ceil(size * (leading * lines.length + 0.14));

      W = Math.max(1, Math.ceil(cssW / grain));
      H = Math.max(1, Math.ceil(cssH / grain));
      canvas.width = W;
      canvas.height = H;
      canvas.style.height = `${cssH}px`;

      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const m = off.getContext('2d');
      m.font = `${weight} ${size / grain}px ${family}`;
      m.textBaseline = 'alphabetic';
      m.fillStyle = '#000';
      lines.forEach((l, i) => m.fillText(l, size * 0.04 / grain, (size * (leading * i + 0.84)) / grain));
      const alpha = m.getImageData(0, 0, W, H).data;
      mask = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) mask[i] = alpha[i * 4 + 3] > 110 ? 1 : 0;

      image = g.createImageData(W, H);
      words = new Uint32Array(image.data.buffer);
      seedNoise();
      draw();
    }

    function draw() {
      if (!mask) return;
      const oi = Math.floor(offIn) % H;
      const oo = Math.floor(offOut) % H;
      for (let y = 0; y < H; y++) {
        const rowIn = ((y - oi + H) % H) * W;   // inside: content moves down
        const rowOut = ((y + oo) % H) * W;      // outside: content moves up
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const i = row + x;
          const on = mask[i] ? noiseIn[rowIn + x] : noiseOut[rowOut + x];
          words[i] = on ? INK : PAPER;
        }
      }
      g.putImageData(image, 0, 0);
    }

    const ro = new ResizeObserver(() => layout());
    ro.observe(headline);
    document.fonts?.ready.then(layout);
    layout();

    return {
      update(next) {
        const relayout = next.motionGrain !== current.motionGrain;
        const reseed = next.motionDensity !== current.motionDensity;
        current = next;
        if (relayout) layout();
        else if (reseed) { seedNoise(); draw(); }
      },
      tick(dt) {
        const still = ctx.reducedMotion();
        headline.classList.toggle('is-still', still);
        if (still || current.motionFreeze) return;
        const cells = (current.motionSpeed * dt) / 1000 / current.motionGrain;
        offIn += cells;
        offOut += cells;
        draw();
      },
      destroy() {
        ro.disconnect();
        headline.classList.remove('is-still');
        headline.textContent = text;
      },
    };
  },
};
