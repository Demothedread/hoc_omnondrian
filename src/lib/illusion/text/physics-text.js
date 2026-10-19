/**
 * text/physics-text.js — headline effects driven by simulated physics
 * ---------------------------------------------------------------------------
 * The headline is split into letters (spans). Each frame a small simulation
 * moves them. All three share one scaffold (splitLetters + per-frame layout
 * cache) and differ only in their equations:
 *
 *   spring  Each letter is a mass on a damped spring (Hooke's law). The
 *           pointer pushes with a smooth radial force.
 *   wave    Letters are beads on a string. The 1D wave equation
 *           y'' = c²(y[i+1] − 2y[i] + y[i−1]) − γy' − κy
 *           carries disturbances along the line and reflects at the ends.
 *   tidal   A point mass (the pointer, or the black hole background) pulls
 *           each letter by GM/r² and stretches it by the tidal term 2GM/r³:
 *           spaghettification. Letters dim with gravitational time
 *           dilation √(1 − r_s/r) and vanish at the horizon.
 *
 * Accessibility: real text in a visually hidden span; letters are
 * aria-hidden. Reduced motion: letters stay at rest.
 */
import { escapeHtml } from '../config.js';
import { stepSpring, criticalSpring } from '../../cosmos/math/spring.js';

function splitLetters(headline) {
  const text = headline.dataset.text || '';
  // Letters are grouped per word (nowrap) so lines only break between words.
  const words = text.split(/(\s+)/).map((part) =>
    /^\s+$/.test(part)
      ? ' '
      : `<span class="ill-ph-word">${[...part].map((ch) => `<span class="ill-ph">${escapeHtml(ch)}</span>`).join('')}</span>`,
  ).join('');
  headline.innerHTML = `<span class="ill-sr">${escapeHtml(text)}</span><span class="ill-ph-line" aria-hidden="true">${words}</span>`;
  const spans = [...headline.querySelectorAll('.ill-ph')];
  // Rest centres relative to the headline's box, measured with transforms cleared.
  const rest = spans.map(() => ({ x: 0, y: 0 }));
  const measure = () => {
    const saved = spans.map((s) => s.style.transform);
    spans.forEach((s) => { s.style.transform = ''; });
    const box = headline.getBoundingClientRect();
    spans.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      rest[i].x = r.left + r.width / 2 - box.left;
      rest[i].y = r.top + r.height / 2 - box.top;
    });
    spans.forEach((s, i) => { s.style.transform = saved[i]; });
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(headline);
  document.fonts?.ready.then(measure);
  return { text, spans, rest, ro };
}

/** Wrap a simulation as a stage text module. */
function physicsEffect(id, simulate) {
  return {
    id,
    mount(headline, cfg, ctx) {
      const L = splitLetters(headline);
      let current = cfg;
      const sim = simulate(L, ctx);
      return {
        update(next) { current = next; },
        tick(dt) {
          if (ctx.reducedMotion()) { sim.rest?.(); return; }
          const box = headline.getBoundingClientRect();
          sim.step(Math.min(dt, 50) / 1000, current, box);
        },
        destroy() {
          L.ro.disconnect();
          headline.textContent = L.text;
        },
      };
    },
  };
}

// --- spring ---------------------------------------------------------------
export const springText = physicsEffect('spring', (L, ctx) => {
  const s = L.spans.map(() => ({ x: { x: 0, v: 0 }, y: { x: 0, v: 0 } }));
  return {
    step(dt, cfg, box) {
      const px = ctx.pointer.clientX ?? -1e4;
      const py = ctx.pointer.clientY ?? -1e4;
      const R = Math.max(80, box.height * 1.2); // reach of the pointer's push
      L.spans.forEach((span, i) => {
        const cx = box.left + L.rest[i].x + s[i].x.x;
        const cy = box.top + L.rest[i].y + s[i].y.x;
        const dx = cx - px, dy = cy - py;
        const d = Math.hypot(dx, dy) || 1;
        const push = d < R ? 9000 * (1 - d / R) ** 2 : 0; // smooth, finite force
        stepSpring(s[i].x, cfg.springStiffness, cfg.springDamping, (push * dx) / d, dt);
        stepSpring(s[i].y, cfg.springStiffness, cfg.springDamping, (push * dy) / d, dt);
        span.style.transform = `translate(${s[i].x.x.toFixed(1)}px, ${s[i].y.x.toFixed(1)}px) rotate(${(s[i].x.v * 0.03).toFixed(2)}deg)`;
      });
    },
    rest() { L.spans.forEach((span) => { span.style.transform = ''; }); },
  };
});

// --- wave -----------------------------------------------------------------
export const waveText = physicsEffect('wave', (L, ctx) => {
  const n = L.spans.length;
  const y = new Float32Array(n);
  const v = new Float32Array(n);
  let lastPx = null, lastPy = null;
  let idle = 0;
  return {
    step(dt, cfg, box) {
      const c2 = cfg.waveSpeed * cfg.waveSpeed;
      const gamma = cfg.waveDamping;
      const kappa = 4; // weak restoring force so the string always returns
      const px = ctx.pointer.clientX, py = ctx.pointer.clientY;

      // Excite the letter under the pointer with the pointer's vertical speed.
      if (px != null && lastPx != null && py > box.top - 40 && py < box.bottom + 40) {
        const i = L.rest.findIndex((r) => Math.abs(box.left + r.x - px) < 24);
        if (i >= 0) v[i] += ((py - lastPy) / Math.max(dt, 1e-3)) * 0.25;
      }
      lastPx = px; lastPy = py;

      // A raindrop now and then (a Poisson process, rate 0.25/s) keeps it alive.
      idle += dt;
      if (Math.random() < 0.25 * dt) v[Math.floor(Math.random() * n)] += (Math.random() - 0.5) * 260;

      // Explicit finite differences, sub-stepped for the CFL condition (c·h < 1).
      const steps = Math.max(1, Math.ceil(dt * cfg.waveSpeed * 1.5));
      const h = dt / steps;
      for (let k = 0; k < steps; k++) {
        for (let i = 0; i < n; i++) {
          const left = i > 0 ? y[i - 1] : y[i];      // free ends reflect
          const right = i < n - 1 ? y[i + 1] : y[i];
          v[i] += (c2 * (left - 2 * y[i] + right) - gamma * v[i] - kappa * y[i]) * h;
        }
        for (let i = 0; i < n; i++) y[i] += v[i] * h;
      }
      L.spans.forEach((span, i) => {
        const slope = (i < n - 1 ? y[i + 1] : y[i]) - (i > 0 ? y[i - 1] : y[i]);
        span.style.transform = `translateY(${y[i].toFixed(1)}px) rotate(${(slope * 0.4).toFixed(2)}deg)`;
      });
    },
    rest() { L.spans.forEach((span) => { span.style.transform = ''; }); },
  };
});

// --- tidal ----------------------------------------------------------------
export const tidalText = physicsEffect('tidal', (L, ctx) => {
  const st = L.spans.map(() => ({ px: [0, 0], py: [0, 0], s: [1, 0] }));
  return {
    step(dt, cfg, box) {
      // The mass: the black hole background if present, otherwise the pointer.
      const a = ctx.attractor ?? { x: ctx.pointer.clientX ?? -1e4, y: ctx.pointer.clientY ?? -1e4, radius: box.height * 0.5 };
      const rs = Math.max(8, a.radius / 2.6);   // horizon from shadow size (shadow ≈ 2.6 r_s)
      const m = cfg.tidalMass;
      L.spans.forEach((span, i) => {
        const x0 = box.left + L.rest[i].x, y0 = box.top + L.rest[i].y;
        let dx = a.x - x0, dy = a.y - y0;
        const r = Math.max(Math.hypot(dx, dy), 1);
        dx /= r; dy /= r;
        // Screen-scaled Newtonian pull ∝ 1/r² and tidal stretch ∝ 1/r³.
        const pull = Math.min(Math.max(0, r - rs), m * rs * 1.2 * (3 * rs / r) ** 2);
        const stretch = Math.min(4, 1 + 2 * m * (2.2 * rs / r) ** 3);
        const dil = r <= rs ? 0 : Math.sqrt(1 - rs / r);                     // √(1 − r_s/r)
        const S = st[i];
        [S.px[0], S.px[1]] = criticalSpring(S.px[0], S.px[1], dx * pull, 9, dt);
        [S.py[0], S.py[1]] = criticalSpring(S.py[0], S.py[1], dy * pull, 9, dt);
        [S.s[0], S.s[1]] = criticalSpring(S.s[0], S.s[1], stretch, 9, dt);
        const ang = Math.atan2(dy, dx);
        span.style.transform =
          `translate(${S.px[0].toFixed(1)}px, ${S.py[0].toFixed(1)}px) rotate(${ang}rad) ` +
          `scale(${S.s[0].toFixed(3)}, ${(1 / Math.sqrt(S.s[0])).toFixed(3)}) rotate(${-ang}rad)`;
        span.style.opacity = dil.toFixed(3);
      });
    },
    rest() { L.spans.forEach((span) => { span.style.transform = ''; span.style.opacity = ''; }); },
  };
});
