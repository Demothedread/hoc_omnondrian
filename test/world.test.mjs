// node test/world.test.mjs — the unified world: every place exists, every link resolves, every item has room
import assert from 'node:assert/strict';
import { worldModel, renderWorldHTML, worldRoutes } from '../src/lib/cosmos/world.js';
import { SAMPLE_MODULES, buildModules } from '../src/lib/cosmos/sample-content.js';
import { documentToProject } from '../src/lib/site/doc-to-deck.js';

// A heavier world than the samples: 9 projects built from documents, 30 photos, 12 posts.
const doc = (n) => `# Project ${n}\n\nIntro paragraph.\n\nKEY\n## Context\n\nSome text here. More text.\n\n- Figure one: 12%\n- Figure two: 3.4x\n\n## Findings\n\n> A quote.\n> — Source\n\n## Next\n\nClosing words.`;
const projects = Array.from({ length: 9 }, (_, i) => ({ slug: `p${i + 1}`, title: `Project ${i + 1}`, kind: i % 2 ? 'Report' : 'Presentation', format: i % 2 ? 'report' : 'deck', ...documentToProject(doc(i + 1)) }));
const photos = Array.from({ length: 30 }, (_, i) => ({ id: `photo-${i + 1}`, src: `/images/gallery/${i + 1}.jpg`, alt: `Photo ${i + 1}` }));
const posts = Array.from({ length: 12 }, (_, i) => ({ slug: `post-${i + 1}`, title: `Post ${i + 1}`, date: '2026-10-01', summary: 'Summary.', html: '<p>Body.</p>' }));
const heavy = buildModules({ projects, photos, posts, about: { title: 'About', summary: 's', html: '<p>x</p>' }, resume: { sections: [{ heading: 'Experience', entries: [{ title: 'A', org: 'B', dates: 'C', note: '' }] }, { heading: 'Education', entries: [{ title: 'D' }] }] } });

for (const [name, modules, seeds] of [['sample', SAMPLE_MODULES, 600], ['heavy', heavy, 300]]) {
  let short = 0, dead = 0, dupe = 0, missing = 0, kb = 0;
  const routes = worldRoutes(modules).map((r) => r.route);
  assert.equal(new Set(routes).size, routes.length, 'routes are unique');
  for (let seed = 1; seed <= seeds; seed++) {
    const model = worldModel(seed, modules);
    for (const r of model.regions) if (r.module && r.leaves.filter((l) => l.role === 'item').length !== r.module.items.length) short++;
    if (seed % 50 === 1) {
      const html = renderWorldHTML(model, { base: '/' });
      kb = Math.max(kb, html.length / 1024);
      const inMap = [...html.matchAll(/data-route="([^"]+)"/g)].map((m) => m[1]);
      const set = new Set(inMap);
      missing += routes.filter((r) => r && !set.has(r)).length;               // listed but not in the map
      for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) {                   // every internal link goes somewhere
        const path = m[1].replace(/^\/|\/$/g, '');
        if (!routes.includes(path) && !/^api\/.+\.json$/.test(path)) dead++;
      }
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      dupe += ids.length - new Set(ids).size;
    }
  }
  console.log(`${name}: ${routes.length} places | regions short of room: ${short}/${seeds * 6} | routes missing from the map: ${missing} | dead links: ${dead} | duplicate ids: ${dupe} | largest page ${kb.toFixed(0)} KB`);
  assert.equal(short, 0); assert.equal(missing, 0); assert.equal(dead, 0); assert.equal(dupe, 0);
}

// Every slide of every project is a place; the report is too.
const routes = worldRoutes(heavy).map((r) => r.route);
assert.ok(routes.includes('projects/p1/1') && routes.includes('projects/p1/report') && routes.includes('gallery/photo-30') && routes.includes('ideas/post-12') && routes.includes('resume/education'));
console.log('ok slides, reports, photos, posts and resumé sections are places');
