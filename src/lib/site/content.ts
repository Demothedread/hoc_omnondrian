/**
 * site/content.ts — reads the CMS (Keystatic) for every page
 * ---------------------------------------------------------------------------
 * Projects: when "Build slides from" is "document", the raw text of the
 * project's document is mapped to slides by doc-to-deck.js (headings →
 * slides, labels, figures, quotes, images, lists). Otherwise the slides
 * built by hand are used.
 * Empty collections fall back to the samples, so every page builds before
 * any content exists.
 */
import { createReader } from '@keystatic/core/reader';
import Markdoc from '@markdoc/markdoc';
import keystaticConfig from '../../../keystatic.config';
import { documentToProject } from './doc-to-deck.js';
import { SAMPLE_PROJECTS, SAMPLE_PHOTOS, SAMPLE_POSTS } from './sample.js';

const reader = () => createReader(process.cwd(), keystaticConfig);

/** Raw document text for each project, bundled at build time (front matter removed). */
const RAW = import.meta.glob('/src/content/projects/*.mdoc', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const rawBody = (slug: string) => (RAW[`/src/content/projects/${slug}.mdoc`] ?? '').replace(/^---\n[\s\S]*?\n---\n?/, '');

const markdocHTML = async (content: () => Promise<{ node: any }>) => {
  const { node } = await content();
  return Markdoc.renderers.html(Markdoc.transform(node));
};

export async function getProjects() {
  try {
    const all = await reader().collections.projects.all();
    if (!all.length) return SAMPLE_PROJECTS;
    return all
      .map(({ slug, entry }) => {
        const handBuilt = entry.slides.map((s) => ({ blocks: s.blocks.map((b) => ({ type: b.discriminant, ...b.value })) }));
        const doc = entry.source === 'document' ? documentToProject(rawBody(slug), { title: entry.title, maxWords: entry.maxWords ?? 150 }) : null;
        const slides = doc && doc.slides.length ? doc.slides : handBuilt;
        return {
          slug,
          title: entry.title,
          kind: entry.kind,
          format: entry.format,
          weight: entry.weight ?? 1,
          summary: entry.summary || doc?.summary || '',
          order: entry.order ?? 0,
          source: entry.source,
          slides: slides.length ? slides : [{ blocks: [{ type: 'heading', text: entry.title }, { type: 'placeholder', text: 'Write the document in the CMS.' }] }],
        };
      })
      .sort((a, b) => a.order - b.order);
  } catch (error) {
    console.warn('[site] projects: using samples', error);
    return SAMPLE_PROJECTS;
  }
}

export async function getPhotos() {
  try {
    const g = await reader().singletons.gallery.read();
    if (!g?.photos?.length) return SAMPLE_PHOTOS;
    return g.photos.map((p, i) => ({ id: `photo-${i + 1}`, src: p.image, full: p.image, alt: p.alt, caption: p.caption, weight: p.weight ?? 1 }));
  } catch {
    return SAMPLE_PHOTOS;
  }
}

export async function getPosts() {
  try {
    const all = await reader().collections.posts.all();
    if (!all.length) return SAMPLE_POSTS.map((p) => ({ ...p, content: null }));
    return all
      .filter(({ entry }) => !entry.draft)
      .map(({ slug, entry }) => ({ slug, title: entry.title, date: entry.date, summary: entry.summary, tone: entry.tone, content: entry.content }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch {
    return SAMPLE_POSTS.map((p) => ({ ...p, content: null }));
  }
}

/** A post's body as HTML (Markdoc), or null for samples (they carry plain text). */
export async function getPostHTML(post: any) {
  return post.content ? markdocHTML(post.content) : null;
}

export async function getAbout() {
  try {
    const a = await reader().singletons.about.read();
    if (a) return { title: a.title, summary: a.summary, html: await markdocHTML(a.content) };
  } catch {}
  return { title: 'About', summary: 'Write the About page in the CMS.', html: '<p>Write the About page in the CMS (About).</p>' };
}

export async function getResume() {
  try {
    const r = await reader().singletons.resume.read();
    if (r?.sections?.length) return r;
  } catch {}
  return { summary: 'Fill in the Resumé in the CMS.', sections: [{ heading: 'Experience', entries: [{ title: 'Role', org: 'Organisation', dates: 'Years', note: 'Write entries in the CMS.' }] }] };
}
