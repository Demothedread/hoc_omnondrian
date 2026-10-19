/**
 * stijl/blog.js — the blog index and a post header, composed
 * ---------------------------------------------------------------------------
 * Post shape: { slug, title, date (YYYY-MM-DD), summary, tone?, body? }
 * Newest posts weigh more, so they take more of the composition.
 */
import { renderSection } from './compose.js';
import { escapeHtml } from '../illusion/config.js';

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export function renderBlogIndex(posts, { base = '/blog', seed = 1931 } = {}) {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  return renderSection({
    items: sorted.map((p, i) => ({
      id: p.slug,
      weight: i === 0 ? 2 : i < 3 ? 1.3 : 1,
      tone: i === 0 ? (p.tone ?? 'auto') : 'auto',
      kicker: fmt(p.date),
      title: p.title,
      summary: p.summary,
      href: `${base}/${p.slug}`,
    })),
    seed, wide: 1.6, tall: sorted.length > 6 ? 0.32 : 0.5, label: 'Posts',
  });
}

export function renderPostHead(post, { seed = 7 } = {}) {
  return renderSection({
    items: [
      { id: 'title', weight: 2.4, tone: 'paper', html: `<p class="stijl__kicker">${fmt(post.date)}</p><h1 class="stijl__title">${escapeHtml(post.title)}</h1>` },
      { id: 'summary', weight: 1, tone: post.tone ?? 'auto', html: `<p class="stijl__summary">${escapeHtml(post.summary ?? '')}</p>` },
    ],
    seed, wide: 2.6, tall: 0.9, tag: 'header', compose: { accents: 1.5 },
  });
}

/** Plain-text body to paragraphs (the CMS version renders Markdoc instead). */
export const bodyHTML = (t = '') => String(t).split(/\n{2,}/).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
