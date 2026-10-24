// DESCRIPTION: Renders semantic project sections as composed magazine spreads.
// INPUTS: Slide blocks and optional project title, section number and total count.
// OUTPUTS: Escaped editorial HTML shared by Cosmos and the project-import preview.
// DEPENDENCIES: presentation.js blockHTML and illusion/config.js escapeHtml.
import { blockHTML } from './presentation.js';
import { escapeHtml } from '../illusion/config.js';

/** Page proportions stay legible even when the containing world field is unusually narrow. */
export function layoutEditorialPages(count, box) {
  if (!count) return [];
  const columns = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * box.w / (box.h * 1.4)))));
  const rows = Math.ceil(count / columns);
  const gap = Math.min(Math.min(box.w, box.h) * 0.025, box.w / columns * 0.08, box.h / rows * 0.08);
  const w = Math.min((box.w - gap * (columns - 1)) / columns, (box.h - gap * (rows - 1)) / rows * 1.4);
  const h = w / 1.4;
  const left = box.x + (box.w - columns * w - (columns - 1) * gap) / 2;
  const top = box.y + (box.h - rows * h - (rows - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: left + (i % columns) * (w + gap), y: top + Math.floor(i / columns) * (h + gap), w, h }));
}

export function editorialLayout(blocks = []) {
  if (blocks.some((b) => b.type === 'figure' && b.src)) return 'visual';
  if (blocks.filter((b) => b.type === 'stat').length >= 2) return 'figures';
  if (blocks.some((b) => b.type === 'quote')) return 'essay';
  return 'feature';
}
export function renderEditorialSpread(slide, { index = 0, total = 1, title = '' } = {}) {
  const blocks = slide.blocks ?? [];
  const headingIndex = blocks.findIndex((b) => b.type === 'heading');
  const heading = blocks[headingIndex];
  const body = blocks.filter((_, i) => i !== headingIndex);
  const layout = editorialLayout(body);
  return `<article class="editorial-spread editorial--${layout}" aria-label="${escapeHtml(heading?.text ?? `Section ${index + 1}`)}">
    <header class="editorial-head"><p class="editorial-kicker">${escapeHtml(heading?.label || title || 'Project notes')} <span>— ${String(index + 1).padStart(2, '0')}</span></p><h2>${escapeHtml(heading?.text ?? title)}</h2><span class="editorial-rule" aria-hidden="true"></span></header>
    <div class="editorial-content" data-park-scroll tabindex="0" aria-label="Section content">${body.map((b, i) => `<div class="editorial-block editorial-block--${escapeHtml(b.type)}" data-tone="${escapeHtml(b.tone ?? 'auto')}" style="--block-index:${i}">${blockHTML(b)}</div>`).join('')}</div>
    <footer class="editorial-folio"><span>${escapeHtml(title || 'Hoc omnia nihil est')}</span><span>${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></footer>
  </article>`;
}
