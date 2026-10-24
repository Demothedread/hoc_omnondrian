// DESCRIPTION: Maps site content to pluggable Cosmos modules and fallback camera shots.
// INPUTS: Projects, photos, posts, About and résumé content.
// OUTPUTS: Module items with nested projects and addressable journey stations.
// DEPENDENCIES: Site renderers, sample data and the pure journey adapter.
import { SAMPLE_PROJECTS, SAMPLE_PHOTOS, SAMPLE_POSTS } from '../site/sample.js';
import { renderReport } from '../stijl/presentation.js';
import { bodyHTML } from '../stijl/blog.js';
import { escapeHtml } from '../illusion/config.js';
import { journeySections } from './journey.js';

const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The six regions of the map, filled from content. Used by the CMS adapter
 * (cosmos/content.ts) with real entries, and below with the samples.
 *   projects  each a project (nested slides + report)
 *   gallery   each photo
 *   ideas     each post (read in place)
 *   about     the About text (read in place)
 *   resume    each section as cards
 *   api       the JSON endpoints as cards
 */
export function buildModules({ projects, photos, posts, about, resume }) {
  return [
    { id: 'projects', title: 'Projects', summary: 'Presentations and reports. Fly in to present; ← → move between slides.',
      items: projects.map((p) => ({ id: p.slug, title: p.title, body: p.kind ?? 'Presentation', kind: 'project', format: p.format ?? 'deck', slides: p.slides, report: renderReport(p, { bodyOnly: true }) })) },
    { id: 'gallery', title: 'Gallery', summary: 'Photographs under a painting that comes apart as you arrive.',
      items: photos.map((ph) => ({ id: ph.id, title: ph.alt, kind: 'photo', src: ph.src, full: ph.full ?? ph.src, alt: ph.alt, caption: ph.caption })) },
    { id: 'ideas', title: 'Ideas', summary: 'Writing. Fly to a post to read it.',
      items: posts.map((p) => ({ id: p.slug, title: p.title, body: p.summary, kind: 'read',
        html: `<header class="cos-read__head"><p class="stijl__kicker">${escapeHtml(p.date ?? '')}</p><h1>${escapeHtml(p.title)}</h1></header>${p.html ?? ''}` })) },
    { id: 'about', title: 'About', summary: about.summary ?? '', greeting: about.greeting, avatar: about.avatar,
      items: [{ id: 'studio', title: about.title ?? 'About', body: about.summary ?? '', kind: 'read', html: `<h1>${escapeHtml(about.title ?? 'About')}</h1>${about.html ?? ''}` }] },
    { id: 'resume', title: 'Resumé', summary: resume.summary ?? 'Experience, education, skills.',
      items: journeySections(resume) },
    { id: 'api', title: 'Site links', summary: 'Connections and open collections.',
      items: [{ id: 'endpoints', title: 'Endpoints', body: 'JSON for every collection.', kind: 'cards', cards: [
        { kicker: 'GET', title: '/api/projects.json', summary: 'Projects with their slides', href: '/api/projects.json' },
        { kicker: 'GET', title: '/api/posts.json', summary: 'Posts', href: '/api/posts.json' },
        { kicker: 'GET', title: '/api/photos.json', summary: 'Photographs', href: '/api/photos.json' },
        { kicker: 'GET', title: '/api/resume.json', summary: 'Resumé', href: '/api/resume.json' },
      ] }] },
  ];
}

/**
 * cosmos/sample-content.js — placeholder modules until the CMS is wired
 * ---------------------------------------------------------------------------
 * Shape expected by the world (the CMS adapter returns the same):
 *   { id, title, summary, items: [{ id, title, body, href? }] }
 * An item with href opens that page on a second click (the first flies there).
 * Order = prominence: the first module gets the largest region.
 */
export const SAMPLE_MODULES = buildModules({
  projects: SAMPLE_PROJECTS,
  photos: SAMPLE_PHOTOS,
  posts: SAMPLE_POSTS.map((p) => ({ ...p, html: bodyHTML(p.body) })),
  about: { title: 'About the studio', summary: '[Placeholder] Who works here.', html: '<p>[Placeholder] Write the About page in the CMS: who you are, what the studio does, how to get in touch.</p>' },
  resume: {
    sections: [
      { heading: 'Experience', entries: [{ title: '[Placeholder] Role', org: 'Organisation', dates: 'Years', note: 'What you did there.' }, { title: '[Placeholder] Role', org: 'Organisation', dates: 'Years', note: '' }] },
      { heading: 'Education', entries: [{ title: '[Placeholder] Degree', org: 'School', dates: 'Year', note: '' }] },
      { heading: 'Skills', entries: [{ title: '[Placeholder] Skill', org: '', dates: '', note: '' }, { title: '[Placeholder] Skill', org: '', dates: '', note: '' }] },
    ],
  },
});

/**
 * Sample shots (format in shots.js). Replace with the Keystatic "Shots"
 * collection via getCosmosShots() in content.ts.
 * @type {import('./shots.js').Shot[]}
 */
export const SAMPLE_SHOTS = [
  {
    // Clicking Projects plays a sequence instead of a single flight.
    id: 'projects-reveal',
    trigger: { on: 'click', route: 'projects' },
    steps: [
      { to: 'projects', fit: 'frame', speed: 0.8, hold: 2.5, push: 1.06 },
      { to: 'projects/tesla', fit: 'fill', speed: 1.1, ease: 'expo', hold: 3, push: 1.1, pan: [0.03, 0] },
      { to: 'projects/uber', fit: 'fill', speed: 1.1, ease: 'expo', hold: 3, push: 1.1, pan: [-0.03, 0] },
      { to: 'projects', fit: 'frame', speed: 0.9, ease: 'cubic' },
    ],
  },
  {
    // Attract mode: a slow Ken Burns loop after 60 s without input.
    id: 'attract',
    trigger: { on: 'idle', seconds: 60 },
    loop: true,
    steps: [
      { to: 'overview', hold: 6, push: 1.14, speed: 0.6 },
      { to: 'gallery', fit: 'frame', hold: 6, push: 1.12, speed: 0.6 },
      { to: 'ideas', fit: 'frame', hold: 6, push: 1.12, speed: 0.6, pan: [0.03, 0.02] },
    ],
  },
];
