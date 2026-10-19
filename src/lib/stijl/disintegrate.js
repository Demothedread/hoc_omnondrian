/**
 * stijl/disintegrate.js — the painting falls away from the screen
 * ---------------------------------------------------------------------------
 * The gallery's photos are laid out by composeSection(), so they already sit
 * in a Mondrian composition. Over them lies the painting: the same
 * composition, each photo field painted a De Stijl colour. As the visitor
 * scrolls, the painting comes apart along its own logic:
 *
 *   • Each field shatters along a finer guillotine split of itself (shards
 *     are smaller Mondrian rectangles, never random polygons).
 *   • Each black line breaks into segments that fall too.
 *   • Shards leave in a wave from the origin outward (default: the centre).
 *   • Every shard follows a ballistic path: pushed away from the viewer
 *     (z = −(v_z·τ + ½·a_z·τ²)), drifting outward, pulled down by gravity
 *     (y = v_y·τ + ½·g·τ²), tumbling at constant angular velocity, fading late.
 *
 * Driven by scroll position, not time, so scrolling back up reassembles the
 * painting exactly. Reduced motion: the painting simply fades.
 *
 * Markup (renderGallery() in gallery.js produces it):
 *   <div class="dis" data-dis>               tall scroll track
 *     <div class="dis__sticky">              pinned viewport
 *       <div class="dis__photos"> …section…  the photos (composeSection)
 *       <div class="dis__painting">          shards are built here
 */
import { STIJL, seededRandom } from '../illusion/config.js';

const SHARD_HUES = [STIJL.red, STIJL.blue, STIJL.yellow];

/** Split a rect into ~n Mondrian shards (guillotine, off-centre cuts). */
function shatter(r, n, rand) {
  const out = [r];
  while (out.length < n) {
    // Split the largest shard, along its longer side.
    out.sort((a, b) => b.w * b.h - a.w * a.h);
    const s = out.shift();
    const t = 0.3 + rand() * 0.4;
    if (s.w >= s.h) out.push({ ...s, w: s.w * t }, { ...s, x: s.x + s.w * t, w: s.w * (1 - t) });
    else out.push({ ...s, h: s.h * t }, { ...s, y: s.y + s.h * t, h: s.h * (1 - t) });
  }
  return out;
}

/**
 * @param {HTMLElement} el   the [data-dis] element
 * @param {object} [o]
 * @param {number} [o.seed=1917]
 * @param {number} [o.cap=0.5]          share of photo fields painted in colour (the rest paper)
 * @param {'centre'|'top'|'left'} [o.origin='centre']   where the falling-away starts
 * @param {number} [o.shards=7]         shards per field (more = finer break-up)
 */
export function mountDisintegrate(el, { seed = 1917, cap = 0.5, origin = 'centre', shards = 7 } = {}) {
  const sticky = el.querySelector('.dis__sticky');
  const section = el.querySelector('.dis__photos .stijl');
  const painting = el.querySelector('.dis__painting');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let parts = [];
  let raf = 0;

  function build() {
    painting.innerHTML = '';
    parts = [];
    const rand = seededRandom(seed);
    const box = section.getBoundingClientRect();
    const host = painting.getBoundingClientRect();
    const ox = box.left - host.left;
    const oy = box.top - host.top;
    const W = box.width, H = box.height;
    const origin0 = origin === 'top' ? [W / 2, 0] : origin === 'left' ? [0, H / 2] : [W / 2, H / 2];
    const maxD = Math.hypot(Math.max(origin0[0], W - origin0[0]), Math.max(origin0[1], H - origin0[1]));
    const add = (r, fill) => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const dx = cx - origin0[0], dy = cy - origin0[1];
      const d = Math.hypot(dx, dy) / maxD;
      const len = Math.hypot(dx, dy) || 1;
      const node = document.createElement('span');
      node.className = 'dis__shard';
      node.style.cssText = `left:${ox + r.x}px;top:${oy + r.y}px;width:${r.w + 0.6}px;height:${r.h + 0.6}px;background:${fill}`;
      painting.append(node);
      parts.push({
        node,
        delay: 0.55 * d + rand() * 0.08,        // the wave travels outward from the origin
        vx: (dx / len) * (60 + rand() * 140),    // px per unit τ, outward
        vy: -40 - rand() * 120,                  // a small lift before gravity wins
        vz: 260 + rand() * 360,                  // away from the viewer
        rx: (rand() - 0.5) * 540, ry: (rand() - 0.5) * 540, rz: (rand() - 0.5) * 240, // deg per unit τ
      });
    };

    // Fields that hold photos: paint them, shatter them.
    const visible = (n) => getComputedStyle(n).display !== 'none' && n.offsetParent !== null;
    const items = [...section.querySelectorAll('.stijl__item')];
    let coloured = 0;
    items.forEach((item, i) => {
      const r = item.getBoundingClientRect();
      const rect = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
      const fill = coloured < cap * items.length && rand() < 0.6 ? SHARD_HUES[(i + seed) % 3] : STIJL.paper;
      if (fill !== STIJL.paper) coloured++;
      shatter(rect, shards, rand).forEach((s) => add(s, fill));
    });
    // Accent fields keep their own colour.
    section.querySelectorAll('.stijl__deco').forEach((deco) => {
      if (!visible(deco)) return;
      deco.querySelectorAll('.stijl__accent').forEach((a) => {
        const r = a.getBoundingClientRect();
        shatter({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }, 3, rand)
          .forEach((s) => add(s, getComputedStyle(a).backgroundColor));
      });
      // Lines break into segments.
      deco.querySelectorAll('.stijl__line').forEach((l) => {
        const r = l.getBoundingClientRect();
        const along = r.width > r.height;
        const n = Math.max(1, Math.round((along ? r.width : r.height) / 140));
        for (let k = 0; k < n; k++) {
          const seg = along
            ? { x: r.left - box.left + (r.width / n) * k, y: r.top - box.top, w: r.width / n, h: r.height }
            : { x: r.left - box.left, y: r.top - box.top + (r.height / n) * k, w: r.width, h: r.height / n };
          add(seg, STIJL.ink);
        }
      });
    });
    // The outer frame, as four bars.
    const f = parseFloat(getComputedStyle(section).outlineWidth) || 12;
    [{ x: 0, y: 0, w: W, h: f }, { x: 0, y: H - f, w: W, h: f }, { x: 0, y: 0, w: f, h: H }, { x: W - f, y: 0, w: f, h: H }]
      .forEach((bar) => shatter(bar, 4, rand).forEach((s) => add(s, STIJL.ink)));
    update();
  }

  /** Progress 0–1 of the scroll through the track. */
  function progress() {
    const r = el.getBoundingClientRect();
    const span = el.offsetHeight - sticky.offsetHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
  }

  function update() {
    raf = 0;
    const p = progress();
    if (reduced.matches) {
      painting.style.opacity = String(1 - p);
      parts.forEach(({ node }) => { node.style.transform = ''; });
    } else {
      painting.style.opacity = '';
      const g = 900;     // px per unit τ² — gravity
      const az = 1400;   // px per unit τ² — acceleration away from the viewer
      for (const s of parts) {
        const t = Math.min(1, Math.max(0, (p - s.delay) / 0.42));
        if (t === 0) { s.node.style.transform = ''; s.node.style.opacity = ''; continue; }
        const tau = t * 1.2;
        const x = s.vx * tau;
        const y = s.vy * tau + 0.5 * g * tau * tau;
        const z = -(s.vz * tau + 0.5 * az * tau * tau);
        s.node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${(s.rx * tau).toFixed(1)}deg) rotateY(${(s.ry * tau).toFixed(1)}deg) rotateZ(${(s.rz * tau).toFixed(1)}deg)`;
        s.node.style.opacity = String(1 - Math.min(1, Math.max(0, (t - 0.55) / 0.45)));
      }
    }
    el.classList.toggle('is-clear', p >= 1);
  }

  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('scroll', onScroll, { passive: true });
  const ro = new ResizeObserver(() => build());
  ro.observe(section);
  build();
  return {
    rebuild: build,
    destroy() { window.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(raf); painting.innerHTML = ''; },
  };
}
