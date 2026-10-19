/**
 * site/sample.js — scaffolding content until the CMS entries exist
 * ---------------------------------------------------------------------------
 * The five projects are real titles with placeholder sections: replace every
 * "[Placeholder]" in Keystatic (Projects collection). Nothing here makes
 * claims about the subjects.
 */

const scaffold = (title, kind) => [
  { blocks: [
    { type: 'heading', text: title, tone: 'paper', weight: 2 },
    { type: 'placeholder', text: `[Placeholder] One-sentence premise of the ${kind.toLowerCase()}.` },
    { type: 'stat', value: '—', label: '[Placeholder] The one number this work turns on' },
  ] },
  { blocks: [
    { type: 'heading', text: 'Context' },
    { type: 'text', text: '[Placeholder] What was the situation, and why did it matter?\n\nA second paragraph if needed.' },
    { type: 'figure', caption: 'Add a context image or chart in the CMS' },
  ] },
  { blocks: [
    { type: 'heading', text: 'Approach' },
    { type: 'text', text: '[Placeholder] How the problem was taken apart: method, data, decisions.' },
    { type: 'stat', value: '—', label: '[Placeholder] A measure of scope' },
    { type: 'quote', text: '[Placeholder] A line worth pulling out.', by: 'Source' },
  ] },
  { blocks: [
    { type: 'heading', text: 'Findings' },
    { type: 'stat', value: '—', label: '[Placeholder] Result one' },
    { type: 'stat', value: '—', label: '[Placeholder] Result two' },
    { type: 'text', text: '[Placeholder] What the evidence showed.' },
  ] },
  { blocks: [
    { type: 'heading', text: 'What next' },
    { type: 'text', text: '[Placeholder] Recommendations, open questions, and where to read more.' },
  ] },
];

export const SAMPLE_PROJECTS = [
  { slug: 'tesla', title: 'Tesla', kind: 'Presentation', format: 'deck', weight: 1.5,
    summary: '[Placeholder] One-line summary from the CMS.' },
  { slug: 'uber', title: 'Uber', kind: 'Presentation', format: 'deck',
    summary: '[Placeholder] One-line summary from the CMS.' },
  { slug: 'hesperia-ca', title: 'Hesperia, CA', kind: 'Report', format: 'report',
    summary: '[Placeholder] One-line summary from the CMS.' },
  { slug: 'big-swingn-picks', title: 'The algorithm behind Big Swing’n’ Picks', kind: 'Report', format: 'report', weight: 1.3,
    summary: '[Placeholder] One-line summary from the CMS.' },
  { slug: 'common-party', title: 'Common Party', kind: 'Presentation', format: 'deck',
    summary: '[Placeholder] One-line summary from the CMS.' },
].map((p) => ({ ...p, slides: scaffold(p.title, p.kind) }));

/**
 * Placeholder photos: generated SVG "prints" (no files, no network), each a
 * simple horizon study in the palette. Replace with the Gallery collection.
 */
function study(i) {
  const skies = [['#1356a2', '#7fa6d6'], ['#d40920', '#f5a35a'], ['#f5d316', '#eeeeea'], ['#22252b', '#6b7380'], ['#eeeeea', '#c9c9c2']];
  const [a, b] = skies[i % skies.length];
  const h = 52 + ((i * 17) % 30);
  const sun = 18 + ((i * 29) % 64);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>
    <rect width='160' height='100' fill='url(#g)'/><circle cx='${sun * 1.6}' cy='${h - 14}' r='9' fill='#eeeeea' opacity='.85'/>
    <path d='M0 ${h} Q40 ${h - 10} 80 ${h - 2} T160 ${h - 6} V100 H0Z' fill='#000' opacity='.82'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
export const SAMPLE_PHOTOS = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i + 1}`,
  src: study(i),
  alt: `Sample horizon study ${i + 1}`,
  caption: `Sample image ${i + 1}. Replace with a photograph in the CMS.`,
  weight: i % 4 === 0 ? 1.6 : 1,
}));

export const SAMPLE_POSTS = [
  { slug: 'welcome', title: 'Welcome to the blog', date: '2026-10-16', tone: 'red',
    summary: 'A sample post. Write real ones in Keystatic under Posts.',
    body: 'This is a sample post so the blog has something to compose. Each post has a title, date, summary, tone and a body written in Keystatic.\n\nThe index arranges posts with the same De Stijl composer as the rest of the site: newer posts carry more weight, so they get more of the canvas.' },
  { slug: 'how-this-site-composes-itself', title: 'How this site composes itself', date: '2026-10-15', tone: 'blue',
    summary: 'Guillotine cuts, weights and a colour cap: the rules behind every section.',
    body: 'Every section is a list of items. The composer splits the space where their weights balance, cuts across the longer side, interleaves small accent fields, and keeps colour under 37.5% of the area.\n\nThe cuts are remembered in order, so each composition can assemble on screen the way it was made: heavy lines first, then lighter ones, then the fields.' },
  { slug: 'writing-in-keystatic', title: 'Writing in Keystatic', date: '2026-10-14', tone: 'yellow',
    summary: 'Where posts, projects and photos live in the CMS.',
    body: 'Posts live in the Posts collection, projects in Projects (each a list of slides made of blocks), and photographs in Gallery.\n\nPublishing a post rebuilds the site; the post appears on the blog index, in the RSS feed, and as a place on the cosmos map if you map it there.' },
];
