/**
 * cosmos/snapshot.js — paint what is on screen into a canvas
 * ---------------------------------------------------------------------------
 * The warp bends a texture, so it needs a picture of the screen. Instead of
 * a general DOM rasteriser (html2canvas is large and slow), this paints the
 * few things the cosmos actually shows: fields as rectangles, the
 * singularity, visible text word by word at its real on-screen position
 * and size, and the title card. Fast enough to run between two frames.
 */

const INK = '#000';

/** Visible words of an element, each with its on-screen rect. */
function wordRects(el) {
  const out = [];
  // Physics letters are already one span per glyph.
  const letters = el.querySelectorAll('.ill-ph');
  if (letters.length) {
    letters.forEach((span) => { const r = span.getBoundingClientRect(); out.push({ text: span.textContent, r }); });
    return out;
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('.ill-sr')) continue;
    for (const m of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (r) out.push({ text: m[0], r });
    }
  }
  return out;
}

/** Effective opacity including ancestors up to (not including) root. */
function opacityOf(el, root) {
  let o = 1;
  for (let e = el; e && e !== root; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
  return o;
}

function drawText(ctx, el, box, scale, root) {
  const alpha = opacityOf(el, root);
  if (alpha < 0.05) return;
  const cs = getComputedStyle(el);
  const size = parseFloat(cs.fontSize) * scale;
  if (size < 3) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = cs.color;
  ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  ctx.textBaseline = 'middle';
  for (const { text, r } of wordRects(el)) {
    if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) continue;
    ctx.fillText(text, r.left - box.left, r.top - box.top + r.height / 2, r.width + 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * @param {HTMLElement} root   the .cos element
 * @param {{ card?: boolean }} [o]  include the title card (default true)
 * @returns {HTMLCanvasElement}
 */
export function snapshotCosmos(root, { card = true } = {}) {
  const box = root.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2, 2048 / Math.max(1, box.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, box.width, box.height);

  const plane = root.querySelector('.cos-plane');
  const scale = Number(plane.style.getPropertyValue('--cos-s')) || 1;
  const visible = (r) => r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;

  // Fields.
  plane.querySelectorAll('.cos-cell, .cos-singularity').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!visible(r)) return;
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(r.left - box.left, r.top - box.top, r.width, r.height);
  });
  // The singularity's painted hole and ring.
  plane.querySelectorAll('.cos-singularity__hole').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!visible(r)) return;
    const cx = r.left - box.left + r.width / 2;
    const cy = r.top - box.top + r.height / 2;
    const rad = r.width / 2;
    [['#d40920', 0.72], ['#f5d316', 0.63], [INK, 0.6]].forEach(([c, f]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, rad * f, 0, Math.PI * 2); ctx.fill();
    });
  });
  // Text on the map.
  plane.querySelectorAll('.cos-lod').forEach((el) => {
    if (visible(el.getBoundingClientRect())) drawText(ctx, el, box, scale, root);
  });

  // Title card.
  const cardEl = root.querySelector('.cos-title');
  if (card && cardEl && opacityOf(cardEl, root) > 0.05) {
    const r = cardEl.getBoundingClientRect();
    const cs = getComputedStyle(cardEl);
    const bw = parseFloat(cs.borderTopWidth) || 0;
    ctx.globalAlpha = opacityOf(cardEl, root);
    ctx.fillStyle = INK;
    ctx.fillRect(r.left - box.left, r.top - box.top, r.width, r.height);
    ctx.fillStyle = cs.backgroundColor;
    ctx.fillRect(r.left - box.left + bw, r.top - box.top + bw, r.width - 2 * bw, r.height - 2 * bw);
    ctx.globalAlpha = 1;
    cardEl.querySelectorAll('.cos-title__text, .cos-title__sub').forEach((el) => drawText(ctx, el, box, 1, root));
  }
  return canvas;
}
