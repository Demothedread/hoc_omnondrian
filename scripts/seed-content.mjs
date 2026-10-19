// scripts/seed-content.mjs — writes the starter content (run once; safe to delete)
import { writeFileSync, mkdirSync } from 'node:fs';
import { SAMPLE_PHOTOS, SAMPLE_POSTS } from '../src/lib/site/sample.js';
import { SAMPLE_SHOTS } from '../src/lib/cosmos/sample-content.js';

const q = (s) => JSON.stringify(String(s)); // YAML accepts JSON strings
const front = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? '[]' : typeof v === 'string' ? q(v) : v}`).join('\n')}\n---\n`;

const doc = (title, kind) => `# ${title}

[Placeholder] One paragraph that sets up the ${kind.toLowerCase()}: the question it answers and why it matters.

Headline figure: 00%

PART ONE
## Context

[Placeholder] What was the situation? Who was involved, and what was at stake? Write it as you would in a report; the site turns each section into a slide.

### What changed
[Placeholder] The decision, event or discovery at the centre of the story.

## Approach

[Placeholder] How the problem was taken apart: the method, the data, the choices.

- [Placeholder] First step
- [Placeholder] Second step
- [Placeholder] Third step

> [Placeholder] A sentence worth pulling out of the text.
> — Source

PART TWO
## Findings

- Placeholder figure one: 00%
- Placeholder figure two: 00
- Placeholder figure three: $00M

[Placeholder] What the evidence showed, in two or three sentences.

## What next

[Placeholder] Recommendations, open questions, and where to read more.
`;

const projects = [
  ['tesla', 'Tesla', 'Presentation', 'deck', 1.5],
  ['uber', 'Uber', 'Presentation', 'deck', 1],
  ['hesperia-ca', 'Hesperia, CA', 'Report', 'report', 1],
  ['big-swingn-picks', 'The algorithm behind Big Swing’n’ Picks', 'Report', 'report', 1.3],
  ['common-party', 'Common Party', 'Presentation', 'deck', 1],
];
mkdirSync('src/content/projects', { recursive: true });
projects.forEach(([slug, title, kind, format, weight], order) => {
  writeFileSync(`src/content/projects/${slug}.mdoc`,
    front({ title, kind, format, summary: '', source: 'document', maxWords: 150, weight, order, slides: [] }) + '\n' + doc(title, kind));
});

mkdirSync('src/content/posts', { recursive: true });
for (const p of SAMPLE_POSTS) {
  writeFileSync(`src/content/posts/${p.slug}.mdoc`, front({ title: p.title, date: p.date, summary: p.summary, tone: p.tone, draft: false }) + '\n' + p.body + '\n');
}

mkdirSync('public/images/gallery', { recursive: true });
const photos = SAMPLE_PHOTOS.map((p, i) => {
  const file = `sample-${i + 1}.svg`;
  writeFileSync(`public/images/gallery/${file}`, decodeURIComponent(p.src.replace('data:image/svg+xml,', '')));
  return { image: `/images/gallery/${file}`, alt: p.alt, caption: p.caption, weight: p.weight };
});
mkdirSync('src/content/gallery', { recursive: true });
writeFileSync('src/content/gallery/index.json', JSON.stringify({ photos }, null, 2) + '\n');

mkdirSync('src/content/about', { recursive: true });
writeFileSync('src/content/about/index.mdoc', front({ title: 'About', summary: '[Placeholder] One or two sentences about the studio.' }) +
  '\n[Placeholder] Write the About page in the CMS: who you are, what the studio does, how to get in touch.\n');

mkdirSync('src/content/resume', { recursive: true });
writeFileSync('src/content/resume/index.json', JSON.stringify({
  summary: '[Placeholder] A sentence that frames the resumé.',
  sections: [
    { heading: 'Experience', entries: [{ title: '[Placeholder] Role', org: 'Organisation', dates: 'Years', note: 'What you did there.' }, { title: '[Placeholder] Role', org: 'Organisation', dates: 'Years', note: '' }] },
    { heading: 'Education', entries: [{ title: '[Placeholder] Degree', org: 'School', dates: 'Year', note: '' }] },
    { heading: 'Skills', entries: [{ title: '[Placeholder] Skill', org: '', dates: '', note: '' }, { title: '[Placeholder] Skill', org: '', dates: '', note: '' }] },
  ],
}, null, 2) + '\n');

mkdirSync('src/content/shots', { recursive: true });
for (const s of SAMPLE_SHOTS) {
  writeFileSync(`src/content/shots/${s.id}.json`, JSON.stringify({
    trigger: s.trigger.on, route: s.trigger.route ?? '', idleSeconds: s.trigger.seconds ?? 60, loop: !!s.loop,
    steps: s.steps.map((st) => ({ to: Array.isArray(st.to) ? st.to.join(', ') : st.to, fit: st.fit ?? '', speed: st.speed ?? 1, ease: st.ease ?? '', hold: st.hold ?? 0, push: st.push ?? 1, panX: st.pan?.[0] ?? 0, panY: st.pan?.[1] ?? 0, focus: st.focus ?? 'map', title: st.title ?? '' })),
  }, null, 2) + '\n');
}
console.log('seeded: 5 projects, posts, 12 photos, about, resume, shots');
