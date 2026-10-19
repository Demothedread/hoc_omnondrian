// node test/import.test.mjs — the import script on HTML and plain text
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importProject, htmlToMarkdown, slugify, outline } from '../scripts/import-project.mjs';

const out = mkdtempSync(join(tmpdir(), 'import-'));

const md = htmlToMarkdown(readFileSync(new URL('./fixtures/report.html', import.meta.url), 'utf8'));
assert.match(md, /^# Common Party$/m);
assert.match(md, /^- Chapters: 12$/m);
assert.match(md, /^> Politics is what neighbours do together\.$/m);
assert.match(md, /^!\[A meeting\]\(\/images\/projects\/club\.jpg "The first meeting"\)$/m);
assert.match(md, /open\./, 'entities decoded');
console.log('ok html → markdown');

const html = await importProject(new URL('./fixtures/report.html', import.meta.url).pathname, { outDir: out });
const types = html.project.slides.map((s) => s.blocks.map((b) => b.type).join(','));
assert.equal(html.slug, 'common-party');
assert.equal(html.project.slides[1].blocks[0].label, 'MEMBERSHIP', 'label above "Who joins"');
assert.ok(types[1].includes('stat,stat'), 'list of figures → big numbers');
assert.ok(html.project.slides.flatMap((s) => s.blocks).find((b) => b.type === 'quote' && b.by === 'Founding note'));
const saved = readFileSync(html.path, 'utf8');
assert.match(saved, /^---\ntitle: "Common Party"\nkind: "Presentation"\nformat: "deck"/);
assert.match(saved, /source: "document"/);
console.log('ok html → project file');

const txt = await importProject(new URL('./fixtures/notes.txt', import.meta.url).pathname, { outDir: out, kind: 'Report', format: 'report' });
assert.equal(txt.project.title, 'Uber');
assert.deepEqual(txt.project.slides.map((s) => s.blocks[0].text), ['Uber', 'Background', 'Takeaways']);
assert.ok(txt.project.slides[1].blocks.find((b) => b.type === 'stat' && b.value === '2,000'));
assert.match(readFileSync(txt.path, 'utf8'), /^## Background$/m, 'saved with the inferred headings, so the CMS shows them');
console.log('ok plain text → project file');

assert.equal(slugify('The algorithm behind Big Swing’n’ Picks'), 'the-algorithm-behind-big-swingn-picks');
assert.equal(slugify('Hesperia, CA'), 'hesperia-ca');
console.log('ok slugs');
console.log('\n' + outline(html.project));
