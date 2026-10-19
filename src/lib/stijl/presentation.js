/**
 * stijl/presentation.js — one project, two forms: a deck or a report
 * ---------------------------------------------------------------------------
 * A project is a list of slides; a slide is a list of blocks. The same
 * content renders as:
 *   deck    full-screen slides, each a Mondrian composition of its blocks
 *           (composeSection), assembling as it scrolls into view
 *   report  long-form reading: each slide becomes a titled section, with a
 *           small composition in the rail as the project's mark
 *
 * Block types (all CMS fields, or produced from a document by site/doc-to-deck.js):
 *   heading { text, label? }    text { text, heading? }  stat { value, label }
 *   quote { text, by }          figure { src, alt, caption }
 *   list { items, ordered? }    placeholder { text }     (scaffolding until real content is written)
 * Any block may set weight (share of the slide) and tone (auto | paper | red | blue | yellow).
 */
import { renderSection } from './compose.js';
import { escapeHtml } from '../illusion/config.js';

const DEFAULT_WEIGHT = { heading: 1.3, text: 2, stat: 0.9, quote: 1.4, figure: 2.2, list: 1.8, placeholder: 1.2 };
const DEFAULT_TONE = { heading: 'auto', text: 'paper', stat: 'yellow', quote: 'auto', figure: 'paper', list: 'paper', placeholder: 'paper' };

/** Paragraphs from plain text (blank line = new paragraph). */
const paras = (t = '', cls = 'blk-text') =>
  String(t).split(/\n{2,}/).filter(Boolean).map((p) => `<p class="${cls}">${escapeHtml(p)}</p>`).join('');

export function blockHTML(b) {
  switch (b.type) {
    case 'heading': return `${b.label ? `<p class="stijl__kicker">${escapeHtml(b.label)}</p>` : ''}<h2 class="blk-heading">${escapeHtml(b.text)}</h2>`;
    case 'text': return `${b.heading ? `<h3 class="blk-subhead">${escapeHtml(b.heading)}</h3>` : ''}${paras(b.text)}`;
    case 'list': return `${b.heading ? `<h3 class="blk-subhead">${escapeHtml(b.heading)}</h3>` : ''}<${b.ordered ? 'ol' : 'ul'} class="blk-list">${(b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
    case 'stat': return `<p class="blk-stat">${escapeHtml(b.value)}</p>${b.label ? `<p class="blk-text">${escapeHtml(b.label)}</p>` : ''}`;
    case 'quote': return `<blockquote class="blk-quote">${escapeHtml(b.text)}${b.by ? `<footer class="blk-text">— ${escapeHtml(b.by)}</footer>` : ''}</blockquote>`;
    case 'figure': return b.src
      ? `<figure class="blk-figure"><img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt ?? '')}" loading="lazy" decoding="async">${b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ''}</figure>`
      : `<p class="blk-placeholder">Figure: ${escapeHtml(b.caption || 'add an image in the CMS')}</p>`;
    default: return `<p class="blk-placeholder">${escapeHtml(b.text ?? '')}</p>`;
  }
}

export function slideItems(slide, s) {
  return slide.blocks.map((b, i) => ({
    id: `s${s}b${i}`,
    weight: b.weight ?? (b.title ? 2.2 : DEFAULT_WEIGHT[b.type] ?? 1),
    tone: b.tone ?? DEFAULT_TONE[b.type] ?? 'auto',
    html: blockHTML(b),
  }));
}

/** Seed from a string, so each project keeps its own composition across builds. */
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 100000;
}

/** The deck: one composed, full-screen section per slide. */
export function renderDeck(project) {
  const base = seedOf(project.slug);
  const slides = project.slides.map((slide, s) => `
    <section class="deck__slide" id="slide-${s + 1}" aria-label="Slide ${s + 1} of ${project.slides.length}">
      ${renderSection({ items: slideItems(slide, s), seed: base + s * 7, wide: 16 / 9, tall: 0.56, tag: 'div', compose: { accents: 0.4, autoColour: 0.45 } })}
    </section>`).join('');
  return `<div class="deck" data-deck tabindex="0">${slides}</div>`;
}

/** The report: the same blocks as continuous reading. */
export function renderReport(project, { bodyOnly = false } = {}) {
  const hues = ['var(--ill-red)', 'var(--ill-blue)', 'var(--ill-yellow)'];
  // Slides that continue a section ("… (continued)") rejoin it in the report.
  const merged = [];
  for (const slide of project.slides) {
    const h = slide.blocks.find((b) => b.type === 'heading');
    if (h && / \(continued\)$/.test(h.text) && merged.length) merged[merged.length - 1].blocks.push(...slide.blocks.filter((b) => b !== h));
    else merged.push({ blocks: [...slide.blocks] });
  }
  const sections = merged.map((slide, s) => {
    const head = slide.blocks.find((b) => b.type === 'heading');
    const id = `${project.slug}-section-${s + 1}`;                        // unique across the whole page, since every project's report is on it
    const body = slide.blocks.filter((b) => b !== head).map((b) => {
      if (b.type === 'stat') return `<div class="report__stat"><strong>${escapeHtml(b.value)}</strong><span>${escapeHtml(b.label ?? '')}</span></div>`;
      if (b.type === 'quote') return `<blockquote>${escapeHtml(b.text)}${b.by ? `<br><small>— ${escapeHtml(b.by)}</small>` : ''}</blockquote>`;
      if (b.type === 'figure') return b.src ? `<figure><img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt ?? '')}" loading="lazy">${b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ''}</figure>` : '';
      const sub = b.heading ? `<h3>${escapeHtml(b.heading)}</h3>` : '';
      if (b.type === 'list') return `${sub}<${b.ordered ? 'ol' : 'ul'}>${(b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
      if (b.type === 'heading') return `<h3>${escapeHtml(b.text)}</h3>`;
      return sub + paras(b.text, '');
    }).join('');
    const kicker = head?.label ? `<p class="report__label">${escapeHtml(head.label)}</p>` : '';
    return { id, title: head?.text ?? `Section ${s + 1}`, html: `<section id="${id}" style="--section-colour:${hues[s % 3]}">${kicker}<h2>${escapeHtml(head?.text ?? `Section ${s + 1}`)}</h2>${body}</section>` };
  });
  if (bodyOnly) return `<div class="report__body">${sections.map((x) => x.html).join('')}</div>`;
  const mark = renderSection({
    items: [{ id: 'mark', weight: 1.6, tone: 'paper', html: `<p class="stijl__kicker">${escapeHtml(project.kind ?? 'Report')}</p><h1 class="stijl__title">${escapeHtml(project.title)}</h1>` }],
    seed: seedOf(project.slug), wide: 0.8, tall: 0.8, tag: 'div', compose: { accents: 3 },
  });
  return `<div class="report">
    <aside class="report__rail">${mark}<ol class="report__toc">${sections.map((x) => `<li><a href="#${x.id}">${escapeHtml(x.title)}</a></li>`).join('')}</ol></aside>
    <article class="report__body">${sections.map((x) => x.html).join('')}</article>
  </div>`;
}

/**
 * The outline: every slide and block, with the rule that produced it.
 * For authors checking how a document was read (see /projects/<slug>/outline).
 */
export function renderOutline(project) {
  const row = (b) => {
    const what = b.type === 'stat' ? `${b.value} — ${b.label}` : b.type === 'list' ? b.items.join(' · ') : b.type === 'figure' ? (b.caption || b.src || '') : (b.text ?? '');
    const extra = [b.label && b.type === 'heading' ? `label “${b.label}”` : '', b.heading ? `subheading “${b.heading}”` : '', b.by ? `source “${b.by}”` : ''].filter(Boolean).join(', ');
    return `<li class="outline__block"><span class="outline__type">${escapeHtml(b.type)}</span><span class="outline__text">${escapeHtml(String(what).slice(0, 140))}${extra ? ` <em>(${escapeHtml(extra)})</em>` : ''}</span><span class="outline__rule">${escapeHtml(b.rule ?? 'written as a slide in the CMS')}</span></li>`;
  };
  return `<ol class="outline">${project.slides.map((s, i) => `<li class="outline__slide"><h2 class="outline__head"><span class="an-lcd">${i + 1}</span> ${escapeHtml(s.blocks.find((b) => b.type === 'heading')?.text ?? 'Untitled slide')}</h2><ul>${s.blocks.map(row).join('')}</ul></li>`).join('')}</ol>`;
}
